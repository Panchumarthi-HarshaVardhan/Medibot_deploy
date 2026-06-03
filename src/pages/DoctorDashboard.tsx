import { authFetch } from '@/utils/api';
import { useState, useRef, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { 
  Users, 
  Calendar, 
  Clock, 
  Activity,
  Check,
  X,
  FileText,
  Upload,
  File,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ClipboardList,
  Pill,
  FolderOpen,
  Stethoscope,
  ChevronDown,
  ChevronUp,
  History
} from 'lucide-react';
import { useAuthContext } from '@/context/AuthContext';
import { useAppointments } from '@/hooks/useAppointments';
import { Appointment } from '@/types';
import { toast } from 'sonner';

interface UploadFile {
  name: string;
  type: string;
  size: number;
  data: string; // base64
}

interface PatientHistoryData {
  patient: {
    name: string;
    age?: number;
    gender?: string;
    medicalHistory?: string;
  };
  pastAppointments: Array<{
    _id: string;
    date: string;
    time: string;
    reason?: string;
    status: string;
    rating?: number;
  }>;
  prescriptions: Array<{
    _id: string;
    medication_details: string;
    dosage?: string;
    duration?: string;
    times_per_day?: number;
    instructions?: string;
    createdAt: string;
  }>;
  medicalRecords: Array<{
    _id: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    status: string;
    aiAnalysis?: {
      summary?: string;
      conditions?: string[];
      medications?: string[];
      labResults?: string[];
      keyFindings?: string[];
      recommendations?: string[];
    };
    uploaded_by?: { name: string; specialization?: string };
    createdAt: string;
  }>;
  symptomChecks: Array<{
    _id: string;
    symptoms: string;
    condition: string;
    severity: string;
    advice?: string;
    createdAt: string;
  }>;
  hasHistory: boolean;
}

const ACCEPTED_FILE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
  'text/csv',
  'application/json'
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const DoctorDashboard = () => {
  const { user } = useAuthContext();
  const { appointments, updateStatus } = useAppointments();
  
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<{patientName: string, text: string} | null>(null);
  
  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadAppointment, setUploadAppointment] = useState<Appointment | null>(null);
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Patient history modal state
  const [showPatientHistoryModal, setShowPatientHistoryModal] = useState(false);
  const [patientHistory, setPatientHistory] = useState<PatientHistoryData | null>(null);
  const [isLoadingPatientHistory, setIsLoadingPatientHistory] = useState(false);
  const [patientHistoryTab, setPatientHistoryTab] = useState<'appointments' | 'prescriptions' | 'records' | 'symptoms'>('appointments');
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);

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
        
        await updateStatus(selectedAppointment.id, 'completed');
      } else {
        toast.error('Failed to send prescription');
      }
    } catch (error) {
      console.error('Error sending prescription:', error);
      toast.error('Error sending prescription');
    }
  };

  // ── Patient History Handlers ────────────────────────────────────────────────

  const handleViewPatientHistory = async (patientId: string | number | undefined) => {
    if (!patientId) {
      toast.error('Patient ID not available');
      return;
    }
    setIsLoadingPatientHistory(true);
    setShowPatientHistoryModal(true);
    setPatientHistoryTab('appointments');
    setExpandedRecordId(null);

    try {
      const res = await authFetch(`/api/patient-history/${patientId}/doctor-view`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setPatientHistory(data);
    } catch (err) {
      console.error('Error fetching patient history:', err);
      toast.error('Failed to load patient history');
      setShowPatientHistoryModal(false);
    } finally {
      setIsLoadingPatientHistory(false);
    }
  };

  // ── Upload Handlers ─────────────────────────────────────────────────────────

  const handleOpenUpload = (appointment: Appointment) => {
    setUploadAppointment(appointment);
    setUploadFiles([]);
    setUploadResult(null);
    setShowUploadModal(true);
  };

  const readFileAsBase64 = (file: globalThis.File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const processFiles = useCallback(async (fileList: FileList | globalThis.File[]) => {
    const files = Array.from(fileList);
    const currentCount = uploadFiles.length;
    const remaining = 5 - currentCount;

    if (remaining <= 0) {
      toast.error('Maximum 5 files allowed');
      return;
    }

    const filesToProcess = files.slice(0, remaining);
    const newFiles: UploadFile[] = [];

    for (const file of filesToProcess) {
      if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
        toast.error(`"${file.name}" — unsupported file type. Use PDF, images, or text.`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`"${file.name}" — file exceeds 5MB limit.`);
        continue;
      }

      try {
        const base64 = await readFileAsBase64(file);
        newFiles.push({
          name: file.name,
          type: file.type,
          size: file.size,
          data: base64
        });
      } catch {
        toast.error(`Failed to read "${file.name}"`);
      }
    }

    if (newFiles.length > 0) {
      setUploadFiles(prev => [...prev, ...newFiles]);
    }
  }, [uploadFiles.length]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files) {
      processFiles(e.dataTransfer.files);
    }
  };

  const removeFile = (index: number) => {
    setUploadFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUploadSubmit = async () => {
    if (!uploadAppointment || uploadFiles.length === 0) return;

    setIsUploading(true);
    setUploadResult(null);

    try {
      const response = await authFetch('/api/medical-records/upload', {
        method: 'POST',
        body: JSON.stringify({
          patient_id: uploadAppointment.patientId,
          files: uploadFiles.map(f => ({ name: f.name, type: f.type, data: f.data }))
        })
      });

      const data = await response.json();

      if (response.ok) {
        setUploadResult({ success: true, message: data.message });
        toast.success('Medical records uploaded successfully!');
      } else {
        setUploadResult({ success: false, message: data.error || 'Upload failed' });
        toast.error(data.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadResult({ success: false, message: 'Network error. Please try again.' });
      toast.error('Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (type: string) => {
    if (type === 'application/pdf') return '📄';
    if (type.startsWith('image/')) return '🖼️';
    if (type === 'text/plain') return '📝';
    if (type === 'text/csv') return '📊';
    return '📁';
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
                              <div className="flex gap-2 items-center">
                                  <button
                                    onClick={() => handleViewPatientHistory(apt.patientId)}
                                    className="p-2 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-full transition-colors"
                                    title="View Patient Records"
                                  >
                                    <History size={18} />
                                  </button>
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
                                <div className="flex gap-2 flex-wrap justify-end">
                                  <button
                                    onClick={() => handleViewPatientHistory(apt.patientId)}
                                    className="text-xs bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600 flex items-center gap-1 transition-colors"
                                    title="View Patient Records"
                                  >
                                    <History size={14} />
                                    Past Records
                                  </button>
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
                                    onClick={() => handleOpenUpload(apt)}
                                    className="text-xs bg-violet-600 text-white px-3 py-1.5 rounded-lg hover:bg-violet-700 flex items-center gap-1 transition-colors"
                                    title="Upload Medical Records"
                                  >
                                    <Upload size={14} />
                                    Records
                                  </button>
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

        {/* Upload Medical Records Modal */}
        {showUploadModal && uploadAppointment && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-2xl w-full max-w-lg p-6 animate-fade-up shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-5">
                <div>
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Upload size={22} className="text-violet-500" />
                    Upload Medical Records
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    For patient: <span className="font-medium text-foreground">{uploadAppointment.patientName}</span>
                  </p>
                </div>
                <button 
                  onClick={() => setShowUploadModal(false)} 
                  className="text-muted-foreground hover:text-foreground p-1"
                >
                  <X size={22} />
                </button>
              </div>

              {/* Drop Zone */}
              {!uploadResult?.success && (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
                    isDragOver
                      ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/10'
                      : 'border-border hover:border-violet-400 hover:bg-muted/30'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={ACCEPTED_FILE_TYPES.join(',')}
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-100 dark:bg-violet-500/15 text-violet-600 mb-3">
                    <Upload size={28} />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {isDragOver ? 'Drop files here' : 'Drag & drop files or click to browse'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    PDF, Images, Text • Max 5MB each • Up to 5 files
                  </p>
                </div>
              )}

              {/* File List */}
              {uploadFiles.length > 0 && !uploadResult?.success && (
                <div className="mt-4 space-y-2">
                  <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5">
                    <File size={14} />
                    Selected Files ({uploadFiles.length}/5)
                  </h4>
                  {uploadFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-lg">{getFileIcon(file.type)}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        title="Remove file"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload Result */}
              {uploadResult && (
                <div className={`mt-4 p-4 rounded-xl flex items-start gap-3 ${
                  uploadResult.success
                    ? 'bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20'
                    : 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20'
                }`}>
                  {uploadResult.success ? (
                    <CheckCircle2 size={20} className="text-green-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle size={20} className="text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className={`text-sm font-medium ${uploadResult.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                      {uploadResult.success ? 'Upload Successful!' : 'Upload Failed'}
                    </p>
                    <p className={`text-xs mt-0.5 ${uploadResult.success ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
                      {uploadResult.message}
                    </p>
                    {uploadResult.success && (
                      <p className="text-xs text-muted-foreground mt-2">
                        AI is analyzing the records. The patient's medical history will be updated automatically.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 text-sm font-medium hover:bg-muted rounded-lg transition-colors"
                >
                  {uploadResult?.success ? 'Close' : 'Cancel'}
                </button>
                {!uploadResult?.success && (
                  <button
                    onClick={handleUploadSubmit}
                    disabled={uploadFiles.length === 0 || isUploading}
                    className="px-5 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload size={16} />
                        Upload {uploadFiles.length > 0 ? `(${uploadFiles.length})` : ''}
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Patient History Modal */}
        {showPatientHistoryModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-2xl w-full max-w-3xl p-6 animate-fade-up shadow-2xl flex flex-col max-h-[90vh]">
              {isLoadingPatientHistory ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 size={36} className="animate-spin text-primary mb-4" />
                  <p className="text-muted-foreground text-sm">Loading patient records...</p>
                </div>
              ) : patientHistory ? (
                <>
                  {/* Modal Header */}
                  <div className="flex justify-between items-start mb-5 pb-4 border-b border-border">
                    <div>
                      <h2 className="text-xl font-semibold flex items-center gap-2">
                        <ClipboardList size={22} className="text-amber-500" />
                        Patient Records
                      </h2>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-lg font-medium text-foreground">{patientHistory.patient.name}</span>
                        {patientHistory.patient.age && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            Age: {patientHistory.patient.age}
                          </span>
                        )}
                        {patientHistory.patient.gender && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">
                            {patientHistory.patient.gender}
                          </span>
                        )}
                      </div>
                      {patientHistory.patient.medicalHistory && (
                        <p className="text-xs text-muted-foreground mt-1.5 max-w-lg line-clamp-2">
                          📋 {patientHistory.patient.medicalHistory}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => { setShowPatientHistoryModal(false); setPatientHistory(null); }}
                      className="text-muted-foreground hover:text-foreground p-1"
                    >
                      <X size={22} />
                    </button>
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-1 mb-4 p-1 bg-muted/50 rounded-xl">
                    {([
                      { key: 'appointments' as const, label: 'Appointments', icon: Calendar, count: patientHistory.pastAppointments.length },
                      { key: 'prescriptions' as const, label: 'Prescriptions', icon: Pill, count: patientHistory.prescriptions.length },
                      { key: 'records' as const, label: 'Records', icon: FolderOpen, count: patientHistory.medicalRecords.length },
                      { key: 'symptoms' as const, label: 'Symptoms', icon: Stethoscope, count: patientHistory.symptomChecks.length },
                    ]).map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setPatientHistoryTab(tab.key)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                          patientHistoryTab === tab.key
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <tab.icon size={14} />
                        {tab.label}
                        {tab.count > 0 && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                            patientHistoryTab === tab.key
                              ? 'bg-primary/10 text-primary'
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {tab.count}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Tab Content */}
                  <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
                    {/* Past Appointments Tab */}
                    {patientHistoryTab === 'appointments' && (
                      <div className="space-y-3">
                        {patientHistory.pastAppointments.length === 0 ? (
                          <div className="text-center py-10 text-muted-foreground">
                            <Calendar size={36} className="mx-auto mb-3 opacity-20" />
                            <p className="text-sm">No past appointments with this patient</p>
                          </div>
                        ) : (
                          patientHistory.pastAppointments.map((apt) => (
                            <div key={apt._id} className="p-4 bg-muted/30 rounded-xl border border-border">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium">
                                    {new Date(apt.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                                    {' '}at {apt.time}
                                  </p>
                                  {apt.reason && (
                                    <p className="text-xs text-muted-foreground mt-0.5">Reason: {apt.reason}</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                    apt.status === 'completed'
                                      ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400'
                                      : 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400'
                                  }`}>
                                    {apt.status}
                                  </span>
                                  {apt.rating && (
                                    <span className="text-xs text-amber-500 font-medium">⭐ {apt.rating}/5</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* Prescriptions Tab */}
                    {patientHistoryTab === 'prescriptions' && (
                      <div className="space-y-3">
                        {patientHistory.prescriptions.length === 0 ? (
                          <div className="text-center py-10 text-muted-foreground">
                            <Pill size={36} className="mx-auto mb-3 opacity-20" />
                            <p className="text-sm">No prescriptions given to this patient</p>
                          </div>
                        ) : (
                          patientHistory.prescriptions.map((rx) => (
                            <div key={rx._id} className="p-4 bg-muted/30 rounded-xl border border-border">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <p className="text-sm font-semibold text-foreground">{rx.medication_details}</p>
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {rx.dosage && (
                                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400">
                                        💊 {rx.dosage}
                                      </span>
                                    )}
                                    {rx.duration && (
                                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400">
                                        ⏱ {rx.duration}
                                      </span>
                                    )}
                                    {rx.times_per_day && (
                                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400">
                                        {rx.times_per_day}x/day
                                      </span>
                                    )}
                                  </div>
                                  {rx.instructions && (
                                    <p className="text-xs text-muted-foreground mt-2 italic">📝 {rx.instructions}</p>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground shrink-0 ml-3">
                                  {new Date(rx.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* Medical Records Tab */}
                    {patientHistoryTab === 'records' && (
                      <div className="space-y-3">
                        {patientHistory.medicalRecords.length === 0 ? (
                          <div className="text-center py-10 text-muted-foreground">
                            <FolderOpen size={36} className="mx-auto mb-3 opacity-20" />
                            <p className="text-sm">No medical records uploaded for this patient</p>
                          </div>
                        ) : (
                          patientHistory.medicalRecords.map((rec) => (
                            <div key={rec._id} className="border border-border rounded-xl overflow-hidden">
                              <div
                                className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                                onClick={() => setExpandedRecordId(expandedRecordId === rec._id ? null : rec._id)}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <span className="text-xl">{getFileIcon(rec.fileType)}</span>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">{rec.fileName}</p>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <span>{formatFileSize(rec.fileSize)}</span>
                                      <span>•</span>
                                      <span>{new Date(rec.createdAt).toLocaleDateString()}</span>
                                      {rec.uploaded_by && (
                                        <>
                                          <span>•</span>
                                          <span>Dr. {rec.uploaded_by.name}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                    rec.status === 'analyzed'
                                      ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400'
                                      : rec.status === 'pending'
                                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                                      : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400'
                                  }`}>
                                    {rec.status}
                                  </span>
                                  {expandedRecordId === rec._id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </div>
                              </div>
                              {expandedRecordId === rec._id && rec.status === 'analyzed' && rec.aiAnalysis && (
                                <div className="px-4 pb-4 border-t border-border bg-muted/20 space-y-3 pt-3">
                                  {rec.aiAnalysis.summary && (
                                    <div className="p-3 bg-violet-50 dark:bg-violet-500/10 rounded-lg text-sm">
                                      <p className="text-xs font-semibold text-violet-700 dark:text-violet-400 mb-1 uppercase">Summary</p>
                                      <p>{rec.aiAnalysis.summary}</p>
                                    </div>
                                  )}
                                  {rec.aiAnalysis.conditions && rec.aiAnalysis.conditions.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                      {rec.aiAnalysis.conditions.map((c, i) => (
                                        <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400">
                                          {c}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  {rec.aiAnalysis.medications && rec.aiAnalysis.medications.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                      {rec.aiAnalysis.medications.map((m, i) => (
                                        <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400">
                                          {m}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  {rec.aiAnalysis.keyFindings && rec.aiAnalysis.keyFindings.length > 0 && (
                                    <ul className="text-sm space-y-1 text-muted-foreground">
                                      {rec.aiAnalysis.keyFindings.map((f, i) => (
                                        <li key={i} className="flex items-start gap-2">
                                          <span className="text-amber-500 mt-0.5">•</span>
                                          <span>{f}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* Symptom Checks Tab */}
                    {patientHistoryTab === 'symptoms' && (
                      <div className="space-y-3">
                        {patientHistory.symptomChecks.length === 0 ? (
                          <div className="text-center py-10 text-muted-foreground">
                            <Stethoscope size={36} className="mx-auto mb-3 opacity-20" />
                            <p className="text-sm">No symptom checks recorded for this patient</p>
                          </div>
                        ) : (
                          patientHistory.symptomChecks.map((sc) => (
                            <div key={sc._id} className="p-4 bg-muted/30 rounded-xl border border-border">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <p className="text-sm font-semibold text-foreground">{sc.condition}</p>
                                  <p className="text-xs text-muted-foreground mt-1">Symptoms: {sc.symptoms}</p>
                                  {sc.advice && (
                                    <p className="text-xs text-muted-foreground mt-1 italic">💡 {sc.advice}</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0 ml-3">
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                    sc.severity === 'severe'
                                      ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400'
                                      : sc.severity === 'moderate'
                                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                                      : 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400'
                                  }`}>
                                    {sc.severity}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(sc.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Modal Footer */}
                  <div className="flex justify-between items-center pt-4 mt-4 border-t border-border">
                    <p className="text-xs text-muted-foreground">
                      {patientHistory.hasHistory 
                        ? `${patientHistory.pastAppointments.length} visit(s) • ${patientHistory.prescriptions.length} prescription(s) • ${patientHistory.medicalRecords.length} record(s)`
                        : 'This is a new patient — no prior history'}
                    </p>
                    <button
                      onClick={() => { setShowPatientHistoryModal(false); setPatientHistory(null); }}
                      className="btn-medical"
                    >
                      Close
                    </button>
                  </div>
                </>
              ) : null}
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
