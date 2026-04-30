import { useState, useEffect, useCallback } from "react";
import netlifyIdentity from "netlify-identity-widget";

interface IdentityUser {
  id: string;
  email?: string;
  jwt: (forceRefresh?: boolean) => Promise<string>;
}

const SITE_URL = window.location.origin;

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

  const handleUser = useCallback((u: IdentityUser | null) => {
    if (!u) {
      setUser(null);
      setToken(null);
      setIsLoading(false);
      return;
    }
    setUser({ email: u.email ?? "", id: u.id });
    u.jwt()
      .then((t: string) => setToken(t))
      .catch(() => setToken(null))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    const onInit = () => {
      const currentUser = netlifyIdentity.currentUser() as IdentityUser | null;
      if (currentUser) {
        handleUser(currentUser);
      } else {
        setIsLoading(false);
        netlifyIdentity.open();
      }
    };

    const onLogin = (u: unknown) => handleUser(u as IdentityUser);

    const onLogout = () => {
      handleUser(null);
      netlifyIdentity.open();
    };

    netlifyIdentity.on("init", onInit);
    netlifyIdentity.on("login", onLogin);
    netlifyIdentity.on("logout", onLogout);

    netlifyIdentity.init({
      APIUrl: `${SITE_URL}/.netlify/identity`,
    });

    return () => {
      netlifyIdentity.off("init", onInit);
      netlifyIdentity.off("login", onLogin);
      netlifyIdentity.off("logout", onLogout);
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
