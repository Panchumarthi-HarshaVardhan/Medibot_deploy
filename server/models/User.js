import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  googleId: {
    type: String,
    default: null
  },
  password: {
    type: String,
    required: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  otpCode: {
    type: String,
    default: null
  },
  otpPurpose: {
    type: String,
    enum: ['signup', 'login', 'reset_password', null],
    default: null
  },
  otpExpiresAt: {
    type: Date,
    default: null
  },
  role: {
    type: String,
    enum: ['patient', 'doctor'],
    default: 'patient'
  },
  specialization: {
    type: String,
    default: null
  },
  phone: {
    type: String,
    default: null
  },
  profileImage: {
    type: String,
    default: null
  },
  age: {
    type: Number,
    default: null
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other', null],
    default: null
  },
  rating: {
    totalScore: { type: Number, default: 0 },
    count: { type: Number, default: 0 }
  },
  medicalHistory: {
    type: String,
    default: null
  }
}, { timestamps: true });

export default mongoose.model('User', userSchema);
