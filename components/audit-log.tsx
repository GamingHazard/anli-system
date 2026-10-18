'use client'

import { useEffect, useState } from 'react'
import { ApiError, AUDIT_EVENT_TYPES, listAuditEvents, listUsers, type AuditEvent, type AuditEventType, type UserAccount } from '@/lib/user-api'

const fieldClass = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-primary focus:ring-2 focus:ring-ring/30'

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function label(value: string) {
  return value.replaceAll('.', ' · ').replaceAll('_', ' ')
}

export default function AuditLogPanel({
  currentUser,
  targetUserId,
}: {
  currentUser: UserAccount
  targetUserId?: string
}) {
  const isSuperAdmin = currentUser.roles.includes('Super Admin')
  const [accounts, setAccounts] = useState<UserAccount[]>([])
  const [accountsError, setAccountsError] = useState('')
  const [eventType, setEventType] = useState<AuditEventType | ''>('')
  const [outcome, setOutcome] = useState<AuditEvent['outcome'] | ''>('')
  const [actorId, setActorId] = useState('')
  const [targetId, setTargetId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [applied, setApplied] = useState({ eventType: '', outcome: '', actorId: '', targetId: '', from: '', to: '' })
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isSuperAdmin || targetUserId) return
    let mounted = true
    listUsers().then((result) => {
      if (mounted) setAccounts(result)
    }).catch((cause: unknown) => {
      if (mounted) setAccountsError(cause instanceof ApiError ? cause.message : 'Could not load account filters.')
    })
    return () => { mounted = false }
  }, [isSuperAdmin, targetUserId])

  useEffect(() => {
    if (!isSuperAdmin) return
    let mounted = true
    setLoading(true)
    setError('')
    setEvents([])
    setCursor(null)
    listAuditEvents({
      eventType: (applied.eventType || undefined) as AuditEventType | undefined,
      outcome: (applied.outcome || undefined) as AuditEvent['outcome'] | undefined,
      actorId: applied.actorId || undefined,
      targetUserId: targetUserId || applied.targetId || undefined,
      from: applied.from || undefined,
      to: applied.to || undefined,
    }).then((result) => {
      if (!mounted) return
      setEvents(result.events)
      setCursor(result.nextCursor)
    }).catch((cause: unknown) => {
      if (mounted) setError(cause instanceof ApiError ? cause.message : 'Could not load audit events.')
    }).finally(() => {
      if (mounted) setLoading(false)
    })
    return () => { mounted = false }
  }, [applied, isSuperAdmin, targetUserId])

  const applyFilters = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setApplied({ eventType, outcome, actorId, targetId, from, to })
  }

  const loadMore = async () => {
    if (!cursor) return
    setLoadingMore(true)
    setError('')
    try {
      const result = await listAuditEvents({
        eventType: (applied.eventType || undefined) as AuditEventType | undefined,
        outcome: (applied.outcome || undefined) as AuditEvent['outcome'] | undefined,
        actorId: applied.actorId || undefined,
        targetUserId: targetUserId || applied.targetId || undefined,
        from: applied.from || undefined,
        to: applied.to || undefined,
        cursor,
      })
      setEvents((current) => [...current, ...result.events])
      setCursor(result.nextCursor)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not load more audit events.')
    } finally {
      setLoadingMore(false)
    }
  }

  if (!isSuperAdmin) {
    return <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">Audit records are restricted to Super Admin accounts.</p>
  }

  return <div>
    {!targetUserId && <form onSubmit={applyFilters} className="mb-4 grid gap-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3 sm:grid-cols-2 xl:grid-cols-3">
      <label className="grid gap-1 text-[10px] font-semibold text-slate-600">Activity<select aria-label="Filter by activity" value={eventType} onChange={(event) => setEventType(event.target.value as AuditEventType | '')} className={fieldClass}><option value="">All activity</option>{AUDIT_EVENT_TYPES.map((type) => <option key={type} value={type}>{label(type)}</option>)}</select></label>
      <label className="grid gap-1 text-[10px] font-semibold text-slate-600">Outcome<select aria-label="Filter by outcome" value={outcome} onChange={(event) => setOutcome(event.target.value as typeof outcome)} className={fieldClass}><option value="">All outcomes</option><option value="success">Success</option><option value="failure">Failure</option><option value="denied">Denied</option></select></label>
      <label className="grid gap-1 text-[10px] font-semibold text-slate-600">Actor<select aria-label="Filter by actor" value={actorId} onChange={(event) => setActorId(event.target.value)} className={fieldClass}><option value="">All actors</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
      <label className="grid gap-1 text-[10px] font-semibold text-slate-600">Affected account<select aria-label="Filter by affected account" value={targetId} onChange={(event) => setTargetId(event.target.value)} className={fieldClass}><option value="">All accounts</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
      <label className="grid gap-1 text-[10px] font-semibold text-slate-600">From<input aria-label="Audit date from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} className={fieldClass} /></label>
      <label className="grid gap-1 text-[10px] font-semibold text-slate-600">To<input aria-label="Audit date to" type="date" value={to} onChange={(event) => setTo(event.target.value)} className={fieldClass} /></label>
      <div className="flex items-center gap-2 sm:col-span-2 xl:col-span-3"><button type="submit" className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">Apply filters</button><button type="button" onClick={() => { setEventType(''); setOutcome(''); setActorId(''); setTargetId(''); setFrom(''); setTo(''); setApplied({ eventType: '', outcome: '', actorId: '', targetId: '', from: '', to: '' }) }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">Clear filters</button>{accountsError && <span role="alert" className="text-[10px] text-rose-700">{accountsError}</span>}</div>
    </form>}

    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-190 text-left text-xs">
        <thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-400"><tr>{['Time', 'Activity', 'Actor', 'Affected account', 'Outcome', 'Details'].map((heading) => <th key={heading} className="px-3 py-3">{heading}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {loading && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">Loading audit events…</td></tr>}
          {error && <tr><td colSpan={6} className="px-4 py-5 text-center text-rose-700" role="alert"><p>{error}</p><button type="button" onClick={() => setApplied((current) => ({ ...current }))} className="mt-2 font-semibold text-primary hover:underline">Try again</button></td></tr>}
          {!loading && !error && events.map((entry) => <AuditRow key={entry.id} event={entry} />)}
          {!loading && !error && events.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">No audit events match these filters.</td></tr>}
        </tbody>
      </table>
    </div>
    <div className="mt-3 flex items-center justify-between"><p className="text-[10px] text-slate-400">{events.length} event{events.length === 1 ? '' : 's'} shown · times displayed in your local timezone</p>{cursor && <button type="button" disabled={loadingMore} onClick={() => void loadMore()} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">{loadingMore ? 'Loading…' : 'Load more'}</button>}</div>
    <p className="mt-3 text-[10px] leading-4 text-slate-400">Audit records are server-generated and retained until an approved retention policy is configured. IP addresses and device details are access-restricted.</p>
  </div>
}

function AuditRow({ event }: { event: AuditEvent }) {
  return <tr className="align-top text-slate-600">
    <td className="whitespace-nowrap px-3 py-3 text-[10px] text-slate-500">{formatTimestamp(event.createdAt)}</td>
    <td className="px-3 py-3"><span className="font-semibold text-slate-800">{label(event.eventType)}</span>{event.reason && <span className="mt-1 block text-[10px] text-slate-400">{label(event.reason)}</span>}</td>
    <td className="px-3 py-3">{event.actor?.name || 'System / unauthenticated'}{event.actor?.roles.length ? <span className="mt-1 block text-[10px] text-slate-400">{event.actor.roles.join(', ')}</span> : null}</td>
    <td className="px-3 py-3">{event.target?.name || '—'}{event.target?.email && <span className="mt-1 block text-[10px] text-slate-400">{event.target.email}</span>}</td>
    <td className="px-3 py-3"><span className={`rounded px-2 py-1 text-[10px] font-semibold capitalize ${event.outcome === 'success' ? 'bg-emerald-50 text-emerald-700' : event.outcome === 'failure' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'}`}>{event.outcome}</span></td>
    <td className="px-3 py-3"><details><summary className="cursor-pointer text-[10px] font-semibold text-primary">View</summary><dl className="mt-2 space-y-1 text-[10px]">{event.ipAddress && <div><dt className="inline font-semibold">IP: </dt><dd className="inline">{event.ipAddress}</dd></div>}{event.userAgent && <div><dt className="inline font-semibold">Device: </dt><dd className="inline break-all">{event.userAgent}</dd></div>}{event.sessionId && <div><dt className="inline font-semibold">Session: </dt><dd className="inline break-all">{event.sessionId}</dd></div>}{Object.entries(event.details).map(([key, value]) => <div key={key}><dt className="inline font-semibold">{label(key)}: </dt><dd className="inline break-all">{Array.isArray(value) ? value.join(', ') : typeof value === 'object' ? JSON.stringify(value) : String(value)}</dd></div>)}</dl></details></td>
  </tr>
}
