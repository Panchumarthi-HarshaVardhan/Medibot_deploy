import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAppointments } from '@/hooks/useAppointments';
import { useMedications } from '@/hooks/useMedications';
import { getDailyTip, getRandomTips } from '@/data/healthTips';
import { HealthTip } from '@/types';
import { 
  Calendar, 
  Pill, 
  Stethoscope, 
  Heart, 
  TrendingUp,
  Clock,
  AlertCircle,
  Lightbulb
} from 'lucide-react';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const { getUpcomingAppointments } = useAppointments();
  const { medications } = useMedications();
  const [dailyTip, setDailyTip] = useState<HealthTip | null>(null);
  const [randomTip, setRandomTip] = useState<HealthTip | null>(null);

  const upcomingAppointments = getUpcomingAppointments();
  const activeReminders = medications.filter(m => m.reminderEnabled);

  useEffect(() => {
    setDailyTip(getDailyTip());
    const tips = getRandomTips(1);
    setRandomTip(tips[0] || null);
  }, []);

  const stats = [
    {
      icon: Calendar,
      label: 'Upcoming Appointments',
      value: upcomingAppointments.length,
      color: 'text-info',
      bgColor: 'bg-info/10',
      link: '/appointments',
    },
    {
      icon: Pill,
      label: 'Active Medications',
      value: activeReminders.length,
      color: 'text-success',
      bgColor: 'bg-success/10',
      link: '/medications',
    },
    {
      icon: Stethoscope,
      label: 'Symptom Checks',
      value: 'Start',
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      link: '/symptom-checker',
    },
    {
      icon: Heart,
      label: 'Health Tips',
      value: 'View',
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      link: '/health-tips',
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="animate-fade-up">
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome to your health management center
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <Link
              key={stat.label}
              to={stat.link}
              className="card-medical group animate-fade-up"
              style={{ animationDelay: `${(index + 1) * 100}ms` }}
            >
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                  <stat.icon className={stat.color} size={24} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Appointments & Medications */}
          <div className="lg:col-span-2 space-y-6">
            {/* Upcoming Appointments */}
            <div className="card-medical animate-fade-up" style={{ animationDelay: '500ms' }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Calendar size={20} className="text-primary" />
                  Upcoming Appointments
                </h2>
                <Link to="/appointments" className="text-primary text-sm hover:underline">
                  View all
                </Link>
              </div>
              {upcomingAppointments.length > 0 ? (
                <div className="space-y-3">
                  {upcomingAppointments.slice(0, 3).map((apt) => (
                    <div
                      key={apt.id}
                      className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Stethoscope size={18} className="text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{apt.doctorName}</p>
                          <p className="text-sm text-muted-foreground">{apt.specialization}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-foreground">{apt.date}</p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 justify-end">
                          <Clock size={12} />
                          {apt.time}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar size={48} className="mx-auto mb-3 opacity-50" />
                  <p>No upcoming appointments</p>
                  <Link to="/appointments" className="text-primary text-sm hover:underline mt-2 inline-block">
                    Book an appointment
                  </Link>
                </div>
              )}
            </div>

            {/* Active Medications */}
            <div className="card-medical animate-fade-up" style={{ animationDelay: '600ms' }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Pill size={20} className="text-success" />
                  Active Medications
                </h2>
                <Link to="/medications" className="text-primary text-sm hover:underline">
                  Manage
                </Link>
              </div>
              {activeReminders.length > 0 ? (
                <div className="space-y-3">
                  {activeReminders.slice(0, 3).map((med) => (
                    <div
                      key={med.id}
                      className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                          <Pill size={18} className="text-success" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{med.name}</p>
                          <p className="text-sm text-muted-foreground">{med.dosage}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-foreground">{med.timesPerDay}x daily</p>
                        <p className="text-sm text-muted-foreground">{med.duration}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Pill size={48} className="mx-auto mb-3 opacity-50" />
                  <p>No active medication reminders</p>
                  <Link to="/medications" className="text-primary text-sm hover:underline mt-2 inline-block">
                    Add a reminder
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Health Tips */}
          <div className="space-y-6">
            {/* Symptom Advice Card */}
            <div className="card-medical border-l-4 border-l-warning animate-fade-up" style={{ animationDelay: '700ms' }}>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-warning/10">
                  <AlertCircle size={20} className="text-warning" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Symptom Advice</h3>
                  <p className="text-sm text-muted-foreground">
                    Sore throat? Drink warm fluids, gargle with salt water, and rest your voice. Honey can also help soothe irritation.
                  </p>
                </div>
              </div>
            </div>

            {/* Daily Health Tip */}
            {dailyTip && (
              <div className="card-medical border-l-4 border-l-success animate-fade-up" style={{ animationDelay: '800ms' }}>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-success/10">
                    <Lightbulb size={20} className="text-success" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Daily Health Tip</h3>
                    <p className="text-lg mb-2">{dailyTip.icon}</p>
                    <p className="font-medium text-foreground">{dailyTip.title}</p>
                    <p className="text-sm text-muted-foreground mt-1">{dailyTip.description}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="card-medical animate-fade-up" style={{ animationDelay: '900ms' }}>
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <TrendingUp size={18} className="text-primary" />
                Quick Actions
              </h3>
              <div className="space-y-2">
                <Link
                  to="/symptom-checker"
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <Stethoscope size={18} className="text-primary" />
                  <span className="text-sm">Check Symptoms</span>
                </Link>
                <Link
                  to="/appointments"
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <Calendar size={18} className="text-primary" />
                  <span className="text-sm">Book Appointment</span>
                </Link>
                <Link
                  to="/medications"
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <Pill size={18} className="text-primary" />
                  <span className="text-sm">Add Medication</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
