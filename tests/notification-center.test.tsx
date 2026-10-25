import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import NotificationCenter from '@/components/notification-center'
import type { NotificationRecord, UserAccount } from '@/lib/user-api'

const notificationApi = vi.hoisted(() => ({
  listNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  handlers: new Map<string, (payload: unknown) => void>(),
  disconnect: vi.fn(),
}))

vi.mock('@/lib/user-api', () => ({
  listNotifications: notificationApi.listNotifications,
  markNotificationRead: notificationApi.markNotificationRead,
  markAllNotificationsRead: notificationApi.markAllNotificationsRead,
  NOTIFICATION_SOCKET_URL: 'http://localhost:5000',
}))

vi.mock('socket.io-client', () => ({
  io: () => ({
    on: (event: string, handler: (payload: unknown) => void) => notificationApi.handlers.set(event, handler),
    disconnect: notificationApi.disconnect,
  }),
}))

const user: UserAccount = {
  id: 'user-1',
  name: 'Ada User',
  email: 'ada@example.test',
  roles: ['General Manager'],
  status: 'Active',
  createdAt: '2026-10-20T00:00:00.000Z',
  mustChangePassword: false,
}

const notification: NotificationRecord = {
  id: 'notice-1',
  type: 'expense.created',
  category: 'expense',
  severity: 'action_required',
  title: 'Expense needs approval',
  message: 'An expense is waiting for your decision.',
  resource: { type: 'expense', id: 'expense-1', reference: 'EXP-1' },
  occurredAt: '2026-10-24T08:00:00.000Z',
  readAt: null,
  expiresAt: null,
  createdAt: '2026-10-24T08:00:00.000Z',
}

function renderCenter(onNavigate = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return {
    onNavigate,
    ...render(
      <QueryClientProvider client={client}>
        <NotificationCenter currentUser={user} onNavigate={onNavigate} />
      </QueryClientProvider>,
    ),
  }
}

describe('notification center', () => {
  beforeEach(() => {
    notificationApi.handlers.clear()
    notificationApi.disconnect.mockReset()
    notificationApi.listNotifications.mockResolvedValue({
      notifications: [notification],
      unreadCount: 1,
      nextCursor: null,
    })
    notificationApi.markNotificationRead.mockResolvedValue({
      notification: { ...notification, readAt: '2026-10-24T09:00:00.000Z' },
      unreadCount: 0,
    })
    notificationApi.markAllNotificationsRead.mockResolvedValue({ updated: 1, unreadCount: 0 })
  })

  afterEach(() => cleanup())

  it('opens the right-side feed, shows unread count, and closes on outside click', async () => {
    renderCenter()
    const trigger = await screen.findByRole('button', { name: /Notifications/ })
    await waitFor(() => expect(trigger.getAttribute('aria-label')).toBe('Notifications, 1 unread'))
    fireEvent.click(trigger)
    const dialog = await screen.findByRole('dialog', { name: 'Notifications' })
    expect(dialog.parentElement?.parentElement).toBe(document.body)
    expect(screen.getByText('Expense needs approval')).toBeTruthy()
    fireEvent.pointerDown(screen.getByRole('dialog').parentElement!)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('marks an item read before navigating to its typed destination', async () => {
    const onNavigate = vi.fn()
    renderCenter(onNavigate)
    const trigger = await screen.findByRole('button', { name: /Notifications/ })
    await waitFor(() => expect(trigger.getAttribute('aria-label')).toBe('Notifications, 1 unread'))
    fireEvent.click(trigger)
    fireEvent.click(await screen.findByRole('button', { name: /Expense needs approval/ }))
    await waitFor(() => expect(notificationApi.markNotificationRead.mock.calls[0]?.[0]).toBe('notice-1'))
    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith('Expenses'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('marks all notifications read and closes on Escape', async () => {
    renderCenter()
    const trigger = await screen.findByRole('button', { name: /Notifications/ })
    await waitFor(() => expect(trigger.getAttribute('aria-label')).toBe('Notifications, 1 unread'))
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('button', { name: /Mark all read/ }))
    await waitFor(() => expect(notificationApi.markAllNotificationsRead).toHaveBeenCalledOnce())
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('loads action-needed notifications through the server-side filter', async () => {
    renderCenter()
    fireEvent.click(await screen.findByRole('button', { name: /Notifications/ }))
    fireEvent.click(screen.getByRole('tab', { name: 'Action needed' }))
    await waitFor(() => expect(notificationApi.listNotifications).toHaveBeenLastCalledWith({
      limit: 30,
      cursor: undefined,
      unread: false,
      category: 'action_required',
    }))
  })
})
