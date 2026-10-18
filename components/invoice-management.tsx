'use client'

import { useMemo, useState } from 'react'
import * as Icons from 'lucide-react'
import { balanceForSale, formatDate, money, paidAmountForSale, type ErpState, type Invoice, type InvoiceStatus } from '@/lib/erp'

type Props = { state: ErpState; updateState: (next: ErpState) => void }
type InvoiceView = 'All invoices' | 'Drafts' | 'Ready to submit' | 'Submitted / issued' | 'Failed' | 'Cancelled'
const views: InvoiceView[] = ['All invoices', 'Drafts', 'Ready to submit', 'Submitted / issued', 'Failed', 'Cancelled']
const statusTone: Record<InvoiceStatus, string> = { Draft: 'bg-slate-100 text-slate-700', 'Ready to submit': 'bg-sky-50 text-sky-800', Submitted: 'bg-amber-50 text-amber-800', Issued: 'bg-emerald-50 text-emerald-700', Failed: 'bg-rose-50 text-rose-700', Cancelled: 'bg-slate-100 text-slate-500', 'Credit note': 'bg-orange-50 text-orange-800' }
const inputClass = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 outline-none focus:border-primary focus:ring-2 focus:ring-ring/30'

function paymentState(invoice: Invoice, state: ErpState) {
  const sale = state.sales.find((item) => item.id === invoice.saleId)
  if (!sale) return 'Sale unavailable'
  const balance = balanceForSale(sale, state.payments)
  const paid = paidAmountForSale(sale.id, state.payments)
  if (balance === 0) return 'Paid'
  return paid > 0 ? 'Partially paid' : sale.paymentTerms === 'Credit' ? 'Unpaid · credit' : 'Unpaid'
}

function invoiceReadiness(invoice: Invoice) {
  const missing: string[] = []
  if (!invoice.seller.name) missing.push('Seller legal name')
  if (!invoice.seller.tin) missing.push('Seller TIN')
  if (!invoice.buyer.name) missing.push('Buyer name')
  if (!invoice.lines.length || invoice.lines.some((line) => !line.description || line.quantity <= 0 || line.unitPrice < 0)) missing.push('Valid invoice line')
  return missing
}

export default function InvoiceManagement({ state, updateState }: Props) {
  const [view, setView] = useState<InvoiceView>('All invoices')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Invoice | null>(null)
  const [notice, setNotice] = useState('')
  const issuedCount = state.invoices.filter((invoice) => invoice.status === 'Issued').length
  const failedCount = state.invoices.filter((invoice) => invoice.status === 'Failed').length
  const readyCount = state.invoices.filter((invoice) => invoice.status === 'Ready to submit').length
  const draftCount = state.invoices.filter((invoice) => invoice.status === 'Draft').length
  const unpaidTotal = state.invoices.filter((invoice) => invoice.status === 'Issued').reduce((total, invoice) => total + (state.sales.find((sale) => sale.id === invoice.saleId) ? balanceForSale(state.sales.find((sale) => sale.id === invoice.saleId)!, state.payments) : 0), 0)

  const filtered = useMemo(() => state.invoices.filter((invoice) => {
    const sale = state.sales.find((item) => item.id === invoice.saleId)
    const matchesView = view === 'All invoices'
      || (view === 'Drafts' && invoice.status === 'Draft')
      || (view === 'Ready to submit' && invoice.status === 'Ready to submit')
      || (view === 'Submitted / issued' && ['Submitted', 'Issued'].includes(invoice.status))
      || (view === 'Failed' && invoice.status === 'Failed')
      || (view === 'Cancelled' && invoice.status === 'Cancelled')
    const query = `${invoice.invoiceNumber} ${invoice.saleReference} ${invoice.buyer.name} ${invoice.buyer.tin ?? ''} ${sale?.reference ?? ''}`.toLowerCase()
    return matchesView && query.includes(search.trim().toLowerCase())
  }).sort((left, right) => right.issueDate.localeCompare(left.issueDate) || right.createdAt.localeCompare(left.createdAt)), [state.invoices, state.sales, view, search])

  const updateInvoice = (invoiceId: string, transform: (invoice: Invoice) => Invoice) => {
    const current = state.invoices.find((invoice) => invoice.id === invoiceId)
    if (!current) return
    const updated = transform(current)
    updateState({ ...state, invoices: state.invoices.map((invoice) => invoice.id === invoiceId ? updated : invoice) })
    setSelected((selectedInvoice) => selectedInvoice?.id === invoiceId ? updated : selectedInvoice)
  }

  const saveDraft = (form: FormData) => {
    if (!selected || selected.status !== 'Draft') return
    const buyerName = String(form.get('buyerName') || '').trim()
    const buyerTin = String(form.get('buyerTin') || '').trim()
    const buyerEmail = String(form.get('buyerEmail') || '').trim()
    const buyerPhone = String(form.get('buyerPhone') || '').trim()
    const buyerAddress = String(form.get('buyerAddress') || '').trim()
    const description = String(form.get('description') || '').trim()
    const quantity = Number(form.get('quantity'))
    const unitPrice = Number(form.get('unitPrice'))
    if (!buyerName || !description || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
      setNotice('Enter buyer name, a line description, a positive quantity, and a valid unit price.')
      return
    }
    const lineTotal = quantity * unitPrice
    updateInvoice(selected.id, (invoice) => ({
      ...invoice,
      buyer: { ...invoice.buyer, name: buyerName, tin: buyerTin || undefined, email: buyerEmail || undefined, phone: buyerPhone || undefined, address: buyerAddress || undefined },
      lines: [{ ...invoice.lines[0], description, quantity, unitPrice, lineTotal }],
      subtotal: lineTotal,
      total: lineTotal + (invoice.taxTotal ?? 0),
      updatedAt: new Date().toISOString(),
      events: [...invoice.events, { id: `IEVT-${Date.now()}`, type: 'Draft updated', at: new Date().toISOString(), actor: 'Sarah Namirembe' }],
    }))
    setNotice('Invoice draft saved locally. URA submission is not connected.')
  }

  const markReady = (invoice: Invoice) => {
    const missing = invoiceReadiness(invoice)
    if (missing.length) { setNotice(`Complete before review: ${missing.join(', ')}.`); return }
    updateInvoice(invoice.id, (current) => ({ ...current, status: 'Ready to submit', updatedAt: new Date().toISOString(), events: [...current.events, { id: `IEVT-${Date.now()}`, type: 'Marked ready for review', at: new Date().toISOString(), actor: 'Sarah Namirembe' }] }))
    setNotice('Draft marked ready. URA submission is still unavailable.')
  }

  const exportRegister = () => {
    const csvRows = filtered.map((invoice) => ({ invoiceNumber: invoice.invoiceNumber, saleReference: invoice.saleReference, customer: invoice.buyer.name, buyerTin: invoice.buyer.tin ?? '', issueDate: invoice.issueDate, status: invoice.status, paymentStatus: paymentState(invoice, state), subtotalUGX: invoice.subtotal, taxUGX: invoice.taxTotal ?? '', totalUGX: invoice.total, uraReference: invoice.uraReference ?? '' }))
    if (!csvRows.length) return
    const headers = Object.keys(csvRows[0])
    const csv = [headers.join(','), ...csvRows.map((row) => headers.map((header) => JSON.stringify(row[header as keyof typeof row] ?? '')).join(','))].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a'); link.href = url; link.download = 'invoice-register-drafts.csv'; link.click(); URL.revokeObjectURL(url)
  }

  if (selected) return <InvoiceDetail invoice={selected} state={state} onBack={() => { setSelected(null); setNotice('') }} onSave={saveDraft} onMarkReady={() => markReady(selected)} notice={notice} onSubmit={() => setNotice('URA EFRIS submission is disabled until an authorized server integration is configured.')} />

  return <div className="animate-in fade-in duration-300">
    <header className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="mb-2 text-xs font-medium text-slate-400">Workspace / Sales Department</div><h2 className="text-2xl font-bold tracking-tight text-slate-900">Invoicing</h2><p className="mt-1 max-w-2xl text-sm text-slate-500">Review sale-linked invoice drafts and track official issuance status.</p></div><div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[10px] font-semibold text-amber-800"><span className="size-1.5 rounded-full bg-amber-500" />URA connection not configured</span><button type="button" onClick={exportRegister} disabled={!filtered.length} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><Icons.Download className="size-4" />Export register</button></div></header>

    <div role="status" className="mb-5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-950"><Icons.TriangleAlert className="mt-0.5 size-4 shrink-0" /><p><strong>Drafts only.</strong> These local documents have not been submitted to URA/EFRIS. Official tax categories, calculations, fiscal numbers, verification codes, and issuance require an authorized server integration.</p></div>

    <section aria-label="Invoice summary" className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Drafts" value={draftCount} icon="FilePenLine" tone="slate" detail="Not submitted" /><Metric label="Ready to submit" value={readyCount} icon="ClipboardCheck" tone="blue" detail="Local validation only" /><Metric label="Issued" value={issuedCount} icon="BadgeCheck" tone="green" detail="URA-confirmed only" /><Metric label="Failed" value={failedCount} icon="TriangleAlert" tone="rose" detail="Submission errors" /><Metric label="Issued balance" value={money(unpaidTotal)} icon="WalletCards" tone="amber" detail="Linked sale balances" /></section>

    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div role="tablist" aria-label="Invoice status" className="flex gap-1 overflow-x-auto border-b border-slate-200 px-4 pt-2">{views.map((item) => { const count = item === 'All invoices' ? state.invoices.length : item === 'Drafts' ? draftCount : item === 'Ready to submit' ? readyCount : item === 'Submitted / issued' ? state.invoices.filter((invoice) => ['Submitted', 'Issued'].includes(invoice.status)).length : item === 'Failed' ? failedCount : state.invoices.filter((invoice) => invoice.status === 'Cancelled').length; return <button key={item} type="button" role="tab" aria-selected={view === item} onClick={() => setView(item)} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-xs font-semibold ${view === item ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{item}<span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px]">{count}</span></button> })}</div>
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 xl:flex-row xl:items-center xl:justify-between"><div><h3 className="text-sm font-bold text-slate-900">{view}</h3><p className="mt-1 text-xs text-slate-500">{filtered.length} matching invoice{filtered.length === 1 ? '' : 's'} · one draft per sale</p></div><label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><Icons.Search className="size-4 text-slate-400" /><input aria-label="Search invoices" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Invoice, sale, customer, TIN" className="w-full bg-transparent text-xs outline-none sm:w-64" /></label></div>
      {filtered.length ? <div className="overflow-x-auto"><table className="w-full min-w-225 text-left text-xs"><thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-400"><tr>{['Invoice', 'Sale', 'Customer', 'Date', 'Total', 'Payment', 'URA status', ''].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{filtered.map((invoice) => <tr key={invoice.id} className="border-t border-slate-100 text-slate-600 hover:bg-slate-50/70"><td className="px-4 py-3"><button type="button" onClick={() => { setSelected(invoice); setNotice('') }} className="font-semibold text-slate-800 hover:text-primary hover:underline">{invoice.invoiceNumber}</button><span className="mt-1 block text-[10px] text-slate-400">Local invoice record</span></td><td className="px-4 py-3 font-mono text-[11px]">{invoice.saleReference}</td><td className="px-4 py-3"><span className="font-semibold text-slate-700">{invoice.buyer.name || 'Buyer details missing'}</span>{invoice.buyer.tin && <span className="mt-1 block text-[10px] text-slate-400">TIN {invoice.buyer.tin}</span>}</td><td className="whitespace-nowrap px-4 py-3">{formatDate(invoice.issueDate)}</td><td className="px-4 py-3 font-semibold text-slate-800">{money(invoice.total)}</td><td className="px-4 py-3">{paymentState(invoice, state)}</td><td className="px-4 py-3"><span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${statusTone[invoice.status]}`}>{invoice.status === 'Draft' || invoice.status === 'Ready to submit' ? 'Not submitted' : invoice.status}</span></td><td className="px-4 py-3 text-right"><button type="button" onClick={() => { setSelected(invoice); setNotice('') }} aria-label={`Open invoice ${invoice.invoiceNumber}`} className="grid size-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100"><Icons.ChevronRight className="size-4" /></button></td></tr>)}</tbody></table></div> : <div className="px-5 py-14 text-center"><Icons.ReceiptText className="mx-auto size-5 text-slate-300" /><h4 className="mt-3 text-sm font-semibold text-slate-800">No invoices in this view</h4><p className="mx-auto mt-1 max-w-md text-xs text-slate-500">A local invoice draft is created automatically when a sale is recorded. Existing sale drafts are backfilled locally.</p></div>}
      <footer className="border-t border-slate-100 px-4 py-3 text-[10px] text-slate-400">Issued status is reserved for authoritative URA confirmation. The receipt printout remains a separate sales receipt.</footer>
    </section>
  </div>
}

function Metric({ label, value, icon, tone, detail }: { label: string; value: number | string; icon: string; tone: string; detail: string }) {
  const Icon = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[icon] ?? Icons.Receipt
  const color = tone === 'green' ? 'bg-emerald-50 text-emerald-700' : tone === 'blue' ? 'bg-sky-50 text-sky-700' : tone === 'rose' ? 'bg-rose-50 text-rose-700' : tone === 'amber' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'
  return <article className="rounded-xl border border-slate-200 bg-white p-4"><span className={`grid size-9 place-items-center rounded-lg ${color}`}><Icon className="size-4" /></span><div className="mt-3 text-xl font-bold text-slate-900">{value}</div><h3 className="mt-0.5 text-xs font-semibold text-slate-700">{label}</h3><p className="mt-1 text-[10px] text-slate-500">{detail}</p></article>
}

function InvoiceDetail({ invoice, state, onBack, onSave, onMarkReady, notice, onSubmit }: { invoice: Invoice; state: ErpState; onBack: () => void; onSave: (form: FormData) => void; onMarkReady: () => void; notice: string; onSubmit: () => void }) {
  const editable = invoice.status === 'Draft'
  const sale = state.sales.find((item) => item.id === invoice.saleId)
  const missing = invoiceReadiness(invoice)
  return <div className="animate-in fade-in duration-200">
    <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-primary hover:underline"><Icons.ArrowLeft className="size-4" /> Back to invoices</button>
    <header className="mb-5 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 lg:flex-row lg:items-center"><span className="grid size-12 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><Icons.ReceiptText className="size-5" /></span><div className="min-w-0 flex-1"><div className="text-xs text-slate-400">Sale {invoice.saleReference} · Local invoice draft</div><h2 className="mt-1 truncate text-xl font-bold text-slate-900">{invoice.invoiceNumber}</h2><div className="mt-2 flex flex-wrap items-center gap-2"><span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${statusTone[invoice.status]}`}>{invoice.status}</span><span className="text-xs text-slate-500">Payment: {paymentState(invoice, state)}</span></div></div><div className="flex flex-wrap gap-2"><button type="button" disabled title="Print/Download PDF can be added after invoice format is confirmed" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-400 disabled:cursor-not-allowed"><Icons.Printer className="size-4" />Print draft</button>{editable && <button type="button" onClick={onMarkReady} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"><Icons.ClipboardCheck className="size-4" />Mark ready</button>}<button type="button" disabled title="URA/EFRIS server connector is not configured" onClick={onSubmit} className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-400"><Icons.Send className="size-4" />Submit to URA</button></div></header>

    <div className="mb-5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-950"><Icons.TriangleAlert className="mt-0.5 size-4 shrink-0" /><p>Draft only. This is not a URA/EFRIS invoice. No tax is calculated, no fiscal number or verification code is issued, and submission is disabled until the official integration is configured.</p></div>
    <form onSubmit={(event) => { event.preventDefault(); onSave(new FormData(event.currentTarget)) }}>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.7fr)]">
        <div className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="text-sm font-bold text-slate-900">Buyer details</h3><p className="mt-1 text-xs text-slate-500">Snapshot from the sale/customer record; edit is available only while this is a draft.</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="block text-xs font-semibold text-slate-600">Buyer legal name<input required name="buyerName" readOnly={!editable} defaultValue={invoice.buyer.name} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm read-only:bg-slate-50" /></label><label className="block text-xs font-semibold text-slate-600">Buyer TIN<input name="buyerTin" readOnly={!editable} defaultValue={invoice.buyer.tin ?? ''} placeholder="Not provided" className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm read-only:bg-slate-50" /></label><label className="block text-xs font-semibold text-slate-600">Email<input name="buyerEmail" type="email" readOnly={!editable} defaultValue={invoice.buyer.email ?? ''} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm read-only:bg-slate-50" /></label><label className="block text-xs font-semibold text-slate-600">Phone<input name="buyerPhone" type="tel" readOnly={!editable} defaultValue={invoice.buyer.phone ?? ''} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm read-only:bg-slate-50" /></label><label className="block text-xs font-semibold text-slate-600 sm:col-span-2">Address<input name="buyerAddress" readOnly={!editable} defaultValue={invoice.buyer.address ?? ''} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm read-only:bg-slate-50" /></label></div></section>
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><header className="border-b border-slate-100 px-5 py-4"><h3 className="text-sm font-bold text-slate-900">Invoice lines</h3><p className="mt-1 text-xs text-slate-500">Sale data currently contains one line; tax treatment requires URA configuration.</p></header><div className="p-5"><div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_100px_140px]"><label className="block text-xs font-semibold text-slate-600 sm:col-span-3">Description<input required name="description" readOnly={!editable} defaultValue={invoice.lines[0]?.description ?? ''} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm read-only:bg-slate-50" /></label><label className="block text-xs font-semibold text-slate-600">Quantity<input required name="quantity" type="number" min="0.001" step="0.001" readOnly={!editable} defaultValue={invoice.lines[0]?.quantity ?? 0} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm read-only:bg-slate-50" /></label><label className="block text-xs font-semibold text-slate-600 sm:col-span-2">Unit price (UGX)<input required name="unitPrice" type="number" min="0" step="1" readOnly={!editable} defaultValue={invoice.lines[0]?.unitPrice ?? 0} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm read-only:bg-slate-50" /></label></div><div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3"><Value label="Subtotal" value={money(invoice.subtotal)} /><Value label="Tax" value={invoice.taxTotal === undefined ? 'Not calculated' : money(invoice.taxTotal)} /><Value label="Invoice total" value={money(invoice.total)} /></div></div></section>
          <section className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="text-sm font-bold text-slate-900">Seller snapshot</h3>{invoice.seller.logoUrl && <img src={invoice.seller.logoUrl} alt="" className="mb-3 max-h-12 max-w-36 object-contain" />}<div className="mt-3 grid gap-3 sm:grid-cols-2"><Value label="Legal name" value={invoice.seller.name || 'Company profile name missing'} /><Value label="Seller TIN" value={invoice.seller.tin || 'Company TIN missing'} /><Value label="Contact" value={[invoice.seller.email, invoice.seller.phone].filter(Boolean).join(' · ') || 'Not provided'} /><Value label="Address" value={invoice.seller.address || 'Not provided'} /></div></section>
        </div>
        <aside className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="text-sm font-bold text-slate-900">Issue readiness</h3><p className="mt-1 text-xs text-slate-500">Local completeness checks only; official requirements have not been configured.</p>{missing.length ? <ul className="mt-4 space-y-2">{missing.map((item) => <li key={item} className="flex items-start gap-2 text-xs text-amber-800"><Icons.CircleAlert className="mt-0.5 size-3.5 shrink-0" />{item}</li>)}</ul> : <p className="mt-4 flex items-center gap-2 text-xs font-semibold text-emerald-700"><Icons.CircleCheck className="size-4" />Basic draft fields are present</p>}<p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-[10px] leading-4 text-slate-500">This does not validate URA tax rules or mean the invoice is legally ready to issue.</p>{editable && <div className="mt-4 flex justify-end"><button type="submit" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Icons.Save className="size-3.5" />Save draft</button></div>}</section>
          <section className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="text-sm font-bold text-slate-900">Sale & payment</h3><div className="mt-3 space-y-3"><Value label="Sale reference" value={invoice.saleReference} /><Value label="Payment terms" value={invoice.paymentTerms} /><Value label="Payment state" value={paymentState(invoice, state)} /><Value label="Due date" value={invoice.dueDate ? formatDate(invoice.dueDate) : 'No due date'} /></div></section>
          <section className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="text-sm font-bold text-slate-900">Draft history</h3><ol className="mt-3 space-y-3">{invoice.events.map((event) => <li key={event.id} className="flex gap-2"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-slate-400" /><div className="min-w-0"><div className="text-xs font-semibold text-slate-700">{event.type}</div><p className="mt-0.5 text-[10px] text-slate-500">{event.actor} · {formatDate(event.at.slice(0, 10))}</p>{event.note && <p className="mt-1 text-[10px] leading-4 text-slate-500">{event.note}</p>}</div></li>)}</ol></section>
        </aside>
      </div>
      {notice && <p role="status" className="mt-4 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">{notice}</p>}
    </form>
  </div>
}

function Value({ label, value }: { label: string; value: string }) { return <div><div className="text-[10px] font-medium uppercase text-slate-400">{label}</div><div className="mt-1 text-xs font-semibold text-slate-800">{value}</div></div> }
