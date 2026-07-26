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
  changePassword as changePasswordSvc,
  createFirstUser as createFirstUserSvc,
  deleteMyProfile as deleteMyProfileSvc,
  isFirstRun as isFirstRunSvc,
  loginWithBiometrics as loginBiometricSvc,
  loginWithPassword as loginPasswordSvc,
  logout as logoutSvc,
  purgeMyData as purgeMyDataSvc,
  updateAutoLogoutSeconds as updateAutoLogoutSvc,
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
  changePin: (oldPin: string, newPin: string) => Promise<void>;
  setAutoLogoutSeconds: (seconds: number) => Promise<void>;
  purgeMyData: () => Promise<void>;
  deleteMyProfile: () => Promise<void>;
  logout: () => void;
  /** Reset the inactivity timer; call on any user interaction. */
  touch: () => void;
  /**
   * Run an action that legitimately sends the app to background (camera,
   * gallery, document picker, share sheet) WITHOUT triggering the auto-lock.
   * Re-arms the inactivity timer when it finishes.
   */
  runWithoutAutoLock: <T>(fn: () => Promise<T>) => Promise<T>;
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
  // >0 while an intentional external activity (camera/gallery/share/picker) is
  // running, so the background transition it causes does not lock the app.
  const lockSuspended = useRef(0);

  const doLogout = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = null;
    logoutSvc();
    setSession(null);
  }, []);

  const touch = useCallback(() => {
    if (!session) return;
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    // 0 (or less) means "never auto-logout while foregrounded".
    if (autoLogoutSeconds.current <= 0) return;
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

  // Lock when the app goes to background — unless we're in the middle of an
  // intentional external activity (camera, gallery, share, file picker).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'background' && session && lockSuspended.current === 0) {
        doLogout();
      }
    });
    return () => sub.remove();
  }, [session, doLogout]);

  const runWithoutAutoLock = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      lockSuspended.current += 1;
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      try {
        return await fn();
      } finally {
        lockSuspended.current = Math.max(0, lockSuspended.current - 1);
        // Re-arm the inactivity timer once we're back in the app.
        touch();
      }
    },
    [touch],
  );

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
    autoLogoutSeconds.current = s.autoLogoutSeconds || DEFAULT_AUTO_LOGOUT_SECONDS;
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

  const changePin = useCallback(
    async (oldPin: string, newPin: string) => {
      if (!session) throw new Error('Se requiere una sesión activa.');
      await changePasswordSvc(session.userId, oldPin, newPin);
    },
    [session],
  );

  const setAutoLogoutSeconds = useCallback(
    async (seconds: number) => {
      if (!session) throw new Error('Se requiere una sesión activa.');
      await updateAutoLogoutSvc(session.dek, session.userId, seconds);
      autoLogoutSeconds.current = seconds;
      setSession({ ...session, autoLogoutSeconds: seconds });
      touch();
    },
    [session, touch],
  );

  const purgeMyData = useCallback(async () => {
    if (!session) throw new Error('Se requiere una sesión activa.');
    await purgeMyDataSvc(session.dek, session.userId);
  }, [session]);

  const deleteMyProfile = useCallback(async () => {
    if (!session) throw new Error('Se requiere una sesión activa.');
    await deleteMyProfileSvc(session.dek, session.userId);
    doLogout();
    setFirstRun(await isFirstRunSvc());
  }, [session, doLogout]);

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
    changePin,
    setAutoLogoutSeconds,
    purgeMyData,
    deleteMyProfile,
    logout: doLogout,
    touch,
    runWithoutAutoLock,
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
