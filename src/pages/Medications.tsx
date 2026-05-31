import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useMedications } from '@/hooks/useMedications';
import { usePrescriptions } from '@/hooks/usePrescriptions';
import { Prescription } from '@/types';
import {
  Pill,
  Plus,
  X,
  Bell,
  BellOff,
  Trash2,
  Edit2,
  Clock,
  Check,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Medications = () => {
  const { medications, addMedication, updateMedication, deleteMedication, toggleReminder } = useMedications();
  const { prescriptions } = usePrescriptions();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [timesPerDay, setTimesPerDay] = useState('1');
  const [duration, setDuration] = useState('');
  const [times, setTimes] = useState<string[]>(['08:00']);
  const [reminderEnabled, setReminderEnabled] = useState(true);

  // Notification simulation
  useEffect(() => {
    const activeReminders = medications.filter(m => m.reminderEnabled);
    if (activeReminders.length > 0) {
      const interval = setInterval(() => {
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        activeReminders.forEach(med => {
          if (med.times.includes(currentTime)) {
            toast.info(`💊 Time to take ${med.name} - ${med.dosage}`, {
              duration: 10000,
            });
          }
        });
      }, 60000); // Check every minute

      return () => clearInterval(interval);
    }
  }, [medications]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !dosage || !duration) {
      toast.error('Please fill in all fields');
      return;
    }

    const medicationData = {
      name,
      dosage,
      timesPerDay: parseInt(timesPerDay),
      duration,
      times: times.slice(0, parseInt(timesPerDay)),
      reminderEnabled,
    };

    if (editingId) {
      const ok = await updateMedication(editingId, medicationData);
      if (ok) {
        toast.success('Medication updated');
        setEditingId(null);
      } else {
        toast.error('Failed to update medication');
        return;
      }
    } else {
      const created = await addMedication(medicationData);
      if (created) {
        toast.success('Medication added');
      } else {
        toast.error('Failed to add medication');
        return;
      }
    }
    
    resetForm();
  };

  const resetForm = () => {
    setName('');
    setDosage('');
    setTimesPerDay('1');
    setDuration('');
    setTimes(['08:00']);
    setReminderEnabled(true);
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (medication: typeof medications[0]) => {
    setName(medication.name);
    setDosage(medication.dosage);
    setTimesPerDay(String(medication.timesPerDay));
    setDuration(medication.duration);
    setTimes(medication.times);
    setReminderEnabled(medication.reminderEnabled);
    setEditingId(medication.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    const ok = await deleteMedication(id);
    if (ok) {
      toast.success('Medication deleted');
    } else {
      toast.error('Failed to delete medication');
    }
  };

  const updateTime = (index: number, value: string) => {
    const newTimes = [...times];
    newTimes[index] = value;
    setTimes(newTimes);
  };

  // Adjust times array when timesPerDay changes
  useEffect(() => {
    const count = parseInt(timesPerDay);
    setTimes(prevTimes => {
      if (count > prevTimes.length) {
        const defaultTimes = ['08:00', '12:00', '18:00', '22:00'];
        return [...prevTimes, ...defaultTimes.slice(prevTimes.length, count)];
      } else if (count < prevTimes.length) {
        return prevTimes.slice(0, count);
      }
      return prevTimes;
    });
  }, [timesPerDay]);

  const parseDosagePattern = (dosage: string): { count: number; times: string[] } => {
    // Try to parse patterns like "1-0-1", "1-1-1", "1-0-0-1"
    const dashPattern = dosage.match(/^([01])-([01])-([01])(?:-([01]))?/);
    if (dashPattern) {
      const slots = [dashPattern[1], dashPattern[2], dashPattern[3], dashPattern[4]].filter(Boolean);
      const timeMap = ['08:00', '13:00', '18:00', '22:00'];
      const activeTimes: string[] = [];
      slots.forEach((val, idx) => {
        if (val === '1') activeTimes.push(timeMap[idx]);
      });
      return { count: activeTimes.length || 1, times: activeTimes.length > 0 ? activeTimes : ['08:00'] };
    }
    return { count: 1, times: ['08:00'] };
  };

  const parseDuration = (instructions: string, defaultDuration: string): string => {
    if (defaultDuration) return defaultDuration;
    // Try to extract duration from instructions text
    const durationMatch = instructions?.match(/(?:for\s+)?(\d+)\s*(day|days|week|weeks|month|months)/i);
    if (durationMatch) {
      return `${durationMatch[1]} ${durationMatch[2].toLowerCase()}`;
    }
    return '7 days';
  };

  const handleAddFromPrescription = (prescription: Prescription) => {
    setName(prescription.medicationDetails);
    setDosage(prescription.dosage);

    // Use doctor-specified values if available, otherwise parse
    if (prescription.timesPerDay) {
      setTimesPerDay(String(prescription.timesPerDay));
      const defaultTimeMap = ['08:00', '13:00', '18:00', '22:00'];
      setTimes(defaultTimeMap.slice(0, prescription.timesPerDay));
    } else {
      const parsed = parseDosagePattern(prescription.dosage || '');
      setTimesPerDay(String(parsed.count));
      setTimes(parsed.times);
    }

    const duration = parseDuration(
      prescription.instructions || '',
      prescription.duration || ''
    );
    setDuration(duration);
    setShowForm(true);
    toast.info('Pre-filled from prescription — review and save to set reminder');
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 animate-fade-up">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Medications & Prescriptions</h1>
            <p className="text-muted-foreground mt-1">
              Manage your prescriptions and reminders
            </p>
          </div>
          <button
            onClick={() => {
              if (showForm) resetForm();
              else setShowForm(true);
            }}
            className="btn-medical flex items-center gap-2"
          >
            {showForm ? <X size={18} /> : <Plus size={18} />}
            {showForm ? 'Cancel' : 'Add Reminder'}
          </button>
        </div>

        {/* Add/Edit Form */}
        {showForm && (
          <div className="card-medical mb-8 animate-fade-up">
            <h2 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
              <Pill size={20} className="text-primary" />
              {editingId ? 'Edit Reminder' : 'Add New Reminder'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Medicine Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input-medical"
                    placeholder="e.g., Paracetamol"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Dosage
                  </label>
                  <input
                    type="text"
                    value={dosage}
                    onChange={(e) => setDosage(e.target.value)}
                    className="input-medical"
                    placeholder="e.g., 500mg"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Times Per Day
                  </label>
                  <select
                    value={timesPerDay}
                    onChange={(e) => setTimesPerDay(e.target.value)}
                    className="input-medical"
                  >
                    {[1, 2, 3, 4].map((num) => (
                      <option key={num} value={num}>{num} time{num > 1 ? 's' : ''} per day</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Duration
                  </label>
                  <input
                    type="text"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="input-medical"
                    placeholder="e.g., 7 days, 2 weeks"
                    required
                  />
                </div>
              </div>

              {/* Time Inputs */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Reminder Times
                </label>
                <div className="flex flex-wrap gap-3">
                  {times.slice(0, parseInt(timesPerDay)).map((time, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Clock size={16} className="text-muted-foreground" />
                      <input
                        type="time"
                        value={time}
                        onChange={(e) => updateTime(index, e.target.value)}
                        className="input-medical w-auto"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Reminder Toggle */}
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  {reminderEnabled ? (
                    <Bell size={20} className="text-primary" />
                  ) : (
                    <BellOff size={20} className="text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-medium text-foreground">Enable Reminders</p>
                    <p className="text-sm text-muted-foreground">Get notified when it's time to take your medication</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReminderEnabled(!reminderEnabled)}
                  className={cn(
                    "w-12 h-6 rounded-full transition-colors relative",
                    reminderEnabled ? "bg-primary" : "bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full transition-transform",
                      reminderEnabled ? "translate-x-7" : "translate-x-1"
                    )}
                  />
                </button>
              </div>

              <button
                type="submit"
                className="btn-medical w-full flex items-center justify-center gap-2"
              >
                <Check size={18} />
                {editingId ? 'Update Reminder' : 'Add Reminder'}
              </button>
            </form>
          </div>
        )}

        <Tabs defaultValue="reminders" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="reminders">My Reminders</TabsTrigger>
                <TabsTrigger value="prescriptions">Doctor Prescriptions</TabsTrigger>
            </TabsList>
            
            <TabsContent value="reminders">
                {/* Medications List */}
                <div className="card-medical animate-fade-up" style={{ animationDelay: '100ms' }}>
                <h2 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
                    <Clock size={20} className="text-primary" />
                    Active Reminders
                </h2>

                {medications.length > 0 ? (
                    <div className="space-y-4">
                    {medications.map((med) => (
                        <div
                        key={med.id}
                        className="flex items-center justify-between p-4 bg-muted/50 rounded-xl"
                        >
                        <div className="flex items-center gap-4">
                            <div className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center",
                            med.reminderEnabled ? "bg-success/10" : "bg-muted"
                            )}>
                            <Pill className={med.reminderEnabled ? "text-success" : "text-muted-foreground"} size={24} />
                            </div>
                            <div>
                            <p className="font-semibold text-foreground">{med.name}</p>
                            <p className="text-sm text-muted-foreground">{med.dosage}</p>
                            <div className="flex items-center gap-3 mt-1">
                                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                                {med.timesPerDay}x daily
                                </span>
                                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                                {med.duration}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                {med.times.join(', ')}
                                </span>
                            </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                            onClick={() => toggleReminder(med.id)}
                            className={cn(
                                "p-2 rounded-lg transition-colors",
                                med.reminderEnabled 
                                ? "text-primary hover:bg-primary/10" 
                                : "text-muted-foreground hover:bg-muted"
                            )}
                            title={med.reminderEnabled ? "Disable reminder" : "Enable reminder"}
                            >
                            {med.reminderEnabled ? <Bell size={18} /> : <BellOff size={18} />}
                            </button>
                            <button
                            onClick={() => handleEdit(med)}
                            className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                            title="Edit medication"
                            >
                            <Edit2 size={18} />
                            </button>
                            <button
                            onClick={() => handleDelete(med.id)}
                            className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                            title="Delete medication"
                            >
                            <Trash2 size={18} />
                            </button>
                        </div>
                        </div>
                    ))}
                    </div>
                ) : (
                    <div className="text-center py-12 text-muted-foreground">
                    <Pill size={48} className="mx-auto mb-3 opacity-50" />
                    <p className="text-lg">No reminders added</p>
                    <p className="text-sm mt-1">Add your medications to get reminders</p>
                    </div>
                )}
                </div>
            </TabsContent>
            
            <TabsContent value="prescriptions">
                 <div className="card-medical animate-fade-up" style={{ animationDelay: '100ms' }}>
                    <h2 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
                        <FileText size={20} className="text-primary" />
                        Doctor Prescriptions
                    </h2>
                    
                    {prescriptions.length > 0 ? (
                        <div className="space-y-4">
                            {prescriptions.map((pres) => (
                                <div key={pres.id} className="p-4 bg-muted/50 rounded-xl border border-muted/50">
                                    <div className="flex flex-col md:flex-row justify-between gap-4 mb-4">
                                        <div>
                                            <h3 className="font-semibold text-lg flex items-center gap-2">
                                                Dr. {pres.doctorName}
                                            </h3>
                                            <p className="text-sm text-muted-foreground">{pres.createdAt}</p>
                                        </div>
                                        <button 
                                            onClick={() => handleAddFromPrescription(pres)}
                                            className="text-sm bg-primary/10 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors flex items-center gap-2 self-start"
                                        >
                                            <Plus size={16} />
                                            Add to Reminders
                                        </button>
                                    </div>
                                    
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="bg-background p-3 rounded-lg">
                                                <p className="text-xs text-muted-foreground mb-1">Medication</p>
                                                <p className="font-medium">{pres.medicationDetails}</p>
                                            </div>
                                            <div className="bg-background p-3 rounded-lg">
                                                <p className="text-xs text-muted-foreground mb-1">Dosage</p>
                                                <p className="font-medium">{pres.dosage}</p>
                                            </div>
                                        </div>
                                        
                                        {(pres.duration || pres.timesPerDay) && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {pres.duration && (
                                                    <div className="bg-background p-3 rounded-lg">
                                                        <p className="text-xs text-muted-foreground mb-1">Duration</p>
                                                        <p className="font-medium">{pres.duration}</p>
                                                    </div>
                                                )}
                                                {pres.timesPerDay && (
                                                    <div className="bg-background p-3 rounded-lg">
                                                        <p className="text-xs text-muted-foreground mb-1">Times Per Day</p>
                                                        <p className="font-medium">{pres.timesPerDay}x daily</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {pres.instructions && (
                                            <div className="bg-background p-3 rounded-lg">
                                                <p className="text-xs text-muted-foreground mb-1">Instructions / Tips</p>
                                                <p className="text-sm">{pres.instructions}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-muted-foreground">
                            <FileText size={48} className="mx-auto mb-3 opacity-50" />
                            <p className="text-lg">No prescriptions yet</p>
                            <p className="text-sm mt-1">Prescriptions from your doctor will appear here</p>
                        </div>
                    )}
                 </div>
            </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Medications;
