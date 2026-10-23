import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiFetch } from '../utils/api';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role?: string;
  timezone?: string;
  avatar?: string;
  apiKey?: string;
  twoFactorEnabled?: boolean;
  notifications?: {
    email: boolean;
    push: boolean;
    weekly: boolean;
    predictive: boolean;
  };
  integrations?: Array<{
    id: string;
    name: string;
    status: string;
  }>;
  planId: string;
  planInterval: string;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string, role?: string) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<User | null>;
  updateUserState: (updated: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('trackwise_token'));
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('trackwise_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [loading, setLoading] = useState<boolean>(true);

  // Initialize and refresh user profile if token exists
  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('trackwise_token');
      if (storedToken) {
        try {
          const res = await apiFetch<{ user: User }>('/api/auth/me');
          setUser(res.user);
          localStorage.setItem('trackwise_user', JSON.stringify(res.user));
        } catch (error) {
          console.warn('Session expired or invalid, logging out:', error);
          logout();
        }
      }
      setLoading(false);
    };

    initializeAuth();

    const handleUnauthorized = () => {
      logout();
    };

    window.addEventListener('auth-unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth-unauthorized', handleUnauthorized);
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    const res = await apiFetch<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    localStorage.setItem('trackwise_token', res.token);
    localStorage.setItem('trackwise_user', JSON.stringify(res.user));
    setToken(res.token);
    setUser(res.user);
    return res.user;
  };

  const register = async (name: string, email: string, password: string, role?: string): Promise<User> => {
    const res = await apiFetch<{ token: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, role }),
    });

    localStorage.setItem('trackwise_token', res.token);
    localStorage.setItem('trackwise_user', JSON.stringify(res.user));
    setToken(res.token);
    setUser(res.user);
    return res.user;
  };

  const logout = () => {
    localStorage.removeItem('trackwise_token');
    localStorage.removeItem('trackwise_user');
    setToken(null);
    setUser(null);
  };

  const refreshUser = async (): Promise<User | null> => {
    try {
      const res = await apiFetch<{ user: User }>('/api/auth/me');
      setUser(res.user);
      localStorage.setItem('trackwise_user', JSON.stringify(res.user));
      return res.user;
    } catch {
      return null;
    }
  };

  const updateUserState = (updated: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return null;
      const next = { ...prev, ...updated };
      localStorage.setItem('trackwise_user', JSON.stringify(next));
      return next;
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        refreshUser,
        updateUserState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
