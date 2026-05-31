import BaseAgent from './BaseAgent.js';
import { isGroqConfigured, generateText, parseJsonFromText } from '../utils/groq.js';
import dotenv from 'dotenv';

dotenv.config();

class SymptomCheckerAgent extends BaseAgent {
  constructor() {
    super('SymptomCheckerAgent', ['symptom_analysis', 'severity_assessment', 'health_recommendations']);
  }

  async processMessage(fromAgentName, message) {
    if (fromAgentName === 'ChatbotAgent' && message.type === 'analyze_symptoms') {
      return await this.execute({
        symptoms: message.symptoms,
        age: message.age,
        gender: message.gender
      });
    }
    return `[${this.name}] Processed message from ${fromAgentName}`;
  }

  normalizeSymptomsInput(symptoms) {
    if (Array.isArray(symptoms)) {
      return symptoms.map((s) => String(s).trim()).filter(Boolean);
    }
    if (typeof symptoms === 'string' && symptoms.trim()) {
      return symptoms
        .split(/[,.\n]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 1);
    }
    return [];
  }

  async execute(input) {
    let symptoms, age, gender;
    
    if (typeof input === 'string') {
      symptoms = this.normalizeSymptomsInput(input);
      age = null;
      gender = null;
    } else {
      symptoms = this.normalizeSymptomsInput(input.symptoms);
      age = input.age;
      gender = input.gender;
    }

    if (!symptoms.length) {
      return {
        type: 'missing_information',
        message: 'Please describe at least one symptom (e.g. fever, headache, cough).',
        agent: this.name,
      };
    }

    const prompt = `You are a medical symptom checker agent. Analyze the following symptoms and provide a structured response.

Symptoms: ${symptoms.join(', ')}
Age: ${age || 'Not provided'}
Gender: ${gender || 'Not provided'}

Respond in the following JSON format only:
{
  "condition": "Likely condition or general assessment",
  "severity": "mild" | "moderate" | "severe",
  "advice": "Self-care advice",
  "recommendation": "Recommendation (e.g., Monitor symptoms, Consult a doctor, Seek emergency care)",
  "confidence": 0-100
}

Important notes:
- For severe symptoms (chest pain, difficulty breathing, severe bleeding, etc.), mark severity as "severe"
- Always advise seeking emergency care for life-threatening symptoms
- Keep advice concise and actionable
- Remember this is general guidance, not a diagnosis
- End all responses with a note to consult a healthcare professional for proper diagnosis`;

    try {
      if (!isGroqConfigured()) throw new Error('Groq API key missing');
      const text = await generateText(prompt, { temperature: 0.2 });
      const analysisResult = parseJsonFromText(text);

      // FIX: removed redundant sendMessage back-call to ChatbotAgent
      // ChatbotAgent already awaits the return value of sendMessage('SymptomCheckerAgent', ...)

      return {
        type: 'symptom_analysis',
        ...analysisResult,
        agent: this.name,
        disclaimer: '⚠️ This is general guidance only. Always consult a healthcare professional for medical advice.'
      };
    } catch (error) {
      console.warn('SymptomCheckerAgent AI unavailable, using fallback:', error?.message || error);
      const fallback = this.getFallbackAssessment(symptoms);

      return {
        type: 'symptom_analysis',
        ...fallback,
        confidence: 65,
        agent: this.name,
        disclaimer: '⚠️ This is general guidance only. Always consult a healthcare professional for medical advice.'
      };
    }
  }

  getFallbackAssessment(symptomsInput) {
    const symptoms = Array.isArray(symptomsInput)
      ? symptomsInput.map((s) => String(s).toLowerCase())
      : String(symptomsInput || '')
          .split(/[,.]/)
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);

    const severeKeywords = ['chest pain', 'difficulty breathing', 'shortness of breath', 'severe bleeding', 'unconscious'];
    const moderateKeywords = ['fever', 'persistent cough', 'vomiting', 'nausea', 'dizziness', 'body aches'];

    const hasSevere = symptoms.some((s) => severeKeywords.some((k) => s.includes(k)));
    const hasModerate = symptoms.some((s) => moderateKeywords.some((k) => s.includes(k)));

    if (hasSevere) {
      return {
        condition: 'Possible urgent medical condition',
        severity: 'severe',
        advice: 'Do not delay care. Stay with someone and avoid self-medicating for severe symptoms.',
        recommendation: 'Seek emergency medical care immediately.'
      };
    }

    if (hasModerate || symptoms.length >= 3) {
      return {
        condition: 'Likely moderate viral or inflammatory condition',
        severity: 'moderate',
        advice: 'Hydrate well, rest, and monitor symptoms every few hours.',
        recommendation: 'Consult a doctor soon, especially if symptoms worsen in 24 hours.'
      };
    }

    return {
      condition: 'Likely mild condition',
      severity: 'mild',
      advice: 'Rest, hydrate, and monitor your symptoms.',
      recommendation: 'Continue self-care and consult a doctor if symptoms persist.'
    };
  }
}

export default SymptomCheckerAgent;
