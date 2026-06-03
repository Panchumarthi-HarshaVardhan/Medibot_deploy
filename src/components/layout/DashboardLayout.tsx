import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Chatbot } from '@/components/chatbot/Chatbot';
import { useAppointmentReminders } from '@/hooks/useAppointmentReminders';

interface DashboardLayoutProps {
  children: ReactNode;
}

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  useAppointmentReminders();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="lg:ml-64 min-h-screen">
        <div className="p-6 lg:p-8">
          {children}
        </div>
      </main>
      <Chatbot />
    </div>
  );
};
