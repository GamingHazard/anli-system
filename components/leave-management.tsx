'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import * as Icons from 'lucide-react'
import { employeeDisplayName, formatDate, getLegacyLeaveRequests, preserveLegacyLeaveRequests, type Employee, type ErpState, type LeaveRequest, type LeaveType } from '@/lib/erp'
import type { LeavePolicy, LeaveRequestInput, LeaveRoutingEmployee, LeaveRoutingUser, UserAccount, LegacyLeaveImportPreview } from '@/lib/user-api'
import { useConfirmLeaveReturn, useCreateLeaveAmendment, useCreateLeaveRequest, useImportLegacyLeaveRequests, useLeaveAmendmentDecision, useLeaveBalances, useLeaveDecision, useLeavePeople, useLeavePolicy, useLeaveRequests, useLeaveCancellation, useLegacyLeaveArchive, usePreviewLegacyLeaveRequests, useUpdateLeavePolicy, useUpdateLeaveRouting } from '@/lib/leave-queries'
import { calculateWorkingDays, validateLeaveRequest } from '@/lib/leave'
import { hasAnyDepartmentRole } from '@/lib/authorization'

type Props = { state: ErpState; updateState: (next: ErpState) => void; currentUser: UserAccount; onViewEmployee: (id: string) => void }
type View = 'Requests' | 'Team calendar' | 'Balances' | 'Policy' | 'Routing'
const leaveTypes: LeaveType[] = ['Annual', 'Sick', 'Maternity/Paternity', 'Compassionate', 'Other']
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const statusStyle = (status: string) => status === 'Approved' ? 'bg-emerald-50 text-emerald-700' : status === 'Pending' ? 'bg-amber-50 text-amber-700' : status === 'Rejected' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'

export default function LeaveManagement({ state, updateState, currentUser, onViewEmployee }: Props) {
  const [view, setView] = useState<View>('Requests')
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<LeaveRequest | null>(null)
  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('All departments')
  const [status, setStatus] = useState('All statuses')
  const [month, setMonth] = useState(() => today().slice(0, 7))
  const [mutationError, setMutationError] = useState('')
  const [legacyRequests, setLegacyRequests] = useState<LeaveRequest[]>([])
  const [legacyPreview, setLegacyPreview] = useState<LegacyLeaveImportPreview | null>(null)
  const [legacyImportMessage, setLegacyImportMessage] = useState('')
  const preservedLegacySnapshot = useRef(false)
  const requestQuery = useLeaveRequests()
  const policyQuery = useLeavePolicy()
  const isAdmin = hasAnyDepartmentRole(currentUser.roles, ['Human Resource', 'Admin'])
  const isSuperAdmin = currentUser.roles.includes('Super Admin')
  const balancesQuery = useLeaveBalances(isAdmin)
  const peopleQuery = useLeavePeople(isAdmin && view === 'Routing')
  const legacyArchiveQuery = useLegacyLeaveArchive(isAdmin)
  const createMutation = useCreateLeaveRequest()
  const decisionMutation = useLeaveDecision()
  const cancellationMutation = useLeaveCancellation()
  const amendmentMutation = useCreateLeaveAmendment()
  const amendmentDecisionMutation = useLeaveAmendmentDecision()
  const returnMutation = useConfirmLeaveReturn()
  const policyMutation = useUpdateLeavePolicy()
  const routingMutation = useUpdateLeaveRouting()
  const legacyPreviewMutation = usePreviewLegacyLeaveRequests()
  const legacyImportMutation = useImportLegacyLeaveRequests()
  const requests = requestQuery.data?.requests ?? []
  useEffect(() => {
    if (!requestQuery.data || preservedLegacySnapshot.current) return
    preserveLegacyLeaveRequests(state.leaveRequests)
    setLegacyRequests(getLegacyLeaveRequests())
    preservedLegacySnapshot.current = true
  }, [requestQuery.data, state.leaveRequests])
  const activeEmployees = state.employees.filter((employee) => employee.status === 'Active')
  const requestEmployees = isAdmin ? activeEmployees : activeEmployees.filter((employee) => employee.userId === currentUser.id)
  const departments = [...new Set(activeEmployees.map((employee) => employee.department).filter(Boolean))].sort()
  const pendingCount = requests.filter((request) => request.status === 'Pending').length
  const awayToday = requests.filter((request) => request.status === 'Approved' && request.startDate <= today() && request.endDate >= today()).length
  const upcoming = requests.filter((request) => request.status === 'Approved' && request.startDate > today() && request.startDate <= addDays(today(), 7)).length
  const rows = useMemo(() => requests.filter((request) => {
    const query = `${request.employeeName} ${request.employeeNumber} ${request.department} ${request.reference} ${request.leaveType} ${request.otherLeaveType ?? ''}`.toLowerCase()
    return query.includes(search.trim().toLowerCase())
      && (department === 'All departments' || request.department === department)
      && (status === 'All statuses' || request.status === status)
  }).sort((left, right) => Number(right.status === 'Pending') - Number(left.status === 'Pending') || right.requestedAt.localeCompare(left.requestedAt)), [requests, search, department, status])
  const saveRequest = async (input: Parameters<typeof createMutation.mutateAsync>[0]) => {
    setMutationError('')
    try {
      await createMutation.mutateAsync(input)
      setShowForm(false)
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : 'Could not submit the leave request.')
    }
  }
  const updateRequest = async (request: LeaveRequest, decision: 'Approved' | 'Rejected', note: string) => {
    setMutationError('')
    try {
      const updated = await decisionMutation.mutateAsync({ id: request.id, input: { decision, note } })
      setSelected(updated)
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : 'Could not save the leave decision.')
    }
  }
  const updateRouting = async (employeeId: string, field: 'userId' | 'supervisorUserId', value: string | null) => {
    setMutationError('')
    try {
      const input = field === 'userId' ? { userId: value } : { supervisorUserId: value }
      const result = await routingMutation.mutateAsync({ employeeId, input })
      updateState({
        ...state,
        employees: state.employees.map((employee) => employee.id === employeeId
          ? { ...employee, ...result.employee }
          : employee),
      })
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : 'Could not update leave routing.')
    }
  }
  const updateSelectedRequest = async (action:
    | { type: 'cancel'; note: string }
    | { type: 'amend'; startDate: string; endDate: string; reason: string }
    | { type: 'return'; actualDate: string }) => {
    if (!selected) return
    setMutationError('')
    try {
      const updated = action.type === 'cancel'
        ? await cancellationMutation.mutateAsync({ id: selected.id, note: action.note })
        : action.type === 'amend'
          ? await amendmentMutation.mutateAsync({ id: selected.id, input: { startDate: action.startDate, endDate: action.endDate, reason: action.reason } })
          : await returnMutation.mutateAsync({ id: selected.id, actualDate: action.actualDate })
      setSelected(updated)
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : `Could not ${action.type} this leave request.`)
    }
  }
  const decideAmendment = async (amendmentId: string, decision: 'Approved' | 'Rejected', note: string) => {
    if (!selected) return
    setMutationError('')
    try {
      const updated = await amendmentDecisionMutation.mutateAsync({
        id: selected.id,
        amendmentId,
        input: { decision, note },
      })
      setSelected(updated)
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : 'Could not save the amendment decision.')
    }
  }
  const previewLegacyImport = async () => {
    setMutationError('')
    setLegacyImportMessage('')
    try {
      const preview = await legacyPreviewMutation.mutateAsync(legacyRequests)
      setLegacyPreview(preview)
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : 'Could not preview the preserved leave archive.')
    }
  }
  const importLegacyArchive = async () => {
    setMutationError('')
    setLegacyImportMessage('')
    try {
      const result = await legacyImportMutation.mutateAsync(legacyRequests)
      setLegacyImportMessage(`${result.imported.length} legacy leave record(s) archived. Original browser data remains preserved; legacy decisions are not treated as verified approvals.`)
      setLegacyPreview(null)
      await legacyArchiveQuery.refetch()
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : 'Could not import the preserved leave archive.')
    }
  }

  return <div className="animate-in fade-in duration-300">
    <header className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><div className="mb-2 text-xs font-medium text-slate-400">Workspace / HR Department</div><h2 className="text-2xl font-bold tracking-tight">Leave Management</h2><p className="mt-1 text-sm text-slate-500">Review leave requests and plan team coverage.</p></div>
      <button type="button" onClick={() => { setMutationError(''); setShowForm(true) }} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#6d28d9] px-3 py-2.5 text-xs font-semibold text-white hover:bg-[#5b21b6]"><Icons.Plus className="size-4" /> New leave request</button>
    </header>

    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"><span className="font-semibold text-amber-700">{pendingCount} pending</span><span className="text-slate-300">·</span><span className="text-sky-700">{awayToday} away today</span><span className="text-slate-300">·</span><span className="text-emerald-700">{upcoming} upcoming this week</span></div>

    <div role="tablist" aria-label="Leave management views" className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">{(['Requests', 'Team calendar', ...(isAdmin ? ['Balances' as const, 'Routing' as const] : []), ...(isSuperAdmin ? ['Policy' as const] : [])] as View[]).map((item) => <button key={item} type="button" role="tab" aria-selected={view === item} onClick={() => setView(item)} className={`shrink-0 border-b-2 px-3 py-3 text-xs font-semibold ${view === item ? 'border-[#6d28d9] text-[#6d28d9]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{item}{item === 'Requests' && <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] ${view === item ? 'bg-[#f1eafd]' : 'bg-slate-100'}`}>{pendingCount}</span>}</button>)}</div>

    {requestQuery.isError && <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">{requestQuery.error instanceof Error ? requestQuery.error.message : 'Could not load leave requests.'}<button type="button" onClick={() => requestQuery.refetch()} className="ml-3 font-semibold underline">Retry</button></p>}
    {mutationError && <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">{mutationError}</p>}
    {requestQuery.isLoading && <p role="status" className="mb-4 text-xs text-slate-500">Loading leave requests…</p>}

    {isAdmin && view === 'Requests' && legacyRequests.length > 0 && <section aria-label="Import browser leave archive" className="mb-4 rounded-xl border border-sky-200 bg-sky-50 p-4"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h3 className="text-sm font-bold text-sky-950">Browser archive available</h3><p className="mt-1 text-xs leading-5 text-sky-900">{legacyRequests.length} locally preserved record(s). Preview before importing. Imported data is kept in a separate, read-only archive and does not count as verified leave, approvals, or balances.</p></div><button type="button" disabled={legacyPreviewMutation.isPending || legacyImportMutation.isPending} onClick={() => void previewLegacyImport()} className="shrink-0 rounded-lg border border-sky-300 bg-white px-3 py-2 text-xs font-semibold text-sky-900 disabled:opacity-50">{legacyPreviewMutation.isPending ? 'Working…' : 'Preview archive'}</button></div>{legacyPreview && <div className="mt-4 border-t border-sky-200 pt-3"><p className="text-xs font-semibold text-sky-950">{legacyPreview.importableCount} can be archived · {legacyPreview.duplicateCount} already archived</p><p className="mt-1 text-[11px] leading-5 text-sky-900">Legacy decisions are preserved as unverified history. Employee profiles are matched by employee number when available; unmatched records remain unlinked.</p><ul className="mt-2 max-h-32 space-y-1 overflow-auto text-[11px] text-sky-900">{legacyPreview.records.slice(0, 8).map((item) => <li key={item.index}>{item.reference || `Record ${item.index + 1}`} · {item.employeeName || 'Unknown employee'} · {item.duplicate ? 'Already archived' : item.importable ? `${item.originalStatus} · ${item.employeeMatched ? 'Employee matched' : 'Employee not matched'}` : item.reason}</li>)}</ul><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={legacyImportMutation.isPending || legacyPreview.importableCount === 0} onClick={() => void importLegacyArchive()} className="rounded-lg bg-sky-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-45">{legacyImportMutation.isPending ? 'Importing…' : `Archive ${legacyPreview.importableCount} records`}</button><button type="button" disabled={legacyImportMutation.isPending} onClick={() => setLegacyPreview(null)} className="rounded-lg border border-sky-300 bg-white px-3 py-2 text-xs font-semibold text-sky-900 disabled:opacity-50">Cancel</button></div></div>}{legacyImportMessage && <p role="status" className="mt-3 rounded-md bg-white px-3 py-2 text-xs text-emerald-800">{legacyImportMessage}</p>}</section>}
    {isAdmin && legacyArchiveQuery.isError && <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">{legacyArchiveQuery.error instanceof Error ? legacyArchiveQuery.error.message : 'Could not load archived leave records.'}</p>}
    {isAdmin && (legacyArchiveQuery.data?.records.length ?? 0) > 0 && view === 'Requests' && <details className="mb-4 rounded-xl border border-slate-200 bg-white p-4"><summary className="cursor-pointer text-sm font-semibold">Read-only legacy archive ({legacyArchiveQuery.data?.records.length})</summary><p className="mt-2 text-xs text-slate-500">These records preserve browser history only. Original approvals are unverified and are excluded from leave balances and active requests.</p><div className="mt-3 max-h-64 overflow-auto"><table className="w-full min-w-[600px] text-left text-xs"><thead className="text-[10px] uppercase text-slate-400"><tr>{['Reference', 'Employee', 'Leave', 'Dates', 'Original status'].map((label) => <th key={label} className="px-2 py-2">{label}</th>)}</tr></thead><tbody>{legacyArchiveQuery.data?.records.map((record) => <tr key={record.id} className="border-t border-slate-100 text-slate-600"><td className="px-2 py-2">{record.reference || '—'}</td><td className="px-2 py-2">{record.employeeName} · {record.employeeNumber || 'Unlinked'}</td><td className="px-2 py-2">{record.leaveType === 'Other' ? record.otherLeaveType || 'Other' : record.leaveType}</td><td className="px-2 py-2">{formatDate(record.startDate)} – {formatDate(record.endDate)}</td><td className="px-2 py-2">{record.originalStatus} (unverified)</td></tr>)}</tbody></table></div></details>}

    {view === 'Requests' && <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 xl:flex-row xl:items-center xl:justify-between"><div><h3 className="text-sm font-bold">Leave requests</h3><p className="mt-1 text-xs text-slate-400">{rows.length} matching request{rows.length === 1 ? '' : 's'} · configured workdays</p></div><div className="flex flex-wrap gap-2"><label className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><Icons.Search className="size-4 shrink-0 text-slate-400" /><input aria-label="Search leave requests" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Employee, ID, or leave type" className="w-48 bg-transparent text-xs outline-none" /></label><select aria-label="Filter leave by department" value={department} onChange={(event) => setDepartment(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><option>All departments</option>{departments.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Filter leave by status" value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><option>All statuses</option>{['Pending', 'Approved', 'Rejected', 'Cancelled'].map((item) => <option key={item}>{item}</option>)}</select></div></div>
      {rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-xs"><thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-400"><tr>{['Employee', 'Leave type', 'Dates', 'Days', 'Handover', 'Status', ''].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{rows.map((request) => <tr key={request.id} className="border-t border-slate-100 text-slate-600 hover:bg-slate-50/70"><td className="px-4 py-3"><button type="button" onClick={() => onViewEmployee(request.employeeId)} className="font-semibold text-slate-800 hover:text-[#6d28d9]">{request.employeeName}</button><span className="mt-1 block text-[10px] text-slate-400">{request.employeeNumber} · {request.department}</span></td><td className="px-4 py-3">{request.leaveType === 'Other' ? request.otherLeaveType : request.leaveType}</td><td className="px-4 py-3">{formatDate(request.startDate)} – {formatDate(request.endDate)}</td><td className="px-4 py-3 font-semibold">{request.requestedDays}</td><td className="px-4 py-3">{request.handoverName}</td><td className="px-4 py-3"><span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${statusStyle(request.status)}`}>{request.status}</span></td><td className="px-4 py-3"><button type="button" onClick={() => setSelected(request)} className="font-semibold text-[#6d28d9] hover:underline">{request.status === 'Pending' ? 'Review' : 'Details'}</button></td></tr>)}</tbody></table></div> : <Empty title={requests.length ? 'No requests match these filters' : 'No leave requests yet'} detail={requests.length ? 'Adjust your search or filters.' : 'New submissions will appear here for review.'} />}
    </section>}

    {view === 'Team calendar' && <CalendarView requests={requests} month={month} setMonth={setMonth} departments={departments} />}
    {view === 'Balances' && isAdmin && <BalancesView balances={balancesQuery.data?.balances ?? []} isLoading={balancesQuery.isLoading} error={balancesQuery.error instanceof Error ? balancesQuery.error.message : ''} departments={departments} />}
    {view === 'Routing' && isAdmin && <RoutingView employees={peopleQuery.data?.employees ?? []} users={peopleQuery.data?.users ?? []} isLoading={peopleQuery.isLoading} error={peopleQuery.error instanceof Error ? peopleQuery.error.message : ''} saving={routingMutation.isPending} onRetry={() => peopleQuery.refetch()} onChange={updateRouting} />}
    {view === 'Policy' && isSuperAdmin && <PolicyView policy={policyQuery.data?.policy} isLoading={policyQuery.isLoading} onSave={async (policy) => { setMutationError(''); try { await policyMutation.mutateAsync(policy) } catch (error) { setMutationError(error instanceof Error ? error.message : 'Could not save leave policy.') } }} />}
    {showForm && <LeaveRequestForm employees={activeEmployees} requestEmployees={requestEmployees} requests={requests} policy={policyQuery.data?.policy} onClose={() => setShowForm(false)} onSave={saveRequest} />}
    {selected && <ReviewDialog request={selected} canManage={isAdmin} canReview={isAdmin || selected.approverUserId === currentUser.id} error={mutationError} onClose={() => setSelected(null)} onDecision={(decision, note) => updateRequest(selected, decision, note)} onCancel={(note) => updateSelectedRequest({ type: 'cancel', note })} onAmend={(input) => updateSelectedRequest({ type: 'amend', ...input })} onConfirmReturn={(actualDate) => updateSelectedRequest({ type: 'return', actualDate })} onDecideAmendment={decideAmendment} />}
  </div>
}

function LeaveRequestForm({ employees, requestEmployees, requests, policy, onClose, onSave }: { employees: Employee[]; requestEmployees: Employee[]; requests: LeaveRequest[]; policy?: LeavePolicy; onClose: () => void; onSave: (request: LeaveRequestInput) => void }) {
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
  const days = calculateWorkingDays(startDate, endDate, policy?.workingDays, policy?.holidays)
  const setHandover = (id: string) => {
    setHandoverEmployeeId(id)
    setHandoverContact(employees.find((item) => item.id === id)?.phone ?? '')
  }
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validation = validateLeaveRequest({ employee, handover, leaveType, otherLeaveType, reason, startDate, endDate, handoverContact }, requests, policy?.workingDays, policy?.holidays)
    if (validation) { setError(validation); return }
    if (!employee || !handover) return
    onSave({
      employeeId: employee.id,
      leaveType,
      otherLeaveType: leaveType === 'Other' ? otherLeaveType.trim() : undefined,
      reason: reason.trim(),
      startDate,
      endDate,
      handoverEmployeeId: handover.id,
      handoverContact: handoverContact.trim(),
    })
  }
  const label = 'block text-xs font-semibold text-slate-600'
  const input = 'mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100'
  return <Modal title="New leave request" subtitle="Employee details are populated from the employee record." onClose={onClose}>
    <form onSubmit={submit} className="space-y-5 p-5">
      <section><h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Employee details</h3><div className="grid gap-3 sm:grid-cols-2"><label className={`${label} sm:col-span-2`}>Employee<select required value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className={input}><option value="">Select an active employee</option>{requestEmployees.map((item) => <option key={item.id} value={item.id}>{employeeDisplayName(item)} · {item.number}</option>)}</select></label><ReadOnly label="Employee ID" value={employee?.number} /><ReadOnly label="Department" value={employee?.department} /><ReadOnly label="Position" value={employee?.role} /><ReadOnly label="Contact" value={employee?.phone} /></div></section>
      <section className="border-t border-slate-100 pt-4"><h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Leave details</h3><div className="grid gap-3 sm:grid-cols-2"><label className={label}>Type of leave<select value={leaveType} onChange={(event) => setLeaveType(event.target.value as LeaveType)} className={input}>{leaveTypes.map((type) => <option key={type}>{type}</option>)}</select></label>{leaveType === 'Other' && <label className={label}>Specify leave type<input required value={otherLeaveType} onChange={(event) => setOtherLeaveType(event.target.value)} className={input} /></label>}<label className={`${label} ${leaveType !== 'Other' ? 'sm:col-span-2' : ''}`}>Reason for leave<textarea required rows={2} value={reason} onChange={(event) => setReason(event.target.value)} className={input} /></label><label className={label}>Leave start<input required type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={input} /></label><label className={label}>Leave end<input required type="date" min={startDate || undefined} value={endDate} onChange={(event) => setEndDate(event.target.value)} className={input} /></label><div className="rounded-lg bg-slate-50 px-3 py-2.5"><div className="text-[10px] font-semibold uppercase text-slate-400">Working days requested</div><div className="mt-1 text-sm font-bold text-slate-800">{days || '—'}</div><div className="mt-0.5 text-[10px] text-slate-400">Uses the configured workdays and holiday calendar.</div></div></div></section>
      <section className="border-t border-slate-100 pt-4"><h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Work handover</h3><div className="grid gap-3 sm:grid-cols-2"><label className={label}>Hand over work to<select required value={handoverEmployeeId} onChange={(event) => setHandover(event.target.value)} className={input}><option value="">Select an active employee</option>{employees.filter((item) => item.id !== employeeId).map((item) => <option key={item.id} value={item.id}>{employeeDisplayName(item)} · {item.department}</option>)}</select></label><label className={label}>Handover contact<input required type="tel" value={handoverContact} onChange={(event) => setHandoverContact(event.target.value)} className={input} /></label></div><p className="mt-2 text-[10px] text-slate-400">Selecting a handover person does not grant system permissions. Temporary access is unavailable until protected business APIs can enforce and audit it.</p></section>
      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{error}</p>}
      <footer className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Cancel</button><button type="submit" className="rounded-lg bg-[#6d28d9] px-4 py-2 text-xs font-semibold text-white">Submit request</button></footer>
    </form>
  </Modal>
}

function ReviewDialog({ request, canManage, canReview, error, onClose, onDecision, onCancel, onAmend, onConfirmReturn, onDecideAmendment }: {
  request: LeaveRequest
  canManage: boolean
  canReview: boolean
  error: string
  onClose: () => void
  onDecision: (decision: 'Approved' | 'Rejected', note: string) => void
  onCancel: (note: string) => void
  onAmend: (input: { startDate: string; endDate: string; reason: string }) => void
  onConfirmReturn: (actualDate: string) => void
  onDecideAmendment: (amendmentId: string, decision: 'Approved' | 'Rejected', note: string) => void
}) {
  const [note, setNote] = useState('')
  const [cancelNote, setCancelNote] = useState('')
  const [amendStart, setAmendStart] = useState(request.startDate)
  const [amendEnd, setAmendEnd] = useState(request.endDate)
  const [amendReason, setAmendReason] = useState('')
  const [actualDate, setActualDate] = useState(today())
  const fields = [['Employee', `${request.employeeName} · ${request.employeeNumber}`], ['Department / position', `${request.department} · ${request.role}`], ['Employee contact', request.employeeContact || 'Not provided'], ['Leave type', request.leaveType === 'Other' ? request.otherLeaveType ?? 'Other' : request.leaveType], ['Dates', `${formatDate(request.startDate)} – ${formatDate(request.endDate)}`], ['Working days', String(request.requestedDays)], ['Handover', request.handoverName], ['Handover contact', request.handoverContact], ['Reason', request.reason]]
  return <Modal title={request.status === 'Pending' ? 'Review leave request' : 'Leave request details'} subtitle={`${request.reference} · Submitted ${formatDate(request.requestedAt.slice(0, 10))}`} onClose={onClose}>
    <div className="p-5"><dl className="grid gap-4 sm:grid-cols-2">{fields.map(([label, value]) => <div key={label}><dt className="text-[10px] font-medium uppercase text-slate-400">{label}</dt><dd className="mt-1 break-words text-xs font-semibold text-slate-800">{value}</dd></div>)}</dl>
      {request.decisions.length > 0 && <section className="mt-5 border-t border-slate-100 pt-4"><h3 className="text-xs font-bold">Decision history</h3><ol className="mt-2 space-y-2">{request.decisions.map((decision) => <li key={decision.id} className="text-xs text-slate-600">{decision.decision} · {decision.actor} · {new Date(decision.at).toLocaleString()}{decision.note ? ` · ${decision.note}` : ''}</li>)}</ol></section>}
      {request.returnConfirmation?.expectedDate && <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">Expected return: <strong>{formatDate(request.returnConfirmation.expectedDate)}</strong>{request.returnConfirmation.actualDate ? ` · Confirmed returned ${formatDate(request.returnConfirmation.actualDate)}` : ' · Return not yet confirmed'}</p>}
      {!!request.amendments?.length && <section className="mt-4 border-t border-slate-100 pt-4"><h3 className="text-xs font-bold">Amendment history</h3><ul className="mt-2 space-y-2">{request.amendments.map((amendment) => <li key={amendment.id} className="text-xs text-slate-600">{formatDate(amendment.startDate)} – {formatDate(amendment.endDate)} · {amendment.status} · {amendment.reason}{amendment.decisionNote ? ` · ${amendment.decisionNote}` : ''}</li>)}</ul></section>}
      {!!request.amendments?.some((amendment) => amendment.status === 'Pending') && canReview && <section className="mt-4 space-y-2 border-t border-slate-100 pt-4"><h3 className="text-xs font-bold">Review pending amendment</h3>{request.amendments.filter((amendment) => amendment.status === 'Pending').map((amendment) => <div key={amendment.id} className="rounded-lg bg-slate-50 p-3 text-xs"><p>{formatDate(amendment.startDate)} – {formatDate(amendment.endDate)} · {amendment.requestedDays} working days</p><p className="mt-1 text-slate-500">{amendment.reason}</p><div className="mt-2 flex justify-end gap-2"><button type="button" onClick={() => onDecideAmendment(amendment.id, 'Rejected', note)} className="rounded border border-rose-200 px-2 py-1 font-semibold text-rose-700">Reject</button><button type="button" onClick={() => onDecideAmendment(amendment.id, 'Approved', note)} className="rounded bg-emerald-700 px-2 py-1 font-semibold text-white">Approve</button></div></div>)}</section>}
      {request.status === 'Pending' && canReview && <div className="mt-5"><label className="block text-xs font-semibold text-slate-600">Decision note<textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label><div className="mt-4 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => onDecision('Rejected', note)} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700">Reject</button><button type="button" onClick={() => onDecision('Approved', note)} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white">Approve</button></div></div>}
      {canManage && ['Pending', 'Approved'].includes(request.status) && <div className="mt-5 space-y-4 border-t border-slate-100 pt-4">
        <label className="block text-xs font-semibold text-slate-600">Cancellation reason<textarea required rows={2} value={cancelNote} onChange={(event) => setCancelNote(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
        <button type="button" disabled={!cancelNote.trim()} onClick={() => onCancel(cancelNote)} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50">Cancel request (HR/Admin)</button>
        {request.status === 'Approved' && <><fieldset className="grid gap-3 sm:grid-cols-2"><legend className="text-xs font-semibold text-slate-700">Request an approved-leave date change</legend><label className="text-xs">New start<input type="date" value={amendStart} onChange={(event) => setAmendStart(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2" /></label><label className="text-xs">New end<input type="date" min={amendStart} value={amendEnd} onChange={(event) => setAmendEnd(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2" /></label><label className="text-xs sm:col-span-2">Reason<input value={amendReason} onChange={(event) => setAmendReason(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2" /></label></fieldset><button type="button" disabled={!amendReason.trim() || amendStart > amendEnd} onClick={() => onAmend({ startDate: amendStart, endDate: amendEnd, reason: amendReason })} className="rounded-lg border border-violet-200 px-3 py-2 text-xs font-semibold text-violet-700 disabled:opacity-50">Submit date amendment for review</button></>}
      </div>}
      {request.status === 'Approved' && canReview && !request.returnConfirmation?.actualDate && <div className="mt-5 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4"><label className="text-xs font-semibold text-slate-600">Actual return date<input type="date" value={actualDate} onChange={(event) => setActualDate(event.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2" /></label><button type="button" onClick={() => onConfirmReturn(actualDate)} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white">Confirm return</button></div>}
      {error && <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</p>}
      <div className="mt-5 flex justify-end"><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold">Close</button></div>
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

type LeaveBalanceRecord = {
  employeeId: string
  employeeName: string
  employeeNumber: string
  department: string
  leaveYear: { start: string; end: string }
  byType: Record<string, { configured: boolean; entitlement: number | null; carryover: number; used: number; pending: number; available: number | null }>
}

function BalancesView({ balances, isLoading, error, departments }: { balances: LeaveBalanceRecord[]; isLoading: boolean; error: string; departments: string[] }) {
  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('All departments')
  const [leaveType, setLeaveType] = useState<LeaveType>('Annual')
  const rows = balances.filter((entry) => `${entry.employeeName} ${entry.employeeNumber} ${entry.department}`.toLowerCase().includes(search.trim().toLowerCase()) && (department === 'All departments' || entry.department === department))
  return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-sm font-bold">Leave balances</h3><p className="mt-1 text-xs text-slate-500">{leaveType} entitlement and usage for {rows[0]?.leaveYear.start ?? 'the current leave year'} – {rows[0]?.leaveYear.end ?? '—'}.</p></div><div className="flex flex-wrap gap-2"><label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><Icons.Search className="size-4 text-slate-400" /><input aria-label="Search leave balances" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Employee or ID" className="w-40 bg-transparent text-xs outline-none" /></label><select aria-label="Filter leave balances by department" value={department} onChange={(event) => setDepartment(event.target.value)} className="rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs"><option>All departments</option>{departments.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Leave type for balances" value={leaveType} onChange={(event) => setLeaveType(event.target.value as LeaveType)} className="rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs">{leaveTypes.map((type) => <option key={type}>{type}</option>)}</select></div></div>{error && <p role="alert" className="p-4 text-xs text-rose-700">{error}</p>}{isLoading && <p role="status" className="p-4 text-xs text-slate-500">Loading leave balances…</p>}<div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-xs"><thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-400"><tr>{['Employee', 'Department', 'Entitlement', 'Carryover', 'Approved days used', 'Pending days', 'Available'].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{rows.map((entry) => { const balance = entry.byType[leaveType]; return <tr key={entry.employeeId} className="border-t border-slate-100 text-slate-600"><td className="px-4 py-3 font-semibold text-slate-800">{entry.employeeName}<span className="mt-1 block text-[10px] text-slate-400">{entry.employeeNumber}</span></td><td className="px-4 py-3">{entry.department}</td><td className="px-4 py-3">{balance?.configured ? balance.entitlement : 'Not configured'}</td><td className="px-4 py-3">{balance?.carryover ?? 0}</td><td className="px-4 py-3">{balance?.used ?? 0}</td><td className="px-4 py-3">{balance?.pending ?? 0}</td><td className="px-4 py-3">{balance?.available ?? '—'}</td></tr> })}</tbody></table>{!rows.length && !isLoading && <p className="px-5 py-10 text-center text-xs text-slate-400">No employees match these filters.</p>}</div></section>
}

function RoutingView({ employees, users, isLoading, error, saving, onRetry, onChange }: {
  employees: LeaveRoutingEmployee[]
  users: LeaveRoutingUser[]
  isLoading: boolean
  error: string
  saving: boolean
  onRetry: () => void
  onChange: (employeeId: string, field: 'userId' | 'supervisorUserId', value: string | null) => void
}) {
  const selectClass = 'w-full min-w-52 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs disabled:opacity-50'
  return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
    <div className="border-b border-slate-100 p-4">
      <h3 className="text-sm font-bold">Employee account and approver routing</h3>
      <p className="mt-1 max-w-3xl text-xs text-slate-500">Link employee records to login accounts so employees can submit their own requests, then select an incharge to review them. HR remains the fallback when no incharge is assigned. This does not grant handover access.</p>
    </div>
    {error && <p role="alert" className="m-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">{error}<button type="button" onClick={onRetry} className="ml-3 font-semibold underline">Retry</button></p>}
    {isLoading ? <p role="status" className="p-5 text-xs text-slate-500">Loading employees and accounts…</p>
      : employees.length ? <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-xs"><thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-400"><tr><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Login account</th><th className="px-4 py-3">Leave incharge</th></tr></thead><tbody>{employees.map((employee) => <tr key={employee.id} className="border-t border-slate-100"><td className="px-4 py-3"><span className="font-semibold text-slate-800">{employee.name || 'Unnamed employee'}</span><span className="mt-1 block text-[10px] text-slate-400">{employee.number} · {employee.department} · {employee.role}</span></td><td className="px-4 py-3"><select aria-label={`Login account for ${employee.name}`} className={selectClass} value={employee.userId ?? ''} disabled={saving} onChange={(event) => onChange(employee.id, 'userId', event.target.value || null)}><option value="">No linked account</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name} · {user.email} ({user.roles.join(', ')})</option>)}</select></td><td className="px-4 py-3"><select aria-label={`Leave incharge for ${employee.name}`} className={selectClass} value={employee.supervisorUserId ?? ''} disabled={saving} onChange={(event) => onChange(employee.id, 'supervisorUserId', event.target.value || null)}><option value="">HR fallback</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name} · {user.email} ({user.roles.join(', ')})</option>)}</select></td></tr>)}</tbody></table></div> : <Empty title="No active employees" detail="Active employee records will appear here for account and approver assignment." />}
  </section>
}

function PolicyView({ policy, isLoading, onSave }: { policy?: LeavePolicy; isLoading: boolean; onSave: (policy: Partial<LeavePolicy>) => void }) {
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5, 6])
  const [holidays, setHolidays] = useState('')
  const [leaveYearStart, setLeaveYearStart] = useState('01-01')
  const [entitlements, setEntitlements] = useState<Record<LeaveType, string>>({
    Annual: '', Sick: '', 'Maternity/Paternity': '', Compassionate: '', Other: '',
  })
  const [carryoverEnabled, setCarryoverEnabled] = useState(false)
  const [carryoverLimit, setCarryoverLimit] = useState('0')
  const [pendingDays, setPendingDays] = useState('2')
  const [beforeStartDays, setBeforeStartDays] = useState('7, 1')
  const [onStartDate, setOnStartDate] = useState(true)
  const [returnFollowUp, setReturnFollowUp] = useState(true)
  useEffect(() => {
    if (!policy) return
    setWorkingDays(policy.workingDays)
    setHolidays(policy.holidays.join('\n'))
    setLeaveYearStart(policy.leaveYearStart)
    setEntitlements(Object.fromEntries(leaveTypes.map((type) => [type, policy.entitlements[type] === undefined ? '' : String(policy.entitlements[type])])) as Record<LeaveType, string>)
    setCarryoverEnabled(policy.carryoverEnabled)
    setCarryoverLimit(String(policy.carryoverLimit))
    setPendingDays(String(policy.reminderThresholds.pendingApprovalBusinessDays))
    setBeforeStartDays(policy.reminderThresholds.beforeStartDays.join(', '))
    setOnStartDate(policy.reminderThresholds.onStartDate)
    setReturnFollowUp(policy.reminderThresholds.returnFollowUp)
  }, [policy])
  const toggleDay = (day: number) => setWorkingDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day].sort())
  const setEntitlement = (type: LeaveType, value: string) => setEntitlements((current) => ({ ...current, [type]: value }))
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsedHolidays = holidays.split(/\r?\n/).map((value) => value.trim()).filter(Boolean)
    const parsedBeforeDays = beforeStartDays.split(',').map((value) => Number(value.trim()))
    onSave({
      workingDays,
      holidays: parsedHolidays,
      leaveYearStart,
      entitlements: Object.fromEntries(leaveTypes.filter((type) => entitlements[type] !== '').map((type) => [type, Number(entitlements[type])])) as Partial<Record<LeaveType, number>>,
      carryoverEnabled,
      carryoverLimit: carryoverEnabled ? Number(carryoverLimit) : 0,
      reminderThresholds: {
        pendingApprovalBusinessDays: Number(pendingDays),
        beforeStartDays: parsedBeforeDays,
        onStartDate,
        returnFollowUp,
      },
    })
  }
  const dayLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return <section className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="text-sm font-bold">Leave policies and future reminder thresholds</h3><p className="mt-1 text-xs text-slate-500">Only Super Admin can save policy. Reminders are calculated for a future notification workflow; nothing is sent.</p>{isLoading ? <p role="status" className="mt-4 text-xs text-slate-500">Loading policy…</p> : <form onSubmit={submit} className="mt-5 space-y-5"><fieldset><legend className="text-xs font-semibold">Working days</legend><div className="mt-2 flex flex-wrap gap-3">{dayLabels.map((label, index) => <label key={label} className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={workingDays.includes(index)} onChange={() => toggleDay(index)} />{label}</label>)}</div></fieldset><label className="block text-xs font-semibold">Holiday dates<textarea rows={4} value={holidays} onChange={(event) => setHolidays(event.target.value)} placeholder="One YYYY-MM-DD date per line" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" /></label><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold">Leave year starts (MM-DD)<input required pattern="(0[1-9]|1[0-2])-(0[1-9]|1[2][0-9]|3[01])" value={leaveYearStart} onChange={(event) => setLeaveYearStart(event.target.value)} className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" /></label>{leaveTypes.map((type) => <label key={type} className="text-xs font-semibold">{type} entitlement (days)<input type="number" min={0} max={366} value={entitlements[type]} onChange={(event) => setEntitlement(type, event.target.value)} placeholder="Not configured" className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" /></label>)}</div><div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={carryoverEnabled} onChange={(event) => setCarryoverEnabled(event.target.checked)} />Allow carryover</label>{carryoverEnabled && <label className="text-xs">Carryover limit<input type="number" min={0} max={366} value={carryoverLimit} onChange={(event) => setCarryoverLimit(event.target.value)} className="ml-2 w-20 rounded border border-slate-200 px-2 py-1" /></label>}</div><fieldset className="space-y-3 border-t border-slate-100 pt-4"><legend className="text-xs font-semibold">Reminder thresholds (not delivered)</legend><label className="block text-xs">Pending approval reminder after<input type="number" min={1} max={60} value={pendingDays} onChange={(event) => setPendingDays(event.target.value)} className="mx-2 w-16 rounded border border-slate-200 px-2 py-1" />business days</label><label className="block text-xs">Approved leave reminders (days before; comma-separated)<input value={beforeStartDays} onChange={(event) => setBeforeStartDays(event.target.value)} className="mt-1.5 block w-full rounded border border-slate-200 px-2 py-2" /></label><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={onStartDate} onChange={(event) => setOnStartDate(event.target.checked)} />Include leave start date</label><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={returnFollowUp} onChange={(event) => setReturnFollowUp(event.target.checked)} />Follow up on expected return date</label></fieldset><button type="submit" disabled={!workingDays.length} className="rounded-lg bg-[#6d28d9] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">Save policy</button></form>}</section>
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
