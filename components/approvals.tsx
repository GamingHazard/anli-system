'use client'

import { useMemo, useState } from 'react'
import * as Icons from 'lucide-react'
import { formatDate, money, type AdvanceRepaymentFrequency, type ErpState, type SalaryAdvance } from '@/lib/erp'
import type { ExpenseRecord, ManualExpense } from '@/lib/expenses'
import { useExpenseDecision, useExpenses } from '@/lib/expense-queries'
import { useGeneralManagerSalaryAdvanceDecision, useHrSalaryAdvanceDecision, useSalaryAdvances } from '@/lib/salary-advance-queries'
import { useLeaveDecision, useLeaveRequests } from '@/lib/leave-queries'
import { useDecidePayrollRun, usePayrollRuns } from '@/lib/payroll-queries'
import type { PayrollRun } from '@/lib/payroll'
import type { LeaveRequest } from '@/lib/erp'
import type { UserAccount } from '@/lib/user-api'
import { hasAnyDepartmentRole, hasDepartmentRole } from '@/lib/authorization'

type Props = { state: ErpState; currentUser: UserAccount; onViewSalaryAdvance: (id: string) => void; onViewPayrollRun: (id: string) => void }
type Source = 'Leave' | 'Salary advance' | 'Payroll' | 'Expense'
type ApprovalStatus = 'Awaiting review' | 'Approved' | 'Rejected' | 'Returned'
type ApprovalItem = { id: string; source: Source; reference: string; requester: string; submittedAt: string; summary: string; amount?: number; status: ApprovalStatus; detail: string; recordId: string; canApprove?: boolean; advance?: SalaryAdvance; expense?: ManualExpense; approvalStage?: 'Human Resource' | 'General Manager' | 'Super Admin' }
type View = 'Needs review' | 'History'

const inputClass = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 outline-none focus:border-primary focus:ring-2 focus:ring-ring/30'
const statusTone: Record<ApprovalStatus, string> = { 'Awaiting review': 'bg-amber-50 text-amber-800', Approved: 'bg-emerald-50 text-emerald-700', Rejected: 'bg-rose-50 text-rose-700', Returned: 'bg-rose-50 text-rose-700' }

function approvalItems(state: ErpState, salaryAdvances: SalaryAdvance[], leaveRequests: LeaveRequest[], payrollRuns: PayrollRun[], expenseRecords: ExpenseRecord[], currentUser: UserAccount): ApprovalItem[] {
  const pending: ApprovalItem[] = [
    ...leaveRequests.filter((request) => request.status === 'Pending').map((request) => ({ id: `leave-${request.id}`, recordId: request.id, source: 'Leave' as const, reference: request.reference, requester: request.employeeName, submittedAt: request.requestedAt, summary: `${request.leaveType === 'Other' ? request.otherLeaveType : request.leaveType} · ${request.requestedDays} working days · ${formatDate(request.startDate)} to ${formatDate(request.endDate)}`, status: 'Awaiting review' as const, canApprove: currentUser.roles.some((role) => ['Human Resource', 'Admin', 'Super Admin'].includes(role)) || request.approverUserId === currentUser.id, detail: `${request.reason}\nHandover: ${request.handoverName} · ${request.department}` })),
    ...salaryAdvances.filter((advance) => advance.status === 'Pending HR review' || advance.status === 'Pending GM review').map((advance) => ({ id: `advance-${advance.id}`, recordId: advance.id, source: 'Salary advance' as const, reference: advance.reference, requester: advance.employeeName, submittedAt: advance.requestedAt, summary: `Requested ${money(advance.requestedAmount)} · ${advance.proposedFrequency} repayment`, amount: advance.requestedAmount, status: 'Awaiting review' as const, detail: `Pending ${advance.status === 'Pending HR review' ? 'Human Resource' : 'General Manager'} approval.\n${advance.reason}\nDate taken: ${formatDate(advance.dateTaken)} · Proposed installment: ${money(advance.hrDecision?.installmentAmount ?? advance.proposedInstallmentAmount)} · Attachments: ${advance.attachments.length}`, advance, approvalStage: advance.status === 'Pending HR review' ? 'Human Resource' as const : 'General Manager' as const })),
    ...payrollRuns.filter((run) => ['In review', 'Manager approved'].includes(run.status)).map((run) => {
      const managerStage = run.status === 'In review'
      const managerApproval = run.approvals.find((approval) => approval.stage === 'General Manager' && approval.decision === 'Approved')
      const canApprove = managerStage
        ? hasDepartmentRole(currentUser.roles, 'General Manager')
        : currentUser.roles.includes('Super Admin') && String(managerApproval?.actorId) !== String(currentUser.id)
      return {
        id: `payroll-${run.id}`,
        recordId: run.id,
        source: 'Payroll' as const,
        reference: run.reference,
        requester: run.createdBy || 'Payroll preparer not recorded',
        submittedAt: run.submittedAt || run.updatedAt,
        summary: `${run.runType} · ${formatDate(run.periodStart)} to ${formatDate(run.periodEnd)} · ${run.payslips.length} payslips · ${money(run.payslips.reduce((sum, slip) => sum + slip.netPay, 0))} net`,
        status: 'Awaiting review' as const,
        canApprove,
        approvalStage: managerStage ? 'General Manager' as const : 'Super Admin' as const,
        detail: `Awaiting ${managerStage ? 'General Manager' : 'Super Admin/Director'} approval.\n${run.approvals.map((approval) => `${approval.stage}: ${approval.decision} by ${approval.actorName}`).join('\n')}`,
      }
    }),
    ...expenseRecords.filter((expense): expense is ManualExpense => expense.source === 'Manual' && expense.status === 'Pending approval').map((expense) => ({ id: `expense-${expense.id}`, recordId: expense.id, source: 'Expense' as const, reference: expense.reference, requester: expense.requestedBy || 'Requester not recorded', submittedAt: expense.createdAt || `${expense.date}T12:00:00.000Z`, summary: `${expense.payee || expense.description} · ${expense.category}${expense.taxType ? ` · ${expense.taxType}` : ''} · ${expense.department}`, amount: expense.amount, status: 'Awaiting review' as const, detail: `${expense.description}\nDate: ${formatDate(expense.date)} · Type: ${expense.expenseType || 'Not specified'} · Receipts: ${expense.attachments.length}`, expense })),
  ]

  const history: ApprovalItem[] = [
    ...leaveRequests.flatMap((request) => request.decisions.filter((decision) => decision.decision === 'Approved' || decision.decision === 'Rejected').map((decision) => ({ id: `leave-decision-${decision.id}`, recordId: request.id, source: 'Leave' as const, reference: request.reference, requester: request.employeeName, submittedAt: decision.at, summary: `${request.leaveType === 'Other' ? request.otherLeaveType : request.leaveType} · ${request.requestedDays} days`, status: decision.decision as ApprovalStatus, detail: `${decision.actor}${decision.note ? `\n${decision.note}` : ''}` }))),
    ...salaryAdvances.filter((advance) => ['Approved', 'Rejected', 'Active', 'Settled'].includes(advance.status)).map((advance) => ({ id: `advance-decision-${advance.id}`, recordId: advance.id, source: 'Salary advance' as const, reference: advance.reference, requester: advance.employeeName, submittedAt: advance.gmDecision?.decidedAt || advance.hrDecision?.decidedAt || advance.updatedAt, summary: `${money(advance.approvedAmount ?? advance.requestedAmount)} · ${advance.status === 'Rejected' ? advance.rejectionReason || 'Rejected' : 'approved terms'}`, amount: advance.approvedAmount ?? advance.requestedAmount, status: advance.status === 'Rejected' ? 'Rejected' as const : 'Approved' as const, detail: `HR: ${advance.hrDecision?.actorName || 'Not recorded'}${advance.gmDecision ? `\nGeneral Manager: ${advance.gmDecision.actorName}` : ''}${advance.rejectionReason ? `\n${advance.rejectionReason}` : ''}`, advance })),
    ...payrollRuns.filter((run) => ['Approved', 'Paid', 'Returned'].includes(run.status)).map((run) => ({
      id: `payroll-decision-${run.id}`,
      recordId: run.id,
      source: 'Payroll' as const,
      reference: run.reference,
      requester: run.createdBy || 'Payroll preparer not recorded',
      submittedAt: run.paidAt || run.approvals.at(-1)?.decidedAt || run.updatedAt,
      summary: `${run.runType} · ${run.payslips.length} payslips · ${money(run.payslips.reduce((sum, slip) => sum + slip.netPay, 0))} net · ${run.status}`,
      status: run.status === 'Returned' ? 'Returned' as const : 'Approved' as const,
      detail: run.approvals.map((approval) => `${approval.stage}: ${approval.decision} by ${approval.actorName}${approval.note ? `\n${approval.note}` : ''}`).join('\n') || `Created by ${run.createdBy}`,
    })),
    ...expenseRecords.filter((expense): expense is ManualExpense => expense.source === 'Manual').flatMap((expense) => (expense.decisions ?? []).map((decision) => ({ id: `expense-decision-${decision.id}`, recordId: expense.id, source: 'Expense' as const, reference: expense.reference, requester: expense.requestedBy || 'Requester not recorded', submittedAt: decision.at, summary: `${expense.payee || expense.description} · ${money(expense.amount)}`, amount: expense.amount, status: decision.decision as ApprovalStatus, detail: `${decision.actor}${decision.note ? `\n${decision.note}` : ''}`, expense }))),
  ]
  return [...pending, ...history].sort((left, right) => right.submittedAt.localeCompare(left.submittedAt))
}

export default function Approvals({ state, currentUser, onViewSalaryAdvance, onViewPayrollRun }: Props) {
  const [view, setView] = useState<View>('Needs review')
  const [sourceFilter, setSourceFilter] = useState<'All sources' | Source>('All sources')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<ApprovalItem | null>(null)
  const [decisionNote, setDecisionNote] = useState('')
  const [decisionTerms, setDecisionTerms] = useState({ amount: 0, frequency: 'Monthly' as AdvanceRepaymentFrequency, installmentAmount: 0 })
  const [message, setMessage] = useState('')
  const approver = currentUser.name
  const canReadAdvances = hasAnyDepartmentRole(currentUser.roles, ['Human Resource', 'General Manager', 'Admin'])
  const advanceQuery = useSalaryAdvances(undefined, canReadAdvances)
  const leaveQuery = useLeaveRequests()
  const canReadPayroll = hasAnyDepartmentRole(currentUser.roles, ['Human Resource', 'General Manager', 'Accountant'])
  const payrollQuery = usePayrollRuns({ limit: 500 }, canReadPayroll)
  const canReadExpenses = hasAnyDepartmentRole(currentUser.roles, ['Accountant', 'General Manager'])
  const expensesQuery = useExpenses({ limit: 2000 }, canReadExpenses)
  const leaveDecisionMutation = useLeaveDecision()
  const hrDecisionMutation = useHrSalaryAdvanceDecision()
  const gmDecisionMutation = useGeneralManagerSalaryAdvanceDecision()
  const payrollDecisionMutation = useDecidePayrollRun()
  const expenseDecisionMutation = useExpenseDecision()
  const salaryAdvances = advanceQuery.data?.advances ?? []
  const leaveRequests = leaveQuery.data?.requests ?? []
  const payrollRuns = payrollQuery.data?.runs ?? []
  const expenseRecords = expensesQuery.data?.expenses ?? []
  const items = useMemo(() => approvalItems(state, salaryAdvances, leaveRequests, payrollRuns, expenseRecords, currentUser), [state, salaryAdvances, leaveRequests, payrollRuns, expenseRecords, currentUser])
  const pending = items.filter((item) => item.status === 'Awaiting review')
  const history = items.filter((item) => item.status !== 'Awaiting review')
  const visible = (view === 'Needs review' ? pending : history).filter((item) => {
    const searchable = `${item.reference} ${item.requester} ${item.summary} ${item.source}`.toLowerCase()
    return (sourceFilter === 'All sources' || item.source === sourceFilter) && searchable.includes(search.trim().toLowerCase())
  })
  const actionable = selected?.status === 'Awaiting review'
    && (selected.source !== 'Leave' || Boolean(selected.canApprove))
    && (selected.source !== 'Payroll' || Boolean(selected.canApprove))
    && (selected.source !== 'Expense' || hasDepartmentRole(currentUser.roles, 'General Manager'))
    && (selected.source !== 'Salary advance'
      || (selected.approvalStage === 'Human Resource' && hasDepartmentRole(currentUser.roles, 'Human Resource'))
      || (selected.approvalStage === 'General Manager' && hasDepartmentRole(currentUser.roles, 'General Manager')))
  const openItem = (item: ApprovalItem) => {
    setSelected(item)
    setDecisionNote('')
    setMessage('')
    if (item.advance) {
      setDecisionTerms({
        amount: item.advance.hrDecision?.amount ?? item.advance.requestedAmount,
        frequency: item.advance.hrDecision?.frequency ?? item.advance.proposedFrequency,
        installmentAmount: item.advance.hrDecision?.installmentAmount ?? item.advance.proposedInstallmentAmount,
      })
    }
  }

  const decide = async (decision: 'Approved' | 'Rejected') => {
    if (!selected || !actionable) return
    if (decision === 'Rejected' && !decisionNote.trim()) { setMessage('Add a reason before rejecting this request.'); return }
    if (selected.source === 'Leave') {
      try {
        await leaveDecisionMutation.mutateAsync({ id: selected.recordId, input: { decision, note: decisionNote.trim() } })
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Could not save the leave decision.')
        return
      }
    } else if (selected.source === 'Salary advance') {
      const advance = selected.advance
      if (!advance || !['Pending HR review', 'Pending GM review'].includes(advance.status)) { setMessage('This request is no longer awaiting review.'); return }
      if (decision === 'Approved' && (!Number.isSafeInteger(decisionTerms.amount) || decisionTerms.amount < 1 || decisionTerms.amount > advance.requestedAmount || !Number.isSafeInteger(decisionTerms.installmentAmount) || decisionTerms.installmentAmount < 1 || decisionTerms.installmentAmount > decisionTerms.amount)) {
        setMessage('Enter a valid approved amount and installment not greater than the requested amount.')
        return
      }
      try {
        const input = decision === 'Rejected'
          ? { decision, note: decisionNote.trim() }
          : {
              decision,
              note: decisionNote.trim(),
              amount: decisionTerms.amount,
              frequency: decisionTerms.frequency,
              installmentAmount: decisionTerms.installmentAmount,
            }
        if (selected.approvalStage === 'Human Resource') await hrDecisionMutation.mutateAsync({ id: advance.id, input })
        else await gmDecisionMutation.mutateAsync({ id: advance.id, input })
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Could not save the salary-advance decision.')
        return
      }
    } else if (selected.source === 'Payroll') {
      try {
        await payrollDecisionMutation.mutateAsync({
          id: selected.recordId,
          decision: decision === 'Approved' ? 'Approved' : 'Returned',
          note: decisionNote.trim(),
        })
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Could not save the payroll decision.')
        return
      }
    } else {
      if (!selected.expense || selected.expense.status !== 'Pending approval') { setMessage('This expense is no longer awaiting review.'); return }
      try {
        await expenseDecisionMutation.mutateAsync({ id: selected.recordId, decision, note: decisionNote.trim() })
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Could not save the expense decision.')
        return
      }
    }
    setSelected(null)
    setMessage('')
  }

  return <div className="animate-in fade-in duration-300">
    <header className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="mb-2 text-xs font-medium text-slate-400">Workspace / Overview</div><h2 className="text-2xl font-bold tracking-tight text-slate-900">Approvals</h2><p className="mt-1 max-w-2xl text-sm text-slate-500">Review pending requests across HR, payroll, finance, and operations.</p></div><div className="text-xs text-slate-500">Signed in as <span className="font-semibold text-slate-700">{currentUser.name}</span></div></header>
    <div role="status" className="mb-5 flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-xs leading-5 text-sky-950"><Icons.Info className="mt-0.5 size-4 shrink-0" /><p>Payroll decisions are server-enforced and require General Manager approval followed by Super Admin/Director approval. Salary advances and leave decisions are backend-backed; expenses retain their current workflow.</p></div>
    {leaveQuery.isError && <div role="alert" className="mb-4 flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800"><span>{leaveQuery.error instanceof Error ? leaveQuery.error.message : 'Could not load leave approvals.'}</span><button type="button" onClick={() => leaveQuery.refetch()} className="font-semibold underline">Retry</button></div>}
    {canReadAdvances && advanceQuery.isError && <div role="alert" className="mb-4 flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800"><span>{advanceQuery.error instanceof Error ? advanceQuery.error.message : 'Could not load salary-advance approvals.'}</span><button type="button" onClick={() => advanceQuery.refetch()} className="font-semibold underline">Retry</button></div>}
    {canReadPayroll && payrollQuery.isError && <div role="alert" className="mb-4 flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800"><span>{payrollQuery.error instanceof Error ? payrollQuery.error.message : 'Could not load payroll approvals.'}</span><button type="button" onClick={() => payrollQuery.refetch()} className="font-semibold underline">Retry</button></div>}
    {canReadExpenses && expensesQuery.isError && <div role="alert" className="mb-4 flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800"><span>{expensesQuery.error instanceof Error ? expensesQuery.error.message : 'Could not load expense approvals.'}</span><button type="button" onClick={() => expensesQuery.refetch()} className="font-semibold underline">Retry</button></div>}

    <section aria-label="Approval summary" className="mb-5 grid gap-3 sm:grid-cols-3"><SummaryMetric title="Needs review" value={pending.length} icon="ClipboardList" tone="amber" /><SummaryMetric title="Approved" value={history.filter((item) => item.status === 'Approved').length} icon="BadgeCheck" tone="green" /><SummaryMetric title="Rejected" value={history.filter((item) => item.status === 'Rejected').length} icon="CircleX" tone="rose" /></section>

    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div role="tablist" aria-label="Approval views" className="flex gap-1 border-b border-slate-200 px-4 pt-2">{(['Needs review', 'History'] as View[]).map((item) => <button key={item} type="button" role="tab" aria-selected={view === item} onClick={() => setView(item)} className={`inline-flex items-center gap-2 border-b-2 px-3 py-3 text-xs font-semibold ${view === item ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{item}<span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px]">{item === 'Needs review' ? pending.length : history.length}</span></button>)}</div>
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between"><div><h3 className="text-sm font-bold text-slate-900">{view}</h3><p className="mt-1 text-xs text-slate-500">{visible.length} {view === 'Needs review' ? 'request' : 'decision'}{visible.length === 1 ? '' : 's'}</p></div><div className="flex flex-col gap-2 sm:flex-row"><label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><Icons.Search className="size-4 text-slate-400" /><input aria-label="Search approvals" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Reference, requester, details" className="w-full bg-transparent text-xs outline-none sm:w-56" /></label><select aria-label="Filter approvals by source" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as typeof sourceFilter)} className={inputClass}><option>All sources</option>{(['Leave', 'Salary advance', 'Payroll', 'Expense'] as Source[]).map((source) => <option key={source}>{source}</option>)}</select></div></div>
      {visible.length ? <div className="overflow-x-auto"><table className="w-full min-w-190 text-left text-xs"><thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-400"><tr>{['Request', 'Requester', 'Summary', 'Submitted', 'Status', ''].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{visible.map((item) => <tr key={item.id} className="border-t border-slate-100 text-slate-600 hover:bg-slate-50/70"><td className="px-4 py-3"><div className="font-semibold text-slate-800">{item.reference}</div><span className="mt-1 block text-[10px] text-slate-400">{item.source}</span></td><td className="px-4 py-3">{item.requester}</td><td className="max-w-80 px-4 py-3"><div className="truncate font-medium text-slate-700">{item.summary}</div><div className="mt-1 truncate text-[10px] text-slate-400">{item.detail.split('\n')[0]}</div></td><td className="whitespace-nowrap px-4 py-3 text-[10px] text-slate-500">{formatDate(item.submittedAt.slice(0, 10))}</td><td className="px-4 py-3"><span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${statusTone[item.status]}`}>{item.status}</span></td><td className="px-4 py-3 text-right"><button type="button" onClick={() => openItem(item)} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">{item.status === 'Awaiting review' ? 'Review' : 'Details'}<Icons.ChevronRight className="size-3.5" /></button></td></tr>)}</tbody></table></div> : <div className="px-5 py-14 text-center"><Icons.Inbox className="mx-auto size-5 text-slate-300" /><h4 className="mt-3 text-sm font-semibold text-slate-800">{view === 'Needs review' ? 'Nothing needs review' : 'No approval history yet'}</h4><p className="mx-auto mt-1 max-w-md text-xs text-slate-500">New leave, salary advance, payroll, and expense requests will appear here when submitted.</p></div>}
      <footer className="border-t border-slate-100 px-4 py-3 text-[10px] text-slate-400">Legacy Pending expenses and unsaved disciplinary letters are not approval requests. Security changes need persisted request records before they can enter this queue.</footer>
    </section>

    {selected && <ApprovalDialog item={selected} note={decisionNote} setNote={setDecisionNote} terms={decisionTerms} setTerms={setDecisionTerms} message={message} canAct={Boolean(actionable)} isSaving={hrDecisionMutation.isPending || gmDecisionMutation.isPending || payrollDecisionMutation.isPending} onViewSalaryAdvance={onViewSalaryAdvance} onClose={() => { setSelected(null); setMessage('') }} onDecision={decide} />}
  </div>
}

function SummaryMetric({ title, value, icon, tone }: { title: string; value: number; icon: string; tone: string }) {
  const Icon = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[icon] ?? Icons.CircleHelp
  const color = tone === 'amber' ? 'bg-amber-50 text-amber-700' : tone === 'green' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
  return <article className="rounded-xl border border-slate-200 bg-white p-4"><span className={`grid size-9 place-items-center rounded-lg ${color}`}><Icon className="size-4" /></span><div className="mt-3 text-xl font-bold text-slate-900">{value}</div><div className="mt-0.5 text-xs font-semibold text-slate-700">{title}</div></article>
}

function ApprovalDialog({ item, note, setNote, terms, setTerms, message, canAct, isSaving, onViewSalaryAdvance, onClose, onDecision }: { item: ApprovalItem; note: string; setNote: (value: string) => void; terms: { amount: number; frequency: AdvanceRepaymentFrequency; installmentAmount: number }; setTerms: (value: { amount: number; frequency: AdvanceRepaymentFrequency; installmentAmount: number }) => void; message: string; canAct: boolean; isSaving: boolean; onViewSalaryAdvance: (id: string) => void; onClose: () => void; onDecision: (decision: 'Approved' | 'Rejected') => void | Promise<void> }) {
  const isPending = item.status === 'Awaiting review'
  const canDecide = isPending && (item.source === 'Leave' || item.source === 'Payroll' ? Boolean(item.canApprove) : item.source !== 'Salary advance' || canAct)
  return <div className="fixed inset-0 z-80 grid place-items-center bg-slate-950/45 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSaving) onClose() }}><section role="dialog" aria-modal="true" aria-labelledby="approval-dialog-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl"><header className="flex items-start justify-between border-b border-slate-100 px-5 py-4"><div><h2 id="approval-dialog-title" className="text-base font-bold text-slate-900">{isPending ? 'Review request' : 'Approval details'}</h2><p className="mt-1 text-xs text-slate-500">{item.source} · {item.reference} · Submitted by {item.requester}</p></div><button type="button" aria-label="Close approval details" disabled={isSaving} onClick={onClose} className="grid size-8 place-items-center rounded-md text-slate-400 hover:bg-slate-100"><Icons.X className="size-4" /></button></header><div className="space-y-4 p-5"><div className="grid gap-4 sm:grid-cols-2"><Detail label="Source module" value={item.source} /><Detail label="Submitted" value={formatDate(item.submittedAt.slice(0, 10))} />{item.amount !== undefined && <Detail label="Amount" value={money(item.amount)} />}<Detail label="Request summary" value={item.summary} wide /></div><div className="rounded-lg bg-slate-50 p-4"><div className="text-[10px] font-semibold uppercase text-slate-400">Request details</div><p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-700">{item.detail}</p></div>{item.source === 'Salary advance' && item.advance && <button type="button" onClick={() => onViewSalaryAdvance(item.advance!.id)} className="text-xs font-semibold text-primary underline">Open salary advance details</button>}{isPending && item.source === 'Salary advance' && canAct && <fieldset className="grid gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-3"><legend className="px-1 text-xs font-semibold text-slate-700">{item.approvalStage} proposed/final terms</legend><label className="text-[10px] font-semibold text-slate-600">Approved amount<input type="number" min={1} max={item.advance?.requestedAmount} value={terms.amount} onChange={(event) => setTerms({ ...terms, amount: Number(event.target.value) })} className="mt-1 block w-full rounded-lg border border-slate-200 px-2 py-2 text-xs" /></label><label className="text-[10px] font-semibold text-slate-600">Repayment frequency<select value={terms.frequency} onChange={(event) => setTerms({ ...terms, frequency: event.target.value as AdvanceRepaymentFrequency })} className="mt-1 block w-full rounded-lg border border-slate-200 px-2 py-2 text-xs"><option>Weekly</option><option>Monthly</option></select></label><label className="text-[10px] font-semibold text-slate-600">Installment<input type="number" min={1} max={terms.amount || undefined} value={terms.installmentAmount} onChange={(event) => setTerms({ ...terms, installmentAmount: Number(event.target.value) })} className="mt-1 block w-full rounded-lg border border-slate-200 px-2 py-2 text-xs" /></label></fieldset>}{isPending && item.source === 'Salary advance' && !canAct && <p role="status" className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">This request is awaiting {item.approvalStage} approval. Your account does not have the required reviewer role.</p>}{isPending && canDecide && <label className="block text-xs font-semibold text-slate-600">Decision note <span className="font-normal text-slate-400">(required for rejection)</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-primary" placeholder="Add context for this decision" /></label>}{message && <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{message}</p>  }{item.source === 'Payroll' && !canAct && <p role="status" className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">This run is awaiting {item.approvalStage} approval. Your account does not have the required reviewer role.</p>}<footer className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" disabled={isSaving} onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-50">Close</button>{canDecide && <button type="button" disabled={isSaving || (item.source !== 'Payroll' && !note.trim())} onClick={() => onDecision('Rejected')} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50">{item.source === 'Payroll' ? 'Return for correction' : 'Reject'}</button>}{canDecide && <button type="button" disabled={isSaving} onClick={() => onDecision('Approved')} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45">{isSaving ? 'Saving…' : item.source === 'Payroll' ? `Approve as ${item.approvalStage}` : 'Approve'}</button>}</footer></div></section></div>
}

function Detail({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) { return <div className={wide ? 'sm:col-span-2' : ''}><div className="text-[10px] font-medium uppercase text-slate-400">{label}</div><div className="mt-1 text-xs font-semibold text-slate-800">{value}</div></div> }
