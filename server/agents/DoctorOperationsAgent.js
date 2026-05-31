import BaseAgent from './BaseAgent.js';
import Appointment from '../models/Appointment.js';
import Prescription from '../models/Prescription.js';
import User from '../models/User.js';

class DoctorOperationsAgent extends BaseAgent {
  constructor() {
    super('DoctorOperationsAgent', ['appointment_management', 'prescription_management']);
  }

  async processMessage(fromAgentName, message) {
    if (fromAgentName === 'ChatbotAgent' && message.type === 'doctor_action') {
      return await this.execute(message.payload);
    }
    return `[${this.name}] Processed message from ${fromAgentName}`;
  }

  async execute(input) {
    try {
      console.log('DoctorOperationsAgent input:', input);
      const operation = input.operation;
      if (operation === 'accept_appointment' || operation === 'reject_appointment') {
        return await this.handleAppointmentAction(input);
      }
      if (operation === 'prescribe_medicine') {
        return await this.handlePrescription(input);
      }

      return {
        type: 'unsupported_action',
        message: 'I could not identify the doctor action. Please ask to accept/reject appointment or prescribe medicine.',
        agent: this.name
      };
    } catch (error) {
      console.error('DoctorOperationsAgent error:', error);
      return {
        type: 'error',
        message: 'Doctor operation failed. Please try again.',
        agent: this.name
      };
    }
  }

  async handleAppointmentAction(input) {
    const doctorId = input.doctor_id || input.user_id;
    if (!doctorId) {
      return {
        type: 'missing_information',
        missingFields: ['doctor_id'],
        message: 'Please login as doctor to manage appointment requests.',
        agent: this.name
      };
    }

    const target = await this.findDoctorAppointment(input, doctorId, true);
    if (!target) {
      return {
        type: 'not_found',
        message: 'No matching pending appointment found to update.',
        agent: this.name
      };
    }

    const nextStatus = input.operation === 'accept_appointment' ? 'accepted' : 'cancelled';
    target.status = nextStatus;
    await target.save();

    return {
      type: 'appointment_updated',
      message: `Appointment ${nextStatus} successfully.`,
      appointment: {
        id: target._id,
        status: target.status,
        date: target.date,
        time: target.time
      },
      agent: this.name
    };
  }

  async handlePrescription(input) {
    const doctorId = input.doctor_id || input.user_id;
    console.log('handlePrescription doctorId:', doctorId);
    if (!doctorId) {
      return {
        type: 'missing_information',
        missingFields: ['doctor_id'],
        message: 'Please login as doctor to prescribe medicines.',
        agent: this.name
      };
    }

    if (!input.medication_details) {
      return {
        type: 'missing_information',
        missingFields: ['medication_details'],
        message: 'Please provide medicine details to create a prescription.',
        agent: this.name
      };
    }

    const appointment = await this.findDoctorAppointment(input, doctorId, false);
    console.log('handlePrescription found appointment:', appointment);
    if (!appointment) {
      return {
        type: 'not_found',
        message: 'No matching appointment found for prescribing medicine.',
        agent: this.name
      };
    }

    const prescription = new Prescription({
      appointment_id: appointment._id,
      patient_id: appointment.patient_id,
      doctor_id: doctorId,
      medication_details: input.medication_details,
      dosage: input.dosage || 'As advised',
      instructions: input.instructions || ''
    });
    await prescription.save();

    appointment.status = 'completed';
    await appointment.save();

    return {
      type: 'prescription_created',
      message: 'Prescription sent successfully and appointment marked as completed.',
      prescription: {
        id: prescription._id,
        appointment_id: appointment._id,
        medication_details: prescription.medication_details,
        dosage: prescription.dosage,
        instructions: prescription.instructions
      },
      agent: this.name
    };
  }

  async findDoctorAppointment(input, doctorId, pendingOnly) {
    console.log('findDoctorAppointment input:', input, 'doctorId:', doctorId, 'pendingOnly:', pendingOnly);
    if (input.appointment_id) {
      const byId = await Appointment.findOne({ _id: input.appointment_id, doctor_id: doctorId });
      console.log('findDoctorAppointment byId:', byId);
      if (byId && (!pendingOnly || byId.status === 'pending')) {
        return byId;
      }
    }

    const query = { doctor_id: doctorId };
    if (pendingOnly) {
      query.status = 'pending';
    } else {
      query.status = { $in: ['accepted', 'confirmed', 'pending'] };
    }

    if (input.patient_name) {
      const patient = await User.findOne({
        role: 'patient',
        name: { $regex: new RegExp(input.patient_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
      });
      console.log('findDoctorAppointment patient:', patient);
      if (!patient) return null;
      query.patient_id = patient._id;
    }

    if (input.date) {
      const dayStart = new Date(`${input.date}T00:00:00.000Z`);
      const dayEnd = new Date(`${input.date}T23:59:59.999Z`);
      query.date = { $gte: dayStart, $lte: dayEnd };
    }

    if (input.time) {
      query.time = input.time.length === 5 ? `${input.time}:00` : input.time;
    }
    console.log('findDoctorAppointment final query:', query);

    const found = await Appointment.findOne(query).sort({ createdAt: -1 });
    console.log('findDoctorAppointment found:', found);
    return found;
  }
}

export default DoctorOperationsAgent;
