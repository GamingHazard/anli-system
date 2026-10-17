'use client'

import { useMemo, useState } from 'react'
import * as Icons from 'lucide-react'
import { createId, exportCsv, formatDate, money, stockQuantityAtLocation, stockUnitCost, stockValue, type ErpState, type ProductionRun, type RawMaterial, type StockMovement, type StockMovementType } from '@/lib/erp'

type Props = { state: ErpState; updateState: (next: ErpState) => void }
type View = 'Inventory' | 'Stock-in history' | 'Production use' | 'All movements'
type MovementForm = 'Stock in' | 'Transfer' | 'Adjustment increase' | 'Adjustment decrease' | null
type DialogMode = MovementForm | 'Add material' | null
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const systemActor = 'Sarah Namirembe'

function statusFor(quantity: number, threshold: number) {
  if (quantity <= 0) return 'Out of stock'
  if (quantity <= threshold) return 'Low stock'
  return 'In stock'
}

function toneFor(status: string) {
  return status === 'In stock' ? 'bg-emerald-50 text-emerald-700' : status === 'Low stock' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
}

function Metric({ label, value, detail, icon, tone }: { label: string; value: string; detail: string; icon: string; tone: 'purple' | 'amber' | 'rose' | 'blue' }) {
  const Icon = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[icon] ?? Icons.Boxes
  const iconTone = tone === 'purple' ? 'bg-secondary text-primary' : tone === 'amber' ? 'bg-amber-50 text-amber-700' : tone === 'rose' ? 'bg-rose-50 text-rose-700' : 'bg-sky-50 text-sky-700'
  return <article className="rounded-lg border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><span className={`grid size-9 place-items-center rounded-md ${iconTone}`}><Icon className="size-4" /></span><span className="text-[9px] font-semibold uppercase text-slate-400">Live</span></div><div className="mt-3 text-xl font-bold tracking-tight text-slate-900">{value}</div><h3 className="mt-0.5 text-xs font-semibold text-slate-700">{label}</h3><p className="mt-1 text-[10px] text-slate-500">{detail}</p></article>
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={`block text-xs font-semibold text-slate-600 ${wide ? 'sm:col-span-2' : ''}`}>{label}{children}</label>
}

const inputClass = 'mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-ring/30'

export default function RawMaterialManagement({ state, updateState }: Props) {
  const [view, setView] = useState<View>('Inventory')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All categories')
  const [location, setLocation] = useState('All locations')
  const [stockState, setStockState] = useState('All stock levels')
  const [movementType, setMovementType] = useState('All movement types')
  const [movementLocation, setMovementLocation] = useState('All locations')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [dialog, setDialog] = useState<DialogMode>(null)
  const [selectedMaterial, setSelectedMaterial] = useState<RawMaterial | null>(null)
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null)
  const [selectedProduction, setSelectedProduction] = useState<ProductionRun | null>(null)
  const [message, setMessage] = useState('')

  const locations = [...new Set([...state.materials.map((material) => material.location), ...state.stockMovements.flatMap((movement) => [movement.fromLocation, movement.toLocation])].filter((value): value is string => Boolean(value)))].sort()
  const categories = [...new Set(state.materials.map((material) => material.category))].sort()
  const inventory = state.materials.map((material) => {
    const quantity = Math.max(0, stockQuantityAtLocation(material.id, state.stockMovements, location === 'All locations' ? undefined : location))
    const cost = stockUnitCost(material, state.stockMovements)
    const heldLocations = locations.filter((item) => stockQuantityAtLocation(material.id, state.stockMovements, item) > 0)
    return { material, quantity, cost, value: quantity * cost, heldLocations, status: statusFor(quantity, material.threshold) }
  })
  const lowStock = inventory.filter((item) => item.quantity > 0 && item.quantity <= item.material.threshold).length
  const outOfStock = inventory.filter((item) => item.quantity <= 0).length
  const month = today().slice(0, 7)
  const receiptsThisMonth = state.stockMovements.filter((movement) => movement.type === 'Stock in' && movement.date.startsWith(month))
  const receivedThisMonth = receiptsThisMonth.reduce((total, movement) => total + movement.quantity * (movement.unitCost ?? 0), 0)
  const visibleInventory = inventory.filter(({ material, quantity, status, heldLocations }) => {
    const text = `${material.name} ${material.code} ${material.category} ${material.unit} ${heldLocations.join(' ')}`.toLowerCase()
    return text.includes(search.trim().toLowerCase())
      && (category === 'All categories' || material.category === category)
      && (location === 'All locations' || heldLocations.includes(location) || (quantity === 0 && material.location === location))
      && (stockState === 'All stock levels' || status === stockState)
  }).sort((left, right) => left.material.name.localeCompare(right.material.name))
  const visibleMovements = useMemo(() => state.stockMovements.filter((movement) => {
    const material = state.materials.find((item) => item.id === movement.materialId)
    const text = `${movement.reference} ${movement.receiptReference ?? ''} ${movement.supplier ?? ''} ${movement.sourceReference ?? ''} ${movement.reason ?? ''} ${material?.name ?? ''} ${material?.code ?? ''}`.toLowerCase()
        return text.includes(search.trim().toLowerCase()) &&
          (movementType === 'All movement types' || movement.type === movementType) &&
          (movementLocation === 'All locations' || movement.fromLocation === movementLocation || movement.toLocation === movementLocation) &&
          (!dateFrom || movement.date >= dateFrom) &&
          (!dateTo || movement.date <= dateTo)
  }).sort((left, right) => right.date.localeCompare(left.date) || right.recordedAt.localeCompare(left.recordedAt)), [state.stockMovements, state.materials, search, movementType, movementLocation, dateFrom, dateTo])

  const receiptGroups = useMemo(() => {
    const groups = new Map<string, StockMovement[]>()
    state.stockMovements.filter((movement) => movement.type === 'Stock in').forEach((movement) => {
      const reference = movement.receiptReference || movement.reference
      groups.set(reference, [...(groups.get(reference) ?? []), movement])
    })
    return [...groups.entries()].map(([reference, rows]) => ({
      reference,
      rows: rows.sort((left, right) => left.materialId.localeCompare(right.materialId)),
      date: rows.reduce((latest, row) => row.date > latest ? row.date : latest, ''),
      supplier: rows.find((row) => row.supplier)?.supplier ?? 'Not recorded',
      location: [...new Set(rows.map((row) => row.toLocation).filter(Boolean))].join(', '),
      quantity: rows.reduce((total, row) => total + row.quantity, 0),
      value: rows.reduce((total, row) => total + row.quantity * (row.unitCost ?? 0), 0),
    })).filter((group) => {
      const searchText = `${group.reference} ${group.supplier} ${group.rows.map((row) => state.materials.find((material) => material.id === row.materialId)?.name ?? '').join(' ')}`.toLowerCase()
      const matchesDate = group.rows.some((row) => (!dateFrom || row.date >= dateFrom) && (!dateTo || row.date <= dateTo))
      const matchesLocation = movementLocation === 'All locations' || group.rows.some((row) => row.toLocation === movementLocation)
      const matchesType = movementType === 'All movement types' || movementType === 'Stock in'
      return searchText.includes(search.trim().toLowerCase()) && matchesDate && matchesLocation && matchesType
    }).sort((left, right) => right.date.localeCompare(left.date))
  }, [state.stockMovements, state.materials, search, movementLocation, movementType, dateFrom, dateTo])

  const saveState = (materials: RawMaterial[], movements: StockMovement[]) => {
    const nextMaterials = materials.map((material) => ({
      ...material,
      quantity: Math.max(0, stockQuantityAtLocation(material.id, movements)),
      cost: stockUnitCost(material, movements),
    }))
    updateState({ ...state, materials: nextMaterials, stockMovements: movements })
  }

  const saveMaterial = (form: FormData) => {
    const code = String(form.get('code') || '').trim()
    const name = String(form.get('name') || '').trim()
    const unit = String(form.get('unit') || '').trim()
    const category = String(form.get('category') || '').trim()
    const location = String(form.get('location') || '').trim()
    const threshold = Number(form.get('threshold'))
    const quantity = Number(form.get('openingQuantity') || 0)
    const cost = Number(form.get('cost') || 0)
    if (!code || !name || !unit || !category || !location || !Number.isFinite(threshold) || threshold < 0 || !Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(cost) || cost < 0) {
      setMessage('Enter a code, name, category, unit, location, and valid non-negative stock values.')
      return false
    }
    if (state.materials.some((material) => material.code.toLowerCase() === code.toLowerCase())) {
      setMessage(`Material code ${code} is already in use.`)
      return false
    }
    const now = new Date().toISOString()
    const material: RawMaterial = {
      id: createId('RM'), code, name, category,
      quantity: 0, unit, threshold, cost, location,
    }
    const opening: StockMovement[] = quantity > 0 ? [{
      id: createId('MOV'), reference: createId('OPEN'), materialId: material.id, type: 'Opening balance', quantity,
      unit: material.unit, date: String(form.get('date') || today()), recordedAt: now, toLocation: material.location,
      unitCost: cost, reason: 'Opening stock', actor: systemActor,
    }] : []
    saveState([material, ...state.materials], [...state.stockMovements, ...opening])
    setDialog(null)
    setMessage('Material added to inventory.')
    return true
  }

  const saveMovement = (form: FormData, mode: Exclude<MovementForm, null>) => {
    const date = String(form.get('date') || '')
    if (mode === 'Stock in') {
      let lines: Array<{ materialId: string; quantity: number; unitCost: number }>
      try {
        lines = JSON.parse(String(form.get('lines') || '[]')) as Array<{ materialId: string; quantity: number; unitCost: number }>
      } catch {
        setMessage('Add at least one valid material line to this receipt.')
        return false
      }
      const supplier = String(form.get('supplier') || '').trim()
      const toLocation = String(form.get('toLocation') || '').trim()
      if (!date || !supplier || !toLocation || !lines.length || lines.some((line) => !state.materials.some((item) => item.id === line.materialId) || !Number.isFinite(line.quantity) || line.quantity <= 0 || !Number.isFinite(line.unitCost) || line.unitCost < 0)) {
        setMessage('Enter a supplier, destination, date, and valid positive quantity and cost for every receipt line.')
        return false
      }
      const now = new Date().toISOString()
      const reference = String(form.get('reference') || '').trim() || createId('GRN')
      const sourceReference = String(form.get('sourceReference') || '').trim() || undefined
      const receiptMovements: StockMovement[] = lines.map((line) => {
        const material = state.materials.find((item) => item.id === line.materialId)!
        return {
          id: createId('MOV'), reference, receiptReference: reference, materialId: material.id, type: 'Stock in',
          quantity: line.quantity, unit: material.unit, date, recordedAt: now, toLocation, supplier, sourceReference,
          unitCost: line.unitCost, actor: systemActor,
        }
      })
      saveState(state.materials, [...receiptMovements, ...state.stockMovements])
      setDialog(null)
      setMessage(`Stock receipt ${reference} recorded with ${receiptMovements.length} line${receiptMovements.length === 1 ? '' : 's'}.`)
      return true
    }
    const materialId = String(form.get('materialId') || '')
    const material = state.materials.find((item) => item.id === materialId)
    const quantity = Number(form.get('quantity'))
    const fromLocation = String(form.get('fromLocation') || '')
    const toLocation = String(form.get('toLocation') || '')
    if (!material || !Number.isFinite(quantity) || quantity <= 0 || !date) {
      setMessage('Select a material and enter a valid positive quantity and date.')
      return false
    }
    if (['Transfer', 'Adjustment decrease'].includes(mode) && stockQuantityAtLocation(material.id, state.stockMovements, fromLocation) < quantity) {
      setMessage(`Only ${stockQuantityAtLocation(material.id, state.stockMovements, fromLocation)} ${material.unit} is available at ${fromLocation}.`)
      return false
    }
    if (mode === 'Transfer' && fromLocation === toLocation) {
      setMessage('Choose different source and destination locations.')
      return false
    }
    const now = new Date().toISOString()
    const reference = String(form.get('reference') || '').trim() || createId('MOV')
    const movement: StockMovement = {
      id: createId('MOV'), reference,
      materialId, type: mode as StockMovementType, quantity, unit: material.unit, date, recordedAt: now,
      fromLocation: ['Transfer', 'Adjustment decrease'].includes(mode) ? fromLocation : undefined,
      toLocation: ['Stock in', 'Transfer', 'Adjustment increase'].includes(mode) ? toLocation : undefined,
      supplier: undefined,
      sourceReference: String(form.get('sourceReference') || '').trim() || undefined,
      unitCost: undefined,
      reason: String(form.get('reason') || '').trim() || undefined,
      actor: systemActor,
    }
    saveState(state.materials, [movement, ...state.stockMovements])
    setDialog(null)
    setMessage(`${mode} recorded for ${material.name}.`)
    return true
  }

  const exportInventory = () => exportCsv('raw-material-inventory.csv', visibleInventory.map(({ material, quantity, cost, value, status, heldLocations }) => ({
    code: material.code, name: material.name, category: material.category, quantity, unit: material.unit,
    reorderLevel: material.threshold, locations: heldLocations.join(', ') || material.location, unitCostUGX: cost, stockValueUGX: value, status,
  })))
  const exportMovements = () => exportCsv('stock-movements.csv', visibleMovements.map((movement) => ({
    date: movement.date, reference: movement.reference, receiptReference: movement.receiptReference ?? '',
    material: state.materials.find((material) => material.id === movement.materialId)?.name ?? movement.materialId,
    type: movement.type, quantity: movement.quantity, unit: movement.unit, fromLocation: movement.fromLocation ?? '',
    toLocation: movement.toLocation ?? '', supplier: movement.supplier ?? '', sourceReference: movement.sourceReference ?? '',
    unitCostUGX: movement.unitCost ?? '', reason: movement.reason ?? '', actor: movement.actor,
  })))
  const exportReceipts = () => exportCsv('stock-in-history.csv', receiptGroups.map((receipt) => ({
    receiptReference: receipt.reference, date: receipt.date, supplier: receipt.supplier, lines: receipt.rows.length,
    quantity: receipt.quantity, destination: receipt.location, valueUGX: receipt.value,
    materials: receipt.rows.map((movement) => `${state.materials.find((material) => material.id === movement.materialId)?.name ?? movement.materialId}: ${movement.quantity} ${movement.unit}`).join('; '),
  })))
  const exportProduction = () => exportCsv('production-use-history.csv', state.productionRuns.filter((run) => `${run.reference} ${run.productName}`.toLowerCase().includes(search.trim().toLowerCase()) && (!dateFrom || run.productionDate >= dateFrom) && (!dateTo || run.productionDate <= dateTo)).map((run) => ({
    date: run.productionDate, reference: run.reference, product: run.productName, tankCount: run.tankCount, location: run.location,
    ingredients: run.lines.map((line) => `${line.materialName}: ${line.totalQuantity} ${line.unit}`).join('; '), actor: run.actor,
  })))
  const exportCurrentView = () => view === 'Inventory' ? exportInventory() : view === 'Stock-in history' ? exportReceipts() : view === 'Production use' ? exportProduction() : exportMovements()

  return <div className="animate-in fade-in duration-300">
    <header className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="mb-2 text-xs font-medium text-slate-400">Workspace / Inventory Department</div><h2 className="text-2xl font-bold tracking-tight">Raw material management</h2><p className="mt-1 text-sm text-slate-500">Store balances and production consumption history.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={exportCurrentView} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Icons.Download className="size-4" /> Export {view === 'Inventory' ? 'inventory' : view === 'Stock-in history' ? 'receipts' : view === 'Production use' ? 'production use' : 'movements'}</button><button type="button" onClick={() => { setMessage(''); setDialog('Add material') }} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Icons.PackagePlus className="size-4" /> Add material</button><button type="button" onClick={() => { setMessage(''); setDialog('Stock in') }} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Icons.ArrowDownToLine className="size-4" /> Stock in</button><button type="button" onClick={() => { setMessage(''); setDialog('Transfer') }} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Icons.ArrowLeftRight className="size-4" /> Transfer / adjust</button></div></header>

    <section aria-label="Inventory summary" className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Stock value" value={money(stockValue(state.materials, state.stockMovements))} detail="Current weighted average value · UGX" icon="Coins" tone="purple" /><Metric label="Low stock" value={String(lowStock)} detail="At or below reorder level" icon="TriangleAlert" tone="amber" /><Metric label="Out of stock" value={String(outOfStock)} detail="No available quantity" icon="PackageX" tone="rose" /><Metric label="Received this month" value={money(receivedThisMonth)} detail={`${receiptsThisMonth.length} receipt line${receiptsThisMonth.length === 1 ? '' : 's'} · transfer excluded`} icon="PackageCheck" tone="blue" /></section>

    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div role="tablist" aria-label="Inventory views" className="flex gap-1 overflow-x-auto border-b border-slate-200 px-4 pt-2">{(['Inventory', 'Stock-in history', 'Production use', 'All movements'] as View[]).map((item) => <button key={item} type="button" role="tab" aria-selected={view === item} onClick={() => setView(item)} className={`shrink-0 border-b-2 px-3 py-3 text-xs font-semibold ${view === item ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{item}<span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] ${view === item ? 'bg-secondary text-secondary-foreground' : 'bg-slate-100 text-slate-500'}`}>{item === 'Inventory' ? state.materials.length : item === 'Stock-in history' ? new Set(state.stockMovements.filter((movement) => movement.type === 'Stock in').map((movement) => movement.receiptReference || movement.reference)).size : item === 'Production use' ? state.productionRuns.length : state.stockMovements.length}</span></button>)}</div>

      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 xl:flex-row xl:items-center xl:justify-between"><div><h3 className="text-sm font-bold">{view}</h3><p className="mt-1 text-xs text-slate-500">{view === 'Inventory' ? `${visibleInventory.length} materials · balances are derived from movements` : view === 'Stock-in history' ? `${receiptGroups.length} receipts · grouped by receipt reference` : view === 'Production use' ? `${state.productionRuns.length} production runs · ingredient use calculated from saved recipes` : `${visibleMovements.length} recorded movements`}</p></div><div className="flex flex-wrap gap-2"><label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><Icons.Search className="size-4 text-slate-400" /><input aria-label={`Search ${view.toLowerCase()}`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={view === 'Production use' ? 'Search product or run' : 'Search material or reference'} className="w-44 bg-transparent text-xs outline-none" /></label>{view === 'Inventory' ? <><select aria-label="Filter materials by category" value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><option>All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Filter materials by location" value={location} onChange={(event) => setLocation(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><option>All locations</option>{locations.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Filter materials by stock level" value={stockState} onChange={(event) => setStockState(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><option>All stock levels</option><option>In stock</option><option>Low stock</option><option>Out of stock</option></select></> : <><select aria-label="Filter movements by type" value={movementType} onChange={(event) => setMovementType(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><option>All movement types</option>{(['Opening balance', 'Stock in', 'Stock out', 'Production use', 'Transfer', 'Adjustment increase', 'Adjustment decrease'] as StockMovementType[]).map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Filter movements by location" value={movementLocation} onChange={(event) => setMovementLocation(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><option>All locations</option>{locations.map((item) => <option key={item}>{item}</option>)}</select><label className="sr-only" htmlFor="movement-from-date">Movements from date</label><input id="movement-from-date" aria-label="Movements from date" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="rounded-lg border border-slate-200 px-2 py-2 text-xs" /><label className="sr-only" htmlFor="movement-to-date">Movements to date</label><input id="movement-to-date" aria-label="Movements to date" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="rounded-lg border border-slate-200 px-2 py-2 text-xs" /></>}</div></div>

      {view === 'Inventory' ? <InventoryTable rows={visibleInventory} onSelect={setSelectedMaterial} /> : view === 'Stock-in history' ? <ReceiptTable groups={receiptGroups} materials={state.materials} onSelect={setSelectedReceipt} /> : view === 'Production use' ? <ProductionTable runs={state.productionRuns.filter((run) => `${run.reference} ${run.productName}`.toLowerCase().includes(search.trim().toLowerCase()) && (!dateFrom || run.productionDate >= dateFrom) && (!dateTo || run.productionDate <= dateTo))} onSelect={setSelectedProduction} /> : <MovementTable movements={visibleMovements} materials={state.materials} />}
      <footer className="border-t border-slate-100 px-4 py-3 text-[10px] text-slate-400">Stock value uses weighted average cost. Recipe setup is temporary here until the Production page owns product setup.</footer>
    </section>

    {dialog && <InventoryDialog mode={dialog as Exclude<MovementForm, null> | 'Add material'} materials={state.materials} movements={state.stockMovements} locations={locations} message={message} onClose={() => setDialog(null)} onSubmit={(form, movement) => dialog === 'Add material' ? saveMaterial(form) : saveMovement(form, movement)} />}
    {selectedMaterial && <MaterialDetails material={selectedMaterial} movements={state.stockMovements.filter((movement) => movement.materialId === selectedMaterial.id).sort((left, right) => right.date.localeCompare(left.date) || right.recordedAt.localeCompare(left.recordedAt))} locations={locations} movementsAll={state.stockMovements} onClose={() => setSelectedMaterial(null)} />}
    {selectedReceipt && <ReceiptDetails reference={selectedReceipt} movements={state.stockMovements.filter((movement) => movement.type === 'Stock in' && (movement.receiptReference || movement.reference) === selectedReceipt)} materials={state.materials} onClose={() => setSelectedReceipt(null)} />}
    {selectedProduction && <ProductionDetails run={selectedProduction} onClose={() => setSelectedProduction(null)} />}
  </div>
}

function InventoryTable({ rows, onSelect }: { rows: Array<{ material: RawMaterial; quantity: number; cost: number; value: number; status: string; heldLocations: string[] }>; onSelect: (material: RawMaterial) => void }) {
  if (!rows.length) return <EmptyState title="No materials found" detail="Try changing the filters, or add a material to begin tracking store stock." />
  return <div className="overflow-x-auto"><table className="w-full min-w-225 text-left text-xs"><thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-400"><tr>{['Material', 'Category', 'On hand', 'Reorder level', 'Location', 'Unit cost', 'Stock value', 'Status', ''].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{rows.map(({ material, quantity, cost, value, status, heldLocations }) => <tr key={material.id} className="border-t border-slate-100 text-slate-600 hover:bg-slate-50/70"><td className="px-4 py-3"><button type="button" onClick={() => onSelect(material)} className="text-left font-semibold text-primary hover:underline">{material.name}</button><span className="mt-1 block font-mono text-[10px] text-slate-400">{material.code}</span></td><td className="px-4 py-3">{material.category}</td><td className="px-4 py-3 font-semibold text-slate-800">{quantity.toLocaleString()} {material.unit}</td><td className="px-4 py-3">{material.threshold.toLocaleString()} {material.unit}</td><td className="max-w-40 px-4 py-3"><span className="block truncate">{heldLocations.length ? heldLocations.join(', ') : material.location}</span></td><td className="px-4 py-3 whitespace-nowrap">{money(cost)}</td><td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">{money(value)}</td><td className="px-4 py-3"><span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${toneFor(status)}`}>{status}</span></td><td className="px-4 py-3"><button type="button" onClick={() => onSelect(material)} aria-label={`View ${material.name} movement history`} className="grid size-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100"><Icons.ChevronRight className="size-4" /></button></td></tr>)}</tbody></table></div>
}

function ProductionTable({ runs, onSelect }: { runs: ProductionRun[]; onSelect: (run: ProductionRun) => void }) {
  if (!runs.length) return <EmptyState title="No production runs recorded" detail="Set up a product recipe, then enter daily tank output to calculate and deduct ingredient usage." />
  return <div className="overflow-x-auto"><table className="w-full min-w-180 text-left text-xs"><thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-400"><tr>{['Date', 'Run reference', 'Product', 'Produced', 'Ingredients consumed', 'Store', 'Recorded by', ''].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{runs.map((run) => <tr key={run.id} className="border-t border-slate-100 text-slate-600 hover:bg-slate-50/70"><td className="px-4 py-3 whitespace-nowrap">{formatDate(run.productionDate)}</td><td className="px-4 py-3 font-semibold text-slate-800">{run.reference}</td><td className="px-4 py-3 font-semibold">{run.productName}</td><td className="px-4 py-3">{(run.producedQuantity ?? run.tankCount).toLocaleString()} {run.productUnit ?? 'unit'}</td><td className="px-4 py-3">{run.lines.length} ingredient lines</td><td className="px-4 py-3">{run.location}</td><td className="px-4 py-3">{run.actor}</td><td className="px-4 py-3"><button type="button" onClick={() => onSelect(run)} aria-label={`View production run ${run.reference}`} className="grid size-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100"><Icons.Eye className="size-4" /></button></td></tr>)}</tbody></table></div>
}

function ProductionDetails({ run, onClose }: { run: ProductionRun; onClose: () => void }) {
  return <div className="fixed inset-0 z-80 grid place-items-center bg-slate-950/45 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section role="dialog" aria-modal="true" aria-labelledby="production-detail-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><p className="text-xs text-slate-400">{run.reference} · {formatDate(run.productionDate)} · {run.location}</p><h2 id="production-detail-title" className="mt-1 text-base font-bold">{run.productName} · {run.producedQuantity ?? run.tankCount} {run.productUnit ?? 'unit'} produced</h2></div><button type="button" aria-label="Close production details" onClick={onClose} className="grid size-8 place-items-center rounded-md text-slate-400 hover:bg-slate-100"><Icons.X className="size-4" /></button></header><div className="overflow-x-auto"><table className="w-full min-w-140 text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase text-slate-400"><tr>{['Ingredient', 'Per product unit', 'Total deducted'].map((item) => <th key={item} className="px-4 py-3">{item}</th>)}</tr></thead><tbody>{run.lines.map((line) => <tr key={line.materialId} className="border-t border-slate-100"><td className="px-4 py-3 font-semibold text-slate-800">{line.materialName}</td><td className="px-4 py-3">{line.quantityPerTank} {line.unit}</td><td className="px-4 py-3 font-semibold text-rose-700">−{line.totalQuantity.toLocaleString()} {line.unit}</td></tr>)}</tbody></table></div><footer className="flex justify-end border-t border-slate-100 px-5 py-4"><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Close</button></footer></section></div>
}

function ReceiptTable({ groups, materials, onSelect }: { groups: Array<{ reference: string; rows: StockMovement[]; date: string; supplier: string; location: string; quantity: number; value: number }>; materials: RawMaterial[]; onSelect: (reference: string) => void }) {
  if (!groups.length) return <EmptyState title="No stock receipts yet" detail="Posted stock-in transactions will appear here, grouped by receipt reference." />
  return <div className="overflow-x-auto"><table className="w-full min-w-180 text-left text-xs"><thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-400"><tr>{['Receipt reference', 'Date', 'Supplier / source', 'Items', 'Quantity received', 'Receipt value', 'Destination', ''].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{groups.map((group) => <tr key={group.reference} className="border-t border-slate-100 text-slate-600 hover:bg-slate-50/70"><td className="px-4 py-3"><button type="button" onClick={() => onSelect(group.reference)} className="font-semibold text-primary hover:underline">{group.reference}</button></td><td className="px-4 py-3 whitespace-nowrap">{formatDate(group.date)}</td><td className="px-4 py-3">{group.supplier}</td><td className="px-4 py-3">{group.rows.length} line{group.rows.length === 1 ? '' : 's'}</td><td className="px-4 py-3">{group.quantity.toLocaleString()}</td><td className="px-4 py-3 font-semibold text-slate-800">{money(group.value)}</td><td className="max-w-40 truncate px-4 py-3">{group.location || '—'}</td><td className="px-4 py-3"><button type="button" onClick={() => onSelect(group.reference)} aria-label={`View receipt ${group.reference}`} className="grid size-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100"><Icons.Eye className="size-4" /></button></td></tr>)}</tbody></table></div>
}

function MovementTable({ movements, materials }: { movements: StockMovement[]; materials: RawMaterial[] }) {
  if (!movements.length) return <EmptyState title="No movements match" detail="Adjust the search or filters to review stock activity." />
  return <div className="overflow-x-auto"><table className="w-full min-w-225 text-left text-xs"><thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-400"><tr>{['Date', 'Reference', 'Material', 'Movement', 'Quantity', 'From', 'To', 'Source / reason', 'Recorded by'].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{movements.map((movement) => <tr key={movement.id} className="border-t border-slate-100 text-slate-600"><td className="px-4 py-3 whitespace-nowrap">{formatDate(movement.date)}</td><td className="px-4 py-3 font-semibold text-slate-800">{movement.reference}</td><td className="px-4 py-3">{materials.find((item) => item.id === movement.materialId)?.name ?? movement.materialId}</td><td className="px-4 py-3">{movement.type}</td><td className="px-4 py-3">{movement.quantity.toLocaleString()} {movement.unit}</td><td className="px-4 py-3">{movement.fromLocation || '—'}</td><td className="px-4 py-3">{movement.toLocation || '—'}</td><td className="max-w-48 truncate px-4 py-3">{movement.supplier || movement.sourceReference || movement.reason || '—'}</td><td className="px-4 py-3">{movement.actor}</td></tr>)}</tbody></table></div>
}

function InventoryDialog({ mode, materials, movements, locations, message, onClose, onSubmit }: { mode: Exclude<MovementForm, null> | 'Add material'; materials: RawMaterial[]; movements: StockMovement[]; locations: string[]; message: string; onClose: () => void; onSubmit: (form: FormData, movement: Exclude<MovementForm, null>) => boolean }) {
  const [movement, setMovement] = useState<Exclude<MovementForm, null>>(mode === 'Add material' ? 'Stock in' : mode)
  const [materialId, setMaterialId] = useState(materials[0]?.id ?? '')
  const [receiptLines, setReceiptLines] = useState<Array<{ materialId: string; quantity: string; unitCost: string }>>([{ materialId: materials[0]?.id ?? '', quantity: '', unitCost: String(materials[0]?.cost ?? 0) }])
  const title = mode === 'Add material' ? 'Add material' : movement
  const save = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); if (onSubmit(new FormData(event.currentTarget), movement)) event.currentTarget.reset() }
  return <div className="fixed inset-0 z-80 grid place-items-center bg-slate-950/45 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section role="dialog" aria-modal="true" aria-labelledby="inventory-dialog-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 id="inventory-dialog-title" className="text-base font-bold">{title}</h2><p className="mt-1 text-xs text-slate-500">{mode === 'Add material' ? 'Create a catalog item and optionally set its opening balance.' : 'Posted movements are retained; corrections should be recorded as adjustments.'}</p></div><button type="button" aria-label="Close inventory form" onClick={onClose} className="grid size-8 place-items-center rounded-md text-slate-400 hover:bg-slate-100"><Icons.X className="size-4" /></button></header>
    <form onSubmit={save} className="p-5"><div className="grid gap-4 sm:grid-cols-2">
      {mode === 'Add material' ? <><Field label="Material code"><input required name="code" className={inputClass} placeholder="e.g. RM-MZ-02" /></Field><Field label="Material name"><input required name="name" className={inputClass} placeholder="Material name" /></Field><Field label="Category"><input required name="category" className={inputClass} placeholder="e.g. Grains" /></Field><Field label="Base unit"><input required name="unit" className={inputClass} placeholder="kg, pcs, litres" /></Field><Field label="Reorder level"><input required name="threshold" type="number" min="0" step="any" defaultValue="0" className={inputClass} /></Field><Field label="Average / opening unit cost (UGX)"><input required name="cost" type="number" min="0" step="any" defaultValue="0" className={inputClass} /></Field><Field label="Initial store location"><input required name="location" list="inventory-location-options" defaultValue={locations[0] ?? 'Main Warehouse'} className={inputClass} /><datalist id="inventory-location-options">{locations.map((item) => <option key={item} value={item} />)}</datalist></Field><Field label="Opening quantity (optional)"><input name="openingQuantity" type="number" min="0" step="any" defaultValue="0" className={inputClass} /></Field><Field label="Opening date"><input name="date" type="date" defaultValue={today()} className={inputClass} /></Field></> : <>
        {mode === 'Transfer' && <Field label="Other stock action"><select value={movement} onChange={(event) => setMovement(event.target.value as Exclude<MovementForm, null>)} className={inputClass}><option>Transfer</option><option>Adjustment increase</option><option>Adjustment decrease</option></select></Field>}
        <Field label="Movement date"><input required name="date" type="date" defaultValue={today()} className={inputClass} /></Field>
        {movement === 'Stock in' ? <><Field label="Receipt reference"><input name="reference" className={inputClass} placeholder="Auto-generated if blank" /></Field><Field label="Supplier / source"><input required name="supplier" className={inputClass} placeholder="Supplier name" /></Field><Field label="Destination location"><input required name="toLocation" list="inventory-location-options" defaultValue={locations[0] ?? 'Main Warehouse'} className={inputClass} /><datalist id="inventory-location-options">{locations.map((item) => <option key={item} value={item} />)}</datalist></Field><Field label="Delivery note / source reference"><input name="sourceReference" className={inputClass} placeholder="Optional reference" /></Field><input type="hidden" name="lines" value={JSON.stringify(receiptLines.map((line) => ({ ...line, quantity: Number(line.quantity), unitCost: Number(line.unitCost) })))} /><div className="space-y-2 sm:col-span-2"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-600">Receipt lines</span><button type="button" onClick={() => setReceiptLines((lines) => [...lines, { materialId: materials[0]?.id ?? '', quantity: '', unitCost: String(materials[0]?.cost ?? 0) }])} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-50"><Icons.Plus className="size-3.5" /> Add material line</button></div>{receiptLines.map((line, index) => <div key={index} className="grid items-end gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[minmax(0,1.5fr)_minmax(90px,0.7fr)_minmax(110px,0.8fr)_32px]"><Field label="Material"><select required value={line.materialId} onChange={(event) => setReceiptLines((lines) => lines.map((item, lineIndex) => lineIndex === index ? { ...item, materialId: event.target.value, unitCost: String(materials.find((material) => material.id === event.target.value)?.cost ?? 0) } : item))} className={inputClass}><option value="" disabled>Select material</option>{materials.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>)}</select></Field><Field label={`Qty (${materials.find((item) => item.id === line.materialId)?.unit ?? 'unit'})`}><input required type="number" min="0.001" step="any" value={line.quantity} onChange={(event) => setReceiptLines((lines) => lines.map((item, lineIndex) => lineIndex === index ? { ...item, quantity: event.target.value } : item))} className={inputClass} /></Field><Field label="Unit cost (UGX)"><input required type="number" min="0" step="any" value={line.unitCost} onChange={(event) => setReceiptLines((lines) => lines.map((item, lineIndex) => lineIndex === index ? { ...item, unitCost: event.target.value } : item))} className={inputClass} /></Field><button type="button" aria-label={`Remove receipt line ${index + 1}`} disabled={receiptLines.length === 1} onClick={() => setReceiptLines((lines) => lines.filter((_, lineIndex) => lineIndex !== index))} className="grid size-8 place-items-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-30"><Icons.Trash2 className="size-4" /></button></div>)}</div></> : <><Field label="Material"><select required name="materialId" value={materialId} onChange={(event) => setMaterialId(event.target.value)} className={inputClass}><option value="" disabled>Select material</option>{materials.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.code} ({item.unit})</option>)}</select></Field><Field label="Quantity"><input required name="quantity" type="number" min="0.001" step="any" className={inputClass} placeholder="0" /></Field></>}
        {movement === 'Transfer' || movement === 'Adjustment decrease' ? <Field label="Source location"><select required name="fromLocation" className={inputClass}>{locations.filter((item) => stockQuantityAtLocation(materialId, movements, item) > 0).map((item) => <option key={item}>{item}</option>)}</select></Field> : null}
        {movement === 'Transfer' || movement === 'Adjustment increase' ? <Field label="Destination location"><input required name="toLocation" list="inventory-location-options" className={inputClass} placeholder="Store location" /><datalist id="inventory-location-options">{locations.map((item) => <option key={item} value={item} />)}</datalist></Field> : null}
        {movement.startsWith('Adjustment') ? <Field label="Adjustment reason" wide><textarea required name="reason" rows={2} className={inputClass} placeholder="Explain the physical count difference or loss" /></Field> : null}
        {movement === 'Transfer' ? <Field label="Transfer reference"><input name="sourceReference" className={inputClass} placeholder="Optional transfer note" /></Field> : null}
      </>}
      {message && <p role="alert" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 sm:col-span-2">{message}</p>}
    </div><footer className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Cancel</button><button type="submit" className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90">{mode === 'Add material' ? 'Save material' : `Post ${movement.toLowerCase()}`}</button></footer></form></section></div>
}

function MaterialDetails({ material, movements, locations, movementsAll, onClose }: { material: RawMaterial; movements: StockMovement[]; locations: string[]; movementsAll: StockMovement[]; onClose: () => void }) {
  return <div className="fixed inset-0 z-80 grid place-items-center bg-slate-950/45 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section role="dialog" aria-modal="true" aria-labelledby="material-detail-title" className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white shadow-2xl"><header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><p className="text-xs text-slate-400">{material.code} · {material.category}</p><h2 id="material-detail-title" className="mt-1 text-lg font-bold">{material.name}</h2><p className="mt-1 text-xs text-slate-500">Current total: {stockQuantityAtLocation(material.id, movementsAll).toLocaleString()} {material.unit} · reorder level {material.threshold} {material.unit}</p></div><button type="button" aria-label="Close material details" onClick={onClose} className="grid size-8 place-items-center rounded-md text-slate-400 hover:bg-slate-100"><Icons.X className="size-4" /></button></header><div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">{locations.map((location) => <div key={location} className="rounded-lg bg-slate-50 p-3"><div className="text-[10px] text-slate-500">{location}</div><div className="mt-1 text-sm font-bold">{stockQuantityAtLocation(material.id, movementsAll, location).toLocaleString()} {material.unit}</div></div>)}</div><section className="border-t border-slate-100"><div className="px-5 py-4"><h3 className="text-sm font-bold">Movement history</h3><p className="mt-1 text-xs text-slate-500">All receipts, issues, transfers, and adjustments for this material.</p></div>{movements.length ? <div className="overflow-x-auto"><table className="w-full min-w-180 text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase text-slate-400"><tr>{['Date', 'Reference', 'Type', 'Quantity', 'From', 'To', 'Reason / source', 'Recorded by'].map((item) => <th key={item} className="px-4 py-3">{item}</th>)}</tr></thead><tbody>{movements.map((item) => <tr key={item.id} className="border-t border-slate-100 text-slate-600"><td className="px-4 py-3">{formatDate(item.date)}</td><td className="px-4 py-3 font-semibold">{item.reference}</td><td className="px-4 py-3">{item.type}</td><td className="px-4 py-3">{item.quantity} {item.unit}</td><td className="px-4 py-3">{item.fromLocation || '—'}</td><td className="px-4 py-3">{item.toLocation || '—'}</td><td className="px-4 py-3">{item.supplier || item.sourceReference || item.reason || '—'}</td><td className="px-4 py-3">{item.actor}</td></tr>)}</tbody></table></div> : <EmptyState title="No movement history" detail="Stock events will appear here." />}</section><footer className="flex justify-end border-t border-slate-100 px-5 py-4"><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Close</button></footer></section></div>
}

function ReceiptDetails({ reference, movements, materials, onClose }: { reference: string; movements: StockMovement[]; materials: RawMaterial[]; onClose: () => void }) {
  const first = movements[0]
  return <div className="fixed inset-0 z-80 grid place-items-center bg-slate-950/45 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section role="dialog" aria-modal="true" aria-labelledby="receipt-detail-title" className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 id="receipt-detail-title" className="text-base font-bold">Stock receipt</h2><p className="mt-1 text-xs text-slate-500">{reference} · {first ? formatDate(first.date) : ''} · {first?.supplier ?? 'Source not recorded'}</p></div><button type="button" aria-label="Close receipt details" onClick={onClose} className="grid size-8 place-items-center rounded-md text-slate-400 hover:bg-slate-100"><Icons.X className="size-4" /></button></header><div className="overflow-x-auto"><table className="w-full min-w-150 text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase text-slate-400"><tr>{['Material', 'Quantity', 'Destination', 'Unit cost', 'Line value'].map((item) => <th key={item} className="px-4 py-3">{item}</th>)}</tr></thead><tbody>{movements.map((movement) => <tr key={movement.id} className="border-t border-slate-100"><td className="px-4 py-3 font-semibold">{materials.find((material) => material.id === movement.materialId)?.name ?? movement.materialId}</td><td className="px-4 py-3">{movement.quantity} {movement.unit}</td><td className="px-4 py-3">{movement.toLocation}</td><td className="px-4 py-3">{money(movement.unitCost ?? 0)}</td><td className="px-4 py-3 font-semibold">{money(movement.quantity * (movement.unitCost ?? 0))}</td></tr>)}</tbody></table></div><footer className="flex justify-end border-t border-slate-100 px-5 py-4"><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Close</button></footer></section></div>
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="px-5 py-14 text-center"><span className="mx-auto grid size-10 place-items-center rounded-full bg-slate-100 text-slate-500"><Icons.Boxes className="size-4" /></span><h4 className="mt-3 text-sm font-semibold text-slate-800">{title}</h4><p className="mx-auto mt-1 max-w-md text-xs text-slate-500">{detail}</p></div>
}