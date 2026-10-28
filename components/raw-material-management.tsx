'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as Icons from 'lucide-react'
import { createId, exportCsv, exportLegacyRawMaterialMigration, formatDate, money } from '@/lib/erp'
import {
  adjustRawMaterialStock,
  configureRawMaterialLocation,
  createProductionMaterial,
  deleteProductionMaterial,
  listInventoryResponsibleUsers,
  listProductionMaterialMovements,
  listProductionMaterialReceipts,
  listProductionMaterialUsages,
  listProductionMaterials,
  listProductionProducts,
  listRawMaterialAlerts,
  postProductionMaterialUsage,
  receiveProductionMaterial,
  transferRawMaterialStock,
  updateProductionMaterial,
  updateProductionMaterialUsage,
  type ProductionMaterial,
  type ProductionMaterialUsageRecord,
  type ProductionProduct,
  type RawMaterialAlert,
  type RawMaterialLocationBalance,
  type RawMaterialMovementType,
  type RawMovementRecord,
} from '@/lib/user-api'

type View = 'Inventory' | 'Stock-in history' | 'Daily production use' | 'All movements' | 'Low stock'
type Dialog = 'material' | 'editMaterial' | 'deleteMaterial' | 'receipt' | 'adjustment' | 'transfer' | 'location' | null
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const validDateInput = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.toISOString().slice(0, 10) === value
}
const inputClass = 'mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 disabled:bg-slate-50 disabled:text-slate-400'
const queryKey = ['raw-material-inventory']

type PackagingLevelInput = { name: string; quantity: string }
type UsagePeriod = 'all' | 'today' | 'week' | 'month'

function usagePeriodRange(period: UsagePeriod) {
  const end = today()
  const date = new Date(`${end}T00:00:00.000Z`)
  if (period === 'today') return { from: end, to: end }
  if (period === 'week') {
    const weekday = date.getUTCDay() || 7
    date.setUTCDate(date.getUTCDate() - weekday + 1)
    return { from: date.toISOString().slice(0, 10), to: end }
  }
  if (period === 'month') return { from: `${end.slice(0, 7)}-01`, to: end }
  return { from: '', to: '' }
}

function packagingChoices(material?: ProductionMaterial) {
  if (!material) return []
  if (!material.packagingLevels?.length) {
    return [{ name: material.unit, baseUnitsPerPackage: 1 }]
  }
  let baseUnitsPerPackage = 1
  return material.packagingLevels.map((level) => {
    baseUnitsPerPackage *= level.quantity
    return { name: level.name, baseUnitsPerPackage }
  })
}

function describePackaging(material: ProductionMaterial) {
  const levels = material.packagingLevels ?? []
  let baseUnitsPerPackage = 1
  return levels.map((level, index) => {
    baseUnitsPerPackage *= level.quantity
    const contained = index === 0
      ? `${level.quantity.toLocaleString()} ${material.unit}`
      : `${level.quantity.toLocaleString()} ${levels[index - 1].name} = ${baseUnitsPerPackage.toLocaleString()} ${material.unit}`
    return `1 ${level.name} = ${contained}`
  }).join('; ')
}

function messageFor(error: unknown) {
  return error instanceof Error ? error.message : 'The request could not be completed.'
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-slate-600">{label}{children}</label>
}

function Metric({ label, value, detail, icon, tone }: { label: string; value: string; detail: string; icon: string; tone: 'purple' | 'amber' | 'rose' | 'blue' }) {
  const Icon = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[icon] ?? Icons.Boxes
  const color = tone === 'purple' ? 'bg-secondary text-primary' : tone === 'amber' ? 'bg-amber-50 text-amber-700' : tone === 'rose' ? 'bg-rose-50 text-rose-700' : 'bg-sky-50 text-sky-700'
  return <article className="rounded-lg border border-slate-200 bg-white p-4"><span className={`grid size-9 place-items-center rounded-md ${color}`}><Icon className="size-4" /></span><div className="mt-3 text-xl font-bold">{value}</div><h3 className="mt-0.5 text-xs font-semibold text-slate-700">{label}</h3><p className="mt-1 text-[10px] text-slate-500">{detail}</p></article>
}

function locationFor(material: ProductionMaterial, location: string) {
  return material.locations.find((item) => item.location === location)
}

function stockStatus(balance: RawMaterialLocationBalance) {
  return balance.quantity <= 0 ? 'Out of stock' : balance.quantity <= balance.reorderThreshold ? 'Low stock' : 'In stock'
}

function statusClass(status: string) {
  return status === 'In stock' ? 'bg-emerald-50 text-emerald-700' : status === 'Low stock' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
}

export default function RawMaterialManagement() {
  const client = useQueryClient()
  const [view, setView] = useState<View>('Inventory')
  const [search, setSearch] = useState('')
  const [locationFilter, setLocationFilter] = useState('All locations')
  const [movementFilter, setMovementFilter] = useState('All movement types')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [dialog, setDialog] = useState<Dialog>(null)
  const [selectedMaterial, setSelectedMaterial] = useState<ProductionMaterial | null>(null)
  const [selectedLocation, setSelectedLocation] = useState('')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [productionDate, setProductionDate] = useState(today())
  const [tankCount, setTankCount] = useState('1')
  const [usageLocation, setUsageLocation] = useState('Main Warehouse')
  const [usagePeriod, setUsagePeriod] = useState<UsagePeriod>('all')
  const [usageFrom, setUsageFrom] = useState('')
  const [usageTo, setUsageTo] = useState('')
  const [usageProductFilter, setUsageProductFilter] = useState('')
  const [expandedUsageId, setExpandedUsageId] = useState('')
  const [editingUsage, setEditingUsage] = useState<ProductionMaterialUsageRecord | null>(null)
  const [message, setMessage] = useState('')

  const workspace = useQuery({
    queryKey,
    queryFn: async () => {
      const [materials, movements, receipts, products, usages, alerts, users] = await Promise.all([
        listProductionMaterials(),
        listProductionMaterialMovements(),
        listProductionMaterialReceipts(),
        listProductionProducts(),
        listProductionMaterialUsages(),
        listRawMaterialAlerts(),
        listInventoryResponsibleUsers(),
      ])
      return {
        materials: materials.materials,
        movements: movements.movements,
        receipts: receipts.movements,
        products: products.products,
        usages: usages.usages,
        alerts: alerts.alerts,
        users: users.users,
      }
    },
  })
  const data = workspace.data
  const materials = data?.materials ?? []
  const movements = data?.movements ?? []
  const receiptMovements = data?.receipts ?? []
  const products = data?.products ?? []
  const usages = data?.usages ?? []
  const alerts = data?.alerts ?? []
  const users = data?.users ?? []
  const locations = [...new Set(materials.flatMap((material) => material.locations.map((balance) => balance.location)))].sort()
  const selectedProduct = products.find((product) => product.id === selectedProductId && product.active)
  const visibleUsages = useMemo(() => {
    const period = usagePeriodRange(usagePeriod)
    const from = usageFrom || period.from
    const to = usageTo || period.to
    return usages.filter((usage) =>
      (!usageProductFilter || usage.productId === usageProductFilter)
      && (!from || usage.productionDate >= from)
      && (!to || usage.productionDate <= to),
    ).sort((left, right) => right.productionDate.localeCompare(left.productionDate) || right.createdAt.localeCompare(left.createdAt))
  }, [usages, usagePeriod, usageFrom, usageTo, usageProductFilter])

  const visibleMaterials = useMemo(() => materials.filter((material) => {
    const text = `${material.name} ${material.code} ${material.category} ${material.unit} ${material.locations.map((balance) => balance.location).join(' ')}`.toLowerCase()
    return text.includes(search.trim().toLowerCase())
      && (locationFilter === 'All locations' || material.locations.some((balance) => balance.location === locationFilter))
  }).sort((left, right) => left.name.localeCompare(right.name)), [materials, search, locationFilter])

  const visibleMovements = useMemo(() => movements.filter((movement) => {
    const text = `${movement.reference} ${movement.receiptReference ?? ''} ${movement.materialName} ${movement.supplier ?? ''} ${movement.sourceReference ?? ''} ${movement.reason ?? ''}`.toLowerCase()
    return text.includes(search.trim().toLowerCase())
      && (movementFilter === 'All movement types' || movement.type === movementFilter)
      && (locationFilter === 'All locations' || movement.fromLocation === locationFilter || movement.toLocation === locationFilter)
      && (!dateFrom || movement.date >= dateFrom)
      && (!dateTo || movement.date <= dateTo)
  }).sort((left, right) => right.date.localeCompare(left.date) || right.createdAt.localeCompare(left.createdAt)), [movements, search, movementFilter, locationFilter, dateFrom, dateTo])

  const receiptGroups = useMemo(() => {
    const groups = new Map<string, RawMovementRecord[]>()
    receiptMovements.forEach((movement) => {
      const reference = movement.receiptReference || movement.reference
      groups.set(reference, [...(groups.get(reference) ?? []), movement])
    })
    return [...groups.entries()].map(([reference, rows]) => ({
      reference,
      rows,
      date: rows.reduce((latest, row) => row.date > latest ? row.date : latest, ''),
      supplier: rows.find((row) => row.supplier)?.supplier ?? 'Not recorded',
      location: [...new Set(rows.map((row) => row.toLocation).filter(Boolean))].join(', '),
      quantity: rows.reduce((total, row) => total + row.quantity, 0),
      value: rows.reduce((total, row) => total + row.quantity * (row.unitCost ?? 0), 0),
    })).filter((group) => `${group.reference} ${group.supplier} ${group.rows.map((row) => row.materialName).join(' ')}`.toLowerCase().includes(search.trim().toLowerCase()))
  }, [receiptMovements, search])

  const allBalances = materials.flatMap((material) => material.locations.map((balance) => ({ material, balance })))
  const lowStockCount = allBalances.filter(({ balance }) => balance.quantity <= balance.reorderThreshold).length
  const outOfStockCount = allBalances.filter(({ balance }) => balance.quantity <= 0).length
  const month = today().slice(0, 7)
  const receivedThisMonth = receiptMovements.filter((movement) => movement.date.startsWith(month)).reduce((total, movement) => total + movement.quantity * (movement.unitCost ?? 0), 0)
  const selectedRecipe = selectedProduct?.recipe?.ingredients ?? []
  const tankNumber = Number(tankCount)
  const usagePreview = selectedRecipe.map((line) => {
    const material = materials.find((item) => item.id === line.materialId)
    const balance = material ? locationFor(material, usageLocation) : undefined
    return { ...line, available: balance?.quantity ?? 0, total: line.quantityPerTank * tankNumber }
  })
  const insufficientLine = usagePreview.find((line) => line.total > line.available)

  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey }),
      client.invalidateQueries({ queryKey: ['production-workspace'] }),
    ])
  }
  const mutationOptions = (success: string) => ({
    onSuccess: async () => { setMessage(success); await refresh() },
    onError: (error: Error) => setMessage(messageFor(error)),
  })
  const createMaterialMutation = useMutation({
    mutationFn: createProductionMaterial,
    ...mutationOptions('Raw material added to the shared inventory catalog.'),
  })
  const updateMaterialMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateProductionMaterial>[1] }) => updateProductionMaterial(id, input),
    onSuccess: async () => {
      setDialog(null)
      setMessage('Raw material profile updated.')
      await refresh()
    },
    onError: (error: Error) => setMessage(messageFor(error)),
  })
  const deleteMaterialMutation = useMutation({
    mutationFn: deleteProductionMaterial,
    onSuccess: async (result) => {
      setDialog(null)
      setSelectedMaterial(null)
      setMessage(`Raw material deleted. Removed ${result.deletedStock.toLocaleString()} ${result.deletedUnit} of current stock; ${result.preservedMovementCount} historical movements were retained.`)
      await refresh()
    },
    onError: (error: Error) => setMessage(messageFor(error)),
  })
  const receiptMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof receiveProductionMaterial>[1] }) => receiveProductionMaterial(id, input),
    ...mutationOptions('Stock receipt recorded.'),
  })
  const adjustmentMutation = useMutation({
    mutationFn: adjustRawMaterialStock,
    ...mutationOptions('Stock adjustment recorded.'),
  })
  const transferMutation = useMutation({
    mutationFn: transferRawMaterialStock,
    ...mutationOptions('Stock transfer recorded.'),
  })
  const locationMutation = useMutation({
    mutationFn: ({ id, location, input }: { id: string; location: string; input: { reorderThreshold: number; responsibleUserId: string | null } }) => configureRawMaterialLocation(id, location, input),
    ...mutationOptions('Location threshold and responsible person saved.'),
  })
  const usageMutation = useMutation({
    mutationFn: postProductionMaterialUsage,
    onSuccess: async ({ usage }) => {
      setMessage(`${usage.reference} posted: ${usage.lines.length} raw materials used for ${usage.tanksProduced} tank(s).`)
      setSelectedProductId('')
      setTankCount('1')
      await refresh()
    },
    onError: (error: Error) => setMessage(messageFor(error)),
  })
  const usageUpdateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateProductionMaterialUsage>[1] }) => updateProductionMaterialUsage(id, input),
    onSuccess: async ({ usage }) => {
      setEditingUsage(null)
      setMessage(`${usage.reference} updated. Stock corrections were added to the movement history.`)
      await refresh()
    },
    onError: (error: Error) => setMessage(messageFor(error)),
  })

  const submitForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setMessage('')
    if (dialog === 'material' || dialog === 'editMaterial') {
      const input = {
        code: String(form.get('code')).trim(),
        name: String(form.get('name')).trim(),
        category: String(form.get('category')).trim(),
        unit: String(form.get('unit')).trim(),
        packagingLevels: form.getAll('packagingName').map((name, index) => ({
          name: String(name).trim(),
          quantity: Number(form.getAll('packagingQuantity')[index]),
        })),
      }
      if (dialog === 'material') createMaterialMutation.mutate(input)
      else if (selectedMaterial) updateMaterialMutation.mutate({ id: selectedMaterial.id, input })
    } else if (dialog === 'deleteMaterial' && selectedMaterial) {
      deleteMaterialMutation.mutate(selectedMaterial.id)
    } else if (dialog === 'receipt') {
      const id = String(form.get('materialId'))
      receiptMutation.mutate({
        id,
        input: {
          packageQuantity: Number(form.get('packageQuantity')),
          packageUnit: String(form.get('packageUnit')).trim(),
          packagePrice: Number(form.get('packagePrice')),
          date: String(form.get('date')),
          location: String(form.get('location')).trim(),
          reference: String(form.get('reference') || '').trim() || undefined,
          reason: String(form.get('reason')).trim(),
          supplier: String(form.get('supplier')).trim(),
          sourceReference: String(form.get('sourceReference') || '').trim() || undefined,
          idempotencyKey: createId('RM-RECEIPT'),
        },
      })
    } else if (dialog === 'adjustment') {
      adjustmentMutation.mutate({
        materialId: String(form.get('materialId')),
        location: String(form.get('location')).trim(),
        direction: String(form.get('direction')) as 'in' | 'out',
        quantity: Number(form.get('quantity')),
        date: String(form.get('date')),
        reference: String(form.get('reference') || '').trim() || undefined,
        reason: String(form.get('reason')).trim(),
        idempotencyKey: createId('RM-ADJ'),
      })
    } else if (dialog === 'transfer') {
      transferMutation.mutate({
        materialId: String(form.get('materialId')),
        fromLocation: String(form.get('fromLocation')).trim(),
        toLocation: String(form.get('toLocation')).trim(),
        quantity: Number(form.get('quantity')),
        date: String(form.get('date')),
        reference: String(form.get('reference') || '').trim() || undefined,
        reason: String(form.get('reason')).trim(),
        idempotencyKey: createId('RM-TRANSFER'),
      })
    } else if (dialog === 'location' && selectedMaterial) {
      locationMutation.mutate({
        id: selectedMaterial.id,
        location: selectedLocation,
        input: {
          reorderThreshold: Number(form.get('reorderThreshold')),
          responsibleUserId: String(form.get('responsibleUserId') || '') || null,
        },
      })
    }
  }

  const submitUsage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedProduct || !selectedRecipe.length || !validDateInput(productionDate)
      || !Number.isFinite(tankNumber) || tankNumber <= 0 || insufficientLine) return
    setMessage('')
    usageMutation.mutate({
      productId: selectedProduct.id,
      productionDate,
      tanksProduced: tankNumber,
      location: usageLocation,
      idempotencyKey: createId('RM-USE'),
    })
  }

  const submitUsageEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingUsage) return
    const form = new FormData(event.currentTarget)
    setMessage('')
    usageUpdateMutation.mutate({
      id: editingUsage.id,
      input: {
        productId: String(form.get('productId')),
        productionDate: String(form.get('productionDate')),
        tanksProduced: Number(form.get('tanksProduced')),
        location: String(form.get('location')).trim(),
      },
    })
  }

  const downloadUsagePdf = async (usage: ProductionMaterialUsageRecord) => {
    try {
      const { jsPDF } = await import('jspdf')
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const left = 14
      const right = pageWidth - 14
      let y = 18
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(18)
      pdf.text('Daily production material use', left, y)
      y += 11
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      for (const detail of [
        `Reference: ${usage.reference}`,
        `Production date: ${formatDate(usage.productionDate)}`,
        `Product: ${usage.productName}`,
        `Tanks made: ${usage.tanksProduced} × 1,000 litres`,
        `Store: ${usage.location}`,
        `Recipe version: v${usage.recipeVersion}`,
      ]) {
        pdf.text(pdf.splitTextToSize(detail, right - left), left, y)
        y += 6
      }
      y += 3
      pdf.setDrawColor(226, 232, 240)
      pdf.line(left, y, right, y)
      y += 8
      pdf.setFont('helvetica', 'bold')
      pdf.text('Raw material', left, y)
      pdf.text('Quantity used', right, y, { align: 'right' })
      y += 3
      pdf.line(left, y, right, y)
      y += 7
      pdf.setFont('helvetica', 'normal')
      for (const line of usage.lines) {
        const materialLines = pdf.splitTextToSize(line.materialName, 112) as string[]
        const quantity = `${line.totalQuantity.toLocaleString()} ${line.unit}`
        const rowHeight = Math.max(6, materialLines.length * 5) + 2
        if (y + rowHeight > pageHeight - 16) {
          pdf.addPage()
          y = 18
          pdf.setFont('helvetica', 'bold')
          pdf.text(`Production use ${usage.reference} (continued)`, left, y)
          y += 9
          pdf.setFont('helvetica', 'normal')
        }
        pdf.text(materialLines, left, y)
        pdf.text(quantity, right, y, { align: 'right' })
        y += rowHeight
      }
      const filename = `${usage.reference}-${usage.productionDate}`.replace(/[^a-zA-Z0-9_-]/g, '-')
      pdf.save(`${filename}.pdf`)
      setMessage(`PDF downloaded for ${usage.reference}.`)
    } catch (error) {
      setMessage(`PDF could not be created: ${messageFor(error)}`)
    }
  }

  const exportCurrent = () => {
    if (view === 'Inventory') {
      exportCsv('raw-material-inventory.csv', visibleMaterials.flatMap((material) => material.locations.map((balance) => ({
        code: material.code, name: material.name, category: material.category, location: balance.location,
        quantity: balance.quantity, unit: material.unit, reorderThreshold: balance.reorderThreshold,
        responsible: balance.responsibleUserName ?? '', status: stockStatus(balance),
      }))))
    } else if (view === 'Stock-in history') {
      exportCsv('raw-material-stock-in-history.csv', receiptGroups.map((receipt) => ({
        reference: receipt.reference, date: receipt.date, supplier: receipt.supplier, location: receipt.location,
        lines: receipt.rows.map((movement) => `${movement.materialName}: ${movement.receiptPackaging ? `${movement.receiptPackaging.packageQuantity} ${movement.receiptPackaging.packageUnit} (${movement.quantity} ${movement.unit})` : `${movement.quantity} ${movement.unit}`}`).join('; '),
        quantity: receipt.quantity, valueUGX: receipt.value,
      })))
    } else if (view === 'Daily production use') {
      exportCsv('daily-raw-material-use.csv', visibleUsages.map((usage) => ({
        date: usage.productionDate, reference: usage.reference, product: usage.productName,
        tanksProduced: usage.tanksProduced, tankLitres: usage.tankVolumeLitres, location: usage.location,
        ingredients: usage.lines.map((line) => `${line.materialName}: ${line.totalQuantity} ${line.unit}`).join('; '),
      })))
    } else if (view === 'Low stock') {
      exportCsv('raw-material-low-stock.csv', alerts.map((alert) => {
        const material = materials.find((item) => item.id === (typeof alert.materialId === 'string' ? alert.materialId : alert.materialId.id))
        return { material: material?.name ?? '', code: material?.code ?? '', location: alert.location, quantity: alert.currentQuantity, threshold: alert.reorderThreshold, responsible: typeof alert.recipientUserId === 'object' ? alert.recipientUserId?.name ?? '' : '' }
      }))
    } else {
      exportCsv('raw-material-movements.csv', visibleMovements.map((movement) => ({
        date: movement.date, reference: movement.reference, material: movement.materialName, type: movement.type,
        quantity: movement.quantity, unit: movement.unit, from: movement.fromLocation ?? '', to: movement.toLocation ?? '',
        supplier: movement.supplier ?? '', sourceReference: movement.sourceReference ?? '', reason: movement.reason ?? '', actor: movement.actor,
      })))
    }
  }

  const exportLegacyMigration = () => {
    try {
      const content = exportLegacyRawMaterialMigration()
      const url = URL.createObjectURL(new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = 'legacy-raw-material-migration.json'
      link.click()
      URL.revokeObjectURL(url)
      setMessage('Legacy inventory export downloaded. Review it with the backend migration dry run before importing.')
    } catch (error) {
      setMessage(messageFor(error))
    }
  }

  if (workspace.isLoading) return <section className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Loading raw-material inventory…</section>
  if (workspace.isError) return <section className="rounded-xl border border-rose-200 bg-rose-50 p-6"><h2 className="font-semibold text-rose-800">Raw-material inventory could not be loaded</h2><p className="mt-2 text-sm text-rose-700">{messageFor(workspace.error)}</p><button type="button" onClick={() => workspace.refetch()} className="mt-3 rounded-lg border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-800">Retry</button></section>

  const isPending = createMaterialMutation.isPending || updateMaterialMutation.isPending || deleteMaterialMutation.isPending || receiptMutation.isPending || adjustmentMutation.isPending || transferMutation.isPending || locationMutation.isPending || usageMutation.isPending || usageUpdateMutation.isPending

  return <div className="animate-in fade-in duration-300">
    <header className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><div className="mb-2 text-xs font-medium text-slate-400">Workspace / Inventory Department</div><h2 className="text-2xl font-bold tracking-tight">Raw material management</h2><p className="mt-1 text-sm text-slate-500">Shared material stock, receipts, traceable movements, and daily production consumption.</p></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={exportCurrent} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700"><Icons.Download className="size-4" /> Export</button>
        <button type="button" onClick={exportLegacyMigration} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700"><Icons.Archive className="size-4" /> Export legacy data</button>
      </div>
    </header>

    <section aria-label="Raw material summary" className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Materials tracked" value={String(materials.length)} detail="Shared catalog used by product recipes" icon="Boxes" tone="purple" />
      <Metric label="Low-stock locations" value={String(lowStockCount)} detail="At or below configured location threshold" icon="TriangleAlert" tone="amber" />
      <Metric label="Out-of-stock locations" value={String(outOfStockCount)} detail="No available quantity at location" icon="PackageX" tone="rose" />
      <Metric label="Received this month" value={money(receivedThisMonth)} detail="Stock-in value · transfers excluded" icon="PackageCheck" tone="blue" />
    </section>

    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div role="tablist" aria-label="Raw material views" className="flex gap-1 overflow-x-auto border-b border-slate-200 px-4 pt-2">
        {(['Inventory', 'Stock-in history', 'Daily production use', 'All movements', 'Low stock'] as View[]).map((item) => <button key={item} type="button" role="tab" aria-selected={view === item} onClick={() => setView(item)} className={`shrink-0 border-b-2 px-3 py-3 text-xs font-semibold ${view === item ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{item}<span className="ml-2 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{item === 'Inventory' ? materials.length : item === 'Stock-in history' ? receiptGroups.length : item === 'Daily production use' ? usages.length : item === 'All movements' ? movements.length : alerts.length}</span></button>)}
      </div>
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 xl:flex-row xl:items-center xl:justify-between">
        <div><h3 className="text-sm font-bold">{view}</h3><p className="mt-1 text-xs text-slate-500">        {view === 'Daily production use' ? `${visibleUsages.length} usage records · filter by production date and product` : view === 'Inventory' ? `${visibleMaterials.length} materials · balances are maintained per location` : view === 'Stock-in history' ? `${receiptGroups.length} receipts` : view === 'Low stock' ? `${alerts.length} notification-ready low-stock alerts · delivery is not enabled` : `${visibleMovements.length} movements`}</p></div>
        {view !== 'Daily production use' && <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><Icons.Search className="size-4 text-slate-400" /><input aria-label={`Search ${view}`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search material or reference" className="w-44 bg-transparent text-xs outline-none" /></label>
          {view === 'Inventory' ? <select aria-label="Filter inventory location" value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"><option>All locations</option>{locations.map((location) => <option key={location}>{location}</option>)}</select> : view !== 'Low stock' && <><select aria-label="Filter movement type" value={movementFilter} onChange={(event) => setMovementFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"><option>All movement types</option>{(['Opening balance', 'Receipt', 'Stock in', 'Stock out', 'Production use', 'Production use correction', 'Transfer', 'Adjustment increase', 'Adjustment decrease'] as RawMaterialMovementType[]).map((type) => <option key={type}>{type}</option>)}</select><input aria-label="From date" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="rounded-lg border border-slate-200 px-2 py-2 text-xs" /><input aria-label="To date" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="rounded-lg border border-slate-200 px-2 py-2 text-xs" /></>}
        </div>}
      </div>

      {view !== 'Daily production use' && <div className="flex justify-end gap-2 border-b border-slate-100 px-4 py-3">
        {view === 'Inventory' && <button type="button" onClick={() => { setDialog('material'); setMessage('') }} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold"><Icons.PackagePlus className="size-4" /> Add material</button>}
        {view === 'Stock-in history' && <button type="button" onClick={() => { setDialog('receipt'); setMessage('') }} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold"><Icons.ArrowDownToLine className="size-4" /> Record stock-in</button>}
        {view === 'All movements' && <>
          <button type="button" onClick={() => { setDialog('adjustment'); setMessage('') }} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold"><Icons.SlidersHorizontal className="size-4" /> Adjust stock</button>
          <button type="button" onClick={() => { setDialog('transfer'); setMessage('') }} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold"><Icons.ArrowLeftRight className="size-4" /> Transfer stock</button>
        </>}
      </div>}

      {view === 'Inventory' && <InventoryTable
        materials={visibleMaterials}
        locationFilter={locationFilter}
        onConfigure={(material, location) => { setSelectedMaterial(material); setSelectedLocation(location); setDialog('location'); setMessage('') }}
        onEdit={(material) => { setSelectedMaterial(material); setDialog('editMaterial'); setMessage('') }}
        onDelete={(material) => { setSelectedMaterial(material); setDialog('deleteMaterial'); setMessage('') }}
      />}
      {view === 'Stock-in history' && <ReceiptTable groups={receiptGroups} />}
      {view === 'All movements' && <MovementTable movements={visibleMovements} />}
      {view === 'Low stock' && <AlertTable alerts={alerts.filter((alert) => {
        const materialId = typeof alert.materialId === 'string' ? alert.materialId : alert.materialId.id
        const material = materials.find((item) => item.id === materialId)
        return `${material?.name ?? ''} ${material?.code ?? ''} ${alert.location}`.toLowerCase().includes(search.trim().toLowerCase())
      })} materials={materials} />}
      {view === 'Daily production use' && <ProductionUseView
        products={products.filter((product) => product.active && product.recipe)}
        filterProducts={products}
        selectedProductId={selectedProductId}
        onSelectProduct={setSelectedProductId}
        product={selectedProduct}
        productionDate={productionDate}
        onProductionDate={setProductionDate}
        locations={locations}
        location={usageLocation}
        onLocation={setUsageLocation}
        tanks={tankCount}
        onTanks={setTankCount}
        preview={usagePreview}
        insufficient={insufficientLine?.materialName}
        usages={visibleUsages}
        period={usagePeriod}
        onPeriod={(period) => { setUsagePeriod(period); setUsageFrom(''); setUsageTo('') }}
        from={usageFrom}
        onFrom={(value) => { setUsageFrom(value); setUsagePeriod('all') }}
        to={usageTo}
        onTo={(value) => { setUsageTo(value); setUsagePeriod('all') }}
        productFilter={usageProductFilter}
        onProductFilter={setUsageProductFilter}
        expandedId={expandedUsageId}
        onToggleUsage={(id) => setExpandedUsageId((current) => current === id ? '' : id)}
        onEditUsage={(usage) => { usageUpdateMutation.reset(); setEditingUsage(usage); setMessage('') }}
        onDownloadUsage={downloadUsagePdf}
        onSubmit={submitUsage}
        disabled={usageMutation.isPending}
      />}

      {(message || isPending) && <p role="status" className="border-t border-slate-100 bg-amber-50 px-4 py-3 text-xs text-amber-800">{isPending ? 'Saving inventory change…' : message}</p>}
      <footer className="border-t border-slate-100 px-4 py-3 text-[10px] text-slate-400">Recipe quantities are for one 1,000-litre tank. Direct usage edits append stock correction movements; legacy production-run usage records are retained as read-only history.</footer>
    </section>

    {dialog && <InventoryDialog
      mode={dialog}
      key={`${dialog}-${selectedMaterial?.id ?? ''}`}
      materials={materials}
      locations={locations}
      users={users}
      material={selectedMaterial}
      location={selectedLocation}
      onClose={() => { if (!isPending) setDialog(null) }}
      onSubmit={submitForm}
      pending={isPending}
      message={message}
    />}
    {editingUsage && <ProductionUsageEditDialog
      key={editingUsage.id}
      usage={editingUsage}
      products={products.filter((product) => product.active && product.recipe)}
      locations={locations}
      pending={usageUpdateMutation.isPending}
      message={usageUpdateMutation.error ? messageFor(usageUpdateMutation.error) : ''}
      onClose={() => { if (!usageUpdateMutation.isPending) setEditingUsage(null) }}
      onSubmit={submitUsageEdit}
    />}
  </div>
}

function InventoryTable({ materials, locationFilter, onConfigure, onEdit, onDelete }: { materials: ProductionMaterial[]; locationFilter: string; onConfigure: (material: ProductionMaterial, location: string) => void; onEdit: (material: ProductionMaterial) => void; onDelete: (material: ProductionMaterial) => void }) {
  if (!materials.length) return <EmptyState title="No raw materials yet" detail="Add a shared raw material, then record stock receipts to establish its balance." />
  const rows = materials.flatMap((material) => {
    const balances = locationFilter === 'All locations'
      ? material.locations
      : material.locations.filter((balance) => balance.location === locationFilter)
    return balances.map((balance) => ({ material, balance }))
  })
  if (!rows.length) return <EmptyState title="No stock configured at this location" detail="Receive or transfer stock to this location to add a balance record." />
  return <div className="overflow-x-auto"><table className="w-full min-w-230 text-left text-xs"><thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-400"><tr>{['Code', 'Material', 'Category', 'Location', 'Available', 'Reorder level', 'Responsible', 'Status', 'Actions'].map((label) => <th key={label} className="px-3 py-3">{label}</th>)}</tr></thead><tbody>{rows.map(({ material, balance }) => <InventoryRow
    key={`${material.id}-${balance.location}`}
    material={material}
    balance={balance}
    onConfigure={onConfigure}
    onEdit={onEdit}
    onDelete={onDelete}
  />)}</tbody></table></div>
}

function InventoryRow({ material, balance, onConfigure, onEdit, onDelete }: {
  material: ProductionMaterial
  balance: RawMaterialLocationBalance
  onConfigure: (material: ProductionMaterial, location: string) => void
  onEdit: (material: ProductionMaterial) => void
  onDelete: (material: ProductionMaterial) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const status = stockStatus(balance)

  useEffect(() => {
    if (!menuOpen) return
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) setMenuOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [menuOpen])

  return <tr className="border-t border-slate-100 text-slate-600">
    <td className="px-3 py-3 font-mono">{material.code}</td>
    <td className="px-3 py-3 font-semibold text-slate-800">{material.name}<span className="mt-1 block text-[10px] font-normal text-slate-400">{material.unit}</span>{(material.packagingLevels?.length ?? 0) > 0 && <span className="mt-1 block max-w-80 text-[10px] font-normal text-slate-500">{describePackaging(material)}</span>}</td>
    <td className="px-3 py-3">{material.category}</td>
    <td className="px-3 py-3">{balance.location}</td>
    <td className="px-3 py-3 font-bold">{balance.quantity.toLocaleString()} {material.unit}</td>
    <td className="px-3 py-3">{balance.reorderThreshold.toLocaleString()} {material.unit}</td>
    <td className="px-3 py-3">{balance.responsibleUserName ?? 'Not assigned'}</td>
    <td className="px-3 py-3"><span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${statusClass(status)}`}>{status}</span></td>
    <td className="px-3 py-3">
      <div ref={menuRef} className="relative flex justify-end">
        <button
          type="button"
          aria-label={`Actions for ${material.name} at ${balance.location}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className="grid size-8 place-items-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
        ><Icons.Ellipsis className="size-4" /></button>
        {menuOpen && <div role="menu" className="absolute right-0 top-full z-20 mt-1 min-w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onConfigure(material, balance.location) }} className="w-full rounded-md px-3 py-2 text-left text-xs font-medium hover:bg-slate-50">Threshold / owner</button>
          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onEdit(material) }} className="w-full rounded-md px-3 py-2 text-left text-xs font-medium hover:bg-slate-50">Edit material</button>
          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onDelete(material) }} className="w-full rounded-md px-3 py-2 text-left text-xs font-medium text-rose-700 hover:bg-rose-50">Delete material</button>
        </div>}
      </div>
    </td>
  </tr>
}

function ReceiptTable({ groups }: { groups: Array<{ reference: string; rows: RawMovementRecord[]; date: string; supplier: string; location: string; quantity: number; value: number }> }) {
  if (!groups.length) return <EmptyState title="No stock receipts yet" detail="Receipts you post will appear here grouped by receipt reference." />
  return <div className="overflow-x-auto"><table className="w-full min-w-180 text-left text-xs"><thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-400"><tr>{['Receipt reference', 'Date', 'Supplier', 'Material lines', 'Quantity in', 'Value', 'Location'].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{groups.map((group) => <tr key={group.reference} className="border-t border-slate-100"><td className="px-4 py-3 font-semibold">{group.reference}</td><td className="px-4 py-3">{formatDate(group.date)}</td><td className="px-4 py-3">{group.supplier}</td><td className="px-4 py-3">{group.rows.map((row) => `${row.materialName}: ${row.receiptPackaging ? `${row.receiptPackaging.packageQuantity} ${row.receiptPackaging.packageUnit} → ` : ''}${row.quantity} ${row.unit}`).join('; ')}</td><td className="px-4 py-3">{group.quantity.toLocaleString()}</td><td className="px-4 py-3">{money(group.value)}</td><td className="px-4 py-3">{group.location || '—'}</td></tr>)}</tbody></table></div>
}

function MovementTable({ movements }: { movements: RawMovementRecord[] }) {
  if (!movements.length) return <EmptyState title="No movements match" detail="Stock receipts, transfers, adjustments, and production usage will be traceable here." />
  return <div className="overflow-x-auto"><table className="w-full min-w-230 text-left text-xs"><thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-400"><tr>{['Date', 'Reference', 'Material', 'Movement', 'Quantity', 'From', 'To', 'Supplier / reason', 'Actor'].map((label) => <th key={label} className="px-3 py-3">{label}</th>)}</tr></thead><tbody>{movements.map((movement) => <tr key={movement.id} className="border-t border-slate-100"><td className="px-3 py-3 whitespace-nowrap">{formatDate(movement.date)}</td><td className="px-3 py-3 font-semibold">{movement.reference}</td><td className="px-3 py-3">{movement.materialName}</td><td className="px-3 py-3">{movement.type}</td><td className={`px-3 py-3 font-semibold ${movement.direction === 'in' ? 'text-emerald-700' : movement.direction === 'out' ? 'text-rose-700' : ''}`}>{movement.direction === 'in' ? '+' : movement.direction === 'out' ? '−' : ''}{movement.quantity.toLocaleString()} {movement.unit}</td><td className="px-3 py-3">{movement.fromLocation ?? '—'}</td><td className="px-3 py-3">{movement.toLocation ?? '—'}</td><td className="px-3 py-3">{movement.supplier || movement.reason || movement.sourceReference || '—'}</td><td className="px-3 py-3">{movement.actor}</td></tr>)}</tbody></table></div>
}

function AlertTable({ alerts, materials }: { alerts: RawMaterialAlert[]; materials: ProductionMaterial[] }) {
  if (!alerts.length) return <EmptyState title="No active low-stock alerts" detail="A notification-ready alert is raised when stock reaches or falls below its configured location threshold. Delivery is not yet enabled." />
  return <div className="overflow-x-auto"><table className="w-full min-w-180 text-left text-xs"><thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-400"><tr>{['Material', 'Location', 'Available', 'Threshold', 'Responsible person', 'Alert state'].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{alerts.map((alert) => {
    const materialId = typeof alert.materialId === 'string' ? alert.materialId : alert.materialId.id
    const material = materials.find((item) => item.id === materialId)
    const recipient = typeof alert.recipientUserId === 'object' ? alert.recipientUserId?.name : ''
    return <tr key={alert.id} className="border-t border-slate-100"><td className="px-4 py-3 font-semibold">{material?.name ?? (typeof alert.materialId === 'object' ? alert.materialId.name : alert.materialId)}</td><td className="px-4 py-3">{alert.location}</td><td className="px-4 py-3 text-rose-700">{alert.currentQuantity.toLocaleString()} {material?.unit ?? ''}</td><td className="px-4 py-3">{alert.reorderThreshold.toLocaleString()} {material?.unit ?? ''}</td><td className="px-4 py-3">{recipient || 'No recipient assigned'}</td><td className="px-4 py-3">Notification pending integration</td></tr>
  })}</tbody></table></div>
}

function ProductionUseView({ products, filterProducts, selectedProductId, onSelectProduct, product, productionDate, onProductionDate, locations, location, onLocation, tanks, onTanks, preview, insufficient, usages, period, onPeriod, from, onFrom, to, onTo, productFilter, onProductFilter, expandedId, onToggleUsage, onEditUsage, onDownloadUsage, onSubmit, disabled }: {
  products: ProductionProduct[]
  filterProducts: ProductionProduct[]
  selectedProductId: string
  onSelectProduct: (value: string) => void
  product?: ProductionProduct
  productionDate: string
  onProductionDate: (value: string) => void
  locations: string[]
  location: string
  onLocation: (value: string) => void
  tanks: string
  onTanks: (value: string) => void
  preview: Array<{ materialId: string; materialName: string; unit: string; quantityPerTank: number; total: number; available: number }>
  insufficient?: string
  usages: ProductionMaterialUsageRecord[]
  period: UsagePeriod
  onPeriod: (value: UsagePeriod) => void
  from: string
  onFrom: (value: string) => void
  to: string
  onTo: (value: string) => void
  productFilter: string
  onProductFilter: (value: string) => void
  expandedId: string
  onToggleUsage: (id: string) => void
  onEditUsage: (usage: ProductionMaterialUsageRecord) => void
  onDownloadUsage: (usage: ProductionMaterialUsageRecord) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  disabled: boolean
}) {
  const invalidDateRange = Boolean(from && to && from > to)
  return <div className="space-y-5 p-4">
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div><h3 className="text-sm font-bold">Record daily tank production use</h3><p className="mt-1 text-xs text-slate-500">Select the product and its saved recipe. Material use is calculated from the recipe for each 1,000-litre tank and deducted from the selected store.</p></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Product"><select required value={selectedProductId} onChange={(event) => onSelectProduct(event.target.value)} className={inputClass}><option value="">Select a product</option>{products.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.code}</option>)}</select></Field>
        <Field label="Production date"><input required type="date" value={productionDate} onChange={(event) => onProductionDate(event.target.value)} className={inputClass} /></Field>
        <Field label="Tanks made (1 tank = 1,000 litres)"><input required type="number" min="0.000001" step="any" value={tanks} onChange={(event) => onTanks(event.target.value)} className={inputClass} /></Field>
        <Field label="Raw-material store location"><select required value={location} onChange={(event) => onLocation(event.target.value)} className={inputClass}><option value="">Select location</option>{locations.map((item) => <option key={item}>{item}</option>)}</select></Field>
      </div>
      {!products.length && <p role="status" className="text-xs text-amber-700">There are no active products with a saved recipe to select.</p>}
      {product && !product.recipe && <p role="alert" className="text-xs text-rose-700">This product has no saved recipe. Add a per-tank recipe in Production Management first.</p>}
      {product?.recipe && <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white"><table className="w-full min-w-140 text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase text-slate-400"><tr>{['Ingredient', 'Per 1,000-litre tank', `Total for ${Number(tanks) || 0} tank(s)`, 'Available at selected store'].map((label) => <th key={label} className="px-3 py-2.5">{label}</th>)}</tr></thead><tbody>{preview.map((line) => <tr key={line.materialId} className="border-t border-slate-100"><td className="px-3 py-2.5 font-semibold">{line.materialName}</td><td className="px-3 py-2.5">{line.quantityPerTank.toLocaleString()} {line.unit}</td><td className="px-3 py-2.5 font-bold">{line.total.toLocaleString()} {line.unit}</td><td className={`px-3 py-2.5 ${line.available < line.total ? 'font-semibold text-rose-700' : 'text-emerald-700'}`}>{line.available.toLocaleString()} {line.unit}</td></tr>)}</tbody></table></div>}
      {insufficient && <p role="alert" className="text-xs font-semibold text-rose-700">Insufficient {insufficient} stock at {location}; posting is blocked.</p>}
      <button type="submit" disabled={disabled || !product?.recipe || !preview.length || Boolean(insufficient) || !validDateInput(productionDate) || !Number.isFinite(Number(tanks)) || Number(tanks) <= 0} className="rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-40">{disabled ? 'Posting use…' : 'Post raw-material use'}</button>
    </form>
    <section aria-labelledby="usage-history-heading" className="space-y-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div><h3 id="usage-history-heading" className="text-sm font-bold text-slate-900">Daily production-use history</h3><p className="mt-1 text-xs text-slate-500">Open a record to review the ingredient breakdown and traceability details.</p></div>
        <span className="text-[11px] font-medium text-slate-500">{usages.length} {usages.length === 1 ? 'record' : 'records'}</span>
      </div>
      <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3 sm:p-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter production usage period">
          {([
            ['all', 'All time'],
            ['today', 'Today'],
            ['week', 'This week'],
            ['month', 'This month'],
          ] as Array<[UsagePeriod, string]>).map(([value, label]) => <button key={value} type="button" aria-pressed={period === value} onClick={() => onPeriod(value)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${period === value ? 'bg-slate-900 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-100'}`}>{label}</button>)}
        </div>
        <div className="grid gap-3 md:grid-cols-[minmax(12rem,1fr)_repeat(2,minmax(9rem,0.65fr))]">
          <label className="block text-[11px] font-semibold text-slate-500">Product
            <select aria-label="Filter usage by product" value={productFilter} onChange={(event) => onProductFilter(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-700 outline-none focus:border-primary focus:ring-2 focus:ring-ring/30">
              <option value="">All products</option>
              {filterProducts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              {Array.from(new Map(usages
                .filter((usage) => !filterProducts.some((item) => item.id === usage.productId))
                .map((usage) => [usage.productId, usage.productName] as const))
                .entries()).map(([id, name]) => <option key={id} value={id}>{name} · archived</option>)}
            </select>
          </label>
          <label className="block text-[11px] font-semibold text-slate-500">From date<input aria-label="Filter usage from date" type="date" value={from} onChange={(event) => onFrom(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-700 outline-none focus:border-primary focus:ring-2 focus:ring-ring/30" /></label>
          <label className="block text-[11px] font-semibold text-slate-500">To date<input aria-label="Filter usage to date" type="date" value={to} onChange={(event) => onTo(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-700 outline-none focus:border-primary focus:ring-2 focus:ring-ring/30" /></label>
        </div>
        {invalidDateRange && <p role="alert" className="text-xs font-medium text-rose-700">The start date must be on or before the end date.</p>}
        {(period !== 'all' || from || to || productFilter) && <button type="button" onClick={() => { onFrom(''); onTo(''); onProductFilter(''); onPeriod('all') }} className="text-left text-xs font-semibold text-primary hover:underline">Clear filters</button>}
      </div>
      {usages.length ? <div className="space-y-3">
        {usages.map((usage) => {
          const expanded = expandedId === usage.id
          const panelId = `usage-panel-${usage.id}`
          const runLinked = Boolean(usage.productionRunId)
          return <article key={usage.id} className={`overflow-hidden rounded-xl border bg-white shadow-sm transition-all ${expanded ? 'border-indigo-200 shadow-md shadow-indigo-950/5' : 'border-slate-200 hover:border-slate-300 hover:shadow-md'}`}>
            <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
              <h4 className="min-w-0 flex-1">
                <button type="button" aria-expanded={expanded} aria-controls={panelId} onClick={() => onToggleUsage(usage.id)} className="group flex w-full min-w-0 items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                  <span className={`grid size-10 shrink-0 place-items-center rounded-xl transition-colors ${expanded ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600 group-hover:bg-indigo-50 group-hover:text-indigo-700'}`}><Icons.CalendarDays className="size-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-medium text-slate-500">{formatDate(usage.productionDate)}</span>
                    <span className="mt-0.5 block truncate text-sm font-bold text-slate-900">{usage.productName}</span>
                  </span>
                  <span className="shrink-0 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-right text-xs font-bold text-indigo-800"><span className="block text-[9px] font-semibold uppercase tracking-wide text-indigo-500">Tanks</span>{usage.tanksProduced}</span>
                  <Icons.ChevronDown className={`ml-1 size-4 shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-180 text-indigo-600' : ''}`} />
                </button>
              </h4>
              <div className="flex shrink-0 items-center gap-2 pl-[52px] sm:pl-0">
                <span aria-hidden="true" className="hidden flex-1 items-center justify-center gap-1.5 text-[10px] font-medium tracking-wide text-slate-400 sm:inline-flex"><span className="h-px w-5 bg-slate-200" />{expanded ? 'Click to collapse' : 'Click to expand'}<span className="h-px w-5 bg-slate-200" /></span>
                <button type="button" onClick={() => onDownloadUsage(usage)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"><Icons.Printer className="size-3.5" /><span>PDF</span></button>
                <button type="button" disabled={runLinked} title={runLinked ? 'Legacy run-linked usage is read-only to keep the production-run ledger consistent.' : 'Edit production usage'} onClick={() => onEditUsage(usage)} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-100 bg-indigo-50/70 px-3 py-2 text-[11px] font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"><Icons.Pencil className="size-3.5" /><span>Edit</span></button>
              </div>
            </div>
            <div id={panelId} hidden={!expanded}>
              <div className="border-t border-slate-100 bg-gradient-to-b from-slate-50/80 to-white px-4 py-4 sm:px-5">
                <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border border-slate-100 bg-white px-3 py-2.5"><span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Reference</span><span className="mt-1 block truncate text-xs font-semibold text-slate-700">{usage.reference}</span></div>
                  <div className="rounded-lg border border-slate-100 bg-white px-3 py-2.5"><span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Store</span><span className="mt-1 block text-xs font-semibold text-slate-700">{usage.location}</span></div>
                  <div className="rounded-lg border border-slate-100 bg-white px-3 py-2.5"><span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Recipe snapshot</span><span className="mt-1 block text-xs font-semibold text-slate-700">Version {usage.recipeVersion} · 1,000-litre tank</span></div>
                  <div className="rounded-lg border border-slate-100 bg-white px-3 py-2.5"><span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Ingredients</span><span className="mt-1 block text-xs font-semibold text-slate-700">{usage.lines.length} material {usage.lines.length === 1 ? 'line' : 'lines'}</span></div>
                </div>
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 bg-slate-50 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-500"><span>Raw material</span><span className="text-right">Quantity used</span></div>
                  {usage.lines.map((line, index) => <div key={`${line.materialId}-${index}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-slate-100 px-3 py-3 text-xs">
                    <span className="flex min-w-0 items-center gap-2 font-semibold text-slate-700"><span className="grid size-6 shrink-0 place-items-center rounded-md bg-emerald-50 text-emerald-700"><Icons.Package className="size-3" /></span><span className="truncate">{line.materialName}</span></span>
                    <span className="whitespace-nowrap text-right font-bold tabular-nums text-slate-900">{line.totalQuantity.toLocaleString()} <span className="font-medium text-slate-500">{line.unit}</span></span>
                  </div>)}
                </div>
                {runLinked && <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2.5 text-[11px] leading-relaxed text-amber-800"><Icons.Info className="mt-0.5 size-3.5 shrink-0" />This record is linked to a legacy production run and is read-only. Its run and stock ledger are preserved together.</p>}
              </div>
            </div>
          </article>
        })}
      </div> : usages.length === 0 && (period !== 'all' || from || to || productFilter)
        ? <EmptyState title="No records match these filters" detail="Try a different period, date range, or product, or clear the filters." />
        : <EmptyState title="No production use recorded" detail="Posted product and tank-use records will appear here." />}
    </section>
  </div>
}

function ProductionUsageEditDialog({ usage, products, locations, pending, message, onClose, onSubmit }: {
  usage: ProductionMaterialUsageRecord
  products: ProductionProduct[]
  locations: string[]
  pending: boolean
  message: string
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const usageProductAvailable = products.some((product) => product.id === usage.productId)
  const usageLocationAvailable = locations.includes(usage.location)
  return <div className="fixed inset-0 z-80 grid place-items-center bg-slate-950/50 p-3 backdrop-blur-[2px] sm:p-6" onClick={(event) => { if (event.target === event.currentTarget && !pending) onClose() }}>
    <section role="dialog" aria-modal="true" aria-labelledby="usage-edit-title" className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/60 bg-white shadow-2xl">
      <header className="flex items-start justify-between gap-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50/80 to-white px-5 py-5">
        <div><span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-indigo-700"><Icons.Pencil className="size-3" /> Edit usage</span><h2 id="usage-edit-title" className="text-base font-bold text-slate-900">Update production record</h2><p className="mt-1 text-xs text-slate-500">{usage.reference} · quantities will be recalculated from the selected product’s active recipe.</p></div>
        <button type="button" aria-label="Close edit production usage" onClick={onClose} disabled={pending} className="grid size-8 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"><Icons.X className="size-4" /></button>
      </header>
      <form onSubmit={onSubmit} className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Product">
            <select required name="productId" defaultValue={usage.productId} className={inputClass}>
              {!usageProductAvailable && <option value={usage.productId}>{usage.productName} · unavailable</option>}
              {products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.code}</option>)}
            </select>
          </Field>
          <Field label="Production date"><input required type="date" name="productionDate" defaultValue={usage.productionDate} className={inputClass} /></Field>
          <Field label="Tanks made (1 tank = 1,000 litres)"><input required type="number" min="0.000001" step="any" name="tanksProduced" defaultValue={usage.tanksProduced} className={inputClass} /></Field>
          <Field label="Raw-material store location">
            <select required name="location" defaultValue={usage.location} className={inputClass}>
              {!usageLocationAvailable && <option value={usage.location}>{usage.location} · unavailable</option>}
              {locations.map((location) => <option key={location} value={location}>{location}</option>)}
            </select>
          </Field>
        </div>
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-relaxed text-amber-900"><Icons.TriangleAlert className="mt-0.5 size-4 shrink-0" />Saving recalculates material quantities from the active recipe and adjusts available stock. Original movements remain unchanged; correction movements are added to the ledger. The edit will fail if stock or inventory configuration cannot support it.</p>
        {message && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800">{message}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} disabled={pending} className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={pending || !products.length} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm disabled:opacity-50"><Icons.Save className="size-3.5" />{pending ? 'Saving changes…' : 'Save and reconcile stock'}</button>
        </div>
      </form>
    </section>
  </div>
}

function InventoryDialog({ mode, materials, locations, users, material, location, onClose, onSubmit, pending, message }: {
  mode: Exclude<Dialog, null>
  materials: ProductionMaterial[]
  locations: string[]
  users: Array<{ id: string; name: string; email: string }>
  material: ProductionMaterial | null
  location: string
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  pending: boolean
  message: string
}) {
  const [packagingLevels, setPackagingLevels] = useState<PackagingLevelInput[]>(() =>
    mode === 'editMaterial' && material
      ? (material.packagingLevels ?? []).map((level) => ({ name: level.name, quantity: String(level.quantity) }))
      : [],
  )
  const firstMaterial = materials.find((item) => item.active)
  const [receiptMaterialId, setReceiptMaterialId] = useState(firstMaterial?.id ?? '')
  const [receiptPackageUnit, setReceiptPackageUnit] = useState(() => {
    const levels = firstMaterial?.packagingLevels ?? []
    return levels.length ? levels[levels.length - 1].name : firstMaterial?.unit ?? ''
  })
  const [receiptPackageQuantity, setReceiptPackageQuantity] = useState('1')
  const [receiptPackagePrice, setReceiptPackagePrice] = useState('0')
  const receiptMaterial = materials.find((item) => item.id === receiptMaterialId)
  const receiptChoices = packagingChoices(receiptMaterial)
  const selectedReceiptChoice = receiptChoices.find((choice) => choice.name === receiptPackageUnit)
  const title = mode === 'material' ? 'Add raw material' : mode === 'editMaterial' ? 'Edit raw material' : mode === 'deleteMaterial' ? 'Delete raw material' : mode === 'receipt' ? 'Record stock-in' : mode === 'adjustment' ? 'Adjust stock' : mode === 'transfer' ? 'Transfer stock' : 'Low-stock settings'
  return <div className="fixed inset-0 z-80 grid place-items-center bg-slate-950/45 p-3 sm:p-6" onClick={(event) => { if (event.target === event.currentTarget && !pending) onClose() }}><section role="dialog" aria-modal="true" aria-labelledby="inventory-dialog-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl">
    <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 id="inventory-dialog-title" className="text-base font-bold">{title}</h2><p className="mt-1 text-xs text-slate-500">{mode === 'location' ? 'Alerts are stored for future notification delivery; no notifications are sent yet.' : mode === 'deleteMaterial' ? 'Current stock and settings will be deleted; historical movements are retained.' : 'Posted movements are retained in the inventory history.'}</p></div><button type="button" aria-label="Close form" onClick={onClose} disabled={pending} className="grid size-8 place-items-center rounded-md text-slate-400"><Icons.X className="size-4" /></button></header>
    <form onSubmit={onSubmit} className="space-y-4 p-5">
      {(mode === 'material' || mode === 'editMaterial') && <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Material code"><input required name="code" defaultValue={mode === 'editMaterial' ? material?.code : ''} className={inputClass} /></Field>
          <Field label="Material name"><input required name="name" defaultValue={mode === 'editMaterial' ? material?.name : ''} className={inputClass} /></Field>
          <Field label="Category"><input required name="category" defaultValue={mode === 'editMaterial' ? material?.category : 'Ingredients'} className={inputClass} /></Field>
          <Field label="Base unit (used for stock and recipes)"><input required name="unit" defaultValue={mode === 'editMaterial' ? material?.unit : ''} placeholder="kg, L, pcs" className={inputClass} /></Field>
        </div>
        {mode === 'editMaterial' && <p className="rounded-md bg-amber-50 px-3 py-2 text-[10px] text-amber-800">Changing the base unit is allowed only before stock movements, stock or reorder thresholds, current product recipes, or pending production runs exist. Historical movements keep their original names, units, and package snapshots.</p>}
        <section className="rounded-lg border border-slate-200 p-4">
          <div className="flex items-start justify-between gap-3">
            <div><h3 className="text-xs font-bold text-slate-700">Packaging conversions</h3><p className="mt-1 text-[10px] text-slate-500">Enter levels from the smallest package to the largest. The first quantity is in base units; later quantities count the previous package.</p></div>
            <button type="button" onClick={() => setPackagingLevels((levels) => [...levels, { name: '', quantity: '' }])} className="shrink-0 rounded-md border border-slate-200 px-2.5 py-1.5 text-[10px] font-semibold">Add level</button>
          </div>
          {packagingLevels.length > 0 && <div className="mt-3 space-y-2">
            {packagingLevels.map((level, index) => <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <Field label={`Package level ${index + 1} name`}><input required name="packagingName" value={level.name} onChange={(event) => setPackagingLevels((levels) => levels.map((item, current) => current === index ? { ...item, name: event.target.value } : item))} placeholder={index === 0 ? 'sack or sachet' : 'box'} className={inputClass} /></Field>
              <Field label={index === 0 ? 'Base units per package' : `Whole number of ${packagingLevels[index - 1].name || 'previous-level packages'}`}>
                <input
                  required
                  name="packagingQuantity"
                  value={level.quantity}
                  onChange={(event) => {
                    const quantity = index === 0 ? event.target.value : event.target.value.replace(/\D/g, '')
                    setPackagingLevels((levels) => levels.map((item, current) => current === index ? { ...item, quantity } : item))
                  }}
                  type={index === 0 ? 'number' : 'text'}
                  inputMode={index === 0 ? 'decimal' : 'numeric'}
                  min={index === 0 ? '0.000001' : undefined}
                  step={index === 0 ? 'any' : undefined}
                  pattern={index === 0 ? undefined : '[1-9][0-9]*'}
                  maxLength={index === 0 ? undefined : 10}
                  placeholder={index === 0 ? 'e.g. 50 kg per sack' : 'e.g. 20 sachets per box'}
                  className={inputClass}
                />
              </Field>
              <button type="button" aria-label={`Remove packaging level ${index + 1}`} onClick={() => setPackagingLevels((levels) => levels.filter((_, current) => current !== index))} className="mt-5 grid size-9 place-items-center rounded-md text-rose-600 hover:bg-rose-50"><Icons.Trash2 className="size-4" /></button>
            </div>)}
          </div>}
          <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-[10px] text-slate-600">{packagingLevels.length ? `Example: ${packagingLevels.map((level) => level.name || 'package').join(' → ')} → base unit.` : 'No package levels means receipts will be entered directly in the base unit.'}</p>
        </section>
      </div>}
      {mode === 'receipt' && <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Material"><select required name="materialId" value={receiptMaterialId} onChange={(event) => {
          const nextMaterial = materials.find((item) => item.id === event.target.value)
          setReceiptMaterialId(event.target.value)
          const nextLevels = nextMaterial?.packagingLevels ?? []
          setReceiptPackageUnit(nextLevels.length ? nextLevels[nextLevels.length - 1].name : nextMaterial?.unit ?? '')
        }} className={inputClass}><option value="">Select material</option>{materials.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>)}</select></Field>
        <Field label="Received as"><select required name="packageUnit" value={receiptPackageUnit} onChange={(event) => setReceiptPackageUnit(event.target.value)} className={inputClass}><option value="">Select package unit</option>{receiptChoices.map((choice) => <option key={choice.name} value={choice.name}>{choice.name}</option>)}</select></Field>
        <Field label={`Number of ${receiptPackageUnit || 'packages'}`}><input required name="packageQuantity" type="number" min="1" step="1" value={receiptPackageQuantity} onChange={(event) => setReceiptPackageQuantity(event.target.value)} className={inputClass} /></Field>
        <Field label={`Price per ${receiptPackageUnit || 'package'} (UGX)`}><input required name="packagePrice" type="number" min="0" step="any" value={receiptPackagePrice} onChange={(event) => setReceiptPackagePrice(event.target.value)} className={inputClass} /></Field>
        {selectedReceiptChoice && receiptMaterial && <p className="sm:col-span-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">{receiptPackageQuantity || 0} {receiptPackageUnit} = {(Number(receiptPackageQuantity) * selectedReceiptChoice.baseUnitsPerPackage).toLocaleString()} {receiptMaterial.unit} · estimated total {money(Number(receiptPackageQuantity) * Number(receiptPackagePrice))} · {money(Number(receiptPackagePrice) / selectedReceiptChoice.baseUnitsPerPackage)} per {receiptMaterial.unit}</p>}
        <Field label="Destination location"><input required name="location" list="inventory-locations" defaultValue={locations[0] ?? 'Main Warehouse'} className={inputClass} /><datalist id="inventory-locations">{locations.map((item) => <option key={item} value={item} />)}</datalist></Field>
        <Field label="Receipt date"><input required name="date" type="date" defaultValue={today()} className={inputClass} /></Field>
        <Field label="Supplier"><input required name="supplier" className={inputClass} /></Field>
        <Field label="Receipt reference"><input name="reference" className={inputClass} /></Field>
        <Field label="Supplier delivery reference"><input name="sourceReference" className={inputClass} /></Field>
        <Field label="Reason"><input required name="reason" className={inputClass} /></Field>
      </div>}
      {mode === 'adjustment' && <div className="grid gap-4 sm:grid-cols-2"><Field label="Material"><select required name="materialId" className={inputClass}><option value="">Select material</option>{materials.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>)}</select></Field><Field label="Location"><select required name="location" className={inputClass}>{locations.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Adjustment type"><select required name="direction" className={inputClass}><option value="in">Increase</option><option value="out">Decrease</option></select></Field><Field label="Quantity"><input required name="quantity" type="number" min="0.000001" step="any" className={inputClass} /></Field><Field label="Date"><input required name="date" type="date" defaultValue={today()} className={inputClass} /></Field><Field label="Reference"><input name="reference" className={inputClass} /></Field><Field label="Reason"><input required name="reason" className={inputClass} /></Field></div>}
      {mode === 'transfer' && <div className="grid gap-4 sm:grid-cols-2"><Field label="Material"><select required name="materialId" className={inputClass}><option value="">Select material</option>{materials.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>)}</select></Field><Field label="Quantity"><input required name="quantity" type="number" min="0.000001" step="any" className={inputClass} /></Field><Field label="From location"><select required name="fromLocation" className={inputClass}>{locations.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="To location"><input required name="toLocation" list="inventory-locations-transfer" className={inputClass} /><datalist id="inventory-locations-transfer">{locations.map((item) => <option key={item} value={item} />)}</datalist></Field><Field label="Date"><input required name="date" type="date" defaultValue={today()} className={inputClass} /></Field><Field label="Reference"><input name="reference" className={inputClass} /></Field><Field label="Reason"><input required name="reason" className={inputClass} /></Field></div>}
      {mode === 'location' && material && <div className="grid gap-4 sm:grid-cols-2"><Field label="Material"><input disabled value={`${material.name} (${material.unit})`} className={inputClass} /></Field><Field label="Store location"><input disabled value={location} className={inputClass} /></Field><Field label="Low-stock threshold"><input required name="reorderThreshold" type="number" min="0" step="any" defaultValue={locationFor(material, location)?.reorderThreshold ?? 0} className={inputClass} /></Field><Field label="Responsible person"><select name="responsibleUserId" defaultValue={locationFor(material, location)?.responsibleUserId ?? ''} className={inputClass}><option value="">Not assigned</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name} · {user.email}</option>)}</select></Field></div>}
      {mode === 'deleteMaterial' && material && <div className="space-y-3">
        <p className="text-sm text-slate-700">Delete <strong>{material.name}</strong> ({material.code}) and all current stock balances?</p>
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          <p>This permanently removes the material profile, {material.balance.toLocaleString()} {material.unit} currently on hand, and its location low-stock settings.</p>
          <p className="mt-2">Historical stock movements and production-use records are retained for audit traceability. Deletion is blocked while a current product recipe or pending production run uses this material.</p>
        </div>
      </div>}
      {message && <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{message}</p>}
      <footer className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={onClose} disabled={pending} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold">Cancel</button><button type="submit" disabled={pending} className={`rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-40 ${mode === 'deleteMaterial' ? 'bg-rose-700 text-white hover:bg-rose-800' : 'bg-primary text-primary-foreground'}`}>{pending ? 'Saving…' : mode === 'material' ? 'Add raw material' : mode === 'editMaterial' ? 'Save changes' : mode === 'deleteMaterial' ? 'Delete material and stock' : 'Save'}</button></footer>
    </form>
  </section></div>
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="px-5 py-14 text-center"><span className="mx-auto grid size-10 place-items-center rounded-full bg-slate-100 text-slate-500"><Icons.Boxes className="size-4" /></span><h4 className="mt-3 text-sm font-semibold text-slate-800">{title}</h4><p className="mx-auto mt-1 max-w-md text-xs text-slate-500">{detail}</p></div>
}
