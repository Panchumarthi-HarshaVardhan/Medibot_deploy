import { authFetch } from '@/utils/api';
import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuthContext } from '@/context/AuthContext';
import { 
  Activity, 
  FileText, 
  Send, 
  Loader2, 
  Save, 
  FolderOpen, 
  Download, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Search
} from 'lucide-react';

interface HistoryAnalysisResult {
  overallHealthStatus: string;
  chronicConditions: string[];
  keyRiskFactors: string[];
  medicationInteractionsOrWarnings: string;
  preventativeRecommendations: string[];
  summaryForDoctor: string;
}

interface ShareableAppointment {
  _id: string;
  status: string;
  doctor_name?: string;
  date?: string;
  time?: string;
}

interface MedicalRecordAIAnalysis {
  summary?: string;
  conditions?: string[];
  medications?: string[];
  labResults?: string[];
  keyFindings?: string[];
  recommendations?: string[];
}

interface MedicalRecordItem {
  _id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  status: 'pending' | 'analyzed' | 'error';
  aiAnalysis?: MedicalRecordAIAnalysis;
  uploaded_by?: { name: string; specialization?: string };
  createdAt: string;
}

const MedicalHistory = () => {
  const { user } = useAuthContext();
  const [medicalHistory, setMedicalHistory] = useState(user?.medicalHistory || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<HistoryAnalysisResult | null>(null);
  const [appointments, setAppointments] = useState<ShareableAppointment[]>([]);
  const [sharingStatus, setSharingStatus] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');

  // Medical records state
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecordItem[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    // Fetch upcoming appointments where we can share history
    if (user?.id) {
      authFetch(`/api/appointments?user_id=${user.id}&role=patient`)
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          // Only allow sharing with accepted or confirmed appointments
          const shareable = (data as ShareableAppointment[]).filter(
            (apt) => apt.status === 'accepted' || apt.status === 'confirmed'
          );
          setAppointments(shareable);
        })
        .catch(console.error);
    }
  }, [user?.id]);

  // Fetch medical records
  useEffect(() => {
    if (user?.id) {
      setIsLoadingRecords(true);
      authFetch(`/api/medical-records/${user.id}`)
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          setMedicalRecords(Array.isArray(data) ? data : []);
        })
        .catch(console.error)
        .finally(() => setIsLoadingRecords(false));
    }
  }, [user?.id]);

  const handleSaveHistory = async () => {
    if (!user?.id) return;
    setIsSaving(true);
    try {
      const res = await authFetch(`/api/user/medical-history`, {
        method: 'PUT',
        body: JSON.stringify({ userId: user.id, medicalHistory }),
      });
      if (!res.ok) throw new Error('Failed to save');
      alert('Medical history updated successfully!');
    } catch (err) {
      alert('Error updating medical history.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAnalyzeHistory = async () => {
    if (!user?.id) return;
    setIsAnalyzing(true);
    try {
      const res = await authFetch(`/api/history/analyze`, {
        method: 'POST',
        body: JSON.stringify({ userId: user.id }),
      });
      if (!res.ok) throw new Error('Failed to analyze');
      const data = await res.json();
      setAnalysisResult(data);
    } catch (err) {
      alert('Error analyzing medical history.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleShareHistory = async (appointmentId: string) => {
    if (!analysisResult) {
      alert('Please analyze your history first before sharing.');
      return;
    }
    setSharingStatus(prev => ({ ...prev, [appointmentId]: 'sharing' }));
    
    // Create a comprehensive text document
    const historyText = `
PATIENT HEALTH SUMMARY
======================
Overall Status: ${analysisResult.overallHealthStatus || 'N/A'}

CHRONIC CONDITIONS:
${(analysisResult.chronicConditions || []).map((c: string) => '- ' + c).join('\n') || '- None'}

KEY RISK FACTORS:
${(analysisResult.keyRiskFactors || []).map((r: string) => '- ' + r).join('\n') || '- None'}

MEDICATION WARNINGS:
${analysisResult.medicationInteractionsOrWarnings || 'None'}

RECOMMENDATIONS:
${(analysisResult.preventativeRecommendations || []).map((r: string) => '- ' + r).join('\n') || '- None'}

SUMMARY FOR DOCTOR:
${analysisResult.summaryForDoctor || 'N/A'}
    `.trim();

    try {
      const res = await authFetch(`/api/appointments/${appointmentId}/share-history`, {
        method: 'POST',
        body: JSON.stringify({ historyText }),
      });
      if (!res.ok) throw new Error('Failed to share');
      setSharingStatus(prev => ({ ...prev, [appointmentId]: 'shared' }));
      setTimeout(() => {
        setSharingStatus(prev => ({ ...prev, [appointmentId]: '' }));
      }, 3000);
    } catch (err) {
      setSharingStatus(prev => ({ ...prev, [appointmentId]: 'error' }));
      alert('Error sharing history.');
    }
  };

  const handleDownloadRecord = async (recordId: string, fileName: string) => {
    setDownloadingId(recordId);
    try {
      const res = await authFetch(`/api/medical-records/file/${recordId}`);
      if (!res.ok) throw new Error('Download failed');
      const data = await res.json();
      
      // Create a download link from Base64
      const link = document.createElement('a');
      link.href = `data:${data.fileType};base64,${data.fileData}`;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('Error downloading file.');
    } finally {
      setDownloadingId(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'analyzed':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400">
            <CheckCircle2 size={12} />
            Analyzed
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
            <Clock size={12} />
            Processing
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400">
            <AlertCircle size={12} />
            Error
          </span>
        );
      default:
        return null;
    }
  };

  const getFileIcon = (type: string) => {
    if (type === 'application/pdf') return '📄';
    if (type.startsWith('image/')) return '🖼️';
    if (type === 'text/plain') return '📝';
    if (type === 'text/csv') return '📊';
    return '📁';
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                <Activity className="text-primary" size={32} />
                Medical History
              </h1>
              <p className="text-muted-foreground mt-1">
                Track your health background and share it with your doctors
              </p>
            </div>
            {user && (
              <button
                onClick={async () => {
                  try {
                    const res = await authFetch(`/api/pdf/summary/${user.id}`);
                    if (!res.ok) throw new Error('Download failed');
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `Health_Summary_${user.name?.replace(/\s+/g, '_') || 'Patient'}.pdf`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                  } catch (err) {
                    alert('Failed to download PDF summary');
                  }
                }}
                className="btn-medical flex items-center gap-2 whitespace-nowrap"
              >
                <Download size={18} />
                Download PDF Summary
              </button>
            )}
          </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column: Manual History */}
          <div className="card-medical animate-fade-up space-y-4" style={{ animationDelay: '100ms' }}>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <FileText className="text-primary" size={24} />
              Personal Health Record
            </h2>
            <p className="text-sm text-muted-foreground">
              Note down any chronic conditions, past surgeries, or allergies.
            </p>
            <textarea
              className="w-full h-48 p-4 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none resize-none transition-all"
              placeholder="e.g. Diagnosed with Type 2 Diabetes in 2018. Allergic to Penicillin. Appendectomy in 2015."
              value={medicalHistory}
              onChange={(e) => setMedicalHistory(e.target.value)}
            />
            <button
              onClick={handleSaveHistory}
              disabled={isSaving}
              className="btn-medical w-full flex justify-center items-center gap-2"
            >
              {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              Save History
            </button>
          </div>

          {/* Right Column: AI Analysis */}
          <div className="card-medical animate-fade-up space-y-4 flex flex-col" style={{ animationDelay: '200ms' }}>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Activity className="text-primary" size={24} />
              AI Health Analysis
            </h2>
            <p className="text-sm text-muted-foreground">
              Our AI can analyze your manual history, past symptom checks, and prescriptions to generate a comprehensive health summary.
            </p>
            
            {!analysisResult ? (
              <div className="flex-1 flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Activity size={48} className="mb-4 opacity-20" />
                <button
                  onClick={handleAnalyzeHistory}
                  disabled={isAnalyzing}
                  className="btn-medical flex items-center justify-center gap-2 mt-4 px-6 py-2"
                >
                  {isAnalyzing ? <Loader2 className="animate-spin" size={18} /> : null}
                  {isAnalyzing ? 'Analyzing...' : 'Generate Analysis'}
                </button>
              </div>
            ) : (
              <div className="flex-1 space-y-4 overflow-y-auto max-h-96 pr-2 custom-scrollbar">
                <div className="p-4 bg-primary/10 rounded-lg">
                  <h3 className="font-medium mb-1">Overall Status</h3>
                  <p className="text-sm">{analysisResult.overallHealthStatus}</p>
                </div>
                
                <div>
                  <h3 className="font-medium mb-2 text-sm text-foreground/80 font-semibold uppercase tracking-wider">Chronic Conditions</h3>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {(analysisResult.chronicConditions || []).map((c: string, i: number) => <li key={i}>{c}</li>)}
                    {(!analysisResult.chronicConditions || analysisResult.chronicConditions.length === 0) && <li className="text-muted-foreground">None reported</li>}
                  </ul>
                </div>

                <div>
                  <h3 className="font-medium mb-2 text-sm text-foreground/80 font-semibold uppercase tracking-wider">Key Risk Factors</h3>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {(analysisResult.keyRiskFactors || []).map((r: string, i: number) => <li key={i}>{r}</li>)}
                    {(!analysisResult.keyRiskFactors || analysisResult.keyRiskFactors.length === 0) && <li className="text-muted-foreground">None identified</li>}
                  </ul>
                </div>

                {analysisResult.medicationInteractionsOrWarnings && (
                  <div className="p-3 bg-warning/10 text-warning-foreground rounded-lg border border-warning/20">
                    <h3 className="font-medium mb-1 text-sm">Medication Notice</h3>
                    <p className="text-sm">{analysisResult.medicationInteractionsOrWarnings}</p>
                  </div>
                )}
                
                <button
                  onClick={handleAnalyzeHistory}
                  disabled={isAnalyzing}
                  className="text-primary text-sm hover:underline mt-2 flex items-center gap-1"
                >
                  {isAnalyzing ? <Loader2 className="animate-spin" size={14} /> : <Activity size={14} />}
                  Re-analyze
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Doctor's Medical Records Section */}
        <div className="card-medical animate-fade-up space-y-4" style={{ animationDelay: '250ms' }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <FolderOpen className="text-violet-500" size={24} />
                Doctor's Medical Records
              </h2>
              <p className="text-sm text-muted-foreground">
                Medical records and documents uploaded by your doctors. AI automatically analyzes these and updates your health history.
              </p>
            </div>
            <div className="relative w-full sm:w-64 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input
                type="text"
                placeholder="Search records..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-medical pl-9 py-2 text-sm w-full"
              />
            </div>
          </div>

          {isLoadingRecords ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="animate-spin text-muted-foreground" size={28} />
            </div>
          ) : medicalRecords.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground bg-muted/30 rounded-xl">
              <FolderOpen size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No medical records uploaded by doctors yet.</p>
              <p className="text-xs mt-1">Records will appear here when your doctor uploads them.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {medicalRecords.filter(r => r.fileName.toLowerCase().includes(searchQuery.toLowerCase()) || r.status.toLowerCase().includes(searchQuery.toLowerCase())).map((record) => (
                <div
                  key={record._id}
                  className="border border-border rounded-xl overflow-hidden transition-all duration-200 hover:border-violet-300 dark:hover:border-violet-500/40"
                >
                  {/* Record Header */}
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedRecord(expandedRecord === record._id ? null : record._id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-2xl">{getFileIcon(record.fileType)}</span>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{record.fileName}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span>{formatFileSize(record.fileSize)}</span>
                          <span>•</span>
                          <span>{new Date(record.createdAt).toLocaleDateString()}</span>
                          {record.uploaded_by && (
                            <>
                              <span>•</span>
                              <span>Dr. {record.uploaded_by.name}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {getStatusBadge(record.status)}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDownloadRecord(record._id, record.fileName); }}
                        disabled={downloadingId === record._id}
                        className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        title="Download"
                      >
                        {downloadingId === record._id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Download size={16} />
                        )}
                      </button>
                      {expandedRecord === record._id ? (
                        <ChevronUp size={18} className="text-muted-foreground" />
                      ) : (
                        <ChevronDown size={18} className="text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Expanded AI Analysis */}
                  {expandedRecord === record._id && record.status === 'analyzed' && record.aiAnalysis && (
                    <div className="px-4 pb-4 border-t border-border bg-muted/20">
                      <div className="pt-4 space-y-3">
                        {/* Summary */}
                        {record.aiAnalysis.summary && (
                          <div className="p-3 bg-violet-50 dark:bg-violet-500/10 rounded-lg border border-violet-200 dark:border-violet-500/20">
                            <h4 className="text-xs font-semibold text-violet-700 dark:text-violet-400 uppercase tracking-wider mb-1">Summary</h4>
                            <p className="text-sm text-foreground">{record.aiAnalysis.summary}</p>
                          </div>
                        )}

                        {/* Conditions */}
                        {record.aiAnalysis.conditions && record.aiAnalysis.conditions.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-foreground/70 uppercase tracking-wider mb-1.5">Conditions Found</h4>
                            <div className="flex flex-wrap gap-1.5">
                              {record.aiAnalysis.conditions.map((c, i) => (
                                <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400 font-medium">
                                  {c}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Medications */}
                        {record.aiAnalysis.medications && record.aiAnalysis.medications.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-foreground/70 uppercase tracking-wider mb-1.5">Medications</h4>
                            <div className="flex flex-wrap gap-1.5">
                              {record.aiAnalysis.medications.map((m, i) => (
                                <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400 font-medium">
                                  {m}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Lab Results */}
                        {record.aiAnalysis.labResults && record.aiAnalysis.labResults.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-foreground/70 uppercase tracking-wider mb-1.5">Lab Results</h4>
                            <ul className="text-sm space-y-1 text-muted-foreground">
                              {record.aiAnalysis.labResults.map((l, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="text-primary mt-1">•</span>
                                  <span>{l}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Key Findings */}
                        {record.aiAnalysis.keyFindings && record.aiAnalysis.keyFindings.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-foreground/70 uppercase tracking-wider mb-1.5">Key Findings</h4>
                            <ul className="text-sm space-y-1 text-muted-foreground">
                              {record.aiAnalysis.keyFindings.map((f, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="text-amber-500 mt-1">•</span>
                                  <span>{f}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Recommendations */}
                        {record.aiAnalysis.recommendations && record.aiAnalysis.recommendations.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-foreground/70 uppercase tracking-wider mb-1.5">Recommendations</h4>
                            <ul className="text-sm space-y-1 text-muted-foreground">
                              {record.aiAnalysis.recommendations.map((r, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="text-green-500 mt-1">•</span>
                                  <span>{r}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Pending/Error state in expanded view */}
                  {expandedRecord === record._id && record.status === 'pending' && (
                    <div className="px-4 pb-4 border-t border-border">
                      <div className="flex items-center gap-3 py-4 text-muted-foreground">
                        <Loader2 size={18} className="animate-spin" />
                        <p className="text-sm">AI analysis is in progress. Please check back shortly.</p>
                      </div>
                    </div>
                  )}

                  {expandedRecord === record._id && record.status === 'error' && (
                    <div className="px-4 pb-4 border-t border-border">
                      <div className="flex items-center gap-3 py-4 text-red-500">
                        <AlertCircle size={18} />
                        <p className="text-sm">AI analysis encountered an error. The file has been stored for manual review.</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Share History Section */}
        <div className="card-medical animate-fade-up space-y-4" style={{ animationDelay: '300ms' }}>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Send className="text-primary" size={24} />
            Share with Doctors
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            You can share your AI-generated health summary with doctors for your upcoming appointments.
          </p>

          {appointments.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground bg-muted/30 rounded-xl">
              No upcoming accepted appointments to share history with.
            </div>
          ) : (
            <div className="space-y-3">
              {appointments.map(apt => (
                <div key={apt._id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-muted/50 rounded-xl gap-4">
                  <div>
                    <h3 className="font-medium text-foreground">Dr. {apt.doctor_name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {new Date(apt.date!).toLocaleDateString()} at {apt.time}
                    </p>
                  </div>
                  <button
                    onClick={() => handleShareHistory(apt._id)}
                    disabled={sharingStatus[apt._id] === 'sharing' || sharingStatus[apt._id] === 'shared'}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2
                      ${sharingStatus[apt._id] === 'shared' 
                        ? 'bg-success text-success-foreground' 
                        : 'bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50'}`}
                  >
                    {sharingStatus[apt._id] === 'sharing' ? (
                      <><Loader2 size={16} className="animate-spin" /> Sharing...</>
                    ) : sharingStatus[apt._id] === 'shared' ? (
                      'Shared Successfully'
                    ) : (
                      <><Send size={16} /> Share History</>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default MedicalHistory;
