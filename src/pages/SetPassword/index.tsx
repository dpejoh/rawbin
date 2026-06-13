import { useState, useEffect } from "react";

interface SetupInfo {
  email: string;
  instance_slug: string;
}

export default function SetPasswordPage({ onDone }: { onDone: () => void }) {
  const [token] = useState(() => new URLSearchParams(window.location.search).get("token"));
  const [info, setInfo] = useState<SetupInfo | null>(null);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setError("Missing token"); return; }
    fetch(`/api/set-password?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json() as { error?: string };
          setError(data.error ?? "Invalid or expired link");
          return;
        }
        const data = await res.json() as SetupInfo;
        setInfo(data);
      })
      .catch(() => setError("Failed to validate link"));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setError(data.error ?? "Failed to set password");
        return;
      }
      onDone();
    } catch {
      setError("Failed to set password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-6">
          <svg className="size-12 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <h1 className="text-xl font-semibold text-foreground">rawbin</h1>

          {error && !info && (
            <div className="text-center space-y-2">
              <p className="text-destructive text-sm">{error}</p>
              <a href="/" className="text-primary text-sm hover:underline">Go to login</a>
            </div>
          )}

          {info && (
            <>
              <p className="text-sm text-muted-foreground text-center">
                Set your password for <strong className="text-foreground">{info.email}</strong>
                <br />
                at <strong className="text-foreground">{info.instance_slug}.rawbin.dpejoh.com</strong>
              </p>

              {error && <p className="text-xs text-destructive">{error}</p>}

              <form onSubmit={handleSubmit} className="w-full space-y-3">
                <input
                  type="password"
                  placeholder="New password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  required
                  minLength={6}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <input
                  type="password"
                  placeholder="Confirm password"
                  value={confirm}
                  onChange={(e) => { setConfirm(e.target.value); setError(""); }}
                  required
                  minLength={6}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  type="submit"
                  disabled={submitting || !password || !confirm}
                  className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {submitting ? "Setting password..." : "Set Password"}
                </button>
              </form>
            </>
          )}

          {!error && !info && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <svg className="animate-spin size-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              <span className="text-sm">Validating link...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
