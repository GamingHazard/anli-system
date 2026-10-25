'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, RefreshCw, ShieldCheck } from 'lucide-react'
import {
  ApiError,
  listAuditEvents,
  listAuditEventTypes,
  listUsers,
  type AuditEvent,
  type AuditEventType,
  type UserAccount,
} from '@/lib/user-api'

type AppliedFilters = {
  eventType: string
  category: string
  outcome: string
  actorId: string
  targetId: string
  resourceType: string
  from: string
  to: string
}

const emptyFilters: AppliedFilters = {
  eventType: '',
  category: '',
  outcome: '',
  actorId: '',
  targetId: '',
  resourceType: '',
  from: '',
  to: '',
}
const fieldClass = 'min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30'

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function label(value: string) {
  return value.replaceAll('.', ' · ').replaceAll('_', ' ')
}

function displayValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(displayValue).join(', ')
  if (value && typeof value === 'object') return JSON.stringify(value) ?? String(value)
  return String(value)
}

export default function AuditWorkspace({
  currentUser,
  targetUserId,
}: {
  currentUser: UserAccount
  targetUserId?: string
}) {
  const isSuperAdmin = currentUser.roles.includes('Super Admin')
  const [accounts, setAccounts] = useState<UserAccount[]>([])
  const [eventTypes, setEventTypes] = useState<AuditEventType[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [resourceTypes, setResourceTypes] = useState<string[]>([])
  const [filterLoadError, setFilterLoadError] = useState('')
  const [filters, setFilters] = useState(emptyFilters)
  const [applied, setApplied] = useState(emptyFilters)
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [moreError, setMoreError] = useState('')
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)
  const [refreshVersion, setRefreshVersion] = useState(0)

  const accountNames = useMemo(
    () => new Map(accounts.map((account) => [account.id, account.name])),
    [accounts],
  )

  const loadFilterOptions = useCallback(async () => {
    if (!isSuperAdmin || targetUserId) return
    setFilterLoadError('')
    const results = await Promise.allSettled([listUsers(), listAuditEventTypes()])
    const failures = results.filter((result) => result.status === 'rejected')
    if (results[0]?.status === 'fulfilled') setAccounts(results[0].value)
    if (results[1]?.status === 'fulfilled') {
      setEventTypes(results[1].value.eventTypes)
      setCategories(results[1].value.categories)
      setResourceTypes(results[1].value.resourceTypes)
    }
    if (failures.length) {
      const failure = failures[0]
      const cause = failure?.status === 'rejected' ? failure.reason : undefined
      setFilterLoadError(
        cause instanceof ApiError
          ? cause.message
          : 'Some filter options could not be loaded.',
      )
    }
  }, [isSuperAdmin, targetUserId])

  useEffect(() => {
    void loadFilterOptions()
  }, [loadFilterOptions])

  useEffect(() => {
    if (!isSuperAdmin) return
    let mounted = true
    setLoading(true)
    setError('')
    setMoreError('')
    setEvents([])
    setCursor(null)
    setExpandedEventId(null)
    listAuditEvents({
      eventType: applied.eventType || undefined,
      category: applied.category || undefined,
      outcome: (applied.outcome || undefined) as AuditEvent['outcome'] | undefined,
      actorId: applied.actorId || undefined,
      targetUserId: targetUserId || applied.targetId || undefined,
      resourceType: applied.resourceType || undefined,
      from: applied.from || undefined,
      to: applied.to || undefined,
    }).then((result) => {
      if (!mounted) return
      setEvents(result.events)
      setCursor(result.nextCursor)
    }).catch((cause: unknown) => {
      if (mounted) {
        setError(cause instanceof ApiError ? cause.message : 'Could not load audit events.')
      }
    }).finally(() => {
      if (mounted) setLoading(false)
    })
    return () => { mounted = false }
  }, [applied, isSuperAdmin, refreshVersion, targetUserId])

  const loadMore = async () => {
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    setMoreError('')
    try {
      const result = await listAuditEvents({
        eventType: applied.eventType || undefined,
        category: applied.category || undefined,
        outcome: (applied.outcome || undefined) as AuditEvent['outcome'] | undefined,
        actorId: applied.actorId || undefined,
        targetUserId: targetUserId || applied.targetId || undefined,
        resourceType: applied.resourceType || undefined,
        from: applied.from || undefined,
        to: applied.to || undefined,
        cursor,
      })
      setEvents((current) => [...current, ...result.events])
      setCursor(result.nextCursor)
    } catch (cause) {
      setMoreError(cause instanceof ApiError ? cause.message : 'Could not load more audit events.')
    } finally {
      setLoadingMore(false)
    }
  }

  const setFilter = (key: keyof AppliedFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }))
  }
  const clearFilters = () => {
    setFilters(emptyFilters)
    setApplied(emptyFilters)
  }
  const applyFilters = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setApplied({ ...filters })
  }
  const activeFilters = [
    applied.eventType && { key: 'eventType' as const, label: label(applied.eventType) },
    applied.category && { key: 'category' as const, label: `Area: ${label(applied.category)}` },
    applied.outcome && { key: 'outcome' as const, label: `Outcome: ${applied.outcome}` },
    applied.actorId && { key: 'actorId' as const, label: `Actor: ${accountNames.get(applied.actorId) || 'Selected account'}` },
    !targetUserId && applied.targetId && { key: 'targetId' as const, label: `Affected account: ${accountNames.get(applied.targetId) || 'Selected account'}` },
    applied.resourceType && { key: 'resourceType' as const, label: `Resource: ${label(applied.resourceType)}` },
    applied.from && { key: 'from' as const, label: `From ${applied.from}` },
    applied.to && { key: 'to' as const, label: `To ${applied.to}` },
  ].filter((filter): filter is { key: keyof AppliedFilters; label: string } => Boolean(filter))

  if (!isSuperAdmin) {
    return <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Audit records are restricted to Super Admin accounts.</p>
  }

  return (
    <section className="animate-in fade-in duration-300">
      {!targetUserId && (
        <header className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="mb-2 text-xs font-medium text-slate-400">Workspace / Security</div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
              <ShieldCheck className="size-6 text-primary" />
              Audit trail
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Review account, security, and business activity recorded by the server.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRefreshVersion((version) => version + 1)}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </header>
      )}

      {!targetUserId && (
        <form onSubmit={applyFilters} className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Find activity</h2>
              <p className="mt-0.5 text-xs text-slate-500">Filter by event, actor, affected account, outcome, or date.</p>
            </div>
            {(activeFilters.length > 0 || Object.values(filters).some(Boolean)) && (
              <button type="button" onClick={clearFilters} className="text-xs font-semibold text-primary hover:underline">
                Clear all
              </button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="grid gap-1.5 text-xs font-medium text-slate-600">
              Area
              <select
                aria-label="Filter by area"
                value={filters.category}
                onChange={(event) => {
                  const category = event.target.value
                  setFilters((current) => ({ ...current, category, eventType: '' }))
                }}
                className={fieldClass}
              >
                <option value="">All areas</option>
                {categories.map((category) => <option key={category} value={category}>{label(category)}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-slate-600">
              Activity
              <select aria-label="Filter by activity" value={filters.eventType} onChange={(event) => setFilter('eventType', event.target.value)} className={fieldClass}>
                <option value="">All activities</option>
                {eventTypes.filter((type) => !filters.category || type.startsWith(`${filters.category}.`)).map((type) => <option key={type} value={type}>{label(filters.category ? type.slice(type.indexOf('.') + 1) : type)}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-slate-600">
              Outcome
              <select aria-label="Filter by outcome" value={filters.outcome} onChange={(event) => setFilter('outcome', event.target.value)} className={fieldClass}>
                <option value="">All outcomes</option>
                <option value="success">Success</option>
                <option value="failure">Failure</option>
                <option value="denied">Denied</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-slate-600">
              Actor
              <select aria-label="Filter by actor" value={filters.actorId} onChange={(event) => setFilter('actorId', event.target.value)} className={fieldClass}>
                <option value="">All actors</option>
                {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-slate-600">
              Affected account
              <select aria-label="Filter by affected account" value={filters.targetId} onChange={(event) => setFilter('targetId', event.target.value)} className={fieldClass}>
                <option value="">All accounts</option>
                {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-slate-600">
              Resource type
              <select aria-label="Filter by resource type" value={filters.resourceType} onChange={(event) => setFilter('resourceType', event.target.value)} className={fieldClass}>
                <option value="">All resource types</option>
                {resourceTypes.map((type) => <option key={type} value={type}>{label(type)}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-slate-600">
              From
              <input aria-label="Audit date from" type="date" value={filters.from} onChange={(event) => setFilter('from', event.target.value)} className={fieldClass} />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-slate-600">
              To
              <input aria-label="Audit date to" type="date" value={filters.to} onChange={(event) => setFilter('to', event.target.value)} className={fieldClass} />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="submit" className="rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90">Apply filters</button>
            {filterLoadError && <span role="alert" className="text-xs text-rose-700">{filterLoadError}<button type="button" onClick={() => void loadFilterOptions()} className="ml-2 font-semibold underline">Retry options</button></span>}
          </div>
          {activeFilters.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3" aria-label="Active filters">
              {activeFilters.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => {
                    setFilter(filter.key, '')
                    setApplied((current) => ({ ...current, [filter.key]: '' }))
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-700 hover:bg-slate-100"
                >
                  {filter.label}<span aria-hidden="true" className="font-bold text-slate-400">×</span>
                </button>
              ))}
            </div>
          )}
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{targetUserId ? 'Account activity' : 'Recorded events'}</h2>
            <p className="mt-0.5 text-xs text-slate-500">Newest activity appears first · times shown in your local timezone</p>
          </div>
          {!targetUserId && <span className="text-xs text-slate-500">{events.length} loaded</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                {['Time', 'Actor', 'Activity', 'Affected record', 'Outcome', ''].map((heading, index) => (
                  <th key={`${heading}-${index}`} className="px-4 py-3">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500">Loading audit events…</td></tr>}
              {error && <tr><td colSpan={6} className="px-4 py-8 text-center" role="alert"><p className="text-sm text-rose-700">{error}</p><button type="button" onClick={() => setRefreshVersion((version) => version + 1)} className="mt-2 text-xs font-semibold text-primary hover:underline">Try again</button></td></tr>}
              {!loading && !error && events.map((entry) => (
                <AuditRow
                  key={entry.id}
                  event={entry}
                  expanded={expandedEventId === entry.id}
                  onToggle={() => setExpandedEventId((current) => current === entry.id ? null : entry.id)}
                />
              ))}
              {!loading && !error && events.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center"><p className="text-sm font-medium text-slate-700">No audit events found</p><p className="mt-1 text-xs text-slate-500">{activeFilters.length ? 'Try adjusting or clearing your filters.' : 'Events will appear here as activity is recorded.'}</p></td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">{events.length} event{events.length === 1 ? '' : 's'} shown</p>
          {cursor && <button type="button" disabled={loadingMore} onClick={() => void loadMore()} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">{loadingMore ? 'Loading…' : 'Load more'}</button>}
          {moreError && <p role="alert" className="text-xs text-rose-700">{moreError}</p>}
        </div>
      </div>
      <p className="mt-3 text-[11px] leading-5 text-slate-500">Audit records are server-generated. Retention is subject to an approved operational and legal policy; IP and device details are access-restricted.</p>
    </section>
  )
}

function AuditRow({
  event,
  expanded,
  onToggle,
}: {
  event: AuditEvent
  expanded: boolean
  onToggle: () => void
}) {
  const outcomeTone = event.outcome === 'success'
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/10'
    : event.outcome === 'failure'
      ? 'bg-rose-50 text-rose-700 ring-rose-600/10'
      : 'bg-amber-50 text-amber-800 ring-amber-600/10'
  const resourceLabel = event.resource?.reference || event.resource?.type || '—'

  return (
    <>
      <tr className={`align-middle text-slate-700 ${expanded ? 'bg-slate-50/70' : 'hover:bg-slate-50/70'}`}>
        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{formatTimestamp(event.createdAt)}</td>
        <td className="px-4 py-3">
          <span className="font-medium text-slate-800">{event.actor?.name || 'System / unauthenticated'}</span>
          {event.actor?.roles.length ? <span className="mt-0.5 block text-[11px] text-slate-500">{event.actor.roles.join(', ')}</span> : null}
        </td>
        <td className="px-4 py-3">
          <span className="font-medium capitalize text-slate-800">{label(event.eventType)}</span>
          {event.reason && <span className="mt-0.5 block text-[11px] text-slate-500">{label(event.reason)}</span>}
        </td>
        <td className="px-4 py-3">
          <span className="font-medium text-slate-700">{event.target?.name || resourceLabel}</span>
          {event.target?.email && <span className="mt-0.5 block text-[11px] text-slate-500">{event.target.email}</span>}
          {event.resource?.id && <span className="mt-0.5 block font-mono text-[10px] text-slate-400">{event.resource.id}</span>}
        </td>
        <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ring-1 ring-inset ${outcomeTone}`}>{event.outcome}</span></td>
        <td className="px-4 py-3 text-right">
          <button type="button" aria-expanded={expanded} onClick={onToggle} className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold text-primary hover:bg-violet-50">
            {expanded ? 'Hide' : 'Details'}{expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-slate-50/70">
          <td colSpan={6} className="px-4 pb-4 pt-1">
            <div className="grid gap-x-8 gap-y-3 rounded-lg border border-slate-200 bg-white p-4 text-xs sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="Event ID" value={event.id} mono />
              <Detail label="Full timestamp" value={new Date(event.createdAt).toISOString()} />
              {event.target && <Detail label="Affected account" value={[event.target.name, event.target.email].filter(Boolean).join(' · ') || event.target.id} />}
              {event.resource && <Detail label="Resource" value={[event.resource.type, event.resource.reference, event.resource.id].filter(Boolean).join(' · ')} />}
              {event.sessionId && <Detail label="Session" value={event.sessionId} mono />}
              {event.ipAddress && <Detail label="IP address" value={event.ipAddress} />}
              {event.userAgent && <Detail label="Device / browser" value={event.userAgent} />}
              {Object.entries(event.details || {}).map(([key, value]) => <Detail key={key} label={label(key)} value={displayValue(value)} />)}
              {Object.keys(event.details || {}).length === 0 && !event.ipAddress && !event.userAgent && !event.sessionId && <p className="text-slate-500">No additional event details were recorded.</p>}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function Detail({ label: title, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="font-semibold text-slate-500">{title}</dt>
      <dd className={`mt-1 break-words text-slate-800 ${mono ? 'font-mono text-[11px]' : ''}`}>{value}</dd>
    </div>
  )
}
