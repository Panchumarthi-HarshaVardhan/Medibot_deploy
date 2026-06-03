import { NavLink, useLocation } from 'react-router-dom';
import { 
  Home, 
  Stethoscope, 
  Calendar, 
  Pill, 
  Heart, 
  LogOut,
  Menu,
  X,
  Users,
  UserCircle,
  Activity,
  Moon,
  Sun
} from 'lucide-react';
import { useAuthContext } from '@/context/AuthContext';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

const patientNavItems = [
  { path: '/dashboard', icon: Home, label: 'Home' },
  { path: '/symptom-checker', icon: Stethoscope, label: 'Symptom Checker' },
  { path: '/medical-history', icon: Activity, label: 'Medical History' },
  { path: '/appointments', icon: Calendar, label: 'Book Appointment' },
  { path: '/medications', icon: Pill, label: 'Medication Reminder' },
  { path: '/health-tips', icon: Heart, label: 'Health Tips' },
  { path: '/profile', icon: UserCircle, label: 'My Profile' },
];

const doctorNavItems = [
  { path: '/doctor-dashboard', icon: Home, label: 'Dashboard' },
  { path: '/appointments', icon: Calendar, label: 'Appointments' },
  { path: '/profile', icon: UserCircle, label: 'My Profile' },
];

export const Sidebar = () => {
  const { user, logout } = useAuthContext();
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark' || 
      (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const isActive = (path: string) => location.pathname === path;

  const navItems = user?.role === 'doctor' ? doctorNavItems : patientNavItems;

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="fixed top-4 left-4 z-50 lg:hidden bg-primary text-primary-foreground p-2 rounded-lg shadow-elevated"
      >
        {isMobileOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Overlay for mobile */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-foreground/50 z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 h-full w-64 bg-sidebar flex flex-col z-50 transition-transform duration-300",
        "lg:translate-x-0",
        isMobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* User Profile Section */}
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-sidebar-accent flex items-center justify-center text-2xl font-bold text-sidebar-foreground overflow-hidden">
              {user?.profileImage ? (
                <img src={user.profileImage} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                user?.name?.charAt(0).toUpperCase() || 'U'
              )}
            </div>
            <div>
              <p className="text-sidebar-foreground font-medium">
                Welcome, {user?.name?.split(' ')[0] || 'User'}!
              </p>
              <p className="text-sidebar-foreground/70 text-sm">
                Logged in as: {user?.role === 'patient' ? 'Patient' : 'Doctor'}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setIsMobileOpen(false)}
              className={cn(
                "sidebar-link",
                isActive(item.path) && "sidebar-link-active"
              )}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer Actions: Theme Toggle & Logout */}
        <div className="p-4 border-t border-sidebar-border space-y-2">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="sidebar-link w-full text-sidebar-foreground/80 hover:text-sidebar-foreground"
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          <button
            onClick={logout}
            className="sidebar-link w-full text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-destructive/20"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
};
