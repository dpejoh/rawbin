import { useState, useEffect, useCallback } from "react";
import netlifyIdentity from "netlify-identity-widget";

export interface AuthUser {
  email: string;
  id: string;
}

interface UseAuthReturn {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  signOut: () => void;
  openLogin: () => void;
}

export default function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const handleUser = useCallback(async (u: unknown) => {
    if (!u) {
      setUser(null);
      setToken(null);
      setIsLoading(false);
      return;
    }
    const userData = u as { email?: string; id: string };
    setUser({ email: userData.email ?? "", id: userData.id });

    try {
      const jwt = await netlifyIdentity.refresh();
      setToken(jwt);
    } catch {
      setToken(null);
    }
    setIsLoading(false);
  }, []);

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
    };

    netlifyIdentity.on("init", onInit);
    netlifyIdentity.on("login", onLogin);
    netlifyIdentity.on("logout", onLogout);
    netlifyIdentity.on("error", onError);

    netlifyIdentity.init();

    return () => {
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

  return { user, token, isLoading, signOut, openLogin };
}
