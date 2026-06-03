export interface User {
  id: string;
  name: string;
  email: string;
  role: 'patient' | 'doctor';
  specialization?: string | null;
  avatar?: string;
  phone?: string;
  profileImage?: string;
  medicalHistory?: string | null;
  age?: number | null;
  gender?: 'male' | 'female' | 'other' | null;
  averageRating?: number;
  ratingCount?: number;
  token?: string; // JWT issued by server
}

export interface Appointment {
  id: string;
  _id?: string;
  patientName: string;
  patientId?: string | number;
  doctorId?: string | number;
  age: number;
  gender: string;
  specialization: string;
  doctorName: string;
  date: string;
  time: string;
  status: 'pending' | 'accepted' | 'confirmed' | 'completed' | 'cancelled';
  reason?: string;
  rating?: number | null;
  sharedHistory?: string;
}

export interface Prescription {
  id: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  doctorName?: string;
  patientName?: string;
  medicationDetails: string; // Legacy
  dosage: string; // Legacy
  duration?: string; // Legacy
  timesPerDay?: number; // Legacy
  instructions: string; // Legacy
  medications?: {
    name: string;
    dosage: string;
    duration?: string;
    timesPerDay?: number;
    instructions?: string;
    reminderTimes?: string[];
  }[];
  createdAt: string;
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  timesPerDay: number;
  duration: string;
  reminderEnabled: boolean;
  times: string[];
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

export interface SymptomResult {
  condition: string;
  advice: string;
  severity: 'mild' | 'moderate' | 'severe';
  recommendation: string;
  specialistType?: string;
  specialistReason?: string;
}

export interface HealthTip {
  id: string;
  category: 'diet' | 'exercise' | 'mental-health' | 'sleep';
  title: string;
  description: string;
  icon: string;
}

export interface ProfileData {
  _id: string;
  name: string;
  email: string;
  role: 'patient' | 'doctor';
  specialization?: string | null;
  createdAt: string;
  phone?: string;
  profileImage?: string;
  averageRating?: number;
  ratingCount?: number;
  stats: {
    totalAppointments: number;
    completedAppointments: number;
    pendingAppointments?: number;
    prescriptionsWritten?: number;
    activeMedications?: number;
    totalPrescriptions?: number;
  };
}
