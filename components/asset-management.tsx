'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import * as Icons from 'lucide-react'
import {
  exportCsv,
  formatDate,
  money,
  type AssetCategory,
  type AssetCondition,
  type AssetEvent,
  type AssetEventType,
  type AssetStatus,
  type CompanyAsset,
  type ErpState,
} from '@/lib/erp'
import {
  createAsset,
  deleteAssetPhoto,
  getAsset,
  importLegacyAssets,
  listAssets,
  recordAssetEvent,
  updateAsset,
  uploadAssetPhoto,
  type AssetEventAction,
  type AssetRecord,
} from '@/lib/user-api'

type Props = { state: ErpState; canRead: boolean; canEdit: boolean }
type CategoryTab = 'All assets' | AssetCategory
type ActionMode = AssetEventAction['action'] | null

const categories: AssetCategory[] = ['Office assets', 'Vehicles', 'Production assets', 'Store', 'Machinery', 'Others']
const conditions: AssetCondition[] = ['Good', 'Fair', 'Needs repair', 'Unserviceable']
const statuses: AssetStatus[] = ['Active', 'Under maintenance', 'Disposed']
const migrationKey = 'lumina-erp-assets-imported-v1'
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const fieldClass = 'mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-ring/30'
const optional = (form: FormData, name: string) => String(form.get(name) || '').trim() || undefined
const apiMessage = (error: unknown) => error instanceof Error ? error.message : 'The request could not be completed.'

function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className={`block text-xs font-semibold text-slate-600 ${wide ? 'sm:col-span-2' : ''}`}>{label}{children}</label>
}

function Metric({ title, value, detail, icon, tone }: { title: string; value: number; detail: string; icon: ReactNode; tone: string }) {
  return <article className="rounded-lg border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><span className={`grid size-9 place-items-center rounded-md ${tone}`}>{icon}</span><span className="text-[9px] font-semibold uppercase text-slate-400">Current</span></div><div className="mt-3 text-xl font-bold tracking-tight text-slate-900">{value}</div><h3 className="mt-0.5 text-xs font-semibold text-slate-700">{title}</h3><p className="mt-1 text-[10px] text-slate-500">{detail}</p></article>
}

export default function AssetManagement({ state, canRead, canEdit }: Props) {
  const [assets, setAssets] = useState<AssetRecord[]>([])
  const [events, setEvents] = useState<AssetEvent[]>([])
  const [loading, setLoading] = useState(canRead)
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [tab, setTab] = useState<CategoryTab>('All assets')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All categories')
  const [conditionFilter, setConditionFilter] = useState('All conditions')
  const [statusFilter, setStatusFilter] = useState('All statuses')
  const [locationFilter, setLocationFilter] = useState('All locations')
  const [assigneeFilter, setAssigneeFilter] = useState('All assignees')
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<AssetRecord | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [action, setAction] = useState<ActionMode>(null)
  const [editingProfile, setEditingProfile] = useState(false)
  const [imported, setImported] = useState(false)
  const [importResult, setImportResult] = useState('')

  const refreshAssets = useCallback(async () => {
    if (!canRead) return
    setLoading(true)
    setLoadError('')
    try {
      const all: AssetRecord[] = []
      let cursor: string | undefined
      const visited = new Set<string>()
      do {
        const page = await listAssets({ limit: 200, cursor })
        all.push(...page.assets)
        cursor = page.nextCursor || undefined
        if (cursor && visited.has(cursor)) throw new Error('The asset list returned a repeated pagination cursor.')
        if (cursor) visited.add(cursor)
      } while (cursor)
      setAssets(all)
    } catch (error) {
      setLoadError(apiMessage(error))
    } finally {
      setLoading(false)
    }
  }, [canRead])

  useEffect(() => {
    if (canRead) void refreshAssets()
    if (typeof window !== 'undefined') setImported(window.localStorage.getItem(migrationKey) === 'success')
  }, [canRead, refreshAssets])

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

  const refreshDetail = useCallback(async (id: string) => {
    setDetailLoading(true)
    setDetailError('')
    try {
      const result = await getAsset(id)
      setSelected(result.asset)
      setEvents(result.events)
    } catch (error) {
      setDetailError(apiMessage(error))
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const runAction = async (operation: () => Promise<void>, success: string) => {
    setBusy(true)
    setMessage('')
    try {
      await operation()
      await refreshAssets()
      if (selected) await refreshDetail(selected.id)
      setMessage(success)
      setAction(null)
      setEditingProfile(false)
      setShowForm(false)
    } catch (error) {
      setMessage(apiMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const saveNewAsset = async (form: FormData, category: AssetCategory) => {
    const assetTag = String(form.get('assetTag') || '').trim()
    const name = String(form.get('name') || '').trim()
    const acquisitionCost = form.get('acquisitionCost') === '' ? undefined : Number(form.get('acquisitionCost'))
    if (!assetTag || !name || (acquisitionCost !== undefined && (!Number.isFinite(acquisitionCost) || acquisitionCost < 0))) {
      setMessage('Enter an asset tag and name, and a valid non-negative acquisition cost.')
      return
    }
    const mileage = form.get('mileage') === '' ? undefined : Number(form.get('mileage'))
    await runAction(() => createAsset({
      assetTag, name, category,
      assetType: optional(form, 'assetType'),
      makeModel: optional(form, 'makeModel'),
      serialNumber: optional(form, 'serialNumber'),
      registration: optional(form, 'registration'),
      vin: optional(form, 'vin'),
      mileage: mileage === undefined ? undefined : Math.max(0, mileage),
      capacity: optional(form, 'capacity'),
      productionLine: optional(form, 'productionLine'),
      serviceInterval: optional(form, 'serviceInterval'),
      acquisitionDate: optional(form, 'acquisitionDate'),
      acquisitionCost,
      supplier: optional(form, 'supplier'),
      warrantyEnd: optional(form, 'warrantyEnd'),
      location: String(form.get('location') || '').trim(),
      assignee: optional(form, 'assignee'),
      department: optional(form, 'department'),
      condition: String(form.get('condition') || 'Good') as AssetCondition,
      status: 'Active',
      conditionNotes: optional(form, 'conditionNotes'),
      nextInspectionDate: optional(form, 'nextInspectionDate'),
      nextServiceDate: optional(form, 'nextServiceDate'),
      insuranceDueDate: optional(form, 'insuranceDueDate'),
      notes: optional(form, 'notes'),
    }).then(() => undefined), `${name} added to ${category}.`)
  }

  const submitEvent = async (form: FormData, mode: Exclude<ActionMode, null>) => {
    if (!selected) return
    const input: AssetEventAction = {
      action: mode,
      date: String(form.get('date') || ''),
      note: optional(form, 'note'),
    }
    if (mode === 'inspection') {
      input.condition = String(form.get('condition') || '') as AssetCondition
      input.reason = optional(form, 'reason')
      input.nextInspectionDate = optional(form, 'nextInspectionDate')
      if (!conditions.includes(input.condition) || (['Needs repair', 'Unserviceable'].includes(input.condition) && !input.reason)) {
        setMessage('Choose a condition and include a finding when the asset needs repair or is unserviceable.')
        return
      }
    } else if (mode === 'transfer') {
      input.location = String(form.get('location') || '').trim()
      input.assignee = optional(form, 'assignee')
      input.department = optional(form, 'department')
      if (!input.location) { setMessage('Enter the new asset location.'); return }
    } else if (mode === 'maintenance' || mode === 'maintenance-completed') {
      input.work = String(form.get('work') || '').trim()
      input.provider = optional(form, 'provider')
      input.cost = form.get('cost') === '' ? undefined : Number(form.get('cost'))
      input.nextServiceDate = optional(form, 'nextServiceDate')
      if (!input.work || (input.cost !== undefined && (!Number.isFinite(input.cost) || input.cost < 0))) {
        setMessage('Enter a maintenance description and a valid non-negative cost.')
        return
      }
    } else if (mode === 'status-change') {
      input.status = String(form.get('status') || '') as AssetStatus
      input.reason = optional(form, 'reason')
      if (!statuses.includes(input.status) || !input.reason) { setMessage('Choose a status and explain the change.'); return }
    } else {
      input.reason = optional(form, 'reason')
      if (!input.reason) { setMessage('A disposal reason is required.'); return }
    }
    await runAction(() => recordAssetEvent(selected.id, input).then(() => undefined), `Event recorded for ${selected.name}.`)
  }

  const saveProfile = async (form: FormData) => {
    if (!selected) return
    const acquisitionCost = form.get('acquisitionCost') === '' ? undefined : Number(form.get('acquisitionCost'))
    const mileage = form.get('mileage') === '' ? undefined : Number(form.get('mileage'))
    if (acquisitionCost !== undefined && (!Number.isFinite(acquisitionCost) || acquisitionCost < 0)
      || mileage !== undefined && (!Number.isFinite(mileage) || mileage < 0)) {
      setMessage('Cost and mileage must be valid non-negative numbers.')
      return
    }
    const changes: Partial<CompanyAsset> = {
      assetTag: String(form.get('assetTag') || '').trim(),
      name: String(form.get('name') || '').trim(),
      category: String(form.get('category') || '') as AssetCategory,
      assetType: optional(form, 'assetType'),
      makeModel: optional(form, 'makeModel'),
      serialNumber: optional(form, 'serialNumber'),
      registration: optional(form, 'registration'),
      vin: optional(form, 'vin'),
      mileage, capacity: optional(form, 'capacity'),
      productionLine: optional(form, 'productionLine'),
      serviceInterval: optional(form, 'serviceInterval'),
      acquisitionDate: optional(form, 'acquisitionDate'),
      acquisitionCost, supplier: optional(form, 'supplier'),
      warrantyEnd: optional(form, 'warrantyEnd'),
      location: String(form.get('location') || '').trim(),
      assignee: optional(form, 'assignee'),
      department: optional(form, 'department'),
      condition: String(form.get('condition') || '') as AssetCondition,
      conditionNotes: optional(form, 'conditionNotes'),
      nextInspectionDate: optional(form, 'nextInspectionDate'),
      nextServiceDate: optional(form, 'nextServiceDate'),
      insuranceDueDate: optional(form, 'insuranceDueDate'),
      notes: optional(form, 'notes'),
    }
    if (!changes.assetTag || !changes.name || !changes.location) {
      setMessage('Asset tag, name, and location are required.')
      return
    }
    await runAction(() => updateAsset(selected.id, changes).then(() => undefined), `Profile updated for ${selected.name}.`)
  }

  const doImport = async () => {
    const legacyAssets = Array.isArray(state.assets) ? state.assets : []
    const legacyEvents = Array.isArray(state.assetEvents) ? state.assetEvents : []
    if (!legacyAssets.length && !legacyEvents.length) {
      setImportResult('No legacy local assets or history were found to import.')
      return
    }
    if (!window.confirm(`Import ${legacyAssets.length} legacy assets and ${legacyEvents.length} history events? The server import is idempotent. Local legacy data will be retained.`)) return
    setBusy(true)
    setImportResult('')
    try {
      const result = await importLegacyAssets(legacyAssets, legacyEvents)
      const rejectedCount = typeof result.rejected === 'number' ? result.rejected : result.rejected.length
      const rejectedNotes = Array.isArray(result.rejected) ? result.rejected.map((item) => `${item.assetTag || 'Asset'}: ${item.reason}`).join('; ') : ''
      const complete = rejectedCount === 0
      setImportResult(`${complete ? 'Import complete' : 'Import partially completed'} — ${result.imported} assets and ${result.importedEvents} events imported, ${result.duplicates} duplicates, ${rejectedCount} rejected.${rejectedNotes ? ` ${rejectedNotes}` : ''} Local source data was retained.${complete ? '' : ' Resolve rejected records and retry; duplicate records will be skipped.'}`)
      if (complete) {
        window.localStorage.setItem(migrationKey, 'success')
        setImported(true)
      }
      await refreshAssets()
    } catch (error) {
      setImportResult(`Import failed. Local data was retained. ${apiMessage(error)}`)
    } finally {
      setBusy(false)
    }
  }

  const exportAssets = () => exportCsv('company-assets.csv', visibleAssets.map((asset) => ({
    assetTag: asset.assetTag, name: asset.name, category: asset.category, type: asset.assetType ?? '', makeModel: asset.makeModel ?? '',
    serialNumber: asset.serialNumber ?? '', registration: asset.registration ?? '', location: asset.location, assignee: asset.assignee ?? '',
    department: asset.department ?? '', condition: asset.condition, status: asset.status, acquisitionDate: asset.acquisitionDate ?? '',
    acquisitionCostUGX: asset.acquisitionCost ?? '', nextInspectionDate: asset.nextInspectionDate ?? '', nextServiceDate: asset.nextServiceDate ?? '',
  })))

  if (!canRead) return <section role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">You do not have permission to access asset management.</section>
  if (selected) return <AssetDetails
    asset={selected} events={events} canEdit={canEdit} busy={busy} loading={detailLoading} error={detailError}
    message={message} action={action} editingProfile={editingProfile}
    onBack={() => { setSelected(null); setEvents([]); setAction(null); setMessage(''); setDetailError('') }}
    onAction={(mode) => { setMessage(''); setAction(mode) }}
    onCloseAction={() => setAction(null)}
    onEdit={() => { setMessage(''); setEditingProfile(true) }}
    onCloseEdit={() => setEditingProfile(false)}
    onEvent={submitEvent}
    onProfile={saveProfile}
    onUpload={async (file) => {
      await runAction(() => uploadAssetPhoto(selected.id, file).then(() => undefined), 'Photo uploaded.')
    }}
    onDeletePhoto={async (photoId) => {
      if (!window.confirm('Delete this asset photo?')) return
      await runAction(() => deleteAssetPhoto(selected.id, photoId), 'Photo deleted.')
    }}
    onExportHistory={() => exportCsv(`${selected.assetTag}-history.csv`, events.map((event) => ({
      date: event.date, type: event.type, actor: event.actor, summary: assetEventSummary(event),
      reason: event.reason ?? '', note: event.note ?? '', locationFrom: event.fromLocation ?? '', locationTo: event.toLocation ?? '',
      assigneeFrom: event.fromAssignee ?? '', assigneeTo: event.toAssignee ?? '', statusFrom: event.previousStatus ?? '', statusTo: event.newStatus ?? '',
      conditionFrom: event.previousCondition ?? '', conditionTo: event.newCondition ?? '', costUGX: event.cost ?? '',
    })))}
  />

  return <div className="animate-in fade-in duration-300">
    <header className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="mb-2 text-xs font-medium text-slate-400">Workspace / Inventory Department</div><h2 className="text-2xl font-bold tracking-tight">Assets management</h2><p className="mt-1 text-sm text-slate-500">Company-owned equipment, condition, ownership, and service history.</p></div><div className="flex flex-wrap gap-2">
      {canEdit && !imported && <button type="button" disabled={busy} onClick={() => void doImport()} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-800 disabled:opacity-50">Import legacy data</button>}
      <button type="button" onClick={exportAssets} disabled={!visibleAssets.length || loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"><Icons.Download className="size-4" /> Export CSV</button>
      {canEdit && tab === 'All assets' && <button type="button" onClick={() => { setMessage(''); setShowForm(true) }} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"><Icons.Plus className="size-4" /> Add asset</button>}
    </div></header>
    {loadError && <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800"><span>Could not load server assets: {loadError}</span><button type="button" onClick={() => void refreshAssets()} className="font-semibold underline">Retry</button></div>}
    {message && <p role="status" className="mb-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-700">{message}</p>}
    {importResult && <p role="status" className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-800">{importResult}</p>}
    {canEdit && imported && <p className="mb-4 text-[11px] text-slate-500">Legacy import has completed. Its local source data remains preserved.</p>}
    <section aria-label="Asset overview" className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric title="Active assets" value={activeCount} detail="Available for company use" icon={<Icons.Building2 className="size-4" />} tone="bg-secondary text-primary" /><Metric title="Needs attention" value={needsAttention} detail="Needs repair or unserviceable" icon={<Icons.TriangleAlert className="size-4" />} tone="bg-rose-50 text-rose-700" /><Metric title="Under maintenance" value={maintenanceCount} detail="Currently in service or repair" icon={<Icons.Wrench className="size-4" />} tone="bg-amber-50 text-amber-700" /><Metric title="Due in 30 days" value={upcoming} detail="Inspection or maintenance" icon={<Icons.CalendarClock className="size-4" />} tone="bg-sky-50 text-sky-700" /></section>
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div role="tablist" aria-label="Asset categories" className="flex gap-1 overflow-x-auto border-b border-slate-200 px-4 pt-2">{(['All assets', ...categories] as CategoryTab[]).map((item) => { const count = item === 'All assets' ? assets.length : assets.filter((asset) => asset.category === item).length; return <button key={item} type="button" role="tab" aria-selected={tab === item} onClick={() => { setTab(item); setCategoryFilter('All categories') }} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-xs font-semibold ${tab === item ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{item}<span className={`rounded-full px-1.5 py-0.5 text-[10px] ${tab === item ? 'bg-secondary text-secondary-foreground' : 'bg-slate-100 text-slate-500'}`}>{count}</span></button> })}</div>
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 xl:flex-row xl:items-center xl:justify-between"><div><h3 className="text-sm font-bold">{tab}</h3><p className="mt-1 text-xs text-slate-500">{loading ? 'Loading server assets…' : `${visibleAssets.length} matching asset${visibleAssets.length === 1 ? '' : 's'}`}</p>{canEdit && tab !== 'All assets' && <button type="button" disabled={busy} onClick={() => { setMessage(''); setShowForm(true) }} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"><Icons.Plus className="size-4" /> Add {tab} asset</button>}</div><div className="flex flex-wrap gap-2"><label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><Icons.Search className="size-4 text-slate-400" /><input aria-label="Search assets" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tag, name, serial, assignee" className="w-48 bg-transparent text-xs outline-none" /></label>{tab === 'All assets' && <select aria-label="Filter assets by category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><option>All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select>}<select aria-label="Filter assets by condition" value={conditionFilter} onChange={(event) => setConditionFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><option>All conditions</option>{conditions.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Filter assets by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><option>All statuses</option>{statuses.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Filter assets by location" value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><option>All locations</option>{locations.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Filter assets by assignee" value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><option>All assignees</option>{assignees.map((item) => <option key={item}>{item}</option>)}</select></div></div>
      {loading && !assets.length ? <div className="px-5 py-14 text-center text-xs text-slate-500">Loading assets from server…</div> : loadError && !assets.length ? <div className="px-5 py-14 text-center text-xs text-slate-500">Server assets are unavailable. Local legacy data is not shown as a fallback.</div> : <AssetTable assets={visibleAssets} onSelect={(asset) => { setSelected(asset); setEvents([]); void refreshDetail(asset.id) }} />}
      <footer className="border-t border-slate-100 px-4 py-3 text-[10px] text-slate-400">Store category is for durable equipment only. Raw materials and finished goods are tracked in their own inventory modules.</footer>
    </section>
    {showForm && <AssetForm selectedCategory={tab === 'All assets' ? undefined : tab} locations={locations} message={message} onClose={() => setShowForm(false)} onSubmit={saveNewAsset} busy={busy} />}
  </div>
}

function AssetTable({ assets, onSelect }: { assets: AssetRecord[]; onSelect: (asset: AssetRecord) => void }) {
  if (!assets.length) return <div className="px-5 py-14 text-center"><span className="mx-auto grid size-10 place-items-center rounded-full bg-slate-100 text-slate-500"><Icons.Building2 className="size-4" /></span><h4 className="mt-3 text-sm font-semibold text-slate-800">No assets found</h4><p className="mx-auto mt-1 max-w-md text-xs text-slate-500">Adjust filters or add a company-owned asset.</p></div>
  return <div className="overflow-x-auto"><table className="w-full min-w-225 text-left text-xs"><thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-400"><tr>{['Asset tag', 'Asset', 'Category', 'Location', 'Custodian', 'Condition', 'Status', 'Next service / inspection'].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{assets.map((asset) => <tr key={asset.id} className="border-t border-slate-100 hover:bg-slate-50"><td className="px-4 py-3 font-mono font-semibold text-primary">{asset.assetTag}</td><td className="px-4 py-3"><button type="button" onClick={() => onSelect(asset)} className="text-left font-semibold text-slate-800 hover:text-primary hover:underline">{asset.name}</button><div className="mt-0.5 text-[10px] text-slate-400">{asset.makeModel || asset.assetType || asset.serialNumber || '—'}</div></td><td className="px-4 py-3 text-slate-600">{asset.category}</td><td className="px-4 py-3 text-slate-600">{asset.location}</td><td className="px-4 py-3 text-slate-600">{asset.assignee || asset.department || 'Unassigned'}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${asset.condition === 'Good' ? 'bg-emerald-50 text-emerald-700' : asset.condition === 'Fair' ? 'bg-sky-50 text-sky-700' : asset.condition === 'Needs repair' ? 'bg-amber-50 text-amber-800' : 'bg-rose-50 text-rose-700'}`}>{asset.condition}</span></td><td className="px-4 py-3 text-slate-600">{asset.status}</td><td className="px-4 py-3 text-slate-500">{asset.nextServiceDate || asset.nextInspectionDate ? formatDate(asset.nextServiceDate || asset.nextInspectionDate!) : '—'}</td></tr>)}</tbody></table></div>
}

function AssetForm({ selectedCategory, locations, message, onClose, onSubmit, busy }: { selectedCategory?: AssetCategory; locations: string[]; message: string; onClose: () => void; onSubmit: (form: FormData, category: AssetCategory) => Promise<void>; busy: boolean }) {
  const [category, setCategory] = useState<AssetCategory>(selectedCategory || 'Office assets')
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void onSubmit(new FormData(event.currentTarget), category) }
  return <Dialog title="Add company asset" subtitle="Register an asset in the server inventory" message={message} onClose={onClose} onSubmit={submit} submitLabel={busy ? 'Saving…' : 'Add asset'} busy={busy}>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Asset tag"><input required name="assetTag" className={fieldClass} /></Field><Field label="Asset name"><input required name="name" className={fieldClass} /></Field><Field label="Category"><select value={category} onChange={(event) => setCategory(event.target.value as AssetCategory)} className={fieldClass}>{categories.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Asset type"><input name="assetType" className={fieldClass} /></Field><Field label="Make / model"><input name="makeModel" className={fieldClass} /></Field><Field label="Serial number"><input name="serialNumber" className={fieldClass} /></Field><Field label="Registration"><input name="registration" className={fieldClass} /></Field><Field label="VIN / chassis"><input name="vin" className={fieldClass} /></Field><Field label="Mileage"><input name="mileage" type="number" min="0" className={fieldClass} /></Field><Field label="Capacity"><input name="capacity" className={fieldClass} /></Field><Field label="Production line"><input name="productionLine" className={fieldClass} /></Field><Field label="Service interval"><input name="serviceInterval" className={fieldClass} /></Field><Field label="Acquisition date"><input name="acquisitionDate" type="date" className={fieldClass} /></Field><Field label="Acquisition cost (UGX)"><input name="acquisitionCost" type="number" min="0" step="1" className={fieldClass} /></Field><Field label="Supplier"><input name="supplier" className={fieldClass} /></Field><Field label="Warranty end"><input name="warrantyEnd" type="date" className={fieldClass} /></Field><Field label="Location"><input required name="location" list="asset-location-options" className={fieldClass} /><datalist id="asset-location-options">{locations.map((location) => <option key={location} value={location} />)}</datalist></Field><Field label="Assignee"><input name="assignee" className={fieldClass} /></Field><Field label="Department"><input name="department" className={fieldClass} /></Field><Field label="Initial condition"><select name="condition" className={fieldClass}>{conditions.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Next inspection"><input name="nextInspectionDate" type="date" className={fieldClass} /></Field><Field label="Next service"><input name="nextServiceDate" type="date" className={fieldClass} /></Field><Field label="Insurance due"><input name="insuranceDueDate" type="date" className={fieldClass} /></Field><Field label="Condition notes" wide><textarea name="conditionNotes" rows={2} className={fieldClass} /></Field><Field label="General notes" wide><textarea name="notes" rows={2} className={fieldClass} /></Field></div>
  </Dialog>
}

function AssetDetails({ asset, events, canEdit, busy, loading, error, message, action, editingProfile, onBack, onAction, onCloseAction, onEdit, onCloseEdit, onEvent, onProfile, onUpload, onDeletePhoto, onExportHistory }: {
  asset: AssetRecord; events: AssetEvent[]; canEdit: boolean; busy: boolean; loading: boolean; error: string; message: string; action: ActionMode; editingProfile: boolean
  onBack: () => void; onAction: (action: Exclude<ActionMode, null>) => void; onCloseAction: () => void; onEdit: () => void; onCloseEdit: () => void
  onEvent: (form: FormData, mode: Exclude<ActionMode, null>) => Promise<void>; onProfile: (form: FormData) => Promise<void>
  onUpload: (file: File) => Promise<void>; onDeletePhoto: (id: string) => Promise<void>; onExportHistory: () => void
}) {
  const [photoError, setPhotoError] = useState('')
  const [photoBusy, setPhotoBusy] = useState(false)
  const upload = async (event: FormEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    setPhotoBusy(true); setPhotoError('')
    try { await onUpload(file) } catch (cause) { setPhotoError(apiMessage(cause)) } finally { setPhotoBusy(false) }
  }
  const removePhoto = async (id: string) => {
    setPhotoBusy(true); setPhotoError('')
    try { await onDeletePhoto(id) } catch (cause) { setPhotoError(apiMessage(cause)) } finally { setPhotoBusy(false) }
  }
  return <div className="animate-in fade-in duration-200">
    <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-primary hover:underline"><Icons.ArrowLeft className="size-4" /> Back to assets</button>
    {error && <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">Could not load asset history: {error}</p>}
    {message && <p role="status" className="mb-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-700">{message}</p>}
    <header className="mb-5 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 lg:flex-row lg:items-center"><div className="grid size-12 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><Icons.Building2 className="size-5" /></div><div className="min-w-0 flex-1"><div className="text-xs text-slate-400">{asset.category} · {asset.assetTag}</div><h2 className="mt-1 text-xl font-bold">{asset.name}</h2><p className="mt-1 text-xs text-slate-500">{asset.location} · {asset.assignee || asset.department || 'Unassigned'} · {asset.condition} · {asset.status}</p></div><div className="flex flex-wrap gap-2">{canEdit && <><button type="button" onClick={onEdit} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold">Edit profile</button><button type="button" disabled={asset.status === 'Disposed'} onClick={() => onAction('inspection')} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold disabled:opacity-40">Inspection</button><button type="button" disabled={asset.status === 'Disposed'} onClick={() => onAction('transfer')} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold disabled:opacity-40">Transfer / reassign</button><button type="button" disabled={asset.status === 'Disposed'} onClick={() => onAction('maintenance')} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold disabled:opacity-40">Start maintenance</button>{asset.status === 'Under maintenance' && <button type="button" onClick={() => onAction('maintenance-completed')} className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-800">Complete / release</button>}<button type="button" disabled={asset.status === 'Disposed'} onClick={() => onAction('status-change')} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold disabled:opacity-40">Change status</button><button type="button" disabled={asset.status === 'Disposed'} onClick={() => onAction('dispose')} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-40">Dispose</button></>}</div></header>
    {loading && <p className="mb-4 text-xs text-slate-500">Refreshing server asset details…</p>}
    <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]"><section className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="text-sm font-bold">Asset profile</h3><div className="mt-4 grid gap-4 sm:grid-cols-2">{[['Make / model', asset.makeModel], ['Serial number', asset.serialNumber], ['Registration', asset.registration], ['VIN / chassis', asset.vin], ['Mileage', asset.mileage?.toLocaleString()], ['Capacity', asset.capacity], ['Production line', asset.productionLine], ['Asset type', asset.assetType], ['Acquired', asset.acquisitionDate ? formatDate(asset.acquisitionDate) : undefined], ['Cost', asset.acquisitionCost === undefined ? undefined : money(asset.acquisitionCost)], ['Supplier', asset.supplier], ['Warranty ends', asset.warrantyEnd ? formatDate(asset.warrantyEnd) : undefined], ['Department', asset.department], ['Next inspection', asset.nextInspectionDate ? formatDate(asset.nextInspectionDate) : undefined], ['Next service', asset.nextServiceDate ? formatDate(asset.nextServiceDate) : undefined], ['Insurance due', asset.insuranceDueDate ? formatDate(asset.insuranceDueDate) : undefined]].map(([label, value]) => <div key={label}><div className="text-[10px] uppercase text-slate-400">{label}</div><div className="mt-1 text-sm font-semibold">{value || '—'}</div></div>)}<div className="sm:col-span-2"><div className="text-[10px] uppercase text-slate-400">Notes</div><div className="mt-1 whitespace-pre-wrap text-sm">{asset.notes || '—'}</div></div></div>
      <section className="mt-6 border-t border-slate-100 pt-5"><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-bold">Asset photos</h3>{canEdit && <label className={`cursor-pointer rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold ${photoBusy ? 'pointer-events-none opacity-50' : ''}`}>{photoBusy ? 'Working…' : 'Upload photo'}<input type="file" accept="image/*" disabled={photoBusy} onChange={upload} className="sr-only" /></label>}</div>{photoError && <p role="alert" className="mt-2 text-xs text-rose-700">{photoError}</p>}{asset.photos?.length ? <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">{asset.photos.map((photo) => <figure key={photo.id} className="relative overflow-hidden rounded-lg border border-slate-200"><a href={photo.url} target="_blank" rel="noreferrer"><img src={photo.url} alt={photo.filename || `${asset.name} photo`} className="h-32 w-full object-cover" /></a>{photo.filename && <figcaption className="truncate px-2 py-1 text-[10px]">{photo.filename}</figcaption>}{canEdit && <button type="button" aria-label={`Delete ${photo.filename || 'asset photo'}`} onClick={() => void removePhoto(photo.id)} className="absolute right-1 top-1 rounded-md bg-white/90 p-1 text-rose-700"><Icons.Trash2 className="size-3.5" /></button>}</figure>)}</div> : <p className="mt-2 text-xs text-slate-400">No photos uploaded.</p>}</section>
    </section>
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h3 className="text-sm font-bold">Asset history</h3><p className="mt-1 text-xs text-slate-500">Audited inspection, assignment, maintenance, and status events.</p></div><button type="button" onClick={onExportHistory} disabled={!events.length} className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold disabled:opacity-40"><Icons.Download className="size-3.5" /> CSV</button></div>{events.length ? <ol className="divide-y divide-slate-100">{events.slice().sort((left, right) => right.date.localeCompare(left.date) || right.recordedAt.localeCompare(left.recordedAt)).map((event) => <li key={event.id} className="flex gap-3 px-5 py-4"><span className="mt-1 grid size-7 shrink-0 place-items-center rounded-md bg-secondary text-primary"><EventIcon type={event.type} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap justify-between gap-2"><strong className="text-xs">{event.type}</strong><time className="text-[10px] text-slate-400">{formatDate(event.date)}</time></div><p className="mt-1 text-xs text-slate-600">{assetEventSummary(event)}</p>{event.note && <p className="mt-1 text-[11px] text-slate-500">{event.note}</p>}<p className="mt-1 text-[10px] text-slate-400">{event.actor || 'Unknown actor'}{event.cost !== undefined ? ` · ${money(event.cost)}` : ''}</p></div></li>)}</ol> : <p className="px-5 py-12 text-center text-xs text-slate-400">{loading ? 'Loading history…' : 'No history recorded.'}</p>}</section></div>
    {action && <AssetEventDialog mode={action} asset={asset} message={message} busy={busy} onClose={onCloseAction} onSubmit={(form) => onEvent(form, action)} />}
    {editingProfile && <AssetProfileDialog asset={asset} message={message} busy={busy} onClose={onCloseEdit} onSubmit={onProfile} />}
  </div>
}

function AssetProfileDialog({ asset, message, busy, onClose, onSubmit }: { asset: AssetRecord; message: string; busy: boolean; onClose: () => void; onSubmit: (form: FormData) => Promise<void> }) {
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void onSubmit(new FormData(event.currentTarget)) }
  return <Dialog title="Edit asset profile" subtitle={`${asset.assetTag} · audited profile correction`} message={message} busy={busy} onClose={onClose} onSubmit={submit} submitLabel={busy ? 'Saving…' : 'Save profile'}>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Asset tag"><input required name="assetTag" defaultValue={asset.assetTag} className={fieldClass} /></Field><Field label="Asset name"><input required name="name" defaultValue={asset.name} className={fieldClass} /></Field><Field label="Category"><select name="category" defaultValue={asset.category} className={fieldClass}>{categories.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Asset type"><input name="assetType" defaultValue={asset.assetType} className={fieldClass} /></Field><Field label="Make / model"><input name="makeModel" defaultValue={asset.makeModel} className={fieldClass} /></Field><Field label="Serial number"><input name="serialNumber" defaultValue={asset.serialNumber} className={fieldClass} /></Field><Field label="Registration"><input name="registration" defaultValue={asset.registration} className={fieldClass} /></Field><Field label="VIN / chassis"><input name="vin" defaultValue={asset.vin} className={fieldClass} /></Field><Field label="Mileage"><input name="mileage" type="number" min="0" defaultValue={asset.mileage} className={fieldClass} /></Field><Field label="Capacity"><input name="capacity" defaultValue={asset.capacity} className={fieldClass} /></Field><Field label="Production line"><input name="productionLine" defaultValue={asset.productionLine} className={fieldClass} /></Field><Field label="Service interval"><input name="serviceInterval" defaultValue={asset.serviceInterval} className={fieldClass} /></Field><Field label="Acquisition date"><input name="acquisitionDate" type="date" defaultValue={asset.acquisitionDate} className={fieldClass} /></Field><Field label="Acquisition cost (UGX)"><input name="acquisitionCost" type="number" min="0" step="1" defaultValue={asset.acquisitionCost} className={fieldClass} /></Field><Field label="Supplier"><input name="supplier" defaultValue={asset.supplier} className={fieldClass} /></Field><Field label="Warranty end"><input name="warrantyEnd" type="date" defaultValue={asset.warrantyEnd} className={fieldClass} /></Field><Field label="Location"><input required name="location" defaultValue={asset.location} className={fieldClass} /></Field><Field label="Assignee"><input name="assignee" defaultValue={asset.assignee} className={fieldClass} /></Field><Field label="Department"><input name="department" defaultValue={asset.department} className={fieldClass} /></Field><Field label="Condition"><select name="condition" defaultValue={asset.condition} className={fieldClass}>{conditions.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Next inspection"><input name="nextInspectionDate" type="date" defaultValue={asset.nextInspectionDate} className={fieldClass} /></Field><Field label="Next service"><input name="nextServiceDate" type="date" defaultValue={asset.nextServiceDate} className={fieldClass} /></Field><Field label="Insurance due"><input name="insuranceDueDate" type="date" defaultValue={asset.insuranceDueDate} className={fieldClass} /></Field><Field label="Condition notes" wide><textarea name="conditionNotes" defaultValue={asset.conditionNotes} rows={2} className={fieldClass} /></Field><Field label="General notes" wide><textarea name="notes" defaultValue={asset.notes} rows={2} className={fieldClass} /></Field></div>
  </Dialog>
}

function AssetEventDialog({ mode, asset, message, busy, onClose, onSubmit }: { mode: Exclude<ActionMode, null>; asset: AssetRecord; message: string; busy: boolean; onClose: () => void; onSubmit: (form: FormData) => Promise<void> }) {
  const title = mode === 'inspection' ? 'Record inspection' : mode === 'transfer' ? 'Transfer / reassign' : mode === 'maintenance' ? 'Start maintenance' : mode === 'maintenance-completed' ? 'Complete maintenance / release' : mode === 'status-change' ? 'Change asset status' : 'Dispose asset'
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void onSubmit(new FormData(event.currentTarget)) }
  return <Dialog title={title} subtitle={`${asset.assetTag} · ${asset.name}`} message={message} busy={busy} onClose={onClose} onSubmit={submit} submitLabel={busy ? 'Saving…' : title}>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Event date"><input required name="date" type="date" defaultValue={today()} className={fieldClass} /></Field>
      {mode === 'inspection' && <><Field label="Condition"><select name="condition" defaultValue={asset.condition} className={fieldClass}>{conditions.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Finding / reason"><input name="reason" className={fieldClass} placeholder="Required for repair or unserviceable" /></Field><Field label="Next inspection date"><input name="nextInspectionDate" type="date" className={fieldClass} /></Field></>}
      {mode === 'transfer' && <><Field label="New location"><input required name="location" defaultValue={asset.location} className={fieldClass} /></Field><Field label="Assigned person"><input name="assignee" defaultValue={asset.assignee} className={fieldClass} /></Field><Field label="Department"><input name="department" defaultValue={asset.department} className={fieldClass} /></Field></>}
      {(mode === 'maintenance' || mode === 'maintenance-completed') && <><Field label="Work performed"><input required name="work" className={fieldClass} placeholder="Service, repair, inspection…" /></Field><Field label="Service provider"><input name="provider" className={fieldClass} /></Field><Field label="Cost (UGX)"><input name="cost" type="number" min="0" step="1" className={fieldClass} /></Field><Field label="Next service date"><input name="nextServiceDate" type="date" className={fieldClass} /></Field></>}
      {mode === 'status-change' && <><Field label="New status"><select name="status" defaultValue={asset.status === 'Active' ? 'Under maintenance' : 'Active'} className={fieldClass}>{statuses.filter((status) => status !== 'Disposed').map((status) => <option key={status}>{status}</option>)}</select></Field><Field label="Reason"><input required name="reason" className={fieldClass} /></Field></>}
      {mode === 'dispose' && <Field label="Disposal reason" wide><textarea required name="reason" rows={3} className={fieldClass} placeholder="Why is the asset being retired?" /></Field>}
      <Field label="Notes" wide><textarea name="note" rows={2} className={fieldClass} /></Field>
    </div>
  </Dialog>
}

function EventIcon({ type }: { type: AssetEventType }) {
  const Icon = type === 'Inspection' ? Icons.ClipboardCheck : type === 'Transfer' || type === 'Assignment' ? Icons.ArrowLeftRight : type === 'Maintenance' || type === 'Maintenance completed' ? Icons.Wrench : type === 'Disposed' ? Icons.Archive : Icons.PackageCheck
  return <Icon className="size-3.5" />
}

function assetEventSummary(event: AssetEvent) {
  if (event.type === 'Inspection') return `Condition ${event.previousCondition ?? '—'} → ${event.newCondition ?? '—'}${event.reason ? ` · ${event.reason}` : ''}`
  if (event.type === 'Transfer' || event.type === 'Assignment') return `${event.fromLocation || 'No location'} → ${event.toLocation || 'No location'}${event.toAssignee ? ` · Assigned to ${event.toAssignee}` : ''}`
  if (event.type === 'Maintenance' || event.type === 'Maintenance completed') return `${event.reason || event.note || 'Maintenance recorded'}${event.provider ? ` · ${event.provider}` : ''}${event.newStatus ? ` · ${event.newStatus}` : ''}`
  if (event.type === 'Profile correction') {
    if (event.description) return event.description
    const changes = [
      event.previousCondition !== undefined || event.newCondition !== undefined
        ? `Condition ${event.previousCondition ?? '—'} → ${event.newCondition ?? '—'}`
        : '',
      event.previousStatus !== undefined || event.newStatus !== undefined
        ? `Status ${event.previousStatus ?? '—'} → ${event.newStatus ?? '—'}`
        : '',
    ].filter(Boolean)
    return event.title || (changes.length ? changes.join(' · ') : 'Asset profile corrected')
  }
  if (event.type === 'Disposed') return event.reason || 'Asset disposed'
  if (event.type === 'Status change') return `${event.previousStatus ?? '—'} → ${event.newStatus ?? '—'}${event.reason ? ` · ${event.reason}` : ''}`
  return event.note || 'Asset acquired and registered'
}

function Dialog({ title, subtitle, message, busy, onClose, onSubmit, submitLabel, children }: { title: string; subtitle: string; message: string; busy: boolean; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; submitLabel: string; children: ReactNode }) {
  return <div className="fixed inset-0 z-80 grid place-items-center bg-slate-950/45 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}><section role="dialog" aria-modal="true" aria-labelledby="asset-dialog-title" className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 id="asset-dialog-title" className="text-base font-bold">{title}</h2><p className="mt-1 text-xs text-slate-500">{subtitle}</p></div><button type="button" aria-label={`Close ${title}`} disabled={busy} onClick={onClose} className="grid size-8 place-items-center rounded-md text-slate-400 hover:bg-slate-100"><Icons.X className="size-4" /></button></header><form onSubmit={onSubmit} className="p-5"><div className="space-y-4">{children}{message && <p role="alert" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{message}</p>}</div><footer className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" disabled={busy} onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Cancel</button><button type="submit" disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{submitLabel}</button></footer></form></section></div>
}
