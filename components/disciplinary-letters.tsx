'use client'

import { useEffect, useState } from 'react'
import * as Icons from 'lucide-react'
import {
  ApiError,
  getDisciplinaryEvidenceDownload,
  type DisciplinaryApproverAssignments,
  type DisciplinaryApproverStage,
  type DisciplinaryCase,
  type DisciplinaryCaseInput,
  type DisciplinaryLetterType,
  type DisciplinaryPolicy,
  type UserAccount,
} from '@/lib/user-api'
import {
  useAcknowledgeDisciplinaryLetter,
  useCreateDisciplinaryCase,
  useDecideDisciplinaryApproval,
  useDisciplinaryApprovers,
  useDisciplinaryCases,
  useDisciplinaryPolicy,
  useIssueDisciplinaryCase,
  useMyDisciplinaryCases,
  useRecordDisciplinaryNoResponse,
  useRecordDisciplinaryOfflineResponse,
  useRemoveDisciplinaryEvidence,
  useRequestDisciplinaryResponse,
  useResolveDisciplinaryAppeal,
  useRescindDisciplinaryCase,
  useSubmitDisciplinaryAppeal,
  useSubmitDisciplinaryCaseForApproval,
  useSubmitDisciplinaryEmployeeResponse,
  useUpdateDisciplinaryCase,
  useUpdateDisciplinaryPolicy,
  useUploadDisciplinaryEvidence,
} from '@/lib/disciplinary-queries'
import { employeeDisplayName, type ErpState } from '@/lib/erp'
import { hasAnyDepartmentRole, hasDepartmentRole } from '@/lib/authorization'

const letterTypes: DisciplinaryLetterType[] = ['Written warning', 'Suspension', 'Termination']
const approvalStages: Array<{ role: DisciplinaryApproverStage; field: keyof DisciplinaryApproverAssignments }> = [
  { role: 'Human Resource', field: 'humanResource' },
  { role: 'General Manager', field: 'generalManager' },
  { role: 'Super Admin', field: 'superAdmin' },
]

type ComposerValues = DisciplinaryCaseInput

function dateAfterDays(days: number) {
  const date = new Date(`${companyDate()}T12:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function companyDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Kampala',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function suggestedReason(type: DisciplinaryLetterType) {
  if (type === 'Written warning') return 'Describe the specific observed conduct or performance concern, relevant dates, and facts reviewed. Avoid conclusions that have not been established.'
  if (type === 'Suspension') return 'Describe the specific reason for considering suspension, the facts reviewed, and why this action is being considered. Do not state an unverified allegation as a finding.'
  return 'Describe the specific grounds being considered, the facts reviewed, and applicable policy or contractual provisions. Do not state an unverified allegation as a finding.'
}

function emptyComposer(employeeId = '', signatory = '', responseRequired = true): ComposerValues {
  return {
    employeeId,
    type: 'Written warning',
    incidentDate: companyDate(),
    allegation: '',
    reason: suggestedReason('Written warning'),
    expectations: '',
    signatory,
    responseRequired,
    assignedApprovers: { humanResource: '', generalManager: '', superAdmin: '' },
  }
}

function asMessage(error: unknown) {
  return error instanceof ApiError || error instanceof Error
    ? error.message
    : 'The disciplinary action could not be completed.'
}

export default function DisciplinaryLettersPage({ state, currentUser }: { state: ErpState; currentUser: UserAccount }) {
  const roles = currentUser.roles
  const isHr = hasDepartmentRole(roles, 'Human Resource')
  const isSuperAdmin = roles.includes('Super Admin')
  const canReview = hasAnyDepartmentRole(roles, ['Human Resource', 'General Manager'])
  const activeEmployees = state.employees.filter((employee) => employee.status === 'Active')
  const caseQuery = useDisciplinaryCases(canReview)
  const employeeCaseQuery = useMyDisciplinaryCases(true)
  const approversQuery = useDisciplinaryApprovers(isHr)
  const policyQuery = useDisciplinaryPolicy(true)
  const createMutation = useCreateDisciplinaryCase()
  const updateMutation = useUpdateDisciplinaryCase()
  const requestResponseMutation = useRequestDisciplinaryResponse()
  const noResponseMutation = useRecordDisciplinaryNoResponse()
  const offlineResponseMutation = useRecordDisciplinaryOfflineResponse()
  const submitForApprovalMutation = useSubmitDisciplinaryCaseForApproval()
  const decisionMutation = useDecideDisciplinaryApproval()
  const issueMutation = useIssueDisciplinaryCase()
  const employeeResponseMutation = useSubmitDisciplinaryEmployeeResponse()
  const acknowledgementMutation = useAcknowledgeDisciplinaryLetter()
  const appealMutation = useSubmitDisciplinaryAppeal()
  const appealResolutionMutation = useResolveDisciplinaryAppeal()
  const rescindMutation = useRescindDisciplinaryCase()
  const evidenceUploadMutation = useUploadDisciplinaryEvidence()
  const evidenceRemoveMutation = useRemoveDisciplinaryEvidence()
  const policyUpdateMutation = useUpdateDisciplinaryPolicy()
  const [showComposer, setShowComposer] = useState(false)
  const [editingCaseId, setEditingCaseId] = useState('')
  const [composer, setComposer] = useState<ComposerValues>(() => emptyComposer('', currentUser.name))
  const [responseTexts, setResponseTexts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [policyDraft, setPolicyDraft] = useState<DisciplinaryPolicy | null>(null)

  useEffect(() => {
    if (!approversQuery.data) return
    setComposer((current) => {
      const assignedApprovers = { ...current.assignedApprovers }
      const used = new Set([currentUser.id, ...Object.values(assignedApprovers).filter(Boolean)])
      for (const stage of approvalStages) {
        if (assignedApprovers[stage.field]) continue
        assignedApprovers[stage.field] = approversQuery.data.candidates[stage.role]
          ?.find((candidate) => !used.has(candidate.id))?.id || ''
        if (assignedApprovers[stage.field]) used.add(assignedApprovers[stage.field])
      }
      return { ...current, assignedApprovers }
    })
  }, [approversQuery.data, currentUser.id])

  useEffect(() => {
    if (policyQuery.data) setPolicyDraft(policyQuery.data.policy)
  }, [policyQuery.data])

  const perform = async (action: () => Promise<unknown>, successMessage: string) => {
    setError('')
    setSuccess('')
    setBusy(true)
    try {
      await action()
      setSuccess(successMessage)
    } catch (actionError) {
      setError(asMessage(actionError))
    } finally {
      setBusy(false)
    }
  }

  const openNewComposer = () => {
    setEditingCaseId('')
    const assignedApprovers: DisciplinaryApproverAssignments = {
      humanResource: '',
      generalManager: '',
      superAdmin: '',
    }
    const used = new Set([currentUser.id])
    for (const stage of approvalStages) {
      const candidate = approversQuery.data?.candidates[stage.role]
        ?.find((item) => !used.has(item.id))
      if (candidate) {
        assignedApprovers[stage.field] = candidate.id
        used.add(candidate.id)
      }
    }
    const type = 'Written warning'
    setComposer({
      ...emptyComposer(
        activeEmployees[0]?.id || '',
        currentUser.name,
        policyQuery.data?.policy.responseRules[type].required ?? true,
      ),
      assignedApprovers,
    })
    setShowComposer(true)
    setError('')
  }

  const openEditComposer = (caseRecord: DisciplinaryCase) => {
    setEditingCaseId(caseRecord.id)
    setComposer({
      employeeId: caseRecord.employeeId,
      type: caseRecord.type,
      incidentDate: caseRecord.incidentDate,
      allegation: caseRecord.allegation,
      reason: caseRecord.reason || '',
      expectations: caseRecord.expectations || '',
      reviewDate: caseRecord.reviewDate,
      suspensionStartDate: caseRecord.suspensionStartDate,
      suspensionEndDate: caseRecord.suspensionEndDate,
      returnDate: caseRecord.returnDate,
      suspensionPayStatus: caseRecord.suspensionPayStatus,
      conditions: caseRecord.conditions,
      effectiveDate: caseRecord.effectiveDate,
      noticeDetails: caseRecord.noticeDetails,
      handoverDetails: caseRecord.handoverDetails,
      signatory: caseRecord.signatory || currentUser.name,
      responseRequired: caseRecord.responseRequired,
      responseDueDate: caseRecord.responseDueDate,
      assignedApprovers: caseRecord.assignedApprovers || { humanResource: '', generalManager: '', superAdmin: '' },
    })
    setShowComposer(true)
    setError('')
  }

  const submitComposer = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const ids = Object.values(composer.assignedApprovers)
    if (new Set(ids).size !== 3 || (!editingCaseId && ids.includes(currentUser.id))) {
      setError('Choose three different approvers. The case creator cannot be an approver.')
      return
    }
    await perform(async () => {
      if (editingCaseId) await updateMutation.mutateAsync({ id: editingCaseId, input: composer })
      else await createMutation.mutateAsync(composer)
      setShowComposer(false)
      setSuccess(editingCaseId ? 'Disciplinary case updated.' : 'Draft case saved.')
    }, editingCaseId ? 'Disciplinary case updated.' : 'Draft case saved.')
  }

  const savePolicy = async () => {
    if (!policyDraft) return
    await perform(() => policyUpdateMutation.mutateAsync(policyDraft), 'Employee response policy saved.')
  }

  const reviewerCases = caseQuery.data?.cases || []
  const myCases = employeeCaseQuery.data?.cases || []
  const actionsBusy = busy || createMutation.isPending || updateMutation.isPending

  return <div className="animate-in fade-in duration-300">
    <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><div className="mb-2 text-xs font-medium text-slate-400">Workspace / Human Resources</div><h2 className="text-2xl font-bold tracking-tight">Disciplinary cases</h2><p className="mt-1 max-w-2xl text-sm text-slate-500">Confidential case records, employee response windows, sequential approvals, and issued-letter follow-up.</p></div>
      {isHr && <button type="button" onClick={openNewComposer} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#6d28d9] px-3 py-2.5 text-xs font-semibold text-white hover:bg-[#5b21b6]"><Icons.Plus className="size-4" /> Create case</button>}
    </div>

    {success && <div role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div>}
    {error && <div role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
    {caseQuery.isError && canReview && <div role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{asMessage(caseQuery.error)}</div>}
    {employeeCaseQuery.isError && <div role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{asMessage(employeeCaseQuery.error)}</div>}
    {isSuperAdmin && policyQuery.isError && <div role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{asMessage(policyQuery.error)}</div>}

    {isSuperAdmin && policyDraft && <details className="mb-5 rounded-xl border border-slate-200 bg-white">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Employee response requirements</summary>
      <div className="grid gap-3 border-t border-slate-100 p-4 md:grid-cols-3">
        {letterTypes.map((type) => <div key={type} className="rounded-lg border border-slate-100 p-3">
          <h3 className="mb-2 text-xs font-bold">{type}</h3>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={policyDraft.responseRules[type].required} onChange={(event) => setPolicyDraft({ ...policyDraft, responseRules: { ...policyDraft.responseRules, [type]: { ...policyDraft.responseRules[type], required: event.target.checked } } })} /> Response required before approvals</label>
          <label className="mt-3 block text-xs font-medium">Response window (calendar days)<input type="number" min={1} max={60} value={policyDraft.responseRules[type].responseWindowDays} onChange={(event) => setPolicyDraft({ ...policyDraft, responseRules: { ...policyDraft.responseRules, [type]: { ...policyDraft.responseRules[type], responseWindowDays: Number(event.target.value) } } })} className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5" /></label>
        </div>)}
        <div className="md:col-span-3"><button type="button" disabled={policyUpdateMutation.isPending} onClick={() => void savePolicy()} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Save response policy</button></div>
      </div>
    </details>}

    {canReview && <section className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-3"><h3 className="text-sm font-bold">Review workspace</h3><p className="mt-1 text-xs text-slate-500">{isHr ? 'Cases are visible to HR; managers see cases assigned to them.' : 'Only cases assigned to your approval account are shown.'}</p></div>
      {caseQuery.isLoading ? <p className="p-6 text-sm text-slate-500">Loading cases…</p>
        : reviewerCases.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No disciplinary cases found.</p>
          : <div className="divide-y divide-slate-100">{reviewerCases.map((item) => <ReviewerCase key={item.id} item={item} currentUser={currentUser} isHr={isHr} busy={actionsBusy} responseText={responseTexts[item.id] || ''} setResponseText={(text) => setResponseTexts((current) => ({ ...current, [item.id]: text }))} onEdit={() => openEditComposer(item)} onAction={perform} mutations={{
            requestResponse: requestResponseMutation,
            noResponse: noResponseMutation,
            offlineResponse: offlineResponseMutation,
            submit: submitForApprovalMutation,
            decision: decisionMutation,
            issue: issueMutation,
            resolveAppeal: appealResolutionMutation,
            rescind: rescindMutation,
            uploadEvidence: evidenceUploadMutation,
            removeEvidence: evidenceRemoveMutation,
          }} />)}</div>}
    </section>}

    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-3"><h3 className="text-sm font-bold">My disciplinary correspondence</h3><p className="mt-1 text-xs text-slate-500">Your response windows, issued letters, acknowledgements, and appeals.</p></div>
      {employeeCaseQuery.isLoading ? <p className="p-6 text-sm text-slate-500">Loading your cases…</p>
        : myCases.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No disciplinary correspondence is available for your account.</p>
          : <div className="divide-y divide-slate-100">{myCases.map((item) => <EmployeeCase key={item.id} item={item} responseText={responseTexts[item.id] || ''} setResponseText={(text) => setResponseTexts((current) => ({ ...current, [item.id]: text }))} onAction={perform} mutations={{ response: employeeResponseMutation, acknowledge: acknowledgementMutation, appeal: appealMutation }} />)}</div>}
    </section>

    {showComposer && <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/45 p-3 sm:p-6"><section role="dialog" aria-modal="true" aria-labelledby="disciplinary-composer-title" className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white shadow-2xl">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4"><div><h2 id="disciplinary-composer-title" className="text-base font-bold">{editingCaseId ? 'Edit disciplinary case' : 'Create disciplinary case'}</h2><p className="mt-1 text-xs text-slate-500">Drafts are confidential and are not issued until all three approvals are complete.</p></div><button type="button" aria-label="Close case editor" onClick={() => setShowComposer(false)} className="grid size-8 place-items-center rounded-md text-slate-400 hover:bg-slate-100"><Icons.X className="size-4" /></button></header>
      <form onSubmit={(event) => void submitComposer(event)} className="space-y-5 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-600">Employee<select required disabled={Boolean(editingCaseId)} value={composer.employeeId} onChange={(event) => setComposer({ ...composer, employeeId: event.target.value })} className="mt-1.5 w-full rounded-md border border-slate-200 px-3 py-2.5 text-sm disabled:bg-slate-100"><option value="">Choose active employee</option>{activeEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employeeDisplayName(employee)} · {employee.number}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-600">Letter type<select value={composer.type} onChange={(event) => { const type = event.target.value as DisciplinaryLetterType; setComposer({ ...composer, type, reason: suggestedReason(type), responseRequired: policyQuery.data?.policy.responseRules[type].required ?? composer.responseRequired }) }} className="mt-1.5 w-full rounded-md border border-slate-200 px-3 py-2.5 text-sm">{letterTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
          <Input label="Incident date" type="date" required value={composer.incidentDate} onChange={(incidentDate) => setComposer({ ...composer, incidentDate })} />
          <Input label="Signatory name and title" required value={composer.signatory} onChange={(signatory) => setComposer({ ...composer, signatory })} />
          <Textarea label="Allegation / matter to be reviewed" required value={composer.allegation} onChange={(allegation) => setComposer({ ...composer, allegation })} />
          <Textarea label="Reason (editable neutral suggestion)" required value={composer.reason} onChange={(reason) => setComposer({ ...composer, reason })} />
          {composer.type === 'Written warning' && <>
            <Textarea label="Expected improvement" value={composer.expectations || ''} onChange={(expectations) => setComposer({ ...composer, expectations })} />
            <Input label="Review date" type="date" value={composer.reviewDate || ''} onChange={(reviewDate) => setComposer({ ...composer, reviewDate })} />
          </>}
          {composer.type === 'Suspension' && <>
            <Input label="Suspension start" type="date" required value={composer.suspensionStartDate || ''} onChange={(suspensionStartDate) => setComposer({ ...composer, suspensionStartDate })} />
            <Input label="Suspension end" type="date" required value={composer.suspensionEndDate || ''} onChange={(suspensionEndDate) => setComposer({ ...composer, suspensionEndDate })} />
            <Input label="Return-to-work date" type="date" value={composer.returnDate || ''} onChange={(returnDate) => setComposer({ ...composer, returnDate })} />
            <label className="text-xs font-semibold text-slate-600">Pay status<select value={composer.suspensionPayStatus || 'Not specified'} onChange={(event) => setComposer({ ...composer, suspensionPayStatus: event.target.value as ComposerValues['suspensionPayStatus'] })} className="mt-1.5 w-full rounded-md border border-slate-200 px-3 py-2.5 text-sm"><option>Not specified</option><option>Paid</option><option>Unpaid</option></select></label>
            <Textarea label="Conditions during suspension" value={composer.conditions || ''} onChange={(conditions) => setComposer({ ...composer, conditions })} />
          </>}
          {composer.type === 'Termination' && <>
            <Input label="Effective date" type="date" required value={composer.effectiveDate || ''} onChange={(effectiveDate) => setComposer({ ...composer, effectiveDate })} />
            <Textarea label="Notice details" value={composer.noticeDetails || ''} onChange={(noticeDetails) => setComposer({ ...composer, noticeDetails })} />
            <Textarea label="Handover / property return" value={composer.handoverDetails || ''} onChange={(handoverDetails) => setComposer({ ...composer, handoverDetails })} />
          </>}
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700"><input type="checkbox" checked={Boolean(composer.responseRequired)} onChange={(event) => setComposer({ ...composer, responseRequired: event.target.checked })} /> Require employee response before approval</label>
        {composer.responseRequired && <Input label="Case-specific response due date (optional; defaults to policy)" type="date" value={composer.responseDueDate || ''} onChange={(responseDueDate) => setComposer({ ...composer, responseDueDate })} />}
        <section className="rounded-lg border border-slate-200 p-4"><h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Sequential approvers</h3><div className="grid gap-3 sm:grid-cols-3">{approvalStages.map((stage) => {
          const candidates = approversQuery.data?.candidates[stage.role] || []
          return <label key={stage.role} className="text-xs font-semibold text-slate-600">{stage.role}<select required value={composer.assignedApprovers[stage.field]} onChange={(event) => setComposer({ ...composer, assignedApprovers: { ...composer.assignedApprovers, [stage.field]: event.target.value } })} className="mt-1.5 w-full rounded-md border border-slate-200 px-2 py-2.5 text-sm"><option value="">Choose approver</option>{candidates.filter((candidate) => candidate.id !== currentUser.id || candidate.id === composer.assignedApprovers[stage.field]).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select></label>
        })}</div>{approversQuery.isError && <p role="alert" className="mt-2 text-xs text-rose-700">{asMessage(approversQuery.error)}</p>}</section>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => setShowComposer(false)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Cancel</button><button type="submit" disabled={actionsBusy || approversQuery.isLoading} className="rounded-lg bg-[#6d28d9] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{actionsBusy ? 'Saving…' : editingCaseId ? 'Save changes' : 'Save draft'}</button></div>
      </form>
    </section></div>}
  </div>
}

function ReviewerCase({ item, currentUser, isHr, busy, responseText, setResponseText, onEdit, onAction, mutations }: {
  item: DisciplinaryCase
  currentUser: UserAccount
  isHr: boolean
  busy: boolean
  responseText: string
  setResponseText: (text: string) => void
  onEdit: () => void
  onAction: (action: () => Promise<unknown>, success: string) => Promise<void>
  mutations: {
    requestResponse: ReturnType<typeof useRequestDisciplinaryResponse>
    noResponse: ReturnType<typeof useRecordDisciplinaryNoResponse>
    submit: ReturnType<typeof useSubmitDisciplinaryCaseForApproval>
    decision: ReturnType<typeof useDecideDisciplinaryApproval>
    issue: ReturnType<typeof useIssueDisciplinaryCase>
    offlineResponse: ReturnType<typeof useRecordDisciplinaryOfflineResponse>
    resolveAppeal: ReturnType<typeof useResolveDisciplinaryAppeal>
    rescind: ReturnType<typeof useRescindDisciplinaryCase>
    uploadEvidence: ReturnType<typeof useUploadDisciplinaryEvidence>
    removeEvidence: ReturnType<typeof useRemoveDisciplinaryEvidence>
  }
}) {
  const [offlineText, setOfflineText] = useState('')
  const [offlineSource, setOfflineSource] = useState<'In person' | 'Written externally'>('In person')
  const canEdit = isHr && ['Draft', 'Under investigation', 'Changes requested'].includes(item.status)
  const pendingStage = item.status.startsWith('Pending ') ? item.status.replace('Pending ', '').replace(' approval', '') : ''
  const assignment: Record<string, string | undefined> = {
    'Human Resource': item.assignedApprovers?.humanResource,
    'General Manager': item.assignedApprovers?.generalManager,
    'Super Admin': item.assignedApprovers?.superAdmin,
  }
  const canApprove = pendingStage && (currentUser.roles.includes('Super Admin') || assignment[pendingStage] === currentUser.id && hasDepartmentRole(currentUser.roles, pendingStage as DisciplinaryApproverStage))
  const canRequestResponse = isHr && item.responseRequired && !item.response?.text && !item.noResponseRecordedAt && ['Draft', 'Under investigation', 'Changes requested'].includes(item.status)
  const canSubmit = isHr && ['Draft', 'Under investigation', 'Changes requested'].includes(item.status)
  const canUploadEvidence = isHr && ['Draft', 'Under investigation', 'Awaiting employee response', 'Changes requested'].includes(item.status)
  const appealToResolve = item.appeals?.find((appeal) => !appeal.resolution)

  return <article className="p-4 sm:p-5">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h4 className="text-sm font-bold text-slate-900">{item.reference} · {item.employeeName}</h4><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700">{item.status}</span><span className="rounded-full bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-800">{item.type}</span></div><p className="mt-1 text-xs text-slate-500">{item.employeeNumber} · {item.department} · {item.role} · Incident {item.incidentDate}</p><p className="mt-3 whitespace-pre-wrap text-xs leading-5 text-slate-700"><strong>Matter:</strong> {item.allegation}</p>{item.response && <p className="mt-2 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs leading-5"><strong>Employee response ({item.response.source}):</strong> {item.response.text}</p>}{item.noResponseRecordedAt && <p className="mt-2 text-xs text-amber-800">Response not recorded by the deadline. HR note: {item.noResponseNote}</p>}</div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {canEdit && <button type="button" onClick={onEdit} className="rounded-md border border-slate-200 px-2.5 py-2 text-xs font-semibold">Edit draft</button>}
        {canRequestResponse && <button type="button" disabled={busy || mutations.requestResponse.isPending} onClick={() => void onAction(() => mutations.requestResponse.mutateAsync({ id: item.id, notice: 'Please provide your response to the matter described in this notice before the response deadline.', dueDate: item.responseDueDate || dateAfterDays(5) }), 'Employee response window opened.')} className="rounded-md border border-slate-200 px-2.5 py-2 text-xs font-semibold disabled:opacity-50">Request response</button>}
        {item.status === 'Awaiting employee response' && isHr && item.responseDueDate && item.responseDueDate < new Date().toISOString().slice(0, 10) && <button type="button" disabled={busy} onClick={() => { const note = window.prompt('Record a factual note about the expired response window.'); if (note?.trim()) void onAction(() => mutations.noResponse.mutateAsync({ id: item.id, note }), 'Non-response recorded; silence is not treated as admission.') }} className="rounded-md border border-amber-200 px-2.5 py-2 text-xs font-semibold text-amber-800 disabled:opacity-50">Record no response</button>}
        {canSubmit && <button type="button" disabled={busy || mutations.submit.isPending} onClick={() => void onAction(() => mutations.submit.mutateAsync(item.id), 'Case submitted to Human Resource for review.')} className="rounded-md bg-violet-700 px-2.5 py-2 text-xs font-semibold text-white disabled:opacity-50">Submit for approval</button>}
        {canApprove && <><button type="button" disabled={busy || mutations.decision.isPending} onClick={() => void onAction(() => mutations.decision.mutateAsync({ id: item.id, decision: 'Approved' }), 'Approval recorded.')} className="rounded-md bg-emerald-700 px-2.5 py-2 text-xs font-semibold text-white disabled:opacity-50">Approve</button><button type="button" disabled={busy || mutations.decision.isPending} onClick={() => { const note = window.prompt('Explain what must be changed before this case can proceed.'); if (note?.trim()) void onAction(() => mutations.decision.mutateAsync({ id: item.id, decision: 'Rejected', note }), 'Changes requested; the case was returned to HR.') }} className="rounded-md border border-rose-200 px-2.5 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50">Request changes</button></>}
        {isHr && item.status === 'Approved' && <button type="button" disabled={busy || mutations.issue.isPending} onClick={() => void onAction(() => mutations.issue.mutateAsync(item.id), 'Letter issued after all three approvals.')} className="rounded-md bg-slate-900 px-2.5 py-2 text-xs font-semibold text-white disabled:opacity-50">Issue letter</button>}
        {currentUser.roles.includes('Super Admin') && item.status === 'Issued' && <button type="button" disabled={busy} onClick={() => { const reason = window.prompt('Provide the reason for rescinding this issued letter.'); if (reason?.trim()) void onAction(() => mutations.rescind.mutateAsync({ id: item.id, reason }), 'Issued letter rescinded.') }} className="rounded-md border border-rose-200 px-2.5 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50">Rescind</button>}
      </div>
    </div>
    {item.reason && <p className="mt-3 whitespace-pre-wrap text-xs leading-5 text-slate-600"><strong>Reason:</strong> {item.reason}</p>}
    {isHr && item.status === 'Awaiting employee response' && <div className="mt-3 rounded-md border border-slate-200 p-3"><label className="block text-xs font-semibold">Record offline employee response<textarea value={offlineText} onChange={(event) => setOfflineText(event.target.value)} rows={3} className="mt-1 w-full rounded border border-slate-200 p-2 text-xs" /></label><div className="mt-2 flex flex-wrap gap-2"><select value={offlineSource} onChange={(event) => setOfflineSource(event.target.value as typeof offlineSource)} className="rounded border border-slate-200 px-2 py-1.5 text-xs"><option>In person</option><option>Written externally</option></select><button type="button" disabled={busy || !offlineText.trim()} onClick={() => void onAction(() => mutations.offlineResponse.mutateAsync({ id: item.id, text: offlineText, source: offlineSource }), 'Offline employee response recorded.')} className="rounded bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Record response</button></div></div>}
    {item.approvals && item.approvals.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{item.approvals.map((approval) => <span key={approval.id} className="rounded border border-slate-200 px-2 py-1 text-[10px] text-slate-600">{approval.stage}: {approval.decision} · {approval.actorName}</span>)}</div>}
    {canUploadEvidence && <div className="mt-3 flex flex-wrap items-center gap-2"><label className="cursor-pointer rounded-md border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-700"><Icons.Paperclip className="mr-1 inline size-3.5" /> Add PDF evidence<input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void onAction(() => mutations.uploadEvidence.mutateAsync({ id: item.id, file }), 'Private evidence uploaded.') }} /></label><span className="text-[10px] text-slate-400">PDF only · 10 MB maximum</span></div>}
    {!!item.evidence?.length && <ul className="mt-2 space-y-1">{item.evidence.map((evidence) => <li key={evidence.id} className="flex items-center gap-2 text-xs"><span>{evidence.name}</span><button type="button" onClick={() => void onAction(async () => {
      const popup = window.open('about:blank', '_blank')
      if (!popup) throw new Error('Allow pop-ups to download private evidence.')
      popup.opener = null
      try {
        const result = await getDisciplinaryEvidenceDownload(item.id, evidence.id)
        popup.location.href = result.url
      } catch (error) {
        popup.close()
        throw error
      }
    }, 'Private evidence link opened.')} className="text-violet-700 underline">Download</button>{canUploadEvidence && <button type="button" onClick={() => void onAction(() => mutations.removeEvidence.mutateAsync({ id: item.id, evidenceId: evidence.id }), 'Evidence removed.')} className="text-rose-700 underline">Remove</button>}</li>)}</ul>}
    {appealToResolve && (isHr || currentUser.roles.includes('Super Admin')) && <AppealResolution appeal={appealToResolve} item={item} busy={busy} onAction={onAction} mutation={mutations.resolveAppeal} />}
  </article>
}

function AppealResolution({ appeal, item, busy, onAction, mutation }: {
  appeal: NonNullable<DisciplinaryCase['appeals']>[number]
  item: DisciplinaryCase
  busy: boolean
  onAction: (action: () => Promise<unknown>, success: string) => Promise<void>
  mutation: ReturnType<typeof useResolveDisciplinaryAppeal>
}) {
  const [resolution, setResolution] = useState<'Upheld' | 'Varied' | 'Overturned'>('Upheld')
  const [note, setNote] = useState('')
  return <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3"><p className="whitespace-pre-wrap text-xs"><strong>Appeal:</strong> {appeal.text}</p><div className="mt-3 flex flex-wrap gap-2"><select value={resolution} onChange={(event) => setResolution(event.target.value as typeof resolution)} className="rounded border border-amber-300 bg-white px-2 py-1.5 text-xs"><option>Upheld</option><option>Varied</option><option>Overturned</option></select><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Reasoned outcome (required)" className="min-w-64 flex-1 rounded border border-amber-300 bg-white px-2 py-1.5 text-xs" /><button type="button" disabled={busy || mutation.isPending || !note.trim()} onClick={() => void onAction(() => mutation.mutateAsync({ id: item.id, appealId: appeal.id, resolution, note }), 'Appeal outcome recorded.')} className="rounded bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Resolve appeal</button></div><p className="mt-2 text-[10px] text-amber-900">The original issued letter remains immutable. An overturned outcome rescinds it; a varied outcome is recorded in the appeal history and does not silently rewrite or reissue the letter.</p></div>
}

function EmployeeCase({ item, responseText, setResponseText, onAction, mutations }: {
  item: DisciplinaryCase
  responseText: string
  setResponseText: (text: string) => void
  onAction: (action: () => Promise<unknown>, success: string) => Promise<void>
  mutations: {
    response: ReturnType<typeof useSubmitDisciplinaryEmployeeResponse>
    acknowledge: ReturnType<typeof useAcknowledgeDisciplinaryLetter>
    appeal: ReturnType<typeof useSubmitDisciplinaryAppeal>
  }
}) {
  const responseOpen = item.status === 'Awaiting employee response'
  const issued = item.status === 'Issued' || item.status === 'Closed'
  return <article className="p-4 sm:p-5"><div className="flex flex-wrap items-center gap-2"><h4 className="text-sm font-bold">{item.reference} · {item.type}</h4><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold">{item.status}</span></div><p className="mt-1 text-xs text-slate-500">Incident date: {item.incidentDate}{item.responseDueDate && responseOpen ? ` · Response due: ${item.responseDueDate}` : ''}</p>
    {item.responseNotice && <p className="mt-3 rounded-md bg-blue-50 p-3 text-xs leading-5 text-blue-900">{item.responseNotice}</p>}
    <p className="mt-3 whitespace-pre-wrap text-xs leading-5 text-slate-700"><strong>Matter:</strong> {item.allegation}</p>
    {item.response && <p className="mt-2 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs leading-5"><strong>Your response:</strong> {item.response.text}</p>}
    {issued && item.reason && <><p className="mt-3 whitespace-pre-wrap text-xs leading-5 text-slate-700"><strong>Issued reason:</strong> {item.reason}</p>{item.expectations && <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-700"><strong>Expectations:</strong> {item.expectations}</p>}{item.conditions && <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-700"><strong>Conditions:</strong> {item.conditions}</p>}</>}
    {responseOpen && <div className="mt-3"><label className="block text-xs font-semibold">Your response<textarea value={responseText} onChange={(event) => setResponseText(event.target.value)} maxLength={5000} rows={4} className="mt-1 w-full rounded-md border border-slate-200 p-2 text-xs" placeholder="You may provide your response here. Silence is not treated as admission." /></label><button type="button" disabled={!responseText.trim() || mutations.response.isPending} onClick={() => void onAction(() => mutations.response.mutateAsync({ id: item.id, text: responseText }), 'Your response has been recorded.')} className="mt-2 rounded-md bg-violet-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Submit response</button></div>}
    {issued && <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={mutations.acknowledge.isPending} onClick={() => void onAction(() => mutations.acknowledge.mutateAsync({ id: item.id, status: 'Received' }), 'Acknowledgement recorded.')} className="rounded-md border border-slate-200 px-2.5 py-2 text-xs font-semibold">Acknowledge receipt</button><button type="button" disabled={mutations.acknowledge.isPending} onClick={() => { const note = window.prompt('Optional note explaining your disagreement or inability to acknowledge receipt.') || ''; void onAction(() => mutations.acknowledge.mutateAsync({ id: item.id, status: 'Disputed', note }), 'Dispute acknowledgement recorded.') }} className="rounded-md border border-amber-200 px-2.5 py-2 text-xs font-semibold text-amber-800">Dispute / unable to acknowledge</button><button type="button" disabled={mutations.appeal.isPending} onClick={() => { const text = window.prompt('Enter your appeal statement.'); if (text?.trim()) void onAction(() => mutations.appeal.mutateAsync({ id: item.id, text }), 'Appeal submitted for review.') }} className="rounded-md border border-violet-200 px-2.5 py-2 text-xs font-semibold text-violet-800">Submit appeal</button></div>}
    {item.appeals?.map((appeal) => <p key={appeal.id} className="mt-3 rounded-md bg-slate-50 p-3 text-xs">Appeal submitted {new Date(appeal.submittedAt).toLocaleDateString()}: {appeal.resolution ? `${appeal.resolution} — ${appeal.resolutionNote}` : 'Awaiting review'}</p>)}
  </article>
}

function Input({ label, value, onChange, type = 'text', required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return <label className="block text-xs font-semibold text-slate-600">{label}<input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full rounded-md border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" /></label>
}

function Textarea({ label, value, onChange, required = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return <label className="block text-xs font-semibold text-slate-600 sm:col-span-2">{label}<textarea required={required} rows={3} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full rounded-md border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" /></label>
}
