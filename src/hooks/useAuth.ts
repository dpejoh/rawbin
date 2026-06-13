import { useState, useEffect, useCallback } from "react";

export type UserRole = "viewer" | "editor" | "admin" | "yuri";
export type AuthMode = "login" | "signup";

const TOKEN_KEY = "rawbin:token";

export default function useAuth() {
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole>("viewer");
  const [slug, setSlug] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [mode, setMode] = useState<AuthMode>("login");
  const [error, setError] = useState<string | null>(null);

  const syncSession = useCallback(async (jwt: string) => {
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (res.ok) {
        const data = (await res.json()) as { email: string; role: string; slug: string };
        setUser({ email: data.email });
        setRole(data.role as UserRole);
        setSlug(data.slug);
        setToken(jwt);
        return true;
      }
    } catch {
      /* ignore */
    }
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setToken(null);
    setRole("viewer");
    setSlug("");
    return false;
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const stored = localStorage.getItem(TOKEN_KEY);
      if (stored) {
        await syncSession(stored);
      }
      if (!cancelled) setIsLoading(false);
    })();

    return () => { cancelled = true; };
  }, [syncSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      setError(null);
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = (await res.json()) as {
          token?: string;
          email?: string;
          role?: string;
          slug?: string;
          error?: string;
        };
        if (!res.ok || !data.token) {
          throw new Error(data.error ?? "Login failed");
        }
        localStorage.setItem(TOKEN_KEY, data.token);
        setToken(data.token);
        setUser({ email: data.email ?? email });
        setRole((data.role as UserRole) ?? "viewer");
        setSlug(data.slug ?? "");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Login failed";
        setError(msg);
        throw err;
      }
    },
    [],
  );

  const signup = useCallback(
    async (email: string, password: string, instance_slug: string) => {
      setError(null);
      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, instance_slug }),
        });
        const data = (await res.json()) as { error?: string; ok?: boolean };
        if (!res.ok) {
          throw new Error(data.error ?? "Registration failed");
        }
        return data.ok;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Registration failed";
        setError(msg);
        throw err;
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    if (token) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        /* ignore */
      }
    }
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setToken(null);
    setRole("viewer");
    setSlug("");
    setMode("login");
    setError(null);
  }, [token]);

  const clearError = useCallback(() => setError(null), []);

  return {
    user,
    token,
    role,
    slug,
    isLoading,
    mode,
    error,
    login,
    signup,
    signOut,
    setMode,
    clearError,
  };
}

export type UseAuthReturn = ReturnType<typeof useAuth>;
