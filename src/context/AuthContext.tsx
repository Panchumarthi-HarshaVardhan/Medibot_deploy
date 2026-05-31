import React, { createContext, useContext, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { User } from '@/types';

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  isLoading: boolean;
  login: (email: string, password: string, role?: string, specialization?: string) => Promise<{ success: boolean; otpRequired?: boolean; error?: string }>;
  verifyLoginOtp: (email: string, otp: string, role?: string, specialization?: string) => Promise<{ success: boolean; error?: string }>;
  signup: (name: string, email: string, password: string, role?: 'patient' | 'doctor', specialization?: string) => Promise<{ success: boolean; otpRequired?: boolean; error?: string }>;
  verifySignupOtp: (email: string, otp: string) => Promise<{ success: boolean; error?: string }>;
  googleAuth: (credential: string, role?: 'patient' | 'doctor', specialization?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const auth = useAuth();

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};
