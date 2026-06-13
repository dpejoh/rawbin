import { useState, useEffect, useCallback } from "react";
import {
  getUser,
  onAuthChange,
  login as nlLogin,
  logout as nlLogout,
  signup as nlSignup,
  oauthLogin as nlOAuthLogin,
  handleAuthCallback,
  refreshSession,
  requestPasswordRecovery,
  acceptInvite as nlAcceptInvite,
  updateUser as nlUpdateUser,
  AUTH_EVENTS,
} from "@netlify/identity";

export type UserRole = "viewer" | "editor" | "admin";

function getJWT(): string | null {
  const match = document.cookie.match(/\bnf_jwt=([^;]+)/);
  return match ? (match[1] ?? null) : null;
}

export type AuthMode = "login" | "signup" | "forgot" | "recovery" | "invite" | "confirm-sent" | "recovery-sent" | "error";

export default function useAuth() {
  const [user, setUser] = useState<{ email: string; id: string } | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole>("viewer");
  const [isLoading, setIsLoading] = useState(true);
  const [mode, setMode] = useState<AuthMode>("login");
  const [error, setError] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);

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
      try {
        const result = await handleAuthCallback();
        if (cancelled) return;
        if (result) {
          if (result.type === "recovery") {
            setMode("recovery");
            await syncSession();
            setIsLoading(false);
            return;
          }
          if (result.type === "invite" && result.token) {
            setInviteToken(result.token);
            setMode("invite");
            setIsLoading(false);
            return;
          }
        }
      } catch {
        /* no callback to process, or expired */
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
      } else if (event === AUTH_EVENTS.RECOVERY) {
        setMode("recovery");
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
          // autoconfirm is on — user is logged in
          await syncSession();
        } else {
          // autoconfirm is off — check if user was created
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

  const resetPassword = useCallback(async (password: string) => {
    setError(null);
    try {
      await nlUpdateUser({ password });
      setMode("login");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to reset password";
      setError(msg);
      throw err;
    }
  }, []);

  const acceptInvite = useCallback(
    async (password: string) => {
      if (!inviteToken) {
        setError("No invite token found");
        return;
      }
      setError(null);
      try {
        await nlAcceptInvite(inviteToken, password);
        await syncSession();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to accept invite";
        setError(msg);
        throw err;
      }
    },
    [inviteToken, syncSession],
  );

  const oauthLogin = useCallback((provider: "google" | "github" | "gitlab" | "bitbucket") => {
    nlOAuthLogin(provider);
  }, []);

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
    inviteToken,
    login,
    signup,
    forgotPassword,
    resetPassword,
    acceptInvite,
    oauthLogin,
    signOut,
    setMode,
    clearError,
  };
}

export type UseAuthReturn = ReturnType<typeof useAuth>;
