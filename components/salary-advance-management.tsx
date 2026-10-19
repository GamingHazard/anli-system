'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import * as Icons from 'lucide-react'
import { createId, employeeDisplayName, exportCsv, formatDate, getLegacySalaryAdvanceImport, markLegacySalaryAdvancesImported, money, type AdvanceRepaymentFrequency, type AdvanceRepaymentMethod, type ErpState, type ExpenseAttachment, type SalaryAdvance } from '@/lib/erp'
import {
  useCreateSalaryAdvance,
  useGeneralManagerSalaryAdvanceDecision,
  useHrSalaryAdvanceDecision,
  useRemoveSalaryAdvanceAttachment,
  useSalaryAdvanceDisbursement,
  useSalaryAdvanceRepayment,
  useSalaryAdvances,
  useUploadSalaryAdvanceAttachment,
} from '@/lib/salary-advance-queries'
import { getSalaryAdvanceAttachmentDownload, importLegacySalaryAdvances, previewLegacySalaryAdvances, type LegacySalaryAdvanceImportPreview, type LegacySalaryAdvanceImportRecord, type UserAccount } from '@/lib/user-api'

type Props = { state: ErpState; initialAdvanceId?: string | null; currentUser: UserAccount; onViewEmployee: (id: string) => void }
type View = 'Requests' | 'Active advances' | 'Repayment history' | 'All records'
type Dialog = 'request' | 'review' | 'disbursement' | 'repayment' | null
type PendingUpload = { attachment: ExpenseAttachment; file: File }

function legacyImportRecord(advance: SalaryAdvance): LegacySalaryAdvanceImportRecord {
  return {
    id: advance.id,
    reference: advance.reference,
    employeeId: advance.employeeId,
    employeeNumber: advance.employeeNumber,
    employeeName: advance.employeeName,
    department: advance.department,
    role: advance.role,
    category: advance.category,
    paymentFrequency: advance.paymentFrequency,
    requestedAmount: advance.requestedAmount,
    reason: advance.reason,
    dateTaken: advance.dateTaken,
    requestedAt: advance.requestedAt,
    proposedFrequency: advance.proposedFrequency,
    proposedInstallmentAmount: advance.proposedInstallmentAmount,
    status: advance.status,
    approvedAmount: advance.approvedAmount,
    approvedFrequency: advance.approvedFrequency,
    approvedInstallmentAmount: advance.approvedInstallmentAmount,
    dateApproved: advance.dateApproved,
    disbursement: advance.disbursement,
    schedule: advance.schedule,
    repayments: advance.repayments,
  }
}

const views: View[] = ['Requests', 'Active advances', 'Repayment history', 'All records']
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const isValidDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(new Date(`${value}T12:00:00.000Z`).getTime())
  && new Date(`${value}T12:00:00.000Z`).toISOString().slice(0, 10) === value
const repaidAmount = (advance: SalaryAdvance) => advance.repayments.reduce((total, item) => total + item.amount, 0)
const balance = (advance: SalaryAdvance) => Math.max(0, (advance.disbursement?.amount ?? 0) - repaidAmount(advance))
const attachmentSize = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
const LEGACY_IMPORT_BATCH_SIZE = 20

function compressAdvanceAttachment(file: File): Promise<ExpenseAttachment> {
  return new Promise((resolve, reject) => {
    const source = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
      const context = canvas.getContext('2d')
      if (!context) {
        URL.revokeObjectURL(source)
        reject(new Error(`Could not process ${file.name}.`))
        return
      }
      context.fillStyle = '#fff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(source)
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error(`Could not process ${file.name}.`))
          return
        }
        const reader = new FileReader()
        reader.onload = () => resolve({
          id: createId('AATT'),
          name: file.name,
          dataUrl: String(reader.result),
          mediaType: blob.type,
          sizeBytes: blob.size,
        })
        reader.onerror = () => reject(new Error(`Could not read ${file.name}.`))
        reader.readAsDataURL(blob)
      }, 'image/jpeg', 0.78)
    }
    image.onerror = () => {
      URL.revokeObjectURL(source)
      reject(new Error(`${file.name} is not a supported image.`))
    }
    image.src = source
  })
}

function attachmentFile(attachment: ExpenseAttachment) {
  if (!attachment.dataUrl) throw new Error(`Could not prepare ${attachment.name} for upload.`)
  const [metadata, encoded] = attachment.dataUrl.split(',')
  const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0))
  const mediaType = metadata.match(/data:(.*?);base64/)?.[1] || 'image/jpeg'
  return new File([bytes], attachment.name, { type: mediaType })
}

function statusTone(status: string) {
  if (status === 'Active') return 'bg-sky-50 text-sky-700'
  if (status === 'Settled' || status === 'Approved') return 'bg-emerald-50 text-emerald-700'
  if (status.startsWith('Pending')) return 'bg-amber-50 text-amber-700'
  if (status === 'Rejected') return 'bg-rose-50 text-rose-700'
  return 'bg-slate-100 text-slate-600'
}

export default function SalaryAdvanceManagement({ state, initialAdvanceId = null, currentUser, onViewEmployee }: Props) {
  const [view, setView] = useState<View>('Requests')
  const [selectedId, setSelectedId] = useState<string | null>(initialAdvanceId)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All statuses')
  const [frequencyFilter, setFrequencyFilter] = useState('All frequencies')
  const [error, setError] = useState('')
  const [legacyArchive, setLegacyArchive] = useState<ReturnType<typeof getLegacySalaryAdvanceImport>>(null)
  const [legacyPreview, setLegacyPreview] = useState<LegacySalaryAdvanceImportPreview | null>(null)
  const [legacyImportBusy, setLegacyImportBusy] = useState(false)
  const [legacyImportMessage, setLegacyImportMessage] = useState('')
  const { data, isLoading, isError, error: loadError, refetch } = useSalaryAdvances()
  const records = data?.advances ?? []
  useEffect(() => setLegacyArchive(getLegacySalaryAdvanceImport()), [])
  const selected = records.find((advance) => advance.id === selectedId) ?? null
  const activeAdvances = records.filter((advance) => advance.status === 'Active')
  const pending = records.filter((advance) => advance.status === 'Pending HR review' || advance.status === 'Pending GM review' || advance.status === 'Pending review')
  const approved = records.filter((advance) => advance.status === 'Approved')
  const canRequest = currentUser.roles.includes('Human Resource')
  const canHrApprove = currentUser.roles.includes('Human Resource')
  const canGmApprove = currentUser.roles.includes('General Manager')
  const canManagePayments = currentUser.roles.includes('Human Resource')
  const createMutation = useCreateSalaryAdvance()
  const hrDecisionMutation = useHrSalaryAdvanceDecision()
  const gmDecisionMutation = useGeneralManagerSalaryAdvanceDecision()
  const disbursementMutation = useSalaryAdvanceDisbursement()
  const repaymentMutation = useSalaryAdvanceRepayment()
  const uploadMutation = useUploadSalaryAdvanceAttachment()
  const removeAttachmentMutation = useRemoveSalaryAdvanceAttachment()
  const submitting = createMutation.isPending || hrDecisionMutation.isPending || gmDecisionMutation.isPending || disbursementMutation.isPending || repaymentMutation.isPending || uploadMutation.isPending || removeAttachmentMutation.isPending
  const totalOutstanding = activeAdvances.reduce((total, advance) => total + balance(advance), 0)
  const repayments = records.flatMap((advance) => advance.repayments.map((repayment) => ({ advance, repayment }))).sort((left, right) => right.repayment.date.localeCompare(left.repayment.date) || right.repayment.recordedAt.localeCompare(left.repayment.recordedAt))
  const rows = useMemo(() => {
    let filteredRecords = view === 'Requests' ? records.filter((advance) => ['Pending HR review', 'Pending GM review', 'Pending review', 'Approved', 'Rejected'].includes(advance.status))
      : view === 'Active advances' ? activeAdvances
        : records
    if (view === 'Repayment history') filteredRecords = filteredRecords.filter((advance) => advance.repayments.length > 0)
    return filteredRecords.filter((advance) => {
      const haystack = `${advance.reference} ${advance.employeeName} ${advance.employeeNumber} ${advance.department} ${advance.reason}`.toLowerCase()
      return haystack.includes(search.trim().toLowerCase())
        && (statusFilter === 'All statuses' || advance.status === statusFilter)
        && (frequencyFilter === 'All frequencies' || (advance.approvedFrequency ?? advance.proposedFrequency) === frequencyFilter)
    }).sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  }, [view, records, activeAdvances, search, statusFilter, frequencyFilter])

  const createRequest = async (form: FormData, attachments: PendingUpload[]) => {
    const employee = state.employees.find((item) => item.id === String(form.get('employeeId') || ''))
    const requestedAmount = Number(form.get('requestedAmount'))
    const installment = Number(form.get('installmentAmount'))
    const dateTaken = String(form.get('dateTaken') || '')
    if (!employee || !Number.isFinite(requestedAmount) || requestedAmount <= 0 || !Number.isFinite(installment) || installment <= 0 || installment > requestedAmount || !isValidDate(dateTaken) || dateTaken > today()) {
      setError('Select an employee, enter a valid requested amount and installment, and select a valid date taken.')
      return
    }
    const frequency = form.get('frequency') === 'Weekly' ? 'Weekly' : 'Monthly'
    try {
      const record = await createMutation.mutateAsync({
        employeeId: employee.id,
        requestedAmount,
        reason: String(form.get('reason') || '').trim(),
        dateTaken,
        proposedFrequency: frequency,
        proposedInstallmentAmount: installment,
      })
      setSelectedId(record.id)
      setDialog(null)
      setError('')
      for (const upload of attachments) await uploadMutation.mutateAsync({ id: record.id, file: upload.file })
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not submit the salary-advance request.')
    }
  }

  const reviewRequest = async (form: FormData) => {
    if (!selected || !['Pending HR review', 'Pending GM review', 'Pending review'].includes(selected.status)) return
    const decision = String(form.get('decision'))
    if (decision === 'Rejected') {
      const rejectionReason = String(form.get('rejectionReason') || '').trim()
      if (!rejectionReason) { setError('A rejection reason is required.'); return }
      try {
        const input = { decision: 'Rejected' as const, note: rejectionReason }
        if (selected.status === 'Pending HR review' && canHrApprove) await hrDecisionMutation.mutateAsync({ id: selected.id, input })
        else if (selected.status === 'Pending GM review' && canGmApprove) await gmDecisionMutation.mutateAsync({ id: selected.id, input })
        else { setError('Your role cannot decide this approval stage.'); return }
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Could not save the decision.')
        return
      }
    } else {
      const approvedAmount = Number(form.get('approvedAmount'))
      const installment = Number(form.get('installmentAmount'))
      const frequency: AdvanceRepaymentFrequency = form.get('frequency') === 'Weekly' ? 'Weekly' : 'Monthly'
      if (!Number.isFinite(approvedAmount) || approvedAmount <= 0 || approvedAmount > selected.requestedAmount || !Number.isFinite(installment) || installment <= 0 || installment > approvedAmount) {
        setError('Approved amount must be positive and no greater than requested; enter valid repayment terms.')
        return
      }
      try {
        const input = { decision: 'Approved' as const, note: String(form.get('decisionNote') || '').trim(), amount: approvedAmount, frequency, installmentAmount: installment }
        if (selected.status === 'Pending HR review' && canHrApprove) await hrDecisionMutation.mutateAsync({ id: selected.id, input })
        else if (selected.status === 'Pending GM review' && canGmApprove) await gmDecisionMutation.mutateAsync({ id: selected.id, input })
        else { setError('Your role cannot decide this approval stage.'); return }
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Could not save the decision.')
        return
      }
    }
    setDialog(null)
    setError('')
  }

  const recordDisbursement = async (form: FormData) => {
    if (!selected || selected.status !== 'Approved' || !selected.approvedAmount) return
    const amount = Number(form.get('amount'))
    const date = String(form.get('date') || '')
    const method = String(form.get('method') || 'Cash') as Exclude<AdvanceRepaymentMethod, 'Payroll'>
    if (!Number.isFinite(amount) || amount <= 0 || amount > selected.approvedAmount || !date) { setError('Enter a positive disbursement no greater than the approved amount and select a date.'); return }
    try {
      await disbursementMutation.mutateAsync({ id: selected.id, input: { amount, date, method, reference: String(form.get('reference') || '').trim() || undefined } })
      setDialog(null)
      setError('')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not record the disbursement.')
    }
  }

  const recordRepayment = async (form: FormData) => {
    if (!selected || selected.status !== 'Active') return
    const amount = Number(form.get('amount'))
    const date = String(form.get('date') || '')
    const method = String(form.get('method') || 'Cash') as Exclude<AdvanceRepaymentMethod, 'Payroll'>
    const remaining = balance(selected)
    if (!Number.isFinite(amount) || amount <= 0 || amount > remaining || !date) { setError(`Enter a repayment greater than zero and no more than ${money(remaining)}.`); return }
    try {
      await repaymentMutation.mutateAsync({ id: selected.id, input: { amount, date, method, reference: String(form.get('reference') || '').trim() || undefined, note: String(form.get('note') || '').trim() || undefined } })
      setDialog(null)
      setError('')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not record the repayment.')
    }
  }

  const removeAttachment = async (attachmentId: string) => {
    if (!selected) return
    try {
      await removeAttachmentMutation.mutateAsync({ id: selected.id, attachmentId })
      setError('')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not remove the attachment.')
    }
  }

  const previewLegacyImport = async () => {
    if (!legacyArchive?.advances.length) return
    setError('')
    setLegacyPreview(null)
    try {
      const records: LegacySalaryAdvanceImportPreview['records'] = []
      for (let start = 0; start < legacyArchive.advances.length; start += LEGACY_IMPORT_BATCH_SIZE) {
        const batch = legacyArchive.advances.slice(start, start + LEGACY_IMPORT_BATCH_SIZE)
        const response = await previewLegacySalaryAdvances(batch.map(legacyImportRecord))
        records.push(...response.records.map((record) => ({ ...record, index: record.index + start })))
      }
      setLegacyPreview({
        records,
        importableCount: records.filter((record) => record.importable).length,
        duplicateCount: records.filter((record) => record.duplicate).length,
      })
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not preview the local salary-advance archive.')
    }
  }

  const importLegacyArchive = async () => {
    if (!legacyArchive || !legacyPreview?.importableCount) return
    setLegacyImportBusy(true)
    setError('')
    try {
      const importableIndexes = new Set(legacyPreview.records.filter((item) => item.importable).map((item) => item.index))
      let importedCount = 0
      let skippedCount = 0
      for (let start = 0; start < legacyArchive.advances.length; start += LEGACY_IMPORT_BATCH_SIZE) {
        const batch = legacyArchive.advances
          .filter((_advance, index) => index >= start && index < start + LEGACY_IMPORT_BATCH_SIZE && importableIndexes.has(index))
          .map(legacyImportRecord)
        if (!batch.length) continue
        const result = await importLegacySalaryAdvances(batch)
        importedCount += result.imported.length
        skippedCount += result.skipped.length
      }
      await refetch()
      if (!skippedCount) {
        markLegacySalaryAdvancesImported()
        setLegacyArchive(getLegacySalaryAdvanceImport())
      }
      setLegacyPreview(null)
      setLegacyImportMessage(`Imported ${importedCount} legacy record${importedCount === 1 ? '' : 's'}${skippedCount ? `; ${skippedCount} skipped and remain in the local archive.` : '. The original browser backup is retained.'}`)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not import the local salary-advance archive.')
    } finally {
      setLegacyImportBusy(false)
    }
  }

  const openAttachment = async (attachmentId: string) => {
    if (!selected) return
    const opened = window.open('about:blank', '_blank')
    try {
      const { url } = await getSalaryAdvanceAttachmentDownload(selected.id, attachmentId)
      if (opened) opened.location.href = url
      else setError('Allow pop-ups to open the secure attachment.')
    } catch (requestError) {
      opened?.close()
      setError(requestError instanceof Error ? requestError.message : 'Could not open the attachment.')
    }
  }

  const openDialog = (next: Dialog) => { setError(''); setDialog(next) }
  const exportRecords = () => exportCsv('salary-advances.csv', rows.map((advance) => ({
    reference: advance.reference, employeeNumber: advance.employeeNumber, employeeName: advance.employeeName,
    department: advance.department, requestedAmount: advance.requestedAmount, approvedAmount: advance.approvedAmount ?? '',
    dateTaken: advance.dateTaken, dateApproved: advance.dateApproved ?? '', attachmentCount: advance.attachments.length,
    disbursedAmount: advance.disbursement?.amount ?? '', repaidAmount: repaidAmount(advance), outstandingBalance: balance(advance),
    repaymentFrequency: advance.approvedFrequency ?? advance.proposedFrequency, status: advance.status, reason: advance.reason,
  })))

  if (isLoading) return <p role="status" className="p-8 text-sm text-slate-500">Loading salary advances…</p>
  if (isError) return <section role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{loadError instanceof Error ? loadError.message : 'Could not load salary advances.'}<button type="button" onClick={() => refetch()} className="ml-3 font-semibold underline">Try again</button></section>
  if (selected) return <>{<AdvanceDetails advance={selected} currentUser={currentUser} error={error} onRemoveAttachment={removeAttachment} onOpenAttachment={openAttachment} onBack={() => setSelectedId(null)} onViewEmployee={onViewEmployee} onAction={openDialog} onExport={() => exportCsv(`${selected.reference.toLowerCase()}-repayments.csv`, selected.repayments.map((repayment) => ({ advance: selected.reference, employee: selected.employeeName, date: repayment.date, amount: repayment.amount, method: repayment.method, reference: repayment.reference ?? '', note: repayment.note ?? '' })))} />}{dialog && <AdvanceDialog mode={dialog} state={state} advance={selected} error={error} submitting={submitting} onClose={() => { setDialog(null); setError('') }} onSubmit={dialog === 'request' ? createRequest : dialog === 'review' ? reviewRequest : dialog === 'disbursement' ? recordDisbursement : recordRepayment} />}</>

  return <div className="animate-in fade-in duration-300">
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="mb-2 text-xs font-medium text-slate-400">Workspace / HR Department</div><h2 className="text-2xl font-bold tracking-tight">Salary Advance Management</h2><p className="mt-1 max-w-2xl text-sm text-slate-500">Review requests, record disbursements, and track repayments against employee advances.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={exportRecords} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"><Icons.Download className="size-4" /> Export CSV</button>{canRequest && <button type="button" onClick={() => openDialog('request')} className="inline-flex items-center gap-2 rounded-lg bg-[#6d28d9] px-3 py-2.5 text-xs font-semibold text-white hover:bg-[#5b21b6]"><Icons.Plus className="size-4" /> New advance request</button>}</div></div>

    {canRequest && legacyArchive?.advances.length ? <section aria-label="Import browser salary advances" className="mb-5 rounded-xl border border-sky-200 bg-sky-50 p-4"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h3 className="text-sm font-bold text-sky-950">Browser archive available</h3><p className="mt-1 text-xs leading-5 text-sky-900">{legacyArchive.advances.length} locally preserved record(s). Preview before importing; the local backup is retained. Imported approvals and file attachments are marked unverified and are not treated as approved backend decisions.</p>{legacyArchive.importedAt && <p className="mt-1 text-[10px] text-sky-800">Last import completed {formatDate(legacyArchive.importedAt.slice(0, 10))}.</p>}</div><button type="button" disabled={legacyImportBusy} onClick={() => void previewLegacyImport()} className="shrink-0 rounded-lg border border-sky-300 bg-white px-3 py-2 text-xs font-semibold text-sky-900 disabled:opacity-50">{legacyImportBusy ? 'Working…' : 'Preview archive'}</button></div>{legacyPreview && <div className="mt-4 border-t border-sky-200 pt-3"><p className="text-xs font-semibold text-sky-950">{legacyPreview.importableCount} can be imported · {legacyPreview.duplicateCount} already imported</p><p className="mt-1 text-[11px] leading-5 text-sky-900">Employee records without a server-side match will remain unlinked. Legacy approvals and attachment files are not migrated; they remain in this browser backup.</p><ul className="mt-2 max-h-32 space-y-1 overflow-auto text-[11px] text-sky-900">{legacyPreview.records.slice(0, 8).map((item) => <li key={item.index}>{item.reference || `Record ${item.index + 1}`} · {item.employeeName || 'Unknown employee'} · {item.duplicate ? 'Already imported' : item.importable ? item.employeeMatched ? 'Ready' : 'Ready, employee not matched' : item.reason}</li>)}</ul><div className="mt-3 flex flex-wrap items-center gap-2"><button type="button" disabled={legacyImportBusy || legacyPreview.importableCount === 0} onClick={() => void importLegacyArchive()} className="rounded-lg bg-sky-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-45">{legacyImportBusy ? 'Importing…' : `Import ${legacyPreview.importableCount} records`}</button><button type="button" disabled={legacyImportBusy} onClick={() => setLegacyPreview(null)} className="rounded-lg border border-sky-300 bg-white px-3 py-2 text-xs font-semibold text-sky-900 disabled:opacity-50">Cancel</button></div></div>}{legacyImportMessage && <p role="status" className="mt-3 rounded-md bg-white px-3 py-2 text-xs text-emerald-800">{legacyImportMessage}</p>}</section> : null}

    <section aria-label="Salary advance summary" className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><AdvanceMetric label="Awaiting review" value={pending.length} detail="Requests needing a decision" icon="ClipboardList" tone="amber" /><AdvanceMetric label="Approved, not disbursed" value={approved.length} detail="Approved advances awaiting payout" icon="BadgeCheck" tone="green" /><AdvanceMetric label="Active advances" value={activeAdvances.length} detail="Currently being repaid" icon="HandCoins" tone="blue" /><AdvanceMetric label="Outstanding balance" value={money(totalOutstanding)} detail="Disbursed less recorded repayments" icon="WalletCards" tone="slate" /></section>

    <div role="tablist" aria-label="Salary advance records" className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">{views.map((item) => { const count = item === 'Requests' ? pending.length + approved.length : item === 'Active advances' ? activeAdvances.length : item === 'Repayment history' ? repayments.length : records.length; return <button key={item} type="button" role="tab" aria-selected={view === item} onClick={() => setView(item)} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-xs font-semibold ${view === item ? 'border-[#6d28d9] text-[#6d28d9]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{item}<span className={`rounded-full px-1.5 py-0.5 text-[10px] ${view === item ? 'bg-[#f1eafd] text-[#6d28d9]' : 'bg-slate-100 text-slate-500'}`}>{count}</span></button> })}</div>

    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 xl:flex-row xl:items-center xl:justify-between"><div><h3 className="text-sm font-bold">{view}</h3><p className="mt-1 text-xs text-slate-400">{view === 'Repayment history' ? `${repayments.length} recorded repayments · schedules are reminders only` : `${rows.length} matching advance${rows.length === 1 ? '' : 's'}`}</p></div><div className="flex flex-wrap gap-2"><label className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><Icons.Search className="size-4 shrink-0 text-slate-400" /><input aria-label="Search salary advances" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Employee, reference, reason" className="w-44 bg-transparent text-xs outline-none" /></label><select aria-label="Filter salary advances by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><option>All statuses</option>{['Pending HR review', 'Pending GM review', 'Approved', 'Rejected', 'Active', 'Settled', 'Legacy archive'].map((status) => <option key={status}>{status}</option>)}</select><select aria-label="Filter salary advances by frequency" value={frequencyFilter} onChange={(event) => setFrequencyFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><option>All frequencies</option><option>Weekly</option><option>Monthly</option></select></div></div>
      {error && <p role="alert" className="mx-4 mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{error}</p>}
      {submitting && <p role="status" className="mx-4 mt-3 text-xs text-slate-500">Saving salary-advance changes…</p>}
      {view === 'Repayment history' ? repayments.filter(({ advance, repayment }) => `${advance.reference} ${advance.employeeName} ${repayment.reference ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()) && (frequencyFilter === 'All frequencies' || (advance.approvedFrequency ?? advance.proposedFrequency) === frequencyFilter) && (statusFilter === 'All statuses' || advance.status === statusFilter)).length ? <div className="overflow-x-auto"><table className="w-full min-w-180 text-left text-xs"><thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-400"><tr>{['Advance', 'Employee', 'Date', 'Amount', 'Method', 'Reference', ''].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{repayments.filter(({ advance, repayment }) => `${advance.reference} ${advance.employeeName} ${repayment.reference ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()) && (frequencyFilter === 'All frequencies' || (advance.approvedFrequency ?? advance.proposedFrequency) === frequencyFilter) && (statusFilter === 'All statuses' || advance.status === statusFilter)).map(({ advance, repayment }) => <tr key={repayment.id} className="border-t border-slate-100 text-slate-600"><td className="px-4 py-3 font-semibold text-slate-800">{advance.reference}</td><td className="px-4 py-3">{advance.employeeName}<span className="mt-1 block text-[10px] text-slate-400">{advance.employeeNumber}</span></td><td className="px-4 py-3">{formatDate(repayment.date)}</td><td className="px-4 py-3 font-semibold text-emerald-700">{money(repayment.amount)}</td><td className="px-4 py-3">{repayment.method}</td><td className="px-4 py-3">{repayment.reference || '—'}</td><td className="px-4 py-3"><button type="button" onClick={() => setSelectedId(advance.id)} className="font-semibold text-[#6d28d9] hover:underline">Details</button></td></tr>)}</tbody></table></div> : <EmptyState title="No repayments recorded" detail="Saved repayments will appear here with their date, amount, and source." /> : rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-250 text-left text-xs"><thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-400"><tr>{['Advance / employee', 'Requested', 'Approved', 'Repayment terms', 'Repaid', 'Balance', 'Next due', 'Status', ''].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{rows.map((advance) => <tr key={advance.id} className="border-t border-slate-100 text-slate-600 hover:bg-slate-50/70"><td className="px-4 py-3"><button type="button" onClick={() => setSelectedId(advance.id)} className="text-left font-semibold text-slate-800 hover:text-[#6d28d9] hover:underline">{advance.employeeName}<span className="mt-1 block font-mono text-[10px] font-normal text-slate-400">{advance.reference} · {advance.employeeNumber}</span></button></td><td className="px-4 py-3">{money(advance.requestedAmount)}<span className="mt-1 block text-[10px] text-slate-400">{formatDate(advance.requestedAt.slice(0, 10))}</span></td><td className="px-4 py-3">{advance.approvedAmount ? money(advance.approvedAmount) : '—'}<span className="mt-1 block text-[10px] text-slate-400">Disbursed {advance.disbursement ? money(advance.disbursement.amount) : 'No'}</span></td><td className="px-4 py-3">{advance.approvedFrequency ?? advance.proposedFrequency}<span className="mt-1 block text-[10px] text-slate-400">{money(advance.approvedInstallmentAmount ?? advance.proposedInstallmentAmount)} per installment</span></td><td className="px-4 py-3">{money(repaidAmount(advance))}</td><td className="px-4 py-3 font-semibold">{advance.disbursement ? money(balance(advance)) : '—'}</td><td className="px-4 py-3">{advance.schedule.find((entry) => entry.dueDate >= today()) ? formatDate(advance.schedule.find((entry) => entry.dueDate >= today())!.dueDate) : '—'}</td><td className="px-4 py-3"><span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${statusTone(advance.status)}`}>{advance.status}</span></td><td className="px-4 py-3"><button type="button" onClick={() => setSelectedId(advance.id)} aria-label={`View ${advance.reference} details`} className="grid size-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100"><Icons.ChevronRight className="size-4" /></button></td></tr>)}</tbody></table></div> : <EmptyState title={records.length ? 'No advances match these filters' : 'No salary advances yet'} detail={records.length ? 'Adjust the search or filters to see advance records.' : 'Create a request to begin the review and disbursement workflow.'} />}
      <footer className="border-t border-slate-100 px-4 py-3 text-[10px] text-slate-400">Outstanding balance includes disbursed funds only. Schedule entries are reminders, not repayments.</footer>
    </section>
    {dialog && <AdvanceDialog mode={dialog} state={state} advance={selected} error={error} submitting={submitting} onClose={() => { setDialog(null); setError('') }} onSubmit={dialog === 'request' ? createRequest : dialog === 'review' ? reviewRequest : dialog === 'disbursement' ? recordDisbursement : recordRepayment} />}
  </div>
}

function AdvanceDetails({ advance, currentUser, error, onRemoveAttachment, onOpenAttachment, onBack, onViewEmployee, onAction, onExport }: { advance: SalaryAdvance; currentUser: UserAccount; error: string; onRemoveAttachment: (id: string) => void; onOpenAttachment: (id: string) => void; onBack: () => void; onViewEmployee: (id: string) => void; onAction: (dialog: Dialog) => void; onExport: () => void }) {
  const currentBalance = balance(advance)
  const progress = advance.disbursement?.amount ? Math.min(100, (repaidAmount(advance) / advance.disbursement.amount) * 100) : 0
  const nextDue = advance.schedule.find((entry) => entry.dueDate >= today())
  const canReviewHr = currentUser.roles.includes('Human Resource') && advance.status === 'Pending HR review'
  const canReviewGm = currentUser.roles.includes('General Manager') && advance.status === 'Pending GM review'
  const canEditPayments = currentUser.roles.includes('Human Resource')
  const canEditAttachments = currentUser.roles.includes('Human Resource') && ['Pending HR review', 'Pending GM review'].includes(advance.status)
  return <div className="animate-in fade-in duration-200">
    <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-[#6d28d9] hover:underline"><Icons.ArrowLeft className="size-4" /> Back to advances</button>
    <header className="mb-5 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 lg:flex-row lg:items-center"><div className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#f1eafd] text-[#6d28d9]"><Icons.HandCoins className="size-5" /></div><div className="min-w-0 flex-1"><div className="text-xs text-slate-400">Salary advance · {advance.legacyReference || advance.reference}</div><h2 className="mt-1 text-xl font-bold text-slate-900">{advance.employeeName}</h2><div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500"><span>{advance.employeeNumber}</span><span>·</span><span>{advance.department}</span><span>·</span><span>{advance.role}</span><span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${statusTone(advance.status)}`}>{advance.status}</span>{advance.legacyUnverified && <span className="rounded-md bg-orange-50 px-2 py-1 text-[10px] font-semibold text-orange-700">Imported legacy record · original status: {advance.legacyStatus || 'Unknown'}</span>}</div></div><div className="flex flex-wrap gap-2"><button type="button" onClick={onExport} disabled={!advance.repayments.length} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"><Icons.Download className="size-4" /> Repayments CSV</button>{advance.employeeId && <button type="button" onClick={() => onViewEmployee(advance.employeeId)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Icons.UserRound className="size-4" /> Employee profile</button>}{(canReviewHr || canReviewGm) && <button type="button" onClick={() => onAction('review')} className="inline-flex items-center gap-2 rounded-lg bg-[#6d28d9] px-3 py-2 text-xs font-semibold text-white hover:bg-[#5b21b6]"><Icons.ClipboardCheck className="size-4" /> {canReviewHr ? 'HR review' : 'Finalize approval'}</button>}{canEditPayments && advance.status === 'Approved' && !advance.disbursement && <button type="button" onClick={() => onAction('disbursement')} className="inline-flex items-center gap-2 rounded-lg bg-[#6d28d9] px-3 py-2 text-xs font-semibold text-white hover:bg-[#5b21b6]"><Icons.Banknote className="size-4" /> Record disbursement</button>}{canEditPayments && advance.status === 'Active' && <button type="button" onClick={() => onAction('repayment')} className="inline-flex items-center gap-2 rounded-lg bg-[#6d28d9] px-3 py-2 text-xs font-semibold text-white hover:bg-purple-700"><Icons.CircleDollarSign className="size-4" /> Record repayment</button>}</div></header>
    {error && <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{error}</p>}

    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><AdvanceMetric label="Requested" value={money(advance.requestedAmount)} detail={`Submitted ${formatDate(advance.requestedAt.slice(0, 10))}`} icon="FilePlus2" tone="slate" /><AdvanceMetric label="Approved" value={advance.approvedAmount ? money(advance.approvedAmount) : '—'} detail="Approved amount; not necessarily disbursed" icon="BadgeCheck" tone="green" /><AdvanceMetric label="Disbursed" value={advance.disbursement ? money(advance.disbursement.amount) : '—'} detail={advance.disbursement ? formatDate(advance.disbursement.date) : 'No disbursement recorded'} icon="Banknote" tone="blue" /><AdvanceMetric label="Outstanding" value={advance.disbursement ? money(currentBalance) : '—'} detail="Disbursed amount less actual repayments" icon="WalletCards" tone={currentBalance ? 'amber' : 'green'} /></div>

    <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-4">
        <section className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="text-sm font-bold">Request details</h3><div className="mt-4 grid gap-4 sm:grid-cols-2"><AdvanceField label="Employee category" value={advance.category} /><AdvanceField label="Employee pay frequency" value={advance.paymentFrequency ?? 'Not configured'} /><AdvanceField label="Requested amount" value={money(advance.requestedAmount)} /><AdvanceField label="Date taken" value={formatDate(advance.dateTaken)} /><AdvanceField label="Date approved" value={advance.dateApproved ? formatDate(advance.dateApproved) : 'Not approved'} />{advance.legacyUnverified && <AdvanceField label="Original reference" value={advance.legacyReference || 'Not recorded'} />}<AdvanceField label="Reason" value={advance.reason} wide /><AdvanceField label="Proposed repayments" value={`${money(advance.proposedInstallmentAmount)} ${advance.proposedFrequency.toLowerCase()}`} /></div>{advance.legacyUnverified && <p role="note" className="mt-4 rounded-lg bg-orange-50 p-3 text-xs leading-5 text-orange-900">This browser archive record is read-only. Its approval history and attachments were not verified as part of import and cannot authorize payments or repayments.</p>}<section aria-label="Advance attachments" className="mt-5 border-t border-slate-100 pt-4"><h3 className="text-xs font-bold text-slate-800">Attachments</h3>{advance.attachments.length ? <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">{advance.attachments.map((attachment) => <article key={attachment.id} className="overflow-hidden rounded-lg border border-slate-200"><button type="button" onClick={() => onOpenAttachment(attachment.id)} className="flex min-h-24 w-full flex-col items-center justify-center gap-2 bg-slate-50 p-3 text-xs font-semibold text-primary hover:bg-purple-50"><Icons.FileText className="size-6" />{attachment.mediaType === 'application/pdf' ? 'Open PDF' : 'Open image'}</button><div className="flex items-center gap-2 border-t border-slate-100 px-2.5 py-2"><span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-slate-600">{attachment.name}</span>{canEditAttachments && <button type="button" onClick={() => onRemoveAttachment(attachment.id)} className="text-[10px] font-semibold text-rose-600 hover:underline">Remove</button>}</div></article>)}</div> : <p className="mt-2 text-xs text-slate-400">No attachments provided.</p>}</section>{advance.status === 'Rejected' && <div className="mt-4 rounded-lg border border-rose-100 bg-rose-50 p-3"><div className="text-[10px] font-semibold uppercase text-rose-700">Rejection reason</div><p className="mt-1 text-xs text-rose-900">{advance.rejectionReason}</p></div>}</section>
        <section className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold">Approval history and terms</h3><p className="mt-1 text-xs text-slate-500">HR proposes; the General Manager finalizes the decision.</p></div></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{(['HR review', 'General Manager review'] as const).map((label, index) => { const decision = index === 0 ? advance.hrDecision : advance.gmDecision; return <article key={label} className="rounded-lg border border-slate-100 bg-slate-50 p-3"><div className="text-[10px] font-semibold uppercase text-slate-500">{label}</div><div className="mt-1 text-xs font-semibold text-slate-800">{decision ? `${decision.decision} · ${decision.actorName}` : `Waiting for ${index === 0 ? 'HR' : 'General Manager'}`}</div>{decision?.amount && <div className="mt-1 text-[10px] text-slate-500">Terms: {money(decision.amount)} · {money(decision.installmentAmount ?? 0)} / {decision.frequency?.toLowerCase()}</div>}{decision?.note && <div className="mt-1 text-[10px] text-slate-500">{decision.note}</div>}</article> })}</div>{advance.approvedAmount && <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3"><AdvanceField label="Final approved amount" value={money(advance.approvedAmount)} /><AdvanceField label="Installment" value={`${money(advance.approvedInstallmentAmount ?? 0)} ${advance.approvedFrequency?.toLowerCase()}`} /><AdvanceField label="First installment due" value={advance.schedule[0]?.dueDate ? formatDate(advance.schedule[0].dueDate) : '—'} /></div>}</section>
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

function AdvanceDialog({ mode, state, advance, error, submitting = false, onClose, onSubmit }: { mode: Exclude<Dialog, null>; state: ErpState; advance: SalaryAdvance | null; error: string; submitting?: boolean; onClose: () => void; onSubmit: (form: FormData, attachments: PendingUpload[]) => void | Promise<void> }) {
  const [decision, setDecision] = useState<'Approved' | 'Rejected'>('Approved')
  const [attachments, setAttachments] = useState<PendingUpload[]>([])
  const [attachmentError, setAttachmentError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const employeeChoices = state.employees.filter((employee) => employee.status === 'Active')
  const frequency = advance?.hrDecision?.frequency ?? advance?.proposedFrequency ?? 'Monthly'
  const suggestedAmount = advance?.hrDecision?.amount ?? advance?.requestedAmount
  const suggestedInstallment = advance?.hrDecision?.installmentAmount ?? advance?.proposedInstallmentAmount
  const title = mode === 'request' ? 'New advance request' : mode === 'review' ? 'Review advance request' : mode === 'disbursement' ? 'Record disbursement' : 'Record repayment'
  const submitLabel = mode === 'request' ? 'Submit request' : mode === 'review' ? 'Save decision' : mode === 'disbursement' ? 'Record disbursement' : 'Save repayment'
  const labelClass = 'block text-xs font-semibold text-slate-600'
  const fieldClass = 'mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#8b5cf6] focus:ring-2 focus:ring-purple-100'
  const todayValue = today()

  const addAttachments = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.currentTarget.value = ''
    setAttachmentError('')
    if (attachments.length + files.length > 5) {
      setAttachmentError('Attach up to 5 files.')
      return
    }
    if (files.some((file) => !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type) || file.size > 10 * 1024 * 1024)) {
      setAttachmentError('Attachments must be JPG, PNG, WebP, or PDF files up to 10 MB each.')
      return
    }
    try {
      const added = await Promise.all(files.map(async (file) => {
        if (file.type === 'application/pdf') {
          return { attachment: { id: createId('AATT'), name: file.name, dataUrl: '', mediaType: file.type, sizeBytes: file.size }, file }
        }
        const attachment = await compressAdvanceAttachment(file)
        return { attachment, file: attachmentFile(attachment) }
      }))
      const next = [...attachments, ...added]
      if (next.reduce((total, item) => total + item.file.size, 0) > 10 * 1024 * 1024) {
        setAttachmentError('Attachments must total 10 MB or less after image optimization.')
        return
      }
      setAttachments(next)
    } catch (processingError) {
      setAttachmentError(processingError instanceof Error ? processingError.message : 'Could not process the selected images.')
    }
  }

  const removeAttachment = (id: string) => {
    setAttachments((current) => current.filter((item) => item.attachment.id !== id))
    setAttachmentError('')
  }

  return <div className="fixed inset-0 z-90 grid place-items-center bg-slate-950/45 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section role="dialog" aria-modal="true" aria-labelledby="advance-dialog-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 id="advance-dialog-title" className="text-base font-bold">{title}</h2><p className="mt-1 text-xs text-slate-500">{advance ? `${advance.reference} · ${advance.employeeName}` : 'Request, review, and payment actions remain separate.'}</p></div><button type="button" aria-label="Close form" onClick={onClose} className="grid size-8 place-items-center rounded-md text-slate-400 hover:bg-slate-100"><Icons.X className="size-4" /></button></header>
    <form onSubmit={(event) => {
      event.preventDefault()
      if (mode === 'request' && attachmentError) return
      void onSubmit(new FormData(event.currentTarget), attachments)
    }} className="p-5">
      {mode === 'request' && <div className="grid gap-4 sm:grid-cols-2">
        <label className={`${labelClass} sm:col-span-2`}>Employee<select required name="employeeId" defaultValue="" className={fieldClass}><option value="" disabled>Select an active employee</option>{employeeChoices.map((employee) => <option key={employee.id} value={employee.id}>{employeeDisplayName(employee)} · {employee.number} · {employee.department} · {employee.paymentFrequency ?? 'Pay frequency not set'}</option>)}</select></label>
        <label className={labelClass}>Requested amount (UGX)<input required name="requestedAmount" type="number" min="1" step="1" className={fieldClass} /></label>
        <label className={labelClass}>Date taken<input required name="dateTaken" type="date" max={todayValue} defaultValue={todayValue} className={fieldClass} /></label>
        <label className={labelClass}>Proposed repayment frequency<select name="frequency" defaultValue="Monthly" className={fieldClass}><option>Monthly</option><option>Weekly</option></select></label>
        <label className={labelClass}>Proposed installment (UGX)<input required name="installmentAmount" type="number" min="1" step="1" className={fieldClass} /></label>
        <label className={`${labelClass} sm:col-span-2`}>Reason<textarea required name="reason" rows={3} className={fieldClass} placeholder="Why is the advance requested?" /></label>
        <section aria-label="Advance attachments" className="sm:col-span-2 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h3 className="text-xs font-bold text-slate-800">Attachments</h3><p className="mt-1 text-[10px] text-slate-500">JPG, PNG, WebP, or PDF · up to 5 files · 10 MB total</p></div>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple onChange={addAttachments} className="sr-only" />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-primary px-3 py-2 text-xs font-semibold text-primary hover:bg-secondary"><Icons.Paperclip className="size-4" /> Upload attachment</button>
          </div>
          {attachmentError && <p role="alert" className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{attachmentError}</p>}
          {attachments.length ? <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{attachments.map(({ attachment }) => <article key={attachment.id} className="overflow-hidden rounded-lg border border-slate-200">{attachment.mediaType.startsWith('image/') ? <img src={attachment.dataUrl} alt={`Advance attachment: ${attachment.name}`} className="h-28 w-full bg-slate-50 object-contain" /> : <div className="grid h-28 place-items-center bg-slate-50"><Icons.FileText className="size-8 text-slate-400" /></div>}<div className="flex items-center gap-2 border-t border-slate-100 px-2.5 py-2"><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-semibold text-slate-700" title={attachment.name}>{attachment.name}</p><p className="text-[9px] text-slate-400">{attachmentSize(attachment.sizeBytes)}</p></div><button type="button" onClick={() => removeAttachment(attachment.id)} aria-label={`Remove ${attachment.name}`} className="grid size-7 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-700"><Icons.Trash2 className="size-3.5" /></button></div></article>)}</div> : <p className="mt-3 rounded-lg border border-dashed border-slate-200 px-3 py-5 text-center text-xs text-slate-400">No attachments added.</p>}
        </section>
        <p className="text-[11px] text-slate-400 sm:col-span-2">The repayment schedule is generated when approved. It is a reminder only; no amount becomes outstanding until a disbursement is recorded.</p>
      </div>}
      {mode === 'review' && advance && <div className="grid gap-4 sm:grid-cols-2"><div className="rounded-lg bg-purple-50 p-3 text-xs text-purple-900 sm:col-span-2">{advance.status === 'Pending HR review' ? 'HR reviews the request and proposes repayment terms. The General Manager must make the final approval.' : 'HR has approved the request. The General Manager may confirm or edit the terms before final approval.'}</div><label className={labelClass}>Decision<select name="decision" value={decision} onChange={(event) => setDecision(event.target.value as typeof decision)} className={fieldClass}><option value="Approved">Approve</option><option value="Rejected">Reject</option></select></label>{decision === 'Approved' && <><label className={labelClass}>{advance.status === 'Pending HR review' ? 'Proposed amount (UGX)' : 'Final approved amount (UGX)'}<input required name="approvedAmount" type="number" min="1" max={advance.requestedAmount} defaultValue={suggestedAmount} className={fieldClass} /></label><label className={labelClass}>Repayment frequency<select name="frequency" defaultValue={frequency} className={fieldClass}><option>Monthly</option><option>Weekly</option></select></label><label className={labelClass}>Installment amount (UGX)<input required name="installmentAmount" type="number" min="1" max={advance.requestedAmount} defaultValue={suggestedInstallment} className={fieldClass} /></label><label className={`${labelClass} sm:col-span-2`}>Decision note<textarea name="decisionNote" rows={2} className={fieldClass} /></label></>}<label className={`${labelClass} sm:col-span-2`}>Rejection reason <span className="font-normal text-slate-400">Required if rejected</span><textarea required={decision === 'Rejected'} name="rejectionReason" rows={2} className={fieldClass} /></label><p className="text-[11px] text-slate-400 sm:col-span-2">Date approved and the repayment schedule are generated only after General Manager approval.</p></div>}
      {mode === 'disbursement' && advance && <div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}>Actual disbursed amount (UGX)<input required name="amount" type="number" min="1" max={advance.approvedAmount} defaultValue={advance.approvedAmount} className={fieldClass} /></label><label className={labelClass}>Disbursement date<input required name="date" type="date" max={todayValue} defaultValue={todayValue} className={fieldClass} /></label><label className={labelClass}>Payment method<select name="method" className={fieldClass}><option>Cash</option><option>Mobile Money</option><option>Bank Transfer</option></select></label><label className={labelClass}>Payment reference<input name="reference" className={fieldClass} placeholder="Optional transaction/reference" /></label><p className="text-[11px] text-slate-400 sm:col-span-2">The recorded amount cannot exceed the approved amount. Only this actual amount becomes the employee&apos;s balance.</p></div>}
      {mode === 'repayment' && advance && <div className="grid gap-4 sm:grid-cols-2"><div className="rounded-lg bg-emerald-50 p-3 sm:col-span-2"><div className="text-[10px] font-semibold uppercase text-emerald-800">Remaining balance</div><div className="mt-1 text-lg font-bold text-emerald-950">{money(balance(advance))}</div></div><label className={labelClass}>Repayment amount (UGX)<input required name="amount" type="number" min="1" max={balance(advance)} step="1" className={fieldClass} /></label><label className={labelClass}>Received date<input required name="date" type="date" max={todayValue} defaultValue={todayValue} className={fieldClass} /></label><label className={labelClass}>Method<select name="method" className={fieldClass}><option>Cash</option><option>Mobile Money</option><option>Bank Transfer</option><option>Payroll</option></select></label><label className={labelClass}>Reference<input name="reference" className={fieldClass} placeholder="Transaction or receipt reference" /></label><label className={`${labelClass} sm:col-span-2`}>Note<textarea name="note" rows={2} className={fieldClass} /></label><p className="text-[11px] text-slate-400 sm:col-span-2">“Payroll” records the source label only; no payroll run integration or deduction is performed.</p></div>}
      {error && <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{error}</p>}
      <footer className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={onClose} disabled={submitting} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-50">Cancel</button><button type="submit" disabled={submitting} className="rounded-lg bg-[#6d28d9] px-4 py-2 text-xs font-semibold text-white hover:bg-[#5b21b6] disabled:opacity-50">{submitting ? 'Saving…' : submitLabel}</button></footer>
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