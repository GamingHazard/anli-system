'use client'

import { useState } from 'react'
import * as Icons from 'lucide-react'
import { employeeDisplayName, formatDate, type Employee, type ErpState } from '@/lib/erp'

type LetterType = 'Written warning' | 'Suspension' | 'Termination'
type View = 'Letters' | 'Templates'
type Draft = {
  employeeId: string
  type: LetterType
  date: string
  reason: string
  expectations: string
  reviewDate: string
  startDate: string
  endDate: string
  returnDate: string
  conditions: string
  effectiveDate: string
  noticeDetails: string
  handoverDetails: string
  signatory: string
}

const letterTypes: LetterType[] = ['Written warning', 'Suspension', 'Termination']
const emptyDraft: Draft = {
  employeeId: '', type: 'Written warning', date: new Date().toISOString().slice(0, 10), reason: '', expectations: '',
  reviewDate: '', startDate: '', endDate: '', returnDate: '', conditions: '', effectiveDate: '', noticeDetails: '',
  handoverDetails: '', signatory: '',
}
const templates: Array<{ type: LetterType; icon: string; detail: string; fields: string }> = [
  { type: 'Written warning', icon: 'MessageSquareWarning', detail: 'Formal notice with a factual reason, expectations, and review date.', fields: 'Reason · Expectations · Review date' },
  { type: 'Suspension', icon: 'CalendarOff', detail: 'Temporary suspension details, dates, conditions, and return date.', fields: 'Reason · Start/end · Conditions · Return date' },
  { type: 'Termination', icon: 'FileX2', detail: 'Employment end date with notice and handover information.', fields: 'Reason · Effective date · Notice · Handover' },
]

export default function DisciplinaryLettersPage({ state }: { state: ErpState }) {
  const [view, setView] = useState<View>('Letters')
  const [showComposer, setShowComposer] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('All letter types')
  const activeEmployees = state.employees.filter((employee) => employee.status === 'Active')
  const employee = activeEmployees.find((item) => item.id === draft.employeeId)
  const beginDraft = (type: LetterType = 'Written warning') => {
    setDraft({ ...emptyDraft, type, date: new Date().toISOString().slice(0, 10) })
    setShowComposer(true)
  }
  const update = (key: keyof Draft, value: string) => setDraft((current) => ({ ...current, [key]: value }))

  return <div className="animate-in fade-in duration-300">
    <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><div className="mb-2 text-xs font-medium text-slate-400">Workspace / HR Department</div><h2 className="text-2xl font-bold tracking-tight">Disciplinary letters</h2><p className="mt-1 max-w-2xl text-sm text-slate-500">Prepare a draft warning, suspension, or termination letter for review.</p></div>
      <button type="button" onClick={() => beginDraft()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#6d28d9] px-3 py-2.5 text-xs font-semibold text-white hover:bg-[#5b21b6]"><Icons.Plus className="size-4" /> Create letter</button>
    </div>

    <div className="mb-5 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900"><Icons.Info className="size-4 shrink-0" /><span><strong>Draft workspace only.</strong> Letters are not saved, approved, or issued in this version. Print produces a draft preview.</span></div>

    <div role="tablist" aria-label="Disciplinary letter views" className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">{(['Letters', 'Templates'] as View[]).map((item) => <button key={item} type="button" role="tab" aria-selected={view === item} onClick={() => setView(item)} className={`shrink-0 border-b-2 px-3 py-3 text-xs font-semibold ${view === item ? 'border-[#6d28d9] text-[#6d28d9]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{item}</button>)}</div>

    {view === 'Letters' ? <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-sm font-bold">Letter drafts</h3><p className="mt-1 text-xs text-slate-500">Drafts will appear here when saving and approval workflows are connected.</p></div><div className="flex flex-wrap gap-2"><label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><Icons.Search className="size-4 text-slate-400" /><input aria-label="Search disciplinary letters" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search employee or reference" className="w-48 bg-transparent text-xs outline-none" /></label><select aria-label="Filter letters by type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">{['All letter types', ...letterTypes].map((type) => <option key={type}>{type}</option>)}</select></div></div>
      <div className="px-5 py-14 text-center"><span className="mx-auto grid size-10 place-items-center rounded-full bg-slate-100 text-slate-500"><Icons.Files className="size-4" /></span><h4 className="mt-3 text-sm font-semibold text-slate-800">No saved letters</h4><p className="mx-auto mt-1 max-w-md text-xs text-slate-500">This page currently creates temporary previews only. Saving, approval, and issue tracking will be added later.</p><button type="button" onClick={() => beginDraft()} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Icons.Plus className="size-3.5" /> Start a draft</button></div>
    </section> : <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-3"><h3 className="text-sm font-bold">Letter templates</h3><p className="mt-1 text-xs text-slate-500">Choose a letter type to open its draft composer. Wording remains editable and requires organization review.</p></div>
      <div className="divide-y divide-slate-100">{templates.map((template) => { const Icon = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[template.icon] || Icons.FileText; return <div key={template.type} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600"><Icon className="size-4" /></span><div className="min-w-0 flex-1"><h4 className="text-sm font-semibold text-slate-800">{template.type}</h4><p className="mt-1 text-xs text-slate-500">{template.detail}</p><p className="mt-1 text-[10px] text-slate-400">Fields: {template.fields}</p></div><button type="button" onClick={() => beginDraft(template.type)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Icons.PencilLine className="size-3.5" /> Draft letter</button></div> })}</div>
    </section>}

    {showComposer && <Composer employees={activeEmployees} employee={employee} draft={draft} companyProfile={state.companyProfile} update={update} onClose={() => setShowComposer(false)} />}
  </div>
}

function Composer({ employees, employee, draft, companyProfile, update, onClose }: { employees: Employee[]; employee?: Employee; draft: Draft; companyProfile: ErpState['companyProfile']; update: (key: keyof Draft, value: string) => void; onClose: () => void }) {
  const inputClass = 'mt-1.5 w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100'
  const labelClass = 'block text-xs font-semibold text-slate-600'
  const field = (key: keyof Draft, label: string, options: { multiline?: boolean; type?: string; required?: boolean } = {}) => <label key={key} className={labelClass}>{label}{options.multiline ? <textarea required={options.required} rows={3} value={draft[key]} onChange={(event) => update(key, event.target.value)} className={inputClass} /> : <input required={options.required} type={options.type ?? 'text'} value={draft[key]} onChange={(event) => update(key, event.target.value)} className={inputClass} />}</label>

  return <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/45 p-3 sm:p-6"><section role="dialog" aria-modal="true" aria-labelledby="disciplinary-composer-title" className="flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
    <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 id="disciplinary-composer-title" className="text-base font-bold">Draft disciplinary letter</h2><p className="mt-1 text-xs text-slate-500">Temporary preview only · not approved or issued</p></div><button type="button" aria-label="Close letter composer" onClick={onClose} className="grid size-8 place-items-center rounded-md text-slate-400 hover:bg-slate-100"><Icons.X className="size-4" /></button></header>
    <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)]">
      <div className="space-y-5 border-b border-slate-100 p-4 sm:p-5 lg:border-b-0 lg:border-r">
        <section><h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Employee</h3><label className={labelClass}>Select employee<select required aria-label="Select employee for letter" value={draft.employeeId} onChange={(event) => update('employeeId', event.target.value)} className={inputClass}><option value="">Choose active employee</option>{employees.map((item) => <option key={item.id} value={item.id}>{employeeDisplayName(item)} · {item.number}</option>)}</select></label><div className="mt-3 grid gap-2 sm:grid-cols-2"><ReadOnly label="Employee ID" value={employee?.number} /><ReadOnly label="Department" value={employee?.department} /><ReadOnly label="Position" value={employee?.role} /><ReadOnly label="Contact" value={employee?.phone} /></div></section>
        <section className="border-t border-slate-100 pt-4"><h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Letter details</h3><div className="grid gap-3 sm:grid-cols-2"><label className={labelClass}>Letter type<select value={draft.type} onChange={(event) => update('type', event.target.value as LetterType)} className={inputClass}>{letterTypes.map((type) => <option key={type}>{type}</option>)}</select></label>{field('date', 'Letter date', { type: 'date', required: true })}
          {draft.type === 'Written warning' && <>{field('reason', 'Reason / conduct summary', { multiline: true, required: true })}{field('expectations', 'Expected improvement', { multiline: true, required: true })}{field('reviewDate', 'Review date', { type: 'date' })}</>}
          {draft.type === 'Suspension' && <>{field('reason', 'Reason for suspension', { multiline: true, required: true })}{field('startDate', 'Suspension start', { type: 'date', required: true })}{field('endDate', 'Suspension end', { type: 'date', required: true })}{field('returnDate', 'Return-to-work date', { type: 'date' })}{field('conditions', 'Conditions during suspension', { multiline: true })}</>}
          {draft.type === 'Termination' && <>{field('reason', 'Reason for termination', { multiline: true, required: true })}{field('effectiveDate', 'Effective date', { type: 'date', required: true })}{field('noticeDetails', 'Notice details', { multiline: true })}{field('handoverDetails', 'Handover / property return', { multiline: true })}</>}
          {field('signatory', 'Signatory name and title', { required: true })}</div></section>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Close</button><button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-[#6d28d9] px-3 py-2 text-xs font-semibold text-white"><Icons.Printer className="size-3.5" /> Print draft preview</button></div>
      </div>
      <div className="bg-slate-50 p-4 sm:p-6"><div className="mb-3 flex items-center justify-between"><div><h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Preview</h3><p className="mt-1 text-[10px] text-slate-400">Unissued draft · review wording before any future use</p></div><span className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[9px] font-bold uppercase text-amber-800">Draft preview</span></div><LetterPreview employee={employee} draft={draft} companyProfile={companyProfile} /></div>
    </div>
  </section></div>
}

function LetterPreview({ employee, draft, companyProfile }: { employee?: Employee; draft: Draft; companyProfile: ErpState['companyProfile'] }) {
  const details: Array<[string, string]> = draft.type === 'Written warning'
    ? [['Reason / conduct summary', draft.reason], ['Expected improvement', draft.expectations], ['Review date', draft.reviewDate ? formatDate(draft.reviewDate) : 'To be determined']]
    : draft.type === 'Suspension'
      ? [['Reason', draft.reason], ['Suspension period', draft.startDate && draft.endDate ? `${formatDate(draft.startDate)} to ${formatDate(draft.endDate)}` : 'Dates to be confirmed'], ['Conditions', draft.conditions], ['Return-to-work date', draft.returnDate ? formatDate(draft.returnDate) : 'To be confirmed']]
      : [['Reason', draft.reason], ['Effective date', draft.effectiveDate ? formatDate(draft.effectiveDate) : 'To be confirmed'], ['Notice details', draft.noticeDetails], ['Handover / property return', draft.handoverDetails]]
  return <article className="disciplinary-print-root mx-auto min-h-[560px] max-w-[760px] border border-slate-200 bg-white p-6 text-slate-800 shadow-sm sm:p-9">
    <div className="flex items-start justify-between gap-4 border-b-2 border-slate-800 pb-4"><div className="min-w-0"><div className="break-words text-sm font-bold tracking-wide">{companyProfile.tradingName || companyProfile.legalName || 'LUMINA ERP'}</div><div className="mt-1 text-[10px] text-slate-500">Human Resources · Confidential</div>{[companyProfile.addressLine1, companyProfile.addressLine2, companyProfile.city, companyProfile.region, companyProfile.country].filter(Boolean).length > 0 && <div className="mt-1 text-[9px] leading-4 text-slate-500">{[companyProfile.addressLine1, companyProfile.addressLine2, companyProfile.city, companyProfile.region, companyProfile.country].filter(Boolean).join(', ')}</div>}<div className="mt-1 flex flex-wrap gap-x-3 text-[9px] text-slate-500">{companyProfile.email && <span>{companyProfile.email}</span>}{companyProfile.phone && <span>{companyProfile.phone}</span>}{companyProfile.tin && <span>TIN: {companyProfile.tin}</span>}</div></div><div className="shrink-0 text-right text-[10px] text-slate-500"><div>LETTER REFERENCE</div><div className="mt-1 font-mono font-semibold text-slate-700">Preview only</div></div></div>
    <div className="mt-6 flex flex-wrap justify-between gap-4 text-xs"><div><div className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">To</div><div className="mt-1 font-bold">{employee ? employeeDisplayName(employee) : '[Employee name]'}</div><div className="mt-1 text-slate-600">{employee?.number || '[Employee ID]'}</div><div className="text-slate-600">{employee ? `${employee.role} · ${employee.department}` : '[Position · Department]'}</div></div><div className="text-right"><div className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Date</div><div className="mt-1 font-medium">{draft.date ? formatDate(draft.date) : '[Date]'}</div></div></div>
    <h1 className="mt-8 text-center text-lg font-bold uppercase">{draft.type}</h1><p className="mt-6 text-xs leading-6">Dear {employee ? employeeDisplayName(employee) : '[Employee name]'},</p><p className="mt-3 text-xs leading-6">This draft letter concerns the following matter. The content below is a preview and must be reviewed against your organization&apos;s approved policies and wording.</p>
    <dl className="mt-5 space-y-4">{details.filter(([, value]) => value).map(([label, value]) => <div key={label}><dt className="text-[9px] font-bold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-xs leading-5">{value}</dd></div>)}</dl>
    <p className="mt-6 text-xs leading-6">Please contact Human Resources if you have questions about this draft.</p><div className="mt-8 grid gap-8 sm:grid-cols-2"><div><div className="h-8 border-b border-slate-400"/><div className="mt-2 text-[10px] font-semibold">{draft.signatory || '[Authorized signatory]'}</div><div className="text-[9px] text-slate-500">For the organization</div></div><div><div className="h-8 border-b border-slate-400"/><div className="mt-2 text-[10px] font-semibold">Employee acknowledgement</div><div className="text-[9px] text-slate-500">Signature · Date</div></div></div>
    <footer className="mt-8 border-t border-slate-200 pt-2 text-center text-[8px] uppercase tracking-wide text-slate-400">Confidential draft · Not approved · Not issued</footer>
  </article>
}

function ReadOnly({ label, value }: { label: string; value?: string }) {
  return <div className="text-xs font-semibold text-slate-600">{label}<div className="mt-1 rounded-md border border-slate-100 bg-slate-50 px-3 py-2.5 text-xs font-normal text-slate-600">{value || 'Select an employee'}</div></div>
}