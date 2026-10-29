"use client";

import { useEffect, useRef, useState } from "react";
import * as Icons from "lucide-react";
import { ActiveSession, ApiError, changePassword, reportSessionActivity, signOut, UserAccount } from "@/lib/user-api";

export function LoginScreen({
  onLogin,
  companyName,
  companyLogoUrl,
  initialError = "",
}: {
  onLogin: (email: string, password: string) => Promise<void>;
  companyName: string;
  companyLogoUrl: string;
  initialError?: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(initialError);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await onLogin(email.trim(), password);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Sign-in failed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-shell">
      <div className="login-orb login-orb-one" />
      <div className="login-orb login-orb-two" />
      <div className="login-grid" />
      <div className="login-topbar">
        <div className="brand-lockup">
          <div className="brand-mark">
            {companyLogoUrl ? (
              <img
                src={companyLogoUrl}
                alt=""
                className="size-full rounded-xl object-contain bg-white p-1"
              />
            ) : (
              companyName.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <strong>{companyName}</strong>
            <span>management system</span>
          </div>
        </div>
        <div className="secure-label">
          <Icons.ShieldCheck /> Secure workspace
        </div>
      </div>
      <div className="login-content">
        <section className="login-intro">
          <div className="eyebrow">
            <Icons.Sparkles /> Digictal operations
          </div>
          <h1>
            Anli Establishment
            <br />
            <em> Management System.</em>
          </h1>
          <p>
            A great paradigm shift to a new digital era to enhance business
            operations with technology
          </p>
          {/* <div className="login-stat-row ">
            <div >
              <strong>360°</strong>
              <span>Business visibility</span>
            </div>
            <div>
              <strong>24/7</strong>
              <span>Operational control</span>
            </div>
            <div>
              <strong>01</strong>
              <span>Unified workspace</span>
            </div>
          </div> */}
        </section>
        <section className="login-card">
          <div className="login-card-glow" />
          <div className="login-card-inner">
            <div className="login-card-heading">
              <span className="login-chip">WELCOME BACK</span>
              <h2>Sign in to {companyName}</h2>
              <p>Enter your credentials to access your workspace.</p>
            </div>
            <form onSubmit={submit} className="login-form">
              <label>
                Email address
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Enter your email"
                  autoComplete="username"
                  required
                />
              </label>
              <label>
                Password
                <div className="password-wrap">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <Icons.EyeOff /> : <Icons.Eye />}
                  </button>
                </div>
              </label>
              {error && (
                <div className="login-error" role="alert">
                  <Icons.AlertCircle />
                  {error}
                </div>
              )}
              <button className="login-submit" disabled={submitting}>
                {submitting ? "Signing you in..." : "Sign in to workspace"}
                <Icons.ArrowRight />
              </button>
            </form>
            <div className="login-card-footer">
              <span>
                <Icons.LockKeyhole /> Protected workspace
              </span>
              <span>Need help?</span>
            </div>
          </div>
        </section>
      </div>
      <div className="login-footer">
        <span>© 2026 {companyName}</span>
        <span>
          Developed by ·{" "}
          <a
            className="hover:text-blue-500 underline"
            href="https://kisibojonathandev.vercel.app/about"
            target="_blank"
            rel="noopener noreferrer"
          >
            Jonathan
          </a>
        </span>
      </div>
    </main>
  );
}

export function PasswordChangeScreen({
  user,
  companyName,
  companyLogoUrl,
  onComplete,
}: {
  user: UserAccount;
  companyName: string;
  companyLogoUrl: string;
  onComplete: (user: UserAccount, session: ActiveSession) => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("The new passwords do not match.");
      return;
    }
    if (newPassword.length < 8 || currentPassword === newPassword) {
      setError("Choose a different password with at least 8 characters.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await changePassword(currentPassword, newPassword);
      onComplete(result.user, result.session);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Could not change your password.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-shell">
      <div className="login-orb login-orb-one" />
      <div className="login-orb login-orb-two" />
      <div className="login-grid" />
      <div className="login-topbar">
        <div className="brand-lockup">
          <div className="brand-mark">
            {companyLogoUrl ? (
              <img
                src={companyLogoUrl}
                alt=""
                className="size-full rounded-xl object-contain bg-white p-1"
              />
            ) : (
              companyName.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <strong>{companyName}</strong>
            <span>Business operating system</span>
          </div>
        </div>
        <div className="secure-label">
          <Icons.ShieldCheck /> Secure workspace
        </div>
      </div>
      <div className="login-content flex min-h-[calc(100vh-142px)] items-center justify-center">
        <section className="login-card w-full max-w-[440px]">
          <div className="login-card-glow" />
          <div className="login-card-inner">
            <div className="login-card-heading">
              <span className="login-chip">FIRST SIGN-IN</span>
              <h2>Set a new password</h2>
              <p>
                Hello {user.name}. Change your initial password to continue.
              </p>
            </div>
            <form onSubmit={submit} className="login-form">
              <label>
                Initial password
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>
              <label>
                New password
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </label>
              <label>
                Confirm new password
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </label>
              {error && (
                <div className="login-error" role="alert">
                  <Icons.AlertCircle />
                  {error}
                </div>
              )}
              <button className="login-submit" disabled={submitting}>
                {submitting ? "Updating password..." : "Change password"}
                <Icons.ArrowRight />
              </button>
            </form>
            <p className="mt-4 text-center text-[10px] text-slate-400">
              Use at least 8 characters. You must change this password before
              accessing the workspace.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

export function ChangePasswordDialog({
  user,
  onClose,
  onComplete,
}: {
  user: UserAccount;
  onClose: () => void;
  onComplete: (user: UserAccount, session: ActiveSession) => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, submitting]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("The new passwords do not match.");
      return;
    }
    if (newPassword.length < 8 || currentPassword === newPassword) {
      setError("Choose a different password with at least 8 characters.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await changePassword(currentPassword, newPassword);
      onComplete(result.user, result.session);
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Could not change your password.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/45 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
        className="w-full max-w-md rounded-xl bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2
              id="change-password-title"
              className="text-base font-bold text-slate-900"
            >
              Change password
            </h2>
            <p className="mt-1 text-xs text-slate-500">{user.email}</p>
          </div>
          <button
            type="button"
            aria-label="Close change password dialog"
            disabled={submitting}
            onClick={onClose}
            className="grid size-8 place-items-center rounded-md text-slate-400 hover:bg-slate-100 disabled:opacity-50"
          >
            <Icons.X className="size-4" />
          </button>
        </header>
        {success ? (
          <div className="p-5">
            <p
              role="status"
              className="flex items-center gap-2 text-sm font-medium text-emerald-700"
            >
              <Icons.CircleCheck className="size-4" />
              Your password was changed successfully.
            </p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 p-5">
            <label className="block text-xs font-semibold text-slate-600">
              Current password
              <input
                autoFocus
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                required
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              New password
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              Confirm new password
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
              />
            </label>
            {error && (
              <p
                role="alert"
                className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
              >
                {error}
              </p>
            )}
            <footer className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                disabled={submitting}
                onClick={onClose}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {submitting ? "Updating…" : "Change password"}
              </button>
            </footer>
          </form>
        )}
      </section>
    </div>
  );
}

export function SessionIdleGuard({
  session,
  onSessionUpdate,
  onExpired,
}: {
  session: ActiveSession;
  onSessionUpdate: (session: ActiveSession) => void;
  onExpired: () => void;
}) {
  const [idleDeadline, setIdleDeadline] = useState(
    new Date(session.idleExpiresAt).getTime(),
  );
  const [now, setNow] = useState(Date.now());
  const [activityError, setActivityError] = useState("");
  const lastActivityRequest = useRef(0);
  const expiryHandled = useRef(false);
  const warningMs = Math.min(
    session.warningPeriodMs,
    session.idleTimeoutMs / 2,
  );
  const remainingSeconds = Math.max(0, Math.ceil((idleDeadline - now) / 1000));
  const lastLocalActivity = useRef(0);

  useEffect(() => {
    const serverDeadline = new Date(session.idleExpiresAt).getTime();
    setIdleDeadline(serverDeadline);
    setNow(Date.now());
    lastActivityRequest.current = 0;
    expiryHandled.current = false;
  }, [session.id, session.idleExpiresAt]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (idleDeadline > now || expiryHandled.current) return;
    expiryHandled.current = true;
    signOut()
      .catch(() => undefined)
      .finally(onExpired);
  }, [idleDeadline, now, onExpired]);

  useEffect(() => {
    const signalActivity = () => {
      if (document.visibilityState !== "visible") return;
      const currentTime = Date.now();
      if (currentTime - lastLocalActivity.current < 1000) return;
      lastLocalActivity.current = currentTime;
      const absoluteDeadline = new Date(session.absoluteExpiresAt).getTime();
      const localDeadline = Math.min(
        currentTime + session.idleTimeoutMs,
        absoluteDeadline,
      );
      setIdleDeadline(localDeadline);
      setActivityError("");
      if (currentTime - lastActivityRequest.current < 30_000) return;
      lastActivityRequest.current = currentTime;
      reportSessionActivity()
        .then(({ session: updatedSession }) => {
          onSessionUpdate(updatedSession);
          setIdleDeadline(new Date(updatedSession.idleExpiresAt).getTime());
        })
        .catch((error: unknown) => {
          if (error instanceof ApiError && error.status === 401) {
            expiryHandled.current = true;
            onExpired();
            return;
          }
          setActivityError(
            error instanceof ApiError
              ? error.message
              : "Could not refresh your active session.",
          );
        });
    };

    const activityEvents: (keyof WindowEventMap)[] = [
      "pointerdown",
      "pointermove",
      "keydown",
      "touchstart",
      "scroll",
    ];
    activityEvents.forEach((eventName) =>
      window.addEventListener(eventName, signalActivity, { passive: true }),
    );
    return () => {
      activityEvents.forEach((eventName) =>
        window.removeEventListener(eventName, signalActivity),
      );
    };
  }, [
    onExpired,
    onSessionUpdate,
    session.absoluteExpiresAt,
    session.id,
    session.idleTimeoutMs,
  ]);

  if (now < idleDeadline - warningMs) {
    return activityError ? (
      <div
        role="alert"
        className="fixed bottom-4 right-4 z-[90] max-w-sm rounded-lg border border-amber-200 bg-white px-4 py-3 text-xs text-amber-900 shadow-lg"
      >
        {activityError}
      </div>
    ) : null;
  }

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/45 p-4">
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="session-warning-title"
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl"
      >
        <span className="grid size-10 place-items-center rounded-lg bg-amber-50 text-amber-700">
          <Icons.Clock3 className="size-5" />
        </span>
        <h2
          id="session-warning-title"
          className="mt-4 text-base font-bold text-slate-900"
        >
          You&apos;re about to be signed out
        </h2>
        <p className="mt-2 text-sm leading-5 text-slate-600">
          Your session will expire in {Math.floor(remainingSeconds / 60)}:
          {String(remainingSeconds % 60).padStart(2, "0")}.
        </p>
        {activityError && (
          <p
            role="alert"
            className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700"
          >
            {activityError}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              signOut()
                .catch(() => undefined)
                .finally(onExpired);
            }}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Sign out
          </button>
          <button
            type="button"
            onClick={() => setActivityError("")}
            className="rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Stay signed in
          </button>
        </div>
      </section>
    </div>
  );
}
