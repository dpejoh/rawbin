import { useState, useEffect, useRef, type FormEvent } from "react";
import type { UseAuthReturn } from "@/hooks/useAuth";

export default function AuthGate(auth: UseAuthReturn) {
  const { mode, setMode, error, clearError, isLoading, login, signup } = auth;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [instanceSlug, setInstanceSlug] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const firstInput = useRef<HTMLInputElement>(null);

  useEffect(() => { firstInput.current?.focus(); }, [mode]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(email, password);
    } catch {
      /* error is set by hook */
    }
    setSubmitting(false);
  };

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      clearError();
      return;
    }
    setSubmitting(true);
    try {
      await signup(email, password, instanceSlug);
      setMode("login");
      clearError();
    } catch {
      /* error is set by hook */
    }
    setSubmitting(false);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-6">
          <svg className="size-12 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <h1 className="text-xl font-semibold text-foreground">rawbin</h1>

          {mode === "login" && (
            <form onSubmit={handleLogin} className="w-full space-y-3">
              <input
                ref={firstInput}
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearError(); }}
                required
                autoComplete="email"
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); clearError(); }}
                required
                autoComplete="current-password"
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
              <button
                type="submit"
                disabled={submitting || !email || !password}
                className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {submitting ? "Signing in..." : "Sign In"}
              </button>
              <div className="flex justify-center text-xs">
                <button type="button" onClick={() => { setMode("signup"); clearError(); }} className="text-muted-foreground hover:text-foreground transition-colors">
                  Create account
                </button>
              </div>
            </form>
          )}

          {mode === "signup" && (
            <form onSubmit={handleSignup} className="w-full space-y-3">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearError(); }}
                required
                autoComplete="email"
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); clearError(); }}
                required
                minLength={6}
                autoComplete="new-password"
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                placeholder="Subdomain (e.g. yuri → yuri.rawbin.dpejoh.com)"
                value={instanceSlug}
                onChange={(e) => { setInstanceSlug(e.target.value); clearError(); }}
                required
                pattern="[a-zA-Z0-9-]+"
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {password && confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-destructive">Passwords do not match</p>
              )}
              {error && <p className="text-xs text-destructive">{error}</p>}
              <button
                type="submit"
                disabled={submitting || !email || !password || !confirmPassword || password !== confirmPassword || !instanceSlug}
                className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {submitting ? "Creating account..." : "Create Account"}
              </button>
              <p className="text-xs text-center text-muted-foreground">
                Already have an account?{" "}
                <button type="button" onClick={() => { setMode("login"); clearError(); }} className="underline hover:text-foreground transition-colors">
                  Sign in
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
