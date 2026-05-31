import { authFetch } from '@/utils/api';
import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { symptoms } from '@/data/symptoms';
import { SymptomResult } from '@/types';
import { 
  Stethoscope, 
  ArrowRight, 
  ArrowLeft, 
  Check,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Calendar,
  RefreshCw
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuthContext } from '@/context/AuthContext';

type Step = 'age' | 'gender' | 'symptoms' | 'result';

const SymptomChecker = () => {
  const { user } = useAuthContext();
  const [currentStep, setCurrentStep] = useState<Step>('age');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [result, setResult] = useState<SymptomResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const steps: Step[] = ['age', 'gender', 'symptoms', 'result'];
  const currentStepIndex = steps.indexOf(currentStep);

  const handleNext = async () => {
    if (currentStep === 'symptoms') {
      setIsAnalyzing(true);
      try {
        const response = await authFetch('/api/symptom-checker', {
          method: 'POST',
          body: JSON.stringify({
            symptoms: [...selectedSymptoms, additionalInfo].filter(Boolean),
            age: parseInt(age),
            gender
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Symptom check failed');
        }

        if (data.type === 'missing_information') {
          throw new Error(data.message || 'Please describe your symptoms.');
        }
        
        if (data.type === 'symptom_analysis') {
          setResult({
            condition: data.condition,
            severity: (['mild', 'moderate', 'severe'].includes(data.severity)
              ? data.severity
              : 'moderate') as SymptomResult['severity'],
            advice: data.advice,
            recommendation: data.recommendation
          });

          // Save history to backend
          if (user?.id) {
            authFetch('/api/symptom-checker/save', {
              method: 'POST',
              body: JSON.stringify({
                patient_id: user.id,
                symptoms: [...selectedSymptoms, additionalInfo].filter(Boolean).join(', '),
                condition: data.condition,
                severity: data.severity,
                advice: data.advice,
                recommendation: data.recommendation
              })
            }).catch(console.error);
          }
        } else {
          throw new Error(data.content || 'Error analyzing symptoms');
        }
        
        setCurrentStep('result');
      } catch (error) {
        console.error('Symptom checker error:', error);
        alert('Error analyzing symptoms. Please try again.');
      } finally {
        setIsAnalyzing(false);
      }
    } else {
      const nextStep = steps[currentStepIndex + 1];
      if (nextStep) setCurrentStep(nextStep);
    }
  };

  const handleBack = () => {
    const prevStep = steps[currentStepIndex - 1];
    if (prevStep) setCurrentStep(prevStep);
  };

  const handleReset = () => {
    setCurrentStep('age');
    setAge('');
    setGender('');
    setSelectedSymptoms([]);
    setAdditionalInfo('');
    setResult(null);
  };

  const toggleSymptom = (symptom: string) => {
    setSelectedSymptoms(prev =>
      prev.includes(symptom)
        ? prev.filter(s => s !== symptom)
        : [...prev, symptom]
    );
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'age':
        return age && parseInt(age) > 0 && parseInt(age) < 120;
      case 'gender':
        return gender !== '';
      case 'symptoms':
        return selectedSymptoms.length > 0;
      default:
        return true;
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'mild':
        return <CheckCircle className="text-success" size={24} />;
      case 'moderate':
        return <AlertCircle className="text-warning" size={24} />;
      case 'severe':
        return <AlertTriangle className="text-destructive" size={24} />;
      default:
        return null;
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-up">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-4">
            <Stethoscope size={32} />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Symptom Checker</h1>
          <p className="text-muted-foreground mt-1">
            Answer a few questions to get health guidance
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-8 animate-fade-up" style={{ animationDelay: '100ms' }}>
          {steps.map((step, index) => (
            <div key={step} className="flex items-center">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                  index < currentStepIndex
                    ? "bg-primary text-primary-foreground"
                    : index === currentStepIndex
                    ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {index < currentStepIndex ? <Check size={16} /> : index + 1}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "w-12 h-1 mx-1",
                    index < currentStepIndex ? "bg-primary" : "bg-muted"
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Form Card */}
        <div className="card-medical animate-fade-up" style={{ animationDelay: '200ms' }}>
          {/* Age Step */}
          {currentStep === 'age' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-2">What's your age?</h2>
                <p className="text-muted-foreground text-sm">This helps us provide age-appropriate advice</p>
              </div>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="input-medical text-center text-2xl"
                placeholder="Enter your age"
                min="1"
                max="120"
              />
            </div>
          )}

          {/* Gender Step */}
          {currentStep === 'gender' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-2">What's your gender?</h2>
                <p className="text-muted-foreground text-sm">Some conditions vary by gender</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {['Male', 'Female', 'Other'].map((g) => (
                  <button
                    key={g}
                    onClick={() => setGender(g)}
                    className={cn(
                      "p-4 rounded-xl border-2 transition-all duration-200",
                      gender === g
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <span className="font-medium">{g}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Symptoms Step */}
          {currentStep === 'symptoms' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-2">Select your symptoms</h2>
                <p className="text-muted-foreground text-sm">Choose all that apply</p>
              </div>
              <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-2">
                {symptoms.map((symptom) => (
                  <button
                    key={symptom}
                    onClick={() => toggleSymptom(symptom)}
                    className={cn(
                      "p-3 rounded-lg border text-left transition-all duration-200",
                      selectedSymptoms.includes(symptom)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <span className="text-sm font-medium">{symptom}</span>
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Additional information (optional)
                </label>
                <textarea
                  value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                  className="input-medical h-24 resize-none"
                  placeholder="Describe any other symptoms or relevant details..."
                />
              </div>
            </div>
          )}

          {/* Result Step */}
          {currentStep === 'result' && result && (
            <div className="space-y-6">
              <div className="text-center">
                {getSeverityIcon(result.severity)}
                <h2 className="text-xl font-semibold text-foreground mt-3">{result.condition}</h2>
                <span className={cn(
                  "inline-block mt-2",
                  result.severity === 'mild' && "badge-severity-mild",
                  result.severity === 'moderate' && "badge-severity-moderate",
                  result.severity === 'severe' && "badge-severity-severe"
                )}>
                  {result.severity.charAt(0).toUpperCase() + result.severity.slice(1)} Severity
                </span>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h3 className="font-medium text-foreground mb-2">Care Advice</h3>
                  <p className="text-muted-foreground text-sm">{result.advice}</p>
                </div>

                <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                  <h3 className="font-medium text-foreground mb-2">Recommendation</h3>
                  <p className="text-primary text-sm font-medium">{result.recommendation}</p>
                </div>

                {result.severity !== 'mild' && (
                  <Link
                    to="/appointments"
                    className="btn-medical w-full flex items-center justify-center gap-2"
                  >
                    <Calendar size={18} />
                    Book an Appointment
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t border-border">
            {currentStep !== 'age' && currentStep !== 'result' ? (
              <button
                onClick={handleBack}
                className="flex items-center gap-2 px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft size={18} />
                Back
              </button>
            ) : currentStep === 'result' ? (
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw size={18} />
                Start Over
              </button>
            ) : (
              <div />
            )}

            {currentStep !== 'result' && (
              <button
                onClick={handleNext}
                disabled={!canProceed() || isAnalyzing}
                className="btn-medical flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAnalyzing ? 'Analyzing...' : (currentStep === 'symptoms' ? 'Analyze' : 'Next')}
                {!isAnalyzing && <ArrowRight size={18} />}
              </button>
            )}
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-center text-sm text-muted-foreground mt-6 animate-fade-up" style={{ animationDelay: '300ms' }}>
          ⚠️ This tool provides general guidance only. Always consult a healthcare professional for medical advice.
        </p>
      </div>
    </DashboardLayout>
  );
};

export default SymptomChecker;
