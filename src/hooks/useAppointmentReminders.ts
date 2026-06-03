import { useEffect } from 'react';
import { useAppointments } from './useAppointments';
import { useAuthContext } from '@/context/AuthContext';
import { parse, isAfter, isBefore, addMinutes, differenceInMinutes } from 'date-fns';

export const useAppointmentReminders = () => {
  const { getUpcomingAppointments } = useAppointments();
  const { user } = useAuthContext();

  useEffect(() => {
    if (!user || user.role !== 'patient') return;

    // Request permission if not granted
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }

    const checkAppointments = () => {
      const upcoming = getUpcomingAppointments();
      const now = new Date();

      upcoming.forEach(apt => {
        if (!apt.date || !apt.time || apt.status !== 'accepted') return;

        try {
          // Parse date and time like "2023-10-25" and "09:00 AM"
          const aptDateTime = new Date(`${apt.date} ${apt.time}`);
          
          if (isNaN(aptDateTime.getTime())) return; // invalid date

          const minsUntil = differenceInMinutes(aptDateTime, now);

          // If the appointment is within exactly 60 minutes or 15 minutes, send notification
          // We use a small window because the interval runs every minute
          if ((minsUntil === 60 || minsUntil === 15) && Notification.permission === 'granted') {
            new Notification('Upcoming Appointment Reminder', {
              body: `Your appointment with Dr. ${apt.doctorName} is starting in ${minsUntil} minutes!`,
              icon: '/favicon.ico'
            });
          }
        } catch (err) {
          console.error('Error checking appointment time', err);
        }
      });
    };

    // Run initially, then every minute
    checkAppointments();
    const intervalId = setInterval(checkAppointments, 60000);

    return () => clearInterval(intervalId);
  }, [user, getUpcomingAppointments]);
};
