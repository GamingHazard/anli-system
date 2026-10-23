'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, ChevronRight, CircleAlert, Clock3, FileCheck2, History, Inbox, RefreshCw, Search, X } from 'lucide-react'
import { formatDate, money, type AdvanceRepaymentFrequency } from '@/lib/erp'
import { useApprovalDecision, useApprovalInbox } from '@/lib/approval-inbox-queries'
import type { ApprovalInboxItem, ApprovalSource, ApprovalStatus } from '@/lib/approval-inbox'
import type { UserAccount } from '@/lib/user-api'

type Props = {
  currentUser: UserAccount
  onViewSalaryAdvance: (id: string) => void
  onViewPayrollRun: (id: string) => void
}
type View = 'My actions' | 'In progress' | 'History'
type Decision = 'Approved' | 'Rejected'

const sources: ApprovalSource[] = ['Leave', 'Leave amendment', 'Salary advance', 'Payroll', 'Expense', 'Disciplinary']
const inputClass = 'rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30'
const statusTone: Record<ApprovalStatus, string> = {
  'Awaiting review': 'border-amber-200 bg-amber-50 text-amber-800',
  'In progress': 'border-sky-200 bg-sky-50 text-sky-800',
  Approved: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  Rejected: 'border-rose-200 bg-rose-50 text-rose-800',
  Returned: 'border-orange-200 bg-orange-50 text-orange-800',
  Cancelled: 'border-slate-200 bg-slate-100 text-slate-600',
}

function displayDate(value: string) {
  return value ? formatDate(value.slice(0, 10)) : '—'
}

function historyItems(items: ApprovalInboxItem[]) {
  return items.filter((item) => ['Approved', 'Rejected', 'Returned', 'Cancelled'].includes(item.status))
}

export default function Approvals({ currentUser, onViewSalaryAdvance, onViewPayrollRun }: Props) {
  const [view, setView] = useState<View>('My actions')
  const [sourceFilter, setSourceFilter] = useState<ApprovalSource | 'All sources'>('All sources')
  const [stageFilter, setStageFilter] = useState('All stages')
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | 'All statuses'>('All statuses')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<ApprovalInboxItem | null>(null)
  const [decisionNote, setDecisionNote] = useState('')
  const [decisionTerms, setDecisionTerms] = useState({
    amount: 0,
    frequency: 'Monthly' as AdvanceRepaymentFrequency,
    installmentAmount: 0,
  })
  const [message, setMessage] = useState('')
  const inboxQuery = useApprovalInbox()
  const decisionMutation = useApprovalDecision()
  const items = inboxQuery.data?.items ?? []
  const actions = items.filter((item) => item.status === 'Awaiting review' && item.canAct)
  const inProgress = items.filter((item) => item.status === 'In progress')
  const history = historyItems(items)
  const currentItems = view === 'My actions' ? actions : view === 'In progress' ? inProgress : history
  const availableStages = [...new Set(currentItems.map((item) => item.stage).filter(Boolean))].sort()
  const visible = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase()
    return currentItems.filter((item) => {
      const sourceMatches = sourceFilter === 'All sources' || item.source === sourceFilter
      const stageMatches = stageFilter === 'All stages' || item.stage === stageFilter
      const statusMatches = statusFilter === 'All statuses' || item.status === statusFilter
      const submittedDate = item.submittedAt.slice(0, 10)
      const dateMatches = (!fromDate || submittedDate >= fromDate) && (!toDate || submittedDate <= toDate)
      const textMatches = !needle || `${item.reference} ${item.requester} ${item.summary} ${item.detail} ${item.source}`.toLocaleLowerCase().includes(needle)
      return sourceMatches && stageMatches && statusMatches && dateMatches && textMatches
    })
  }, [currentItems, search, sourceFilter, stageFilter, statusFilter, fromDate, toDate])
  const isSaving = decisionMutation.isPending

  const openItem = (item: ApprovalInboxItem) => {
    setSelected(item)
    setDecisionNote('')
    setMessage('')
    setDecisionTerms({
      amount: item.salaryAdvance?.hrDecision?.amount ?? item.salaryAdvance?.requestedAmount ?? 0,
      frequency: item.salaryAdvance?.hrDecision?.frequency ?? item.salaryAdvance?.proposedFrequency ?? 'Monthly',
      installmentAmount: item.salaryAdvance?.hrDecision?.installmentAmount
        ?? item.salaryAdvance?.proposedInstallmentAmount ?? 0,
    })
  }

  const decide = async (decision: Decision) => {
    if (!selected || !selected.canAct || selected.status !== 'Awaiting review') return
    if (decision === 'Rejected' && !decisionNote.trim()) {
      setMessage('Add a reason before rejecting this request.')
      return
    }
    if (decision === 'Approved' && selected.source === 'Salary advance') {
      const maxAmount = selected.salaryAdvance?.requestedAmount ?? 0
      if (!Number.isSafeInteger(decisionTerms.amount) || decisionTerms.amount < 1 || decisionTerms.amount > maxAmount
        || !Number.isSafeInteger(decisionTerms.installmentAmount) || decisionTerms.installmentAmount < 1
        || decisionTerms.installmentAmount > decisionTerms.amount) {
        setMessage('Enter a valid approved amount and installment not greater than the requested amount.')
        return
      }
    }

    try {
      if (selected.source === 'Payroll') {
        await decisionMutation.mutateAsync({
          source: 'Payroll',
          recordId: selected.recordId,
          decision: decision === 'Approved' ? 'Approved' : 'Returned',
          note: decisionNote.trim(),
        })
      } else if (selected.source === 'Salary advance') {
        await decisionMutation.mutateAsync({
          source: 'Salary advance',
          recordId: selected.recordId,
          stage: selected.stage,
          decision,
          note: decisionNote.trim(),
          ...(decision === 'Approved' ? { terms: decisionTerms } : {}),
        })
      } else if (selected.source === 'Leave amendment') {
        await decisionMutation.mutateAsync({
          source: 'Leave amendment',
          recordId: selected.recordId,
          subRecordId: selected.subRecordId,
          decision,
          note: decisionNote.trim(),
        })
      } else if (selected.source === 'Leave') {
        await decisionMutation.mutateAsync({
          source: 'Leave',
          recordId: selected.recordId,
          decision,
          note: decisionNote.trim(),
        })
      } else if (selected.source === 'Expense') {
        await decisionMutation.mutateAsync({
          source: 'Expense',
          recordId: selected.recordId,
          decision,
          note: decisionNote.trim(),
        })
      } else {
        await decisionMutation.mutateAsync({
          source: 'Disciplinary',
          recordId: selected.recordId,
          decision,
          note: decisionNote.trim(),
        })
      }
      setSelected(null)
      setMessage('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save this approval decision.')
    }
  }

  return (
    <div className="animate-in fade-in duration-300">
      <header className="mb-6 flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-slate-50 p-5 sm:flex-row sm:items-end sm:p-6">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Workflow center</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Approvals</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            A single, permission-aware inbox for requests waiting on your review and decisions in progress.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-slate-500 sm:inline">Signed in as <strong className="text-slate-700">{currentUser.name}</strong></span>
          <button
            type="button"
            aria-label="Refresh approvals"
            onClick={() => void inboxQuery.refetch()}
            disabled={inboxQuery.isFetching}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${inboxQuery.isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </header>

      <section aria-label="Approval overview" className="mb-5 grid gap-3 sm:grid-cols-3">
        <SummaryMetric title="My actions" value={inboxQuery.data?.counts.actionable ?? actions.length} icon={<CheckCircle2 className="size-4" />} tone="amber" />
        <SummaryMetric title="In progress" value={inboxQuery.data?.counts.inProgress ?? inProgress.length} icon={<Clock3 className="size-4" />} tone="blue" />
        <SummaryMetric title="Recent decisions" value={inboxQuery.data?.counts.history ?? history.length} icon={<FileCheck2 className="size-4" />} tone="green" />
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div role="tablist" aria-label="Approval inbox views" className="flex overflow-x-auto border-b border-slate-200 px-3 pt-2 sm:px-5">
          {([
            { label: 'My actions' as const, count: inboxQuery.data?.counts.actionable ?? actions.length, icon: <CheckCircle2 className="size-4" /> },
            { label: 'In progress' as const, count: inboxQuery.data?.counts.inProgress ?? inProgress.length, icon: <Clock3 className="size-4" /> },
            { label: 'History' as const, count: inboxQuery.data?.counts.history ?? history.length, icon: <History className="size-4" /> },
          ]).map((tab) => (
            <button
              key={tab.label}
              type="button"
              role="tab"
              aria-selected={view === tab.label}
              onClick={() => setView(tab.label)}
              className={`-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-xs font-semibold transition sm:px-4 ${view === tab.label ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              {tab.icon}
              {tab.label}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${view === tab.label ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500'}`}>{tab.count}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">{view}</h2>
            <p className="mt-1 text-xs text-slate-500">
              {inboxQuery.isLoading ? 'Loading inbox…' : `${visible.length} ${visible.length === 1 ? 'request' : 'requests'} shown`}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3">
              <Search className="size-4 shrink-0 text-slate-400" />
              <input
                aria-label="Search approvals"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Reference, requester, details"
                className="h-10 w-full bg-transparent text-xs outline-none sm:w-56"
              />
            </label>
            <select
              aria-label="Filter approvals by workflow"
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value as ApprovalSource | 'All sources')}
              className={inputClass}
            >
              <option>All sources</option>
              {sources.map((source) => <option key={source} value={source}>{source}</option>)}
            </select>
            <select
              aria-label="Filter approvals by stage"
              value={stageFilter}
              onChange={(event) => setStageFilter(event.target.value)}
              className={inputClass}
            >
              <option>All stages</option>
              {availableStages.map((stage) => <option key={stage}>{stage}</option>)}
            </select>
            <select
              aria-label="Filter approvals by status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as ApprovalStatus | 'All statuses')}
              className={inputClass}
            >
              <option>All statuses</option>
              {(['Awaiting review', 'In progress', 'Approved', 'Rejected', 'Returned', 'Cancelled'] as ApprovalStatus[]).map((status) => <option key={status}>{status}</option>)}
            </select>
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-500">
              From
              <input aria-label="Filter approvals from date" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="h-10 bg-transparent text-xs text-slate-700 outline-none" />
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-500">
              To
              <input aria-label="Filter approvals to date" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="h-10 bg-transparent text-xs text-slate-700 outline-none" />
            </label>
          </div>
        </div>

        {inboxQuery.data?.truncatedSources?.length ? (
          <p role="status" className="mx-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 sm:mx-5">
            Showing the most recent items for {inboxQuery.data.truncatedSources.join(', ')}. Refine the list in its source module to find older records.
          </p>
        ) : null}

        {inboxQuery.isError ? (
          <div role="alert" className="m-4 flex flex-col items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2 text-sm text-rose-800">
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              <span>{inboxQuery.error instanceof Error ? inboxQuery.error.message : 'Could not load the approval inbox.'}</span>
            </div>
            <button type="button" onClick={() => void inboxQuery.refetch()} className="text-xs font-semibold text-rose-800 underline">Try again</button>
          </div>
        ) : inboxQuery.isLoading ? (
          <div className="space-y-3 p-4 sm:p-5" aria-label="Loading approval inbox">
            {[1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-xl bg-slate-100" />)}
          </div>
        ) : visible.length ? (
          <div className="divide-y divide-slate-100">
            {visible.map((item) => (
              <article key={item.id} className="flex flex-col gap-4 p-4 transition hover:bg-slate-50/70 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">{item.reference}</span>
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">{item.source}</span>
                    <span className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${statusTone[item.status]}`}>{item.status}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span>{item.requester}</span><span aria-hidden="true">·</span>
                    <span>{displayDate(item.submittedAt)}</span>
                    {item.stage && <><span aria-hidden="true">·</span><span>Stage: {item.stage}</span></>}
                  </div>
                  <p className="mt-2 truncate text-sm font-medium text-slate-700">{item.summary}</p>
                  {item.amount !== undefined && <p className="mt-1 text-xs font-semibold text-slate-500">{money(item.amount)}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => openItem(item)}
                  className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-primary/30 hover:text-primary"
                >
                  {item.canAct ? 'Review' : 'View details'}<ChevronRight className="size-3.5" />
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="px-5 py-16 text-center">
            <span className="mx-auto grid size-11 place-items-center rounded-full bg-slate-100 text-slate-400"><Inbox className="size-5" /></span>
            <h3 className="mt-4 text-sm font-semibold text-slate-800">
              {search || sourceFilter !== 'All sources' || stageFilter !== 'All stages' || statusFilter !== 'All statuses' || fromDate || toDate ? 'No matching requests' : view === 'My actions' ? 'You’re all caught up' : view === 'In progress' ? 'No requests in progress' : 'No decisions yet'}
            </h3>
            <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">
              {search || sourceFilter !== 'All sources' || stageFilter !== 'All stages' || statusFilter !== 'All statuses' || fromDate || toDate
                ? 'Try changing your search or workflow filter.'
                : view === 'My actions'
                  ? 'Requests assigned to you for review will appear here.'
                  : view === 'In progress'
                    ? 'Requests awaiting another workflow stage will appear here when visible to your role.'
                    : 'Completed decisions visible to your account will appear here.'}
            </p>
          </div>
        )}
        <footer className="border-t border-slate-100 bg-slate-50/70 px-4 py-3 text-[11px] leading-5 text-slate-500 sm:px-5">
          Each decision is validated and saved by its source workflow. Disciplinary information is limited to authorized reviewers.
        </footer>
      </section>

      {selected && (
        <ApprovalDialog
          item={selected}
          note={decisionNote}
          setNote={setDecisionNote}
          terms={decisionTerms}
          setTerms={setDecisionTerms}
          message={message}
          isSaving={isSaving}
          onViewSalaryAdvance={onViewSalaryAdvance}
          onViewPayrollRun={onViewPayrollRun}
          onClose={() => { if (!isSaving) { setSelected(null); setMessage('') } }}
          onDecision={decide}
        />
      )}
    </div>
  )
}

function SummaryMetric({ title, value, icon, tone }: { title: string; value: number; icon: React.ReactNode; tone: 'amber' | 'blue' | 'green' }) {
  const palette = tone === 'amber' ? 'bg-amber-50 text-amber-700' : tone === 'blue' ? 'bg-sky-50 text-sky-700' : 'bg-emerald-50 text-emerald-700'
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className={`grid size-9 place-items-center rounded-lg ${palette}`}>{icon}</span>
      <div className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{value}</div>
      <div className="mt-0.5 text-xs font-semibold text-slate-600">{title}</div>
    </article>
  )
}

function ApprovalDialog({
  item,
  note,
  setNote,
  terms,
  setTerms,
  message,
  isSaving,
  onViewSalaryAdvance,
  onViewPayrollRun,
  onClose,
  onDecision,
}: {
  item: ApprovalInboxItem
  note: string
  setNote: (value: string) => void
  terms: { amount: number; frequency: AdvanceRepaymentFrequency; installmentAmount: number }
  setTerms: (value: { amount: number; frequency: AdvanceRepaymentFrequency; installmentAmount: number }) => void
  message: string
  isSaving: boolean
  onViewSalaryAdvance: (id: string) => void
  onViewPayrollRun: (id: string) => void
  onClose: () => void
  onDecision: (decision: Decision) => void | Promise<void>
}) {
  const canDecide = item.status === 'Awaiting review' && item.canAct
  const requiresNote = canDecide && (item.source === 'Payroll' || item.source === 'Disciplinary')

  return (
    <div
      className="fixed inset-0 z-80 grid place-items-center bg-slate-950/45 p-3 backdrop-blur-[2px] sm:p-6"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !isSaving) onClose() }}
    >
      <section role="dialog" aria-modal="true" aria-labelledby="approval-dialog-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-primary">{item.source} · {item.reference}</p>
            <h2 id="approval-dialog-title" className="mt-1 text-lg font-bold text-slate-900">{canDecide ? 'Review request' : 'Approval details'}</h2>
            <p className="mt-1 text-xs text-slate-500">Submitted by {item.requester} · {displayDate(item.submittedAt)}</p>
          </div>
          <button type="button" aria-label="Close approval details" disabled={isSaving} onClick={onClose} className="grid size-9 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50">
            <X className="size-4" />
          </button>
        </header>
        <div className="space-y-5 p-5 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <Detail label="Current status" value={item.status} />
            <Detail label="Approval stage" value={item.stage || 'Complete'} />
            {item.amount !== undefined && <Detail label="Amount" value={money(item.amount)} />}
            <Detail label="Request" value={item.summary} wide />
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Request details</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.detail || 'No additional details were provided.'}</p>
          </div>

          {(item.source === 'Salary advance' || item.source === 'Payroll') && (
            <div className="flex flex-wrap gap-2">
              {item.source === 'Salary advance' && <button type="button" onClick={() => onViewSalaryAdvance(item.recordId)} className="text-xs font-semibold text-primary underline">Open salary advance record</button>}
              {item.source === 'Payroll' && <button type="button" onClick={() => onViewPayrollRun(item.recordId)} className="text-xs font-semibold text-primary underline">Open payroll run</button>}
            </div>
          )}

          {item.history.length > 0 && (
            <section aria-label="Decision history">
              <h3 className="mb-3 text-xs font-bold text-slate-800">Decision trail</h3>
              <ol className="space-y-3 border-l border-slate-200 pl-4">
                {item.history.map((entry, index) => (
                  <li key={`${entry.stage}-${entry.at}-${index}`} className="relative">
                    <span className="absolute -left-[21px] top-1 grid size-3 place-items-center rounded-full border-2 border-white bg-primary shadow-[0_0_0_1px_#cbd5e1]" />
                    <p className="text-xs font-semibold text-slate-800">{entry.stage}: {entry.decision}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{entry.actor} · {displayDate(entry.at)}</p>
                    {entry.note && <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-600">{entry.note}</p>}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {canDecide && item.source === 'Salary advance' && item.salaryAdvance && (
            <fieldset className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-3">
              <legend className="px-1 text-xs font-semibold text-slate-700">{item.stage} proposed/final terms</legend>
              <label className="text-[11px] font-semibold text-slate-600">
                Approved amount
                <input type="number" min={1} max={item.salaryAdvance.requestedAmount} value={terms.amount} onChange={(event) => setTerms({ ...terms, amount: Number(event.target.value) })} className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </label>
              <label className="text-[11px] font-semibold text-slate-600">
                Repayment frequency
                <select value={terms.frequency} onChange={(event) => setTerms({ ...terms, frequency: event.target.value as AdvanceRepaymentFrequency })} className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <option>Weekly</option><option>Monthly</option>
                </select>
              </label>
              <label className="text-[11px] font-semibold text-slate-600">
                Installment
                <input type="number" min={1} max={terms.amount || undefined} value={terms.installmentAmount} onChange={(event) => setTerms({ ...terms, installmentAmount: Number(event.target.value) })} className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </label>
            </fieldset>
          )}

          {canDecide && (
            <label className="block text-xs font-semibold text-slate-600">
              Decision note {item.source === 'Payroll' && requiresNote
                ? <span className="font-normal text-rose-600">(required for return)</span>
                : <span className="font-normal text-slate-400">(required for rejection)</span>}
              <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={1000} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-ring/30" placeholder="Add context for this decision" />
            </label>
          )}

          {item.status === 'In progress' && <p role="status" className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">This request is currently waiting for {item.stage || 'another workflow step'}.</p>}
          {message && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{message}</p>}

          <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" disabled={isSaving} onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 disabled:opacity-50">Close</button>
            {canDecide && (
              <>
                <button
                  type="button"
                  disabled={isSaving || !note.trim()}
                  onClick={() => void onDecision('Rejected')}
                  className="rounded-lg border border-rose-200 px-4 py-2.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-45"
                >
                  {item.source === 'Payroll' ? 'Return for correction' : 'Reject'}
                </button>
                <button type="button" disabled={isSaving} onClick={() => void onDecision('Approved')} className="rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-45">
                  {isSaving ? 'Saving…' : item.stage ? `Approve · ${item.stage}` : 'Approve'}
                </button>
              </>
            )}
          </footer>
        </div>
      </section>
    </div>
  )
}

function Detail({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-800">{value}</div>
    </div>
  )
}
