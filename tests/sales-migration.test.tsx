import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cloneSeed } from '@/lib/erp'
import { importLegacySalesOnce, SALES_IMPORT_MARKER_KEY, SALES_IMPORT_SNAPSHOT_KEY } from '@/lib/sales-migration'

describe('safe sales migration', () => {
  beforeEach(() => localStorage.clear())

  it('marks local sales imported only after the server reports no rejections', async () => {
    const state = cloneSeed()
    const importer = vi.fn().mockResolvedValue({ imported: ['S-1048'], duplicates: [], rejected: [] })

    await expect(importLegacySalesOnce(true, state, importer)).resolves.toBe('')
    expect(importer).toHaveBeenCalledWith(state.sales, state.payments)
    expect(localStorage.getItem(SALES_IMPORT_MARKER_KEY)).toBe('complete')
  })

  it('retains a retry path and warns when the server rejects records', async () => {
    const state = cloneSeed()
    const importer = vi.fn().mockResolvedValue({
      imported: [],
      duplicates: [],
      rejected: [{ id: state.sales[0].id, reason: 'receipt reference conflict' }],
    })

    await expect(importLegacySalesOnce(true, state, importer)).resolves.toMatch(/could not be imported/)
    expect(localStorage.getItem(SALES_IMPORT_MARKER_KEY)).toBeNull()
    expect(localStorage.getItem(SALES_IMPORT_SNAPSHOT_KEY)).not.toBeNull()

    const retry = vi.fn().mockResolvedValue({ imported: [], duplicates: state.sales.map((sale) => sale.id), rejected: [] })
    await expect(importLegacySalesOnce(true, { sales: [], payments: [] }, retry)).resolves.toBe('')
    expect(retry).toHaveBeenCalledWith(state.sales, state.payments)
    expect(localStorage.getItem(SALES_IMPORT_MARKER_KEY)).toBe('complete')
    expect(localStorage.getItem(SALES_IMPORT_SNAPSHOT_KEY)).toBeNull()
  })

  it('does not set the marker for users who cannot manage sales', async () => {
    const importer = vi.fn()

    await expect(importLegacySalesOnce(false, cloneSeed(), importer)).resolves.toMatch(/Ask a sales manager/)
    expect(importer).not.toHaveBeenCalled()
    expect(localStorage.getItem(SALES_IMPORT_MARKER_KEY)).toBeNull()
  })
})
