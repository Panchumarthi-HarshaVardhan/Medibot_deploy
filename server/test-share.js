import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const Appointment = mongoose.model('Appointment', new mongoose.Schema({
  patient_id: mongoose.Schema.Types.ObjectId,
  doctor_id: mongoose.Schema.Types.ObjectId,
  sharedHistory: String
}));

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/medibot');
  const apt = await Appointment.findOne();
  console.log("Appointment:", apt);
  process.exit(0);
}
run().catch(console.error);
