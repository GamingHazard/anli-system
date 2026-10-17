'use client'

import { useMemo, useState } from 'react'
import * as Icons from 'lucide-react'
import { createId, exportCsv, formatDate, money, type AssetCategory, type AssetCondition, type AssetEvent, type AssetEventType, type AssetStatus, type CompanyAsset, type ErpState } from '@/lib/erp'

type Props = { state: ErpState; updateState: (next: ErpState) => void }
type CategoryTab = 'All assets' | AssetCategory
type ActionMode = 'inspection' | 'transfer' | 'maintenance' | 'dispose' | null
const categories: AssetCategory[] = ['Office assets', 'Vehicles', 'Production assets', 'Store', 'Machinery', 'Others']
const conditions: AssetCondition[] = ['Good', 'Fair', 'Needs repair', 'Unserviceable']
const statuses: AssetStatus[] = ['Active', 'Under maintenance', 'Disposed']
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const actor = 'Sarah Namirembe'
const fieldClass = 'mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-ring/30'

function conditionTone(condition: AssetCondition) {
  if (condition === 'Good') return 'bg-emerald-50 text-emerald-700'
  if (condition === 'Fair') return 'bg-sky-50 text-sky-700'
  if (condition === 'Needs repair') return 'bg-amber-50 text-amber-800'
  return 'bg-rose-50 text-rose-700'
}

function Metric({ title, value, detail, icon, color }: { title: string; value: string; detail: string; icon: string; color: string }) {
  const Icon = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[icon] ?? Icons.Building2
  const tone = color === 'primary' ? 'bg-secondary text-primary' : color === 'amber' ? 'bg-amber-50 text-amber-700' : color === 'rose' ? 'bg-rose-50 text-rose-700' : 'bg-sky-50 text-sky-700'
  return <article className="rounded-lg border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><span className={`grid size-9 place-items-center rounded-md ${tone}`}><Icon className="size-4" /></span><span className="text-[9px] font-semibold uppercase text-slate-400">Current</span></div><div className="mt-3 text-xl font-bold tracking-tight text-slate-900">{value}</div><h3 className="mt-0.5 text-xs font-semibold text-slate-700">{title}</h3><p className="mt-1 text-[10px] text-slate-500">{detail}</p></article>
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={`block text-xs font-semibold text-slate-600 ${wide ? 'sm:col-span-2' : ''}`}>{label}{children}</label>
}

export default function AssetManagement({ state, updateState }: Props) {
  const assets = Array.isArray(state.assets) ? state.assets : []
  const assetEvents = Array.isArray(state.assetEvents) ? state.assetEvents : []
  const [tab, setTab] = useState<CategoryTab>('All assets')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All categories')
  const [conditionFilter, setConditionFilter] = useState('All conditions')
  const [statusFilter, setStatusFilter] = useState('All statuses')
  const [locationFilter, setLocationFilter] = useState('All locations')
  const [assigneeFilter, setAssigneeFilter] = useState('All assignees')
  const [showForm, setShowForm] = useState(false)
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  const [action, setAction] = useState<ActionMode>(null)
  const [message, setMessage] = useState('')
  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId) ?? null

  const locations = [...new Set(assets.map((asset) => asset.location).filter(Boolean))].sort()
  const assignees = [...new Set(assets.map((asset) => asset.assignee || asset.department).filter((value): value is string => Boolean(value)))].sort()
  const dueSoonLimit = new Date(`${today()}T12:00:00.000Z`)
  dueSoonLimit.setUTCDate(dueSoonLimit.getUTCDate() + 30)
  const dueSoon = dueSoonLimit.toISOString().slice(0, 10)
  const upcoming = assets.filter((asset) => asset.status !== 'Disposed' && [asset.nextInspectionDate, asset.nextServiceDate].some((date) => Boolean(date && date >= today() && date <= dueSoon))).length
  const needsAttention = assets.filter((asset) => ['Needs repair', 'Unserviceable'].includes(asset.condition) && asset.status !== 'Disposed').length
  const activeCount = assets.filter((asset) => asset.status === 'Active').length
  const maintenanceCount = assets.filter((asset) => asset.status === 'Under maintenance').length

  const visibleAssets = useMemo(() => assets.filter((asset) => {
    const searchable = `${asset.assetTag} ${asset.name} ${asset.serialNumber ?? ''} ${asset.makeModel ?? ''} ${asset.assignee ?? ''} ${asset.department ?? ''} ${asset.location} ${asset.assetType ?? ''}`.toLowerCase()
    return (tab === 'All assets' ? categoryFilter === 'All categories' || asset.category === categoryFilter : asset.category === tab)
      && searchable.includes(search.trim().toLowerCase())
      && (conditionFilter === 'All conditions' || asset.condition === conditionFilter)
      && (statusFilter === 'All statuses' || asset.status === statusFilter)
      && (locationFilter === 'All locations' || asset.location === locationFilter)
      && (assigneeFilter === 'All assignees' || asset.assignee === assigneeFilter || asset.department === assigneeFilter)
  }).sort((left, right) => left.name.localeCompare(right.name)), [assets, tab, categoryFilter, search, conditionFilter, statusFilter, locationFilter, assigneeFilter])

  const saveAsset = (form: FormData, category: AssetCategory) => {
    const assetTag = String(form.get('assetTag') || '').trim()
    const name = String(form.get('name') || '').trim()
    const acquisitionCost = form.get('acquisitionCost') === '' ? undefined : Number(form.get('acquisitionCost'))
    if (!assetTag || !name || assets.some((asset) => asset.assetTag.toLowerCase() === assetTag.toLowerCase()) || (acquisitionCost !== undefined && (!Number.isFinite(acquisitionCost) || acquisitionCost < 0))) {
      setMessage('Enter an asset tag and name, use a unique tag, and enter a valid non-negative acquisition cost.')
      return false
    }
    const now = new Date().toISOString()
    const initialCondition = String(form.get('condition') || 'Good') as AssetCondition
    const asset: CompanyAsset = {
      id: createId('ASSET'), assetTag, name, category,
      assetType: String(form.get('assetType') || '').trim() || undefined,
      makeModel: String(form.get('makeModel') || '').trim() || undefined,
      serialNumber: String(form.get('serialNumber') || '').trim() || undefined,
      registration: String(form.get('registration') || '').trim() || undefined,
      vin: String(form.get('vin') || '').trim() || undefined,
      mileage: form.get('mileage') === '' ? undefined : Math.max(0, Number(form.get('mileage'))),
      capacity: String(form.get('capacity') || '').trim() || undefined,
      productionLine: String(form.get('productionLine') || '').trim() || undefined,
      serviceInterval: String(form.get('serviceInterval') || '').trim() || undefined,
      acquisitionDate: String(form.get('acquisitionDate') || '') || undefined,
      acquisitionCost,
      supplier: String(form.get('supplier') || '').trim() || undefined,
      warrantyEnd: String(form.get('warrantyEnd') || '') || undefined,
      location: String(form.get('location') || '').trim(),
      assignee: String(form.get('assignee') || '').trim() || undefined,
      department: String(form.get('department') || '').trim() || undefined,
      condition: initialCondition,
      status: 'Active',
      conditionNotes: String(form.get('conditionNotes') || '').trim() || undefined,
      nextInspectionDate: String(form.get('nextInspectionDate') || '') || undefined,
      nextServiceDate: String(form.get('nextServiceDate') || '') || undefined,
      insuranceDueDate: String(form.get('insuranceDueDate') || '') || undefined,
      notes: String(form.get('notes') || '').trim() || undefined,
      createdAt: now, updatedAt: now,
    }
    const event: AssetEvent = { id: createId('AEVT'), assetId: asset.id, type: 'Acquired', date: asset.acquisitionDate || today(), recordedAt: now, actor, newCondition: initialCondition, newStatus: 'Active', toLocation: asset.location, toAssignee: asset.assignee, note: 'Asset registered' }
    updateState({ ...state, assets: [asset, ...assets], assetEvents: [event, ...assetEvents] })
    setTab(category)
    setShowForm(false)
    setMessage(`${asset.name} added to ${category}.`)
    return true
  }

  const recordEvent = (form: FormData, mode: Exclude<ActionMode, null>) => {
    if (!selectedAsset || selectedAsset.status === 'Disposed') return false
    const date = String(form.get('date') || '')
    const note = String(form.get('note') || '').trim()
    const now = new Date().toISOString()
    let updatedAsset: CompanyAsset = { ...selectedAsset, updatedAt: now }
    let event: AssetEvent
    if (mode === 'inspection') {
      const condition = String(form.get('condition') || '') as AssetCondition
      const reason = String(form.get('reason') || '').trim()
      const nextInspectionDate = String(form.get('nextInspectionDate') || '') || undefined
      if (!date || !conditions.includes(condition) || (['Needs repair', 'Unserviceable'].includes(condition) && !reason)) {
        setMessage('Enter the inspection date and condition. Add a finding/reason when the asset needs repair or is unserviceable.')
        return false
      }
      updatedAsset = { ...updatedAsset, condition, conditionNotes: note || reason || selectedAsset.conditionNotes, nextInspectionDate, status: condition === 'Unserviceable' ? 'Under maintenance' : selectedAsset.status === 'Under maintenance' && condition !== 'Needs repair' ? 'Active' : selectedAsset.status }
      event = { id: createId('AEVT'), assetId: selectedAsset.id, type: 'Inspection', date, recordedAt: now, actor, previousCondition: selectedAsset.condition, newCondition: condition, previousStatus: selectedAsset.status, newStatus: updatedAsset.status, reason: reason || undefined, note: note || undefined, nextInspectionDate }
    } else if (mode === 'transfer') {
      const location = String(form.get('location') || '').trim()
      const assignee = String(form.get('assignee') || '').trim() || undefined
      const department = String(form.get('department') || '').trim() || undefined
      if (!date || !location) { setMessage('Enter the transfer date and new location.'); return false }
      updatedAsset = { ...updatedAsset, location, assignee, department }
      event = { id: createId('AEVT'), assetId: selectedAsset.id, type: 'Transfer', date, recordedAt: now, actor, fromLocation: selectedAsset.location, toLocation: location, fromAssignee: selectedAsset.assignee, toAssignee: assignee, note: note || undefined }
    } else if (mode === 'maintenance') {
      const work = String(form.get('work') || '').trim()
      const provider = String(form.get('provider') || '').trim() || undefined
      const cost = form.get('cost') === '' ? undefined : Number(form.get('cost'))
      const nextServiceDate = String(form.get('nextServiceDate') || '') || undefined
      if (!date || !work || (cost !== undefined && (!Number.isFinite(cost) || cost < 0))) { setMessage('Enter a completion date and maintenance description; cost must be non-negative.')
        return false
      }
      updatedAsset = { ...updatedAsset, status: 'Under maintenance', nextServiceDate }
      event = { id: createId('AEVT'), assetId: selectedAsset.id, type: 'Maintenance', date, recordedAt: now, actor, previousStatus: selectedAsset.status, newStatus: 'Under maintenance', reason: work, provider, cost, note: note || undefined, nextServiceDate }
    } else {
      const reason = String(form.get('reason') || '').trim()
      if (!date || !reason) { setMessage('Disposal date and reason are required.')
        return false
      }
      updatedAsset = { ...updatedAsset, status: 'Disposed' }
      event = { id: createId('AEVT'), assetId: selectedAsset.id, type: 'Disposed', date, recordedAt: now, actor, previousStatus: selectedAsset.status, newStatus: 'Disposed', reason, note: note || undefined }
    }
    updateState({ ...state, assets: assets.map((asset) => asset.id === selectedAsset.id ? updatedAsset : asset), assetEvents: [event, ...assetEvents] })
    setAction(null)
    setMessage(`${event.type} recorded for ${selectedAsset.name}.`)
    return true
  }

  const exportAssets = () => exportCsv('company-assets.csv', visibleAssets.map((asset) => ({
    assetTag: asset.assetTag, name: asset.name, category: asset.category, type: asset.assetType ?? '', makeModel: asset.makeModel ?? '',
    serialNumber: asset.serialNumber ?? '', registration: asset.registration ?? '', location: asset.location, assignee: asset.assignee ?? '',
    department: asset.department ?? '', condition: asset.condition, status: asset.status, acquisitionDate: asset.acquisitionDate ?? '',
    acquisitionCostUGX: asset.acquisitionCost ?? '', nextInspectionDate: asset.nextInspectionDate ?? '', nextServiceDate: asset.nextServiceDate ?? '',
  })))

  if (selectedAsset) return <AssetDetails asset={selectedAsset} events={assetEvents.filter((event) => event.assetId === selectedAsset.id).sort((left, right) => right.date.localeCompare(left.date) || right.recordedAt.localeCompare(left.recordedAt))} onBack={() => { setSelectedAssetId(null); setAction(null); setMessage('') }} onAction={(mode) => { setMessage(''); setAction(mode) }} onCloseAction={() => setAction(null)} action={action} message={message} onSubmit={recordEvent} />

  const filteredAssets = visibleAssets

  return <div className="animate-in fade-in duration-300">
    <header className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="mb-2 text-xs font-medium text-slate-400">Workspace / Inventory Department</div><h2 className="text-2xl font-bold tracking-tight">Assets management</h2><p className="mt-1 text-sm text-slate-500">Company-owned equipment, condition, ownership, and service history.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={exportAssets} disabled={!filteredAssets.length} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"><Icons.Download className="size-4" /> Export CSV</button><button type="button" onClick={() => { setMessage(''); setShowForm(true) }} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"><Icons.Plus className="size-4" /> Add asset</button></div></header>
    <section aria-label="Asset overview" className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric title="Active assets" value={String(activeCount)} detail="Available for company use" icon="Building2" color="primary" /><Metric title="Needs attention" value={String(needsAttention)} detail="Needs repair or unserviceable" icon="TriangleAlert" color="rose" /><Metric title="Under maintenance" value={String(maintenanceCount)} detail="Currently in service or repair" icon="Wrench" color="amber" /><Metric title="Due in 30 days" value={String(upcoming)} detail="Inspection or maintenance" icon="CalendarClock" color="blue" /></section>
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div role="tablist" aria-label="Asset categories" className="flex gap-1 overflow-x-auto border-b border-slate-200 px-4 pt-2">{(['All assets', ...categories] as CategoryTab[]).map((item) => { const count = item === 'All assets' ? assets.length : assets.filter((asset) => asset.category === item).length; return <button key={item} type="button" role="tab" aria-selected={tab === item} onClick={() => { setTab(item); setCategoryFilter('All categories') }} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-xs font-semibold ${tab === item ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{item}<span className={`rounded-full px-1.5 py-0.5 text-[10px] ${tab === item ? 'bg-secondary text-secondary-foreground' : 'bg-slate-100 text-slate-500'}`}>{count}</span></button> })}</div>
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 xl:flex-row xl:items-center xl:justify-between"><div><h3 className="text-sm font-bold">{tab}</h3><p className="mt-1 text-xs text-slate-500">{filteredAssets.length} matching asset{filteredAssets.length === 1 ? '' : 's'}</p></div><div className="flex flex-wrap gap-2"><label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><Icons.Search className="size-4 text-slate-400" /><input aria-label="Search assets" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tag, name, serial, assignee" className="w-48 bg-transparent text-xs outline-none" /></label>{tab === 'All assets' && <select aria-label="Filter assets by category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><option>All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select>}<select aria-label="Filter assets by condition" value={conditionFilter} onChange={(event) => setConditionFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><option>All conditions</option>{conditions.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Filter assets by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><option>All statuses</option>{statuses.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Filter assets by location" value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><option>All locations</option>{locations.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Filter assets by assignee" value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><option>All assignees</option>{assignees.map((item) => <option key={item}>{item}</option>)}</select></div></div>
      <AssetTable assets={filteredAssets} onSelect={(asset) => { setSelectedAssetId(asset.id); setMessage('') }} />
      <footer className="border-t border-slate-100 px-4 py-3 text-[10px] text-slate-400">Store category is for durable equipment only. Raw materials and finished goods are tracked in their own inventory modules.</footer>
    </section>
    {showForm && <AssetForm selectedCategory={tab === 'All assets' ? undefined : tab} locations={locations} message={message} onClose={() => setShowForm(false)} onSubmit={saveAsset} />}
  </div>
}

function AssetTable({ assets, onSelect }: { assets: CompanyAsset[]; onSelect: (asset: CompanyAsset) => void }) {
  if (!assets.length) return <div className="px-5 py-14 text-center"><span className="mx-auto grid size-10 place-items-center rounded-full bg-slate-100 text-slate-500"><Icons.Building2 className="size-4" /></span><h4 className="mt-3 text-sm font-semibold text-slate-800">No assets found</h4><p className="mx-auto mt-1 max-w-md text-xs text-slate-500">Adjust filters or add a company-owned asset.</p></div>
  return <div className="overflow-x-auto"><table className="w-full min-w-225 text-left text-xs"><thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-400"><tr>{['Asset tag', 'Asset', 'Category', 'Location', 'Custodian', 'Condition', 'Status', 'Next service / inspection', ''].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{assets.map((asset) => <tr key={asset.id} className="border-t border-slate-100 text-slate-600 hover:bg-slate-50/70"><td className="px-4 py-3 font-mono font-semibold text-slate-800">{asset.assetTag}</td><td className="px-4 py-3"><button type="button" onClick={() => onSelect(asset)} className="text-left font-semibold text-primary hover:underline">{asset.name}</button><span className="mt-1 block text-[10px] text-slate-400">{asset.makeModel || asset.assetType || asset.serialNumber || '—'}</span></td><td className="px-4 py-3">{asset.category}</td><td className="px-4 py-3">{asset.location}</td><td className="px-4 py-3">{asset.assignee || asset.department || 'Unassigned'}</td><td className="px-4 py-3"><span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${conditionTone(asset.condition)}`}>{asset.condition}</span></td><td className="px-4 py-3">{asset.status}</td><td className="px-4 py-3 whitespace-nowrap">{asset.nextServiceDate || asset.nextInspectionDate ? formatDate(asset.nextServiceDate ?? asset.nextInspectionDate!) : '—'}</td><td className="px-4 py-3"><button type="button" onClick={() => onSelect(asset)} aria-label={`Open ${asset.name}`} className="grid size-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100"><Icons.ChevronRight className="size-4" /></button></td></tr>)}</tbody></table></div>
}

function AssetForm({ selectedCategory, locations, message, onClose, onSubmit }: { selectedCategory?: AssetCategory; locations: string[]; message: string; onClose: () => void; onSubmit: (form: FormData, category: AssetCategory) => boolean }) {
  const [category, setCategory] = useState<AssetCategory>(selectedCategory ?? categories[0])
  const todayDate = today()
  const submit = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); onSubmit(new FormData(event.currentTarget), category) }
  return <DialogShell title="Add asset" subtitle="Register durable company property and its starting condition." message={message} onClose={onClose} onSubmit={submit} submitLabel="Save asset">
    <div className="grid gap-4 sm:grid-cols-2">{!selectedCategory && <Field label="Category"><select value={category} onChange={(event) => setCategory(event.target.value as AssetCategory)} className={fieldClass}>{categories.map((item) => <option key={item}>{item}</option>)}</select></Field>}<Field label="Asset tag"><input required name="assetTag" className={fieldClass} placeholder="e.g. VEH-001" /></Field><Field label="Asset name"><input required name="name" className={fieldClass} placeholder="Asset name" /></Field><Field label="Acquisition date"><input name="acquisitionDate" type="date" max={todayDate} className={fieldClass} /></Field><Field label="Acquisition cost (UGX)"><input name="acquisitionCost" type="number" min="0" step="1" className={fieldClass} placeholder="Optional" /></Field><Field label="Supplier / vendor"><input name="supplier" className={fieldClass} placeholder="Optional" /></Field><Field label="Location"><input required name="location" list="asset-location-options" className={fieldClass} placeholder="Office, workshop, store..." /><datalist id="asset-location-options">{locations.map((item) => <option key={item} value={item} />)}</datalist></Field><Field label="Assigned to"><input name="assignee" className={fieldClass} placeholder="Person or custodian" /></Field><Field label="Department"><input name="department" className={fieldClass} placeholder="Department" /></Field><Field label="Initial condition"><select name="condition" defaultValue="Good" className={fieldClass}>{conditions.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Warranty end"><input name="warrantyEnd" type="date" className={fieldClass} /></Field>
      {(category === 'Office assets' || category === 'Store' || category === 'Machinery' || category === 'Production assets' || category === 'Vehicles') && <><Field label="Make / model"><input name="makeModel" className={fieldClass} placeholder="Make and model" /></Field><Field label="Serial number"><input name="serialNumber" className={fieldClass} placeholder="Serial number" /></Field></>}
      {category === 'Vehicles' && <><Field label="Registration / plate"><input name="registration" className={fieldClass} /></Field><Field label="VIN / chassis number"><input name="vin" className={fieldClass} /></Field><Field label="Current mileage"><input name="mileage" type="number" min="0" step="1" className={fieldClass} /></Field><Field label="Insurance due"><input name="insuranceDueDate" type="date" className={fieldClass} /></Field><Field label="Inspection due"><input name="nextInspectionDate" type="date" className={fieldClass} /></Field></>}
      {(category === 'Machinery' || category === 'Production assets') && <><Field label="Capacity / unit"><input name="capacity" className={fieldClass} placeholder="e.g. 500 L" /></Field>{category === 'Production assets' && <Field label="Production line"><input name="productionLine" className={fieldClass} /></Field>}<Field label="Service interval"><input name="serviceInterval" className={fieldClass} placeholder="e.g. Every 6 months" /></Field><Field label="Next service date"><input name="nextServiceDate" type="date" className={fieldClass} /></Field></>}
      {(category === 'Office assets' || category === 'Store') && <Field label={category === 'Store' ? 'Store area / location detail' : 'Room / office'}><input name="assetType" className={fieldClass} placeholder={category === 'Store' ? 'e.g. Main store shelving' : 'Room or office'} /></Field>}
      {category === 'Others' && <Field label="Asset type"><input required name="assetType" className={fieldClass} placeholder="Describe the asset type" /></Field>}
      <Field label="Condition notes" wide><textarea name="conditionNotes" rows={2} className={fieldClass} placeholder="Initial inspection notes" /></Field><Field label="General notes" wide><textarea name="notes" rows={2} className={fieldClass} /></Field>
    </div>
  </DialogShell>
}

function AssetDetails({ asset, events, onBack, onAction, onCloseAction, action, message, onSubmit }: { asset: CompanyAsset; events: AssetEvent[]; onBack: () => void; onAction: (action: Exclude<ActionMode, null>) => void; onCloseAction: () => void; action: ActionMode; message: string; onSubmit: (form: FormData, mode: Exclude<ActionMode, null>) => boolean }) {
  return <div className="animate-in fade-in duration-200"><button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-primary hover:underline"><Icons.ArrowLeft className="size-4" /> Back to assets</button><header className="mb-5 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 lg:flex-row lg:items-center"><div className="grid size-12 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><Icons.Building2 className="size-5" /></div><div className="min-w-0 flex-1"><div className="text-xs text-slate-400">{asset.category} · {asset.assetTag}</div><h2 className="mt-1 text-xl font-bold">{asset.name}</h2><p className="mt-1 text-xs text-slate-500">{asset.location} · {asset.assignee || asset.department || 'Unassigned'} · {asset.condition} · {asset.status}</p></div><div className="flex flex-wrap gap-2"><button type="button" disabled={asset.status === 'Disposed'} onClick={() => onAction('inspection')} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold">Record inspection</button><button type="button" disabled={asset.status === 'Disposed'} onClick={() => onAction('transfer')} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold">Transfer / reassign</button><button type="button" disabled={asset.status === 'Disposed'} onClick={() => onAction('maintenance')} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold">Record maintenance</button><button type="button" disabled={asset.status === 'Disposed'} onClick={() => onAction('dispose')} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700">Dispose asset</button></div></header>
    <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]"><section className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="text-sm font-bold">Asset profile</h3><div className="mt-4 grid gap-4 sm:grid-cols-2">{[['Make / model', asset.makeModel], ['Serial number', asset.serialNumber], ['Registration', asset.registration], ['VIN / chassis', asset.vin], ['Mileage', asset.mileage?.toLocaleString()], ['Capacity', asset.capacity], ['Production line', asset.productionLine], ['Asset type', asset.assetType], ['Acquired', asset.acquisitionDate ? formatDate(asset.acquisitionDate) : undefined], ['Cost', asset.acquisitionCost === undefined ? undefined : money(asset.acquisitionCost)], ['Supplier', asset.supplier], ['Warranty ends', asset.warrantyEnd ? formatDate(asset.warrantyEnd) : undefined], ['Department', asset.department], ['Next inspection', asset.nextInspectionDate ? formatDate(asset.nextInspectionDate) : undefined], ['Next service', asset.nextServiceDate ? formatDate(asset.nextServiceDate) : undefined]].map(([label, value]) => <div key={label}><div className="text-[10px] uppercase text-slate-400">{label}</div><div className="mt-1 text-sm font-semibold">{value || '—'}</div></div>)}<div className="sm:col-span-2"><div className="text-[10px] uppercase text-slate-400">Notes</div><div className="mt-1 whitespace-pre-wrap text-sm">{asset.notes || '—'}</div></div></div></section>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="border-b border-slate-100 px-5 py-4"><h3 className="text-sm font-bold">Asset history</h3><p className="mt-1 text-xs text-slate-500">Inspection, assignment, maintenance, and status events are retained.</p></div>{events.length ? <ol className="divide-y divide-slate-100">{events.map((event) => <li key={event.id} className="flex gap-3 px-5 py-4"><span className="mt-1 grid size-7 shrink-0 place-items-center rounded-md bg-secondary text-primary"><EventIcon type={event.type} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap justify-between gap-2"><strong className="text-xs">{event.type}</strong><time className="text-[10px] text-slate-400">{formatDate(event.date)}</time></div><p className="mt-1 text-xs text-slate-600">{assetEventSummary(event)}</p>{event.note && <p className="mt-1 text-[11px] text-slate-500">{event.note}</p>}<p className="mt-1 text-[10px] text-slate-400">{event.actor}{event.cost !== undefined ? ` · ${money(event.cost)}` : ''}</p></div></li>)}</ol> : <p className="px-5 py-12 text-center text-xs text-slate-400">No history recorded.</p>}</section></div>
    {action && <AssetEventDialog mode={action} asset={asset} message={message} onClose={onCloseAction} onSubmit={(form) => onSubmit(form, action)} />}
  </div>
}

function EventIcon({ type }: { type: AssetEventType }) {
  const icon = type === 'Inspection' ? Icons.ClipboardCheck : type === 'Transfer' || type === 'Assignment' ? Icons.ArrowLeftRight : type === 'Maintenance' ? Icons.Wrench : type === 'Disposed' ? Icons.Archive : Icons.PackageCheck
  const Icon = icon
  return <Icon className="size-3.5" />
}

function assetEventSummary(event: AssetEvent) {
  if (event.type === 'Inspection') return `Condition ${event.previousCondition ?? '—'} → ${event.newCondition ?? '—'}${event.reason ? ` · ${event.reason}` : ''}`
  if (event.type === 'Transfer' || event.type === 'Assignment') return `${event.fromLocation || 'No location'} → ${event.toLocation || 'No location'}${event.toAssignee ? ` · Assigned to ${event.toAssignee}` : ''}`
  if (event.type === 'Maintenance') return `${event.reason || 'Maintenance recorded'}${event.provider ? ` · ${event.provider}` : ''}${event.newStatus ? ` · ${event.newStatus}` : ''}`
  if (event.type === 'Disposed') return event.reason || 'Asset disposed'
  return event.note || 'Asset acquired and registered'
}

function AssetEventDialog({ mode, asset, message, onClose, onSubmit }: { mode: Exclude<ActionMode, null>; asset: CompanyAsset; message: string; onClose: () => void; onSubmit: (form: FormData) => boolean }) {
  const title = mode === 'inspection' ? 'Record inspection' : mode === 'transfer' ? 'Transfer / reassign' : mode === 'maintenance' ? 'Record maintenance' : 'Dispose asset'
  const submit = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); onSubmit(new FormData(event.currentTarget)) }
  return <DialogShell title={title} subtitle={`${asset.assetTag} · ${asset.name}`} message={message} onClose={onClose} onSubmit={submit} submitLabel={title}>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Event date"><input required name="date" type="date" defaultValue={today()} className={fieldClass} /></Field>
      {mode === 'inspection' && <><Field label="Condition"><select name="condition" defaultValue={asset.condition} className={fieldClass}>{conditions.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Finding / reason"><input name="reason" className={fieldClass} placeholder="Required for repair or unserviceable" /></Field><Field label="Next inspection date"><input name="nextInspectionDate" type="date" className={fieldClass} /></Field></>}
      {mode === 'transfer' && <><Field label="New location"><input required name="location" defaultValue={asset.location} className={fieldClass} /></Field><Field label="Assigned person"><input name="assignee" defaultValue={asset.assignee} className={fieldClass} /></Field><Field label="Department"><input name="department" defaultValue={asset.department} className={fieldClass} /></Field></>}
      {mode === 'maintenance' && <><Field label="Work performed"><input required name="work" className={fieldClass} placeholder="Service, repair, inspection..." /></Field><Field label="Service provider"><input name="provider" className={fieldClass} /></Field><Field label="Cost (UGX)"><input name="cost" type="number" min="0" step="1" className={fieldClass} /></Field><Field label="Next service date"><input name="nextServiceDate" type="date" className={fieldClass} /></Field></>}
      {mode === 'dispose' && <Field label="Disposal reason" wide><textarea required name="reason" rows={3} className={fieldClass} placeholder="Why is the asset being retired?" /></Field>}
      <Field label="Notes" wide><textarea name="note" rows={2} className={fieldClass} /></Field>
    </div>
  </DialogShell>
}

function DialogShell({ title, subtitle, message, onClose, onSubmit, submitLabel, children }: { title: string; subtitle: string; message: string; onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; submitLabel: string; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-80 grid place-items-center bg-slate-950/45 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section role="dialog" aria-modal="true" aria-labelledby="asset-dialog-title" className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 id="asset-dialog-title" className="text-base font-bold">{title}</h2><p className="mt-1 text-xs text-slate-500">{subtitle}</p></div><button type="button" aria-label={`Close ${title}`} onClick={onClose} className="grid size-8 place-items-center rounded-md text-slate-400 hover:bg-slate-100"><Icons.X className="size-4" /></button></header><form onSubmit={onSubmit} className="p-5"><div className="space-y-4">{children}{message && <p role="alert" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{message}</p>}</div><footer className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Cancel</button><button type="submit" className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90">{submitLabel}</button></footer></form></section></div>
}