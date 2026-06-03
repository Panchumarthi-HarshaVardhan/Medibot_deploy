import mongoose from 'mongoose';

const medicalRecordSchema = new mongoose.Schema({
  patient_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  uploaded_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  fileData: {
    type: String,
    required: true
  },
  aiAnalysis: {
    summary: { type: String, default: null },
    conditions: [{ type: String }],
    medications: [{ type: String }],
    labResults: [{ type: String }],
    keyFindings: [{ type: String }],
    recommendations: [{ type: String }]
  },
  status: {
    type: String,
    enum: ['pending', 'analyzed', 'error'],
    default: 'pending'
  }
}, { timestamps: true });

export default mongoose.model('MedicalRecord', medicalRecordSchema);
