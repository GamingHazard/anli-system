import { beforeEach, describe, expect, it, vi } from 'vitest'
import { importLegacySalesOnce, SALES_IMPORT_MARKER_KEY, SALES_IMPORT_SNAPSHOT_KEY } from '@/lib/sales-migration'
import type { Sale, SalePayment } from '@/lib/erp'

const migrationSale: Sale = {
  id: 'S-MIGRATION-1',
  date: '2026-11-03',
  customer: 'Migration Customer',
  product: 'Migration Product',
  quantity: 1,
  total: 1000,
  status: 'Pending',
  method: 'Cash',
  reference: 'REC-MIGRATION-1',
}
const migrationPayment: SalePayment = {
  id: 'P-MIGRATION-1',
  saleId: migrationSale.id,
  amount: 1000,
  date: '2026-11-03',
  method: 'Cash',
  recordedAt: '2026-11-03T09:00:00.000Z',
}
const migrationState = { sales: [migrationSale], payments: [migrationPayment] }

describe('safe sales migration', () => {
  beforeEach(() => localStorage.clear())

  it('marks local sales imported only after the server reports no rejections', async () => {
    const importer = vi.fn().mockResolvedValue({ imported: [migrationSale.id], duplicates: [], rejected: [] })

    await expect(importLegacySalesOnce(true, migrationState, importer)).resolves.toBe('')
    expect(importer).toHaveBeenCalledWith(migrationState.sales, migrationState.payments)
    expect(localStorage.getItem(SALES_IMPORT_MARKER_KEY)).toBe('complete')
  })

  it('retains a retry path and warns when the server rejects records', async () => {
    const importer = vi.fn().mockResolvedValue({
      imported: [],
      duplicates: [],
      rejected: [{ id: migrationSale.id, reason: 'receipt reference conflict' }],
    })

    await expect(importLegacySalesOnce(true, migrationState, importer)).resolves.toMatch(/could not be imported/)
    expect(localStorage.getItem(SALES_IMPORT_MARKER_KEY)).toBeNull()
    expect(localStorage.getItem(SALES_IMPORT_SNAPSHOT_KEY)).not.toBeNull()

    const retry = vi.fn().mockResolvedValue({ imported: [], duplicates: migrationState.sales.map((sale) => sale.id), rejected: [] })
    await expect(importLegacySalesOnce(true, { sales: [], payments: [] }, retry)).resolves.toBe('')
    expect(retry).toHaveBeenCalledWith(migrationState.sales, migrationState.payments)
    expect(localStorage.getItem(SALES_IMPORT_MARKER_KEY)).toBe('complete')
    expect(localStorage.getItem(SALES_IMPORT_SNAPSHOT_KEY)).toBeNull()
  })

  it('does not set the marker for users who cannot manage sales', async () => {
    const importer = vi.fn()

    await expect(importLegacySalesOnce(false, migrationState, importer)).resolves.toMatch(/Ask a sales manager/)
    expect(importer).not.toHaveBeenCalled()
    expect(localStorage.getItem(SALES_IMPORT_MARKER_KEY)).toBeNull()
  })
})
