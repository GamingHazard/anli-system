import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AuditWorkspace from '@/components/audit-workspace'
import type { UserAccount } from '@/lib/user-api'

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const currentUser: UserAccount = {
  id: 'admin-1',
  name: 'Workspace Admin',
  email: 'admin@example.com',
  roles: ['Super Admin'],
  status: 'Active',
  createdAt: '2026-01-01T00:00:00.000Z',
  mustChangePassword: false,
}

describe('audit workspace', () => {
  it('loads server event types and global events, then reveals event details', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/users')) return Promise.resolve(jsonResponse({ users: [] }))
      if (url.includes('/audit/event-types')) {
        return Promise.resolve(jsonResponse({
          eventTypes: ['inventory.raw_material_transferred'],
          resourceTypes: ['inventory'],
          categories: ['inventory'],
        }))
      }
      if (url.includes('/audit')) {
        return Promise.resolve(jsonResponse({
          events: [{
            id: 'event-1',
            eventType: 'inventory.raw_material_transferred',
            outcome: 'success',
            actor: { id: 'admin-1', name: 'Workspace Admin', roles: ['Super Admin'] },
            target: null,
            resource: { type: 'raw_material', id: 'material-1', reference: 'MAT-01' },
            sessionId: 'session-1',
            ipAddress: '192.0.2.2',
            details: { quantity: 12, unit: 'kg' },
            createdAt: '2026-10-25T06:00:00.000Z',
          }],
          nextCursor: null,
        }))
      }
      return Promise.resolve(jsonResponse({}, 404))
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<AuditWorkspace currentUser={currentUser} />)

    expect(await screen.findByRole('option', { name: 'inventory · raw material transferred' })).toBeTruthy()
    expect(await screen.findByText('MAT-01')).toBeTruthy()
    expect(await screen.findByText('Workspace Admin')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Details/ }))
    expect(await screen.findByText('192.0.2.2')).toBeTruthy()
    expect(screen.getByText('12')).toBeTruthy()
    expect(screen.getByText('material-1')).toBeTruthy()
  })

  it('applies server-supported filters and uses the account-scoped feed', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/users')) {
        return Promise.resolve(jsonResponse({
          users: [{
            id: 'staff-1',
            name: 'Staff Member',
            email: 'staff@example.com',
            roles: ['Accountant'],
            status: 'Active',
            createdAt: '2026-01-01T00:00:00.000Z',
            mustChangePassword: false,
          }],
        }))
      }
      if (url.includes('/audit/event-types')) {
        return Promise.resolve(jsonResponse({
          eventTypes: ['auth.login.failed'],
          resourceTypes: ['users'],
          categories: ['auth'],
        }))
      }
      return Promise.resolve(jsonResponse({ events: [], nextCursor: null }))
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<AuditWorkspace currentUser={currentUser} />)
    await screen.findAllByRole('option', { name: 'Staff Member' })
    fireEvent.change(screen.getByLabelText('Filter by area'), { target: { value: 'auth' } })
    fireEvent.change(screen.getByLabelText('Filter by activity'), { target: { value: 'auth.login.failed' } })
    fireEvent.change(screen.getByLabelText('Filter by outcome'), { target: { value: 'denied' } })
    fireEvent.change(screen.getByLabelText('Filter by actor'), { target: { value: 'staff-1' } })
    fireEvent.change(screen.getByLabelText('Filter by resource type'), { target: { value: 'users' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }))

    await waitFor(() => {
      const globalCall = fetchMock.mock.calls.find(([input]) => String(input).includes('/audit?'))
      expect(globalCall?.[0]).toContain('eventType=auth.login.failed')
      expect(globalCall?.[0]).toContain('category=auth')
      expect(globalCall?.[0]).toContain('outcome=denied')
      expect(globalCall?.[0]).toContain('actorId=staff-1')
      expect(globalCall?.[0]).toContain('resourceType=users')
    })
  })

  it('filters grouped tabs and keeps the selected categories when loading another page', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/users')) return Promise.resolve(jsonResponse({ users: [] }))
      if (url.includes('/audit/event-types')) {
        return Promise.resolve(jsonResponse({
          eventTypes: ['sale.created', 'credit.sale_updated', 'receipt.archived', 'data.read.succeeded', 'order.created'],
          resourceTypes: ['sale'],
          categories: ['sale', 'credit', 'receipt', 'data', 'order'],
        }))
      }
      if (url.includes('/audit?')) {
        return Promise.resolve(jsonResponse({
          events: [],
          nextCursor: url.includes('cursor=') ? null : 'next-page',
        }))
      }
      return Promise.resolve(jsonResponse({}, 404))
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<AuditWorkspace currentUser={currentUser} />)

    fireEvent.click(await screen.findByRole('tab', { name: 'Sales & credit' }))
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([input]) => (
        String(input).includes('categories=sale%2Ccredit%2Creceipt')
      ))).toBe(true)
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Load more' }))
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([input]) => {
        const url = String(input)
        return url.includes('categories=sale%2Ccredit%2Creceipt') && url.includes('cursor=next-page')
      })).toBe(true)
    })

    fireEvent.click(screen.getByRole('tab', { name: 'System' }))
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([input]) => String(input).includes('categories=data'))).toBe(true)
    })
  })

  it('does not request the global feed for a non-Super Admin', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<AuditWorkspace currentUser={{ ...currentUser, roles: ['Accountant'] }} />)
    expect(screen.getByText('Audit records are restricted to Super Admin accounts.')).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
