import User from '../models/User.js';
import SymptomCheck from '../models/SymptomCheck.js';
import Prescription from '../models/Prescription.js';

/** Load patient profile + recent checks + prescriptions for history analysis agents. */
export async function loadPatientHistoryData(userId) {
  if (!userId) {
    throw new Error('User ID is required to load medical history');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const symptomChecks = await SymptomCheck.find({ patient_id: userId })
    .sort({ createdAt: -1 })
    .limit(5);
  const prescriptions = await Prescription.find({ patient_id: userId }).sort({ createdAt: -1 });

  return {
    userId: user._id.toString(),
    name: user.name,
    age: user.age,
    gender: user.gender,
    medicalHistory: user.medicalHistory,
    symptomChecks: symptomChecks.map((c) => c.toObject()),
    prescriptions: prescriptions.map((p) => p.toObject()),
  };
}

export function formatPrescriptionLine(p) {
  const parts = [p.medication_details || 'Unknown medication'];
  if (p.dosage) parts.push(p.dosage);
  if (p.times_per_day) parts.push(`${p.times_per_day}x/day`);
  if (p.duration) parts.push(`for ${p.duration}`);
  if (p.instructions) parts.push(`(${p.instructions})`);
  return parts.join(' — ');
}
