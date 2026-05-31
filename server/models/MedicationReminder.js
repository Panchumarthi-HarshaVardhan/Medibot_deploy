import mongoose from 'mongoose';

const medicationReminderSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    name: {
      type: String,
      required: true
    },
    dosage: {
      type: String,
      required: true
    },
    timesPerDay: {
      type: Number,
      default: 1
    },
    duration: {
      type: String,
      required: true
    },
    times: {
      type: [String],
      default: []
    },
    reminderEnabled: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

export default mongoose.model('MedicationReminder', medicationReminderSchema);
