import { authFetch } from '@/utils/api';
import { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuthContext } from '@/context/AuthContext';
import { ProfileData } from '@/types';
import {
  User,
  Mail,
  Stethoscope,
  Calendar,
  Pill,
  FileText,
  Clock,
  Award,
  Activity,
  Users,
  ShieldCheck,
  TrendingUp,
  CheckCircle2,
  Phone,
  Camera,
  Star,
  Edit,
  Check,
  X,
  Globe
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const Profile = () => {
  const { user, setUser } = useAuthContext();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingPhone, setEditingPhone] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getCookie = (name: string) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
    return null;
  };

  const currentLangCookie = getCookie('googtrans');
  const initialLang = currentLangCookie ? currentLangCookie.split('/').pop() || 'en' : 'en';
  const [language, setLanguage] = useState(initialLang);

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const lang = e.target.value;
    setLanguage(lang);
    if (lang === 'en') {
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
    } else {
      document.cookie = `googtrans=/en/${lang}; path=/`;
      document.cookie = `googtrans=/en/${lang}; path=/; domain=${window.location.hostname};`;
    }
    window.location.reload();
  };

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const response = await authFetch(`/api/profile/${user.id}`);
        if (response.ok) {
          const data = await response.json();
          setProfile({
            ...data,
            _id: data._id?.toString?.() || user.id,
          });
          setPhoneInput(data.phone || '');
          setNameInput(data.name || user.name || '');
        } else if (response.status === 401) {
          toast.error('Session expired. Please sign in again.');
        } else {
          // Fallback: show basic info from session so page is not blank
          setProfile({
            _id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            specialization: user.specialization ?? null,
            createdAt: new Date().toISOString(),
            phone: user.phone,
            profileImage: user.profileImage,
            averageRating: user.averageRating ?? 0,
            ratingCount: user.ratingCount ?? 0,
            stats: {
              totalAppointments: 0,
              completedAppointments: 0,
              pendingAppointments: 0,
              prescriptionsWritten: 0,
              activeMedications: 0,
              totalPrescriptions: 0,
            },
          });
          setNameInput(user.name || '');
          toast.error('Could not load full profile stats. Showing basic account info.');
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
        toast.error('Failed to load profile. Is the server running?');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  const handlePhoneSave = async () => {
    if (!user) return;
    setIsUpdating(true);
    try {
      const response = await authFetch(`/api/profile/${user.id}`, {
        method: 'PUT',
        body: JSON.stringify({ phone: phoneInput }),
      });
      if (response.ok) {
        const updatedUser = await response.json();
        setProfile(updatedUser);
        // Update user context with all existing properties + new phone
        setUser(prev => prev ? { ...prev, phone: updatedUser.phone } : null);
        setEditingPhone(false);
        toast.success('Phone number updated!');
      }
    } catch (error) {
      console.error('Failed to update phone:', error);
      toast.error('Failed to update phone');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleNameSave = async () => {
    if (!user) return;
    setIsUpdating(true);
    try {
      const response = await authFetch(`/api/profile/${user.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: nameInput }),
      });
      if (response.ok) {
        const updatedUser = await response.json();
        setProfile(updatedUser);
        // Update user context with all existing properties + new name
        setUser(prev => prev ? { ...prev, name: updatedUser.name } : null);
        setEditingName(false);
        toast.success('Name updated!');
      }
    } catch (error) {
      console.error('Failed to update name:', error);
      toast.error('Failed to update name');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image too large. Max 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Image = event.target?.result as string;
      setIsUpdating(true);
      try {
        const response = await authFetch(`/api/profile/${user.id}`, {
          method: 'PUT',
          body: JSON.stringify({ profileImage: base64Image }),
        });
        if (response.ok) {
          const updatedUser = await response.json();
          setProfile(updatedUser);
          // Update user context with all existing properties + new profile image
          setUser(prev => prev ? { ...prev, profileImage: updatedUser.profileImage, avatar: updatedUser.profileImage } : null);
          toast.success('Profile image updated!');
        } else {
          toast.error('Failed to update profile image');
        }
      } catch (error) {
        console.error('Failed to update profile image:', error);
        toast.error('Failed to update profile image');
      } finally {
        setIsUpdating(false);
      }
    };
    reader.readAsDataURL(file);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!profile || !user) {
    return (
      <DashboardLayout>
        <div className="text-center py-20 text-muted-foreground">
          <User size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg">Profile not found</p>
        </div>
      </DashboardLayout>
    );
  }

  const isDoctor = user?.role === 'doctor';
  const memberSince = profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }) : '';

  const displayImage = profile?.profileImage || user?.profileImage || user?.avatar;

  const doctorStats = [
    {
      icon: Users,
      label: 'Patients Treated',
      value: profile?.stats?.completedAppointments || 0,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      icon: Calendar,
      label: 'Total Appointments',
      value: profile?.stats?.totalAppointments || 0,
      color: 'text-info',
      bgColor: 'bg-info/10',
    },
    {
      icon: Clock,
      label: 'Pending Requests',
      value: profile?.stats?.pendingAppointments || 0,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
    {
      icon: FileText,
      label: 'Prescriptions Written',
      value: profile?.stats?.prescriptionsWritten || 0,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
  ];

  const patientStats = [
    {
      icon: Calendar,
      label: 'Total Appointments',
      value: profile?.stats?.totalAppointments || 0,
      color: 'text-info',
      bgColor: 'bg-info/10',
    },
    {
      icon: CheckCircle2,
      label: 'Completed Visits',
      value: profile?.stats?.completedAppointments || 0,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      icon: Pill,
      label: 'Active Medications',
      value: profile?.stats?.activeMedications || 0,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      icon: FileText,
      label: 'Prescriptions',
      value: profile?.stats?.totalPrescriptions || 0,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
  ];

  const stats = isDoctor ? doctorStats : patientStats;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Profile Header Card */}
        <div className="relative overflow-hidden rounded-2xl animate-fade-up">
          {/* Gradient Banner */}
          <div className="h-36 bg-gradient-to-br from-primary via-primary/80 to-primary/60 relative">
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-4 right-8 w-24 h-24 rounded-full bg-white/20 blur-xl" />
              <div className="absolute bottom-2 left-16 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
              <div className="absolute top-8 left-1/3 w-16 h-16 rounded-full bg-white/15 blur-lg" />
            </div>
          </div>

          {/* Profile Info Overlay */}
          <div className="bg-card border border-border/50 rounded-b-2xl px-6 pb-6 pt-0 relative">
            {/* Avatar */}
            <div className="absolute -top-14 left-6">
              <div className="relative">
                <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-4xl font-bold text-white shadow-elevated border-4 border-card overflow-hidden">
                  {displayImage ? (
                    <img src={displayImage} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    user.name?.charAt(0).toUpperCase() || 'U'
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUpdating}
                  className="absolute bottom-0 right-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  <Camera size={16} />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </div>
            </div>

            {/* Info Section */}
            <div className="pt-16 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold text-foreground">
                    {isDoctor ? `Dr. ${user?.name || 'User'}` : user?.name || 'User'}
                  </h1>
                  <span className={cn(
                    "px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide",
                    isDoctor
                      ? "bg-primary/10 text-primary"
                      : "bg-info/10 text-info"
                  )}>
                    {isDoctor ? '🩺 Doctor' : '🧑 Patient'}
                  </span>
                </div>

                {/* Doctor Rating */}
                {isDoctor && (
                  <div className="flex items-center gap-2 mt-3">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={16}
                          className={cn(
                            "fill-current",
                            star <= (profile?.averageRating || 0)
                              ? "text-yellow-500"
                              : "text-muted-foreground/30"
                          )}
                        />
                      ))}
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      {profile?.averageRating || 0}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      ({profile?.ratingCount || 0} {profile?.ratingCount === 1 ? 'rating' : 'ratings'})
                    </span>
                  </div>
                )}

                <div className="flex flex-col gap-2 mt-3">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Mail size={15} />
                    <span>{user?.email || ''}</span>
                  </div>
                  
                  {/* Phone Number */}
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Phone size={15} />
                    {editingPhone ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="tel"
                          value={phoneInput}
                          onChange={(e) => setPhoneInput(e.target.value)}
                          className="w-48 px-2 py-1 text-sm border border-border rounded bg-card"
                          placeholder="Enter phone number"
                        />
                        <button
                          onClick={handlePhoneSave}
                          disabled={isUpdating}
                          className="p-1 text-success hover:bg-success/10 rounded"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => {
                            setEditingPhone(false);
                            setPhoneInput(profile?.phone || '');
                          }}
                          className="p-1 text-muted-foreground hover:bg-muted/50 rounded"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span>{profile?.phone || 'Not set'}</span>
                        <button
                          onClick={() => setEditingPhone(true)}
                          className="p-1 text-muted-foreground hover:text-foreground"
                        >
                          <Edit size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  {isDoctor && profile?.specialization && (
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <Stethoscope size={15} />
                      <span className="font-medium text-foreground">{profile.specialization}</span>
                    </div>
                  )}
                  {memberSince && (
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <Calendar size={15} />
                      <span>Member since {memberSince}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Verification Badge */}
              <div className="flex items-center gap-2 px-4 py-2 bg-success/10 text-success rounded-xl self-start">
                <ShieldCheck size={18} />
                <span className="text-sm font-medium">Verified Account</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className="card-medical animate-fade-up group"
              style={{ animationDelay: `${(index + 1) * 100}ms` }}
            >
              <div className="flex flex-col items-center text-center gap-3">
                <div className={cn("p-3 rounded-xl transition-transform group-hover:scale-110", stat.bgColor)}>
                  <stat.icon className={stat.color} size={22} />
                </div>
                <div>
                  <p className="text-3xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Details Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Account Details */}
          <div className="card-medical animate-fade-up" style={{ animationDelay: '500ms' }}>
            <h2 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
              <User size={20} className="text-primary" />
              Account Details
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Full Name</span>
                {editingName ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      className="w-48 px-2 py-1 text-sm border border-border rounded bg-card"
                      placeholder="Enter full name"
                    />
                    <button
                      onClick={handleNameSave}
                      disabled={isUpdating}
                      className="p-1 text-success hover:bg-success/10 rounded"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={() => {
                        setEditingName(false);
                        setNameInput(profile?.name || user?.name || '');
                      }}
                      className="p-1 text-muted-foreground hover:bg-muted/50 rounded"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="font-medium text-foreground">{profile?.name || user?.name || 'User'}</span>
                    <button
                      onClick={() => setEditingName(true)}
                      className="p-1 text-muted-foreground hover:text-foreground"
                    >
                      <Edit size={14} />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between py-3 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Email</span>
                <span className="font-medium text-foreground text-sm">{user?.email || ''}</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Role</span>
                <span className="font-medium text-foreground capitalize">{user?.role || 'patient'}</span>
              </div>
              {isDoctor && (
                <div className="flex items-center justify-between py-3 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">Specialization</span>
                  <span className="font-medium text-primary">{profile?.specialization || 'Not set'}</span>
                </div>
              )}
              <div className="flex items-center justify-between py-3 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Member Since</span>
                <span className="font-medium text-foreground">{memberSince}</span>
              </div>
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Globe size={16} />
                  <span>Language</span>
                </div>
                <select
                  value={language}
                  onChange={handleLanguageChange}
                  className="px-2 py-1 text-sm border border-border rounded bg-card outline-none focus:ring-1 focus:ring-primary/50"
                >
                  <option value="en">English</option>
                  <option value="hi">Hindi (हिन्दी)</option>
                  <option value="te">Telugu (తెలుగు)</option>
                  <option value="ta">Tamil (தமிழ்)</option>
                  <option value="kn">Kannada (ಕನ್ನಡ)</option>
                  <option value="ml">Malayalam (മലയാളം)</option>
                  <option value="mr">Marathi (मराठी)</option>
                  <option value="bn">Bengali (বাংলা)</option>
                  <option value="gu">Gujarati (ગુજરાતી)</option>
                  <option value="ur">Urdu (اردو)</option>
                  <option value="pa">Punjabi (ਪੰਜਾਬੀ)</option>
                  <option value="or">Odia (ଓଡ଼ିଆ)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Activity Summary */}
          <div className="card-medical animate-fade-up" style={{ animationDelay: '600ms' }}>
            <h2 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
              <Activity size={20} className="text-primary" />
              Activity Summary
            </h2>
            <div className="space-y-4">
              {isDoctor ? (
                <>
                  <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl">
                    <div className="p-2.5 rounded-lg bg-primary/10">
                      <TrendingUp size={18} className="text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">Completion Rate</p>
                      <p className="text-sm text-muted-foreground">
                        {profile?.stats?.totalAppointments > 0
                          ? `${Math.round((profile.stats.completedAppointments / profile.stats.totalAppointments) * 100)}%`
                          : 'No appointments yet'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl">
                    <div className="p-2.5 rounded-lg bg-success/10">
                      <Award size={18} className="text-success" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">Specialization</p>
                      <p className="text-sm text-muted-foreground">{profile?.specialization || 'General Practice'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl">
                    <div className="p-2.5 rounded-lg bg-info/10">
                      <FileText size={18} className="text-info" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">Prescriptions</p>
                      <p className="text-sm text-muted-foreground">{profile?.stats?.prescriptionsWritten || 0} written</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl">
                    <div className="p-2.5 rounded-lg bg-primary/10">
                      <TrendingUp size={18} className="text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">Health Journey</p>
                      <p className="text-sm text-muted-foreground">
                        {profile?.stats?.completedAppointments > 0
                          ? `${profile.stats.completedAppointments} completed visit${profile.stats.completedAppointments > 1 ? 's' : ''}`
                          : 'Start by booking your first appointment'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl">
                    <div className="p-2.5 rounded-lg bg-success/10">
                      <Pill size={18} className="text-success" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">Medication Tracking</p>
                      <p className="text-sm text-muted-foreground">
                        {(profile?.stats?.activeMedications || 0) > 0
                          ? `${profile.stats.activeMedications} active reminder${(profile.stats.activeMedications || 0) > 1 ? 's' : ''}`
                          : 'No active reminders'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl">
                    <div className="p-2.5 rounded-lg bg-info/10">
                      <FileText size={18} className="text-info" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">Prescriptions</p>
                      <p className="text-sm text-muted-foreground">{profile?.stats?.totalPrescriptions || 0} received</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Profile;
