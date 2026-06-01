import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const Appointment = mongoose.model('Appointment', new mongoose.Schema({
  patient_id: mongoose.Schema.Types.ObjectId,
  doctor_id: mongoose.Schema.Types.ObjectId,
  sharedHistory: String,
  status: String
}));

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/medibot');
  const apt = await Appointment.findOne();
  apt.status = 'accepted';
  await apt.save();
  
  // Now simulate the endpoint logic
  try {
    const historyText = "Test history text";
    const foundApt = await Appointment.findById(apt._id);
    foundApt.sharedHistory = historyText;
    await foundApt.save();
    console.log("Updated appointment sharedHistory to:", foundApt.sharedHistory);
  } catch (err) {
    console.error("Error updating:", err);
  }
  process.exit(0);
}
run().catch(console.error);
