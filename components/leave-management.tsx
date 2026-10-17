'use client'

import { useMemo, useState } from 'react'
import * as Icons from 'lucide-react'
import { createId, employeeDisplayName, formatDate, type Employee, type ErpState, type LeaveRequest, type LeaveType } from '@/lib/erp'
import { calculateWorkingDays, decideLeaveRequest, leaveBalanceFor, validateLeaveRequest } from '@/lib/leave'

type Props = { state: ErpState; updateState: (next: ErpState) => void; onViewEmployee: (id: string) => void }
type View = 'Requests' | 'Team calendar' | 'Balances'
const leaveTypes: LeaveType[] = ['Sick', 'Maternity/Paternity', 'Compassionate', 'Other']
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const statusStyle = (status: string) => status === 'Approved' ? 'bg-emerald-50 text-emerald-700' : status === 'Pending' ? 'bg-amber-50 text-amber-700' : status === 'Rejected' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'

export default function LeaveManagement({ state, updateState, onViewEmployee }: Props) {
  const [view, setView] = useState<View>('Requests')
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<LeaveRequest | null>(null)
  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('All departments')
  const [status, setStatus] = useState('All statuses')
  const [month, setMonth] = useState(() => today().slice(0, 7))
  const activeEmployees = state.employees.filter((employee) => employee.status === 'Active')
  const departments = [...new Set(activeEmployees.map((employee) => employee.department).filter(Boolean))].sort()
  const pendingCount = state.leaveRequests.filter((request) => request.status === 'Pending').length
  const awayToday = state.leaveRequests.filter((request) => request.status === 'Approved' && request.startDate <= today() && request.endDate >= today()).length
  const upcoming = state.leaveRequests.filter((request) => request.status === 'Approved' && request.startDate > today() && request.startDate <= addDays(today(), 7)).length
  const rows = useMemo(() => state.leaveRequests.filter((request) => {
    const query = `${request.employeeName} ${request.employeeNumber} ${request.department} ${request.reference} ${request.leaveType} ${request.otherLeaveType ?? ''}`.toLowerCase()
    return query.includes(search.trim().toLowerCase())
      && (department === 'All departments' || request.department === department)
      && (status === 'All statuses' || request.status === status)
  }).sort((left, right) => Number(right.status === 'Pending') - Number(left.status === 'Pending') || right.requestedAt.localeCompare(left.requestedAt)), [state.leaveRequests, search, department, status])
  const saveRequest = (request: LeaveRequest) => {
    updateState({ ...state, leaveRequests: [request, ...state.leaveRequests] })
    setShowForm(false)
  }
  const updateRequest = (request: LeaveRequest) => {
    updateState({ ...state, leaveRequests: state.leaveRequests.map((item) => item.id === request.id ? request : item) })
    setSelected(request)
  }

  return <div className="animate-in fade-in duration-300">
    <header className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><div className="mb-2 text-xs font-medium text-slate-400">Workspace / HR Department</div><h2 className="text-2xl font-bold tracking-tight">Leave Management</h2><p className="mt-1 text-sm text-slate-500">Review leave requests and plan team coverage.</p></div>
      <button type="button" onClick={() => setShowForm(true)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#6d28d9] px-3 py-2.5 text-xs font-semibold text-white hover:bg-[#5b21b6]"><Icons.Plus className="size-4" /> New leave request</button>
    </header>

    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"><span className="font-semibold text-amber-700">{pendingCount} pending</span><span className="text-slate-300">·</span><span className="text-sky-700">{awayToday} away today</span><span className="text-slate-300">·</span><span className="text-emerald-700">{upcoming} upcoming this week</span></div>

    <div role="tablist" aria-label="Leave management views" className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">{(['Requests', 'Team calendar', 'Balances'] as View[]).map((item) => <button key={item} type="button" role="tab" aria-selected={view === item} onClick={() => setView(item)} className={`shrink-0 border-b-2 px-3 py-3 text-xs font-semibold ${view === item ? 'border-[#6d28d9] text-[#6d28d9]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{item}{item === 'Requests' && <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] ${view === item ? 'bg-[#f1eafd]' : 'bg-slate-100'}`}>{pendingCount}</span>}</button>)}</div>

    {view === 'Requests' && <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 xl:flex-row xl:items-center xl:justify-between"><div><h3 className="text-sm font-bold">Leave requests</h3><p className="mt-1 text-xs text-slate-400">{rows.length} matching request{rows.length === 1 ? '' : 's'} · weekday counts exclude weekends</p></div><div className="flex flex-wrap gap-2"><label className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><Icons.Search className="size-4 shrink-0 text-slate-400" /><input aria-label="Search leave requests" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Employee, ID, or leave type" className="w-48 bg-transparent text-xs outline-none" /></label><select aria-label="Filter leave by department" value={department} onChange={(event) => setDepartment(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><option>All departments</option>{departments.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Filter leave by status" value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">{['All statuses', 'Pending', 'Approved', 'Rejected', 'Cancelled'].map((item) => <option key={item}>{item}</option>)}</select></div></div>
      {rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-xs"><thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-400"><tr>{['Employee', 'Leave type', 'Dates', 'Days', 'Handover', 'Status', ''].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{rows.map((request) => <tr key={request.id} className="border-t border-slate-100 text-slate-600 hover:bg-slate-50/70"><td className="px-4 py-3"><button type="button" onClick={() => onViewEmployee(request.employeeId)} className="font-semibold text-slate-800 hover:text-[#6d28d9]">{request.employeeName}</button><span className="mt-1 block text-[10px] text-slate-400">{request.employeeNumber} · {request.department}</span></td><td className="px-4 py-3">{request.leaveType === 'Other' ? request.otherLeaveType : request.leaveType}</td><td className="px-4 py-3">{formatDate(request.startDate)} – {formatDate(request.endDate)}</td><td className="px-4 py-3 font-semibold">{request.requestedDays}</td><td className="px-4 py-3">{request.handoverName}</td><td className="px-4 py-3"><span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${statusStyle(request.status)}`}>{request.status}</span></td><td className="px-4 py-3"><button type="button" onClick={() => setSelected(request)} className="font-semibold text-[#6d28d9] hover:underline">{request.status === 'Pending' ? 'Review' : 'Details'}</button></td></tr>)}</tbody></table></div> : <Empty title={state.leaveRequests.length ? 'No requests match these filters' : 'No leave requests yet'} detail={state.leaveRequests.length ? 'Adjust your search or filters.' : 'New submissions will appear here for review.'} />}
    </section>}

    {view === 'Team calendar' && <CalendarView requests={state.leaveRequests} month={month} setMonth={setMonth} departments={departments} />}
    {view === 'Balances' && <BalancesView employees={activeEmployees} requests={state.leaveRequests} departments={departments} />}
    {showForm && <LeaveRequestForm employees={activeEmployees} requests={state.leaveRequests} onClose={() => setShowForm(false)} onSave={saveRequest} />}
    {selected && <ReviewDialog request={selected} onClose={() => setSelected(null)} onDecision={(decision, note) => updateRequest(decideLeaveRequest(selected, decision, 'Sarah Namirembe', note))} />}
  </div>
}

function LeaveRequestForm({ employees, requests, onClose, onSave }: { employees: Employee[]; requests: LeaveRequest[]; onClose: () => void; onSave: (request: LeaveRequest) => void }) {
  const [employeeId, setEmployeeId] = useState('')
  const [leaveType, setLeaveType] = useState<LeaveType>('Sick')
  const [otherLeaveType, setOtherLeaveType] = useState('')
  const [reason, setReason] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [handoverEmployeeId, setHandoverEmployeeId] = useState('')
  const [handoverContact, setHandoverContact] = useState('')
  const [error, setError] = useState('')
  const employee = employees.find((item) => item.id === employeeId)
  const handover = employees.find((item) => item.id === handoverEmployeeId)
  const days = calculateWorkingDays(startDate, endDate)
  const setHandover = (id: string) => {
    setHandoverEmployeeId(id)
    setHandoverContact(employees.find((item) => item.id === id)?.phone ?? '')
  }
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validation = validateLeaveRequest({ employee, handover, leaveType, otherLeaveType, reason, startDate, endDate, handoverContact }, requests)
    if (validation) { setError(validation); return }
    if (!employee || !handover) return
    const now = new Date().toISOString()
    onSave({
      id: createId('LEAVE'), reference: createId('LV'), employeeId: employee.id, employeeName: employeeDisplayName(employee), employeeNumber: employee.number,
      department: employee.department, role: employee.role, employeeContact: employee.phone ?? '', leaveType,
      otherLeaveType: leaveType === 'Other' ? otherLeaveType.trim() : undefined, reason: reason.trim(), startDate, endDate, requestedDays: days,
      handoverEmployeeId: handover.id, handoverName: employeeDisplayName(handover), handoverContact: handoverContact.trim(), status: 'Pending', requestedAt: now, updatedAt: now, decisions: [],
    })
  }
  const label = 'block text-xs font-semibold text-slate-600'
  const input = 'mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100'
  return <Modal title="New leave request" subtitle="Employee details are populated from the employee record." onClose={onClose}>
    <form onSubmit={submit} className="space-y-5 p-5">
      <section><h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Employee details</h3><div className="grid gap-3 sm:grid-cols-2"><label className={`${label} sm:col-span-2`}>Employee<select required value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className={input}><option value="">Select an active employee</option>{employees.map((item) => <option key={item.id} value={item.id}>{employeeDisplayName(item)} · {item.number}</option>)}</select></label><ReadOnly label="Employee ID" value={employee?.number} /><ReadOnly label="Department" value={employee?.department} /><ReadOnly label="Position" value={employee?.role} /><ReadOnly label="Contact" value={employee?.phone} /></div></section>
      <section className="border-t border-slate-100 pt-4"><h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Leave details</h3><div className="grid gap-3 sm:grid-cols-2"><label className={label}>Type of leave<select value={leaveType} onChange={(event) => setLeaveType(event.target.value as LeaveType)} className={input}>{leaveTypes.map((type) => <option key={type}>{type}</option>)}</select></label>{leaveType === 'Other' && <label className={label}>Specify leave type<input required value={otherLeaveType} onChange={(event) => setOtherLeaveType(event.target.value)} className={input} /></label>}<label className={`${label} ${leaveType !== 'Other' ? 'sm:col-span-2' : ''}`}>Reason for leave<textarea required rows={2} value={reason} onChange={(event) => setReason(event.target.value)} className={input} /></label><label className={label}>Leave start<input required type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={input} /></label><label className={label}>Leave end<input required type="date" min={startDate || undefined} value={endDate} onChange={(event) => setEndDate(event.target.value)} className={input} /></label><div className="rounded-lg bg-slate-50 px-3 py-2.5"><div className="text-[10px] font-semibold uppercase text-slate-400">Working days requested</div><div className="mt-1 text-sm font-bold text-slate-800">{days || '—'}</div><div className="mt-0.5 text-[10px] text-slate-400">Weekends excluded; holidays not yet configured.</div></div></div></section>
      <section className="border-t border-slate-100 pt-4"><h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Work handover</h3><div className="grid gap-3 sm:grid-cols-2"><label className={label}>Hand over work to<select required value={handoverEmployeeId} onChange={(event) => setHandover(event.target.value)} className={input}><option value="">Select an active employee</option>{employees.filter((item) => item.id !== employeeId).map((item) => <option key={item.id} value={item.id}>{employeeDisplayName(item)} · {item.department}</option>)}</select></label><label className={label}>Handover contact<input required type="tel" value={handoverContact} onChange={(event) => setHandoverContact(event.target.value)} className={input} /></label></div></section>
      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{error}</p>}
      <footer className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Cancel</button><button type="submit" className="rounded-lg bg-[#6d28d9] px-4 py-2 text-xs font-semibold text-white">Submit request</button></footer>
    </form>
  </Modal>
}

function ReviewDialog({ request, onClose, onDecision }: { request: LeaveRequest; onClose: () => void; onDecision: (decision: 'Approved' | 'Rejected', note: string) => void }) {
  const [note, setNote] = useState('')
  const fields = [['Employee', `${request.employeeName} · ${request.employeeNumber}`], ['Department / position', `${request.department} · ${request.role}`], ['Employee contact', request.employeeContact || 'Not provided'], ['Leave type', request.leaveType === 'Other' ? request.otherLeaveType ?? 'Other' : request.leaveType], ['Dates', `${formatDate(request.startDate)} – ${formatDate(request.endDate)}`], ['Working days', String(request.requestedDays)], ['Handover', request.handoverName], ['Handover contact', request.handoverContact], ['Reason', request.reason]]
  return <Modal title={request.status === 'Pending' ? 'Review leave request' : 'Leave request details'} subtitle={`${request.reference} · Submitted ${formatDate(request.requestedAt.slice(0, 10))}`} onClose={onClose}>
    <div className="p-5"><dl className="grid gap-4 sm:grid-cols-2">{fields.map(([label, value]) => <div key={label}><dt className="text-[10px] font-medium uppercase text-slate-400">{label}</dt><dd className="mt-1 break-words text-xs font-semibold text-slate-800">{value}</dd></div>)}</dl>
      {request.decisions.length > 0 && <section className="mt-5 border-t border-slate-100 pt-4"><h3 className="text-xs font-bold">Decision history</h3><ol className="mt-2 space-y-2">{request.decisions.map((decision) => <li key={decision.id} className="text-xs text-slate-600">{decision.decision} · {decision.actor} · {new Date(decision.at).toLocaleString()}{decision.note ? ` · ${decision.note}` : ''}</li>)}</ol></section>}
      {request.status === 'Pending' ? <div className="mt-5"><label className="block text-xs font-semibold text-slate-600">Decision note<textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label><div className="mt-4 flex flex-wrap justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Close</button><button type="button" onClick={() => onDecision('Rejected', note)} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700">Reject</button><button type="button" onClick={() => onDecision('Approved', note)} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white">Approve</button></div></div> : <div className="mt-5 flex justify-end"><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold">Close</button></div>}
    </div>
  </Modal>
}

function CalendarView({ requests, month, setMonth, departments }: { requests: LeaveRequest[]; month: string; setMonth: (value: string) => void; departments: string[] }) {
  const [department, setDepartment] = useState('All departments')
  const [year, monthIndex] = month.split('-').map(Number)
  const firstWeekday = (new Date(Date.UTC(year, monthIndex - 1, 1)).getUTCDay() + 6) % 7
  const count = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate()
  const cells: Array<number | null> = [...Array.from({ length: firstWeekday }, () => null), ...Array.from({ length: count }, (_, index) => index + 1)]
  while (cells.length % 7) cells.push(null)
  const monthRequests = requests.filter((request) => ['Pending', 'Approved'].includes(request.status) && request.startDate.slice(0, 7) <= month && request.endDate.slice(0, 7) >= month && (department === 'All departments' || request.department === department))
  const label = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, monthIndex - 1, 1)))
  const step = (offset: number) => { const date = new Date(Date.UTC(year, monthIndex - 1 + offset, 1)); setMonth(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`) }
  return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><header className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-sm font-bold">Team calendar</h3><p className="mt-1 text-xs text-slate-400">Approved leave and pending requests by date.</p></div><div className="flex flex-wrap items-center gap-2"><select aria-label="Filter leave calendar by department" value={department} onChange={(event) => setDepartment(event.target.value)} className="rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs"><option>All departments</option>{departments.map((item) => <option key={item}>{item}</option>)}</select><button aria-label="Previous month" onClick={() => step(-1)} className="grid size-8 place-items-center rounded-md hover:bg-slate-100"><Icons.ChevronLeft className="size-4" /></button><strong className="min-w-32 text-center text-xs">{label}</strong><button aria-label="Next month" onClick={() => step(1)} className="grid size-8 place-items-center rounded-md hover:bg-slate-100"><Icons.ChevronRight className="size-4" /></button></div></header><div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50 text-center text-[10px] font-semibold uppercase text-slate-400">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <div key={day} className="py-2">{day}</div>)}</div><div className="grid grid-cols-7">{cells.map((day, index) => { const date = day ? `${month}-${String(day).padStart(2, '0')}` : ''; const daily = monthRequests.filter((request) => request.startDate <= date && request.endDate >= date); return <div key={`${month}-${index}`} className="min-h-24 border-b border-r border-slate-100 p-1.5 sm:min-h-28 sm:p-2"><span className={`text-[10px] ${day ? 'text-slate-500' : 'text-transparent'}`}>{day ?? '0'}</span><div className="mt-1 space-y-1">{daily.slice(0, 2).map((request) => <div key={request.id} title={`${request.employeeName} · ${request.status}`} className={`truncate rounded px-1 py-1 text-[9px] font-semibold ${request.status === 'Approved' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>{request.employeeName.split(' ')[0]} · {request.leaveType}</div>)}{daily.length > 2 && <div className="text-[9px] text-slate-400">+{daily.length - 2} more</div>}</div></div> })}</div><footer className="flex gap-4 px-4 py-3 text-[10px] text-slate-500"><span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-emerald-500" />Approved</span><span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-amber-400" />Pending</span></footer></section>
}

function BalancesView({ employees, requests, departments }: { employees: Employee[]; requests: LeaveRequest[]; departments: string[] }) {
  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('All departments')
  const rows = employees.filter((employee) => `${employeeDisplayName(employee)} ${employee.number} ${employee.department}`.toLowerCase().includes(search.trim().toLowerCase()) && (department === 'All departments' || employee.department === department)).map((employee) => ({ employee, balance: leaveBalanceFor(employee.id, undefined, requests) }))
  return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-sm font-bold">Leave balances</h3><p className="mt-1 text-xs text-slate-500">Entitlement policies are not configured. Usage is shown for visibility; available balances are not calculated.</p></div><div className="flex flex-wrap gap-2"><label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><Icons.Search className="size-4 text-slate-400" /><input aria-label="Search leave balances" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Employee or ID" className="w-40 bg-transparent text-xs outline-none" /></label><select aria-label="Filter leave balances by department" value={department} onChange={(event) => setDepartment(event.target.value)} className="rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs"><option>All departments</option>{departments.map((item) => <option key={item}>{item}</option>)}</select></div></div><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-xs"><thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-400"><tr>{['Employee', 'Department', 'Approved days used', 'Pending days', 'Available'].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{rows.map(({ employee, balance }) => <tr key={employee.id} className="border-t border-slate-100 text-slate-600"><td className="px-4 py-3 font-semibold text-slate-800">{employeeDisplayName(employee)}<span className="mt-1 block text-[10px] text-slate-400">{employee.number}</span></td><td className="px-4 py-3">{employee.department}</td><td className="px-4 py-3">{balance.used}</td><td className="px-4 py-3">{balance.pending}</td><td className="px-4 py-3 text-slate-400">Not configured</td></tr>)}</tbody></table>{!rows.length && <p className="px-5 py-10 text-center text-xs text-slate-400">No employees match these filters.</p>}</div></section>
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/40 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section role="dialog" aria-modal="true" aria-labelledby="leave-dialog-title" className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 id="leave-dialog-title" className="text-base font-bold">{title}</h2><p className="mt-1 text-xs text-slate-500">{subtitle}</p></div><button type="button" aria-label="Close dialog" onClick={onClose} className="grid size-8 place-items-center rounded-md text-slate-400 hover:bg-slate-100"><Icons.X className="size-4" /></button></header><div className="min-h-0 overflow-y-auto">{children}</div></section></div>
}

function ReadOnly({ label, value }: { label: string; value?: string }) {
  return <div className="block text-xs font-semibold text-slate-600">{label}<div className="mt-1.5 min-h-10 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm font-normal text-slate-600">{value || 'Select an employee'}</div></div>
}

function Empty({ title, detail }: { title: string; detail: string }) {
  return <div className="px-5 py-14 text-center"><Icons.CalendarDays className="mx-auto size-5 text-slate-400" /><h4 className="mt-3 text-sm font-semibold text-slate-800">{title}</h4><p className="mx-auto mt-1 max-w-md text-xs text-slate-500">{detail}</p></div>
}

function addDays(date: string, amount: number) {
  const next = new Date(`${date}T12:00:00.000Z`)
  next.setUTCDate(next.getUTCDate() + amount)
  return next.toISOString().slice(0, 10)
}
