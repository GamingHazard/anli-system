'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { io } from 'socket.io-client'
import {
  Bell,
  Check,
  CheckCheck,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  FileText,
  PackageSearch,
  ReceiptText,
  Wallet,
  X,
} from 'lucide-react'
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NOTIFICATION_SOCKET_URL,
  type NotificationPage,
  type NotificationRecord,
  type UserAccount,
} from '@/lib/user-api'

type Props = {
  currentUser: UserAccount
  onNavigate: (section: string) => void
}

type FeedFilter = 'all' | 'unread' | 'action'
type NotificationCache = InfiniteData<NotificationPage, string | null>

const queryKey = (userId: string, filter: FeedFilter) => ['notifications', userId, filter] as const

function sectionForResource(type: string) {
  switch (type) {
    case 'sale':
      return 'Credit Sales'
    case 'leave_request':
      return 'Leave Management'
    case 'payroll_run':
      return 'Payroll Management'
    case 'salary_advance':
      return 'Salary Advance Management'
    case 'expense':
      return 'Expenses'
    case 'disciplinary_case':
      return 'Disciplinary Letters'
    case 'raw_material_alert':
      return 'Raw Material Management'
    default:
      return null
  }
}

function categoryLabel(category: NotificationRecord['category']) {
  const labels: Record<NotificationRecord['category'], string> = {
    approval: 'Approval',
    leave: 'Leave',
    payroll: 'Payroll',
    salary_advance: 'Salary advance',
    expense: 'Expense',
    inventory: 'Inventory',
    sales: 'Credit',
    security: 'Security',
    general: 'Update',
  }
  return labels[category]
}

function NotificationIcon({ notification }: { notification: NotificationRecord }) {
  const className = 'size-4'
  if (notification.category === 'inventory') return <PackageSearch className={className} />
  if (notification.category === 'payroll' || notification.category === 'salary_advance') return <Wallet className={className} />
  if (notification.category === 'sales') return <ReceiptText className={className} />
  if (notification.category === 'leave') return <Clock3 className={className} />
  if (notification.category === 'approval' || notification.category === 'expense') return <ClipboardCheck className={className} />
  return <FileText className={className} />
}

function dateGroup(value: string) {
  const date = new Date(value)
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala' }).format(new Date())
  const yesterday = new Date(`${today}T00:00:00.000Z`)
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  const previousDay = yesterday.toISOString().slice(0, 10)
  const dateLabel = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala' }).format(date)
  if (dateLabel === today) return 'Today'
  if (dateLabel === previousDay) return 'Yesterday'
  return 'Earlier'
}

function formatTime(value: string) {
  const timestamp = new Date(value).getTime()
  const elapsed = Math.max(0, Date.now() - timestamp)
  const minutes = Math.floor(elapsed / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value))
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'The notification action could not be completed.'
}

export default function NotificationCenter({ currentUser, onNavigate }: Props) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<FeedFilter>('all')
  const [actionError, setActionError] = useState('')
  const [live, setLive] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const wasOpen = useRef(false)
  const filterRef = useRef<FeedFilter>(filter)
  filterRef.current = filter
  const queryClient = useQueryClient()
  const key = useMemo(() => queryKey(currentUser.id, filter), [currentUser.id, filter])
  const notifications = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => listNotifications({
      limit: 30,
      cursor: pageParam ?? undefined,
      unread: filter === 'unread',
      category: filter === 'action' ? 'action_required' : undefined,
    }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  })
  const pages = notifications.data?.pages ?? []
  const unreadCount = pages[0]?.unreadCount ?? 0
  const allItems = pages.flatMap((page) => page.notifications)
  const groupedItems = useMemo(() => {
    const groups = new Map<string, NotificationRecord[]>()
    for (const item of allItems) {
      const group = dateGroup(item.occurredAt || item.createdAt)
      groups.set(group, [...(groups.get(group) ?? []), item])
    }
    return [...groups.entries()].sort(([left], [right]) => {
      const order = ['Today', 'Yesterday', 'Earlier']
      return order.indexOf(left) - order.indexOf(right)
    })
  }, [allItems])
  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  })
  const markAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  })

  useEffect(() => {
    const socket = io(NOTIFICATION_SOCKET_URL, { withCredentials: true })
    socket.on('connect', () => setLive(true))
    socket.on('disconnect', () => setLive(false))
    socket.on('connect_error', () => setLive(false))
    socket.on('notification.created', (payload: { notification?: NotificationRecord }) => {
      const incoming = payload?.notification
      if (!incoming) return
      const matchesFilter = (feedFilter: FeedFilter) => (
        feedFilter === 'all' ||
        (feedFilter === 'unread' && !incoming.readAt) ||
        (feedFilter === 'action' && ['action_required', 'urgent'].includes(incoming.severity))
      )
      for (const feedFilter of ['all', 'unread', 'action'] as const) {
        const feedKey = queryKey(currentUser.id, feedFilter)
        const current = queryClient.getQueryData<NotificationCache>(feedKey)
        if (!current?.pages.length || !matchesFilter(feedFilter)) continue
        const alreadyListed = current.pages.some((page) => page.notifications.some((item) => item.id === incoming.id))
        if (alreadyListed) continue
        const firstPage = current.pages[0]
        queryClient.setQueryData<NotificationCache>(feedKey, {
          ...current,
          pages: [
            {
              ...firstPage,
              notifications: [incoming, ...firstPage.notifications].slice(0, 30),
              unreadCount: firstPage.unreadCount + (incoming.readAt ? 0 : 1),
            },
            ...current.pages.slice(1),
          ],
        })
      }
      void queryClient.invalidateQueries({ queryKey: ['notifications', currentUser.id] })
    })
    socket.on('notification.unread_count', (payload: { unreadCount?: number }) => {
      const unreadCount = payload?.unreadCount
      if (typeof unreadCount !== 'number' || !Number.isInteger(unreadCount) || unreadCount < 0) return
      for (const feedFilter of ['all', 'unread', 'action'] as const) {
        const feedKey = queryKey(currentUser.id, feedFilter)
        queryClient.setQueryData<NotificationCache>(feedKey, (current) => {
          if (!current?.pages.length) return current
          return {
            ...current,
            pages: current.pages.map((page, index) => index === 0
              ? { ...page, unreadCount }
              : page),
          }
        })
      }
    })
    return () => {
      socket.disconnect()
      setLive(false)
    }
  }, [currentUser.id, queryClient])

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      closeRef.current?.focus()
      wasOpen.current = true
    } else {
      document.body.style.overflow = ''
      if (wasOpen.current) triggerRef.current?.focus()
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  async function openNotification(notification: NotificationRecord) {
    setActionError('')
    const section = sectionForResource(notification.resource.type)
    if (!section) {
      setActionError('This item does not have a destination in the current workspace.')
      return
    }
    if (!notification.readAt) {
      try {
        await markReadMutation.mutateAsync(notification.id)
      } catch (error) {
        setActionError(errorMessage(error))
      }
    }
    setOpen(false)
    onNavigate(section)
  }

  async function markAllRead() {
    setActionError('')
    try {
      await markAllMutation.mutateAsync()
    } catch (error) {
      setActionError(errorMessage(error))
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="notification-center"
        onClick={() => {
          setActionError('')
          setOpen((value) => !value)
        }}
        className={`relative rounded-xl p-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 ${open ? 'bg-violet-50 text-violet-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}
      >
        <Bell className="size-[19px]" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full border-2 border-white bg-violet-600 px-1 py-0.5 text-center text-[9px] font-bold leading-none text-white shadow-sm">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[70] bg-slate-950/25 backdrop-blur-[2px]"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false)
          }}
        >
          <aside
            ref={panelRef}
            id="notification-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="notification-center-title"
            className="absolute inset-y-0 right-0 flex w-full max-w-[min(100vw,460px)] flex-col border-l border-slate-200/80 bg-[#fbfbfe] shadow-2xl shadow-slate-950/20"
          >
            <header className="relative overflow-hidden border-b border-slate-100 bg-white px-5 pb-4 pt-5 sm:px-6">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 via-indigo-500 to-sky-400" />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="grid size-9 place-items-center rounded-xl bg-violet-50 text-violet-700">
                      <Bell className="size-4" />
                    </span>
                    <div>
                      <h2 id="notification-center-title" className="text-base font-bold tracking-tight text-slate-900">Notifications</h2>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {unreadCount === 0 ? 'You’re all caught up' : `${unreadCount} unread ${unreadCount === 1 ? 'update' : 'updates'}`}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={() => void markAllRead()}
                      disabled={markAllMutation.isPending}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-semibold text-violet-700 transition hover:bg-violet-50 disabled:opacity-50"
                    >
                      <CheckCheck className="size-3.5" />
                      <span className="hidden sm:inline">Mark all read</span>
                      <span className="sm:hidden">Read all</span>
                    </button>
                  )}
                  <button
                    ref={closeRef}
                    type="button"
                    aria-label="Close notifications"
                    onClick={() => setOpen(false)}
                    className="grid size-9 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between gap-3">
                <div role="tablist" aria-label="Filter notifications" className="flex rounded-xl bg-slate-100 p-1">
                  {([
                    ['all', 'All'],
                    ['unread', 'Unread'],
                    ['action', 'Action needed'],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="tab"
                      aria-selected={filter === value}
                      onClick={() => setFilter(value)}
                      className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${filter === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium ${live ? 'text-emerald-700' : 'text-slate-400'}`}>
                  <span className={`size-1.5 rounded-full ${live ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  {live ? 'Live' : 'Auto-sync'}
                </span>
              </div>
            </header>

            {actionError && (
              <div role="alert" className="mx-4 mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800">
                <CircleAlert className="mt-0.5 size-4 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-3 sm:px-5">
              {notifications.isLoading ? (
                <div role="status" className="space-y-3 py-5">
                  <span className="sr-only">Loading notifications</span>
                  {[0, 1, 2].map((item) => (
                    <div key={item} className="animate-pulse rounded-2xl border border-slate-100 bg-white p-4">
                      <div className="flex gap-3">
                        <div className="size-9 rounded-xl bg-slate-100" />
                        <div className="flex-1 space-y-2 pt-1">
                          <div className="h-3 w-2/3 rounded bg-slate-100" />
                          <div className="h-2.5 w-full rounded bg-slate-50" />
                          <div className="h-2.5 w-1/3 rounded bg-slate-50" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : notifications.isError ? (
                <div role="alert" className="my-6 rounded-2xl border border-rose-100 bg-white p-5 text-center">
                  <CircleAlert className="mx-auto size-6 text-rose-500" />
                  <p className="mt-3 text-sm font-semibold text-slate-800">Notifications couldn’t load</p>
                  <p className="mt-1 text-xs text-slate-500">Check your connection, then try again.</p>
                  <button type="button" onClick={() => void notifications.refetch()} className="mt-4 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700">Try again</button>
                </div>
              ) : groupedItems.length === 0 ? (
                <div className="grid min-h-64 place-items-center py-10 text-center">
                  <div>
                    <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-white text-slate-300 shadow-sm ring-1 ring-slate-100">
                      <Check className="size-6" />
                    </span>
                    <h3 className="mt-4 text-sm font-semibold text-slate-800">
                      {filter === 'all' ? 'You’re all caught up' : 'Nothing in this view'}
                    </h3>
                    <p className="mx-auto mt-1 max-w-56 text-xs leading-5 text-slate-500">
                      {filter === 'all' ? 'Important updates and tasks will appear here.' : 'Try another filter to see more notifications.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  {groupedItems.map(([group, items]) => (
                    <section key={group} aria-label={group}>
                      <div className="mb-2 flex items-center justify-between px-1">
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">{group}</h3>
                        <span className="text-[10px] tabular-nums text-slate-400">{items.length}</span>
                      </div>
                      <div className="space-y-2">
                        {items.map((notification) => {
                          const actionRequired = notification.severity === 'action_required' || notification.severity === 'urgent'
                          const destination = sectionForResource(notification.resource.type)
                          return (
                            <article
                              key={notification.id}
                              className={`group relative overflow-hidden rounded-2xl border transition-all ${notification.readAt ? 'border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm' : 'border-violet-100 bg-white shadow-[0_2px_12px_rgba(79,70,229,0.045)] hover:border-violet-200 hover:shadow-md'}`}
                            >
                              {!notification.readAt && <span className="absolute bottom-3 left-0 top-3 w-0.5 rounded-r bg-violet-500" />}
                              <button
                                type="button"
                                onClick={() => void openNotification(notification)}
                                className="w-full p-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500 sm:p-4"
                              >
                                <span className="flex items-start gap-3">
                                  <span className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl ${notification.severity === 'urgent' ? 'bg-rose-50 text-rose-600' : actionRequired ? 'bg-violet-50 text-violet-700' : 'bg-slate-50 text-slate-500'}`}>
                                    <NotificationIcon notification={notification} />
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="flex items-start justify-between gap-2">
                                      <span className={`text-[13px] leading-5 ${notification.readAt ? 'font-semibold text-slate-800' : 'font-bold text-slate-950'}`}>{notification.title}</span>
                                      <span className="shrink-0 pt-0.5 text-[10px] text-slate-400">{formatTime(notification.occurredAt || notification.createdAt)}</span>
                                    </span>
                                    <span className="mt-1 block line-clamp-2 text-xs leading-[1.55] text-slate-500">{notification.message}</span>
                                    <span className="mt-3 flex flex-wrap items-center gap-2">
                                      <span className="rounded-md bg-slate-50 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-slate-500">{categoryLabel(notification.category)}</span>
                                      {notification.resource.reference && <span className="max-w-36 truncate text-[10px] font-medium text-slate-400">{notification.resource.reference}</span>}
                                      {actionRequired && (
                                        <span className={`ml-auto inline-flex items-center gap-1 text-[10px] font-bold ${notification.severity === 'urgent' ? 'text-rose-600' : 'text-violet-700'}`}>
                                          {destination ? 'Open task' : 'View update'} <ChevronRight className="size-3" />
                                        </span>
                                      )}
                                      {!actionRequired && destination && <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 group-hover:text-slate-700">View <ChevronRight className="size-3" /></span>}
                                    </span>
                                  </span>
                                </span>
                              </button>
                            </article>
                          )
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              )}
              {notifications.hasNextPage && (
                <button
                  type="button"
                  onClick={() => void notifications.fetchNextPage()}
                  disabled={notifications.isFetchingNextPage}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-50"
                >
                  {notifications.isFetchingNextPage ? 'Loading older notifications…' : 'Load older notifications'}
                  {!notifications.isFetchingNextPage && <ChevronRight className="size-3.5 rotate-90" />}
                </button>
              )}
            </div>
            <footer className="flex items-center justify-between border-t border-slate-100 bg-white px-5 py-3 text-[10px] text-slate-400 sm:px-6">
              <span>Updates for {currentUser.roles.slice(0, 2).join(' · ') || 'your account'}</span>
              <button type="button" onClick={() => void notifications.refetch()} className="font-semibold text-slate-500 hover:text-violet-700">Refresh</button>
            </footer>
          </aside>
        </div>,
        document.body,
      )}
    </>
  )
}
