"use client";

/**
 * Client-side session state.
 *
 * The token lives in localStorage and is attached to every API request by the
 * client. This state is a *presentation* concern only — the backend enforces
 * authentication and authorization on every request, so route guards here are
 * purely for UX (e.g. not flashing a dashboard at a logged-out visitor).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api, ApiError, tokenStore } from "@/lib/api";
import type { Role, User } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  /** True until the stored session has been resolved. */
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Re-resolves the session from the stored token. */
  refresh: () => void;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // A session can only be pending if a token was stored — this avoids a
  // skeleton flash (and a setState in an effect) for signed-out visitors.
  const [loading, setLoading] = useState(() => tokenStore.get() !== null);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  /** Re-resolve the session from the stored token. */
  const refresh = useCallback(() => setRefreshToken((token) => token + 1), []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!tokenStore.get()) return;
      try {
        const me = await api.me();
        if (cancelled) return;
        setUser(me);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        // An expired or revoked token must drop the session entirely.
        if (err instanceof ApiError && err.isAuthError) {
          tokenStore.clear();
          setUser(null);
        } else {
          setError(err instanceof ApiError ? err.message : "Could not load your session.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.login(email, password);
    setUser(result.user);
    setError(null);
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  const hasRole = useCallback(
    (...roles: Role[]) => {
      if (!user) return false;
      if (user.roles.includes("SUPER_ADMIN")) return true;
      return roles.some((role) => user.roles.includes(role));
    },
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, error, login, logout, refresh, hasRole }),
    [user, loading, error, login, logout, refresh, hasRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return context;
}

/**
 * Roles allowed to create/update CRM records. Mirrors the backend's
 * `require_role("SUPERVISOR", "AI_MANAGER")` plus the ORG_ADMIN bypass.
 */
export const WRITE_ROLES: Role[] = ["ORG_ADMIN", "SUPERVISOR", "AI_MANAGER"];

/** Only ORG_ADMIN (and SUPER_ADMIN) may delete customers. */
export const DELETE_ROLES: Role[] = ["ORG_ADMIN"];

export function canWrite(user: Pick<User, "roles"> | null): boolean {
  if (!user) return false;
  if (user.roles.includes("SUPER_ADMIN") || user.roles.includes("ORG_ADMIN")) return true;
  return user.roles.some((role) => WRITE_ROLES.includes(role));
}
