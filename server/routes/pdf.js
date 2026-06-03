import express from 'express';
import PDFDocument from 'pdfkit';
import User from '../models/User.js';
import Appointment from '../models/Appointment.js';
import Prescription from '../models/Prescription.js';
import MedicalRecord from '../models/MedicalRecord.js';
import SymptomCheck from '../models/SymptomCheck.js';
import { requireAuth } from '../index.js';

const router = express.Router();

router.get('/summary/:patientId', requireAuth, async (req, res) => {
  try {
    const { patientId } = req.params;
    
    // Authorization: User can only download their own, or doctor can download any
    if (req.user.role !== 'doctor' && req.user.id !== patientId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const patient = await User.findById(patientId);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    // Gather data
    const [appointments, prescriptions, records, symptoms] = await Promise.all([
      Appointment.find({ patient_id: patientId }).sort({ date: -1 }).limit(5),
      Prescription.find({ patient_id: patientId }).sort({ createdAt: -1 }).limit(5),
      MedicalRecord.find({ uploaded_by: patientId }).sort({ createdAt: -1 }).limit(5),
      SymptomCheck.find({ user_id: patientId }).sort({ createdAt: -1 }).limit(5)
    ]);

    // Create a document
    const doc = new PDFDocument({ margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Health_Summary_${patient.name.replace(/\s+/g, '_')}.pdf`);
    
    doc.pipe(res);

    // Title
    doc.fontSize(24).font('Helvetica-Bold').text('AI Health Summary Report', { align: 'center' });
    doc.moveDown();

    // Patient Info
    doc.fontSize(16).font('Helvetica-Bold').text('Patient Information');
    doc.fontSize(12).font('Helvetica')
       .text(`Name: ${patient.name}`)
       .text(`Age: ${patient.age || 'N/A'}`)
       .text(`Gender: ${patient.gender || 'N/A'}`)
       .text(`Email: ${patient.email}`);
    
    if (patient.medicalHistory) {
      doc.moveDown().font('Helvetica-Bold').text('Self-Reported Medical History:');
      doc.font('Helvetica').text(patient.medicalHistory);
    }
    doc.moveDown(2);

    // Recent Symptoms
    if (symptoms.length > 0) {
      doc.fontSize(16).font('Helvetica-Bold').text('Recent Symptom Checks');
      doc.moveDown(0.5);
      symptoms.forEach(sym => {
        doc.fontSize(12).font('Helvetica-Bold').text(`Date: ${new Date(sym.createdAt).toLocaleDateString()}`);
        doc.font('Helvetica').text(`Symptoms: ${sym.symptoms}`);
        doc.text(`Condition: ${sym.condition}`);
        doc.text(`Severity: ${sym.severity}`);
        if (sym.advice) doc.text(`Advice: ${sym.advice}`);
        doc.moveDown();
      });
      doc.moveDown();
    }

    // Recent Prescriptions
    if (prescriptions.length > 0) {
      doc.fontSize(16).font('Helvetica-Bold').text('Recent Prescriptions');
      doc.moveDown(0.5);
      prescriptions.forEach(rx => {
        doc.fontSize(12).font('Helvetica-Bold').text(`Date: ${new Date(rx.createdAt).toLocaleDateString()}`);
        if (rx.medications && rx.medications.length > 0) {
          rx.medications.forEach(m => {
             doc.font('Helvetica').text(`- ${m.name} | Dosage: ${m.dosage} | Duration: ${m.duration || 'N/A'}`);
          });
        } else if (rx.medication_details) {
          doc.font('Helvetica').text(`Medication: ${rx.medication_details} | Dosage: ${rx.dosage || 'N/A'}`);
        }
        if (rx.instructions) doc.text(`Instructions: ${rx.instructions}`);
        doc.moveDown();
      });
      doc.moveDown();
    }

    // AI Analyzed Medical Records
    if (records.length > 0) {
      doc.fontSize(16).font('Helvetica-Bold').text('AI Analyzed Medical Records');
      doc.moveDown(0.5);
      records.forEach(rec => {
        doc.fontSize(12).font('Helvetica-Bold').text(`Document: ${rec.fileName}`);
        doc.font('Helvetica').text(`Date: ${new Date(rec.createdAt).toLocaleDateString()}`);
        if (rec.aiAnalysis && rec.aiAnalysis.summary) {
          doc.text(`AI Summary: ${rec.aiAnalysis.summary}`);
        } else {
          doc.text(`Status: ${rec.status}`);
        }
        doc.moveDown();
      });
    }

    // Finalize
    doc.end();

  } catch (err) {
    console.error('Error generating PDF:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate PDF' });
    }
  }
});

export default router;
