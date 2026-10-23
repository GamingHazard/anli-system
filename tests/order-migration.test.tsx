import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cloneSeed } from '@/lib/erp'
import { importLegacyOrdersOnce, ORDER_IMPORT_MARKER_KEY, ORDER_IMPORT_SNAPSHOT_KEY } from '@/lib/order-migration'

describe('safe order migration', () => {
  beforeEach(() => localStorage.clear())

  it('marks the local history imported only after server confirmation', async () => {
    const orders = cloneSeed().orders
    const importer = vi.fn().mockResolvedValue({ imported: orders.map((order) => order.id), duplicates: [], rejected: [] })

    await expect(importLegacyOrdersOnce(true, orders, importer)).resolves.toBe('')
    expect(importer).toHaveBeenCalledWith(orders)
    expect(localStorage.getItem(ORDER_IMPORT_MARKER_KEY)).toBe('complete')
    expect(localStorage.getItem(ORDER_IMPORT_SNAPSHOT_KEY)).toBeNull()
  })

  it('retains the saved snapshot when some orders are rejected', async () => {
    const orders = cloneSeed().orders
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
