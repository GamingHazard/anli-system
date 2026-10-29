import { afterEach, describe, expect, it, vi } from 'vitest'
import { createOrder, getOrderDetails, getPendingOrderCount, listOrders } from '@/lib/user-api'

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response
}

afterEach(() => vi.unstubAllGlobals())

const orderResponse = {
  id: 'SERVER-ORDER',
  orderNumber: 'ORD-2026-000001',
  customerId: 'C-100',
  customer: { name: 'Saved customer' },
  items: [{
    productId: '507f1f77bcf86cd799439013',
    productName: 'Mango juice',
    packs: 2,
    pricePerPack: 24000,
    lineTotal: 48000,
  }],
  total: 48000,
  paidAmount: 0,
  date: '2026-10-23',
  requestedDate: '2026-10-24',
  fulfilmentMethod: 'Delivery' as const,
  destination: '',
  paymentTerms: 'Credit' as const,
  dueDate: '2026-11-23',
  status: 'Pending' as const,
  statusHistory: [],
  priority: 'Normal' as const,
  priorityReason: '',
  notes: '',
  reserved: false,
  createdAt: '2026-10-23T10:00:00.000Z',
}

describe('orders API client', () => {
  it('returns an empty list when the server reports no orders', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      orders: [],
      total: 0,
      page: 1,
      limit: 200,
    }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(listOrders()).resolves.toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('loads the pending, non-archived order count without fetching the full order list', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      orders: [orderResponse],
      total: 14,
      page: 1,
      limit: 1,
    }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(getPendingOrderCount()).resolves.toBe(14)
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/orders?status=Pending&archived=false&page=1&limit=1')
  })

  it('rejects invalid pending order count metadata', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      orders: [],
      total: -1,
      page: 1,
      limit: 1,
    })))

    await expect(getPendingOrderCount()).rejects.toThrow('The pending order count returned inconsistent pagination metadata.')
  })

  it('rejects pagination metadata that cannot supply the reported order total', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      orders: [],
      total: 1,
      page: 1,
      limit: 200,
    }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(listOrders()).rejects.toThrow('The order list returned inconsistent pagination metadata.')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('normalizes server snapshots including credit due dates', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      orders: [orderResponse],
      total: 1,
      page: 1,
      limit: 200,
    })))

    const [order] = await listOrders()
    expect(order.reference).toBe('ORD-2026-000001')
    expect(order.dueDate).toBe('2026-11-23')
    expect(order.items[0].productId).toBe('507f1f77bcf86cd799439013')
  })

  it('sends the caller idempotency key when creating a pending order', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ order: orderResponse }, 201))
    vi.stubGlobal('fetch', fetchMock)

    const result = await createOrder({
      customerId: 'C-100',
      items: [{ productId: '507f1f77bcf86cd799439013', packs: 2 }],
      requestedDate: '2026-10-24',
      fulfilmentMethod: 'Delivery',
      paymentTerms: 'Credit',
      dueDate: '2026-11-23',
      priority: 'Normal',
      idempotencyKey: 'ORDER-RETRY-1',
    })

    expect(result.dueDate).toBe('2026-11-23')
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(String(init.body))).toMatchObject({
      idempotencyKey: 'ORDER-RETRY-1',
      dueDate: '2026-11-23',
    })
  })

  it('loads a single order with its server payment history', async () => {
    const payment = {
      id: 'ORDER-PAY-1',
      orderId: orderResponse.id,
      amount: 12000,
      date: '2026-10-23',
      method: 'Cash' as const,
      txnID: 'TX-1',
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      order: orderResponse,
      payments: [payment],
    })))

    const result = await getOrderDetails(orderResponse.id)
    expect(result.order.reference).toBe(orderResponse.orderNumber)
    expect(result.payments).toEqual([payment])
  })
})
