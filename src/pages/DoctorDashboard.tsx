import { authFetch } from '@/utils/api';
import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { 
  Users, 
  Calendar, 
  Clock, 
  Activity,
  Check,
  X,
  FileText
} from 'lucide-react';
import { useAuthContext } from '@/context/AuthContext';
import { useAppointments } from '@/hooks/useAppointments';
import { Appointment } from '@/types';
import { toast } from 'sonner';

const DoctorDashboard = () => {
  const { user } = useAuthContext();
  const { appointments, updateStatus, fetchAppointments } = useAppointments();
  
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<{patientName: string, text: string} | null>(null);
  
  // Prescription Form
  const [medicationDetails, setMedicationDetails] = useState('');
  const [dosage, setDosage] = useState('');
  const [prescriptionDuration, setPrescriptionDuration] = useState('');
  const [prescriptionTimesPerDay, setPrescriptionTimesPerDay] = useState('1');
  const [instructions, setInstructions] = useState('');

  // Stats calculation
  const stats = [
    {
      icon: Users,
      label: 'Total Patients',
      value: appointments.filter(a => a.status === 'completed').length.toString(),
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      icon: Calendar,
      label: 'Appointments Today',
      value: appointments.filter(a => new Date(a.date).toDateString() === new Date().toDateString()).length.toString(),
      color: 'text-info',
      bgColor: 'bg-info/10',
    },
    {
      icon: Clock,
      label: 'Pending Requests',
      value: appointments.filter(a => a.status === 'pending').length.toString(),
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
  ];

  const handleAccept = async (id: string) => {
    if (await updateStatus(id, 'accepted')) {
      toast.success('Appointment accepted');
    } else {
      toast.error('Failed to accept appointment');
    }
  };

  const handleReject = async (id: string) => {
     if (await updateStatus(id, 'cancelled')) {
      toast.success('Appointment rejected');
    } else {
      toast.error('Failed to reject appointment');
    }
  };

  const handleComplete = async (id: string) => {
    if (await updateStatus(id, 'completed')) {
      toast.success('Appointment completed');
    } else {
      toast.error('Failed to complete appointment');
    }
  };

  const handleOpenPrescription = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setShowPrescriptionModal(true);
  };

  const handleSubmitPrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppointment) return;

    try {
      const response = await authFetch(`/api/prescriptions`, {
        method: 'POST',
        body: JSON.stringify({
          appointment_id: selectedAppointment.id,
          patient_id: selectedAppointment.patientId,
          doctor_id: user?.id,
          medication_details: medicationDetails,
          dosage,
          duration: prescriptionDuration || null,
          times_per_day: parseInt(prescriptionTimesPerDay) || null,
          instructions
        }),
      });

      if (response.ok) {
        toast.success('Prescription sent successfully');
        setShowPrescriptionModal(false);
        setMedicationDetails('');
        setDosage('');
        setPrescriptionDuration('');
        setPrescriptionTimesPerDay('1');
        setInstructions('');
        
        // Optionally mark appointment as completed
        await updateStatus(selectedAppointment.id, 'completed');
      } else {
        toast.error('Failed to send prescription');
      }
    } catch (error) {
      console.error('Error sending prescription:', error);
      toast.error('Error sending prescription');
    }
  };

  const pendingAppointments = appointments.filter(a => a.status === 'pending');
  const activeAppointments = appointments.filter(a => a.status === 'accepted');

  return (
    <DashboardLayout>
       <div className="space-y-6">
        {/* Header */}
        <div className="animate-fade-up">
          <h1 className="text-3xl font-bold text-foreground">Doctor Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back, Dr. {user?.name?.split(' ')[0] || 'User'}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className="card-medical animate-fade-up"
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
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pending Requests */}
            <div className="card-medical animate-fade-up" style={{ animationDelay: '500ms' }}>
                <h3 className="text-lg font-semibold mb-4">Pending Requests</h3>
                {pendingAppointments.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No pending requests</p>
                ) : (
                  <div className="space-y-4">
                      {pendingAppointments.map((apt) => (
                          <div key={apt.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                              <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                      {apt.patientName.charAt(0)}
                                  </div>
                                  <div>
                                      <p className="font-medium">{apt.patientName}</p>
                                      <p className="text-sm text-muted-foreground">{apt.reason || 'General Checkup'}</p>
                                      <p className="text-xs text-muted-foreground">{apt.date} at {apt.time}</p>
                                  </div>
                              </div>
                              <div className="flex gap-2">
                                  <button 
                                    onClick={() => handleAccept(apt.id)}
                                    className="p-2 text-green-600 hover:bg-green-50 rounded-full" 
                                    title="Accept"
                                  >
                                    <Check size={18} />
                                  </button>
                                  <button 
                                    onClick={() => handleReject(apt.id)}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-full" 
                                    title="Reject"
                                  >
                                    <X size={18} />
                                  </button>
                              </div>
                          </div>
                      ))}
                  </div>
                )}
            </div>

            {/* Upcoming/Accepted Appointments */}
             <div className="card-medical animate-fade-up" style={{ animationDelay: '600ms' }}>
                <h3 className="text-lg font-semibold mb-4">Upcoming Appointments</h3>
                {activeAppointments.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No upcoming appointments</p>
                ) : (
                  <div className="space-y-4">
                      {activeAppointments.map((apt) => (
                          <div key={apt.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                              <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                      {apt.patientName.charAt(0)}
                                  </div>
                                  <div>
                                      <p className="font-medium">{apt.patientName}</p>
                                      <p className="text-sm text-muted-foreground">{apt.date} at {apt.time}</p>
                                  </div>
                              </div>
                                <div className="flex gap-2">
                                  {apt.sharedHistory && (
                                    <button
                                      onClick={() => {
                                        setSelectedHistory({ patientName: apt.patientName, text: apt.sharedHistory! });
                                      }}
                                      className="text-xs bg-info text-info-foreground px-3 py-1.5 rounded-lg hover:bg-info/90 flex items-center gap-1"
                                      title="View Shared History"
                                    >
                                      <FileText size={14} />
                                      History
                                    </button>
                                  )}
                                  <button 
                                    onClick={() => handleComplete(apt.id)}
                                    className="text-xs bg-success text-success-foreground px-3 py-1.5 rounded-lg hover:bg-success/90 flex items-center gap-1"
                                  >
                                    <Check size={14} />
                                    Complete
                                  </button>
                                  <button 
                                    onClick={() => handleOpenPrescription(apt)}
                                    className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90 flex items-center gap-1"
                                  >
                                    <FileText size={14} />
                                    Prescribe
                                  </button>
                                </div>
                          </div>
                      ))}
                  </div>
                )}
            </div>
        </div>

        {/* Prescription Modal */}
        {showPrescriptionModal && selectedAppointment && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-2xl w-full max-w-lg p-6 animate-fade-up">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">Write Prescription</h2>
                <button onClick={() => setShowPrescriptionModal(false)} className="text-muted-foreground hover:text-foreground">
                  <X size={24} />
                </button>
              </div>
              
              <div className="mb-4 p-4 bg-muted/50 rounded-xl">
                <p className="font-medium">Patient: {selectedAppointment.patientName}</p>
                <p className="text-sm text-muted-foreground">Date: {selectedAppointment.date}</p>
              </div>

              <form onSubmit={handleSubmitPrescription} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Medication Details</label>
                  <textarea
                    value={medicationDetails}
                    onChange={(e) => setMedicationDetails(e.target.value)}
                    className="input-medical w-full min-h-[80px]"
                    placeholder="e.g. Paracetamol 500mg"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Dosage</label>
                  <input
                    type="text"
                    value={dosage}
                    onChange={(e) => setDosage(e.target.value)}
                    className="input-medical w-full"
                    placeholder="e.g. 1-0-1 after food"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Duration</label>
                    <input
                      type="text"
                      value={prescriptionDuration}
                      onChange={(e) => setPrescriptionDuration(e.target.value)}
                      className="input-medical w-full"
                      placeholder="e.g. 7 days, 2 weeks"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Times Per Day</label>
                    <select
                      value={prescriptionTimesPerDay}
                      onChange={(e) => setPrescriptionTimesPerDay(e.target.value)}
                      className="input-medical w-full"
                    >
                      {[1, 2, 3, 4].map((num) => (
                        <option key={num} value={num}>{num} time{num > 1 ? 's' : ''}/day</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Instructions / Tips</label>
                  <textarea
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    className="input-medical w-full min-h-[100px]"
                    placeholder="Additional instructions, health tips, precautions..."
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowPrescriptionModal(false)}
                    className="px-4 py-2 text-sm font-medium hover:bg-muted rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-medical"
                  >
                    Send Prescription
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Shared History Modal */}
        {selectedHistory && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-2xl w-full max-w-2xl p-6 animate-fade-up flex flex-col max-h-[85vh]">
              <div className="flex justify-between items-center mb-4 pb-4 border-b">
                <div>
                  <h2 className="text-xl font-semibold">Patient Medical History</h2>
                  <p className="text-sm text-muted-foreground">Shared by {selectedHistory.patientName}</p>
                </div>
                <button onClick={() => setSelectedHistory(null)} className="text-muted-foreground hover:text-foreground">
                  <X size={24} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4 text-sm whitespace-pre-wrap">
                {selectedHistory.text}
              </div>

              <div className="flex justify-end pt-4 mt-4 border-t">
                <button
                  type="button"
                  onClick={() => setSelectedHistory(null)}
                  className="btn-medical"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default DoctorDashboard;
