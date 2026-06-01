import { authFetch } from '@/utils/api';
import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuthContext } from '@/context/AuthContext';
import { Activity, FileText, Send, Loader2, Save } from 'lucide-react';

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

const MedicalHistory = () => {
  const { user } = useAuthContext();
  const [medicalHistory, setMedicalHistory] = useState(user?.medicalHistory || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<HistoryAnalysisResult | null>(null);
  const [appointments, setAppointments] = useState<ShareableAppointment[]>([]);
  const [sharingStatus, setSharingStatus] = useState<Record<string, string>>({});

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

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="animate-fade-up">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Activity className="text-primary" size={32} />
            Medical History
          </h1>
          <p className="text-muted-foreground mt-1">
            Track your health background and share it with your doctors
          </p>
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
                      {new Date(apt.date).toLocaleDateString()} at {apt.time}
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
