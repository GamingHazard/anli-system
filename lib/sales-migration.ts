import type { Sale, SalePayment } from '@/lib/erp'

export const SALES_IMPORT_MARKER_KEY = 'lumina-erp-sales-import-v1'
export const SALES_IMPORT_SNAPSHOT_KEY = 'lumina-erp-sales-import-snapshot-v1'

type LegacySalesImporter = (sales: Sale[], payments: SalePayment[]) => Promise<{
  rejected: { id: string; reason: string }[]
}>

export async function importLegacySalesOnce(
  canManage: boolean,
  snapshot: { sales: Sale[]; payments: SalePayment[] },
  importer: LegacySalesImporter,
  storage: Storage = window.localStorage,
) {
  if (storage.getItem(SALES_IMPORT_MARKER_KEY)) return ''
  let retainedSnapshot = snapshot
  const savedSnapshot = storage.getItem(SALES_IMPORT_SNAPSHOT_KEY)
  if (savedSnapshot) {
    try {
      const parsed: unknown = JSON.parse(savedSnapshot)
      if (!parsed || typeof parsed !== 'object' ||
        !Array.isArray((parsed as { sales?: unknown }).sales) ||
        !Array.isArray((parsed as { payments?: unknown }).payments)) {
        return 'Saved browser sales could not be read for import. The original data was retained; contact an administrator before clearing browser storage.'
      }
      retainedSnapshot = parsed as typeof snapshot
    } catch {
      return 'Saved browser sales could not be read for import. The original data was retained; contact an administrator before clearing browser storage.'
    }
  } else if (snapshot.sales.length) {
    storage.setItem(SALES_IMPORT_SNAPSHOT_KEY, JSON.stringify(snapshot))
  }
  if (!retainedSnapshot.sales.length) {
    if (canManage) storage.setItem(SALES_IMPORT_MARKER_KEY, 'complete')
    return ''
  }
  if (!canManage) {
    return 'Browser-saved sales are retained but have not been imported. Ask a sales manager to sign in to complete the import.'
  }
  try {
    const result = await importer(retainedSnapshot.sales, retainedSnapshot.payments)
    if (result.rejected.length) {
      const examples = result.rejected
        .slice(0, 3)
        .map(({ id, reason }) => `${id}: ${reason}`)
        .join('; ')
      const remainder = result.rejected.length > 3
        ? `; and ${result.rejected.length - 3} more`
        : ''
      return `${result.rejected.length} browser-saved sale or payment record(s) could not be imported (${examples}${remainder}). Local data was retained; resolve the conflicts and retry.`
    }
    storage.setItem(SALES_IMPORT_MARKER_KEY, 'complete')
    storage.removeItem(SALES_IMPORT_SNAPSHOT_KEY)
    return ''
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error.'
    return `Sales import did not complete: ${message} Local data was retained.`
  }
}
