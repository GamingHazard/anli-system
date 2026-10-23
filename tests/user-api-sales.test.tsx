import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSale, getCreditCustomerStatement, getCreditReminderSettings, importLegacySales, listCreditNotifications, listSalesOwners, markCreditNotificationRead, updateCreditReminderSettings, updateCreditSale } from '@/lib/user-api'
import type { Sale, SalePayment } from '@/lib/erp'

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response
}

afterEach(() => vi.unstubAllGlobals())

const saleResponse = {
  id: 'SERVER-SALE',
  receiptNumber: 'SAL-2026-000001',
  receiptYear: 2026,
  receiptSequence: 1,
  customerId: 'C-100',
  customer: { name: 'Saved customer', phone: '+256700000000' },
  company: { name: 'Example Ltd', email: 'info@example.test' },
  date: '2026-10-23',
  lines: [{
    productId: '507f1f77bcf86cd799439013',
    productCode: 'J-1',
    productName: 'Mango juice',
    packType: 'Box' as const,
    piecesPerPack: 12,
    packs: 2,
    quantityPieces: 24,
    catalogPricePerPack: 24000,
    pricePerPack: 24000,
    lineTotal: 48000,
  }],
  total: 48000,
  paidAmount: 48000,
  paymentTerms: 'Paid now' as const,
  payments: [{
    id: 'PAY-1',
    saleId: 'SERVER-SALE',
    amount: 48000,
    date: '2026-10-23',
    method: 'Cash' as const,
    createdAt: '2026-10-23T10:00:00.000Z',
  }],
  createdAt: '2026-10-23T10:00:00.000Z',
}

describe('sales API client', () => {
  it('returns only a server-confirmed receipt and sends the idempotency key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ sale: saleResponse, payments: saleResponse.payments }, 201))
    vi.stubGlobal('fetch', fetchMock)
    const input = {
      customerId: 'C-100',
      lines: [{ productId: saleResponse.lines[0].productId, packs: 2 }],
      paymentTerms: 'Paid now' as const,
      initialPaymentAmount: 48000,
      initialPaymentMethod: 'Cash' as const,
      idempotencyKey: 'SALE-RETRY-1',
    }

    const result = await createSale(input)
    expect(result.sale.receiptNumber).toBe('SAL-2026-000001')
    expect(result.sale.lines).toHaveLength(1)
    expect(result.payments[0].amount).toBe(48000)
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(String(init.body)).idempotencyKey).toBe('SALE-RETRY-1')

    const missingReceipt = vi.fn().mockResolvedValue(jsonResponse({
      sale: { ...saleResponse, receiptNumber: '', reference: '' },
      payments: saleResponse.payments,
    }, 201))
    vi.stubGlobal('fetch', missingReceipt)
    await expect(createSale(input)).rejects.toMatchObject({ status: 502 })
  })

  it('imports saved sales and payment history through the protected migration endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      imported: ['S-1'],
      duplicates: [],
      rejected: [],
    }, 201))
    vi.stubGlobal('fetch', fetchMock)
    const sale: Sale = {
      id: 'S-1',
      reference: 'SAL-1048',
      receiptNumber: 'SAL-1048',
      date: '2026-10-23',
      customer: 'Walk-in',
      product: 'Mango juice',
      quantity: 2,
      total: 48000,
      status: 'Paid',
      method: 'Cash',
    }
    const payment: SalePayment = {
      id: 'PAY-1',
      saleId: sale.id,
      amount: 48000,
      date: sale.date,
      method: 'Cash',
      recordedAt: `${sale.date}T10:00:00.000Z`,
    }

    await expect(importLegacySales([sale], [payment])).resolves.toEqual({
      imported: ['S-1'],
      duplicates: [],
      rejected: [],
    })
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/sales/legacy-import'),
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('loads and marks credit due notifications read', async () => {
    const notification = {
      id: 'NOTICE-1',
      type: 'credit_due' as const,
      title: 'Credit sale due in 7 days',
      message: 'SAL-2026-000001 has an outstanding balance.',
      saleId: saleResponse.id,
      receiptNumber: saleResponse.receiptNumber,
      dueDate: '2026-10-30',
      balance: 12000,
      readAt: null,
      createdAt: '2026-10-23T10:00:00.000Z',
    }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ notifications: [notification], unreadCount: 1 }))
      .mockResolvedValueOnce(jsonResponse({ notification: { ...notification, readAt: '2026-10-23T11:00:00.000Z' } }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(listCreditNotifications()).resolves.toMatchObject({ unreadCount: 1, notifications: [notification] })
    await expect(markCreditNotificationRead(notification.id)).resolves.toMatchObject({
      notification: { id: notification.id, readAt: '2026-10-23T11:00:00.000Z' },
    })
    expect(fetchMock.mock.calls[1]?.[0]).toContain('/notifications/NOTICE-1/read')
  })

  it('updates credit review details and loads customer statement and owners', async () => {
    const creditSale = {
      ...saleResponse,
      paymentTerms: 'Credit' as const,
      paidAmount: 0,
      payments: [],
      assignedTo: 'OWNER-1',
      dueDate: '2026-11-01',
    }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ sale: creditSale }))
      .mockResolvedValueOnce(jsonResponse({
        customer: { id: 'C-100', name: 'Saved customer' },
        sales: [{ ...creditSale, balance: 48000 }],
        summary: { totalCredit: 48000, totalPaid: 0, outstanding: 48000, overdue: 0 },
      }))
      .mockResolvedValueOnce(jsonResponse({ users: [{ id: 'OWNER-1', name: 'Sales owner', email: 'owner@example.test', roles: ['Sales Manager'] }] }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(updateCreditSale(creditSale.id, {
      customerId: 'C-100',
      dueDate: '2026-11-01',
      assignedTo: 'OWNER-1',
    })).resolves.toMatchObject({ dueDate: '2026-11-01', assignedTo: 'OWNER-1' })
    await expect(getCreditCustomerStatement('C-100')).resolves.toMatchObject({
      summary: { outstanding: 48000 },
      sales: [{ balance: 48000 }],
    })
    await expect(listSalesOwners()).resolves.toEqual([{ id: 'OWNER-1', name: 'Sales owner', email: 'owner@example.test', roles: ['Sales Manager'] }])
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(expect.arrayContaining([
      expect.stringContaining('/sales/SERVER-SALE/credit'),
      expect.stringContaining('/sales/credit-customers/C-100/statement'),
      expect.stringContaining('/sales/owners'),
    ]))
  })

  it('reads and updates credit reminder threshold settings', async () => {
    const settings = {
      daysBeforeDue: [7, 1, 0],
      daysAfterDue: [1, 3, 7],
      repeatOverdueEveryDays: 7,
      escalateAfterDays: 7,
      timeZone: 'Africa/Kampala' as const,
    }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ settings }))
      .mockResolvedValueOnce(jsonResponse({ settings }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(getCreditReminderSettings()).resolves.toEqual({ settings })
    await expect(updateCreditReminderSettings(settings)).resolves.toEqual({ settings })
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'PUT' })
  })
})
