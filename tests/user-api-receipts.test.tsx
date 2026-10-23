import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  listAllManagedReceipts,
  listManagedReceipts,
  recordReceiptBulkExport,
  setManagedReceiptArchived,
  setManagedReceiptFavorite,
} from '@/lib/user-api'

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response
}

afterEach(() => vi.unstubAllGlobals())

const receipt = {
  id: 'RECEIPT-1',
  kind: 'credit-payment' as const,
  receiptNumber: 'CPR-2026-000001',
  date: '2026-10-23',
  amount: 12000,
  customer: { name: 'Saved customer' },
  company: { name: 'Example Ltd' },
  lines: [],
  saleReceiptNumber: 'SAL-2026-000001',
  saleId: 'SALE-1',
  payment: { amount: 12000, method: 'Cash' },
  isFavorite: false,
  isArchived: false,
}

describe('receipt management API client', () => {
  it('requests server-filtered receipt pages and traverses all cursors', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        receipts: [receipt],
        nextCursor: 'CURSOR-1',
        stats: { count: 2, totalAmount: 24000, totalPaid: 24000, outstanding: 0 },
      }))
      .mockResolvedValueOnce(jsonResponse({
        receipts: [receipt],
        nextCursor: 'CURSOR-1',
        stats: { count: 2, totalAmount: 24000, totalPaid: 24000, outstanding: 0 },
      }))
      .mockResolvedValueOnce(jsonResponse({
        receipts: [{ ...receipt, id: 'RECEIPT-2' }],
        nextCursor: null,
        stats: { count: 2, totalAmount: 24000, totalPaid: 24000, outstanding: 0 },
      }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(listManagedReceipts('credit-payments', {
      from: '2026-10-01',
      to: '2026-10-31',
      search: 'customer',
      favorite: true,
    })).resolves.toMatchObject({ receipts: [receipt], nextCursor: 'CURSOR-1' })
    const result = await listAllManagedReceipts('credit-payments', { archived: true })
    expect(result.receipts.map((item) => item.id)).toEqual(['RECEIPT-1', 'RECEIPT-2'])
    expect(fetchMock.mock.calls[0]?.[0]).toContain('favorite=true')
    expect(fetchMock.mock.calls[1]?.[0]).toContain('archived=true')
    expect(fetchMock.mock.calls[2]?.[0]).toContain('cursor=CURSOR-1')
  })

  it('saves favorites, archives/restores, and audits bulk export metadata', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ enabled: true }))
      .mockResolvedValueOnce(jsonResponse({ enabled: false, archivedAt: null }))
      .mockResolvedValueOnce(jsonResponse({}, 204))
    vi.stubGlobal('fetch', fetchMock)

    await expect(setManagedReceiptFavorite('sales', 'SALE-1', true)).resolves.toEqual({ enabled: true })
    await expect(setManagedReceiptArchived('sales', 'SALE-1', false)).resolves.toEqual({ enabled: false, archivedAt: null })
    await expect(recordReceiptBulkExport('sales', 'download', 2, { from: '2026-10-01' })).resolves.toBeUndefined()
    expect(fetchMock.mock.calls.map(([url, init]) => [url, (init as RequestInit).method])).toEqual([
      [expect.stringContaining('/receipts/sales/SALE-1/favorite'), 'PATCH'],
      [expect.stringContaining('/receipts/sales/SALE-1/archive'), 'PATCH'],
      [expect.stringContaining('/receipts/bulk-export'), 'POST'],
    ])
  })
})
