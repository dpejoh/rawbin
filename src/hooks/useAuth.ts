import { useState, useEffect, useCallback } from "react";
import netlifyIdentity from "netlify-identity-widget";

export type UserRole = "viewer" | "editor" | "admin";

export interface AuthUser {
  email: string;
  id: string;
}

interface UseAuthReturn {
  user: AuthUser | null;
  token: string | null;
  role: UserRole;
  isLoading: boolean;
  signOut: () => void;
  openLogin: () => void;
}

export default function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole>("viewer");
  const [isLoading, setIsLoading] = useState(true);

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

  const handleUser = useCallback(async (u: unknown) => {
    if (!u) {
      setUser(null);
      setToken(null);
      setRole("viewer");
      setIsLoading(false);
      return;
    }
    const userData = u as { email?: string; id: string };
    setUser({ email: userData.email ?? "", id: userData.id });

    try {
      const jwt = await netlifyIdentity.refresh();
      setToken(jwt);
      await fetchRole(jwt);
    } catch {
      setToken(null);
    }
    setIsLoading(false);
  }, [fetchRole]);

  useEffect(() => {
    const onInit = (u: unknown) => {
      if (u) {
        handleUser(u);
      } else {
        setIsLoading(false);
        netlifyIdentity.open();
      }
    };

    const onLogin = (u: unknown) => handleUser(u);

    const onLogout = () => {
      setUser(null);
      setToken(null);
      setIsLoading(false);
      netlifyIdentity.open();
    };

    const onError = (err: unknown) => {
      console.error("[Identity]", err);
      setIsLoading(false);
    };

    netlifyIdentity.on("init", onInit);
    netlifyIdentity.on("login", onLogin);
    netlifyIdentity.on("logout", onLogout);
    netlifyIdentity.on("error", onError);

    netlifyIdentity.init();

    const fallback = setTimeout(() => setIsLoading(false), 3000);

    return () => {
      clearTimeout(fallback);
      netlifyIdentity.off("init", onInit);
      netlifyIdentity.off("login", onLogin);
      netlifyIdentity.off("logout", onLogout);
      netlifyIdentity.off("error", onError);
    };
  }, [handleUser]);

  const signOut = useCallback(() => {
    netlifyIdentity.logout();
  }, []);

  const openLogin = useCallback(() => {
    netlifyIdentity.open();
  }, []);

  return { user, token, role, isLoading, signOut, openLogin };
}
