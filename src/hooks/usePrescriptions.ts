import { authFetch } from '@/utils/api';
import { useState, useEffect, useCallback } from 'react';
import { Prescription } from '@/types';
import { useAuthContext } from '@/context/AuthContext';

export const usePrescriptions = () => {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const { user } = useAuthContext();

  const fetchPrescriptions = useCallback(async () => {
    try {
      if (!user) return;
      const response = await authFetch(
        `/api/prescriptions?user_id=${user.id}&role=${user.role}`
      );
      if (response.ok) {
        const data = await response.json();
        // Map backend data to frontend model
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mappedPrescriptions = data.map((pres: any) => ({
          id: pres._id.toString(),
          appointmentId: pres.appointment_id.toString(),
          patientId: pres.patient_id?.toString() || pres.patient_id,
          doctorId: pres.doctor_id?.toString() || pres.doctor_id,
          doctorName: pres.doctor_name,
          patientName: pres.patient_name,
          medicationDetails: pres.medication_details,
          dosage: pres.dosage,
          duration: pres.duration || null,
          timesPerDay: pres.times_per_day || null,
          instructions: pres.instructions,
          createdAt: new Date(pres.createdAt).toLocaleDateString()
        }));
        setPrescriptions(mappedPrescriptions);
      }
    } catch (error) {
      console.error('Error fetching prescriptions:', error);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchPrescriptions();
    }
  }, [user, fetchPrescriptions]);

  return { prescriptions, fetchPrescriptions };
};
