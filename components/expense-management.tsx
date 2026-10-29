'use client'

import { useEffect, useRef, useState } from 'react'
import * as Icons from 'lucide-react'
import { exportCsv, formatDate, money, type ErpState, type ExpenseAttachment as LocalAttachment, type UgandaTaxType } from '@/lib/erp'
import {
  EXPENSE_CATEGORIES,
  type ExpenseAttachment,
  type ExpensePaymentMethod,
  type ExpenseRecord,
  type ExpenseStatus,
  type ManualExpense,
  type CreateExpenseInput,
} from '@/lib/expenses'
import {
  useCreateExpense,
  useExpenses,
  useExpenseAttachmentDownload,
  useImportLegacyExpenses,
  useRecordExpensePayment,
  useRemoveExpenseAttachment,
  useUploadExpenseAttachment,
} from '@/lib/expense-queries'
import type { UserAccount } from '@/lib/user-api'
import { hasAnyDepartmentRole } from '@/lib/authorization'

type Props = {
  state: ErpState
  currentUser: UserAccount
  onViewPayrollRun: (id: string) => void
}
type ExpenseTab = 'All expenses' | 'Pending approval' | 'Approved' | 'Partially paid' | 'Legacy unverified' | 'Paid' | 'Rejected'
type PeriodFilter = 'All dates' | 'This week' | 'This month' | 'Custom'
type ReceiptDraft = { preview: LocalAttachment; file: File }

const expenseTypes: NonNullable<ErpState['expenses'][number]['expenseType']>[] = ['Supplier bill', 'Employee reimbursement', 'Petty cash / other']
const ugandaTaxTypes: UgandaTaxType[] = [
  'Value Added Tax (VAT) - non-recoverable input tax',
  'Corporation tax',
  'Presumptive tax',
  'Pay As You Earn (PAYE)',
  'Withholding tax',
  'Excise duty',
  'Import / customs duty',
  'Stamp duty',
  'Local Service Tax (LST)',
  'Property rates',
  'Tax penalty or interest',
  'Other tax',
]
const departments = ['Finance', 'HR', 'Inventory', 'Marketing', 'Operations', 'Production', 'Sales']
const migrationKey = 'lumina-erp-expense-import-v1'
const companyDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

function compressReceipt(file: File): Promise<ReceiptDraft> {
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
        reader.onload = () => {
          const optimized = new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, { type: blob.type })
          resolve({
            preview: {
              id: `${Date.now()}-${Math.random()}`,
              name: file.name,
              dataUrl: String(reader.result),
              mediaType: blob.type,
              sizeBytes: blob.size,
            },
            file: optimized,
          })
        }
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

function dateOffset(date: string, days: number) {
  const value = new Date(`${date}T12:00:00.000Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function totalAmount(expenses: ExpenseRecord[]) {
  return expenses.reduce((sum, expense) => sum + expense.amount, 0)
}

function ExpenseMetric({ label, value, detail, icon, tone }: { label: string; value: string; detail: string; icon: string; tone: 'amber' | 'green' | 'primary' | 'blue' }) {
  const Icon = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[icon] ?? Icons.Receipt
  const toneClass = tone === 'amber' ? 'bg-amber-50 text-amber-700' : tone === 'green' ? 'bg-emerald-50 text-emerald-700' : tone === 'primary' ? 'bg-secondary text-primary' : 'bg-sky-50 text-sky-700'
  return <article className="rounded-lg border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><span className={`grid size-9 place-items-center rounded-md ${toneClass}`}><Icon className="size-4" /></span><span className="text-[9px] font-semibold uppercase text-slate-400">Live</span></div><div className="mt-3 text-xl font-bold tracking-tight text-slate-900">{value}</div><h3 className="mt-0.5 text-xs font-semibold text-slate-700">{label}</h3><p className="mt-1 text-[10px] text-slate-500">{detail}</p></article>
}

function apiMessage(error: unknown) {
  return error instanceof Error ? error.message : 'The expense request could not be completed.'
}

export default function ExpenseManagement({ state, currentUser, onViewPayrollRun }: Props) {
  const roles = currentUser.roles
  const canRead = hasAnyDepartmentRole(roles, ['Accountant', 'General Manager', 'Admin'])
  const canCreate = hasAnyDepartmentRole(roles, ['Accountant', 'General Manager'])
  const canPay = hasAnyDepartmentRole(roles, ['Accountant', 'General Manager'])
  const query = useExpenses({ limit: 200 }, canRead)
  const createMutation = useCreateExpense()
  const paymentMutation = useRecordExpensePayment()
  const uploadMutation = useUploadExpenseAttachment()
  const removeAttachmentMutation = useRemoveExpenseAttachment()
  const importMutation = useImportLegacyExpenses()
  const getAttachmentDownload = useExpenseAttachmentDownload()
  const [tab, setTab] = useState<ExpenseTab>('All expenses')
  const [period, setPeriod] = useState<PeriodFilter>('All dates')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [category, setCategory] = useState('All categories')
  const [department, setDepartment] = useState('All departments')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<ExpenseRecord | null>(null)
  const [message, setMessage] = useState('')
  const [legacyImportAvailable, setLegacyImportAvailable] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') setLegacyImportAvailable(window.localStorage.getItem(migrationKey) !== 'success' && state.expenses.length > 0)
  }, [state.expenses.length])

  if (!canRead) return <section role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">You do not have permission to access expense records.</section>

  const today = companyDate()
  const currentMonth = today.slice(0, 7)
  const weekday = new Date(`${today}T12:00:00.000Z`).getUTCDay()
  const weekStart = dateOffset(today, -((weekday + 6) % 7))
  const expenses = query.data?.expenses ?? []
  const manualExpenses = expenses.filter((expense): expense is ManualExpense => expense.source === 'Manual')
  const pending = manualExpenses.filter((expense) => expense.status === 'Pending approval')
  const paid = expenses.filter((expense) => expense.status === 'Paid')
  const monthExpenses = expenses.filter((expense) => expense.date.startsWith(currentMonth))
  const weekExpenses = expenses.filter((expense) => expense.date >= weekStart && expense.date <= today)
  const expenseDepartments = [...new Set(expenses.map((expense) => expense.department).filter((value) => value !== 'Multiple'))].sort()
  const categories = [...new Set([...EXPENSE_CATEGORIES, 'Payroll', ...expenses.map((expense) => expense.category)])].sort()

  const visibleExpenses = expenses.filter((expense) => {
    const matchesTab = tab === 'All expenses'
      || (tab === 'Legacy unverified' ? expense.status === 'Legacy unverified' : expense.status === tab)
    const matchesPeriod = period === 'All dates'
      || (period === 'This week' && expense.date >= weekStart && expense.date <= today)
      || (period === 'This month' && expense.date.startsWith(currentMonth))
      || (period === 'Custom' && (!dateFrom || expense.date >= dateFrom) && (!dateTo || expense.date <= dateTo))
    const matchesCategory = category === 'All categories' || expense.category === category
    const matchesDepartment = department === 'All departments' || expense.department === department
    const haystack = `${expense.reference} ${expense.payee} ${expense.description} ${expense.category} ${'taxType' in expense ? expense.taxType ?? '' : ''} ${'payrollSubtype' in expense ? expense.payrollSubtype : ''} ${expense.department}`.toLowerCase()
    return matchesTab && matchesPeriod && matchesCategory && matchesDepartment && haystack.includes(search.trim().toLowerCase())
  }).sort((left, right) => right.date.localeCompare(left.date) || right.reference.localeCompare(left.reference))

  const saveExpense = async (event: React.FormEvent<HTMLFormElement>, receipts: ReceiptDraft[]) => {
    const form = new FormData(event.currentTarget)
    const input = {
      expenseType: String(form.get('expenseType')) as ManualExpense['expenseType'],
      date: String(form.get('date')),
      payee: String(form.get('payee')).trim(),
      category: String(form.get('category')) as CreateExpenseInput['category'],
      department: String(form.get('department')),
      amount: Number(form.get('amount')),
      description: String(form.get('description')).trim(),
      ...(form.get('category') === 'Tax' ? { taxType: String(form.get('taxType')) as UgandaTaxType } : {}),
    }
    setBusy(true)
    setMessage('')
    try {
      const { expense } = await createMutation.mutateAsync(input)
      let uploadFailure = ''
      for (const receipt of receipts) {
        try {
          await uploadMutation.mutateAsync({ id: expense.id, receipt: receipt.file })
        } catch (error) {
          uploadFailure = apiMessage(error)
          break
        }
      }
      setShowForm(false)
      setTab('All expenses')
      setPeriod('All dates')
      setCategory('All categories')
      setDepartment('All departments')
      setSearch('')
      setMessage(uploadFailure
        ? `Expense ${expense.reference} was saved, but a receipt could not be uploaded: ${uploadFailure}`
        : `Expense ${expense.reference} was submitted for General Manager approval.`)
    } catch (error) {
      setMessage(apiMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const recordPayment = async (expense: ManualExpense, form: FormData) => {
    setBusy(true)
    setMessage('')
    try {
      await paymentMutation.mutateAsync({
        id: expense.id,
        amount: Number(form.get('amount')),
        date: String(form.get('date')),
        method: String(form.get('method')) as ExpensePaymentMethod,
        reference: String(form.get('reference') || ''),
        note: String(form.get('note') || ''),
      })
      setMessage(`Payment was recorded for ${expense.reference}.`)
      setSelected(null)
    } catch (error) {
      setMessage(apiMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const importLegacy = async () => {
    if (!window.confirm(`Import ${state.expenses.length} browser-local records as unverified legacy expenses? Their past approval/payment status will not be trusted.`)) return
    setBusy(true)
    setMessage('')
    try {
      const result = await importMutation.mutateAsync(state.expenses)
      if (result.rejected.length === 0) {
        window.localStorage.setItem(migrationKey, 'success')
        setLegacyImportAvailable(false)
      }
      setMessage(`Legacy import complete: ${result.imported.length} imported, ${result.duplicates} already imported, ${result.rejected.length} rejected.`)
    } catch (error) {
      setMessage(apiMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const uploadAttachment = async (expense: ManualExpense, file: File) => {
    setBusy(true)
    setMessage('')
    try {
      const receipt = await compressReceipt(file)
      const result = await uploadMutation.mutateAsync({ id: expense.id, receipt: receipt.file })
      setSelected(result.expense)
      setMessage('Receipt uploaded.')
    } catch (error) {
      setMessage(apiMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const removeAttachment = async (expense: ManualExpense, attachment: ExpenseAttachment) => {
    setBusy(true)
    setMessage('')
    try {
      const result = await removeAttachmentMutation.mutateAsync({ id: expense.id, attachmentId: attachment.id })
      setSelected(result.expense)
      setMessage('Receipt removed.')
    } catch (error) {
      setMessage(apiMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const exportVisible = () => exportCsv('expenses.csv', visibleExpenses.map((expense) => ({
    source: expense.source,
    reference: expense.reference,
    date: expense.date,
    expenseType: 'expenseType' in expense ? expense.expenseType : expense.payrollSubtype,
    payee: expense.payee,
    taxType: 'taxType' in expense ? expense.taxType ?? '' : '',
    description: expense.description,
    category: expense.category,
    department: expense.department,
    amountUGX: expense.amount,
    paidUGX: expense.paidAmount,
    status: expense.status,
    payrollRun: expense.source === 'Payroll' ? expense.reference : '',
  })))

  return <div className="animate-in fade-in duration-300">
    <header className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><div className="mb-2 text-xs font-medium text-slate-400">Workspace / Finance Department</div><h2 className="text-2xl font-bold tracking-tight">Expenses</h2><p className="mt-1 text-sm text-slate-500">Manual expenses plus linked, read-only costs from approved payroll runs.</p></div>
      <div className="flex flex-wrap gap-2">
        {legacyImportAvailable && canCreate && <button type="button" disabled={busy} onClick={() => void importLegacy()} className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-900 disabled:opacity-50"><Icons.Archive className="size-4" /> Import legacy records</button>}
        <button type="button" onClick={exportVisible} disabled={!visibleExpenses.length} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><Icons.Download className="size-4" /> Export CSV</button>
        {canCreate && <button type="button" onClick={() => { setMessage(''); setShowForm(true) }} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"><Icons.Plus className="size-4" /> Record expense</button>}
      </div>
    </header>

    {expenses.some((expense) => expense.source === 'Payroll') && <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">Payroll costs show gross earnings plus employer contributions. Payroll payout amounts show cash paid to employees, so they do not necessarily reconcile to total payroll cost. This register is not a double-entry ledger.</p>}
    {query.isError && <div role="alert" className="mb-4 flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800"><span>{apiMessage(query.error)}</span><button type="button" onClick={() => void query.refetch()} className="font-semibold underline">Retry</button></div>}
    {message && <p role="status" className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-900">{message}</p>}
    <section aria-label="Expense summary" className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <ExpenseMetric label="Awaiting approval" value={money(totalAmount(pending))} detail={`${pending.length} manual request${pending.length === 1 ? '' : 's'} awaiting General Manager`} icon="Clock3" tone="amber" />
      <ExpenseMetric label="Paid" value={money(paid.reduce((sum, expense) => sum + expense.paidAmount, 0))} detail={`${paid.length} paid record${paid.length === 1 ? '' : 's'} · all dates`} icon="CircleCheck" tone="green" />
      <ExpenseMetric label="This month" value={money(totalAmount(monthExpenses))} detail={`${monthExpenses.length} manual and payroll records`} icon="CalendarDays" tone="primary" />
      <ExpenseMetric label="This week" value={money(totalAmount(weekExpenses))} detail={`${weekExpenses.length} manual and payroll records`} icon="CalendarRange" tone="blue" />
    </section>

    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div role="tablist" aria-label="Expense status" className="flex gap-1 overflow-x-auto border-b border-slate-200 px-4 pt-2">{(['All expenses', 'Pending approval', 'Approved', 'Partially paid', 'Legacy unverified', 'Paid', 'Rejected'] as ExpenseTab[]).map((item) => {
        const count = item === 'All expenses' ? expenses.length : expenses.filter((expense) => expense.status === item).length
        return <button key={item} type="button" role="tab" aria-selected={tab === item} onClick={() => setTab(item)} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-xs font-semibold ${tab === item ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{item}<span className={`rounded-full px-1.5 py-0.5 text-[10px] ${tab === item ? 'bg-secondary text-secondary-foreground' : 'bg-slate-100 text-slate-500'}`}>{count}</span></button>
      })}</div>
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 xl:flex-row xl:items-center xl:justify-between"><div><h3 className="text-sm font-bold">{tab}</h3><p className="mt-1 text-xs text-slate-500">{query.isLoading ? 'Loading expenses…' : `${visibleExpenses.length} matching expense${visibleExpenses.length === 1 ? '' : 's'}`}</p></div>
        <div className="flex flex-wrap gap-2">
          <label className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><Icons.Search className="size-4 shrink-0 text-slate-400" /><input aria-label="Search expenses" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search expenses" className="w-40 bg-transparent text-xs outline-none" /></label>
          <select aria-label="Filter expenses by period" value={period} onChange={(event) => setPeriod(event.target.value as PeriodFilter)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">{(['All dates', 'This week', 'This month', 'Custom'] as PeriodFilter[]).map((option) => <option key={option}>{option}</option>)}</select>
          <select aria-label="Filter expenses by category" value={category} onChange={(event) => setCategory(event.target.value)} className="max-w-44 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><option>All categories</option>{categories.map((option) => <option key={option}>{option}</option>)}</select>
          <select aria-label="Filter expenses by department" value={department} onChange={(event) => setDepartment(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><option>All departments</option>{expenseDepartments.map((option) => <option key={option}>{option}</option>)}</select>
          {period === 'Custom' && <><label className="sr-only" htmlFor="expense-date-from">From date</label><input id="expense-date-from" aria-label="Expenses from date" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs" /><label className="sr-only" htmlFor="expense-date-to">To date</label><input id="expense-date-to" aria-label="Expenses to date" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs" /></>}
        </div>
      </div>
      {query.isLoading ? <p role="status" className="px-5 py-14 text-center text-sm text-slate-500">Loading expenses from the server…</p> : visibleExpenses.length ? <div className="overflow-x-auto"><table className="w-full min-w-225 text-left text-xs"><thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-400"><tr>{['Reference', 'Date', 'Payee / description', 'Category', 'Department', 'Amount', 'Status', ''].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{visibleExpenses.map((expense) => <tr key={`${expense.source}-${expense.id}`} className="border-t border-slate-100 text-slate-600 hover:bg-slate-50/70"><td className="px-4 py-3 font-semibold text-slate-800">{expense.reference}<span className="mt-1 block text-[9px] font-medium uppercase text-slate-400">{expense.source === 'Payroll' ? 'Payroll linked' : expense.status === 'Legacy unverified' ? 'Legacy' : 'Manual'}</span></td><td className="px-4 py-3 whitespace-nowrap">{formatDate(expense.date)}</td><td className="max-w-65 px-4 py-3"><div className="truncate font-semibold text-slate-800">{expense.payee}</div><div className="mt-1 truncate text-[10px] text-slate-400">{expense.description}</div></td><td className="px-4 py-3">{expense.category}{expense.source === 'Payroll' && <span className="mt-1 block text-[10px] text-slate-400">{expense.payrollSubtype}</span>}{'taxType' in expense && expense.taxType && <span className="mt-1 block text-[10px] text-slate-400">{expense.taxType}</span>}</td><td className="px-4 py-3">{expense.department}</td><td className="px-4 py-3 font-semibold text-slate-800">{money(expense.amount)}</td><td className="px-4 py-3"><span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${expense.status === 'Paid' || expense.status === 'Approved' ? 'bg-emerald-50 text-emerald-700' : expense.status === 'Rejected' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{expense.status}</span></td><td className="px-4 py-3"><button type="button" onClick={() => setSelected(expense)} aria-label={`View expense ${expense.reference}`} className="inline-flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"><Icons.Eye className="size-4" /></button></td></tr>)}</tbody></table></div> : <div className="px-5 py-14 text-center"><span className="mx-auto grid size-10 place-items-center rounded-full bg-slate-100 text-slate-500"><Icons.ReceiptText className="size-4" /></span><h4 className="mt-3 text-sm font-semibold text-slate-800">{query.isError ? 'Could not load expenses' : 'No expenses match'}</h4><p className="mx-auto mt-1 max-w-md text-xs text-slate-500">{query.isError ? 'Retry the server request to load the expense register.' : 'Adjust the selected filters or record a new expense.'}</p><button type="button" onClick={() => { setTab('All expenses'); setPeriod('All dates'); setCategory('All categories'); setDepartment('All departments'); setSearch(''); setDateFrom(''); setDateTo('') }} className="mt-3 text-xs font-semibold text-teal-800 hover:underline">Clear filters</button></div>}
      <footer className="border-t border-slate-100 px-4 py-3 text-[10px] text-slate-400">Payroll rows are derived from approved runs and cannot be manually duplicated. This operational register is not a general ledger.</footer>
    </section>

    {showForm && <ExpenseForm busy={busy} onClose={() => setShowForm(false)} onSubmit={saveExpense} departments={expenseDepartments} />}
    {selected && <ExpenseDetails
      expense={selected}
      canPay={canPay && selected.source === 'Manual' && ['Approved', 'Partially paid'].includes(selected.status)}
      canManageAttachments={canCreate && selected.source === 'Manual' && selected.status === 'Pending approval'}
      busy={busy}
      onClose={() => setSelected(null)}
      onPayment={(form) => selected.source === 'Manual' ? void recordPayment(selected, form) : undefined}
      onViewPayrollRun={selected.source === 'Payroll' ? () => onViewPayrollRun(selected.sourceRunId) : undefined}
      onUploadAttachment={(file) => selected.source === 'Manual' ? void uploadAttachment(selected, file) : undefined}
      onRemoveAttachment={(attachment) => selected.source === 'Manual' ? void removeAttachment(selected, attachment) : undefined}
    />}
  </div>
}

function ExpenseForm({ onClose, onSubmit, departments, busy }: {
  onClose: () => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>, attachments: ReceiptDraft[]) => void
  departments: string[]
  busy: boolean
}) {
  const [attachments, setAttachments] = useState<ReceiptDraft[]>([])
  const [attachmentError, setAttachmentError] = useState('')
  const [category, setCategory] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fieldClass = 'mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-ring/30'
  const labelClass = 'block text-xs font-semibold text-slate-600'
  const addAttachments = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const files = Array.from(input.files ?? [])
    input.value = ''
    setAttachmentError('')
    if (!files.length) return
    if (attachments.length + files.length > 5) {
      setAttachmentError('Attach up to 5 receipt images per expense.')
      return
    }
    if (files.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) {
      setAttachmentError('Choose JPG, PNG, or WebP image files.')
      return
    }
    if (files.some((file) => file.size > 10 * 1024 * 1024)) {
      setAttachmentError('Each image must be smaller than 10 MB before optimization.')
      return
    }
    try {
      const added = await Promise.all(files.map(compressReceipt))
      const next = [...attachments, ...added]
      if (next.reduce((total, attachment) => total + attachment.preview.sizeBytes, 0) > 2 * 1024 * 1024) {
        setAttachmentError('Optimized receipt images must total 2 MB or less.')
        return
      }
      setAttachments(next)
    } catch (error) {
      setAttachmentError(apiMessage(error))
    }
  }
  return <div className="fixed inset-0 z-80 grid place-items-center bg-slate-950/40 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}><section role="dialog" aria-modal="true" aria-labelledby="expense-form-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 id="expense-form-title" className="text-base font-bold">Record expense</h2><p className="mt-1 text-xs text-slate-500">Accountant submits expenses for General Manager approval; payment is recorded separately.</p></div><button type="button" aria-label="Close expense form" onClick={onClose} className="grid size-8 place-items-center rounded-md text-slate-400 hover:bg-slate-100"><Icons.X className="size-4" /></button></header>
    <form onSubmit={(event) => { event.preventDefault(); onSubmit(event, attachments) }} className="p-5"><div className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-[10px] leading-4 text-amber-900">Saving submits this expense for approval. Payroll salary, wages, and feeding entries are generated from approved payroll runs and cannot be entered here.</div><div className="grid gap-4 sm:grid-cols-2">
      <label className={labelClass}>Expense type<select name="expenseType" defaultValue="Supplier bill" className={fieldClass}>{expenseTypes.map((option) => <option key={option}>{option}</option>)}</select></label>
      <label className={labelClass}>Expense date<input required name="date" type="date" defaultValue={companyDate()} className={fieldClass} /></label>
      <label className={labelClass}>Payee<input required name="payee" className={fieldClass} placeholder="Supplier or employee name" /></label>
      <label className={labelClass}>Category<select required name="category" value={category} onChange={(event) => setCategory(event.target.value)} className={fieldClass}><option value="" disabled>Select category</option>{EXPENSE_CATEGORIES.map((option) => <option key={option}>{option}</option>)}</select></label>
      {category === 'Tax' && <><label className={labelClass}>Tax type<select required name="taxType" defaultValue="" className={fieldClass}><option value="" disabled>Select tax type</option>{ugandaTaxTypes.map((option) => <option key={option}>{option}</option>)}</select></label><p className="rounded-md bg-amber-50 px-3 py-2 text-[10px] leading-4 text-amber-900 sm:col-span-2">Only record tax here when it is a company expense. VAT collected and PAYE/withholding deducted from others are generally liabilities, not expenses; confirm classification with your accountant.</p></>}
      <label className={labelClass}>Department<select required name="department" defaultValue={departments.includes('Operations') ? 'Operations' : departments[0] ?? 'Operations'} className={fieldClass}>{[...new Set([...departments, ...departmentsList])].sort().map((option) => <option key={option}>{option}</option>)}</select></label>
      <label className={labelClass}>Amount (UGX)<input required name="amount" type="number" min="1" step="1" className={fieldClass} placeholder="0" /></label>
      <label className={`${labelClass} sm:col-span-2`}>Business purpose / description<textarea required name="description" rows={3} className={fieldClass} placeholder="What was purchased or paid for?" /></label>
      <p className="text-[11px] text-slate-400 sm:col-span-2">Payroll processing/vendor fees may be recorded as professional services. Actual salary, wages, and feeding payouts come from payroll.</p>
    </div><section aria-label="Receipt image previews" className="mt-5 border-t border-slate-100 pt-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-xs font-bold text-slate-800">Receipt images</h3><p className="mt-1 text-[10px] text-slate-500">JPG, PNG, or WebP · up to 5 images · optimized before upload</p></div><input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={addAttachments} className="sr-only" /><button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-primary px-3 py-2 text-xs font-semibold text-primary hover:bg-secondary"><Icons.Paperclip className="size-4" /> Add attachments</button></div>
      {attachmentError && <p role="alert" className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{attachmentError}</p>}
      {attachments.length ? <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{attachments.map(({ preview }) => <article key={preview.id} className="overflow-hidden rounded-lg border border-slate-200"><img src={preview.dataUrl} alt={`Receipt preview: ${preview.name}`} className="h-32 w-full bg-slate-50 object-contain" /><div className="flex items-center gap-2 border-t border-slate-100 px-2.5 py-2"><p className="min-w-0 flex-1 truncate text-[10px] font-semibold text-slate-700">{preview.name}</p><button type="button" onClick={() => setAttachments((current) => current.filter((item) => item.preview.id !== preview.id))} aria-label={`Remove ${preview.name}`} className="grid size-7 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-700"><Icons.Trash2 className="size-3.5" /></button></div></article>)}</div> : <p className="mt-3 rounded-lg border border-dashed border-slate-200 px-3 py-5 text-center text-xs text-slate-400">No receipt images attached.</p>}
    </section><footer className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" disabled={busy} onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-50">Cancel</button><button type="submit" disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{busy ? 'Saving…' : 'Submit for approval'}</button></footer></form></section></div>
}

const departmentsList = ['Finance', 'HR', 'Inventory', 'Marketing', 'Operations', 'Production', 'Sales']

function ExpenseDetails({ expense, canPay, canManageAttachments, busy, onClose, onPayment, onViewPayrollRun, onUploadAttachment, onRemoveAttachment }: {
  expense: ExpenseRecord
  canPay: boolean
  canManageAttachments: boolean
  busy: boolean
  onClose: () => void
  onPayment: (form: FormData) => void
  onViewPayrollRun?: () => void
  onUploadAttachment?: (file: File) => void
  onRemoveAttachment?: (attachment: ExpenseAttachment) => void
}) {
  const [preview, setPreview] = useState<ExpenseAttachment | null>(null)
  const [showPayment, setShowPayment] = useState(false)
  const [attachmentError, setAttachmentError] = useState('')
  const attachmentInput = useRef<HTMLInputElement>(null)
  const getAttachmentDownload = useExpenseAttachmentDownload()
  const previewAttachment = async (attachment: ExpenseAttachment) => {
    if (expense.source !== 'Manual') return
    setAttachmentError('')
    try {
      const result = await getAttachmentDownload({ id: expense.id, attachmentId: attachment.id })
      setPreview({ ...attachment, url: result.url })
    } catch (error) {
      setAttachmentError(apiMessage(error))
    }
  }
  return <div className="fixed inset-0 z-80 grid place-items-center bg-slate-950/40 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}><section role="dialog" aria-modal="true" aria-labelledby="expense-detail-title" className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 id="expense-detail-title" className="text-base font-bold">Expense details</h2><p className="mt-1 text-xs text-slate-500">{expense.reference}</p></div><button type="button" aria-label="Close expense details" onClick={onClose} className="grid size-8 place-items-center rounded-md text-slate-400 hover:bg-slate-100"><Icons.X className="size-4" /></button></header>
    <div className="grid gap-x-6 gap-y-5 p-5 sm:grid-cols-2"><ExpenseDetail label="Expense date" value={expense.source === 'Payroll' ? `${formatDate(expense.periodStart)} to ${formatDate(expense.periodEnd)}` : formatDate(expense.date)} /><ExpenseDetail label="Status" value={expense.status} /><ExpenseDetail label="Source" value={expense.source === 'Payroll' ? 'Linked payroll run (read-only)' : expense.status === 'Legacy unverified' ? `Legacy · old status: ${expense.legacyStatus || 'not recorded'}` : 'Manual expense'} /><ExpenseDetail label="Type" value={expense.source === 'Payroll' ? expense.payrollSubtype : expense.expenseType} /><ExpenseDetail label="Payee" value={expense.payee} /><ExpenseDetail label="Category" value={expense.category} />{'taxType' in expense && expense.taxType && <ExpenseDetail label="Uganda tax type" value={expense.taxType} />}<ExpenseDetail label="Department" value={expense.department} /><ExpenseDetail label={expense.source === 'Payroll' ? 'Payroll cost' : 'Approved cost'} value={money(expense.amount)} /><ExpenseDetail label={expense.source === 'Payroll' ? 'Payroll payout recorded' : 'Paid amount'} value={money(expense.paidAmount)} />{expense.source === 'Payroll' && <ExpenseDetail label="Cost less payout (not payment due)" value={money(expense.remainingAmount)} />}{expense.source === 'Manual' && <ExpenseDetail label="Remaining amount" value={money(expense.remainingAmount)} />}<ExpenseDetail label="Business purpose" value={expense.description} wide />
      {expense.source === 'Payroll' && onViewPayrollRun && <button type="button" onClick={onViewPayrollRun} className="sm:col-span-2 inline-flex items-center gap-2 text-xs font-semibold text-primary hover:underline"><Icons.ExternalLink className="size-4" /> Open source payroll run</button>}
      {expense.source === 'Manual' && expense.decisions.length > 0 && <section className="sm:col-span-2"><h3 className="text-xs font-bold text-slate-800">Approval history</h3><ol className="mt-2 space-y-2">{expense.decisions.map((decision) => <li key={decision.id} className="rounded-lg bg-slate-50 p-3 text-xs"><strong>{decision.decision}</strong> by {decision.actor} · {formatDate(decision.at.slice(0, 10))}{decision.note && <p className="mt-1 text-slate-500">{decision.note}</p>}</li>)}</ol></section>}
      {expense.payments.length > 0 && <section className="sm:col-span-2"><h3 className="text-xs font-bold text-slate-800">Payment history</h3><ol className="mt-2 space-y-2">{expense.payments.map((payment) => <li key={payment.id} className="rounded-lg bg-slate-50 p-3 text-xs"><strong>{money(payment.amount)}</strong> · {payment.method} · {formatDate(payment.date)} · recorded by {payment.recordedBy}{payment.reference && <span> · Ref: {payment.reference}</span>}{payment.note && <p className="mt-1 text-slate-500">{payment.note}</p>}</li>)}</ol></section>}
      {expense.source === 'Manual' && expense.status === 'Legacy unverified' && expense.legacyAttachments?.length ? <section className="sm:col-span-2"><p className="text-xs text-amber-800">Legacy image data was not copied to the server. The original local browser snapshot has been retained.</p></section> : null}
      <section aria-label="Receipt attachments" className="sm:col-span-2"><div className="flex items-center justify-between"><h3 className="text-xs font-bold text-slate-800">Receipt images</h3>{canManageAttachments && <><input ref={attachmentInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) onUploadAttachment?.(file) }} /><button type="button" disabled={busy || expense.attachments.length >= 5} onClick={() => attachmentInput.current?.click()} className="text-xs font-semibold text-primary disabled:opacity-50">Add receipt</button></>}</div>{expense.source === 'Manual' && expense.attachments.length ? <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">{expense.attachments.map((attachment) => <div key={attachment.id} className="overflow-hidden rounded-lg border border-slate-200"><button type="button" onClick={() => void previewAttachment(attachment)} className="block w-full text-left"><span className="grid h-28 place-items-center bg-slate-50 text-slate-400"><Icons.Receipt className="size-6" /></span><span className="block truncate border-t border-slate-100 px-2.5 py-2 text-[10px] font-semibold text-slate-600">{attachment.name}</span></button>{canManageAttachments && <button type="button" disabled={busy} onClick={() => onRemoveAttachment?.(attachment)} className="w-full border-t px-2 py-1 text-[10px] text-rose-700">Remove</button>}</div>)}</div> : <p className="mt-2 text-xs text-slate-400">{expense.source === 'Manual' && expense.legacyAttachments?.length ? `${expense.legacyAttachments.length} legacy receipt reference(s); image files were not migrated.` : 'No receipt images attached.'}</p>}</section>
      {canManageAttachments && attachmentError && <p role="alert" className="sm:col-span-2 text-xs text-rose-700">{attachmentError}</p>}
      {canPay && !showPayment && <button type="button" onClick={() => setShowPayment(true)} className="sm:col-span-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">Record payment</button>}
      {canPay && showPayment && <form className="sm:col-span-2 space-y-3 rounded-lg border border-slate-200 p-4" onSubmit={(event) => { event.preventDefault(); onPayment(new FormData(event.currentTarget)) }}><h3 className="text-xs font-bold">Record payment</h3><label className="block text-xs font-semibold">Amount (UGX)<input required name="amount" type="number" min="1" max={expense.remainingAmount} step="1" defaultValue={expense.remainingAmount} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label><label className="block text-xs font-semibold">Payment date<input required name="date" type="date" defaultValue={companyDate()} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label><label className="block text-xs font-semibold">Method<select name="method" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">{(['Cash', 'Bank transfer', 'Mobile Money', 'Cheque'] as ExpensePaymentMethod[]).map((method) => <option key={method}>{method}</option>)}</select></label><label className="block text-xs font-semibold">Reference<input name="reference" maxLength={160} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label><label className="block text-xs font-semibold">Note<textarea name="note" maxLength={500} rows={2} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label><div className="flex justify-end gap-2"><button type="button" onClick={() => setShowPayment(false)} className="rounded-lg border px-3 py-2 text-xs">Cancel</button><button type="submit" disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">{busy ? 'Saving…' : 'Save payment'}</button></div></form>}
    </div><footer className="flex justify-end border-t border-slate-100 px-5 py-4"><button type="button" disabled={busy} onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Close</button></footer>{preview && <div role="dialog" aria-modal="true" aria-label={`Receipt preview ${preview.name}`} className="fixed inset-0 z-90 grid place-items-center bg-slate-950/80 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreview(null) }}><button type="button" aria-label="Close receipt preview" onClick={() => setPreview(null)} className="absolute right-4 top-4 grid size-9 place-items-center rounded-md bg-white/10 text-white hover:bg-white/20"><Icons.X className="size-5" /></button><img src={preview.url} alt={`Receipt: ${preview.name}`} className="max-h-[82vh] max-w-[92vw] object-contain" /><p className="absolute bottom-4 max-w-full truncate text-xs text-white">{preview.name}</p></div>}</section></div>
}

function ExpenseDetail({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return <div className={wide ? 'sm:col-span-2' : ''}><div className="text-[10px] font-medium uppercase text-slate-400">{label}</div><div className="mt-1 whitespace-pre-wrap wrap-break-word text-sm font-semibold text-slate-800">{value}</div></div>
}
