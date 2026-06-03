import { API_BASE, authHeaders } from '@/utils/api';
import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAppointments } from '@/hooks/useAppointments';
import { specializations, timeSlots } from '@/data/symptoms';
import { 
  Calendar, 
  Clock, 
  User, 
  Stethoscope, 
  Check,
  X,
  Plus,
  Star,
  Search
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, addDays } from 'date-fns';
import { useAuthContext } from '@/context/AuthContext';

const Appointments = () => {
  const { appointments, addAppointment, cancelAppointment, getUpcomingAppointments, rateAppointment } = useAppointments();
  const [showForm, setShowForm] = useState(false);
  const [dbDoctors, setDbDoctors] = useState<{_id: string, id: string, name: string, specialization?: string}[]>([]);
  const { user } = useAuthContext();
  const [ratingAppointment, setRatingAppointment] = useState<string | null>(null);
  const [selectedRating, setSelectedRating] = useState(0);
  
  // Form state
  const [specialization, setSpecialization] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const specializationQuery = specialization ? `?specialization=${encodeURIComponent(specialization)}` : '';
        const response = await fetch(`${API_BASE}/api/doctors${specializationQuery}`);
        if (response.ok) {
          const data = await response.json();
          setDbDoctors(
            (data as { _id: { toString(): string }; [key: string]: unknown }[]).map((doc) => ({
              ...doc,
              id: doc._id.toString(),
            }))
          );
        }
      } catch (error) {
        console.error('Error fetching doctors:', error);
      }
    };
    fetchDoctors();
  }, [specialization]);

  const upcomingAppointments = getUpcomingAppointments();
  const completedAppointments = appointments.filter(apt => apt.status === 'completed');

  // Generate next 14 days for date selection
  const availableDates = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(new Date(), i + 1);
    return {
      value: format(date, 'yyyy-MM-dd'),
      label: format(date, 'EEE, MMM d'),
    };
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!specialization || !selectedDoctorId || !selectedDate || !selectedTime) {
      toast.error('Please fill in all fields');
      return;
    }

    const doctor = dbDoctors.find(d => d.id.toString() === selectedDoctorId);

    const success = await addAppointment({
      patientName: user?.name || 'User',
      age: 0,
      gender: 'N/A',
      specialization,
      doctorName: doctor?.name || 'Unknown Doctor',
      doctorId: selectedDoctorId,
      date: selectedDate,
      time: selectedTime,
    });

    if (success) {
      toast.success('Appointment booked successfully!');
      
      // Reset form
      setSpecialization('');
      setSelectedDoctorId('');
      setSelectedDate('');
      setSelectedTime('');
      setShowForm(false);
    } else {
      toast.error('Failed to book appointment');
    }
  };

  const handleCancel = async (id: string) => {
    if (await cancelAppointment(id)) {
      toast.success('Appointment cancelled');
    } else {
      toast.error('Failed to cancel appointment');
    }
  };

  const handleRate = async () => {
    if (!ratingAppointment || selectedRating === 0) return;
    
    const success = await rateAppointment(ratingAppointment, selectedRating);
    if (success) {
      toast.success('Rating submitted!');
      setRatingAppointment(null);
      setSelectedRating(0);
    } else {
      toast.error('Failed to submit rating');
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 animate-fade-up">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Appointments</h1>
            <p className="text-muted-foreground mt-1">
              Book and manage your doctor appointments
            </p>
          </div>
          {user?.role === 'patient' && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="btn-medical flex items-center gap-2"
            >
              {showForm ? <X size={18} /> : <Plus size={18} />}
              {showForm ? 'Cancel' : 'Book Appointment'}
            </button>
          )}
        </div>

        {/* Search Bar */}
        <div className="mb-6 animate-fade-up">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <input
              type="text"
              placeholder="Search appointments by doctor, specialization..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-medical pl-10"
            />
          </div>
        </div>

        {/* Booking Form */}
        {showForm && user?.role === 'patient' && (
          <div className="card-medical mb-8 animate-fade-up">
            <h2 className="text-xl font-semibold mb-6">Book New Appointment</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Specialization</label>
                  <div className="relative">
                    <Stethoscope className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <select
                      value={specialization}
                      onChange={(e) => {
                        setSpecialization(e.target.value);
                        setSelectedDoctorId('');
                      }}
                      className="input-medical pl-10"
                      required
                    >
                      <option value="">Select Specialization</option>
                      {specializations.map((spec) => (
                        <option key={spec} value={spec}>{spec}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Doctor</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <select
                      value={selectedDoctorId}
                      onChange={(e) => setSelectedDoctorId(e.target.value)}
                      className="input-medical pl-10"
                      required
                    >
                      <option value="">Select Doctor</option>
                      {specialization && dbDoctors.length === 0 && (
                        <option value="" disabled>No doctors available for this specialization</option>
                      )}
                      {dbDoctors.map((doc) => (
                        <option key={doc.id} value={doc.id}>{doc.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <select
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="input-medical pl-10"
                      required
                    >
                      <option value="">Select Date</option>
                      {availableDates.map((date) => (
                        <option key={date.value} value={date.value}>{date.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Time</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <select
                      value={selectedTime}
                      onChange={(e) => setSelectedTime(e.target.value)}
                      className="input-medical pl-10"
                      required
                    >
                      <option value="">Select Time</option>
                      {timeSlots.map((time) => (
                        <option key={time} value={time}>{time}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button type="submit" className="btn-medical">
                  Confirm Booking
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Upcoming Appointments List */}
        <div className="space-y-4 mb-12">
          <h2 className="text-xl font-semibold mb-4">Upcoming Appointments</h2>
          {upcomingAppointments.length === 0 ? (
            <div className="text-center py-12 bg-muted/30 rounded-2xl border-2 border-dashed border-muted">
              <Calendar className="mx-auto text-muted-foreground mb-4" size={48} />
              <p className="text-lg font-medium text-muted-foreground">No upcoming appointments</p>
              {user?.role === 'patient' && (
                <button 
                  onClick={() => setShowForm(true)}
                  className="text-primary hover:underline mt-2"
                >
                  Book your first appointment
                </button>
              )}
            </div>
          ) : (
            upcomingAppointments
              .filter(apt => apt.doctorName.toLowerCase().includes(searchQuery.toLowerCase()) || apt.specialization?.toLowerCase().includes(searchQuery.toLowerCase()) || apt.patientName.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((apt) => (
              <div
                key={apt.id}
                className="card-medical flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fade-up"
              >
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0",
                    apt.status === 'pending' ? "bg-warning" : 
                    apt.status === 'accepted' ? "bg-primary" : "bg-muted"
                  )}>
                    <Calendar size={24} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">
                      {user?.role === 'doctor' ? apt.patientName : `Dr. ${apt.doctorName}`}
                    </h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
                      <div className="flex items-center gap-1">
                        <Stethoscope size={14} />
                        {apt.specialization || apt.reason}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar size={14} />
                        {apt.date}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock size={14} />
                        {apt.time}
                      </div>
                    </div>
                    <div className="mt-2">
                        <span className={cn(
                            "text-xs px-2 py-1 rounded-full capitalize",
                            apt.status === 'pending' ? "bg-warning/10 text-warning" :
                            apt.status === 'accepted' ? "bg-primary/10 text-primary" :
                            "bg-muted text-muted-foreground"
                        )}>
                            {apt.status}
                        </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                  {user?.role === 'patient' && apt.status !== 'cancelled' && (
                    <button
                      onClick={() => handleCancel(apt.id)}
                      className="flex-1 md:flex-none px-4 py-2 border border-destructive/20 text-destructive rounded-lg hover:bg-destructive/5 transition-colors text-sm font-medium"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Completed Appointments with Rating */}
        {completedAppointments.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">Completed Appointments</h2>
            {completedAppointments
              .filter(apt => apt.doctorName.toLowerCase().includes(searchQuery.toLowerCase()) || apt.specialization?.toLowerCase().includes(searchQuery.toLowerCase()) || apt.patientName.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((apt) => (
              <div
                key={apt.id}
                className="card-medical flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fade-up"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-success flex items-center justify-center text-white shrink-0">
                    <Check size={24} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">
                      {user?.role === 'doctor' ? apt.patientName : `Dr. ${apt.doctorName}`}
                    </h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
                      <div className="flex items-center gap-1">
                        <Stethoscope size={14} />
                        {apt.specialization || apt.reason}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar size={14} />
                        {apt.date}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock size={14} />
                        {apt.time}
                      </div>
                    </div>
                    {apt.rating ? (
                      <div className="flex items-center gap-1 mt-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            size={16}
                            className={cn(
                              "fill-current",
                              star <= apt.rating ? "text-yellow-500" : "text-muted-foreground/30"
                            )}
                          />
                        ))}
                        <span className="text-sm text-muted-foreground ml-1">Rated</span>
                      </div>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-full bg-success/10 text-success mt-2 inline-block">
                        Completed
                      </span>
                    )}
                  </div>
                </div>

                {user?.role === 'patient' && !apt.rating && (
                  <div className="flex flex-col gap-2 w-full md:w-auto">
                    {ratingAppointment === apt.id ? (
                      <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              onClick={() => setSelectedRating(star)}
                              className="p-1"
                            >
                              <Star
                                size={24}
                                className={cn(
                                  "cursor-pointer transition-transform hover:scale-110",
                                  star <= selectedRating ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground"
                                )}
                              />
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={handleRate}
                          disabled={selectedRating === 0}
                          className="btn-medical px-4 py-1 text-sm disabled:opacity-50"
                        >
                          Submit
                        </button>
                        <button
                          onClick={() => {
                            setRatingAppointment(null);
                            setSelectedRating(0);
                          }}
                          className="text-muted-foreground hover:text-foreground p-1"
                        >
                          <X size={20} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setRatingAppointment(apt.id)}
                        className="btn-medical px-4 py-2"
                      >
                        Rate Doctor
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Appointments;
