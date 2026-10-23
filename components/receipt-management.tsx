'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, ChevronDown, Download, Eye, Heart, LoaderCircle, Printer, ReceiptText, RotateCcw, Search, Star, X } from 'lucide-react'
import { formatDate, money, type ManagedReceipt } from '@/lib/erp'
import {
  ApiError,
  listAllManagedReceipts,
  listManagedReceipts,
  recordReceiptBulkExport,
  setManagedReceiptArchived,
  setManagedReceiptFavorite,
  type ReceiptFilters,
  type ReceiptKind,
} from '@/lib/user-api'

function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'The receipt action could not be completed.'
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] || character)
}

function receiptHtml(receipt: ManagedReceipt) {
  const company = receipt.company || {}
  const lines = receipt.kind === 'sale'
    ? (receipt.lines.length
      ? receipt.lines.map((line) => `<tr><td>${escapeHtml(line.productName)}</td><td>${line.packs} ${escapeHtml(line.packType)}</td><td>${money(line.lineTotal)}</td></tr>`).join('')
      : `<tr><td>Sale transaction</td><td>—</td><td>${money(receipt.amount)}</td></tr>`)
    : `<tr><td>Credit payment${receipt.saleReceiptNumber ? ` for ${escapeHtml(receipt.saleReceiptNumber)}` : ''}</td><td>${escapeHtml(receipt.payment?.method)}</td><td>${money(receipt.amount)}</td></tr>`
  const summary = receipt.kind === 'sale'
    ? `<p>Total: <strong>${money(receipt.total ?? receipt.amount)}</strong></p><p>Paid: ${money(receipt.paidAmount ?? 0)} &nbsp; Balance: ${money(receipt.balance ?? 0)}</p>${(receipt.payments || []).map((payment) => `<p>${escapeHtml(formatDate(payment.date))} · ${escapeHtml(payment.method)}: ${money(payment.amount)}</p>`).join('')}`
    : `<p>Payment amount: <strong>${money(receipt.amount)}</strong></p>`
  return `<article class="receipt">
    ${company.logoUrl ? `<img class="logo" src="${escapeHtml(company.logoUrl)}" alt="">` : ''}
    <h1>${escapeHtml(company.name || 'Company')}</h1>
    <p>${[company.address, company.phone, company.email].filter(Boolean).map(escapeHtml).join(' · ')}</p>
    <h2>${receipt.kind === 'sale' ? 'SALES RECEIPT' : 'CREDIT PAYMENT RECEIPT'}</h2>
    <p><strong>Receipt:</strong> ${escapeHtml(receipt.receiptNumber)}</p>
    <p><strong>Date:</strong> ${escapeHtml(formatDate(receipt.date))}</p>
    <p><strong>Customer:</strong> ${escapeHtml(receipt.customer?.name || 'Walk-in customer')}</p>
    ${receipt.customer?.phone ? `<p><strong>Phone:</strong> ${escapeHtml(receipt.customer.phone)}</p>` : ''}
    <table><thead><tr><th>Description</th><th>Quantity / method</th><th>Amount</th></tr></thead><tbody>${lines}</tbody></table>
    ${summary}
    <p class="thanks">Thank you for your business.</p>
  </article>`
}

async function printReceipts(receipts: ManagedReceipt[], popup = window.open('', '_blank')) {
  if (!popup) throw new ApiError('Allow pop-ups to print receipts.', 400)
  const html = receipts.map(receiptHtml).join('')
  popup.document.open()
  popup.document.write(`<!doctype html><html><head><title>Receipts</title><style>
    *{box-sizing:border-box}body{font:14px Arial,sans-serif;color:#172033;margin:0}
    .receipt{position:relative;page-break-after:always;break-after:page;padding:18mm 16mm;min-height:260mm}
    .receipt:last-child{page-break-after:auto;break-after:auto}h1{font-size:20px;margin:0 0 4px}
    h2{font-size:16px;margin:24px 0 16px}.logo{max-width:80px;max-height:60px;object-fit:contain;float:right}
    p{margin:5px 0}table{border-collapse:collapse;width:100%;margin:20px 0}
    th,td{text-align:left;border-bottom:1px solid #cbd5e1;padding:8px 4px}
    td:last-child,th:last-child{text-align:right}.thanks{margin-top:32px;color:#64748b}
    @media print{@page{size:A4;margin:0}.receipt{min-height:297mm}}
  </style></head><body>${html}</body></html>`)
  popup.document.close()
  await Promise.all(Array.from(popup.document.images).map((image) => image.complete
    ? Promise.resolve()
    : new Promise<void>((resolve) => {
      image.addEventListener('load', () => resolve(), { once: true })
      image.addEventListener('error', () => resolve(), { once: true })
    })))
  popup.focus()
  popup.print()
}

const logoCache = new Map<string, Promise<{ data: string; format: 'PNG' | 'JPEG' }>>()

function loadReceiptLogo(url: string) {
  if (!logoCache.has(url)) {
    logoCache.set(url, (async () => {
      const response = await fetch(url)
      if (!response.ok) throw new Error('The company logo could not be loaded for the PDF.')
      const blob = await response.blob()
      const format = blob.type === 'image/jpeg' ? 'JPEG' : blob.type === 'image/png' ? 'PNG' : null
      if (!format) throw new Error('The company logo must be a PNG or JPEG image to include it in the PDF.')
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onerror = () => reject(new Error('The company logo could not be read for the PDF.'))
        reader.onload = () => typeof reader.result === 'string'
          ? resolve(reader.result)
          : reject(new Error('The company logo could not be converted for the PDF.'))
        reader.readAsDataURL(blob)
      })
      return { data, format }
    })())
  }
  return logoCache.get(url)!
}

async function downloadReceipts(receipts: ManagedReceipt[], filename = 'receipts.pdf') {
  const { jsPDF } = await import('jspdf')
  const pageHeight = (receipt: ManagedReceipt) => Math.max(
    150,
    145 + (receipt.kind === 'sale' ? receipt.lines.length * 8 + (receipt.payments?.length || 0) * 5 : 0),
  )
  const firstHeight = pageHeight(receipts[0])
  const pdf = new jsPDF({ unit: 'mm', format: [210, firstHeight] })
  for (const [index, receipt] of receipts.entries()) {
    const height = pageHeight(receipt)
    if (index > 0) pdf.addPage([210, height])
    const company = receipt.company || {}
    const buyer = receipt.customer || { name: 'Walk-in customer' }
    let y = 18
    let brandX = 14
    if (company.logoUrl) {
      const logo = await loadReceiptLogo(company.logoUrl)
      pdf.addImage(logo.data, logo.format, 14, 12, 28, 18)
      brandX = 48
    }
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(15)
    pdf.text(company.name || 'Company', brandX, y)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    y += 7
    for (const detail of [company.address, company.phone, company.email].filter(Boolean)) {
      pdf.text(pdf.splitTextToSize(String(detail), 145), brandX, y)
      y += 4.5
    }
    y += 7
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(13)
    pdf.text(receipt.kind === 'sale' ? 'SALES RECEIPT' : 'CREDIT PAYMENT RECEIPT', 14, y)
    y += 9
    pdf.setFontSize(10)
    pdf.text(`Receipt: ${receipt.receiptNumber}`, 14, y)
    pdf.text(`Date: ${formatDate(receipt.date)}`, 196, y, { align: 'right' })
    y += 7
    pdf.setFont('helvetica', 'normal')
    pdf.text(`Customer: ${buyer.name || 'Walk-in customer'}`, 14, y)
    if (buyer.phone) {
      y += 6
      pdf.text(`Phone: ${buyer.phone}`, 14, y)
    }
    y += 12
    pdf.setFont('helvetica', 'bold')
    pdf.text('Description', 14, y)
    pdf.text('Amount', 196, y, { align: 'right' })
    y += 3
    pdf.line(14, y, 196, y)
    y += 7
    pdf.setFont('helvetica', 'normal')
    if (receipt.kind === 'sale') {
      for (const line of receipt.lines) {
        const wrapped = pdf.splitTextToSize(`${line.productName} · ${line.packs} ${line.packType}`, 145) as string[]
        pdf.text(wrapped, 14, y)
        pdf.text(money(line.lineTotal), 196, y, { align: 'right' })
        y += Math.max(6, wrapped.length * 5)
      }
      if (!receipt.lines.length) {
        pdf.text('Sale transaction', 14, y)
        pdf.text(money(receipt.amount), 196, y, { align: 'right' })
        y += 7
      }
      y += 4
      pdf.line(14, y, 196, y)
      y += 8
      pdf.setFont('helvetica', 'bold')
      pdf.text('Total', 150, y, { align: 'right' })
      pdf.text(money(receipt.total ?? receipt.amount), 196, y, { align: 'right' })
      y += 7
      pdf.setFont('helvetica', 'normal')
      pdf.text(`Paid: ${money(receipt.paidAmount ?? 0)}    Balance: ${money(receipt.balance ?? 0)}`, 14, y)
      for (const payment of receipt.payments || []) {
        y += 6
        pdf.setFontSize(8)
        pdf.text(`${formatDate(payment.date)} · ${payment.method}${payment.receiptNumber ? ` · ${payment.receiptNumber}` : ''}: ${money(payment.amount)}`, 14, y)
      }
    } else {
      pdf.text(`Credit payment for ${receipt.saleReceiptNumber || 'sale'}`, 14, y)
      pdf.text(money(receipt.amount), 196, y, { align: 'right' })
      y += 8
      pdf.text(`Method: ${receipt.payment?.method || '—'}`, 14, y)
      if (receipt.payment?.txnID) pdf.text(`Reference: ${receipt.payment.txnID}`, 14, y + 6)
    }
  }
  await pdf.save(filename, { returnPromise: true })
}

export default function ReceiptManagementPage({
  companyName,
  companyLogoUrl,
}: {
  companyName: string
  companyLogoUrl: string
}) {
  const [kind, setKind] = useState<ReceiptKind>('sales')
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const [archivedOnly, setArchivedOnly] = useState(false)
  const [cursor, setCursor] = useState<string | undefined>()
  const [previousCursors, setPreviousCursors] = useState<Array<string | undefined>>([])
  const [selected, setSelected] = useState<ManagedReceipt | null>(null)
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState('')
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()
  const filters = useMemo<ReceiptFilters>(() => ({
    from: from || undefined,
    to: to || undefined,
    search: search || undefined,
    favorite: favoriteOnly || undefined,
    archived: archivedOnly || undefined,
  }), [archivedOnly, favoriteOnly, from, search, to])
  const query = useQuery({
    queryKey: ['managed-receipts', kind, filters, cursor],
    queryFn: () => listManagedReceipts(kind, filters, cursor),
  })
  const receipts = query.data?.receipts || []

  useEffect(() => {
    if (!exportMenuOpen) return
    const dismissOutside = (event: PointerEvent) => {
      if (!exportMenuRef.current?.contains(event.target as Node)) setExportMenuOpen(false)
    }
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExportMenuOpen(false)
    }
    document.addEventListener('pointerdown', dismissOutside)
    document.addEventListener('keydown', dismissOnEscape)
    return () => {
      document.removeEventListener('pointerdown', dismissOutside)
      document.removeEventListener('keydown', dismissOnEscape)
    }
  }, [exportMenuOpen])

  function resetPaging() {
    setCursor(undefined)
    setPreviousCursors([])
  }

  async function updateFavorite(receipt: ManagedReceipt) {
    setActionError('')
    try {
      await setManagedReceiptFavorite(kind, receipt.id, !receipt.isFavorite)
      await queryClient.invalidateQueries({ queryKey: ['managed-receipts'] })
      setSelected((current) => current?.id === receipt.id ? { ...current, isFavorite: !receipt.isFavorite } : current)
    } catch (error) {
      setActionError(errorText(error))
    }
  }

  async function updateArchive(receipt: ManagedReceipt) {
    setActionError('')
    try {
      await setManagedReceiptArchived(kind, receipt.id, !receipt.isArchived)
      await queryClient.invalidateQueries({ queryKey: ['managed-receipts'] })
      setSelected(null)
    } catch (error) {
      setActionError(errorText(error))
    }
  }

  async function exportReceipts(action: 'print' | 'download', applyFilters: boolean) {
    setActionError('')
    setBusy(`${action}-${applyFilters ? 'filtered' : 'all'}`)
    const popup = action === 'print' ? window.open('', '_blank') : null
    if (action === 'print' && !popup) {
      setBusy('')
      setActionError('Allow pop-ups to print receipts.')
      return
    }
    try {
      const result = await listAllManagedReceipts(kind, applyFilters ? filters : { archived: archivedOnly || undefined })
      if (!result.receipts.length) throw new ApiError('There are no receipts in this selection.', 404)
      if (result.receipts.length >= 200 && !window.confirm(`This will ${action} ${result.receipts.length.toLocaleString()} receipts. Continue?`)) {
        popup?.close()
        return
      }
      if (action === 'print') await printReceipts(result.receipts, popup)
      else await downloadReceipts(result.receipts)
      await recordReceiptBulkExport(kind, action, result.receipts.length, applyFilters ? filters : { archived: archivedOnly || undefined })
    } catch (error) {
      popup?.close()
      setActionError(errorText(error))
    } finally {
      setBusy('')
    }
  }

  async function exportOne(receipt: ManagedReceipt, action: 'print' | 'download') {
    setActionError('')
    try {
      if (action === 'print') await printReceipts([receipt])
      else await downloadReceipts([receipt], `${receipt.receiptNumber.replace(/[^A-Za-z0-9_-]/g, '-')}.pdf`)
    } catch (error) {
      setActionError(errorText(error))
    }
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Sales Department</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Receipt Management</h1>
          <p className="mt-1 text-sm text-slate-500">Browse, manage, print, and download server-recorded receipts.</p>
        </div>
        <div ref={exportMenuRef} className="relative">
          <button
            type="button"
            disabled={Boolean(busy)}
            aria-haspopup="menu"
            aria-expanded={exportMenuOpen}
            onClick={() => setExportMenuOpen((open) => !open)}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            <Download className="size-4" /> Export <ChevronDown className={`size-4 transition-transform ${exportMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          {exportMenuOpen && (
            <div role="menu" aria-label="Export receipts" className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
              <button
                type="button"
                role="menuitem"
                disabled={Boolean(busy)}
                onClick={() => { setExportMenuOpen(false); void exportReceipts('print', false) }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Printer className="size-4 text-slate-500" /> Print all receipts
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={Boolean(busy)}
                onClick={() => { setExportMenuOpen(false); void exportReceipts('download', false) }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Download className="size-4 text-slate-500" /> Download all receipts
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Receipts', query.data?.stats.count ?? 0],
          ['Total value', money(query.data?.stats.totalAmount ?? 0)],
          [kind === 'sales' ? 'Amount paid' : 'Payments received', money(query.data?.stats.totalPaid ?? 0)],
          ['Outstanding balance', money(query.data?.stats.outstanding ?? 0)],
        ].map(([label, value]) => (
          <article key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-2 text-xl font-bold text-slate-900">{value}</p>
          </article>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        {([
          ['sales', 'Sales receipts'],
          ['credit-payments', 'Credit payment receipts'],
        ] as const).map(([value, label]) => (
          <button key={value} type="button" onClick={() => { setKind(value); resetPaging(); setSelected(null) }} className={`border-b-2 px-3 py-3 text-sm font-semibold ${kind === value ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="min-w-48 flex-1">
          <span className="mb-1 block text-xs font-semibold text-slate-600">Search</span>
          <span className="flex items-center gap-2 rounded-lg border border-slate-200 px-3">
            <Search className="size-4 text-slate-400" />
            <input value={search} onChange={(event) => { setSearch(event.target.value); resetPaging() }} placeholder="Receipt, customer, or product" className="h-10 w-full bg-transparent text-sm outline-none" />
          </span>
        </label>
        <label><span className="mb-1 block text-xs font-semibold text-slate-600">From</span><input type="date" value={from} onChange={(event) => { setFrom(event.target.value); resetPaging() }} className="h-10 rounded-lg border border-slate-200 px-3 text-sm" /></label>
        <label><span className="mb-1 block text-xs font-semibold text-slate-600">To</span><input type="date" value={to} onChange={(event) => { setTo(event.target.value); resetPaging() }} className="h-10 rounded-lg border border-slate-200 px-3 text-sm" /></label>
        <label className="flex h-10 items-center gap-2 px-1 text-sm text-slate-600"><input type="checkbox" checked={favoriteOnly} onChange={(event) => { setFavoriteOnly(event.target.checked); resetPaging() }} /> Favorites</label>
        <label className="flex h-10 items-center gap-2 px-1 text-sm text-slate-600"><input type="checkbox" checked={archivedOnly} onChange={(event) => { setArchivedOnly(event.target.checked); resetPaging() }} /> Archived</label>
        <button type="button" disabled={Boolean(busy)} onClick={() => void exportReceipts('print', true)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 disabled:opacity-50"><Printer className="size-4" /> Print filtered</button>
        <button type="button" disabled={Boolean(busy)} onClick={() => void exportReceipts('download', true)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 disabled:opacity-50"><Download className="size-4" /> Download filtered</button>
      </div>

      {actionError && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{actionError}</div>}
      {busy && <p role="status" className="inline-flex items-center gap-2 text-sm text-slate-600"><LoaderCircle className="size-4 animate-spin" /> Preparing receipt export…</p>}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {query.isLoading ? <p role="status" className="p-8 text-center text-sm text-slate-500">Loading receipts…</p> : query.isError ? (
          <div role="alert" className="p-8 text-center text-sm text-rose-700">{errorText(query.error)} <button type="button" onClick={() => void query.refetch()} className="ml-2 font-semibold underline">Retry</button></div>
        ) : receipts.length === 0 ? (
          <div className="p-12 text-center"><ReceiptText className="mx-auto size-8 text-slate-300" /><p className="mt-3 font-semibold text-slate-700">No receipts found</p><p className="mt-1 text-sm text-slate-500">Adjust the filters or switch receipt tabs.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Receipt</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {receipts.map((receipt) => (
                  <tr key={receipt.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-semibold text-slate-900">{receipt.receiptNumber}</td>
                    <td className="px-4 py-3">{receipt.customer?.name || 'Walk-in customer'}{receipt.saleReceiptNumber && <span className="mt-1 block text-xs text-slate-500">Sale {receipt.saleReceiptNumber}</span>}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(receipt.date)}</td>
                    <td className="px-4 py-3 font-semibold">{money(receipt.amount)}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${receipt.isArchived ? 'bg-slate-100 text-slate-600' : receipt.balance ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{receipt.isArchived ? 'Archived' : receipt.balance ? 'Partially paid' : 'Complete'}</span></td>
                    <td className="px-4 py-3"><div className="flex justify-end gap-1">
                      <button type="button" title="View receipt" aria-label={`View ${receipt.receiptNumber}`} onClick={() => setSelected(receipt)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100"><Eye className="size-4" /></button>
                      <button type="button" title={receipt.isFavorite ? 'Remove favorite' : 'Save favorite'} aria-label={`${receipt.isFavorite ? 'Unfavorite' : 'Favorite'} ${receipt.receiptNumber}`} onClick={() => void updateFavorite(receipt)} className={`rounded-md p-2 hover:bg-rose-50 ${receipt.isFavorite ? 'text-rose-600' : 'text-slate-500'}`}><Heart className="size-4" fill={receipt.isFavorite ? 'currentColor' : 'none'} /></button>
                      <button type="button" title="Print receipt" aria-label={`Print ${receipt.receiptNumber}`} onClick={() => void exportOne(receipt, 'print')} className="rounded-md p-2 text-slate-500 hover:bg-slate-100"><Printer className="size-4" /></button>
                      <button type="button" title="Download receipt" aria-label={`Download ${receipt.receiptNumber}`} onClick={() => void exportOne(receipt, 'download')} className="rounded-md p-2 text-slate-500 hover:bg-slate-100"><Download className="size-4" /></button>
                      <button type="button" title={receipt.isArchived ? 'Restore receipt' : 'Archive receipt'} aria-label={`${receipt.isArchived ? 'Restore' : 'Archive'} ${receipt.receiptNumber}`} onClick={() => void updateArchive(receipt)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100">{receipt.isArchived ? <RotateCcw className="size-4" /> : <Archive className="size-4" />}</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!query.isError && !query.isLoading && receipts.length > 0 && <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
          <span>{query.data?.stats.count ?? 0} matching receipts</span>
          <div className="flex gap-2">
            <button type="button" disabled={!previousCursors.length} onClick={() => { const previous = [...previousCursors]; const next = previous.pop(); setPreviousCursors(previous); setCursor(next) }} className="rounded-md border border-slate-200 px-3 py-1.5 disabled:opacity-40">Previous</button>
            <button type="button" disabled={!query.data?.nextCursor} onClick={() => { setPreviousCursors((items) => [...items, cursor]); setCursor(query.data?.nextCursor || undefined) }} className="rounded-md border border-slate-200 px-3 py-1.5 disabled:opacity-40">Next</button>
          </div>
        </div>}
      </div>

      {selected && <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null) }}>
        <section role="dialog" aria-modal="true" aria-labelledby="receipt-preview-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white shadow-2xl">
          <header className="flex items-start justify-between border-b border-slate-100 p-5"><div className="flex items-center gap-3">{(selected.company?.logoUrl || companyLogoUrl) && <img src={selected.company?.logoUrl || companyLogoUrl} alt="" className="size-10 rounded object-contain" />}<div><p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{selected.company?.name || companyName}</p><h2 id="receipt-preview-title" className="text-lg font-bold">{selected.kind === 'sale' ? 'Sales receipt' : 'Credit payment receipt'}</h2></div></div><button type="button" onClick={() => setSelected(null)} aria-label="Close receipt" className="rounded-md p-2 text-slate-500 hover:bg-slate-100"><X className="size-4" /></button></header>
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-slate-500">Receipt number</p><p className="font-semibold">{selected.receiptNumber}</p></div><div><p className="text-xs text-slate-500">Date</p><p className="font-semibold">{formatDate(selected.date)}</p></div><div><p className="text-xs text-slate-500">Customer</p><p className="font-semibold">{selected.customer?.name || 'Walk-in customer'}</p></div><div><p className="text-xs text-slate-500">Amount</p><p className="font-semibold">{money(selected.amount)}</p></div></div>
            {selected.kind === 'sale' ? <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">{selected.lines.map((line, index) => <div key={`${line.productId}-${index}`} className="flex justify-between gap-4 p-3 text-sm"><span>{line.productName} · {line.packs} {line.packType}</span><strong>{money(line.lineTotal)}</strong></div>)}<div className="flex justify-between p-3 text-sm font-bold"><span>Total</span><span>{money(selected.total ?? selected.amount)}</span></div><div className="flex justify-between p-3 text-sm"><span>Paid / balance</span><span>{money(selected.paidAmount ?? 0)} / {money(selected.balance ?? 0)}</span></div></div> : <div className="rounded-lg border border-slate-200 p-3 text-sm"><p>Sale receipt: {selected.saleReceiptNumber}</p><p>Payment method: {selected.payment?.method || '—'}</p>{selected.payment?.txnID && <p>Transaction: {selected.payment.txnID}</p>}</div>}
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
              <button type="button" onClick={() => void updateFavorite(selected)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold"><Star className="size-4" />{selected.isFavorite ? 'Saved' : 'Save favorite'}</button>
              <button type="button" onClick={() => void exportOne(selected, 'print')} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold"><Printer className="size-4" />Print</button>
              <button type="button" onClick={() => void exportOne(selected, 'download')} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold"><Download className="size-4" />Download</button>
              <button type="button" onClick={() => void updateArchive(selected)} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">{selected.isArchived ? <RotateCcw className="size-4" /> : <Archive className="size-4" />}{selected.isArchived ? 'Restore' : 'Archive'}</button>
            </div>
          </div>
        </section>
      </div>}
    </section>
  )
}
