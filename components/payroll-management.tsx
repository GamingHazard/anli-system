'use client'

import { useMemo, useState } from 'react'
import * as Icons from 'lucide-react'
import { createId, employeeDisplayName, exportCsv, formatDate, money, type Employee, type ErpState, type PayrollFrequency, type PayrollPayslipSnapshot, type PayrollRun, type PayrollRunStatus } from '@/lib/erp'
import { approvePayrollRun } from '@/lib/approvals'
import { useRecordPayrollSalaryAdvanceRepayments } from '@/lib/salary-advance-queries'
import type { UserAccount } from '@/lib/user-api'

type PayrollManagementProps = {
  state: ErpState
  updateState: (next: ErpState) => void
  initialRunId?: string | null
  currentUser: UserAccount
  onViewEmployee: (id: string) => void
}

function companyDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

function currentPeriod(frequency: PayrollFrequency) {
  const today = companyDate()
  if (frequency === 'Monthly') {
    const start = `${today.slice(0, 7)}-01`
    const [year, month] = today.slice(0, 7).split('-').map(Number)
    const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
    return { periodStart: start, periodEnd: end }
  }
  const date = new Date(`${today}T12:00:00+03:00`)
  const weekday = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - weekday)
  const periodStart = date.toISOString().slice(0, 10)
  date.setUTCDate(date.getUTCDate() + 6)
  return { periodStart, periodEnd: date.toISOString().slice(0, 10) }
}

function attendanceUnits(employeeId: string, state: ErpState, start: string, end: string) {
  return state.attendanceRecords
    .filter((record) => record.employeeId === employeeId && record.workDate >= start && record.workDate <= end && record.status === 'Present')
    .reduce((units, record) => units + (record.halfDay ? 0.5 : 1), 0)
}

function makePayslip(employee: Employee, state: ErpState, frequency: PayrollFrequency, periodStart: string, periodEnd: string): PayrollPayslipSnapshot {
  const ready = Boolean(employee.compensationType && Number.isFinite(employee.salary) && employee.salary > 0)
  return {
    id: createId('SLIP'),
    employeeId: employee.id,
    employeeNumber: employee.number,
    employeeName: employeeDisplayName(employee),
    category: employee.category,
    department: employee.department,
    role: employee.role,
    compensationType: employee.compensationType,
    paymentFrequency: frequency,
    configuredRate: Number.isFinite(employee.salary) && employee.salary > 0 ? employee.salary : undefined,
    attendanceUnits: attendanceUnits(employee.id, state, periodStart, periodEnd),
    earnings: [{ id: createId('EARN'), label: employee.compensationType === 'Wage earner' ? 'Wage based on attendance' : 'Base salary' }],
    deductions: [],
    reviewStatus: ready ? 'Ready' : 'Needs review',
    paymentStatus: 'Unpaid',
  }
}

function statusTone(status: string) {
  if (status === 'Paid' || status === 'Approved' || status === 'Ready') return 'bg-emerald-50 text-emerald-700'
  if (status === 'Needs review' || status === 'In review') return 'bg-amber-50 text-amber-700'
  return 'bg-slate-100 text-slate-600'
}

export default function PayrollManagementPage({ state, updateState, initialRunId = null, currentUser, onViewEmployee }: PayrollManagementProps) {
  const [frequency, setFrequency] = useState<PayrollFrequency>('Monthly')
  const [period, setPeriod] = useState(() => currentPeriod('Monthly'))
  const [selectedRunId, setSelectedRunId] = useState<string | null>(initialRunId)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All statuses')
  const [frequencyFilter, setFrequencyFilter] = useState('All frequencies')
  const [payrollRepaymentError, setPayrollRepaymentError] = useState('')
  const payrollRepaymentMutation = useRecordPayrollSalaryAdvanceRepayments()
  const canPostAdvanceRepayments = currentUser.roles.some((role) => ['Human Resource', 'Accountant'].includes(role))
  const employeesForFrequency = state.employees.filter((employee) => employee.status === 'Active' && employee.paymentFrequency === frequency)
  const validPeriod = Boolean(period.periodStart && period.periodEnd && period.periodStart <= period.periodEnd)
  const matchingRuns = state.payrollRuns.filter((run) => run.frequency === frequency && run.periodStart === period.periodStart && run.periodEnd === period.periodEnd)
  const selectedRun = state.payrollRuns.find((run) => run.id === selectedRunId) ?? null
  const filteredRuns = useMemo(() => state.payrollRuns
    .filter((run) => frequencyFilter === 'All frequencies' || run.frequency === frequencyFilter)
    .filter((run) => statusFilter === 'All statuses' || run.status === statusFilter)
    .filter((run) => `${run.reference} ${run.frequency} ${run.periodStart} ${run.periodEnd}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((left, right) => right.periodStart.localeCompare(left.periodStart) || right.createdAt.localeCompare(left.createdAt)),
  [state.payrollRuns, frequencyFilter, statusFilter, search])
  const needsReview = selectedRun?.payslips.filter((slip) => slip.reviewStatus === 'Needs review').length ?? 0
  const periodRuns = state.payrollRuns.filter((run) => run.frequency === frequency && run.periodStart === period.periodStart && run.periodEnd === period.periodEnd)
  const periodPayslips = periodRuns.flatMap((run) => run.payslips)
  const periodReviewCount = periodPayslips.filter((slip) => slip.reviewStatus === 'Needs review').length
  const periodPaidCount = periodPayslips.filter((slip) => slip.paymentStatus === 'Paid').length

  const changeFrequency = (nextFrequency: PayrollFrequency) => {
    setFrequency(nextFrequency)
    setPeriod(currentPeriod(nextFrequency))
  }

  const prepareRun = () => {
    if (!validPeriod) return
    const existing = matchingRuns[0]
    if (existing) {
      setSelectedRunId(existing.id)
      return
    }
    const now = new Date().toISOString()
    const run: PayrollRun = {
      id: createId('PRUN'),
      reference: createId('PR'),
      frequency,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      status: 'Draft',
      createdAt: now,
      updatedAt: now,
      createdBy: currentUser.name,
      payslips: employeesForFrequency.map((employee) => makePayslip(employee, state, frequency, period.periodStart, period.periodEnd)),
    }
    updateState({ ...state, payrollRuns: [run, ...state.payrollRuns] })
    setSelectedRunId(run.id)
  }

  const updateRun = (runId: string, transform: (run: PayrollRun) => PayrollRun) => {
    updateState({ ...state, payrollRuns: state.payrollRuns.map((run) => run.id === runId && run.status !== 'Paid' ? transform(run) : run) })
  }

  const setPayslipReview = (slip: PayrollPayslipSnapshot, reviewStatus: PayrollPayslipSnapshot['reviewStatus']) => {
    if (!selectedRun || selectedRun.status === 'Paid') return
    if (reviewStatus === 'Ready' && (!slip.compensationType || !slip.configuredRate || slip.configuredRate <= 0)) return
    updateRun(selectedRun.id, (run) => ({
      ...run,
      updatedAt: new Date().toISOString(),
      payslips: run.payslips.map((item) => item.id === slip.id ? { ...item, reviewStatus } : item),
    }))
  }

  const refreshPayslipSetup = (slip: PayrollPayslipSnapshot) => {
    if (!selectedRun || selectedRun.status === 'Paid') return
    const employee = state.employees.find((item) => item.id === slip.employeeId)
    if (!employee) return
    const refreshed = makePayslip(employee, state, selectedRun.frequency, selectedRun.periodStart, selectedRun.periodEnd)
    updateRun(selectedRun.id, (run) => ({
      ...run,
      updatedAt: new Date().toISOString(),
      payslips: run.payslips.map((item) => item.id === slip.id ? { ...refreshed, id: item.id, earnings: item.earnings, deductions: item.deductions, grossPay: item.grossPay, deductionTotal: item.deductionTotal, netPay: item.netPay, paymentStatus: item.paymentStatus } : item),
    }))
  }

  const transitionRun = async (nextStatus: PayrollRunStatus) => {
    if (!selectedRun || selectedRun.status === 'Paid') return
    if (nextStatus === 'In review' && (selectedRun.status !== 'Draft' || needsReview > 0)) return
    if (nextStatus === 'Approved' && (selectedRun.status !== 'In review' || needsReview > 0)) return
    if (nextStatus === 'Paid' && selectedRun.status !== 'Approved') return
    if (nextStatus === 'Approved') {
      const approved = approvePayrollRun(selectedRun, currentUser.name)
      if (approved !== selectedRun) updateRun(selectedRun.id, () => approved)
      return
    }
    if (nextStatus === 'Paid') {
      if (!canPostAdvanceRepayments) {
        setPayrollRepaymentError('Only Human Resource or an Accountant can record payroll-linked salary-advance repayments.')
        return
      }
      setPayrollRepaymentError('')
      try {
        const posted = await Promise.all(selectedRun.payslips.map((slip) => payrollRepaymentMutation.mutateAsync({
          payrollRunId: selectedRun.id,
          payslipId: slip.id,
          employeeId: slip.employeeId,
          periodEnd: selectedRun.periodEnd,
        })))
        const now = new Date().toISOString()
        updateRun(selectedRun.id, (run) => ({
          ...run,
          status: 'Paid',
          updatedAt: now,
          paidAt: now,
          payslips: run.payslips.map((slip) => {
            const repayments = posted.flatMap((result, index) => selectedRun.payslips[index].id === slip.id ? result.repayments : [])
            const advanceDeductions = repayments.map((repayment) => ({
              id: `ADV-REPAY-${repayment.id}`,
              label: `Salary advance repayment · ${repayment.advanceReference}`,
              amount: repayment.amount,
              source: 'Salary advance' as const,
            }))
            const deductions = [...slip.deductions.filter((item) => item.source !== 'Salary advance'), ...advanceDeductions]
            const advanceTotal = advanceDeductions.reduce((total, item) => total + item.amount, 0)
            return {
              ...slip,
              deductions,
              deductionTotal: slip.deductionTotal === undefined ? advanceTotal : slip.deductionTotal + advanceTotal,
              netPay: slip.grossPay === undefined ? slip.netPay : Math.max(0, slip.grossPay - (slip.deductionTotal ?? 0) - advanceTotal),
              paymentStatus: 'Paid',
            }
          }),
        }))
      } catch (error) {
        setPayrollRepaymentError(error instanceof Error ? error.message : 'Salary-advance repayments could not be posted. The payroll run remains approved and unpaid; retrying is safe.')
      }
      return
    }
    const now = new Date().toISOString()
    updateRun(selectedRun.id, (run) => ({
      ...run,
      status: nextStatus,
      updatedAt: now,
      approvedAt: run.approvedAt,
      paidAt: run.paidAt,
      payslips: run.payslips,
    }))
  }

  const deleteDraft = () => {
    if (!selectedRun || selectedRun.status !== 'Draft') return
    if (!window.confirm(`Delete draft ${selectedRun.reference}? This cannot be undone.`)) return
    updateState({ ...state, payrollRuns: state.payrollRuns.filter((run) => run.id !== selectedRun.id) })
    setSelectedRunId(null)
  }

  const exportRun = (run: PayrollRun) => exportCsv(`${run.reference.toLowerCase()}-payslips.csv`, run.payslips.map((slip) => ({
    run: run.reference,
    frequency: run.frequency,
    periodStart: run.periodStart,
    periodEnd: run.periodEnd,
    employeeNumber: slip.employeeNumber,
    employeeName: slip.employeeName,
    category: slip.category,
    department: slip.department,
    payType: slip.compensationType ?? 'Needs setup',
    configuredRateUGX: slip.configuredRate ?? '',
    attendanceUnitsReference: slip.attendanceUnits ?? '',
    reviewStatus: slip.reviewStatus,
    paymentStatus: slip.paymentStatus,
    grossPay: slip.grossPay ?? 'Not calculated',
    deductions: slip.deductionTotal ?? 'Not calculated',
    netPay: slip.netPay ?? 'Not calculated',
  })))

  return <div className="animate-in fade-in duration-300">
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><div className="mb-2 text-xs font-medium text-slate-400">Workspace / HR Department</div><h2 className="text-2xl font-bold tracking-tight">Payroll Management</h2><p className="mt-1 max-w-2xl text-sm text-slate-500">Prepare and review payroll runs by each employee&apos;s configured payment frequency.</p></div>
      <button type="button" onClick={prepareRun} disabled={!employeesForFrequency.length || !validPeriod} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#6d28d9] px-3 py-2.5 text-xs font-semibold text-white hover:bg-[#5b21b6] disabled:cursor-not-allowed disabled:opacity-45"><Icons.Plus className="size-4" />{matchingRuns.length ? 'Open period run' : 'Prepare payroll run'}</button>
    </div>

    <div className="mb-4 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-end sm:justify-between">
      <div><div className="mb-2 text-xs font-semibold text-slate-600">Pay frequency</div><div role="group" aria-label="Payroll frequency" className="inline-flex rounded-lg border border-slate-200 p-0.5"><button type="button" aria-pressed={frequency === 'Monthly'} onClick={() => changeFrequency('Monthly')} className={`rounded-md px-3 py-2 text-xs font-semibold ${frequency === 'Monthly' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>Monthly</button><button type="button" aria-pressed={frequency === 'Weekly'} onClick={() => changeFrequency('Weekly')} className={`rounded-md px-3 py-2 text-xs font-semibold ${frequency === 'Weekly' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>Weekly</button></div></div>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-600">Period start<input aria-label="Payroll period start" type="date" max={period.periodEnd || undefined} value={period.periodStart} onChange={(event) => setPeriod((current) => ({ ...current, periodStart: event.target.value }))} className="mt-1 block rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-normal" /></label><label className="text-xs font-semibold text-slate-600">Period end<input aria-label="Payroll period end" type="date" min={period.periodStart || undefined} value={period.periodEnd} onChange={(event) => setPeriod((current) => ({ ...current, periodEnd: event.target.value }))} className="mt-1 block rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-normal" /></label></div>
    </div>

    <section aria-label="Payroll period summary" className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <PayrollMetric label="Eligible employees" value={employeesForFrequency.length} detail={`${frequency} frequency · active employees`} icon="UsersRound" tone="blue" />
      <PayrollMetric label="Runs in this period" value={periodRuns.length} detail={`${periodRuns.filter((run) => run.status !== 'Paid').length} unpaid run${periodRuns.filter((run) => run.status !== 'Paid').length === 1 ? '' : 's'}`} icon="Files" tone="purple" />
      <PayrollMetric label="Payslips needing review" value={periodReviewCount} detail="Pay setup must be verified" icon="ClipboardCheck" tone="amber" />
      <PayrollMetric label="Paid payslips" value={periodPaidCount} detail="Recorded in saved run snapshots" icon="CircleDollarSign" tone="green" />
    </section>
    {payrollRepaymentError && <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">{payrollRepaymentError}</p>}
    {selectedRun?.status === 'Approved' && !canPostAdvanceRepayments && <p role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">Only Human Resource or an Accountant can record this run as paid because payment posts any due salary-advance deductions.</p>}

    {selectedRun ? <section className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-4 border-b border-slate-100 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div><button type="button" onClick={() => setSelectedRunId(null)} className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-[#6d28d9] hover:underline"><Icons.ArrowLeft className="size-3.5" /> Payroll run history</button><div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-bold">{selectedRun.reference}</h3><span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${statusTone(selectedRun.status)}`}>{selectedRun.status}</span></div><p className="mt-1 text-xs text-slate-500">{selectedRun.frequency} · {formatDate(selectedRun.periodStart)} to {formatDate(selectedRun.periodEnd)} · Created {formatDate(selectedRun.createdAt.slice(0, 10))}</p></div>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => exportRun(selectedRun)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"><Icons.Download className="size-4" /> Export payslips</button>{selectedRun.status === 'Draft' && <button type="button" onClick={deleteDraft} className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"><Icons.Trash2 className="size-4" /> Delete draft</button>}</div>
      </div>
      <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 xl:grid-cols-4"><PayrollValue label="Employees" value={selectedRun.payslips.length} /><PayrollValue label="Needs setup review" value={needsReview} /><PayrollValue label="Gross pay" value="Not calculated" /><PayrollValue label="Net pay" value="Not calculated" /></div>
      <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/70 p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-xs font-semibold text-slate-700">Run workflow</div><p className="mt-1 text-[11px] text-slate-500">Net pay and statutory deductions are not calculated. Recording payment posts due salary-advance repayments first.</p></div><div className="flex flex-wrap gap-2">{selectedRun.status === 'Draft' && <button type="button" disabled={needsReview > 0} onClick={() => transitionRun('In review')} className="rounded-lg bg-[#6d28d9] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Submit for review</button>}{selectedRun.status === 'In review' && <button type="button" disabled={needsReview > 0} onClick={() => transitionRun('Approved')} className="rounded-lg bg-[#6d28d9] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Approve run</button>}{selectedRun.status === 'Approved' && <button type="button" disabled={!canPostAdvanceRepayments || payrollRepaymentMutation.isPending} onClick={() => void transitionRun('Paid')} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45">{payrollRepaymentMutation.isPending ? 'Posting repayments…' : 'Record as paid'}</button>}{selectedRun.status === 'Paid' && <span className="self-center text-xs font-semibold text-emerald-700">Paid {selectedRun.paidAt ? formatDate(selectedRun.paidAt.slice(0, 10)) : ''} · snapshot locked</span>}</div></div>
      {selectedRun.payslips.length ? <div className="overflow-x-auto"><table className="w-full min-w-250 text-left text-xs"><thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-400"><tr>{['Employee snapshot', 'Category / department', 'Pay setup', 'Attendance units', 'Earnings / deductions', 'Review', 'Payment'].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{selectedRun.payslips.map((slip) => <tr key={slip.id} className="border-t border-slate-100 text-slate-600"><td className="px-4 py-3"><div className="font-semibold text-slate-800">{slip.employeeName}</div><div className="mt-1 font-mono text-[10px] text-slate-400">{slip.employeeNumber} · {slip.role}</div></td><td className="px-4 py-3">{slip.category}<span className="mt-1 block text-[10px] text-slate-400">{slip.department}</span></td><td className="px-4 py-3">{slip.compensationType ?? <span className="font-semibold text-amber-700">Pay type missing</span>}<span className="mt-1 block">{slip.configuredRate ? money(slip.configuredRate) : <span className="text-amber-700">Rate missing</span>}</span><span className="mt-1 block text-[10px] text-slate-400">{slip.compensationType === 'Wage earner' ? 'Daily rate reference only' : 'Configured rate · no calculation'}</span></td><td className="px-4 py-3">{slip.attendanceUnits ?? 0}<span className="mt-1 block text-[10px] text-slate-400">Reference only · half-day = 0.5</span></td><td className="px-4 py-3"><div>Earnings: {slip.grossPay === undefined ? 'Not calculated' : money(slip.grossPay)}</div><div className="mt-1">Deductions: {slip.deductionTotal === undefined ? 'Not calculated' : money(slip.deductionTotal)}</div><div className="mt-1 font-semibold text-slate-800">Net: {slip.netPay === undefined ? 'Not calculated' : money(slip.netPay)}</div></td><td className="px-4 py-3"><span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${statusTone(slip.reviewStatus)}`}>{slip.reviewStatus}</span>{selectedRun.status !== 'Paid' && <div className="mt-2">{slip.reviewStatus === 'Needs review' ? <><button type="button" onClick={() => onViewEmployee(slip.employeeId)} className="font-semibold text-[#6d28d9] hover:underline">Review employee setup</button><button type="button" onClick={() => refreshPayslipSetup(slip)} className="ml-2 font-semibold text-slate-500 hover:underline">Refresh snapshot</button></> : <button type="button" onClick={() => setPayslipReview(slip, 'Needs review')} className="font-semibold text-slate-500 hover:underline">Flag for review</button>}</div>}</td><td className="px-4 py-3"><span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${statusTone(slip.paymentStatus)}`}>{slip.paymentStatus}</span></td></tr>)}</tbody></table></div> : <div className="px-5 py-12 text-center"><Icons.UsersRound className="mx-auto size-5 text-slate-300" /><h4 className="mt-2 text-sm font-semibold text-slate-700">No employees in this run</h4><p className="mt-1 text-xs text-slate-500">No active employees have {selectedRun.frequency.toLowerCase()} payment frequency.</p></div>}
      <div className="border-t border-slate-100 px-4 py-3 text-[10px] text-slate-400">Payslip identity and setup values are snapshots from run creation; paid runs cannot be edited.</div>
    </section> : null}

    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 xl:flex-row xl:items-center xl:justify-between"><div><h3 className="text-sm font-bold">Payroll run history</h3><p className="mt-1 text-xs text-slate-400">{state.payrollRuns.length} saved run{state.payrollRuns.length === 1 ? '' : 's'} · totals remain uncalculated</p></div><div className="flex flex-wrap gap-2"><label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><Icons.Search className="size-4 text-slate-400" /><input aria-label="Search payroll runs" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search run or period" className="w-40 bg-transparent text-xs outline-none" /></label><select aria-label="Filter payroll runs by frequency" value={frequencyFilter} onChange={(event) => setFrequencyFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><option>All frequencies</option><option>Monthly</option><option>Weekly</option></select><select aria-label="Filter payroll runs by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><option>All statuses</option><option>Draft</option><option>In review</option><option>Approved</option><option>Paid</option></select></div></div>
      {filteredRuns.length ? <div className="overflow-x-auto"><table className="w-full min-w-190 text-left text-xs"><thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-400"><tr>{['Run', 'Frequency', 'Pay period', 'Employees', 'Review', 'Totals', 'Status', ''].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{filteredRuns.map((run) => <tr key={run.id} className="border-t border-slate-100 text-slate-600 hover:bg-slate-50/70"><td className="px-4 py-3 font-semibold text-slate-800">{run.reference}<span className="mt-1 block font-mono text-[10px] font-normal text-slate-400">Updated {formatDate(run.updatedAt.slice(0, 10))}</span></td><td className="px-4 py-3">{run.frequency}</td><td className="px-4 py-3">{formatDate(run.periodStart)} – {formatDate(run.periodEnd)}</td><td className="px-4 py-3">{run.payslips.length}</td><td className="px-4 py-3">{run.payslips.filter((slip) => slip.reviewStatus === 'Needs review').length} need review</td><td className="px-4 py-3">Not calculated</td><td className="px-4 py-3"><span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${statusTone(run.status)}`}>{run.status}</span></td><td className="px-4 py-3"><button type="button" onClick={() => setSelectedRunId(run.id)} className="inline-flex items-center gap-1 font-semibold text-[#6d28d9] hover:underline">Details <Icons.ChevronRight className="size-3.5" /></button></td></tr>)}</tbody></table></div> : <div className="px-5 py-14 text-center"><span className="mx-auto grid size-10 place-items-center rounded-full bg-slate-100 text-slate-500"><Icons.WalletCards className="size-4" /></span><h4 className="mt-3 text-sm font-semibold text-slate-800">{state.payrollRuns.length ? 'No runs match these filters' : 'No payroll runs yet'}</h4><p className="mx-auto mt-1 max-w-md text-xs text-slate-500">{state.payrollRuns.length ? 'Adjust the search or filters to see saved payroll runs.' : 'Choose a payment frequency and period, then prepare a draft from matching active employees.'}</p></div>}
      <div className="border-t border-slate-100 px-4 py-3 text-[10px] text-slate-400">Showing {filteredRuns.length} of {state.payrollRuns.length} runs · employee category does not determine eligibility</div>
    </section>
  </div>
}

function PayrollMetric({ label, value, detail, icon, tone }: { label: string; value: number; detail: string; icon: string; tone: string }) {
  const Icon = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[icon] || Icons.CircleHelp
  const toneClass = tone === 'green' ? 'bg-emerald-50 text-emerald-700' : tone === 'amber' ? 'bg-amber-50 text-amber-700' : tone === 'purple' ? 'bg-violet-50 text-violet-700' : 'bg-sky-50 text-sky-700'
  return <article className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><span className={`grid size-9 place-items-center rounded-lg ${toneClass}`}><Icon className="size-4" /></span><span className="text-[9px] font-semibold uppercase text-slate-400">Period</span></div><div className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{value}</div><h3 className="mt-0.5 text-xs font-semibold text-slate-700">{label}</h3><p className="mt-1 text-[10px] text-slate-400">{detail}</p></article>
}

function PayrollValue({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg bg-slate-50 px-3 py-2"><div className="text-[10px] text-slate-400">{label}</div><div className="mt-1 text-sm font-bold text-slate-800">{value}</div></div>
}