'use client'

import { useRef, useState } from 'react'
import * as Icons from 'lucide-react'
import { createId, exportCsv, formatDate, money, type ErpState, type Expense, type ExpenseAttachment } from '@/lib/erp'

type Props = { state: ErpState; updateState: (next: ErpState) => void }
type ExpenseTab = 'All expenses' | 'Pending approval' | 'Approved' | 'Legacy pending' | 'Paid' | 'Rejected'
type PeriodFilter = 'All dates' | 'This week' | 'This month' | 'Custom'

const expenseCategories = [
  'Rent and premises', 'Utilities', 'Production consumables', 'Packaging',
  'Repairs and maintenance', 'Fuel', 'Transport and delivery', 'Travel and accommodation',
  'Office supplies and printing', 'Telephone and internet', 'IT and software',
  'Professional services', 'Marketing and advertising', 'Insurance',
  'Licenses and compliance fees', 'Bank and transaction charges', 'Staff welfare and training',
  'Cleaning and security', 'Other',
]
const expenseTypes: NonNullable<Expense['expenseType']>[] = ['Supplier bill', 'Employee reimbursement', 'Petty cash / other']
const companyDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

function compressReceipt(file: File): Promise<ExpenseAttachment> {
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
        reader.onload = () => resolve({ id: createId('EATT'), name: file.name, dataUrl: String(reader.result), mediaType: blob.type, sizeBytes: blob.size })
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

const attachmentSize = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`

function dateOffset(date: string, days: number) {
  const value = new Date(`${date}T12:00:00.000Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function topCategory(expenses: Expense[]) {
  const totals = expenses.reduce<Record<string, number>>((groups, expense) => {
    groups[expense.category] = (groups[expense.category] ?? 0) + expense.amount
    return groups
  }, {})
  return Object.entries(totals).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]
}

function ExpenseMetric({ label, value, detail, icon, tone }: { label: string; value: string; detail: string; icon: string; tone: 'amber' | 'green' | 'primary' | 'blue' }) {
  const Icon = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[icon] ?? Icons.Receipt
  const toneClass = tone === 'amber' ? 'bg-amber-50 text-amber-700' : tone === 'green' ? 'bg-emerald-50 text-emerald-700' : tone === 'primary' ? 'bg-secondary text-primary' : 'bg-sky-50 text-sky-700'
  return <article className="rounded-lg border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><span className={`grid size-9 place-items-center rounded-md ${toneClass}`}><Icon className="size-4" /></span><span className="text-[9px] font-semibold uppercase text-slate-400">Live</span></div><div className="mt-3 text-xl font-bold tracking-tight text-slate-900">{value}</div><h3 className="mt-0.5 text-xs font-semibold text-slate-700">{label}</h3><p className="mt-1 text-[10px] text-slate-500">{detail}</p></article>
}

export default function ExpenseManagement({ state, updateState }: Props) {
  const [tab, setTab] = useState<ExpenseTab>('All expenses')
  const [period, setPeriod] = useState<PeriodFilter>('All dates')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [category, setCategory] = useState('All categories')
  const [department, setDepartment] = useState('All departments')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<Expense | null>(null)

  const today = companyDate()
  const currentMonth = today.slice(0, 7)
  const weekday = new Date(`${today}T12:00:00.000Z`).getUTCDay()
  const weekStart = dateOffset(today, -((weekday + 6) % 7))
  const monthExpenses = state.expenses.filter((expense) => expense.date.startsWith(currentMonth))
  const weekExpenses = state.expenses.filter((expense) => expense.date >= weekStart && expense.date <= today)
  const pending = state.expenses.filter((expense) => expense.status === 'Pending approval')
  const paid = state.expenses.filter((expense) => expense.status === 'Paid')
  const departments = [...new Set(state.expenses.map((expense) => expense.department).filter(Boolean))].sort()
  const categories = [...new Set([...expenseCategories, ...state.expenses.map((expense) => expense.category)])].sort()

  const visibleExpenses = state.expenses.filter((expense) => {
    const matchesTab = tab === 'All expenses'
      || (tab === 'Legacy pending' ? expense.status === 'Pending' : expense.status === tab)
    const matchesPeriod = period === 'All dates'
      || (period === 'This week' && expense.date >= weekStart && expense.date <= today)
      || (period === 'This month' && expense.date.startsWith(currentMonth))
      || (period === 'Custom' && (!dateFrom || expense.date >= dateFrom) && (!dateTo || expense.date <= dateTo))
    const matchesCategory = category === 'All categories' || expense.category === category
    const matchesDepartment = department === 'All departments' || expense.department === department
    const haystack = `${expense.reference} ${expense.payee ?? ''} ${expense.description} ${expense.category} ${expense.department}`.toLowerCase()
    return matchesTab && matchesPeriod && matchesCategory && matchesDepartment && haystack.includes(search.trim().toLowerCase())
  }).sort((left, right) => right.date.localeCompare(left.date) || right.reference.localeCompare(left.reference))

  const saveExpense = (event: React.FormEvent<HTMLFormElement>, attachments: ExpenseAttachment[]) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const expense: Expense = {
      id: createId('EX'), reference: createId('EXP'),
      expenseType: String(form.get('expenseType')) as Expense['expenseType'],
      date: String(form.get('date')), payee: String(form.get('payee')).trim(),
      category: String(form.get('category')), department: String(form.get('department')),
      amount: Number(form.get('amount')), description: String(form.get('description')).trim(), status: 'Pending approval', attachments,
      requestedBy: 'Sarah Namirembe', createdAt: new Date().toISOString(), decisions: [],
    }
    updateState({ ...state, expenses: [expense, ...state.expenses] })
    setShowForm(false)
    setTab('All expenses')
    setPeriod('All dates')
    setCategory('All categories')
    setDepartment('All departments')
    setSearch('')
  }

  const exportVisible = () => exportCsv('expenses.csv', visibleExpenses.map((expense) => ({
    reference: expense.reference, date: expense.date, expenseType: expense.expenseType ?? '', payee: expense.payee ?? '',
    description: expense.description, category: expense.category, department: expense.department, amountUGX: expense.amount, status: expense.status,
  })))

  return <div className="animate-in fade-in duration-300">
    <header className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><div className="mb-2 text-xs font-medium text-slate-400">Workspace / Finance Department</div><h2 className="text-2xl font-bold tracking-tight">Expenses</h2><p className="mt-1 text-sm text-slate-500">Recorded business spending, by period and payment status.</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={exportVisible} disabled={!visibleExpenses.length} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><Icons.Download className="size-4" /> Export CSV</button><button type="button" onClick={() => setShowForm(true)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"><Icons.Plus className="size-4" /> Record expense</button></div>
    </header>

    <section aria-label="Expense summary" className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <ExpenseMetric label="Awaiting approval" value={money(pending.reduce((total, expense) => total + expense.amount, 0))} detail={`${pending.length} request${pending.length === 1 ? '' : 's'} in the Approvals inbox`} icon="Clock3" tone="amber" />
      <ExpenseMetric label="Paid" value={money(paid.reduce((total, expense) => total + expense.amount, 0))} detail={`${paid.length} paid record${paid.length === 1 ? '' : 's'} · all dates`} icon="CircleCheck" tone="green" />
      <ExpenseMetric label="This month" value={money(monthExpenses.reduce((total, expense) => total + expense.amount, 0))} detail={topCategory(monthExpenses) ? `Top category: ${topCategory(monthExpenses)![0]} · ${money(topCategory(monthExpenses)![1])}` : 'No recorded spend this month'} icon="CalendarDays" tone="primary" />
      <ExpenseMetric label="This week" value={money(weekExpenses.reduce((total, expense) => total + expense.amount, 0))} detail={topCategory(weekExpenses) ? `Top category: ${topCategory(weekExpenses)![0]} · ${money(topCategory(weekExpenses)![1])}` : 'No recorded spend this week'} icon="CalendarRange" tone="blue" />
    </section>

    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div role="tablist" aria-label="Expense status" className="flex gap-1 overflow-x-auto border-b border-slate-200 px-4 pt-2">{(['All expenses', 'Pending approval', 'Approved', 'Legacy pending', 'Paid', 'Rejected'] as ExpenseTab[]).map((item) => {
        const count = item === 'All expenses' ? state.expenses.length : item === 'Legacy pending' ? state.expenses.filter((expense) => expense.status === 'Pending').length : state.expenses.filter((expense) => expense.status === item).length
        return <button key={item} type="button" role="tab" aria-selected={tab === item} onClick={() => setTab(item)} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-xs font-semibold ${tab === item ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{item}<span className={`rounded-full px-1.5 py-0.5 text-[10px] ${tab === item ? 'bg-secondary text-secondary-foreground' : 'bg-slate-100 text-slate-500'}`}>{count}</span></button>
      })}</div>
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 xl:flex-row xl:items-center xl:justify-between"><div><h3 className="text-sm font-bold">{tab}</h3><p className="mt-1 text-xs text-slate-500">{visibleExpenses.length} matching expense{visibleExpenses.length === 1 ? '' : 's'}</p></div>
        <div className="flex flex-wrap gap-2">
          <label className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><Icons.Search className="size-4 shrink-0 text-slate-400" /><input aria-label="Search expenses" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search expenses" className="w-40 bg-transparent text-xs outline-none" /></label>
          <select aria-label="Filter expenses by period" value={period} onChange={(event) => setPeriod(event.target.value as PeriodFilter)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">{(['All dates', 'This week', 'This month', 'Custom'] as PeriodFilter[]).map((option) => <option key={option}>{option}</option>)}</select>
          <select aria-label="Filter expenses by category" value={category} onChange={(event) => setCategory(event.target.value)} className="max-w-44 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><option>All categories</option>{categories.map((option) => <option key={option}>{option}</option>)}</select>
          <select aria-label="Filter expenses by department" value={department} onChange={(event) => setDepartment(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><option>All departments</option>{departments.map((option) => <option key={option}>{option}</option>)}</select>
          {period === 'Custom' && <><label className="sr-only" htmlFor="expense-date-from">From date</label><input id="expense-date-from" aria-label="Expenses from date" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs" /><label className="sr-only" htmlFor="expense-date-to">To date</label><input id="expense-date-to" aria-label="Expenses to date" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs" /></>}
        </div>
      </div>
      {visibleExpenses.length ? <div className="overflow-x-auto"><table className="w-full min-w-225 text-left text-xs"><thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-400"><tr>{['Reference', 'Date', 'Payee / description', 'Category', 'Department', 'Amount', 'Status', ''].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{visibleExpenses.map((expense) => <tr key={expense.id} className="border-t border-slate-100 text-slate-600 hover:bg-slate-50/70"><td className="px-4 py-3 font-semibold text-slate-800">{expense.reference}</td><td className="px-4 py-3 whitespace-nowrap">{formatDate(expense.date)}</td><td className="max-w-65 px-4 py-3"><div className="truncate font-semibold text-slate-800">{expense.payee || expense.description}</div><div className="mt-1 truncate text-[10px] text-slate-400">{expense.payee ? expense.description : expense.expenseType ?? 'Expense'}</div></td><td className="px-4 py-3">{expense.category}</td><td className="px-4 py-3">{expense.department}</td><td className="px-4 py-3 font-semibold text-slate-800">{money(expense.amount)}</td><td className="px-4 py-3"><span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${expense.status === 'Paid' || expense.status === 'Approved' ? 'bg-emerald-50 text-emerald-700' : expense.status === 'Rejected' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{expense.status === 'Pending' ? 'Legacy pending' : expense.status}</span></td><td className="px-4 py-3"><button type="button" onClick={() => setSelected(expense)} aria-label={`View expense ${expense.reference}`} className="inline-flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"><Icons.Eye className="size-4" /></button></td></tr>)}</tbody></table></div> : <div className="px-5 py-14 text-center"><span className="mx-auto grid size-10 place-items-center rounded-full bg-slate-100 text-slate-500"><Icons.ReceiptText className="size-4" /></span><h4 className="mt-3 text-sm font-semibold text-slate-800">No expenses match</h4><p className="mx-auto mt-1 max-w-md text-xs text-slate-500">Adjust the selected filters or record a new expense.</p><button type="button" onClick={() => { setTab('All expenses'); setPeriod('All dates'); setCategory('All categories'); setDepartment('All departments'); setSearch(''); setDateFrom(''); setDateTo('') }} className="mt-3 text-xs font-semibold text-teal-800 hover:underline">Clear filters</button></div>}
      <footer className="border-t border-slate-100 px-4 py-3 text-[10px] text-slate-400">Showing {visibleExpenses.length} of {state.expenses.length} records · Payroll, salary advances, and inventory purchases are recorded in their own modules.</footer>
    </section>

    {showForm && <ExpenseForm onClose={() => setShowForm(false)} onSubmit={saveExpense} departments={departments} />}
    {selected && <ExpenseDetails expense={selected} onClose={() => setSelected(null)} />}
  </div>
}

function ExpenseForm({ onClose, onSubmit, departments }: { onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>, attachments: ExpenseAttachment[]) => void; departments: string[] }) {
  const [attachments, setAttachments] = useState<ExpenseAttachment[]>([])
  const [attachmentError, setAttachmentError] = useState('')
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
      if (next.reduce((total, attachment) => total + attachment.sizeBytes, 0) > 2 * 1024 * 1024) {
        setAttachmentError('Optimized receipt images must total 2 MB or less.')
        return
      }
      setAttachments(next)
    } catch (error) {
      setAttachmentError(error instanceof Error ? error.message : 'Could not process receipt images.')
    }
  }
  const removeAttachment = (id: string) => setAttachments((current) => current.filter((attachment) => attachment.id !== id))
  return <div className="fixed inset-0 z-80 grid place-items-center bg-slate-950/40 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section role="dialog" aria-modal="true" aria-labelledby="expense-form-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 id="expense-form-title" className="text-base font-bold">Record expense</h2><p className="mt-1 text-xs text-slate-500">New records are submitted for approval and remain unpaid until recorded as paid.</p></div><button type="button" aria-label="Close expense form" onClick={onClose} className="grid size-8 place-items-center rounded-md text-slate-400 hover:bg-slate-100"><Icons.X className="size-4" /></button></header>
    <form onSubmit={(event) => { event.preventDefault(); onSubmit(event, attachments) }} className="p-5"><div className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-[10px] leading-4 text-amber-900">Saving submits this expense for approval. Payment remains a separate step after approval.</div><div className="grid gap-4 sm:grid-cols-2">
      <label className={labelClass}>Expense type<select name="expenseType" defaultValue="Supplier bill" className={fieldClass}>{expenseTypes.map((option) => <option key={option}>{option}</option>)}</select></label>
      <label className={labelClass}>Expense date<input required name="date" type="date" defaultValue={companyDate()} className={fieldClass} /></label>
      <label className={labelClass}>Payee<input required name="payee" className={fieldClass} placeholder="Supplier or employee name" /></label>
      <label className={labelClass}>Category<select required name="category" defaultValue="" className={fieldClass}><option value="" disabled>Select category</option>{expenseCategories.map((option) => <option key={option}>{option}</option>)}</select></label>
      <label className={labelClass}>Department<select required name="department" defaultValue={departments.includes('Operations') ? 'Operations' : departments[0] ?? 'Operations'} className={fieldClass}>{[...new Set([...departments, 'Sales', 'Finance', 'HR', 'Inventory', 'Marketing', 'Operations', 'Production'])].sort().map((option) => <option key={option}>{option}</option>)}</select></label>
      <label className={labelClass}>Amount (UGX)<input required name="amount" type="number" min="1" step="1" className={fieldClass} placeholder="0" /></label>
      <label className={`${labelClass} sm:col-span-2`}>Business purpose / description<textarea required name="description" rows={3} className={fieldClass} placeholder="What was purchased or paid for?" /></label>
      <p className="text-[11px] text-slate-400 sm:col-span-2">Payroll, recoverable salary advances, and inventory purchases should be recorded in their respective modules.</p>
    </div><section aria-label="Receipt image previews" className="mt-5 border-t border-slate-100 pt-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-xs font-bold text-slate-800">Receipt images</h3><p className="mt-1 text-[10px] text-slate-500">JPG, PNG, or WebP · up to 5 images · optimized for storage</p></div><input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={addAttachments} className="sr-only" /><button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-primary px-3 py-2 text-xs font-semibold text-primary hover:bg-secondary"><Icons.Paperclip className="size-4" /> Add attachments</button></div>
      {attachmentError && <p role="alert" className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{attachmentError}</p>}
      {attachments.length ? <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{attachments.map((attachment) => <article key={attachment.id} className="overflow-hidden rounded-lg border border-slate-200"><img src={attachment.dataUrl} alt={`Receipt preview: ${attachment.name}`} className="h-32 w-full bg-slate-50 object-contain" /><div className="flex items-center gap-2 border-t border-slate-100 px-2.5 py-2"><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-semibold text-slate-700" title={attachment.name}>{attachment.name}</p><p className="text-[9px] text-slate-400">{attachmentSize(attachment.sizeBytes)}</p></div><button type="button" onClick={() => removeAttachment(attachment.id)} aria-label={`Remove ${attachment.name}`} className="grid size-7 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-700"><Icons.Trash2 className="size-3.5" /></button></div></article>)}</div> : <p className="mt-3 rounded-lg border border-dashed border-slate-200 px-3 py-5 text-center text-xs text-slate-400">No receipt images attached.</p>}
    </section><footer className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Cancel</button><button type="submit" className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90">Save expense</button></footer></form></section></div>
}

function ExpenseDetails({ expense, onClose }: { expense: Expense; onClose: () => void }) {
  const [preview, setPreview] = useState<ExpenseAttachment | null>(null)
  return <div className="fixed inset-0 z-80 grid place-items-center bg-slate-950/40 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section role="dialog" aria-modal="true" aria-labelledby="expense-detail-title" className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 id="expense-detail-title" className="text-base font-bold">Expense details</h2><p className="mt-1 text-xs text-slate-500">{expense.reference}</p></div><button type="button" aria-label="Close expense details" onClick={onClose} className="grid size-8 place-items-center rounded-md text-slate-400 hover:bg-slate-100"><Icons.X className="size-4" /></button></header><div className="grid gap-x-6 gap-y-5 p-5 sm:grid-cols-2"><ExpenseDetail label="Expense date" value={formatDate(expense.date)} /><ExpenseDetail label="Status" value={expense.status} /><ExpenseDetail label="Type" value={expense.expenseType ?? 'Not specified'} /><ExpenseDetail label="Payee" value={expense.payee || 'Not specified'} /><ExpenseDetail label="Category" value={expense.category} /><ExpenseDetail label="Department" value={expense.department} /><ExpenseDetail label="Amount" value={money(expense.amount)} /><ExpenseDetail label="Business purpose" value={expense.description} wide /><section aria-label="Receipt attachments" className="sm:col-span-2"><h3 className="text-xs font-bold text-slate-800">Receipt images</h3>{expense.attachments?.length ? <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">{expense.attachments.map((attachment) => <button key={attachment.id} type="button" onClick={() => setPreview(attachment)} aria-label={`Preview receipt ${attachment.name}`} className="group overflow-hidden rounded-lg border border-slate-200 text-left hover:border-primary"><img src={attachment.dataUrl} alt={`Receipt: ${attachment.name}`} className="h-28 w-full bg-slate-50 object-contain" /><span className="block truncate border-t border-slate-100 px-2.5 py-2 text-[10px] font-semibold text-slate-600">{attachment.name}</span></button>)}</div> : <p className="mt-2 text-xs text-slate-400">No receipt images attached.</p>}</section></div><footer className="flex justify-end border-t border-slate-100 px-5 py-4"><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Close</button></footer>{preview && <div role="dialog" aria-modal="true" aria-label={`Receipt preview ${preview.name}`} className="fixed inset-0 z-90 grid place-items-center bg-slate-950/80 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreview(null) }}><button type="button" aria-label="Close receipt preview" onClick={() => setPreview(null)} className="absolute right-4 top-4 grid size-9 place-items-center rounded-md bg-white/10 text-white hover:bg-white/20"><Icons.X className="size-5" /></button><img src={preview.dataUrl} alt={`Receipt: ${preview.name}`} className="max-h-[82vh] max-w-[92vw] object-contain" /><p className="absolute bottom-4 max-w-full truncate text-xs text-white">{preview.name}</p></div>}</section></div>
}

function ExpenseDetail({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return <div className={wide ? 'sm:col-span-2' : ''}><div className="text-[10px] font-medium uppercase text-slate-400">{label}</div><div className="mt-1 whitespace-pre-wrap wrap-break-word text-sm font-semibold text-slate-800">{value}</div></div>
}