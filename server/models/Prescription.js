import mongoose from 'mongoose';

const prescriptionSchema = new mongoose.Schema({
  appointment_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: true
  },
  patient_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  doctor_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  medication_details: {
    type: String,
    required: true
  },
  dosage: {
    type: String
  },
  duration: {
    type: String,
    default: null
  },
  times_per_day: {
    type: Number,
    default: null
  },
  instructions: {
    type: String
  }
}, { timestamps: true });

export default mongoose.model('Prescription', prescriptionSchema);
