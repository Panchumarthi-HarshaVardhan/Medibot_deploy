import dotenv from 'dotenv';
dotenv.config();
import { sendMedicationReminderEmail } from './server/utils/email.js';

async function test() {
  console.log("Testing email sending...");
  console.log("Using credentials:", process.env.EMAIL_USER);
  const result = await sendMedicationReminderEmail("harsha.vintern@gmail.com", "Test Med", "1 pill", "Now");
  console.log("Result:", result);
  process.exit(0);
}

test();
