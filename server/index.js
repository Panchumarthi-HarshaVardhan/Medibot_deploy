import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { OAuth2Client } from 'google-auth-library';
import mongoose from 'mongoose';
import connectDB from './db.js';
import User from './models/User.js';
import Appointment from './models/Appointment.js';
import Prescription from './models/Prescription.js';
import MedicationReminder from './models/MedicationReminder.js';
import SymptomCheck from './models/SymptomCheck.js';
import MedicalRecord from './models/MedicalRecord.js';
import { chatbotAgent, symptomCheckerAgent, medicationReminderAgent, medicalHistoryAnalyzerAgent, medicalRecordAnalyzerAgent } from './agents/index.js';
import { sendOtpEmail, sendMedicationReminderEmail } from './utils/email.js';
import voiceRouter from './routes/voice.js';
import path from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const FRONTEND_ORIGINS = (process.env.FRONTEND_URL ||
  'http://localhost:5173,http://localhost:8080')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// ── CORS ─────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow all origins in development, or specific origins in production
      const isDev = process.env.NODE_ENV !== 'production';
      if (isDev || !origin || FRONTEND_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`[cors] Blocked origin: ${origin}. Allowed: ${FRONTEND_ORIGINS.join(', ')}`);
        callback(null, true); // Allow for now to avoid CORS issues on Render; restrict later if needed
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

connectDB();

// Google Cloud TTS route (public)
app.use('/api/voice', voiceRouter);

// ── Rate Limiting ─────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 min
  max: 20,
  message: { error: 'Too many requests, please try again later.' }
});
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 15,
  message: { error: 'AI rate limit exceeded, please wait a moment.' }
});

// ── JWT Middleware ────────────────────────────────────────────────────────────
const requireAuth = (req, res, next) => {
  console.log('\n[requireAuth] New request:', req.method, req.url);
  console.log('[requireAuth] All headers:', Object.fromEntries(Object.entries(req.headers)));
  console.log('[requireAuth] Authorization header:', req.headers.authorization);
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('[requireAuth] ❌ No or invalid Authorization header');
    return res.status(401).json({ error: 'Authentication required' });
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('[requireAuth] ✅ Valid token, decoded:', decoded);
    req.user = decoded; // { id, email, role }
    next();
  } catch (err) {
    console.error('[requireAuth] ❌ JWT error:', err);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const issueToken = (user) =>
  jwt.sign({ id: user._id.toString(), email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

// ── Medication Reminder Scheduling ───────────────────────────────────────────
const scheduledReminders = new Map();

function scheduleEmailReminder(reminder, userEmail) {
  const reminderId = reminder._id.toString();
  
  if (scheduledReminders.has(reminderId)) {
    scheduledReminders.get(reminderId).forEach(t => t.stop());
    scheduledReminders.delete(reminderId);
  }
  
  if (!reminder.reminderEnabled || !reminder.times || reminder.times.length === 0) return;
  
  const tasks = [];
  
  reminder.times.forEach(timeStr => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const task = cron.schedule(`${minutes} ${hours} * * *`, async () => {
      await sendMedicationReminderEmail(userEmail, reminder.name, reminder.dosage, timeStr);
    });
    tasks.push(task);
  });
  
  scheduledReminders.set(reminderId, tasks);
}

async function rescheduleAllReminders() {
  try {
    const activeReminders = await MedicationReminder.find({ reminderEnabled: true });
    for (const reminder of activeReminders) {
      const user = await User.findById(reminder.user_id);
      if (user?.email) scheduleEmailReminder(reminder, user.email);
    }
    console.log(`[scheduler] Rescheduled ${activeReminders.length} active medication reminders`);
  } catch (err) {
    console.error('[scheduler] Error rescheduling reminders:', err);
  }
}
setTimeout(rescheduleAllReminders, 3000);

// ── pendingActions TTL eviction ───────────────────────────────────────────────
// (ChatbotAgent's pendingActions Map is cleaned below)
setInterval(() => {
  chatbotAgent.evictStalePendingActions?.();
}, 60_000);

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const getGoogleClientId = () => process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || null;
const getGoogleClient = () => {
  const clientId = getGoogleClientId();
  return clientId ? new OAuth2Client(clientId) : null;
};
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

// Health check (frontend uses this to detect a down backend)
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    mongo: mongoose.connection.readyState === 1,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  PUBLIC ROUTES (no auth required)
// ═══════════════════════════════════════════════════════════════════════════════

// Signup
app.post('/api/signup', authLimiter, async (req, res) => {
  try {
    const { name, email, password, role, specialization } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Please provide name, email, and password' });
    const userRole = role || 'patient';
    if (userRole === 'doctor' && !specialization) return res.status(400).json({ error: 'Specialization is required for doctors' });
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(409).json({ error: 'Email already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const otpCode = generateOtp();
    // Store OTP in DB on the (temp) user document
    const tempUser = new User({
      name, email: email.trim(), password: hashedPassword,
      role: userRole, specialization: userRole === 'doctor' ? specialization : null,
      isVerified: false, otpCode, otpPurpose: 'signup',
      otpExpiresAt: new Date(Date.now() + OTP_EXPIRY_MS)
    });
    await tempUser.save();

    const mailStatus = await sendOtpEmail(email, otpCode, 'signup');
    res.status(201).json({
      message: 'Signup OTP sent to your email', email: email.trim(),
      ...(mailStatus.delivered ? {} : { otpFallback: otpCode })
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/signup/verify-otp', authLimiter, async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required' });
    const user = await User.findOne({ email: email.trim(), otpPurpose: 'signup', isVerified: false });
    if (!user) return res.status(400).json({ error: 'No signup OTP request found or expired' });
    if (user.otpCode !== String(otp).trim()) return res.status(400).json({ error: 'Invalid OTP' });
    if (user.otpExpiresAt < new Date()) {
      await User.deleteOne({ _id: user._id });
      return res.status(400).json({ error: 'OTP expired' });
    }
    user.isVerified = true;
    user.otpCode = null; user.otpPurpose = null; user.otpExpiresAt = null;
    await user.save();
    const token = issueToken(user);
    const { password: _, otpCode: __, ...userOut } = user.toObject();
    res.json({ ...userOut, token });
  } catch (err) {
    console.error('Signup OTP verification error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Google OAuth
app.post('/api/auth/google', authLimiter, async (req, res) => {
  try {
    const { credential, role = 'patient', specialization } = req.body;
    if (!credential) return res.status(400).json({ error: 'Missing Google credential token' });
    const googleClientId = getGoogleClientId();
    const googleClient = getGoogleClient();
    if (!googleClient || !googleClientId) return res.status(500).json({ error: 'Google login is not configured on server' });

    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: googleClientId });
    const payload = ticket.getPayload();
    if (!payload) return res.status(400).json({ error: 'Invalid Google token' });

    const { sub: googleId, email, name, picture } = payload;
    let user = await User.findOne({ $or: [{ googleId }, { email }] });
    if (user) {
      if (!user.googleId) { user.googleId = googleId; await user.save(); }
    } else {
      const userRole = role || 'patient';
      if (userRole === 'doctor' && !specialization) return res.status(400).json({ error: 'Specialization required for doctors' });
      user = new User({
        name, email, googleId, password: await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10),
        role: userRole, specialization: userRole === 'doctor' ? specialization : null,
        profileImage: picture || null, isVerified: true
      });
      await user.save();
    }
    const token = issueToken(user);
    const { password: _, ...userOut } = user.toObject();
    res.json({ ...userOut, token });
  } catch (err) {
    console.error('Google auth error:', err);
    res.status(500).json({ error: 'Google authentication failed' });
  }
});

// Login
app.post('/api/login', authLimiter, async (req, res) => {
  try {
    let { email, password, role, specialization } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Please provide email and password' });
    email = email.trim(); password = password.trim();
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return res.status(401).json({ error: 'Invalid credentials' });
    if (role && user.role !== role) return res.status(403).json({ error: `Please login as a ${role}` });
    if (role === 'doctor' && specialization && user.specialization !== specialization)
      return res.status(403).json({ error: 'Selected specialization does not match your account' });
    if (!user.isVerified) return res.status(403).json({ error: 'Please verify your email before login' });

    const otpCode = generateOtp();
    user.otpCode = otpCode;
    user.otpPurpose = 'login';
    user.otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MS);
    await user.save();

    const mailStatus = await sendOtpEmail(email, otpCode, 'login');
    res.json({
      message: 'Login OTP sent to your email', email: user.email,
      ...(mailStatus.delivered ? {} : { otpFallback: otpCode })
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/login/verify-otp', authLimiter, async (req, res) => {
  try {
    const { email, otp, role, specialization } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required' });
    const user = await User.findOne({ email: email.trim(), otpPurpose: 'login' });
    if (!user) return res.status(400).json({ error: 'No login OTP request found' });
    if (user.otpCode !== String(otp).trim()) return res.status(400).json({ error: 'Invalid OTP' });
    if (user.otpExpiresAt < new Date()) {
      user.otpCode = null; user.otpPurpose = null; user.otpExpiresAt = null;
      await user.save();
      return res.status(400).json({ error: 'OTP expired' });
    }
    if (role && user.role !== role) return res.status(403).json({ error: `Please login as a ${role}` });
    if (role === 'doctor' && specialization && user.specialization !== specialization)
      return res.status(403).json({ error: 'Selected specialization does not match your account' });

    user.otpCode = null; user.otpPurpose = null; user.otpExpiresAt = null;
    await user.save();

    const token = issueToken(user);
    const { password: _, ...userOut } = user.toObject();
    res.json({ ...userOut, token });
  } catch (err) {
    console.error('Login OTP verification error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Forgot / Reset Password
app.post('/api/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const user = await User.findOne({ email: email.trim() });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const otpCode = generateOtp();
    user.otpCode = otpCode; user.otpPurpose = 'reset_password';
    user.otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MS);
    await user.save();
    const mailStatus = await sendOtpEmail(email.trim(), otpCode, 'reset_password');
    res.json({ message: 'Password reset OTP sent to your email', ...(mailStatus.delivered ? {} : { otpFallback: otpCode }) });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/reset-password', authLimiter, async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) return res.status(400).json({ error: 'Email, OTP, and new password are required' });
    const user = await User.findOne({ email: email.trim(), otpPurpose: 'reset_password' });
    if (!user) return res.status(400).json({ error: 'No password reset requested' });
    if (user.otpCode !== String(otp).trim()) return res.status(400).json({ error: 'Invalid OTP' });
    if (user.otpExpiresAt < new Date()) {
      user.otpCode = null; user.otpPurpose = null; user.otpExpiresAt = null;
      await user.save();
      return res.status(400).json({ error: 'OTP expired' });
    }
    user.password = await bcrypt.hash(newPassword.trim(), 10);
    user.otpCode = null; user.otpPurpose = null; user.otpExpiresAt = null;
    await user.save();
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Public: Get Doctors (for appointment booking on login page etc.)
app.get('/api/doctors', async (req, res) => {
  try {
    const { specialization } = req.query;
    const query = { role: 'doctor' };
    if (specialization) query.specialization = specialization;
    const doctors = await User.find(query, '_id name specialization rating profileImage');
    const doctorsWithRating = doctors.map(doc => {
      const d = doc.toObject();
      d.averageRating = d.rating && d.rating.count > 0 ? Math.round((d.rating.totalScore / d.rating.count) * 10) / 10 : 0;
      d.ratingCount = d.rating?.count || 0;
      delete d.rating;
      return d;
    });
    res.json(doctorsWithRating);
  } catch (err) {
    console.error('Error fetching doctors:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  PROTECTED ROUTES (requireAuth middleware on all)
// ═══════════════════════════════════════════════════════════════════════════════

// Appointments
app.post('/api/appointments', requireAuth, async (req, res) => {
  console.log('POST /api/appointments incoming request:', req.body);
  try {
    const { patient_id, doctor_id, doctor_name, date, time, reason, specialization } = req.body;
    if (!patient_id || !doctor_id || !date || !time) return res.status(400).json({ error: 'Missing required fields' });
    // Patients can only book for themselves
    if (req.user.role === 'patient' && req.user.id !== patient_id)
      return res.status(403).json({ error: 'Cannot book appointment for another user' });
    const newAppointment = new Appointment({ patient_id, doctor_id, doctor_name, date, time, reason, specialization });
    await newAppointment.save();
    res.status(201).json({ _id: newAppointment._id, message: 'Appointment booked successfully' });
  } catch (err) {
    console.error('Error booking appointment:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/appointments', requireAuth, async (req, res) => {
  try {
    const { user_id, role } = req.query;
    if (!user_id || !role) return res.status(400).json({ error: 'Missing user_id or role' });
    // Users can only see their own appointments
    if (req.user.id !== user_id) return res.status(403).json({ error: 'Access denied' });
    let appointments;
    if (role === 'doctor') {
      appointments = await Appointment.find({ doctor_id: user_id }).populate('patient_id', 'name').sort({ date: 1, time: 1 });
      appointments = appointments.filter(apt => apt.patient_id != null).map(apt => ({ ...apt.toObject(), patient_name: apt.patient_id.name }));
    } else {
      appointments = await Appointment.find({ patient_id: user_id }).populate('doctor_id', 'name specialization').sort({ date: 1, time: 1 });
      appointments = appointments.filter(apt => apt.doctor_id != null).map(apt => {
        const obj = apt.toObject();
        if (!obj.specialization && apt.doctor_id?.specialization) obj.specialization = apt.doctor_id.specialization;
        return obj;
      });
    }
    res.json(appointments);
  } catch (err) {
    console.error('Error fetching appointments:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/appointments/:id/status', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'Status is required' });
    const appointment = await Appointment.findById(id);
    if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
    // Only the doctor or patient of this appointment can change status
    if (req.user.id !== appointment.doctor_id.toString() && req.user.id !== appointment.patient_id.toString())
      return res.status(403).json({ error: 'Access denied' });
    await Appointment.findByIdAndUpdate(id, { status });
    res.json({ message: 'Status updated successfully' });
  } catch (err) {
    console.error('Error updating appointment:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/appointments/:id/rate', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    const appointment = await Appointment.findById(id);
    if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
    if (appointment.status !== 'completed') return res.status(400).json({ error: 'Can only rate completed appointments' });
    if (appointment.patient_id.toString() !== req.user.id) return res.status(403).json({ error: 'Only the patient can rate this appointment' });
    if (appointment.rating) return res.status(400).json({ error: 'Appointment already rated' });
    appointment.rating = rating;
    await appointment.save();
    await User.findByIdAndUpdate(appointment.doctor_id, { $inc: { 'rating.totalScore': rating, 'rating.count': 1 } });
    res.json({ message: 'Rating submitted successfully', rating });
  } catch (err) {
    console.error('Error rating appointment:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Prescriptions
app.post('/api/prescriptions', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'doctor') return res.status(403).json({ error: 'Only doctors can create prescriptions' });
    const { appointment_id, patient_id, doctor_id, medication_details, dosage, instructions, duration, times_per_day } = req.body;
    if (!appointment_id || !patient_id || !doctor_id || !medication_details) return res.status(400).json({ error: 'Missing required fields' });
    if (req.user.id !== doctor_id) return res.status(403).json({ error: 'Cannot create prescription as another doctor' });
    const newPrescription = new Prescription({ appointment_id, patient_id, doctor_id, medication_details, dosage, duration: duration || null, times_per_day: times_per_day || null, instructions });
    await newPrescription.save();
    res.status(201).json({ message: 'Prescription added successfully' });
  } catch (err) {
    console.error('Error creating prescription:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/prescriptions', requireAuth, async (req, res) => {
  try {
    const { user_id, role } = req.query;
    if (!user_id || !role) return res.status(400).json({ error: 'Missing user_id or role' });
    if (req.user.id !== user_id) return res.status(403).json({ error: 'Access denied' });
    let prescriptions;
    if (role === 'doctor') {
      prescriptions = await Prescription.find({ doctor_id: user_id }).populate('patient_id', 'name').sort({ createdAt: -1 });
      prescriptions = prescriptions.filter(pre => pre.patient_id != null).map(pre => ({ ...pre.toObject(), patient_name: pre.patient_id.name }));
    } else {
      prescriptions = await Prescription.find({ patient_id: user_id }).populate('doctor_id', 'name').sort({ createdAt: -1 });
      prescriptions = prescriptions.filter(pre => pre.doctor_id != null).map(pre => ({ ...pre.toObject(), doctor_name: pre.doctor_id.name }));
    }
    res.json(prescriptions);
  } catch (err) {
    console.error('Error fetching prescriptions:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Medication Reminders
app.get('/api/medications', requireAuth, async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: 'Missing user_id' });
    if (req.user.id !== user_id) return res.status(403).json({ error: 'Access denied' });
    const reminders = await MedicationReminder.find({ user_id }).sort({ createdAt: -1 });
    res.json(reminders);
  } catch (err) {
    console.error('Error fetching medication reminders:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/medications', requireAuth, async (req, res) => {
  try {
    const { user_id, name, dosage, timesPerDay, duration, times, reminderEnabled } = req.body;
    if (!user_id || !name || !dosage || !duration) return res.status(400).json({ error: 'Missing required fields' });
    if (req.user.id !== user_id) return res.status(403).json({ error: 'Cannot create reminder for another user' });
    const reminder = new MedicationReminder({ user_id, name, dosage, timesPerDay: timesPerDay || 1, duration, times: Array.isArray(times) ? times : [], reminderEnabled: reminderEnabled !== false });
    await reminder.save();
    try {
      const reminderUser = await User.findById(user_id);
      if (reminderUser?.email) scheduleEmailReminder(reminder, reminderUser.email);
    } catch (scheduleErr) {
      console.warn('[scheduler] Failed to schedule reminder:', scheduleErr.message);
    }
    res.status(201).json(reminder);
  } catch (err) {
    console.error('Error creating medication reminder:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/medications/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const reminder = await MedicationReminder.findById(id);
    if (!reminder) return res.status(404).json({ error: 'Reminder not found' });
    if (reminder.user_id.toString() !== req.user.id) return res.status(403).json({ error: 'Access denied' });
    const updated = await MedicationReminder.findByIdAndUpdate(id, req.body, { new: true });
    
    const user = await User.findById(updated.user_id);
    if (user?.email) {
      scheduleEmailReminder(updated, user.email);
    }
    
    res.json(updated);
  } catch (err) {
    console.error('Error updating medication reminder:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/medications/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const reminder = await MedicationReminder.findById(id);
    if (!reminder) return res.status(404).json({ error: 'Reminder not found' });
    if (reminder.user_id.toString() !== req.user.id) return res.status(403).json({ error: 'Access denied' });
    await MedicationReminder.findByIdAndDelete(id);
    if (scheduledReminders.has(id)) {
      scheduledReminders.get(id).forEach(t => t.stop());
      scheduledReminders.delete(id);
    }
    res.json({ message: 'Medication reminder deleted' });
  } catch (err) {
    console.error('Error deleting medication reminder:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Profile
app.get('/api/profile/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.id !== id) return res.status(403).json({ error: 'Access denied' });
    const user = await User.findById(id, '-password -otpCode -otpPurpose -otpExpiresAt');
    if (!user) return res.status(404).json({ error: 'User not found' });
    const userObj = user.toObject();
    if (user.role === 'doctor') {
      const totalAppointments = await Appointment.countDocuments({ doctor_id: id });
      const completedAppointments = await Appointment.countDocuments({ doctor_id: id, status: 'completed' });
      const pendingAppointments = await Appointment.countDocuments({ doctor_id: id, status: 'pending' });
      const prescriptionsWritten = await Prescription.countDocuments({ doctor_id: id });
      userObj.stats = { totalAppointments, completedAppointments, pendingAppointments, prescriptionsWritten };
      userObj.averageRating = user.rating?.count > 0 ? Math.round((user.rating.totalScore / user.rating.count) * 10) / 10 : 0;
      userObj.ratingCount = user.rating?.count || 0;
    } else {
      const totalAppointments = await Appointment.countDocuments({ patient_id: id });
      const completedAppointments = await Appointment.countDocuments({ patient_id: id, status: 'completed' });
      const activeMedications = await MedicationReminder.countDocuments({ user_id: id, reminderEnabled: true });
      const totalPrescriptions = await Prescription.countDocuments({ patient_id: id });
      userObj.stats = { totalAppointments, completedAppointments, activeMedications, totalPrescriptions };
      userObj.averageRating = 0; userObj.ratingCount = 0;
    }
    res.json(userObj);
  } catch (err) {
    console.error('Error fetching profile:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/profile/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.id !== id) return res.status(403).json({ error: 'Access denied' });
    const { phone, profileImage, name, age, gender, medicalHistory } = req.body;
    const updateFields = {};
    if (phone !== undefined) updateFields.phone = phone;
    if (name !== undefined) updateFields.name = name;
    if (age !== undefined) updateFields.age = age;
    if (gender !== undefined) updateFields.gender = gender;
    if (medicalHistory !== undefined) updateFields.medicalHistory = medicalHistory;
    if (profileImage !== undefined) {
      if (profileImage && profileImage.length > 5 * 1024 * 1024) return res.status(400).json({ error: 'Image too large. Max 5MB.' });
      updateFields.profileImage = profileImage;
    }
    const user = await User.findByIdAndUpdate(id, updateFields, { new: true, select: '-password -otpCode -otpPurpose -otpExpiresAt' });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const userObj = user.toObject();
    userObj.averageRating = user.role === 'doctor' && user.rating?.count > 0 ? Math.round((user.rating.totalScore / user.rating.count) * 10) / 10 : 0;
    userObj.ratingCount = user.rating?.count || 0;
    res.json(userObj);
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Medical History
app.post('/api/symptom-checker/save', requireAuth, async (req, res) => {
  try {
    const { patient_id, symptoms, condition, severity, advice, recommendation } = req.body;
    if (!patient_id) return res.status(400).json({ error: 'Patient ID required' });
    if (req.user.id !== patient_id) return res.status(403).json({ error: 'Access denied' });
    const check = new SymptomCheck({ patient_id, symptoms, condition, severity, advice, recommendation });
    await check.save();
    res.json({ message: 'Saved successfully', check });
  } catch (err) {
    console.error('Symptom check save error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/user/medical-history', requireAuth, async (req, res) => {
  try {
    const { userId, medicalHistory } = req.body;
    if (req.user.id !== userId) return res.status(403).json({ error: 'Access denied' });
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.medicalHistory = medicalHistory;
    await user.save();
    res.json({ message: 'History updated', medicalHistory: user.medicalHistory });
  } catch (err) {
    console.error('History update error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/history/analyze', requireAuth, aiLimiter, async (req, res) => {
  try {
    const { userId } = req.body;
    if (req.user.id !== userId) return res.status(403).json({ error: 'Access denied' });
    const { loadPatientHistoryData } = await import('./utils/patientHistory.js');
    const data = await loadPatientHistoryData(userId);
    const response = await medicalHistoryAnalyzerAgent.execute(data);
    res.json(response);
  } catch (err) {
    console.error('History analyze error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/appointments/:id/share-history', requireAuth, async (req, res) => {
  try {
    const { historyText } = req.body;
    const apt = await Appointment.findById(req.params.id);
    if (!apt) return res.status(404).json({ error: 'Appointment not found' });
    if (req.user.id !== apt.patient_id.toString()) return res.status(403).json({ error: 'Access denied' });
    apt.sharedHistory = historyText;
    await apt.save();
    res.json({ message: 'History shared successfully' });
  } catch (err) {
    console.error('Share history error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// AI Agent Endpoints
app.post('/api/chatbot', requireAuth, aiLimiter, async (req, res) => {
  try {
    const { message, context } = req.body;
    const response = await chatbotAgent.execute(message, { ...context, userId: req.user.id, userRole: req.user.role });
    res.json(response);
  } catch (err) {
    console.error('Chatbot error:', err);
    res.status(500).json({ error: 'Chatbot error' });
  }
});

app.post('/api/symptom-checker', requireAuth, aiLimiter, async (req, res) => {
  try {
    const { symptoms, age, gender } = req.body;
    const response = await symptomCheckerAgent.execute({ symptoms, age, gender });
    res.json(response);
  } catch (err) {
    console.error('Symptom checker error:', err);
    res.status(500).json({ error: 'Symptom checker error' });
  }
});

// ── Medical Records Endpoints ─────────────────────────────────────────────────

// Upload medical records (doctor only)
app.post('/api/medical-records/upload', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({ error: 'Only doctors can upload medical records' });
    }
    const { patient_id, files } = req.body;
    if (!patient_id || !files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'Patient ID and at least one file are required' });
    }
    if (files.length > 5) {
      return res.status(400).json({ error: 'Maximum 5 files per upload' });
    }

    const patient = await User.findById(patient_id);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const savedRecords = [];

    for (const file of files) {
      if (!file.name || !file.type || !file.data) {
        continue; // Skip invalid files
      }

      // Check file size (Base64 is ~33% larger than binary; limit to ~5MB original)
      const estimatedSize = Math.round((file.data.length * 3) / 4);
      if (estimatedSize > 5 * 1024 * 1024) {
        continue; // Skip files over 5MB
      }

      const record = new MedicalRecord({
        patient_id,
        uploaded_by: req.user.id,
        fileName: file.name,
        fileType: file.type,
        fileSize: estimatedSize,
        fileData: file.data,
        status: 'pending'
      });
      await record.save();
      savedRecords.push(record);

      // Trigger AI analysis asynchronously
      (async () => {
        try {
          const result = await medicalRecordAnalyzerAgent.execute({
            fileData: file.data,
            fileType: file.type,
            fileName: file.name,
            patientName: patient.name,
            patientAge: patient.age,
            patientGender: patient.gender
          });

          record.aiAnalysis = result.analysis;
          record.status = 'analyzed';
          await record.save();

          // Auto-merge key findings into patient's medical history
          const newFindings = [];
          if (result.analysis.conditions?.length) {
            newFindings.push('Conditions: ' + result.analysis.conditions.join(', '));
          }
          if (result.analysis.medications?.length) {
            newFindings.push('Medications: ' + result.analysis.medications.join(', '));
          }
          if (result.analysis.keyFindings?.length) {
            newFindings.push('Key Findings: ' + result.analysis.keyFindings.join(', '));
          }

          if (newFindings.length > 0) {
            const dateStr = new Date().toLocaleDateString();
            const updateBlock = `\n\n--- Auto-updated from uploaded record "${file.name}" (${dateStr}) ---\n${newFindings.join('\n')}`;
            const currentHistory = patient.medicalHistory || '';
            patient.medicalHistory = currentHistory + updateBlock;
            await patient.save();
            console.log(`[MedicalRecords] Auto-updated history for patient ${patient_id}`);
          }
        } catch (analysisErr) {
          console.error('[MedicalRecords] AI analysis failed:', analysisErr.message);
          record.status = 'error';
          await record.save();
        }
      })();
    }

    if (savedRecords.length === 0) {
      return res.status(400).json({ error: 'No valid files were uploaded' });
    }

    res.status(201).json({
      message: `${savedRecords.length} record(s) uploaded successfully. AI analysis in progress.`,
      records: savedRecords.map(r => ({ _id: r._id, fileName: r.fileName, status: r.status }))
    });
  } catch (err) {
    console.error('Error uploading medical records:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get medical records for a patient
app.get('/api/medical-records/:patientId', requireAuth, async (req, res) => {
  try {
    const { patientId } = req.params;
    // Patients can see their own records; doctors can see any patient's records
    if (req.user.role === 'patient' && req.user.id !== patientId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const records = await MedicalRecord.find({ patient_id: patientId })
      .select('-fileData')
      .populate('uploaded_by', 'name specialization')
      .sort({ createdAt: -1 });
    res.json(records);
  } catch (err) {
    console.error('Error fetching medical records:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Download/view a specific medical record file
app.get('/api/medical-records/file/:id', requireAuth, async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ error: 'Record not found' });
    // Access control: patient owns record or user is a doctor
    if (req.user.role === 'patient' && req.user.id !== record.patient_id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json({
      fileName: record.fileName,
      fileType: record.fileType,
      fileData: record.fileData
    });
  } catch (err) {
    console.error('Error downloading medical record:', err);
    res.status(500).json({ error: 'Database error' });
  }
});
// ── Patient History for Doctors ───────────────────────────────────────────────

// Get full patient history for a doctor's view (past appointments, prescriptions, medical records)
app.get('/api/patient-history/:patientId/doctor-view', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({ error: 'Only doctors can view patient history' });
    }
    const { patientId } = req.params;

    // Get patient basic info
    const patient = await User.findById(patientId, 'name age gender medicalHistory');
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    // Past appointments with THIS doctor
    const pastAppointments = await Appointment.find({
      patient_id: patientId,
      doctor_id: req.user.id,
      status: { $in: ['completed', 'accepted', 'confirmed'] }
    }).sort({ date: -1, time: -1 }).limit(20);

    // Prescriptions given by THIS doctor to this patient
    const prescriptions = await Prescription.find({
      patient_id: patientId,
      doctor_id: req.user.id
    }).sort({ createdAt: -1 }).limit(20);

    // All medical records for this patient (uploaded by any doctor)
    const medicalRecords = await MedicalRecord.find({ patient_id: patientId })
      .select('-fileData')
      .populate('uploaded_by', 'name specialization')
      .sort({ createdAt: -1 })
      .limit(20);

    // Symptom checks for this patient
    const symptomChecks = await SymptomCheck.find({ patient_id: patientId })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      patient: {
        name: patient.name,
        age: patient.age,
        gender: patient.gender,
        medicalHistory: patient.medicalHistory
      },
      pastAppointments: pastAppointments.map(a => a.toObject()),
      prescriptions: prescriptions.map(p => p.toObject()),
      medicalRecords: medicalRecords.map(r => r.toObject()),
      symptomChecks: symptomChecks.map(s => s.toObject()),
      hasHistory: pastAppointments.length > 0 || prescriptions.length > 0 || medicalRecords.length > 0
    });
  } catch (err) {
    console.error('Error fetching patient history for doctor:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/medication-reminder', requireAuth, async (req, res) => {
  try {
    const response = await medicationReminderAgent.execute(req.body);
    res.json(response);
  } catch (err) {
    console.error('Medication reminder agent error:', err);
    res.status(500).json({ error: 'Medication reminder agent error' });
  }
});
// Serve React build
app.use(express.static(path.join(__dirname, '../dist')));

// React Router support
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
