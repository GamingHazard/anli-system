'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  CircleDollarSign,
  ClipboardList,
  Download,
  Factory,
  PackageSearch,
  Plus,
  RefreshCw,
  TrendingUp,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getDashboardSummary, type DashboardAvailability, type UserRole } from '@/lib/user-api'

type Period = 'today' | '7d' | '30d'

function kampalaDate() {
  const values = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Kampala',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const parts = Object.fromEntries(values.map(({ type, value }) => [type, value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

function previousDate(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day - days))
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`
}

function money(value: number) {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0,
  }).format(value)
}

function shortMoney(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`
  return String(value)
}

function sectionAvailable<T extends object>(
  section: (DashboardAvailability & T) | undefined,
): section is { status: 'available' } & T {
  return section?.status === 'available'
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return reduced
}

function SectionError({ section }: { section: DashboardAvailability | undefined }) {
  if (!section || section.status !== 'unavailable') return null
  return (
    <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
      {section.message}
    </p>
  )
}

function SummaryCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
  onClick,
  index,
}: {
  label: string
  value: string
  detail: string
  icon: typeof TrendingUp
  tone: string
  onClick: () => void
  index: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition duration-300 hover:-translate-y-1 hover:border-violet-200 hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-500"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div className="flex items-center justify-between">
        <span className={`grid size-10 place-items-center rounded-xl ${tone}`}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <ArrowUpRight className="size-4 text-slate-300 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-violet-600" aria-hidden="true" />
      </div>
      <div className="mt-4 text-2xl font-bold tracking-tight text-slate-900">{value}</div>
      <div className="mt-1 text-xs font-semibold text-slate-600">{label}</div>
      <div className="mt-2 text-[11px] text-slate-400">{detail}</div>
    </button>
  )
}

function LoadingCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Loading dashboard metrics">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white p-5 motion-reduce:animate-none">
          <div className="size-10 rounded-xl bg-slate-100" />
          <div className="mt-5 h-6 w-2/3 rounded bg-slate-100" />
          <div className="mt-3 h-3 w-1/2 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  )
}

export default function DashboardOverview({
  companyName,
  companyLogoUrl,
  userName,
  roles,
  onNavigate,
  onExportSales,
}: {
  companyName: string
  companyLogoUrl: string
  userName: string
  roles: readonly UserRole[]
  onNavigate: (page: string) => void
  onExportSales: () => void
}) {
  const [period, setPeriod] = useState<Period>('7d')
  const [today, setToday] = useState('')
  const reducedMotion = useReducedMotion()

  useEffect(() => setToday(kampalaDate()), [])

  const range = useMemo(() => {
    const end = today || kampalaDate()
    const days = period === 'today' ? 0 : period === '30d' ? 29 : 6
    return { from: previousDate(end, days), to: end }
  }, [period, today])

  const query = useQuery({
    queryKey: ['dashboard-summary', roles, range.from, range.to],
    queryFn: () => getDashboardSummary(range.from, range.to),
    enabled: Boolean(today),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 30_000,
  })

  const summary = query.data
  const sections = summary?.sections
  const metrics: Array<{
    label: string
    value: string
    detail: string
    icon: typeof TrendingUp
    tone: string
    target: string
  }> = []
  if (sectionAvailable(sections?.sales)) {
    metrics.push(
      { label: 'Sales revenue', value: money(sections.sales.revenue ?? 0), detail: `Collected ${money(sections.sales.collected ?? 0)}`, icon: CircleDollarSign, tone: 'bg-violet-50 text-violet-700', target: 'Sales' },
      { label: 'Outstanding receivables', value: money(sections.sales.outstanding ?? 0), detail: `All periods · ${sections.sales.overdueReceivables ?? 0} overdue accounts`, icon: ArrowDownRight, tone: 'bg-amber-50 text-amber-700', target: 'Sales' },
    )
  }
  if (sectionAvailable(sections?.orders)) {
    metrics.push({ label: 'Open orders', value: String(sections.orders.open ?? 0), detail: `${sections.orders.late ?? 0} late · ${sections.orders.highPriority ?? 0} high priority`, icon: ClipboardList, tone: 'bg-blue-50 text-blue-700', target: 'Orders' })
  }
  if (sectionAvailable(sections?.production)) {
    metrics.push({ label: 'Production output', value: (sections.production.produced ?? 0).toLocaleString(), detail: `${(sections.production.damaged ?? 0).toLocaleString()} damaged units`, icon: Factory, tone: 'bg-emerald-50 text-emerald-700', target: 'Production Management' })
  }
  if (sectionAvailable(sections?.inventory)) {
    metrics.push({ label: 'Low-stock alerts', value: String(sections.inventory.activeLowStock ?? 0), detail: 'Active materials below reorder threshold', icon: Boxes, tone: 'bg-orange-50 text-orange-700', target: 'Raw Material Management' })
  }
  if (sectionAvailable(sections?.expenses)) {
    metrics.push({ label: 'Approved expenses', value: money(sections.expenses.total ?? 0), detail: `${sections.expenses.pendingApproval ?? 0} awaiting approval`, icon: Activity, tone: 'bg-fuchsia-50 text-fuchsia-700', target: 'Expenses' })
  }
  if (sectionAvailable(sections?.people)) {
    metrics.push({ label: 'Attendance records', value: String(sections.people.recordedAttendance ?? 0), detail: `${sections.people.pendingLeave ?? 0} leave requests pending`, icon: Activity, tone: 'bg-sky-50 text-sky-700', target: 'Attendance Management' })
  }
  if (sectionAvailable(sections?.assets)) {
    metrics.push({ label: 'Assets due soon', value: String(sections.assets.dueMaintenance ?? 0), detail: 'Inspection, service or insurance deadlines', icon: Boxes, tone: 'bg-cyan-50 text-cyan-700', target: 'Assets Management' })
  }

  const actionItems = [
    sectionAvailable(sections?.orders) && (sections.orders.late ?? 0) > 0
      ? { title: `${sections.orders.late} late orders`, detail: 'Review delivery commitments', target: 'Orders', icon: AlertTriangle }
      : null,
    sectionAvailable(sections?.sales) && (sections.sales.overdueReceivables ?? 0) > 0
      ? { title: `${sections.sales.overdueReceivables} overdue receivables`, detail: 'Follow up on outstanding payments', target: 'Sales', icon: CircleDollarSign }
      : null,
    sectionAvailable(sections?.inventory) && (sections.inventory.activeLowStock ?? 0) > 0
      ? { title: `${sections.inventory.activeLowStock} low-stock materials`, detail: 'Check reorder requirements', target: 'Raw Material Management', icon: PackageSearch }
      : null,
    sectionAvailable(sections?.expenses) && (sections.expenses.pendingApproval ?? 0) > 0
      ? { title: `${sections.expenses.pendingApproval} expenses awaiting approval`, detail: 'Review the finance queue', target: 'Expenses', icon: ClipboardList }
      : null,
    sectionAvailable(sections?.people) && (sections.people.pendingLeave ?? 0) > 0
      ? { title: `${sections.people.pendingLeave} leave requests pending`, detail: 'Review the HR queue', target: 'Leave Management', icon: ClipboardList }
      : null,
    sectionAvailable(sections?.assets) && (sections.assets.dueMaintenance ?? 0) > 0
      ? { title: `${sections.assets.dueMaintenance} asset deadlines due`, detail: 'Check inspection and service schedules', target: 'Assets Management', icon: AlertTriangle }
      : null,
  ].filter((item) => item !== null)

  const periodLabel = period === 'today' ? 'Today' : period === '30d' ? 'Last 30 days' : 'Last 7 days'

  return (
    <div className="space-y-5">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-[11px] font-semibold text-violet-700">
            {companyLogoUrl ? <img src={companyLogoUrl} alt="" className="size-5 rounded bg-white object-contain p-0.5" /> : <TrendingUp className="size-3.5" aria-hidden="true" />}
            Welcome, {userName.split(/\s+/)[0]}
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{companyName} overview</h2>
          <p className="mt-1 text-sm text-slate-500">Operational performance and actions tailored to your access.</p>
          <p className="mt-1 text-xs text-slate-400">{roles.join(' · ')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sections?.sales && (
            <>
              <button type="button" onClick={onExportSales} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 motion-reduce:transition-none">
                <Download className="size-4" aria-hidden="true" /> Export
              </button>
              <button type="button" onClick={() => onNavigate('Sales')} className="inline-flex items-center gap-2 rounded-lg bg-violet-700 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-800 motion-reduce:transition-none">
                <Plus className="size-4" aria-hidden="true" /> New sale
              </button>
            </>
          )}
          <label htmlFor="dashboard-period" className="sr-only">Dashboard date range</label>
          <select
            id="dashboard-period"
            value={period}
            onChange={(event) => setPeriod(event.target.value as Period)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100 motion-reduce:transition-none"
          >
            <option value="today">Today</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
          <button
            type="button"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
            aria-label="Refresh dashboard data"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 motion-reduce:transition-none"
          >
            <RefreshCw className={`size-3.5 ${query.isFetching && !reducedMotion ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </header>

      {!today || query.isLoading ? <LoadingCards /> : query.isError && !summary ? (
        <section role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
          <p className="font-semibold">Dashboard data could not be loaded.</p>
          <p className="mt-1">Your work is unchanged. Check your connection and retry.</p>
          <button type="button" onClick={() => void query.refetch()} className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-rose-800 shadow-sm">Try again</button>
        </section>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-white/80 px-4 py-2.5 text-xs text-slate-500">
            <span>{periodLabel} <span className="text-slate-400">· {range.from} to {range.to} · Kampala time</span></span>
            <span aria-live="polite">{query.isFetching ? 'Refreshing…' : summary?.generatedAt ? `Updated ${new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(summary.generatedAt))}` : 'Waiting for data'}</span>
          </div>
          {query.isError && summary && <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Refresh failed. Showing the last successful dashboard snapshot.</p>}

          {metrics.length > 0 ? (
            <section aria-label="Key performance indicators" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric, index) => (
                <SummaryCard key={metric.label} {...metric} index={index} onClick={() => onNavigate(metric.target)} />
              ))}
            </section>
          ) : (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
              No dashboard sections are available for the assigned role.
            </section>
          )}

          {actionItems.length > 0 && (
            <section aria-labelledby="dashboard-actions-title" className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-lg bg-amber-100 text-amber-700"><AlertTriangle className="size-4" aria-hidden="true" /></span>
                <div>
                  <h3 id="dashboard-actions-title" className="text-sm font-bold text-slate-900">Needs attention</h3>
                  <p className="text-xs text-slate-500">Time-sensitive items from your authorized workflows</p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {actionItems.map((item, index) => item && (
                  <button key={item.title} type="button" onClick={() => onNavigate(item.target)} className="flex items-center gap-3 rounded-xl border border-white bg-white/90 p-3 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300" style={{ animationDelay: `${index * 60}ms` }}>
                    <item.icon className="size-4 shrink-0 text-amber-600" aria-hidden="true" />
                    <span className="min-w-0"><span className="block truncate text-xs font-semibold text-slate-800">{item.title}</span><span className="mt-0.5 block truncate text-[11px] text-slate-500">{item.detail}</span></span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <div className={`grid gap-4 ${sections?.sales ? 'xl:grid-cols-[1.6fr_1fr]' : 'xl:grid-cols-1'}`}>
            {sections?.sales && (
              <section aria-labelledby="dashboard-sales-title" className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-5 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 id="dashboard-sales-title" className="text-sm font-bold text-slate-900">Sales & collections</h3>
                    <p className="mt-1 text-xs text-slate-400">Daily revenue compared with payments received</p>
                  </div>
                  {sectionAvailable(sections.sales) && <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700">{money(sections.sales.revenue ?? 0)} revenue</span>}
                </div>
                {sectionAvailable(sections.sales) ? (
                  sections.sales.trend?.length ? (
                    <div className="h-[260px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={sections.sales.trend} margin={{ top: 8, right: 10, left: 4, bottom: 0 }}>
                          <defs>
                            <linearGradient id="dashboardRevenue" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.24} />
                              <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid vertical={false} stroke="#eef0f4" />
                          <XAxis dataKey="date" tickFormatter={(value: string) => value.slice(5)} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(value: number) => shortMoney(value)} width={48} />
                          <Tooltip formatter={(value) => [money(Number(value ?? 0)), '']} labelFormatter={(label) => `Date: ${label}`} />
                          <Area isAnimationActive={!reducedMotion} type="monotone" dataKey="revenue" name="Revenue" stroke="#7c3aed" strokeWidth={2.5} fill="url(#dashboardRevenue)" />
                          <Area isAnimationActive={!reducedMotion} type="monotone" dataKey="collected" name="Collected" stroke="#0f766e" strokeWidth={2} fill="transparent" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <p className="grid h-[220px] place-items-center text-sm text-slate-400">No sales in this period yet.</p>
                ) : <SectionError section={sections.sales} />}
                <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-2"><span className="size-2 rounded-full bg-violet-600" />Revenue</span>
                  <span className="inline-flex items-center gap-2"><span className="size-2 rounded-full bg-teal-700" />Collected</span>
                </div>
              </section>
            )}

            {(sections?.orders || sections?.production) && <section aria-labelledby="dashboard-operations-title" className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-4">
                <h3 id="dashboard-operations-title" className="text-sm font-bold text-slate-900">Operations snapshot</h3>
                <p className="mt-1 text-xs text-slate-400">Order pipeline and production for this period</p>
              </div>
              {sections?.orders && (sectionAvailable(sections.orders) ? (
                sections.orders.byStatus?.length ? (
                  <div className="h-[190px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sections.orders.byStatus} layout="vertical" margin={{ top: 0, right: 10, left: 8, bottom: 0 }}>
                        <CartesianGrid horizontal={false} stroke="#eef0f4" />
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="status" width={88} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                        <Tooltip formatter={(value) => [Number(value ?? 0), 'Orders']} />
                        <Bar isAnimationActive={!reducedMotion} dataKey="count" name="Orders" fill="#6366f1" radius={[0, 5, 5, 0]} barSize={16} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : <p className="py-8 text-center text-xs text-slate-400">No orders to display.</p>
              ) : <SectionError section={sections.orders} />)}
              {sections?.production && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-2 font-semibold text-slate-700"><Factory className="size-3.5 text-emerald-600" />Production output</span>
                    {sectionAvailable(sections.production) && <span className="font-semibold text-slate-700">{(sections.production.produced ?? 0).toLocaleString()} units</span>}
                  </div>
                  {sectionAvailable(sections.production) ? (
                    sections.production.trend?.length ? (
                      <div className="h-[105px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={sections.production.trend} margin={{ top: 2, right: 2, left: -25, bottom: 0 }}>
                            <XAxis dataKey="date" tickFormatter={(value: string) => value.slice(5)} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                            <Tooltip formatter={(value) => [Number(value ?? 0).toLocaleString(), '']} />
                            <Bar isAnimationActive={!reducedMotion} dataKey="produced" name="Produced" fill="#10b981" radius={[3, 3, 0, 0]} />
                            <Bar isAnimationActive={!reducedMotion} dataKey="damaged" name="Damaged" fill="#fb7185" radius={[3, 3, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : <p className="text-xs text-slate-400">No production runs in this period.</p>
                  ) : <SectionError section={sections.production} />}
                </div>
              )}
            </section>}
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sectionAvailable(sections?.sales) && (
              <section aria-labelledby="dashboard-products-title" className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-3"><h3 id="dashboard-products-title" className="text-sm font-bold text-slate-900">Top products</h3><p className="mt-1 text-xs text-slate-400">Revenue by product in the selected period</p></div>
                {sections.sales.products?.length ? (
                  <div className="h-[190px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sections.sales.products} layout="vertical" margin={{ top: 0, right: 12, left: 4, bottom: 0 }}>
                        <CartesianGrid horizontal={false} stroke="#eef0f4" />
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="name" width={90} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                        <Tooltip formatter={(value) => [money(Number(value ?? 0)), 'Revenue']} />
                        <Bar isAnimationActive={!reducedMotion} dataKey="revenue" name="Revenue" fill="#8b5cf6" radius={[0, 5, 5, 0]} barSize={16} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : <p className="py-8 text-center text-xs text-slate-400">No product sales in this period.</p>}
              </section>
            )}
            {sections?.expenses && (
              <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-fuchsia-50 text-fuchsia-700"><Activity className="size-5" aria-hidden="true" /></span>
                  <div><h3 className="text-sm font-bold text-slate-900">Finance snapshot</h3><p className="mt-1 text-xs text-slate-400">Approved expense total · {periodLabel.toLowerCase()}</p></div>
                </div>
                {sectionAvailable(sections.expenses) ? (
                  <>
                    <div className="mt-4 flex items-end justify-between gap-3">
                      <div className="text-xl font-bold text-slate-900">{money(sections.expenses.total ?? 0)}</div>
                      <button type="button" onClick={() => onNavigate('Expenses')} className="text-xs font-semibold text-violet-700 hover:text-violet-900">Review {sections.expenses.pendingApproval ?? 0} pending <ArrowUpRight className="inline size-3.5" aria-hidden="true" /></button>
                    </div>
                    {sections.expenses.trend?.length ? (
                      <div className="mt-3 h-[95px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={sections.expenses.trend}>
                            <XAxis dataKey="date" tickFormatter={(value: string) => value.slice(5)} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                            <Tooltip formatter={(value) => [money(Number(value ?? 0)), 'Expenses']} />
                            <Area isAnimationActive={!reducedMotion} type="monotone" dataKey="amount" name="Approved expenses" stroke="#c026d3" fill="#fae8ff" strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    ) : <p className="mt-3 text-xs text-slate-400">No approved expenses in this period.</p>}
                  </>
                ) : <SectionError section={sections.expenses} />}
              </section>
            )}
            {sections?.inventory && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-orange-50 text-orange-700"><Boxes className="size-5" aria-hidden="true" /></span>
                  <div><h3 className="text-sm font-bold text-slate-900">Inventory watch</h3><p className="mt-1 text-xs text-slate-400">Persistent raw-material threshold alerts</p></div>
                </div>
                {sectionAvailable(sections.inventory) ? (
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div><div className="text-xl font-bold text-slate-900">{sections.inventory.activeLowStock ?? 0}</div><div className="mt-1 text-xs text-slate-500">active low-stock alerts</div></div>
                    <button type="button" onClick={() => onNavigate('Raw Material Management')} className="text-xs font-semibold text-violet-700 hover:text-violet-900">Open inventory <ArrowUpRight className="inline size-3.5" aria-hidden="true" /></button>
                  </div>
                ) : <SectionError section={sections.inventory} />}
              </section>
            )}
            {sections?.people && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-sky-50 text-sky-700"><Activity className="size-5" aria-hidden="true" /></span><div><h3 className="text-sm font-bold text-slate-900">People operations</h3><p className="mt-1 text-xs text-slate-400">Aggregate attendance and leave status</p></div></div>
                {sectionAvailable(sections.people) ? (
                  <>
                    <div className="mt-4 flex items-end justify-between gap-3">
                      <div><div className="text-xl font-bold text-slate-900">{sections.people.recordedAttendance ?? 0}</div><div className="mt-1 text-xs text-slate-500">attendance records in range</div></div>
                      <button type="button" onClick={() => onNavigate('Leave Management')} className="text-xs font-semibold text-violet-700 hover:text-violet-900">{sections.people.pendingLeave ?? 0} pending leave <ArrowUpRight className="inline size-3.5" aria-hidden="true" /></button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {sections.people.attendanceByStatus?.map((item) => <span key={item.status} className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600">{item.status}: {item.count}</span>)}
                    </div>
                  </>
                ) : <SectionError section={sections.people} />}
              </section>
            )}
            {sections?.assets && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-cyan-50 text-cyan-700"><Boxes className="size-5" aria-hidden="true" /></span><div><h3 className="text-sm font-bold text-slate-900">Asset care</h3><p className="mt-1 text-xs text-slate-400">Deadlines over the next 30 days or already due</p></div></div>
                {sectionAvailable(sections.assets) ? (
                  <div className="mt-4 flex items-end justify-between gap-3"><div className="text-xl font-bold text-slate-900">{sections.assets.dueMaintenance ?? 0} due</div><button type="button" onClick={() => onNavigate('Assets Management')} className="text-xs font-semibold text-violet-700 hover:text-violet-900">Review assets <ArrowUpRight className="inline size-3.5" aria-hidden="true" /></button></div>
                ) : <SectionError section={sections.assets} />}
              </section>
            )}
          </div>
        </>
      )}
    </div>
  )
}
