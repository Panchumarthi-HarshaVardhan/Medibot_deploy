import { authFetch } from '@/utils/api';
import { useState, useEffect } from 'react';
import { Medication } from '@/types';
import { useAuthContext } from '@/context/AuthContext';

interface MedicationDoc {
  _id: { toString(): string };
  name: string;
  dosage: string;
  timesPerDay: number;
  duration: string;
  reminderEnabled: boolean;
  times?: string[];
}

export const useMedications = () => {
  const [medications, setMedications] = useState<Medication[]>([]);
  const { user } = useAuthContext();

  const fetchMedications = async () => {
    if (!user) {
      setMedications([]);
      return;
    }

    try {
      const response = await authFetch(`/api/medications?user_id=${user.id}`);
      if (!response.ok) return;
      const data = await response.json();
      const mapped = (data as MedicationDoc[]).map((med) => ({
        id: med._id.toString(),
        name: med.name,
        dosage: med.dosage,
        timesPerDay: med.timesPerDay,
        duration: med.duration,
        reminderEnabled: med.reminderEnabled,
        times: med.times || []
      }));
      setMedications(mapped);
    } catch (error) {
      console.error('Error fetching medications:', error);
    }
  };

  useEffect(() => {
    fetchMedications();
  }, [user]);

  const addMedication = async (medication: Omit<Medication, 'id'>) => {
    if (!user) return null;
    try {
      const response = await authFetch(`/api/medications`, {
        method: 'POST',
        body: JSON.stringify({
          user_id: user.id,
          ...medication
        })
      });
      if (!response.ok) return null;
      const saved = await response.json();
      const newMedication: Medication = {
        id: saved._id.toString(),
        name: saved.name,
        dosage: saved.dosage,
        timesPerDay: saved.timesPerDay,
        duration: saved.duration,
        reminderEnabled: saved.reminderEnabled,
        times: saved.times || []
      };
      setMedications((prev) => [newMedication, ...prev]);
      return newMedication;
    } catch (error) {
      console.error('Error adding medication:', error);
      return null;
    }
  };

  const updateMedication = async (id: string, updates: Partial<Medication>) => {
    try {
      const response = await authFetch(`/api/medications/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      if (!response.ok) return false;
      const saved = await response.json();
      const updatedItem: Medication = {
        id: saved._id.toString(),
        name: saved.name,
        dosage: saved.dosage,
        timesPerDay: saved.timesPerDay,
        duration: saved.duration,
        reminderEnabled: saved.reminderEnabled,
        times: saved.times || []
      };
      setMedications((prev) => prev.map((med) => (med.id === id ? updatedItem : med)));
      return true;
    } catch (error) {
      console.error('Error updating medication:', error);
      return false;
    }
  };

  const deleteMedication = async (id: string) => {
    try {
      const response = await authFetch(`/api/medications/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) return false;
      setMedications((prev) => prev.filter((med) => med.id !== id));
      return true;
    } catch (error) {
      console.error('Error deleting medication:', error);
      return false;
    }
  };

  const toggleReminder = async (id: string) => {
    const med = medications.find((m) => m.id === id);
    if (!med) return false;
    return await updateMedication(id, { reminderEnabled: !med.reminderEnabled });
  };

  return { medications, addMedication, updateMedication, deleteMedication, toggleReminder, fetchMedications };
};
