import type { Customer } from '@/lib/erp'

export const CUSTOMER_IMPORT_MARKER_KEY = 'lumina-erp-customer-import-v1'

type CustomerImporter = (customers: Customer[]) => Promise<{
  rejected: { id: string; index: number; reason: string }[]
}>

export async function importLegacyCustomersOnce(
  canManage: boolean,
  customers: Customer[],
  importer: CustomerImporter,
  storage: Storage = window.localStorage,
) {
  if (storage.getItem(CUSTOMER_IMPORT_MARKER_KEY)) return ''
  if (!customers.length) {
    if (canManage) storage.setItem(CUSTOMER_IMPORT_MARKER_KEY, 'complete')
    return ''
  }
  if (!canManage) {
    return 'Browser-saved customer records are retained but have not been imported. Ask a customer manager to sign in to complete the import.'
  }
  try {
    const result = await importer(customers)
    if (result.rejected.length) {
      const examples = result.rejected
        .slice(0, 3)
        .map(({ id, reason }) => `${id}: ${reason}`)
        .join('; ')
      const remainder = result.rejected.length > 3
        ? `; and ${result.rejected.length - 3} more`
        : ''
      return `${result.rejected.length} browser-saved customer record(s) could not be imported (${examples}${remainder}). Local data was retained; resolve the conflicts and retry.`
    }
    storage.setItem(CUSTOMER_IMPORT_MARKER_KEY, 'complete')
    return ''
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error.'
    return `Customer import did not complete: ${message} Local data was retained.`
  }
}
