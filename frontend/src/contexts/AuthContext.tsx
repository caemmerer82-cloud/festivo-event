import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { loginTenant, loginSystem, logout as apiLogout } from '../api/auth';
import type { AuthUser } from '../types';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string, tenantSlug?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function decodeToken(token: string): AuthUser | null {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload));
    // Check expiry
    if (decoded.exp && decoded.exp < Date.now() / 1000) {
      return null;
    }
    return decoded as AuthUser;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    if (storedToken) {
      const decoded = decodeToken(storedToken);
      if (decoded) {
        setUser(decoded);
        setToken(storedToken);
      } else {
        localStorage.removeItem('auth_token');
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (username: string, password: string, tenantSlug?: string) => {
    let result;
    if (tenantSlug) {
      result = await loginTenant(tenantSlug, username, password);
    } else {
      result = await loginSystem(username, password);
    }

    const newToken: string = result.data.token;
    const decoded = decodeToken(newToken);

    if (!decoded) {
      throw new Error('Ungültiges Token erhalten');
    }

    localStorage.setItem('auth_token', newToken);
    setToken(newToken);
    setUser(decoded);
  }, []);

  const logout = useCallback(() => {
    const tenantSlug = user?.tenant_slug;
    apiLogout(tenantSlug).catch(() => {});
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
