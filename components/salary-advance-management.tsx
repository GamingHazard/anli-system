'use client'

import { useMemo, useState } from 'react'
import * as Icons from 'lucide-react'
import { createId, employeeDisplayName, exportCsv, formatDate, money, type AdvanceActivity, type AdvanceRepaymentFrequency, type AdvanceRepaymentMethod, type ErpState, type SalaryAdvance } from '@/lib/erp'
import { decideSalaryAdvance } from '@/lib/approvals'

type Props = { state: ErpState; updateState: (next: ErpState) => void; initialAdvanceId?: string | null; onViewEmployee: (id: string) => void }
type View = 'Requests' | 'Active advances' | 'Repayment history' | 'All records'
type Dialog = 'request' | 'review' | 'disbursement' | 'repayment' | null

const views: View[] = ['Requests', 'Active advances', 'Repayment history', 'All records']
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const activity = (action: string, note?: string): AdvanceActivity => ({ id: createId('AACT'), action, actor: 'Sarah Namirembe', at: new Date().toISOString(), note })
const repaidAmount = (advance: SalaryAdvance) => advance.repayments.reduce((total, item) => total + item.amount, 0)
const balance = (advance: SalaryAdvance) => Math.max(0, (advance.disbursement?.amount ?? 0) - repaidAmount(advance))

function statusTone(status: string) {
  if (status === 'Active') return 'bg-sky-50 text-sky-700'
  if (status === 'Settled' || status === 'Approved') return 'bg-emerald-50 text-emerald-700'
  if (status === 'Pending review') return 'bg-amber-50 text-amber-700'
  if (status === 'Rejected') return 'bg-rose-50 text-rose-700'
  return 'bg-slate-100 text-slate-600'
}

function addInstallments(firstDueDate: string, frequency: AdvanceRepaymentFrequency, installment: number, amount: number) {
  const schedule: SalaryAdvance['schedule'] = []
  if (!firstDueDate || installment <= 0 || amount <= 0) return schedule
  let remaining = amount
  let dueDate = firstDueDate
  while (remaining > 0 && schedule.length < 120) {
    const plannedAmount = Math.min(installment, remaining)
    schedule.push({ id: createId('ASCH'), dueDate, plannedAmount })
    remaining -= plannedAmount
    const next = new Date(`${dueDate}T12:00:00.000Z`)
    next.setUTCDate(next.getUTCDate() + (frequency === 'Weekly' ? 7 : 1))
    if (frequency === 'Monthly') next.setUTCMonth(next.getUTCMonth() + 1)
    dueDate = next.toISOString().slice(0, 10)
  }
  return schedule
}

export default function SalaryAdvanceManagement({ state, updateState, initialAdvanceId = null, onViewEmployee }: Props) {
  const [view, setView] = useState<View>('Requests')
  const [selectedId, setSelectedId] = useState<string | null>(initialAdvanceId)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All statuses')
  const [frequencyFilter, setFrequencyFilter] = useState('All frequencies')
  const [error, setError] = useState('')
  const selected = state.salaryAdvances.find((advance) => advance.id === selectedId) ?? null
  const activeAdvances = state.salaryAdvances.filter((advance) => advance.status === 'Active')
  const pending = state.salaryAdvances.filter((advance) => advance.status === 'Pending review')
  const approved = state.salaryAdvances.filter((advance) => advance.status === 'Approved')
  const totalOutstanding = activeAdvances.reduce((total, advance) => total + balance(advance), 0)
  const repayments = state.salaryAdvances.flatMap((advance) => advance.repayments.map((repayment) => ({ advance, repayment }))).sort((left, right) => right.repayment.date.localeCompare(left.repayment.date) || right.repayment.recordedAt.localeCompare(left.repayment.recordedAt))
  const rows = useMemo(() => {
    let records = view === 'Requests' ? state.salaryAdvances.filter((advance) => ['Pending review', 'Approved', 'Rejected'].includes(advance.status))
      : view === 'Active advances' ? activeAdvances
        : state.salaryAdvances
    if (view === 'Repayment history') records = records.filter((advance) => advance.repayments.length > 0)
    return records.filter((advance) => {
      const haystack = `${advance.reference} ${advance.employeeName} ${advance.employeeNumber} ${advance.department} ${advance.reason}`.toLowerCase()
      return haystack.includes(search.trim().toLowerCase())
        && (statusFilter === 'All statuses' || advance.status === statusFilter)
        && (frequencyFilter === 'All frequencies' || (advance.approvedFrequency ?? advance.proposedFrequency) === frequencyFilter)
    }).sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  }, [view, state.salaryAdvances, activeAdvances, search, statusFilter, frequencyFilter])

  const saveAdvance = (advance: SalaryAdvance) => updateState({ ...state, salaryAdvances: [advance, ...state.salaryAdvances] })
  const updateAdvance = (advanceId: string, transform: (advance: SalaryAdvance) => SalaryAdvance) => {
    updateState({ ...state, salaryAdvances: state.salaryAdvances.map((advance) => advance.id === advanceId ? transform(advance) : advance) })
  }

  const createRequest = (form: FormData) => {
    const employee = state.employees.find((item) => item.id === String(form.get('employeeId') || ''))
    const requestedAmount = Number(form.get('requestedAmount'))
    const installment = Number(form.get('installmentAmount'))
    const firstDueDate = String(form.get('firstDueDate') || '')
    if (!employee || !Number.isFinite(requestedAmount) || requestedAmount <= 0 || !Number.isFinite(installment) || installment <= 0 || installment > requestedAmount || !firstDueDate) {
      setError('Select an employee and enter a valid requested amount, installment, and first due date.')
      return
    }
    const now = new Date().toISOString()
    const frequency = form.get('frequency') === 'Weekly' ? 'Weekly' : 'Monthly'
    const record: SalaryAdvance = {
      id: createId('ADV'), reference: createId('ADV'), employeeId: employee.id, employeeNumber: employee.number,
      employeeName: employeeDisplayName(employee), department: employee.department, role: employee.role, category: employee.category,
      paymentFrequency: employee.paymentFrequency, requestedAmount, reason: String(form.get('reason') || '').trim(), requestedAt: now,
      proposedFrequency: frequency, proposedInstallmentAmount: installment, proposedFirstDueDate: firstDueDate,
      status: 'Pending review', schedule: [], repayments: [], activity: [activity('Request submitted')], createdAt: now, updatedAt: now,
    }
    saveAdvance(record)
    setSelectedId(record.id)
    setDialog(null)
    setError('')
  }

  const reviewRequest = (form: FormData) => {
    if (!selected || selected.status !== 'Pending review') return
    const decision = String(form.get('decision'))
    if (decision === 'Rejected') {
      const rejectionReason = String(form.get('rejectionReason') || '').trim()
      if (!rejectionReason) { setError('A rejection reason is required.'); return }
      updateAdvance(selected.id, (advance) => decideSalaryAdvance(advance, 'Rejected', 'Sarah Namirembe', rejectionReason))
    } else {
      const approvedAmount = Number(form.get('approvedAmount'))
      const installment = Number(form.get('installmentAmount'))
      const frequency: AdvanceRepaymentFrequency = form.get('frequency') === 'Weekly' ? 'Weekly' : 'Monthly'
      const firstDueDate = String(form.get('firstDueDate') || '')
      if (!Number.isFinite(approvedAmount) || approvedAmount <= 0 || approvedAmount > selected.requestedAmount || !Number.isFinite(installment) || installment <= 0 || installment > approvedAmount || !firstDueDate) {
        setError('Approved amount must be positive and no greater than requested; enter valid repayment terms.')
        return
      }
      updateAdvance(selected.id, (advance) => decideSalaryAdvance(advance, 'Approved', 'Sarah Namirembe', `Approved ${money(approvedAmount)} with ${frequency.toLowerCase()} reminders.`, { amount: approvedAmount, frequency, installment, firstDueDate }))
    }
    setDialog(null)
    setError('')
  }

  const recordDisbursement = (form: FormData) => {
    if (!selected || selected.status !== 'Approved' || !selected.approvedAmount) return
    const amount = Number(form.get('amount'))
    const date = String(form.get('date') || '')
    const method = String(form.get('method') || 'Cash') as Exclude<AdvanceRepaymentMethod, 'Payroll'>
    if (!Number.isFinite(amount) || amount <= 0 || amount > selected.approvedAmount || !date) { setError('Enter a positive disbursement no greater than the approved amount and select a date.'); return }
    const now = new Date().toISOString()
    updateAdvance(selected.id, (advance) => ({ ...advance, status: 'Active', disbursement: { amount, date, method, reference: String(form.get('reference') || '').trim() || undefined, recordedAt: now }, schedule: addInstallments(advance.firstDueDate ?? '', advance.approvedFrequency ?? 'Monthly', advance.approvedInstallmentAmount ?? amount, amount), activity: [...advance.activity, activity('Advance disbursed', `${money(amount)} via ${method}.`)], updatedAt: now }))
    setDialog(null)
    setError('')
  }

  const recordRepayment = (form: FormData) => {
    if (!selected || selected.status !== 'Active') return
    const amount = Number(form.get('amount'))
    const date = String(form.get('date') || '')
    const method = String(form.get('method') || 'Cash') as AdvanceRepaymentMethod
    const remaining = balance(selected)
    if (!Number.isFinite(amount) || amount <= 0 || amount > remaining || !date) { setError(`Enter a repayment greater than zero and no more than ${money(remaining)}.`); return }
    const now = new Date().toISOString()
    const repayment = { id: createId('AREP'), date, amount, method, reference: String(form.get('reference') || '').trim() || undefined, note: String(form.get('note') || '').trim() || undefined, recordedAt: now }
    const nextPaid = repaidAmount(selected) + amount
    updateAdvance(selected.id, (advance) => ({ ...advance, status: nextPaid >= (advance.disbursement?.amount ?? 0) ? 'Settled' : 'Active', repayments: [...advance.repayments, repayment], activity: [...advance.activity, activity('Repayment recorded', `${money(amount)} via ${method}.`)], updatedAt: now }))
    setDialog(null)
    setError('')
  }

  const openDialog = (next: Dialog) => { setError(''); setDialog(next) }
  const exportRecords = () => exportCsv('salary-advances.csv', rows.map((advance) => ({
    reference: advance.reference, employeeNumber: advance.employeeNumber, employeeName: advance.employeeName,
    department: advance.department, requestedAmount: advance.requestedAmount, approvedAmount: advance.approvedAmount ?? '',
    disbursedAmount: advance.disbursement?.amount ?? '', repaidAmount: repaidAmount(advance), outstandingBalance: balance(advance),
    repaymentFrequency: advance.approvedFrequency ?? advance.proposedFrequency, status: advance.status, reason: advance.reason,
  })))

  if (selected) return <>{<AdvanceDetails advance={selected} onBack={() => setSelectedId(null)} onViewEmployee={onViewEmployee} onAction={openDialog} onExport={() => exportCsv(`${selected.reference.toLowerCase()}-repayments.csv`, selected.repayments.map((repayment) => ({ advance: selected.reference, employee: selected.employeeName, date: repayment.date, amount: repayment.amount, method: repayment.method, reference: repayment.reference ?? '', note: repayment.note ?? '' })))} />}{dialog && <AdvanceDialog mode={dialog} state={state} advance={selected} error={error} onClose={() => { setDialog(null); setError('') }} onSubmit={dialog === 'request' ? createRequest : dialog === 'review' ? reviewRequest : dialog === 'disbursement' ? recordDisbursement : recordRepayment} />}</>

  return <div className="animate-in fade-in duration-300">
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="mb-2 text-xs font-medium text-slate-400">Workspace / HR Department</div><h2 className="text-2xl font-bold tracking-tight">Salary Advance Management</h2><p className="mt-1 max-w-2xl text-sm text-slate-500">Review requests, record disbursements, and track repayments against employee advances.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={exportRecords} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"><Icons.Download className="size-4" /> Export CSV</button><button type="button" onClick={() => openDialog('request')} className="inline-flex items-center gap-2 rounded-lg bg-[#6d28d9] px-3 py-2.5 text-xs font-semibold text-white hover:bg-[#5b21b6]"><Icons.Plus className="size-4" /> New advance request</button></div></div>

    <section aria-label="Salary advance summary" className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><AdvanceMetric label="Awaiting review" value={pending.length} detail="Requests needing a decision" icon="ClipboardList" tone="amber" /><AdvanceMetric label="Approved, not disbursed" value={approved.length} detail="Approved advances awaiting payout" icon="BadgeCheck" tone="green" /><AdvanceMetric label="Active advances" value={activeAdvances.length} detail="Currently being repaid" icon="HandCoins" tone="blue" /><AdvanceMetric label="Outstanding balance" value={money(totalOutstanding)} detail="Disbursed less recorded repayments" icon="WalletCards" tone="slate" /></section>

    <div role="tablist" aria-label="Salary advance records" className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">{views.map((item) => { const count = item === 'Requests' ? pending.length + approved.length : item === 'Active advances' ? activeAdvances.length : item === 'Repayment history' ? repayments.length : state.salaryAdvances.length; return <button key={item} type="button" role="tab" aria-selected={view === item} onClick={() => setView(item)} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-xs font-semibold ${view === item ? 'border-[#6d28d9] text-[#6d28d9]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{item}<span className={`rounded-full px-1.5 py-0.5 text-[10px] ${view === item ? 'bg-[#f1eafd] text-[#6d28d9]' : 'bg-slate-100 text-slate-500'}`}>{count}</span></button> })}</div>

    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 xl:flex-row xl:items-center xl:justify-between"><div><h3 className="text-sm font-bold">{view}</h3><p className="mt-1 text-xs text-slate-400">{view === 'Repayment history' ? `${repayments.length} recorded repayments · schedules are reminders only` : `${rows.length} matching advance${rows.length === 1 ? '' : 's'}`}</p></div><div className="flex flex-wrap gap-2"><label className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><Icons.Search className="size-4 shrink-0 text-slate-400" /><input aria-label="Search salary advances" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Employee, reference, reason" className="w-44 bg-transparent text-xs outline-none" /></label><select aria-label="Filter salary advances by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><option>All statuses</option>{['Pending review', 'Approved', 'Rejected', 'Active', 'Settled'].map((status) => <option key={status}>{status}</option>)}</select><select aria-label="Filter salary advances by frequency" value={frequencyFilter} onChange={(event) => setFrequencyFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><option>All frequencies</option><option>Weekly</option><option>Monthly</option></select></div></div>
      {view === 'Repayment history' ? repayments.filter(({ advance, repayment }) => `${advance.reference} ${advance.employeeName} ${repayment.reference ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()) && (frequencyFilter === 'All frequencies' || (advance.approvedFrequency ?? advance.proposedFrequency) === frequencyFilter) && (statusFilter === 'All statuses' || advance.status === statusFilter)).length ? <div className="overflow-x-auto"><table className="w-full min-w-180 text-left text-xs"><thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-400"><tr>{['Advance', 'Employee', 'Date', 'Amount', 'Method', 'Reference', ''].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{repayments.filter(({ advance, repayment }) => `${advance.reference} ${advance.employeeName} ${repayment.reference ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()) && (frequencyFilter === 'All frequencies' || (advance.approvedFrequency ?? advance.proposedFrequency) === frequencyFilter) && (statusFilter === 'All statuses' || advance.status === statusFilter)).map(({ advance, repayment }) => <tr key={repayment.id} className="border-t border-slate-100 text-slate-600"><td className="px-4 py-3 font-semibold text-slate-800">{advance.reference}</td><td className="px-4 py-3">{advance.employeeName}<span className="mt-1 block text-[10px] text-slate-400">{advance.employeeNumber}</span></td><td className="px-4 py-3">{formatDate(repayment.date)}</td><td className="px-4 py-3 font-semibold text-emerald-700">{money(repayment.amount)}</td><td className="px-4 py-3">{repayment.method}</td><td className="px-4 py-3">{repayment.reference || '—'}</td><td className="px-4 py-3"><button type="button" onClick={() => setSelectedId(advance.id)} className="font-semibold text-[#6d28d9] hover:underline">Details</button></td></tr>)}</tbody></table></div> : <EmptyState title="No repayments recorded" detail="Saved repayments will appear here with their date, amount, and source." /> : rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-250 text-left text-xs"><thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-400"><tr>{['Advance / employee', 'Requested', 'Approved', 'Repayment terms', 'Repaid', 'Balance', 'Next due', 'Status', ''].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{rows.map((advance) => <tr key={advance.id} className="border-t border-slate-100 text-slate-600 hover:bg-slate-50/70"><td className="px-4 py-3"><button type="button" onClick={() => setSelectedId(advance.id)} className="text-left font-semibold text-slate-800 hover:text-[#6d28d9] hover:underline">{advance.employeeName}<span className="mt-1 block font-mono text-[10px] font-normal text-slate-400">{advance.reference} · {advance.employeeNumber}</span></button></td><td className="px-4 py-3">{money(advance.requestedAmount)}<span className="mt-1 block text-[10px] text-slate-400">{formatDate(advance.requestedAt.slice(0, 10))}</span></td><td className="px-4 py-3">{advance.approvedAmount ? money(advance.approvedAmount) : '—'}<span className="mt-1 block text-[10px] text-slate-400">Disbursed {advance.disbursement ? money(advance.disbursement.amount) : 'No'}</span></td><td className="px-4 py-3">{advance.approvedFrequency ?? advance.proposedFrequency}<span className="mt-1 block text-[10px] text-slate-400">{money(advance.approvedInstallmentAmount ?? advance.proposedInstallmentAmount)} per installment</span></td><td className="px-4 py-3">{money(repaidAmount(advance))}</td><td className="px-4 py-3 font-semibold">{advance.disbursement ? money(balance(advance)) : '—'}</td><td className="px-4 py-3">{advance.schedule.find((entry) => entry.dueDate >= today()) ? formatDate(advance.schedule.find((entry) => entry.dueDate >= today())!.dueDate) : '—'}</td><td className="px-4 py-3"><span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${statusTone(advance.status)}`}>{advance.status}</span></td><td className="px-4 py-3"><button type="button" onClick={() => setSelectedId(advance.id)} aria-label={`View ${advance.reference} details`} className="grid size-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100"><Icons.ChevronRight className="size-4" /></button></td></tr>)}</tbody></table></div> : <EmptyState title={state.salaryAdvances.length ? 'No advances match these filters' : 'No salary advances yet'} detail={state.salaryAdvances.length ? 'Adjust the search or filters to see advance records.' : 'Create a request to begin the review and disbursement workflow.'} />}
      <footer className="border-t border-slate-100 px-4 py-3 text-[10px] text-slate-400">Outstanding balance includes disbursed funds only. Schedule entries are reminders, not repayments.</footer>
    </section>
    {dialog && <AdvanceDialog mode={dialog} state={state} advance={selected} error={error} onClose={() => { setDialog(null); setError('') }} onSubmit={dialog === 'request' ? createRequest : dialog === 'review' ? reviewRequest : dialog === 'disbursement' ? recordDisbursement : recordRepayment} />}
  </div>
}

function AdvanceDetails({ advance, onBack, onViewEmployee, onAction, onExport }: { advance: SalaryAdvance; onBack: () => void; onViewEmployee: (id: string) => void; onAction: (dialog: Dialog) => void; onExport: () => void }) {
  const currentBalance = balance(advance)
  const progress = advance.disbursement?.amount ? Math.min(100, (repaidAmount(advance) / advance.disbursement.amount) * 100) : 0
  const nextDue = advance.schedule.find((entry) => entry.dueDate >= today())
  return <div className="animate-in fade-in duration-200">
    <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-[#6d28d9] hover:underline"><Icons.ArrowLeft className="size-4" /> Back to advances</button>
    <header className="mb-5 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 lg:flex-row lg:items-center"><div className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#f1eafd] text-[#6d28d9]"><Icons.HandCoins className="size-5" /></div><div className="min-w-0 flex-1"><div className="text-xs text-slate-400">Salary advance · {advance.reference}</div><h2 className="mt-1 text-xl font-bold text-slate-900">{advance.employeeName}</h2><div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500"><span>{advance.employeeNumber}</span><span>·</span><span>{advance.department}</span><span>·</span><span>{advance.role}</span><span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${statusTone(advance.status)}`}>{advance.status}</span></div></div><div className="flex flex-wrap gap-2"><button type="button" onClick={onExport} disabled={!advance.repayments.length} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"><Icons.Download className="size-4" /> Repayments CSV</button><button type="button" onClick={() => onViewEmployee(advance.employeeId)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Icons.UserRound className="size-4" /> Employee profile</button>{advance.status === 'Pending review' && <button type="button" onClick={() => onAction('review')} className="inline-flex items-center gap-2 rounded-lg bg-[#6d28d9] px-3 py-2 text-xs font-semibold text-white hover:bg-[#5b21b6]"><Icons.ClipboardCheck className="size-4" /> Review request</button>}{advance.status === 'Approved' && <button type="button" onClick={() => onAction('disbursement')} className="inline-flex items-center gap-2 rounded-lg bg-[#6d28d9] px-3 py-2 text-xs font-semibold text-white hover:bg-[#5b21b6]"><Icons.Banknote className="size-4" /> Record disbursement</button>}{advance.status === 'Active' && <button type="button" onClick={() => onAction('repayment')} className="inline-flex items-center gap-2 rounded-lg bg-[#6d28d9] px-3 py-2 text-xs font-semibold text-white hover:bg-[#5b21b6]"><Icons.CircleDollarSign className="size-4" /> Record repayment</button>}</div></header>

    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><AdvanceMetric label="Requested" value={money(advance.requestedAmount)} detail={`Submitted ${formatDate(advance.requestedAt.slice(0, 10))}`} icon="FilePlus2" tone="slate" /><AdvanceMetric label="Approved" value={advance.approvedAmount ? money(advance.approvedAmount) : '—'} detail="Approved amount; not necessarily disbursed" icon="BadgeCheck" tone="green" /><AdvanceMetric label="Disbursed" value={advance.disbursement ? money(advance.disbursement.amount) : '—'} detail={advance.disbursement ? formatDate(advance.disbursement.date) : 'No disbursement recorded'} icon="Banknote" tone="blue" /><AdvanceMetric label="Outstanding" value={advance.disbursement ? money(currentBalance) : '—'} detail="Disbursed amount less actual repayments" icon="WalletCards" tone={currentBalance ? 'amber' : 'green'} /></div>

    <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-4">
        <section className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="text-sm font-bold">Request details</h3><div className="mt-4 grid gap-4 sm:grid-cols-2"><AdvanceField label="Employee category" value={advance.category} /><AdvanceField label="Employee pay frequency" value={advance.paymentFrequency ?? 'Not configured'} /><AdvanceField label="Requested amount" value={money(advance.requestedAmount)} /><AdvanceField label="Reason" value={advance.reason} wide /><AdvanceField label="Proposed repayments" value={`${money(advance.proposedInstallmentAmount)} ${advance.proposedFrequency.toLowerCase()}`} /><AdvanceField label="Proposed first due date" value={formatDate(advance.proposedFirstDueDate)} /></div>{advance.status === 'Rejected' && <div className="mt-4 rounded-lg border border-rose-100 bg-rose-50 p-3"><div className="text-[10px] font-semibold uppercase text-rose-700">Rejection reason</div><p className="mt-1 text-xs text-rose-900">{advance.rejectionReason}</p></div>}</section>
        <section className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold">Approved terms</h3><p className="mt-1 text-xs text-slate-500">The final terms recorded by the reviewer.</p></div>{advance.decisionBy && <span className="text-[10px] text-slate-400">{advance.decisionBy} · {advance.decisionAt ? formatDate(advance.decisionAt.slice(0, 10)) : ''}</span>}</div>{advance.approvedAmount ? <div className="mt-4 grid gap-4 sm:grid-cols-3"><AdvanceField label="Approved amount" value={money(advance.approvedAmount)} /><AdvanceField label="Installment" value={`${money(advance.approvedInstallmentAmount ?? 0)} ${advance.approvedFrequency?.toLowerCase()}`} /><AdvanceField label="First due date" value={advance.firstDueDate ? formatDate(advance.firstDueDate) : '—'} /></div> : <div className="mt-4 rounded-lg bg-slate-50 p-4 text-xs text-slate-500">Awaiting a reviewer decision. Approval does not create an outstanding balance.</div>}</section>
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="border-b border-slate-100 px-5 py-4"><h3 className="text-sm font-bold">Disbursement</h3><p className="mt-1 text-xs text-slate-500">Only a recorded disbursement is added to the advance balance.</p></div>{advance.disbursement ? <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4"><AdvanceField label="Actual amount" value={money(advance.disbursement.amount)} /><AdvanceField label="Date" value={formatDate(advance.disbursement.date)} /><AdvanceField label="Method" value={advance.disbursement.method} /><AdvanceField label="Reference" value={advance.disbursement.reference || '—'} /></div> : <div className="px-5 py-8 text-center text-xs text-slate-400">No disbursement recorded.</div>}</section>
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h3 className="text-sm font-bold">Repayment ledger</h3><p className="mt-1 text-xs text-slate-500">Recorded payments only · {money(repaidAmount(advance))} repaid</p></div><button type="button" disabled={advance.status !== 'Active'} onClick={() => onAction('repayment')} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"><Icons.Plus className="size-3.5" /> Record repayment</button></div>{advance.repayments.length ? <div className="overflow-x-auto"><table className="w-full min-w-160 text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase text-slate-400"><tr>{['Date', 'Amount', 'Method', 'Reference', 'Note'].map((item) => <th key={item} className="px-4 py-3">{item}</th>)}</tr></thead><tbody>{[...advance.repayments].sort((left, right) => right.date.localeCompare(left.date)).map((repayment) => <tr key={repayment.id} className="border-t border-slate-100 text-slate-600"><td className="px-4 py-3">{formatDate(repayment.date)}</td><td className="px-4 py-3 font-semibold text-emerald-700">{money(repayment.amount)}</td><td className="px-4 py-3">{repayment.method}</td><td className="px-4 py-3">{repayment.reference || '—'}</td><td className="px-4 py-3">{repayment.note || '—'}</td></tr>)}</tbody></table></div> : <div className="px-5 py-9 text-center text-xs text-slate-400">No repayments recorded yet.</div>}</section>
      </div>
      <div className="space-y-4">
        <section className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-bold">Repayment progress</h3><p className="mt-1 text-xs text-slate-500">Based on actual recorded repayments</p></div><span className="text-sm font-bold text-slate-800">{Math.round(progress)}%</span></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${progress}%` }} /></div><div className="mt-3 flex justify-between gap-3 text-xs"><span className="text-slate-500">Repaid <strong className="text-slate-800">{money(repaidAmount(advance))}</strong></span><span className="text-slate-500">Balance <strong className="text-slate-800">{advance.disbursement ? money(currentBalance) : '—'}</strong></span></div>{nextDue && advance.status === 'Active' && <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3 text-xs"><Icons.CalendarClock className="size-4 text-amber-600" /><span className="text-slate-500">Next reminder</span><strong className="ml-auto">{formatDate(nextDue.dueDate)} · {money(nextDue.plannedAmount)}</strong></div>}</section>
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="border-b border-slate-100 px-5 py-4"><h3 className="text-sm font-bold">Repayment schedule</h3><p className="mt-1 text-xs text-slate-500">Planned reminders · do not reduce the balance.</p></div>{advance.schedule.length ? <div className="max-h-85 divide-y divide-slate-100 overflow-auto">{advance.schedule.map((entry, index) => { const dueState = advance.repayments.some((repayment) => repayment.date === entry.dueDate && repayment.amount >= entry.plannedAmount) ? 'Repayment on date' : entry.dueDate < today() ? 'Past due reminder' : 'Upcoming reminder'; return <div key={entry.id} className="flex items-center gap-3 px-5 py-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600">{index + 1}</span><div className="min-w-0 flex-1"><div className="text-xs font-semibold text-slate-800">{formatDate(entry.dueDate)}</div><div className="mt-0.5 text-[10px] text-slate-400">{dueState}</div></div><strong className="text-xs">{money(entry.plannedAmount)}</strong></div> })}</div> : <div className="px-5 py-9 text-center text-xs text-slate-400">A schedule appears after approval.</div>}</section>
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="border-b border-slate-100 px-5 py-4"><h3 className="text-sm font-bold">Activity history</h3></div>{advance.activity.length ? <ol className="divide-y divide-slate-100">{[...advance.activity].sort((left, right) => right.at.localeCompare(left.at)).map((entry) => <li key={entry.id} className="flex gap-3 px-5 py-3"><span className="mt-1.5 size-2 shrink-0 rounded-full bg-emerald-600" /><div className="min-w-0 flex-1"><div className="text-xs font-semibold text-slate-800">{entry.action}</div>{entry.note && <div className="mt-1 text-[11px] text-slate-500">{entry.note}</div>}<div className="mt-1 text-[10px] text-slate-400">{entry.actor} · {new Date(entry.at).toLocaleString()}</div></div></li>)}</ol> : <div className="px-5 py-8 text-center text-xs text-slate-400">No activity recorded.</div>}</section>
      </div>
    </div>
  </div>
}

function AdvanceDialog({ mode, state, advance, error, onClose, onSubmit }: { mode: Exclude<Dialog, null>; state: ErpState; advance: SalaryAdvance | null; error: string; onClose: () => void; onSubmit: (form: FormData) => void }) {
  const [decision, setDecision] = useState<'Approved' | 'Rejected'>('Approved')
  const employeeChoices = state.employees.filter((employee) => employee.status === 'Active')
  const frequency = advance?.proposedFrequency ?? 'Monthly'
  const title = mode === 'request' ? 'New advance request' : mode === 'review' ? 'Review advance request' : mode === 'disbursement' ? 'Record disbursement' : 'Record repayment'
  const submitLabel = mode === 'request' ? 'Submit request' : mode === 'review' ? 'Save decision' : mode === 'disbursement' ? 'Record disbursement' : 'Save repayment'
  const labelClass = 'block text-xs font-semibold text-slate-600'
  const fieldClass = 'mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#8b5cf6] focus:ring-2 focus:ring-purple-100'
  const todayValue = today()
  return <div className="fixed inset-0 z-90 grid place-items-center bg-slate-950/45 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section role="dialog" aria-modal="true" aria-labelledby="advance-dialog-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 id="advance-dialog-title" className="text-base font-bold">{title}</h2><p className="mt-1 text-xs text-slate-500">{advance ? `${advance.reference} · ${advance.employeeName}` : 'Request, review, and payment actions remain separate.'}</p></div><button type="button" aria-label="Close form" onClick={onClose} className="grid size-8 place-items-center rounded-md text-slate-400 hover:bg-slate-100"><Icons.X className="size-4" /></button></header>
    <form onSubmit={(event) => { event.preventDefault(); onSubmit(new FormData(event.currentTarget)) }} className="p-5">
      {mode === 'request' && <div className="grid gap-4 sm:grid-cols-2"><label className={`${labelClass} sm:col-span-2`}>Employee<select required name="employeeId" defaultValue="" className={fieldClass}><option value="" disabled>Select an active employee</option>{employeeChoices.map((employee) => <option key={employee.id} value={employee.id}>{employeeDisplayName(employee)} · {employee.number} · {employee.department} · {employee.paymentFrequency ?? 'Pay frequency not set'}</option>)}</select></label><label className={labelClass}>Requested amount (UGX)<input required name="requestedAmount" type="number" min="1" step="1" className={fieldClass} /></label><label className={labelClass}>Proposed repayment frequency<select name="frequency" defaultValue="Monthly" className={fieldClass}><option>Monthly</option><option>Weekly</option></select></label><label className={labelClass}>Proposed installment (UGX)<input required name="installmentAmount" type="number" min="1" step="1" className={fieldClass} /></label><label className={labelClass}>First due date<input required name="firstDueDate" type="date" min={todayValue} className={fieldClass} /></label><label className={`${labelClass} sm:col-span-2`}>Reason<textarea required name="reason" rows={3} className={fieldClass} placeholder="Why is the advance requested?" /></label><p className="text-[11px] text-slate-400 sm:col-span-2">The schedule is a reminder only. No amount becomes outstanding until a disbursement is recorded.</p></div>}
      {mode === 'review' && advance && <div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}>Decision<select name="decision" value={decision} onChange={(event) => setDecision(event.target.value as typeof decision)} className={fieldClass}><option value="Approved">Approve</option><option value="Rejected">Reject</option></select></label>{decision === 'Approved' && <><label className={labelClass}>Approved amount (UGX)<input required name="approvedAmount" type="number" min="1" max={advance.requestedAmount} defaultValue={advance.requestedAmount} className={fieldClass} /></label><label className={labelClass}>Repayment frequency<select name="frequency" defaultValue={frequency} className={fieldClass}><option>Monthly</option><option>Weekly</option></select></label><label className={labelClass}>Installment amount (UGX)<input required name="installmentAmount" type="number" min="1" max={advance.requestedAmount} defaultValue={advance.proposedInstallmentAmount} className={fieldClass} /></label><label className={labelClass}>First due date<input required name="firstDueDate" type="date" min={todayValue} defaultValue={advance.proposedFirstDueDate} className={fieldClass} /></label></>}<label className={`${labelClass} sm:col-span-2`}>Rejection reason <span className="font-normal text-slate-400">Required if rejected</span><textarea required={decision === 'Rejected'} name="rejectionReason" rows={2} className={fieldClass} /></label><p className="text-[11px] text-slate-400 sm:col-span-2">Approval sets terms only. Record the actual payout separately to create an outstanding balance.</p></div>}
      {mode === 'disbursement' && advance && <div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}>Actual disbursed amount (UGX)<input required name="amount" type="number" min="1" max={advance.approvedAmount} defaultValue={advance.approvedAmount} className={fieldClass} /></label><label className={labelClass}>Disbursement date<input required name="date" type="date" max={todayValue} defaultValue={todayValue} className={fieldClass} /></label><label className={labelClass}>Payment method<select name="method" className={fieldClass}><option>Cash</option><option>Mobile Money</option><option>Bank Transfer</option></select></label><label className={labelClass}>Payment reference<input name="reference" className={fieldClass} placeholder="Optional transaction/reference" /></label><p className="text-[11px] text-slate-400 sm:col-span-2">The recorded amount cannot exceed the approved amount. Only this actual amount becomes the employee&apos;s balance.</p></div>}
      {mode === 'repayment' && advance && <div className="grid gap-4 sm:grid-cols-2"><div className="rounded-lg bg-emerald-50 p-3 sm:col-span-2"><div className="text-[10px] font-semibold uppercase text-emerald-800">Remaining balance</div><div className="mt-1 text-lg font-bold text-emerald-950">{money(balance(advance))}</div></div><label className={labelClass}>Repayment amount (UGX)<input required name="amount" type="number" min="1" max={balance(advance)} step="1" className={fieldClass} /></label><label className={labelClass}>Received date<input required name="date" type="date" max={todayValue} defaultValue={todayValue} className={fieldClass} /></label><label className={labelClass}>Method<select name="method" className={fieldClass}><option>Cash</option><option>Mobile Money</option><option>Bank Transfer</option><option>Payroll</option></select></label><label className={labelClass}>Reference<input name="reference" className={fieldClass} placeholder="Transaction or receipt reference" /></label><label className={`${labelClass} sm:col-span-2`}>Note<textarea name="note" rows={2} className={fieldClass} /></label><p className="text-[11px] text-slate-400 sm:col-span-2">“Payroll” records the source label only; no payroll run integration or deduction is performed.</p></div>}
      {error && <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{error}</p>}
      <footer className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Cancel</button><button type="submit" className="rounded-lg bg-[#6d28d9] px-4 py-2 text-xs font-semibold text-white hover:bg-[#5b21b6]">{submitLabel}</button></footer>
    </form></section></div>
}

function AdvanceMetric({ label, value, detail, icon, tone }: { label: string; value: string | number; detail: string; icon: string; tone: string }) {
  const Icon = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[icon] || Icons.CircleHelp
  const color = tone === 'amber' ? 'bg-amber-50 text-amber-700' : tone === 'green' ? 'bg-emerald-50 text-emerald-700' : tone === 'blue' ? 'bg-sky-50 text-sky-700' : tone === 'slate' ? 'bg-slate-100 text-slate-600' : 'bg-rose-50 text-rose-700'
  return <article className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><span className={`grid size-9 place-items-center rounded-lg ${color}`}><Icon className="size-4" /></span><span className="text-[9px] font-semibold uppercase text-slate-400">Live</span></div><div className="mt-3 text-xl font-bold tracking-tight text-slate-900">{value}</div><h3 className="mt-0.5 text-xs font-semibold text-slate-700">{label}</h3><p className="mt-1 text-[10px] text-slate-400">{detail}</p></article>
}

function AdvanceField({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return <div className={wide ? 'sm:col-span-2' : ''}><div className="text-[10px] font-medium uppercase text-slate-400">{label}</div><div className="mt-1 wrap-break-word text-sm font-semibold text-slate-800">{value}</div></div>
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="px-5 py-14 text-center"><span className="mx-auto grid size-10 place-items-center rounded-full bg-slate-100 text-slate-500"><Icons.HandCoins className="size-4" /></span><h4 className="mt-3 text-sm font-semibold text-slate-800">{title}</h4><p className="mx-auto mt-1 max-w-md text-xs text-slate-500">{detail}</p></div>
}