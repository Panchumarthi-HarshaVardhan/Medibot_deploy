import ChatbotAgent from './ChatbotAgent.js';
import SymptomCheckerAgent from './SymptomCheckerAgent.js';
import AppointmentBookingAgent from './AppointmentBookingAgent.js';
import MedicationReminderAgent from './MedicationReminderAgent.js';
import DoctorOperationsAgent from './DoctorOperationsAgent.js';
import MedicalHistoryAnalyzerAgent from './MedicalHistoryAnalyzerAgent.js';
import MedicalRecordAnalyzerAgent from './MedicalRecordAnalyzerAgent.js';

const chatbotAgent = new ChatbotAgent();
const symptomCheckerAgent = new SymptomCheckerAgent();
const appointmentBookingAgent = new AppointmentBookingAgent();
const medicationReminderAgent = new MedicationReminderAgent();
const doctorOperationsAgent = new DoctorOperationsAgent();
const medicalHistoryAnalyzerAgent = new MedicalHistoryAnalyzerAgent();
const medicalRecordAnalyzerAgent = new MedicalRecordAnalyzerAgent();

chatbotAgent.connectToAgent(symptomCheckerAgent);
chatbotAgent.connectToAgent(appointmentBookingAgent);
chatbotAgent.connectToAgent(medicationReminderAgent);
chatbotAgent.connectToAgent(doctorOperationsAgent);
chatbotAgent.connectToAgent(medicalHistoryAnalyzerAgent);
chatbotAgent.connectToAgent(medicalRecordAnalyzerAgent);

export { 
  chatbotAgent, 
  symptomCheckerAgent, 
  appointmentBookingAgent, 
  medicationReminderAgent, 
  doctorOperationsAgent,
  medicalHistoryAnalyzerAgent,
  medicalRecordAnalyzerAgent
};
