'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Download, Ellipsis, Eye, Plus, Printer, Search, X } from 'lucide-react'
import { createId, exportCsv, formatDate, money, packUnitLabel, paidAmountForSale, paymentStateForSale, sum, type ErpState, type Sale, type SalePayment } from '@/lib/erp'
import { ApiError, confirmOrder, createSale, getCreditCustomerStatement, getCreditReminderSettings, getSalesBonusSettings, listOrders, listProductionProducts, listSalesOwners, recordSalePayment, updateCreditReminderSettings, updateCreditSale, type UserAccount } from '@/lib/user-api'

type Props = {
  mode: 'sales' | 'credit'
  state: ErpState
  currentUser: UserAccount
  salesLoading: boolean
  salesError: string
  salesWarning: string
  onRetrySales: () => void
  onSaleUpdated: (sale: Sale, payments: SalePayment[]) => void
  companyName: string
  companyLogoUrl: string
  customersAvailable: boolean
  onRetryCustomers: () => void
}

type DraftLine = { key: string; productId: string; packs: string; price: string; reason: string }
type SalePaymentDraft = { amount: number; date: string; method: SalePayment['method']; txnID: string; note: string }
type SalesPeriod = 'today' | 'week' | 'month'

const paymentMethods: SalePayment['method'][] = ['Cash', 'Mobile Money', 'Bank Transfer', 'Check', 'Card']
const salesPeriodLabels: Record<SalesPeriod, string> = {
  today: 'Today',
  week: 'This week',
  month: 'This month',
}
const today = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Kampala',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date())
const salesPeriodStart = (period: SalesPeriod, currentDate: string) => {
  if (period === 'month') return `${currentDate.slice(0, 7)}-01`
  if (period === 'today') return currentDate

  const date = new Date(`${currentDate}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7))
  return date.toISOString().slice(0, 10)
}
const productQueryKey = ['sales-products']

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'The request could not be completed.'
}

function SaleReceipt({
  sale,
  companyName,
  companyLogoUrl,
  onClose,
}: {
  sale: Sale
  companyName: string
  companyLogoUrl: string
  onClose: () => void
}) {
  const [downloadError, setDownloadError] = useState('')
  const [downloading, setDownloading] = useState(false)
  const company = sale.companySnapshot ?? {
    name: companyName,
    logoUrl: companyLogoUrl,
  }
  const buyer = sale.customerSnapshot ?? { name: sale.customer }
  const payments = sale.payments ?? []
  const lines = sale.lines?.length
    ? sale.lines
    : sale.legacyImported
      ? []
      : [{
        productId: '',
        productCode: '',
        productName: sale.product,
        packType: 'Box' as const,
        piecesPerPack: 1,
        packs: sale.quantity,
        quantityPieces: sale.quantity,
        catalogPricePerPack: sale.total / Math.max(1, sale.quantity),
        pricePerPack: sale.total / Math.max(1, sale.quantity),
        lineTotal: sale.total,
      }]

  const downloadPdf = async () => {
    setDownloading(true)
    setDownloadError('')
    try {
      const { jsPDF } = await import('jspdf')
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
      let y = 18
      let brandX = 14
      if (company.logoUrl) {
        const response = await fetch(company.logoUrl)
        if (!response.ok) throw new Error('The company logo could not be loaded for the PDF.')
        const logoBlob = await response.blob()
        const imageFormat = logoBlob.type === 'image/jpeg' ? 'JPEG' : logoBlob.type === 'image/png' ? 'PNG' : ''
        if (!imageFormat) throw new Error('The company logo must be a PNG or JPEG image to include it in the PDF.')
        const logoData = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onerror = () => reject(new Error('The company logo could not be read for the PDF.'))
          reader.onload = () => typeof reader.result === 'string'
            ? resolve(reader.result)
            : reject(new Error('The company logo could not be converted for the PDF.'))
          reader.readAsDataURL(logoBlob)
        })
        pdf.addImage(logoData, imageFormat, 14, 12, 28, 18)
        brandX = 48
      }
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(15)
      const companyLines = pdf.splitTextToSize(company.name || companyName, 132) as string[]
      pdf.text(companyLines, brandX, y)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      y += Math.max(6, companyLines.length * 6)
      for (const detail of [company.address, company.phone, company.email].filter(Boolean)) {
        const detailLines = pdf.splitTextToSize(String(detail), 132) as string[]
        pdf.text(detailLines, brandX, y)
        y += Math.max(4.5, detailLines.length * 4.5)
      }
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.text(`Sale / Receipt No. ${sale.receiptNumber || sale.reference}`, 196, 18, { align: 'right' })
      pdf.setFontSize(18)
      pdf.text('SALES RECEIPT', 14, y + 7)
      y += 14
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.text(`Date: ${formatDate(sale.date)}`, 14, y)
      pdf.text(`Customer: ${buyer.name}`, 14, y + 6)
      if (buyer.phone) pdf.text(`Phone: ${buyer.phone}`, 14, y + 12)
      y += buyer.phone ? 22 : 16
      pdf.setFont('helvetica', 'bold')
      pdf.text('Product', 14, y)
      pdf.text('Packs', 120, y, { align: 'right' })
      pdf.text('Price / pack', 158, y, { align: 'right' })
      pdf.text('Amount', 196, y, { align: 'right' })
      y += 3
      pdf.line(14, y, 196, y)
      y += 7
      pdf.setFont('helvetica', 'normal')
      for (const line of lines) {
        const label = `${line.productName} (${line.packType}${line.piecesPerPack ? ` · ${line.piecesPerPack} pcs` : ''})`
        const wrapped = pdf.splitTextToSize(label, 95) as string[]
        if (y + Math.max(6, wrapped.length * 4.5) + 2 > 275) {
          pdf.addPage()
          y = 18
          pdf.setFont('helvetica', 'bold')
          pdf.text(`Receipt ${sale.receiptNumber || sale.reference} (continued)`, 14, y)
          y += 9
          pdf.setFont('helvetica', 'normal')
        }
        pdf.text(wrapped, 14, y)
        pdf.text(String(line.packs), 120, y, { align: 'right' })
        pdf.text(money(line.pricePerPack), 158, y, { align: 'right' })
        pdf.text(money(line.lineTotal), 196, y, { align: 'right' })
        y += Math.max(6, wrapped.length * 4.5) + 2
      }
      if (sale.legacyImported) {
        pdf.text(`${sale.product} (legacy record)`, 14, y)
        pdf.text(`${sale.quantity} units`, 120, y, { align: 'right' })
        pdf.text('-', 158, y, { align: 'right' })
        pdf.text(money(sale.total), 196, y, { align: 'right' })
        y += 8
      }
      pdf.line(14, y, 196, y)
      y += 8
      pdf.setFont('helvetica', 'bold')
      pdf.text('Total', 158, y, { align: 'right' })
      pdf.text(money(sale.total), 196, y, { align: 'right' })
      y += 7
      pdf.setFont('helvetica', 'normal')
      pdf.text(`Payment terms: ${sale.paymentTerms || 'Same-day'}`, 14, y)
      y += 6
      pdf.text(`Paid: ${money(sale.paidAmount ?? sum(payments.map((payment) => payment.amount)))}`, 14, y)
      y += 6
      pdf.text(`Balance: ${money(Math.max(0, sale.total - (sale.paidAmount ?? sum(payments.map((payment) => payment.amount)))) )}`, 14, y)
      y += 9
      for (const payment of payments) {
        pdf.text(`${formatDate(payment.date)} · ${payment.method}${payment.txnID ? ` · ${payment.txnID}` : ''}: ${money(payment.amount)}`, 14, y)
        y += 5
      }
      y += 10
      if (y + 24 > 282) {
        pdf.addPage()
        y = 250
      } else {
        y = Math.max(y, 250)
      }
      pdf.setDrawColor(203, 213, 225)
      pdf.line(14, y - 5, 196, y - 5)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(9)
      pdf.text(`Sale made by: ${sale.createdByName || 'Name not recorded'}`, 14, y)
      pdf.setFont('helvetica', 'normal')
      pdf.text('Signature:', 128, y)
      pdf.line(148, y + 1, 196, y + 1)
      y += 10
      pdf.save(`${(sale.receiptNumber || sale.reference).replace(/[^A-Za-z0-9_-]/g, '-')}.pdf`)
    } catch (error) {
      setDownloadError(errorMessage(error))
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section role="dialog" aria-modal="true" aria-labelledby="sale-receipt-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id="sale-receipt-title" className="text-base font-bold">Sale receipt</h2>
            <p className="mt-1 text-xs text-slate-500">{sale.receiptNumber || sale.reference}</p>
          </div>
          <button type="button" aria-label="Close receipt" onClick={onClose} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><X className="size-4" /></button>
        </header>
        <div className="p-5">
          <div className="mb-5 flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
            <div className="flex items-start gap-3">
              {company.logoUrl && <img src={company.logoUrl} alt="" className="max-h-14 max-w-24 object-contain" />}
              <div>
                <h3 className="font-bold">{company.name || companyName}</h3>
                {company.address && <p className="mt-1 text-xs text-slate-500">{company.address}</p>}
                <p className="mt-1 text-xs text-slate-500">{[company.phone, company.email].filter(Boolean).join(' · ')}</p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Sale / Receipt No.</div>
              <div className="mt-1 text-sm font-bold">{sale.receiptNumber || sale.reference}</div>
              <div className="mt-1 text-xs text-slate-500">{formatDate(sale.date)}</div>
            </div>
          </div>
          <div className="mb-5 grid gap-3 sm:grid-cols-2">
            <div><div className="text-[10px] uppercase text-slate-400">Customer</div><div className="mt-1 text-sm font-semibold">{buyer.name}</div></div>
            {buyer.phone && <div><div className="text-[10px] uppercase text-slate-400">Phone</div><div className="mt-1 text-sm">{buyer.phone}</div></div>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-left text-xs">
              <thead><tr className="border-b border-slate-200 text-[10px] uppercase text-slate-400"><th className="py-2">Product</th><th className="py-2 text-right">Packs</th><th className="py-2 text-right">Price / pack</th><th className="py-2 text-right">Amount</th></tr></thead>
              <tbody>{sale.legacyImported ? <tr className="border-b border-slate-100"><td className="py-2.5 font-medium">{sale.product}<span className="block text-[10px] text-slate-400">Imported historical record</span></td><td className="py-2.5 text-right">{sale.quantity} units</td><td className="py-2.5 text-right">—</td><td className="py-2.5 text-right font-semibold">{money(sale.total)}</td></tr> : lines.map((line, index) => <tr key={`${line.productId}-${index}`} className="border-b border-slate-100"><td className="py-2.5 font-medium">{line.productName}<span className="block text-[10px] text-slate-400">{line.packType} · {line.piecesPerPack} pieces/pack</span></td><td className="py-2.5 text-right">{line.packs}</td><td className="py-2.5 text-right">{money(line.pricePerPack)}</td><td className="py-2.5 text-right font-semibold">{money(line.lineTotal)}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="mt-4 ml-auto max-w-xs space-y-2 text-xs">
            <div className="flex justify-between border-t border-slate-200 pt-3 font-bold"><span>Total</span><span>{money(sale.total)}</span></div>
            <div className="flex justify-between"><span>Paid</span><span>{money(sale.paidAmount ?? sum(payments.map((payment) => payment.amount)))}</span></div>
            <div className="flex justify-between font-semibold"><span>Balance</span><span>{money(Math.max(0, sale.total - (sale.paidAmount ?? sum(payments.map((payment) => payment.amount)))))}</span></div>
          </div>
          <div className="mt-4 text-xs text-slate-500">Terms: {sale.paymentTerms || 'Same-day'}</div>
          {payments.length > 0 && <div className="mt-3"><h3 className="text-[10px] font-bold uppercase text-slate-400">Payments</h3>{payments.map((payment) => <div key={payment.id} className="mt-1 flex justify-between gap-3 text-xs"><span>{formatDate(payment.date)} · {payment.method}{payment.txnID ? ` · ${payment.txnID}` : ''}</span><span>{money(payment.amount)}</span></div>)}</div>}
          {downloadError && <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{downloadError}</p>}
        </div>
        <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Close</button>
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold"><Printer className="size-4" /> Print</button>
          <button type="button" onClick={() => void downloadPdf()} disabled={downloading} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"><Download className="size-4" />{downloading ? 'Preparing PDF…' : 'Download PDF'}</button>
        </footer>
        <div className="sale-receipt-print" aria-hidden="true">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              {company.logoUrl && <img src={company.logoUrl} alt="" className="max-h-14 max-w-24 object-contain" />}
              <div><div className="receipt-brand">{company.name || companyName}</div>{company.address && <div className="mt-1 text-xs">{company.address}</div>}<div className="mt-1 text-xs">{[company.phone, company.email].filter(Boolean).join(' · ')}</div></div>
            </div>
            <div className="receipt-reference text-right"><strong>Sale / Receipt No.</strong><div>{sale.receiptNumber || sale.reference}</div></div>
          </div>
          <h1>Sales receipt</h1>
          <div className="receipt-line"><span>Date</span><strong>{formatDate(sale.date)}</strong></div>
          <div className="receipt-line"><span>Customer</span><strong>{buyer.name}</strong></div>
          {buyer.phone && <div className="receipt-line"><span>Phone</span><strong>{buyer.phone}</strong></div>}
          <div className="receipt-divider" />
          {sale.legacyImported ? <div className="receipt-line"><span>{sale.product} · {sale.quantity} units (imported historical record)</span><strong>{money(sale.total)}</strong></div> : lines.map((line, index) => <div key={`${line.productId}-${index}`} className="receipt-line"><span>{line.productName} · {line.packs} {line.packType} × {money(line.pricePerPack)}</span><strong>{money(line.lineTotal)}</strong></div>)}
          <div className="receipt-divider" />
          <div className="receipt-total"><span>Total</span><strong>{money(sale.total)}</strong></div>
          <div className="receipt-line"><span>Paid</span><strong>{money(sale.paidAmount ?? sum(payments.map((payment) => payment.amount)))}</strong></div>
          <div className="receipt-line"><span>Balance</span><strong>{money(Math.max(0, sale.total - (sale.paidAmount ?? sum(payments.map((payment) => payment.amount)))))}</strong></div>
          {payments.map((payment) => <div key={payment.id} className="receipt-line"><span>{formatDate(payment.date)} · {payment.method}</span><strong>{money(payment.amount)}</strong></div>)}
          <p className="receipt-thanks">Thank you for your business.</p>
          <div className="receipt-signoff">
            <div><div className="receipt-signoff-label">Sale made by</div><strong>{sale.createdByName || 'Name not recorded'}</strong></div>
            <div className="receipt-signature"><span>Signature</span><span className="receipt-signature-line" /></div>
          </div>
        </div>
      </section>
    </div>
  )
}

function SaleForm({
  customers,
  customersAvailable,
  onRetryCustomers,
  user,
  onCancel,
  onSubmit,
}: {
  customers: ErpState['customers']
  customersAvailable: boolean
  onRetryCustomers: () => void
  user: UserAccount
  onCancel: () => void
  onSubmit: (input: Parameters<typeof createSale>[0]) => Promise<Sale>
}) {
  const [customerId, setCustomerId] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerMenuOpen, setCustomerMenuOpen] = useState(false)
  const [activeCustomerOption, setActiveCustomerOption] = useState(0)
  const [guestName, setGuestName] = useState('Walk-in customer')
  const [guestPhone, setGuestPhone] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [terms, setTerms] = useState<'Paid now' | 'Same-day' | 'Credit'>('Same-day')
  const [dueDate, setDueDate] = useState('')
  const [method, setMethod] = useState<SalePayment['method']>('Cash')
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [lines, setLines] = useState<DraftLine[]>([{ key: createId('LINE'), productId: '', packs: '1', price: '', reason: '' }])
  const [error, setError] = useState('')
  const [salePending, setSalePending] = useState(false)
  const [bonusDisabled, setBonusDisabled] = useState(false)
  const [bonusDisabledReason, setBonusDisabledReason] = useState('')
  const idempotencyKey = useRef(createId('SALE'))
  const customerPickerRef = useRef<HTMLDivElement>(null)
  const productsQuery = useQuery({ queryKey: productQueryKey, queryFn: listProductionProducts })
  const bonusSettingsQuery = useQuery({ queryKey: ['sales-bonus-settings'], queryFn: getSalesBonusSettings })
  const activeProducts = productsQuery.data?.products.filter((product) =>
    product.active && product.packType && product.piecesPerPack && product.price && product.price > 0,
  ) ?? []
  const availablePacksFor = (productId: string) => {
    const product = activeProducts.find((item) => item.id === productId)
    return product
      ? Math.max(0, product.availablePacks ?? product.balancePacks - (product.reservedPacks ?? 0))
      : 0
  }
  const requestedPacksByProduct = lines.reduce((totals, line) => {
    if (line.productId) totals.set(line.productId, (totals.get(line.productId) ?? 0) + (Number(line.packs) || 0))
    return totals
  }, new Map<string, number>())
  const hasInsufficientStock = [...requestedPacksByProduct].some(([productId, packs]) =>
    packs > availablePacksFor(productId),
  )
  const hasSellableStock = activeProducts.some((product) => availablePacksFor(product.id) > 0)
  const stockUnavailable = productsQuery.isLoading || productsQuery.isError || !hasSellableStock
  const guest = !customerId
  const selectedCustomer = customers.find((customer) => customer.id === customerId)
  const customerOptions = customers.filter((customer) =>
    customersAvailable &&
    customer.status === 'Active' &&
    !customer.archivedAt &&
    customer.name.toLowerCase().includes(customerSearch.trim().toLowerCase()),
  )
  const canOverridePrice = user.roles.some((role) => ['Sales Manager', 'General Manager', 'Super Admin'].includes(role))
  const total = lines.reduce((sumLines, line) => sumLines + (Number(line.packs) || 0) * Number(line.price || 0), 0)
  const todayValue = today()
  const eligibleBoxQuantity = lines.reduce((total, line) => {
    const product = activeProducts.find((item) => item.id === line.productId)
    return product?.packType === 'Box' ? total + (Number(line.packs) || 0) : total
  }, 0)
  const bonusPreview = (() => {
    const settings = bonusSettingsQuery.data?.salesBonus
    if (!settings?.enabled || bonusDisabled || !eligibleBoxQuantity) return 0
    if (eligibleBoxQuantity >= settings.volume.minimumQuantity) {
      return Math.floor(eligibleBoxQuantity / settings.volume.qualifyingQuantity) * settings.volume.bonusQuantity
    }
    if (eligibleBoxQuantity >= settings.standard.minimumQuantity && eligibleBoxQuantity <= settings.standard.maximumQuantity) {
      return Math.floor(eligibleBoxQuantity / settings.standard.qualifyingQuantity) * settings.standard.bonusQuantity
    }
    return 0
  })()
  const canDisableBonus = user.roles.some((role) => ['Sales Manager', 'General Manager', 'Super Admin'].includes(role))

  useEffect(() => {
    if (!customerMenuOpen) return
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !customerPickerRef.current?.contains(event.target)) {
        setCustomerMenuOpen(false)
        setCustomerSearch('')
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCustomerMenuOpen(false)
        setCustomerSearch('')
      }
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [customerMenuOpen])

  const selectCustomer = (id: string) => {
    setCustomerId(id)
    setCustomerSearch('')
    setCustomerMenuOpen(false)
    setActiveCustomerOption(0)
    if (!id) {
      setTerms('Paid now')
      setPaymentAmount(total)
    }
  }
  const handleCustomerKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setCustomerMenuOpen(true)
      setActiveCustomerOption((current) => Math.min(current + 1, customerOptions.length))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setCustomerMenuOpen(true)
      setActiveCustomerOption((current) => Math.max(current - 1, 0))
    } else if (event.key === 'Enter' && customerMenuOpen) {
      event.preventDefault()
      selectCustomer(activeCustomerOption === 0 ? '' : customerOptions[activeCustomerOption - 1]?.id ?? '')
    } else if (event.key === 'Escape' && customerMenuOpen) {
      event.preventDefault()
      setCustomerMenuOpen(false)
      setCustomerSearch('')
    }
  }

  const setTerm = (value: 'Paid now' | 'Same-day' | 'Credit') => {
    setTerms(value)
    if (value === 'Paid now') setPaymentAmount(total)
  }
  const changeProduct = (key: string, productId: string) => {
    const product = activeProducts.find((item) => item.id === productId)
    setLines((current) => current.map((line) =>
      line.key === key ? { ...line, productId, price: product?.price ? String(product.price) : '', reason: '' } : line,
    ))
  }
  const changeTermTotal = (nextLines: DraftLine[]) => {
    setLines(nextLines)
    if (terms === 'Paid now' || guest) {
      setPaymentAmount(nextLines.reduce((value, line) => value + (Number(line.packs) || 0) * Number(line.price || 0), 0))
    }
  }
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    try {
      const savedCustomer = customers.find((customer) => customer.id === customerId)
      if (productsQuery.isLoading || productsQuery.isError) {
        throw new Error('Product stock is unavailable. Reload stock before completing a sale.')
      }
      if (!hasSellableStock) throw new Error('There is no sellable stock available for this sale.')
      if (hasInsufficientStock) throw new Error('The requested quantity exceeds available stock. Reduce the quantity or choose another product.')
      const saleLines = lines.map((line) => {
        const packs = Number(line.packs)
        if (!Number.isSafeInteger(packs) || packs < 1) throw new Error('Enter a positive whole-number quantity for every product.')
        const product = activeProducts.find((item) => item.id === line.productId)
        if (!product) throw new Error('Choose an active priced product with valid pack details for every line.')
        const catalogPrice = product.price ?? 0
        const selectedPrice = Number(line.price)
        if (!Number.isInteger(selectedPrice) || selectedPrice <= 0) throw new Error('Enter a positive whole-UGX price per pack.')
        if (selectedPrice !== catalogPrice && !line.reason.trim()) throw new Error(`Provide a reason for the ${product.name} price override.`)
        return {
          productId: product.id,
          packs,
          ...(selectedPrice !== catalogPrice ? { pricePerPack: selectedPrice, overrideReason: line.reason.trim() } : {}),
        }
      })
      const termsToSubmit = guest ? 'Paid now' : terms
      const amountToSubmit = guest || termsToSubmit === 'Paid now' ? total : paymentAmount
      if (termsToSubmit === 'Credit' && !dueDate) throw new Error('Select a due date for a credit sale.')
      if (amountToSubmit > total) throw new Error('Initial payment cannot exceed the sale total.')
      if (amountToSubmit < total && !savedCustomer) throw new Error('One-time customer sales must be paid in full at the time of sale.')
      if (bonusDisabled && !bonusDisabledReason.trim()) throw new Error('Provide a reason for disabling the sales bonus.')
      setSalePending(true)
      return await onSubmit({
        customerId: savedCustomer?.id,
        guest: savedCustomer ? undefined : { name: guestName.trim() || 'Walk-in customer', phone: guestPhone.trim(), email: guestEmail.trim() },
        lines: saleLines,
        paymentTerms: termsToSubmit,
        dueDate: termsToSubmit === 'Credit' ? dueDate : undefined,
        initialPaymentAmount: amountToSubmit,
        initialPaymentMethod: amountToSubmit ? method : undefined,
        idempotencyKey: idempotencyKey.current,
        ...(bonusDisabled ? { bonusDisabled: true, bonusDisabledReason: bonusDisabledReason.trim() } : {}),
      })
    } catch (caught) {
      setError(errorMessage(caught))
      return undefined
    } finally {
      setSalePending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/40 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="sale-form-title" className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <div><h2 id="sale-form-title" className="font-bold">Record sale</h2><p className="mt-1 text-xs text-slate-500">Product prices and totals are verified by the server.</p></div>
          <button type="button" aria-label="Close sale form" disabled={salePending} onClick={onCancel} className="rounded-md p-1.5 text-slate-400"><X className="size-4" /></button>
        </header>
        <form onSubmit={(event) => { void submit(event) }} className="space-y-5 p-5">
          <section className="grid gap-3 sm:grid-cols-2">
            <div className="text-xs font-semibold text-slate-600">
              <label htmlFor="sale-customer">Customer</label>
              <div ref={customerPickerRef} className="relative mt-1.5">
                <input
                  id="sale-customer"
                  type="text"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={customerMenuOpen}
                  aria-controls={customerMenuOpen ? 'sale-customer-options' : undefined}
                  aria-activedescendant={customerMenuOpen ? `sale-customer-option-${activeCustomerOption}` : undefined}
                  autoComplete="off"
                  disabled={salePending}
                  value={customerMenuOpen ? customerSearch : customerId ? selectedCustomer?.name ?? '' : 'Walk-in / one-time customer'}
                  onFocus={() => { setCustomerSearch(''); setCustomerMenuOpen(true); setActiveCustomerOption(0) }}
                  onChange={(event) => { setCustomerSearch(event.target.value); setCustomerMenuOpen(true); setActiveCustomerOption(0) }}
                  onKeyDown={handleCustomerKeyDown}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                {customerMenuOpen && <div id="sale-customer-options" role="listbox" aria-label="Customer options" className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                  <div
                    id="sale-customer-option-0"
                    role="option"
                    aria-selected={activeCustomerOption === 0}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveCustomerOption(0)}
                    onClick={() => selectCustomer('')}
                    className={`cursor-pointer rounded-md px-3 py-2.5 text-xs font-medium ${activeCustomerOption === 0 ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                  >Walk-in / one-time customer</div>
                  {customerOptions.map((customer, index) => {
                    const optionIndex = index + 1
                    return <div
                      key={customer.id}
                      id={`sale-customer-option-${optionIndex}`}
                      role="option"
                      aria-selected={activeCustomerOption === optionIndex}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActiveCustomerOption(optionIndex)}
                      onClick={() => selectCustomer(customer.id)}
                      className={`cursor-pointer rounded-md px-3 py-2.5 text-xs font-medium ${activeCustomerOption === optionIndex ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                    >{customer.name}</div>
                  })}
                  {customerOptions.length === 0 && customerSearch.trim() && <p role="status" className="px-3 py-2.5 text-xs font-normal text-slate-400">No matching saved customers. Choose walk-in or try another search.</p>}
                </div>}
              </div>
            </div>
            {guest && <label className="text-xs font-semibold text-slate-600">Receipt name <span className="font-normal text-slate-400">Optional</span><input value={guestName} onChange={(event) => setGuestName(event.target.value)} maxLength={180} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" /></label>}
            {guest && <label className="text-xs font-semibold text-slate-600">Phone <span className="font-normal text-slate-400">Optional</span><input type="tel" value={guestPhone} onChange={(event) => setGuestPhone(event.target.value)} maxLength={40} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" /></label>}
            {guest && <label className="text-xs font-semibold text-slate-600">Email <span className="font-normal text-slate-400">Optional</span><input type="email" value={guestEmail} onChange={(event) => setGuestEmail(event.target.value)} maxLength={254} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" /></label>}
          </section>
          {!customersAvailable && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">Saved customer profiles are unavailable. You can proceed with a fully paid walk-in sale. <button type="button" onClick={onRetryCustomers} className="font-semibold underline">Retry customer loading</button></p>}

          <section>
            <div className="mb-3 flex items-center justify-between"><h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">Products</h3><button type="button" disabled={salePending} onClick={() => changeTermTotal([...lines, { key: createId('LINE'), productId: '', packs: '1', price: '', reason: '' }])} className="inline-flex items-center gap-1 text-xs font-semibold text-primary"><Plus className="size-3.5" /> Add product</button></div>
            {productsQuery.isLoading && <p role="status" className="text-xs text-slate-500">Loading product prices…</p>}
            {productsQuery.isError && <p role="alert" className="text-xs text-rose-700">{errorMessage(productsQuery.error)} <button type="button" onClick={() => void productsQuery.refetch()} className="font-semibold underline">Retry</button></p>}
            {!productsQuery.isLoading && activeProducts.length === 0 && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">No active products have a catalog price and valid outer-pack size. Configure product price and packaging in Production Management before recording sales.</p>}
            {!productsQuery.isLoading && !productsQuery.isError && activeProducts.length > 0 && !hasSellableStock && <p role="alert" className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-900">There is no sellable stock available. Restock a product before recording a sale.</p>}
            <div className="space-y-3">{lines.map((line, index) => {
              const product = activeProducts.find((item) => item.id === line.productId)
              const availablePacks = product ? availablePacksFor(product.id) : 0
              const otherRequestedPacks = lines.reduce((totalPacks, item) =>
                item.productId === line.productId && item.key !== line.key ? totalPacks + (Number(item.packs) || 0) : totalPacks,
              0)
              const lineStockExceeded = Boolean(product && (requestedPacksByProduct.get(product.id) ?? 0) > availablePacks)
              const catalogPrice = product?.price ?? 0
              const overridden = Boolean(product && Number(line.price) !== catalogPrice)
              return <div key={line.key} className="grid items-end gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[minmax(0,1fr)_90px_145px_36px]">
                <label className="text-xs font-semibold text-slate-600">Product
                  <select required value={line.productId} disabled={salePending} onChange={(event) => changeProduct(line.key, event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm">
                    <option value="">Choose product</option>
                    {activeProducts.map((item) => {
                      const available = availablePacksFor(item.id)
                      return <option key={item.id} value={item.id} disabled={available === 0}>{item.name} · {item.packType} · {money(item.price ?? 0)}/pack · {available > 0 ? `${available} available` : 'Out of stock'}</option>
                    })}
                  </select>
                  {product && <span className="mt-1 block text-[10px] font-normal text-slate-400">Available: {availablePacks.toLocaleString()} {packUnitLabel(product.packType, availablePacks)} · {product.loosePieces ?? 0} loose pieces not sellable</span>}
                </label>
                <label className="text-xs font-semibold text-slate-600">Quantity ({packUnitLabel(product?.packType)})<input required type="number" min="1" max={Math.max(1, availablePacks - otherRequestedPacks)} step="1" value={line.packs} disabled={salePending || !product || availablePacks === 0} onChange={(event) => changeTermTotal(lines.map((item) => item.key === line.key ? { ...item, packs: event.target.value } : item))} className="mt-1.5 w-full rounded-lg border border-slate-200 px-2 py-2.5 text-sm disabled:bg-slate-50" /></label>
                <label className="text-xs font-semibold text-slate-600">Price / {packUnitLabel(product?.packType, 1)} (UGX)<input required type="number" min="1" step="1" value={line.price} disabled={salePending || !canOverridePrice} onChange={(event) => setLines((current) => current.map((item) => item.key === line.key ? { ...item, price: event.target.value } : item))} className="mt-1.5 w-full rounded-lg border border-slate-200 px-2 py-2.5 text-sm disabled:bg-slate-50" /></label>
                <button type="button" aria-label={`Remove product ${index + 1}`} disabled={salePending || lines.length === 1} onClick={() => changeTermTotal(lines.filter((item) => item.key !== line.key))} className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-30"><X className="size-4" /></button>
                {overridden && <label className="text-xs font-semibold text-amber-800 sm:col-span-4">Reason for price override<input required value={line.reason} disabled={salePending} onChange={(event) => setLines((current) => current.map((item) => item.key === line.key ? { ...item, reason: event.target.value } : item))} maxLength={500} className="mt-1.5 w-full rounded-lg border border-amber-200 px-3 py-2 text-sm" /></label>}
                {lineStockExceeded && <p role="alert" className="text-xs font-medium text-rose-700 sm:col-span-4">Requested quantity exceeds available stock ({availablePacks} {packUnitLabel(product?.packType, availablePacks)} available).</p>}
                <div className="text-right text-xs text-slate-500 sm:col-span-4">Line total: <strong className="text-slate-800">{money((Number(line.packs) || 0) * Number(line.price || 0))}</strong></div>
              </div>
            })}</div>
            <div className="mt-3 flex justify-end border-t border-slate-100 pt-3 text-sm font-bold">Sale total: <span className="ml-2 text-primary">{money(total)}</span></div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-600">Payment terms
              <select value={guest ? 'Paid now' : terms} disabled={guest || salePending} onChange={(event) => setTerm(event.target.value as typeof terms)} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm">
                <option value="Paid now">Paid now</option><option value="Same-day">Same-day</option><option value="Credit">Credit</option>
              </select>
              {guest && <span className="mt-1 block text-[10px] font-normal text-slate-400">One-time customers must pay in full at sale.</span>}
            </label>
            {terms === 'Credit' && !guest && <label className="text-xs font-semibold text-slate-600">Credit due date<input required type="date" min={todayValue} value={dueDate} disabled={salePending} onChange={(event) => setDueDate(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" /></label>}
            <label className="text-xs font-semibold text-slate-600">Initial payment (UGX)<input type="number" min="0" step="1" value={guest || terms === 'Paid now' ? total : paymentAmount} disabled={guest || terms === 'Paid now' || salePending} onChange={(event) => setPaymentAmount(Math.max(0, Number(event.target.value)))} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm disabled:bg-slate-50" /></label>
            {(guest || terms === 'Paid now' || paymentAmount > 0) && <label className="text-xs font-semibold text-slate-600">Payment method<select value={method} disabled={salePending} onChange={(event) => setMethod(event.target.value as SalePayment['method'])} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm">{paymentMethods.map((item) => <option key={item}>{item}</option>)}</select></label>}
          </section>
          <section className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-xs font-bold text-emerald-900">Sales bonus preview</h3>
                <p className="mt-1 text-xs leading-5 text-emerald-800">
                  {eligibleBoxQuantity.toLocaleString()} eligible box packs · {bonusPreview.toLocaleString()} free boxes
                </p>
                <p className="mt-1 text-[10px] leading-4 text-emerald-700">Carton packs do not qualify for this bonus.</p>
              </div>
              {canDisableBonus && (
                <label className="flex min-h-11 items-center gap-2 text-xs font-semibold text-slate-700">
                  <input type="checkbox" checked={bonusDisabled} disabled={salePending} onChange={(event) => { setBonusDisabled(event.target.checked); if (!event.target.checked) setBonusDisabledReason('') }} className="size-4 accent-primary" />
                  Disable bonus
                </label>
              )}
            </div>
            {bonusDisabled && (
              <label className="mt-3 block text-xs font-semibold text-slate-700">
                Reason for disabling the bonus
                <textarea required value={bonusDisabledReason} disabled={salePending} onChange={(event) => setBonusDisabledReason(event.target.value)} maxLength={500} rows={3} className="mt-1.5 w-full rounded-lg border border-amber-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="Explain why this sale does not receive the bonus" />
              </label>
            )}
          </section>
          {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
          <footer className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" disabled={salePending} onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold">Cancel</button><button type="submit" disabled={salePending || stockUnavailable || !activeProducts.length || hasInsufficientStock} className="rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">{salePending ? 'Saving sale…' : 'Complete sale'}</button></footer>
        </form>
      </section>
    </div>
  )
}

export default function SalesManagementPage({
  mode,
  state,
  currentUser,
  salesLoading,
  salesError,
  salesWarning,
  onRetrySales,
  onSaleUpdated,
  companyName,
  companyLogoUrl,
  customersAvailable,
  onRetryCustomers,
}: Props) {
  const [search, setSearch] = useState('')
  const [salesPeriod, setSalesPeriod] = useState<SalesPeriod>('today')
  const [salesPeriodMenuOpen, setSalesPeriodMenuOpen] = useState(false)
  const [creditActionMenuFor, setCreditActionMenuFor] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null)
  const [paymentSale, setPaymentSale] = useState<Sale | null>(null)
  const [paymentError, setPaymentError] = useState('')
  const [paymentSaving, setPaymentSaving] = useState(false)
  const [creditView, setCreditView] = useState<'outstanding' | 'due-soon' | 'overdue' | 'settled' | 'review'>('outstanding')
  const [reviewSale, setReviewSale] = useState<Sale | null>(null)
  const [reviewDueDate, setReviewDueDate] = useState('')
  const [reviewOwner, setReviewOwner] = useState('')
  const [reviewCustomerId, setReviewCustomerId] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [reviewSaving, setReviewSaving] = useState(false)
  const [statementCustomerId, setStatementCustomerId] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsDraft, setSettingsDraft] = useState({ daysBeforeDue: '7, 1, 0', daysAfterDue: '1, 3, 7', repeatOverdueEveryDays: '7', escalateAfterDays: '7' })
  const [settingsError, setSettingsError] = useState('')
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [pendingOrderMessage, setPendingOrderMessage] = useState('')
  const queryClient = useQueryClient()
  const salesPeriodMenuRef = useRef<HTMLDivElement>(null)
  const creditActionMenuRef = useRef<HTMLDivElement>(null)
  const [paymentDraft, setPaymentDraft] = useState<SalePaymentDraft>({ amount: 0, date: today(), method: 'Cash', txnID: '', note: '' })
  const paymentKey = useRef({ saleId: '', value: createId('PAY') })
  useEffect(() => {
    if (!salesPeriodMenuOpen) return
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !salesPeriodMenuRef.current?.contains(event.target)) setSalesPeriodMenuOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSalesPeriodMenuOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [salesPeriodMenuOpen])
  useEffect(() => {
    if (!creditActionMenuFor) return
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !creditActionMenuRef.current?.contains(event.target)) {
        setCreditActionMenuFor(null)
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCreditActionMenuFor(null)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [creditActionMenuFor])
  const canCreate = currentUser.roles.some((role) => ['Sales Manager', 'General Manager', 'Super Admin'].includes(role))
  const pendingOrdersQuery = useQuery({
    queryKey: ['sales-pending-orders'],
    queryFn: listOrders,
    enabled: mode === 'sales',
  })
  const pendingOrders = (pendingOrdersQuery.data ?? [])
    .filter((order) => order.status === 'Pending' && !order.archivedAt && !order.legacyImported)
    .sort((left, right) => {
      if (left.priority !== right.priority) return left.priority === 'High' ? -1 : 1
      return left.createdAt.localeCompare(right.createdAt)
    })
  const confirmOrderMutation = useMutation({
    mutationFn: (orderId: string) => confirmOrder(orderId),
    onSuccess: async (order) => {
      setPendingOrderMessage(`${order.reference} confirmed and stock reserved.`)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['sales-pending-orders'] }),
        queryClient.invalidateQueries({ queryKey: productQueryKey }),
      ])
    },
    onError: (error: Error) => setPendingOrderMessage(errorMessage(error)),
  })
  const stockProductsQuery = useQuery({
    queryKey: productQueryKey,
    queryFn: listProductionProducts,
    enabled: mode === 'sales',
  })
  const stockProducts = stockProductsQuery.data?.products ?? []
  const productsWithAvailableStock = stockProducts.filter((product) => product.active
    && (product.availablePacks ?? Math.max(0, product.balancePacks - (product.reservedPacks ?? 0))) > 0).length
  const visibleSales = useMemo(() => state.sales.filter((sale) => {
    const searchable = `${sale.reference} ${sale.customer} ${sale.product} ${sale.lines?.map((line) => line.productName).join(' ') ?? ''}`.toLowerCase()
    if (!searchable.includes(search.toLowerCase())) return false
    if (mode === 'credit') return sale.paymentTerms === 'Credit'
    return true
  }).sort((left, right) => right.date.localeCompare(left.date)), [state, search, mode])
  const outstandingSales = visibleSales.filter((sale) => paidAmountForSale(sale.id, state.payments) < sale.total)
  const overdueSales = outstandingSales.filter((sale) => Boolean(sale.dueDate && sale.dueDate < today()))
  const paidSales = visibleSales.filter((sale) => paidAmountForSale(sale.id, state.payments) >= sale.total)
  const salesOwners = useQuery({
    queryKey: ['sales-owners'],
    queryFn: listSalesOwners,
    enabled: mode === 'credit',
  })
  const reminderSettings = useQuery({
    queryKey: ['credit-reminder-settings'],
    queryFn: getCreditReminderSettings,
    enabled: mode === 'credit' && currentUser.roles.some((role) => ['General Manager', 'Super Admin'].includes(role)),
  })
  const customerStatement = useQuery({
    queryKey: ['credit-statement', statementCustomerId],
    queryFn: () => getCreditCustomerStatement(statementCustomerId),
    enabled: Boolean(statementCustomerId),
  })
  const todayDate = today()
  const periodStartDate = salesPeriodStart(salesPeriod, todayDate)
  const periodSalesTotal = sum(state.sales
    .filter((sale) => {
      const saleDate = sale.date.slice(0, 10)
      return saleDate >= periodStartDate && saleDate <= todayDate
    })
    .map((sale) => sale.total))
  const dueSoonWindow = Math.max(...(reminderSettings.data?.settings.daysBeforeDue ?? [7]))
  const dueSoonSales = outstandingSales.filter((sale) =>
    Boolean(sale.dueDate && sale.dueDate >= todayDate && sale.dueDate <= new Date(Date.parse(`${todayDate}T00:00:00.000Z`) + dueSoonWindow * 86400000).toISOString().slice(0, 10)),
  )
  const needsReviewSales = visibleSales.filter((sale) => sale.creditNeedsReview || !sale.customerId || !sale.dueDate || !sale.assignedTo)
  const creditTabs = [
    { id: 'outstanding' as const, label: 'Outstanding', count: outstandingSales.length },
    { id: 'due-soon' as const, label: 'Due soon', count: dueSoonSales.length },
    { id: 'overdue' as const, label: 'Overdue', count: overdueSales.length },
    { id: 'settled' as const, label: 'Settled', count: paidSales.length },
    { id: 'review' as const, label: 'Needs review', count: needsReviewSales.length },
  ]
  const creditSalesForView = mode !== 'credit' ? visibleSales : (
    creditView === 'due-soon' ? dueSoonSales :
      creditView === 'overdue' ? overdueSales :
        creditView === 'settled' ? paidSales :
          creditView === 'review' ? needsReviewSales : outstandingSales
  )
  const submitCreditReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!reviewSale) return
    setReviewSaving(true)
    setReviewError('')
    try {
      const updated = await updateCreditSale(reviewSale.id, {
        customerId: reviewCustomerId || undefined,
        dueDate: reviewDueDate || undefined,
        assignedTo: reviewOwner || null,
      })
      onSaleUpdated(updated, state.payments.filter((payment) => payment.saleId === updated.id))
      setReviewSale(null)
    } catch (error) {
      setReviewError(errorMessage(error))
    } finally {
      setReviewSaving(false)
    }
  }

  const saveReminderSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSettingsSaving(true)
    setSettingsError('')
    try {
      const parseThresholds = (value: string) => {
        const parts = value.split(',').map((item) => item.trim())
        if (parts.some((item) => !/^\d+$/.test(item))) throw new Error('Enter comma-separated whole numbers for reminder days.')
        const values = parts.map(Number)
        if (!values.length || values.length > 10 || new Set(values).size !== values.length) {
          throw new Error('Provide between 1 and 10 distinct reminder days.')
        }
        return values
      }
      const daysBeforeDue = parseThresholds(settingsDraft.daysBeforeDue)
      const daysAfterDue = parseThresholds(settingsDraft.daysAfterDue)
      await updateCreditReminderSettings({
        daysBeforeDue,
        daysAfterDue,
        repeatOverdueEveryDays: Number(settingsDraft.repeatOverdueEveryDays),
        escalateAfterDays: Number(settingsDraft.escalateAfterDays),
      })
      await queryClient.invalidateQueries({ queryKey: ['credit-reminder-settings'] })
      setSettingsOpen(false)
    } catch (error) {
      setSettingsError(errorMessage(error))
    } finally {
      setSettingsSaving(false)
    }
  }

  const submitSale = async (input: Parameters<typeof createSale>[0]) => {
    const result = await createSale(input)
    if (!result.sale.receiptNumber) throw new ApiError('Sale was not completed because the server did not return its receipt number.', 502)
    onSaleUpdated(result.sale, result.payments)
    setShowForm(false)
    setReceiptSale(result.sale)
    return result.sale
  }

  const submitPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!paymentSale) return
    setPaymentSaving(true)
    setPaymentError('')
    try {
      const result = await recordSalePayment(paymentSale.id, {
        amount: paymentDraft.amount,
        date: paymentDraft.date,
        method: paymentDraft.method,
        txnID: paymentDraft.txnID || undefined,
        note: paymentDraft.note || undefined,
        idempotencyKey: paymentKey.current.value,
      })
      const updatedSale = {
        ...paymentSale,
        paidAmount: result.payments.reduce((total, payment) => total + payment.amount, 0),
        status: result.payments.reduce((total, payment) => total + payment.amount, 0) >= paymentSale.total ? 'Paid' as const : 'Pending' as const,
        payments: result.payments,
      }
      onSaleUpdated(updatedSale, result.payments)
      setPaymentSale(null)
      paymentKey.current.value = createId('PAY')
      setPaymentDraft({ amount: 0, date: today(), method: 'Cash', txnID: '', note: '' })
    } catch (error) {
      setPaymentError(errorMessage(error))
    } finally {
      setPaymentSaving(false)
    }
  }

  if (salesLoading) return <section role="status" className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Loading sales from the server…</section>
  if (salesError) return <section role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800"><h2 className="font-semibold">Sales data could not be loaded</h2><p className="mt-2">{salesError}</p><button type="button" onClick={onRetrySales} className="mt-3 rounded-lg border border-rose-300 px-3 py-2 text-xs font-semibold">Retry</button></section>

  return (
    <div className="animate-in fade-in duration-300">
      <header className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><div className="mb-2 text-xs font-medium text-slate-400">Workspace / Sales Department</div><h2 className="text-2xl font-bold tracking-tight">{mode === 'credit' ? 'Credit Sales' : 'Sales'}</h2><p className="mt-1 text-sm text-slate-500">{mode === 'credit' ? 'Track outstanding customer balances and record repayments.' : 'Record catalog-priced sales, dispatch finished stock, and issue receipts.'}</p></div>
        <div className="flex gap-2"><button type="button" onClick={() => exportCsv(mode === 'credit' ? 'credit-sales.csv' : 'sales.csv', visibleSales.map((sale) => ({ reference: sale.receiptNumber || sale.reference, customer: sale.customer, date: sale.date, products: sale.product, total: sale.total, paid: paidAmountForSale(sale.id, state.payments), balance: Math.max(0, sale.total - paidAmountForSale(sale.id, state.payments)), paymentTerms: sale.paymentTerms }))) } className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold"><Download className="size-4" /> Export CSV</button>{mode === 'sales' && canCreate && <button type="button" onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"><Plus className="size-4" /> Add sale</button>}</div>
      </header>
      {salesWarning && <p role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">{salesWarning}</p>}
      {mode === 'sales' ? <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="text-xs text-slate-500">Sales {salesPeriodLabels[salesPeriod].toLowerCase()}</div>
            <div ref={salesPeriodMenuRef} className="relative -mt-1 -mr-1">
              <button
                type="button"
                aria-label={`Sales period: ${salesPeriodLabels[salesPeriod]}`}
                aria-haspopup="menu"
                aria-expanded={salesPeriodMenuOpen}
                onClick={() => setSalesPeriodMenuOpen((open) => !open)}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
              >
                {salesPeriodLabels[salesPeriod]} <ChevronDown className={`size-3 transition-transform ${salesPeriodMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {salesPeriodMenuOpen && <div role="menu" aria-label="Sales period" className="absolute right-0 z-20 mt-1 min-w-32 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                {(Object.keys(salesPeriodLabels) as SalesPeriod[]).map((period) => (
                  <button
                    key={period}
                    type="button"
                    role="menuitem"
                    aria-current={salesPeriod === period ? 'true' : undefined}
                    onClick={() => { setSalesPeriod(period); setSalesPeriodMenuOpen(false) }}
                    className={`w-full rounded-md px-3 py-2 text-left text-xs font-medium ${salesPeriod === period ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                  >{salesPeriodLabels[period]}</button>
                ))}
              </div>}
            </div>
          </div>
          <div className="mt-1 font-bold">{money(periodSalesTotal)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-500">Outstanding balance</div><div className="mt-1 font-bold">{money(sum(state.sales.map((sale) => Math.max(0, sale.total - paidAmountForSale(sale.id, state.payments)))))}</div></div>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-2"><h3 className="text-xs font-semibold text-slate-600">Total pending orders</h3><span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-semibold uppercase text-amber-700">Awaiting confirmation</span></div>
          {pendingOrdersQuery.isLoading ? <p role="status" className="mt-2 text-[10px] text-slate-400">Loading pending orders…</p>
            : pendingOrdersQuery.isError ? <div className="mt-2"><p role="alert" className="text-[10px] text-rose-700">Pending orders could not be loaded.</p><button type="button" onClick={() => { void pendingOrdersQuery.refetch() }} className="mt-1 text-[10px] font-semibold text-primary hover:underline">Retry</button></div>
              : <><p className="mt-1 text-lg font-bold tabular-nums text-slate-900">{pendingOrders.length} <span className="text-xs font-medium text-slate-500">{pendingOrders.length === 1 ? 'order' : 'orders'}</span></p>
                <ul aria-label="Pending order requiring attention" className="mt-2 max-h-28 space-y-2 overflow-y-auto border-t border-slate-100 pt-2">
                  {pendingOrders.length ? pendingOrders.slice(0, 1).map((order) => <li key={order.id} className="flex items-center justify-between gap-2 text-[10px]">
                    <span className="min-w-0"><span className="block truncate font-semibold text-slate-700">{order.customer}</span><span className="block truncate text-slate-400">{order.reference} · requested {formatDate(order.requestedDate)}{order.priority === 'High' ? ' · High priority' : ''}</span></span>
                    {canCreate && <button type="button" disabled={confirmOrderMutation.isPending} onClick={() => { setPendingOrderMessage(''); confirmOrderMutation.mutate(order.id) }} className="shrink-0 rounded-md bg-emerald-50 px-2 py-1.5 font-semibold text-emerald-800 hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-50">{confirmOrderMutation.isPending && confirmOrderMutation.variables === order.id ? 'Confirming…' : 'Confirm'}</button>}
                  </li>) : <li className="py-1 text-[10px] text-slate-400">No orders are awaiting confirmation.</li>}
                </ul>
                {!canCreate && pendingOrders.length > 0 && <p className="mt-2 text-[10px] text-slate-400">A sales manager can confirm these orders.</p>}
                {pendingOrderMessage && <p role={confirmOrderMutation.isError ? 'alert' : 'status'} className={`mt-2 border-t border-slate-100 pt-2 text-[10px] ${confirmOrderMutation.isError ? 'text-rose-700' : 'text-emerald-700'}`}>{pendingOrderMessage}</p>}
              </>}
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-2"><h3 className="text-xs font-semibold text-slate-600">Product stock availability</h3><span className="rounded-full bg-sky-50 px-2 py-0.5 text-[9px] font-semibold uppercase text-sky-700">Live</span></div>
          {stockProductsQuery.isLoading ? <p role="status" className="mt-2 text-[10px] text-slate-400">Loading product stock…</p>
            : stockProductsQuery.isError ? <div className="mt-2"><p role="alert" className="text-[10px] text-rose-700">Product stock could not be loaded.</p><button type="button" onClick={() => { void stockProductsQuery.refetch() }} className="mt-1 text-[10px] font-semibold text-primary hover:underline">Retry</button></div>
              : <><p className="mt-1 text-lg font-bold tabular-nums text-slate-900">{productsWithAvailableStock.toLocaleString()} <span className="text-xs font-medium text-slate-500">products with stock</span></p><ul aria-label="Available stock by product" className="mt-2 max-h-24 space-y-1 overflow-y-auto border-t border-slate-100 pt-2">{stockProducts.length ? stockProducts.map((product) => {
                const available = product.availablePacks ?? Math.max(0, product.balancePacks - (product.reservedPacks ?? 0))
                return <li key={product.id} className="flex items-center justify-between gap-2 text-[10px]"><span className="min-w-0 truncate font-medium text-slate-600">{product.name}{!product.active ? ' · inactive' : ''}</span><span className={`shrink-0 font-semibold tabular-nums ${available > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>{available.toLocaleString()} {packUnitLabel(product.packType, available)}</span></li>
              }) : <li className="text-[10px] text-slate-400">No products found</li>}</ul></>}
        </article>
      </section> : <section className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-500">Outstanding credit</div><div className="mt-1 font-bold">{money(sum(outstandingSales.map((sale) => Math.max(0, sale.total - paidAmountForSale(sale.id, state.payments)))))}</div></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-500">Overdue credit sales</div><div className="mt-1 font-bold">{overdueSales.length}</div></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-500">Settled credit sales</div><div className="mt-1 font-bold">{paidSales.length}</div></div>
      </section>}
      {mode === 'credit' && <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1 border-b border-slate-200">{creditTabs.map((tab) => <button key={tab.id} type="button" aria-pressed={creditView === tab.id} onClick={() => setCreditView(tab.id)} className={`border-b-2 px-3 py-2 text-xs font-semibold ${creditView === tab.id ? 'border-[#6d28d9] text-[#6d28d9]' : 'border-transparent text-slate-500'}`}>{tab.label}<span className="ml-2 text-slate-400">{tab.count}</span></button>)}</div>
        <div className="flex items-center gap-2"><label className="text-xs font-semibold text-slate-600">Customer statement
          <select value={statementCustomerId} onChange={(event) => setStatementCustomerId(event.target.value)} className="ml-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs">
            <option value="">Choose customer</option>{[...new Map(visibleSales.filter((sale) => sale.customerId).map((sale) => [sale.customerId!, sale.customer])).entries()].map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>{currentUser.roles.some((role) => ['General Manager', 'Super Admin'].includes(role)) && <button type="button" onClick={() => { const settings = reminderSettings.data?.settings; if (settings) setSettingsDraft({ daysBeforeDue: settings.daysBeforeDue.join(', '), daysAfterDue: settings.daysAfterDue.join(', '), repeatOverdueEveryDays: String(settings.repeatOverdueEveryDays), escalateAfterDays: String(settings.escalateAfterDays) }); setSettingsOpen(true) }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold">Reminder settings</button>}</div>
      </div>}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-4"><label className="flex max-w-md items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><Search className="size-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search receipt, customer, or product" className="w-full bg-transparent text-xs outline-none" /></label></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase text-slate-400"><tr>{(mode === 'credit' ? ['Receipt No.', 'Date', 'Due date', 'Customer', 'Owner', 'Products', 'Total', 'Paid / balance', 'Payment status', 'Actions'] : ['Receipt No.', 'Date', 'Customer', 'Products', 'Total', 'Paid / balance', 'Payment status', 'Actions']).map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>
          {creditSalesForView.map((sale) => {
            const paid = paidAmountForSale(sale.id, state.payments)
            const balance = Math.max(0, sale.total - paid)
            const productNames = sale.lines?.map((line) => `${line.productName} × ${line.packs} ${line.packType}`).join(', ') || sale.product
            return <tr key={sale.id} className="border-t border-slate-100 text-slate-600"><td className="px-4 py-3 font-semibold text-slate-800">{sale.receiptNumber || sale.reference}</td><td className="px-4 py-3">{formatDate(sale.date)}</td>{mode === 'credit' && <td className={`px-4 py-3 ${sale.dueDate && sale.dueDate < todayDate && balance > 0 ? 'font-semibold text-rose-700' : ''}`}>{sale.dueDate ? formatDate(sale.dueDate) : 'Needs review'}</td>}<td className="px-4 py-3">{sale.customer}</td>{mode === 'credit' && <td className="px-4 py-3">{salesOwners.data?.find((owner) => owner.id === sale.assignedTo)?.name || 'Unassigned'}</td>}<td className="max-w-72 truncate px-4 py-3" title={productNames}>{productNames}</td><td className="px-4 py-3 font-semibold">{money(sale.total)}</td><td className="px-4 py-3">{money(paid)} / {money(balance)}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${balance ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{paymentStateForSale(sale, state.payments)}</span></td><td className="px-4 py-3">
              {mode === 'credit' ? <div ref={creditActionMenuFor === sale.id ? creditActionMenuRef : null} className="relative flex justify-end">
                <button
                  type="button"
                  aria-label={`Actions for credit sale ${sale.reference}`}
                  aria-haspopup="menu"
                  aria-expanded={creditActionMenuFor === sale.id}
                  onClick={() => setCreditActionMenuFor((current) => current === sale.id ? null : sale.id)}
                  className="grid size-8 place-items-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                ><Ellipsis className="size-4" /></button>
                {creditActionMenuFor === sale.id && <div role="menu" aria-label={`Actions for credit sale ${sale.reference}`} className="absolute right-0 top-full z-30 mt-1 min-w-44 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
                  <button type="button" role="menuitem" onClick={() => { setCreditActionMenuFor(null); setReceiptSale(sale) }} className="w-full rounded-md px-3 py-2 text-left text-xs font-medium hover:bg-slate-50">View receipt</button>
                  {(sale.creditNeedsReview || !sale.dueDate || !sale.assignedTo) && <button type="button" role="menuitem" onClick={() => { setCreditActionMenuFor(null); setReviewSale(sale); setReviewDueDate(sale.dueDate || ''); setReviewOwner(sale.assignedTo || ''); setReviewCustomerId(sale.customerId || ''); setReviewError('') }} className="w-full rounded-md px-3 py-2 text-left text-xs font-medium hover:bg-slate-50">Review credit details</button>}
                  {balance > 0 && <button type="button" role="menuitem" onClick={() => { setCreditActionMenuFor(null); if (paymentKey.current.saleId !== sale.id) paymentKey.current = { saleId: sale.id, value: createId('PAY') }; setPaymentSale(sale); setPaymentDraft({ amount: balance, date: today(), method: 'Cash', txnID: '', note: '' }); setPaymentError('') }} className="w-full rounded-md px-3 py-2 text-left text-xs font-medium hover:bg-slate-50">Record payment</button>}
                </div>}
              </div> : <div className="flex gap-1">
                <button type="button" aria-label={`View receipt ${sale.reference}`} onClick={() => setReceiptSale(sale)} className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1.5"><Eye className="size-3.5" /> Receipt</button>
                {balance > 0 && <button type="button" onClick={() => { if (paymentKey.current.saleId !== sale.id) paymentKey.current = { saleId: sale.id, value: createId('PAY') }; setPaymentSale(sale); setPaymentDraft({ amount: balance, date: today(), method: 'Cash', txnID: '', note: '' }); setPaymentError('') }} className="rounded border border-slate-200 px-2 py-1.5">Record payment</button>}
              </div>}
            </td></tr>
          })}
        </tbody></table></div>
        {!visibleSales.length && <div className="py-14 text-center text-sm text-slate-500">No sales found.</div>}
      </section>
      {customerStatement.data && <div className="fixed inset-0 z-[72] grid place-items-center bg-slate-950/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setStatementCustomerId('') }}><section role="dialog" aria-modal="true" aria-label="Customer credit statement" className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl"><div className="flex items-start justify-between"><div><h2 className="font-bold">{customerStatement.data.customer.name} credit statement</h2><p className="mt-1 text-xs text-slate-500">Credit sales and payments recorded for this customer.</p></div><button type="button" aria-label="Close customer statement" onClick={() => setStatementCustomerId('')}><X className="size-4" /></button></div><div className="my-4 grid grid-cols-3 gap-2 text-xs"><div className="rounded bg-slate-50 p-3">Credit <strong className="mt-1 block">{money(customerStatement.data.summary.totalCredit)}</strong></div><div className="rounded bg-slate-50 p-3">Paid <strong className="mt-1 block">{money(customerStatement.data.summary.totalPaid)}</strong></div><div className="rounded bg-slate-50 p-3">Outstanding <strong className="mt-1 block">{money(customerStatement.data.summary.outstanding)}</strong></div></div><div className="divide-y divide-slate-100">{customerStatement.data.sales.map((sale) => <div key={sale.id} className="flex justify-between py-3 text-xs"><span>{sale.receiptNumber} · due {sale.dueDate ? formatDate(sale.dueDate) : 'Needs review'} · {sale.payments.length} payment(s)</span><strong>{money(sale.balance)} balance</strong></div>)}</div></section></div>}
      {customerStatement.isError && statementCustomerId && <p role="alert" className="mb-3 text-xs text-rose-700">Customer statement could not be loaded.</p>}
      {settingsOpen && <div className="fixed inset-0 z-[75] grid place-items-center bg-slate-950/40 p-4"><section role="dialog" aria-modal="true" aria-label="Credit reminder settings" className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"><h2 className="font-bold">Credit reminder thresholds</h2><p className="mt-1 text-xs text-slate-500">Days are measured in Africa/Kampala calendar time. Use comma-separated whole days.</p><form onSubmit={(event) => { void saveReminderSettings(event) }} className="mt-4 space-y-3"><label className="block text-xs font-semibold">Days before due<input required value={settingsDraft.daysBeforeDue} onChange={(event) => setSettingsDraft({ ...settingsDraft, daysBeforeDue: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /></label><label className="block text-xs font-semibold">Days overdue for alerts<input required value={settingsDraft.daysAfterDue} onChange={(event) => setSettingsDraft({ ...settingsDraft, daysAfterDue: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /></label><label className="block text-xs font-semibold">Weekly repeats after escalation (days)<input required type="number" min="1" max="90" value={settingsDraft.repeatOverdueEveryDays} onChange={(event) => setSettingsDraft({ ...settingsDraft, repeatOverdueEveryDays: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /></label><label className="block text-xs font-semibold">Escalate to General Managers after (days overdue)<input required type="number" min="1" max="365" value={settingsDraft.escalateAfterDays} onChange={(event) => setSettingsDraft({ ...settingsDraft, escalateAfterDays: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>{settingsError && <p role="alert" className="text-xs text-rose-700">{settingsError}</p>}<div className="flex justify-end gap-2"><button type="button" disabled={settingsSaving} onClick={() => setSettingsOpen(false)} className="rounded border border-slate-200 px-3 py-2 text-xs">Cancel</button><button type="submit" disabled={settingsSaving} className="rounded bg-primary px-3 py-2 text-xs text-primary-foreground">{settingsSaving ? 'Saving…' : 'Save settings'}</button></div></form></section></div>}
      {reviewSale && <div className="fixed inset-0 z-[75] grid place-items-center bg-slate-950/40 p-4"><section role="dialog" aria-modal="true" aria-label="Review credit sale" className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"><h2 className="font-bold">Review credit sale</h2><p className="mt-1 text-xs text-slate-500">{reviewSale.reference} · {reviewSale.customer}</p><form onSubmit={(event) => { void submitCreditReview(event) }} className="mt-4 space-y-3"><label className="block text-xs font-semibold">Customer<select required disabled={!customersAvailable} value={reviewCustomerId} onChange={(event) => setReviewCustomerId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"><option value="">Choose customer</option>{state.customers.filter((customer) => customer.status === 'Active').map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>{!customersAvailable && <div className="flex items-center justify-between rounded bg-amber-50 p-2 text-xs text-amber-800"><span>Saved customer data is unavailable.</span><button type="button" onClick={onRetryCustomers} className="font-semibold underline">Retry</button></div>}<label className="block text-xs font-semibold">Due date<input required type="date" value={reviewDueDate} onChange={(event) => setReviewDueDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /></label><label className="block text-xs font-semibold">Assigned owner<select value={reviewOwner} onChange={(event) => setReviewOwner(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"><option value="">Unassigned</option>{salesOwners.data?.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}</select></label>{reviewError && <p role="alert" className="text-xs text-rose-700">{reviewError}</p>}<div className="flex justify-end gap-2"><button type="button" disabled={reviewSaving} onClick={() => setReviewSale(null)} className="rounded border border-slate-200 px-3 py-2 text-xs">Cancel</button><button type="submit" disabled={reviewSaving || !customersAvailable} className="rounded bg-primary px-3 py-2 text-xs text-primary-foreground disabled:opacity-50">{reviewSaving ? 'Saving…' : 'Save review'}</button></div></form></section></div>}
      {showForm && <SaleForm customers={customersAvailable ? state.customers : []} customersAvailable={customersAvailable} onRetryCustomers={onRetryCustomers} user={currentUser} onCancel={() => setShowForm(false)} onSubmit={submitSale} />}
      {receiptSale && <SaleReceipt sale={receiptSale} companyName={state.companyProfile.tradingName || state.companyProfile.legalName} companyLogoUrl={state.companyProfile.logo.url} onClose={() => setReceiptSale(null)} />}
      {paymentSale && <div className="fixed inset-0 z-[75] grid place-items-center bg-slate-950/40 p-4"><section role="dialog" aria-modal="true" className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl"><div className="mb-4 flex items-start justify-between"><div><h2 className="font-bold">Record payment</h2><p className="mt-1 text-xs text-slate-500">{paymentSale.reference} · Balance {money(Math.max(0, paymentSale.total - paidAmountForSale(paymentSale.id, state.payments)))}</p></div><button type="button" aria-label="Close payment form" onClick={() => setPaymentSale(null)} className="rounded p-1 text-slate-400"><X className="size-4" /></button></div><form onSubmit={(event) => { void submitPayment(event) }} className="space-y-3"><label className="block text-xs font-semibold">Amount (UGX)<input required type="number" min="1" step="1" value={paymentDraft.amount} onChange={(event) => setPaymentDraft({ ...paymentDraft, amount: Number(event.target.value) })} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" /></label><label className="block text-xs font-semibold">Date<input required type="date" value={paymentDraft.date} onChange={(event) => setPaymentDraft({ ...paymentDraft, date: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" /></label><label className="block text-xs font-semibold">Method<select value={paymentDraft.method} onChange={(event) => setPaymentDraft({ ...paymentDraft, method: event.target.value as SalePayment['method'] })} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm">{paymentMethods.map((method) => <option key={method}>{method}</option>)}</select></label><label className="block text-xs font-semibold">Transaction ID <span className="font-normal text-slate-400">Optional</span><input value={paymentDraft.txnID} onChange={(event) => setPaymentDraft({ ...paymentDraft, txnID: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" /></label><label className="block text-xs font-semibold">Note <span className="font-normal text-slate-400">Optional</span><textarea value={paymentDraft.note} onChange={(event) => setPaymentDraft({ ...paymentDraft, note: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" /></label>{paymentError && <p role="alert" className="rounded bg-rose-50 p-2 text-xs text-rose-800">{paymentError}</p>}<div className="flex justify-end gap-2 pt-2"><button type="button" disabled={paymentSaving} onClick={() => setPaymentSale(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs">Cancel</button><button type="submit" disabled={paymentSaving} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">{paymentSaving ? 'Saving…' : 'Save payment'}</button></div></form></section></div>}
    </div>
  )
}
