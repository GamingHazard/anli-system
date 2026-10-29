import { createId, employeeDisplayName, type AdvanceRepaymentMethod, type AdvanceRepaymentFrequency, type AssetEvent, type AssetCategory, type AssetCondition, type AssetStatus, type AttendanceRecord, type AttendanceStatus, type CompanyAsset, type CompanyProfile, type Customer, type Employee, type EmployeeDraft, type EmployeeDocument, type LeaveRequest, type LeaveType, type ManagedReceipt, type Order, type OrderStatus, type ReceiptStats, type Sale, type SaleLine, type SalePayment, type SalePartySnapshot, type SaleCompanySnapshot, type SalaryAdvance } from './erp'
import type { PayrollPolicy, PayrollRun, PayrollRunType } from './payroll'
import type { CreateExpenseInput, ExpenseEvent, ExpenseFilters, ExpenseRecord, ManualExpense } from './expenses'
import type { ApprovalInboxResponse } from './approval-inbox'

export const USER_ROLES = [
  'Super Admin',
  'Admin',
  'General Manager',
  'Human Resource',
  'Marketing Manager',
  'Sales Manager',
  'Production Manager',
  'Inventory Manager',
  'Accountant',
] as const

export type UserRole = (typeof USER_ROLES)[number]
export type AccountStatus = 'Active' | 'Suspended' | 'Deactivated'

export type UserAccount = {
  id: string
  name: string
  email: string
  roles: UserRole[]
  status: AccountStatus
  createdAt: string
  updatedAt?: string
  lastActive?: string
  suspensionReason?: string
  mustChangePassword: boolean
}

export type ActiveSession = {
  id: string
  userAgent: string
  createdAt: string
  lastActivityAt: string
  idleTimeoutMs: number
  warningPeriodMs: number
  idleExpiresAt: string
  absoluteExpiresAt: string
  current: boolean
}

export type SessionProtectionSettings = {
  privilegedIdle: number
  generalIdle: number
  warningPeriod: number
}

export type DashboardAvailability =
  | { status: 'unavailable'; message: string }
  | ({ status: 'available' } & Record<string, unknown>)

export type DashboardSummary = {
  version: 1
  range: { from: string; to: string; timeZone: string }
  generatedAt: string
  sections: {
    sales?: DashboardAvailability & {
      revenue?: number
      collected?: number
      outstanding?: number
      overdueReceivables?: number
      trend?: Array<{ date: string; revenue: number; collected: number }>
      products?: Array<{ name: string; revenue: number }>
    }
    orders?: DashboardAvailability & {
      open?: number
      late?: number
      highPriority?: number
      byStatus?: Array<{ status: string; count: number }>
    }
    production?: DashboardAvailability & {
      produced?: number
      damaged?: number
      trend?: Array<{ date: string; produced: number; damaged: number }>
    }
    inventory?: DashboardAvailability & { activeLowStock?: number }
    expenses?: DashboardAvailability & {
      total?: number
      pendingApproval?: number
      trend?: Array<{ date: string; amount: number }>
    }
    people?: DashboardAvailability & {
      attendanceByStatus?: Array<{ status: string; count: number }>
      recordedAttendance?: number
      pendingLeave?: number
    }
    assets?: DashboardAvailability & { dueMaintenance?: number }
  }
}

export type CompanyLogo = { url: string; publicId: string }
export type PublicCompanyBrand = { companyName: string; logoUrl: string }

export type AuditEventType = string
export type AuditEvent = {
  id: string
  eventType: AuditEventType
  outcome: 'success' | 'failure' | 'denied'
  reason?: string
  actor: { id: string; name?: string; roles: UserRole[] } | null
  target: { id: string; name?: string; email?: string } | null
  resource?: { type: string; id?: string; reference?: string } | null
  sessionId: string | null
  ipAddress?: string
  userAgent?: string
  details: Record<string, unknown>
  createdAt: string
}

export type AuditFilters = {
  eventType?: AuditEventType
  category?: string
  categories?: string[]
  outcome?: AuditEvent['outcome']
  actorId?: string
  targetUserId?: string
  resourceType?: string
  from?: string
  to?: string
  limit?: number
  cursor?: string
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export type CustomerInput = Pick<Customer, 'name' | 'type' | 'phone'> &
  Partial<Pick<Customer, 'contact' | 'email' | 'region' | 'district' | 'tin' | 'country' | 'referredBy' | 'notes' | 'status'>>
export type CustomerUpdate = Omit<Partial<Customer>, 'archivedAt'> & { archivedAt?: string | null }

export type OrderApiRecord = {
  id: string
  orderNumber: string
  customerId: string
  customer: { name: string; contact?: string; phone?: string; email?: string; address?: string; tin?: string }
  items: Array<{
    productId?: string | null
    productCode?: string
    productName: string
    packType?: 'Box' | 'Carton' | null
    piecesPerPack?: number | null
    packs: number
    quantityPieces?: number | null
    catalogPricePerPack?: number | null
    pricePerPack: number
    overrideReason?: string
    lineTotal: number
  }>
  total: number
  paidAmount: number
  date: string
  requestedDate: string
  fulfilmentMethod: 'Delivery' | 'Pickup'
  destination: string
  paymentTerms: 'Paid now' | 'Same-day' | 'Credit'
  dueDate?: string
  status: OrderStatus
  statusHistory: Array<{ type: string; fromStatus?: string; toStatus?: string; at: string; actor?: string; reason?: string }>
  completedAt?: string | null
  archivedAt?: string | null
  priority: 'Normal' | 'High'
  priorityReason?: string
  notes: string
  reserved: boolean
  saleId?: string | null
  legacyImported?: boolean
  createdAt: string
}

export type OrderPaymentRecord = {
  id: string
  orderId: string
  amount: number
  date: string
  method: SalePayment['method']
  txnID?: string
  note?: string
  salePaymentId?: string | null
}

export type OrderInput = {
  customerId: string
  items: Array<{ productId: string; packs: number; pricePerPack?: number; overrideReason?: string }>
  requestedDate: string
  fulfilmentMethod: 'Delivery' | 'Pickup'
  destination?: string
  paymentTerms: 'Paid now' | 'Same-day' | 'Credit'
  dueDate?: string
  priority: 'Normal' | 'High'
  priorityReason?: string
  notes?: string
  idempotencyKey?: string
}

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '')

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      credentials: 'include',
      cache: 'no-store',
      headers: {
        ...(init.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    })
  } catch {
    throw new ApiError('Could not reach the server. Check that the API is running and try again.', 0)
  }

  if (response.status === 204) return undefined as T
  const body = await response.json().catch(() => ({})) as { error?: string; code?: string }
  if (!response.ok) {
    throw new ApiError(body.error || 'The request could not be completed.', response.status, body.code)
  }
  return body as T
}

export type AssetPhoto = { id: string; url: string; filename?: string; uploadedAt?: string }
export type AssetRecord = CompanyAsset & { photos?: AssetPhoto[] }
export type AssetListFilters = {
  limit?: number
  cursor?: string
  category?: AssetCategory
  condition?: AssetCondition
  status?: AssetStatus
  location?: string
  assignee?: string
  search?: string
}
export type AssetEventAction = {
  action: 'inspection' | 'transfer' | 'maintenance' | 'maintenance-completed' | 'status-change' | 'dispose'
  date: string
  condition?: AssetCondition
  reason?: string
  nextInspectionDate?: string
  location?: string
  assignee?: string
  department?: string
  work?: string
  provider?: string
  cost?: number
  nextServiceDate?: string
  status?: AssetStatus
  note?: string
}
export type AssetImportResult = {
  imported: number
  importedEvents: number
  duplicates: number
  rejected: number | Array<{ assetTag?: string; reason: string }>
}

export async function listAssets(filters: AssetListFilters = {}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries({ limit: 200, ...filters })) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  const result = await request<{ assets: AssetRecord[]; nextCursor: string | null }>(`/assets?${params}`)
  return result
}

export async function getAsset(id: string) {
  return request<{ asset: AssetRecord; events: AssetEvent[] }>(`/assets/${encodeURIComponent(id)}`)
}

export async function createAsset(asset: Omit<CompanyAsset, 'id' | 'createdAt' | 'updatedAt'>) {
  return request<{ asset: AssetRecord }>('/assets', {
    method: 'POST',
    body: JSON.stringify(asset),
  })
}

export async function updateAsset(id: string, changes: Partial<CompanyAsset>) {
  return request<{ asset: AssetRecord; event: AssetEvent }>(`/assets/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(changes),
  })
}

export async function recordAssetEvent(id: string, input: AssetEventAction) {
  return request<{ asset: AssetRecord; event: AssetEvent }>(`/assets/${encodeURIComponent(id)}/events`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function importLegacyAssets(assets: CompanyAsset[], events: AssetEvent[]) {
  return request<AssetImportResult>('/assets/import', {
    method: 'POST',
    body: JSON.stringify({ assets, events }),
  })
}

export async function uploadAssetPhoto(id: string, photo: File) {
  const body = new FormData()
  body.set('photo', photo)
  return request<{ asset: AssetRecord }>(`/assets/${encodeURIComponent(id)}/photos`, {
    method: 'POST',
    body,
  })
}

export async function deleteAssetPhoto(id: string, photoId: string) {
  return request<void>(`/assets/${encodeURIComponent(id)}/photos/${encodeURIComponent(photoId)}`, {
    method: 'DELETE',
  })
}

export function getPublicCompanyBrand() {
  return request<PublicCompanyBrand>('/profile-settings/public-brand')
}

export function getCompanyProfile() {
  return request<{ profile: CompanyProfile }>('/profile-settings')
}

export function updateCompanyProfile(profile: Omit<CompanyProfile, 'logo'>) {
  return request<{ profile: CompanyProfile }>('/profile-settings', {
    method: 'PUT',
    body: JSON.stringify(profile),
  })
}

export function uploadCompanyLogo(file: File) {
  const body = new FormData()
  body.set('logo', file)
  return request<{ logo: CompanyLogo }>('/profile-settings/logo', {
    method: 'POST',
    body,
  })
}

export function removeCompanyLogo() {
  return request<{ logo: CompanyLogo }>('/profile-settings/logo', { method: 'DELETE' })
}

export type ProductionIngredient = {
  materialId: string
  materialName: string
  unit: string
  quantityPerTank: number
}

export type ProductionRecipe = {
  id: string
  productId: string
  version: number
  ingredients: ProductionIngredient[]
}

export type ProductionProduct = {
  id: string
  code: string
  name: string
  category: 'Cup' | 'Bottle'
  unit: string
  flavour: 'Mango' | 'Pineapple milk'
  packType: 'Box' | 'Carton'
  piecesPerPack: number
  packWeightKg: number
  price?: number
  recipeRequired: boolean
  active: boolean
  balancePacks: number
  reservedPacks?: number
  availablePacks?: number
  loosePieces?: number
  inventoryEffectiveDate?: string
  recipe: ProductionRecipe | null
  activeRecipeId?: string | null
  createdAt: string
}

export type ProductionMaterial = {
  id: string
  code: string
  name: string
  category: string
  unit: string
  packagingLevels?: MaterialPackagingLevel[]
  active: boolean
  balance: number
  locations: RawMaterialLocationBalance[]
}

export type MaterialPackagingLevel = {
  name: string
  quantity: number
}

export type ReceiptPackagingSnapshot = {
  packageQuantity: number
  packageUnit: string
  baseUnitsPerPackage: number
  packagePrice: number
}

export type RawMaterialLocationBalance = {
  id?: string
  location: string
  quantity: number
  reorderThreshold: number
  responsibleUserId: string | null
  responsibleUserName?: string | null
  responsibleUserActive?: boolean
}

export type RawMaterialMovementType = 'Opening balance' | 'Receipt' | 'Stock in' | 'Stock out' | 'Production use' | 'Production use correction' | 'Transfer' | 'Adjustment increase' | 'Adjustment decrease'

export type RawMovementRecord = {
  id: string
  materialId: string
  type: RawMaterialMovementType
  direction: 'in' | 'out' | 'transfer'
  quantity: number
  unit: string
  date: string
  reference: string
  receiptReference?: string
  reason?: string
  materialName: string
  fromLocation?: string
  toLocation?: string
  supplier?: string
  sourceReference?: string
  unitCost?: number
  receiptPackaging?: ReceiptPackagingSnapshot
  actor: string
  createdAt: string
}

export type RawMaterialAlert = {
  id: string
  materialId: { id: string; code: string; name: string; unit: string; category: string } | string
  location: string
  recipientUserId?: { id: string; name: string; email: string } | string | null
  reorderThreshold: number
  currentQuantity: number
  status: 'active' | 'resolved'
  lastTriggeredAt?: string
  updatedAt: string
}

export type InventoryResponsibleUser = {
  id: string
  name: string
  email: string
  roles: string[]
}

export type ProductionMaterialUsageRecord = {
  id: string
  reference: string
  productionRunId?: string
  productId: string
  productName: string
  productionDate: string
  tanksProduced: number
  tankVolumeLitres: 1000
  location: string
  recipeId: string
  recipeVersion: number
  lines: Array<ProductionIngredient & { totalQuantity: number }>
  actor: string
  updatedBy?: string
  createdAt: string
}

export type ProductionRunRecord = {
  id: string
  reference: string
  productId: string
  productName: string
  productUnit: string
  recipeId?: string | null
  recipeVersion?: number | null
  productionDate: string
  inventoryUnit?: 'piece_legacy' | 'pack'
  packTypeSnapshot?: 'Box' | 'Carton'
  piecesPerPackSnapshot?: number
  openingStockPacks?: number
  salesQuantityPacks?: number
  damagedQuantityPacks?: number
  closingStockPacks?: number
  producedQuantityPacks?: number
  openingStockPieces?: number
  salesQuantityPieces?: number
  damagedQuantityPieces?: number
  closingStockPieces?: number
  producedQuantityPieces?: number
  damageReason?: string
  lines: Array<ProductionIngredient & { totalQuantity: number }>
  createdAt: string
}

export type FinishedMovementRecord = {
  id: string
  productId: string
  type: string
  direction: 'in' | 'out'
  inventoryUnit?: 'piece_legacy' | 'pack'
  quantityPacks?: number
  packTypeSnapshot?: 'Box' | 'Carton'
  piecesPerPackSnapshot?: number
  quantityPieces?: number
  date: string
  reference: string
  reason: string
  productName: string
  createdAt: string
}

export type DailyProductionStockSummary = {
  productId: string
  productionDate: string
  packType: 'Box' | 'Carton'
  piecesPerPack: number
  openingStockPacks: number
  salesQuantityPacks: number
  otherMovementNetPacks: number
  loosePieces: number
}

type ProductInput = {
  code: string
  name: string
  category: 'Cup' | 'Bottle'
  unit: string
  flavour: 'Mango' | 'Pineapple milk'
  packType?: 'Box' | 'Carton'
  piecesPerPack?: number
  packWeightKg?: number
  price: number
  recipeRequired: boolean
  ingredients?: Array<{
    materialId: string
    quantityPerTank: number
  }>
}

export async function listProductionProducts() {
  return request<{ products: ProductionProduct[] }>('/production/products')
}

export async function createProductionProduct(input: ProductInput) {
  return request<{ product: ProductionProduct }>('/production/products', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateProductionProduct(id: string, input: Omit<Partial<ProductInput>, 'packType' | 'piecesPerPack' | 'packWeightKg'> & {
  packType?: 'Box' | 'Carton'
  piecesPerPack?: number
  packWeightKg?: number
  active?: boolean
}) {
  return request<{ product: ProductionProduct }>(`/production/products/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export async function updateProductionRecipe(id: string, ingredients: NonNullable<ProductInput['ingredients']>) {
  return request<{ recipe: ProductionRecipe }>(`/production/products/${encodeURIComponent(id)}/recipe`, {
    method: 'PUT',
    body: JSON.stringify({ ingredients }),
  })
}

type ApiPayment = Omit<SalePayment, 'recordedAt'> & { createdAt?: string; updatedAt?: string }

export type ReceiptKind = 'sales' | 'credit-payments'
export type ReceiptFilters = {
  from?: string
  to?: string
  search?: string
  favorite?: boolean
  archived?: boolean
}

export async function listManagedReceipts(kind: ReceiptKind, filters: ReceiptFilters = {}, cursor?: string) {
  const params = new URLSearchParams({ limit: '100' })
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  if (filters.search?.trim()) params.set('search', filters.search.trim())
  if (filters.favorite) params.set('favorite', 'true')
  if (filters.archived) params.set('archived', 'true')
  if (cursor) params.set('cursor', cursor)
  return request<{ receipts: ManagedReceipt[]; nextCursor: string | null; stats: ReceiptStats }>(
    `/receipts/${kind}?${params}`,
  )
}

export async function listAllManagedReceipts(kind: ReceiptKind, filters: ReceiptFilters = {}) {
  const receipts: ManagedReceipt[] = []
  const visited = new Set<string>()
  let cursor: string | undefined
  let stats: ReceiptStats = { count: 0, totalAmount: 0, totalPaid: 0, outstanding: 0 }
  do {
    const result = await listManagedReceipts(kind, filters, cursor)
    receipts.push(...result.receipts)
    stats = result.stats
    cursor = result.nextCursor || undefined
    if (cursor && visited.has(cursor)) throw new ApiError('The receipt list returned a repeated pagination cursor.', 502)
    if (cursor) visited.add(cursor)
  } while (cursor)
  return { receipts, stats }
}

export async function setManagedReceiptFavorite(kind: ReceiptKind, id: string, enabled: boolean) {
  return request<{ enabled: boolean }>(`/receipts/${kind}/${encodeURIComponent(id)}/favorite`, {
    method: 'PATCH',
    body: JSON.stringify({ enabled }),
  })
}

export async function setManagedReceiptArchived(kind: ReceiptKind, id: string, enabled: boolean) {
  return request<{ enabled: boolean; archivedAt: string | null }>(`/receipts/${kind}/${encodeURIComponent(id)}/archive`, {
    method: 'PATCH',
    body: JSON.stringify({ enabled }),
  })
}

export async function recordReceiptBulkExport(
  kind: ReceiptKind,
  action: 'print' | 'download',
  count: number,
  filters: ReceiptFilters,
) {
  await request<void>('/receipts/bulk-export', {
    method: 'POST',
    body: JSON.stringify({ kind, action, count, filters }),
  })
}

type ApiSale = {
  id: string
  receiptNumber: string
  reference?: string
  receiptYear: number
  receiptSequence: number
  customerId: string | null
  assignedTo?: string | null
  createdByName?: string
  customer: SalePartySnapshot
  company: SaleCompanySnapshot
  date: string
  lines: SaleLine[]
  legacyImported?: boolean
  legacyProduct?: string
  legacyQuantity?: number
  legacyMethod?: string
  legacyTxnID?: string
  total: number
  paidAmount: number
  paymentTerms: Sale['paymentTerms']
  dueDate?: string
  payments?: ApiPayment[]
  createdAt: string
}

function normalizeSalePayment(payment: ApiPayment): SalePayment {
  return {
    id: payment.id,
    saleId: payment.saleId,
    paymentReceiptNumber: payment.paymentReceiptNumber,
    amount: payment.amount,
    date: payment.date,
    method: payment.method,
    txnID: payment.txnID || undefined,
    note: payment.note || undefined,
    recordedAt: payment.createdAt || payment.updatedAt || `${payment.date}T00:00:00.000Z`,
  }
}

function normalizeSale(sale: ApiSale): { sale: Sale; payments: SalePayment[] } {
  const payments = (sale.payments ?? []).map(normalizeSalePayment)
  const lastPayment = payments[payments.length - 1]
  const customer = sale.customer?.name || 'Walk-in customer'
  const lines = sale.lines ?? []
  return {
    sale: {
      id: sale.id,
      reference: sale.receiptNumber || sale.reference || '',
      receiptNumber: sale.receiptNumber || sale.reference || '',
      date: sale.date,
      customer,
      customerId: sale.customerId || undefined,
      assignedTo: sale.assignedTo || undefined,
      createdByName: sale.createdByName || undefined,
      product: sale.legacyProduct || lines.map((line) => line.productName).join(', '),
      quantity: sale.legacyQuantity ?? lines.reduce((total, line) => total + line.packs, 0),
      total: sale.total,
      status: sale.paidAmount >= sale.total ? 'Paid' : 'Pending',
      method: lastPayment?.method || sale.legacyMethod || (sale.paymentTerms === 'Credit' ? 'Credit terms' : 'Unpaid'),
      txnID: lastPayment?.txnID || sale.legacyTxnID || undefined,
      paymentTerms: sale.paymentTerms,
      dueDate: sale.dueDate,
      lines,
      customerSnapshot: sale.customer,
      companySnapshot: sale.company,
      paidAmount: sale.paidAmount,
      payments,
      legacyImported: sale.legacyImported,
    },
    payments,
  }
}

export type CreateSaleInput = {
  customerId?: string
  guest?: Pick<SalePartySnapshot, 'name' | 'contact' | 'phone' | 'email' | 'address' | 'tin'>
  lines: Array<{ productId: string; packs: number; pricePerPack?: number; overrideReason?: string }>
  paymentTerms: NonNullable<Sale['paymentTerms']>
  dueDate?: string
  initialPaymentAmount: number
  initialPaymentMethod?: SalePayment['method']
  initialPaymentTxnID?: string
  idempotencyKey: string
}

export async function listSales() {
  const sales: Sale[] = []
  const payments: SalePayment[] = []
  const visited = new Set<string>()
  let cursor: string | undefined
  do {
    const params = new URLSearchParams({ limit: '200' })
    if (cursor) params.set('cursor', cursor)
    const result = await request<{ sales: ApiSale[]; nextCursor: string | null }>(`/sales?${params}`)
    for (const row of result.sales) {
      const normalized = normalizeSale(row)
      sales.push(normalized.sale)
      payments.push(...normalized.payments)
    }
    cursor = result.nextCursor || undefined
    if (cursor && visited.has(cursor)) throw new Error('The sales list returned a repeated pagination cursor.')
    if (cursor) visited.add(cursor)
  } while (cursor)
  return { sales, payments }
}

export async function importLegacySales(sales: Sale[], payments: SalePayment[]) {
  const imported: string[] = []
  const duplicates: string[] = []
  const rejected: { id: string; reason: string }[] = []
  const batchCount = Math.max(1, Math.ceil(sales.length / 200))
  for (let batchIndex = 0; batchIndex < batchCount; batchIndex += 1) {
    const batchSales = sales.slice(batchIndex * 200, (batchIndex + 1) * 200)
    const batchIds = new Set(batchSales.map((sale) => sale.id))
    const batchPayments = payments.filter((payment) => batchIds.has(payment.saleId))
    if (batchPayments.length > 1000) {
      throw new ApiError('A legacy sales batch contains more than 1,000 payments for 200 sales. Local data was retained; import smaller history groups.', 400)
    }
    if (batchIndex === batchCount - 1) {
      batchPayments.push(...payments.filter((payment) => !sales.some((sale) => sale.id === payment.saleId)))
    }
    const result = await request<{
      imported: string[]
      duplicates: string[]
      rejected: { id: string; reason: string }[]
    }>('/sales/legacy-import', {
      method: 'POST',
      body: JSON.stringify({
        sales: batchSales.map((sale) => ({
          id: sale.id,
          reference: sale.reference,
          date: sale.date,
          customer: sale.customer,
          customerId: sale.customerId,
          product: sale.product,
          quantity: sale.quantity,
          total: sale.total,
          status: sale.status,
          method: sale.method,
          txnID: sale.txnID,
          paymentTerms: sale.paymentTerms,
          dueDate: sale.dueDate,
        })),
        payments: batchPayments.map((payment) => ({
          id: payment.id,
          saleId: payment.saleId,
          amount: payment.amount,
          date: payment.date,
          method: payment.method,
          txnID: payment.txnID,
          note: payment.note,
          recordedAt: payment.recordedAt,
        })),
      }),
    })
    imported.push(...result.imported)
    duplicates.push(...result.duplicates)
    rejected.push(...result.rejected)
  }
  return { imported, duplicates, rejected }
}

export async function createSale(input: CreateSaleInput) {
  const result = await request<{ sale: ApiSale; payments: ApiSale['payments']; replayed?: boolean }>('/sales', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  const normalized = normalizeSale({ ...result.sale, payments: result.payments ?? result.sale.payments })
  if (!normalized.sale.receiptNumber) throw new ApiError('The server saved the sale but did not return a receipt number. Contact an administrator before retrying.', 502)
  return { ...normalized, replayed: result.replayed ?? false }
}

export async function recordSalePayment(id: string, input: Omit<CreateSaleInput, 'customerId' | 'guest' | 'lines' | 'paymentTerms' | 'dueDate' | 'initialPaymentAmount' | 'initialPaymentMethod' | 'initialPaymentTxnID'> & {
  amount: number
  date: string
  method: SalePayment['method']
  txnID?: string
  note?: string
}) {
  const result = await request<{
    payment: Omit<SalePayment, 'recordedAt'> & { createdAt?: string; updatedAt?: string }
    payments: Array<Omit<SalePayment, 'recordedAt'> & { createdAt?: string; updatedAt?: string }>
    replayed?: boolean
  }>(`/sales/${encodeURIComponent(id)}/payments`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return { payment: normalizeSalePayment(result.payment), payments: result.payments.map(normalizeSalePayment), replayed: result.replayed ?? false }
}

export type NotificationCategory = 'approval' | 'leave' | 'payroll' | 'salary_advance' | 'expense' | 'inventory' | 'sales' | 'security' | 'general'
export type NotificationSeverity = 'info' | 'action_required' | 'urgent'
export type NotificationRecord = {
  id: string
  type: string
  category: NotificationCategory
  severity: NotificationSeverity
  title: string
  message: string
  resource: { type: string; id: string; reference?: string }
  occurredAt: string
  readAt: string | null
  expiresAt: string | null
  createdAt: string
}
export type NotificationPage = {
  notifications: NotificationRecord[]
  unreadCount: number
  nextCursor: string | null
}

export type CreditReminderSettings = {
  daysBeforeDue: number[]
  daysAfterDue: number[]
  repeatOverdueEveryDays: number
  escalateAfterDays: number
  timeZone: 'Africa/Kampala'
}

export type SalesOwner = Pick<UserAccount, 'id' | 'name' | 'email' | 'roles'>

export const NOTIFICATION_SOCKET_URL = apiBaseUrl.replace(/\/api\/?$/, '')

export async function listNotifications(options: { limit?: number; cursor?: string; unread?: boolean; category?: 'action_required' } = {}) {
  const params = new URLSearchParams({ limit: String(options.limit ?? 50) })
  if (options.cursor) params.set('cursor', options.cursor)
  if (options.unread) params.set('unread', 'true')
  if (options.category) params.set('category', options.category)
  return request<NotificationPage>(`/notifications?${params.toString()}`)
}

export async function markNotificationRead(id: string) {
  return request<{ notification: NotificationRecord; unreadCount: number }>(`/notifications/${encodeURIComponent(id)}/read`, {
    method: 'PATCH',
  })
}

export async function markAllNotificationsRead() {
  return request<{ updated: number; unreadCount: number }>('/notifications/read-all', { method: 'PATCH' })
}

export async function getCreditReminderSettings() {
  return request<{ settings: CreditReminderSettings }>('/notifications/credit-reminder-settings')
}

export async function updateCreditReminderSettings(settings: Omit<CreditReminderSettings, 'timeZone'>) {
  return request<{ settings: CreditReminderSettings }>('/notifications/credit-reminder-settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  })
}

export async function listSalesOwners() {
  const result = await request<{ users: SalesOwner[] }>('/sales/owners')
  return result.users
}

export async function updateCreditSale(id: string, input: { customerId?: string; dueDate?: string; assignedTo?: string | null }) {
  const result = await request<{ sale: ApiSale }>(`/sales/${encodeURIComponent(id)}/credit`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  return normalizeSale(result.sale).sale
}

export async function getCreditCustomerStatement(customerId: string) {
  return request<{
    customer: { id: string; name: string; phone?: string; email?: string }
    sales: Array<ApiSale & { balance: number; payments: ApiPayment[] }>
    summary: { totalCredit: number; totalPaid: number; outstanding: number; overdue: number }
  }>(`/sales/credit-customers/${encodeURIComponent(customerId)}/statement`)
}

export async function listProductionMaterials() {
  return listRawMaterials()
}

export async function listRawMaterials() {
  return request<{ materials: ProductionMaterial[] }>('/production/materials')
}

export async function listInventoryResponsibleUsers() {
  return request<{ users: InventoryResponsibleUser[] }>('/production/materials/responsible-users')
}

export async function createProductionMaterial(input: { code: string; name: string; category: string; unit: string; packagingLevels?: MaterialPackagingLevel[] }) {
  return request<{ material: ProductionMaterial }>('/production/materials', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateProductionMaterial(id: string, input: { code: string; name: string; category: string; unit: string; packagingLevels?: MaterialPackagingLevel[] }) {
  return request<{ material: ProductionMaterial }>(`/production/materials/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export async function deleteProductionMaterial(id: string) {
  return request<{ deleted: true; materialId: string; deletedUnit: string; deletedStock: number; deletedLocationCount: number; preservedMovementCount: number }>(`/production/materials/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export async function configureRawMaterialLocation(id: string, location: string, input: { reorderThreshold: number; responsibleUserId: string | null }) {
  return request<{ location: RawMaterialLocationBalance; responsibleUser: { id: string; name: string } | null }>(`/production/materials/${encodeURIComponent(id)}/locations/${encodeURIComponent(location)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function receiveProductionMaterial(id: string, input: { quantity?: number; date: string; reference?: string; reason: string; location: string; supplier?: string; sourceReference?: string; unitCost?: number; packageUnit?: string; packageQuantity?: number; packagePrice?: number; idempotencyKey: string }) {
  return request<{ balance: number; movement: RawMovementRecord }>(`/production/materials/${encodeURIComponent(id)}/receipts`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function adjustRawMaterialStock(input: { materialId: string; location: string; direction: 'in' | 'out'; quantity: number; date: string; reference?: string; reason: string; idempotencyKey: string }) {
  return request<{ balance: number; movement: RawMovementRecord }>('/production/materials/adjustments', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function transferRawMaterialStock(input: { materialId: string; fromLocation: string; toLocation: string; quantity: number; date: string; reference?: string; reason: string; idempotencyKey: string }) {
  return request<{ balance: number; movement: RawMovementRecord }>('/production/materials/transfers', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function listProductionMaterialMovements(filters: { materialId?: string; location?: string; type?: string; from?: string; to?: string } = {}) {
  const params = new URLSearchParams({ limit: '200' })
  Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value) })
  return request<{ movements: RawMovementRecord[] }>(`/production/materials/movements?${params.toString()}`)
}

export async function listProductionMaterialReceipts() {
  return request<{ movements: RawMovementRecord[] }>('/production/materials/receipts?limit=200')
}

export async function listRawMaterialAlerts() {
  return request<{ alerts: RawMaterialAlert[] }>('/production/materials/low-stock?limit=200')
}

export async function listProductionMaterialUsages() {
  return request<{ usages: ProductionMaterialUsageRecord[] }>('/production/materials/production-usages?limit=200')
}

export async function postProductionMaterialUsage(input: {
  tanksProduced: number
  location: string
  idempotencyKey: string
} & (
  | { productionRunId: string }
  | { productId: string; productionDate: string }
)) {
  return request<{ usage: ProductionMaterialUsageRecord; replayed?: boolean }>('/production/materials/production-usages', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateProductionMaterialUsage(id: string, input: {
  productId: string
  productionDate: string
  tanksProduced: number
  location: string
}) {
  return request<{ usage: ProductionMaterialUsageRecord }>(`/production/materials/production-usages/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export async function listProductionRuns() {
  return request<{ runs: ProductionRunRecord[] }>('/production/runs?limit=200')
}

export async function getDailyProductionStockSummary(productId: string, date: string) {
  const params = new URLSearchParams({ productId, date })
  return request<DailyProductionStockSummary>(`/production/runs/daily-stock-summary?${params}`)
}

export async function postProductionRun(input: {
  productId: string
  productionDate: string
  openingStockPacks: number
  damagedQuantityPacks: number
  closingStockPacks: number
  damageReason?: string
  idempotencyKey: string
}) {
  return request<{ run: ProductionRunRecord; balancePacks: number }>('/production/runs', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function listFinishedStockMovements() {
  return request<{ movements: FinishedMovementRecord[] }>('/production/stock/finished/movements?limit=200')
}

export async function receiveFinishedStock(input: {
  productId: string
  quantityPacks: number
  date: string
  reason: string
  reference?: string
  idempotencyKey: string
}) {
  return request<{ balancePacks: number; movement: FinishedMovementRecord }>('/production/stock/finished/receipts', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function adjustFinishedStock(input: {
  productId: string
  direction: 'in' | 'out'
  quantityPacks: number
  date: string
  reason: string
  reference?: string
  idempotencyKey: string
}) {
  return request<{ balancePacks: number; movement: FinishedMovementRecord }>('/production/stock/finished/adjustments', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export type EmployeeDraftRecord = {
  id: string
  employee: Partial<Employee>
  currentStep: number
  updatedAt: string
}

function normalizeEmployee(employee: Employee): Employee {
  const documents = (employee.documents ?? []).map((document) => {
    const absoluteUrl = document.url.startsWith('http')
      ? document.url
      : `${apiBaseUrl}${document.url}`;
    return { ...document, url: absoluteUrl, download_Url: absoluteUrl }
  })
  return {
    ...employee,
    dateOfBirth: employee.dateOfBirth?.slice(0, 10),
    image: employee.image ?? {
      url: employee.photoUrl ?? '',
      publicId: '',
    },
    photoUrl: employee.image?.url ?? employee.photoUrl ?? '',
    documents,
    salary: employee.salary ?? 0,
  }
}

export async function listEmployees(filters: {
  q?: string
  department?: string
  category?: string
  frequency?: string
  status?: string
} = {}) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value) search.set(key, value)
  }
  const suffix = search.size ? `?${search.toString()}` : ''
  const result = await request<{ employees: Employee[]; limited: boolean }>(`/employees${suffix}`)
  return { ...result, employees: result.employees.map(normalizeEmployee) }
}

export async function listCustomers() {
  const customers: Customer[] = []
  const visited = new Set<string>()
  let cursor: string | undefined
  do {
    const search = new URLSearchParams({ limit: '200' })
    if (cursor) search.set('cursor', cursor)
    const page = await request<{ customers: Customer[]; nextCursor: string | null }>(`/customers?${search}`)
    customers.push(...page.customers)
    cursor = page.nextCursor || undefined
    if (cursor && visited.has(cursor)) throw new Error('The customer list returned a repeated pagination cursor.')
    if (cursor) visited.add(cursor)
  } while (cursor)
  return customers
}

export async function createCustomer(customer: CustomerInput) {
  const result = await request<{ customer: Customer }>('/customers', {
    method: 'POST',
    body: JSON.stringify(customer),
  })
  return result.customer
}

export async function updateCustomer(id: string, customer: CustomerUpdate) {
  const result = await request<{ customer: Customer }>(`/customers/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(customer),
  })
  return result.customer
}

export async function changeCustomerStatus(id: string, status: Customer['status']) {
  const result = await request<{ customer: Customer }>(`/customers/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
  return result.customer
}

export async function archiveCustomer(id: string) {
  const result = await request<{ customer: Customer }>(`/customers/${encodeURIComponent(id)}/archive`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
  return result.customer
}

export async function restoreCustomer(id: string) {
  const result = await request<{ customer: Customer }>(`/customers/${encodeURIComponent(id)}/restore`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
  return result.customer
}

function normalizeOrderApi(order: OrderApiRecord): Order {
  const statusHistory = order.statusHistory.map((event) => ({
    type: event.type,
    status: (event.toStatus || event.fromStatus || order.status) as OrderStatus,
    at: event.at,
    actor: event.actor,
    reason: event.reason,
  }))
  return {
    id: order.id,
    reference: order.orderNumber,
    orderNumber: order.orderNumber,
    date: order.date,
    createdAt: order.createdAt,
    customer: order.customer.name,
    customerId: order.customerId,
    items: order.items.map((item, index) => ({
      id: `${order.id}-line-${index + 1}`,
      product: item.productName,
      quantity: item.packs,
      unitPrice: item.pricePerPack,
      lineTotal: item.lineTotal,
      productId: item.productId || undefined,
      productCode: item.productCode,
      packType: item.packType || undefined,
      piecesPerPack: item.piecesPerPack || undefined,
      overrideReason: item.overrideReason || undefined,
    })),
    total: order.total,
    requestedDate: order.requestedDate,
    fulfilmentMethod: order.fulfilmentMethod,
    destination: order.destination,
    paymentTerms: order.paymentTerms,
    dueDate: order.dueDate || undefined,
    status: order.status,
    statusHistory,
    completedAt: order.completedAt || undefined,
    priority: order.priority,
    priorityReason: order.priorityReason,
    archivedAt: order.archivedAt || undefined,
    notes: order.notes,
    paidAmount: order.paidAmount,
    reserved: order.reserved,
    saleId: order.saleId || undefined,
    legacyImported: order.legacyImported,
  }
}

export async function listOrders() {
  const orders: Order[] = []
  let pageNumber = 1
  let total = 0
  const pageSize = 200
  do {
    const search = new URLSearchParams({ page: String(pageNumber), limit: String(pageSize) })
    const result = await request<{ orders: OrderApiRecord[]; total: number; page?: number; limit?: number }>(`/orders?${search}`)
    if (!Array.isArray(result.orders) || !Number.isSafeInteger(result.total) || result.total < 0 ||
      (result.page !== undefined && result.page !== pageNumber) ||
      (result.limit !== undefined && result.limit !== pageSize)) {
      throw new Error('The order list returned inconsistent pagination metadata.')
    }
    orders.push(...result.orders.map(normalizeOrderApi))
    total = result.total
    pageNumber += 1
    if (orders.length < total && result.orders.length === 0) {
      throw new Error('The order list returned inconsistent pagination metadata.')
    }
  } while (orders.length < total)
  return orders
}

export async function getPendingOrderCount() {
  const search = new URLSearchParams({
    status: 'Pending',
    archived: 'false',
    page: '1',
    limit: '1',
  })
  const result = await request<{ orders: OrderApiRecord[]; total: number; page?: number; limit?: number }>(`/orders?${search}`)
  if (!Array.isArray(result.orders) || !Number.isSafeInteger(result.total) || result.total < 0 ||
    (result.page !== undefined && result.page !== 1) ||
    (result.limit !== undefined && result.limit !== 1)) {
    throw new Error('The pending order count returned inconsistent pagination metadata.')
  }
  return result.total
}

export async function getOrderDetails(id: string) {
  const result = await request<{ order: OrderApiRecord; payments: OrderPaymentRecord[] }>(
    `/orders/${encodeURIComponent(id)}`,
  )
  return {
    order: normalizeOrderApi(result.order),
    payments: result.payments,
  }
}

export async function createOrder(input: OrderInput) {
  const result = await request<{ order: OrderApiRecord }>('/orders', {
    method: 'POST',
    body: JSON.stringify({ ...input, idempotencyKey: input.idempotencyKey || createId('ORD-REQUEST') }),
  })
  return normalizeOrderApi(result.order)
}

export async function updateOrder(id: string, input: Partial<OrderInput>) {
  const result = await request<{ order: OrderApiRecord }>(`/orders/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
  return normalizeOrderApi(result.order)
}

export async function confirmOrder(id: string) {
  const result = await request<{ order: OrderApiRecord }>(`/orders/${encodeURIComponent(id)}/confirm`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
  return normalizeOrderApi(result.order)
}

export async function changeOrderStatus(id: string, status: OrderStatus, reason = '') {
  const result = await request<{ order: OrderApiRecord }>(`/orders/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, reason }),
  })
  return normalizeOrderApi(result.order)
}

export async function recordOrderPayment(id: string, input: {
  amount: number
  date: string
  method: SalePayment['method']
  txnID?: string
  note?: string
  idempotencyKey: string
}) {
  return request<{ payment: OrderPaymentRecord; payments: OrderPaymentRecord[]; replayed: boolean }>(
    `/orders/${encodeURIComponent(id)}/payments`,
    { method: 'POST', body: JSON.stringify(input) },
  )
}

export async function fulfillOrder(id: string) {
  const result = await request<{ order: OrderApiRecord; sale: ApiSale; payments: ApiPayment[]; replayed: boolean }>(
    `/orders/${encodeURIComponent(id)}/fulfill`,
    { method: 'POST', body: JSON.stringify({}) },
  )
  const normalizedSale = normalizeSale({ ...result.sale, payments: result.payments })
  return { order: normalizeOrderApi(result.order), ...normalizedSale, replayed: result.replayed }
}

export async function archiveOrder(id: string) {
  const result = await request<{ order: OrderApiRecord }>(`/orders/${encodeURIComponent(id)}/archive`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
  return normalizeOrderApi(result.order)
}

export async function restoreOrder(id: string) {
  const result = await request<{ order: OrderApiRecord }>(`/orders/${encodeURIComponent(id)}/restore`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
  return normalizeOrderApi(result.order)
}

export async function importLegacyOrders(orders: Order[]) {
  const imported: string[] = []
  const duplicates: string[] = []
  const rejected: { id: string; reason: string }[] = []
  for (let start = 0; start < orders.length; start += 200) {
    const result = await request<{ imported: string[]; duplicates: string[]; rejected: typeof rejected }>(
      '/orders/legacy-import',
      {
        method: 'POST',
        body: JSON.stringify({
          orders: orders.slice(start, start + 200).map((order) => ({
            id: order.id,
            reference: order.reference,
            date: order.date,
            customer: order.customer,
            customerId: order.customerId,
            items: order.items.map((item) => ({
              product: item.product,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              lineTotal: item.lineTotal,
            })),
            total: order.total,
            requestedDate: order.requestedDate,
            fulfilmentMethod: order.fulfilmentMethod,
            destination: order.destination,
            paymentTerms: order.paymentTerms,
            status: order.status,
            completedAt: order.completedAt,
            priority: order.priority,
            priorityReason: order.priorityReason,
            archivedAt: order.archivedAt,
            notes: order.notes,
          })),
        }),
      },
    )
    imported.push(...result.imported)
    duplicates.push(...result.duplicates)
    rejected.push(...result.rejected)
  }
  return { imported, duplicates, rejected }
}

export async function importLegacyCustomers(customers: Customer[]) {
  const imported: Customer[] = []
  const existing: string[] = []
  const rejected: { id: string; index: number; reason: string }[] = []
  const batchSize = 200
  for (let start = 0; start < customers.length; start += batchSize) {
    const result = await request<{
      imported: Customer[]
      existing: string[]
      rejected: { id: string; index: number; reason: string }[]
    }>('/customers/legacy-import', {
      method: 'POST',
      body: JSON.stringify({ customers: customers.slice(start, start + batchSize) }),
    })
    imported.push(...result.imported)
    existing.push(...result.existing)
    rejected.push(...result.rejected.map((item) => ({ ...item, index: item.index + start })))
  }
  return { imported, existing, rejected }
}

export async function getEmployee(id: string) {
  const result = await request<{ employee: Employee; limited: boolean }>(`/employees/${encodeURIComponent(id)}`)
  return { ...result, employee: normalizeEmployee(result.employee) }
}

export async function createEmployee(employee: Omit<Employee, 'id' | 'number' | 'documents' | 'image' | 'photoUrl'>) {
  const result = await request<{ employee: Employee }>('/employees', {
    method: 'POST',
    body: JSON.stringify(employee),
  })
  return normalizeEmployee(result.employee)
}

const EMPLOYEE_PROFILE_UPDATE_FIELDS: readonly (keyof Employee)[] = [
  'name',
  'firstName',
  'secondName',
  'otherNames',
  'dateOfBirth',
  'gender',
  'maritalStatus',
  'spouseName',
  'spousePhone',
  'childrenCount',
  'educationLevel',
  'profession',
  'phone',
  'email',
  'currentAddress',
  'placeOfOrigin',
  'nextOfKinName',
  'nextOfKinRelationship',
  'nextOfKinPhone',
  'nextOfKinAddress',
  'mother',
  'father',
  'category',
  'department',
  'role',
  'status',
  'salary',
  'compensationType',
  'paymentFrequency',
  'nssfNumber',
  'tinNumber',
  'nssfApplies',
  'taxApplies',
  'notes',
  'userId',
  'supervisorUserId',
]

export async function updateEmployee(id: string, employee: Partial<Employee>) {
  const changes: Partial<Employee> = {}
  for (const field of EMPLOYEE_PROFILE_UPDATE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(employee, field)) {
      Object.assign(changes, { [field]: employee[field] })
    }
  }
  const result = await request<{ employee: Employee }>(`/employees/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(changes),
  })
  return normalizeEmployee(result.employee)
}

export async function deactivateEmployee(id: string) {
  const result = await request<{ employee: Employee }>(`/employees/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  return normalizeEmployee(result.employee)
}

export function uploadEmployeeImage(id: string, file: File) {
  const body = new FormData()
  body.set('image', file)
  return request<{ image: { url: string; publicId: string } }>(`/employees/${encodeURIComponent(id)}/image`, {
    method: 'POST',
    body,
  })
}

export function removeEmployeeImage(id: string) {
  return request<{ image: { url: string; publicId: string } }>(`/employees/${encodeURIComponent(id)}/image`, {
    method: 'DELETE',
  })
}

export function uploadEmployeeDocument(id: string, title: string, file: File) {
  const body = new FormData()
  body.set('title', title)
  body.set('document', file)
  return request<{ document: EmployeeDocument }>(`/employees/${encodeURIComponent(id)}/documents`, {
    method: 'POST',
    body,
  })
}

export function removeEmployeeDocument(employeeId: string, documentId: string) {
  return request<{ removed: boolean }>(
    `/employees/${encodeURIComponent(employeeId)}/documents/${encodeURIComponent(documentId)}`,
    { method: 'DELETE' },
  )
}

export function getEmployeeDocumentDownload(employeeId: string, documentId: string) {
  return request<{ url: string; expiresInSeconds: number }>(
    `/employees/${encodeURIComponent(employeeId)}/documents/${encodeURIComponent(documentId)}/download`,
  )
}

export function listEmployeeDrafts() {
  return request<{ drafts: EmployeeDraftRecord[] }>('/employees/drafts')
}

export function saveEmployeeDraft(draft: EmployeeDraft) {
  return request<{ draft: EmployeeDraftRecord }>(`/employees/drafts/${encodeURIComponent(draft.id)}`, {
    method: 'PUT',
    body: JSON.stringify({ employee: draft.employee, currentStep: draft.currentStep }),
  })
}

export function deleteEmployeeDraft(id: string) {
  return request<{ removed: boolean }>(`/employees/drafts/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function importLocalEmployees(employees: Array<{ migrationKey: string; employee: Record<string, unknown> }>) {
  return request<{
    imported: number
    alreadyImported: number
    failed: number
    results: Array<{ index: number; migrationKey?: string; status: string; error?: string; employeeId?: string }>
  }>('/employees/import', {
    method: 'POST',
    body: JSON.stringify({ employees }),
  })
}

export async function listAttendance(month: string, employeeId?: string) {
  const search = new URLSearchParams({ month })
  if (employeeId) search.set('employeeId', employeeId)
  const result = await request<{ records: AttendanceRecord[] }>(`/attendance?${search.toString()}`)
  return {
    records: result.records.map((record) => ({
      ...record,
      id: String(record.id),
      employeeId: String(record.employeeId),
      status: record.status as AttendanceStatus,
      updatedAt: String(record.updatedAt),
    })),
  }
}

export function saveDailyAttendance(
  workDate: string,
  entries: Array<Pick<AttendanceRecord, 'employeeId' | 'status' | 'halfDay' | 'late' | 'note'>>,
) {
  return request<{ records: AttendanceRecord[] }>(`/attendance/daily/${encodeURIComponent(workDate)}`, {
    method: 'PUT',
    body: JSON.stringify({ entries }),
  })
}

export type LeavePolicy = {
  workingDays: number[]
  holidays: string[]
  leaveYearStart: string
  entitlements: Partial<Record<LeaveType, number>>
  carryoverEnabled: boolean
  carryoverLimit: number
  reminderThresholds: {
    pendingApprovalBusinessDays: number
    beforeStartDays: number[]
    onStartDate: boolean
    returnFollowUp: boolean
  }
}

export type LeaveRoutingEmployee = {
  id: string
  name: string
  number: string
  department: string
  role: string
  userId: string | null
  supervisorUserId: string | null
}

export type LeaveRoutingUser = {
  id: string
  name: string
  email: string
  roles: UserRole[]
}

export type LeaveRequestInput = {
  employeeId?: string
  leaveType: LeaveType
  otherLeaveType?: string
  reason: string
  startDate: string
  endDate: string
  handoverEmployeeId: string
  handoverContact?: string
}

export type LegacyLeaveArchiveRecord = {
  id: string
  reference: string
  employeeNumber: string
  employeeName: string
  department: string
  role: string
  leaveType: LeaveType
  otherLeaveType: string
  reason: string
  startDate: string
  endDate: string
  requestedDays: number
  handoverName: string
  handoverContact: string
  originalStatus: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled' | 'Unknown'
  createdAt: string
}

export type LegacyLeaveImportPreview = {
  records: Array<{
    index: number
    reference: string
    employeeName?: string
    originalStatus?: LegacyLeaveArchiveRecord['originalStatus']
    employeeMatched: boolean
    importable: boolean
    duplicate: boolean
    reason: string
  }>
  importableCount: number
  duplicateCount: number
}

function legacyLeaveImportPayload(leaves: LeaveRequest[]) {
  return leaves.map((leave) => ({
    id: leave.id,
    reference: leave.reference,
    employeeNumber: leave.employeeNumber,
    employeeName: leave.employeeName,
    department: leave.department,
    role: leave.role,
    leaveType: leave.leaveType,
    otherLeaveType: leave.otherLeaveType,
    reason: leave.reason,
    startDate: leave.startDate,
    endDate: leave.endDate,
    handoverName: leave.handoverName,
    handoverContact: leave.handoverContact,
    status: leave.status,
    requestedAt: leave.requestedAt,
  }))
}

export function listLegacyLeaveArchive() {
  return request<{ records: LegacyLeaveArchiveRecord[] }>('/leave/legacy-archive')
}

export function previewLegacyLeaveRequests(leaves: LeaveRequest[]) {
  return request<LegacyLeaveImportPreview>('/leave/legacy-import/preview', {
    method: 'POST',
    body: JSON.stringify({ leaves: legacyLeaveImportPayload(leaves) }),
  })
}

export function importLegacyLeaveRequests(leaves: LeaveRequest[]) {
  return request<{
    imported: LegacyLeaveArchiveRecord[]
    skipped: Array<{ index: number; reference: string; reason: string }>
  }>('/leave/legacy-import', {
    method: 'POST',
    body: JSON.stringify({ leaves: legacyLeaveImportPayload(leaves) }),
  })
}

function normalizeLeaveRequest(request: LeaveRequest): LeaveRequest {
  const raw = request as LeaveRequest & Record<string, unknown>
  const decisions = (raw.decisions ?? []).map((entry) => {
    const decision = entry as LeaveRequest['decisions'][number] & { actorId?: string; actorName?: string; _id?: string; id?: string }
    return {
      ...decision,
      id: String(decision.id || decision._id || ''),
      actor: decision.actorName || decision.actor || 'Administrator',
      at: typeof decision.at === 'string' ? decision.at : new Date(String(decision.at)).toISOString(),
    }
  })
  const employee = raw.employeeId && typeof raw.employeeId === 'object'
    ? raw.employeeId as Employee & { _id?: string; phone?: string }
    : undefined
  const referenceId = (value: unknown) => value && typeof value === 'object'
    ? String((value as { id?: string; _id?: string }).id || (value as { _id?: string })._id || '')
    : String(value || '')
  return {
    ...request,
    id: String(raw.id || raw._id || ''),
    employeeId: String(employee?.id || employee?._id || referenceId(raw.employeeId)),
    employeeName: String(raw.employeeName || employeeDisplayName(employee ?? {})),
    employeeNumber: String(raw.employeeNumber || employee?.number || ''),
    department: String(raw.department || employee?.department || ''),
    role: String(raw.role || employee?.role || ''),
    employeeContact: String(raw.employeeContact || employee?.phone || ''),
    handoverEmployeeId: String(raw.handoverEmployeeId || ''),
    handoverName: String(raw.handoverName || ''),
    handoverContact: String(raw.handoverContact || ''),
    requestedAt: String(raw.requestedAt || raw.createdAt || ''),
    updatedAt: String(raw.updatedAt || raw.createdAt || ''),
    requesterUserId: referenceId(raw.requesterUserId),
    approverUserId: referenceId(raw.approverUserId),
    decisions,
    amendments: (raw.amendments ?? []).map((item) => {
      const amendment = item as NonNullable<LeaveRequest['amendments']>[number] & { _id?: string; id?: string }
      return { ...amendment, id: String(amendment.id || amendment._id || '') }
    }),
  }
}

export function getApprovalInbox() {
  return request<ApprovalInboxResponse>('/approvals')
}

export async function listLeaveRequests(filters: { status?: LeaveRequest['status'] } = {}) {
  const query = filters.status ? `?status=${encodeURIComponent(filters.status)}` : ''
  const result = await request<{ requests: LeaveRequest[] }>(`/leave${query}`)
  return { requests: result.requests.map(normalizeLeaveRequest) }
}

export async function createLeaveRequest(input: LeaveRequestInput) {
  const result = await request<{ request: LeaveRequest }>('/leave', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return normalizeLeaveRequest(result.request)
}

export async function decideLeaveRequest(id: string, input: { decision: 'Approved' | 'Rejected'; note?: string }) {
  const result = await request<{ request: LeaveRequest }>(`/leave/${encodeURIComponent(id)}/decision`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return normalizeLeaveRequest(result.request)
}

export async function cancelLeaveRequest(id: string, note: string) {
  const result = await request<{ request: LeaveRequest }>(`/leave/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  })
  return normalizeLeaveRequest(result.request)
}

export async function createLeaveAmendment(id: string, input: { startDate: string; endDate: string; reason: string }) {
  const result = await request<{ request: LeaveRequest }>(`/leave/${encodeURIComponent(id)}/amendments`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return normalizeLeaveRequest(result.request)
}

export async function decideLeaveAmendment(id: string, amendmentId: string, input: { decision: 'Approved' | 'Rejected'; note?: string }) {
  const result = await request<{ request: LeaveRequest }>(`/leave/${encodeURIComponent(id)}/amendments/${encodeURIComponent(amendmentId)}/decision`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return normalizeLeaveRequest(result.request)
}

export async function confirmLeaveReturn(id: string, actualDate: string) {
  const result = await request<{ request: LeaveRequest }>(`/leave/${encodeURIComponent(id)}/return-confirmation`, {
    method: 'POST',
    body: JSON.stringify({ actualDate }),
  })
  return normalizeLeaveRequest(result.request)
}

export async function getLeavePolicy() {
  return request<{ policy: LeavePolicy }>('/leave/policy')
}

export async function updateLeavePolicy(policy: Partial<LeavePolicy>) {
  return request<{ policy: LeavePolicy }>('/leave/policy', {
    method: 'PUT',
    body: JSON.stringify(policy),
  })
}

export function listLeavePeople() {
  return request<{ employees: LeaveRoutingEmployee[]; users: LeaveRoutingUser[] }>('/leave/people')
}

export function updateLeaveRouting(employeeId: string, input: { userId?: string | null; supervisorUserId?: string | null }) {
  return request<{ employee: Pick<LeaveRoutingEmployee, 'id' | 'userId' | 'supervisorUserId'> }>(
    `/leave/people/${encodeURIComponent(employeeId)}/routing`,
    { method: 'PUT', body: JSON.stringify(input) },
  )
}

export async function listLeaveBalances() {
  return request<{ balances: Array<{
    employeeId: string
    employeeName: string
    employeeNumber: string
    department: string
    leaveYear: { start: string; end: string }
    byType: Record<LeaveType, { configured: boolean; entitlement: number | null; carryover: number; used: number; pending: number; available: number | null }>
  }> }>('/leave/balances')
}

export async function listLeaveReminderCandidates() {
  return request<{ candidates: Array<{ key: string; type: string; dueDate: string; requestId: string; recipientUserId: string }> }>('/leave/reminder-candidates')
}

export type DisciplinaryLetterType = 'Written warning' | 'Suspension' | 'Termination'
export type DisciplinaryCaseStatus =
  | 'Draft'
  | 'Under investigation'
  | 'Awaiting employee response'
  | 'Pending Human Resource approval'
  | 'Pending General Manager approval'
  | 'Pending Super Admin approval'
  | 'Changes requested'
  | 'Approved'
  | 'Issued'
  | 'Closed'
  | 'Rescinded'

export type DisciplinaryApproverStage = 'Human Resource' | 'General Manager' | 'Super Admin'
export type DisciplinaryApproverAssignments = {
  humanResource: string
  generalManager: string
  superAdmin: string
}

export type DisciplinaryCase = {
  id: string
  reference: string
  employeeId: string
  employeeName: string
  employeeNumber: string
  department: string
  role: string
  type: DisciplinaryLetterType
  status: DisciplinaryCaseStatus
  incidentDate: string
  allegation: string
  reason?: string
  expectations?: string
  reviewDate?: string
  suspensionStartDate?: string
  suspensionEndDate?: string
  returnDate?: string
  suspensionPayStatus?: 'Paid' | 'Unpaid' | 'Not specified'
  conditions?: string
  effectiveDate?: string
  noticeDetails?: string
  handoverDetails?: string
  signatory?: string
  responseRequired: boolean
  responseDueDate?: string
  responseNotice?: string
  response?: { text: string; submittedAt: string; submittedBy: string; source: 'Employee portal' | 'In person' | 'Written externally' }
  responseHistory?: Array<{ text: string; submittedAt: string; submittedBy: string; source: 'Employee portal' | 'In person' | 'Written externally' }>
  noResponseRecordedAt?: string
  noResponseNote?: string
  assignedApprovers?: DisciplinaryApproverAssignments
  approvals?: Array<{ id: string; round: number; stage: DisciplinaryApproverStage; decision: 'Approved' | 'Rejected'; actorId: string; actorName: string; note: string; decidedAt: string }>
  approvalRound?: number
  evidence?: Array<{ id: string; name: string; mediaType: string; sizeBytes: number; uploadedBy: string; uploadedAt: string }>
  acknowledgements?: Array<{ id: string; status: 'Received' | 'Declined' | 'Disputed'; note: string; actorId: string; recordedAt: string }>
  appeals?: Array<{ id: string; text: string; submittedAt: string; resolution?: 'Upheld' | 'Varied' | 'Overturned'; resolutionNote?: string }>
  issuedAt?: string
  issuedLetterVersion?: number
  letterVersion?: number
  rescindReason?: string
  createdAt?: string
  updatedAt?: string
}

export type DisciplinaryCaseInput = {
  employeeId: string
  type: DisciplinaryLetterType
  incidentDate: string
  allegation: string
  reason: string
  expectations?: string
  reviewDate?: string
  suspensionStartDate?: string
  suspensionEndDate?: string
  returnDate?: string
  suspensionPayStatus?: 'Paid' | 'Unpaid' | 'Not specified'
  conditions?: string
  effectiveDate?: string
  noticeDetails?: string
  handoverDetails?: string
  signatory: string
  responseRequired?: boolean
  responseDueDate?: string
  assignedApprovers: DisciplinaryApproverAssignments
}

export type DisciplinaryPolicy = {
  responseRules: Record<DisciplinaryLetterType, { required: boolean; responseWindowDays: number }>
}

export type DisciplinaryIndicator = {
  type: DisciplinaryLetterType
  label: string
  icon: 'flag-outline' | 'flag-filled' | 'user-x'
  reference: string
}

export async function listDisciplinaryCases() {
  return request<{ cases: DisciplinaryCase[] }>('/disciplinary-cases')
}

export async function listMyDisciplinaryCases() {
  return request<{ cases: DisciplinaryCase[] }>('/disciplinary-cases/my-cases')
}

export async function getDisciplinaryCase(id: string) {
  return request<{ case: DisciplinaryCase }>(`/disciplinary-cases/${encodeURIComponent(id)}`)
}

export async function getDisciplinaryApproverCandidates() {
  return request<{ candidates: Record<DisciplinaryApproverStage, Array<{ id: string; name: string; role: DisciplinaryApproverStage }>> }>('/disciplinary-cases/approvers')
}

export async function getDisciplinaryPolicy() {
  return request<{ policy: DisciplinaryPolicy }>('/disciplinary-cases/policy')
}

export async function updateDisciplinaryPolicy(policy: DisciplinaryPolicy) {
  return request<{ policy: DisciplinaryPolicy }>('/disciplinary-cases/policy', {
    method: 'PUT',
    body: JSON.stringify(policy),
  })
}

export async function listDisciplinaryIndicators() {
  return request<{ indicators: Record<string, DisciplinaryIndicator[]> }>('/disciplinary-cases/employee-indicators')
}

export async function createDisciplinaryCase(input: DisciplinaryCaseInput) {
  return request<{ case: DisciplinaryCase }>('/disciplinary-cases', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateDisciplinaryCase(id: string, input: Partial<DisciplinaryCaseInput>) {
  return request<{ case: DisciplinaryCase }>(`/disciplinary-cases/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export async function requestDisciplinaryResponse(id: string, responseNotice: string, responseDueDate: string) {
  return request<{ case: DisciplinaryCase }>(`/disciplinary-cases/${encodeURIComponent(id)}/response-request`, {
    method: 'POST',
    body: JSON.stringify({ responseNotice, responseDueDate }),
  })
}

export async function submitDisciplinaryEmployeeResponse(id: string, text: string) {
  return request<{ case: DisciplinaryCase }>(`/disciplinary-cases/my-cases/${encodeURIComponent(id)}/responses`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  })
}

export async function recordDisciplinaryOfflineResponse(id: string, text: string, source: 'In person' | 'Written externally') {
  return request<{ case: DisciplinaryCase }>(`/disciplinary-cases/${encodeURIComponent(id)}/response-record`, {
    method: 'POST',
    body: JSON.stringify({ text, source }),
  })
}

export async function recordDisciplinaryNoResponse(id: string, note: string) {
  return request<{ case: DisciplinaryCase }>(`/disciplinary-cases/${encodeURIComponent(id)}/no-response`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  })
}

export async function submitDisciplinaryCaseForApproval(id: string) {
  return request<{ case: DisciplinaryCase }>(`/disciplinary-cases/${encodeURIComponent(id)}/submit`, { method: 'POST' })
}

export async function decideDisciplinaryApproval(id: string, decision: 'Approved' | 'Rejected', note = '') {
  return request<{ case: DisciplinaryCase }>(`/disciplinary-cases/${encodeURIComponent(id)}/approvals`, {
    method: 'POST',
    body: JSON.stringify({ decision, note }),
  })
}

export async function issueDisciplinaryCase(id: string) {
  return request<{ case: DisciplinaryCase }>(`/disciplinary-cases/${encodeURIComponent(id)}/issue`, { method: 'POST' })
}

export async function acknowledgeDisciplinaryLetter(id: string, status: 'Received' | 'Declined' | 'Disputed', note = '') {
  return request<{ case: DisciplinaryCase }>(`/disciplinary-cases/my-cases/${encodeURIComponent(id)}/acknowledgements`, {
    method: 'POST',
    body: JSON.stringify({ status, note }),
  })
}

export async function submitDisciplinaryAppeal(id: string, text: string) {
  return request<{ case: DisciplinaryCase }>(`/disciplinary-cases/my-cases/${encodeURIComponent(id)}/appeals`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  })
}

export async function resolveDisciplinaryAppeal(id: string, appealId: string, resolution: 'Upheld' | 'Varied' | 'Overturned', note: string) {
  return request<{ case: DisciplinaryCase }>(`/disciplinary-cases/${encodeURIComponent(id)}/appeals/${encodeURIComponent(appealId)}/resolution`, {
    method: 'POST',
    body: JSON.stringify({ resolution, note }),
  })
}

export async function rescindDisciplinaryCase(id: string, reason: string) {
  return request<{ case: DisciplinaryCase }>(`/disciplinary-cases/${encodeURIComponent(id)}/rescind`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

export async function uploadDisciplinaryEvidence(id: string, file: File) {
  const body = new FormData()
  body.set('file', file)
  return request<{ case: DisciplinaryCase }>(`/disciplinary-cases/${encodeURIComponent(id)}/evidence`, {
    method: 'POST',
    body,
  })
}

export async function removeDisciplinaryEvidence(id: string, evidenceId: string) {
  return request<{ case: DisciplinaryCase }>(`/disciplinary-cases/${encodeURIComponent(id)}/evidence/${encodeURIComponent(evidenceId)}`, {
    method: 'DELETE',
  })
}

export async function getDisciplinaryEvidenceDownload(id: string, evidenceId: string) {
  return request<{ url: string; expiresInSeconds: number }>(`/disciplinary-cases/${encodeURIComponent(id)}/evidence/${encodeURIComponent(evidenceId)}/download`)
}

function normalizeSalaryAdvance(advance: SalaryAdvance): SalaryAdvance {
  const raw = advance as SalaryAdvance & Record<string, unknown>
  const hr = raw.hrDecision as (SalaryAdvance['hrDecision'] & { _id?: string }) | undefined
  const gm = raw.gmDecision as (SalaryAdvance['gmDecision'] & { _id?: string }) | undefined
  return {
    ...advance,
    id: String(raw.id || raw._id || ''),
    employeeId: raw.employeeId ? String(raw.employeeId) : '',
    requestedAt: typeof raw.requestedAt === 'string' ? raw.requestedAt : new Date(String(raw.requestedAt)).toISOString(),
    dateTaken: String(raw.dateTaken).slice(0, 10),
    dateApproved: typeof raw.dateApproved === 'string' ? raw.dateApproved.slice(0, 10) : undefined,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date(String(raw.createdAt)).toISOString(),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date(String(raw.updatedAt)).toISOString(),
    legacyUnverified: Boolean(raw.legacyUnverified),
    legacyStatus: typeof raw.legacyStatus === 'string' ? raw.legacyStatus : undefined,
    legacyReference: typeof raw.legacyReference === 'string' ? raw.legacyReference : undefined,
    hrDecision: hr ? { ...hr, actorId: String(hr.actorId), decidedAt: new Date(hr.decidedAt).toISOString() } : undefined,
    gmDecision: gm ? { ...gm, actorId: String(gm.actorId), decidedAt: new Date(gm.decidedAt).toISOString() } : undefined,
    decisionAt: gm?.decidedAt || hr?.decidedAt,
    decisionBy: gm?.actorName || hr?.actorName,
    attachments: (raw.attachments || []).map((attachment) => {
      const item = attachment as typeof advance.attachments[number] & { _id?: string; uploadedBy?: string }
      return { ...item, id: String(item.id || item._id || ''), url: String(item.url || ''), dataUrl: undefined }
    }),
    schedule: (raw.schedule || []).map((entry) => {
      const item = entry as SalaryAdvance['schedule'][number] & { _id?: string }
      return { ...item, id: String(item.id || item._id || ''), dueDate: String(item.dueDate).slice(0, 10) }
    }),
    repayments: (raw.repayments || []).map((repayment) => {
      const item = repayment as SalaryAdvance['repayments'][number] & { _id?: string }
      return {
        ...item,
        id: String(item.id || item._id || ''),
        date: String(item.date).slice(0, 10),
        recordedAt: typeof item.recordedAt === 'string' ? item.recordedAt : new Date(String(item.recordedAt)).toISOString(),
        scheduleEntryIds: item.scheduleEntryIds?.map(String),
      }
    }),
    activity: (raw.activity || []).map((entry) => {
      const item = entry as SalaryAdvance['activity'][number] & { _id?: string; actorName?: string; actorId?: string }
      return { ...item, id: String(item.id || item._id || ''), actor: item.actorName || 'System', at: typeof item.at === 'string' ? item.at : new Date(String(item.at)).toISOString() }
    }),
  }
}

export type SalaryAdvanceRequestInput = {
  employeeId: string
  requestedAmount: number
  reason: string
  dateTaken: string
  proposedFrequency: AdvanceRepaymentFrequency
  proposedInstallmentAmount: number
}

export type SalaryAdvanceDecisionInput = {
  decision: 'Approved' | 'Rejected'
  note: string
  amount?: number
  frequency?: AdvanceRepaymentFrequency
  installmentAmount?: number
}

export type LegacySalaryAdvanceImportRecord = Pick<
  SalaryAdvance,
  | 'id'
  | 'reference'
  | 'employeeId'
  | 'employeeNumber'
  | 'employeeName'
  | 'department'
  | 'role'
  | 'category'
  | 'paymentFrequency'
  | 'requestedAmount'
  | 'reason'
  | 'dateTaken'
  | 'requestedAt'
  | 'proposedFrequency'
  | 'proposedInstallmentAmount'
  | 'status'
  | 'approvedAmount'
  | 'approvedFrequency'
  | 'approvedInstallmentAmount'
  | 'dateApproved'
  | 'disbursement'
  | 'schedule'
  | 'repayments'
>

export type LegacySalaryAdvanceImportPreview = {
  records: Array<{
    index: number
    reference: string
    employeeName?: string
    employeeMatched: boolean
    importable: boolean
    duplicate: boolean
    reason: string
  }>
  importableCount: number
  duplicateCount: number
}

export function previewLegacySalaryAdvances(advances: LegacySalaryAdvanceImportRecord[]) {
  return request<LegacySalaryAdvanceImportPreview>('/salary-advances/legacy-import/preview', {
    method: 'POST',
    body: JSON.stringify({ advances }),
  })
}

export function importLegacySalaryAdvances(advances: LegacySalaryAdvanceImportRecord[]) {
  return request<{ imported: SalaryAdvance[]; skipped: Array<{ index: number; reference: string; reason: string }> }>('/salary-advances/legacy-import', {
    method: 'POST',
    body: JSON.stringify({ advances }),
  })
}

export async function listSalaryAdvances(filters: { employeeId?: string; status?: string } = {}) {
  const search = new URLSearchParams()
  if (filters.employeeId) search.set('employeeId', filters.employeeId)
  if (filters.status) search.set('status', filters.status)
  const suffix = search.size ? `?${search.toString()}` : ''
  const result = await request<{ advances: SalaryAdvance[] }>(`/salary-advances${suffix}`)
  return { advances: result.advances.map(normalizeSalaryAdvance) }
}

export async function createSalaryAdvance(input: SalaryAdvanceRequestInput) {
  const result = await request<{ advance: SalaryAdvance }>('/salary-advances', { method: 'POST', body: JSON.stringify(input) })
  return normalizeSalaryAdvance(result.advance)
}

export async function decideSalaryAdvanceHr(id: string, input: SalaryAdvanceDecisionInput) {
  const result = await request<{ advance: SalaryAdvance }>(`/salary-advances/${encodeURIComponent(id)}/hr-decision`, { method: 'POST', body: JSON.stringify(input) })
  return normalizeSalaryAdvance(result.advance)
}

export async function decideSalaryAdvanceGeneralManager(id: string, input: SalaryAdvanceDecisionInput) {
  const result = await request<{ advance: SalaryAdvance }>(`/salary-advances/${encodeURIComponent(id)}/gm-decision`, { method: 'POST', body: JSON.stringify(input) })
  return normalizeSalaryAdvance(result.advance)
}

export async function recordSalaryAdvanceDisbursement(id: string, input: { amount: number; date: string; method: Exclude<AdvanceRepaymentMethod, 'Payroll'>; reference?: string }) {
  const result = await request<{ advance: SalaryAdvance }>(`/salary-advances/${encodeURIComponent(id)}/disbursement`, { method: 'POST', body: JSON.stringify(input) })
  return normalizeSalaryAdvance(result.advance)
}

export async function recordSalaryAdvanceRepayment(id: string, input: { amount: number; date: string; method: Exclude<AdvanceRepaymentMethod, 'Payroll'>; reference?: string; note?: string }) {
  const result = await request<{ advance: SalaryAdvance }>(`/salary-advances/${encodeURIComponent(id)}/repayments`, { method: 'POST', body: JSON.stringify(input) })
  return normalizeSalaryAdvance(result.advance)
}

export function uploadSalaryAdvanceAttachment(id: string, file: File) {
  const body = new FormData()
  body.set('file', file)
  return request<{ attachment: SalaryAdvance['attachments'][number] }>(`/salary-advances/${encodeURIComponent(id)}/attachments`, { method: 'POST', body })
}

export function removeSalaryAdvanceAttachment(id: string, attachmentId: string) {
  return request<{ removed: boolean }>(`/salary-advances/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}`, { method: 'DELETE' })
}

export function getSalaryAdvanceAttachmentDownload(id: string, attachmentId: string) {
  return request<{ url: string; expiresInSeconds: number }>(`/salary-advances/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}/download`)
}

export function recordPayrollSalaryAdvanceRepayments(input: { payrollRunId: string; payslipId: string; employeeId: string; periodEnd: string }) {
  return request<{ repayments: Array<{ advanceId: string; advanceReference: string; amount: number; date: string; method: 'Payroll'; id: string; idempotent: boolean }>; idempotent: boolean }>('/salary-advances/payroll-repayments', { method: 'POST', body: JSON.stringify(input) })
}

export type PayrollRunFilters = {
  runType?: PayrollRunType
  status?: PayrollRun['status']
  periodStart?: string
  periodEnd?: string
  limit?: number
}

export function getPayrollPolicy() {
  return request<{ policy: PayrollPolicy }>('/payroll/policy')
}

export function updatePayrollPolicy(policy: Omit<PayrollPolicy, 'updatedAt' | 'updatedByName'>) {
  return request<{ policy: PayrollPolicy }>('/payroll/policy', { method: 'PUT', body: JSON.stringify(policy) })
}

export async function listPayrollRuns(filters: PayrollRunFilters = {}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries({ limit: 100, ...filters })) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  return request<{ runs: PayrollRun[] }>(`/payroll/runs?${params}`)
}

export async function listExpenses(filters: ExpenseFilters = {}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries({ limit: 100, ...filters })) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  return request<{ expenses: ExpenseRecord[]; nextCursor: string | null }>(`/expenses?${params}`)
}

export function getExpense(id: string) {
  return request<{ expense: ManualExpense; events: ExpenseEvent[] }>(`/expenses/${encodeURIComponent(id)}`)
}

export function createExpense(input: CreateExpenseInput) {
  return request<{ expense: ManualExpense }>('/expenses', { method: 'POST', body: JSON.stringify(input) })
}

export function decideExpense(id: string, input: { decision: 'Approved' | 'Rejected'; note: string }) {
  return request<{ expense: ManualExpense }>(`/expenses/${encodeURIComponent(id)}/decision`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function recordExpensePayment(id: string, input: {
  amount: number
  date: string
  method: 'Cash' | 'Bank transfer' | 'Mobile Money' | 'Cheque'
  reference: string
  note: string
}) {
  return request<{ expense: ManualExpense }>(`/expenses/${encodeURIComponent(id)}/payments`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function uploadExpenseAttachment(id: string, receipt: File) {
  const body = new FormData()
  body.set('receipt', receipt)
  return request<{ expense: ManualExpense }>(`/expenses/${encodeURIComponent(id)}/attachments`, {
    method: 'POST',
    body,
  })
}

export function removeExpenseAttachment(id: string, attachmentId: string) {
  return request<{ expense: ManualExpense }>(
    `/expenses/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}`,
    { method: 'DELETE' },
  )
}

export function getExpenseAttachmentDownload(id: string, attachmentId: string) {
  return request<{ url: string; expiresInSeconds: number }>(
    `/expenses/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}/download`,
  )
}

export function importLegacyExpenses(expenses: unknown[]) {
  return request<{ imported: ManualExpense[]; duplicates: number; rejected: Array<{ index: number; reason: string }> }>(
    '/expenses/legacy-import',
    { method: 'POST', body: JSON.stringify({ expenses }) },
  )
}

export function getPayrollRun(id: string) {
  return request<{ run: PayrollRun }>(`/payroll/runs/${encodeURIComponent(id)}`)
}

export function createPayrollRun(input: { runType: PayrollRunType; periodStart: string; periodEnd: string }) {
  return request<{ run: PayrollRun }>('/payroll/runs', { method: 'POST', body: JSON.stringify(input) })
}

export function recalculatePayrollRun(id: string) {
  return request<{ run: PayrollRun }>(`/payroll/runs/${encodeURIComponent(id)}/recalculate`, { method: 'POST', body: '{}' })
}

export function submitPayrollRun(id: string) {
  return request<{ run: PayrollRun }>(`/payroll/runs/${encodeURIComponent(id)}/submit`, { method: 'POST', body: '{}' })
}

export function decidePayrollRun(id: string, input: { decision: 'Approved' | 'Returned'; note: string }) {
  return request<{ run: PayrollRun }>(`/payroll/runs/${encodeURIComponent(id)}/decision`, { method: 'POST', body: JSON.stringify(input) })
}

export function recordPayrollCashPayment(id: string, input: { date: string; reference: string; note: string }) {
  return request<{ run: PayrollRun }>(`/payroll/runs/${encodeURIComponent(id)}/payment`, { method: 'POST', body: JSON.stringify(input) })
}

export function closePayrollAttendancePeriod(input: { periodStart: string; periodEnd: string; confirmedComplete: true }) {
  return request<{ period: { periodStart: string; periodEnd: string; status: 'Closed'; closedAt: string; closedByName: string } }>('/payroll/attendance-periods', { method: 'POST', body: JSON.stringify(input) })
}

export function getPayrollAttendancePeriod(periodStart: string, periodEnd: string) {
  return request<{ period: { periodStart: string; periodEnd: string; status: 'Closed' | 'Reopened'; closedAt: string; closedByName: string; reopenReason: string } | null }>(
    `/payroll/attendance-periods/${encodeURIComponent(periodStart)}/${encodeURIComponent(periodEnd)}`,
  )
}

export function reopenPayrollAttendancePeriod(periodStart: string, periodEnd: string, reason: string) {
  return request<{ period: { periodStart: string; periodEnd: string; status: 'Reopened'; reopenReason: string } }>(
    `/payroll/attendance-periods/${encodeURIComponent(periodStart)}/${encodeURIComponent(periodEnd)}/reopen`,
    { method: 'POST', body: JSON.stringify({ reason }) },
  )
}

export function listEmployeePayslips(employeeId: string) {
  return request<{ payslips: Array<{ run: PayrollRun; payslip: PayrollRun['payslips'][number] }> }>(
    `/payroll/employees/${encodeURIComponent(employeeId)}/payslips`,
  )
}

export function signIn(email: string, password: string) {
  return request<{ user: UserAccount; session: ActiveSession }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export async function getCurrentSession(): Promise<{ user: UserAccount; session: ActiveSession } | null> {
  try {
    return await request<{ user: UserAccount; session: ActiveSession }>('/auth/session')
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
}

export function getDashboardSummary(from: string, to: string) {
  const params = new URLSearchParams({ from, to })
  return request<DashboardSummary>(`/dashboard/summary?${params}`)
}

export function signOut() {
  return request<void>('/auth/logout', { method: 'POST' })
}

export function changePassword(currentPassword: string, newPassword: string) {
  return request<{ user: UserAccount; session: ActiveSession }>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
}

export function reportSessionActivity() {
  return request<{ session: ActiveSession }>('/sessions/activity', { method: 'POST' })
}

export function listActiveSessions(userId?: string) {
  const path = userId
    ? `/sessions/users/${encodeURIComponent(userId)}`
    : '/sessions'
  return request<{ sessions: ActiveSession[] }>(path)
}

export function revokeActiveSession(sessionId: string) {
  return request<void>(`/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' })
}

export function getSessionProtectionSettings() {
  return request<{ sessionProtection: SessionProtectionSettings }>('/security-settings')
}

export function updateSessionProtectionSettings(settings: SessionProtectionSettings) {
  return request<{ sessionProtection: SessionProtectionSettings }>('/security-settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  })
}

export function listAuditEvents(filters: AuditFilters = {}) {
  const { targetUserId, ...query } = filters
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') {
      params.set(key, Array.isArray(value) ? value.join(',') : String(value))
    }
  }
  const suffix = params.size ? `?${params.toString()}` : ''
  const path = targetUserId
    ? `/audit/users/${encodeURIComponent(targetUserId)}${suffix}`
    : `/audit${suffix}`
  return request<{ events: AuditEvent[]; nextCursor: string | null }>(path)
}

export async function listAuditEventTypes() {
  return request<{ eventTypes: string[]; resourceTypes: string[]; categories: string[] }>('/audit/event-types')
}

export async function listUsers() {
  const result = await request<{ users: UserAccount[] }>('/users')
  return result.users
}

export function createUser(input: { name: string; email: string; password: string; roles: UserRole[] }) {
  return request<{ user: UserAccount }>('/users', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateUser(id: string, input: { name: string; email: string; roles: UserRole[] }) {
  return request<{ user: UserAccount }>(`/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function updateUserStatus(id: string, status: AccountStatus, suspensionReason?: string) {
  return request<{ user: UserAccount }>(`/users/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, suspensionReason }),
  })
}

export function resetUserPassword(id: string) {
  return request<{ temporaryPassword: string; expiresAt: string; message: string }>(
    `/users/${encodeURIComponent(id)}/reset-password`,
    { method: 'POST' },
  )
}
