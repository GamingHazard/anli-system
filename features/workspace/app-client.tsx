"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  canAccessPath,
  canAccessSection,
  defaultPathForRoles,
  hasAnyDepartmentRole,
  hasDepartmentRole,
} from "@/lib/authorization";
import { customerPath, employeePath, pathForSection, payrollPath, salaryAdvancePath, sectionForPath } from "@/lib/app-routes";
import { importLegacyCustomersOnce } from "@/lib/customer-migration";
import { importLegacySalesOnce } from "@/lib/sales-migration";
import { createInvoiceSellerSnapshot, getSavedCustomersForImport, getSavedSalesForImport, linkCustomerTransactions, loadState, saveState, CompanyProfile, Employee, ErpState, Sale, SalePayment } from "@/lib/erp";
import { ActiveSession, ApiError, importLegacyCustomers, importLegacySales, listCustomers, listEmployees, getCompanyProfile, getCurrentSession, getEmployee, getPublicCompanyBrand, listSales, signIn, signOut, PublicCompanyBrand, UserAccount } from "@/lib/user-api";
import { Header, Sidebar } from "@/features/workspace/legacy-shell";
import { WorkspaceContext } from "@/features/workspace/workspace-context";

const LoginScreen = dynamic(() =>
  import("@/features/auth/legacy-screens").then((module) => module.LoginScreen),
);
const PasswordChangeScreen = dynamic(() =>
  import("@/features/auth/legacy-screens").then(
    (module) => module.PasswordChangeScreen,
  ),
);
const ChangePasswordDialog = dynamic(() =>
  import("@/features/auth/legacy-screens").then(
    (module) => module.ChangePasswordDialog,
  ),
);
const SessionIdleGuard = dynamic(() =>
  import("@/features/auth/legacy-screens").then(
    (module) => module.SessionIdleGuard,
  ),
);

const queryClient = new QueryClient();

export default function AppClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = sectionForPath(pathname) ?? "Dashboard";
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [sessionInfo, setSessionInfo] = useState<ActiveSession | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedPayrollRunId = searchParams.get("runId");
  const selectedAdvanceId = searchParams.get("advanceId");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [state, setState] = useState<ErpState>(loadState);
  const setActive = useCallback(
    (section: string) => {
      const path = pathForSection(section);
      if (path && currentUser && canAccessSection(currentUser.roles, section)) {
        router.push(path);
      }
    },
    [currentUser, router],
  );
  const openEmployee = useCallback(
    (id: string) => {
      setSelectedId(id);
      router.push(employeePath(id));
    },
    [router],
  );
  const openCustomer = useCallback(
    (id: string) => {
      setSelectedId(id);
      router.push(customerPath(id));
    },
    [router],
  );
  const openPayrollRun = useCallback(
    (id: string) => router.push(payrollPath(id)),
    [router],
  );
  const openSalaryAdvance = useCallback(
    (id: string) => router.push(salaryAdvancePath(id)),
    [router],
  );
  useEffect(() => {
    const match = pathname.match(/^\/(?:employees|customers)\/([^/]+)$/);
    setSelectedId(match ? decodeURIComponent(match[1]) : null);
  }, [pathname]);
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
      "Admin",
      "Super Admin",
    ]),
  );
  const [employeeLoadError, setEmployeeLoadError] = useState("");
  const [employeeDetailLoading, setEmployeeDetailLoading] = useState(false);
  const [employeeLoadAttempt, setEmployeeLoadAttempt] = useState(0);
  const [publicBrand, setPublicBrand] = useState<PublicCompanyBrand>({
    companyName: "ANLI ESTABLISHMENT LTD",
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
  }, [setActive]);
  useEffect(() => {
    let mounted = true;
    getPublicCompanyBrand()
      .then((brand) => {
        if (mounted)
          setPublicBrand({
            companyName: brand.companyName || "ANLI WORKSPACE",
            logoUrl: brand.logoUrl || "",
          });
      })
      .catch(() => {
        if (mounted)
          setPublicBrand({ companyName: "ANLI WORKSPACE", logoUrl: "" });
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
    if (
      !currentUser ||
      currentUser.mustChangePassword ||
      !canAccessSection(currentUser.roles, "Employee Profiles")
    ) {
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
        migrationWarning = `Customer import did not complete: ${error instanceof ApiError ? error.message : error instanceof Error ? error.message : "Unknown error."} Local data was retained.`;
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
    if (authLoading) return;
    if (!currentUser || currentUser.mustChangePassword) {
      if (pathname !== "/") router.replace("/");
      return;
    }
    const defaultPath = defaultPathForRoles(currentUser.roles);
    if (pathname === "/") router.replace(defaultPath);
    else if (!canAccessPath(currentUser.roles, pathname)) {
      router.replace(defaultPath);
    }
  }, [authLoading, currentUser, pathname, router]);
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ type: string; id: string }>)
        .detail;
      if (detail.type === "invoice") {
        setActive("Invoicing");
        return;
      }
      if (detail.type === "employee") openEmployee(detail.id);
      else openCustomer(detail.id);
    };
    window.addEventListener("erp:view", handler);
    return () => window.removeEventListener("erp:view", handler);
  }, [openCustomer, openEmployee, setActive]);
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
  const updateCustomers = useCallback((customers: ErpState["customers"]) => {
    setState((current) => {
      const next = linkCustomerTransactions({ ...current, customers });
      saveState(next);
      return next;
    });
    queryClient.invalidateQueries();
  }, []);
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
    currentUser &&
    hasAnyDepartmentRole(currentUser.roles, [
      "Inventory Manager",
      "General Manager",
      "Admin",
    ]),
  );
  const assetCanEdit = Boolean(
    currentUser && hasDepartmentRole(currentUser.roles, "Inventory Manager"),
  );
  const companyLogoUrl =
    currentUser && companyProfileLoaded
      ? state.companyProfile.logo.url || publicBrand.logoUrl
      : publicBrand.logoUrl;
  const routeAllowed = Boolean(
    currentUser && canAccessPath(currentUser.roles, pathname),
  );
  useEffect(() => {
    document.title = `${companyName} | Business Operations Suite`;
  }, [companyName]);
  useEffect(() => {
    if (authLoading) return;
    if (!currentUser || currentUser.mustChangePassword) {
      if (pathname !== "/") router.replace("/");
      return;
    }
    const defaultPath = defaultPathForRoles(currentUser.roles);
    if (pathname === "/") router.replace(defaultPath);
    else if (!canAccessPath(currentUser.roles, pathname)) {
      router.replace(defaultPath);
    }
  }, [authLoading, currentUser, pathname, router]);
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
  const workspaceValue = {
    currentUser,
    state,
    updateState,
    updateSale,
    updateCustomers,
    companyName,
    companyLogoUrl,
    companyProfileEditable:
      currentUser.roles.includes("Super Admin") &&
      companyProfileLoaded &&
      !companyProfileError,
    companyProfileError,
    retryCompanyProfile: () =>
      setCompanyProfileLoadAttempt((attempt) => attempt + 1),
    applyCompanyProfile,
    handleSessionEnded,
    navigateToSection: setActive,
    openEmployee,
    openCustomer,
    openPayrollRun,
    openSalaryAdvance,
    selectedPayrollRunId,
    selectedAdvanceId,
    selectedEmployee,
    selectedCustomer,
    employeesLoaded,
    employeeLoadError,
    employeeDetailLoading,
    retryEmployees: () => setEmployeeLoadAttempt((attempt) => attempt + 1),
    updateEmployee: (employee: Employee) =>
      setState((current) => ({
        ...current,
        employees: current.employees.map((item) =>
          item.id === employee.id ? employee : item,
        ),
      })),
    addEmployee: (employee: Employee) =>
      setState((current) => ({
        ...current,
        employees: [
          employee,
          ...current.employees.filter((item) => item.id !== employee.id),
        ],
      })),
    customersLoaded,
    customersApiLoaded,
    customerLoadError,
    retryCustomers: () => setCustomerLoadAttempt((attempt) => attempt + 1),
    customerCanRead,
    customerCanManage,
    salesLoaded,
    salesLoadError,
    salesMigrationWarning,
    retrySales: () => setSalesLoadAttempt((attempt) => attempt + 1),
    salesCanRead,
    canReadAssets: assetCanRead,
    canEditAssets: assetCanEdit,
  };
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
      <WorkspaceContext.Provider value={workspaceValue}>
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
            currentUser={currentUser}
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
              {routeAllowed ? (
                children
              ) : (
                <p role="status" className="text-sm text-slate-500">
                  Redirecting to an authorized section…
                </p>
              )}
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
            </main>
          </div>
        </div>
      </WorkspaceContext.Provider>
    </QueryClientProvider>
  );
}
