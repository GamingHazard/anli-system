"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import * as Icons from "lucide-react";
import {
  Boxes,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FilePlus2,
  Menu,
  Plus,
  Search,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";
import PayrollManagementPage from "@/components/payroll-management";
import SalaryAdvanceManagement from "@/components/salary-advance-management";
import ExpenseManagement from "@/components/expense-management";
import RawMaterialManagement from "@/components/raw-material-management";
import ProductionManagement from "@/components/production-management";
import AssetManagement from "@/components/asset-management";
import CompanyProfileManagement from "@/components/company-profile-management";
import UserManagement from "@/components/user-management";
import AuditWorkspace from "@/components/audit-workspace";
import SecuritySettings from "@/components/security-settings";
import Approvals from "@/components/approvals";
import LeaveManagement from "@/components/leave-management";
import DisciplinaryLettersPage from "@/components/disciplinary-letters";
import SalesManagementPage from "@/components/sales-management";
import ReceiptManagementPage from "@/components/receipt-management";
import OrdersManagement from "@/components/orders-management";
import NotificationCenter from "@/components/notification-center";
import DashboardOverview from "@/components/dashboard-overview";
import { hasAnyDepartmentRole, hasDepartmentRole } from "@/lib/authorization";
import { importLegacyCustomersOnce } from "@/lib/customer-migration";
import { importLegacySalesOnce } from "@/lib/sales-migration";
import {
  useAttendanceMonth,
  useAttendanceYear,
  useSaveDailyAttendance,
} from "@/lib/attendance-queries";
import { useLeaveRequests } from "@/lib/leave-queries";
import {
  useDisciplinaryCases,
  useDisciplinaryIndicators,
} from "@/lib/disciplinary-queries";
import { useSalaryAdvances } from "@/lib/salary-advance-queries";
import {
  balanceForSale,
  chartData,
  createId,
  createInvoiceDraft,
  createInvoiceSellerSnapshot,
  employeeDisplayName,
  exportCsv,
  formatDate,
  getSavedCustomersForImport,
  getSavedSalesForImport,
  getLegacyEmployeeImport,
  clearLegacyEmployeeImport,
  initials,
  isWithinDays,
  linkCustomerTransactions,
  loadState,
  money,
  navGroups,
  paidAmountForSale,
  paymentStateForSale,
  saveState,
  seedState,
  simulate,
  sum,
  type AttendanceRecord,
  type AttendanceStatus,
  type CompanyProfile,
  type Employee,
  type EmployeeDraft,
  type ErpState,
  type Invoice,
  type Sale,
  type SalePayment,
} from "@/lib/erp";
import {
  type ActiveSession,
  ApiError,
  changePassword,
  archiveCustomer as archiveCustomerApi,
  changeCustomerStatus as changeCustomerStatusApi,
  createCustomer as createCustomerApi,
  createEmployee as createEmployeeApi,
  deactivateEmployee as deactivateEmployeeApi,
  deleteEmployeeDraft,
  importLocalEmployees,
  importLegacyCustomers,
  importLegacySales,
  listCustomers,
  listEmployeeDrafts,
  listEmployees,
  removeEmployeeDocument,
  removeEmployeeImage,
  saveEmployeeDraft,
  updateEmployee as updateEmployeeApi,
  uploadEmployeeDocument,
  uploadEmployeeImage,
  getCompanyProfile,
  getCurrentSession,
  getEmployee,
  getEmployeeDocumentDownload,
  getPublicCompanyBrand,
  listSales,
  reportSessionActivity,
  restoreCustomer as restoreCustomerApi,
  signIn,
  signOut,
  updateCustomer as updateCustomerApi,
  type PublicCompanyBrand,
  type DisciplinaryIndicator,
  type UserAccount,
} from "@/lib/user-api";

const queryClient = new QueryClient();
const iconMap = Icons as unknown as Record<
  string,
  React.ComponentType<{ className?: string }>
>;

function LoginScreen({
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
            <span>Business operating system</span>
          </div>
        </div>
        <div className="secure-label">
          <Icons.ShieldCheck /> Secure workspace
        </div>
      </div>
      <div className="login-content">
        <section className="login-intro">
          <div className="eyebrow">
            <Icons.Sparkles /> Intelligent operations
          </div>
          <h1>
            Run your business
            <br />
            <em>with clarity.</em>
          </h1>
          <p>
            One calm, connected workspace for your people, sales, finance and
            operations.
          </p>
          <div className="login-stat-row">
            <div>
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
          </div>
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
        <span>UGX · Africa/Kampala</span>
      </div>
    </main>
  );
}

function PasswordChangeScreen({
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

function ChangePasswordDialog({
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

function SessionIdleGuard({
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

function App() {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [sessionInfo, setSessionInfo] = useState<ActiveSession | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [active, setActive] = useState("Dashboard");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedPayrollRunId, setSelectedPayrollRunId] = useState<
    string | null
  >(null);
  const [selectedAdvanceId, setSelectedAdvanceId] = useState<string | null>(
    null,
  );
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [state, setState] = useState<ErpState>(loadState);
  const customerCanRead = Boolean(
    currentUser &&
      hasAnyDepartmentRole(currentUser.roles, [
        "Sales Manager",
        "Marketing Manager",
        "General Manager",
        "Admin",
      ]),
  );
  const customerCanManage = Boolean(
    currentUser &&
      hasAnyDepartmentRole(currentUser.roles, [
        "Sales Manager",
        "General Manager",
        "Admin",
      ]),
  );
  const selectedEmployee = state.employees.find(
    (item) => item.id === selectedId,
  );
  const selectedCustomer = state.customers.find(
    (item) => item.id === selectedId,
  );
  const [employeesLoaded, setEmployeesLoaded] = useState(false);
  const [customersLoaded, setCustomersLoaded] = useState(false);
  const [customersApiLoaded, setCustomersApiLoaded] = useState(false);
  const [customerLoadError, setCustomerLoadError] = useState("");
  const [customerLoadAttempt, setCustomerLoadAttempt] = useState(0);
  const [salesLoaded, setSalesLoaded] = useState(false);
  const [salesLoadError, setSalesLoadError] = useState("");
  const [salesMigrationWarning, setSalesMigrationWarning] = useState("");
  const [salesLoadAttempt, setSalesLoadAttempt] = useState(0);
  const salesCanRead = Boolean(
    currentUser &&
      hasAnyDepartmentRole(currentUser.roles, [
        "Sales Manager",
        "General Manager",
        "Super Admin",
      ]),
  );
  const [employeeLoadError, setEmployeeLoadError] = useState("");
  const [employeeDetailLoading, setEmployeeDetailLoading] = useState(false);
  const [employeeLoadAttempt, setEmployeeLoadAttempt] = useState(0);
  const [publicBrand, setPublicBrand] = useState<PublicCompanyBrand>({
    companyName: "Lumina ERP",
    logoUrl: "",
  });
  const [companyProfileLoaded, setCompanyProfileLoaded] = useState(false);
  const [companyProfileError, setCompanyProfileError] = useState("");
  const [companyProfileLoadAttempt, setCompanyProfileLoadAttempt] = useState(0);
  const handleAuthenticatedUpdate = useCallback(
    (user: UserAccount, session: ActiveSession) => {
      setCurrentUser(user);
      setSessionInfo(session);
      setAuthError("");
    },
    [],
  );
  const handleSessionEnded = useCallback(() => {
    setCurrentUser(null);
    setSessionInfo(null);
    setAuthError("Your session ended. Sign in again to continue.");
    setActive("Dashboard");
    setMobileNav(false);
    setShowChangePassword(false);
  }, []);
  useEffect(() => {
    let mounted = true;
    getPublicCompanyBrand()
      .then((brand) => {
        if (mounted)
          setPublicBrand({
            companyName: brand.companyName || "Lumina ERP",
            logoUrl: brand.logoUrl || "",
          });
      })
      .catch(() => {
        if (mounted) setPublicBrand({ companyName: "Lumina ERP", logoUrl: "" });
      });
    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    if (!currentUser || currentUser.mustChangePassword) {
      setCompanyProfileLoaded(false);
      return;
    }
    let mounted = true;
    setCompanyProfileLoaded(false);
    setCompanyProfileError("");
    getCompanyProfile()
      .then(({ profile }) => {
        if (!mounted) return;
        setState((current) => {
          const next = {
            ...current,
            companyProfile: profile,
            invoices: current.invoices.map((invoice) =>
              invoice.status === "Draft"
                ? { ...invoice, seller: createInvoiceSellerSnapshot(profile) }
                : invoice,
            ),
          };
          saveState(next);
          return next;
        });
        setCompanyProfileLoaded(true);
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setCompanyProfileError(
          error instanceof ApiError
            ? error.message
            : "Could not load the company profile.",
        );
        setCompanyProfileLoaded(true);
      });
    return () => {
      mounted = false;
    };
  }, [currentUser, companyProfileLoadAttempt]);
  useEffect(() => {
    if (!currentUser || currentUser.mustChangePassword) {
      setEmployeesLoaded(false);
      setEmployeeLoadError("");
      setState((current) => ({
        ...current,
        employees: [],
        employeeDrafts: [],
      }));
      return;
    }
    let mounted = true;
    setEmployeesLoaded(false);
    setEmployeeLoadError("");
    listEmployees()
      .then(({ employees }) => {
        if (mounted) {
          setState((current) => ({ ...current, employees }));
          setEmployeesLoaded(true);
        }
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setEmployeeLoadError(
          error instanceof ApiError
            ? error.message
            : "Could not load employee profiles.",
        );
        setEmployeesLoaded(true);
      });
    return () => {
      mounted = false;
    };
  }, [currentUser, employeeLoadAttempt]);
  useEffect(() => {
    if (!currentUser || currentUser.mustChangePassword || !customerCanRead) {
      setCustomersLoaded(false);
      setCustomersApiLoaded(false);
      setCustomerLoadError("");
      return;
    }
    let mounted = true;
    setCustomersLoaded(false);
    setCustomersApiLoaded(false);
    setCustomerLoadError("");
    const loadCustomers = async () => {
      let migrationWarning = "";
      try {
        migrationWarning = await importLegacyCustomersOnce(
          customerCanManage,
          getSavedCustomersForImport(),
          importLegacyCustomers,
        );
      } catch (error) {
        migrationWarning =
          `Customer import did not complete: ${error instanceof ApiError ? error.message : error instanceof Error ? error.message : "Unknown error."} Local data was retained.`;
      }
      try {
        const customers = await listCustomers();
        if (!mounted) return;
        setCustomersApiLoaded(true);
        setState((current) => {
          const next = linkCustomerTransactions({ ...current, customers });
          saveState(next);
          return next;
        });
        setCustomerLoadError(migrationWarning);
      } catch (error) {
        if (!mounted) return;
        setCustomersApiLoaded(false);
        const loadMessage =
          error instanceof ApiError
            ? error.message
            : "Could not load customer records.";
        setCustomerLoadError(
          migrationWarning ? `${migrationWarning} ${loadMessage}` : loadMessage,
        );
      } finally {
        if (mounted) setCustomersLoaded(true);
      }
    };
    void loadCustomers();
    return () => {
      mounted = false;
    };
  }, [
    currentUser?.id,
    currentUser?.mustChangePassword,
    customerCanRead,
    customerCanManage,
    customerLoadAttempt,
  ]);
  useEffect(() => {
    if (!currentUser || currentUser.mustChangePassword || !salesCanRead) {
      setSalesLoaded(false);
      setSalesLoadError("");
      setSalesMigrationWarning("");
      return;
    }
    let mounted = true;
    setSalesLoaded(false);
    setSalesLoadError("");
    const loadSales = async () => {
      let migrationWarning = "";
      try {
        migrationWarning = await importLegacySalesOnce(
          salesCanRead,
          getSavedSalesForImport(),
          importLegacySales,
        );
      } catch (error) {
        migrationWarning = `Sales import did not complete: ${error instanceof Error ? error.message : "Unknown error."} Local data was retained.`;
      }
      if (mounted) setSalesMigrationWarning(migrationWarning);
      try {
        const { sales, payments } = await listSales();
        if (!mounted) return;
        setState((current) => {
          const next = { ...current, sales, payments };
          saveState(next);
          return next;
        });
      } catch (error: unknown) {
        if (!mounted) return;
        setSalesLoadError(
          error instanceof ApiError
            ? error.message
            : "Could not load sales records.",
        );
      } finally {
        if (mounted) setSalesLoaded(true);
      }
    };
    void loadSales();
    return () => {
      mounted = false;
    };
  }, [
    currentUser?.id,
    currentUser?.mustChangePassword,
    salesCanRead,
    salesLoadAttempt,
  ]);
  useEffect(() => {
    if (
      active !== "Employee Profile Details" ||
      !selectedId ||
      !employeesLoaded ||
      selectedEmployee
    )
      return;
    let mounted = true;
    setEmployeeDetailLoading(true);
    setEmployeeLoadError("");
    getEmployee(selectedId)
      .then(({ employee }) => {
        if (mounted)
          setState((current) => ({
            ...current,
            employees: [
              employee,
              ...current.employees.filter((item) => item.id !== employee.id),
            ],
          }));
      })
      .catch((error: unknown) => {
        if (mounted)
          setEmployeeLoadError(
            error instanceof ApiError
              ? error.message
              : "Could not load this employee profile.",
          );
      })
      .finally(() => {
        if (mounted) setEmployeeDetailLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [
    active,
    selectedId,
    employeesLoaded,
    selectedEmployee,
    employeeLoadAttempt,
  ]);
  useEffect(() => {
    let mounted = true;
    getCurrentSession()
      .then((result) => {
        if (mounted && result) {
          setCurrentUser(result.user);
          setSessionInfo(result.session);
        }
      })
      .catch((error: unknown) => {
        if (mounted)
          setAuthError(
            error instanceof ApiError
              ? error.message
              : "Could not verify your session.",
          );
      })
      .finally(() => {
        if (mounted) setAuthLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ type: string; id: string }>)
        .detail;
      if (detail.type === "invoice") {
        setActive("Invoicing");
        return;
      }
      setSelectedId(detail.id);
      setActive(
        detail.type === "employee"
          ? "Employee Profile Details"
          : "Customer Details",
      );
    };
    window.addEventListener("erp:view", handler);
    return () => window.removeEventListener("erp:view", handler);
  }, []);
  const updateState = (next: ErpState) => {
    const linked = linkCustomerTransactions(next);
    setState(linked);
    saveState(linked);
    queryClient.invalidateQueries();
  };
  const updateSale = (sale: Sale, payments: SalePayment[]) => {
    setState((current) => ({
      ...current,
      sales: [sale, ...current.sales.filter((item) => item.id !== sale.id)],
      payments: [
        ...current.payments.filter((payment) => payment.saleId !== sale.id),
        ...payments,
      ],
    }));
  };
  const updateCustomers = useCallback(
    (customers: ErpState["customers"]) => {
      setState((current) => {
        const next = linkCustomerTransactions({ ...current, customers });
        saveState(next);
        return next;
      });
      queryClient.invalidateQueries();
    },
    [],
  );
  const applyCompanyProfile = (companyProfile: CompanyProfile) => {
    setState((current) => {
      const next = {
        ...current,
        companyProfile,
        invoices: current.invoices.map((invoice) =>
          invoice.status === "Draft"
            ? {
                ...invoice,
                seller: createInvoiceSellerSnapshot(companyProfile),
              }
            : invoice,
        ),
      };
      saveState(next);
      return next;
    });
  };
  const companyName =
    currentUser && companyProfileLoaded
      ? state.companyProfile.tradingName ||
        state.companyProfile.legalName ||
        publicBrand.companyName
      : publicBrand.companyName;
  const assetCanRead = Boolean(
    currentUser && hasAnyDepartmentRole(currentUser.roles, ["Inventory Manager", "General Manager"]),
  );
  const assetCanEdit = Boolean(
    currentUser && hasDepartmentRole(currentUser.roles, "Inventory Manager"),
  );
  const companyLogoUrl =
    currentUser && companyProfileLoaded
      ? state.companyProfile.logo.url || publicBrand.logoUrl
      : publicBrand.logoUrl;
  useEffect(() => {
    document.title = `${companyName} | Business Operations Suite`;
  }, [companyName]);
  if (authLoading)
    return (
      <main className="login-shell grid min-h-screen place-items-center">
        <p className="text-sm text-slate-300">Checking secure session…</p>
      </main>
    );
  if (!currentUser)
    return (
      <LoginScreen
        onLogin={async (email, password) => {
          const result = await signIn(email, password);
          handleAuthenticatedUpdate(result.user, result.session);
        }}
        companyName={companyName}
        companyLogoUrl={companyLogoUrl}
        initialError={authError}
      />
    );
  if (currentUser.mustChangePassword)
    return (
      <PasswordChangeScreen
        user={currentUser}
        companyName={companyName}
        companyLogoUrl={companyLogoUrl}
        onComplete={handleAuthenticatedUpdate}
      />
    );
  const handleLogout = async () => {
    try {
      await signOut();
      handleSessionEnded();
    } catch (error) {
      setAuthError(
        error instanceof ApiError
          ? error.message
          : "Could not complete sign-out with the server.",
      );
      handleSessionEnded();
    }
    setActive("Dashboard");
    setMobileNav(false);
  };
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-[#f7f8fc] text-slate-900">
        {sessionInfo && (
          <SessionIdleGuard
            session={sessionInfo}
            onSessionUpdate={setSessionInfo}
            onExpired={handleSessionEnded}
          />
        )}
        <Sidebar
          active={active}
          setActive={(value) => {
            setActive(value);
            setMobileNav(false);
          }}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          mobileNav={mobileNav}
          setMobileNav={setMobileNav}
          companyName={companyName}
          companyLogoUrl={companyLogoUrl}
          canReadAssets={assetCanRead}
          canReadCustomers={customerCanRead}
          canReadSales={salesCanRead}
        />
        <div
          className={`transition-[margin] duration-200 ${collapsed ? "lg:ml-[76px]" : "lg:ml-[252px]"}`}
        >
          <Header
            active={active}
            setMobileNav={setMobileNav}
            currentUser={currentUser}
            onNavigate={setActive}
            onLogout={handleLogout}
            onChangePassword={() => setShowChangePassword(true)}
          />
          {showChangePassword && (
            <ChangePasswordDialog
              user={currentUser}
              onClose={() => setShowChangePassword(false)}
              onComplete={handleAuthenticatedUpdate}
            />
          )}
          <main className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
            {companyProfileError && (
              <div
                role="alert"
                className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800"
              >
                <span>
                  Company profile could not be loaded: {companyProfileError}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setCompanyProfileLoadAttempt((attempt) => attempt + 1)
                  }
                  className="font-semibold underline underline-offset-2"
                >
                  Try again
                </button>
              </div>
            )}
            {active === "Analysis" ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">Analysis</h2>
                <p className="mt-2 text-sm text-slate-500">Coming soon!</p>
              </section>
            ) : active === "Auditing" ? (
              <AuditWorkspace currentUser={currentUser} />
            ) : active === "Dashboard" ? (
              <DashboardOverview
                companyName={companyName}
                companyLogoUrl={companyLogoUrl}
                userName={currentUser.name}
                roles={currentUser.roles}
                onNavigate={setActive}
                onExportSales={() =>
                  exportCsv(
                    `${
                      companyName
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/^-|-$/g, "") || "company"
                    }-sales.csv`,
                    state.sales as unknown as Record<string, unknown>[],
                  )
                }
              />
            ) : active === "Sales" || active === "Credit Sales" ? (
              !salesCanRead ? (
                <section role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                  You do not have permission to access sales records.
                </section>
              ) : (
                <SalesManagementPage
                  mode={active === "Credit Sales" ? "credit" : "sales"}
                  state={state}
                  currentUser={currentUser}
                  salesLoading={!salesLoaded}
                  salesError={salesLoadError}
                  onRetrySales={() =>
                    setSalesLoadAttempt((attempt) => attempt + 1)
                  }
                  onSaleUpdated={updateSale}
                  salesWarning={salesMigrationWarning}
                  customersAvailable={customersApiLoaded}
                  onRetryCustomers={() =>
                    setCustomerLoadAttempt((attempt) => attempt + 1)
                  }
                  companyName={companyName}
                  companyLogoUrl={companyLogoUrl}
                />
              )
            ) : active === "Receipt Management" ? (
              !salesCanRead ? (
                <section role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                  You do not have permission to access receipts.
                </section>
              ) : (
                <ReceiptManagementPage
                  companyName={companyName}
                  companyLogoUrl={companyLogoUrl}
                />
              )
            ) : active === "Payroll Management" ? (
              <PayrollManagementPage
                state={state}
                currentUser={currentUser}
                initialRunId={selectedPayrollRunId}
              />
            ) : active === "Salary Advance Management" ? (
              <SalaryAdvanceManagement
                state={state}
                currentUser={currentUser}
                initialAdvanceId={selectedAdvanceId}
                onViewEmployee={(id) => {
                  setSelectedId(id);
                  setActive("Employee Profile Details");
                }}
              />
            ) : active === "Employee Profile Details" ? (
              !employeesLoaded ? (
                <p role="status" className="p-8 text-sm text-slate-500">
                  Loading employee profile…
                </p>
              ) : employeeLoadError ? (
                <div
                  role="alert"
                  className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
                >
                  {employeeLoadError}
                  <button
                    type="button"
                    onClick={() =>
                      setEmployeeLoadAttempt((attempt) => attempt + 1)
                    }
                    className="ml-3 font-semibold underline"
                  >
                    Try again
                  </button>
                </div>
              ) : employeeDetailLoading ? (
                <p role="status" className="p-8 text-sm text-slate-500">
                  Loading employee profile…
                </p>
              ) : selectedEmployee ? (
                <EmployeeDetails
                  employee={selectedEmployee}
                  state={state}
                  updateState={updateState}
                  canManage={hasAnyDepartmentRole(currentUser.roles, ["Admin", "Human Resource"])}
                  canReadAdvances={hasAnyDepartmentRole(currentUser.roles, ["Admin", "Human Resource", "General Manager"])}
                  canReadDisciplinary={hasAnyDepartmentRole(currentUser.roles, ["Human Resource", "General Manager"])}
                  onEmployeeUpdated={(employee) =>
                    setState((current) => ({
                      ...current,
                      employees: current.employees.map((item) =>
                        item.id === employee.id ? employee : item,
                      ),
                    }))
                  }
                  onBack={() => setActive("Employee Profiles")}
                  onViewPayrollRun={(id) => {
                    setSelectedPayrollRunId(id);
                    setActive("Payroll Management");
                  }}
                  onViewAdvance={(id) => {
                    setSelectedAdvanceId(id);
                    setActive("Salary Advance Management");
                  }}
                />
              ) : (
                <section className="rounded-lg border border-slate-200 bg-white p-8 text-center">
                  <p className="text-sm text-slate-600">
                    Select an employee profile from the directory.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActive("Employee Profiles")}
                    className="mt-3 text-sm font-semibold text-primary"
                  >
                    Back to employee directory
                  </button>
                </section>
              )
            ) : active === "Customer Details" ? (
              !customerCanRead ? (
                <section role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                  You do not have permission to view customer records.
                </section>
              ) : !customersLoaded ? (
                <p role="status" className="p-8 text-sm text-slate-500">
                  Loading customer profile…
                </p>
              ) : selectedCustomer ? (
                <>
                  {customerLoadError && (
                    <p role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      {customerLoadError}
                    </p>
                  )}
                  <CustomerDetails
                    customer={selectedCustomer}
                    state={state}
                    onBack={() => setActive("Customer Management")}
                  />
                </>
              ) : (
                <section role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  {customerLoadError || "This customer profile could not be found."}
                  <button
                    type="button"
                    onClick={() => setCustomerLoadAttempt((attempt) => attempt + 1)}
                    className="ml-3 font-semibold underline"
                  >
                    Retry
                  </button>
                </section>
              )
            ) : active === "Employee Profiles" ? (
              <EmployeeDirectory
                state={state}
                updateState={updateState}
                loading={!employeesLoaded}
                loadError={employeeLoadError}
                currentUser={currentUser}
                onRetry={() => setEmployeeLoadAttempt((attempt) => attempt + 1)}
                onView={(id) => {
                  setSelectedId(id);
                  setActive("Employee Profile Details");
                }}
                onEmployeeCreated={(employee) =>
                  setState((current) => ({
                    ...current,
                    employees: [
                      employee,
                      ...current.employees.filter(
                        (item) => item.id !== employee.id,
                      ),
                    ],
                  }))
                }
              />
            ) : active === "Attendance Management" ? (
              hasAnyDepartmentRole(currentUser.roles, ["Admin", "Human Resource"]) ? (
                <AttendancePage
                  state={state}
                  employeesLoaded={employeesLoaded}
                  employeeLoadError={employeeLoadError}
                  onRetry={() =>
                    setEmployeeLoadAttempt((attempt) => attempt + 1)
                  }
                />
              ) : (
                <section
                  role="alert"
                  className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
                >
                  You do not have permission to access attendance records.
                </section>
              )
            ) : (
              <ModulePage
                active={active}
                state={state}
                updateState={updateState}
                currentUser={currentUser}
                companyName={companyName}
                companyLogoUrl={companyLogoUrl}
                companyProfileEditable={
                  currentUser.roles.includes("Super Admin") &&
                  companyProfileLoaded &&
                  !companyProfileError
                }
                onCompanyProfileSave={applyCompanyProfile}
                onCurrentSessionRevoked={handleSessionEnded}
                onViewSalaryAdvance={(id) => {
                  setSelectedAdvanceId(id);
                  setActive("Salary Advance Management");
                }}
                onViewPayrollRun={(id) => {
                  setSelectedPayrollRunId(id);
                  setActive("Payroll Management");
                }}
                onView={(id) => {
                  setSelectedId(id);
                  setActive(
                    active === "Employee Profiles"
                      ? "Employee Profile Details"
                      : "Customer Details",
                  );
                }}
                updateCustomers={updateCustomers}
                customersLoaded={customersLoaded}
                customersApiLoaded={customersApiLoaded}
                customerLoadError={customerLoadError}
                onRetryCustomers={() =>
                  setCustomerLoadAttempt((attempt) => attempt + 1)
                }
                customerCanManage={customerCanManage}
              />
            )}
          </main>
        </div>
      </div>
    </QueryClientProvider>
  );
}

function companyWorkDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kampala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function AttendancePage({
  state,
  employeesLoaded,
  employeeLoadError,
  onRetry,
}: {
  state: ErpState;
  employeesLoaded: boolean;
  employeeLoadError: string;
  onRetry: () => void;
}) {
  const [workDate, setWorkDate] = useState(companyWorkDate);
  const [department, setDepartment] = useState("All departments");
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [attendanceYear, setAttendanceYear] = useState(() =>
    Number(companyWorkDate().slice(0, 4)),
  );
  const [saveError, setSaveError] = useState("");
  const [expandedMonth, setExpandedMonth] = useState(
    companyWorkDate().slice(0, 7),
  );
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(
    null,
  );
  const attendanceQuery = useAttendanceYear(attendanceYear);
  const dayAttendanceQuery = useAttendanceMonth(workDate.slice(0, 7));
  const attendanceError = attendanceQuery.error ?? dayAttendanceQuery.error;
  const attendanceRecords = attendanceQuery.records;
  const saveMutation = useSaveDailyAttendance();
  const activeEmployees = state.employees.filter(
    (employee) => employee.status === "Active",
  );
  const departments = [
    ...new Set(
      activeEmployees.map((employee) => employee.department).filter(Boolean),
    ),
  ].sort();
  const recordedEmployeeIds = new Set([
    ...attendanceRecords.map((record) => record.employeeId),
    ...(dayAttendanceQuery.data?.records ?? []).map(
      (record) => record.employeeId,
    ),
  ]);
  const historyEmployees = state.employees.filter(
    (employee) =>
      (employee.status === "Active" || recordedEmployeeIds.has(employee.id)) &&
      (department === "All departments" || employee.department === department),
  );
  const departmentEmployees = activeEmployees.filter(
    (employee) =>
      department === "All departments" || employee.department === department,
  );
  const employees = historyEmployees.filter((employee) =>
    `${employeeDisplayName(employee)} ${employee.number} ${employee.department} ${employee.role}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const dayRecords = (dayAttendanceQuery.data?.records ?? []).filter(
    (record) =>
      record.workDate === workDate &&
      historyEmployees.some((employee) => employee.id === record.employeeId),
  );
  const presentRecords = dayRecords.filter(
    (record) => record.status === "Present",
  );
  const lateCount = presentRecords.filter((record) => record.late).length;
  const absentCount = dayRecords.filter(
    (record) => record.status === "Absent",
  ).length;
  const leaveCount = dayRecords.filter(
    (record) => record.status === "On leave",
  ).length;
  const currentMonth = companyWorkDate().slice(0, 7);
  const currentYear = Number(currentMonth.slice(0, 4));
  const historyYears = Array.from(
    { length: Math.max(1, Math.max(currentYear, attendanceYear) - 1999) },
    (_, index) => Math.max(currentYear, attendanceYear) - index,
  );
  const attendanceMonths = [
    ...new Set([
      ...(attendanceYear === currentYear ? [currentMonth] : []),
      ...attendanceRecords
        .map((record) => record.workDate.slice(0, 7))
        .filter(Boolean),
    ]),
  ].sort((left, right) => right.localeCompare(left));
  const monthLabel = (month: string) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Kampala",
      month: "long",
      year: "numeric",
    }).format(new Date(`${month}-15T12:00:00+03:00`));
  const monthDates = (month: string) => {
    const [year, monthNumber] = month.split("-").map(Number);
    const count = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    return Array.from(
      { length: count },
      (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`,
    );
  };
  const dayOfWeek = (date: string) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Kampala",
      weekday: "short",
    }).format(new Date(`${date}T12:00:00+03:00`));
  const monthSummary = (month: string) => {
    const records = attendanceRecords.filter(
      (record) =>
        record.workDate.startsWith(`${month}-`) &&
        historyEmployees.some((employee) => employee.id === record.employeeId),
    );
    return {
      recordedDays: new Set(records.map((record) => record.workDate)).size,
      present: records.filter((record) => record.status === "Present").length,
      halfDays: records.filter(
        (record) => record.status === "Present" && record.halfDay,
      ).length,
      late: records.filter(
        (record) => record.status === "Present" && record.late,
      ).length,
      absent: records.filter((record) => record.status === "Absent").length,
      leave: records.filter((record) => record.status === "On leave").length,
    };
  };
  const saveAttendance = async (
    updates: Array<
      Pick<
        AttendanceRecord,
        "employeeId" | "status" | "halfDay" | "late" | "note"
      >
    >,
  ) => {
    setSaveError("");
    try {
      await saveMutation.mutateAsync({ workDate, entries: updates });
      setShowDialog(false);
    } catch (error) {
      setSaveError(
        error instanceof ApiError
          ? error.message
          : "Could not save attendance.",
      );
    }
  };

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 text-xs font-medium text-slate-400">
            Workspace / HR Department
          </div>
          <h2 className="text-2xl font-bold tracking-tight">
            Attendance Management
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Daily roll call ·{" "}
            {new Intl.DateTimeFormat("en-GB", {
              timeZone: "Africa/Kampala",
              dateStyle: "full",
            }).format(new Date(`${workDate}T12:00:00+03:00`))}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Only server-saved attendance is shown. Previous browser-local
            records remain archived in that browser and were not imported.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSaveError("");
            setShowDialog(true);
          }}
          disabled={
            !employeesLoaded ||
            Boolean(employeeLoadError) ||
            dayAttendanceQuery.isLoading ||
            dayAttendanceQuery.isError ||
            departmentEmployees.length === 0 ||
            saveMutation.isPending
          }
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#6d28d9] px-3 py-2.5 text-xs font-semibold text-white hover:bg-[#5b21b6] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icons.ClipboardCheck className="size-4" /> Add attendance
        </button>
      </div>
      {!employeesLoaded && (
        <p
          role="status"
          className="mb-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500"
        >
          Loading employee roster…
        </p>
      )}
      {employeeLoadError && (
        <div
          role="alert"
          className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
        >
          <span>{employeeLoadError}</span>
          <button
            type="button"
            onClick={onRetry}
            className="font-semibold underline"
          >
            Retry employee roster
          </button>
        </div>
      )}
      {employeesLoaded &&
        !employeeLoadError &&
        activeEmployees.length === 0 && (
          <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            No active employee profiles are available to record attendance.
          </p>
        )}
      {saveError && (
        <p
          role="alert"
          className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
        >
          {saveError}
        </p>
      )}
      {(attendanceQuery.isLoading || dayAttendanceQuery.isLoading) && (
        <p
          role="status"
          className="mb-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500"
        >
          Loading attendance history…
        </p>
      )}
      {(attendanceQuery.isError || dayAttendanceQuery.isError) && (
        <div
          role="alert"
          className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
        >
          <span>
            {attendanceError instanceof ApiError
              ? attendanceError.message
              : "Could not load attendance history."}
          </span>
          <button
            type="button"
            onClick={() => {
              void attendanceQuery.refetch();
              void dayAttendanceQuery.refetch();
            }}
            className="font-semibold underline"
          >
            Try again
          </button>
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-xs font-semibold text-slate-600">
          Work date for entry
          <input
            aria-label="Attendance work date"
            type="date"
            value={workDate}
            onChange={(event) => {
              if (!/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) return;
              setWorkDate(event.target.value);
              setAttendanceYear(Number(event.target.value.slice(0, 4)));
              setExpandedMonth(event.target.value.slice(0, 7));
            }}
            className="mt-1 block rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-normal"
          />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          History year
          <select
            aria-label="Attendance history year"
            value={attendanceYear}
            onChange={(event) => setAttendanceYear(Number(event.target.value))}
            className="mt-1 block rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-normal"
          >
            {historyYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Department
          <select
            aria-label="Attendance department"
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
            className="mt-1 block rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-normal"
          >
            <option>All departments</option>
            {departments.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="ml-auto flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <Search className="size-4 text-slate-400" />
          <input
            aria-label="Search attendance employees"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search employees"
            className="w-44 bg-transparent text-xs outline-none"
          />
        </label>
      </div>
      <section
        aria-label="Attendance summary"
        className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <AttendanceMetric
          title="Present"
          value={presentRecords.length}
          detail={`${presentRecords.filter((record) => !record.halfDay).length} full day · ${presentRecords.filter((record) => record.halfDay).length} half day`}
          icon="UserCheck"
          tone="green"
        />
        <AttendanceMetric
          title="Late arrivals"
          value={lateCount}
          detail="Present employees marked late"
          icon="ClockAlert"
          tone="amber"
        />
        <AttendanceMetric
          title="Absent"
          value={absentCount}
          detail="Explicitly marked absent"
          icon="UserX"
          tone="rose"
        />
        <AttendanceMetric
          title="On leave"
          value={leaveCount}
          detail="Marked on leave for this date"
          icon="CalendarOff"
          tone="blue"
        />
      </section>
      <section
        aria-label="Monthly attendance history"
        className="overflow-hidden rounded-xl border border-slate-200 bg-white"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div>
            <h3 className="text-sm font-bold">Monthly attendance</h3>
            <p className="mt-1 text-xs text-slate-400">
              Select a month to review daily attendance by employee.
            </p>
          </div>
          <span className="text-[10px] text-slate-400">
            Company time: Africa/Kampala
          </span>
        </div>
        <div className="divide-y divide-slate-100">
          {attendanceQuery.isError ? (
            <p className="px-5 py-10 text-center text-xs text-rose-700">
              Attendance history could not be loaded. Use Try again above.
            </p>
          ) : attendanceQuery.isLoading ? (
            <p
              role="status"
              className="px-5 py-10 text-center text-xs text-slate-400"
            >
              Loading monthly history…
            </p>
          ) : attendanceMonths.length === 0 ? (
            <p className="px-5 py-10 text-center text-xs text-slate-400">
              No attendance records for {attendanceYear}.
            </p>
          ) : (
            attendanceMonths.map((month) => {
              const summary = monthSummary(month);
              const dates = monthDates(month);
              const expanded = expandedMonth === month;
              return (
                <section key={month} className="min-w-0">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setExpandedMonth(expanded ? "" : month)}
                    className="flex w-full flex-col gap-3 px-4 py-3 text-left hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <Icons.ChevronRight
                        className={`size-4 text-slate-400 transition-transform ${expanded ? "rotate-90" : ""}`}
                      />
                      <span className="text-sm font-bold text-slate-800">
                        {monthLabel(month)}
                      </span>
                      {month === currentMonth && (
                        <span className="rounded bg-[#f1eafd] px-1.5 py-0.5 text-[9px] font-semibold text-[#6d28d9]">
                          Current month
                        </span>
                      )}
                    </span>
                    <span className="flex flex-wrap gap-x-3 gap-y-1 pl-6 text-[10px] text-slate-500 sm:pl-0">
                      <span>{summary.recordedDays} days recorded</span>
                      <span className="text-emerald-700">
                        {summary.present} present
                      </span>
                      <span className="text-orange-700">
                        {summary.halfDays} half-days
                      </span>
                      <span className="text-blue-700">{summary.late} late</span>
                      <span className="text-rose-700">
                        {summary.absent} absent
                      </span>
                      <span className="text-sky-700">
                        {summary.leave} leave
                      </span>
                    </span>
                  </button>
                  {expanded && (
                    <div
                      id={`attendance-month-${month}`}
                      className="border-t border-slate-100"
                    >
                      <div className="flex flex-wrap gap-x-4 gap-y-2 border-b border-slate-100 px-4 py-2 text-[10px] text-slate-500">
                        <span className="flex items-center gap-1.5">
                          <i className="size-2 rounded-sm bg-emerald-500" />
                          Present
                        </span>
                        <span className="flex items-center gap-1.5">
                          <i className="size-2 rounded-sm bg-rose-500" />
                          Absent
                        </span>
                        <span className="flex items-center gap-1.5">
                          <i className="size-2 rounded-sm bg-orange-400" />
                          Half-day
                        </span>
                        <span className="flex items-center gap-1.5">
                          <i className="size-2 rounded-sm bg-sky-500" />
                          On leave
                        </span>
                        <span className="flex items-center gap-1.5">
                          <i className="grid size-3 place-items-center rounded-full bg-blue-600 text-[8px] font-bold not-italic text-white">
                            L
                          </i>
                          Late
                        </span>
                        <span className="text-slate-400">
                          Blank cells are unmarked; weekends are not assumed
                          absent.
                        </span>
                      </div>
                      <div className="overflow-auto">
                        <table className="w-full border-separate border-spacing-0 text-center text-[10px]">
                          <thead className="sticky top-0 z-20 bg-slate-50 text-slate-500">
                            <tr>
                              <th className="sticky left-0 z-30 min-w-[190px] border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-left">
                                Employee
                              </th>
                              {dates.map((date) => {
                                const weekend = ["Sat", "Sun"].includes(
                                  dayOfWeek(date),
                                );
                                return (
                                  <th
                                    key={date}
                                    className={`min-w-9 border-b border-slate-100 px-1 py-2 ${weekend ? "bg-slate-100/70 text-slate-400" : ""}`}
                                  >
                                    <span className="block font-semibold">
                                      {Number(date.slice(-2))}
                                    </span>
                                    <span className="mt-0.5 block text-[8px] font-normal">
                                      {dayOfWeek(date)}
                                    </span>
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody>
                            {employees.map((employee) => (
                              <tr key={employee.id} className="group">
                                <th
                                  scope="row"
                                  className="sticky left-0 z-10 border-b border-r border-slate-100 bg-white px-3 py-2 text-left group-hover:bg-slate-50"
                                >
                                  <span className="block truncate text-[11px] font-semibold text-slate-800">
                                    {employeeDisplayName(employee)}
                                  </span>
                                  <span className="mt-0.5 block truncate text-[9px] font-normal text-slate-400">
                                    {employee.number} · {employee.department}
                                  </span>
                                </th>
                                {dates.map((date) => {
                                  const record = attendanceRecords.find(
                                    (item) =>
                                      item.employeeId === employee.id &&
                                      item.workDate === date,
                                  );
                                  const isWeekend = ["Sat", "Sun"].includes(
                                    dayOfWeek(date),
                                  );
                                  const cellColor = !record
                                    ? "bg-transparent text-slate-300"
                                    : record.status === "Absent"
                                      ? "bg-rose-500 text-white"
                                      : record.status === "On leave"
                                        ? "bg-sky-500 text-white"
                                        : record.status === "Present" &&
                                            record.halfDay
                                          ? "bg-orange-400 text-white"
                                          : record.status === "Present"
                                            ? "bg-emerald-500 text-white"
                                            : "bg-transparent text-slate-300";
                                  const cellLabel = !record
                                    ? `${employeeDisplayName(employee)}, ${date}: unmarked${isWeekend ? ", weekend" : ""}`
                                    : `${employeeDisplayName(employee)}, ${date}: ${record.status}${record.status === "Present" ? (record.halfDay ? ", half day" : ", full day") : ""}${record.status === "Present" && record.late ? ", late" : ""}`;
                                  return (
                                    <td
                                      key={date}
                                      className={`border-b border-slate-100 px-0.5 py-1 ${isWeekend && !record ? "bg-slate-50/70" : ""}`}
                                    >
                                      <button
                                        type="button"
                                        aria-label={cellLabel}
                                        title={cellLabel}
                                        onClick={() => {
                                          setWorkDate(date);
                                          setExpandedMonth(month);
                                          if (record) setSelectedRecord(record);
                                          else setShowDialog(true);
                                        }}
                                        className={`relative mx-auto grid size-7 place-items-center rounded-md font-semibold transition hover:ring-2 hover:ring-slate-300 ${cellColor}`}
                                      >
                                        <span>
                                          {record
                                            ? record.status === "Absent"
                                              ? "A"
                                              : record.status === "On leave"
                                                ? "L"
                                                : record.status === "Present" &&
                                                    record.halfDay
                                                  ? "½"
                                                  : record.status === "Present"
                                                    ? "P"
                                                    : "·"
                                            : "·"}
                                        </span>
                                        {record?.status === "Present" &&
                                          record.late && (
                                            <span
                                              aria-hidden="true"
                                              className="absolute -right-0.5 -top-0.5 grid size-3 place-items-center rounded-full bg-blue-600 text-[7px] font-bold leading-none text-white"
                                            >
                                              L
                                            </span>
                                          )}
                                      </button>
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </section>
              );
            })
          )}
        </div>
      </section>
      {showDialog && (
        <AttendanceDialog
          employees={departmentEmployees}
          records={dayAttendanceQuery.data?.records ?? []}
          workDate={workDate}
          onClose={() => setShowDialog(false)}
          onSave={saveAttendance}
          isSaving={saveMutation.isPending}
          error={saveError}
        />
      )}
      {selectedRecord && (
        <AttendanceRecordDialog
          employeeName={employeeDisplayName(
            state.employees.find(
              (employee) => employee.id === selectedRecord.employeeId,
            ) ?? {},
          )}
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
        />
      )}
    </div>
  );
}

function AttendanceMetric({
  title,
  value,
  detail,
  icon,
  tone,
}: {
  title: string;
  value: number;
  detail: string;
  icon: string;
  tone: string;
}) {
  const Icon = iconMap[icon] || Icons.CircleCheck;
  const toneClass =
    tone === "green"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "amber"
        ? "bg-amber-50 text-amber-700"
        : tone === "rose"
          ? "bg-rose-50 text-rose-700"
          : "bg-sky-50 text-sky-700";
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <span
          className={`grid size-9 place-items-center rounded-lg ${toneClass}`}
        >
          <Icon className="size-4" />
        </span>
        <span className="text-[9px] font-semibold uppercase text-slate-400">
          {title === "Present" ? "Workday" : "Daily"}
        </span>
      </div>
      <div className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
        {value}
      </div>
      <h3 className="mt-0.5 text-xs font-semibold text-slate-700">{title}</h3>
      <p className="mt-1 text-[10px] text-slate-400">{detail}</p>
    </article>
  );
}

function AttendanceDialog({
  employees,
  records,
  workDate,
  onClose,
  onSave,
  isSaving,
  error,
}: {
  employees: Employee[];
  records: AttendanceRecord[];
  workDate: string;
  onClose: () => void;
  isSaving: boolean;
  error: string;
  onSave: (
    records: Array<
      Pick<
        AttendanceRecord,
        "employeeId" | "status" | "halfDay" | "late" | "note"
      >
    >,
  ) => void;
}) {
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<
    Record<
      string,
      {
        status: AttendanceStatus;
        halfDay: boolean;
        late: boolean;
        note: string;
      }
    >
  >(() =>
    Object.fromEntries(
      employees.map((employee) => {
        const record = records.find((item) => item.employeeId === employee.id);
        return [
          employee.id,
          {
            status: record?.status ?? "Unmarked",
            halfDay: record?.halfDay ?? false,
            late: record?.late ?? false,
            note: record?.note ?? "",
          },
        ];
      }),
    ),
  );
  const visibleEmployees = employees.filter((employee) =>
    `${employeeDisplayName(employee)} ${employee.number} ${employee.department}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const setEntry = (
    employeeId: string,
    update: Partial<(typeof entries)[string]>,
  ) =>
    setEntries((current) => ({
      ...current,
      [employeeId]: { ...current[employeeId], ...update },
    }));
  const setAllVisiblePresent = () =>
    setEntries((current) => ({
      ...current,
      ...Object.fromEntries(
        visibleEmployees.map((employee) => [
          employee.id,
          { ...current[employee.id], status: "Present" as const },
        ]),
      ),
    }));
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/40 p-3 sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="attendance-dialog-title"
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id="attendance-dialog-title" className="text-base font-bold">
              Record attendance
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {formatDate(workDate)} · Unmarked employees remain unmarked when
              saved.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close attendance dialog"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"
          >
            <X className="size-4" />
          </button>
        </header>
        {error && (
          <p
            role="alert"
            className="mx-4 mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
          >
            {error}
          </p>
        )}
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <Search className="size-4 text-slate-400" />
            <input
              aria-label="Search attendance roster"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full bg-transparent text-xs outline-none sm:w-64"
              placeholder="Search employees"
            />
          </label>
          <button
            type="button"
            onClick={setAllVisiblePresent}
            className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Mark all visible present
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 text-[10px] font-semibold uppercase text-slate-400">
              <tr>
                {[
                  "Employee",
                  "Attendance status",
                  "Half-day",
                  "Late",
                  "Note",
                ].map((label) => (
                  <th key={label} className="px-4 py-3">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleEmployees.map((employee) => {
                const entry = entries[employee.id];
                return (
                  <tr key={employee.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      {employeeDisplayName(employee)}
                      <span className="mt-1 block text-[10px] font-normal text-slate-400">
                        {employee.number} · {employee.department}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        aria-label={`${employeeDisplayName(employee)} attendance status`}
                        value={entry.status}
                        onChange={(event) => {
                          const status = event.target.value as AttendanceStatus;
                          setEntry(employee.id, {
                            status,
                            halfDay:
                              status === "Present" ? entry.halfDay : false,
                            late: status === "Present" ? entry.late : false,
                          });
                        }}
                        className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs"
                      >
                        <option>Unmarked</option>
                        <option>Present</option>
                        <option>Absent</option>
                        <option>On leave</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        aria-label={`${employeeDisplayName(employee)} half day`}
                        type="checkbox"
                        checked={entry.halfDay}
                        disabled={entry.status !== "Present"}
                        onChange={(event) =>
                          setEntry(employee.id, {
                            halfDay: event.target.checked,
                          })
                        }
                        className="size-4 accent-[#6d28d9] disabled:opacity-40"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        aria-label={`${employeeDisplayName(employee)} late`}
                        type="checkbox"
                        checked={entry.late}
                        disabled={entry.status !== "Present"}
                        onChange={(event) =>
                          setEntry(employee.id, { late: event.target.checked })
                        }
                        className="size-4 accent-[#6d28d9] disabled:opacity-40"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        aria-label={`${employeeDisplayName(employee)} note`}
                        value={entry.note}
                        onChange={(event) =>
                          setEntry(employee.id, { note: event.target.value })
                        }
                        placeholder="Optional"
                        className="w-36 rounded-md border border-slate-200 px-2 py-1.5 text-xs"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {visibleEmployees.length === 0 && (
            <p className="p-8 text-center text-xs text-slate-400">
              No employees match this search.
            </p>
          )}
        </div>
        <footer className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
          <p className="text-[10px] text-slate-400">
            Late and half-day are modifiers of Present.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() =>
                onSave(
                  employees.map((employee) => ({
                    employeeId: employee.id,
                    ...entries[employee.id],
                  })),
                )
              }
              className="rounded-lg bg-[#6d28d9] px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? "Saving…" : "Save attendance"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function Sidebar({
  active,
  setActive,
  collapsed,
  setCollapsed,
  mobileNav,
  setMobileNav,
  companyName,
  companyLogoUrl,
  canReadAssets,
  canReadCustomers,
  canReadSales,
}: {
  active: string;
  setActive: (value: string) => void;
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
  mobileNav: boolean;
  setMobileNav: (value: boolean) => void;
  companyName: string;
  companyLogoUrl: string;
  canReadAssets: boolean;
  canReadCustomers: boolean;
  canReadSales: boolean;
}) {
  const visibleNavGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          (item.label !== "Assets Management" || canReadAssets) &&
          (item.label !== "Customer Management" || canReadCustomers) &&
          (item.label !== "Sales" || canReadSales) &&
          (item.label !== "Credit Sales" || canReadSales) &&
          (item.label !== "Receipt Management" || canReadSales),
      ),
    }))
    .filter((group) => group.items.length > 0);
  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-slate-950/30 lg:hidden ${mobileNav ? "block" : "hidden"}`}
        onClick={() => setMobileNav(false)}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[252px] flex-col border-r border-slate-200 bg-white transition-transform duration-200 ${mobileNav ? "translate-x-0" : "-translate-x-full"} ${collapsed ? "lg:w-[76px]" : "lg:translate-x-0"} lg:translate-x-0`}
      >
        <div className="flex h-[76px] items-center gap-3 border-b border-slate-100 px-5">
          <div className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#6d28d9] text-sm font-bold text-white shadow-lg shadow-purple-200">
            {companyLogoUrl ? (
              <img
                src={companyLogoUrl}
                alt=""
                className="size-full bg-white object-contain p-1"
              />
            ) : (
              companyName.charAt(0).toUpperCase()
            )}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div
                className="max-w-40 truncate text-[15px] font-bold tracking-tight"
                title={companyName}
              >
                {companyName}
              </div>
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
                Management system
              </div>
            </div>
          )}
          <button
            aria-label="Close navigation"
            className="ml-auto lg:hidden"
            onClick={() => setMobileNav(false)}
          >
            <X className="size-5 text-slate-400" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-5">
          {visibleNavGroups.map((group) => (
            <div key={group.label} className="mb-5">
              <div
                className={`mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 ${collapsed ? "lg:hidden" : ""}`}
              >
                {group.label}
              </div>
              {group.items.map((item) => {
                const Icon = iconMap[item.icon] || LayoutFallback;
                const comingSoon = ["Analysis", "Data Backup", "Invoicing"].includes(item.label);
                return (
                  <button
                    key={item.label}
                    title={collapsed && comingSoon ? `${item.label} (coming soon!)` : collapsed ? item.label : undefined}
                    aria-label={comingSoon ? `${item.label} (coming soon!)` : item.label}
                    disabled={comingSoon}
                    onClick={() => setActive(item.label)}
                    className={`group mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition ${comingSoon ? "cursor-not-allowed text-slate-400" : active === item.label ? "bg-[#f1eafd] text-[#6d28d9]" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}
                  >
                    <Icon
                      className={`size-[17px] shrink-0 ${active === item.label ? "text-[#6d28d9]" : "text-slate-400 group-hover:text-slate-600"}`}
                    />
                    {!collapsed && (
                      <span className="flex min-w-0 items-center gap-1.5 truncate">
                        <span className="truncate">{item.label}</span>
                        {comingSoon && <span className="shrink-0 text-[10px] font-medium text-slate-400">(coming soon!)</span>}
                      </span>
                    )}
                    {!collapsed && active === item.label && (
                      <span className="ml-auto size-1.5 rounded-full bg-[#6d28d9]" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
function LayoutFallback({ className }: { className?: string }) {
  return <div className={className} />;
}
function EmployeeDetails({
  employee,
  state,
  updateState,
  canManage,
  canReadAdvances,
  canReadDisciplinary,
  onEmployeeUpdated,
  onBack,
  onViewPayrollRun,
  onViewAdvance,
}: {
  employee: Employee;
  state: ErpState;
  updateState: (next: ErpState) => void;
  canManage: boolean;
  canReadAdvances: boolean;
  canReadDisciplinary: boolean;
  onEmployeeUpdated: (employee: Employee) => void;
  onBack: () => void;
  onViewPayrollRun: (id: string) => void;
  onViewAdvance: (id: string) => void;
}) {
  return (
    <EmployeeProfile
      employee={employee}
      state={state}
      updateState={updateState}
      canManage={canManage}
      canReadAdvances={canReadAdvances}
      canReadDisciplinary={canReadDisciplinary}
      onEmployeeUpdated={onEmployeeUpdated}
      onBack={onBack}
      onViewPayrollRun={onViewPayrollRun}
      onViewAdvance={onViewAdvance}
    />
  );
}

const employeeWizardSteps = [
  "Personal",
  "Family",
  "Education",
  "Addresses",
  "Department & payroll",
  "Documents & review",
] as const;
const employeeDepartments = [
  "Sales",
  "HR",
  "Inventory",
  "Marketing",
  "Production",
];
const employeeRoles = [
  "Sales Manager",
  "General Manager",
  "Marketing Manager",
  "Inventory Manager",
  "Production Manager",
];
function EmployeeDirectory({
  state,
  updateState,
  loading,
  loadError,
  currentUser,
  onRetry,
  onView,
  onEmployeeCreated,
}: {
  state: ErpState;
  updateState: (next: ErpState) => void;
  loading: boolean;
  loadError: string;
  currentUser: UserAccount;
  onRetry: () => void;
  onView: (id: string) => void;
  onEmployeeCreated: (employee: Employee) => void;
}) {
  const [showWizard, setShowWizard] = useState(false);
  const [resumeDraft, setResumeDraft] = useState<EmployeeDraft | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [draftLoadError, setDraftLoadError] = useState("");
  const [drafts, setDrafts] = useState<EmployeeDraft[]>([]);
  const [query, setQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("All departments");
  const [categoryFilter, setCategoryFilter] = useState("All categories");
  const [frequencyFilter, setFrequencyFilter] = useState("All frequencies");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const canManage = currentUser.roles.some((role) =>
    ["Super Admin", "Admin", "Human Resource"].includes(role),
  );
  const canReadDisciplinary = currentUser.roles.some((role) =>
    ["Human Resource", "General Manager", "Super Admin"].includes(role),
  );
  const disciplinaryIndicatorsQuery =
    useDisciplinaryIndicators(canReadDisciplinary);
  const canRead = canManage || currentUser.roles.includes("General Manager");
  const [legacyImport, setLegacyImport] = useState(() =>
    getLegacyEmployeeImport(),
  );
  useEffect(() => {
    if (!canManage) return;
    let mounted = true;
    listEmployeeDrafts()
      .then(({ drafts }) => {
        if (mounted) setDrafts(drafts as EmployeeDraft[]);
      })
      .catch((error: unknown) => {
        if (mounted)
          setDraftLoadError(
            error instanceof ApiError
              ? error.message
              : "Could not load employee drafts.",
          );
      });
    return () => {
      mounted = false;
    };
  }, [canManage]);
  const standardDepartments = [
    "Sales",
    "HR",
    "Marketing",
    "Inventory",
    "Production",
  ];
  const legacyDepartments = [
    ...new Set(
      state.employees
        .map((employee) => employee.department)
        .filter(
          (department) =>
            department && !standardDepartments.includes(department),
        ),
    ),
  ].sort();
  const departments = [...standardDepartments, ...legacyDepartments];
  const visibleEmployees = state.employees.filter(
    (employee) =>
      `${employeeDisplayName(employee)} ${employee.number} ${employee.department} ${employee.role} ${employee.category}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (departmentFilter === "All departments" ||
        employee.department === departmentFilter) &&
      (categoryFilter === "All categories" ||
        (categoryFilter === "Staff"
          ? ["Staff", "Staff employee"].includes(employee.category)
          : categoryFilter === "Casual"
            ? ["Casual", "Casual worker"].includes(employee.category)
            : employee.category === "Other")) &&
      (frequencyFilter === "All frequencies" ||
        (frequencyFilter === "Not set"
          ? !employee.paymentFrequency
          : employee.paymentFrequency === frequencyFilter)) &&
      (statusFilter === "All statuses" || employee.status === statusFilter),
  );
  const resetFilters = () => {
    setQuery("");
    setDepartmentFilter("All departments");
    setCategoryFilter("All categories");
    setFrequencyFilter("All frequencies");
    setStatusFilter("All statuses");
  };
  const discardDraft = async (draft: EmployeeDraft) => {
    if (!window.confirm("Discard this employee draft? This cannot be undone."))
      return;
    try {
      await deleteEmployeeDraft(draft.id);
      setDrafts((current) => current.filter((item) => item.id !== draft.id));
    } catch (error) {
      setImportMessage(
        error instanceof ApiError
          ? error.message
          : "Could not discard this draft.",
      );
    }
  };
  const openDraft = (draft: EmployeeDraft) => {
    setResumeDraft(draft);
    setShowWizard(true);
  };
  const importLegacy = async () => {
    if (!legacyImport || importing) return;
    setImporting(true);
    setImportMessage("");
    try {
      const source = legacyImport.employees.filter(
        (employee) => employee.id && employee.number,
      );
      const importable = source.map((employee) => {
        const {
          id,
          photoUrl: _photoUrl,
          image: _image,
          documents: _documents,
          ...profile
        } = employee;
        return {
          migrationKey: String(id)
            .replace(/[^A-Za-z0-9_-]/g, "_")
            .slice(0, 80),
          employee: profile as Record<string, unknown>,
        };
      });
      const result = {
        imported: 0,
        alreadyImported: 0,
        failed: 0,
        results: [] as Array<{
          index: number;
          migrationKey?: string;
          status: string;
          error?: string;
          employeeId?: string;
        }>,
      };
      for (let offset = 0; offset < importable.length; offset += 25) {
        const batch = await importLocalEmployees(
          importable.slice(offset, offset + 25),
        );
        result.imported += batch.imported;
        result.alreadyImported += batch.alreadyImported;
        result.failed += batch.failed;
        result.results.push(
          ...batch.results.map((item) => ({
            ...item,
            index: item.index + offset,
          })),
        );
      }
      const migratedDrafts: string[] = [];
      for (const draft of legacyImport.employeeDrafts) {
        try {
          const {
            id: _id,
            number: _number,
            image: _image,
            photoUrl: _photoUrl,
            documents: _documents,
            ...draftEmployee
          } = draft.employee;
          await saveEmployeeDraft({ ...draft, employee: draftEmployee });
          migratedDrafts.push(draft.id);
        } catch {
          // Keep the legacy migration bundle so this draft can be retried.
        }
      }
      const refreshed = await listEmployees();
      const refreshedDrafts = await listEmployeeDrafts();
      updateState({ ...state, employees: refreshed.employees });
      setDrafts(refreshedDrafts.drafts as EmployeeDraft[]);
      if (
        result.failed === 0 &&
        migratedDrafts.length === legacyImport.employeeDrafts.length
      ) {
        clearLegacyEmployeeImport();
        setLegacyImport(null);
      }
      const oldMediaCount = source.filter(
        (employee) =>
          employee.photoUrl ||
          employee.image?.url ||
          employee.documents?.length,
      ).length;
      setImportMessage(
        `${result.imported} imported, ${result.alreadyImported} already imported, ${result.failed} failed.${oldMediaCount ? ` ${oldMediaCount} old profile(s) had media references that cannot be safely copied from browser storage; upload those files again on the profile.` : ""}${migratedDrafts.length < legacyImport.employeeDrafts.length ? " Some drafts could not migrate and are retained for retry." : ""}`,
      );
    } catch (error) {
      setImportMessage(
        error instanceof ApiError
          ? error.message
          : "Could not import local employee profiles.",
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 text-xs font-medium text-slate-400">
            Workspace / Employee Profiles
          </div>
          <h2 className="text-2xl font-bold tracking-tight">
            Employee directory
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Employee records, employment terms, and profile documents.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setResumeDraft(null);
              setShowWizard(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#6d28d9] px-3 py-2.5 text-xs font-semibold text-white hover:bg-[#5b21b6]"
          >
            <Plus className="size-4" /> Add employee
          </button>
        )}
      </div>
      {!canRead && (
        <p
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          Your account does not have permission to view employee profiles.
        </p>
      )}
      {loading && (
        <p
          role="status"
          className="mb-4 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500"
        >
          Loading employee profiles…
        </p>
      )}
      {loadError && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
        >
          {loadError}
        </div>
      )}
      {loadError && (
        <button
          type="button"
          onClick={onRetry}
          className="mb-4 text-xs font-semibold text-rose-700 underline"
        >
          Retry loading employee profiles
        </button>
      )}
      {canManage && legacyImport && (
        <section className="mb-4 rounded-xl border border-sky-200 bg-sky-50 p-4">
          <h3 className="text-sm font-bold text-sky-950">
            Local employee records found
          </h3>
          <p className="mt-1 text-xs text-sky-900">
            Import {legacyImport.employees.length} browser-saved employee
            profile(s) and {legacyImport.employeeDrafts.length} draft(s) into
            the server. Seeded demo employees are excluded. Existing local
            images/documents cannot be copied unless you upload the original
            files again.
          </p>
          <button
            type="button"
            disabled={importing || loading}
            onClick={importLegacy}
            className="mt-3 rounded-lg bg-sky-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {importing ? "Importing…" : "Import local employee data"}
          </button>
        </section>
      )}
      {importMessage && (
        <p
          role="status"
          className="mb-4 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-950"
        >
          {importMessage}
        </p>
      )}
      {draftLoadError && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"
        >
          {draftLoadError}
        </p>
      )}
      <section
        aria-label="Employee workforce totals"
        className="mb-4 grid gap-3 sm:grid-cols-3"
      >
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-xs font-semibold text-slate-600">
            Total profiles
          </h3>
          <div className="mt-2 text-2xl font-bold">
            {loading ? "—" : state.employees.length}
          </div>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-xs font-semibold text-slate-600">
            Active employees
          </h3>
          <div className="mt-2 text-2xl font-bold">
            {loading
              ? "—"
              : state.employees.filter(
                  (employee) => employee.status === "Active",
                ).length}
          </div>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-xs font-semibold text-slate-600">
            Inactive employees
          </h3>
          <div className="mt-2 text-2xl font-bold">
            {loading
              ? "—"
              : state.employees.filter(
                  (employee) => employee.status === "Inactive",
                ).length}
          </div>
        </article>
      </section>
      {drafts.length > 0 && (
        <section className="mb-4 overflow-hidden rounded-xl border border-amber-200 bg-white">
          <div className="border-b border-amber-100 px-4 py-3">
            <h3 className="text-sm font-bold">Employee drafts</h3>
            <p className="mt-1 text-xs text-slate-500">
              Incomplete records are saved separately and are not treated as
              employees.
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {drafts.map((draft) => (
              <div
                key={draft.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="text-xs font-semibold text-slate-800">
                    {employeeDisplayName(draft.employee)}
                  </div>
                  <div className="mt-1 text-[10px] text-slate-400">
                    Step {draft.currentStep + 1} of {employeeWizardSteps.length}{" "}
                    · Updated {new Date(draft.updatedAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => openDraft(draft)}
                    className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Resume
                  </button>
                  <button
                    type="button"
                    onClick={() => discardDraft(draft)}
                    className="rounded-md px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                  >
                    Discard
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      {!loading && !loadError && canRead && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-sm font-bold">Employees</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Showing {visibleEmployees.length} of {state.employees.length}{" "}
                  records
                </p>
              </div>
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <Search className="size-4 text-slate-400" />
                <input
                  aria-label="Search employees"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="w-full bg-transparent text-xs outline-none placeholder:text-slate-400 sm:w-64"
                  placeholder="Search name, number, department"
                />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <select
                aria-label="Filter employees by department"
                value={departmentFilter}
                onChange={(event) => setDepartmentFilter(event.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
              >
                <option>All departments</option>
                {departments.map((department) => (
                  <option key={department}>{department}</option>
                ))}
              </select>
              <select
                aria-label="Filter employees by category"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
              >
                <option>All categories</option>
                <option>Staff</option>
                <option>Casual</option>
                <option value="Other">Others</option>
              </select>
              <select
                aria-label="Filter employees by payment frequency"
                value={frequencyFilter}
                onChange={(event) => setFrequencyFilter(event.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
              >
                <option>All frequencies</option>
                <option>Monthly</option>
                <option>Weekly</option>
                <option value="Not set">Frequency not set</option>
              </select>
              <select
                aria-label="Filter employees by status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
              >
                <option>All statuses</option>
                <option>Active</option>
                <option>Inactive</option>
              </select>
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                <Icons.RotateCcw className="size-3.5" /> Reset filters
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-400">
                <tr>
                  {(canManage
                    ? [
                        "Employee",
                        "Department",
                        "Role",
                        "Category",
                        "Pay type",
                        "Frequency",
                        "Salary / wage",
                        "Status",
                      ]
                    : ["Employee", "Department", "Role", "Category", "Status"]
                  ).map((heading) => (
                    <th key={heading} className="px-4 py-3">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleEmployees.map((employee) => (
                  <tr
                    key={employee.id}
                    className="border-t border-slate-100 text-slate-600 hover:bg-slate-50/70"
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => onView(employee.id)}
                        className="flex items-center gap-3 text-left"
                      >
                        <EmployeeAvatar employee={employee} size="sm" />
                        <span className="font-semibold text-slate-800 hover:text-[#6d28d9]">
                          {employeeDisplayName(employee)}
                          <span className="mt-1 block font-mono text-[10px] font-normal text-slate-400">
                            {employee.number}
                          </span>
                        </span>
                        {disciplinaryIndicatorsQuery.data?.indicators[employee.id]?.map((indicator) => (
                          <DisciplinaryIndicatorBadge key={`${indicator.reference}-${indicator.icon}`} indicator={indicator} />
                        ))}
                      </button>
                    </td>
                    <td className="px-4 py-3">{employee.department}</td>
                    <td className="px-4 py-3">{employee.role}</td>
                    <td className="px-4 py-3">{employee.category}</td>
                    {canManage && (
                      <td className="px-4 py-3">
                        {employee.compensationType ?? "Not set"}
                      </td>
                    )}
                    {canManage && (
                      <td className="px-4 py-3">
                        {employee.paymentFrequency ?? "Not set"}
                      </td>
                    )}
                    {canManage && (
                      <td className="px-4 py-3 font-semibold text-slate-700">
                        {money(employee.salary)}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <Status text={employee.status} />
                    </td>
                  </tr>
                ))}
                {visibleEmployees.length === 0 && (
                  <tr>
                    <td
                      colSpan={canManage ? 8 : 5}
                      className="px-4 py-10 text-center text-slate-400"
                    >
                      No employees match those search terms and filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {showWizard && canManage && (
        <EmployeeWizard
          state={state}
          updateState={updateState}
          draft={resumeDraft}
          onEmployeeSaved={(employee) => {
            onEmployeeCreated(employee);
            if (resumeDraft)
              setDrafts((current) =>
                current.filter((item) => item.id !== resumeDraft.id),
              );
          }}
          onDraftSaved={(draft) =>
            setDrafts((current) => [
              draft,
              ...current.filter((item) => item.id !== draft.id),
            ])
          }
          onClose={() => {
            setShowWizard(false);
            setResumeDraft(null);
          }}
        />
      )}
    </div>
  );
}

function EmployeeAvatar({
  employee,
  size = "md",
}: {
  employee: Partial<Employee>;
  size?: "sm" | "md";
}) {
  const dimensions = size === "sm" ? "size-10 text-xs" : "size-16 text-lg";
  return employee.photoUrl ? (
    <img
      src={employee.photoUrl}
      alt={`${employeeDisplayName(employee)} profile`}
      className={`${dimensions} shrink-0 rounded-full object-cover`}
    />
  ) : (
    <div
      className={`${dimensions} grid shrink-0 place-items-center rounded-full bg-[#e9ddff] font-bold text-[#6d28d9]`}
    >
      {initials(employeeDisplayName(employee))}
    </div>
  );
}

function DisciplinaryIndicatorBadge({
  indicator,
}: {
  indicator: DisciplinaryIndicator;
}) {
  const icon = indicator.icon === "user-x"
    ? <Icons.UserRoundX className="size-4 text-rose-700" aria-hidden="true" />
    : <Icons.Flag
        className={`size-4 text-rose-700 ${indicator.icon === "flag-filled" ? "fill-rose-600" : ""}`}
        aria-hidden="true"
      />;
  return (
    <span
      title={`${indicator.label} · ${indicator.reference}`}
      aria-label={`${indicator.label}, reference ${indicator.reference}`}
      className="inline-flex shrink-0 items-center"
    >
      {icon}
    </span>
  );
}

function EmployeeWizard({
  state,
  updateState,
  draft,
  employee,
  onEmployeeSaved,
  onDraftSaved,
  onClose,
}: {
  state: ErpState;
  updateState: (next: ErpState) => void;
  draft: EmployeeDraft | null;
  employee?: Employee;
  onEmployeeSaved: (employee: Employee) => void;
  onDraftSaved: (draft: EmployeeDraft) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState(draft?.currentStep ?? 0);
  const [values, setValues] = useState<Partial<Employee>>(
    draft?.employee ?? employee ?? {},
  );
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [documentFiles, setDocumentFiles] = useState<
    Record<string, File | null>
  >({});
  const [documentNames, setDocumentNames] = useState<Record<string, string[]>>(
    {},
  );
  const [createdEmployee, setCreatedEmployee] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const keepLegacyName = Boolean(
    employee?.name &&
    !employee.firstName &&
    !employee.secondName &&
    !values.firstName?.trim() &&
    !values.secondName?.trim(),
  );
  const photoPreview = useMemo(
    () => (photoFile ? URL.createObjectURL(photoFile) : null),
    [photoFile],
  );
  useEffect(
    () => () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    },
    [photoPreview],
  );
  const updateField = (name: string, value: string | number | boolean) => {
    const [group, key] = name.split(".");
    setValues((current) => {
      if (group === "mother" || group === "father") {
        return {
          ...current,
          [group]: {
            name: "",
            phone: "",
            address: "",
            status: "",
            ...current[group],
            [key]: value,
          },
        };
      }
      return { ...current, [name]: value };
    });
    setError("");
  };
  const valueFor = (name: string) => {
    const [group, key] = name.split(".");
    return group === "mother" || group === "father"
      ? ((values[group] as Employee[typeof group])?.[
          key as keyof Employee[typeof group]
        ] ?? "")
      : (values[name as keyof Employee] ?? "");
  };
  const fieldClass =
    "mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#8b5cf6] focus:ring-2 focus:ring-purple-100";
  const labelClass = "block text-xs font-semibold text-slate-600";
  const input = (
    name: string,
    label: string,
    options: {
      type?: string;
      required?: boolean;
      placeholder?: string;
      wide?: boolean;
      choices?: string[];
    } = {},
  ) => {
    const val = valueFor(name);
    const field = options.choices ? (
      <select
        required={options.required}
        name={name}
        value={String(val)}
        onChange={(event) => updateField(name, event.target.value)}
        className={fieldClass}
      >
        <option value="">Select {label.toLowerCase()}</option>
        {options.choices.map((choice) => (
          <option key={choice}>{choice}</option>
        ))}
      </select>
    ) : options.type === "textarea" ? (
      <textarea
        required={options.required}
        name={name}
        value={String(val)}
        onChange={(event) => updateField(name, event.target.value)}
        rows={3}
        placeholder={options.placeholder}
        className={fieldClass}
      />
    ) : (
      <input
        required={options.required}
        name={name}
        type={options.type ?? "text"}
        min={options.type === "number" ? 0 : undefined}
        value={String(val)}
        onChange={(event) =>
          updateField(
            name,
            options.type === "number"
              ? Number(event.target.value)
              : event.target.value,
          )
        }
        placeholder={options.placeholder}
        className={fieldClass}
      />
    );
    return (
      <label
        key={name}
        className={`${labelClass} ${options.wide ? "sm:col-span-2" : ""}`}
      >
        {label}
        {options.required && <span className="ml-1 text-rose-600">*</span>}
        {field}
      </label>
    );
  };
  const checkbox = (name: string, label: string) => (
    <label
      key={name}
      className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-medium text-slate-700"
    >
      <input
        type="checkbox"
        checked={Boolean(valueFor(name))}
        onChange={(event) => updateField(name, event.target.checked)}
        className="size-4 accent-[#6d28d9]"
      />
      {label}
    </label>
  );
  const validateStep = () => {
    if (
      step === 0 &&
      !keepLegacyName &&
      (!values.firstName?.trim() ||
        !values.secondName?.trim() ||
        !values.dateOfBirth ||
        !values.gender)
    )
      return "Enter first name, second name, date of birth, and gender to continue.";
    if (
      step === 1 &&
      values.maritalStatus === "Married" &&
      (!values.spouseName?.trim() || !values.spousePhone?.trim())
    )
      return "Enter the spouse's name and phone number to continue.";
    if (
      step === 3 &&
      (!values.nextOfKinName?.trim() ||
        !values.nextOfKinRelationship?.trim() ||
        !values.nextOfKinPhone?.trim())
    )
      return "Enter the next-of-kin name, relationship, and phone number to continue.";
    if (
      step === 4 &&
      (!values.category ||
        !values.department ||
        !values.role ||
        !values.salary ||
        !values.paymentFrequency ||
        (!employee && !values.compensationType))
    )
      return "Complete category, department, role, pay type, salary/wage, and payment frequency.";
    return "";
  };
  const persistDraft = async () => {
    const id = draft?.id ?? createId("EDRAFT");
    const {
      id: _employeeId,
      number: _employeeNumber,
      image: _image,
      photoUrl: _photoUrl,
      documents: _documents,
      ...draftEmployee
    } = values;
    const nextDraft: EmployeeDraft = {
      id,
      employee: draftEmployee,
      currentStep: step,
      updatedAt: new Date().toISOString(),
    };
    setSaving(true);
    try {
      const result = await saveEmployeeDraft(nextDraft);
      const savedDraft = result.draft;
      updateState({
        ...state,
        employeeDrafts: [
          { ...savedDraft, employee: savedDraft.employee as Partial<Employee> },
          ...state.employeeDrafts.filter((item) => item.id !== id),
        ],
      });
      onDraftSaved(savedDraft as EmployeeDraft);
      onClose();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Could not save this employee draft.",
      );
    } finally {
      setSaving(false);
    }
  };
  const finish = async () => {
    const validation = validateStep();
    if (validation) {
      setError(validation);
      return;
    }
    const name = employeeDisplayName(values);
    const effectiveEmployee = createdEmployee ?? employee;
    const completed: Partial<Employee> = {
      ...(effectiveEmployee ?? {}),
      ...values,
      name,
      firstName: values.firstName?.trim(),
      secondName: values.secondName?.trim(),
      otherNames: values.otherNames?.trim() || undefined,
      category: (values.category || "Staff employee") as Employee["category"],
      department: values.department || "",
      role: values.role || "",
      status: values.status ?? "Active",
      salary: Number(values.salary) || 0,
      compensationType: values.compensationType as Employee["compensationType"],
      paymentFrequency: values.paymentFrequency as Employee["paymentFrequency"],
      nssfApplies: Boolean(values.nssfApplies),
      taxApplies: Boolean(values.taxApplies),
      documents: effectiveEmployee?.documents ?? [],
      mother: values.mother ?? { name: "", phone: "", address: "", status: "" },
      father: values.father ?? { name: "", phone: "", address: "", status: "" },
    };
    const {
      id: _id,
      number: _number,
      documents: _documents,
      image: _image,
      photoUrl: _photoUrl,
      ...profile
    } = completed;
    setSaving(true);
    let persistedEmployee = effectiveEmployee;
    try {
      let savedEmployee = effectiveEmployee
        ? await updateEmployeeApi(effectiveEmployee.id, profile)
        : await createEmployeeApi({
            ...profile,
            name,
            category: completed.category ?? "Staff employee",
            department: completed.department ?? "",
            role: completed.role ?? "",
            status: completed.status ?? "Active",
            salary: Number(completed.salary) || 0,
          });
      persistedEmployee = savedEmployee;
      if (!effectiveEmployee) setCreatedEmployee(savedEmployee);
      if (photoFile) {
        const result = await uploadEmployeeImage(savedEmployee.id, photoFile);
        savedEmployee = {
          ...savedEmployee,
          image: result.image,
          photoUrl: result.image.url,
        };
        persistedEmployee = savedEmployee;
        setPhotoFile(null);
      }
      for (const [title, file] of Object.entries(documentFiles)) {
        if (!file) continue;
        const result = await uploadEmployeeDocument(
          savedEmployee.id,
          title,
          file,
        );
        savedEmployee = {
          ...savedEmployee,
          documents: [...(savedEmployee.documents ?? []), result.document],
        };
        persistedEmployee = savedEmployee;
        setDocumentFiles((current) => ({ ...current, [title]: null }));
      }
      updateState({
        ...state,
        employees: effectiveEmployee
          ? state.employees.map((item) =>
              item.id === savedEmployee.id ? savedEmployee : item,
            )
          : [savedEmployee, ...state.employees],
        employeeDrafts: state.employeeDrafts.filter(
          (item) => item.id !== draft?.id,
        ),
      });
      onEmployeeSaved(savedEmployee);
      onClose();
    } catch (cause) {
      if (persistedEmployee) {
        setCreatedEmployee(persistedEmployee);
        updateState({
          ...state,
          employees: [
            persistedEmployee,
            ...state.employees.filter(
              (item) => item.id !== persistedEmployee?.id,
            ),
          ],
        });
        onEmployeeSaved(persistedEmployee);
      }
      setError(
        cause instanceof ApiError
          ? cause.message
          : "The employee profile could not be saved. Check the server connection and try again.",
      );
    } finally {
      setSaving(false);
    }
  };
  const nextStep = () => {
    const validation = validateStep();
    if (validation) {
      setError(validation);
      return;
    }
    setError("");
    setStep((current) => Math.min(employeeWizardSteps.length - 1, current + 1));
  };
  const closeWizard = () => {
    if (
      window.confirm(
        "Close this form? Unsaved changes will be lost unless you save a draft.",
      )
    )
      onClose();
  };
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step < employeeWizardSteps.length - 1) nextStep();
    else await finish();
  };

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/45 p-3 sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="employee-wizard-title"
        className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id="employee-wizard-title" className="text-base font-bold">
              {employee
                ? "Edit employee"
                : draft
                  ? "Resume employee draft"
                  : "Add employee"}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Step {step + 1} of {employeeWizardSteps.length} · Drafts stay
              separate from employee records
            </p>
          </div>
          <button
            type="button"
            aria-label="Close employee form"
            onClick={closeWizard}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="border-b border-slate-100 px-5 py-3">
          <div className="flex gap-2 overflow-x-auto">
            {employeeWizardSteps.map((label, index) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  if (index < step) {
                    setError("");
                    setStep(index);
                  }
                }}
                aria-current={step === index ? "step" : undefined}
                className={`shrink-0 rounded-md px-2.5 py-1.5 text-[10px] font-semibold ${step === index ? "bg-[#f1eafd] text-[#6d28d9]" : index < step ? "text-emerald-700 hover:bg-emerald-50" : "text-slate-400"}`}
              >
                {index + 1}. {label}
              </button>
            ))}
          </div>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-[#6d28d9] transition-all"
              style={{
                width: `${((step + 1) / employeeWizardSteps.length) * 100}%`,
              }}
            />
          </div>
        </div>
        <form
          onSubmit={handleSubmit}
          className="min-h-0 flex-1 overflow-y-auto p-5"
        >
          {step === 0 && (
            <div>
              <h3 className="mb-1 text-sm font-bold">Personal identity</h3>
              <p className="mb-4 text-xs text-slate-500">
                Enter the employee&apos;s legal names and basic details.
              </p>
              {keepLegacyName && (
                <div className="mb-4 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  Existing full name: <strong>{employee?.name}</strong>. It will
                  be preserved as saved; enter both structured names below only
                  when you can verify them.
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                {input("firstName", "First name", {
                  required: !keepLegacyName,
                })}
                {input("secondName", "Second name", {
                  required: !keepLegacyName,
                })}
                {input("otherNames", "Other names", { wide: true })}
                {input("dateOfBirth", "Date of birth", {
                  type: "date",
                  required: !keepLegacyName,
                })}
                {input("gender", "Gender", {
                  choices: ["Female", "Male", "Prefer not to say"],
                })}
                {input("phone", "Phone number", { type: "tel" })}
                {input("email", "Email address", { type: "email" })}
                <div className="sm:col-span-2">
                  <span className={labelClass}>Profile photo</span>
                  <div className="mt-2 flex items-center gap-4">
                    <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-[#e9ddff] text-lg font-bold text-[#6d28d9]">
                      {photoPreview ? (
                        <img
                          src={photoPreview}
                          alt="Selected employee preview"
                          className="size-full object-cover"
                        />
                      ) : (
                        initials(employeeDisplayName(values))
                      )}
                    </div>
                    <div>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        aria-label="Choose employee photo"
                        onChange={(event) =>
                          setPhotoFile(event.target.files?.[0] ?? null)
                        }
                        className="block max-w-full text-xs text-slate-500 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-700"
                      />
                      <p className="mt-1 text-[10px] text-slate-400">
                        PNG, JPEG, or WebP image; up to 5 MB.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {step === 1 && (
            <div>
              <h3 className="mb-1 text-sm font-bold">Family details</h3>
              <p className="mb-4 text-xs text-slate-500">
                Spouse information is only requested when marital status is
                Married.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {input("maritalStatus", "Marital status", {
                  choices: [
                    "Single",
                    "Married",
                    "Separated",
                    "Divorced",
                    "Widowed",
                  ],
                })}
                {values.maritalStatus === "Married" && (
                  <>
                    {input("spouseName", "Spouse name", { required: true })}
                    {input("spousePhone", "Spouse phone", {
                      required: true,
                      type: "tel",
                    })}
                  </>
                )}
                {input("childrenCount", "Number of children", {
                  type: "number",
                })}
                {[
                  ["mother.name", "Mother's name"],
                  ["mother.phone", "Mother's phone"],
                  ["mother.address", "Mother's current address"],
                  ["mother.status", "Mother's status"],
                  ["father.name", "Father's name"],
                  ["father.phone", "Father's phone"],
                  ["father.address", "Father's current address"],
                  ["father.status", "Father's status"],
                ].map(([name, label]) =>
                  name.endsWith("status")
                    ? input(name, label, { choices: ["Alive", "Deceased"] })
                    : input(name, label, {
                        type: name.endsWith("phone") ? "tel" : undefined,
                        wide: name.endsWith("address"),
                      }),
                )}
              </div>
            </div>
          )}
          {step === 2 && (
            <div>
              <h3 className="mb-1 text-sm font-bold">Education & profession</h3>
              <p className="mb-4 text-xs text-slate-500">
                Capture the employee&apos;s highest completed education and
                profession.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {input("educationLevel", "Level of education", {
                  choices: [
                    "Primary",
                    "Secondary",
                    "Certificate",
                    "Diploma",
                    "Bachelor's degree",
                    "Postgraduate",
                    "Other",
                  ],
                })}
                {input("profession", "Profession", {
                  placeholder: "e.g. Accountant, Driver, Engineer",
                })}
              </div>
            </div>
          )}
          {step === 3 && (
            <div>
              <h3 className="mb-1 text-sm font-bold">
                Addresses & next of kin
              </h3>
              <p className="mb-4 text-xs text-slate-500">
                Add the employee&apos;s current location, origin, and emergency
                contact.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {input("currentAddress", "Current address", {
                  type: "textarea",
                  wide: true,
                })}
                {input("placeOfOrigin", "Place of origin", {
                  type: "textarea",
                  wide: true,
                })}
                {input("nextOfKinName", "Next of kin name", { required: true })}
                {input("nextOfKinRelationship", "Relationship", {
                  required: true,
                })}
                {input("nextOfKinPhone", "Next of kin phone", {
                  required: true,
                  type: "tel",
                })}
                {input("nextOfKinAddress", "Next of kin current address", {
                  type: "textarea",
                  wide: true,
                })}
              </div>
            </div>
          )}
          {step === 4 && (
            <div>
              <h3 className="mb-1 text-sm font-bold">Department & payroll</h3>
              <p className="mb-4 text-xs text-slate-500">
                Category, pay type, and pay frequency are separate. Payroll
                deductions are not calculated in this form.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {input("category", "Employee category", {
                  choices: ["Staff employee", "Casual worker", "Other"],
                })}
                {input("department", "Department", {
                  choices: [
                    ...new Set(
                      [
                        ...employeeDepartments,
                        ...state.employees.map((item) => item.department),
                        values.department,
                      ].filter((item): item is string => Boolean(item)),
                    ),
                  ],
                })}
                {input("role", "Primary role", {
                  choices: [
                    ...new Set(
                      [
                        ...employeeRoles,
                        ...state.employees.map((item) => item.role),
                        values.role,
                      ].filter((item): item is string => Boolean(item)),
                    ),
                  ],
                })}
                {input("compensationType", "Pay type", {
                  choices: ["Salary earner", "Wage earner"],
                })}
                {input("salary", "Salary / wage (UGX)", {
                  type: "number",
                  required: true,
                })}
                {input("paymentFrequency", "Payment frequency", {
                  choices: ["Monthly", "Weekly"],
                })}
                {input("status", "Employment status", {
                  choices: ["Active", "Inactive"],
                })}
                {input("nssfNumber", "NSSF account number")}
                {input("tinNumber", "TIN number")}
                {checkbox("nssfApplies", "NSSF deduction applies")}
                {checkbox("taxApplies", "Tax deduction applies")}
              </div>
            </div>
          )}
          {step === 5 && (
            <div>
              <h3 className="mb-1 text-sm font-bold">Documents & review</h3>
              <p className="mb-4 text-xs text-slate-500">
                Upload PDF files to secure employee storage. Maximum file size
                is 10 MB per document.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {["CV", "LC letter", "Cover letter", "Police letter", "ID"].map(
                  (title) => (
                    <label
                      key={title}
                      className={`${labelClass} rounded-lg border border-slate-200 p-3`}
                    >
                      {title}
                      <input
                        type="file"
                        aria-label={`Select ${title}`}
                        onChange={(event) =>
                          (() => {
                            const file = event.target.files?.[0] ?? null;
                            setDocumentFiles((current) => ({
                              ...current,
                              [title]: file,
                            }));
                            setDocumentNames((current) => ({
                              ...current,
                              [title]: file ? [file.name] : [],
                            }));
                          })()
                        }
                        className="mt-2 block w-full text-[11px] text-slate-500 file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-2.5 file:py-1.5 file:text-[10px] file:font-semibold"
                      />
                      {documentNames[title]?.map((name) => (
                        <span
                          key={name}
                          className="mt-2 block truncate text-[10px] font-normal text-emerald-700"
                        >
                          Selected: {name} · uploads on save
                        </span>
                      ))}
                    </label>
                  ),
                )}
              </div>
              <div className="mt-5 rounded-lg bg-slate-50 p-4">
                <h4 className="text-xs font-bold">Review employee</h4>
                <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                  <ReviewValue
                    label="Name"
                    value={employeeDisplayName(values)}
                  />
                  <ReviewValue
                    label="Date of birth"
                    value={values.dateOfBirth}
                  />
                  <ReviewValue label="Category" value={values.category} />
                  <ReviewValue
                    label="Department / role"
                    value={`${values.department || "Not set"} · ${values.role || "Not set"}`}
                  />
                  <ReviewValue
                    label="Pay"
                    value={`${money(Number(values.salary) || 0)} · ${values.paymentFrequency || "Frequency not set"}`}
                  />
                  <ReviewValue
                    label="NSSF / tax"
                    value={`${values.nssfApplies ? "NSSF applies" : "No NSSF"} · ${values.taxApplies ? "Tax applies" : "No tax"}`}
                  />
                </dl>
              </div>
            </div>
          )}
          {error && (
            <p
              role="alert"
              className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700"
            >
              {error}
            </p>
          )}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={closeWizard}
              className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50"
            >
              Cancel
            </button>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={persistDraft}
                disabled={saving}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Save draft
              </button>
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setStep((current) => Math.max(0, current - 1));
                  }}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Previous
                </button>
              )}
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[#6d28d9] px-4 py-2 text-xs font-semibold text-white hover:bg-[#5b21b6]"
              >
                {saving
                  ? "Saving…"
                  : step === employeeWizardSteps.length - 1
                    ? (createdEmployee ?? employee)
                      ? "Save changes"
                      : "Complete employee"
                    : "Continue"}
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}

function ReviewValue({
  label,
  value,
}: {
  label: string;
  value?: string | number;
}) {
  return (
    <div>
      <dt className="text-[10px] text-slate-400">{label}</dt>
      <dd className="mt-1 font-semibold text-slate-700">
        {value || "Not provided"}
      </dd>
    </div>
  );
}

type EmployeeProfileTab =
  | "overview"
  | "personal"
  | "employment"
  | "documents"
  | "attendance"
  | "payroll"
  | "advances"
  | "leave"
  | "punishment";

function EmployeeProfile({
  employee,
  state,
  updateState,
  canManage,
  canReadAdvances,
  canReadDisciplinary,
  onEmployeeUpdated,
  onBack,
  onViewPayrollRun,
  onViewAdvance,
}: {
  employee: Employee;
  state: ErpState;
  updateState: (next: ErpState) => void;
  canManage: boolean;
  canReadAdvances: boolean;
  canReadDisciplinary: boolean;
  onEmployeeUpdated: (employee: Employee) => void;
  onBack: () => void;
  onViewPayrollRun: (id: string) => void;
  onViewAdvance: (id: string) => void;
}) {
  const leaveQuery = useLeaveRequests();
  const disciplinaryIndicatorsQuery =
    useDisciplinaryIndicators(canReadDisciplinary);
  const [activeTab, setActiveTab] = useState<EmployeeProfileTab>("overview");
  const [showEdit, setShowEdit] = useState(false);
  const [selectedAttendanceRecord, setSelectedAttendanceRecord] =
    useState<AttendanceRecord | null>(null);
  const [attendanceView, setAttendanceView] = useState<"calendar" | "list">(
    "calendar",
  );
  const [attendanceMonth, setAttendanceMonth] = useState(() =>
    companyWorkDate().slice(0, 7),
  );
  const employeeAttendanceQuery = useAttendanceMonth(
    attendanceMonth,
    employee.id,
    activeTab === "attendance",
  );
  const employeeSalaryAdvancesQuery = useSalaryAdvances(
    employee.id,
    activeTab === "advances" && canReadAdvances,
  );
  const employeeDisciplinaryCasesQuery = useDisciplinaryCases(
    activeTab === "punishment" && canReadDisciplinary,
  );
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [imageError, setImageError] = useState("");
  const [documentError, setDocumentError] = useState("");
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentBusy, setDocumentBusy] = useState(false);
  const previewUrl = useMemo(
    () => (photoFile ? URL.createObjectURL(photoFile) : null),
    [photoFile],
  );
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );
  const allTabs: { id: EmployeeProfileTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "personal", label: "Personal & family" },
    { id: "employment", label: "Employment & education" },
    { id: "documents", label: "Documents" },
    { id: "attendance", label: "Attendance" },
    { id: "payroll", label: "Payroll history" },
    { id: "advances", label: "Salary advances" },
    { id: "leave", label: "Leave history" },
    { id: "punishment", label: "Punishment history" },
  ];
  const tabs = canManage
    ? allTabs.filter((tab) => tab.id !== "punishment" || canReadDisciplinary)
    : canReadDisciplinary
      ? allTabs.filter((tab) => ["overview", "punishment"].includes(tab.id))
      : allTabs.filter((tab) => tab.id === "overview");
  const displayName = employeeDisplayName(employee);
  const saveProfileImage = async (file: File) => {
    setImageError("");
    setPhotoFile(file);
    try {
      const { image } = await uploadEmployeeImage(employee.id, file);
      onEmployeeUpdated({ ...employee, image, photoUrl: image.url });
      setPhotoFile(null);
    } catch (error) {
      setImageError(
        error instanceof ApiError
          ? error.message
          : "Could not upload the employee image.",
      );
    }
  };
  const deleteProfileImage = async () => {
    setImageError("");
    try {
      const { image } = await removeEmployeeImage(employee.id);
      onEmployeeUpdated({ ...employee, image, photoUrl: "" });
    } catch (error) {
      setImageError(
        error instanceof ApiError
          ? error.message
          : "Could not remove the employee image.",
      );
    }
  };
  const addDocument = async () => {
    if (!documentFile || !documentTitle.trim()) {
      setDocumentError("Choose a PDF and enter a document title.");
      return;
    }
    setDocumentBusy(true);
    setDocumentError("");
    try {
      const { document } = await uploadEmployeeDocument(
        employee.id,
        documentTitle.trim(),
        documentFile,
      );
      onEmployeeUpdated({
        ...employee,
        documents: [...(employee.documents ?? []), document],
      });
      setDocumentFile(null);
      setDocumentTitle("");
    } catch (error) {
      setDocumentError(
        error instanceof ApiError
          ? error.message
          : "Could not upload the document.",
      );
    } finally {
      setDocumentBusy(false);
    }
  };
  const deleteDocument = async (documentId?: string) => {
    if (!documentId) return;
    setDocumentError("");
    try {
      await removeEmployeeDocument(employee.id, documentId);
      onEmployeeUpdated({
        ...employee,
        documents: (employee.documents ?? []).filter(
          (item) => item.id !== documentId,
        ),
      });
    } catch (error) {
      setDocumentError(
        error instanceof ApiError
          ? error.message
          : "Could not remove the document.",
      );
    }
  };
  const downloadDocument = async (documentId?: string) => {
    if (!documentId) return;
    setDocumentError("");
    try {
      const { url } = await getEmployeeDocumentDownload(
        employee.id,
        documentId,
      );
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.click();
    } catch (error) {
      setDocumentError(
        error instanceof ApiError
          ? error.message
          : "Could not generate a secure document link.",
      );
    }
  };
  const deactivateProfile = async () => {
    if (
      !window.confirm(
        `Deactivate ${displayName}? The employee record and history will be retained.`,
      )
    )
      return;
    try {
      const updated = await deactivateEmployeeApi(employee.id);
      onEmployeeUpdated(updated);
    } catch (error) {
      setImageError(
        error instanceof ApiError
          ? error.message
          : "Could not deactivate this employee.",
      );
    }
  };
  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const buttons = Array.from(
      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
        "[role=tab]",
      ) ?? [],
    );
    const index = buttons.indexOf(event.currentTarget);
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : buttons.length - 1)) %
            buttons.length;
    buttons[nextIndex]?.focus();
    buttons[nextIndex]?.click();
  };
  const field = (label: string, value?: string | number | boolean) => (
    <div key={label}>
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className="mt-1 break-words text-sm font-semibold text-slate-800">
        {value === undefined || value === "" ? "Not provided" : String(value)}
      </div>
    </div>
  );
  const emptyHistory = (title: string) => (
    <section className="rounded-xl border border-slate-200 bg-white px-5 py-12 text-center">
      <div className="mx-auto grid size-11 place-items-center rounded-full bg-slate-100 text-slate-500">
        <Icons.CalendarClock className="size-5" />
      </div>
      <h3 className="mt-3 text-sm font-bold">No {title.toLowerCase()} yet</h3>
      <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
        {title} records will appear here when the related HR workflow is
        connected.
      </p>
    </section>
  );
  const employeeAttendance = [
    ...(employeeAttendanceQuery.data?.records ?? []),
  ].sort((left, right) => right.workDate.localeCompare(left.workDate));
  const attendanceMonthStart = new Date(`${attendanceMonth}-01T12:00:00+03:00`);
  const attendanceMonthDays = new Date(
    Date.UTC(
      attendanceMonthStart.getUTCFullYear(),
      attendanceMonthStart.getUTCMonth() + 1,
      0,
    ),
  ).getUTCDate();
  const firstWeekday = (attendanceMonthStart.getUTCDay() + 6) % 7;
  const attendanceCalendarCells: Array<string | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from(
      { length: attendanceMonthDays },
      (_, index) => `${attendanceMonth}-${String(index + 1).padStart(2, "0")}`,
    ),
  ];
  while (attendanceCalendarCells.length % 7 !== 0)
    attendanceCalendarCells.push(null);
  const attendanceWeekday = (date: string) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Kampala",
      weekday: "short",
    }).format(new Date(`${date}T12:00:00+03:00`));
  const attendanceSummary = {
    present: employeeAttendance.filter((record) => record.status === "Present")
      .length,
    fullDays: employeeAttendance.filter(
      (record) => record.status === "Present" && !record.halfDay,
    ).length,
    halfDays: employeeAttendance.filter(
      (record) => record.status === "Present" && record.halfDay,
    ).length,
    late: employeeAttendance.filter(
      (record) => record.status === "Present" && record.late,
    ).length,
    absent: employeeAttendance.filter((record) => record.status === "Absent")
      .length,
    leave: employeeAttendance.filter((record) => record.status === "On leave")
      .length,
  };
  const changeAttendanceMonth = (offset: number) => {
    const [year, month] = attendanceMonth.split("-").map(Number);
    const next = new Date(Date.UTC(year, month - 1 + offset, 1));
    setAttendanceMonth(
      `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`,
    );
  };
  const attendanceMonthLabel = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Kampala",
    month: "long",
    year: "numeric",
  }).format(attendanceMonthStart);
  const attendanceRecordForDay = (date: string) =>
    employeeAttendance.find((record) => record.workDate === date);
  const attendanceDayLabel = (date: string, record?: AttendanceRecord) => {
    const dateLabel = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Kampala",
      dateStyle: "full",
    }).format(new Date(`${date}T12:00:00+03:00`));
    if (!record) return `${dateLabel}: no attendance record`;
    const details =
      record.status === "Present"
        ? `${record.halfDay ? "half day" : "full day"}${record.late ? ", late" : ""}`
        : "";
    return `${dateLabel}: ${record.status}${details ? `, ${details}` : ""}`;
  };
  const openAttendanceRecord = (record: AttendanceRecord) =>
    setSelectedAttendanceRecord(record);
  const tabContent = () => {
    if (activeTab === "overview")
      return (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-bold">Employee summary</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {field("Employee number", employee.number)}
              {field("Category", employee.category)}
              {field("Department", employee.department)}
              {field("Primary role", employee.role)}
              {field("Employment status", employee.status)}
              {canManage &&
                field("Payment frequency", employee.paymentFrequency)}
            </div>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-bold">Personal summary</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {field("Date of birth", employee.dateOfBirth)}
              {field("Gender", employee.gender)}
              {field("Phone", employee.phone)}
              {field("Email", employee.email)}
              {field("Current address", employee.currentAddress)}
            </div>
          </section>
          {canManage && (
            <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
              <h3 className="text-sm font-bold">Record completion</h3>
              <p className="mt-1 text-xs text-slate-500">
                Profile image and document files are stored in the employee
                profile.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  [
                    "Personal details",
                    Boolean(employee.firstName && employee.secondName),
                  ],
                  [
                    "Employment details",
                    Boolean(employee.department && employee.role),
                  ],
                  ["NSSF number", Boolean(employee.nssfNumber)],
                  ["TIN", Boolean(employee.tinNumber)],
                  ["Documents", Boolean(employee.documents?.length)],
                ].map(([label, complete]) => (
                  <span
                    key={String(label)}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[10px] font-semibold ${complete ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${complete ? "bg-emerald-500" : "bg-slate-400"}`}
                    />
                    {label}: {complete ? "Complete" : "Not added"}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
      );
    if (activeTab === "personal")
      return (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-bold">Personal details</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {field("First name", employee.firstName)}
              {field("Second name", employee.secondName)}
              {field("Other names", employee.otherNames)}
              {field("Date of birth", employee.dateOfBirth)}
              {field("Gender", employee.gender)}
              {field("Marital status", employee.maritalStatus)}
              {field("Number of children", employee.childrenCount)}
            </div>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-bold">Spouse</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {field(
                "Name",
                employee.maritalStatus === "Married"
                  ? employee.spouseName
                  : "Not applicable",
              )}
              {field(
                "Phone",
                employee.maritalStatus === "Married"
                  ? employee.spousePhone
                  : "Not applicable",
              )}
            </div>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-bold">Next of kin</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {field("Name", employee.nextOfKinName)}
              {field("Relationship", employee.nextOfKinRelationship)}
              {field("Phone", employee.nextOfKinPhone)}
              {field("Current address", employee.nextOfKinAddress)}
            </div>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-bold">Parents</h3>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              {(["mother", "father"] as const).map((parent) => (
                <div key={parent}>
                  <h4 className="text-xs font-semibold capitalize text-slate-700">
                    {parent}
                  </h4>
                  <div className="mt-3 grid gap-3">
                    {field("Name", employee[parent]?.name)}
                    {field("Phone", employee[parent]?.phone)}
                    {field("Current address", employee[parent]?.address)}
                    {field("Status", employee[parent]?.status)}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      );
    if (activeTab === "employment")
      return (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-bold">Employment</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {field("Employee number", employee.number)}
              {field("Category", employee.category)}
              {field("Department", employee.department)}
              {field("Role", employee.role)}
              {field("Status", employee.status)}
            </div>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-bold">Payroll setup</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {field("Pay type", employee.compensationType)}
              {field("Salary / wage", money(employee.salary))}
              {field("Frequency", employee.paymentFrequency)}
              {field("NSSF account number", employee.nssfNumber)}
              {field("TIN number", employee.tinNumber)}
              {field(
                "NSSF deduction",
                employee.nssfApplies ? "Applies" : "Does not apply",
              )}
              {field(
                "Tax deduction",
                employee.taxApplies ? "Applies" : "Does not apply",
              )}
            </div>
            <p className="mt-4 text-[10px] text-slate-400">
              This profile does not calculate statutory deductions.
            </p>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-bold">Education & profession</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {field("Education level", employee.educationLevel)}
              {field("Profession", employee.profession)}
            </div>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-bold">Addresses</h3>
            <div className="mt-4 grid gap-4">
              {field("Current address", employee.currentAddress)}
              {field("Place of origin", employee.placeOfOrigin)}
            </div>
          </section>
        </div>
      );
    if (activeTab === "documents")
      return (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-sm font-bold">Employee documents</h3>
            <p className="mt-1 text-xs text-slate-500">
              PDFs are uploaded to protected employee document storage.
            </p>
          </div>
          {canManage && (
            <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-[1fr_1fr_auto]">
              <label className="text-xs font-semibold text-slate-600">
                Document title
                <input
                  value={documentTitle}
                  onChange={(event) => setDocumentTitle(event.target.value)}
                  maxLength={80}
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-xs font-normal"
                  placeholder="e.g. CV, National ID"
                />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                PDF document
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(event) =>
                    setDocumentFile(event.target.files?.[0] ?? null)
                  }
                  className="mt-2 block w-full text-xs font-normal"
                />
              </label>
              <button
                type="button"
                disabled={documentBusy}
                onClick={addDocument}
                className="self-end rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
              >
                {documentBusy ? "Uploading…" : "Upload PDF"}
              </button>
            </div>
          )}
          {documentError && (
            <p
              role="alert"
              className="mx-4 mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700"
            >
              {documentError}
            </p>
          )}
          {employee.documents?.length ? (
            <div className="divide-y divide-slate-100">
              {employee.documents.map((document, index) => (
                <div
                  key={`${document.publicId}-${index}`}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Icons.FileText className="size-4 shrink-0 text-slate-400" />
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold">
                        {document.title}
                      </div>
                      <div className="truncate text-[10px] text-slate-400">
                        {document.fileName || "PDF document"}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => downloadDocument(document.id)}
                      className="rounded-md border border-slate-200 px-2.5 py-1.5 text-[10px] font-semibold text-slate-700"
                    >
                      Open / download
                    </button>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => deleteDocument(document.id)}
                        className="rounded-md border border-rose-100 px-2.5 py-1.5 text-[10px] font-semibold text-rose-700"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-5 py-12 text-center text-xs text-slate-400">
              No employee documents have been uploaded.
            </p>
          )}
        </section>
      );
    if (activeTab === "attendance")
      return (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-bold">Attendance</h3>
              <p className="mt-1 text-xs text-slate-500">
                {attendanceMonthLabel} · {employeeAttendance.length} recorded
                day{employeeAttendance.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div
                className="inline-flex rounded-lg border border-slate-200 p-0.5"
                role="group"
                aria-label="Attendance view"
              >
                <button
                  type="button"
                  aria-pressed={attendanceView === "calendar"}
                  onClick={() => setAttendanceView("calendar")}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${attendanceView === "calendar" ? "bg-slate-100 text-slate-900" : "text-slate-500"}`}
                >
                  <Icons.CalendarDays className="mr-1.5 inline size-3.5" />
                  Calendar
                </button>
                <button
                  type="button"
                  aria-pressed={attendanceView === "list"}
                  onClick={() => setAttendanceView("list")}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${attendanceView === "list" ? "bg-slate-100 text-slate-900" : "text-slate-500"}`}
                >
                  <Icons.List className="mr-1.5 inline size-3.5" />
                  List
                </button>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() => changeAttendanceMonth(-1)}
                  className="grid size-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() => changeAttendanceMonth(1)}
                  className="grid size-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          </div>
          {employeeAttendanceQuery.isLoading ? (
            <p
              role="status"
              className="px-5 py-12 text-center text-xs text-slate-400"
            >
              Loading employee attendance…
            </p>
          ) : employeeAttendanceQuery.isError ? (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-center gap-3 px-5 py-12 text-xs text-rose-700"
            >
              <span>
                {employeeAttendanceQuery.error instanceof ApiError
                  ? employeeAttendanceQuery.error.message
                  : "Could not load employee attendance."}
              </span>
              <button
                type="button"
                onClick={() => void employeeAttendanceQuery.refetch()}
                className="font-semibold underline"
              >
                Try again
              </button>
            </div>
          ) : attendanceView === "calendar" ? (
            <div className="p-4">
              <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                {[
                  [
                    "Recorded days",
                    employeeAttendance.length,
                    "text-slate-800",
                  ],
                  ["Full days", attendanceSummary.fullDays, "text-emerald-700"],
                  ["Half-days", attendanceSummary.halfDays, "text-orange-700"],
                  ["Late", attendanceSummary.late, "text-blue-700"],
                  ["Absent", attendanceSummary.absent, "text-rose-700"],
                  ["Leave", attendanceSummary.leave, "text-sky-700"],
                ].map(([label, value, color]) => (
                  <div
                    key={String(label)}
                    className="rounded-lg bg-slate-50 px-3 py-2"
                  >
                    <div className="text-[10px] text-slate-400">{label}</div>
                    <div className={`mt-0.5 text-sm font-bold ${color}`}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2 text-[10px] text-slate-500">
                <span className="flex items-center gap-1.5">
                  <i className="size-2 rounded-sm bg-emerald-500" />
                  Present
                </span>
                <span className="flex items-center gap-1.5">
                  <i className="size-2 rounded-sm bg-orange-400" />
                  Half-day
                </span>
                <span className="flex items-center gap-1.5">
                  <i className="size-2 rounded-sm bg-rose-500" />
                  Absent
                </span>
                <span className="flex items-center gap-1.5">
                  <i className="size-2 rounded-sm bg-sky-500" />
                  On leave
                </span>
                <span className="flex items-center gap-1.5">
                  <i className="grid size-3 place-items-center rounded-full bg-blue-600 text-[8px] font-bold not-italic text-white">
                    L
                  </i>
                  Late
                </span>
              </div>
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                  (day) => (
                    <div
                      key={day}
                      className="py-1 text-center text-[10px] font-semibold uppercase text-slate-400"
                    >
                      {day}
                    </div>
                  ),
                )}
                {attendanceCalendarCells.map((date, index) => {
                  if (!date)
                    return (
                      <div
                        key={`pad-${attendanceMonth}-${index}`}
                        aria-hidden="true"
                        className="aspect-square min-h-10 rounded-lg bg-transparent sm:min-h-14"
                      />
                    );
                  const record = attendanceRecordForDay(date);
                  const isWeekend = ["Sat", "Sun"].includes(
                    attendanceWeekday(date),
                  );
                  const background = !record
                    ? isWeekend
                      ? "bg-slate-50 text-slate-300"
                      : "bg-white text-slate-400"
                    : record.status === "Absent"
                      ? "bg-rose-500 text-white"
                      : record.status === "On leave"
                        ? "bg-sky-500 text-white"
                        : record.status === "Present" && record.halfDay
                          ? "bg-orange-400 text-white"
                          : record.status === "Present"
                            ? "bg-emerald-500 text-white"
                            : "bg-white text-slate-300";
                  const marker = !record
                    ? ""
                    : record.status === "Absent"
                      ? "A"
                      : record.status === "On leave"
                        ? "L"
                        : record.status === "Present" && record.halfDay
                          ? "½"
                          : record.status === "Present"
                            ? "P"
                            : "";
                  return (
                    <button
                      key={date}
                      type="button"
                      aria-label={attendanceDayLabel(date, record)}
                      title={attendanceDayLabel(date, record)}
                      onClick={() => record && openAttendanceRecord(record)}
                      disabled={!record}
                      className={`relative flex aspect-square min-h-10 flex-col items-center justify-center rounded-lg border border-slate-100 text-xs font-semibold transition sm:min-h-14 ${background} ${record ? "cursor-pointer hover:ring-2 hover:ring-slate-300" : "cursor-default"}`}
                    >
                      <span className="text-[10px] opacity-75">
                        {Number(date.slice(-2))}
                      </span>
                      <span className="text-sm">{marker}</span>
                      {record?.status === "Present" && record.late && (
                        <span
                          aria-hidden="true"
                          className="absolute right-1 top-1 grid size-3 place-items-center rounded-full bg-blue-600 text-[7px] font-bold leading-none text-white"
                        >
                          L
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {!employeeAttendance.length && (
                <p className="mt-4 text-center text-xs text-slate-400">
                  No attendance records for this month. Unrecorded days remain
                  blank.
                </p>
              )}
            </div>
          ) : (
            <div>
              {employeeAttendance.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px] text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] uppercase text-slate-400">
                      <tr>
                        {[
                          "Work date",
                          "Status",
                          "Day",
                          "Late",
                          "Notes",
                          "Last updated",
                        ].map((label) => (
                          <th key={label} className="px-4 py-3">
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {employeeAttendance.map((record) => (
                        <tr
                          key={record.id}
                          className="border-t border-slate-100 text-slate-600 hover:bg-slate-50/70"
                        >
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => openAttendanceRecord(record)}
                              aria-label={`View attendance record for ${formatDate(record.workDate)}`}
                              className="font-semibold text-[#6d28d9] hover:underline"
                            >
                              {formatDate(record.workDate)}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <Status
                              text={
                                record.status === "Present" && record.halfDay
                                  ? "Half-day"
                                  : record.status
                              }
                            />
                          </td>
                          <td className="px-4 py-3">
                            {record.status === "Present"
                              ? record.halfDay
                                ? "Half day"
                                : "Full day"
                              : "—"}
                          </td>
                          <td className="px-4 py-3">
                            {record.status === "Present" && record.late
                              ? "Yes"
                              : "—"}
                          </td>
                          <td className="px-4 py-3">{record.note || "—"}</td>
                          <td className="px-4 py-3 text-slate-400">
                            {new Date(record.updatedAt).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="px-5 py-12 text-center text-xs text-slate-400">
                  No attendance records for this month.
                </p>
              )}
            </div>
          )}
        </section>
      );
    if (activeTab === "payroll") {
      const payslips = state.payrollRuns
        .flatMap((run) =>
          run.payslips
            .filter((slip) => slip.employeeId === employee.id)
            .map((slip) => ({ run, slip })),
        )
        .sort((left, right) =>
          right.run.periodStart.localeCompare(left.run.periodStart),
        );
      return (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-sm font-bold">Payroll history</h3>
            <p className="mt-1 text-xs text-slate-500">
              Saved payslip snapshots · amounts are shown only when recorded in
              a run.
            </p>
          </div>
          {payslips.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-190 text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase text-slate-400">
                  <tr>
                    {[
                      "Payroll run",
                      "Frequency",
                      "Period",
                      "Pay setup",
                      "Gross",
                      "Deductions",
                      "Net",
                      "Run status",
                    ].map((label) => (
                      <th key={label} className="px-4 py-3">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payslips.map(({ run, slip }) => (
                    <tr
                      key={slip.id}
                      className="border-t border-slate-100 text-slate-600"
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => onViewPayrollRun(run.id)}
                          className="font-semibold text-[#6d28d9] hover:underline"
                        >
                          {run.reference}
                        </button>
                        <span className="mt-1 block text-[10px] text-slate-400">
                          {slip.employeeNumber} snapshot
                        </span>
                      </td>
                      <td className="px-4 py-3">{slip.paymentFrequency}</td>
                      <td className="px-4 py-3">
                        {formatDate(run.periodStart)} –{" "}
                        {formatDate(run.periodEnd)}
                      </td>
                      <td className="px-4 py-3">
                        {slip.compensationType ?? "Needs setup"}
                        <span className="mt-1 block text-[10px] text-slate-400">
                          Rate{" "}
                          {slip.configuredRate
                            ? money(slip.configuredRate)
                            : "not set"}{" "}
                          · {slip.attendanceUnits ?? 0} attendance units
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {slip.grossPay === undefined
                          ? "Not calculated"
                          : money(slip.grossPay)}
                      </td>
                      <td className="px-4 py-3">
                        {slip.deductionTotal === undefined
                          ? "Not calculated"
                          : money(slip.deductionTotal)}
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {slip.netPay === undefined
                          ? "Not calculated"
                          : money(slip.netPay)}
                      </td>
                      <td className="px-4 py-3">
                        {run.status} · {slip.paymentStatus}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            emptyHistory("Payroll history")
          )}
        </section>
      );
    }
    if (activeTab === "advances") {
      const employeeAdvances = (
        employeeSalaryAdvancesQuery.data?.advances ?? []
      ).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      const amountRepaid = (advance: ErpState["salaryAdvances"][number]) =>
        advance.repayments.reduce(
          (total, repayment) => total + repayment.amount,
          0,
        );
      const outstanding = (advance: ErpState["salaryAdvances"][number]) =>
        Math.max(
          0,
          (advance.disbursement?.amount ?? 0) - amountRepaid(advance),
        );
      return (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-sm font-bold">Salary advances</h3>
            <p className="mt-1 text-xs text-slate-500">
              Advance requests, disbursements, and recorded repayments linked to
              this employee.
            </p>
          </div>
          {!canReadAdvances ? (
            <p role="alert" className="p-5 text-sm text-rose-700">
              You do not have permission to view salary advances.
            </p>
          ) : employeeSalaryAdvancesQuery.isLoading ? (
            <p role="status" className="p-5 text-sm text-slate-500">
              Loading salary advances…
            </p>
          ) : employeeSalaryAdvancesQuery.isError ? (
            <div role="alert" className="p-5 text-sm text-rose-700">
              {employeeSalaryAdvancesQuery.error instanceof Error
                ? employeeSalaryAdvancesQuery.error.message
                : "Could not load salary advances."}
              <button
                type="button"
                onClick={() => employeeSalaryAdvancesQuery.refetch()}
                className="ml-2 font-semibold underline"
              >
                Try again
              </button>
            </div>
          ) : employeeAdvances.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-190 text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase text-slate-400">
                  <tr>
                    {[
                      "Advance",
                      "Requested",
                      "Disbursed",
                      "Repaid",
                      "Balance",
                      "Frequency",
                      "Status",
                    ].map((label) => (
                      <th key={label} className="px-4 py-3">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employeeAdvances.map((advance) => (
                    <tr
                      key={advance.id}
                      className="border-t border-slate-100 text-slate-600"
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => onViewAdvance(advance.id)}
                          className="font-semibold text-[#087e75] hover:underline"
                        >
                          {advance.reference}
                        </button>
                        <span className="mt-1 block text-[10px] text-slate-400">
                          {formatDate(advance.requestedAt.slice(0, 10))}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {money(advance.requestedAmount)}
                      </td>
                      <td className="px-4 py-3">
                        {advance.disbursement
                          ? money(advance.disbursement.amount)
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {money(amountRepaid(advance))}
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {advance.disbursement
                          ? money(outstanding(advance))
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {advance.approvedFrequency ?? advance.proposedFrequency}
                      </td>
                      <td className="px-4 py-3">{advance.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            emptyHistory("Salary advances")
          )}
        </section>
      );
    }
    if (activeTab === "leave") {
      const employeeLeave = (leaveQuery.data?.requests ?? [])
        .filter((request) => request.employeeId === employee.id)
        .sort((left, right) => right.startDate.localeCompare(left.startDate));
      return (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-sm font-bold">Leave history</h3>
            <p className="mt-1 text-xs text-slate-500">
              Submitted and reviewed leave requests linked to this employee.
            </p>
          </div>
          {employeeLeave.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase text-slate-400">
                  <tr>
                    {[
                      "Request",
                      "Leave type",
                      "Dates",
                      "Working days",
                      "Handover",
                      "Status",
                    ].map((label) => (
                      <th key={label} className="px-4 py-3">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employeeLeave.map((request) => (
                    <tr
                      key={request.id}
                      className="border-t border-slate-100 text-slate-600"
                    >
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        {request.reference}
                        <span className="mt-1 block text-[10px] font-normal text-slate-400">
                          Submitted{" "}
                          {formatDate(request.requestedAt.slice(0, 10))}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {request.leaveType === "Other"
                          ? request.otherLeaveType
                          : request.leaveType}
                      </td>
                      <td className="px-4 py-3">
                        {formatDate(request.startDate)} –{" "}
                        {formatDate(request.endDate)}
                      </td>
                      <td className="px-4 py-3">{request.requestedDays}</td>
                      <td className="px-4 py-3">{request.handoverName}</td>
                      <td className="px-4 py-3">{request.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            emptyHistory("Leave history")
          )}
        </section>
      );
    }
    if (activeTab === "punishment" && canReadDisciplinary) {
      const employeeCases = (employeeDisciplinaryCasesQuery.data?.cases ?? [])
        .filter((caseRecord) => caseRecord.employeeId === employee.id)
        .sort((left, right) => (right.createdAt || "").localeCompare(left.createdAt || ""));
      return (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-sm font-bold">Disciplinary history</h3>
            <p className="mt-1 text-xs text-slate-500">
              Confidential case outcomes visible only to authorized disciplinary readers.
            </p>
          </div>
          {employeeDisciplinaryCasesQuery.isError ? (
            <p role="alert" className="p-5 text-sm text-rose-700">
              Could not load disciplinary history.
            </p>
          ) : employeeDisciplinaryCasesQuery.isLoading ? (
            <p role="status" className="p-5 text-sm text-slate-500">
              Loading disciplinary history…
            </p>
          ) : employeeCases.length ? (
            <div className="divide-y divide-slate-100">
              {employeeCases.map((caseRecord) => (
                <article key={caseRecord.id} className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-xs text-slate-800">
                      {caseRecord.reference} · {caseRecord.type}
                    </strong>
                    <Status text={caseRecord.status} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Incident date: {caseRecord.incidentDate}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-700">
                    {caseRecord.allegation}
                  </p>
                  {["Issued", "Closed", "Rescinded"].includes(caseRecord.status) &&
                    caseRecord.reason && (
                      <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-600">
                        <strong>Issued reason:</strong> {caseRecord.reason}
                      </p>
                    )}
                </article>
              ))}
            </div>
          ) : (
            emptyHistory("Disciplinary history")
          )}
        </section>
      );
    }
    const historyNames: Partial<Record<EmployeeProfileTab, string>> = {
      attendance: "Attendance",
      payroll: "Payroll history",
      advances: "Salary advances",
      leave: "Leave history",
      punishment: "Punishment history",
    };
    return emptyHistory(historyNames[activeTab] ?? "HR history");
  };

  return (
    <div className="animate-in fade-in duration-300">
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-[#6d28d9] hover:underline"
      >
        <ChevronLeft className="size-4" /> Back to employee list
      </button>
      <header className="mb-5 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center">
        <div className="relative">
          <EmployeeAvatar
            employee={
              previewUrl ? { ...employee, photoUrl: previewUrl } : employee
            }
          />
          {canManage && (
            <label
              className="absolute -bottom-1 -right-1 grid size-7 cursor-pointer place-items-center rounded-full border-2 border-white bg-slate-100 text-slate-600 hover:bg-slate-200"
              title="Upload or replace profile image"
            >
              <Icons.Camera className="size-3.5" />
              <input
                type="file"
                accept="image/*"
                aria-label="Update employee photo preview"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void saveProfileImage(file);
                }}
                className="sr-only"
              />
            </label>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-slate-400">
            Employee profile · {employee.number}
          </div>
          <h2 className="mt-1 truncate text-xl font-bold tracking-tight text-slate-900">
            {displayName}
          </h2>
          {disciplinaryIndicatorsQuery.data?.indicators[employee.id]?.length ? (
            <div className="mt-2 flex flex-wrap gap-2" aria-label="Disciplinary indicators">
              {disciplinaryIndicatorsQuery.data.indicators[employee.id].map((indicator) => (
                <span key={`${indicator.reference}-${indicator.icon}`} className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-800">
                  <DisciplinaryIndicatorBadge indicator={indicator} />
                  {indicator.label}
                </span>
              ))}
            </div>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>{employee.department}</span>
            <span>·</span>
            <span>{employee.role}</span>
            <span>·</span>
            <span>{employee.category}</span>
            <Status text={employee.status} />
          </div>
          <p className="mt-2 text-[10px] text-slate-400">
            {canManage
              ? "PNG, JPEG, or WebP · maximum 5 MB."
              : "Employee profile image."}
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            {employee.photoUrl && (
              <button
                type="button"
                onClick={deleteProfileImage}
                className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
              >
                Remove image
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowEdit(true)}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Icons.PencilLine className="size-3.5" /> Edit profile
            </button>
            {employee.status === "Active" && (
              <button
                type="button"
                onClick={deactivateProfile}
                className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
              >
                Deactivate
              </button>
            )}
          </div>
        )}
      </header>
      {imageError && (
        <p
          role="alert"
          className="mb-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700"
        >
          {imageError}
        </p>
      )}
      <div
        role="tablist"
        aria-label={`${displayName} profile sections`}
        className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`employee-tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`employee-panel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={handleTabKeyDown}
            className={`shrink-0 border-b-2 px-3 py-3 text-xs font-semibold transition ${activeTab === tab.id ? "border-[#6d28d9] text-[#6d28d9]" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <section
        id={`employee-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`employee-tab-${activeTab}`}
        tabIndex={0}
      >
        {tabContent()}
      </section>
      {selectedAttendanceRecord && (
        <AttendanceRecordDialog
          employeeName={displayName}
          record={selectedAttendanceRecord}
          onClose={() => setSelectedAttendanceRecord(null)}
        />
      )}
      {showEdit && (
        <EmployeeWizard
          state={state}
          updateState={updateState}
          draft={null}
          employee={employee}
          onEmployeeSaved={onEmployeeUpdated}
          onDraftSaved={() => {}}
          onClose={() => setShowEdit(false)}
        />
      )}
    </div>
  );
}

function AttendanceRecordDialog({
  employeeName,
  record,
  onClose,
}: {
  employeeName: string;
  record: AttendanceRecord;
  onClose: () => void;
}) {
  const closeFromBackdrop = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };
  const detail = (label: string, value: string) => (
    <div key={label} className="border-b border-slate-100 py-3 last:border-0">
      <div className="text-[10px] font-medium uppercase text-slate-400">
        {label}
      </div>
      <div className="mt-1 break-words text-sm font-semibold text-slate-800">
        {value || "—"}
      </div>
    </div>
  );
  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/40 p-4"
      onMouseDown={closeFromBackdrop}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="attendance-record-title"
        className="w-full max-w-lg rounded-xl bg-white shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id="attendance-record-title" className="text-base font-bold">
              Attendance record
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {employeeName} · {formatDate(record.workDate)}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close attendance record"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="px-5 py-2">
          {detail("Status", record.status)}
          {detail(
            "Day length",
            record.status === "Present"
              ? record.halfDay
                ? "Half day"
                : "Full day"
              : "Not applicable",
          )}
          {detail(
            "Late",
            record.status === "Present"
              ? record.late
                ? "Yes"
                : "No"
              : "Not applicable",
          )}
          {detail("Note", record.note ?? "No note")}
          {detail("Last updated", new Date(record.updatedAt).toLocaleString())}
        </div>
        <footer className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
          <p className="text-[10px] text-slate-400">
            Attendance changes are recorded in the system audit log.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#6d28d9] px-4 py-2 text-xs font-semibold text-white"
          >
            Close
          </button>
        </footer>
      </section>
    </div>
  );
}
function customerSalesFor(
  customer: ErpState["customers"][number],
  state: ErpState,
) {
  return state.sales.filter((sale) => {
    if (sale.customerId === customer.id) return true;
    if (sale.customerId && state.customers.some((item) => item.id === sale.customerId)) {
      return false;
    }
    const matches = state.customers.filter(
      (item) =>
        item.name.trim().replace(/\s+/g, " ").toLowerCase() ===
        sale.customer.trim().replace(/\s+/g, " ").toLowerCase(),
    );
    return matches.length === 1 && matches[0].id === customer.id;
  });
}

function customerOrdersFor(
  customer: ErpState["customers"][number],
  state: ErpState,
) {
  return state.orders.filter((order) => {
    if (order.customerId === customer.id) return true;
    if (order.customerId && state.customers.some((item) => item.id === order.customerId)) {
      return false;
    }
    const matches = state.customers.filter(
      (item) =>
        item.name.trim().replace(/\s+/g, " ").toLowerCase() ===
        order.customer.trim().replace(/\s+/g, " ").toLowerCase(),
    );
    return matches.length === 1 && matches[0].id === customer.id;
  });
}

function customerCreditBalance(
  customer: ErpState["customers"][number],
  state: ErpState,
) {
  return sum(
    customerSalesFor(customer, state)
      .filter((sale) => sale.paymentTerms === "Credit")
      .map((sale) => balanceForSale(sale, state.payments)),
  );
}

function CustomerManagementPage({
  state,
  updateCustomers,
  customersLoaded,
  loadError,
  onRetry,
  canManage,
  onView,
}: {
  state: ErpState;
  updateCustomers: (customers: ErpState["customers"]) => void;
  customersLoaded: boolean;
  loadError: string;
  onRetry: () => void;
  canManage: boolean;
  onView: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All types");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [regionFilter, setRegionFilter] = useState("All regions");
  const [districtFilter, setDistrictFilter] = useState("All districts");
  const [referrerFilter, setReferrerFilter] = useState("All referrers");
  const [period, setPeriod] = useState<"all" | "month" | "year">("month");
  const [editingCustomer, setEditingCustomer] = useState<
    ErpState["customers"][number] | null
  >(null);
  const [showForm, setShowForm] = useState(false);
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState("");
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!openActionId) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !actionsRef.current?.contains(event.target)
      ) {
        setOpenActionId(null);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [openActionId]);
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const yearStart = `${now.getFullYear()}-01-01`;
  const selectedPeriodStart =
    period === "month" ? monthStart : period === "year" ? yearStart : "";
  const runCustomerMutation = async (
    work: () => Promise<ErpState["customers"][number]>,
    successMessage: string,
  ) => {
    if (!canManage || !customersLoaded || saving) return null;
    setSaving(true);
    setActionError("");
    try {
      const updatedCustomer = await work();
      updateCustomers([
        updatedCustomer,
        ...state.customers.filter((item) => item.id !== updatedCustomer.id),
      ]);
      setToast(successMessage);
      window.setTimeout(() => setToast(""), 2600);
      return updatedCustomer;
    } catch (error) {
      setActionError(
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "The customer change could not be saved.",
      );
      return null;
    } finally {
      setSaving(false);
    }
  };
  const activeCustomers = state.customers.filter(
    (customer) => customer.status === "Active" && !customer.archivedAt,
  );
  const addedThisMonth = state.customers.filter(
    (customer) =>
      !customer.archivedAt &&
      customer.createdAt?.slice(0, 7) === monthStart.slice(0, 7),
  ).length;
  const debtors = state.customers.filter(
    (customer) =>
      !customer.archivedAt && customerCreditBalance(customer, state) > 0,
  );
  const types = [
    ...new Set(
      state.customers.map((customer) => customer.type).filter(Boolean),
    ),
  ].sort();
  const regions = [
    ...new Set(
      state.customers
        .map((customer) => customer.region)
        .filter((value): value is string => Boolean(value)),
    ),
  ].sort();
  const districts = [
    ...new Set(
      state.customers
        .map((customer) => customer.district)
        .filter((value): value is string => Boolean(value)),
    ),
  ].sort();
  const referrers = [
    ...new Set(
      state.customers
        .map((customer) => customer.referredBy)
        .filter((value): value is string => Boolean(value)),
    ),
  ].sort();
  const filteredCustomers = state.customers.filter((customer) => {
    const sales = customerSalesFor(customer, state);
    const orders = customerOrdersFor(customer, state);
    const searchable = [
      customer.name,
      customer.id,
      customer.contact,
      customer.phone,
      customer.email,
      customer.region,
      customer.district,
      customer.country,
      customer.tin,
      customer.referredBy,
      ...sales.map((sale) => sale.reference),
      ...orders.map((order) => order.reference),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return (
      (statusFilter === "Archived"
        ? Boolean(customer.archivedAt)
        : !customer.archivedAt) &&
      searchable.includes(search.trim().toLowerCase()) &&
      (typeFilter === "All types" || customer.type === typeFilter) &&
      (statusFilter === "All statuses" ||
        statusFilter === "Archived" ||
        customer.status === statusFilter) &&
      (regionFilter === "All regions" || customer.region === regionFilter) &&
      (districtFilter === "All districts" ||
        customer.district === districtFilter) &&
      (referrerFilter === "All referrers" ||
        customer.referredBy === referrerFilter)
    );
  });
  const saveCustomer = async (form: FormData) => {
    const existing = editingCustomer;
    const customer = {
      name: String(form.get("name") || "").trim(),
      type: String(form.get("type") || "Small dealer"),
      contact: String(form.get("contact") || "").trim(),
      phone: String(form.get("phone") || "").trim(),
      email: String(form.get("email") || "").trim(),
      region: String(form.get("region") || "").trim() || undefined,
      district: String(form.get("district") || "").trim() || undefined,
      tin: String(form.get("tin") || "").trim() || undefined,
      country: String(form.get("country") || "").trim() || undefined,
      referredBy: String(form.get("referredBy") || "").trim(),
      notes: String(form.get("notes") || "").trim() || undefined,
      status: String(form.get("status") || "Active") as
        | "Active"
        | "Inactive"
        | "Suspended",
    };
    const saved = await runCustomerMutation(
      () =>
        existing
          ? updateCustomerApi(existing.id, customer)
          : createCustomerApi({
              name: customer.name,
              type: customer.type,
              phone: customer.phone,
              contact: customer.contact,
              email: customer.email,
              region: customer.region,
              district: customer.district,
              tin: customer.tin,
              country: customer.country,
              referredBy: customer.referredBy,
              notes: customer.notes,
              status: customer.status,
            }),
      existing ? "Customer updated" : "Customer added",
    );
    if (!saved) return;
    setEditingCustomer(null);
    setShowForm(false);
  };
  const setCustomerStatus = (
    customer: ErpState["customers"][number],
    status: "Active" | "Suspended",
  ) => {
    void runCustomerMutation(
      () => changeCustomerStatusApi(customer.id, status),
      status === "Suspended" ? "Customer suspended" : "Customer set to active",
    );
    setOpenActionId(null);
  };
  const setCustomerArchived = (
    customer: ErpState["customers"][number],
    archived: boolean,
  ) => {
    void runCustomerMutation(
      () =>
        archived
          ? archiveCustomerApi(customer.id)
          : restoreCustomerApi(customer.id),
      archived ? "Customer archived" : "Customer restored",
    );
    setOpenActionId(null);
  };
  const activateCustomer = (customer: ErpState["customers"][number]) => {
    void runCustomerMutation(
      () => updateCustomerApi(customer.id, { status: "Active", archivedAt: null }),
      "Customer set to active",
    );
    setOpenActionId(null);
  };
  const downloadCustomer = (customer: ErpState["customers"][number]) => {
    const sales = customerSalesFor(customer, state);
    exportCsv(
      `${customer.id.toLowerCase()}-${customer.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`,
      [
        {
          id: customer.id,
          name: customer.name,
          type: customer.type,
          contact: customer.contact ?? "",
          phone: customer.phone,
          email: customer.email,
          region: customer.region ?? "",
          district: customer.district ?? "",
          tin: customer.tin ?? "",
          country: customer.country ?? "",
          referredBy: customer.referredBy ?? "",
          salesCount: sales.length,
          lifetimeSales: sum(sales.map((sale) => sale.total)),
          outstandingCredit: customerCreditBalance(customer, state),
          status: customer.status,
          archived: Boolean(customer.archivedAt),
        },
      ],
    );
    setOpenActionId(null);
  };

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 text-xs font-medium text-slate-400">
            Workspace / Customer Management
          </div>
          <h2 className="text-2xl font-bold tracking-tight">
            Customer directory
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            One customer record, linked to every sale, order and repayment.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() =>
              exportCsv(
                "customers.csv",
                filteredCustomers.map((customer) => {
                  const sales = customerSalesFor(customer, state);
                  const periodSales = sales.filter(
                    (sale) =>
                      !selectedPeriodStart || sale.date >= selectedPeriodStart,
                  );
                  return {
                    id: customer.id,
                    name: customer.name,
                    type: customer.type,
                    contact: customer.contact ?? "",
                    phone: customer.phone,
                    email: customer.email,
                    region: customer.region ?? "",
                    district: customer.district ?? "",
                    country: customer.country ?? "",
                    referredBy: customer.referredBy ?? "",
                    salesCount: sales.length,
                    periodSales: sum(periodSales.map((sale) => sale.total)),
                    outstanding: sum(
                      sales.map((sale) => balanceForSale(sale, state.payments)),
                    ),
                    status: customer.status,
                  };
                }),
              )
            }
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <Download className="size-4" /> Export CSV
          </button>
          {canManage && (
            <button
              disabled={!customersLoaded || saving}
              onClick={() => {
                setEditingCustomer(null);
                setActionError("");
                setShowForm(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-[#6d28d9] px-3 py-2 text-xs font-semibold text-white hover:bg-[#5b21b6] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="size-4" /> Add customer
            </button>
          )}
        </div>
      </div>

      {!customersLoaded && (
        <p role="status" className="mb-4 rounded-lg bg-white px-4 py-3 text-sm text-slate-500">
          Loading customer records…
        </p>
      )}
      {loadError && (
        <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>{loadError}</span>
          <button type="button" onClick={onRetry} className="font-semibold underline">
            Retry
          </button>
        </div>
      )}
      {actionError && (
        <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {actionError}
        </p>
      )}
      {toast && (
        <div
          role="status"
          className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700"
        >
          {toast}
        </div>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CustomerMetric
          label="Total customers"
          value={state.customers.length}
          detail="All customer records"
          icon="UsersRound"
          tone="purple"
        />
        <CustomerMetric
          label="Active customers"
          value={activeCustomers.length}
          detail={`${state.customers.length - activeCustomers.length} inactive accounts`}
          icon="UserRoundCheck"
          tone="green"
        />
        <CustomerMetric
          label="Added this month"
          value={addedThisMonth}
          detail="Based on recorded creation dates"
          icon="UserRoundPlus"
          tone="blue"
        />
        <CustomerMetric
          label="Outstanding credit"
          value={debtors.length}
          detail={`${money(sum(state.customers.map((customer) => customerCreditBalance(customer, state))))} balance`}
          icon="HandCoins"
          tone="amber"
        />
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-1 flex-wrap gap-2">
            <label className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 sm:max-w-sm sm:flex-1">
              <Search className="size-4 shrink-0 text-slate-400" />
              <input
                aria-label="Search customers"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-slate-400"
                placeholder="Name, ID, contact, location or transaction"
              />
            </label>
            <select
              aria-label="Filter by customer type"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
            >
              <option>All types</option>
              {types.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
            <select
              aria-label="Filter by account status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
            >
              <option>All statuses</option>
              <option>Active</option>
              <option>Suspended</option>
              <option>Inactive</option>
              <option>Archived</option>
            </select>
            {regions.length > 0 && (
              <select
                aria-label="Filter by region"
                value={regionFilter}
                onChange={(event) => setRegionFilter(event.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
              >
                <option>All regions</option>
                {regions.map((region) => (
                  <option key={region}>{region}</option>
                ))}
              </select>
            )}
            {districts.length > 0 && (
              <select
                aria-label="Filter by district"
                value={districtFilter}
                onChange={(event) => setDistrictFilter(event.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
              >
                <option>All districts</option>
                {districts.map((district) => (
                  <option key={district}>{district}</option>
                ))}
              </select>
            )}
            {referrers.length > 0 && (
              <select
                aria-label="Filter by referrer"
                value={referrerFilter}
                onChange={(event) => setReferrerFilter(event.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
              >
                <option>All referrers</option>
                {referrers.map((referrer) => (
                  <option key={referrer}>{referrer}</option>
                ))}
              </select>
            )}
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
            Revenue period
            <select
              aria-label="Revenue period"
              value={period}
              onChange={(event) =>
                setPeriod(event.target.value as typeof period)
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
            >
              <option value="month">This month</option>
              <option value="year">This year</option>
              <option value="all">All time</option>
            </select>
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1150px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-400">
              <tr>
                {[
                  "Customer",
                  "Type",
                  "Contact",
                  "Operating area",
                  "Referred by",
                  "Sales",
                  "Revenue",
                  "Credit balance",
                  "Last sale",
                  "Status",
                  "Actions",
                ].map((heading) => (
                  <th key={heading} className="px-4 py-3">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer) => {
                const sales = customerSalesFor(customer, state);
                const lastSale = [...sales].sort((left, right) =>
                  right.date.localeCompare(left.date),
                )[0];
                const periodSales = sales.filter(
                  (sale) =>
                    !selectedPeriodStart || sale.date >= selectedPeriodStart,
                );
                const balance = customerCreditBalance(customer, state);
                const area =
                  customer.type === "Big dealer"
                    ? [customer.region, customer.district]
                        .filter(Boolean)
                        .join(" · ")
                    : customer.type === "Export customer"
                      ? customer.country
                      : "—";
                return (
                  <tr
                    key={customer.id}
                    className="border-t border-slate-100 text-slate-600 hover:bg-slate-50/70"
                  >
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => onView(customer.id)}
                        className="text-left font-semibold text-slate-800 hover:text-[#6d28d9] hover:underline"
                      >
                        {customer.name}
                        <span className="mt-1 block font-mono text-[10px] font-normal text-slate-400">
                          {customer.id}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3.5">{customer.type}</td>
                    <td className="px-4 py-3.5">
                      <span className="font-medium text-slate-700">
                        {customer.contact || "—"}
                      </span>
                      <span className="mt-1 block">{customer.phone}</span>
                      <span className="mt-0.5 block text-[10px] text-slate-400">
                        {customer.email || ""}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">{area || "—"}</td>
                    <td className="px-4 py-3.5">
                      {customer.referredBy || "—"}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-700">
                      {sales.length}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-700">
                      {money(sum(periodSales.map((sale) => sale.total)))}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-700">
                      {money(balance)}
                    </td>
                    <td className="px-4 py-3.5">
                      {lastSale ? formatDate(lastSale.date) : "—"}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1">
                        {customer.archivedAt && (
                          <span className="mr-1 rounded bg-slate-100 px-1.5 py-1 text-[9px] font-semibold uppercase text-slate-500">
                            Archived
                          </span>
                        )}
                        <Status text={customer.status} />
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div
                        className="relative"
                        ref={openActionId === customer.id ? actionsRef : null}
                      >
                        <button
                          type="button"
                          disabled={!customersLoaded || saving}
                          aria-label={`Actions for ${customer.name}`}
                          aria-expanded={openActionId === customer.id}
                          aria-haspopup="menu"
                          onClick={() =>
                            setOpenActionId((current) =>
                              current === customer.id ? null : customer.id,
                            )
                          }
                          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                        >
                          <Icons.MoreHorizontal className="size-4" />
                        </button>
                        {openActionId === customer.id && (
                          <div
                            role="menu"
                            aria-label={`Actions for ${customer.name}`}
                            className="absolute right-0 top-full z-30 mt-1 w-48 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg"
                          >
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setOpenActionId(null);
                                onView(customer.id);
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"
                            >
                              <Icons.UserRound className="size-3.5 text-slate-400" />{" "}
                              View profile
                            </button>
                            {canManage && (
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setEditingCustomer(customer);
                                  setActionError("");
                                  setShowForm(true);
                                  setOpenActionId(null);
                                }}
                                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"
                              >
                                <Icons.PencilLine className="size-3.5 text-slate-400" />{" "}
                                Edit customer
                              </button>
                            )}
                            {canManage &&
                              !customer.archivedAt &&
                              customer.status !== "Suspended" && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() =>
                                    setCustomerStatus(customer, "Suspended")
                                  }
                                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"
                                >
                                  <Icons.Pause className="size-3.5 text-slate-400" />{" "}
                                  Suspend
                                </button>
                              )}
                            {canManage &&
                              (customer.status !== "Active" ||
                                customer.archivedAt) && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => activateCustomer(customer)}
                                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"
                                >
                                  <Icons.CircleCheck className="size-3.5 text-slate-400" />{" "}
                                  Set active
                                </button>
                              )}
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => downloadCustomer(customer)}
                              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"
                            >
                              <Icons.Download className="size-3.5 text-slate-400" />{" "}
                              Download
                            </button>
                            {canManage && (
                              <div className="my-1 border-t border-slate-100" />
                            )}
                            {canManage && (
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() =>
                                  setCustomerArchived(
                                    customer,
                                    !customer.archivedAt,
                                  )
                                }
                                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-rose-700 hover:bg-rose-50"
                              >
                                {customer.archivedAt ? (
                                  <>
                                    <Icons.ArchiveRestore className="size-3.5" />{" "}
                                    Restore from archive
                                  </>
                                ) : (
                                  <>
                                    <Icons.Archive className="size-3.5" /> Archive
                                    customer
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filteredCustomers.length && (
                <tr>
                  <td
                    colSpan={11}
                    className="px-4 py-12 text-center text-sm text-slate-400"
                  >
                    No customers match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 px-4 py-3 text-[11px] text-slate-400">
          Showing {filteredCustomers.length}{" "}
          {statusFilter === "Archived" ? "archived" : "active directory"}{" "}
          records · Sales counts are calculated from linked transactions
        </div>
      </section>

      {showForm && (
        <CustomerFormDialog
          customer={editingCustomer}
          isSaving={saving}
          saveError={actionError}
          onClose={() => {
            setShowForm(false);
            setEditingCustomer(null);
          }}
          onSave={saveCustomer}
        />
      )}
    </div>
  );
}

function CustomerMetric({
  label,
  value,
  detail,
  icon,
  tone,
}: {
  label: string;
  value: number | string;
  detail: string;
  icon: string;
  tone: string;
}) {
  const Icon = iconMap[icon] || Icons.UsersRound;
  const toneClass =
    tone === "green"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "blue"
        ? "bg-sky-50 text-sky-700"
        : tone === "amber"
          ? "bg-amber-50 text-amber-700"
          : "bg-violet-50 text-violet-700";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <span
          className={`grid size-9 place-items-center rounded-lg ${toneClass}`}
        >
          <Icon className="size-[17px]" />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Live
        </span>
      </div>
      <div className="mt-3 text-xl font-bold tracking-tight">{value}</div>
      <div className="mt-0.5 text-xs font-semibold text-slate-700">{label}</div>
      <div className="mt-1 text-[10px] text-slate-400">{detail}</div>
    </div>
  );
}

function CustomerFormDialog({
  customer,
  isSaving,
  saveError,
  onClose,
  onSave,
}: {
  customer: ErpState["customers"][number] | null;
  isSaving: boolean;
  saveError: string;
  onClose: () => void;
  onSave: (form: FormData) => void;
}) {
  const [type, setType] = useState(customer?.type ?? "Small dealer");
  const fieldClass =
    "mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#8b5cf6] focus:ring-2 focus:ring-purple-100";
  const labelClass = "block text-xs font-semibold text-slate-600";
  const isBigDealer = type === "Big dealer";
  const isExport = type === "Export customer";

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-form-title"
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <div>
            <h3 id="customer-form-title" className="text-base font-bold">
              {customer ? "Edit customer" : "Add customer"}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Customer records stay linked to their transaction history.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close customer form"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"
          >
            <X className="size-4" />
          </button>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSave(new FormData(event.currentTarget));
          }}
          className="p-5"
        >
          {saveError && (
            <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {saveError}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={`${labelClass} sm:col-span-2`}>
              Customer or business name
              <input
                required
                name="name"
                defaultValue={customer?.name ?? ""}
                className={fieldClass}
                placeholder="Registered customer name"
              />
            </label>
            <label className={labelClass}>
              Customer type
              <select
                required
                name="type"
                value={type}
                onChange={(event) => setType(event.target.value)}
                className={fieldClass}
              >
                {customer &&
                  !["Big dealer", "Small dealer", "Export customer"].includes(
                    customer.type,
                  ) && (
                    <option value={customer.type}>
                      {customer.type} (existing)
                    </option>
                  )}
                <option>Big dealer</option>
                <option>Small dealer</option>
                <option>Export customer</option>
              </select>
            </label>
            <label className={labelClass}>
              Primary contact person
              <input
                required={!customer || Boolean(customer.contact)}
                name="contact"
                defaultValue={customer?.contact ?? ""}
                className={fieldClass}
                placeholder="Full name"
              />
            </label>
            <label className={labelClass}>
              Contact number
              <input
                required
                name="phone"
                type="tel"
                defaultValue={customer?.phone ?? ""}
                className={fieldClass}
                placeholder="+256 700 000 000"
              />
            </label>
            <label className={labelClass}>
              Email address{" "}
              <span className="font-normal text-slate-400">Optional</span>
              <input
                name="email"
                type="email"
                defaultValue={customer?.email ?? ""}
                className={fieldClass}
                placeholder="name@business.com"
              />
            </label>
            {isBigDealer && (
              <>
                <label className={labelClass}>
                  Region of operation
                  <input
                    required
                    name="region"
                    defaultValue={customer?.region ?? ""}
                    className={fieldClass}
                    placeholder="Region"
                  />
                </label>
                <label className={labelClass}>
                  District
                  <input
                    required
                    name="district"
                    defaultValue={customer?.district ?? ""}
                    className={fieldClass}
                    placeholder="District"
                  />
                </label>
                <label className={labelClass}>
                  TIN{" "}
                  <span className="font-normal text-slate-400">Optional</span>
                  <input
                    name="tin"
                    defaultValue={customer?.tin ?? ""}
                    className={fieldClass}
                    placeholder="Tax identification number"
                  />
                </label>
              </>
            )}
            {isExport && (
              <label className={labelClass}>
                Country of operation
                <input
                  required
                  name="country"
                  defaultValue={customer?.country ?? ""}
                  className={fieldClass}
                  placeholder="Country"
                />
              </label>
            )}
            <label className={labelClass}>
              Referred by
              <input
                required={!customer || Boolean(customer.referredBy)}
                name="referredBy"
                defaultValue={customer?.referredBy ?? ""}
                className={fieldClass}
                placeholder="Staff member or external referrer"
              />
            </label>
            <label className={labelClass}>
              Account status
              <select
                name="status"
                defaultValue={customer?.status ?? "Active"}
                className={fieldClass}
              >
                <option>Active</option>
                <option>Suspended</option>
                <option>Inactive</option>
              </select>
            </label>
            <label className={`${labelClass} sm:col-span-2`}>
              Notes <span className="font-normal text-slate-400">Optional</span>
              <textarea
                name="notes"
                rows={3}
                defaultValue={customer?.notes ?? ""}
                className={fieldClass}
                placeholder="Account preferences or relationship notes"
              />
            </label>
          </div>
          <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              disabled={isSaving}
              className="rounded-lg bg-[#6d28d9] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#5b21b6] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? "Saving…" : customer ? "Save changes" : "Create customer"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function CustomerDetails({
  customer,
  state,
  onBack,
}: {
  customer: ErpState["customers"][number];
  state: ErpState;
  onBack: () => void;
}) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "sales" | "orders" | "payments"
  >("overview");
  const sales = customerSalesFor(customer, state).sort((left, right) =>
    right.date.localeCompare(left.date),
  );
  const orders = customerOrdersFor(customer, state).sort((left, right) =>
    right.date.localeCompare(left.date),
  );
  const saleIds = new Set(sales.map((sale) => sale.id));
  const payments = state.payments
    .filter((payment) => saleIds.has(payment.saleId))
    .sort((left, right) => right.date.localeCompare(left.date));
  const totalSales = sum(sales.map((sale) => sale.total));
  const outstanding = customerCreditBalance(customer, state);
  const area =
    customer.type === "Big dealer"
      ? [customer.region, customer.district].filter(Boolean).join(" · ")
      : (customer.country ?? "—");
  const tabs = [
    ["overview", "Overview"],
    ["sales", "Sales history", sales.length],
    ["orders", "Order history", orders.length],
    ["payments", "Payment history", payments.length],
  ] as const;
  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const tabButtons = Array.from(
      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
        "[role=tab]",
      ) ?? [],
    );
    const currentIndex = tabButtons.indexOf(event.currentTarget);
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabButtons.length - 1
          : (currentIndex +
              (event.key === "ArrowRight" ? 1 : tabButtons.length - 1)) %
            tabButtons.length;
    tabButtons[nextIndex]?.focus();
    tabButtons[nextIndex]?.click();
  };

  return (
    <DetailView
      title="Customer details"
      subtitle="Customer profile and linked commercial history."
      name={customer.name}
      meta={`${customer.type} · ${customer.status}`}
      onBack={onBack}
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CustomerMetric
          label="Number of sales"
          value={sales.length}
          detail="Derived from linked sales"
          icon="ReceiptText"
          tone="purple"
        />
        <CustomerMetric
          label="Total sales"
          value={money(totalSales)}
          detail="Lifetime sales value"
          icon="ChartNoAxesCombined"
          tone="blue"
        />
        <CustomerMetric
          label="Outstanding credit"
          value={money(outstanding)}
          detail="Current unpaid balance"
          icon="HandCoins"
          tone="amber"
        />
        <CustomerMetric
          label="Customer orders"
          value={orders.length}
          detail="Linked order records"
          icon="ClipboardList"
          tone="green"
        />
      </div>
      <div
        role="tablist"
        aria-label={`${customer.name} details`}
        className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200"
      >
        {tabs.map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`customer-tab-${id}`}
            aria-selected={activeTab === id}
            aria-controls={`customer-panel-${id}`}
            tabIndex={activeTab === id ? 0 : -1}
            onClick={() => setActiveTab(id)}
            onKeyDown={handleTabKeyDown}
            className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-xs font-semibold transition ${activeTab === id ? "border-[#6d28d9] text-[#6d28d9]" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            {label}
            {count !== undefined && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] ${activeTab === id ? "bg-[#f1eafd] text-[#6d28d9]" : "bg-slate-100 text-slate-500"}`}
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      <section
        id={`customer-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`customer-tab-${activeTab}`}
        tabIndex={0}
      >
        {activeTab === "overview" && (
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-bold">Customer information</h3>
            <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Customer ID", customer.id],
                ["Primary contact", customer.contact || "—"],
                ["Phone", customer.phone],
                ["Email", customer.email || "—"],
                ["Operating area", area],
                ["TIN", customer.tin || "—"],
                ["Referred by", customer.referredBy || "—"],
                ["Account status", customer.status],
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="text-[11px] text-slate-400">{label}</div>
                  <div className="mt-1 break-words text-sm font-semibold text-slate-800">
                    {value}
                  </div>
                </div>
              ))}
            </div>
            {customer.notes && (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <div className="text-[11px] text-slate-400">Notes</div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                  {customer.notes}
                </p>
              </div>
            )}
          </section>
        )}

        {activeTab === "sales" && (
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="text-sm font-bold">Sales history</h3>
              <p className="mt-1 text-xs text-slate-400">
                {sales.length} linked transactions · {money(totalSales)}{" "}
                lifetime value
              </p>
            </div>
            {sales.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase text-slate-400">
                    <tr>
                      {[
                        "Reference",
                        "Date",
                        "Product",
                        "Total",
                        "Balance",
                        "Status",
                      ].map((label) => (
                        <th key={label} className="px-5 py-3">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map((sale) => (
                      <tr
                        key={sale.id}
                        className="border-t border-slate-100 text-slate-600"
                      >
                        <td className="px-5 py-3 font-semibold text-slate-800">
                          {sale.reference}
                        </td>
                        <td className="px-5 py-3">{formatDate(sale.date)}</td>
                        <td className="px-5 py-3">{sale.product}</td>
                        <td className="px-5 py-3 font-semibold">
                          {money(sale.total)}
                        </td>
                        <td className="px-5 py-3">
                          {money(
                            sale.paymentTerms === "Credit"
                              ? balanceForSale(sale, state.payments)
                              : 0,
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <Status
                            text={
                              sale.paymentTerms === "Credit"
                                ? paymentStateForSale(sale, state.payments)
                                : sale.status
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-5 py-8 text-center text-xs text-slate-400">
                No sales linked to this customer yet.
              </p>
            )}
          </section>
        )}

        {activeTab === "orders" && (
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="text-sm font-bold">Order history</h3>
              <p className="mt-1 text-xs text-slate-400">
                Customer orders linked to this account
              </p>
            </div>
            {orders.length ? (
              <div className="divide-y divide-slate-100">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="flex flex-col gap-2 px-5 py-3 text-xs sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <span className="font-semibold text-slate-800">
                        {order.reference}
                      </span>
                      <span className="ml-2 text-slate-400">
                        {formatDate(order.date)} · {order.items.length} items
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-slate-700">
                        {money(order.total)}
                      </span>
                      <Status text={order.status} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-5 py-8 text-center text-xs text-slate-400">
                No orders linked to this customer yet.
              </p>
            )}
          </section>
        )}

        {activeTab === "payments" && (
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="text-sm font-bold">Payment history</h3>
              <p className="mt-1 text-xs text-slate-400">
                Repayments recorded against this customer&apos;s credit sales
              </p>
            </div>
            {payments.length ? (
              <div className="divide-y divide-slate-100">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex flex-col gap-1 px-5 py-3 text-xs sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <span className="font-semibold text-slate-800">
                        {
                          sales.find((sale) => sale.id === payment.saleId)
                            ?.reference
                        }
                      </span>
                      <span className="ml-2 text-slate-400">
                        {formatDate(payment.date)} · {payment.method}
                      </span>
                      {payment.note && (
                        <span className="ml-2 text-slate-400">
                          {payment.note}
                        </span>
                      )}
                    </div>
                    <span className="font-semibold text-emerald-700">
                      {money(payment.amount)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-5 py-8 text-center text-xs text-slate-400">
                No payments recorded.
              </p>
            )}
          </section>
        )}
      </section>
    </DetailView>
  );
}
function DetailView({
  title,
  subtitle,
  name,
  meta,
  onBack,
  children,
}: {
  title: string;
  subtitle: string;
  name: string;
  meta: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="animate-in fade-in duration-300">
      <button
        onClick={onBack}
        className="mb-5 inline-flex items-center gap-2 text-xs font-semibold text-[#6d28d9] hover:underline"
      >
        <ChevronLeft className="size-4" /> Back to list
      </button>
      <div className="mb-6 flex items-start gap-4">
        <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#f1eafd] text-lg font-bold text-[#6d28d9]">
          {initials(name)}
        </div>
        <div>
          <div className="text-xs font-medium text-slate-400">
            Workspace / {title}
          </div>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">{name}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {meta} · {subtitle}
          </p>
        </div>
      </div>
      {children}
    </div>
  );
}
function DetailGrid({ items }: { items: string[][] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-bold">Profile information</h3>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-slate-50 p-4">
            <div className="text-[11px] font-medium text-slate-400">
              {label}
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-800">
              {value}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
function Related({ title, rows }: { title: string; rows: string[][] }) {
  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-bold">{title}</h3>
      <div className="mt-4 divide-y divide-slate-100">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="text-slate-500">{label}</span>
            <span className="font-semibold text-slate-800 sm:text-right">
              {value}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
function Header({
  active,
  setMobileNav,
  currentUser,
  onNavigate,
  onLogout,
  onChangePassword,
}: {
  active: string;
  setMobileNav: (value: boolean) => void;
  currentUser: UserAccount;
  onNavigate: (section: string) => void;
  onLogout: () => void;
  onChangePassword: () => void;
}) {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !profileMenuRef.current?.contains(event.target)
      )
        setProfileMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileMenuOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [profileMenuOpen]);

  return (
    <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <button
          aria-label="Open navigation"
          onClick={() => setMobileNav(true)}
          className="rounded-lg p-2 hover:bg-slate-100 lg:hidden"
        >
          <Menu className="size-5" />
        </button>
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Workspace</span>
            <span>/</span>
            <span className="text-slate-600">{active}</span>
          </div>
          {currentUser.roles.includes("Super Admin") && (
            <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-800">
              Temporary all-department access
            </span>
          )}
          {/* <h1 className="mt-0.5 text-lg font-bold tracking-tight sm:text-xl">
            {active}
          </h1> */}
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        {/* <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 md:flex"><Search className="size-4 text-slate-400" /><input className="w-36 bg-transparent text-xs outline-none placeholder:text-slate-400" placeholder="Search anything..." /></div> */}
        <NotificationCenter currentUser={currentUser} onNavigate={onNavigate} />
        <div className="hidden h-7 w-px bg-slate-200 sm:block" />
        <div ref={profileMenuRef} className="relative">
          <button
            type="button"
            aria-label="Open user menu"
            aria-haspopup="menu"
            aria-expanded={profileMenuOpen}
            onClick={() => setProfileMenuOpen((open) => !open)}
            className="flex items-center gap-2 rounded-lg p-1.5 text-left hover:bg-slate-50"
          >
            <div className="grid size-8 place-items-center rounded-full bg-[#e9ddff] text-[10px] font-bold text-[#6d28d9]">
              {initials(currentUser.name)}
            </div>
            <div className="hidden text-left sm:block">
              <div className="text-xs font-semibold">{currentUser.name}</div>
              <div className="text-[10px] text-slate-400">
                {currentUser.roles.join(" · ")}
              </div>
            </div>
            <ChevronDown
              className={`hidden size-3.5 text-slate-400 transition-transform sm:block ${profileMenuOpen ? "rotate-180" : ""}`}
            />
          </button>
          {profileMenuOpen && (
            <div
              role="menu"
              aria-label="User menu"
              className="absolute right-0 top-full z-40 mt-2 w-48 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setProfileMenuOpen(false);
                  onChangePassword();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Icons.KeyRound className="size-3.5" />
                Change password
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setProfileMenuOpen(false);
                  onLogout();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-medium text-rose-700 hover:bg-rose-50"
              >
                <Icons.LogOut className="size-3.5" />
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function Kpi({
  label,
  value,
  change,
  icon,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  change: string;
  icon: string;
  tone: string;
  onClick: () => void;
}) {
  const Icon = iconMap[icon] || TrendingUp;
  return (
    <button
      onClick={onClick}
      className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-purple-200 hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <span
          className={`grid size-9 place-items-center rounded-xl ${tone === "purple" ? "bg-[#f1eafd] text-[#6d28d9]" : tone === "blue" ? "bg-blue-50 text-blue-600" : tone === "amber" ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"}`}
        >
          <Icon className="size-[18px]" />
        </span>
        <ChevronRight className="size-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-purple-400" />
      </div>
      <div className="mt-4 text-xl font-bold tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{label}</div>
      <div
        className={`mt-3 text-[11px] font-semibold ${change.startsWith("-") ? "text-emerald-600" : "text-emerald-600"}`}
      >
        {change}
      </div>
    </button>
  );
}
function MiniMetric({
  label,
  value,
  meta,
  icon,
}: {
  label: string;
  value: string;
  meta: string;
  icon: string;
}) {
  const Icon = iconMap[icon] || Boxes;
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-500">
        <Icon className="size-[19px]" />
      </div>
      <div>
        <div className="text-[11px] text-slate-400">{label}</div>
        <div className="mt-1 text-lg font-bold">{value}</div>
        <div className="mt-0.5 text-[10px] text-slate-400">{meta}</div>
      </div>
    </div>
  );
}
function RecentSales({
  state,
  setActive,
}: {
  state: ErpState;
  setActive: (value: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <SectionHead
        title="Recent transactions"
        link="View sales"
        onClick={() => setActive("Sales")}
      />{" "}
      <div className="mt-4 flex flex-col gap-4">
        {state.sales.slice(0, 4).map((s) => (
          <div key={s.id} className="flex items-center gap-3">
            <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#f1eafd] text-[10px] font-bold text-[#6d28d9]">
              {initials(s.customer)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold">{s.customer}</div>
              <div className="text-[10px] text-slate-400">
                {s.reference} · {formatDate(s.date)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-bold">{money(s.total)}</div>
              <Status text={s.status} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
function LowStock({
  state,
  setActive,
}: {
  state: ErpState;
  setActive: (value: string) => void;
}) {
  const low = state.materials.filter((m) => m.quantity <= m.threshold);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <SectionHead
        title="Low stock alerts"
        link="Inventory"
        onClick={() => setActive("Raw Material Management")}
      />
      <div className="mt-4 flex flex-col gap-4">
        {low.map((m) => (
          <div key={m.id} className="flex items-center gap-3">
            <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-600">
              <Icons.AlertTriangle className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold">{m.name}</div>
              <div className="text-[10px] text-slate-400">
                Reorder at {m.threshold} {m.unit}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-bold">
                {m.quantity} {m.unit}
              </div>
              <div className="text-[10px] font-medium text-amber-600">
                Reorder soon
              </div>
            </div>
          </div>
        ))}
        {!low.length && (
          <div className="py-5 text-center text-xs text-slate-400">
            All materials are well stocked.
          </div>
        )}
      </div>
    </section>
  );
}
function Activity({ state }: { state: ErpState }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <SectionHead title="System activity" link="Auditing" />
      <div className="mt-4 flex flex-col gap-4">
        {state.activities.map((a) => (
          <div key={a.id} className="flex gap-3">
            <div
              className={`mt-1 size-2 shrink-0 rounded-full ${a.outcome === "Success" ? "bg-emerald-500" : "bg-amber-500"}`}
            />
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-700">
                {a.action}
              </div>
              <div className="mt-0.5 text-[10px] text-slate-400">
                {a.actor} · {a.time}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
function SectionHead({
  title,
  link,
  onClick,
}: {
  title: string;
  link: string;
  onClick?: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-bold">{title}</h3>
      <button
        onClick={onClick}
        className="text-[11px] font-semibold text-[#6d28d9] hover:underline"
      >
        {link}
      </button>
    </div>
  );
}
function Status({ text }: { text: string }) {
  const color = ["Paid", "Approved", "Active", "Success"].includes(text)
    ? "bg-emerald-50 text-emerald-700"
    : ["Pending", "Review", "Draft", "Suspended"].includes(text)
      ? "bg-amber-50 text-amber-700"
      : "bg-slate-100 text-slate-600";
  return (
    <span
      className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[9px] font-semibold ${color}`}
    >
      {text}
    </span>
  );
}

function CreditSalesPage({
  state,
  updateState,
}: {
  state: ErpState;
  updateState: (next: ErpState) => void;
}) {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<
    "outstanding" | "overdue" | "due-soon" | "paid"
  >("outstanding");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [paymentSaleId, setPaymentSaleId] = useState<string | null>(null);
  const [actionSaleId, setActionSaleId] = useState<string | null>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!actionSaleId) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !actionsRef.current?.contains(event.target)
      ) {
        setActionSaleId(null);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [actionSaleId]);
  const today = new Date().toISOString().slice(0, 10);
  const dueSoonLimit = new Date(`${today}T00:00:00.000Z`);
  dueSoonLimit.setUTCDate(dueSoonLimit.getUTCDate() + 7);
  const dueSoonDate = dueSoonLimit.toISOString().slice(0, 10);
  const creditSales = state.sales.filter(
    (sale) => sale.paymentTerms === "Credit",
  );
  const outstandingSales = creditSales.filter(
    (sale) => balanceForSale(sale, state.payments) > 0,
  );
  const overdueSales = outstandingSales.filter((sale) =>
    Boolean(sale.dueDate && sale.dueDate < today),
  );
  const dueSoonSales = outstandingSales.filter((sale) =>
    Boolean(
      sale.dueDate && sale.dueDate >= today && sale.dueDate <= dueSoonDate,
    ),
  );
  const settledSales = creditSales.filter(
    (sale) => balanceForSale(sale, state.payments) === 0,
  );
  const activeSales =
    view === "outstanding"
      ? outstandingSales
      : view === "overdue"
        ? overdueSales
        : view === "due-soon"
          ? dueSoonSales
          : settledSales;
  const visibleSales = activeSales
    .filter((sale) => {
      const customer = state.customers.find(
        (item) => item.id === sale.customerId,
      );
      const matchesSearch =
        `${sale.reference} ${sale.customer} ${customer?.phone ?? ""}`
          .toLowerCase()
          .includes(search.toLowerCase());
      const paymentState = paymentStateForSale(sale, state.payments, today);
      const matchesStatus =
        statusFilter === "All statuses" ||
        paymentState === statusFilter ||
        (statusFilter === "Needs review" && sale.creditNeedsReview);
      return matchesSearch && matchesStatus;
    })
    .sort(
      (left, right) =>
        (left.dueDate || "9999-12-31").localeCompare(
          right.dueDate || "9999-12-31",
        ) || left.date.localeCompare(right.date),
    );
  const openBalance = (sales: ErpState["sales"]) =>
    sum(sales.map((sale) => balanceForSale(sale, state.payments)));
  const customersWithBalances = new Set(
    outstandingSales.map(
      (sale) => sale.customerId || sale.customer.trim().toLowerCase(),
    ),
  ).size;
  const selectedSale =
    creditSales.find((sale) => sale.id === selectedSaleId) ?? null;
  const paymentSale =
    creditSales.find((sale) => sale.id === paymentSaleId) ?? null;

  const recordPayment = (payment: Omit<SalePayment, "id" | "recordedAt">) => {
    if (!paymentSale) return;
    const balance = balanceForSale(paymentSale, state.payments);
    if (
      !Number.isFinite(payment.amount) ||
      payment.amount <= 0 ||
      payment.amount > balance
    )
      return;
    updateState({
      ...state,
      payments: [
        ...state.payments,
        {
          ...payment,
          id: createId("PAY"),
          recordedAt: new Date().toISOString(),
        },
      ],
    });
    setPaymentSaleId(null);
  };

  const views = [
    ["outstanding", "Outstanding", outstandingSales.length],
    ["overdue", "Overdue", overdueSales.length],
    ["due-soon", "Due soon", dueSoonSales.length],
    ["paid", "Paid / settled", settledSales.length],
  ] as const;

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 text-xs font-medium text-slate-400">
            Workspace / Sales Department
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Credit Sales</h2>
          <p className="mt-1 text-sm text-slate-500">
            Monitor receivables and record customer repayments.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            exportCsv(
              "credit-sales.csv",
              visibleSales.map((sale) => ({
                reference: sale.reference,
                customer: sale.customer,
                saleDate: sale.date,
                dueDate: sale.dueDate ?? "Needs review",
                total: sale.total,
                paid: paidAmountForSale(sale.id, state.payments),
                balance: balanceForSale(sale, state.payments),
                status: paymentStateForSale(sale, state.payments, today),
              })),
            )
          }
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
        >
          <Download className="size-4" /> Export CSV
        </button>
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Total outstanding"
          value={money(openBalance(outstandingSales))}
          change={`${outstandingSales.length} open credit sales`}
          icon="WalletCards"
          tone="purple"
          onClick={() => setView("outstanding")}
        />
        <Kpi
          label="Overdue amount"
          value={money(openBalance(overdueSales))}
          change={`${overdueSales.length} overdue sales`}
          icon="CalendarAlert"
          tone="amber"
          onClick={() => setView("overdue")}
        />
        <Kpi
          label="Due in the next 7 days"
          value={money(openBalance(dueSoonSales))}
          change={`${dueSoonSales.length} sales due soon`}
          icon="CalendarClock"
          tone="blue"
          onClick={() => setView("due-soon")}
        />
        <Kpi
          label="Customers with balances"
          value={String(customersWithBalances)}
          change={`${settledSales.length} settled credit sales`}
          icon="UsersRound"
          tone="green"
          onClick={() => setView("outstanding")}
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        {views.map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            aria-pressed={view === key}
            onClick={() => setView(key)}
            className={`border-b-2 px-3 py-2.5 text-xs font-semibold ${view === key ? "border-[#6d28d9] text-[#6d28d9]" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            {label}
            <span className="ml-2 text-[10px] text-slate-400">{count}</span>
          </button>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <Search className="size-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full bg-transparent text-xs outline-none placeholder:text-slate-400 sm:w-64"
              placeholder="Search customer or reference"
            />
          </div>
          <select
            aria-label="Filter credit sales by status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
          >
            <option>All statuses</option>
            <option>Unpaid</option>
            <option>Partially paid</option>
            <option>Paid</option>
            <option>Unpaid · Overdue</option>
            <option>Partially paid · Overdue</option>
            <option>Needs review</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3">Sale</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Sale date</th>
                <th className="px-4 py-3">Due date</th>
                <th className="px-4 py-3 text-right">Original</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3">Payment state</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleSales.map((sale) => {
                const paid = paidAmountForSale(sale.id, state.payments);
                const balance = balanceForSale(sale, state.payments);
                const paymentState = sale.creditNeedsReview
                  ? "Needs review"
                  : paymentStateForSale(sale, state.payments, today);
                return (
                  <tr
                    key={sale.id}
                    className="border-b border-slate-50 text-xs text-slate-600 last:border-0 hover:bg-slate-50/50"
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setSelectedSaleId(sale.id)}
                        className="font-semibold text-slate-800 hover:text-[#6d28d9] hover:underline"
                      >
                        {sale.reference}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">
                        {sale.customer}
                      </div>
                      {sale.creditNeedsReview && (
                        <div className="mt-1 text-[10px] font-medium text-amber-700">
                          Customer/due date needs review
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">{formatDate(sale.date)}</td>
                    <td
                      className={`px-4 py-3 ${sale.dueDate && sale.dueDate < today && balance > 0 ? "font-semibold text-red-600" : ""}`}
                    >
                      {sale.dueDate ? formatDate(sale.dueDate) : "Needs review"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {money(sale.total)}
                    </td>
                    <td className="px-4 py-3 text-right">{money(paid)}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">
                      {money(balance)}
                    </td>
                    <td className="px-4 py-3">
                      <Status text={paymentState} />
                    </td>
                    <td className="px-4 py-3">
                      <div
                        className="relative"
                        ref={actionSaleId === sale.id ? actionsRef : undefined}
                      >
                        <button
                          type="button"
                          aria-label={`Actions for ${sale.reference}`}
                          aria-expanded={actionSaleId === sale.id}
                          onClick={() =>
                            setActionSaleId((current) =>
                              current === sale.id ? null : sale.id,
                            )
                          }
                          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-[#6d28d9]"
                        >
                          <Icons.MoreHorizontal className="size-4" />
                        </button>
                        {actionSaleId === sale.id && (
                          <div
                            role="dialog"
                            aria-label={`Actions for ${sale.reference}`}
                            className="absolute right-0 top-full z-30 mt-1 w-44 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setActionSaleId(null);
                                setSelectedSaleId(sale.id);
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"
                            >
                              <Icons.Eye className="size-3.5 text-slate-400" />{" "}
                              View details
                            </button>
                            <button
                              type="button"
                              disabled={balance <= 0}
                              onClick={() => {
                                setActionSaleId(null);
                                setPaymentSaleId(sale.id);
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Icons.CircleDollarSign className="size-3.5 text-slate-400" />{" "}
                              Record payment
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!visibleSales.length && (
            <div className="py-14 text-center text-xs text-slate-400">
              No credit sales match this view.
            </div>
          )}
        </div>
        <div className="border-t border-slate-100 px-4 py-3 text-[11px] text-slate-400">
          Showing {visibleSales.length} of {activeSales.length} credit sales ·
          balances are calculated from recorded payments
        </div>
      </section>
      {paymentSale && (
        <RecordCreditPaymentDialog
          sale={paymentSale}
          balance={balanceForSale(paymentSale, state.payments)}
          onClose={() => setPaymentSaleId(null)}
          onSave={recordPayment}
        />
      )}
      {selectedSale && (
        <CreditSaleDetailsDialog
          sale={selectedSale}
          payments={state.payments.filter(
            (payment) => payment.saleId === selectedSale.id,
          )}
          onClose={() => setSelectedSaleId(null)}
        />
      )}
    </div>
  );
}

function RecordCreditPaymentDialog({
  sale,
  balance,
  onClose,
  onSave,
}: {
  sale: ErpState["sales"][number];
  balance: number;
  onClose: () => void;
  onSave: (payment: Omit<SalePayment, "id" | "recordedAt">) => void;
}) {
  const [method, setMethod] = useState<SalePayment["method"]>("Cash");
  const [error, setError] = useState("");
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get("amount"));
    const txnID = String(form.get("txnID") || "").trim();
    if (!Number.isFinite(amount) || amount <= 0 || amount > balance) {
      setError(
        `Enter an amount greater than zero and no more than ${money(balance)}.`,
      );
      return;
    }
    if (method !== "Cash" && !txnID) {
      setError("Enter the transaction ID for this payment method.");
      return;
    }
    onSave({
      saleId: sale.id,
      amount,
      date: String(form.get("date")),
      method,
      txnID: txnID || undefined,
      note: String(form.get("note") || "").trim() || undefined,
    });
  };
  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="credit-payment-title"
        className="w-full max-w-md rounded-xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id="credit-payment-title" className="text-base font-bold">
              Record payment
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {sale.reference} · Balance {money(balance)}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close payment form"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"
          >
            <X className="size-4" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4 p-5">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-600">
            Amount (UGX)
            <input
              required
              autoFocus
              name="amount"
              type="number"
              min="1"
              max={balance}
              step="1"
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-600">
            Received date
            <input
              required
              name="date"
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-600">
            Payment method
            <select
              value={method}
              onChange={(event) =>
                setMethod(event.target.value as SalePayment["method"])
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal"
            >
              <option>Cash</option>
              <option>Mobile Money</option>
              <option>Bank Transfer</option>
              <option>Check</option>
            </select>
          </label>
          {method !== "Cash" && (
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-600">
              Transaction ID
              <input
                required
                name="txnID"
                className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal"
              />
            </label>
          )}
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-600">
            Note (optional)
            <textarea
              name="note"
              rows={2}
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal"
            />
          </label>
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
            >
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#6d28d9] px-3 py-2 text-xs font-semibold text-white"
            >
              Save payment
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function CreditSaleDetailsDialog({
  sale,
  payments,
  onClose,
}: {
  sale: ErpState["sales"][number];
  payments: SalePayment[];
  onClose: () => void;
}) {
  const paid = paidAmountForSale(sale.id, payments);
  const balance = balanceForSale(sale, payments);
  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="credit-sale-details-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id="credit-sale-details-title" className="text-base font-bold">
              Credit sale details
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {sale.reference} · {sale.customer}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close credit sale details"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div>
            <div className="text-[11px] text-slate-400">Sale date</div>
            <div className="mt-1 text-sm font-semibold">
              {formatDate(sale.date)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Due date</div>
            <div className="mt-1 text-sm font-semibold">
              {sale.dueDate ? formatDate(sale.dueDate) : "Needs review"}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Original amount</div>
            <div className="mt-1 text-sm font-semibold">
              {money(sale.total)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Payment state</div>
            <Status text={paymentStateForSale(sale, payments)} />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Paid</div>
            <div className="mt-1 text-sm font-semibold">{money(paid)}</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Outstanding</div>
            <div className="mt-1 text-sm font-bold">{money(balance)}</div>
          </div>
          <div className="sm:col-span-2">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
              Payment history
            </h3>
            {payments.length ? (
              <div className="divide-y divide-slate-100 border-y border-slate-100">
                {[...payments]
                  .sort(
                    (a, b) =>
                      b.date.localeCompare(a.date) ||
                      b.recordedAt.localeCompare(a.recordedAt),
                  )
                  .map((payment) => (
                    <div
                      key={payment.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs"
                    >
                      <div>
                        <div className="font-semibold text-slate-800">
                          {payment.method}
                          {payment.txnID ? ` · ${payment.txnID}` : ""}
                        </div>
                        <div className="mt-1 text-slate-400">
                          {formatDate(payment.date)}
                          {payment.note ? ` · ${payment.note}` : ""}
                        </div>
                      </div>
                      <strong>{money(payment.amount)}</strong>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="rounded-lg bg-slate-50 p-4 text-xs text-slate-500">
                No payments recorded yet.
              </p>
            )}
          </div>
        </div>
        <div className="flex justify-end border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
          >
            Close
          </button>
        </div>
      </section>
    </div>
  );
}

function ModulePage({
  active,
  state,
  updateState,
  currentUser,
  companyName,
  companyLogoUrl,
  companyProfileEditable,
  onCompanyProfileSave,
  onCurrentSessionRevoked,
  onViewSalaryAdvance,
  onViewPayrollRun,
  onView,
  updateCustomers,
  customersLoaded,
  customersApiLoaded,
  customerLoadError,
  onRetryCustomers,
  customerCanManage,
}: {
  active: string;
  state: ErpState;
  updateState: (next: ErpState) => void;
  currentUser: UserAccount;
  companyName: string;
  companyLogoUrl: string;
  companyProfileEditable: boolean;
  onCompanyProfileSave: (profile: CompanyProfile) => void;
  onCurrentSessionRevoked: () => void;
  onViewSalaryAdvance: (id: string) => void;
  onViewPayrollRun: (id: string) => void;
  onView: (id: string) => void;
  updateCustomers: (customers: ErpState["customers"]) => void;
  customersLoaded: boolean;
  customersApiLoaded: boolean;
  customerLoadError: string;
  onRetryCustomers: () => void;
  customerCanManage: boolean;
}) {
  const customerCanRead = hasAnyDepartmentRole(currentUser.roles, [
    "Sales Manager",
    "Marketing Manager",
    "General Manager",
    "Admin",
  ]);
  const assetCanRead = currentUser.roles.some((role) =>
    ["Inventory Manager", "General Manager", "Super Admin"].includes(role),
  );
  const assetCanEdit = currentUser.roles.includes("Inventory Manager");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState("");
  const [salesFromDate, setSalesFromDate] = useState("");
  const [showSalesDatePicker, setShowSalesDatePicker] = useState(false);
  const salesDatePickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showSalesDatePicker) return;
    const handleOutsideClick = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !salesDatePickerRef.current?.contains(event.target)
      ) {
        setShowSalesDatePicker(false);
      }
    };
    document.addEventListener("pointerdown", handleOutsideClick);
    return () =>
      document.removeEventListener("pointerdown", handleOutsideClick);
  }, [showSalesDatePicker]);
  const [salesPeriod, setSalesPeriod] = useState<
    "all" | "today" | "week" | "month" | "year"
  >("all");
  const [showSalesFilters, setShowSalesFilters] = useState(false);
  const salesFiltersRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showSalesFilters) return;
    const handleOutsideClick = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !salesFiltersRef.current?.contains(event.target)
      ) {
        setShowSalesFilters(false);
      }
    };
    document.addEventListener("pointerdown", handleOutsideClick);
    return () =>
      document.removeEventListener("pointerdown", handleOutsideClick);
  }, [showSalesFilters]);
  const [orderStatusFilter, setOrderStatusFilter] = useState<
    | ""
    | "Pending"
    | "Confirmed"
    | "In progress"
    | "Ready"
    | "Completed"
    | "Cancelled"
  >("");
  const [orderPeriod, setOrderPeriod] = useState<
    "all" | "today" | "week" | "month" | "year"
  >("all");
  const [orderView, setOrderView] = useState<
    "open" | "completed" | "cancelled" | "archived"
  >("open");
  const [showOrderFilters, setShowOrderFilters] = useState(false);
  const orderFiltersRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showOrderFilters) return;
    const handleOutsideClick = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !orderFiltersRef.current?.contains(event.target)
      ) {
        setShowOrderFilters(false);
      }
    };
    document.addEventListener("pointerdown", handleOutsideClick);
    return () =>
      document.removeEventListener("pointerdown", handleOutsideClick);
  }, [showOrderFilters]);
  if (active === "Expenses")
    return (
      <ExpenseManagement
        state={state}
        currentUser={currentUser}
        onViewPayrollRun={onViewPayrollRun}
      />
    );
  if (active === "Raw Material Management")
    return <RawMaterialManagement />;
  if (active === "Orders")
    return (
      <OrdersManagement
        state={state}
        currentUser={currentUser}
        customersLoaded={customersLoaded}
        customersApiLoaded={customersApiLoaded}
        customerLoadError={customerLoadError}
        onRetryCustomers={onRetryCustomers}
        onStateChange={updateState}
      />
    );
  if (active === "Production Management")
    return <ProductionManagement />;
  if (active === "Assets Management")
    return (
      <AssetManagement
        state={state}
        canRead={assetCanRead}
        canEdit={assetCanEdit}
      />
    );
  if (active === "Data Backup")
    return (
      <section role="status" className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <h2 className="text-lg font-semibold text-slate-900">Data Backup is coming soon</h2>
        <p className="mt-1 text-sm text-slate-500">This section is not available yet.</p>
      </section>
    );
  if (active === "Company Profile Management")
    return (
      <CompanyProfileManagement
        profile={state.companyProfile}
        canEdit={companyProfileEditable}
        onSave={onCompanyProfileSave}
      />
    );
  if (active === "User Management")
    return <UserManagement currentUser={currentUser} />;
  if (active === "Security Settings")
    return (
      <SecuritySettings
        currentUser={currentUser}
        onCurrentSessionRevoked={onCurrentSessionRevoked}
      />
    );
  if (active === "Approvals")
    return (
      <Approvals
        currentUser={currentUser}
        onViewSalaryAdvance={onViewSalaryAdvance}
        onViewPayrollRun={onViewPayrollRun}
      />
    );
  const kind = active.split(" ")[0];
  const data =
    active === "Sales"
      ? state.sales
      : active === "Orders"
        ? state.orders
        : active === "Customer Management"
          ? state.customers
          : active === "Employee Profiles"
            ? state.employees
            : state.activities;
  const today = new Date().toISOString().slice(0, 10);
  const periodStartDate = new Date(`${today}T00:00:00.000Z`);
  if (salesPeriod === "week") {
    periodStartDate.setUTCDate(
      periodStartDate.getUTCDate() - ((periodStartDate.getUTCDay() + 6) % 7),
    );
  } else if (salesPeriod === "month") {
    periodStartDate.setUTCDate(1);
  } else if (salesPeriod === "year") {
    periodStartDate.setUTCMonth(0, 1);
  }
  const periodStart =
    salesPeriod === "all" ? "" : periodStartDate.toISOString().slice(0, 10);
  const orderPeriodStartDate = new Date(`${today}T00:00:00.000Z`);
  if (orderPeriod === "week") {
    orderPeriodStartDate.setUTCDate(
      orderPeriodStartDate.getUTCDate() -
        ((orderPeriodStartDate.getUTCDay() + 6) % 7),
    );
  } else if (orderPeriod === "month") {
    orderPeriodStartDate.setUTCDate(1);
  } else if (orderPeriod === "year") {
    orderPeriodStartDate.setUTCMonth(0, 1);
  }
  const orderPeriodStart =
    orderPeriod === "all"
      ? ""
      : orderPeriodStartDate.toISOString().slice(0, 10);
  const filtered = data.filter((item) => {
    const matchesSearch = JSON.stringify(item)
      .toLowerCase()
      .includes(search.toLowerCase());
    const itemDate = (item as { date?: string }).date;
    const matchesStartDate =
      active !== "Sales" || !salesFromDate || (itemDate ?? "") >= salesFromDate;
    const matchesPeriod =
      active !== "Sales" ||
      !periodStart ||
      ((itemDate ?? "") >= periodStart && (itemDate ?? "") <= today);
    const matchesOrderStatus =
      active !== "Orders" ||
      !orderStatusFilter ||
      (item as { status?: string }).status === orderStatusFilter;
    const matchesOrderPeriod =
      active !== "Orders" ||
      !orderPeriodStart ||
      ((itemDate ?? "") >= orderPeriodStart && (itemDate ?? "") <= today);
    const order = item as ErpState["orders"][number];
    const matchesOrderView =
      active !== "Orders" ||
      (orderView === "open"
        ? !order.archivedAt &&
          !["Completed", "Cancelled"].includes(order.status)
        : orderView === "completed"
          ? order.status === "Completed" && !order.archivedAt
          : orderView === "cancelled"
            ? order.status === "Cancelled" && !order.archivedAt
            : Boolean(order.archivedAt));
    return (
      matchesSearch &&
      matchesStartDate &&
      matchesPeriod &&
      matchesOrderStatus &&
      matchesOrderPeriod &&
      matchesOrderView
    );
  });
  const displayedData =
    active === "Orders"
      ? [...filtered].sort((left, right) => {
          const leftOrder = left as ErpState["orders"][number];
          const rightOrder = right as ErpState["orders"][number];
          const leftOverride =
            leftOrder.priority === "High" && Boolean(leftOrder.priorityReason);
          const rightOverride =
            rightOrder.priority === "High" &&
            Boolean(rightOrder.priorityReason);
          if (orderView === "open" && leftOverride !== rightOverride)
            return leftOverride ? -1 : 1;
          return leftOrder.createdAt.localeCompare(rightOrder.createdAt);
        })
      : filtered;
  const isDashboardLike = active === "Reporting";
  const updateOrder = (
    orderId: string,
    updates: Partial<ErpState["orders"][number]>,
  ) => {
    updateState({
      ...state,
      orders: state.orders.map((order) => {
        if (order.id !== orderId) return order;
        const statusHistory =
          updates.status && updates.status !== order.status
            ? [
                ...order.statusHistory,
                { status: updates.status, at: new Date().toISOString() },
              ]
            : order.statusHistory;
        return { ...order, ...updates, statusHistory };
      }),
    });
  };
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = { ...state };
    if (active === "Sales") {
      const paymentTerms = String(form.get("paymentTerms") || "Same-day");
      const selectedCustomerId = String(form.get("customerId") || "");
      const customerId =
        selectedCustomerId === "__walkin__" ? "" : selectedCustomerId;
      const customerName = customerId
        ? state.customers.find((customer) => customer.id === customerId)
            ?.name || ""
        : "Walk-in customer";
      const sale: ErpState["sales"][number] = {
        id: createId("S"),
        reference: createId("SAL"),
        date: new Date().toISOString().slice(0, 10),
        customer: customerName,
        customerId: customerId || undefined,
        product: String(form.get("product") || "Premium Maize Flour"),
        quantity: Number(form.get("quantity") || 1),
        total: Number(form.get("amount") || 0),
        status: String(
          paymentTerms === "Credit" ? "Pending" : form.get("status") || "Paid",
        ) as "Paid" | "Pending",
        method: String(
          paymentTerms === "Credit"
            ? "Credit terms"
            : form.get("method") || "Cash",
        ),
        txnID: String(form.get("txnID") || "") || undefined,
        paymentTerms: paymentTerms as "Same-day" | "Credit",
        dueDate:
          String(paymentTerms === "Credit" ? form.get("dueDate") || "" : "") ||
          undefined,
      };
      next.sales = [sale, ...state.sales];
      const saleCustomer = state.customers.find(
        (customer) => customer.id === sale.customerId,
      );
      next.invoices = [
        createInvoiceDraft(sale, saleCustomer, state.companyProfile),
        ...state.invoices,
      ];
    }
    if (active === "Orders") {
      const submittedItems = JSON.parse(
        String(form.get("items") || "[]"),
      ) as ErpState["orders"][number]["items"];
      const newCustomer = form.get("customer") === "__new__";
      const customerId = newCustomer
        ? createId("C")
        : String(form.get("customer") || "");
      const selectedCustomer = state.customers.find(
        (customer) => customer.id === customerId,
      );
      const customerName = newCustomer
        ? String(form.get("newCustomerName") || "").trim()
        : selectedCustomer?.name || "";
      if (newCustomer) {
        next.customers = [
          {
            id: customerId,
            name: customerName,
            type: String(form.get("newCustomerType") || "Small dealer"),
            contact: String(form.get("newCustomerContact") || "").trim(),
            phone: String(form.get("newCustomerPhone") || ""),
            email: String(form.get("newCustomerEmail") || ""),
            region: String(form.get("newCustomerRegion") || "") || undefined,
            district:
              String(form.get("newCustomerDistrict") || "") || undefined,
            tin: String(form.get("newCustomerTin") || "") || undefined,
            country: String(form.get("newCustomerCountry") || "") || undefined,
            referredBy: String(form.get("newCustomerReferredBy") || "").trim(),
            createdAt: new Date().toISOString(),
            status: "Active",
            purchases: 0,
          },
          ...state.customers,
        ];
      }
      next.orders = [
        {
          id: createId("ORD"),
          reference: createId("ORD"),
          date: new Date().toISOString().slice(0, 10),
          createdAt: new Date().toISOString(),
          customer: customerName,
          customerId,
          items: submittedItems.map((item) => ({
            ...item,
            id: createId("ITEM"),
          })),
          total: submittedItems.reduce(
            (total, item) => total + item.lineTotal,
            0,
          ),
          requestedDate: String(form.get("requestedDate")),
          fulfilmentMethod: String(form.get("fulfilmentMethod")) as
            | "Delivery"
            | "Pickup",
          destination: String(form.get("destination") || ""),
          paymentTerms: String(form.get("paymentTerms")) as
            | "Paid now"
            | "Same-day"
            | "Credit",
          status: "Pending",
          statusHistory: [{ status: "Pending", at: new Date().toISOString() }],
          priority: String(form.get("priority")) as "Normal" | "High",
          priorityReason: String(form.get("priorityReason") || "") || undefined,
          notes: String(form.get("notes") || ""),
        },
        ...state.orders,
      ];
    }
    if (active === "Customer Management")
      next.customers = [
        {
          id: createId("C"),
          name: String(form.get("name") || "New customer"),
          type: "Retail",
          phone: String(form.get("phone") || ""),
          email: String(form.get("email") || ""),
          status: "Active",
          purchases: 0,
        },
        ...state.customers,
      ];
    if (active === "Employee Profiles")
      next.employees = [
        {
          id: createId("E"),
          number: createId("EMP"),
          name: String(form.get("name") || "New employee"),
          category: "Staff",
          department: String(form.get("department") || "Operations"),
          role: String(form.get("role") || "Team member"),
          status: "Active",
          salary: Number(form.get("salary") || 0),
        },
        ...state.employees,
      ];
    updateState(next);
    setShowForm(false);
    setToast(`${kind} record saved successfully`);
    setTimeout(() => setToast(""), 2600);
  };
  if (active === "Leave Management") {
    return (
      <LeaveManagement
        state={state}
        updateState={updateState}
        currentUser={currentUser}
        onViewEmployee={(id) =>
          window.dispatchEvent(
            new CustomEvent("erp:view", { detail: { type: "employee", id } }),
          )
        }
      />
    );
  }
  if (active === "Disciplinary Letters") {
    return <DisciplinaryLettersPage state={state} currentUser={currentUser} />;
  }
  if (active === "Customer Management") {
    if (!customerCanRead) {
      return (
        <section role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          You do not have permission to view customer records.
        </section>
      );
    }
    return (
      <CustomerManagementPage
        state={state}
        updateCustomers={updateCustomers}
        customersLoaded={customersLoaded}
        loadError={customerLoadError}
        onRetry={onRetryCustomers}
        canManage={customerCanManage}
        onView={onView}
      />
    );
  }
  if (active === "Invoicing") {
    return (
      <section role="status" className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <h2 className="text-lg font-semibold text-slate-900">Invoicing is coming soon</h2>
        <p className="mt-1 text-sm text-slate-500">This section is not available yet.</p>
      </section>
    );
  }
  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 text-xs font-medium text-slate-400">
            Workspace / {active}
          </div>
          <h2 className="text-2xl font-bold tracking-tight">{active}</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Manage {active.toLowerCase()} with connected mock workflows and
            local demonstration persistence.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() =>
              exportCsv(
                `${active.toLowerCase().replaceAll(" ", "-")}.csv`,
                displayedData as unknown as Record<string, unknown>[],
              )
            }
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm"
          >
            <Download className="size-4" /> Export CSV
          </button>
          {![
            "Auditing",
            "Analysis",
            "Reporting",
            "Data Backup",
            "Security Settings",
          ].includes(active) && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-[#6d28d9] px-3 py-2 text-xs font-semibold text-white shadow-sm shadow-purple-200"
            >
              <Plus className="size-4" /> Add {kind}
            </button>
          )}
        </div>
      </div>
      {toast && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {toast}
        </div>
      )}
      {isDashboardLike ? (
        <AnalyticsPanel active={active} state={state} />
      ) : (
        <>
          {active === "Sales" ? (
            <SalesKpis sales={state.sales} />
          ) : active === "Orders" ? (
            <OrdersKpis orders={state.orders} />
          ) : (
            <div className="mb-4 grid gap-4 sm:grid-cols-3">
              <Kpi
                label="Total records"
                value={String(data.length)}
                change="Live demo data"
                icon="Layers3"
                tone="purple"
                onClick={() => undefined}
              />
              <Kpi
                label="Active / approved"
                value={String(
                  data.filter((item: any) =>
                    ["Active", "Paid", "Approved", "Success"].includes(
                      item.status || item.outcome,
                    ),
                  ).length,
                )}
                change="Across this module"
                icon="CircleCheck"
                tone="green"
                onClick={() => undefined}
              />
              <Kpi
                label="Updated today"
                value={String(Math.max(1, Math.ceil(data.length / 3)))}
                change="Recent activity"
                icon="Clock3"
                tone="blue"
                onClick={() => undefined}
              />
            </div>
          )}
          {active === "Orders" && (
            <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
              {(
                [
                  ["open", "Open queue"],
                  ["completed", "Completed"],
                  ["cancelled", "Cancelled"],
                  ["archived", "Archived"],
                ] as const
              ).map(([view, label]) => (
                <button
                  key={view}
                  type="button"
                  aria-pressed={orderView === view}
                  onClick={() => {
                    setOrderView(view);
                    setOrderStatusFilter("");
                  }}
                  className={`border-b-2 px-3 py-2.5 text-xs font-semibold ${orderView === view ? "border-[#6d28d9] text-[#6d28d9]" : "border-transparent text-slate-500 hover:text-slate-800"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <Search className="size-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-transparent text-xs outline-none placeholder:text-slate-400 sm:w-64"
                  placeholder={`Search ${active.toLowerCase()}...`}
                />
              </div>
              <div className="flex gap-2">
                {active === "Sales" && (
                  <div className="relative" ref={salesDatePickerRef}>
                    <button
                      type="button"
                      aria-expanded={showSalesDatePicker}
                      onClick={() => setShowSalesDatePicker((open) => !open)}
                      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${salesFromDate ? "border-[#c4b5fd] bg-[#f5f0ff] text-[#5b21b6]" : "border-slate-200 bg-white text-slate-600"}`}
                    >
                      <Icons.CalendarDays className="size-4" />
                      {salesFromDate
                        ? `Sales from ${salesFromDate}`
                        : "Sales from"}
                    </button>
                    {showSalesDatePicker && (
                      <div className="absolute right-0 top-full z-20 mt-2 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
                        <label className="flex flex-col gap-2 text-xs font-semibold text-slate-600">
                          <span>Show sales from date</span>
                          <input
                            autoFocus
                            type="date"
                            value={salesFromDate}
                            onChange={(event) => {
                              setSalesFromDate(event.target.value);
                              setShowSalesDatePicker(false);
                            }}
                            className="rounded-md border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-[#8b5cf6]"
                          />
                        </label>
                        {salesFromDate && (
                          <button
                            type="button"
                            onClick={() => {
                              setSalesFromDate("");
                              setShowSalesDatePicker(false);
                            }}
                            className="mt-2 text-xs font-medium text-slate-500 hover:text-slate-900"
                          >
                            Clear date filter
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {active === "Orders" ? (
                  <select
                    aria-label="Filter orders by status"
                    value={orderStatusFilter}
                    onChange={(event) =>
                      setOrderStatusFilter(
                        event.target.value as typeof orderStatusFilter,
                      )
                    }
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
                  >
                    <option value="">All statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="In progress">In progress</option>
                    <option value="Ready">Ready</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                ) : (
                  <select className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                    <option>All statuses</option>
                    <option>Active</option>
                    <option>Pending</option>
                    <option>Paid</option>
                  </select>
                )}
                {active === "Sales" ? (
                  <div className="relative" ref={salesFiltersRef}>
                    <button
                      type="button"
                      aria-label="Filter sales by period"
                      aria-expanded={showSalesFilters}
                      aria-haspopup="dialog"
                      onClick={() => setShowSalesFilters((open) => !open)}
                      className={`rounded-lg border p-2 ${salesPeriod !== "all" ? "border-[#c4b5fd] bg-[#f5f0ff] text-[#5b21b6]" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
                    >
                      <Icons.SlidersHorizontal className="size-4" />
                    </button>
                    {showSalesFilters && (
                      <div
                        role="dialog"
                        aria-label="Filter sales by date"
                        className="absolute right-0 top-full z-20 mt-2 w-48 rounded-lg border border-slate-200 bg-white p-2 shadow-lg"
                      >
                        <div className="px-2 py-1.5 text-xs font-semibold text-slate-500">
                          Filter sales by
                        </div>
                        {(
                          [
                            ["today", "Today"],
                            ["week", "This week"],
                            ["month", "This month"],
                            ["year", "This year"],
                          ] as const
                        ).map(([period, label]) => (
                          <button
                            key={period}
                            type="button"
                            aria-pressed={salesPeriod === period}
                            onClick={() => {
                              setSalesPeriod(period);
                              setShowSalesFilters(false);
                            }}
                            className={`flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-xs ${salesPeriod === period ? "bg-[#f5f0ff] font-semibold text-[#5b21b6]" : "text-slate-600 hover:bg-slate-50"}`}
                          >
                            {label}
                            {salesPeriod === period && (
                              <Icons.Check className="size-3.5" />
                            )}
                          </button>
                        ))}
                        <div className="my-1 border-t border-slate-100" />
                        <button
                          type="button"
                          onClick={() => {
                            setOrderView("archived");
                            setShowOrderFilters(false);
                            setOrderStatusFilter("");
                          }}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"
                        >
                          <Icons.Archive className="size-3.5 text-slate-400" />
                          Archived sales
                        </button>
                      </div>
                    )}
                  </div>
                ) : active === "Orders" ? (
                  <div className="relative" ref={orderFiltersRef}>
                    <button
                      type="button"
                      aria-label="Filter orders by period"
                      aria-expanded={showOrderFilters}
                      aria-haspopup="dialog"
                      onClick={() => setShowOrderFilters((open) => !open)}
                      className={`rounded-lg border p-2 ${orderPeriod !== "all" ? "border-[#c4b5fd] bg-[#f5f0ff] text-[#5b21b6]" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
                    >
                      <Icons.SlidersHorizontal className="size-4" />
                    </button>
                    {showOrderFilters && (
                      <div
                        role="dialog"
                        aria-label="Filter orders by date"
                        className="absolute right-0 top-full z-20 mt-2 w-48 rounded-lg border border-slate-200 bg-white p-2 shadow-lg"
                      >
                        <div className="px-2 py-1.5 text-xs font-semibold text-slate-500">
                          Filter orders by
                        </div>
                        {(
                          [
                            ["today", "Today"],
                            ["week", "This week"],
                            ["month", "This month"],
                            ["year", "This year"],
                            ["all", "All dates"],
                          ] as const
                        ).map(([period, label]) => (
                          <button
                            key={period}
                            type="button"
                            aria-pressed={orderPeriod === period}
                            onClick={() => {
                              setOrderPeriod(period);
                              setShowOrderFilters(false);
                            }}
                            className={`flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-xs ${orderPeriod === period ? "bg-[#f5f0ff] font-semibold text-[#5b21b6]" : "text-slate-600 hover:bg-slate-50"}`}
                          >
                            {label}
                            {orderPeriod === period && (
                              <Icons.Check className="size-3.5" />
                            )}
                          </button>
                        ))}
                        <div className="my-1 border-t border-slate-100" />
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"
                        >
                          <Icons.Archive className="size-3.5 text-slate-400" />
                          Archived
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <button className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50">
                    <Icons.SlidersHorizontal className="size-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {tableHeaders(active).map((header) => (
                      <th key={header} className="px-5 py-3">
                        {header}
                      </th>
                    ))}
                    <th className="px-5 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedData.map((item: any, index) => (
                    <TableRow
                      key={item.id || index}
                      item={item}
                      active={active}
                      invoice={
                        active === "Sales"
                          ? state.invoices.find(
                              (invoice) => invoice.saleId === item.id,
                            )
                          : undefined
                      }
                      companyName={
                        state.companyProfile.tradingName ||
                        state.companyProfile.legalName ||
                        companyName
                      }
                      companyLogoUrl={companyLogoUrl}
                      queuePosition={index + 1}
                      onOrderStatusChange={(orderId, status) =>
                        updateOrder(orderId, {
                          status,
                          completedAt:
                            status === "Completed"
                              ? new Date().toISOString()
                              : undefined,
                        })
                      }
                      onArchiveOrder={(orderId, archived) =>
                        updateOrder(orderId, {
                          archivedAt: archived
                            ? new Date().toISOString()
                            : undefined,
                        })
                      }
                    />
                  ))}
                </tbody>
              </table>
              {!filtered.length && (
                <div className="py-16 text-center">
                  <div className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-slate-100">
                    <Search className="size-4 text-slate-400" />
                  </div>
                  <div className="text-sm font-semibold">No records found</div>
                  <div className="mt-1 text-xs text-slate-400">
                    Try a different search or add a new record.
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-[11px] text-slate-400">
              <span>
                Showing {displayedData.length} of {data.length} records
              </span>
              <div className="flex gap-1">
                <button className="rounded border border-slate-200 p-1.5">
                  <ChevronLeft className="size-3.5" />
                </button>
                <button className="rounded bg-[#6d28d9] px-2.5 py-1.5 font-semibold text-white">
                  1
                </button>
                <button className="rounded border border-slate-200 p-1.5">
                  <ChevronRight className="size-3.5" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      {showForm && (
        <FormDialog
          active={active}
          customers={state.customers}
          onClose={() => setShowForm(false)}
          onSubmit={submit}
        />
      )}
    </div>
  );
}
function SalesKpis({ sales }: { sales: ErpState["sales"] }) {
  const today = new Date().toISOString().slice(0, 10);
  const weekStartDate = new Date();
  weekStartDate.setHours(0, 0, 0, 0);
  weekStartDate.setDate(
    weekStartDate.getDate() - ((weekStartDate.getDay() + 6) % 7),
  );
  const weekStart = weekStartDate.toISOString().slice(0, 10);
  const todaysSales = sales.filter((sale) => sale.date === today);
  const pendingSales = sales.filter(
    (sale) =>
      sale.status === "Pending" &&
      (sale.paymentTerms ?? "Same-day") === "Same-day",
  );
  const pendingCustomerCount = new Set(
    pendingSales.map((sale) => sale.customer.trim().toLowerCase()),
  ).size;
  const debtSales = sales.filter(
    (sale) => sale.status === "Pending" && sale.paymentTerms === "Credit",
  );
  const currentWeekSales = sales.filter(
    (sale) => sale.date >= weekStart && sale.date <= today,
  );
  const debtorCount = new Set(
    debtSales.map((sale) => sale.customer.trim().toLowerCase()),
  ).size;

  return (
    <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi
        label="Total sales today"
        value={money(sum(todaysSales.map((sale) => sale.total)))}
        change={`${todaysSales.length} sales`}
        icon="TrendingUp"
        tone="purple"
        onClick={() => undefined}
      />
      <Kpi
        label="Pending sales"
        value={`${pendingSales.length} sales`}
        change={`Total ${money(sum(pendingSales.map((sale) => sale.total)))} · ${pendingCustomerCount} customers`}
        icon="Clock3"
        tone="amber"
        onClick={() => undefined}
      />
      <Kpi
        label="Outstanding debt sales"
        value={money(sum(debtSales.map((sale) => sale.total)))}
        change={`${debtSales.length} sales · ${debtorCount} customers`}
        icon="HandCoins"
        tone="blue"
        onClick={() => undefined}
      />
      <Kpi
        label="Sales this week"
        value={money(sum(currentWeekSales.map((sale) => sale.total)))}
        change={`${currentWeekSales.length} sales · Since ${weekStart}`}
        icon="BarChart3"
        tone="green"
        onClick={() => undefined}
      />
    </div>
  );
}

function OrdersKpis({ orders }: { orders: ErpState["orders"] }) {
  const today = new Date().toISOString().slice(0, 10);
  const currentDate = new Date(`${today}T00:00:00.000Z`);
  const weekStartDate = new Date(currentDate);
  weekStartDate.setUTCDate(
    weekStartDate.getUTCDate() - ((weekStartDate.getUTCDay() + 6) % 7),
  );
  const weekStart = weekStartDate.toISOString().slice(0, 10);
  const openOrders = orders.filter(
    (order) =>
      !order.archivedAt && !["Completed", "Cancelled"].includes(order.status),
  );
  const completedThisWeek = orders.filter(
    (order) =>
      order.status === "Completed" &&
      (order.completedAt ?? "").slice(0, 10) >= weekStart &&
      (order.completedAt ?? "").slice(0, 10) <= today,
  );
  const dueToday = openOrders.filter((order) => order.requestedDate === today);
  const overdue = openOrders.filter((order) => order.requestedDate < today);
  const openCustomerCount = new Set(
    openOrders.map((order) => order.customer.trim().toLowerCase()),
  ).size;

  return (
    <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi
        label="Open orders"
        value={`${openOrders.length} orders`}
        change={`Expected ${money(sum(openOrders.map((order) => order.total)))} · ${openCustomerCount} customers`}
        icon="ClipboardList"
        tone="amber"
        onClick={() => undefined}
      />
      <Kpi
        label="Due today"
        value={`${dueToday.length} orders`}
        change={money(sum(dueToday.map((order) => order.total)))}
        icon="CalendarCheck"
        tone="green"
        onClick={() => undefined}
      />
      <Kpi
        label="Overdue orders"
        value={`${overdue.length} orders`}
        change={money(sum(overdue.map((order) => order.total)))}
        icon="CalendarDays"
        tone="blue"
        onClick={() => undefined}
      />
      <Kpi
        label="Completed this week"
        value={`${completedThisWeek.length} orders`}
        change="Fulfilment completed"
        icon="ChartNoAxesCombined"
        tone="purple"
        onClick={() => undefined}
      />
    </div>
  );
}

function tableHeaders(active: string) {
  if (active === "Sales")
    return ["Reference", "Customer", "Product", "Date", "Total", "Status"];
  if (active === "Orders")
    return [
      "Order / queue",
      "Customer",
      "Items",
      "Received / due",
      "Total",
      "Priority / status",
    ];
  if (active === "Customer Management")
    return ["Customer", "Type", "Contact", "Transactions", "Status"];
  if (active === "Employee Profiles")
    return ["Employee", "Department", "Role", "Category", "Salary", "Status"];
  return ["Reference / name", "Module", "Details", "Date", "Owner", "Status"];
}
function TableRow({
  item,
  active,
  invoice,
  companyName,
  companyLogoUrl,
  queuePosition,
  onOrderStatusChange,
  onArchiveOrder,
}: {
  item: any;
  active: string;
  invoice?: Invoice;
  companyName: string;
  companyLogoUrl: string;
  queuePosition?: number;
  onOrderStatusChange?: (
    orderId: string,
    status: ErpState["orders"][number]["status"],
  ) => void;
  onArchiveOrder?: (orderId: string, archived: boolean) => void;
}) {
  const [showSalesActions, setShowSalesActions] = useState(false);
  const [showSalesDetails, setShowSalesDetails] = useState(false);
  const [showOrderActions, setShowOrderActions] = useState(false);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const salesActionsRef = useRef<HTMLDivElement>(null);
  const orderActionsRef = useRef<HTMLDivElement>(null);
  const orderStatusTransitions: Partial<
    Record<
      ErpState["orders"][number]["status"],
      ErpState["orders"][number]["status"]
    >
  > = {
    Pending: "Confirmed",
    Confirmed: "In progress",
    "In progress": "Ready",
    Ready: "Completed",
  };
  const nextOrderStatus =
    orderStatusTransitions[item.status as ErpState["orders"][number]["status"]];
  useEffect(() => {
    if (!showSalesActions) return;
    const handleOutsideClick = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !salesActionsRef.current?.contains(event.target)
      ) {
        setShowSalesActions(false);
      }
    };
    document.addEventListener("pointerdown", handleOutsideClick);
    return () =>
      document.removeEventListener("pointerdown", handleOutsideClick);
  }, [showSalesActions]);
  useEffect(() => {
    if (!showOrderActions) return;
    const handleOutsideClick = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !orderActionsRef.current?.contains(event.target)
      ) {
        setShowOrderActions(false);
      }
    };
    document.addEventListener("pointerdown", handleOutsideClick);
    return () =>
      document.removeEventListener("pointerdown", handleOutsideClick);
  }, [showOrderActions]);
  let cells: React.ReactNode[] = [];
  if (active === "Sales")
    cells = [
      <span className="font-semibold text-slate-700">{item.reference}</span>,
      item.customer,
      item.product,
      formatDate(item.date),
      money(item.total),
      <Status text={item.status} />,
    ];
  else if (active === "Orders")
    cells = [
      <div>
        <div className="font-semibold text-slate-700">
          #{queuePosition} · {item.reference}
        </div>
        <div className="mt-1 text-[10px] text-slate-400">
          Received {item.createdAt.slice(11, 16)}
        </div>
      </div>,
      item.customer,
      <div className="max-w-[260px]">
        {item.items.map(
          (orderItem: ErpState["orders"][number]["items"][number]) => (
            <div key={orderItem.id} className="truncate">
              {orderItem.product}{" "}
              <span className="text-slate-400">× {orderItem.quantity}</span>
            </div>
          ),
        )}
      </div>,
      <div>
        <div>{formatDate(item.date)}</div>
        <div
          className={`mt-1 text-[10px] font-semibold ${item.requestedDate < new Date().toISOString().slice(0, 10) && !["Completed", "Cancelled"].includes(item.status) ? "text-red-600" : item.requestedDate === new Date().toISOString().slice(0, 10) ? "text-amber-600" : "text-slate-400"}`}
        >
          {item.requestedDate < new Date().toISOString().slice(0, 10) &&
          !["Completed", "Cancelled"].includes(item.status)
            ? "Overdue · "
            : "Due "}
          {formatDate(item.requestedDate)}
        </div>
      </div>,
      money(item.total),
      <span>
        <Status text={item.priority} />
        {item.priorityReason && (
          <span
            className="block max-w-28 truncate text-[9px] text-amber-700"
            title={item.priorityReason}
          >
            Override recorded
          </span>
        )}
        <Status text={item.status} />
      </span>,
    ];
  else if (active === "Customer Management")
    cells = [
      <button
        onClick={() =>
          window.dispatchEvent(
            new CustomEvent("erp:view", {
              detail: { type: "customer", id: item.id },
            }),
          )
        }
        className="font-semibold text-slate-700 hover:text-[#6d28d9] hover:underline"
      >
        {item.name}
      </button>,
      item.type,
      <span>
        {item.phone}
        <br />
        <span className="text-[10px] text-slate-400">{item.email}</span>
      </span>,
      item.purchases,
      <Status text={item.status} />,
    ];
  else if (active === "Employee Profiles")
    cells = [
      <button
        onClick={() =>
          window.dispatchEvent(
            new CustomEvent("erp:view", {
              detail: { type: "employee", id: item.id },
            }),
          )
        }
        className="text-left font-semibold text-slate-700 hover:text-[#6d28d9] hover:underline"
      >
        {item.name}
        <br />
        <span className="text-[10px] font-normal text-slate-400">
          {item.number}
        </span>
      </button>,
      item.department,
      item.role,
      item.category,
      money(item.salary),
      <Status text={item.status} />,
    ];
  else
    cells = [
      <span className="font-semibold text-slate-700">
        {item.action || item.name || item.id}
      </span>,
      item.module || item.category || "General",
      item.description || item.actor || item.role || "—",
      item.time || item.date || "Today",
      item.actor || item.department || "System",
      <Status text={item.outcome || item.status || "Active"} />,
    ];
  return (
    <tr className="border-b border-slate-50 text-xs text-slate-500 last:border-0 hover:bg-slate-50/50">
      {cells.map((cell, i) => (
        <td key={i} className="px-5 py-4 align-middle">
          {cell}
        </td>
      ))}
      <td className="px-5 py-4">
        {active === "Sales" ? (
          <div className="relative" ref={salesActionsRef}>
            <button
              type="button"
              aria-label={`Actions for ${item.reference}`}
              aria-expanded={showSalesActions}
              onClick={() => setShowSalesActions((open) => !open)}
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-[#6d28d9]"
            >
              <Icons.MoreHorizontal className="size-4" />
            </button>
            {showSalesActions && (
              <div
                role="dialog"
                aria-label={`Sales actions for ${item.reference}`}
                className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg"
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowSalesActions(false);
                    setShowSalesDetails(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"
                >
                  <Icons.Eye className="size-3.5 text-slate-400" /> View details
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSalesActions(false);
                    setShowSalesDetails(true);
                    window.setTimeout(() => window.print(), 0);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"
                >
                  <Icons.Printer className="size-3.5 text-slate-400" /> Print
                  receipt
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"
                >
                  <Icons.Download className="size-3.5 text-slate-400" />{" "}
                  Download
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"
                >
                  <Icons.Archive className="size-3.5 text-slate-400" /> Archive
                </button>
                {item.status === "Pending" && (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"
                  >
                    <Icons.CircleCheck className="size-3.5 text-slate-400" />{" "}
                    Set paid
                  </button>
                )}
              </div>
            )}
          </div>
        ) : active === "Orders" ? (
          <div className="relative" ref={orderActionsRef}>
            <button
              type="button"
              aria-label={`Actions for ${item.reference}`}
              aria-expanded={showOrderActions}
              onClick={() => setShowOrderActions((open) => !open)}
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-[#6d28d9]"
            >
              <Icons.MoreHorizontal className="size-4" />
            </button>
            {showOrderActions && (
              <div
                role="menu"
                className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setShowOrderDetails(true);
                    setShowOrderActions(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"
                >
                  <Icons.Eye className="size-3.5 text-slate-400" /> View order
                  details
                </button>
                {nextOrderStatus && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onOrderStatusChange?.(item.id, nextOrderStatus);
                      setShowOrderActions(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"
                  >
                    <Icons.ArrowRight className="size-3.5 text-slate-400" />{" "}
                    Move to {nextOrderStatus}
                  </button>
                )}
                {!item.archivedAt &&
                  !["Completed", "Cancelled"].includes(item.status) && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onOrderStatusChange?.(item.id, "Cancelled");
                        setShowOrderActions(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"
                    >
                      <Icons.CircleX className="size-3.5 text-slate-400" />{" "}
                      Cancel order
                    </button>
                  )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onArchiveOrder?.(item.id, !item.archivedAt);
                    setShowOrderActions(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"
                >
                  {item.archivedAt ? (
                    <>
                      <Icons.ArchiveRestore className="size-3.5 text-slate-400" />{" "}
                      Restore order
                    </>
                  ) : (
                    <>
                      <Icons.Archive className="size-3.5 text-slate-400" />{" "}
                      Archive order
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        ) : (
          <button className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-[#6d28d9]">
            <Icons.MoreHorizontal className="size-4" />
          </button>
        )}
        {active === "Sales" && showSalesDetails && (
          <SalesDetailsDialog
            sale={item}
            invoice={invoice}
            companyName={companyName}
            companyLogoUrl={companyLogoUrl}
            onClose={() => setShowSalesDetails(false)}
          />
        )}
        {active === "Orders" && showOrderDetails && (
          <OrderDetailsDialog
            order={item}
            onClose={() => setShowOrderDetails(false)}
          />
        )}
      </td>
    </tr>
  );
}

function OrderDetailsDialog({
  order,
  onClose,
}: {
  order: ErpState["orders"][number];
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-details-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2
              id="order-details-title"
              className="text-base font-bold text-slate-900"
            >
              Order details
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {order.reference} · Received {formatDate(order.date)}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close order details"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div>
            <div className="text-[11px] text-slate-400">Customer</div>
            <div className="mt-1 text-sm font-semibold">{order.customer}</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Status</div>
            <Status text={order.status} />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Requested date</div>
            <div className="mt-1 text-sm font-semibold">
              {formatDate(order.requestedDate)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Fulfilment</div>
            <div className="mt-1 text-sm font-semibold">
              {order.fulfilmentMethod}
              {order.destination ? ` · ${order.destination}` : ""}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Payment terms</div>
            <div className="mt-1 text-sm font-semibold">
              {order.paymentTerms}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Priority</div>
            <div className="mt-1 text-sm font-semibold">{order.priority}</div>
            {order.priorityReason && (
              <p className="mt-1 text-xs text-amber-700">
                Override: {order.priorityReason}
              </p>
            )}
          </div>
          <div className="sm:col-span-2">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
              Items
            </h3>
            <div className="divide-y divide-slate-100 border-y border-slate-100">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between gap-4 py-2.5 text-sm"
                >
                  <span>
                    {item.product}{" "}
                    <span className="text-slate-400">
                      × {item.quantity} at {money(item.unitPrice)}
                    </span>
                  </span>
                  <strong>{money(item.lineTotal)}</strong>
                </div>
              ))}
            </div>
            <div className="mt-3 text-right text-base font-bold">
              Total: {money(order.total)}
            </div>
          </div>
          {order.notes && (
            <div className="sm:col-span-2">
              <div className="text-[11px] text-slate-400">Notes</div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                {order.notes}
              </p>
            </div>
          )}
          <div className="sm:col-span-2">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
              Status history
            </h3>
            <div className="space-y-2">
              {order.statusHistory.map((change, index) => (
                <div
                  key={`${change.at}-${index}`}
                  className="flex justify-between gap-4 text-xs"
                >
                  <span className="font-semibold text-slate-700">
                    {change.status}
                  </span>
                  <time className="text-slate-400">
                    {new Intl.DateTimeFormat("en-GB", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(change.at))}
                  </time>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </section>
    </div>
  );
}

function SalesDetailsDialog({
  sale,
  invoice,
  companyName,
  companyLogoUrl,
  onClose,
}: {
  sale: ErpState["sales"][number];
  invoice?: Invoice;
  companyName: string;
  companyLogoUrl: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="sale-details-title"
        className="w-full max-w-lg rounded-xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2
              id="sale-details-title"
              className="text-base font-bold text-slate-900"
            >
              Sale details
            </h2>
            <p className="mt-1 text-xs text-slate-500">{sale.reference}</p>
          </div>
          <button
            type="button"
            aria-label="Close sale details"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2">
          {[
            ["Sale reference", sale.reference],
            ["Date", formatDate(sale.date)],
            ["Customer", sale.customer],
            ["Product", sale.product],
            ["Quantity", String(sale.quantity)],
            ["Payment method", sale.method],
            ...(sale.txnID ? [["Transaction ID", sale.txnID]] : []),
            ["Payment terms", sale.paymentTerms ?? "Same-day"],
            ["Status", sale.status],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="text-[11px] font-medium text-slate-400">
                {label}
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-800">
                {value}
              </div>
            </div>
          ))}
          <div className="sm:col-span-2">
            <div className="text-[11px] font-medium text-slate-400">Total</div>
            <div className="mt-1 text-lg font-bold text-slate-900">
              {money(sale.total)}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
          {invoice && (
            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("erp:view", {
                    detail: { type: "invoice", id: invoice.id },
                  }),
                )
              }
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Icons.ReceiptText className="size-4" />
              Open invoice draft
            </button>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-[#6d28d9] px-3 py-2 text-xs font-semibold text-white hover:bg-[#5b21b6]"
          >
            <Icons.Printer className="size-4" /> Print receipt
          </button>
        </div>
        <div className="sale-receipt-print" aria-hidden="true">
          <div className="receipt-brand">
            {companyLogoUrl && (
              <img
                src={companyLogoUrl}
                alt=""
                className="mx-auto mb-2 max-h-12 max-w-32 object-contain"
              />
            )}
            {companyName}
          </div>
          <h1>Sales receipt</h1>
          <div className="receipt-reference">{sale.reference}</div>
          <div className="receipt-divider" />
          <div className="receipt-line">
            <span>Date</span>
            <strong>{formatDate(sale.date)}</strong>
          </div>
          <div className="receipt-line">
            <span>Customer</span>
            <strong>{sale.customer}</strong>
          </div>
          <div className="receipt-line">
            <span>Product</span>
            <strong>{sale.product}</strong>
          </div>
          <div className="receipt-line">
            <span>Quantity</span>
            <strong>{sale.quantity}</strong>
          </div>
          <div className="receipt-line">
            <span>Payment method</span>
            <strong>{sale.method}</strong>
          </div>
          {sale.txnID && (
            <div className="receipt-line">
              <span>Transaction ID</span>
              <strong>{sale.txnID}</strong>
            </div>
          )}
          <div className="receipt-line">
            <span>Payment terms</span>
            <strong>{sale.paymentTerms ?? "Same-day"}</strong>
          </div>
          <div className="receipt-line">
            <span>Status</span>
            <strong>{sale.status}</strong>
          </div>
          <div className="receipt-divider" />
          <div className="receipt-total">
            <span>Total paid / due</span>
            <strong>{money(sale.total)}</strong>
          </div>
          <p className="receipt-thanks">Thank you for your business.</p>
        </div>
      </section>
    </div>
  );
}
function FormDialog({
  active,
  customers,
  onClose,
  onSubmit,
}: {
  active: string;
  customers: ErpState["customers"];
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [salePaymentTerms, setSalePaymentTerms] = useState("Same-day");
  if (active === "Orders") {
    return (
      <FormDialogShell active={active} onClose={onClose} onSubmit={onSubmit}>
        <form onSubmit={onSubmit}>
          <OrderFormFields customers={customers} onCancel={onClose} />
        </form>
      </FormDialogShell>
    );
  }
  const fieldConfig =
    active === "Sales"
      ? [
          ["customer", "Customer name", "Kampala Fresh Mart"],
          ["product", "Product", "Premium Maize Flour"],
          ["quantity", "Quantity", "1"],
          ["amount", "Total amount (UGX)", "0"],
          ["method", "Payment method", "Cash"],
          ["txnID", "Transaction ID", "Enter transaction ID"],
          ["paymentTerms", "Payment terms", "Same-day"],
          ["dueDate", "Credit due date", ""],
        ]
      : active === "Customer Management"
        ? [
            ["name", "Customer or business name", "New customer"],
            ["phone", "Telephone", "+256 700 000 000"],
            ["email", "Email address", "customer@example.com"],
          ]
        : [
            ["name", "Full name", "New team member"],
            ["department", "Department", "Operations"],
            ["role", "Job title", "Team member"],
            ["salary", "Salary / wage (UGX)", "0"],
          ];

  return (
    <FormDialogShell active={active} onClose={onClose} onSubmit={onSubmit}>
      <form onSubmit={onSubmit} className="p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {fieldConfig
            .filter(
              ([name]) =>
                (name !== "txnID" ||
                  (salePaymentTerms !== "Credit" &&
                    (paymentMethod === "Mobile Money" ||
                      paymentMethod === "Bank Transfer" ||
                      paymentMethod === "Check"))) &&
                (name !== "dueDate" || salePaymentTerms === "Credit") &&
                (name !== "method" || salePaymentTerms !== "Credit"),
            )
            .map(([name, label, placeholder]) => (
              <label
                key={name}
                className="flex flex-col gap-1.5 text-xs font-semibold text-slate-600"
              >
                <span>{label}</span>
                {name === "customer" ? (
                  <select
                    required
                    name="customerId"
                    defaultValue=""
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#8b5cf6] focus:ring-2 focus:ring-purple-100"
                  >
                    <option value="" disabled>
                      Select a customer
                    </option>
                    {customers
                      .filter((customer) => customer.status === "Active")
                      .map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name}
                        </option>
                      ))}
                    {salePaymentTerms !== "Credit" && (
                      <option value="__walkin__">Walk-in customer</option>
                    )}
                  </select>
                ) : name === "dueDate" ? (
                  <input
                    required
                    name={name}
                    type="date"
                    min={new Date().toISOString().slice(0, 10)}
                    placeholder={placeholder}
                    className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-[#8b5cf6] focus:ring-2 focus:ring-purple-100"
                  />
                ) : name === "method" ? (
                  <select
                    name={name}
                    defaultValue="Cash"
                    onChange={(event) => setPaymentMethod(event.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#8b5cf6] focus:ring-2 focus:ring-purple-100"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Mobile Money">Mobile Money</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Check">Check</option>
                  </select>
                ) : name === "paymentTerms" ? (
                  <select
                    name={name}
                    defaultValue="Same-day"
                    onChange={(event) =>
                      setSalePaymentTerms(event.target.value)
                    }
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#8b5cf6] focus:ring-2 focus:ring-purple-100"
                  >
                    <option value="Same-day">Same-day payment</option>
                    <option value="Credit">Credit sale</option>
                  </select>
                ) : (
                  <input
                    required
                    name={name}
                    type={
                      name === "amount" ||
                      name === "quantity" ||
                      name === "salary"
                        ? "number"
                        : "text"
                    }
                    placeholder={placeholder}
                    className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none transition placeholder:text-slate-300 focus:border-[#8b5cf6] focus:ring-2 focus:ring-purple-100"
                  />
                )}
              </label>
            ))}
        </div>
        {active === "Sales" && salePaymentTerms !== "Credit" && (
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-600">
            <span>Status</span>
            <select
              name="status"
              defaultValue="Paid"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#8b5cf6] focus:ring-2 focus:ring-purple-100"
            >
              <option value="Paid">Paid</option>
              <option value="Pending">Pending</option>
            </select>
          </label>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600"
          >
            Cancel
          </button>
          <button className="rounded-lg bg-[#6d28d9] px-4 py-2.5 text-xs font-semibold text-white shadow-sm">
            Save record
          </button>
        </div>
      </form>
    </FormDialogShell>
  );
}

function FormDialogShell({
  active,
  onClose,
  onSubmit,
  children,
}: {
  active: string;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/35 p-4">
      <div
        className={`max-h-[92vh] w-full overflow-y-auto rounded-2xl bg-white shadow-2xl ${active === "Orders" ? "max-w-3xl" : "max-w-lg"}`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <div>
            <h3 className="font-bold">Add {active}</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              {active === "Orders"
                ? "Add a customer order to the fulfilment queue."
                : "This record will persist in the demo workspace."}
            </p>
          </div>
          <button
            type="button"
            aria-label={`Close add ${active} form`}
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
          >
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function OrderFormFields({
  customers,
  onCancel,
}: {
  customers: ErpState["customers"];
  onCancel: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [customer, setCustomer] = useState("");
  const [newCustomerType, setNewCustomerType] = useState("Small dealer");
  const [priority, setPriority] = useState<"Normal" | "High">("Normal");
  const [fulfilmentMethod, setFulfilmentMethod] = useState<
    "Delivery" | "Pickup"
  >("Delivery");
  const [items, setItems] = useState([
    { id: "line-1", product: "", quantity: 1, unitPrice: 0 },
  ]);
  const total = items.reduce(
    (amount, item) => amount + item.quantity * item.unitPrice,
    0,
  );
  const serializedItems = JSON.stringify(
    items.map((item) => ({
      id: item.id,
      product: item.product,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.quantity * item.unitPrice,
    })),
  );
  const fieldClass =
    "rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#8b5cf6] focus:ring-2 focus:ring-purple-100";
  const labelClass =
    "flex flex-col gap-1.5 text-xs font-semibold text-slate-600";

  return (
    <>
      <div className="space-y-5 p-5">
        <section>
          <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">
            Customer
          </h4>
          <label className={labelClass}>
            Customer
            <select
              required
              name="customer"
              value={customer}
              onChange={(event) => setCustomer(event.target.value)}
              className={fieldClass}
            >
              <option value="" disabled>
                Select customer
              </option>
              {customers
                .filter((item) => item.status === "Active")
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              <option value="__new__">+ Add a new customer</option>
            </select>
          </label>
          {customer === "__new__" && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className={labelClass}>
                Customer name
                <input
                  required
                  name="newCustomerName"
                  className={fieldClass}
                  placeholder="Business or person"
                />
              </label>
              <label className={labelClass}>
                Customer type
                <select
                  required
                  name="newCustomerType"
                  value={newCustomerType}
                  onChange={(event) => setNewCustomerType(event.target.value)}
                  className={fieldClass}
                >
                  <option>Big dealer</option>
                  <option>Small dealer</option>
                  <option>Export customer</option>
                </select>
              </label>
              <label className={labelClass}>
                Primary contact
                <input
                  required
                  name="newCustomerContact"
                  className={fieldClass}
                  placeholder="Contact person's name"
                />
              </label>
              <label className={labelClass}>
                Phone
                <input
                  required
                  name="newCustomerPhone"
                  type="tel"
                  className={fieldClass}
                  placeholder="+256..."
                />
              </label>
              <label className={labelClass}>
                Email
                <input
                  name="newCustomerEmail"
                  type="email"
                  className={fieldClass}
                  placeholder="orders@example.com"
                />
              </label>
              <label className={labelClass}>
                Referred by
                <input
                  required
                  name="newCustomerReferredBy"
                  className={fieldClass}
                  placeholder="Staff member or referrer"
                />
              </label>
              {newCustomerType === "Big dealer" && (
                <>
                  <label className={labelClass}>
                    Region
                    <input
                      required
                      name="newCustomerRegion"
                      className={fieldClass}
                    />
                  </label>
                  <label className={labelClass}>
                    District
                    <input
                      required
                      name="newCustomerDistrict"
                      className={fieldClass}
                    />
                  </label>
                  <label className={labelClass}>
                    TIN (optional)
                    <input name="newCustomerTin" className={fieldClass} />
                  </label>
                </>
              )}
              {newCustomerType === "Export customer" && (
                <label className={labelClass}>
                  Country of operation
                  <input
                    required
                    name="newCustomerCountry"
                    className={fieldClass}
                  />
                </label>
              )}
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Order items
            </h4>
            <button
              type="button"
              onClick={() =>
                setItems((current) => [
                  ...current,
                  {
                    id: `line-${Date.now()}`,
                    product: "",
                    quantity: 1,
                    unitPrice: 0,
                  },
                ])
              }
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#6d28d9] hover:underline"
            >
              <Plus className="size-3.5" /> Add item
            </button>
          </div>
          <input type="hidden" name="items" value={serializedItems} />
          <div className="space-y-3">
            {items.map((item, index) => (
              <div
                key={item.id}
                className="grid items-end gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[minmax(0,1fr)_100px_150px_36px]"
              >
                <label className={labelClass}>
                  Product / description
                  <input
                    required
                    value={item.product}
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((line) =>
                          line.id === item.id
                            ? { ...line, product: event.target.value }
                            : line,
                        ),
                      )
                    }
                    className={fieldClass}
                    placeholder="Product name"
                  />
                </label>
                <label className={labelClass}>
                  Quantity
                  <input
                    required
                    min="1"
                    step="1"
                    type="number"
                    value={item.quantity}
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((line) =>
                          line.id === item.id
                            ? {
                                ...line,
                                quantity: Math.max(
                                  1,
                                  Number(event.target.value),
                                ),
                              }
                            : line,
                        ),
                      )
                    }
                    className={fieldClass}
                  />
                </label>
                <label className={labelClass}>
                  Unit price (UGX)
                  <input
                    required
                    min="0"
                    step="1"
                    type="number"
                    value={item.unitPrice}
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((line) =>
                          line.id === item.id
                            ? {
                                ...line,
                                unitPrice: Math.max(
                                  0,
                                  Number(event.target.value),
                                ),
                              }
                            : line,
                        ),
                      )
                    }
                    className={fieldClass}
                  />
                </label>
                <button
                  type="button"
                  aria-label={`Remove item ${index + 1}`}
                  disabled={items.length === 1}
                  onClick={() =>
                    setItems((current) =>
                      current.filter((line) => line.id !== item.id),
                    )
                  }
                  className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                >
                  <Icons.Trash2 className="size-4" />
                </button>
                <div className="text-right text-xs text-slate-500 sm:col-span-4">
                  Line total:{" "}
                  <strong className="text-slate-800">
                    {money(item.quantity * item.unitPrice)}
                  </strong>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-end border-t border-slate-100 pt-3 text-sm font-bold">
            Order total:{" "}
            <span className="ml-2 text-[#5b21b6]">{money(total)}</span>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Requested fulfilment date
            <input
              required
              name="requestedDate"
              type="date"
              min={today}
              defaultValue={today}
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            Fulfilment method
            <select
              name="fulfilmentMethod"
              value={fulfilmentMethod}
              onChange={(event) =>
                setFulfilmentMethod(event.target.value as "Delivery" | "Pickup")
              }
              className={fieldClass}
            >
              <option value="Delivery">Delivery</option>
              <option value="Pickup">Customer pickup</option>
            </select>
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            {fulfilmentMethod === "Delivery"
              ? "Delivery address / instructions"
              : "Pickup instructions"}
            <input
              name="destination"
              className={fieldClass}
              placeholder={
                fulfilmentMethod === "Delivery"
                  ? "Delivery location"
                  : "Pickup details"
              }
            />
          </label>
          <label className={labelClass}>
            Payment terms
            <select
              name="paymentTerms"
              defaultValue="Same-day"
              className={fieldClass}
            >
              <option value="Paid now">Paid now</option>
              <option value="Same-day">Same-day payment</option>
              <option value="Credit">Credit terms</option>
            </select>
          </label>
          <label className={labelClass}>
            Priority
            <select
              name="priority"
              value={priority}
              onChange={(event) =>
                setPriority(event.target.value as "Normal" | "High")
              }
              className={fieldClass}
            >
              <option value="Normal">Normal</option>
              <option value="High">High priority</option>
            </select>
          </label>
          {priority === "High" && (
            <label className={`${labelClass} sm:col-span-2`}>
              Reason for priority override
              <textarea
                required
                name="priorityReason"
                rows={2}
                className={fieldClass}
                placeholder="Explain why this order must move ahead of older orders"
              />
            </label>
          )}
          <label className={`${labelClass} sm:col-span-2`}>
            Order notes
            <textarea
              name="notes"
              rows={3}
              className={fieldClass}
              placeholder="Customer instructions or internal notes"
            />
          </label>
        </section>
      </div>
      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-100 bg-white px-5 py-4">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-lg bg-[#6d28d9] px-4 py-2.5 text-xs font-semibold text-white shadow-sm"
        >
          Add to order queue
        </button>
      </div>
    </>
  );
}

function AnalyticsPanel({
  active,
  state,
}: {
  active: string;
  state: ErpState;
}) {
  const lowStock = state.materials.filter(
    (material) => material.quantity <= material.threshold,
  ).length;
  const insights = [
    {
      title: "Sales momentum",
      text: "Weekly revenue is trending above the previous period.",
      Icon: TrendingUp,
    },
    {
      title: "Inventory watch",
      text: `${lowStock} materials need replenishment planning.`,
      Icon: Icons.AlertTriangle,
    },
    {
      title: "Data boundary",
      text: "All figures are simulated and stored only in this browser.",
      Icon: Icons.Info,
    },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:col-span-2">
        <h3 className="text-sm font-bold">{active} overview</h3>
        <p className="mt-1 text-xs text-slate-400">
          Derived from your shared demonstration records.
        </p>
        <div className="mt-5 h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid vertical={false} stroke="#eef0f4" />
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="sales" fill="#6d28d9" radius={[5, 5, 0, 0]} />
              <Bar dataKey="expenses" fill="#c4b5fd" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-bold">Management insights</h3>
        <div className="mt-5 flex flex-col gap-4">
          {insights.map(({ title, text, Icon }) => (
            <div key={title} className="flex gap-3 rounded-xl bg-slate-50 p-4">
              <Icon className="mt-0.5 size-4 shrink-0 text-[#6d28d9]" />
              <div>
                <div className="text-xs font-bold">{title}</div>
                <div className="mt-1 text-xs leading-relaxed text-slate-500">
                  {text}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-bold">Report controls</h3>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-600">
            From
            <input
              type="date"
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal"
            />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            To
            <input
              type="date"
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal"
            />
          </label>
        </div>
        <button
          onClick={() =>
            exportCsv(
              "company-report.csv",
              state.sales as unknown as Record<string, unknown>[],
            )
          }
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#6d28d9] px-4 py-2.5 text-xs font-semibold text-white"
        >
          <Download className="size-4" /> Export report
        </button>
      </section>
    </div>
  );
}

export default function Page() {
  return <App />;
}
