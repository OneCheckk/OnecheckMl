import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, getStoredToken, setStoredToken, AUTH_USER_KEY, apiEvents } from '../api/client';
import type { UserRole } from '@contracts';
import { homePathForRole } from './routeAccess';

export const DEV_SESSION_KEY = 'onecheck_dev_session';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  institutionName?: string;
  institutionId?: string;
}

export const adaptAuthUser = (rawUser: any): User => {
  if (!rawUser) throw new Error('No user data received');
  const id = rawUser.id || rawUser._id || '';
  const inst = rawUser.institution;
  const institutionName =
    typeof inst === 'object' && inst !== null
      ? inst.name
      : rawUser.institutionName || undefined;
  const institutionId =
    typeof inst === 'object' && inst !== null
      ? (inst._id || inst.id)
      : rawUser.institutionId || (typeof inst === 'string' ? inst : undefined);

  return {
    id: String(id),
    name: rawUser.name || '',
    email: rawUser.email || '',
    role: rawUser.role,
    institutionName,
    institutionId: institutionId ? String(institutionId) : undefined,
  };
};

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isDevSession: boolean;
  login: (email: string, password?: string, roleHint?: UserRole) => Promise<User>;
  devBypassLogin: (role: UserRole) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const MOCK_DEV_USERS: Record<string, User> = {
  INSTITUTION: {
    id: 'dev-mock-inst',
    name: 'Dr. R. K. Sharma (Testing Official)',
    email: 'institution@apex-tech.edu.in',
    role: 'INSTITUTION',
    institutionName: 'Apex Institute of Technology',
  },
  SCRUTINY_OFFICER: {
    id: 'dev-mock-officer',
    name: 'Shri V. S. Rao (Testing Officer)',
    email: 'officer.rao@aicte.gov.in',
    role: 'SCRUTINY_OFFICER',
    institutionName: 'AICTE Northern Regional Office',
  },
  REGIONAL_DIRECTOR: {
    id: 'dev-mock-director',
    name: 'Dr. Sunita Deshmukh (Testing Director)',
    email: 'director@aicte.gov.in',
    role: 'REGIONAL_DIRECTOR',
    institutionName: 'AICTE Central Headquarters',
  },
  ADMIN: {
    id: 'dev-mock-admin',
    name: 'System Admin (Testing Mode)',
    email: 'admin@aicte.gov.in',
    role: 'ADMIN',
    institutionName: 'AICTE e-Governance Cell',
  },
  AUDITOR: {
    id: 'dev-mock-auditor',
    name: 'Senior Auditor (Testing Mode)',
    email: 'auditor@cag.gov.in',
    role: 'AUDITOR',
    institutionName: 'CAG Compliance Cell',
  },
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = sessionStorage.getItem(AUTH_USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDevSession, setIsDevSession] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(DEV_SESSION_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const navigate = useNavigate();

  // Listen to 401 unauthorized emitted by axios interceptor
  useEffect(() => {
    const unsubscribe = apiEvents.on('401_UNAUTHORIZED', () => {
      logout();
      navigate('/login');
    });
    return unsubscribe;
  }, [navigate]);

  // Restore and sync session with /auth/me on mount if token is present
  useEffect(() => {
    let isMounted = true;
    const restoreSession = async () => {
      const storedToken = getStoredToken();
      if (!storedToken) return;

      try {
        const res = await apiClient.get('/auth/me');
        const data = res.data?.data || res.data;
        const userData = data?.user || data;
        if (userData && isMounted) {
          const adapted = adaptAuthUser(userData);
          setUser(adapted);
          sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(adapted));
        }
      } catch (err: any) {
        if (err?.response?.status === 401 && isMounted) {
          const isDev = sessionStorage.getItem(DEV_SESSION_KEY) === 'true';
          if (!isDev) {
            logout();
          }
        }
      }
    };

    restoreSession();
    return () => {
      isMounted = false;
    };
  }, []);

  // Post-sign-in destination (see auth/routeAccess.ts). Covers the backend's
  // OFFICER and INSTITUTION_USER role aliases used by the seeded accounts.
  const routeByRole = (role: UserRole) => {
    const target = homePathForRole(role);
    navigate(target === '/' ? '/portal' : target);
  };

  const login = async (email: string, password?: string, roleHint?: UserRole): Promise<User> => {
    setIsLoading(true);
    try {
      const payload: Record<string, any> = { email: email.trim().toLowerCase() };
      if (password) payload.password = password;
      if (roleHint) payload.roleHint = roleHint;

      const res = await apiClient.post('/auth/login', payload);
      const data = res.data?.data || res.data;
      const receivedToken = data.token;
      const receivedUser = adaptAuthUser(data.user || data);

      setStoredToken(receivedToken);
      sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(receivedUser));
      sessionStorage.removeItem(DEV_SESSION_KEY);

      setToken(receivedToken);
      setUser(receivedUser);
      setIsDevSession(false);

      routeByRole(receivedUser.role);
      return receivedUser;
    } finally {
      setIsLoading(false);
    }
  };

  // Development-Only Bypass Login
  const devBypassLogin = async (role: UserRole) => {
    setIsLoading(true);
    const mockUser = MOCK_DEV_USERS[role] || MOCK_DEV_USERS.INSTITUTION;

    try {
      // 1. First attempt the dedicated /auth/dev-bypass endpoint to get a real signed JWT
      const res = await apiClient.post('/auth/dev-bypass', { role });
      const data = res.data?.data || res.data;
      if (data?.token && data?.user) {
        const receivedToken = data.token;
        const receivedUser = adaptAuthUser(data.user);

        setStoredToken(receivedToken);
        sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(receivedUser));
        sessionStorage.removeItem(DEV_SESSION_KEY);

        setToken(receivedToken);
        setUser(receivedUser);
        setIsDevSession(false);

        routeByRole(receivedUser.role);
        return;
      }
    } catch {
      // If dev-bypass endpoint failed, try standard login with seed password
      try {
        const seedPasswords: Record<string, string> = {
          INSTITUTION: 'Institution@123456',
          SCRUTINY_OFFICER: 'Officer@123456',
          REGIONAL_DIRECTOR: 'Director@123456',
          ADMIN: 'Admin@123456',
          AUDITOR: 'Auditor@123456',
        };
        const password = seedPasswords[role] || 'Officer@123456';
        await login(mockUser.email, password, role);
        return;
      } catch {
        // Fall back to pure client-side mock session
      }
    } finally {
      setIsLoading(false);
    }

    // 2. Client-side dev fallback
    const mockToken = `dev-mock-jwt-token-for-${role.toLowerCase()}`;
    setStoredToken(mockToken);
    sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(mockUser));
    sessionStorage.setItem(DEV_SESSION_KEY, 'true');
    setToken(mockToken);
    setUser(mockUser);
    setIsDevSession(true);
    routeByRole(mockUser.role);
  };

  const logout = () => {
    setStoredToken(null);
    sessionStorage.removeItem(AUTH_USER_KEY);
    sessionStorage.removeItem(DEV_SESSION_KEY);
    setToken(null);
    setUser(null);
    setIsDevSession(false);
    navigate('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        isDevSession,
        login,
        devBypassLogin,
        logout,
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
