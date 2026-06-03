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
  "specialistType": "The type of specialist doctor to consult (e.g., General Physician, Cardiologist, Pulmonologist, Dermatologist, Neurologist, Gastroenterologist, Orthopedist, ENT Specialist, Ophthalmologist, Psychiatrist, Endocrinologist, Urologist, Gynecologist, Allergist, Rheumatologist)",
  "specialistReason": "Brief 1-2 sentence explanation of why this specialist is recommended based on the symptoms",
  "confidence": 0-100
}

Important notes:
- For severe symptoms (chest pain, difficulty breathing, severe bleeding, etc.), mark severity as "severe"
- Always advise seeking emergency care for life-threatening symptoms
- Keep advice concise and actionable
- Choose the most appropriate specialist based on the primary symptoms
- For general/mild symptoms, recommend "General Physician"
- Remember this is general guidance, not a diagnosis
- End all responses with a note to consult a healthcare professional for proper diagnosis`;

    try {
      if (!isGroqConfigured()) throw new Error('Groq API key missing');
      const text = await generateText(prompt, { temperature: 0.2 });
      const analysisResult = parseJsonFromText(text);

      return {
        type: 'symptom_analysis',
        ...analysisResult,
        specialistType: analysisResult.specialistType || 'General Physician',
        specialistReason: analysisResult.specialistReason || 'A general physician can evaluate your symptoms and refer you to a specialist if needed.',
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

    // Specialist mapping for fallback
    const specialistMap = [
      { keywords: ['chest pain', 'heart', 'palpitations', 'blood pressure'], specialist: 'Cardiologist', reason: 'Your symptoms may be related to cardiovascular health and should be evaluated by a heart specialist.' },
      { keywords: ['breathing', 'cough', 'asthma', 'wheezing', 'lung'], specialist: 'Pulmonologist', reason: 'Your respiratory symptoms should be evaluated by a lung specialist.' },
      { keywords: ['skin', 'rash', 'acne', 'itching', 'hives', 'eczema'], specialist: 'Dermatologist', reason: 'Your skin-related symptoms are best evaluated by a dermatology specialist.' },
      { keywords: ['headache', 'migraine', 'numbness', 'tingling', 'seizure', 'memory'], specialist: 'Neurologist', reason: 'Your neurological symptoms should be assessed by a brain and nerve specialist.' },
      { keywords: ['stomach', 'abdominal', 'diarrhea', 'constipation', 'bloating', 'acid reflux', 'nausea', 'vomiting'], specialist: 'Gastroenterologist', reason: 'Your digestive symptoms should be evaluated by a gastrointestinal specialist.' },
      { keywords: ['joint', 'back pain', 'bone', 'muscle pain', 'fracture', 'sprain'], specialist: 'Orthopedist', reason: 'Your musculoskeletal symptoms should be examined by a bone and joint specialist.' },
      { keywords: ['ear', 'throat', 'sore throat', 'sinus', 'nose', 'hearing', 'tonsil'], specialist: 'ENT Specialist', reason: 'Your ear, nose, or throat symptoms are best evaluated by an ENT specialist.' },
      { keywords: ['eye', 'vision', 'blurry', 'eye pain'], specialist: 'Ophthalmologist', reason: 'Your eye-related symptoms should be examined by an eye specialist.' },
      { keywords: ['anxiety', 'depression', 'stress', 'insomnia', 'panic', 'mood'], specialist: 'Psychiatrist', reason: 'Your mental health symptoms should be discussed with a mental health specialist.' },
      { keywords: ['diabetes', 'thyroid', 'hormone', 'weight gain', 'fatigue'], specialist: 'Endocrinologist', reason: 'Your symptoms may be related to hormonal or metabolic conditions that an endocrinologist can evaluate.' },
      { keywords: ['urinary', 'kidney', 'bladder', 'urine'], specialist: 'Urologist', reason: 'Your urinary symptoms should be evaluated by a urological specialist.' },
      { keywords: ['allergy', 'allergic', 'sneezing', 'runny nose', 'hay fever'], specialist: 'Allergist', reason: 'Your allergy symptoms should be evaluated by an allergy and immunology specialist.' },
    ];

    let specialist = 'General Physician';
    let specialistReason = 'A general physician can evaluate your symptoms comprehensively and refer you to a specialist if needed.';

    for (const mapping of specialistMap) {
      if (symptoms.some((s) => mapping.keywords.some((k) => s.includes(k)))) {
        specialist = mapping.specialist;
        specialistReason = mapping.reason;
        break;
      }
    }

    if (hasSevere) {
      return {
        condition: 'Possible urgent medical condition',
        severity: 'severe',
        advice: 'Do not delay care. Stay with someone and avoid self-medicating for severe symptoms.',
        recommendation: 'Seek emergency medical care immediately.',
        specialistType: specialist,
        specialistReason: specialistReason
      };
    }

    if (hasModerate || symptoms.length >= 3) {
      return {
        condition: 'Likely moderate viral or inflammatory condition',
        severity: 'moderate',
        advice: 'Hydrate well, rest, and monitor symptoms every few hours.',
        recommendation: 'Consult a doctor soon, especially if symptoms worsen in 24 hours.',
        specialistType: specialist,
        specialistReason: specialistReason
      };
    }

    return {
      condition: 'Likely mild condition',
      severity: 'mild',
      advice: 'Rest, hydrate, and monitor your symptoms.',
      recommendation: 'Continue self-care and consult a doctor if symptoms persist.',
      specialistType: specialist,
      specialistReason: specialistReason
    };
  }
}

export default SymptomCheckerAgent;
