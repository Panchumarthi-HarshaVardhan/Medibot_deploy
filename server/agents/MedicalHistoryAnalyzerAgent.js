import BaseAgent from './BaseAgent.js';
import { isGroqConfigured, generateText, parseJsonFromText } from '../utils/groq.js';
import { loadPatientHistoryData, formatPrescriptionLine } from '../utils/patientHistory.js';
import dotenv from 'dotenv';

dotenv.config();

export function formatHistoryAnalysisText(result) {
  if (!result || typeof result !== 'object') return 'Medical history analysis is unavailable.';
  return [
    `Overall: ${result.overallHealthStatus || 'N/A'}`,
    '',
    'Key risk factors:',
    ...(result.keyRiskFactors?.length
      ? result.keyRiskFactors.map((r) => `• ${r}`)
      : ['• None listed']),
    '',
    'Chronic conditions:',
    ...(result.chronicConditions?.length
      ? result.chronicConditions.map((c) => `• ${c}`)
      : ['• None identified']),
    '',
    `Medication notes: ${result.medicationInteractionsOrWarnings || 'None'}`,
    '',
    'Recommendations:',
    ...(result.preventativeRecommendations?.length
      ? result.preventativeRecommendations.map((r) => `• ${r}`)
      : ['• Follow up with your healthcare provider']),
    '',
    `Summary for doctor: ${result.summaryForDoctor || 'N/A'}`,
  ].join('\n');
}

class MedicalHistoryAnalyzerAgent extends BaseAgent {
  constructor() {
    super('MedicalHistoryAnalyzerAgent', ['analyze_medical_history']);
  }

  async processMessage(fromAgentName, message) {
    if (fromAgentName === 'ChatbotAgent' && message.type === 'analyze_history') {
      return await this.execute(message.data);
    }
    return `[${this.name}] Received data from ${fromAgentName}`;
  }

  async execute(data) {
    let patientData = data || {};
    if (patientData.userId && !patientData.name) {
      try {
        patientData = await loadPatientHistoryData(patientData.userId);
      } catch (loadErr) {
        console.warn('MedicalHistoryAnalyzerAgent could not load patient:', loadErr.message);
        return {
          type: 'history_analysis',
          content: 'I could not load your medical records. Please try again after logging in.',
          overallHealthStatus: 'Unable to load records.',
          keyRiskFactors: [],
          chronicConditions: [],
          medicationInteractionsOrWarnings: 'N/A',
          preventativeRecommendations: ['Sign in and try again.'],
          summaryForDoctor: 'Patient records could not be loaded.',
          agent: this.name,
        };
      }
    }

    const { name, age, gender, medicalHistory, symptomChecks, prescriptions } = patientData;

    if (!isGroqConfigured()) {
      console.warn('MedicalHistoryAnalyzerAgent AI unavailable, using fallback');
      return this.getFallbackAnalysis(patientData);
    }

    const prompt = `
      You are an expert AI Medical History Analyzer.
      Analyze the following patient data and provide a comprehensive Health Summary & Analysis.
      
      Patient Name: ${name || 'Unknown'}
      Age: ${age || 'Unknown'}
      Gender: ${gender || 'Unknown'}
      
      Self-Reported Medical History (Chronic conditions, allergies, surgeries):
      ${medicalHistory || 'None reported.'}
      
      Recent Symptom Checks:
      ${symptomChecks && symptomChecks.length > 0 ? symptomChecks.map(c => `- Symptoms: ${c.symptoms} | AI Assessment: ${c.condition} (${c.severity}) | Date: ${new Date(c.createdAt).toLocaleDateString()}`).join('\n') : 'None'}
      
      Active Prescriptions:
      ${prescriptions && prescriptions.length > 0 ? prescriptions.map((p) => `- ${formatPrescriptionLine(p)}`).join('\n') : 'None'}
      
      Provide your response in raw JSON format (without markdown code blocks) with the following structure:
      {
        "overallHealthStatus": "A brief 1-2 sentence overview of their current health status.",
        "keyRiskFactors": ["risk 1", "risk 2"],
        "chronicConditions": ["condition 1"],
        "medicationInteractionsOrWarnings": "Any potential issues or 'None identified'",
        "preventativeRecommendations": ["rec 1", "rec 2"],
        "summaryForDoctor": "A concise, professional summary intended for a doctor reviewing this patient before an appointment."
      }
    `;

    try {
      const text = await generateText(prompt, { temperature: 0.2, maxTokens: 2048 });
      const analysisResult = parseJsonFromText(text);

      const merged = {
        type: 'history_analysis',
        ...analysisResult,
        agent: this.name,
      };
      merged.content = formatHistoryAnalysisText(merged);
      return merged;
    } catch (error) {
      console.warn('MedicalHistoryAnalyzerAgent error, using fallback:', error?.message || error);
      return this.getFallbackAnalysis(patientData);
    }
  }

  getFallbackAnalysis(data) {
    const result = {
      type: 'history_analysis',
      overallHealthStatus: 'Health status analysis is currently unavailable (AI fallback).',
      keyRiskFactors: ['Unable to analyze risk factors.'],
      chronicConditions: data.medicalHistory ? ['See self-reported medical history.'] : ['None identified'],
      medicationInteractionsOrWarnings: 'Unable to analyze interactions.',
      preventativeRecommendations: ['Maintain a balanced diet and regular exercise.', 'Follow up with your healthcare provider.'],
      summaryForDoctor: `Patient ${data.name || ''} has shared their history. Please review their self-reported medical history and active prescriptions directly.`,
      agent: this.name,
    };
    result.content = formatHistoryAnalysisText(result);
    return result;
  }
}

export default MedicalHistoryAnalyzerAgent;
