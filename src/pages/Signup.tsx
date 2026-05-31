import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/context/AuthContext';
import { Bot, Mail, Lock, User, ArrowRight, Stethoscope } from 'lucide-react';
import { toast } from 'sonner';
import { specializations } from '@/data/symptoms';
import { requestGoogleCredential } from '@/utils/googleAuth';

const Signup = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [role, setRole] = useState<'patient' | 'doctor'>('patient');
  const [specialization, setSpecialization] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signup, verifySignupOtp, googleAuth } = useAuthContext();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsLoading(true);

    if (!otpSent) {
      if (password !== confirmPassword) {
        toast.error('Passwords do not match');
        setIsLoading(false);
        return;
      }

      if (password.length < 6) {
        toast.error('Password must be at least 6 characters');
        setIsLoading(false);
        return;
      }

      if (role === 'doctor' && !specialization) {
        toast.error('Please select specialization');
        setIsLoading(false);
        return;
      }

      const result = await signup(name, email, password, role, specialization);
      if (result.success && result.otpRequired) {
        setOtpSent(true);
        toast.success('OTP sent to your email');
      } else {
        toast.error(result.error || 'Email already exists');
      }
    } else {
      const result = await verifySignupOtp(email, otp);
      if (result.success) {
        toast.success('Account created successfully!');
        if (role === 'doctor') {
          navigate('/doctor-dashboard');
        } else {
          navigate('/dashboard');
        }
      } else {
        toast.error(result.error || 'Invalid OTP');
      }
    }

    setIsLoading(false);
  };

  const handleGoogleSignup = async () => {
    if (role === 'doctor' && !specialization) {
      toast.error('Please select specialization for doctor signup');
      return;
    }
    setIsLoading(true);
    try {
      await requestGoogleCredential(async (response) => {
        const result = await googleAuth(response.credential, role, specialization);
        if (result.success) {
          toast.success('Signed in with Google');
          navigate(role === 'doctor' ? '/doctor-dashboard' : '/dashboard');
        } else {
          toast.error(result.error || 'Google sign-in failed');
        }
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Google sign-in failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/20 to-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8 animate-fade-up">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground mb-4 shadow-glow">
            <Bot size={32} />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Medibot</h1>
          <p className="text-muted-foreground mt-1">Create your account</p>
        </div>

        {/* Signup Form */}
        <div className="card-medical animate-fade-up" style={{ animationDelay: '100ms' }}>
          <h2 className="text-xl font-semibold text-foreground mb-6">Get Started</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setRole('patient')}
                className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                  role === 'patient' 
                    ? 'border-primary bg-primary/5 text-primary' 
                    : 'border-border bg-card text-muted-foreground hover:border-primary/50'
                }`}
              >
                <User size={24} />
                <span className="font-medium text-sm">Patient</span>
              </button>
              <button
                type="button"
                onClick={() => setRole('doctor')}
                className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                  role === 'doctor' 
                    ? 'border-primary bg-primary/5 text-primary' 
                    : 'border-border bg-card text-muted-foreground hover:border-primary/50'
                }`}
              >
                <Stethoscope size={24} />
                <span className="font-medium text-sm">Doctor</span>
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-medical pl-10"
                  placeholder="John Doe"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-medical pl-10"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            {role === 'doctor' && !otpSent && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Specialization
                </label>
                <select
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  className="input-medical"
                  required
                >
                  <option value="">Select Specialization</option>
                  {specializations.map((spec) => (
                    <option key={spec} value={spec}>
                      {spec}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!otpSent ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input-medical pl-10"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="input-medical pl-10"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Enter OTP
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="input-medical pl-10"
                    placeholder="6-digit OTP"
                    maxLength={6}
                    required
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="btn-medical w-full flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <>
                  {otpSent ? 'Verify OTP' : 'Create Account'}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
          {!otpSent && (
            <button
              type="button"
              onClick={handleGoogleSignup}
              disabled={isLoading}
              className="w-full mt-3 border border-border rounded-xl py-3 font-medium hover:bg-muted transition-colors flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.2 1.2-1.4 3.6-5.4 3.6-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.2.8 3.9 1.5l2.7-2.6C17 3.1 14.7 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4.1 9.6-9.9 0-.7-.1-1.3-.2-1.9H12z" />
                <path fill="#34A853" d="M3.5 7.3l3.2 2.4C7.6 7.8 9.6 6.3 12 6.3c1.9 0 3.2.8 3.9 1.5l2.7-2.6C17 3.1 14.7 2 12 2 8.2 2 4.9 4.2 3.5 7.3z" />
                <path fill="#FBBC05" d="M12 22c2.6 0 4.8-.9 6.4-2.5l-3-2.4c-.8.6-1.9 1.1-3.4 1.1-2.4 0-4.4-1.6-5.2-3.8l-3.2 2.5C4.9 19.8 8.2 22 12 22z" />
                <path fill="#4285F4" d="M22 12.1c0-.7-.1-1.3-.2-1.9H12v3.9h5.4c-.3 1.3-1 2.4-2 3.1l3 2.4c1.8-1.6 2.8-4.1 2.8-7.5z" />
              </svg>
              Continue with Google
            </button>
          )}

          <p className="text-center text-muted-foreground mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-primary font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6 animate-fade-up" style={{ animationDelay: '200ms' }}>
          By signing up, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
};

export default Signup;
