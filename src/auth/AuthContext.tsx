/**
 * Global auth/session context.
 *
 * Holds the in-memory session (including the DEK) and exposes the user-scoped
 * repositories. Also enforces two security behaviours required for a finance
 * app: inactivity auto-logout, and locking when the app goes to background.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';

import { getDatabase } from '../db/client';
import { maybeRunAutoBackup } from '../backup/autoBackup';
import { registerBackupTask } from '../backup/backgroundTask';
import { CurrencyCode } from '../money/currency';
import { Repositories, createRepositories } from '../data/repositories';
import {
  Session,
  addUser as addUserSvc,
  createFirstUser as createFirstUserSvc,
  isFirstRun as isFirstRunSvc,
  loginWithBiometrics as loginBiometricSvc,
  loginWithPassword as loginPasswordSvc,
  logout as logoutSvc,
} from './userService';

interface AuthContextValue {
  loading: boolean;
  firstRun: boolean;
  session: Session | null;
  repos: Repositories | null;
  createFirstUser: (
    name: string,
    password: string,
    baseCurrency?: CurrencyCode,
  ) => Promise<void>;
  loginWithPassword: (userId: string, password: string) => Promise<void>;
  loginWithBiometrics: (userId: string) => Promise<boolean>;
  addUser: (name: string, password: string) => Promise<void>;
  logout: () => void;
  /** Reset the inactivity timer; call on any user interaction. */
  touch: () => void;
  refreshFirstRun: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const DEFAULT_AUTO_LOGOUT_SECONDS = 120;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [firstRun, setFirstRun] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoLogoutSeconds = useRef(DEFAULT_AUTO_LOGOUT_SECONDS);

  const doLogout = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = null;
    logoutSvc();
    setSession(null);
  }, []);

  const touch = useCallback(() => {
    if (!session) return;
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(
      doLogout,
      autoLogoutSeconds.current * 1000,
    );
  }, [session, doLogout]);

  // Determine first-run state on mount.
  useEffect(() => {
    (async () => {
      try {
        setFirstRun(await isFirstRunSvc());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Prevent screenshots / recording while a session is active (sensitive data).
  useEffect(() => {
    if (session) {
      ScreenCapture.preventScreenCaptureAsync('fintrack-session').catch(() => {});
    } else {
      ScreenCapture.allowScreenCaptureAsync('fintrack-session').catch(() => {});
    }
  }, [session]);

  // Lock when the app goes to background; (re)arm inactivity timer on start.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'background' && session) {
        doLogout();
      }
    });
    return () => sub.remove();
  }, [session, doLogout]);

  // Arm the inactivity timer whenever a session begins.
  useEffect(() => {
    if (session) touch();
    return () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Register the best-effort background backup task once on mount.
  useEffect(() => {
    registerBackupTask().catch(() => {});
  }, []);

  const applySession = useCallback((s: Session) => {
    autoLogoutSeconds.current = DEFAULT_AUTO_LOGOUT_SECONDS;
    setSession(s);
    setFirstRun(false);
    // Opportunistic backup: DB is open here, so a snapshot can checkpoint it.
    maybeRunAutoBackup().catch(() => {});
  }, []);

  const createFirstUser = useCallback(
    async (name: string, password: string, baseCurrency?: CurrencyCode) => {
      const s = await createFirstUserSvc(name, password, baseCurrency);
      applySession(s);
    },
    [applySession],
  );

  const loginWithPassword = useCallback(
    async (userId: string, password: string) => {
      const s = await loginPasswordSvc(userId, password);
      applySession(s);
    },
    [applySession],
  );

  const loginWithBiometrics = useCallback(
    async (userId: string) => {
      const s = await loginBiometricSvc(userId);
      if (!s) return false;
      applySession(s);
      return true;
    },
    [applySession],
  );

  const addUser = useCallback(
    async (name: string, password: string) => {
      if (!session) throw new Error('Se requiere una sesión activa.');
      await addUserSvc(session.dek, name, password);
    },
    [session],
  );

  const refreshFirstRun = useCallback(async () => {
    setFirstRun(await isFirstRunSvc());
  }, []);

  const repos = useMemo<Repositories | null>(() => {
    if (!session) return null;
    return createRepositories(getDatabase(), session.userId);
  }, [session]);

  const value: AuthContextValue = {
    loading,
    firstRun,
    session,
    repos,
    createFirstUser,
    loginWithPassword,
    loginWithBiometrics,
    addUser,
    logout: doLogout,
    touch,
    refreshFirstRun,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/** Convenience hook that guarantees a live session + repos (post-login). */
export function useSession() {
  const { session, repos } = useAuth();
  if (!session || !repos) {
    throw new Error('useSession called without an active session');
  }
  return { session, repos };
}
