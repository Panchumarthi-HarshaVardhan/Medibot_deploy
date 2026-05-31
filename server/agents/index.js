import ChatbotAgent from './ChatbotAgent.js';
import SymptomCheckerAgent from './SymptomCheckerAgent.js';
import AppointmentBookingAgent from './AppointmentBookingAgent.js';
import MedicationReminderAgent from './MedicationReminderAgent.js';
import DoctorOperationsAgent from './DoctorOperationsAgent.js';
import MedicalHistoryAnalyzerAgent from './MedicalHistoryAnalyzerAgent.js';

const chatbotAgent = new ChatbotAgent();
const symptomCheckerAgent = new SymptomCheckerAgent();
const appointmentBookingAgent = new AppointmentBookingAgent();
const medicationReminderAgent = new MedicationReminderAgent();
const doctorOperationsAgent = new DoctorOperationsAgent();
const medicalHistoryAnalyzerAgent = new MedicalHistoryAnalyzerAgent();

chatbotAgent.connectToAgent(symptomCheckerAgent);
chatbotAgent.connectToAgent(appointmentBookingAgent);
chatbotAgent.connectToAgent(medicationReminderAgent);
chatbotAgent.connectToAgent(doctorOperationsAgent);
chatbotAgent.connectToAgent(medicalHistoryAnalyzerAgent);

export { 
  chatbotAgent, 
  symptomCheckerAgent, 
  appointmentBookingAgent, 
  medicationReminderAgent, 
  doctorOperationsAgent,
  medicalHistoryAnalyzerAgent
};
