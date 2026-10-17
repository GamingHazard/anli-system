'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import * as Icons from 'lucide-react'
import { Bell, Boxes, ChevronDown, ChevronLeft, ChevronRight, Download, FilePlus2, Menu, Plus, Search, Settings2, Sparkles, TrendingUp, X } from 'lucide-react'
import PayrollManagementPage from '@/components/payroll-management'
import SalaryAdvanceManagement from '@/components/salary-advance-management'
import ExpenseManagement from '@/components/expense-management'
import RawMaterialManagement from '@/components/raw-material-management'
import ProductionManagement from '@/components/production-management'
import AssetManagement from '@/components/asset-management'
import DataBackup from '@/components/data-backup'
import CompanyProfileManagement from '@/components/company-profile-management'
import UserManagement from '@/components/user-management'
import SecuritySettings from '@/components/security-settings'
import Approvals from '@/components/approvals'
import InvoiceManagement from '@/components/invoice-management'
import LeaveManagement from '@/components/leave-management'
import DisciplinaryLettersPage from '@/components/disciplinary-letters'
import { balanceForSale, chartData, cloneSeed, createId, createInvoiceDraft, employeeDisplayName, exportCsv, formatDate, initials, isWithinDays, loadState, money, navGroups, paidAmountForSale, paymentStateForSale, productMix, saveState, seedState, simulate, sum, type AttendanceRecord, type AttendanceStatus, type Employee, type EmployeeDraft, type ErpState, type Invoice, type SalePayment } from '@/lib/erp'

const queryClient = new QueryClient()
const iconMap = Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>

function LoginScreen({ onLogin, companyName }: { onLogin: () => void; companyName: string }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    window.setTimeout(() => {
      if (username.trim().toLowerCase() === 'admin' && password === '123456') {
        onLogin()
      } else {
        setError('The username or password is incorrect. Please try again.')
      }
      setSubmitting(false)
    }, 450)
  }

  return <main className="login-shell">
    <div className="login-orb login-orb-one" />
    <div className="login-orb login-orb-two" />
    <div className="login-grid" />
    <div className="login-topbar"><div className="brand-lockup"><div className="brand-mark">{companyName.charAt(0).toUpperCase()}</div><div><strong>{companyName}</strong><span>Business operating system</span></div></div><div className="secure-label"><Icons.ShieldCheck /> Secure workspace</div></div>
    <div className="login-content">
      <section className="login-intro"><div className="eyebrow"><Icons.Sparkles /> Intelligent operations</div><h1>Run your business<br /><em>with clarity.</em></h1><p>One calm, connected workspace for your people, sales, finance and operations.</p><div className="login-stat-row"><div><strong>360°</strong><span>Business visibility</span></div><div><strong>24/7</strong><span>Operational control</span></div><div><strong>01</strong><span>Unified workspace</span></div></div></section>
      <section className="login-card"><div className="login-card-glow" /><div className="login-card-inner"><div className="login-card-heading"><span className="login-chip">WELCOME BACK</span><h2>Sign in to {companyName}</h2><p>Enter your credentials to access your workspace.</p></div><form onSubmit={submit} className="login-form"><label>Username<input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Enter your username" autoComplete="username" required /></label><label>Password<div className="password-wrap"><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" autoComplete="current-password" required /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <Icons.EyeOff /> : <Icons.Eye />}</button></div></label>{error && <div className="login-error" role="alert"><Icons.AlertCircle />{error}</div>}<button className="login-submit" disabled={submitting}>{submitting ? 'Signing you in...' : 'Sign in to workspace'}<Icons.ArrowRight /></button></form><div className="login-card-footer"><span><Icons.LockKeyhole /> Protected workspace</span><span>Need help?</span></div></div></section>
    </div>
    <div className="login-footer"><span>© 2026 Lumina ERP</span><span>UGX · Africa/Kampala</span></div>
  </main>
}

function App() {
  const [authenticated, setAuthenticated] = useState(false)
  const [active, setActive] = useState('Dashboard')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedPayrollRunId, setSelectedPayrollRunId] = useState<string | null>(null)
  const [selectedAdvanceId, setSelectedAdvanceId] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [state, setState] = useState<ErpState>(loadState)
  useEffect(() => { const handler = (event: Event) => { const detail = (event as CustomEvent<{ type: string; id: string }>).detail; if (detail.type === 'invoice') { setActive('Invoicing'); return } setSelectedId(detail.id); setActive(detail.type === 'employee' ? 'Employee Profile Details' : 'Customer Details') }; window.addEventListener('erp:view', handler); return () => window.removeEventListener('erp:view', handler) }, [])
  const updateState = (next: ErpState) => { setState(next); saveState(next); queryClient.invalidateQueries() }
  const companyName = state.companyProfile.tradingName || state.companyProfile.legalName || 'Lumina ERP'
  if (!authenticated) return <LoginScreen onLogin={() => setAuthenticated(true)} companyName={companyName} />
  return <QueryClientProvider client={queryClient}><div className="min-h-screen bg-[#f7f8fc] text-slate-900"><Sidebar active={active} setActive={(value) => { setActive(value); setMobileNav(false) }} collapsed={collapsed} setCollapsed={setCollapsed} mobileNav={mobileNav} setMobileNav={setMobileNav} onReset={() => updateState(cloneSeed())} companyName={companyName} /><div className={`transition-[margin] duration-200 ${collapsed ? 'lg:ml-[76px]' : 'lg:ml-[252px]'}`}><Header active={active} setMobileNav={setMobileNav} /><main className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">{active === 'Dashboard' ? <Dashboard state={state} setActive={setActive} /> : active === 'Credit Sales' ? <CreditSalesPage state={state} updateState={updateState} /> : active === 'Payroll Management' ? <PayrollManagementPage state={state} updateState={updateState} initialRunId={selectedPayrollRunId} onViewEmployee={(id) => { setSelectedId(id); setActive('Employee Profile Details') }} /> : active === 'Salary Advance Management' ? <SalaryAdvanceManagement state={state} updateState={updateState} initialAdvanceId={selectedAdvanceId} onViewEmployee={(id) => { setSelectedId(id); setActive('Employee Profile Details') }} /> : active === 'Employee Profile Details' ? <EmployeeDetails employee={state.employees.find((item) => item.id === selectedId) || state.employees[0]} state={state} updateState={updateState} onBack={() => setActive('Employee Profiles')} onViewPayrollRun={(id) => { setSelectedPayrollRunId(id); setActive('Payroll Management') }} onViewAdvance={(id) => { setSelectedAdvanceId(id); setActive('Salary Advance Management') }} /> : active === 'Customer Details' ? <CustomerDetails customer={state.customers.find((item) => item.id === selectedId) || state.customers[0]} state={state} onBack={() => setActive('Customer Management')} /> : active === 'Employee Profiles' ? <EmployeeDirectory state={state} updateState={updateState} onView={(id) => { setSelectedId(id); setActive('Employee Profile Details') }} /> : active === 'Attendance Management' ? <AttendancePage state={state} updateState={updateState} /> : <ModulePage active={active} state={state} updateState={updateState} onView={(id) => { setSelectedId(id); setActive(active === 'Employee Profiles' ? 'Employee Profile Details' : 'Customer Details') }} />}</main></div></div></QueryClientProvider>
}

function companyWorkDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kampala", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function AttendancePage({ state, updateState }: { state: ErpState; updateState: (next: ErpState) => void }) {
  const [workDate, setWorkDate] = useState(companyWorkDate);
  const [department, setDepartment] = useState("All departments");
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [expandedMonth, setExpandedMonth] = useState(companyWorkDate().slice(0, 7));
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const activeEmployees = state.employees.filter((employee) => employee.status === "Active");
  const departments = [...new Set(activeEmployees.map((employee) => employee.department).filter(Boolean))].sort();
  const departmentEmployees = activeEmployees.filter((employee) => department === "All departments" || employee.department === department);
  const employees = departmentEmployees.filter((employee) => `${employeeDisplayName(employee)} ${employee.number} ${employee.department} ${employee.role}`.toLowerCase().includes(search.toLowerCase()));
  const dayRecords = state.attendanceRecords.filter((record) => record.workDate === workDate && departmentEmployees.some((employee) => employee.id === record.employeeId));
  const presentRecords = dayRecords.filter((record) => record.status === "Present");
  const lateCount = presentRecords.filter((record) => record.late).length;
  const absentCount = dayRecords.filter((record) => record.status === "Absent").length;
  const leaveCount = dayRecords.filter((record) => record.status === "On leave").length;
  const currentMonth = companyWorkDate().slice(0, 7);
  const attendanceMonths = [...new Set([currentMonth, ...state.attendanceRecords.map((record) => record.workDate.slice(0, 7)).filter(Boolean)])].sort((left, right) => right.localeCompare(left));
  const monthLabel = (month: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Kampala", month: "long", year: "numeric" }).format(new Date(`${month}-15T12:00:00+03:00`));
  const monthDates = (month: string) => {
    const [year, monthNumber] = month.split("-").map(Number);
    const count = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    return Array.from({ length: count }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`);
  };
  const dayOfWeek = (date: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Kampala", weekday: "short" }).format(new Date(`${date}T12:00:00+03:00`));
  const monthSummary = (month: string) => {
    const records = state.attendanceRecords.filter((record) => record.workDate.startsWith(`${month}-`) && departmentEmployees.some((employee) => employee.id === record.employeeId));
    return {
      recordedDays: new Set(records.map((record) => record.workDate)).size,
      present: records.filter((record) => record.status === "Present").length,
      halfDays: records.filter((record) => record.status === "Present" && record.halfDay).length,
      late: records.filter((record) => record.status === "Present" && record.late).length,
      absent: records.filter((record) => record.status === "Absent").length,
      leave: records.filter((record) => record.status === "On leave").length,
    };
  };
  const saveAttendance = (updates: Array<Pick<AttendanceRecord, "employeeId" | "status" | "halfDay" | "late" | "note">>) => {
    const updatedEmployeeIds = new Set(updates.map((record) => record.employeeId));
    const untouchedRecords = state.attendanceRecords.filter((record) => record.workDate !== workDate || !updatedEmployeeIds.has(record.employeeId));
    const savedRecords = updates.filter((record) => record.status !== "Unmarked").map((update) => {
      const existing = state.attendanceRecords.find((record) => record.employeeId === update.employeeId && record.workDate === workDate);
      return { ...existing, ...update, id: existing?.id ?? createId("ATT"), workDate, updatedAt: new Date().toISOString() } as AttendanceRecord;
    });
    updateState({ ...state, attendanceRecords: [...untouchedRecords, ...savedRecords] });
    setShowDialog(false);
  };

  return <div className="animate-in fade-in duration-300">
    <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="mb-2 text-xs font-medium text-slate-400">Workspace / HR Department</div><h2 className="text-2xl font-bold tracking-tight">Attendance Management</h2><p className="mt-1 text-sm text-slate-500">Daily roll call · {new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Kampala", dateStyle: "full" }).format(new Date(`${workDate}T12:00:00+03:00`))}</p></div><button type="button" onClick={() => setShowDialog(true)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#6d28d9] px-3 py-2.5 text-xs font-semibold text-white hover:bg-[#5b21b6]"><Icons.ClipboardCheck className="size-4" /> Add attendance</button></div>
    <div className="mb-4 flex flex-wrap items-end gap-3"><label className="text-xs font-semibold text-slate-600">Work date for entry<input aria-label="Attendance work date" type="date" value={workDate} onChange={(event) => { setWorkDate(event.target.value); setExpandedMonth(event.target.value.slice(0, 7)); }} className="mt-1 block rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-normal" /></label><label className="text-xs font-semibold text-slate-600">Department<select aria-label="Attendance department" value={department} onChange={(event) => setDepartment(event.target.value)} className="mt-1 block rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-normal"><option>All departments</option>{departments.map((item) => <option key={item}>{item}</option>)}</select></label><label className="ml-auto flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"><Search className="size-4 text-slate-400" /><input aria-label="Search attendance employees" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employees" className="w-44 bg-transparent text-xs outline-none" /></label></div>
    <section aria-label="Attendance summary" className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><AttendanceMetric title="Present" value={presentRecords.length} detail={`${presentRecords.filter((record) => !record.halfDay).length} full day · ${presentRecords.filter((record) => record.halfDay).length} half day`} icon="UserCheck" tone="green" /><AttendanceMetric title="Late arrivals" value={lateCount} detail="Present employees marked late" icon="ClockAlert" tone="amber" /><AttendanceMetric title="Absent" value={absentCount} detail="Explicitly marked absent" icon="UserX" tone="rose" /><AttendanceMetric title="On leave" value={leaveCount} detail="Marked on leave for this date" icon="CalendarOff" tone="blue" /></section>
    <section aria-label="Monthly attendance history" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3"><div><h3 className="text-sm font-bold">Monthly attendance</h3><p className="mt-1 text-xs text-slate-400">Select a month to review daily attendance by employee.</p></div><span className="text-[10px] text-slate-400">Company time: Africa/Kampala</span></div>
      <div className="divide-y divide-slate-100">
        {attendanceMonths.map((month) => {
          const summary = monthSummary(month);
          const dates = monthDates(month);
          const expanded = expandedMonth === month;
          return <section key={month} className="min-w-0">
            <button type="button" aria-expanded={expanded} onClick={() => setExpandedMonth(expanded ? "" : month)} className="flex w-full flex-col gap-3 px-4 py-3 text-left hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-center gap-2"><Icons.ChevronRight className={`size-4 text-slate-400 transition-transform ${expanded ? "rotate-90" : ""}`} /><span className="text-sm font-bold text-slate-800">{monthLabel(month)}</span>{month === currentMonth && <span className="rounded bg-[#f1eafd] px-1.5 py-0.5 text-[9px] font-semibold text-[#6d28d9]">Current month</span>}</span>
              <span className="flex flex-wrap gap-x-3 gap-y-1 pl-6 text-[10px] text-slate-500 sm:pl-0"><span>{summary.recordedDays} days recorded</span><span className="text-emerald-700">{summary.present} present</span><span className="text-orange-700">{summary.halfDays} half-days</span><span className="text-blue-700">{summary.late} late</span><span className="text-rose-700">{summary.absent} absent</span><span className="text-sky-700">{summary.leave} leave</span></span>
            </button>
            {expanded && <div id={`attendance-month-${month}`} className="border-t border-slate-100">
              <div className="flex flex-wrap gap-x-4 gap-y-2 border-b border-slate-100 px-4 py-2 text-[10px] text-slate-500"><span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-emerald-500" />Present</span><span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-rose-500" />Absent</span><span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-orange-400" />Half-day</span><span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-sky-500" />On leave</span><span className="flex items-center gap-1.5"><i className="grid size-3 place-items-center rounded-full bg-blue-600 text-[8px] font-bold not-italic text-white">L</i>Late</span><span className="text-slate-400">Blank cells are unmarked; weekends are not assumed absent.</span></div>
              <div className="overflow-auto"><table className="w-full border-separate border-spacing-0 text-center text-[10px]"><thead className="sticky top-0 z-20 bg-slate-50 text-slate-500"><tr><th className="sticky left-0 z-30 min-w-[190px] border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-left">Employee</th>{dates.map((date) => { const weekend = ["Sat", "Sun"].includes(dayOfWeek(date)); return <th key={date} className={`min-w-9 border-b border-slate-100 px-1 py-2 ${weekend ? "bg-slate-100/70 text-slate-400" : ""}`}><span className="block font-semibold">{Number(date.slice(-2))}</span><span className="mt-0.5 block text-[8px] font-normal">{dayOfWeek(date)}</span></th>; })}</tr></thead>
                <tbody>{employees.map((employee) => <tr key={employee.id} className="group"><th scope="row" className="sticky left-0 z-10 border-b border-r border-slate-100 bg-white px-3 py-2 text-left group-hover:bg-slate-50"><span className="block truncate text-[11px] font-semibold text-slate-800">{employeeDisplayName(employee)}</span><span className="mt-0.5 block truncate text-[9px] font-normal text-slate-400">{employee.number} · {employee.department}</span></th>{dates.map((date) => {
                  const record = state.attendanceRecords.find((item) => item.employeeId === employee.id && item.workDate === date);
                  const isWeekend = ["Sat", "Sun"].includes(dayOfWeek(date));
                  const cellColor = !record ? "bg-transparent text-slate-300" : record.status === "Absent" ? "bg-rose-500 text-white" : record.status === "On leave" ? "bg-sky-500 text-white" : record.status === "Present" && record.halfDay ? "bg-orange-400 text-white" : record.status === "Present" ? "bg-emerald-500 text-white" : "bg-transparent text-slate-300";
                  const cellLabel = !record ? `${employeeDisplayName(employee)}, ${date}: unmarked${isWeekend ? ", weekend" : ""}` : `${employeeDisplayName(employee)}, ${date}: ${record.status}${record.status === "Present" ? record.halfDay ? ", half day" : ", full day" : ""}${record.status === "Present" && record.late ? ", late" : ""}`;
                  return <td key={date} className={`border-b border-slate-100 px-0.5 py-1 ${isWeekend && !record ? "bg-slate-50/70" : ""}`}><button type="button" aria-label={cellLabel} title={cellLabel} onClick={() => { setWorkDate(date); setExpandedMonth(month); if (record) setSelectedRecord(record); else setShowDialog(true); }} className={`relative mx-auto grid size-7 place-items-center rounded-md font-semibold transition hover:ring-2 hover:ring-slate-300 ${cellColor}`}><span>{record ? record.status === "Absent" ? "A" : record.status === "On leave" ? "L" : record.status === "Present" && record.halfDay ? "½" : record.status === "Present" ? "P" : "·" : "·"}</span>{record?.status === "Present" && record.late && <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 grid size-3 place-items-center rounded-full bg-blue-600 text-[7px] font-bold leading-none text-white">L</span>}</button></td>;
                })}</tr>)}</tbody>
              </table></div>
            </div>}
          </section>;
        })}
      </div>
    </section>
    {showDialog && <AttendanceDialog employees={departmentEmployees} records={state.attendanceRecords.filter((record) => record.workDate === workDate)} workDate={workDate} onClose={() => setShowDialog(false)} onSave={saveAttendance} />}
    {selectedRecord && <AttendanceRecordDialog employeeName={employeeDisplayName(state.employees.find((employee) => employee.id === selectedRecord.employeeId) ?? {})} record={selectedRecord} onClose={() => setSelectedRecord(null)} />}
  </div>;
}

function AttendanceMetric({ title, value, detail, icon, tone }: { title: string; value: number; detail: string; icon: string; tone: string }) {
  const Icon = iconMap[icon] || Icons.CircleCheck;
  const toneClass = tone === "green" ? "bg-emerald-50 text-emerald-700" : tone === "amber" ? "bg-amber-50 text-amber-700" : tone === "rose" ? "bg-rose-50 text-rose-700" : "bg-sky-50 text-sky-700";
  return <article className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><span className={`grid size-9 place-items-center rounded-lg ${toneClass}`}><Icon className="size-4" /></span><span className="text-[9px] font-semibold uppercase text-slate-400">{title === "Present" ? "Workday" : "Daily"}</span></div><div className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{value}</div><h3 className="mt-0.5 text-xs font-semibold text-slate-700">{title}</h3><p className="mt-1 text-[10px] text-slate-400">{detail}</p></article>;
}

function AttendanceDialog({ employees, records, workDate, onClose, onSave }: { employees: Employee[]; records: AttendanceRecord[]; workDate: string; onClose: () => void; onSave: (records: Array<Pick<AttendanceRecord, "employeeId" | "status" | "halfDay" | "late" | "note">>) => void }) {
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<Record<string, { status: AttendanceStatus; halfDay: boolean; late: boolean; note: string }>>(() => Object.fromEntries(employees.map((employee) => {
    const record = records.find((item) => item.employeeId === employee.id);
    return [employee.id, { status: record?.status ?? "Unmarked", halfDay: record?.halfDay ?? false, late: record?.late ?? false, note: record?.note ?? "" }];
  })));
  const visibleEmployees = employees.filter((employee) => `${employeeDisplayName(employee)} ${employee.number} ${employee.department}`.toLowerCase().includes(query.toLowerCase()));
  const setEntry = (employeeId: string, update: Partial<(typeof entries)[string]>) => setEntries((current) => ({ ...current, [employeeId]: { ...current[employeeId], ...update } }));
  const setAllVisiblePresent = () => setEntries((current) => ({ ...current, ...Object.fromEntries(visibleEmployees.map((employee) => [employee.id, { ...current[employee.id], status: "Present" as const }])) }));
  return <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/40 p-3 sm:p-6"><section role="dialog" aria-modal="true" aria-labelledby="attendance-dialog-title" className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
    <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 id="attendance-dialog-title" className="text-base font-bold">Record attendance</h2><p className="mt-1 text-xs text-slate-500">{formatDate(workDate)} · Unmarked employees remain unmarked when saved.</p></div><button type="button" aria-label="Close attendance dialog" onClick={onClose} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><X className="size-4" /></button></header>
    <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"><label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><Search className="size-4 text-slate-400" /><input aria-label="Search attendance roster" value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-xs outline-none sm:w-64" placeholder="Search employees" /></label><button type="button" onClick={setAllVisiblePresent} className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Mark all visible present</button></div>
    <div className="min-h-0 flex-1 overflow-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead className="sticky top-0 bg-slate-50 text-[10px] font-semibold uppercase text-slate-400"><tr>{["Employee", "Attendance status", "Half-day", "Late", "Note"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{visibleEmployees.map((employee) => { const entry = entries[employee.id]; return <tr key={employee.id} className="border-t border-slate-100"><td className="px-4 py-3 font-semibold text-slate-800">{employeeDisplayName(employee)}<span className="mt-1 block text-[10px] font-normal text-slate-400">{employee.number} · {employee.department}</span></td><td className="px-4 py-3"><select aria-label={`${employeeDisplayName(employee)} attendance status`} value={entry.status} onChange={(event) => { const status = event.target.value as AttendanceStatus; setEntry(employee.id, { status, halfDay: status === "Present" ? entry.halfDay : false, late: status === "Present" ? entry.late : false }); }} className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs"><option>Unmarked</option><option>Present</option><option>Absent</option><option>On leave</option></select></td><td className="px-4 py-3"><input aria-label={`${employeeDisplayName(employee)} half day`} type="checkbox" checked={entry.halfDay} disabled={entry.status !== "Present"} onChange={(event) => setEntry(employee.id, { halfDay: event.target.checked })} className="size-4 accent-[#6d28d9] disabled:opacity-40" /></td><td className="px-4 py-3"><input aria-label={`${employeeDisplayName(employee)} late`} type="checkbox" checked={entry.late} disabled={entry.status !== "Present"} onChange={(event) => setEntry(employee.id, { late: event.target.checked })} className="size-4 accent-[#6d28d9] disabled:opacity-40" /></td><td className="px-4 py-3"><input aria-label={`${employeeDisplayName(employee)} note`} value={entry.note} onChange={(event) => setEntry(employee.id, { note: event.target.value })} placeholder="Optional" className="w-36 rounded-md border border-slate-200 px-2 py-1.5 text-xs" /></td></tr>; })}</tbody></table>{visibleEmployees.length === 0 && <p className="p-8 text-center text-xs text-slate-400">No employees match this search.</p>}</div>
    <footer className="flex items-center justify-between border-t border-slate-100 px-5 py-4"><p className="text-[10px] text-slate-400">Late and half-day are modifiers of Present.</p><div className="flex gap-2"><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Cancel</button><button type="button" onClick={() => onSave(employees.map((employee) => ({ employeeId: employee.id, ...entries[employee.id] })))} className="rounded-lg bg-[#6d28d9] px-4 py-2 text-xs font-semibold text-white">Save attendance</button></div></footer>
  </section></div>;
}

function Sidebar({ active, setActive, collapsed, setCollapsed, mobileNav, setMobileNav, onReset, companyName }: { active: string; setActive: (value: string) => void; collapsed: boolean; setCollapsed: (value: boolean) => void; mobileNav: boolean; setMobileNav: (value: boolean) => void; onReset: () => void; companyName: string }) {
  return <><div className={`fixed inset-0 z-40 bg-slate-950/30 lg:hidden ${mobileNav ? 'block' : 'hidden'}`} onClick={() => setMobileNav(false)} /><aside className={`fixed inset-y-0 left-0 z-50 flex w-[252px] flex-col border-r border-slate-200 bg-white transition-transform duration-200 ${mobileNav ? 'translate-x-0' : '-translate-x-full'} ${collapsed ? 'lg:w-[76px]' : 'lg:translate-x-0'} lg:translate-x-0`}>
    <div className="flex h-[76px] items-center gap-3 border-b border-slate-100 px-5"><div className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#6d28d9] text-sm font-bold text-white shadow-lg shadow-purple-200">{companyName.charAt(0).toUpperCase()}</div>{!collapsed && <div className="min-w-0"><div className="max-w-40 truncate text-[15px] font-bold tracking-tight" title={companyName}>{companyName}</div><div className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">Business suite</div></div>}<button aria-label="Close navigation" className="ml-auto lg:hidden" onClick={() => setMobileNav(false)}><X className="size-5 text-slate-400" /></button></div>
    <nav className="flex-1 overflow-y-auto px-3 py-5">{navGroups.map(group => <div key={group.label} className="mb-5"><div className={`mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 ${collapsed ? 'lg:hidden' : ''}`}>{group.label}</div>{group.items.map(item => { const Icon = iconMap[item.icon] || LayoutFallback; return <button key={item.label} title={collapsed ? item.label : undefined} onClick={() => setActive(item.label)} className={`group mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition ${active === item.label ? 'bg-[#f1eafd] text-[#6d28d9]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}><Icon className={`size-[17px] shrink-0 ${active === item.label ? 'text-[#6d28d9]' : 'text-slate-400 group-hover:text-slate-600'}`} />{!collapsed && <span className="truncate">{item.label}</span>}{!collapsed && active === item.label && <span className="ml-auto size-1.5 rounded-full bg-[#6d28d9]" />}</button> })}</div>)}</nav>
    <div className={`border-t border-slate-100 p-3 ${collapsed ? 'lg:flex lg:justify-center' : ''}`}><button title="Reset demo data" onClick={onReset} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-medium text-slate-500 hover:bg-slate-50"><Settings2 className="size-[17px] text-slate-400" />{!collapsed && <span>Reset demo data</span>}</button><div className={`mt-3 flex items-center gap-3 rounded-xl bg-slate-50 p-3 ${collapsed ? 'lg:hidden' : ''}`}><div className="grid size-8 shrink-0 place-items-center rounded-full bg-[#e9ddff] text-[11px] font-bold text-[#6d28d9]">SN</div><div className="min-w-0"><div className="truncate text-xs font-semibold">Sarah Namirembe</div><div className="truncate text-[10px] text-slate-400">Administrator</div></div><ChevronDown className="ml-auto size-3.5 text-slate-400" /></div></div>
  </aside></>
}
function LayoutFallback({ className }: { className?: string }) { return <div className={className} /> }
function EmployeeDetails({ employee, state, updateState, onBack, onViewPayrollRun, onViewAdvance }: { employee: Employee; state: ErpState; updateState: (next: ErpState) => void; onBack: () => void; onViewPayrollRun: (id: string) => void; onViewAdvance: (id: string) => void }) { return <EmployeeProfile employee={employee} state={state} updateState={updateState} onBack={onBack} onViewPayrollRun={onViewPayrollRun} onViewAdvance={onViewAdvance} /> }

const employeeWizardSteps = ["Personal", "Family", "Education", "Addresses", "Department & payroll", "Documents & review"] as const;
const employeeDepartments = ["Sales", "HR", "Inventory", "Marketing", "Production"];
const employeeRoles = ["Sales Manager", "General Manager", "Marketing Manager", "Inventory Manager", "Production Manager"];
const employeeKpiDemo = {
  total: 24,
  departments: [
    { name: "Sales", count: 7 },
    { name: "HR", count: 4 },
    { name: "Marketing", count: 3 },
    { name: "Inventory", count: 5 },
    { name: "Production", count: 5 },
  ],
  presentToday: 18,
  scheduledToday: 21,
  incomplete: 8,
  missingFields: 5,
  missingDocuments: 6,
  onLeaveToday: 3,
};

function EmployeeDirectory({ state, updateState, onView }: { state: ErpState; updateState: (next: ErpState) => void; onView: (id: string) => void }) {
  const [showWizard, setShowWizard] = useState(false);
  const [resumeDraft, setResumeDraft] = useState<EmployeeDraft | null>(null);
  const [query, setQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("All departments");
  const [categoryFilter, setCategoryFilter] = useState("All categories");
  const [frequencyFilter, setFrequencyFilter] = useState("All frequencies");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const standardDepartments = ["Sales", "HR", "Marketing", "Inventory", "Production"];
  const legacyDepartments = [...new Set(state.employees.map((employee) => employee.department).filter((department) => department && !standardDepartments.includes(department)))].sort();
  const departments = [...standardDepartments, ...legacyDepartments];
  const visibleEmployees = state.employees.filter((employee) => `${employeeDisplayName(employee)} ${employee.number} ${employee.department} ${employee.role} ${employee.category}`.toLowerCase().includes(query.toLowerCase())
    && (departmentFilter === "All departments" || employee.department === departmentFilter)
    && (categoryFilter === "All categories" || (categoryFilter === "Staff" ? ["Staff", "Staff employee"].includes(employee.category) : categoryFilter === "Casual" ? ["Casual", "Casual worker"].includes(employee.category) : employee.category === "Other"))
    && (frequencyFilter === "All frequencies" || (frequencyFilter === "Not set" ? !employee.paymentFrequency : employee.paymentFrequency === frequencyFilter))
    && (statusFilter === "All statuses" || employee.status === statusFilter));
  const resetFilters = () => { setQuery(""); setDepartmentFilter("All departments"); setCategoryFilter("All categories"); setFrequencyFilter("All frequencies"); setStatusFilter("All statuses"); };
  const discardDraft = (draft: EmployeeDraft) => {
    if (!window.confirm("Discard this employee draft? This cannot be undone.")) return;
    updateState({ ...state, employeeDrafts: state.employeeDrafts.filter((item) => item.id !== draft.id) });
  };
  const openDraft = (draft: EmployeeDraft) => { setResumeDraft(draft); setShowWizard(true); };

  return <div className="animate-in fade-in duration-300">
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><div className="mb-2 text-xs font-medium text-slate-400">Workspace / Employee Profiles</div><h2 className="text-2xl font-bold tracking-tight">Employee directory</h2><p className="mt-1 text-sm text-slate-500">Employee records, employment terms, and profile documents.</p></div>
      <button type="button" onClick={() => { setResumeDraft(null); setShowWizard(true); }} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#6d28d9] px-3 py-2.5 text-xs font-semibold text-white hover:bg-[#5b21b6]"><Plus className="size-4" /> Add employee</button>
    </div>
    <section aria-label="Employee workforce KPIs" className="mb-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
      <article className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between"><h3 className="text-xs font-semibold text-slate-600">Total employees</h3><span className="rounded bg-slate-100 px-1.5 py-1 text-[9px] font-bold uppercase text-slate-500">Demo data</span></div>
        <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{employeeKpiDemo.total}</div>
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-slate-100 pt-3 text-[11px]">{employeeKpiDemo.departments.map((department) => <div key={department.name} className="flex justify-between gap-2"><span className="text-slate-500">{department.name}</span><span className="font-semibold text-slate-700">{department.count}</span></div>)}</div>
      </article>
      <article className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between"><h3 className="text-xs font-semibold text-slate-600">Present today</h3><span className="rounded bg-slate-100 px-1.5 py-1 text-[9px] font-bold uppercase text-slate-500">Demo data</span></div>
        <div className="mt-2 flex items-baseline gap-2"><span className="text-2xl font-bold tracking-tight text-slate-900">{employeeKpiDemo.presentToday}</span><span className="text-xs text-slate-500">of {employeeKpiDemo.scheduledToday} scheduled</span></div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.round(employeeKpiDemo.presentToday / employeeKpiDemo.scheduledToday * 100)}%` }} /></div>
        <p className="mt-2 text-[10px] text-slate-400">Mock attendance snapshot</p>
      </article>
      <article className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between"><h3 className="text-xs font-semibold text-slate-600">Incomplete records</h3><span className="rounded bg-slate-100 px-1.5 py-1 text-[9px] font-bold uppercase text-slate-500">Demo data</span></div>
        <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{employeeKpiDemo.incomplete}</div>
        <p className="mt-1 text-[11px] text-slate-500">Employees missing required information</p>
        <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3"><span className="rounded bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-700">{employeeKpiDemo.missingFields} missing fields</span><span className="rounded bg-rose-50 px-2 py-1 text-[10px] font-medium text-rose-700">{employeeKpiDemo.missingDocuments} missing documents</span></div>
        <p className="mt-2 text-[9px] text-slate-400">Fields and documents can overlap.</p>
      </article>
      <article className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between"><h3 className="text-xs font-semibold text-slate-600">Employees on leave</h3><span className="rounded bg-slate-100 px-1.5 py-1 text-[9px] font-bold uppercase text-slate-500">Demo data</span></div>
        <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{employeeKpiDemo.onLeaveToday}</div>
        <p className="mt-1 text-[11px] text-slate-500">On approved leave today</p>
        <p className="mt-3 border-t border-slate-100 pt-3 text-[10px] text-slate-400">Disciplinary letters are managed separately.</p>
      </article>
    </section>
    {state.employeeDrafts.length > 0 && <section className="mb-4 overflow-hidden rounded-xl border border-amber-200 bg-white">
      <div className="border-b border-amber-100 px-4 py-3"><h3 className="text-sm font-bold">Employee drafts</h3><p className="mt-1 text-xs text-slate-500">Incomplete records are saved separately and are not treated as employees.</p></div>
      <div className="divide-y divide-slate-100">{state.employeeDrafts.map((draft) => <div key={draft.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-xs font-semibold text-slate-800">{employeeDisplayName(draft.employee)}</div><div className="mt-1 text-[10px] text-slate-400">Step {draft.currentStep + 1} of {employeeWizardSteps.length} · Updated {new Date(draft.updatedAt).toLocaleString()}</div></div><div className="flex gap-2"><button type="button" onClick={() => openDraft(draft)} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Resume</button><button type="button" onClick={() => discardDraft(draft)} className="rounded-md px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50">Discard</button></div></div>)}</div>
    </section>}
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><h3 className="text-sm font-bold">Employees</h3><p className="mt-1 text-xs text-slate-400">Showing {visibleEmployees.length} of {state.employees.length} records</p></div><label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><Search className="size-4 text-slate-400" /><input aria-label="Search employees" value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-xs outline-none placeholder:text-slate-400 sm:w-64" placeholder="Search name, number, department" /></label></div>
        <div className="mt-3 flex flex-wrap gap-2">
          <select aria-label="Filter employees by department" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><option>All departments</option>{departments.map((department) => <option key={department}>{department}</option>)}</select>
          <select aria-label="Filter employees by category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><option>All categories</option><option>Staff</option><option>Casual</option><option value="Other">Others</option></select>
          <select aria-label="Filter employees by payment frequency" value={frequencyFilter} onChange={(event) => setFrequencyFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><option>All frequencies</option><option>Monthly</option><option>Weekly</option><option value="Not set">Frequency not set</option></select>
          <select aria-label="Filter employees by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><option>All statuses</option><option>Active</option><option>Inactive</option></select>
          <button type="button" onClick={resetFilters} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"><Icons.RotateCcw className="size-3.5" /> Reset filters</button>
        </div>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[920px] text-left text-xs"><thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-400"><tr>{["Employee", "Department", "Role", "Category", "Pay type", "Frequency", "Salary / wage", "Status"].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead><tbody>{visibleEmployees.map((employee) => <tr key={employee.id} className="border-t border-slate-100 text-slate-600 hover:bg-slate-50/70"><td className="px-4 py-3"><button type="button" onClick={() => onView(employee.id)} className="flex items-center gap-3 text-left"><EmployeeAvatar employee={employee} size="sm" /><span className="font-semibold text-slate-800 hover:text-[#6d28d9]">{employeeDisplayName(employee)}<span className="mt-1 block font-mono text-[10px] font-normal text-slate-400">{employee.number}</span></span></button></td><td className="px-4 py-3">{employee.department}</td><td className="px-4 py-3">{employee.role}</td><td className="px-4 py-3">{employee.category}</td><td className="px-4 py-3">{employee.compensationType ?? "Not set"}</td><td className="px-4 py-3">{employee.paymentFrequency ?? "Not set"}</td><td className="px-4 py-3 font-semibold text-slate-700">{money(employee.salary)}</td><td className="px-4 py-3"><Status text={employee.status} /></td></tr>)}{visibleEmployees.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">No employees match those search terms and filters.</td></tr>}</tbody></table></div>
    </section>
    {showWizard && <EmployeeWizard state={state} updateState={updateState} draft={resumeDraft} onClose={() => { setShowWizard(false); setResumeDraft(null); }} />}
  </div>;
}

function EmployeeAvatar({ employee, size = "md" }: { employee: Partial<Employee>; size?: "sm" | "md" }) {
  const dimensions = size === "sm" ? "size-10 text-xs" : "size-16 text-lg";
  return employee.photoUrl
    ? <img src={employee.photoUrl} alt={`${employeeDisplayName(employee)} profile`} className={`${dimensions} shrink-0 rounded-full object-cover`} />
    : <div className={`${dimensions} grid shrink-0 place-items-center rounded-full bg-[#e9ddff] font-bold text-[#6d28d9]`}>{initials(employeeDisplayName(employee))}</div>;
}

function EmployeeWizard({ state, updateState, draft, employee, onClose }: { state: ErpState; updateState: (next: ErpState) => void; draft: EmployeeDraft | null; employee?: Employee; onClose: () => void }) {
  const [step, setStep] = useState(draft?.currentStep ?? 0);
  const [values, setValues] = useState<Partial<Employee>>(draft?.employee ?? employee ?? {});
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [documentNames, setDocumentNames] = useState<Record<string, string[]>>({});
  const [error, setError] = useState("");
  const keepLegacyName = Boolean(employee?.name && !employee.firstName && !employee.secondName && !values.firstName?.trim() && !values.secondName?.trim());
  const photoPreview = useMemo(() => photoFile ? URL.createObjectURL(photoFile) : null, [photoFile]);
  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview); }, [photoPreview]);
  const updateField = (name: string, value: string | number | boolean) => {
    const [group, key] = name.split(".");
    setValues((current) => {
      if (group === "mother" || group === "father") {
        return { ...current, [group]: { name: "", phone: "", address: "", status: "", ...current[group], [key]: value } };
      }
      return { ...current, [name]: value };
    });
    setError("");
  };
  const valueFor = (name: string) => {
    const [group, key] = name.split(".");
    return group === "mother" || group === "father" ? (values[group] as Employee[typeof group])?.[key as keyof Employee[typeof group]] ?? "" : values[name as keyof Employee] ?? "";
  };
  const fieldClass = "mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#8b5cf6] focus:ring-2 focus:ring-purple-100";
  const labelClass = "block text-xs font-semibold text-slate-600";
  const input = (name: string, label: string, options: { type?: string; required?: boolean; placeholder?: string; wide?: boolean; choices?: string[] } = {}) => {
    const val = valueFor(name);
    const field = options.choices ? <select required={options.required} name={name} value={String(val)} onChange={(event) => updateField(name, event.target.value)} className={fieldClass}><option value="">Select {label.toLowerCase()}</option>{options.choices.map((choice) => <option key={choice}>{choice}</option>)}</select>
      : options.type === "textarea" ? <textarea required={options.required} name={name} value={String(val)} onChange={(event) => updateField(name, event.target.value)} rows={3} placeholder={options.placeholder} className={fieldClass} />
        : <input required={options.required} name={name} type={options.type ?? "text"} min={options.type === "number" ? 0 : undefined} value={String(val)} onChange={(event) => updateField(name, options.type === "number" ? Number(event.target.value) : event.target.value)} placeholder={options.placeholder} className={fieldClass} />;
    return <label key={name} className={`${labelClass} ${options.wide ? "sm:col-span-2" : ""}`}>{label}{options.required && <span className="ml-1 text-rose-600">*</span>}{field}</label>;
  };
  const checkbox = (name: string, label: string) => <label key={name} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-medium text-slate-700"><input type="checkbox" checked={Boolean(valueFor(name))} onChange={(event) => updateField(name, event.target.checked)} className="size-4 accent-[#6d28d9]" />{label}</label>;
  const validateStep = () => {
    if (step === 0 && !keepLegacyName && (!values.firstName?.trim() || !values.secondName?.trim() || !values.dateOfBirth || !values.gender)) return "Enter first name, second name, date of birth, and gender to continue.";
    if (step === 1 && values.maritalStatus === "Married" && (!values.spouseName?.trim() || !values.spousePhone?.trim())) return "Enter the spouse's name and phone number to continue.";
    if (step === 3 && (!values.nextOfKinName?.trim() || !values.nextOfKinRelationship?.trim() || !values.nextOfKinPhone?.trim())) return "Enter the next-of-kin name, relationship, and phone number to continue.";
    if (step === 4 && (!values.category || !values.department || !values.role || !values.salary || !values.paymentFrequency || (!employee && !values.compensationType))) return "Complete category, department, role, pay type, salary/wage, and payment frequency.";
    return "";
  };
  const persistDraft = () => {
    const id = draft?.id ?? createId("EDRAFT");
    const nextDraft: EmployeeDraft = { id, employee: values, currentStep: step, updatedAt: new Date().toISOString() };
    updateState({ ...state, employeeDrafts: [nextDraft, ...state.employeeDrafts.filter((item) => item.id !== id)] });
    onClose();
  };
  const finish = () => {
    const validation = validateStep();
    if (validation) { setError(validation); return; }
    const name = employeeDisplayName(values);
    const completed: Employee = {
      ...(employee ?? {} as Employee),
      ...values,
      id: employee?.id ?? createId("E"),
      number: employee?.number ?? createId("EMP"),
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
      documents: employee?.documents ?? [],
      mother: values.mother ?? { name: "", phone: "", address: "", status: "" },
      father: values.father ?? { name: "", phone: "", address: "", status: "" },
    };
    const employees = employee ? state.employees.map((item) => item.id === employee.id ? completed : item) : [completed, ...state.employees];
    updateState({ ...state, employees, employeeDrafts: state.employeeDrafts.filter((item) => item.id !== draft?.id) });
    onClose();
  };
  const nextStep = () => { const validation = validateStep(); if (validation) { setError(validation); return; } setError(""); setStep((current) => Math.min(employeeWizardSteps.length - 1, current + 1)); };
  const closeWizard = () => { if (window.confirm("Close this form? Unsaved changes will be lost unless you save a draft.")) onClose(); };
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); if (step < employeeWizardSteps.length - 1) nextStep(); else finish(); };

  return <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/45 p-3 sm:p-6">
    <section role="dialog" aria-modal="true" aria-labelledby="employee-wizard-title" className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
      <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 id="employee-wizard-title" className="text-base font-bold">{employee ? "Edit employee" : draft ? "Resume employee draft" : "Add employee"}</h2><p className="mt-1 text-xs text-slate-500">Step {step + 1} of {employeeWizardSteps.length} · Drafts stay separate from employee records</p></div><button type="button" aria-label="Close employee form" onClick={closeWizard} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><X className="size-4" /></button></header>
      <div className="border-b border-slate-100 px-5 py-3"><div className="flex gap-2 overflow-x-auto">{employeeWizardSteps.map((label, index) => <button key={label} type="button" onClick={() => { if (index < step) { setError(""); setStep(index); } }} aria-current={step === index ? "step" : undefined} className={`shrink-0 rounded-md px-2.5 py-1.5 text-[10px] font-semibold ${step === index ? "bg-[#f1eafd] text-[#6d28d9]" : index < step ? "text-emerald-700 hover:bg-emerald-50" : "text-slate-400"}`}>{index + 1}. {label}</button>)}</div><div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#6d28d9] transition-all" style={{ width: `${((step + 1) / employeeWizardSteps.length) * 100}%` }} /></div></div>
      <form onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto p-5">
        {step === 0 && <div><h3 className="mb-1 text-sm font-bold">Personal identity</h3><p className="mb-4 text-xs text-slate-500">Enter the employee&apos;s legal names and basic details.</p>{keepLegacyName && <div className="mb-4 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">Existing full name: <strong>{employee?.name}</strong>. It will be preserved as saved; enter both structured names below only when you can verify them.</div>}<div className="grid gap-4 sm:grid-cols-2">{input("firstName", "First name", { required: !keepLegacyName })}{input("secondName", "Second name", { required: !keepLegacyName })}{input("otherNames", "Other names", { wide: true })}{input("dateOfBirth", "Date of birth", { type: "date", required: !keepLegacyName })}{input("gender", "Gender", { choices: ["Female", "Male", "Prefer not to say"] })}{input("phone", "Phone number", { type: "tel" })}{input("email", "Email address", { type: "email" })}<div className="sm:col-span-2"><span className={labelClass}>Profile photo</span><div className="mt-2 flex items-center gap-4"><div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-[#e9ddff] text-lg font-bold text-[#6d28d9]">{photoPreview ? <img src={photoPreview} alt="Selected employee preview" className="size-full object-cover" /> : initials(employeeDisplayName(values))}</div><div><input type="file" accept="image/*" aria-label="Choose employee photo" onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)} className="block max-w-full text-xs text-slate-500 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-700" /><p className="mt-1 text-[10px] text-slate-400">Preview only. Photo upload and storage will be connected later.</p></div></div></div></div></div>}
        {step === 1 && <div><h3 className="mb-1 text-sm font-bold">Family details</h3><p className="mb-4 text-xs text-slate-500">Spouse information is only requested when marital status is Married.</p><div className="grid gap-4 sm:grid-cols-2">{input("maritalStatus", "Marital status", { choices: ["Single", "Married", "Separated", "Divorced", "Widowed"] })}{values.maritalStatus === "Married" && <>{input("spouseName", "Spouse name", { required: true })}{input("spousePhone", "Spouse phone", { required: true, type: "tel" })}</>}{input("childrenCount", "Number of children", { type: "number" })}{[["mother.name", "Mother's name"], ["mother.phone", "Mother's phone"], ["mother.address", "Mother's current address"], ["mother.status", "Mother's status"], ["father.name", "Father's name"], ["father.phone", "Father's phone"], ["father.address", "Father's current address"], ["father.status", "Father's status"]].map(([name, label]) => name.endsWith("status") ? input(name, label, { choices: ["Alive", "Deceased"] }) : input(name, label, { type: name.endsWith("phone") ? "tel" : undefined, wide: name.endsWith("address") }))}</div></div>}
        {step === 2 && <div><h3 className="mb-1 text-sm font-bold">Education & profession</h3><p className="mb-4 text-xs text-slate-500">Capture the employee&apos;s highest completed education and profession.</p><div className="grid gap-4 sm:grid-cols-2">{input("educationLevel", "Level of education", { choices: ["Primary", "Secondary", "Certificate", "Diploma", "Bachelor's degree", "Postgraduate", "Other"] })}{input("profession", "Profession", { placeholder: "e.g. Accountant, Driver, Engineer" })}</div></div>}
        {step === 3 && <div><h3 className="mb-1 text-sm font-bold">Addresses & next of kin</h3><p className="mb-4 text-xs text-slate-500">Add the employee&apos;s current location, origin, and emergency contact.</p><div className="grid gap-4 sm:grid-cols-2">{input("currentAddress", "Current address", { type: "textarea", wide: true })}{input("placeOfOrigin", "Place of origin", { type: "textarea", wide: true })}{input("nextOfKinName", "Next of kin name", { required: true })}{input("nextOfKinRelationship", "Relationship", { required: true })}{input("nextOfKinPhone", "Next of kin phone", { required: true, type: "tel" })}{input("nextOfKinAddress", "Next of kin current address", { type: "textarea", wide: true })}</div></div>}
        {step === 4 && <div><h3 className="mb-1 text-sm font-bold">Department & payroll</h3><p className="mb-4 text-xs text-slate-500">Category, pay type, and pay frequency are separate. Payroll deductions are not calculated in this form.</p><div className="grid gap-4 sm:grid-cols-2">{input("category", "Employee category", { choices: ["Staff employee", "Casual worker", "Other"] })}{input("department", "Department", { choices: [...new Set([...employeeDepartments, ...state.employees.map((item) => item.department), values.department].filter((item): item is string => Boolean(item)))] })}{input("role", "Primary role", { choices: [...new Set([...employeeRoles, ...state.employees.map((item) => item.role), values.role].filter((item): item is string => Boolean(item)))] })}{input("compensationType", "Pay type", { choices: ["Salary earner", "Wage earner"] })}{input("salary", "Salary / wage (UGX)", { type: "number", required: true })}{input("paymentFrequency", "Payment frequency", { choices: ["Monthly", "Weekly"] })}{input("status", "Employment status", { choices: ["Active", "Inactive"] })}{input("nssfNumber", "NSSF account number")}{input("tinNumber", "TIN number")}{checkbox("nssfApplies", "NSSF deduction applies")}{checkbox("taxApplies", "Tax deduction applies")}</div></div>}
        {step === 5 && <div><h3 className="mb-1 text-sm font-bold">Documents & review</h3><p className="mb-4 text-xs text-slate-500">Choose files to preview their names. Upload and URL generation will be added with the backend integration.</p><div className="grid gap-3 sm:grid-cols-2">{["CV", "LC letter", "Cover letter", "Police letter", "ID"].map((title) => <label key={title} className={`${labelClass} rounded-lg border border-slate-200 p-3`}>{title}<input type="file" aria-label={`Select ${title}`} onChange={(event) => setDocumentNames((current) => ({ ...current, [title]: Array.from(event.target.files ?? []).map((file) => file.name) }))} className="mt-2 block w-full text-[11px] text-slate-500 file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-2.5 file:py-1.5 file:text-[10px] file:font-semibold" />{documentNames[title]?.map((name) => <span key={name} className="mt-2 block truncate text-[10px] font-normal text-emerald-700">Selected: {name} · not uploaded</span>)}</label>)}</div><div className="mt-5 rounded-lg bg-slate-50 p-4"><h4 className="text-xs font-bold">Review employee</h4><dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2"><ReviewValue label="Name" value={employeeDisplayName(values)} /><ReviewValue label="Date of birth" value={values.dateOfBirth} /><ReviewValue label="Category" value={values.category} /><ReviewValue label="Department / role" value={`${values.department || "Not set"} · ${values.role || "Not set"}`} /><ReviewValue label="Pay" value={`${money(Number(values.salary) || 0)} · ${values.paymentFrequency || "Frequency not set"}`} /><ReviewValue label="NSSF / tax" value={`${values.nssfApplies ? "NSSF applies" : "No NSSF"} · ${values.taxApplies ? "Tax applies" : "No tax"}`} /></dl></div></div>}
        {error && <p role="alert" className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{error}</p>}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={closeWizard} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50">Cancel</button><div className="flex flex-wrap gap-2"><button type="button" onClick={persistDraft} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Save draft</button>{step > 0 && <button type="button" onClick={() => { setError(""); setStep((current) => Math.max(0, current - 1)); }} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Previous</button>}<button type="submit" className="rounded-lg bg-[#6d28d9] px-4 py-2 text-xs font-semibold text-white hover:bg-[#5b21b6]">{step === employeeWizardSteps.length - 1 ? employee ? "Save changes" : "Complete employee" : "Continue"}</button></div></div>
      </form>
    </section>
  </div>;
}

function ReviewValue({ label, value }: { label: string; value?: string | number }) { return <div><dt className="text-[10px] text-slate-400">{label}</dt><dd className="mt-1 font-semibold text-slate-700">{value || "Not provided"}</dd></div>; }

type EmployeeProfileTab = "overview" | "personal" | "employment" | "documents" | "attendance" | "payroll" | "advances" | "leave" | "punishment";

function EmployeeProfile({ employee, state, updateState, onBack, onViewPayrollRun, onViewAdvance }: { employee: Employee; state: ErpState; updateState: (next: ErpState) => void; onBack: () => void; onViewPayrollRun: (id: string) => void; onViewAdvance: (id: string) => void }) {
  const [activeTab, setActiveTab] = useState<EmployeeProfileTab>("overview");
  const [showEdit, setShowEdit] = useState(false);
  const [selectedAttendanceRecord, setSelectedAttendanceRecord] = useState<AttendanceRecord | null>(null);
  const [attendanceView, setAttendanceView] = useState<"calendar" | "list">("calendar");
  const [attendanceMonth, setAttendanceMonth] = useState(() => companyWorkDate().slice(0, 7));
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const previewUrl = useMemo(() => photoFile ? URL.createObjectURL(photoFile) : null, [photoFile]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  const tabs: { id: EmployeeProfileTab; label: string }[] = [
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
  const displayName = employeeDisplayName(employee);
  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const buttons = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role=tab]") ?? []);
    const index = buttons.indexOf(event.currentTarget);
    const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowRight" ? 1 : buttons.length - 1)) % buttons.length;
    buttons[nextIndex]?.focus();
    buttons[nextIndex]?.click();
  };
  const field = (label: string, value?: string | number | boolean) => <div key={label}><div className="text-[11px] text-slate-400">{label}</div><div className="mt-1 break-words text-sm font-semibold text-slate-800">{value === undefined || value === "" ? "Not provided" : String(value)}</div></div>;
  const emptyHistory = (title: string) => <section className="rounded-xl border border-slate-200 bg-white px-5 py-12 text-center"><div className="mx-auto grid size-11 place-items-center rounded-full bg-slate-100 text-slate-500"><Icons.CalendarClock className="size-5" /></div><h3 className="mt-3 text-sm font-bold">No {title.toLowerCase()} yet</h3><p className="mx-auto mt-1 max-w-md text-xs text-slate-500">{title} records will appear here when the related HR workflow is connected.</p></section>;
  const employeeAttendance = state.attendanceRecords.filter((record) => record.employeeId === employee.id && record.workDate.startsWith(`${attendanceMonth}-`)).sort((left, right) => right.workDate.localeCompare(left.workDate));
  const attendanceMonthStart = new Date(`${attendanceMonth}-01T12:00:00+03:00`);
  const attendanceMonthDays = new Date(Date.UTC(attendanceMonthStart.getUTCFullYear(), attendanceMonthStart.getUTCMonth() + 1, 0)).getUTCDate();
  const firstWeekday = (attendanceMonthStart.getUTCDay() + 6) % 7;
  const attendanceCalendarCells: Array<string | null> = [...Array.from({ length: firstWeekday }, () => null), ...Array.from({ length: attendanceMonthDays }, (_, index) => `${attendanceMonth}-${String(index + 1).padStart(2, "0")}`)];
  while (attendanceCalendarCells.length % 7 !== 0) attendanceCalendarCells.push(null);
  const attendanceWeekday = (date: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Kampala", weekday: "short" }).format(new Date(`${date}T12:00:00+03:00`));
  const attendanceSummary = {
    present: employeeAttendance.filter((record) => record.status === "Present").length,
    fullDays: employeeAttendance.filter((record) => record.status === "Present" && !record.halfDay).length,
    halfDays: employeeAttendance.filter((record) => record.status === "Present" && record.halfDay).length,
    late: employeeAttendance.filter((record) => record.status === "Present" && record.late).length,
    absent: employeeAttendance.filter((record) => record.status === "Absent").length,
    leave: employeeAttendance.filter((record) => record.status === "On leave").length,
  };
  const changeAttendanceMonth = (offset: number) => {
    const [year, month] = attendanceMonth.split("-").map(Number);
    const next = new Date(Date.UTC(year, month - 1 + offset, 1));
    setAttendanceMonth(`${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`);
  };
  const attendanceMonthLabel = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Kampala", month: "long", year: "numeric" }).format(attendanceMonthStart);
  const attendanceRecordForDay = (date: string) => employeeAttendance.find((record) => record.workDate === date);
  const attendanceDayLabel = (date: string, record?: AttendanceRecord) => {
    const dateLabel = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Kampala", dateStyle: "full" }).format(new Date(`${date}T12:00:00+03:00`));
    if (!record) return `${dateLabel}: no attendance record`;
    const details = record.status === "Present" ? `${record.halfDay ? "half day" : "full day"}${record.late ? ", late" : ""}` : "";
    return `${dateLabel}: ${record.status}${details ? `, ${details}` : ""}`;
  };
  const openAttendanceRecord = (record: AttendanceRecord) => setSelectedAttendanceRecord(record);
  const tabContent = () => {
    if (activeTab === "overview") return <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="text-sm font-bold">Employee summary</h3><div className="mt-4 grid gap-4 sm:grid-cols-2">{field("Employee number", employee.number)}{field("Category", employee.category)}{field("Department", employee.department)}{field("Primary role", employee.role)}{field("Employment status", employee.status)}{field("Payment frequency", employee.paymentFrequency)}</div></section>
      <section className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="text-sm font-bold">Personal summary</h3><div className="mt-4 grid gap-4 sm:grid-cols-2">{field("Date of birth", employee.dateOfBirth)}{field("Gender", employee.gender)}{field("Phone", employee.phone)}{field("Email", employee.email)}{field("Current address", employee.currentAddress)}</div></section>
      <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2"><h3 className="text-sm font-bold">Record completion</h3><p className="mt-1 text-xs text-slate-500">Profile image and document uploads are not connected yet.</p><div className="mt-4 flex flex-wrap gap-2">{[["Personal details", Boolean(employee.firstName && employee.secondName)], ["Employment details", Boolean(employee.department && employee.role)], ["NSSF number", Boolean(employee.nssfNumber)], ["TIN", Boolean(employee.tinNumber)], ["Documents", Boolean(employee.documents?.length)]].map(([label, complete]) => <span key={String(label)} className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[10px] font-semibold ${complete ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}><span className={`size-1.5 rounded-full ${complete ? "bg-emerald-500" : "bg-slate-400"}`} />{label}: {complete ? "Complete" : "Not added"}</span>)}</div></section>
    </div>;
    if (activeTab === "personal") return <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="text-sm font-bold">Personal details</h3><div className="mt-4 grid gap-4 sm:grid-cols-2">{field("First name", employee.firstName)}{field("Second name", employee.secondName)}{field("Other names", employee.otherNames)}{field("Date of birth", employee.dateOfBirth)}{field("Gender", employee.gender)}{field("Marital status", employee.maritalStatus)}{field("Number of children", employee.childrenCount)}</div></section>
      <section className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="text-sm font-bold">Spouse</h3><div className="mt-4 grid gap-4 sm:grid-cols-2">{field("Name", employee.maritalStatus === "Married" ? employee.spouseName : "Not applicable")}{field("Phone", employee.maritalStatus === "Married" ? employee.spousePhone : "Not applicable")}</div></section>
      <section className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="text-sm font-bold">Next of kin</h3><div className="mt-4 grid gap-4 sm:grid-cols-2">{field("Name", employee.nextOfKinName)}{field("Relationship", employee.nextOfKinRelationship)}{field("Phone", employee.nextOfKinPhone)}{field("Current address", employee.nextOfKinAddress)}</div></section>
      <section className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="text-sm font-bold">Parents</h3><div className="mt-4 grid gap-5 sm:grid-cols-2">{(["mother", "father"] as const).map((parent) => <div key={parent}><h4 className="text-xs font-semibold capitalize text-slate-700">{parent}</h4><div className="mt-3 grid gap-3">{field("Name", employee[parent]?.name)}{field("Phone", employee[parent]?.phone)}{field("Current address", employee[parent]?.address)}{field("Status", employee[parent]?.status)}</div></div>)}</div></section>
    </div>;
    if (activeTab === "employment") return <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="text-sm font-bold">Employment</h3><div className="mt-4 grid gap-4 sm:grid-cols-2">{field("Employee number", employee.number)}{field("Category", employee.category)}{field("Department", employee.department)}{field("Role", employee.role)}{field("Status", employee.status)}</div></section>
      <section className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="text-sm font-bold">Payroll setup</h3><div className="mt-4 grid gap-4 sm:grid-cols-2">{field("Pay type", employee.compensationType)}{field("Salary / wage", money(employee.salary))}{field("Frequency", employee.paymentFrequency)}{field("NSSF account number", employee.nssfNumber)}{field("TIN number", employee.tinNumber)}{field("NSSF deduction", employee.nssfApplies ? "Applies" : "Does not apply")}{field("Tax deduction", employee.taxApplies ? "Applies" : "Does not apply")}</div><p className="mt-4 text-[10px] text-slate-400">This profile does not calculate statutory deductions.</p></section>
      <section className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="text-sm font-bold">Education & profession</h3><div className="mt-4 grid gap-4 sm:grid-cols-2">{field("Education level", employee.educationLevel)}{field("Profession", employee.profession)}</div></section>
      <section className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="text-sm font-bold">Addresses</h3><div className="mt-4 grid gap-4">{field("Current address", employee.currentAddress)}{field("Place of origin", employee.placeOfOrigin)}</div></section>
    </div>;
    if (activeTab === "documents") return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="border-b border-slate-100 px-5 py-4"><h3 className="text-sm font-bold">Employee documents</h3><p className="mt-1 text-xs text-slate-500">Files are not uploaded or stored in this UI-only phase.</p></div>{employee.documents?.length ? <div className="divide-y divide-slate-100">{employee.documents.map((document, index) => <div key={`${document.publicId}-${index}`} className="flex items-center justify-between gap-3 px-5 py-3"><div className="flex min-w-0 items-center gap-3"><Icons.FileText className="size-4 shrink-0 text-slate-400" /><div className="min-w-0"><div className="truncate text-xs font-semibold">{document.title}</div><div className="truncate text-[10px] text-slate-400">{document.publicId}</div></div></div><div className="flex gap-2"><a aria-disabled={!document.url} href={document.url || undefined} target="_blank" rel="noreferrer" className={`rounded-md border px-2.5 py-1.5 text-[10px] font-semibold ${document.url ? "border-slate-200 text-slate-700" : "pointer-events-none border-slate-100 text-slate-300"}`}>View</a><a aria-disabled={!document.download_Url} href={document.download_Url || undefined} download className={`rounded-md border px-2.5 py-1.5 text-[10px] font-semibold ${document.download_Url ? "border-slate-200 text-slate-700" : "pointer-events-none border-slate-100 text-slate-300"}`}>Download</a></div></div>)}</div> : <p className="px-5 py-12 text-center text-xs text-slate-400">No uploaded documents. Connect document upload to add CV, LC letter, cover letter, police letter, or ID.</p>}</section>;
    if (activeTab === "attendance") return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-4 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h3 className="text-sm font-bold">Attendance</h3><p className="mt-1 text-xs text-slate-500">{attendanceMonthLabel} · {employeeAttendance.length} recorded day{employeeAttendance.length === 1 ? "" : "s"}</p></div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5" role="group" aria-label="Attendance view"><button type="button" aria-pressed={attendanceView === "calendar"} onClick={() => setAttendanceView("calendar")} className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${attendanceView === "calendar" ? "bg-slate-100 text-slate-900" : "text-slate-500"}`}><Icons.CalendarDays className="mr-1.5 inline size-3.5" />Calendar</button><button type="button" aria-pressed={attendanceView === "list"} onClick={() => setAttendanceView("list")} className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${attendanceView === "list" ? "bg-slate-100 text-slate-900" : "text-slate-500"}`}><Icons.List className="mr-1.5 inline size-3.5" />List</button></div>
          <div className="flex items-center gap-1"><button type="button" aria-label="Previous month" onClick={() => changeAttendanceMonth(-1)} className="grid size-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100"><ChevronLeft className="size-4" /></button><button type="button" aria-label="Next month" onClick={() => changeAttendanceMonth(1)} className="grid size-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100"><ChevronRight className="size-4" /></button></div>
        </div>
      </div>
      {attendanceView === "calendar" ? <div className="p-4">
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">{[["Recorded days", employeeAttendance.length, "text-slate-800"], ["Full days", attendanceSummary.fullDays, "text-emerald-700"], ["Half-days", attendanceSummary.halfDays, "text-orange-700"], ["Late", attendanceSummary.late, "text-blue-700"], ["Absent", attendanceSummary.absent, "text-rose-700"], ["Leave", attendanceSummary.leave, "text-sky-700"]].map(([label, value, color]) => <div key={String(label)} className="rounded-lg bg-slate-50 px-3 py-2"><div className="text-[10px] text-slate-400">{label}</div><div className={`mt-0.5 text-sm font-bold ${color}`}>{value}</div></div>)}</div>
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2 text-[10px] text-slate-500"><span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-emerald-500" />Present</span><span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-orange-400" />Half-day</span><span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-rose-500" />Absent</span><span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-sky-500" />On leave</span><span className="flex items-center gap-1.5"><i className="grid size-3 place-items-center rounded-full bg-blue-600 text-[8px] font-bold not-italic text-white">L</i>Late</span></div>
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <div key={day} className="py-1 text-center text-[10px] font-semibold uppercase text-slate-400">{day}</div>)}{attendanceCalendarCells.map((date, index) => {
          if (!date) return <div key={`pad-${attendanceMonth}-${index}`} aria-hidden="true" className="aspect-square min-h-10 rounded-lg bg-transparent sm:min-h-14" />;
          const record = attendanceRecordForDay(date);
          const isWeekend = ["Sat", "Sun"].includes(attendanceWeekday(date));
          const background = !record ? isWeekend ? "bg-slate-50 text-slate-300" : "bg-white text-slate-400" : record.status === "Absent" ? "bg-rose-500 text-white" : record.status === "On leave" ? "bg-sky-500 text-white" : record.status === "Present" && record.halfDay ? "bg-orange-400 text-white" : record.status === "Present" ? "bg-emerald-500 text-white" : "bg-white text-slate-300";
          const marker = !record ? "" : record.status === "Absent" ? "A" : record.status === "On leave" ? "L" : record.status === "Present" && record.halfDay ? "½" : record.status === "Present" ? "P" : "";
          return <button key={date} type="button" aria-label={attendanceDayLabel(date, record)} title={attendanceDayLabel(date, record)} onClick={() => record && openAttendanceRecord(record)} disabled={!record} className={`relative flex aspect-square min-h-10 flex-col items-center justify-center rounded-lg border border-slate-100 text-xs font-semibold transition sm:min-h-14 ${background} ${record ? "cursor-pointer hover:ring-2 hover:ring-slate-300" : "cursor-default"}`}><span className="text-[10px] opacity-75">{Number(date.slice(-2))}</span><span className="text-sm">{marker}</span>{record?.status === "Present" && record.late && <span aria-hidden="true" className="absolute right-1 top-1 grid size-3 place-items-center rounded-full bg-blue-600 text-[7px] font-bold leading-none text-white">L</span>}</button>;
        })}</div>
        {!employeeAttendance.length && <p className="mt-4 text-center text-xs text-slate-400">No attendance records for this month. Unrecorded days remain blank.</p>}
      </div> : <div>{employeeAttendance.length ? <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase text-slate-400"><tr>{["Work date", "Status", "Day", "Late", "Notes", "Last updated"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{employeeAttendance.map((record) => <tr key={record.id} className="border-t border-slate-100 text-slate-600 hover:bg-slate-50/70"><td className="px-4 py-3"><button type="button" onClick={() => openAttendanceRecord(record)} aria-label={`View attendance record for ${formatDate(record.workDate)}`} className="font-semibold text-[#6d28d9] hover:underline">{formatDate(record.workDate)}</button></td><td className="px-4 py-3"><Status text={record.status === "Present" && record.halfDay ? "Half-day" : record.status} /></td><td className="px-4 py-3">{record.status === "Present" ? record.halfDay ? "Half day" : "Full day" : "—"}</td><td className="px-4 py-3">{record.status === "Present" && record.late ? "Yes" : "—"}</td><td className="px-4 py-3">{record.note || "—"}</td><td className="px-4 py-3 text-slate-400">{new Date(record.updatedAt).toLocaleString()}</td></tr>)}</tbody></table></div> : <p className="px-5 py-12 text-center text-xs text-slate-400">No attendance records for this month.</p>}</div>}
    </section>;
    if (activeTab === "payroll") {
      const payslips = state.payrollRuns.flatMap((run) => run.payslips.filter((slip) => slip.employeeId === employee.id).map((slip) => ({ run, slip }))).sort((left, right) => right.run.periodStart.localeCompare(left.run.periodStart));
      return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="border-b border-slate-100 px-5 py-4"><h3 className="text-sm font-bold">Payroll history</h3><p className="mt-1 text-xs text-slate-500">Saved payslip snapshots · amounts are shown only when recorded in a run.</p></div>{payslips.length ? <div className="overflow-x-auto"><table className="w-full min-w-190 text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase text-slate-400"><tr>{["Payroll run", "Frequency", "Period", "Pay setup", "Gross", "Deductions", "Net", "Run status"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{payslips.map(({ run, slip }) => <tr key={slip.id} className="border-t border-slate-100 text-slate-600"><td className="px-4 py-3"><button type="button" onClick={() => onViewPayrollRun(run.id)} className="font-semibold text-[#6d28d9] hover:underline">{run.reference}</button><span className="mt-1 block text-[10px] text-slate-400">{slip.employeeNumber} snapshot</span></td><td className="px-4 py-3">{slip.paymentFrequency}</td><td className="px-4 py-3">{formatDate(run.periodStart)} – {formatDate(run.periodEnd)}</td><td className="px-4 py-3">{slip.compensationType ?? "Needs setup"}<span className="mt-1 block text-[10px] text-slate-400">Rate {slip.configuredRate ? money(slip.configuredRate) : "not set"} · {slip.attendanceUnits ?? 0} attendance units</span></td><td className="px-4 py-3">{slip.grossPay === undefined ? "Not calculated" : money(slip.grossPay)}</td><td className="px-4 py-3">{slip.deductionTotal === undefined ? "Not calculated" : money(slip.deductionTotal)}</td><td className="px-4 py-3 font-semibold">{slip.netPay === undefined ? "Not calculated" : money(slip.netPay)}</td><td className="px-4 py-3">{run.status} · {slip.paymentStatus}</td></tr>)}</tbody></table></div> : emptyHistory("Payroll history")}</section>;
    }
    if (activeTab === "advances") {
      const employeeAdvances = state.salaryAdvances.filter((advance) => advance.employeeId === employee.id).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      const amountRepaid = (advance: ErpState["salaryAdvances"][number]) => advance.repayments.reduce((total, repayment) => total + repayment.amount, 0);
      const outstanding = (advance: ErpState["salaryAdvances"][number]) => Math.max(0, (advance.disbursement?.amount ?? 0) - amountRepaid(advance));
      return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="border-b border-slate-100 px-5 py-4"><h3 className="text-sm font-bold">Salary advances</h3><p className="mt-1 text-xs text-slate-500">Advance requests, disbursements, and recorded repayments linked to this employee.</p></div>{employeeAdvances.length ? <div className="overflow-x-auto"><table className="w-full min-w-190 text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase text-slate-400"><tr>{["Advance", "Requested", "Disbursed", "Repaid", "Balance", "Frequency", "Status"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{employeeAdvances.map((advance) => <tr key={advance.id} className="border-t border-slate-100 text-slate-600"><td className="px-4 py-3"><button type="button" onClick={() => onViewAdvance(advance.id)} className="font-semibold text-[#087e75] hover:underline">{advance.reference}</button><span className="mt-1 block text-[10px] text-slate-400">{formatDate(advance.requestedAt.slice(0, 10))}</span></td><td className="px-4 py-3">{money(advance.requestedAmount)}</td><td className="px-4 py-3">{advance.disbursement ? money(advance.disbursement.amount) : "—"}</td><td className="px-4 py-3">{money(amountRepaid(advance))}</td><td className="px-4 py-3 font-semibold">{advance.disbursement ? money(outstanding(advance)) : "—"}</td><td className="px-4 py-3">{advance.approvedFrequency ?? advance.proposedFrequency}</td><td className="px-4 py-3">{advance.status}</td></tr>)}</tbody></table></div> : emptyHistory("Salary advances")}</section>;
    }
    if (activeTab === "leave") {
      const employeeLeave = state.leaveRequests.filter((request) => request.employeeId === employee.id).sort((left, right) => right.startDate.localeCompare(left.startDate));
      return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="border-b border-slate-100 px-5 py-4"><h3 className="text-sm font-bold">Leave history</h3><p className="mt-1 text-xs text-slate-500">Submitted and reviewed leave requests linked to this employee.</p></div>{employeeLeave.length ? <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase text-slate-400"><tr>{["Request", "Leave type", "Dates", "Working days", "Handover", "Status"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{employeeLeave.map((request) => <tr key={request.id} className="border-t border-slate-100 text-slate-600"><td className="px-4 py-3 font-semibold text-slate-800">{request.reference}<span className="mt-1 block text-[10px] font-normal text-slate-400">Submitted {formatDate(request.requestedAt.slice(0, 10))}</span></td><td className="px-4 py-3">{request.leaveType === "Other" ? request.otherLeaveType : request.leaveType}</td><td className="px-4 py-3">{formatDate(request.startDate)} – {formatDate(request.endDate)}</td><td className="px-4 py-3">{request.requestedDays}</td><td className="px-4 py-3">{request.handoverName}</td><td className="px-4 py-3">{request.status}</td></tr>)}</tbody></table></div> : emptyHistory("Leave history")}</section>;
    }
    const historyNames: Partial<Record<EmployeeProfileTab, string>> = { attendance: "Attendance", payroll: "Payroll history", advances: "Salary advances", leave: "Leave history", punishment: "Punishment history" };
    return emptyHistory(historyNames[activeTab] ?? "HR history");
  };

  return <div className="animate-in fade-in duration-300">
    <button onClick={onBack} className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-[#6d28d9] hover:underline"><ChevronLeft className="size-4" /> Back to employee list</button>
    <header className="mb-5 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center">
      <div className="relative"><EmployeeAvatar employee={previewUrl ? { ...employee, photoUrl: previewUrl } : employee} /><label className="absolute -bottom-1 -right-1 grid size-7 cursor-pointer place-items-center rounded-full border-2 border-white bg-slate-100 text-slate-600 hover:bg-slate-200" title="Choose a temporary photo preview"><Icons.Camera className="size-3.5" /><input type="file" accept="image/*" aria-label="Update employee photo preview" onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)} className="sr-only" /></label></div>
      <div className="min-w-0 flex-1"><div className="text-xs text-slate-400">Employee profile · {employee.number}</div><h2 className="mt-1 truncate text-xl font-bold tracking-tight text-slate-900">{displayName}</h2><div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500"><span>{employee.department}</span><span>·</span><span>{employee.role}</span><span>·</span><span>{employee.category}</span><Status text={employee.status} /></div><p className="mt-2 text-[10px] text-slate-400">Photo preview only; upload storage is not connected.</p></div>
      <button type="button" onClick={() => setShowEdit(true)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Icons.PencilLine className="size-3.5" /> Edit profile</button>
    </header>
    <div role="tablist" aria-label={`${displayName} profile sections`} className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">{tabs.map((tab) => <button key={tab.id} type="button" role="tab" id={`employee-tab-${tab.id}`} aria-selected={activeTab === tab.id} aria-controls={`employee-panel-${tab.id}`} tabIndex={activeTab === tab.id ? 0 : -1} onClick={() => setActiveTab(tab.id)} onKeyDown={handleTabKeyDown} className={`shrink-0 border-b-2 px-3 py-3 text-xs font-semibold transition ${activeTab === tab.id ? "border-[#6d28d9] text-[#6d28d9]" : "border-transparent text-slate-500 hover:text-slate-800"}`}>{tab.label}</button>)}</div>
    <section id={`employee-panel-${activeTab}`} role="tabpanel" aria-labelledby={`employee-tab-${activeTab}`} tabIndex={0}>{tabContent()}</section>
    {selectedAttendanceRecord && <AttendanceRecordDialog employeeName={displayName} record={selectedAttendanceRecord} onClose={() => setSelectedAttendanceRecord(null)} />}
    {showEdit && <EmployeeWizard state={state} updateState={updateState} draft={null} employee={employee} onClose={() => setShowEdit(false)} />}
  </div>;
}

function AttendanceRecordDialog({ employeeName, record, onClose }: { employeeName: string; record: AttendanceRecord; onClose: () => void }) {
  const closeFromBackdrop = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };
  const detail = (label: string, value: string) => <div key={label} className="border-b border-slate-100 py-3 last:border-0"><div className="text-[10px] font-medium uppercase text-slate-400">{label}</div><div className="mt-1 break-words text-sm font-semibold text-slate-800">{value || "—"}</div></div>;
  return <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/40 p-4" onMouseDown={closeFromBackdrop}><section role="dialog" aria-modal="true" aria-labelledby="attendance-record-title" className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
    <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 id="attendance-record-title" className="text-base font-bold">Attendance record</h2><p className="mt-1 text-xs text-slate-500">{employeeName} · {formatDate(record.workDate)}</p></div><button type="button" aria-label="Close attendance record" onClick={onClose} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><X className="size-4" /></button></header>
    <div className="px-5 py-2">{detail("Status", record.status)}{detail("Day length", record.status === "Present" ? record.halfDay ? "Half day" : "Full day" : "Not applicable")}{detail("Late", record.status === "Present" ? record.late ? "Yes" : "No" : "Not applicable")}{detail("Check-in", record.checkIn ?? "Not recorded")}{detail("Check-out", record.checkOut ?? "Not recorded")}{detail("Note", record.note ?? "No note")}{detail("Last updated", new Date(record.updatedAt).toLocaleString())}</div>
    <footer className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4"><p className="text-[10px] text-slate-400">Correction history is not available yet.</p><button type="button" onClick={onClose} className="rounded-lg bg-[#6d28d9] px-4 py-2 text-xs font-semibold text-white">Close</button></footer>
  </section></div>;
}
function customerSalesFor(customer: ErpState["customers"][number], state: ErpState) {
  return state.sales.filter((sale) => sale.customerId
    ? sale.customerId === customer.id
    : sale.customer.trim().toLowerCase() === customer.name.trim().toLowerCase());
}

function customerOrdersFor(customer: ErpState["customers"][number], state: ErpState) {
  return state.orders.filter((order) => order.customerId
    ? order.customerId === customer.id
    : order.customer.trim().toLowerCase() === customer.name.trim().toLowerCase());
}

function customerCreditBalance(customer: ErpState["customers"][number], state: ErpState) {
  return sum(customerSalesFor(customer, state)
    .filter((sale) => sale.paymentTerms === "Credit")
    .map((sale) => balanceForSale(sale, state.payments)));
}

function CustomerManagementPage({ state, updateState, onView }: {
  state: ErpState;
  updateState: (next: ErpState) => void;
  onView: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All types");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [regionFilter, setRegionFilter] = useState("All regions");
  const [districtFilter, setDistrictFilter] = useState("All districts");
  const [referrerFilter, setReferrerFilter] = useState("All referrers");
  const [period, setPeriod] = useState<"all" | "month" | "year">("month");
  const [editingCustomer, setEditingCustomer] = useState<ErpState["customers"][number] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState("");
  useEffect(() => {
    if (!openActionId) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !actionsRef.current?.contains(event.target)) {
        setOpenActionId(null);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [openActionId]);
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const yearStart = `${now.getFullYear()}-01-01`;
  const selectedPeriodStart = period === "month" ? monthStart : period === "year" ? yearStart : "";
  const activeCustomers = state.customers.filter((customer) => customer.status === "Active" && !customer.archivedAt);
  const addedThisMonth = state.customers.filter((customer) => !customer.archivedAt && customer.createdAt?.slice(0, 7) === monthStart.slice(0, 7)).length;
  const debtors = state.customers.filter((customer) => !customer.archivedAt && customerCreditBalance(customer, state) > 0);
  const types = [...new Set(state.customers.map((customer) => customer.type).filter(Boolean))].sort();
  const regions = [...new Set(state.customers.map((customer) => customer.region).filter((value): value is string => Boolean(value)))].sort();
  const districts = [...new Set(state.customers.map((customer) => customer.district).filter((value): value is string => Boolean(value)))].sort();
  const referrers = [...new Set(state.customers.map((customer) => customer.referredBy).filter((value): value is string => Boolean(value)))].sort();
  const filteredCustomers = state.customers.filter((customer) => {
    const sales = customerSalesFor(customer, state);
    const orders = customerOrdersFor(customer, state);
    const searchable = [customer.name, customer.id, customer.contact, customer.phone, customer.email, customer.region, customer.district, customer.country, customer.tin, customer.referredBy, ...sales.map((sale) => sale.reference), ...orders.map((order) => order.reference)]
      .filter(Boolean).join(" ").toLowerCase();
    return (statusFilter === "Archived" ? Boolean(customer.archivedAt) : !customer.archivedAt)
      && searchable.includes(search.trim().toLowerCase())
      && (typeFilter === "All types" || customer.type === typeFilter)
      && (statusFilter === "All statuses" || statusFilter === "Archived" || customer.status === statusFilter)
      && (regionFilter === "All regions" || customer.region === regionFilter)
      && (districtFilter === "All districts" || customer.district === districtFilter)
      && (referrerFilter === "All referrers" || customer.referredBy === referrerFilter);
  });
  const saveCustomer = (form: FormData) => {
    const existing = editingCustomer;
    const customer: ErpState["customers"][number] = {
      id: existing?.id ?? createId("C"),
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
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      archivedAt: existing?.archivedAt,
      status: String(form.get("status") || "Active") as "Active" | "Inactive" | "Suspended",
      purchases: existing?.purchases ?? 0,
    };
    updateState({
      ...state,
      customers: existing
        ? state.customers.map((item) => item.id === existing.id ? customer : item)
        : [customer, ...state.customers],
    });
    setEditingCustomer(null);
    setShowForm(false);
    setToast(existing ? "Customer updated" : "Customer added");
    window.setTimeout(() => setToast(""), 2600);
  };
  const setCustomerStatus = (customer: ErpState["customers"][number], status: "Active" | "Suspended") => {
    updateState({
      ...state,
      customers: state.customers.map((item) => item.id === customer.id ? { ...item, status } : item),
    });
    setOpenActionId(null);
    setToast(status === "Suspended" ? "Customer suspended" : "Customer set to active");
    window.setTimeout(() => setToast(""), 2600);
  };
  const setCustomerArchived = (customer: ErpState["customers"][number], archived: boolean) => {
    updateState({
      ...state,
      customers: state.customers.map((item) => item.id === customer.id
        ? { ...item, archivedAt: archived ? new Date().toISOString() : undefined }
        : item),
    });
    setOpenActionId(null);
    setToast(archived ? "Customer archived" : "Customer restored");
    window.setTimeout(() => setToast(""), 2600);
  };
  const activateCustomer = (customer: ErpState["customers"][number]) => {
    updateState({
      ...state,
      customers: state.customers.map((item) => item.id === customer.id
        ? { ...item, status: "Active", archivedAt: undefined }
        : item),
    });
    setOpenActionId(null);
    setToast("Customer set to active");
    window.setTimeout(() => setToast(""), 2600);
  };
  const downloadCustomer = (customer: ErpState["customers"][number]) => {
    const sales = customerSalesFor(customer, state);
    exportCsv(`${customer.id.toLowerCase()}-${customer.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`, [{
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
    }]);
    setOpenActionId(null);
  };

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 text-xs font-medium text-slate-400">Workspace / Customer Management</div>
          <h2 className="text-2xl font-bold tracking-tight">Customer directory</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">One customer record, linked to every sale, order and repayment.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportCsv("customers.csv", filteredCustomers.map((customer) => {
            const sales = customerSalesFor(customer, state);
            const periodSales = sales.filter((sale) => !selectedPeriodStart || sale.date >= selectedPeriodStart);
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
              outstanding: sum(sales.map((sale) => balanceForSale(sale, state.payments))),
              status: customer.status,
            };
          }))} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
            <Download className="size-4" /> Export CSV
          </button>
          <button onClick={() => { setEditingCustomer(null); setShowForm(true); }} className="inline-flex items-center gap-2 rounded-lg bg-[#6d28d9] px-3 py-2 text-xs font-semibold text-white hover:bg-[#5b21b6]">
            <Plus className="size-4" /> Add customer
          </button>
        </div>
      </div>

      {toast && <div role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">{toast}</div>}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CustomerMetric label="Total customers" value={state.customers.length} detail="All customer records" icon="UsersRound" tone="purple" />
        <CustomerMetric label="Active customers" value={activeCustomers.length} detail={`${state.customers.length - activeCustomers.length} inactive accounts`} icon="UserRoundCheck" tone="green" />
        <CustomerMetric label="Added this month" value={addedThisMonth} detail="Based on recorded creation dates" icon="UserRoundPlus" tone="blue" />
        <CustomerMetric label="Outstanding credit" value={debtors.length} detail={`${money(sum(state.customers.map((customer) => customerCreditBalance(customer, state))))} balance`} icon="HandCoins" tone="amber" />
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-1 flex-wrap gap-2">
            <label className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 sm:max-w-sm sm:flex-1">
              <Search className="size-4 shrink-0 text-slate-400" />
              <input aria-label="Search customers" value={search} onChange={(event) => setSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-slate-400" placeholder="Name, ID, contact, location or transaction" />
            </label>
            <select aria-label="Filter by customer type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
              <option>All types</option>{types.map((type) => <option key={type}>{type}</option>)}
            </select>
            <select aria-label="Filter by account status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
              <option>All statuses</option><option>Active</option><option>Suspended</option><option>Inactive</option><option>Archived</option>
            </select>
            {regions.length > 0 && <select aria-label="Filter by region" value={regionFilter} onChange={(event) => setRegionFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
              <option>All regions</option>{regions.map((region) => <option key={region}>{region}</option>)}
            </select>}
            {districts.length > 0 && <select aria-label="Filter by district" value={districtFilter} onChange={(event) => setDistrictFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
              <option>All districts</option>{districts.map((district) => <option key={district}>{district}</option>)}
            </select>}
            {referrers.length > 0 && <select aria-label="Filter by referrer" value={referrerFilter} onChange={(event) => setReferrerFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
              <option>All referrers</option>{referrers.map((referrer) => <option key={referrer}>{referrer}</option>)}
            </select>}
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
            Revenue period
            <select aria-label="Revenue period" value={period} onChange={(event) => setPeriod(event.target.value as typeof period)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
              <option value="month">This month</option><option value="year">This year</option><option value="all">All time</option>
            </select>
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1150px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-400">
              <tr>{["Customer", "Type", "Contact", "Operating area", "Referred by", "Sales", "Revenue", "Credit balance", "Last sale", "Status", "Actions"].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer) => {
                const sales = customerSalesFor(customer, state);
                const lastSale = [...sales].sort((left, right) => right.date.localeCompare(left.date))[0];
                const periodSales = sales.filter((sale) => !selectedPeriodStart || sale.date >= selectedPeriodStart);
                const balance = customerCreditBalance(customer, state);
                const area = customer.type === "Big dealer"
                  ? [customer.region, customer.district].filter(Boolean).join(" · ")
                  : customer.type === "Export customer" ? customer.country : "—";
                return <tr key={customer.id} className="border-t border-slate-100 text-slate-600 hover:bg-slate-50/70">
                  <td className="px-4 py-3.5"><button onClick={() => onView(customer.id)} className="text-left font-semibold text-slate-800 hover:text-[#6d28d9] hover:underline">{customer.name}<span className="mt-1 block font-mono text-[10px] font-normal text-slate-400">{customer.id}</span></button></td>
                  <td className="px-4 py-3.5">{customer.type}</td>
                  <td className="px-4 py-3.5"><span className="font-medium text-slate-700">{customer.contact || "—"}</span><span className="mt-1 block">{customer.phone}</span><span className="mt-0.5 block text-[10px] text-slate-400">{customer.email || ""}</span></td>
                  <td className="px-4 py-3.5">{area || "—"}</td>
                  <td className="px-4 py-3.5">{customer.referredBy || "—"}</td>
                  <td className="px-4 py-3.5 font-semibold text-slate-700">{sales.length}</td>
                  <td className="px-4 py-3.5 font-semibold text-slate-700">{money(sum(periodSales.map((sale) => sale.total)))}</td>
                  <td className="px-4 py-3.5 font-semibold text-slate-700">{money(balance)}</td>
                  <td className="px-4 py-3.5">{lastSale ? formatDate(lastSale.date) : "—"}</td>
                  <td className="px-4 py-3.5"><div className="flex items-center gap-1">{customer.archivedAt && <span className="mr-1 rounded bg-slate-100 px-1.5 py-1 text-[9px] font-semibold uppercase text-slate-500">Archived</span>}<Status text={customer.status} /></div></td>
                  <td className="px-4 py-3.5"><div className="relative" ref={openActionId === customer.id ? actionsRef : null}>
                    <button type="button" aria-label={`Actions for ${customer.name}`} aria-expanded={openActionId === customer.id} aria-haspopup="menu" onClick={() => setOpenActionId((current) => current === customer.id ? null : customer.id)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"><Icons.MoreHorizontal className="size-4" /></button>
                    {openActionId === customer.id && <div role="menu" aria-label={`Actions for ${customer.name}`} className="absolute right-0 top-full z-30 mt-1 w-48 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
                      <button type="button" role="menuitem" onClick={() => { setOpenActionId(null); onView(customer.id); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"><Icons.UserRound className="size-3.5 text-slate-400" /> View profile</button>
                      <button type="button" role="menuitem" onClick={() => { setEditingCustomer(customer); setShowForm(true); setOpenActionId(null); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"><Icons.PencilLine className="size-3.5 text-slate-400" /> Edit customer</button>
                      {!customer.archivedAt && customer.status !== "Suspended" && <button type="button" role="menuitem" onClick={() => setCustomerStatus(customer, "Suspended")} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"><Icons.Pause className="size-3.5 text-slate-400" /> Suspend</button>}
                      {(customer.status !== "Active" || customer.archivedAt) && <button type="button" role="menuitem" onClick={() => activateCustomer(customer)} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"><Icons.CircleCheck className="size-3.5 text-slate-400" /> Set active</button>}
                      <button type="button" role="menuitem" onClick={() => downloadCustomer(customer)} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"><Icons.Download className="size-3.5 text-slate-400" /> Download</button>
                      <div className="my-1 border-t border-slate-100" />
                      <button type="button" role="menuitem" onClick={() => setCustomerArchived(customer, !customer.archivedAt)} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-rose-700 hover:bg-rose-50">{customer.archivedAt ? <><Icons.ArchiveRestore className="size-3.5" /> Restore from archive</> : <><Icons.Archive className="size-3.5" /> Archive customer</>}</button>
                    </div>}
                  </div></td>
                </tr>;
              })}
              {!filteredCustomers.length && <tr><td colSpan={11} className="px-4 py-12 text-center text-sm text-slate-400">No customers match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 px-4 py-3 text-[11px] text-slate-400">Showing {filteredCustomers.length} {statusFilter === "Archived" ? "archived" : "active directory"} records · Sales counts are calculated from linked transactions</div>
      </section>

      {showForm && <CustomerFormDialog customer={editingCustomer} onClose={() => { setShowForm(false); setEditingCustomer(null); }} onSave={saveCustomer} />}
    </div>
  );
}

function CustomerMetric({ label, value, detail, icon, tone }: { label: string; value: number | string; detail: string; icon: string; tone: string }) {
  const Icon = iconMap[icon] || Icons.UsersRound;
  const toneClass = tone === "green" ? "bg-emerald-50 text-emerald-700" : tone === "blue" ? "bg-sky-50 text-sky-700" : tone === "amber" ? "bg-amber-50 text-amber-700" : "bg-violet-50 text-violet-700";
  return <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><span className={`grid size-9 place-items-center rounded-lg ${toneClass}`}><Icon className="size-[17px]" /></span><span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Live</span></div><div className="mt-3 text-xl font-bold tracking-tight">{value}</div><div className="mt-0.5 text-xs font-semibold text-slate-700">{label}</div><div className="mt-1 text-[10px] text-slate-400">{detail}</div></div>;
}

function CustomerFormDialog({ customer, onClose, onSave }: {
  customer: ErpState["customers"][number] | null;
  onClose: () => void;
  onSave: (form: FormData) => void;
}) {
  const [type, setType] = useState(customer?.type ?? "Small dealer");
  const fieldClass = "mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#8b5cf6] focus:ring-2 focus:ring-purple-100";
  const labelClass = "block text-xs font-semibold text-slate-600";
  const isBigDealer = type === "Big dealer";
  const isExport = type === "Export customer";

  return <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="customer-form-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
        <div><h3 id="customer-form-title" className="text-base font-bold">{customer ? "Edit customer" : "Add customer"}</h3><p className="mt-1 text-xs text-slate-500">Customer records stay linked to their transaction history.</p></div>
        <button type="button" aria-label="Close customer form" onClick={onClose} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><X className="size-4" /></button>
      </div>
      <form onSubmit={(event) => { event.preventDefault(); onSave(new FormData(event.currentTarget)); }} className="p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={`${labelClass} sm:col-span-2`}>Customer or business name<input required name="name" defaultValue={customer?.name ?? ""} className={fieldClass} placeholder="Registered customer name" /></label>
          <label className={labelClass}>Customer type<select required name="type" value={type} onChange={(event) => setType(event.target.value)} className={fieldClass}>
            {customer && !["Big dealer", "Small dealer", "Export customer"].includes(customer.type) && <option value={customer.type}>{customer.type} (existing)</option>}
            <option>Big dealer</option><option>Small dealer</option><option>Export customer</option>
          </select></label>
          <label className={labelClass}>Primary contact person<input required={!customer || Boolean(customer.contact)} name="contact" defaultValue={customer?.contact ?? ""} className={fieldClass} placeholder="Full name" /></label>
          <label className={labelClass}>Contact number<input required name="phone" type="tel" defaultValue={customer?.phone ?? ""} className={fieldClass} placeholder="+256 700 000 000" /></label>
          <label className={labelClass}>Email address <span className="font-normal text-slate-400">Optional</span><input name="email" type="email" defaultValue={customer?.email ?? ""} className={fieldClass} placeholder="name@business.com" /></label>
          {isBigDealer && <>
            <label className={labelClass}>Region of operation<input required name="region" defaultValue={customer?.region ?? ""} className={fieldClass} placeholder="Region" /></label>
            <label className={labelClass}>District<input required name="district" defaultValue={customer?.district ?? ""} className={fieldClass} placeholder="District" /></label>
            <label className={labelClass}>TIN <span className="font-normal text-slate-400">Optional</span><input name="tin" defaultValue={customer?.tin ?? ""} className={fieldClass} placeholder="Tax identification number" /></label>
          </>}
          {isExport && <label className={labelClass}>Country of operation<input required name="country" defaultValue={customer?.country ?? ""} className={fieldClass} placeholder="Country" /></label>}
          <label className={labelClass}>Referred by<input required={!customer || Boolean(customer.referredBy)} name="referredBy" defaultValue={customer?.referredBy ?? ""} className={fieldClass} placeholder="Staff member or external referrer" /></label>
              <label className={labelClass}>Account status<select name="status" defaultValue={customer?.status ?? "Active"} className={fieldClass}><option>Active</option><option>Suspended</option><option>Inactive</option></select></label>
          <label className={`${labelClass} sm:col-span-2`}>Notes <span className="font-normal text-slate-400">Optional</span><textarea name="notes" rows={3} defaultValue={customer?.notes ?? ""} className={fieldClass} placeholder="Account preferences or relationship notes" /></label>
        </div>
        <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
          <button className="rounded-lg bg-[#6d28d9] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#5b21b6]">{customer ? "Save changes" : "Create customer"}</button>
        </div>
      </form>
    </section>
  </div>;
}

function CustomerDetails({ customer, state, onBack }: { customer: ErpState["customers"][number]; state: ErpState; onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<"overview" | "sales" | "orders" | "payments">("overview");
  const sales = customerSalesFor(customer, state).sort((left, right) => right.date.localeCompare(left.date));
  const orders = customerOrdersFor(customer, state).sort((left, right) => right.date.localeCompare(left.date));
  const saleIds = new Set(sales.map((sale) => sale.id));
  const payments = state.payments.filter((payment) => saleIds.has(payment.saleId)).sort((left, right) => right.date.localeCompare(left.date));
  const totalSales = sum(sales.map((sale) => sale.total));
  const outstanding = customerCreditBalance(customer, state);
  const area = customer.type === "Big dealer" ? [customer.region, customer.district].filter(Boolean).join(" · ") : customer.country ?? "—";
  const tabs = [
    ["overview", "Overview"],
    ["sales", "Sales history", sales.length],
    ["orders", "Order history", orders.length],
    ["payments", "Payment history", payments.length],
  ] as const;
  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const tabButtons = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role=tab]") ?? []);
    const currentIndex = tabButtons.indexOf(event.currentTarget);
    const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? tabButtons.length - 1 : (currentIndex + (event.key === "ArrowRight" ? 1 : tabButtons.length - 1)) % tabButtons.length;
    tabButtons[nextIndex]?.focus();
    tabButtons[nextIndex]?.click();
  };

  return <DetailView title="Customer details" subtitle="Customer profile and linked commercial history." name={customer.name} meta={`${customer.type} · ${customer.status}`} onBack={onBack}>
    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <CustomerMetric label="Number of sales" value={sales.length} detail="Derived from linked sales" icon="ReceiptText" tone="purple" />
      <CustomerMetric label="Total sales" value={money(totalSales)} detail="Lifetime sales value" icon="ChartNoAxesCombined" tone="blue" />
      <CustomerMetric label="Outstanding credit" value={money(outstanding)} detail="Current unpaid balance" icon="HandCoins" tone="amber" />
      <CustomerMetric label="Customer orders" value={orders.length} detail="Linked order records" icon="ClipboardList" tone="green" />
    </div>
    <div role="tablist" aria-label={`${customer.name} details`} className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map(([id, label, count]) => <button key={id} type="button" role="tab" id={`customer-tab-${id}`} aria-selected={activeTab === id} aria-controls={`customer-panel-${id}`} tabIndex={activeTab === id ? 0 : -1} onClick={() => setActiveTab(id)} onKeyDown={handleTabKeyDown} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-xs font-semibold transition ${activeTab === id ? "border-[#6d28d9] text-[#6d28d9]" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
        {label}{count !== undefined && <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${activeTab === id ? "bg-[#f1eafd] text-[#6d28d9]" : "bg-slate-100 text-slate-500"}`}>{count}</span>}
      </button>)}
    </div>

    <section id={`customer-panel-${activeTab}`} role="tabpanel" aria-labelledby={`customer-tab-${activeTab}`} tabIndex={0}>
      {activeTab === "overview" && <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-bold">Customer information</h3>
        <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          {[ ["Customer ID", customer.id], ["Primary contact", customer.contact || "—"], ["Phone", customer.phone], ["Email", customer.email || "—"], ["Operating area", area], ["TIN", customer.tin || "—"], ["Referred by", customer.referredBy || "—"], ["Account status", customer.status]].map(([label, value]) => <div key={label}><div className="text-[11px] text-slate-400">{label}</div><div className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</div></div>)}
        </div>
        {customer.notes && <div className="mt-5 border-t border-slate-100 pt-4"><div className="text-[11px] text-slate-400">Notes</div><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{customer.notes}</p></div>}
      </section>}

      {activeTab === "sales" && <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4"><h3 className="text-sm font-bold">Sales history</h3><p className="mt-1 text-xs text-slate-400">{sales.length} linked transactions · {money(totalSales)} lifetime value</p></div>
        {sales.length ? <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase text-slate-400"><tr>{["Reference", "Date", "Product", "Total", "Balance", "Status"].map((label) => <th key={label} className="px-5 py-3">{label}</th>)}</tr></thead><tbody>{sales.map((sale) => <tr key={sale.id} className="border-t border-slate-100 text-slate-600"><td className="px-5 py-3 font-semibold text-slate-800">{sale.reference}</td><td className="px-5 py-3">{formatDate(sale.date)}</td><td className="px-5 py-3">{sale.product}</td><td className="px-5 py-3 font-semibold">{money(sale.total)}</td><td className="px-5 py-3">{money(sale.paymentTerms === "Credit" ? balanceForSale(sale, state.payments) : 0)}</td><td className="px-5 py-3"><Status text={sale.paymentTerms === "Credit" ? paymentStateForSale(sale, state.payments) : sale.status} /></td></tr>)}</tbody></table></div> : <p className="px-5 py-8 text-center text-xs text-slate-400">No sales linked to this customer yet.</p>}
      </section>}

      {activeTab === "orders" && <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4"><h3 className="text-sm font-bold">Order history</h3><p className="mt-1 text-xs text-slate-400">Customer orders linked to this account</p></div>
        {orders.length ? <div className="divide-y divide-slate-100">{orders.map((order) => <div key={order.id} className="flex flex-col gap-2 px-5 py-3 text-xs sm:flex-row sm:items-center sm:justify-between"><div><span className="font-semibold text-slate-800">{order.reference}</span><span className="ml-2 text-slate-400">{formatDate(order.date)} · {order.items.length} items</span></div><div className="flex items-center gap-3"><span className="font-semibold text-slate-700">{money(order.total)}</span><Status text={order.status} /></div></div>)}</div> : <p className="px-5 py-8 text-center text-xs text-slate-400">No orders linked to this customer yet.</p>}
      </section>}

      {activeTab === "payments" && <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4"><h3 className="text-sm font-bold">Payment history</h3><p className="mt-1 text-xs text-slate-400">Repayments recorded against this customer&apos;s credit sales</p></div>
        {payments.length ? <div className="divide-y divide-slate-100">{payments.map((payment) => <div key={payment.id} className="flex flex-col gap-1 px-5 py-3 text-xs sm:flex-row sm:items-center sm:justify-between"><div><span className="font-semibold text-slate-800">{sales.find((sale) => sale.id === payment.saleId)?.reference}</span><span className="ml-2 text-slate-400">{formatDate(payment.date)} · {payment.method}</span>{payment.note && <span className="ml-2 text-slate-400">{payment.note}</span>}</div><span className="font-semibold text-emerald-700">{money(payment.amount)}</span></div>)}</div> : <p className="px-5 py-8 text-center text-xs text-slate-400">No payments recorded.</p>}
      </section>}
    </section>
  </DetailView>;
}
function DetailView({ title, subtitle, name, meta, onBack, children }: { title: string; subtitle: string; name: string; meta: string; onBack: () => void; children: React.ReactNode }) { return <div className="animate-in fade-in duration-300"><button onClick={onBack} className="mb-5 inline-flex items-center gap-2 text-xs font-semibold text-[#6d28d9] hover:underline"><ChevronLeft className="size-4" /> Back to list</button><div className="mb-6 flex items-start gap-4"><div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#f1eafd] text-lg font-bold text-[#6d28d9]">{initials(name)}</div><div><div className="text-xs font-medium text-slate-400">Workspace / {title}</div><h2 className="mt-1 text-2xl font-bold tracking-tight">{name}</h2><p className="mt-1 text-sm text-slate-500">{meta} · {subtitle}</p></div></div>{children}</div> }
function DetailGrid({ items }: { items: string[][] }) { return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="text-sm font-bold">Profile information</h3><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-4"><div className="text-[11px] font-medium text-slate-400">{label}</div><div className="mt-1 text-sm font-semibold text-slate-800">{value}</div></div>)}</div></section> }
function Related({ title, rows }: { title: string; rows: string[][] }) { return <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="text-sm font-bold">{title}</h3><div className="mt-4 divide-y divide-slate-100">{rows.map(([label, value]) => <div key={label} className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"><span className="text-slate-500">{label}</span><span className="font-semibold text-slate-800 sm:text-right">{value}</span></div>)}</div></section> }
function Header({ active, setMobileNav }: { active: string; setMobileNav: (value: boolean) => void }) { return <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur sm:px-6 lg:px-8"><div className="flex items-center gap-3"><button aria-label="Open navigation" onClick={() => setMobileNav(true)} className="rounded-lg p-2 hover:bg-slate-100 lg:hidden"><Menu className="size-5" /></button><div><div className="flex items-center gap-2 text-xs text-slate-400"><span>Workspace</span><span>/</span><span className="text-slate-600">{active}</span></div><h1 className="mt-0.5 text-lg font-bold tracking-tight sm:text-xl">{active}</h1></div></div><div className="flex items-center gap-2 sm:gap-4"><div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 md:flex"><Search className="size-4 text-slate-400" /><input className="w-36 bg-transparent text-xs outline-none placeholder:text-slate-400" placeholder="Search anything..." /></div><button aria-label="Notifications" className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Bell className="size-[19px]" /><span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-[#8b5cf6]" /></button><div className="hidden h-7 w-px bg-slate-200 sm:block" /><div className="flex items-center gap-2"><div className="grid size-8 place-items-center rounded-full bg-[#e9ddff] text-[10px] font-bold text-[#6d28d9]">SN</div><div className="hidden text-left sm:block"><div className="text-xs font-semibold">Sarah Namirembe</div><div className="text-[10px] text-slate-400">Administrator</div></div><ChevronDown className="hidden size-3.5 text-slate-400 sm:block" /></div></div></header> }

function Dashboard({ state, setActive }: { state: ErpState; setActive: (value: string) => void }) {
 const today = sum(state.sales.filter(s => s.date === new Date().toISOString().slice(0, 10)).map(s => s.total)); const week = sum(state.sales.filter(s => isWithinDays(s.date, 7)).map(s => s.total)); const month = sum(state.sales.filter(s => isWithinDays(s.date, 31)).map(s => s.total)); const expenses = sum(state.expenses.filter(e => isWithinDays(e.date, 31)).map(e => e.amount)); const stock = sum(state.materials.map(m => m.quantity * m.cost));
 return <div className="animate-in fade-in duration-300"><div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#f1eafd] px-3 py-1 text-[11px] font-semibold text-[#6d28d9]"><Sparkles className="size-3.5" /> Good morning, Sarah</div><h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Here&apos;s your business overview.</h2><p className="mt-1 text-sm text-slate-500">Monitor your key operations and make informed decisions.</p></div><div className="flex items-center gap-2"><button onClick={() => exportCsv('lumina-sales.csv', state.sales as unknown as Record<string, unknown>[])} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50"><Download className="size-4" /> Export</button><button onClick={() => setActive('Sales')} className="inline-flex items-center gap-2 rounded-lg bg-[#6d28d9] px-3 py-2 text-xs font-semibold text-white shadow-sm shadow-purple-200 hover:bg-[#5b21b6]"><Plus className="size-4" /> New sale</button></div></div>
 <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Kpi label="Today's sales" value={money(today)} change="+12.8%" icon="TrendingUp" tone="purple" onClick={() => setActive('Sales')} /><Kpi label="Monthly sales" value={money(month)} change="+8.4%" icon="BarChart3" tone="blue" onClick={() => setActive('Sales')} /><Kpi label="Monthly expenses" value={money(expenses)} change="-4.2%" icon="ArrowDownRight" tone="amber" onClick={() => setActive('Expenses')} /><Kpi label="Team members" value={String(state.employees.length)} change="2 pending leave" icon="UsersRound" tone="green" onClick={() => setActive('Employee Profiles')} /></div>
 <div className="mt-4 grid gap-4 xl:grid-cols-[1.65fr_1fr]"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="mb-5 flex items-start justify-between"><div><h3 className="text-sm font-bold">Sales performance</h3><p className="mt-1 text-xs text-slate-400">Revenue and expenses for the last 7 days</p></div><select className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 outline-none"><option>This week</option><option>This month</option></select></div><div className="h-[260px] w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.23} /><stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#eef0f4" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} dy={10} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => `${v}m`} /><Tooltip contentStyle={{ border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 12 }} formatter={(value: any) => [`${value ?? 0}m UGX`, 'Sales']} /><Area type="monotone" dataKey="sales" stroke="#6d28d9" strokeWidth={2.5} fill="url(#salesFill)" /></AreaChart></ResponsiveContainer></div><div className="mt-4 flex items-center gap-5 text-[11px] text-slate-500"><span className="flex items-center gap-2"><span className="size-2 rounded-full bg-[#6d28d9]" />Sales</span><span className="flex items-center gap-2"><span className="size-2 rounded-full bg-slate-300" />Expenses</span><span className="ml-auto font-semibold text-emerald-600">{money(week)} this week</span></div></section>
 <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="mb-2"><h3 className="text-sm font-bold">Sales by product</h3><p className="mt-1 text-xs text-slate-400">Share of current month revenue</p></div><div className="relative h-[220px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={productMix} innerRadius={64} outerRadius={88} paddingAngle={3} dataKey="value" stroke="none">{productMix.map((_, index) => <Cell key={index} fill={['#6d28d9', '#8b5cf6', '#c4b5fd', '#ede9fe'][index]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><div className="absolute inset-0 grid place-items-center pointer-events-none"><div className="text-center"><div className="text-xl font-bold">100%</div><div className="text-[10px] text-slate-400">mix</div></div></div></div><div className="grid grid-cols-2 gap-3">{productMix.map((p, i) => <div key={p.name} className="flex items-center gap-2 text-[11px] text-slate-500"><span className="size-2 rounded-full" style={{ background: ['#6d28d9', '#8b5cf6', '#c4b5fd', '#ede9fe'][i] }} />{p.name}<span className="ml-auto font-semibold text-slate-700">{p.value}%</span></div>)}</div></section></div>
 <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_1fr_1fr]"><RecentSales state={state} setActive={setActive} /><LowStock state={state} setActive={setActive} /><Activity state={state} /></div><div className="mt-4 grid gap-4 sm:grid-cols-3"><MiniMetric label="Raw material stock value" value={money(stock)} meta="4 tracked materials" icon="Boxes" /><MiniMetric label="Production today" value="1,240 kg" meta="92% of daily target" icon="Factory" /><MiniMetric label="Outstanding invoices" value={money(4360000)} meta="6 invoices awaiting payment" icon="FileClock" /></div></div>
}
function Kpi({ label, value, change, icon, tone, onClick }: { label: string; value: string; change: string; icon: string; tone: string; onClick: () => void }) { const Icon = iconMap[icon] || TrendingUp; return <button onClick={onClick} className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-purple-200 hover:shadow-md"><div className="flex items-center justify-between"><span className={`grid size-9 place-items-center rounded-xl ${tone === 'purple' ? 'bg-[#f1eafd] text-[#6d28d9]' : tone === 'blue' ? 'bg-blue-50 text-blue-600' : tone === 'amber' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}><Icon className="size-[18px]" /></span><ChevronRight className="size-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-purple-400" /></div><div className="mt-4 text-xl font-bold tracking-tight">{value}</div><div className="mt-1 text-xs text-slate-500">{label}</div><div className={`mt-3 text-[11px] font-semibold ${change.startsWith('-') ? 'text-emerald-600' : 'text-emerald-600'}`}>{change}</div></button> }
function MiniMetric({ label, value, meta, icon }: { label: string; value: string; meta: string; icon: string }) { const Icon = iconMap[icon] || Boxes; return <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-500"><Icon className="size-[19px]" /></div><div><div className="text-[11px] text-slate-400">{label}</div><div className="mt-1 text-lg font-bold">{value}</div><div className="mt-0.5 text-[10px] text-slate-400">{meta}</div></div></div> }
function RecentSales({ state, setActive }: { state: ErpState; setActive: (value: string) => void }) { return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><SectionHead title="Recent transactions" link="View sales" onClick={() => setActive('Sales')} /> <div className="mt-4 flex flex-col gap-4">{state.sales.slice(0, 4).map(s => <div key={s.id} className="flex items-center gap-3"><div className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#f1eafd] text-[10px] font-bold text-[#6d28d9]">{initials(s.customer)}</div><div className="min-w-0 flex-1"><div className="truncate text-xs font-semibold">{s.customer}</div><div className="text-[10px] text-slate-400">{s.reference} · {formatDate(s.date)}</div></div><div className="text-right"><div className="text-xs font-bold">{money(s.total)}</div><Status text={s.status} /></div></div>)}</div></section> }
function LowStock({ state, setActive }: { state: ErpState; setActive: (value: string) => void }) { const low = state.materials.filter(m => m.quantity <= m.threshold); return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><SectionHead title="Low stock alerts" link="Inventory" onClick={() => setActive('Raw Material Management')} /><div className="mt-4 flex flex-col gap-4">{low.map(m => <div key={m.id} className="flex items-center gap-3"><div className="grid size-8 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-600"><Icons.AlertTriangle className="size-4" /></div><div className="min-w-0 flex-1"><div className="truncate text-xs font-semibold">{m.name}</div><div className="text-[10px] text-slate-400">Reorder at {m.threshold} {m.unit}</div></div><div className="text-right"><div className="text-xs font-bold">{m.quantity} {m.unit}</div><div className="text-[10px] font-medium text-amber-600">Reorder soon</div></div></div>)}{!low.length && <div className="py-5 text-center text-xs text-slate-400">All materials are well stocked.</div>}</div></section> }
function Activity({ state }: { state: ErpState }) { return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><SectionHead title="System activity" link="Auditing" /><div className="mt-4 flex flex-col gap-4">{state.activities.map(a => <div key={a.id} className="flex gap-3"><div className={`mt-1 size-2 shrink-0 rounded-full ${a.outcome === 'Success' ? 'bg-emerald-500' : 'bg-amber-500'}`} /><div className="min-w-0"><div className="text-xs font-medium text-slate-700">{a.action}</div><div className="mt-0.5 text-[10px] text-slate-400">{a.actor} · {a.time}</div></div></div>)}</div></section> }
function SectionHead({ title, link, onClick }: { title: string; link: string; onClick?: () => void }) { return <div className="flex items-center justify-between"><h3 className="text-sm font-bold">{title}</h3><button onClick={onClick} className="text-[11px] font-semibold text-[#6d28d9] hover:underline">{link}</button></div> }
function Status({ text }: { text: string }) { const color = ['Paid', 'Approved', 'Active', 'Success'].includes(text) ? 'bg-emerald-50 text-emerald-700' : ['Pending', 'Review', 'Draft', 'Suspended'].includes(text) ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'; return <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[9px] font-semibold ${color}`}>{text}</span> }

function CreditSalesPage({
  state,
  updateState,
}: {
  state: ErpState;
  updateState: (next: ErpState) => void;
}) {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"outstanding" | "overdue" | "due-soon" | "paid">("outstanding");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [paymentSaleId, setPaymentSaleId] = useState<string | null>(null);
  const [actionSaleId, setActionSaleId] = useState<string | null>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!actionSaleId) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !actionsRef.current?.contains(event.target)) {
        setActionSaleId(null);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [actionSaleId]);
  const today = new Date().toISOString().slice(0, 10);
  const dueSoonLimit = new Date(`${today}T00:00:00.000Z`);
  dueSoonLimit.setUTCDate(dueSoonLimit.getUTCDate() + 7);
  const dueSoonDate = dueSoonLimit.toISOString().slice(0, 10);
  const creditSales = state.sales.filter((sale) => sale.paymentTerms === "Credit");
  const outstandingSales = creditSales.filter((sale) => balanceForSale(sale, state.payments) > 0);
  const overdueSales = outstandingSales.filter((sale) => Boolean(sale.dueDate && sale.dueDate < today));
  const dueSoonSales = outstandingSales.filter((sale) => Boolean(sale.dueDate && sale.dueDate >= today && sale.dueDate <= dueSoonDate));
  const settledSales = creditSales.filter((sale) => balanceForSale(sale, state.payments) === 0);
  const activeSales = view === "outstanding" ? outstandingSales : view === "overdue" ? overdueSales : view === "due-soon" ? dueSoonSales : settledSales;
  const visibleSales = activeSales
    .filter((sale) => {
      const customer = state.customers.find((item) => item.id === sale.customerId);
      const matchesSearch = `${sale.reference} ${sale.customer} ${customer?.phone ?? ""}`.toLowerCase().includes(search.toLowerCase());
      const paymentState = paymentStateForSale(sale, state.payments, today);
      const matchesStatus = statusFilter === "All statuses" || paymentState === statusFilter || (statusFilter === "Needs review" && sale.creditNeedsReview);
      return matchesSearch && matchesStatus;
    })
    .sort((left, right) => (left.dueDate || "9999-12-31").localeCompare(right.dueDate || "9999-12-31") || left.date.localeCompare(right.date));
  const openBalance = (sales: ErpState["sales"]) => sum(sales.map((sale) => balanceForSale(sale, state.payments)));
  const customersWithBalances = new Set(outstandingSales.map((sale) => sale.customerId || sale.customer.trim().toLowerCase())).size;
  const selectedSale = creditSales.find((sale) => sale.id === selectedSaleId) ?? null;
  const paymentSale = creditSales.find((sale) => sale.id === paymentSaleId) ?? null;

  const recordPayment = (payment: Omit<SalePayment, "id" | "recordedAt">) => {
    if (!paymentSale) return;
    const balance = balanceForSale(paymentSale, state.payments);
    if (!Number.isFinite(payment.amount) || payment.amount <= 0 || payment.amount > balance) return;
    updateState({
      ...state,
      payments: [...state.payments, { ...payment, id: createId("PAY"), recordedAt: new Date().toISOString() }],
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
          <div className="mb-2 text-xs font-medium text-slate-400">Workspace / Sales Department</div>
          <h2 className="text-2xl font-bold tracking-tight">Credit Sales</h2>
          <p className="mt-1 text-sm text-slate-500">Monitor receivables and record customer repayments.</p>
        </div>
        <button
          type="button"
          onClick={() => exportCsv("credit-sales.csv", visibleSales.map((sale) => ({
            reference: sale.reference,
            customer: sale.customer,
            saleDate: sale.date,
            dueDate: sale.dueDate ?? "Needs review",
            total: sale.total,
            paid: paidAmountForSale(sale.id, state.payments),
            balance: balanceForSale(sale, state.payments),
            status: paymentStateForSale(sale, state.payments, today),
          })))}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
        >
          <Download className="size-4" /> Export CSV
        </button>
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Total outstanding" value={money(openBalance(outstandingSales))} change={`${outstandingSales.length} open credit sales`} icon="WalletCards" tone="purple" onClick={() => setView("outstanding")} />
        <Kpi label="Overdue amount" value={money(openBalance(overdueSales))} change={`${overdueSales.length} overdue sales`} icon="CalendarAlert" tone="amber" onClick={() => setView("overdue")} />
        <Kpi label="Due in the next 7 days" value={money(openBalance(dueSoonSales))} change={`${dueSoonSales.length} sales due soon`} icon="CalendarClock" tone="blue" onClick={() => setView("due-soon")} />
        <Kpi label="Customers with balances" value={String(customersWithBalances)} change={`${settledSales.length} settled credit sales`} icon="UsersRound" tone="green" onClick={() => setView("outstanding")} />
      </div>

      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        {views.map(([key, label, count]) => (
          <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)} className={`border-b-2 px-3 py-2.5 text-xs font-semibold ${view === key ? "border-[#6d28d9] text-[#6d28d9]" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            {label}<span className="ml-2 text-[10px] text-slate-400">{count}</span>
          </button>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <Search className="size-4 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full bg-transparent text-xs outline-none placeholder:text-slate-400 sm:w-64" placeholder="Search customer or reference" />
          </div>
          <select aria-label="Filter credit sales by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
            <option>All statuses</option><option>Unpaid</option><option>Partially paid</option><option>Paid</option><option>Unpaid · Overdue</option><option>Partially paid · Overdue</option><option>Needs review</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left">
            <thead><tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-400"><th className="px-4 py-3">Sale</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Sale date</th><th className="px-4 py-3">Due date</th><th className="px-4 py-3 text-right">Original</th><th className="px-4 py-3 text-right">Paid</th><th className="px-4 py-3 text-right">Balance</th><th className="px-4 py-3">Payment state</th><th className="px-4 py-3">Action</th></tr></thead>
            <tbody>
              {visibleSales.map((sale) => {
                const paid = paidAmountForSale(sale.id, state.payments);
                const balance = balanceForSale(sale, state.payments);
                const paymentState = sale.creditNeedsReview ? "Needs review" : paymentStateForSale(sale, state.payments, today);
                return <tr key={sale.id} className="border-b border-slate-50 text-xs text-slate-600 last:border-0 hover:bg-slate-50/50">
                  <td className="px-4 py-3"><button type="button" onClick={() => setSelectedSaleId(sale.id)} className="font-semibold text-slate-800 hover:text-[#6d28d9] hover:underline">{sale.reference}</button></td>
                  <td className="px-4 py-3"><div className="font-semibold text-slate-800">{sale.customer}</div>{sale.creditNeedsReview && <div className="mt-1 text-[10px] font-medium text-amber-700">Customer/due date needs review</div>}</td>
                  <td className="px-4 py-3">{formatDate(sale.date)}</td>
                  <td className={`px-4 py-3 ${sale.dueDate && sale.dueDate < today && balance > 0 ? "font-semibold text-red-600" : ""}`}>{sale.dueDate ? formatDate(sale.dueDate) : "Needs review"}</td>
                  <td className="px-4 py-3 text-right">{money(sale.total)}</td><td className="px-4 py-3 text-right">{money(paid)}</td><td className="px-4 py-3 text-right font-bold text-slate-800">{money(balance)}</td>
                  <td className="px-4 py-3"><Status text={paymentState} /></td>
                  <td className="px-4 py-3">
                    <div className="relative" ref={actionSaleId === sale.id ? actionsRef : undefined}>
                      <button
                        type="button"
                        aria-label={`Actions for ${sale.reference}`}
                        aria-expanded={actionSaleId === sale.id}
                        onClick={() => setActionSaleId((current) => current === sale.id ? null : sale.id)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-[#6d28d9]"
                      >
                        <Icons.MoreHorizontal className="size-4" />
                      </button>
                      {actionSaleId === sale.id && (
                        <div role="dialog" aria-label={`Actions for ${sale.reference}`} className="absolute right-0 top-full z-30 mt-1 w-44 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
                          <button type="button" onClick={() => { setActionSaleId(null); setSelectedSaleId(sale.id); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-50">
                            <Icons.Eye className="size-3.5 text-slate-400" /> View details
                          </button>
                          <button type="button" disabled={balance <= 0} onClick={() => { setActionSaleId(null); setPaymentSaleId(sale.id); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
                            <Icons.CircleDollarSign className="size-3.5 text-slate-400" /> Record payment
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
          {!visibleSales.length && <div className="py-14 text-center text-xs text-slate-400">No credit sales match this view.</div>}
        </div>
        <div className="border-t border-slate-100 px-4 py-3 text-[11px] text-slate-400">Showing {visibleSales.length} of {activeSales.length} credit sales · balances are calculated from recorded payments</div>
      </section>
      {paymentSale && <RecordCreditPaymentDialog sale={paymentSale} balance={balanceForSale(paymentSale, state.payments)} onClose={() => setPaymentSaleId(null)} onSave={recordPayment} />}
      {selectedSale && <CreditSaleDetailsDialog sale={selectedSale} payments={state.payments.filter((payment) => payment.saleId === selectedSale.id)} onClose={() => setSelectedSaleId(null)} />}
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
      setError(`Enter an amount greater than zero and no more than ${money(balance)}.`);
      return;
    }
    if (method !== "Cash" && !txnID) {
      setError("Enter the transaction ID for this payment method.");
      return;
    }
    onSave({ saleId: sale.id, amount, date: String(form.get("date")), method, txnID: txnID || undefined, note: String(form.get("note") || "").trim() || undefined });
  };
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="credit-payment-title" className="w-full max-w-md rounded-xl bg-white shadow-2xl">
      <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4"><div><h2 id="credit-payment-title" className="text-base font-bold">Record payment</h2><p className="mt-1 text-xs text-slate-500">{sale.reference} · Balance {money(balance)}</p></div><button type="button" aria-label="Close payment form" onClick={onClose} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><X className="size-4" /></button></div>
      <form onSubmit={submit} className="space-y-4 p-5">
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-600">Amount (UGX)<input required autoFocus name="amount" type="number" min="1" max={balance} step="1" className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal" /></label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-600">Received date<input required name="date" type="date" max={new Date().toISOString().slice(0, 10)} defaultValue={new Date().toISOString().slice(0, 10)} className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal" /></label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-600">Payment method<select value={method} onChange={(event) => setMethod(event.target.value as SalePayment["method"])} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal"><option>Cash</option><option>Mobile Money</option><option>Bank Transfer</option><option>Check</option></select></label>
        {method !== "Cash" && <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-600">Transaction ID<input required name="txnID" className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal" /></label>}
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-600">Note (optional)<textarea name="note" rows={2} className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal" /></label>
        {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Cancel</button><button type="submit" className="rounded-lg bg-[#6d28d9] px-3 py-2 text-xs font-semibold text-white">Save payment</button></div>
      </form>
    </section>
  </div>;
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
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="credit-sale-details-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl">
      <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4"><div><h2 id="credit-sale-details-title" className="text-base font-bold">Credit sale details</h2><p className="mt-1 text-xs text-slate-500">{sale.reference} · {sale.customer}</p></div><button type="button" aria-label="Close credit sale details" onClick={onClose} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><X className="size-4" /></button></div>
      <div className="grid gap-4 p-5 sm:grid-cols-2"><div><div className="text-[11px] text-slate-400">Sale date</div><div className="mt-1 text-sm font-semibold">{formatDate(sale.date)}</div></div><div><div className="text-[11px] text-slate-400">Due date</div><div className="mt-1 text-sm font-semibold">{sale.dueDate ? formatDate(sale.dueDate) : "Needs review"}</div></div><div><div className="text-[11px] text-slate-400">Original amount</div><div className="mt-1 text-sm font-semibold">{money(sale.total)}</div></div><div><div className="text-[11px] text-slate-400">Payment state</div><Status text={paymentStateForSale(sale, payments)} /></div><div><div className="text-[11px] text-slate-400">Paid</div><div className="mt-1 text-sm font-semibold">{money(paid)}</div></div><div><div className="text-[11px] text-slate-400">Outstanding</div><div className="mt-1 text-sm font-bold">{money(balance)}</div></div>
        <div className="sm:col-span-2"><h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Payment history</h3>{payments.length ? <div className="divide-y divide-slate-100 border-y border-slate-100">{[...payments].sort((a,b) => b.date.localeCompare(a.date) || b.recordedAt.localeCompare(a.recordedAt)).map((payment) => <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs"><div><div className="font-semibold text-slate-800">{payment.method}{payment.txnID ? ` · ${payment.txnID}` : ""}</div><div className="mt-1 text-slate-400">{formatDate(payment.date)}{payment.note ? ` · ${payment.note}` : ""}</div></div><strong>{money(payment.amount)}</strong></div>)}</div> : <p className="rounded-lg bg-slate-50 p-4 text-xs text-slate-500">No payments recorded yet.</p>}</div>
      </div>
      <div className="flex justify-end border-t border-slate-100 px-5 py-4"><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Close</button></div>
    </section>
  </div>;
}

function ModulePage({
  active,
  state,
  updateState,
  onView,
}: {
  active: string;
  state: ErpState;
  updateState: (next: ErpState) => void;
  onView: (id: string) => void;
}) {
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
    return () => document.removeEventListener("pointerdown", handleOutsideClick);
  }, [showSalesDatePicker]);
  const [salesPeriod, setSalesPeriod] = useState<
    "all" | "today" | "week" | "month" | "year"
  >( "all");
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
    return () => document.removeEventListener("pointerdown", handleOutsideClick);
  }, [showSalesFilters]);
  const [orderStatusFilter, setOrderStatusFilter] = useState<"" | "Pending" | "Confirmed" | "In progress" | "Ready" | "Completed" | "Cancelled">("");
  const [orderPeriod, setOrderPeriod] = useState<"all" | "today" | "week" | "month" | "year">("all");
  const [orderView, setOrderView] = useState<"open" | "completed" | "cancelled" | "archived">("open");
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
    return () => document.removeEventListener("pointerdown", handleOutsideClick);
  }, [showOrderFilters]);
  if (active === "Expenses") return <ExpenseManagement state={state} updateState={updateState} />;
  if (active === "Raw Material Management") return <RawMaterialManagement state={state} updateState={updateState} />;
  if (active === "Production Management") return <ProductionManagement state={state} updateState={updateState} />;
  if (active === "Assets Management") return <AssetManagement state={state} updateState={updateState} />;
  if (active === "Data Backup") return <DataBackup />;
  if (active === "Company Profile Management") return <CompanyProfileManagement profile={state.companyProfile} onSave={(companyProfile) => updateState({ ...state, companyProfile })} />;
  if (active === "User Management") return <UserManagement />;
  if (active === "Security Settings") return <SecuritySettings />;
  if (active === "Approvals") return <Approvals state={state} updateState={updateState} />;
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
        ? !order.archivedAt && !["Completed", "Cancelled"].includes(order.status)
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
  const displayedData = active === "Orders"
    ? [...filtered].sort((left, right) => {
        const leftOrder = left as ErpState["orders"][number];
        const rightOrder = right as ErpState["orders"][number];
        const leftOverride = leftOrder.priority === "High" && Boolean(leftOrder.priorityReason);
        const rightOverride = rightOrder.priority === "High" && Boolean(rightOrder.priorityReason);
        if (orderView === "open" && leftOverride !== rightOverride) return leftOverride ? -1 : 1;
        return leftOrder.createdAt.localeCompare(rightOrder.createdAt);
      })
    : filtered;
  const isDashboardLike = ["Analysis", "Reporting"].includes(active);
  const updateOrder = (
    orderId: string,
    updates: Partial<ErpState["orders"][number]>,
  ) => {
    updateState({
      ...state,
      orders: state.orders.map((order) => {
        if (order.id !== orderId) return order;
        const statusHistory = updates.status && updates.status !== order.status
          ? [...order.statusHistory, { status: updates.status, at: new Date().toISOString() }]
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
      const customerId = selectedCustomerId === "__walkin__" ? "" : selectedCustomerId;
      const customerName = customerId
        ? state.customers.find((customer) => customer.id === customerId)?.name || ""
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
          status: String(paymentTerms === "Credit" ? "Pending" : form.get("status") || "Paid") as "Paid" | "Pending",
          method: String(paymentTerms === "Credit" ? "Credit terms" : form.get("method") || "Cash"),
          txnID: String(form.get("txnID") || "") || undefined,
          paymentTerms: paymentTerms as
            "Same-day" | "Credit",
          dueDate: String(paymentTerms === "Credit" ? form.get("dueDate") || "" : "") || undefined,
        };
      next.sales = [sale, ...state.sales];
      const saleCustomer = state.customers.find((customer) => customer.id === sale.customerId);
      next.invoices = [createInvoiceDraft(sale, saleCustomer, state.companyProfile), ...state.invoices];
    }
    if (active === "Orders") {
      const submittedItems = JSON.parse(String(form.get("items") || "[]")) as ErpState["orders"][number]["items"];
      const newCustomer = form.get("customer") === "__new__";
      const customerId = newCustomer ? createId("C") : String(form.get("customer") || "");
      const selectedCustomer = state.customers.find((customer) => customer.id === customerId);
      const customerName = newCustomer ? String(form.get("newCustomerName") || "").trim() : selectedCustomer?.name || "";
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
            district: String(form.get("newCustomerDistrict") || "") || undefined,
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
          items: submittedItems.map((item) => ({ ...item, id: createId("ITEM") })),
          total: submittedItems.reduce((total, item) => total + item.lineTotal, 0),
          requestedDate: String(form.get("requestedDate")),
          fulfilmentMethod: String(form.get("fulfilmentMethod")) as "Delivery" | "Pickup",
          destination: String(form.get("destination") || ""),
          paymentTerms: String(form.get("paymentTerms")) as "Paid now" | "Same-day" | "Credit",
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
    return <LeaveManagement state={state} updateState={updateState} onViewEmployee={(id) => window.dispatchEvent(new CustomEvent("erp:view", { detail: { type: "employee", id } }))} />;
  }
  if (active === "Disciplinary Letters") {
    return <DisciplinaryLettersPage state={state} />;
  }
  if (active === "Customer Management") {
    return <CustomerManagementPage state={state} updateState={updateState} onView={onView} />;
  }
  if (active === "Invoicing") {
    return <InvoiceManagement state={state} updateState={updateState} />;
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
              {([
                ["open", "Open queue"],
                ["completed", "Completed"],
                ["cancelled", "Cancelled"],
                ["archived", "Archived"],
              ] as const).map(([view, label]) => (
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
                      {salesFromDate ? `Sales from ${salesFromDate}` : "Sales from"}
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
                    onChange={(event) => setOrderStatusFilter(event.target.value as typeof orderStatusFilter)}
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
                        {([
                          ["today", "Today"],
                          ["week", "This week"],
                          ["month", "This month"],
                          ["year", "This year"],
                        ] as const).map(([period, label]) => (
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
                        {([
                          ["today", "Today"],
                          ["week", "This week"],
                          ["month", "This month"],
                          ["year", "This year"],
                          ["all", "All dates"],
                        ] as const).map(([period, label]) => (
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
                      invoice={active === "Sales" ? state.invoices.find((invoice) => invoice.saleId === item.id) : undefined}
                      companyName={state.companyProfile.tradingName || state.companyProfile.legalName || "Lumina ERP"}
                      queuePosition={index + 1}
                      onOrderStatusChange={(orderId, status) => updateOrder(orderId, { status, completedAt: status === "Completed" ? new Date().toISOString() : undefined })}
                      onArchiveOrder={(orderId, archived) => updateOrder(orderId, { archivedAt: archived ? new Date().toISOString() : undefined })}
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
    (order) => !order.archivedAt && !["Completed", "Cancelled"].includes(order.status),
  );
  const completedThisWeek = orders.filter(
    (order) =>
      order.status === "Completed" &&
      (order.completedAt ?? "").slice(0, 10) >= weekStart &&
      (order.completedAt ?? "").slice(0, 10) <= today,
  );
  const dueToday = openOrders.filter((order) => order.requestedDate === today);
  const overdue = openOrders.filter((order) => order.requestedDate < today);
  const openCustomerCount = new Set(openOrders.map((order) => order.customer.trim().toLowerCase())).size;

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
  queuePosition,
  onOrderStatusChange,
  onArchiveOrder,
}: {
  item: any;
  active: string;
  invoice?: Invoice;
  companyName: string;
  queuePosition?: number;
  onOrderStatusChange?: (orderId: string, status: ErpState["orders"][number]["status"]) => void;
  onArchiveOrder?: (orderId: string, archived: boolean) => void;
}) {
  const [showSalesActions, setShowSalesActions] = useState(false);
  const [showSalesDetails, setShowSalesDetails] = useState(false);
  const [showOrderActions, setShowOrderActions] = useState(false);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const salesActionsRef = useRef<HTMLDivElement>(null);
  const orderActionsRef = useRef<HTMLDivElement>(null);
  const orderStatusTransitions: Partial<Record<ErpState["orders"][number]["status"], ErpState["orders"][number]["status"]>> = {
    Pending: "Confirmed",
    Confirmed: "In progress",
    "In progress": "Ready",
    Ready: "Completed",
  };
  const nextOrderStatus = orderStatusTransitions[item.status as ErpState["orders"][number]["status"]];
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
    return () => document.removeEventListener("pointerdown", handleOutsideClick);
  }, [showSalesActions]);
  useEffect(() => {
    if (!showOrderActions) return;
    const handleOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !orderActionsRef.current?.contains(event.target)) {
        setShowOrderActions(false);
      }
    };
    document.addEventListener("pointerdown", handleOutsideClick);
    return () => document.removeEventListener("pointerdown", handleOutsideClick);
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
      <div><div className="font-semibold text-slate-700">#{queuePosition} · {item.reference}</div><div className="mt-1 text-[10px] text-slate-400">Received {item.createdAt.slice(11, 16)}</div></div>,
      item.customer,
      <div className="max-w-[260px]">
        {item.items.map((orderItem: ErpState["orders"][number]["items"][number]) => (
          <div key={orderItem.id} className="truncate">{orderItem.product} <span className="text-slate-400">× {orderItem.quantity}</span></div>
        ))}
      </div>,
      <div><div>{formatDate(item.date)}</div><div className={`mt-1 text-[10px] font-semibold ${item.requestedDate < new Date().toISOString().slice(0, 10) && !["Completed", "Cancelled"].includes(item.status) ? "text-red-600" : item.requestedDate === new Date().toISOString().slice(0, 10) ? "text-amber-600" : "text-slate-400"}`}>{item.requestedDate < new Date().toISOString().slice(0, 10) && !["Completed", "Cancelled"].includes(item.status) ? "Overdue · " : "Due "}{formatDate(item.requestedDate)}</div></div>,
      money(item.total),
      <span>
        <Status text={item.priority} />
        {item.priorityReason && <span className="block max-w-28 truncate text-[9px] text-amber-700" title={item.priorityReason}>Override recorded</span>}
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
                  <Icons.Printer className="size-3.5 text-slate-400" /> Print receipt
                </button>
                <button type="button" className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-50">
                  <Icons.Download className="size-3.5 text-slate-400" /> Download
                </button>
                <button type="button" className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-50">
                  <Icons.Archive className="size-3.5 text-slate-400" /> Archive
                </button>
                {item.status === "Pending" && (
                  <button type="button" className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-50">
                    <Icons.CircleCheck className="size-3.5 text-slate-400" /> Set paid
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
              <div role="menu" className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
                <button type="button" role="menuitem" onClick={() => { setShowOrderDetails(true); setShowOrderActions(false); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-50">
                  <Icons.Eye className="size-3.5 text-slate-400" /> View order details
                </button>
                {nextOrderStatus && (
                  <button type="button" role="menuitem" onClick={() => { onOrderStatusChange?.(item.id, nextOrderStatus); setShowOrderActions(false); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-50">
                    <Icons.ArrowRight className="size-3.5 text-slate-400" /> Move to {nextOrderStatus}
                  </button>
                )}
                {!item.archivedAt && !["Completed", "Cancelled"].includes(item.status) && (
                  <button type="button" role="menuitem" onClick={() => { onOrderStatusChange?.(item.id, "Cancelled"); setShowOrderActions(false); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"><Icons.CircleX className="size-3.5 text-slate-400" /> Cancel order</button>
                )}
                <button type="button" role="menuitem" onClick={() => { onArchiveOrder?.(item.id, !item.archivedAt); setShowOrderActions(false); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-50">
                  {item.archivedAt ? <><Icons.ArchiveRestore className="size-3.5 text-slate-400" /> Restore order</> : <><Icons.Archive className="size-3.5 text-slate-400" /> Archive order</>}
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
      <section role="dialog" aria-modal="true" aria-labelledby="order-details-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div><h2 id="order-details-title" className="text-base font-bold text-slate-900">Order details</h2><p className="mt-1 text-xs text-slate-500">{order.reference} · Received {formatDate(order.date)}</p></div>
          <button type="button" aria-label="Close order details" onClick={onClose} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><X className="size-4" /></button>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div><div className="text-[11px] text-slate-400">Customer</div><div className="mt-1 text-sm font-semibold">{order.customer}</div></div>
          <div><div className="text-[11px] text-slate-400">Status</div><Status text={order.status} /></div>
          <div><div className="text-[11px] text-slate-400">Requested date</div><div className="mt-1 text-sm font-semibold">{formatDate(order.requestedDate)}</div></div>
          <div><div className="text-[11px] text-slate-400">Fulfilment</div><div className="mt-1 text-sm font-semibold">{order.fulfilmentMethod}{order.destination ? ` · ${order.destination}` : ""}</div></div>
          <div><div className="text-[11px] text-slate-400">Payment terms</div><div className="mt-1 text-sm font-semibold">{order.paymentTerms}</div></div>
          <div><div className="text-[11px] text-slate-400">Priority</div><div className="mt-1 text-sm font-semibold">{order.priority}</div>{order.priorityReason && <p className="mt-1 text-xs text-amber-700">Override: {order.priorityReason}</p>}</div>
          <div className="sm:col-span-2">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Items</h3>
            <div className="divide-y divide-slate-100 border-y border-slate-100">
              {order.items.map((item) => <div key={item.id} className="flex justify-between gap-4 py-2.5 text-sm"><span>{item.product} <span className="text-slate-400">× {item.quantity} at {money(item.unitPrice)}</span></span><strong>{money(item.lineTotal)}</strong></div>)}
            </div>
            <div className="mt-3 text-right text-base font-bold">Total: {money(order.total)}</div>
          </div>
          {order.notes && <div className="sm:col-span-2"><div className="text-[11px] text-slate-400">Notes</div><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{order.notes}</p></div>}
          <div className="sm:col-span-2"><h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Status history</h3><div className="space-y-2">{order.statusHistory.map((change, index) => <div key={`${change.at}-${index}`} className="flex justify-between gap-4 text-xs"><span className="font-semibold text-slate-700">{change.status}</span><time className="text-slate-400">{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(change.at))}</time></div>)}</div></div>
        </div>
        <div className="flex justify-end border-t border-slate-100 px-5 py-4"><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Close</button></div>
      </section>
    </div>
  );
}

function SalesDetailsDialog({
  sale,
  invoice,
  companyName,
  onClose,
}: {
  sale: ErpState["sales"][number];
  invoice?: Invoice;
  companyName: string;
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
            <h2 id="sale-details-title" className="text-base font-bold text-slate-900">
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
              <div className="text-[11px] font-medium text-slate-400">{label}</div>
              <div className="mt-1 text-sm font-semibold text-slate-800">{value}</div>
            </div>
          ))}
          <div className="sm:col-span-2">
            <div className="text-[11px] font-medium text-slate-400">Total</div>
            <div className="mt-1 text-lg font-bold text-slate-900">{money(sale.total)}</div>
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
          {invoice && <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("erp:view", { detail: { type: "invoice", id: invoice.id } }))} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Icons.ReceiptText className="size-4" />Open invoice draft</button>}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-[#6d28d9] px-3 py-2 text-xs font-semibold text-white hover:bg-[#5b21b6]"
          >
            <Icons.Printer className="size-4" /> Print receipt
          </button>
        </div>
        <div className="sale-receipt-print" aria-hidden="true">
          <div className="receipt-brand">{companyName}</div>
          <h1>Sales receipt</h1>
          <div className="receipt-reference">{sale.reference}</div>
          <div className="receipt-divider" />
          <div className="receipt-line"><span>Date</span><strong>{formatDate(sale.date)}</strong></div>
          <div className="receipt-line"><span>Customer</span><strong>{sale.customer}</strong></div>
          <div className="receipt-line"><span>Product</span><strong>{sale.product}</strong></div>
          <div className="receipt-line"><span>Quantity</span><strong>{sale.quantity}</strong></div>
          <div className="receipt-line"><span>Payment method</span><strong>{sale.method}</strong></div>
          {sale.txnID && <div className="receipt-line"><span>Transaction ID</span><strong>{sale.txnID}</strong></div>}
          <div className="receipt-line"><span>Payment terms</span><strong>{sale.paymentTerms ?? "Same-day"}</strong></div>
          <div className="receipt-line"><span>Status</span><strong>{sale.status}</strong></div>
          <div className="receipt-divider" />
          <div className="receipt-total"><span>Total paid / due</span><strong>{money(sale.total)}</strong></div>
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
                  (name !== "txnID" || (salePaymentTerms !== "Credit" && (paymentMethod === "Mobile Money" || paymentMethod === "Bank Transfer" || paymentMethod === "Check"))) &&
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
                  <select required name="customerId" defaultValue="" className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#8b5cf6] focus:ring-2 focus:ring-purple-100">
                    <option value="" disabled>Select a customer</option>
                    {customers.filter((customer) => customer.status === "Active").map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
                    {salePaymentTerms !== "Credit" && <option value="__walkin__">Walk-in customer</option>}
                  </select>
                ) : name === "dueDate" ? (
                  <input required name={name} type="date" min={new Date().toISOString().slice(0, 10)} placeholder={placeholder} className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-[#8b5cf6] focus:ring-2 focus:ring-purple-100" />
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
                    onChange={(event) => setSalePaymentTerms(event.target.value)}
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
      <div className={`max-h-[92vh] w-full overflow-y-auto rounded-2xl bg-white shadow-2xl ${active === "Orders" ? "max-w-3xl" : "max-w-lg"}`}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <div>
            <h3 className="font-bold">Add {active}</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              {active === "Orders" ? "Add a customer order to the fulfilment queue." : "This record will persist in the demo workspace."}
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
  const [fulfilmentMethod, setFulfilmentMethod] = useState<"Delivery" | "Pickup">("Delivery");
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
  const fieldClass = "rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#8b5cf6] focus:ring-2 focus:ring-purple-100";
  const labelClass = "flex flex-col gap-1.5 text-xs font-semibold text-slate-600";

  return (
    <>
      <div className="space-y-5 p-5">
        <section>
          <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Customer</h4>
          <label className={labelClass}>
            Customer
            <select
              required
              name="customer"
              value={customer}
              onChange={(event) => setCustomer(event.target.value)}
              className={fieldClass}
            >
              <option value="" disabled>Select customer</option>
              {customers.filter((item) => item.status === "Active").map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
              <option value="__new__">+ Add a new customer</option>
            </select>
          </label>
          {customer === "__new__" && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className={labelClass}>Customer name<input required name="newCustomerName" className={fieldClass} placeholder="Business or person" /></label>
              <label className={labelClass}>Customer type<select required name="newCustomerType" value={newCustomerType} onChange={(event) => setNewCustomerType(event.target.value)} className={fieldClass}><option>Big dealer</option><option>Small dealer</option><option>Export customer</option></select></label>
              <label className={labelClass}>Primary contact<input required name="newCustomerContact" className={fieldClass} placeholder="Contact person's name" /></label>
              <label className={labelClass}>Phone<input required name="newCustomerPhone" type="tel" className={fieldClass} placeholder="+256..." /></label>
              <label className={labelClass}>Email<input name="newCustomerEmail" type="email" className={fieldClass} placeholder="orders@example.com" /></label>
              <label className={labelClass}>Referred by<input required name="newCustomerReferredBy" className={fieldClass} placeholder="Staff member or referrer" /></label>
              {newCustomerType === "Big dealer" && <>
                <label className={labelClass}>Region<input required name="newCustomerRegion" className={fieldClass} /></label>
                <label className={labelClass}>District<input required name="newCustomerDistrict" className={fieldClass} /></label>
                <label className={labelClass}>TIN (optional)<input name="newCustomerTin" className={fieldClass} /></label>
              </>}
              {newCustomerType === "Export customer" && <label className={labelClass}>Country of operation<input required name="newCustomerCountry" className={fieldClass} /></label>}
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">Order items</h4>
            <button type="button" onClick={() => setItems((current) => [...current, { id: `line-${Date.now()}`, product: "", quantity: 1, unitPrice: 0 }])} className="inline-flex items-center gap-1 text-xs font-semibold text-[#6d28d9] hover:underline"><Plus className="size-3.5" /> Add item</button>
          </div>
          <input type="hidden" name="items" value={serializedItems} />
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={item.id} className="grid items-end gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[minmax(0,1fr)_100px_150px_36px]">
                <label className={labelClass}>Product / description<input required value={item.product} onChange={(event) => setItems((current) => current.map((line) => line.id === item.id ? { ...line, product: event.target.value } : line))} className={fieldClass} placeholder="Product name" /></label>
                <label className={labelClass}>Quantity<input required min="1" step="1" type="number" value={item.quantity} onChange={(event) => setItems((current) => current.map((line) => line.id === item.id ? { ...line, quantity: Math.max(1, Number(event.target.value)) } : line))} className={fieldClass} /></label>
                <label className={labelClass}>Unit price (UGX)<input required min="0" step="1" type="number" value={item.unitPrice} onChange={(event) => setItems((current) => current.map((line) => line.id === item.id ? { ...line, unitPrice: Math.max(0, Number(event.target.value)) } : line))} className={fieldClass} /></label>
                <button type="button" aria-label={`Remove item ${index + 1}`} disabled={items.length === 1} onClick={() => setItems((current) => current.filter((line) => line.id !== item.id))} className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"><Icons.Trash2 className="size-4" /></button>
                <div className="text-right text-xs text-slate-500 sm:col-span-4">Line total: <strong className="text-slate-800">{money(item.quantity * item.unitPrice)}</strong></div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-end border-t border-slate-100 pt-3 text-sm font-bold">Order total: <span className="ml-2 text-[#5b21b6]">{money(total)}</span></div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>Requested fulfilment date<input required name="requestedDate" type="date" min={today} defaultValue={today} className={fieldClass} /></label>
          <label className={labelClass}>Fulfilment method<select name="fulfilmentMethod" value={fulfilmentMethod} onChange={(event) => setFulfilmentMethod(event.target.value as "Delivery" | "Pickup")} className={fieldClass}><option value="Delivery">Delivery</option><option value="Pickup">Customer pickup</option></select></label>
          <label className={`${labelClass} sm:col-span-2`}>{fulfilmentMethod === "Delivery" ? "Delivery address / instructions" : "Pickup instructions"}<input name="destination" className={fieldClass} placeholder={fulfilmentMethod === "Delivery" ? "Delivery location" : "Pickup details"} /></label>
          <label className={labelClass}>Payment terms<select name="paymentTerms" defaultValue="Same-day" className={fieldClass}><option value="Paid now">Paid now</option><option value="Same-day">Same-day payment</option><option value="Credit">Credit terms</option></select></label>
          <label className={labelClass}>Priority<select name="priority" value={priority} onChange={(event) => setPriority(event.target.value as "Normal" | "High")} className={fieldClass}><option value="Normal">Normal</option><option value="High">High priority</option></select></label>
          {priority === "High" && <label className={`${labelClass} sm:col-span-2`}>Reason for priority override<textarea required name="priorityReason" rows={2} className={fieldClass} placeholder="Explain why this order must move ahead of older orders" /></label>}
          <label className={`${labelClass} sm:col-span-2`}>Order notes<textarea name="notes" rows={3} className={fieldClass} placeholder="Customer instructions or internal notes" /></label>
        </section>
      </div>
      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-100 bg-white px-5 py-4">
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600">Cancel</button>
        <button type="submit" className="rounded-lg bg-[#6d28d9] px-4 py-2.5 text-xs font-semibold text-white shadow-sm">Add to order queue</button>
      </div>
    </>
  );
}

function AnalyticsPanel({ active, state }: { active: string; state: ErpState }) {
  const lowStock = state.materials.filter((material) => material.quantity <= material.threshold).length
  const insights = [
    { title: 'Sales momentum', text: 'Weekly revenue is trending above the previous period.', Icon: TrendingUp },
    { title: 'Inventory watch', text: `${lowStock} materials need replenishment planning.`, Icon: Icons.AlertTriangle },
    { title: 'Data boundary', text: 'All figures are simulated and stored only in this browser.', Icon: Icons.Info },
  ]

  return <div className="grid gap-4 lg:grid-cols-2">
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:col-span-2">
      <h3 className="text-sm font-bold">{active} overview</h3><p className="mt-1 text-xs text-slate-400">Derived from your shared demonstration records.</p>
      <div className="mt-5 h-[320px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid vertical={false} stroke="#eef0f4" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} /><Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} /><Bar dataKey="sales" fill="#6d28d9" radius={[5, 5, 0, 0]} /><Bar dataKey="expenses" fill="#c4b5fd" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div>
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h3 className="text-sm font-bold">Management insights</h3><div className="mt-5 flex flex-col gap-4">{insights.map(({ title, text, Icon }) => <div key={title} className="flex gap-3 rounded-xl bg-slate-50 p-4"><Icon className="mt-0.5 size-4 shrink-0 text-[#6d28d9]" /><div><div className="text-xs font-bold">{title}</div><div className="mt-1 text-xs leading-relaxed text-slate-500">{text}</div></div></div>)}</div></section>
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h3 className="text-sm font-bold">Report controls</h3><div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-600">From<input type="date" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal" /></label><label className="text-xs font-semibold text-slate-600">To<input type="date" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal" /></label></div><button onClick={() => exportCsv('lumina-report.csv', state.sales as unknown as Record<string, unknown>[])} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#6d28d9] px-4 py-2.5 text-xs font-semibold text-white"><Download className="size-4" /> Export report</button></section>
  </div>
}

export default function Page() { return <App /> }
