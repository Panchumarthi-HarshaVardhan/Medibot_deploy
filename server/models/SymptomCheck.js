import mongoose from 'mongoose';

const symptomCheckSchema = new mongoose.Schema({
  patient_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  symptoms: {
    type: String,
    required: true
  },
  condition: {
    type: String
  },
  severity: {
    type: String,
    enum: ['mild', 'moderate', 'severe']
  },
  advice: {
    type: String
  },
  recommendation: {
    type: String
  }
}, { timestamps: true });

export default mongoose.model('SymptomCheck', symptomCheckSchema);
