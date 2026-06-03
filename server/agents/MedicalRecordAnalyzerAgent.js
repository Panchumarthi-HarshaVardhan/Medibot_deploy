import BaseAgent from './BaseAgent.js';
import { isGroqConfigured, generateText, parseJsonFromText } from '../utils/groq.js';
import dotenv from 'dotenv';

dotenv.config();

class MedicalRecordAnalyzerAgent extends BaseAgent {
  constructor() {
    super('MedicalRecordAnalyzerAgent', ['analyze_medical_record']);
  }

  async processMessage(fromAgentName, message) {
    if (message.type === 'analyze_record') {
      return await this.execute(message.data);
    }
    return `[${this.name}] Received data from ${fromAgentName}`;
  }

  /**
   * Extract readable text content from a Base64-encoded file.
   * For text/plain and CSV files we decode directly.
   * For PDFs and images we extract whatever text is embedded in the Base64.
   * (Full OCR / PDF parsing would require additional libraries like pdf-parse;
   *  for now we do best-effort text extraction.)
   */
  extractTextFromFile(fileData, fileType, fileName) {
    try {
      // For text-based files, decode the Base64 directly
      if (
        fileType === 'text/plain' ||
        fileType === 'text/csv' ||
        fileType === 'application/json' ||
        fileType.startsWith('text/')
      ) {
        return Buffer.from(fileData, 'base64').toString('utf-8');
      }

      // For PDF files, attempt to extract embedded text
      if (fileType === 'application/pdf') {
        const raw = Buffer.from(fileData, 'base64').toString('latin1');
        // Simple extraction of text streams from PDF
        const textParts = [];
        const streamRegex = /stream\s*\n?([\s\S]*?)\nendstream/g;
        let match;
        while ((match = streamRegex.exec(raw)) !== null) {
          const chunk = match[1];
          // Filter for printable ASCII content
          const printable = chunk.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s{3,}/g, ' ').trim();
          if (printable.length > 20) {
            textParts.push(printable);
          }
        }
        // Also try extracting parenthesized text (PDF text objects)
        const textObjRegex = /\(([^)]{2,})\)/g;
        while ((match = textObjRegex.exec(raw)) !== null) {
          const text = match[1].replace(/\\/g, '');
          if (text.length > 2 && /[a-zA-Z]/.test(text)) {
            textParts.push(text);
          }
        }
        if (textParts.length > 0) {
          return textParts.join('\n').slice(0, 8000);
        }
        return `[PDF file: ${fileName}] — Could not extract text content. The file may contain scanned images. Key metadata: file size indicates a medical document.`;
      }

      // For image files, we can't extract text without OCR
      if (fileType.startsWith('image/')) {
        return `[Image file: ${fileName}] — This appears to be a medical image/scan. File type: ${fileType}. Unable to extract text without OCR. Please describe the key findings from this image.`;
      }

      return `[File: ${fileName}] — File type: ${fileType}. Unable to extract text content from this format.`;
    } catch (err) {
      console.warn('MedicalRecordAnalyzerAgent text extraction error:', err.message);
      return `[File: ${fileName}] — Error extracting content: ${err.message}`;
    }
  }

  async execute(data) {
    const { fileData, fileType, fileName, patientName, patientAge, patientGender } = data;

    const extractedText = this.extractTextFromFile(fileData, fileType, fileName);

    const prompt = `You are an expert medical record analyzer. You have received a medical document for a patient. 
Analyze the content and extract structured medical information.

Patient Name: ${patientName || 'Unknown'}
Patient Age: ${patientAge || 'Unknown'}
Patient Gender: ${patientGender || 'Unknown'}
File Name: ${fileName}
File Type: ${fileType}

Document Content:
${extractedText.slice(0, 6000)}

Based on this document, provide a structured analysis in raw JSON format (without markdown code blocks):
{
  "summary": "Brief 2-3 sentence summary of what this document contains and its key findings",
  "conditions": ["List of medical conditions, diagnoses, or diseases mentioned"],
  "medications": ["List of medications, drugs, or treatments mentioned with dosages if available"],
  "labResults": ["List of lab test results with values, e.g. 'Blood Glucose: 126 mg/dL (High)'"],
  "keyFindings": ["Important clinical findings, observations, or notes"],
  "recommendations": ["Doctor's recommendations, follow-up instructions, or next steps mentioned"]
}

Important:
- Extract ONLY information explicitly mentioned in the document
- If a category has no relevant information, use an empty array []
- For lab results, include reference ranges and flag abnormal values
- Keep each item concise but informative
- If the document text is unreadable or minimal, still provide your best analysis based on available context`;

    try {
      if (!isGroqConfigured()) throw new Error('Groq API key missing');
      const text = await generateText(prompt, { temperature: 0.1, maxTokens: 2048 });
      const analysisResult = parseJsonFromText(text);

      return {
        type: 'record_analysis',
        status: 'analyzed',
        analysis: {
          summary: analysisResult.summary || 'Analysis complete.',
          conditions: Array.isArray(analysisResult.conditions) ? analysisResult.conditions : [],
          medications: Array.isArray(analysisResult.medications) ? analysisResult.medications : [],
          labResults: Array.isArray(analysisResult.labResults) ? analysisResult.labResults : [],
          keyFindings: Array.isArray(analysisResult.keyFindings) ? analysisResult.keyFindings : [],
          recommendations: Array.isArray(analysisResult.recommendations) ? analysisResult.recommendations : []
        },
        agent: this.name
      };
    } catch (error) {
      console.warn('MedicalRecordAnalyzerAgent AI error, using fallback:', error?.message || error);
      return this.getFallbackAnalysis(fileName, fileType, extractedText);
    }
  }

  getFallbackAnalysis(fileName, fileType, extractedText) {
    const hasContent = extractedText && extractedText.length > 50 && !extractedText.startsWith('[');

    return {
      type: 'record_analysis',
      status: 'analyzed',
      analysis: {
        summary: hasContent
          ? `Medical document "${fileName}" uploaded successfully. AI detailed analysis is currently unavailable, but the document has been stored for review.`
          : `Medical document "${fileName}" (${fileType}) uploaded. Text extraction was limited — the file may contain scanned images or non-text content.`,
        conditions: [],
        medications: [],
        labResults: [],
        keyFindings: hasContent
          ? ['Document contains text content that should be reviewed by a healthcare provider.']
          : ['Document stored for manual review by healthcare provider.'],
        recommendations: ['Please review the original document for detailed information.']
      },
      agent: this.name
    };
  }
}

export default MedicalRecordAnalyzerAgent;
