import { authFetch } from '@/utils/api';
import { useState, useEffect, useCallback } from 'react';
import { Appointment } from '@/types';
import { useAuthContext } from '@/context/AuthContext';

export const useAppointments = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const { user } = useAuthContext();

  const fetchAppointments = useCallback(async () => {
    try {
      if (!user) return;
      const response = await authFetch(
        `/api/appointments?user_id=${user.id}&role=${user.role}`
      );
      if (response.ok) {
        const data = await response.json();
        // Map backend data to frontend model
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mappedAppointments = data.map((apt: any) => ({
          id: apt._id.toString(),
          _id: apt._id,
          patientName: apt.patient_name || 'You',
          patientId: apt.patient_id?._id || apt.patient_id,
          doctorId: apt.doctor_id?._id || apt.doctor_id,
          doctorName: apt.doctor_name,
          age: 0,
          gender: '',
          specialization: apt.specialization || 'General',
          date: new Date(apt.date).toLocaleDateString(),
          time: formatTimeForDisplay(apt.time),
          status: apt.status,
          reason: apt.reason,
          rating: apt.rating,
          sharedHistory: apt.sharedHistory
        }));
        setAppointments(mappedAppointments);
      }
    } catch (error) {
      console.error('Error fetching appointments:', error);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchAppointments();
    }
  }, [user, fetchAppointments]);

  const addAppointment = async (appointment: Partial<Appointment> & { specialization?: string }) => {
    try {
      if (!user) return;
      
      const payload = {
        patient_id: user.id,
        doctor_id: appointment.doctorId,
        doctor_name: appointment.doctorName,
        date: appointment.date,
        time: formatTimeForDB(appointment.time!),
        reason: appointment.specialization,
        specialization: appointment.specialization
      };
      console.log('addAppointment payload:', payload);

      const response = await authFetch(`/api/appointments`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      console.log('addAppointment response status:', response.status, 'ok:', response.ok);
      if (!response.ok) {
        const errText = await response.text();
        console.error('addAppointment error text:', errText);
      }

      if (response.ok) {
        fetchAppointments();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error booking appointment:', error);
      return false;
    }
  };

const formatTimeForDB = (time12h: string): string => {
  const [time, modifier] = time12h.split(' ');
  const [rawHours, minutes] = time.split(':');
  let hours = rawHours;
  
  if (hours === '12') {
    hours = '00';
  }
  
  if (modifier === 'PM') {
    hours = (parseInt(hours, 10) + 12).toString();
  }
  
  return `${hours.padStart(2, '0')}:${minutes}:00`;
};

const formatTimeForDisplay = (time24h: string): string => {
  if (!time24h) return '';
  const [hours, minutes] = time24h.split(':');
  let h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12; // the hour '0' should be '12'
  return `${h.toString().padStart(2, '0')}:${minutes} ${ampm}`;
};


  const updateStatus = async (id: string, status: string) => {
    try {
      const response = await authFetch(`/api/appointments/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        fetchAppointments();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error updating status:', error);
      return false;
    }
  };

  const rateAppointment = async (id: string, rating: number) => {
    try {
      if (!user) return false;
      
      const response = await authFetch(`/api/appointments/${id}/rate`, {
        method: 'PUT',
        body: JSON.stringify({ rating, userId: user.id }),
      });
      
      if (response.ok) {
        fetchAppointments();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error rating appointment:', error);
      return false;
    }
  };

  const cancelAppointment = async (id: string) => {
    return updateStatus(id, 'cancelled');
  };

  const getUpcomingAppointments = () => {
    return appointments.filter(apt => apt.status === 'pending' || apt.status === 'accepted');
  };

  return { appointments, addAppointment, cancelAppointment, updateStatus, getUpcomingAppointments, fetchAppointments, rateAppointment };
};
