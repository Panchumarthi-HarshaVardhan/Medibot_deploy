import nodemailer from 'nodemailer';

let transporter = null;
let isInitialized = false;

const getTransporter = () => {
  if (isInitialized) return transporter;
  
  if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
    transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }
  isInitialized = true;
  return transporter;
};

export const sendOtpEmail = async (email, otp, purpose = 'verification') => {
  const mailTransporter = getTransporter();
  if (!mailTransporter) {
    console.warn(
      `[email] Missing EMAIL_USER or EMAIL_PASSWORD. OTP for ${email} (${purpose}) is ${otp}`
    );
    return { delivered: false, reason: 'missing_credentials' };
  }

  try {
    await mailTransporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: purpose === 'login' ? 'Your Login OTP Code' : 'Verify your account',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.4;">
          <h2>Your OTP Code</h2>
          <p>Use this OTP to complete your ${purpose} process:</p>
          <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${otp}</p>
          <p>This OTP expires in 5 minutes.</p>
        </div>
      `
    });
    return { delivered: true };
  } catch (error) {
    console.warn(
      `[email] Failed to send OTP email to ${email} (${purpose}). OTP: ${otp}. Error: ${error.message}`
    );
    return { delivered: false, reason: error.message };
  }
};

export const sendMedicationReminderEmail = async (email, medicineName, dosage, time) => {
  const mailTransporter = getTransporter();
  if (!mailTransporter) {
    console.warn(`[email] Missing config. Medication reminder for ${email}: ${medicineName} ${dosage} at ${time}`);
    return { delivered: false, reason: 'missing_credentials' };
  }

  try {
    await mailTransporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: `💊 Medication Reminder: ${medicineName}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #0d9488, #14b8a6); padding: 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 22px;">💊 Medication Reminder</h1>
          </div>
          <div style="padding: 24px;">
            <p style="font-size: 16px; color: #333;">It's time to take your medicine!</p>
            <div style="background: #f0fdfa; border-left: 4px solid #14b8a6; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p style="margin: 0 0 8px 0; font-weight: bold; color: #0d9488; font-size: 18px;">${medicineName}</p>
              <p style="margin: 0 0 4px 0; color: #555;"><strong>Dosage:</strong> ${dosage}</p>
              <p style="margin: 0; color: #555;"><strong>Scheduled Time:</strong> ${time}</p>
            </div>
            <p style="font-size: 13px; color: #888; margin-top: 20px;">This is an automated reminder from MediBot. Please take your medicine as prescribed.</p>
          </div>
          <div style="background: #f8f8f8; padding: 12px; text-align: center; font-size: 12px; color: #aaa;">MediBot Health Assistant</div>
        </div>
      `
    });
    console.log(`[email] Medication reminder sent to ${email} for ${medicineName}`);
    return { delivered: true };
  } catch (error) {
    console.warn(`[email] Failed medication reminder to ${email}: ${error.message}`);
    return { delivered: false, reason: error.message };
  }
};
