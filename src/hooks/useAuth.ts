import { useState, useEffect, useCallback } from "react";
import {
  getUser,
  onAuthChange,
  login as nlLogin,
  logout as nlLogout,
  signup as nlSignup,
  handleAuthCallback,
  refreshSession,
  hydrateSession,
  requestPasswordRecovery,
  recoverPassword as nlRecoverPassword,
  acceptInvite as nlAcceptInvite,
  AUTH_EVENTS,
} from "@netlify/identity";

export type UserRole = "viewer" | "editor" | "admin";

function getJWT(): string | null {
  const match = document.cookie.match(/\bnf_jwt=([^;]+)/);
  return match ? (match[1] ?? null) : null;
}

export type AuthMode = "login" | "signup" | "forgot" | "recovery" | "invite" | "confirm-sent" | "recovery-sent";

export default function useAuth() {
  const [user, setUser] = useState<{ email: string; id: string } | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole>("viewer");
  const [isLoading, setIsLoading] = useState(true);
  const [mode, setMode] = useState<AuthMode>("login");
  const [error, setError] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [recoveryToken, setRecoveryToken] = useState<string | null>(null);

  const fetchRole = useCallback(async (jwt: string) => {
    try {
      const res = await fetch("/.netlify/functions/roles", {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (res.ok) {
        const data = (await res.json()) as { role?: string };
        if (data.role === "editor" || data.role === "admin") setRole(data.role);
        else setRole("viewer");
      } else {
        setRole("viewer");
      }
    } catch {
      setRole("viewer");
    }
  }, []);

  const syncSession = useCallback(async () => {
    try {
      await refreshSession();
    } catch {
      /* ignore */
    }
    const jwt = getJWT();
    const u = await getUser();
    if (jwt && u) {
      setToken(jwt);
      setUser({ email: u.email ?? "", id: u.id });
      await fetchRole(jwt);
    } else if (u) {
      setUser({ email: u.email ?? "", id: u.id });
      const jwt2 = getJWT();
      if (jwt2) {
        setToken(jwt2);
        await fetchRole(jwt2);
      }
    } else {
      setUser(null);
      setToken(null);
      setRole("viewer");
    }
  }, [fetchRole]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Check for recovery_token in URL hash — handle with recoverPassword()
      // instead of handleAuthCallback() to avoid session issues with updateUser()
      const hash = window.location.hash;
      if (hash) {
        const params = new URLSearchParams(hash.replace(/^#/, ""));
        const rToken = params.get("recovery_token");
        if (rToken) {
          setRecoveryToken(rToken);
          window.location.hash = "";
          setMode("recovery");
          setIsLoading(false);
          return;
        }
      }

      // Process other auth callback tokens (confirmation, invite, OAuth, email change)
      try {
        const result = await handleAuthCallback();
        if (cancelled) return;
        if (result) {
          if (result.type === "invite" && result.token) {
            setInviteToken(result.token);
            setMode("invite");
            setIsLoading(false);
            return;
          }
          // OAuth, confirmation, email_change — user is logged in
          await hydrateSession();
          await syncSession();
          if (!cancelled) setIsLoading(false);
          return;
        }
      } catch {
        /* no callback to process */
      }

      await syncSession();
      if (!cancelled) setIsLoading(false);
    })();

    const unsub = onAuthChange((event, u) => {
      if (event === AUTH_EVENTS.LOGIN) {
        syncSession();
      } else if (event === AUTH_EVENTS.LOGOUT) {
        setUser(null);
        setToken(null);
        setRole("viewer");
        setMode("login");
      } else if (event === AUTH_EVENTS.TOKEN_REFRESH) {
        const jwt = getJWT();
        if (jwt) {
          setToken(jwt);
          fetchRole(jwt);
        }
      } else if (event === AUTH_EVENTS.USER_UPDATED) {
        if (u) setUser({ email: u.email ?? "", id: u.id });
      }
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [syncSession, fetchRole]);

  const login = useCallback(
    async (email: string, password: string) => {
      setError(null);
      try {
        await nlLogin(email, password);
        await syncSession();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Login failed";
        setError(msg);
        throw err;
      }
    },
    [syncSession],
  );

  const signup = useCallback(
    async (email: string, password: string, name?: string) => {
      setError(null);
      try {
        const data = name ? { full_name: name } : undefined;
        await nlSignup(email, password, data);
        const jwt = getJWT();
        if (jwt) {
          await syncSession();
        } else {
          const u = await getUser();
          if (u) {
            setUser({ email: u.email ?? "", id: u.id });
            const jwt2 = getJWT();
            if (jwt2) {
              setToken(jwt2);
              await fetchRole(jwt2);
            }
          } else {
            setMode("confirm-sent");
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Signup failed";
        setError(msg);
        throw err;
      }
    },
    [syncSession, fetchRole],
  );

  const forgotPassword = useCallback(async (email: string) => {
    setError(null);
    try {
      await requestPasswordRecovery(email);
      setMode("recovery-sent");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send recovery email";
      setError(msg);
      throw err;
    }
  }, []);

  const resetPassword = useCallback(
    async (password: string) => {
      if (!recoveryToken) {
        setError("No recovery token available. Please request a new password reset.");
        return;
      }
      setError(null);
      try {
        await nlRecoverPassword(recoveryToken, password);
        setRecoveryToken(null);
        await hydrateSession();
        await syncSession();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to reset password";
        setError(msg);
        throw err;
      }
    },
    [recoveryToken, syncSession],
  );

  const acceptInvite = useCallback(
    async (password: string) => {
      if (!inviteToken) {
        setError("No invite token found");
        return;
      }
      setError(null);
      try {
        await nlAcceptInvite(inviteToken, password);
        setInviteToken(null);
        await syncSession();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to accept invite";
        setError(msg);
        throw err;
      }
    },
    [inviteToken, syncSession],
  );

  const signOut = useCallback(async () => {
    try {
      await nlLogout();
    } catch {
      /* ignore */
    }
    setUser(null);
    setToken(null);
    setRole("viewer");
    setMode("login");
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    user,
    token,
    role,
    isLoading,
    mode,
    error,
    login,
    signup,
    forgotPassword,
    resetPassword,
    acceptInvite,
    signOut,
    setMode,
    clearError,
  };
}

export type UseAuthReturn = ReturnType<typeof useAuth>;
