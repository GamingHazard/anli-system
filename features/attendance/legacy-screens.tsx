"use client";

import { useState } from "react";
import * as Icons from "lucide-react";
import { Search, X } from "lucide-react";
import { useAttendanceMonth, useAttendanceYear, useSaveDailyAttendance } from "@/lib/attendance-queries";
import { employeeDisplayName, formatDate, AttendanceRecord, AttendanceStatus, Employee, ErpState } from "@/lib/erp";
import { ApiError } from "@/lib/user-api";
import { companyWorkDate } from "@/features/workspace/dates";
import { AttendanceRecordDialog } from "@/features/attendance/record-dialog";
import { iconMap } from "@/features/workspace/legacy-shell";

export function AttendancePage({
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

export function AttendanceMetric({
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

export function AttendanceDialog({
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
