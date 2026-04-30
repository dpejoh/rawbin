import { useState, useEffect, useCallback } from "react";

interface User {
  email: string;
  id: string;
}

interface UseAuthReturn {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  signOut: () => void;
}

export default function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let identity: ReturnType<typeof Object.create> | null = null;

    async function init() {
      try {
        const mod = await import("netlify-identity-widget");
        identity = mod.default as Record<string, unknown>;
        const on = (identity as Record<string, unknown>).on as (event: string, cb: (...args: unknown[]) => void) => void;

        on("init", () => {
          const cu = (identity as Record<string, unknown>).currentUser as () => Record<string, unknown> | undefined;
          const currentUser = cu();
          if (currentUser) {
            setUser({ email: (currentUser.email as string) ?? "", id: currentUser.id as string });
            const jwtFn = currentUser.jwt as () => Promise<string>;
            jwtFn().then(setToken).catch(() => {});
          }
          setIsLoading(false);
        });

        on("login", (u: unknown) => {
          const userData = u as Record<string, unknown>;
          setUser({ email: (userData.email as string) ?? "", id: userData.id as string });
          const cu = (identity as Record<string, unknown>).currentUser as () => Record<string, unknown> | undefined;
          const currentUser = cu();
          if (currentUser) {
            const jwtFn = currentUser.jwt as () => Promise<string>;
            jwtFn().then(setToken).catch(() => {});
          }
          setIsLoading(false);
        });

        on("logout", () => {
          setUser(null);
          setToken(null);
          setIsLoading(false);
        });

        const initFn = (identity as Record<string, unknown>).init as () => void;
        initFn();
      } catch {
        setIsLoading(false);
      }
    }
    init();

    return () => {
      if (identity) {
        const off = (identity as Record<string, unknown>).off as (event: string, cb: (...args: unknown[]) => void) => void;
        off("init", () => {});
        off("login", () => {});
        off("logout", () => {});
      }
    };
  }, []);

  const signOut = useCallback(() => {
    import("netlify-identity-widget").then((mod) => {
      ((mod.default as Record<string, unknown>).logout as () => void)();
    });
  }, []);

  return { user, token, isLoading, signOut };
}
