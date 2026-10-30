const routesBySection: Record<string, string> = {
  Dashboard: "/dashboard",
  Approvals: "/approvals",
  Auditing: "/auditing",
  Analysis: "/analysis",
  Sales: "/sales",
  "Credit Sales": "/credit-sales",
  Orders: "/orders",
  Invoicing: "/invoicing",
  "Receipt Management": "/receipts",
  "Customer Management": "/customers",
  "Employee Profiles": "/employees",
  "Attendance Management": "/attendance",
  "Payroll Management": "/payroll",
  "Salary Advance Management": "/salary-advances",
  "Leave Management": "/leave",
  "Disciplinary Letters": "/disciplinary",
  Expenses: "/expenses",
  "Raw Material Management": "/inventory/materials",
  "Production Management": "/inventory/production",
  "Assets Management": "/inventory/assets",
  "Data Backup": "/inventory/data-backup",
  "Company Profile Management": "/settings/company",
  "User Management": "/settings/users",
  "Security Settings": "/settings/security",
  "General Settings": "/settings/general",
};

const sectionsByRoute = Object.fromEntries(
  Object.entries(routesBySection).map(([section, route]) => [route, section]),
);

export function pathForSection(section: string): string | null {
  return routesBySection[section] ?? null;
}

export function sectionForPath(pathname: string): string | null {
  if (pathname.startsWith("/employees/")) return "Employee Profile Details";
  if (pathname.startsWith("/customers/")) return "Customer Details";
  return sectionsByRoute[pathname] ?? null;
}

export function employeePath(employeeId: string): string {
  return `/employees/${encodeURIComponent(employeeId)}`;
}

export function customerPath(customerId: string): string {
  return `/customers/${encodeURIComponent(customerId)}`;
}

export function payrollPath(runId?: string | null): string {
  return runId
    ? `/payroll?runId=${encodeURIComponent(runId)}`
    : "/payroll";
}

export function salaryAdvancePath(advanceId?: string | null): string {
  return advanceId
    ? `/salary-advances?advanceId=${encodeURIComponent(advanceId)}`
    : "/salary-advances";
}
