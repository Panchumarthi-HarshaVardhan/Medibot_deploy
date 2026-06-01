import BaseAgent from './BaseAgent.js';
import { isGroqConfigured, generateText, chatWithHistory, parseJsonFromText } from '../utils/groq.js';
import { formatHistoryAnalysisText } from './MedicalHistoryAnalyzerAgent.js';
import User from '../models/User.js';
import dotenv from 'dotenv';

dotenv.config();

const MAX_HISTORY_TURNS = 20; // sliding window per session

class ChatbotAgent extends BaseAgent {
  constructor() {
    super('ChatbotAgent', ['general_health_chat', 'greetings', 'emergency_guidance']);
    // FIX: per-session history (keyed by userId) instead of a single shared array
    this.sessionHistories = new Map(); // Map<userId, messages[]>
    this.pendingActions = new Map();   // Map<userId, { action, payload, timestamp }>
  }

  /** Called by the scheduler every 60s to evict stale pending actions */
  evictStalePendingActions() {
    const now = Date.now();
    for (const [userId, action] of this.pendingActions) {
      if (now - action.timestamp > 5 * 60 * 1000) {
        this.pendingActions.delete(userId);
      }
    }
  }

  _getHistory(userId) {
    if (!this.sessionHistories.has(userId)) {
      this.sessionHistories.set(userId, []);
    }
    return this.sessionHistories.get(userId);
  }

  _pushHistory(userId, role, text) {
    const history = this._getHistory(userId);
    history.push({ role, parts: [{ text }] });
    // Keep only the last MAX_HISTORY_TURNS turns (2 entries per turn)
    if (history.length > MAX_HISTORY_TURNS * 2) {
      history.splice(0, history.length - MAX_HISTORY_TURNS * 2);
    }
  }

  async processMessage(fromAgentName, message) {
    if (fromAgentName === 'SymptomCheckerAgent') {
      return `[${this.name}] Acknowledged Symptom Checker result: ${JSON.stringify(message)}`;
    }
    return `[${this.name}] Processed message from ${fromAgentName}`;
  }

  async execute(userInput, context = {}) {
    const userId = context.userId || 'anonymous';
    this._pushHistory(userId, 'user', userInput);

    // Check for pending action context (multi-turn conversation)
    const pending = this.pendingActions.get(userId);
    if (pending && (Date.now() - pending.timestamp) < 5 * 60 * 1000) {
      if (pending.action === 'prescribe_medicine' && !pending.payload.medication_details) {
        pending.payload.medication_details = userInput;
        pending.payload.dosage = pending.payload.dosage || this.extractDosageForPrescription(userInput);
        this.pendingActions.delete(userId);
        const doctorResult = await this.sendMessage('DoctorOperationsAgent', {
          type: 'doctor_action',
          payload: { ...pending.payload, operation: 'prescribe_medicine', doctor_id: pending.payload.doctor_id || context.userId || null }
        });
        return { type: doctorResult.type, content: doctorResult.message, data: doctorResult.prescription || doctorResult, agent: this.name };
      }
      this.pendingActions.delete(userId);
    }

    const routerPrompt = `Classify the user message into one action and extract data.
User message: "${userInput}"
Known context: ${JSON.stringify(context)}

Important: For date, accept ANY date format (YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, "June 3rd", "tomorrow", "today", etc.) and convert it to YYYY-MM-DD format.
For time, accept any 12-hour or 24-hour format and convert to HH:mm (24-hour).

Return JSON only:
{
  "action": "chat" | "symptom_check" | "book_appointment" | "medication_reminder" | "doctor_appointment_update" | "prescribe_medicine" | "analyze_history" | "update_history",
  "payload": {
    "symptoms": string[],
    "age": number | null,
    "gender": string | null,
    "doctor_name": string | null,
    "date": "YYYY-MM-DD" | null,
    "time": "HH:mm" | null,
    "reason": string | null,
    "patient_id": string | null,
    "name": string | null,
    "dosage": string | null,
    "timesPerDay": number | null,
    "duration": string | null,
    "times": string[] | null,
    "operation": "accept_appointment" | "reject_appointment" | null,
    "appointment_id": string | null,
    "patient_name": string | null,
    "medication_details": string | null,
    "doctor_id": string | null,
    "medical_history_text": string | null
  }
}`;

    try {
      let action = 'chat';
      let payload = {};
      try {
        if (!isGroqConfigured()) throw new Error('Groq API key missing');
        const routeText = await generateText(routerPrompt, { temperature: 0.1 });
        const route = parseJsonFromText(routeText);
        action = route.action || 'chat';
        payload = route.payload || {};
      } catch (routerError) {
        const fallbackRoute = this.getFallbackRoute(userInput, context);
        action = fallbackRoute.action;
        payload = fallbackRoute.payload;
        console.warn('Chatbot router AI unavailable, using fallback routing:', routerError?.message || routerError);
      }

      if (action === 'symptom_check') {
        const symptomResult = await this.sendMessage('SymptomCheckerAgent', {
          type: 'analyze_symptoms',
          symptoms: this.normalizeSymptoms(payload.symptoms, userInput),
          age: payload.age ?? context.age ?? null,
          gender: payload.gender ?? context.gender ?? null
        });
        if (symptomResult.type === 'missing_information' || symptomResult.type === 'agent_error') {
          return this.wrapAgentResult(symptomResult.type, symptomResult, symptomResult.message);
        }
        return this.wrapAgentResult('symptom_analysis', symptomResult, this.formatSymptomContent(symptomResult));
      }

      if (action === 'book_appointment') {
        const bookingResult = await this.sendMessage('AppointmentBookingAgent', {
          type: 'book_appointment',
          payload: { ...payload, patient_id: payload.patient_id || context.userId || null }
        });
        return this.wrapAgentResult(bookingResult.type, bookingResult, bookingResult.message);
      }

      if (action === 'medication_reminder') {
        const reminderResult = await this.sendMessage('MedicationReminderAgent', {
          type: 'create_medication_reminder',
          payload: { ...payload, user_id: payload.user_id || context.userId || null }
        });
        return this.wrapAgentResult(reminderResult.type, reminderResult, reminderResult.message);
      }

      if (action === 'analyze_history') {
        if (!context.userId) {
          return {
            type: 'history_analysis',
            content: 'Please log in so I can analyze your medical history.',
            agent: this.name,
          };
        }
        const historyResult = await this.sendMessage('MedicalHistoryAnalyzerAgent', {
          type: 'analyze_history',
          data: { userId: context.userId },
        });
        const summary =
          historyResult?.content ||
          formatHistoryAnalysisText(historyResult);
        return this.wrapAgentResult('history_analysis', historyResult, summary);
      }

      if (action === 'update_history') {
        if (!context.userId) {
          return {
            type: 'missing_information',
            content: 'Please log in so I can update your medical history.',
            agent: this.name,
          };
        }
        const text =
          payload.medical_history_text ||
          String(userInput || '').replace(/^(update|set)\s+(my\s+)?medical\s+history[:\s-]*/i, '').trim();
        if (!text) {
          return {
            type: 'missing_information',
            content: 'Please provide the medical history text to save.',
            agent: this.name,
          };
        }
        let updated = null;
        try {
          updated = await User.findByIdAndUpdate(
            context.userId,
            { medicalHistory: text },
            { new: true }
          );
        } catch (err) {
          return {
            type: 'error',
            content: 'I could not update your medical history right now. Please try again in a moment.',
            agent: this.name,
          };
        }
        if (!updated) {
          return {
            type: 'not_found',
            content: 'Could not find your account to update medical history.',
            agent: this.name,
          };
        }
        return {
          type: 'history_updated',
          content: 'Your medical history has been updated successfully.',
          data: { medicalHistory: updated.medicalHistory },
          agent: this.name,
        };
      }

      if (action === 'doctor_appointment_update' || action === 'prescribe_medicine') {
        const doctorResult = await this.sendMessage('DoctorOperationsAgent', {
          type: 'doctor_action',
          payload: {
            ...payload,
            operation: action === 'doctor_appointment_update' ? payload.operation || 'accept_appointment' : 'prescribe_medicine',
            doctor_id: payload.doctor_id || context.userId || null
          }
        });
        if (doctorResult.type === 'missing_information') {
          this.pendingActions.set(userId, { action, payload: { ...payload, doctor_id: context.userId }, timestamp: Date.now() });
        }
        return this.wrapAgentResult(doctorResult.type, doctorResult, doctorResult.message);
      }

      const isDoctor = context.userRole === 'doctor';
      const systemPrompt = `You are MediBot, a helpful health assistant talking to a ${isDoctor ? 'Doctor' : 'Patient'}.
Your role is to:
${isDoctor ? `
1. Assist the doctor with managing their appointments.
2. Help the doctor write prescriptions based on their inputs.
3. Keep responses professional, concise, and focused on medical administration.` : `
1. Answer general health questions for the patient.
2. Help the patient book appointments or set medication reminders.
3. Advise seeking emergency services for life-threatening symptoms.
4. Keep responses friendly, concise, and empathetic.`}
Important: If the user only says hi/hello/hey, reply briefly (one sentence) about what you can help with—do NOT repeat a full introduction if you already greeted them earlier in this chat.`;

      let text = '';
      if (isGroqConfigured()) {
        try {
          const priorHistory = this._getHistory(userId).slice(0, -1);
          text = await chatWithHistory(systemPrompt, priorHistory, userInput);
        } catch (chatError) {
          console.warn('Chatbot AI chat unavailable, using fallback response:', chatError?.message || chatError);
          text = this.getFallbackChatResponse(userInput);
        }
      } else {
        text = this.getFallbackChatResponse(userInput);
      }

      this._pushHistory(userId, 'model', text);
      return { type: 'chat_response', content: text, agent: this.name };
    } catch (error) {
      console.error('ChatbotAgent error:', error);
      return { type: 'chat_response', content: this.getFallbackChatResponse(userInput), agent: this.name };
    }
  }

  wrapAgentResult(type, data, content) {
    return {
      type: data?.type || type,
      content: content || data?.message || 'Action completed.',
      data,
      agent: this.name,
    };
  }

  normalizeSymptoms(symptoms, fallbackText) {
    if (Array.isArray(symptoms) && symptoms.length > 0) {
      return symptoms.map((s) => String(s).trim()).filter(Boolean);
    }
    const text = typeof symptoms === 'string' && symptoms.trim() ? symptoms : String(fallbackText || '');
    return text
      .split(/[,.\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 1);
  }

  formatSymptomContent(result) {
    if (!result?.condition) return result?.message || 'Symptom analysis completed.';
    return (
      `Condition: ${result.condition}\n` +
      `Severity: ${result.severity}\n` +
      `Advice: ${result.advice}\n` +
      `Recommendation: ${result.recommendation}\n\n` +
      `${result.disclaimer || '⚠️ This is general guidance only. Please consult a healthcare professional.'}`
    );
  }

  getFallbackRoute(userInput, context) {
    const input = String(userInput || '').toLowerCase();
    const symptomKeywords = ['symptom', 'fever', 'cough', 'headache', 'pain', 'vomiting', 'nausea', 'sore throat'];
    const appointmentKeywords = ['appointment', 'book', 'schedule', 'doctor'];
    const medicationKeywords = ['medicine', 'medication', 'reminder', 'pill', 'tablet', 'dose'];
    const doctorActionKeywords = ['accept', 'approve', 'reject', 'decline', 'cancel request'];
    const prescribeKeywords = ['prescribe', 'prescription', 'give prescription'];
    const historyKeywords = ['analyze my history', 'analyze history', 'medical history analysis', 'history analysis'];
    const updateHistoryKeywords = ['update my medical history', 'set my medical history', 'add to my medical history', 'medical history:'];

    if (historyKeywords.some((k) => input.includes(k))) {
      return { action: 'analyze_history', payload: {} };
    }
    if (updateHistoryKeywords.some((k) => input.includes(k))) {
      return {
        action: 'update_history',
        payload: {
          medical_history_text: String(userInput || '')
            .replace(/^(update|set|add to)\s+(my\s+)?medical\s+history[:\s-]*/i, '')
            .trim()
        }
      };
    }
    if (context.userRole === 'doctor' && prescribeKeywords.some((k) => input.includes(k))) {
      return { action: 'prescribe_medicine', payload: { doctor_id: context.userId || null, appointment_id: this.extractObjectId(input), patient_name: this.extractPatientName(userInput), medication_details: this.extractMedicationDetailsForPrescription(userInput), dosage: this.extractDosageForPrescription(userInput), instructions: this.extractInstructions(userInput), date: this.extractDate(userInput), time: this.extractTime(userInput) } };
    }
    if (context.userRole === 'doctor' && doctorActionKeywords.some((k) => input.includes(k)) && input.includes('appointment')) {
      return { action: 'doctor_appointment_update', payload: { doctor_id: context.userId || null, appointment_id: this.extractObjectId(input), patient_name: this.extractPatientName(userInput), operation: input.includes('reject') || input.includes('decline') ? 'reject_appointment' : 'accept_appointment', date: this.extractDate(userInput), time: this.extractTime(userInput) } };
    }
    if (appointmentKeywords.some((k) => input.includes(k))) {
      return { action: 'book_appointment', payload: { doctor_name: this.extractDoctorName(userInput), date: this.extractDate(userInput), time: this.extractTime(userInput), reason: this.extractReason(userInput), patient_id: context.userId || null } };
    }
    if (medicationKeywords.some((k) => input.includes(k))) {
      return { action: 'medication_reminder', payload: this.extractMedicationPayload(userInput, context) };
    }
    if (symptomKeywords.some((k) => input.includes(k))) {
      return { action: 'symptom_check', payload: { symptoms: this.extractSymptoms(input), age: context.age || null, gender: context.gender || null } };
    }
    return { action: 'chat', payload: {} };
  }

  extractSymptoms(input) {
    const known = ['fever', 'headache', 'cough', 'sore throat', 'fatigue', 'nausea', 'vomiting', 'body aches', 'chest pain'];
    return known.filter((k) => input.includes(k));
  }
  extractDoctorName(input) {
    const match = input.match(/dr\.?\s+([a-zA-Z\s]+?)(?=\s+on\s+\d{4}-\d{2}-\d{2}|\s+at\s+\d{1,2}:\d{2}|\s+for\s+|$)/i);
    return match ? match[1].trim().replace(/\s+/g, ' ') : null;
  }
  extractDate(input) {
    // Try YYYY-MM-DD first
    let match = input.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
    if (match) {
      return `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`;
    }
    // Try MM/DD/YYYY or DD/MM/YYYY (we'll assume MM/DD/YYYY for now, or check which part > 12)
    match = input.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{4}|\d{2})\b/);
    if (match) {
      let month, day, year;
      if (match[3].length === 2) {
        year = '20' + match[3];
      } else {
        year = match[3];
      }
      const m1 = Number(match[1]);
      const m2 = Number(match[2]);
      if (m1 > 12) {
        month = m2;
        day = m1;
      } else if (m2 > 12) {
        month = m1;
        day = m2;
      } else {
        // Default to MM/DD/YYYY
        month = m1;
        day = m2;
      }
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    // Try natural dates like "June 3", "June 3rd", "Jun 3 2025"
    let naturalDateMatch = input.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?/i);
    if (naturalDateMatch) {
      const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const monthName = naturalDateMatch[1].toLowerCase().substring(0, 3);
      const month = monthNames.indexOf(monthName) + 1;
      const day = Number(naturalDateMatch[2]);
      const year = naturalDateMatch[3] ? Number(naturalDateMatch[3]) : new Date().getFullYear();
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    // Try natural dates like "3 June", "3rd June", "3 June 2025"
    naturalDateMatch = input.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?(?:\s+(\d{4}))?/i);
    if (naturalDateMatch) {
      const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const monthName = naturalDateMatch[2].toLowerCase().substring(0, 3);
      const month = monthNames.indexOf(monthName) + 1;
      const day = Number(naturalDateMatch[1]);
      const year = naturalDateMatch[3] ? Number(naturalDateMatch[3]) : new Date().getFullYear();
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    // Try "tomorrow"
    if (/\btomorrow\b/i.test(input)) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    }
    // Try "today"
    if (/\btoday\b/i.test(input)) {
      const today = new Date();
      return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }
    return null;
  }
  extractTime(input) {
    const match = input.match(/\b(\d{1,2}):(\d{2})(?:\s?(am|pm))?\b/i);
    if (!match) return null;
    let hours = Number(match[1]); const minutes = match[2]; const meridian = (match[3] || '').toLowerCase();
    if (meridian === 'pm' && hours < 12) hours += 12;
    if (meridian === 'am' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${minutes}`;
  }
  extractReason(input) { const match = input.match(/\bfor\s+(.+)$/i); return match ? match[1].replace(/\.$/, '').trim() : 'General consultation'; }
  extractObjectId(input) { const match = input.match(/\b[a-f0-9]{24}\b/i); return match ? match[0] : null; }
  extractPatientName(input) { const match = input.match(/patient\s+([a-zA-Z\s]+?)(?=\s+on\s+\d{4}-\d{2}-\d{2}|\s+at\s+\d{1,2}:\d{2}|\s+appointment|\s+with|\s+for|$)/i); return match ? match[1].trim() : null; }
  extractMedicationDetailsForPrescription(input) {
    let match = input.match(/prescrib(?:e|ing)\s+(.+?)(?=\s+dosage[:\s]|\s+instructions?[:\s]|\s+for patient|\s+to patient|$)/i);
    if (match) return match[1].trim();
    match = input.match(/patient\s+[a-zA-Z\s]+?,\s*(.+?)(?=\s+dosage[:\s]|\s+instructions?[:\s]|$)/i);
    if (match) return match[1].trim();
    return null;
  }
  extractDosageForPrescription(input) { const match = input.match(/dosage[:\s]+(.+?)(?=\s+instructions?[:\s]|\s+for patient|\s+to patient|$)/i); return match ? match[1].trim() : null; }
  extractInstructions(input) { const match = input.match(/instructions?[:\s]+(.+?)(?=\s+for patient|\s+to patient|\s+on\s+\d{4}-\d{2}-\d{2}|\s+at\s+\d{1,2}:\d{2}|$)/i); return match ? match[1].trim() : null; }
  extractMedicationPayload(input, context) {
    const reminderTail = input.match(/reminder(?:s)?\s+for\s+(.+)/i);
    const parsingBase = reminderTail ? reminderTail[1] : input;
    const nameMatch = parsingBase.match(/^([a-zA-Z][a-zA-Z0-9\s-]*?)(?=\s+\d+\s?(?:mg|ml|mcg)|\s+\d+\s*(?:times|x)|\s+for\s+\d+\s*(?:day|days|week|weeks|month|months)|\s+at\s+\d{1,2}:\d{2}|$)/i);
    const dosageMatch = input.match(/\b\d+\s?(?:mg|ml|mcg|tablet|tablets|capsule|capsules)\b/i);
    const timesPerDayMatch = input.match(/\b(\d+)\s*(?:times|x)\s*(?:a|per)?\s*day\b/i);
    const durationMatch = input.match(/\bfor\s+(\d+\s*(?:day|days|week|weeks|month|months))\b/i);
    const timeMatches = [...input.matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g)].map(m => `${String(Number(m[1])).padStart(2, '0')}:${m[2]}`);
    return { user_id: context.userId || null, name: nameMatch ? nameMatch[1].trim() : null, dosage: dosageMatch ? dosageMatch[0] : '1 tablet', timesPerDay: timesPerDayMatch ? Number(timesPerDayMatch[1]) : Math.max(timeMatches.length, 1), duration: durationMatch ? durationMatch[1].trim() : '7 days', times: timeMatches };
  }
  getFallbackChatResponse(userInput) {
    const input = String(userInput || '').toLowerCase().trim();
    if (/^(hi|hello|hey|good morning|good afternoon)\b/.test(input)) {
      return 'How can I help you today?';
    }
    if (input.includes('update my medical history') || input.includes('set my medical history')) {
      return 'Sure — share your history text and I will save it to your profile.';
    }
    if (input.includes('analyze') && input.includes('history')) return 'To analyze your medical history, say "analyze my history" and I\'ll look at your symptom checks and prescriptions.';
    if (input.includes('accept appointment') || input.includes('reject appointment')) return 'For doctor actions, include patient name/date/time or appointment id so I can update the appointment request.';
    if (input.includes('prescribe')) return 'For prescriptions, provide medicine details and either appointment id or patient name, date, and time.';
    if (input.includes('emergency') || input.includes('chest pain') || input.includes('difficulty breathing')) return 'If this is an emergency symptom, please seek immediate medical care or call emergency services.';
    return 'I can help you check symptoms, book appointments, create medication reminders, or analyze your medical history. Tell me what you need.';
  }
  async invokeSymptomChecker(symptoms) {
    return await this.sendMessage('SymptomCheckerAgent', { type: 'analyze_symptoms', symptoms });
  }
}

export default ChatbotAgent;
