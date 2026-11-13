'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiUrl } from '../utils/api';

export type UserRole = 'customer' | 'artisan' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  phone?: string;
  avatarUrl?: string | null;
  token?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<boolean>;
  logout: () => void;
  updateUser: (updates: Partial<AuthUser>) => void;
  redirectToDashboard: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Sayfa yenilendiğinde localStorage'dan oturumu al
    try {
      const stored = localStorage.getItem('usta_bul_user');
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch {
      // LocalStorage erişim hatası
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleSessionExpired = () => {
      localStorage.removeItem('usta_bul_user');
      setUser(null);
      router.replace('/session-ended');
    };

    window.addEventListener('usta-session-expired', handleSessionExpired);
    const originalFetch = window.fetch;
    const boundFetch = originalFetch.bind(window);
    const sessionAwareFetch: typeof window.fetch = async (input, init) => {
      const requestHeaders = new Headers(input instanceof Request ? input.headers : undefined);
      new Headers(init?.headers).forEach((value, key) => requestHeaders.set(key, value));
      const response = await boundFetch(input, init);
      const requestUrl =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const isAuthEndpoint = /\/api\/v1\/auth\/(login|register|refresh-token)(?:\?|$)/.test(
        requestUrl
      );

      if (
        response.status === 401 &&
        requestHeaders.has('Authorization') &&
        !isAuthEndpoint &&
        localStorage.getItem('usta_bul_user')
      ) {
        window.dispatchEvent(new Event('usta-session-expired'));
      }

      return response;
    };
    window.fetch = sessionAwareFetch;

    return () => {
      window.removeEventListener('usta-session-expired', handleSessionExpired);
      if (window.fetch === sessionAwareFetch) {
        window.fetch = originalFetch;
      }
    };
  }, [router]);

  const redirectToDashboard = (role: UserRole) => {
    if (role === 'customer') {
      const isMobile = window.matchMedia('(max-width: 860px)').matches;
      router.push(isMobile ? '/' : '/requests');
    } else if (role === 'artisan') {
      router.push('/artisan-dashboard');
    } else if (role === 'admin') {
      router.push('/admin-dashboard');
    } else {
      router.push('/');
    }
  };

  const login = async (email: string, pass: string): Promise<boolean> => {
    const res = await fetch(apiUrl('/api/v1/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.data?.user || !data?.data?.tokens?.accessToken) {
      throw new Error(data?.error?.message || 'E-posta veya şifre hatalı.');
    }

    const loggedUser: AuthUser = {
      id: data.data.user.id,
      email: data.data.user.email,
      fullName: data.data.user.fullName,
      phone: data.data.user.phone,
      avatarUrl: data.data.user.avatarUrl || null,
      role: data.data.user.role,
      token: data.data.tokens.accessToken,
    };

    setUser(loggedUser);
    localStorage.setItem('usta_bul_user', JSON.stringify(loggedUser));
    redirectToDashboard(loggedUser.role);
    return true;
  };

  const updateUser = (updates: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...updates };
      localStorage.setItem('usta_bul_user', JSON.stringify(next));
      return next;
    });
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('usta_bul_user');
    router.push('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        updateUser,
        redirectToDashboard,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
