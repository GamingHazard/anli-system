import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cloneSeed } from '@/lib/erp'
import { CUSTOMER_IMPORT_MARKER_KEY, importLegacyCustomersOnce } from '@/lib/customer-migration'

describe('safe customer migration', () => {
  beforeEach(() => localStorage.clear())

  it('marks migration complete only after the server confirms all records', async () => {
    const customers = cloneSeed().customers
    const importer = vi.fn().mockResolvedValue({ rejected: [] })

    await expect(importLegacyCustomersOnce(true, customers, importer)).resolves.toBe('')
    expect(importer).toHaveBeenCalledWith(customers)
    expect(localStorage.getItem(CUSTOMER_IMPORT_MARKER_KEY)).toBe('complete')
  })

  it('retains local data and leaves migration retryable after a partial rejection', async () => {
    const customers = cloneSeed().customers
    const importer = vi.fn().mockResolvedValue({
      rejected: [{ id: customers[0].id, index: 0, reason: 'duplicate name' }],
    })

    await expect(importLegacyCustomersOnce(true, customers, importer)).resolves.toMatch(/could not be imported/)
    expect(localStorage.getItem(CUSTOMER_IMPORT_MARKER_KEY)).toBeNull()
  })

  it('does not attempt import or set a marker for read-only users', async () => {
    const customers = cloneSeed().customers
    const importer = vi.fn()

    await expect(importLegacyCustomersOnce(false, customers, importer)).resolves.toMatch(/Ask a customer manager/)
    expect(importer).not.toHaveBeenCalled()
    expect(localStorage.getItem(CUSTOMER_IMPORT_MARKER_KEY)).toBeNull()
  })

  it('reports API failures and retries safely without clearing the browser snapshot', async () => {
    const customers = cloneSeed().customers
    const importer = vi.fn().mockRejectedValue(new Error('Server unavailable'))

    await expect(importLegacyCustomersOnce(true, customers, importer)).resolves.toMatch(/Server unavailable/)
    expect(localStorage.getItem(CUSTOMER_IMPORT_MARKER_KEY)).toBeNull()
  })
})
