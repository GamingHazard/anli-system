import { beforeEach, describe, expect, it, vi } from 'vitest'
import { importLegacyOrdersOnce, ORDER_IMPORT_MARKER_KEY, ORDER_IMPORT_SNAPSHOT_KEY } from '@/lib/order-migration'
import type { Order } from '@/lib/erp'

const orders: Order[] = [{
  id: 'ORD-MIGRATION-1',
  reference: 'ORD-MIGRATION-1',
  date: '2026-11-03',
  createdAt: '2026-11-03T09:00:00.000Z',
  customer: 'Migration Customer',
  items: [{ id: 'ORD-MIGRATION-1-1', product: 'Migration Product', quantity: 1, unitPrice: 1000, lineTotal: 1000 }],
  total: 1000,
  requestedDate: '2026-11-04',
  fulfilmentMethod: 'Delivery',
  destination: 'Migration Address',
  paymentTerms: 'Same-day',
  status: 'Pending',
  statusHistory: [],
  priority: 'Normal',
  notes: '',
}]

describe('safe order migration', () => {
  beforeEach(() => localStorage.clear())

  it('marks the local history imported only after server confirmation', async () => {
    const importer = vi.fn().mockResolvedValue({ imported: orders.map((order) => order.id), duplicates: [], rejected: [] })

    await expect(importLegacyOrdersOnce(true, orders, importer)).resolves.toBe('')
    expect(importer).toHaveBeenCalledWith(orders)
    expect(localStorage.getItem(ORDER_IMPORT_MARKER_KEY)).toBe('complete')
    expect(localStorage.getItem(ORDER_IMPORT_SNAPSHOT_KEY)).toBeNull()
  })

  it('retains the saved snapshot when some orders are rejected', async () => {
    const importer = vi.fn().mockResolvedValue({
      imported: [],
      duplicates: [],
      rejected: [{ id: orders[0].id, reason: 'reference conflict' }],
    })

    await expect(importLegacyOrdersOnce(true, orders, importer)).resolves.toMatch(/could not be imported/)
    expect(localStorage.getItem(ORDER_IMPORT_MARKER_KEY)).toBeNull()
    expect(localStorage.getItem(ORDER_IMPORT_SNAPSHOT_KEY)).not.toBeNull()
  })
})
