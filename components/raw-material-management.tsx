'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as Icons from 'lucide-react'
import { createId, exportCsv, exportLegacyRawMaterialMigration, formatDate, money } from '@/lib/erp'
import {
  adjustRawMaterialStock,
  configureRawMaterialLocation,
  createProductionMaterial,
  listInventoryResponsibleUsers,
  listProductionMaterialMovements,
  listProductionMaterialReceipts,
  listProductionMaterialUsages,
  listProductionMaterials,
  listProductionProducts,
  listProductionRuns,
  listRawMaterialAlerts,
  postProductionMaterialUsage,
  receiveProductionMaterial,
  transferRawMaterialStock,
  type ProductionMaterial,
  type ProductionProduct,
  type ProductionRunRecord,
  type RawMaterialAlert,
  type RawMaterialLocationBalance,
  type RawMaterialMovementType,
  type RawMovementRecord,
} from '@/lib/user-api'

type View = 'Inventory' | 'Stock-in history' | 'Daily production use' | 'All movements' | 'Low stock'
type Dialog = 'material' | 'receipt' | 'adjustment' | 'transfer' | 'location' | null
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const inputClass = 'mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 disabled:bg-slate-50 disabled:text-slate-400'
const queryKey = ['raw-material-inventory']

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
  const [selectedRunId, setSelectedRunId] = useState('')
  const [tankCount, setTankCount] = useState('1')
  const [usageLocation, setUsageLocation] = useState('Main Warehouse')
  const [message, setMessage] = useState('')

  const workspace = useQuery({
    queryKey,
    queryFn: async () => {
      const [materials, movements, receipts, products, runs, usages, alerts, users] = await Promise.all([
        listProductionMaterials(),
        listProductionMaterialMovements(),
        listProductionMaterialReceipts(),
        listProductionProducts(),
        listProductionRuns(),
        listProductionMaterialUsages(),
        listRawMaterialAlerts(),
        listInventoryResponsibleUsers(),
      ])
      return {
        materials: materials.materials,
        movements: movements.movements,
        receipts: receipts.movements,
        products: products.products,
        runs: runs.runs,
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
  const runs = data?.runs ?? []
  const usages = data?.usages ?? []
  const alerts = data?.alerts ?? []
  const users = data?.users ?? []
  const locations = [...new Set(materials.flatMap((material) => material.locations.map((balance) => balance.location)))].sort()
  const selectedRun = runs.find((run) => run.id === selectedRunId)
  const selectedProduct = products.find((product) => product.id === selectedRun?.productId)
  const pendingRuns = runs.filter((run) => !usages.some((usage) => usage.productionRunId === run.id))

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
      setSelectedRunId('')
      setTankCount('1')
      await refresh()
    },
    onError: (error: Error) => setMessage(messageFor(error)),
  })

  const submitForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setMessage('')
    if (dialog === 'material') {
      createMaterialMutation.mutate({
        code: String(form.get('code')).trim(),
        name: String(form.get('name')).trim(),
        category: String(form.get('category')).trim(),
        unit: String(form.get('unit')).trim(),
      })
    } else if (dialog === 'receipt') {
      const id = String(form.get('materialId'))
      receiptMutation.mutate({
        id,
        input: {
          quantity: Number(form.get('quantity')),
          date: String(form.get('date')),
          location: String(form.get('location')).trim(),
          reference: String(form.get('reference') || '').trim() || undefined,
          reason: String(form.get('reason')).trim(),
          supplier: String(form.get('supplier')).trim(),
          sourceReference: String(form.get('sourceReference') || '').trim() || undefined,
          unitCost: Number(form.get('unitCost')),
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
    if (!selectedRun || !selectedRecipe.length || !Number.isFinite(tankNumber) || tankNumber <= 0 || insufficientLine) return
    setMessage('')
    usageMutation.mutate({
      productionRunId: selectedRun.id,
      tanksProduced: tankNumber,
      location: usageLocation,
      idempotencyKey: createId('RM-USE'),
    })
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
        lines: receipt.rows.map((movement) => `${movement.materialName}: ${movement.quantity} ${movement.unit}`).join('; '),
        quantity: receipt.quantity, valueUGX: receipt.value,
      })))
    } else if (view === 'Daily production use') {
      exportCsv('daily-raw-material-use.csv', usages.map((usage) => ({
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

  const isPending = createMaterialMutation.isPending || receiptMutation.isPending || adjustmentMutation.isPending || transferMutation.isPending || locationMutation.isPending || usageMutation.isPending
  const dialogTitle = dialog === 'material' ? 'Add raw material' : dialog === 'receipt' ? 'Record stock-in' : dialog === 'adjustment' ? 'Adjust stock' : dialog === 'transfer' ? 'Transfer stock' : 'Low-stock settings'

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
        <div><h3 className="text-sm font-bold">{view}</h3><p className="mt-1 text-xs text-slate-500">{view === 'Daily production use' ? 'Select a posted finished-goods run and enter tanks made; ingredient use is calculated from the saved per-tank recipe.' : view === 'Inventory' ? `${visibleMaterials.length} materials · balances are maintained per location` : view === 'Stock-in history' ? `${receiptGroups.length} receipts` : view === 'Low stock' ? `${alerts.length} notification-ready low-stock alerts · delivery is not enabled` : `${visibleMovements.length} movements`}</p></div>
        {view !== 'Daily production use' && <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><Icons.Search className="size-4 text-slate-400" /><input aria-label={`Search ${view}`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search material or reference" className="w-44 bg-transparent text-xs outline-none" /></label>
          {view === 'Inventory' ? <select aria-label="Filter inventory location" value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"><option>All locations</option>{locations.map((location) => <option key={location}>{location}</option>)}</select> : view !== 'Low stock' && <><select aria-label="Filter movement type" value={movementFilter} onChange={(event) => setMovementFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"><option>All movement types</option>{(['Opening balance', 'Receipt', 'Stock in', 'Stock out', 'Production use', 'Transfer', 'Adjustment increase', 'Adjustment decrease'] as RawMaterialMovementType[]).map((type) => <option key={type}>{type}</option>)}</select><input aria-label="From date" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="rounded-lg border border-slate-200 px-2 py-2 text-xs" /><input aria-label="To date" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="rounded-lg border border-slate-200 px-2 py-2 text-xs" /></>}
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

      {view === 'Inventory' && <InventoryTable materials={visibleMaterials} locationFilter={locationFilter} onConfigure={(material, location) => { setSelectedMaterial(material); setSelectedLocation(location); setDialog('location'); setMessage('') }} />}
      {view === 'Stock-in history' && <ReceiptTable groups={receiptGroups} />}
      {view === 'All movements' && <MovementTable movements={visibleMovements} />}
      {view === 'Low stock' && <AlertTable alerts={alerts.filter((alert) => {
        const materialId = typeof alert.materialId === 'string' ? alert.materialId : alert.materialId.id
        const material = materials.find((item) => item.id === materialId)
        return `${material?.name ?? ''} ${material?.code ?? ''} ${alert.location}`.toLowerCase().includes(search.trim().toLowerCase())
      })} materials={materials} />}
      {view === 'Daily production use' && <ProductionUseView
        runs={pendingRuns}
        selectedRunId={selectedRunId}
        onSelectRun={setSelectedRunId}
        selectedRun={selectedRun}
        product={selectedProduct}
        materials={materials}
        locations={locations}
        location={usageLocation}
        onLocation={setUsageLocation}
        tanks={tankCount}
        onTanks={setTankCount}
        preview={usagePreview}
        insufficient={insufficientLine?.materialName}
        usages={usages}
        onSubmit={submitUsage}
        disabled={usageMutation.isPending}
      />}

      {(message || isPending) && <p role="status" className="border-t border-slate-100 bg-amber-50 px-4 py-3 text-xs text-amber-800">{isPending ? 'Saving inventory change…' : message}</p>}
      <footer className="border-t border-slate-100 px-4 py-3 text-[10px] text-slate-400">Recipe quantities are for one 1,000-litre tank. Raw-material usage is posted once per linked production run; notification delivery will be added in a future phase.</footer>
    </section>

    {dialog && <InventoryDialog
      mode={dialog}
      materials={materials}
      locations={locations}
      users={users}
      material={selectedMaterial}
      location={selectedLocation}
      onClose={() => { if (!isPending) setDialog(null) }}
      onSubmit={submitForm}
      pending={isPending}
    />}
  </div>
}

function InventoryTable({ materials, locationFilter, onConfigure }: { materials: ProductionMaterial[]; locationFilter: string; onConfigure: (material: ProductionMaterial, location: string) => void }) {
  if (!materials.length) return <EmptyState title="No raw materials yet" detail="Add a shared raw material, then record stock receipts to establish its balance." />
  const rows = materials.flatMap((material) => {
    const balances = locationFilter === 'All locations'
      ? material.locations
      : material.locations.filter((balance) => balance.location === locationFilter)
    return balances.map((balance) => ({ material, balance }))
  })
  if (!rows.length) return <EmptyState title="No stock configured at this location" detail="Receive or transfer stock to this location to add a balance record." />
  return <div className="overflow-x-auto"><table className="w-full min-w-230 text-left text-xs"><thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-400"><tr>{['Code', 'Material', 'Category', 'Location', 'Available', 'Reorder level', 'Responsible', 'Status', ''].map((label) => <th key={label} className="px-3 py-3">{label}</th>)}</tr></thead><tbody>{rows.map(({ material, balance }) => {
    const status = stockStatus(balance)
    return <tr key={`${material.id}-${balance.location}`} className="border-t border-slate-100 text-slate-600"><td className="px-3 py-3 font-mono">{material.code}</td><td className="px-3 py-3 font-semibold text-slate-800">{material.name}<span className="mt-1 block text-[10px] font-normal text-slate-400">{material.unit}</span></td><td className="px-3 py-3">{material.category}</td><td className="px-3 py-3">{balance.location}</td><td className="px-3 py-3 font-bold">{balance.quantity.toLocaleString()} {material.unit}</td><td className="px-3 py-3">{balance.reorderThreshold.toLocaleString()} {material.unit}</td><td className="px-3 py-3">{balance.responsibleUserName ?? 'Not assigned'}</td><td className="px-3 py-3"><span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${statusClass(status)}`}>{status}</span></td><td className="px-3 py-3"><button type="button" onClick={() => onConfigure(material, balance.location)} className="rounded-md border border-slate-200 px-2 py-1.5 font-semibold">Threshold / owner</button></td></tr>
  })}</tbody></table></div>
}

function ReceiptTable({ groups }: { groups: Array<{ reference: string; rows: RawMovementRecord[]; date: string; supplier: string; location: string; quantity: number; value: number }> }) {
  if (!groups.length) return <EmptyState title="No stock receipts yet" detail="Receipts you post will appear here grouped by receipt reference." />
  return <div className="overflow-x-auto"><table className="w-full min-w-180 text-left text-xs"><thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-400"><tr>{['Receipt reference', 'Date', 'Supplier', 'Material lines', 'Quantity in', 'Value', 'Location'].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{groups.map((group) => <tr key={group.reference} className="border-t border-slate-100"><td className="px-4 py-3 font-semibold">{group.reference}</td><td className="px-4 py-3">{formatDate(group.date)}</td><td className="px-4 py-3">{group.supplier}</td><td className="px-4 py-3">{group.rows.map((row) => `${row.materialName}: ${row.quantity} ${row.unit}`).join('; ')}</td><td className="px-4 py-3">{group.quantity.toLocaleString()}</td><td className="px-4 py-3">{money(group.value)}</td><td className="px-4 py-3">{group.location || '—'}</td></tr>)}</tbody></table></div>
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

function ProductionUseView({ runs, selectedRunId, onSelectRun, selectedRun, product, materials, locations, location, onLocation, tanks, onTanks, preview, insufficient, usages, onSubmit, disabled }: {
  runs: ProductionRunRecord[]
  selectedRunId: string
  onSelectRun: (value: string) => void
  selectedRun?: ProductionRunRecord
  product?: ProductionProduct
  materials: ProductionMaterial[]
  locations: string[]
  location: string
  onLocation: (value: string) => void
  tanks: string
  onTanks: (value: string) => void
  preview: Array<{ materialId: string; materialName: string; unit: string; quantityPerTank: number; total: number; available: number }>
  insufficient?: string
  usages: Array<{ id: string; reference: string; productionRunId: string; productName: string; productionDate: string; tanksProduced: number; tankVolumeLitres: 1000; location: string; recipeVersion: number; lines: Array<{ materialName: string; unit: string; totalQuantity: number }> }>
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  disabled: boolean
}) {
  return <div className="space-y-5 p-4">
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div><h3 className="text-sm font-bold">Record daily tank production use</h3><p className="mt-1 text-xs text-slate-500">First post the matching finished-goods production record in Production Management. This form records raw-material use once for that run.</p></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Posted production run"><select required value={selectedRunId} onChange={(event) => onSelectRun(event.target.value)} className={inputClass}><option value="">Select a run</option>{runs.map((run) => <option key={run.id} value={run.id}>{formatDate(run.productionDate)} · {run.productName} · {run.reference}</option>)}</select></Field>
        <Field label="Tanks made (1 tank = 1,000 litres)"><input required type="number" min="0.000001" step="any" value={tanks} onChange={(event) => onTanks(event.target.value)} className={inputClass} /></Field>
        <Field label="Raw-material store location"><select required value={location} onChange={(event) => onLocation(event.target.value)} className={inputClass}><option value="">Select location</option>{locations.map((item) => <option key={item}>{item}</option>)}</select></Field>
      </div>
      {selectedRun && (!selectedRun.recipeId || !product?.recipe) && <p role="alert" className="text-xs text-rose-700">This run has no recipe snapshot. Save a per-tank recipe before posting its material use.</p>}
      {selectedRun && product?.recipe && <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white"><table className="w-full min-w-140 text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase text-slate-400"><tr>{['Ingredient', 'Per 1,000-litre tank', `Total for ${Number(tanks) || 0} tank(s)`, 'Available at selected store'].map((label) => <th key={label} className="px-3 py-2.5">{label}</th>)}</tr></thead><tbody>{preview.map((line) => <tr key={line.materialId} className="border-t border-slate-100"><td className="px-3 py-2.5 font-semibold">{line.materialName}</td><td className="px-3 py-2.5">{line.quantityPerTank.toLocaleString()} {line.unit}</td><td className="px-3 py-2.5 font-bold">{line.total.toLocaleString()} {line.unit}</td><td className={`px-3 py-2.5 ${line.available < line.total ? 'font-semibold text-rose-700' : 'text-emerald-700'}`}>{line.available.toLocaleString()} {line.unit}</td></tr>)}</tbody></table></div>}
      {insufficient && <p role="alert" className="text-xs font-semibold text-rose-700">Insufficient {insufficient} stock at {location}; posting is blocked.</p>}
      <button type="submit" disabled={disabled || !selectedRun || !product?.recipe || !preview.length || Boolean(insufficient) || !Number.isFinite(Number(tanks)) || Number(tanks) <= 0} className="rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-40">{disabled ? 'Posting use…' : 'Post raw-material use'}</button>
    </form>
    <section><h3 className="mb-2 text-sm font-bold">Daily production-use history</h3>{usages.length ? <div className="overflow-x-auto"><table className="w-full min-w-190 text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase text-slate-400"><tr>{['Date', 'Reference', 'Product', 'Tanks', 'Store', 'Ingredients consumed', 'Recipe version'].map((label) => <th key={label} className="px-3 py-3">{label}</th>)}</tr></thead><tbody>{usages.map((usage) => <tr key={usage.id} className="border-t border-slate-100"><td className="px-3 py-3">{formatDate(usage.productionDate)}</td><td className="px-3 py-3 font-semibold">{usage.reference}</td><td className="px-3 py-3">{usage.productName}</td><td className="px-3 py-3">{usage.tanksProduced}</td><td className="px-3 py-3">{usage.location}</td><td className="px-3 py-3">{usage.lines.map((line) => `${line.materialName}: ${line.totalQuantity} ${line.unit}`).join('; ')}</td><td className="px-3 py-3">v{usage.recipeVersion}</td></tr>)}</tbody></table></div> : <EmptyState title="No production use recorded" detail="Linked tank-use records will appear here after posting." />}</section>
  </div>
}

function InventoryDialog({ mode, materials, locations, users, material, location, onClose, onSubmit, pending }: {
  mode: Exclude<Dialog, null>
  materials: ProductionMaterial[]
  locations: string[]
  users: Array<{ id: string; name: string; email: string }>
  material: ProductionMaterial | null
  location: string
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  pending: boolean
}) {
  const title = mode === 'material' ? 'Add raw material' : mode === 'receipt' ? 'Record stock-in' : mode === 'adjustment' ? 'Adjust stock' : mode === 'transfer' ? 'Transfer stock' : 'Low-stock settings'
  return <div className="fixed inset-0 z-80 grid place-items-center bg-slate-950/45 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) onClose() }}><section role="dialog" aria-modal="true" aria-labelledby="inventory-dialog-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl">
    <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 id="inventory-dialog-title" className="text-base font-bold">{title}</h2><p className="mt-1 text-xs text-slate-500">{mode === 'location' ? 'Alerts are stored for future notification delivery; no notifications are sent yet.' : 'Posted movements are retained in the inventory history.'}</p></div><button type="button" aria-label="Close form" onClick={onClose} disabled={pending} className="grid size-8 place-items-center rounded-md text-slate-400"><Icons.X className="size-4" /></button></header>
    <form onSubmit={onSubmit} className="space-y-4 p-5">
      {mode === 'material' && <div className="grid gap-4 sm:grid-cols-2"><Field label="Material code"><input required name="code" className={inputClass} /></Field><Field label="Material name"><input required name="name" className={inputClass} /></Field><Field label="Category"><input required name="category" defaultValue="Ingredients" className={inputClass} /></Field><Field label="Base unit"><input required name="unit" placeholder="kg, L, pcs" className={inputClass} /></Field></div>}
      {mode === 'receipt' && <div className="grid gap-4 sm:grid-cols-2"><Field label="Material"><select required name="materialId" className={inputClass}><option value="">Select material</option>{materials.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>)}</select></Field><Field label="Quantity"><input required name="quantity" type="number" min="0.000001" step="any" className={inputClass} /></Field><Field label="Destination location"><input required name="location" list="inventory-locations" defaultValue={locations[0] ?? 'Main Warehouse'} className={inputClass} /><datalist id="inventory-locations">{locations.map((item) => <option key={item} value={item} />)}</datalist></Field><Field label="Receipt date"><input required name="date" type="date" defaultValue={today()} className={inputClass} /></Field><Field label="Supplier"><input required name="supplier" className={inputClass} /></Field><Field label="Unit cost (UGX)"><input required name="unitCost" type="number" min="0" step="any" defaultValue="0" className={inputClass} /></Field><Field label="Receipt reference"><input name="reference" className={inputClass} /></Field><Field label="Supplier delivery reference"><input name="sourceReference" className={inputClass} /></Field><Field label="Reason"><input required name="reason" className={inputClass} /></Field></div>}
      {mode === 'adjustment' && <div className="grid gap-4 sm:grid-cols-2"><Field label="Material"><select required name="materialId" className={inputClass}><option value="">Select material</option>{materials.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>)}</select></Field><Field label="Location"><select required name="location" className={inputClass}>{locations.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Adjustment type"><select required name="direction" className={inputClass}><option value="in">Increase</option><option value="out">Decrease</option></select></Field><Field label="Quantity"><input required name="quantity" type="number" min="0.000001" step="any" className={inputClass} /></Field><Field label="Date"><input required name="date" type="date" defaultValue={today()} className={inputClass} /></Field><Field label="Reference"><input name="reference" className={inputClass} /></Field><Field label="Reason"><input required name="reason" className={inputClass} /></Field></div>}
      {mode === 'transfer' && <div className="grid gap-4 sm:grid-cols-2"><Field label="Material"><select required name="materialId" className={inputClass}><option value="">Select material</option>{materials.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>)}</select></Field><Field label="Quantity"><input required name="quantity" type="number" min="0.000001" step="any" className={inputClass} /></Field><Field label="From location"><select required name="fromLocation" className={inputClass}>{locations.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="To location"><input required name="toLocation" list="inventory-locations-transfer" className={inputClass} /><datalist id="inventory-locations-transfer">{locations.map((item) => <option key={item} value={item} />)}</datalist></Field><Field label="Date"><input required name="date" type="date" defaultValue={today()} className={inputClass} /></Field><Field label="Reference"><input name="reference" className={inputClass} /></Field><Field label="Reason"><input required name="reason" className={inputClass} /></Field></div>}
      {mode === 'location' && material && <div className="grid gap-4 sm:grid-cols-2"><Field label="Material"><input disabled value={`${material.name} (${material.unit})`} className={inputClass} /></Field><Field label="Store location"><input disabled value={location} className={inputClass} /></Field><Field label="Low-stock threshold"><input required name="reorderThreshold" type="number" min="0" step="any" defaultValue={locationFor(material, location)?.reorderThreshold ?? 0} className={inputClass} /></Field><Field label="Responsible person"><select name="responsibleUserId" defaultValue={locationFor(material, location)?.responsibleUserId ?? ''} className={inputClass}><option value="">Not assigned</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name} · {user.email}</option>)}</select></Field></div>}
      <footer className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={onClose} disabled={pending} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold">Cancel</button><button type="submit" disabled={pending} className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40">{pending ? 'Saving…' : 'Save'}</button></footer>
    </form>
  </section></div>
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="px-5 py-14 text-center"><span className="mx-auto grid size-10 place-items-center rounded-full bg-slate-100 text-slate-500"><Icons.Boxes className="size-4" /></span><h4 className="mt-3 text-sm font-semibold text-slate-800">{title}</h4><p className="mx-auto mt-1 max-w-md text-xs text-slate-500">{detail}</p></div>
}
