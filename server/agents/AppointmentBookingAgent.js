import BaseAgent from './BaseAgent.js';
import Appointment from '../models/Appointment.js';
import User from '../models/User.js';

class AppointmentBookingAgent extends BaseAgent {
  constructor() {
    super('AppointmentBookingAgent', ['appointment_booking', 'doctor_lookup']);
  }

  async processMessage(fromAgentName, message) {
    if (fromAgentName === 'ChatbotAgent' && message.type === 'book_appointment') {
      return await this.execute(message.payload);
    }
    return `[${this.name}] Processed message from ${fromAgentName}`;
  }

  async execute(input) {
    try {
      const patientId = input.patient_id || input.patientId || input.userId;
      const doctorNameRaw = input.doctor_name || input.doctorName;
      const date = input.date;
      const time = input.time;
      const reason = input.reason || 'General consultation';

      if (!patientId) {
        return {
          type: 'missing_information',
          missingFields: ['patient_id'],
          message: 'Please login first so I can book the appointment under your account.',
          agent: this.name
        };
      }

      if (!doctorNameRaw || !date || !time) {
        return {
          type: 'missing_information',
          missingFields: [
            !doctorNameRaw ? 'doctor_name' : null,
            !date ? 'date' : null,
            !time ? 'time' : null
          ].filter(Boolean),
          message:
            'Please provide doctor name, date (YYYY-MM-DD), and time (HH:mm or HH:mm:ss) to book the appointment.',
          agent: this.name
        };
      }

      const doctorName = doctorNameRaw.trim();
      const doctor = await User.findOne({
        role: 'doctor',
        name: { $regex: new RegExp(`^${doctorName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      });
      const fuzzyDoctor =
        doctor ||
        (await User.findOne({
          role: 'doctor',
          name: { $regex: new RegExp(doctorName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
        }));

      if (!fuzzyDoctor) {
        return {
          type: 'booking_failed',
          message: `I could not find a doctor named "${doctorName}". Please share the exact doctor name.`,
          agent: this.name
        };
      }

      const normalizedTime = time.length === 5 ? `${time}:00` : time;
      const appointment = new Appointment({
        patient_id: patientId,
        doctor_id: fuzzyDoctor._id,
        doctor_name: fuzzyDoctor.name,
        specialization: fuzzyDoctor.specialization || null,
        date,
        time: normalizedTime,
        reason
      });
      await appointment.save();

      return {
        type: 'appointment_booked',
        message: `Appointment booked with Dr. ${fuzzyDoctor.name} on ${date} at ${normalizedTime}.`,
        appointment: {
          id: appointment._id,
          doctor_name: appointment.doctor_name,
          date: appointment.date,
          time: appointment.time,
          reason: appointment.reason
        },
        agent: this.name
      };
    } catch (error) {
      console.error('AppointmentBookingAgent error:', error);
      return {
        type: 'error',
        message: 'I could not complete the appointment booking. Please try again.',
        agent: this.name
      };
    }
  }
}

export default AppointmentBookingAgent;
