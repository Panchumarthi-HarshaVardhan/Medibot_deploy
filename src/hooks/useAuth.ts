import { useState, useEffect } from 'react';
import { API_BASE, parseJsonResponse } from '@/utils/api';
import { User } from '@/types';

const STORAGE_KEY = 'health_app_user';


export const useAuth = () => {
  const [user, setUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = sessionStorage.getItem(STORAGE_KEY);
    if (storedUser && storedUser !== 'undefined') {
      try {
        const parsed = JSON.parse(storedUser);
        // Validate shape before trusting stored user
        if (parsed?.id && parsed?.email && parsed?.role && parsed?.token) {
          setUserState(parsed);
        } else {
          sessionStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const setUser = (newUser: User | null) => {
    setUserState(newUser);
    if (newUser) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  };

  const login = async (
    email: string,
    password: string,
    role?: string,
    specialization?: string
  ): Promise<{ success: boolean; otpRequired?: boolean; error?: string }> => {
    try {
      const response = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: email.trim(), 
          password: password.trim(), 
          role,
          specialization: role === 'doctor' ? specialization : undefined
        }),
      });

      const data = await parseJsonResponse<{ error?: string }>(response);

      if (!response.ok) {
        return { success: false, otpRequired: false, error: data.error || 'Login failed' };
      }

      return { success: true, otpRequired: true };
    } catch (error) {
      console.error('Login failed:', error);
      const message = error instanceof Error ? error.message : 'Network error or server is down';
      return { success: false, otpRequired: false, error: message };
    }
  };

  const verifyLoginOtp = async (
    email: string,
    otp: string,
    role?: string,
    specialization?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`${API_BASE}/api/login/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          otp: otp.trim(),
          role,
          specialization: role === 'doctor' ? specialization : undefined
        }),
      });

      const data = await parseJsonResponse<Record<string, unknown>>(response);

      if (!response.ok) {
        return { success: false, error: (data.error as string) || 'OTP verification failed' };
      }

      const userData: User = {
        id: String(data._id),
        name: data.name as string,
        email: data.email as string,
        role: data.role as User['role'],
        specialization: (data.specialization as string) || null,
        phone: (data.phone as string) || null,
        profileImage: (data.profileImage as string) || null,
        medicalHistory: (data.medicalHistory as string) || null,
        age: (data.age as number) || null,
        gender: (data.gender as 'male' | 'female' | 'other') || null,
        averageRating: (data.averageRating as number) || 0,
        ratingCount: (data.ratingCount as number) || 0,
        token: (data.token as string) || undefined,
      };

      setUser(userData);
      return { success: true };
    } catch (error) {
      console.error('Login OTP verification failed:', error);
      const message = error instanceof Error ? error.message : 'Network error or server is down';
      return { success: false, error: message };
    }
  };

  const signup = async (
    name: string,
    email: string,
    password: string,
    role: 'patient' | 'doctor' = 'patient',
    specialization?: string
  ): Promise<{ success: boolean; otpRequired?: boolean; error?: string }> => {
    try {
      const response = await fetch(`${API_BASE}/api/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: name.trim(), 
          email: email.trim(), 
          password: password.trim(), 
          role,
          specialization: role === 'doctor' ? specialization : undefined
        }),
      });

      const data = await parseJsonResponse<{ error?: string }>(response);

      if (!response.ok) {
        return { success: false, otpRequired: false, error: data.error || 'Signup failed' };
      }

      return { success: true, otpRequired: true };
    } catch (error) {
      console.error('Signup failed:', error);
      const message = error instanceof Error ? error.message : 'Network error or server is down';
      return { success: false, otpRequired: false, error: message };
    }
  };

  const verifySignupOtp = async (
    email: string,
    otp: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`${API_BASE}/api/signup/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp: otp.trim() }),
      });

      const data = await parseJsonResponse<Record<string, unknown>>(response);

      if (!response.ok) {
        return { success: false, error: (data.error as string) || 'OTP verification failed' };
      }

      const userData: User = {
        id: String(data._id),
        name: data.name as string,
        email: data.email as string,
        role: data.role as User['role'],
        specialization: (data.specialization as string) || null,
        phone: (data.phone as string) || null,
        profileImage: (data.profileImage as string) || null,
        medicalHistory: (data.medicalHistory as string) || null,
        age: (data.age as number) || null,
        gender: (data.gender as 'male' | 'female' | 'other') || null,
        averageRating: (data.averageRating as number) || 0,
        ratingCount: (data.ratingCount as number) || 0,
        token: (data.token as string) || undefined,
      };

      setUser(userData);
      return { success: true };
    } catch (error) {
      console.error('Signup OTP verification failed:', error);
      const message = error instanceof Error ? error.message : 'Network error or server is down';
      return { success: false, error: message };
    }
  };

  const forgotPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`${API_BASE}/api/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await parseJsonResponse<{ error?: string }>(response);
      if (!response.ok) return { success: false, error: data.error || 'Failed to send OTP' };
      return { success: true };
    } catch (error) {
      console.error('Forgot password error:', error);
      const message = error instanceof Error ? error.message : 'Network error or server is down';
      return { success: false, error: message };
    }
  };

  const resetPassword = async (email: string, otp: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`${API_BASE}/api/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp: otp.trim(), newPassword: newPassword.trim() }),
      });
      const data = await parseJsonResponse<{ error?: string }>(response);
      if (!response.ok) return { success: false, error: data.error || 'Failed to reset password' };
      return { success: true };
    } catch (error) {
      console.error('Reset password error:', error);
      const message = error instanceof Error ? error.message : 'Network error or server is down';
      return { success: false, error: message };
    }
  };

  const logout = () => {
    setUser(null);
  };

  const googleAuth = async (
    credential: string,
    role: 'patient' | 'doctor' = 'patient',
    specialization?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential,
          role,
          specialization: role === 'doctor' ? specialization : undefined
        })
      });

      const data = await parseJsonResponse<Record<string, unknown>>(response);
      if (!response.ok) {
        return { success: false, error: (data.error as string) || 'Google authentication failed' };
      }

      const userData: User = {
        id: String(data._id),
        name: data.name as string,
        email: data.email as string,
        role: data.role as User['role'],
        specialization: (data.specialization as string) || null,
        phone: (data.phone as string) || null,
        profileImage: (data.profileImage as string) || null,
        medicalHistory: (data.medicalHistory as string) || null,
        age: (data.age as number) || null,
        gender: (data.gender as 'male' | 'female' | 'other') || null,
        averageRating: (data.averageRating as number) || 0,
        ratingCount: (data.ratingCount as number) || 0,
        token: (data.token as string) || undefined,
      };

      setUser(userData);
      return { success: true };
    } catch (error) {
      console.error('Google auth failed:', error);
      const message = error instanceof Error ? error.message : 'Network error or server is down';
      return { success: false, error: message };
    }
  };

  return { user, setUser, isLoading, login, verifyLoginOtp, signup, verifySignupOtp, forgotPassword, resetPassword, googleAuth, logout };
};
