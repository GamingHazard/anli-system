import type { Order } from './erp'

export const ORDER_IMPORT_MARKER_KEY = 'lumina-orders-server-import-v1'
export const ORDER_IMPORT_SNAPSHOT_KEY = 'lumina-orders-import-snapshot-v1'

type ImportResult = {
  imported: string[]
  duplicates: string[]
  rejected: Array<{ id: string; reason: string }>
}

type Importer = (orders: Order[]) => Promise<ImportResult>

export async function importLegacyOrdersOnce(
  canImport: boolean,
  currentOrders: Order[],
  importer: Importer,
): Promise<string> {
  if (typeof window === 'undefined' || window.localStorage.getItem(ORDER_IMPORT_MARKER_KEY)) return ''
  const savedSnapshot = window.localStorage.getItem(ORDER_IMPORT_SNAPSHOT_KEY)
  let orders: Order[]
  if (savedSnapshot) {
    try {
      const parsed: unknown = JSON.parse(savedSnapshot)
      if (!Array.isArray(parsed)) throw new Error('Saved order import snapshot is invalid.')
      orders = parsed as Order[]
    } catch {
      throw new Error('Could not read the saved order import snapshot. It was retained for recovery.')
    }
  } else {
    if (!currentOrders.length) {
      window.localStorage.setItem(ORDER_IMPORT_MARKER_KEY, 'complete')
      return ''
    }
    if (!canImport) return 'Ask an authorized Sales Manager to import existing local orders.'
    window.localStorage.setItem(ORDER_IMPORT_SNAPSHOT_KEY, JSON.stringify(currentOrders))
    orders = currentOrders
  }
  if (!canImport) return 'Ask an authorized Sales Manager to retry importing existing local orders.'
  const result = await importer(orders)
  if (result.rejected.length) {
    const examples = result.rejected.slice(0, 3).map((item) => `${item.id}: ${item.reason}`).join('; ')
    return `${result.rejected.length} order(s) could not be imported and remain saved for retry. ${examples}`
  }
  window.localStorage.setItem(ORDER_IMPORT_MARKER_KEY, 'complete')
  window.localStorage.removeItem(ORDER_IMPORT_SNAPSHOT_KEY)
  return ''
}
