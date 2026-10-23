'use client'

import { useEffect, useMemo, useState } from 'react'
import * as Icons from 'lucide-react'
import { employeeDisplayName, exportCsv, formatDate, money, type ErpState } from '@/lib/erp'
import {
  useClosePayrollAttendancePeriod,
  useCreatePayrollRun,
  useDecidePayrollRun,
  usePayrollAttendancePeriod,
  usePayrollPolicy,
  usePayrollRun,
  usePayrollRuns,
  useRecalculatePayrollRun,
  useRecordPayrollCashPayment,
  useSubmitPayrollRun,
  useUpdatePayrollPolicy,
} from '@/lib/payroll-queries'
import type { PayrollPolicy, PayrollRun, PayrollRunType, PayrollStatutoryRule } from '@/lib/payroll'
import type { UserAccount } from '@/lib/user-api'
import { hasAnyDepartmentRole, hasDepartmentRole } from '@/lib/authorization'

type PayrollManagementProps = {
  state: ErpState
  initialRunId?: string | null
  currentUser: UserAccount
}

type PayrollSection = PayrollRunType

const sections: Array<{ type: PayrollSection; description: string }> = [
  { type: 'Monthly', description: 'Monthly salaries and applicable statutory deductions. Feeding is handled separately.' },
  { type: 'Weekly wages', description: 'Weekly wage rates multiplied by approved attendance units. Feeding is excluded.' },
  { type: 'Weekly feeding', description: 'Separate weekly cash allowance based on eligible attendance days.' },
]

function companyDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

function monthPeriod(date: string) {
  const month = date.slice(0, 7)
  const [year, monthNumber] = month.split('-').map(Number)
  return { periodStart: `${month}-01`, periodEnd: new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10) }
}

function weekPeriod(date: string, weekStartDay: number) {
  const value = new Date(`${date}T12:00:00.000Z`)
  const difference = (value.getUTCDay() - weekStartDay + 7) % 7
  value.setUTCDate(value.getUTCDate() - difference)
  const periodStart = value.toISOString().slice(0, 10)
  value.setUTCDate(value.getUTCDate() + 6)
  return { periodStart, periodEnd: value.toISOString().slice(0, 10) }
}

function totalFor(run: PayrollRun, key: 'grossPay' | 'netPay' | 'employerContributionTotal') {
  return run.payslips.reduce((sum, slip) => sum + slip[key], 0)
}

function dayName(day: number) {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day] || 'Monday'
}

function statutoryRuleTemplate(): PayrollStatutoryRule {
  return {
    code: `RULE-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
    name: '',
    appliesTo: 'Employee deduction',
    runTypes: ['Monthly'],
    employeeFlag: 'all',
    method: 'Percentage',
    ratePercent: 0,
    bands: [{ upTo: null, ratePercent: 0 }],
    ceiling: null,
    effectiveFrom: companyDate(),
    effectiveTo: '',
  }
}

export default function PayrollManagementPage({ state, initialRunId = null, currentUser }: PayrollManagementProps) {
  const roles = currentUser.roles
  const canRead = hasAnyDepartmentRole(roles, ['Human Resource', 'General Manager', 'Accountant'])
  const canPrepare = hasDepartmentRole(roles, 'Human Resource')
  const canManagerApprove = hasDepartmentRole(roles, 'General Manager')
  const canDirectorApprove = roles.includes('Super Admin')
  const canPay = hasDepartmentRole(roles, 'Accountant')
  const canConfigure = hasDepartmentRole(roles, 'Accountant')
  const [section, setSection] = useState<PayrollSection>('Monthly')
  const [dateAnchor, setDateAnchor] = useState(companyDate)
  const [period, setPeriod] = useState(() => monthPeriod(companyDate()))
  const [selectedRunId, setSelectedRunId] = useState<string | null>(initialRunId)
  const [showPolicy, setShowPolicy] = useState(false)
  const [policyDraft, setPolicyDraft] = useState<PayrollPolicy | null>(null)
  const [attendanceConfirmed, setAttendanceConfirmed] = useState(false)
  const [decisionNote, setDecisionNote] = useState('')
  const [paymentDate, setPaymentDate] = useState(companyDate)
  const [paymentReference, setPaymentReference] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const [historySearch, setHistorySearch] = useState('')
  const [message, setMessage] = useState('')

  const policyQuery = usePayrollPolicy(canRead)
  const runsQuery = usePayrollRuns({ limit: 500 }, canRead)
  const selectedRunQuery = usePayrollRun(selectedRunId, canRead)
  const attendancePeriodQuery = usePayrollAttendancePeriod(period.periodStart, period.periodEnd, canRead)
  const closeAttendanceMutation = useClosePayrollAttendancePeriod()
  const createRunMutation = useCreatePayrollRun()
  const recalculateMutation = useRecalculatePayrollRun()
  const submitMutation = useSubmitPayrollRun()
  const decideMutation = useDecidePayrollRun()
  const paymentMutation = useRecordPayrollCashPayment()
  const policyMutation = useUpdatePayrollPolicy()

  const policy = policyQuery.data?.policy
  const runList = runsQuery.data?.runs ?? []
  const currentRun = selectedRunQuery.data?.run ?? runList.find((run) => run.id === selectedRunId) ?? null
  const sectionRuns = useMemo(
    () => runList
      .filter((run) => run.runType === section)
      .filter((run) => `${run.reference} ${run.payslips.map((slip) => slip.employeeName).join(' ')}`.toLowerCase().includes(historySearch.trim().toLowerCase()))
      .sort((a, b) => b.periodStart.localeCompare(a.periodStart)),
    [runList, section, historySearch],
  )
  const eligibleEmployees = state.employees.filter((employee) => employee.status === 'Active')
  const matchingRun = sectionRuns.find((run) => run.periodStart === period.periodStart && run.periodEnd === period.periodEnd)
  const attendancePeriod = attendancePeriodQuery.data?.period
  const pendingMutation = closeAttendanceMutation.isPending || createRunMutation.isPending
    || recalculateMutation.isPending || submitMutation.isPending || decideMutation.isPending
    || paymentMutation.isPending || policyMutation.isPending
  const loadError = policyQuery.error || runsQuery.error || selectedRunQuery.error || attendancePeriodQuery.error
  const employeeCount = section === 'Monthly'
    ? eligibleEmployees.filter((employee) => employee.compensationType === 'Salary earner' && employee.paymentFrequency === 'Monthly').length
    : section === 'Weekly wages'
      ? eligibleEmployees.filter((employee) => employee.compensationType === 'Wage earner' && employee.paymentFrequency === 'Weekly').length
      : (policy?.feedingAllowance.eligibleEmployeeIds.length ?? 0)

  useEffect(() => {
    if (policy) setPolicyDraft(structuredClone(policy))
  }, [policy])

  useEffect(() => {
    if (initialRunId) setSelectedRunId(initialRunId)
  }, [initialRunId])

  const changeSection = (next: PayrollSection) => {
    setSection(next)
    setSelectedRunId(null)
    const today = companyDate()
    setDateAnchor(today)
    setPeriod(next === 'Monthly' ? monthPeriod(today) : weekPeriod(today, policy?.weekStartDay ?? 1))
    setAttendanceConfirmed(false)
    setMessage('')
  }

  const changeAnchor = (value: string) => {
    setDateAnchor(value)
    setPeriod(section === 'Monthly' ? monthPeriod(value) : weekPeriod(value, policy?.weekStartDay ?? 1))
    setAttendanceConfirmed(false)
  }

  const handleCloseAttendance = async () => {
    setMessage('')
    try {
      await closeAttendanceMutation.mutateAsync({
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        confirmedComplete: true,
      })
      setAttendanceConfirmed(false)
      setMessage('Attendance is certified and locked for this period.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not certify attendance.')
    }
  }

  const handleCreateRun = async () => {
    setMessage('')
    try {
      const result = await createRunMutation.mutateAsync({
        runType: section,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
      })
      setSelectedRunId(result.run.id)
      setMessage('Payroll was calculated from server-backed employee and attendance data.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not calculate payroll.')
    }
  }

  const runAction = async (action: () => Promise<unknown>, success: string) => {
    setMessage('')
    try {
      await action()
      setMessage(success)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Payroll action could not be completed.')
    }
  }

  const savePolicy = async () => {
    if (!policyDraft) return
    setMessage('')
    try {
      const { updatedAt: _updatedAt, updatedByName: _updatedByName, ...payload } = policyDraft
      await policyMutation.mutateAsync(payload)
      setShowPolicy(false)
      setMessage('Payroll policy saved.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save payroll policy.')
    }
  }

  const toggleEligibleEmployee = (employeeId: string) => {
    if (!policyDraft) return
    const selected = policyDraft.feedingAllowance.eligibleEmployeeIds
    setPolicyDraft({
      ...policyDraft,
      feedingAllowance: {
        ...policyDraft.feedingAllowance,
        eligibleEmployeeIds: selected.includes(employeeId)
          ? selected.filter((id) => id !== employeeId)
          : [...selected, employeeId],
      },
    })
  }

  const exportRun = (run: PayrollRun) => exportCsv(`${run.reference.toLowerCase()}-payslips.csv`, run.payslips.map((slip) => ({
    run: run.reference,
    type: run.runType,
    periodStart: run.periodStart,
    periodEnd: run.periodEnd,
    employeeNumber: slip.employeeNumber,
    employeeName: slip.employeeName,
    department: slip.department,
    attendanceUnits: slip.attendanceUnits,
    earnings: slip.earnings.map((line) => `${line.label}: ${line.amount}`).join('; '),
    deductions: slip.deductions.map((line) => `${line.label}: ${line.amount}`).join('; '),
    employerContributions: slip.employerContributions.map((line) => `${line.label}: ${line.amount}`).join('; '),
    grossPay: slip.grossPay,
    deductionTotal: slip.deductionTotal,
    netPay: slip.netPay,
    paymentStatus: slip.paymentStatus,
  })))

  if (!canRead) {
    return <section role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">Your account does not have permission to view payroll records.</section>
  }

  return <div className="animate-in fade-in duration-300">
    <header className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <div className="mb-2 text-xs font-medium text-slate-400">Workspace / HR & Finance</div>
        <h2 className="text-2xl font-bold tracking-tight">Payroll Management</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">Prepare, approve, and record employee pay with backend-calculated, auditable runs.</p>
      </div>
      {canConfigure && <button type="button" onClick={() => { setShowPolicy((value) => !value); setMessage('') }} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Icons.Settings2 className="size-4" /> Payroll policy</button>}
    </header>

    {message && <p role="status" className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-900">{message}</p>}
    {loadError && <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">{loadError instanceof Error ? loadError.message : 'Payroll data could not be loaded.'}</p>}
    {(policyQuery.isLoading || runsQuery.isLoading) && <p role="status" className="mb-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">Loading payroll policy and server records…</p>}

    {showPolicy && policyDraft && <PolicyEditor
      policy={policyDraft}
      employees={eligibleEmployees}
      isSaving={policyMutation.isPending}
      onChange={setPolicyDraft}
      onToggleEmployee={toggleEligibleEmployee}
      onSave={() => void savePolicy()}
      onCancel={() => { setShowPolicy(false); if (policy) setPolicyDraft(structuredClone(policy)) }}
    />}

    <div role="tablist" aria-label="Payroll payout type" className="mb-4 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2">
      {sections.map((item) => <button key={item.type} type="button" role="tab" aria-selected={section === item.type} onClick={() => changeSection(item.type)} className={`rounded-lg px-4 py-2.5 text-xs font-semibold transition-colors ${section === item.type ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{item.type === 'Monthly' ? 'Monthly Payroll' : item.type === 'Weekly wages' ? 'Weekly Wages' : 'Weekly Feeding Allowance'}</button>)}
    </div>

    <p className="mb-4 text-xs text-slate-500">{sections.find((item) => item.type === section)?.description}</p>

    <section aria-label="Pay period and preparation" className="mb-5 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-semibold text-slate-600">{section === 'Monthly' ? 'Payroll month' : 'Choose a date in the work week'}
            <input aria-label={section === 'Monthly' ? 'Payroll month' : 'Date in payroll week'} type={section === 'Monthly' ? 'month' : 'date'} value={section === 'Monthly' ? dateAnchor.slice(0, 7) : dateAnchor} onChange={(event) => changeAnchor(section === 'Monthly' ? `${event.target.value}-01` : event.target.value)} className="mt-1 block rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-normal" />
          </label>
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700"><span className="font-semibold">Period:</span> {period.periodStart} to {period.periodEnd}</div>
          {section !== 'Monthly' && <span className="text-[10px] text-slate-400">Week starts {dayName(policy?.weekStartDay ?? 1)} · attendance cutoff {policy?.attendanceCutoffDelayDays ?? 1} day(s) after period end</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {attendancePeriod?.status === 'Closed'
            ? <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"><Icons.LockKeyhole className="size-3.5" /> Attendance certified</span>
            : canPrepare && <button type="button" disabled={!attendanceConfirmed || closeAttendanceMutation.isPending} onClick={() => void handleCloseAttendance()} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 disabled:cursor-not-allowed disabled:opacity-50">{closeAttendanceMutation.isPending ? 'Certifying…' : 'Certify attendance'}</button>}
          {canPrepare && !matchingRun && <button type="button" disabled={pendingMutation || attendancePeriod?.status !== 'Closed'} onClick={() => void handleCreateRun()} className="inline-flex items-center gap-2 rounded-lg bg-[#6d28d9] px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-[#5b21b6] disabled:cursor-not-allowed disabled:opacity-45"><Icons.Calculator className="size-4" />{createRunMutation.isPending ? 'Calculating…' : 'Calculate run'}</button>}
          {canPrepare && matchingRun && !selectedRunId && <button type="button" onClick={() => setSelectedRunId(matchingRun.id)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Open existing run</button>}
        </div>
      </div>
      {canPrepare && attendancePeriod?.status !== 'Closed' && <label className="mt-4 flex items-start gap-2 text-[11px] leading-4 text-slate-600"><input type="checkbox" checked={attendanceConfirmed} onChange={(event) => setAttendanceConfirmed(event.target.checked)} className="mt-0.5 accent-violet-700" />I confirm attendance for this complete period has been reviewed, and missing days have been resolved before locking it for payroll.</label>}
      {!attendancePeriodQuery.isLoading && !attendancePeriod && <p className="mt-3 text-[11px] text-amber-800">Attendance must be certified and locked for this exact period before calculating a run. Certification prevents later edits unless a Super Admin reopens it.</p>}
      {section === 'Weekly feeding' && <div className="mt-3 rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-[11px] text-violet-900">Feeding is a separate weekly cash payout. It is never included in monthly salary or weekly wage totals.</div>}
    </section>

    <section aria-label={`${section} summary`} className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Eligible employees" value={employeeCount} detail={section} icon="UsersRound" />
      <Metric label="Runs in history" value={sectionRuns.length} detail="Backend-persisted runs" icon="Files" />
      <Metric label="Awaiting approval" value={sectionRuns.filter((run) => ['In review', 'Manager approved'].includes(run.status)).length} detail="Manager then Director" icon="ClipboardCheck" />
      <Metric label="Paid runs" value={sectionRuns.filter((run) => run.status === 'Paid').length} detail="Recorded cash payout" icon="CircleDollarSign" />
    </section>

    {selectedRunId && currentRun && <RunDetails
      run={currentRun}
      decisionNote={decisionNote}
      setDecisionNote={setDecisionNote}
      paymentDate={paymentDate}
      setPaymentDate={setPaymentDate}
      paymentReference={paymentReference}
      setPaymentReference={setPaymentReference}
      paymentNote={paymentNote}
      setPaymentNote={setPaymentNote}
      busy={pendingMutation}
      canPrepare={canPrepare}
      canManagerApprove={canManagerApprove}
      canDirectorApprove={canDirectorApprove}
      canPay={canPay}
      onClose={() => setSelectedRunId(null)}
      onExport={() => exportRun(currentRun)}
      onRecalculate={() => void runAction(() => recalculateMutation.mutateAsync(currentRun.id), 'Payroll recalculated from current certified sources.')}
      onSubmit={() => void runAction(() => submitMutation.mutateAsync(currentRun.id), 'Payroll submitted for General Manager approval.')}
      onDecision={(decision) => void runAction(() => decideMutation.mutateAsync({ id: currentRun.id, decision, note: decisionNote }), decision === 'Approved' ? 'Approval recorded.' : 'Run returned to HR for correction.')}
      onPayment={() => void runAction(() => paymentMutation.mutateAsync({ id: currentRun.id, date: paymentDate, reference: paymentReference, note: paymentNote }), 'Cash payment recorded.')}
    />}
    {selectedRunId && selectedRunQuery.isLoading && <p role="status" className="mb-5 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Loading payroll run…</p>}
    {selectedRunId && selectedRunQuery.isError && !currentRun && <p role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{selectedRunQuery.error instanceof Error ? selectedRunQuery.error.message : 'Payroll run could not be loaded.'}</p>}

    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <header className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h3 className="text-sm font-bold">{section === 'Monthly' ? 'Monthly payroll history' : section === 'Weekly wages' ? 'Weekly wage history' : 'Weekly feeding payout history'}</h3><p className="mt-1 text-xs text-slate-400">{sectionRuns.length} server-recorded runs</p></div>
        <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><Icons.Search className="size-4 text-slate-400" /><input aria-label="Search payroll history" value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} placeholder="Search reference or employee" className="w-48 bg-transparent text-xs outline-none" /></label>
      </header>
      {runsQuery.isLoading ? <div role="status" className="px-5 py-12 text-center text-xs text-slate-500">Loading runs…</div>
        : sectionRuns.length ? <div className="overflow-x-auto"><table className="w-full min-w-200 text-left text-xs">
          <thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-400"><tr>{['Reference', 'Period', 'Employees', 'Gross', 'Net payout', 'Status', ''].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead>
          <tbody>{sectionRuns.map((run) => {
            return <tr key={run.id} className="border-t border-slate-100 text-slate-600 hover:bg-slate-50/70">
              <td className="px-4 py-3 font-semibold text-slate-800">{run.reference}<span className="mt-1 block text-[10px] font-normal text-slate-400">{run.createdBy}</span></td>
              <td className="px-4 py-3">{formatDate(run.periodStart)} – {formatDate(run.periodEnd)}</td>
              <td className="px-4 py-3">{run.payslips.length}</td>
              <td className="px-4 py-3">{money(totalFor(run, 'grossPay'))}</td>
              <td className="px-4 py-3 font-semibold">{money(totalFor(run, 'netPay'))}</td>
              <td className="px-4 py-3"><StatusBadge status={run.status} /></td>
              <td className="px-4 py-3"><button type="button" onClick={() => setSelectedRunId(run.id)} className="font-semibold text-primary hover:underline">Details</button></td>
            </tr>
          })}</tbody>
        </table></div>
        : <div className="px-5 py-14 text-center"><Icons.WalletCards className="mx-auto size-5 text-slate-300" /><h4 className="mt-3 text-sm font-semibold text-slate-800">No runs yet</h4><p className="mt-1 text-xs text-slate-500">Certify attendance for a completed period to calculate the first {section.toLowerCase()} run.</p></div>}
      <div className="border-t border-slate-100 px-4 py-3 text-[10px] text-slate-400">Payroll data is loaded from the server. Client-local historical runs are kept separate and are not imported.</div>
    </section>

    {state.payrollRuns.length > 0 && <details className="mt-5 rounded-xl border border-amber-200 bg-amber-50">
      <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-amber-900">Legacy browser payroll history ({state.payrollRuns.length}) · read-only, not verified or imported</summary>
      <div className="overflow-x-auto border-t border-amber-200"><table className="w-full min-w-150 text-left text-xs"><thead className="text-[10px] uppercase text-amber-800"><tr>{['Reference', 'Frequency', 'Period', 'Employees', 'Legacy status'].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{state.payrollRuns.map((run) => <tr key={run.id} className="border-t border-amber-100"><td className="px-4 py-3 font-semibold">{run.reference}</td><td className="px-4 py-3">{run.frequency}</td><td className="px-4 py-3">{run.periodStart} – {run.periodEnd}</td><td className="px-4 py-3">{run.payslips.length}</td><td className="px-4 py-3">{run.status} · local snapshot</td></tr>)}</tbody></table></div>
    </details>}
  </div>
}

function PolicyEditor({ policy, employees, isSaving, onChange, onToggleEmployee, onSave, onCancel }: {
  policy: PayrollPolicy
  employees: ErpState['employees']
  isSaving: boolean
  onChange: (policy: PayrollPolicy) => void
  onToggleEmployee: (id: string) => void
  onSave: () => void
  onCancel: () => void
}) {
  const updateRule = (index: number, update: Partial<PayrollStatutoryRule>) => onChange({
    ...policy,
    statutoryRules: policy.statutoryRules.map((rule, current) => current === index ? { ...rule, ...update } : rule),
  })
  return <section aria-label="Payroll policy editor" className="mb-5 rounded-xl border border-violet-200 bg-white p-4">
    <header className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-bold">Payroll policy</h3><p className="mt-1 text-xs text-slate-500">Configure weekly periods, feeding eligibility/rates, and accountant-approved statutory rules. No statutory rates are assumed by the system.</p></div><button type="button" aria-label="Close payroll policy" onClick={onCancel} className="rounded-md p-1 text-slate-400 hover:bg-slate-100"><Icons.X className="size-4" /></button></header>
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      <label className="text-xs font-semibold text-slate-600">Week starts on<select value={policy.weekStartDay} onChange={(event) => onChange({ ...policy, weekStartDay: Number(event.target.value) })} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal">{['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label>
      <label className="text-xs font-semibold text-slate-600">Attendance cutoff delay (days)<input type="number" min={0} max={14} value={policy.attendanceCutoffDelayDays} onChange={(event) => onChange({ ...policy, attendanceCutoffDelayDays: Number(event.target.value) })} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal" /></label>
      <label className="text-xs font-semibold text-slate-600 md:col-span-2">Company default feeding allowance per eligible day (UGX)<input type="number" min={0} step={1} value={policy.feedingAllowance.defaultDailyRate} onChange={(event) => onChange({ ...policy, feedingAllowance: { ...policy.feedingAllowance, defaultDailyRate: Number(event.target.value) } })} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal" /></label>
    </div>
    <fieldset className="mt-5 rounded-lg border border-slate-200 p-3">
      <legend className="px-1 text-xs font-bold text-slate-700">Employees eligible for weekly feeding cash payout</legend>
      <div className="mt-2 grid max-h-44 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">{employees.map((employee) => <label key={employee.id} className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={policy.feedingAllowance.eligibleEmployeeIds.includes(employee.id)} onChange={() => onToggleEmployee(employee.id)} className="accent-violet-700" />{employeeDisplayName(employee)} <span className="text-[10px] text-slate-400">{employee.number}</span></label>)}</div>
    </fieldset>
    <fieldset className="mt-5 rounded-lg border border-slate-200 p-3">
      <legend className="px-1 text-xs font-bold text-slate-700">Employee-specific feeding rate overrides</legend>
      {policy.feedingAllowance.employeeOverrides.map((override, index) => <div key={`${override.employeeId}-${index}`} className="mt-2 grid gap-2 sm:grid-cols-[1fr_150px_150px_150px_auto]">
        <select aria-label="Override employee" value={override.employeeId} onChange={(event) => onChange({ ...policy, feedingAllowance: { ...policy.feedingAllowance, employeeOverrides: policy.feedingAllowance.employeeOverrides.map((item, current) => current === index ? { ...item, employeeId: event.target.value } : item) } })} className="rounded-lg border border-slate-200 px-2 py-2 text-xs">{employees.map((employee) => <option key={employee.id} value={employee.id}>{employeeDisplayName(employee)}</option>)}</select>
        <input aria-label="Override daily rate" type="number" min={0} value={override.dailyRate} onChange={(event) => onChange({ ...policy, feedingAllowance: { ...policy.feedingAllowance, employeeOverrides: policy.feedingAllowance.employeeOverrides.map((item, current) => current === index ? { ...item, dailyRate: Number(event.target.value) } : item) } })} className="rounded-lg border border-slate-200 px-2 py-2 text-xs" />
        <input aria-label="Override effective from" type="date" value={override.effectiveFrom} onChange={(event) => onChange({ ...policy, feedingAllowance: { ...policy.feedingAllowance, employeeOverrides: policy.feedingAllowance.employeeOverrides.map((item, current) => current === index ? { ...item, effectiveFrom: event.target.value } : item) } })} className="rounded-lg border border-slate-200 px-2 py-2 text-xs" />
        <input aria-label="Override effective to" type="date" value={override.effectiveTo} onChange={(event) => onChange({ ...policy, feedingAllowance: { ...policy.feedingAllowance, employeeOverrides: policy.feedingAllowance.employeeOverrides.map((item, current) => current === index ? { ...item, effectiveTo: event.target.value } : item) } })} className="rounded-lg border border-slate-200 px-2 py-2 text-xs" />
        <button type="button" aria-label="Remove feeding rate override" onClick={() => onChange({ ...policy, feedingAllowance: { ...policy.feedingAllowance, employeeOverrides: policy.feedingAllowance.employeeOverrides.filter((_, current) => current !== index) } })} className="rounded-lg p-2 text-rose-700 hover:bg-rose-50"><Icons.Trash2 className="size-4" /></button>
      </div>)}
      <button type="button" disabled={!employees.length} onClick={() => {
        const available = employees.find((employee) => !policy.feedingAllowance.employeeOverrides.some((item) => item.employeeId === employee.id))
        if (!available) return
        onChange({ ...policy, feedingAllowance: { ...policy.feedingAllowance, employeeOverrides: [...policy.feedingAllowance.employeeOverrides, { employeeId: available.id, dailyRate: policy.feedingAllowance.defaultDailyRate, effectiveFrom: companyDate(), effectiveTo: '' }] } })
      }} className="mt-3 text-xs font-semibold text-primary hover:underline">Add employee override</button>
    </fieldset>
    <fieldset className="mt-5 space-y-3 rounded-lg border border-slate-200 p-3">
      <legend className="px-1 text-xs font-bold text-slate-700">Accountant-configured statutory rules</legend>
      {policy.statutoryRules.map((rule, index) => <div key={`${rule.code}-${index}`} className="rounded-lg bg-slate-50 p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-[10px] font-semibold text-slate-600">Rule code<input value={rule.code} onChange={(event) => updateRule(index, { code: event.target.value })} className="mt-1 block w-full rounded border border-slate-200 px-2 py-1.5 text-xs font-normal" /></label>
          <label className="text-[10px] font-semibold text-slate-600">Rule name<input value={rule.name} onChange={(event) => updateRule(index, { name: event.target.value })} className="mt-1 block w-full rounded border border-slate-200 px-2 py-1.5 text-xs font-normal" /></label>
          <label className="text-[10px] font-semibold text-slate-600">Treatment<select value={rule.appliesTo} onChange={(event) => updateRule(index, { appliesTo: event.target.value as PayrollStatutoryRule['appliesTo'] })} className="mt-1 block w-full rounded border border-slate-200 px-2 py-1.5 text-xs font-normal"><option>Employee deduction</option><option>Employer contribution</option></select></label>
          <label className="text-[10px] font-semibold text-slate-600">Applies to<select value={rule.employeeFlag} onChange={(event) => updateRule(index, { employeeFlag: event.target.value as PayrollStatutoryRule['employeeFlag'] })} className="mt-1 block w-full rounded border border-slate-200 px-2 py-1.5 text-xs font-normal"><option value="all">All employees</option><option value="taxApplies">Tax flag enabled</option><option value="nssfApplies">NSSF flag enabled</option></select></label>
          <label className="text-[10px] font-semibold text-slate-600">Calculation<select value={rule.method} onChange={(event) => updateRule(index, { method: event.target.value as PayrollStatutoryRule['method'] })} className="mt-1 block w-full rounded border border-slate-200 px-2 py-1.5 text-xs font-normal"><option>Percentage</option><option>Progressive</option></select></label>
          {rule.method === 'Percentage'
            ? <label className="text-[10px] font-semibold text-slate-600">Rate (%)<input type="number" min={0} max={100} step="0.01" value={rule.ratePercent} onChange={(event) => updateRule(index, { ratePercent: Number(event.target.value) })} className="mt-1 block w-full rounded border border-slate-200 px-2 py-1.5 text-xs font-normal" /></label>
            : <div className="text-[10px] font-semibold text-slate-600 sm:col-span-2">Progressive bands (UGX threshold : percent)<textarea aria-label={`${rule.name || rule.code} progressive bands`} value={rule.bands.map((band) => `${band.upTo ?? '∞'}:${band.ratePercent}`).join('\n')} onChange={(event) => {
              const bands = event.target.value.split('\n').filter(Boolean).map((row) => {
                const [limit, rate] = row.split(':')
                return { upTo: limit.trim() === '∞' ? null : Number(limit), ratePercent: Number(rate) }
              })
              updateRule(index, { bands })
            }} rows={3} className="mt-1 block w-full rounded border border-slate-200 px-2 py-1.5 text-xs font-normal" placeholder={'100000:0\n∞:10'} /></div>}
          <label className="text-[10px] font-semibold text-slate-600">Effective from<input type="date" value={rule.effectiveFrom} onChange={(event) => updateRule(index, { effectiveFrom: event.target.value })} className="mt-1 block w-full rounded border border-slate-200 px-2 py-1.5 text-xs font-normal" /></label>
          <label className="text-[10px] font-semibold text-slate-600">Effective to<input type="date" value={rule.effectiveTo} onChange={(event) => updateRule(index, { effectiveTo: event.target.value })} className="mt-1 block w-full rounded border border-slate-200 px-2 py-1.5 text-xs font-normal" /></label>
        </div>
        <div className="mt-2 flex flex-wrap gap-3">{(['Monthly', 'Weekly wages', 'Weekly feeding'] as const).map((type) => <label key={type} className="flex items-center gap-1.5 text-[10px] text-slate-600"><input type="checkbox" checked={rule.runTypes.includes(type)} onChange={(event) => updateRule(index, { runTypes: event.target.checked ? [...rule.runTypes, type] : rule.runTypes.filter((item) => item !== type) })} className="accent-violet-700" />{type}</label>)}</div>
        <button type="button" onClick={() => onChange({ ...policy, statutoryRules: policy.statutoryRules.filter((_, current) => current !== index) })} className="mt-2 text-[10px] font-semibold text-rose-700 hover:underline">Remove rule</button>
      </div>)}
      <button type="button" onClick={() => onChange({ ...policy, statutoryRules: [...policy.statutoryRules, statutoryRuleTemplate()] })} className="text-xs font-semibold text-primary hover:underline">Add statutory rule</button>
      <p className="text-[10px] leading-4 text-amber-800">Enter values approved by the company accountant. This configuration tool does not determine applicable law or tax rates.</p>
    </fieldset>
    <footer className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Cancel</button><button type="button" disabled={isSaving} onClick={onSave} className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">{isSaving ? 'Saving…' : 'Save policy'}</button></footer>
  </section>
}

function RunDetails({ run, decisionNote, setDecisionNote, paymentDate, setPaymentDate, paymentReference, setPaymentReference, paymentNote, setPaymentNote, busy, canPrepare, canManagerApprove, canDirectorApprove, canPay, onClose, onExport, onRecalculate, onSubmit, onDecision, onPayment }: {
  run: PayrollRun
  decisionNote: string
  setDecisionNote: (value: string) => void
  paymentDate: string
  setPaymentDate: (value: string) => void
  paymentReference: string
  setPaymentReference: (value: string) => void
  paymentNote: string
  setPaymentNote: (value: string) => void
  busy: boolean
  canPrepare: boolean
  canManagerApprove: boolean
  canDirectorApprove: boolean
  canPay: boolean
  onClose: () => void
  onExport: () => void
  onRecalculate: () => void
  onSubmit: () => void
  onDecision: (decision: 'Approved' | 'Returned') => void
  onPayment: () => void
}) {
  const totalGross = totalFor(run, 'grossPay')
  const totalNet = totalFor(run, 'netPay')
  const totalEmployer = totalFor(run, 'employerContributionTotal')
  const nextApproval = run.status === 'In review' && canManagerApprove
    ? 'General Manager'
    : run.status === 'Manager approved' && canDirectorApprove
      ? 'Super Admin / Director'
      : null
  return <section className="mb-5 overflow-hidden rounded-xl border border-violet-200 bg-white">
    <header className="flex flex-col gap-4 border-b border-slate-100 p-4 sm:flex-row sm:items-start sm:justify-between">
      <div><button type="button" onClick={onClose} className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"><Icons.ArrowLeft className="size-3.5" /> Run history</button><div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-bold">{run.reference}</h3><StatusBadge status={run.status} /></div><p className="mt-1 text-xs text-slate-500">{run.runType} · {formatDate(run.periodStart)} to {formatDate(run.periodEnd)} · Prepared by {run.createdBy}</p></div>
      <button type="button" onClick={onExport} className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"><Icons.Download className="size-4" /> Export payslips</button>
    </header>
    <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 xl:grid-cols-4">
      <Value label="Employees" value={run.payslips.length} />
      <Value label="Gross earnings" value={money(totalGross)} />
      <Value label="Net cash payout" value={money(totalNet)} />
      <Value label="Employer contributions" value={money(totalEmployer)} />
    </div>
    <div className="border-b border-slate-100 bg-slate-50/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-xs font-semibold text-slate-800">Workflow</div><p className="mt-1 text-[11px] text-slate-500">HR prepares → General Manager approves → Super Admin/Director approves → Accountant records cash payout.</p></div>
        {run.status === 'Draft' && canPrepare && <button type="button" disabled={busy} onClick={onRecalculate} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">Recalculate draft</button>}
        {run.status === 'Returned' && canPrepare && <button type="button" disabled={busy} onClick={onRecalculate} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">Recalculate after return</button>}
        {(run.status === 'Draft' || run.status === 'Returned') && canPrepare && <button type="button" disabled={busy} onClick={onSubmit} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">Submit for approval</button>}
        {nextApproval && <div className="flex flex-wrap items-end gap-2"><label className="text-[10px] font-semibold text-slate-600">Approval note<textarea value={decisionNote} onChange={(event) => setDecisionNote(event.target.value)} rows={2} className="mt-1 block w-56 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-normal" placeholder="Required if returning" /></label><button type="button" disabled={busy || !decisionNote.trim()} onClick={() => onDecision('Returned')} className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-40">Return for correction</button><button type="button" disabled={busy} onClick={() => onDecision('Approved')} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Approve as {nextApproval}</button></div>}
        {run.status === 'Approved' && canPay && <div className="flex flex-wrap items-end gap-2"><label className="text-[10px] font-semibold text-slate-600">Cash payment date<input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-normal" /></label><label className="text-[10px] font-semibold text-slate-600">Receipt/reference<input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-normal" /></label><label className="text-[10px] font-semibold text-slate-600">Payment note<input value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-normal" /></label><button type="button" disabled={busy} onClick={onPayment} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Record {money(totalNet)} cash payout</button></div>}
        {run.status === 'Approved' && !canPay && <p className="text-xs text-amber-800">Awaiting an Accountant to record cash payment.</p>}
      </div>
      {run.returnedNote && <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-800">Returned: {run.returnedNote}</p>}
      {run.payment && <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Paid in cash: {money(run.payment.amount)} · {formatDate(run.payment.date)} · {run.payment.recordedByName} {run.payment.reference && `· ${run.payment.reference}`}</p>}
      <div className="mt-3 flex flex-wrap gap-2">{run.approvals.map((approval, index) => <span key={`${approval.stage}-${index}`} className="rounded-md bg-white px-2 py-1 text-[10px] text-slate-600">{approval.stage}: {approval.decision} by {approval.actorName}{approval.note && ` · ${approval.note}`}</span>)}</div>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-240 text-left text-xs">
        <thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-400"><tr>{['Employee', 'Attendance', 'Earnings', 'Deductions', 'Employer contributions', 'Gross', 'Net', 'Payment'].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead>
        <tbody>{run.payslips.map((slip) => <tr key={slip.id} className="border-t border-slate-100 align-top text-slate-600">
          <td className="px-4 py-3"><div className="font-semibold text-slate-800">{slip.employeeName}</div><div className="mt-1 text-[10px] text-slate-400">{slip.employeeNumber} · {slip.department}</div><div className="mt-1 text-[10px] text-slate-400">{slip.compensationType} · rate {money(slip.configuredRate)}</div></td>
          <td className="px-4 py-3"><div>{slip.attendanceUnits} units</div><details className="mt-1"><summary className="cursor-pointer text-[10px] text-primary">Show {slip.attendance.length} records</summary><ul className="mt-1 space-y-1">{slip.attendance.map((record) => <li key={record.date}>{record.date}: {record.status} ({record.units})</li>)}</ul></details></td>
          <td className="px-4 py-3">{slip.earnings.map((item) => <div key={`${item.code}-${item.label}`} className="mb-1">{item.label}: <span className="font-semibold">{money(item.amount)}</span></div>)}</td>
          <td className="px-4 py-3">{slip.deductions.length ? slip.deductions.map((item) => <div key={`${item.code}-${item.label}`} className="mb-1">{item.label}: <span className="font-semibold">{money(item.amount)}</span></div>) : '—'}</td>
          <td className="px-4 py-3">{slip.employerContributions.length ? slip.employerContributions.map((item) => <div key={`${item.code}-${item.label}`} className="mb-1">{item.label}: {money(item.amount)}</div>) : '—'}</td>
          <td className="px-4 py-3 font-semibold">{money(slip.grossPay)}</td><td className="px-4 py-3 font-semibold text-slate-900">{money(slip.netPay)}</td><td className="px-4 py-3"><StatusBadge status={slip.paymentStatus} /></td>
        </tr>)}</tbody>
      </table>
    </div>
    <footer className="border-t border-slate-100 px-4 py-3 text-[10px] text-slate-400">Calculation snapshot {run.calculationSnapshot.currency} · attendance certified by {run.calculationSnapshot.attendanceClosedByName} · hash {run.calculationSnapshot && JSON.stringify(run.calculationSnapshot).length ? 'stored' : 'unavailable'} · created {formatDate(run.createdAt.slice(0, 10))}</footer>
  </section>
}

function StatusBadge({ status }: { status: string }) {
  const tone = ['Paid', 'Approved', 'Manager approved', 'Ready'].includes(status)
    ? 'bg-emerald-50 text-emerald-700'
    : ['Draft', 'Returned', 'Needs review', 'In review'].includes(status)
      ? 'bg-amber-50 text-amber-800'
      : 'bg-slate-100 text-slate-600'
  return <span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${tone}`}>{status}</span>
}

function Metric({ label, value, detail, icon }: { label: string; value: number; detail: string; icon: string }) {
  const icons = { UsersRound: Icons.UsersRound, Files: Icons.Files, ClipboardCheck: Icons.ClipboardCheck, CircleDollarSign: Icons.CircleDollarSign }
  const Icon = icons[icon as keyof typeof icons]
  return <article className="rounded-xl border border-slate-200 bg-white p-4"><span className="grid size-9 place-items-center rounded-lg bg-violet-50 text-violet-700"><Icon className="size-4" /></span><div className="mt-3 text-2xl font-bold text-slate-900">{value}</div><h3 className="mt-0.5 text-xs font-semibold text-slate-700">{label}</h3><p className="mt-1 text-[10px] text-slate-400">{detail}</p></article>
}

function Value({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg bg-slate-50 px-3 py-2"><div className="text-[10px] text-slate-400">{label}</div><div className="mt-1 text-sm font-bold text-slate-800">{value}</div></div>
}
