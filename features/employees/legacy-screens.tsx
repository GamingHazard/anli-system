"use client";

import { useEffect, useMemo, useState } from "react";
import * as Icons from "lucide-react";
import { ChevronLeft, ChevronRight, Plus, Search, X } from "lucide-react";
import { useAttendanceMonth } from "@/lib/attendance-queries";
import { useLeaveRequests } from "@/lib/leave-queries";
import { useDisciplinaryCases, useDisciplinaryIndicators } from "@/lib/disciplinary-queries";
import { useSalaryAdvances } from "@/lib/salary-advance-queries";
import { createId, employeeDisplayName, formatDate, getLegacyEmployeeImport, clearLegacyEmployeeImport, initials, money, AttendanceRecord, Employee, EmployeeDraft, ErpState } from "@/lib/erp";
import { ApiError, createEmployee as createEmployeeApi, deactivateEmployee as deactivateEmployeeApi, deleteEmployeeDraft, importLocalEmployees, listEmployeeDrafts, listEmployees, removeEmployeeDocument, removeEmployeeImage, saveEmployeeDraft, updateEmployee as updateEmployeeApi, uploadEmployeeDocument, uploadEmployeeImage, getEmployeeDocumentDownload, DisciplinaryIndicator, UserAccount } from "@/lib/user-api";
import { companyWorkDate } from "@/features/workspace/dates";
import { AttendanceRecordDialog } from "@/features/attendance/record-dialog";
import { Status } from "@/features/workspace/legacy-widgets";

export function EmployeeDetails({
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

export const employeeWizardSteps = [
  "Personal",
  "Family",
  "Education",
  "Addresses",
  "Department & payroll",
  "Documents & review",
] as const;

export const employeeDepartments = [
  "Sales",
  "HR",
  "Inventory",
  "Marketing",
  "Production",
];

export const employeeRoles = [
  "Sales Manager",
  "General Manager",
  "Marketing Manager",
  "Inventory Manager",
  "Production Manager",
];

export function EmployeeDirectory({
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
    ["Super Admin", "Human Resource"].includes(role),
  );
  const canReadDisciplinary = currentUser.roles.some((role) =>
    ["Human Resource", "General Manager", "Super Admin"].includes(role),
  );
  const disciplinaryIndicatorsQuery =
    useDisciplinaryIndicators(canReadDisciplinary);
  const canRead =
    canManage ||
    currentUser.roles.some((role) =>
      ["Admin", "General Manager"].includes(role),
    );
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
                        {disciplinaryIndicatorsQuery.data?.indicators[
                          employee.id
                        ]?.map((indicator) => (
                          <DisciplinaryIndicatorBadge
                            key={`${indicator.reference}-${indicator.icon}`}
                            indicator={indicator}
                          />
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

export function EmployeeAvatar({
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

export function DisciplinaryIndicatorBadge({
  indicator,
}: {
  indicator: DisciplinaryIndicator;
}) {
  const icon =
    indicator.icon === "user-x" ? (
      <Icons.UserRoundX className="size-4 text-rose-700" aria-hidden="true" />
    ) : (
      <Icons.Flag
        className={`size-4 text-rose-700 ${indicator.icon === "flag-filled" ? "fill-rose-600" : ""}`}
        aria-hidden="true"
      />
    );
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

export function EmployeeWizard({
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

export function ReviewValue({
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

export type EmployeeProfileTab =
  | "overview"
  | "personal"
  | "employment"
  | "documents"
  | "attendance"
  | "payroll"
  | "advances"
  | "leave"
  | "punishment";

export function EmployeeProfile({
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
        .sort((left, right) =>
          (right.createdAt || "").localeCompare(left.createdAt || ""),
        );
      return (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-sm font-bold">Disciplinary history</h3>
            <p className="mt-1 text-xs text-slate-500">
              Confidential case outcomes visible only to authorized disciplinary
              readers.
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
                  {["Issued", "Closed", "Rescinded"].includes(
                    caseRecord.status,
                  ) &&
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
            <div
              className="mt-2 flex flex-wrap gap-2"
              aria-label="Disciplinary indicators"
            >
              {disciplinaryIndicatorsQuery.data.indicators[employee.id].map(
                (indicator) => (
                  <span
                    key={`${indicator.reference}-${indicator.icon}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-800"
                  >
                    <DisciplinaryIndicatorBadge indicator={indicator} />
                    {indicator.label}
                  </span>
                ),
              )}
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
