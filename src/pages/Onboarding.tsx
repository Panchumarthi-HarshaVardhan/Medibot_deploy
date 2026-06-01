import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, ArrowRight, Loader2 } from 'lucide-react';
import { useAuthContext } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { API_BASE, parseJsonResponse } from '@/utils/api';

const Onboarding = () => {
  const { user, setUser } = useAuthContext();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    age: '',
    gender: '',
    medicalHistory: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.age || !formData.gender) {
      toast({
        title: "Missing Information",
        description: "Please provide your age and gender to continue.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE}/api/profile/${user?.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token}`
        },
        body: JSON.stringify({
          age: parseInt(formData.age, 10),
          gender: formData.gender,
          medicalHistory: formData.medicalHistory
        })
      });

      const data = await parseJsonResponse<any>(response);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save profile');
      }

      // Update local context
      if (user) {
        setUser({
          ...user,
          age: parseInt(formData.age, 10),
          gender: formData.gender as 'male' | 'female' | 'other',
          medicalHistory: formData.medicalHistory
        });
      }

      toast({
        title: "Profile Complete",
        description: "Welcome to MediBot!",
      });

      navigate('/dashboard');
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <div className="bg-background rounded-2xl shadow-elevated w-full max-w-md p-8 animate-fade-up">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
            <Activity className="text-primary w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-center">Complete Your Profile</h1>
          <p className="text-muted-foreground text-center text-sm mt-2">
            Help us understand your health better to provide accurate AI analysis and care.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="age" className="text-sm font-medium">Age</label>
            <input
              id="age"
              name="age"
              type="number"
              min="0"
              max="120"
              required
              value={formData.age}
              onChange={handleChange}
              placeholder="e.g. 28"
              className="input-medical"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="gender" className="text-sm font-medium">Gender</label>
            <select
              id="gender"
              name="gender"
              required
              value={formData.gender}
              onChange={handleChange}
              className="input-medical bg-white dark:bg-gray-900"
            >
              <option value="" disabled>Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="medicalHistory" className="text-sm font-medium">
              Previous Health Conditions <span className="text-muted-foreground font-normal">(Optional)</span>
            </label>
            <textarea
              id="medicalHistory"
              name="medicalHistory"
              rows={3}
              value={formData.medicalHistory}
              onChange={handleChange}
              placeholder="e.g. Asthma, High Blood Pressure, past surgeries..."
              className="input-medical resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full btn-medical flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Continue to Dashboard
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Onboarding;
