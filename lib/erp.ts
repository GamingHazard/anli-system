export type Status = 'Paid' | 'Pending' | 'Overdue' | 'Approved' | 'Draft' | 'Active' | 'Inactive'

export type SaleLine = { productId: string; productCode: string; productName: string; packType: 'Box' | 'Carton'; piecesPerPack: number; packs: number; quantityPieces: number; catalogPricePerPack: number; pricePerPack: number; overrideReason?: string; lineTotal: number }
export type SalePartySnapshot = { name: string; contact?: string; phone?: string; email?: string; address?: string; tin?: string }
export type SaleCompanySnapshot = { name: string; email?: string; phone?: string; address?: string; logoUrl?: string }
export type Sale = { id: string; date: string; customer: string; customerId?: string; assignedTo?: string | null; product: string; quantity: number; total: number; status: 'Paid' | 'Pending'; method: string; txnID?: string; paymentTerms?: 'Paid now' | 'Same-day' | 'Credit'; dueDate?: string; creditNeedsReview?: boolean; reference: string; receiptNumber?: string; lines?: SaleLine[]; customerSnapshot?: SalePartySnapshot; companySnapshot?: SaleCompanySnapshot; paidAmount?: number; payments?: SalePayment[]; legacyImported?: boolean }
export type SalePayment = { id: string; saleId: string; paymentReceiptNumber?: string; amount: number; date: string; method: 'Cash' | 'Mobile Money' | 'Bank Transfer' | 'Check' | 'Card' | 'Legacy'; txnID?: string; note?: string; recordedAt: string }
export type ManagedReceipt = {
  id: string
  kind: 'sale' | 'credit-payment'
  receiptNumber: string
  date: string
  amount: number
  customer: SalePartySnapshot
  company: SaleCompanySnapshot
  lines: SaleLine[]
  payments?: Array<{ receiptNumber: string; date: string; amount: number; method: string; txnID?: string }>
  saleReceiptNumber?: string
  saleId: string
  payment?: { amount: number; method: string; txnID?: string; note?: string }
  total?: number
  paidAmount?: number
  balance?: number
  isFavorite: boolean
  isArchived: boolean
  archivedAt?: string | null
}
export type ReceiptStats = { count: number; totalAmount: number; totalPaid: number; outstanding: number }
export type InvoiceStatus = 'Draft' | 'Ready to submit' | 'Submitted' | 'Issued' | 'Failed' | 'Cancelled' | 'Credit note'
export type InvoiceLine = { id: string; description: string; quantity: number; unitPrice: number; lineTotal: number; taxCategory?: string; taxRate?: number; taxAmount?: number }
export type InvoicePartySnapshot = { name: string; tin?: string; email?: string; phone?: string; address?: string; logoUrl?: string }
export type InvoiceEvent = { id: string; type: string; at: string; actor: string; note?: string }
export type Invoice = {
  id: string; invoiceNumber: string; saleId: string; saleReference: string; status: InvoiceStatus
  issueDate: string; dueDate?: string; currency: 'UGX'; paymentTerms: string
  seller: InvoicePartySnapshot; buyer: InvoicePartySnapshot; lines: InvoiceLine[]
  subtotal: number; taxTotal?: number; total: number
  uraReference?: string; verificationUrl?: string; qrCodeData?: string
  events: InvoiceEvent[]; createdAt: string; updatedAt: string
}
export type OrderStatus = 'Pending' | 'Confirmed' | 'In progress' | 'Ready' | 'Completed' | 'Cancelled'
export type OrderItem = { id: string; product: string; quantity: number; unitPrice: number; lineTotal: number; productId?: string; productCode?: string; packType?: 'Box' | 'Carton'; piecesPerPack?: number; overrideReason?: string }
export type OrderStatusChange = { status: OrderStatus; at: string; type?: string; actor?: string; reason?: string }
export type Order = {
  id: string
  reference: string
  orderNumber?: string
  date: string
  createdAt: string
  customer: string
  customerId?: string
  items: OrderItem[]
  total: number
  requestedDate: string
  fulfilmentMethod: 'Delivery' | 'Pickup'
  destination: string
  paymentTerms: 'Paid now' | 'Same-day' | 'Credit'
  dueDate?: string
  status: OrderStatus
  statusHistory: OrderStatusChange[]
  completedAt?: string
  priority: 'Normal' | 'High'
  priorityReason?: string
  archivedAt?: string
  notes: string
  paidAmount?: number
  reserved?: boolean
  saleId?: string
  legacyImported?: boolean
}
export type EmployeeCategory = 'Staff employee' | 'Casual worker' | 'Other' | 'Staff' | 'Casual'
export type EmployeeDocument = { id?: string; title: string; url: string; publicId?: string; download_Url: string; fileName?: string; uploadedAt?: string }
export type EmployeeParent = { name: string; phone: string; address: string; status: 'Alive' | 'Deceased' | '' }
export type Employee = {
  id: string
  userId?: string | null
  supervisorUserId?: string | null
  name: string
  number: string
  firstName?: string
  secondName?: string
  otherNames?: string
  dateOfBirth?: string
  gender?: string
  maritalStatus?: string
  spouseName?: string
  spousePhone?: string
  childrenCount?: number
  educationLevel?: string
  profession?: string
  phone?: string
  email?: string
  currentAddress?: string
  placeOfOrigin?: string
  nextOfKinName?: string
  nextOfKinRelationship?: string
  nextOfKinPhone?: string
  nextOfKinAddress?: string
  mother?: EmployeeParent
  father?: EmployeeParent
  category: EmployeeCategory
  department: string
  role: string
  status: 'Active' | 'Inactive'
  salary: number
  compensationType?: 'Salary earner' | 'Wage earner'
  paymentFrequency?: 'Monthly' | 'Weekly'
  nssfNumber?: string
  tinNumber?: string
  nssfApplies?: boolean
  taxApplies?: boolean
  photoUrl?: string
  image?: { url: string; publicId: string }
  documents?: EmployeeDocument[]
  notes?: string
}
export type EmployeeDraft = {
  id: string
  employee: Partial<Employee>
  currentStep: number
  updatedAt: string
}
export type AttendanceStatus = 'Present' | 'Absent' | 'On leave' | 'Unmarked'
export type AttendanceRecord = {
  id: string
  employeeId: string
  workDate: string
  status: AttendanceStatus
  halfDay: boolean
  late: boolean
  checkIn?: string
  checkOut?: string
  note?: string
  updatedAt: string
}
export type LeaveType = 'Annual' | 'Sick' | 'Maternity/Paternity' | 'Compassionate' | 'Other'
export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled'
export type LeaveDecision = { id: string; decision: 'Approved' | 'Rejected' | 'Cancelled'; actor: string; at: string; note?: string }
export type LeaveRequest = {
  id: string
  reference: string
  employeeId: string
  employeeName: string
  employeeNumber: string
  department: string
  role: string
  employeeContact: string
  leaveType: LeaveType
  otherLeaveType?: string
  reason: string
  startDate: string
  endDate: string
  requestedDays: number
  handoverEmployeeId: string
  handoverName: string
  handoverContact: string
  requesterUserId?: string
  approverUserId?: string
  handoverUserId?: string | null
  returnConfirmation?: { expectedDate?: string; actualDate?: string; confirmedBy?: string; confirmedAt?: string }
  amendments?: Array<{
    id: string
    startDate: string
    endDate: string
    requestedDays: number
    reason: string
    status: 'Pending' | 'Approved' | 'Rejected'
    requestedBy: string
    requestedAt: string
    decidedBy?: string
    decidedAt?: string
    decisionNote?: string
  }>
  status: LeaveStatus
  requestedAt: string
  updatedAt: string
  decisions: LeaveDecision[]
}
export type PayrollFrequency = 'Monthly' | 'Weekly'
export type PayrollRunStatus = 'Draft' | 'In review' | 'Approved' | 'Paid'
export type PayrollReviewStatus = 'Needs review' | 'Ready'
export type PayrollPaymentStatus = 'Unpaid' | 'Paid'
export type PayrollLineItem = { id: string; label: string; amount?: number; source?: 'Salary advance' }
export type PayrollPayslipSnapshot = {
  id: string
  employeeId: string
  employeeNumber: string
  employeeName: string
  category: EmployeeCategory
  department: string
  role: string
  compensationType?: Employee['compensationType']
  paymentFrequency: PayrollFrequency
  configuredRate?: number
  attendanceUnits?: number
  earnings: PayrollLineItem[]
  deductions: PayrollLineItem[]
  grossPay?: number
  deductionTotal?: number
  netPay?: number
  reviewStatus: PayrollReviewStatus
  paymentStatus: PayrollPaymentStatus
}
export type PayrollRun = {
  id: string
  reference: string
  frequency: PayrollFrequency
  periodStart: string
  periodEnd: string
  status: PayrollRunStatus
  createdAt: string
  updatedAt: string
  createdBy?: string
  approvedAt?: string
  approvedBy?: string
  approvalNote?: string
  paidAt?: string
  notes?: string
  payslips: PayrollPayslipSnapshot[]
}
export type AdvanceStatus = 'Pending HR review' | 'Pending GM review' | 'Pending review' | 'Approved' | 'Rejected' | 'Active' | 'Settled' | 'Legacy archive'
export type AdvanceRepaymentFrequency = 'Weekly' | 'Monthly'
export type AdvanceRepaymentMethod = 'Cash' | 'Mobile Money' | 'Bank Transfer' | 'Payroll'
export type AdvanceScheduleEntry = { id: string; dueDate: string; plannedAmount: number }
export type AdvanceRepayment = { id: string; date: string; amount: number; method: AdvanceRepaymentMethod; reference?: string; note?: string; recordedAt: string; scheduleEntryIds?: string[]; payrollRunId?: string; payslipId?: string }
export type AdvanceActivity = { id: string; action: string; actor: string; at: string; note?: string }
export type AdvanceDecision = { decision: 'Approved' | 'Rejected'; actorId: string; actorName: string; role: 'Human Resource' | 'General Manager'; note?: string; amount?: number; frequency?: AdvanceRepaymentFrequency; installmentAmount?: number; decidedAt: string; legacy?: boolean }
export type AdvanceAttachment = { id: string; name: string; url?: string; publicId?: string; resourceType?: 'image' | 'raw'; dataUrl?: string; mediaType: string; sizeBytes: number; uploadedAt?: string }
export type SalaryAdvance = {
  id: string
  reference: string
  employeeId: string
  employeeNumber: string
  employeeName: string
  department: string
  role: string
  category: EmployeeCategory
  paymentFrequency?: Employee['paymentFrequency']
  requestedAmount: number
  reason: string
  dateTaken: string
  dateApproved?: string
  attachments: AdvanceAttachment[]
  requestedAt: string
  proposedFrequency: AdvanceRepaymentFrequency
  proposedInstallmentAmount: number
  status: AdvanceStatus
  approvedAmount?: number
  approvedFrequency?: AdvanceRepaymentFrequency
  approvedInstallmentAmount?: number
  decisionAt?: string
  decisionBy?: string
  hrDecision?: AdvanceDecision
  gmDecision?: AdvanceDecision
  rejectionReason?: string
  disbursement?: { amount: number; date: string; method: Exclude<AdvanceRepaymentMethod, 'Payroll'>; reference?: string; recordedAt: string; recordedBy?: string }
  schedule: AdvanceScheduleEntry[]
  repayments: AdvanceRepayment[]
  activity: AdvanceActivity[]
  legacyUnverified?: boolean
  legacyStatus?: string
  legacyReference?: string
  createdAt: string
  updatedAt: string
}
export type ExpenseAttachment = { id: string; name: string; dataUrl: string; mediaType: string; sizeBytes: number }
export type ExpenseStatus = 'Pending approval' | 'Approved' | 'Rejected' | 'Paid' | 'Pending'
export type ExpenseDecision = { id: string; decision: 'Approved' | 'Rejected'; actor: string; at: string; note?: string }
export type UgandaTaxType = 'Value Added Tax (VAT) - non-recoverable input tax' | 'Corporation tax' | 'Presumptive tax' | 'Pay As You Earn (PAYE)' | 'Withholding tax' | 'Excise duty' | 'Import / customs duty' | 'Stamp duty' | 'Local Service Tax (LST)' | 'Property rates' | 'Tax penalty or interest' | 'Other tax'
export type Expense = { id: string; reference: string; category: string; description: string; amount: number; date: string; status: ExpenseStatus; department: string; expenseType?: 'Supplier bill' | 'Employee reimbursement' | 'Petty cash / other'; payee?: string; taxType?: UgandaTaxType; attachments?: ExpenseAttachment[]; requestedBy?: string; createdAt?: string; decisions?: ExpenseDecision[]; rejectionReason?: string }
export type Customer = {
  id: string
  name: string
  type: string
  contact?: string
  phone: string
  email: string
  region?: string
  district?: string
  tin?: string
  country?: string
  referredBy?: string
  createdAt?: string
  notes?: string
  archivedAt?: string
  status: 'Active' | 'Inactive' | 'Suspended'
  purchases: number
}
export type RawMaterial = { id: string; code: string; name: string; category: string; quantity: number; unit: string; threshold: number; cost: number; location: string }
export type RecipeIngredient = { materialId: string; quantityPerTank: number }
export type ProductionRecipe = { id: string; productName: string; tankUnit: string; ingredients: RecipeIngredient[]; createdAt: string; updatedAt: string }
export type ProductionRunLine = { materialId: string; materialName: string; quantityPerTank: number; totalQuantity: number; unit: string }
export type ProductionRun = { id: string; reference: string; recipeId: string; productId?: string; productName: string; productUnit?: string; productionDate: string; tankCount: number; producedQuantity?: number; openingStock?: number; salesQuantity?: number; damagedQuantity?: number; closingStock?: number; damageReason?: string; salesSource: 'Manual'; location: string; lines: ProductionRunLine[]; recordedAt: string; actor: string }
export type FinishedProduct = { id: string; code: string; name: string; category: string; unit: string; flavour?: 'Mango' | 'Pineapple milk'; packType?: 'Box' | 'Carton'; piecesPerPack?: number; packWeightKg?: number; price?: number; recipeId?: string; recipeRequired: boolean; active: boolean; createdAt: string; updatedAt: string }
export type FinishedStockMovementType = 'Opening balance' | 'Production' | 'Sales dispatch' | 'Damage/write-off' | 'Internal use/sample' | 'Transfer in' | 'Transfer out' | 'Other stock in' | 'Adjustment increase' | 'Adjustment decrease'
export type FinishedStockMovement = { id: string; reference: string; productId: string; type: FinishedStockMovementType; quantity: number; date: string; recordedAt: string; reason?: string; note?: string; actor: string }
export type AssetCategory = 'Office assets' | 'Vehicles' | 'Production assets' | 'Store' | 'Machinery' | 'Others'
export type AssetCondition = 'Good' | 'Fair' | 'Needs repair' | 'Unserviceable'
export type AssetStatus = 'Active' | 'Under maintenance' | 'Disposed'
export type CompanyAsset = {
  id: string; assetTag: string; name: string; category: AssetCategory; assetType?: string
  makeModel?: string; serialNumber?: string; registration?: string; vin?: string; mileage?: number
  capacity?: string; productionLine?: string; serviceInterval?: string
  acquisitionDate?: string; acquisitionCost?: number; supplier?: string; warrantyEnd?: string
  location: string; assignee?: string; department?: string; condition: AssetCondition; status: AssetStatus
  conditionNotes?: string; nextInspectionDate?: string; nextServiceDate?: string; insuranceDueDate?: string
  notes?: string; photos?: Array<{ id: string; url: string; filename?: string; uploadedAt?: string }>
  createdAt: string; updatedAt: string
}
export type AssetEventType = 'Acquired' | 'Inspection' | 'Transfer' | 'Assignment' | 'Maintenance' | 'Maintenance completed' | 'Profile correction' | 'Status change' | 'Disposed'
export type AssetEvent = {
  id: string; assetId: string; type: AssetEventType; date: string; recordedAt: string; actor: string
  title?: string; description?: string
  reference?: string; fromLocation?: string; toLocation?: string; fromAssignee?: string; toAssignee?: string
  previousCondition?: AssetCondition; newCondition?: AssetCondition; previousStatus?: AssetStatus; newStatus?: AssetStatus
  reason?: string; note?: string; provider?: string; cost?: number; nextInspectionDate?: string; nextServiceDate?: string
}
export type StockMovementType = 'Opening balance' | 'Stock in' | 'Stock out' | 'Production use' | 'Transfer' | 'Adjustment increase' | 'Adjustment decrease'
export type StockMovement = { id: string; reference: string; receiptReference?: string; productionRunId?: string; materialId: string; type: StockMovementType; quantity: number; unit: string; date: string; recordedAt: string; fromLocation?: string; toLocation?: string; supplier?: string; sourceReference?: string; unitCost?: number; reason?: string; actor: string }
export type Activity = { id: string; action: string; module: string; actor: string; time: string; outcome: 'Success' | 'Review' }
export type CompanyProfile = {
  legalName: string; tradingName: string; email: string; phone: string; website: string
  addressLine1: string; addressLine2: string; city: string; region: string; postalCode: string; country: string
  tin: string; registrationNumber: string; registrationAuthority: string
  logo: { url: string; publicId: string }
}
export type ErpState = { sales: Sale[]; invoices: Invoice[]; payments: SalePayment[]; orders: Order[]; employees: Employee[]; employeeDrafts: EmployeeDraft[]; attendanceRecords: AttendanceRecord[]; leaveRequests: LeaveRequest[]; payrollRuns: PayrollRun[]; salaryAdvances: SalaryAdvance[]; expenses: Expense[]; customers: Customer[]; materials: RawMaterial[]; stockMovements: StockMovement[]; productionRecipes: ProductionRecipe[]; productionRuns: ProductionRun[]; finishedProducts: FinishedProduct[]; finishedStockMovements: FinishedStockMovement[]; assets: CompanyAsset[]; assetEvents: AssetEvent[]; companyProfile: CompanyProfile; activities: Activity[] }

export const emptyCompanyProfile: CompanyProfile = {
  legalName: '', tradingName: '', email: '', phone: '', website: '', addressLine1: '', addressLine2: '',
  city: '', region: '', postalCode: '', country: '', tin: '', registrationNumber: '', registrationAuthority: '',
  logo: { url: '', publicId: '' },
}

const normalizeCompanyProfile = (value: unknown): CompanyProfile => {
  const profile = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const logo = profile.logo && typeof profile.logo === 'object'
    ? profile.logo as Record<string, unknown>
    : {}
  const textFields = Object.keys(emptyCompanyProfile).filter((key) => key !== 'logo')
  return {
    ...Object.fromEntries(textFields.map((key) => [
      key,
      typeof profile[key] === 'string' ? profile[key] : '',
    ])),
    logo: {
      url: typeof logo.url === 'string' ? logo.url : '',
      publicId: typeof logo.publicId === 'string' ? logo.publicId : '',
    },
  } as CompanyProfile
}

export const createInvoiceDraft = (sale: Sale, customer: Customer | undefined, profile: CompanyProfile): Invoice => {
  const now = new Date().toISOString()
  const quantity = Math.max(1, Number(sale.quantity) || 1)
  const unitPrice = sale.total / quantity
  const seller = createInvoiceSellerSnapshot(profile)
  const buyerAddress = [customer?.district, customer?.region, customer?.country].filter(Boolean).join(', ')
  const lines = sale.lines?.length
    ? sale.lines.map((line, index) => ({
        id: `${sale.id}-LINE-${index + 1}`,
        description: `${line.productName} · ${line.packs} ${line.packType.toLowerCase()}${line.packs === 1 ? '' : 's'}`,
        quantity: line.packs,
        unitPrice: line.pricePerPack,
        lineTotal: line.lineTotal,
      }))
    : [{ id: `${sale.id}-LINE-1`, description: sale.product, quantity, unitPrice, lineTotal: sale.total }]
  return {
    id: `INV-${sale.id}`,
    invoiceNumber: `INV-${sale.id}`,
    saleId: sale.id,
    saleReference: sale.reference,
    status: 'Draft',
    issueDate: sale.date,
    dueDate: sale.dueDate,
    currency: 'UGX',
    paymentTerms: sale.paymentTerms || 'Same-day',
    seller,
    buyer: { name: sale.customer, tin: customer?.tin || undefined, email: customer?.email || undefined, phone: customer?.phone || undefined, address: buyerAddress || undefined },
    lines,
    subtotal: sale.total,
    total: sale.total,
    events: [{ id: `${sale.id}-INVOICE-DRAFT`, type: 'Draft created', at: now, actor: 'System', note: 'Automatic invoice draft created from sale.' }],
    createdAt: now,
    updatedAt: now,
  }
}

export const createInvoiceSellerSnapshot = (profile: CompanyProfile): InvoicePartySnapshot => {
  const sellerName = profile.legalName || profile.tradingName || ''
  const address = [profile.addressLine1, profile.addressLine2, profile.city, profile.region, profile.country].filter(Boolean).join(', ')
  return {
    name: sellerName,
    tin: profile.tin || undefined,
    email: profile.email || undefined,
    phone: profile.phone || undefined,
    address: address || undefined,
    logoUrl: profile.logo.url || undefined,
  }
}

const daysAgo = (days: number) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
const daysFromNow = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
const seedMaterials: RawMaterial[] = [
  { id: 'RM-001', code: 'RM-MZ-01', name: 'Maize grain', category: 'Grains', quantity: 2840, unit: 'kg', threshold: 1000, cost: 1250, location: 'Main Warehouse' },
  { id: 'RM-002', code: 'RM-PK-02', name: 'Packaging bags', category: 'Packaging', quantity: 620, unit: 'pcs', threshold: 800, cost: 420, location: 'Packaging Store' },
  { id: 'RM-003', code: 'RM-WH-03', name: 'Wheat grain', category: 'Grains', quantity: 1640, unit: 'kg', threshold: 900, cost: 1850, location: 'Main Warehouse' },
  { id: 'RM-004', code: 'RM-SG-04', name: 'Sugar', category: 'Ingredients', quantity: 410, unit: 'kg', threshold: 500, cost: 2900, location: 'Ingredients Store' },
]
const seedOpeningMovements: StockMovement[] = seedMaterials.map((material) => ({
  id: `OPEN-${material.id}`, reference: `OPEN-${material.code}`, materialId: material.id,
  type: 'Opening balance', quantity: material.quantity, unit: material.unit, date: daysAgo(0),
  recordedAt: `${daysAgo(0)}T09:00:00.000Z`, toLocation: material.location,
  unitCost: material.cost, reason: 'Opening stock from initial inventory', actor: 'System',
}))
export const seedState: ErpState = {
  companyProfile: { ...emptyCompanyProfile },
  invoices: [],
  orders: [
    { id: 'ORD-1008', reference: 'ORD-1008', date: daysAgo(0), createdAt: `${daysAgo(0)}T09:00:00.000Z`, customer: 'Nile Foods Ltd', items: [{ id: 'ORD-1008-1', product: 'Wheat Flour 25kg', quantity: 36, unitPrice: 80000, lineTotal: 2880000 }], total: 2880000, requestedDate: daysAgo(0), fulfilmentMethod: 'Delivery', destination: 'Next wholesale run', paymentTerms: 'Credit', status: 'Pending', statusHistory: [{ status: 'Pending', at: `${daysAgo(0)}T09:00:00.000Z` }], priority: 'High', priorityReason: 'Customer requested urgent dispatch.', notes: 'Deliver with the next wholesale run.' },
    { id: 'ORD-1007', reference: 'ORD-1007', date: daysAgo(2), createdAt: `${daysAgo(2)}T09:00:00.000Z`, customer: 'Kampala Fresh Mart', items: [{ id: 'ORD-1007-1', product: 'Premium Maize Flour', quantity: 60, unitPrice: 45000, lineTotal: 2700000 }], total: 2700000, requestedDate: daysAgo(2), fulfilmentMethod: 'Delivery', destination: 'Customer requested delivery before Friday.', paymentTerms: 'Same-day', status: 'Confirmed', statusHistory: [{ status: 'Confirmed', at: `${daysAgo(2)}T09:00:00.000Z` }], priority: 'Normal', notes: 'Customer requested delivery before Friday.' },
    { id: 'ORD-1006', reference: 'ORD-1006', date: daysAgo(5), createdAt: `${daysAgo(5)}T09:00:00.000Z`, customer: 'Acacia Hotels', items: [{ id: 'ORD-1006-1', product: 'Rice 50kg', quantity: 20, unitPrice: 90000, lineTotal: 1800000 }], total: 1800000, requestedDate: daysAgo(5), fulfilmentMethod: 'Pickup', destination: '', paymentTerms: 'Paid now', status: 'Pending', statusHistory: [{ status: 'Pending', at: `${daysAgo(5)}T09:00:00.000Z` }], priority: 'Normal', notes: 'Awaiting confirmation of quantities.' },
  ],
  sales: [
    { id: 'S-1048', reference: 'SAL-1048', date: daysAgo(0), customer: 'Kampala Fresh Mart', product: 'Premium Maize Flour', quantity: 42, total: 1890000, status: 'Paid', method: 'Mobile Money', paymentTerms: 'Same-day' },
    { id: 'S-1047', reference: 'SAL-1047', date: daysAgo(1), customer: 'Nile Foods Ltd', product: 'Wheat Flour 25kg', quantity: 18, total: 1440000, status: 'Pending', method: 'Bank Transfer', paymentTerms: 'Same-day' },
    { id: 'S-1046', reference: 'SAL-1046', date: daysAgo(2), customer: 'Acacia Hotels', product: 'Rice 50kg', quantity: 24, total: 2160000, status: 'Paid', method: 'Cash', paymentTerms: 'Same-day' },
    { id: 'S-1045', reference: 'SAL-1045', date: daysAgo(4), customer: 'Green Basket', product: 'Premium Maize Flour', quantity: 30, total: 1350000, status: 'Paid', method: 'Card', paymentTerms: 'Same-day' },
    { id: 'S-1044', reference: 'SAL-1044', date: daysAgo(8), customer: 'Kampala Fresh Mart', product: 'Sugar 25kg', quantity: 12, total: 780000, status: 'Paid', method: 'Mobile Money', paymentTerms: 'Same-day' },
    { id: 'S-1043', reference: 'SAL-1043', date: daysAgo(12), customer: 'Nile Foods Ltd', customerId: 'C-002', product: 'Wheat Flour 25kg', quantity: 25, total: 2000000, status: 'Pending', method: 'Cash', paymentTerms: 'Credit', dueDate: daysAgo(2) },
    { id: 'S-1042', reference: 'SAL-1042', date: daysAgo(3), customer: 'Acacia Hotels', customerId: 'C-003', product: 'Rice 50kg', quantity: 10, total: 900000, status: 'Pending', method: 'Cash', paymentTerms: 'Credit', dueDate: daysFromNow(4) },
  ],
  payments: [
    { id: 'PAY-1043-1', saleId: 'S-1043', amount: 500000, date: daysAgo(5), method: 'Bank Transfer', txnID: 'BNK-70421', note: 'Part payment', recordedAt: `${daysAgo(5)}T10:30:00.000Z` },
  ],
  employees: [
    { id: 'E-001', number: 'EMP-001', name: 'Sarah Namirembe', category: 'Staff', department: 'Finance', role: 'Finance Manager', status: 'Active', salary: 4200000 },
    { id: 'E-002', number: 'EMP-002', name: 'David Okello', category: 'Staff', department: 'Sales', role: 'Sales Lead', status: 'Active', salary: 3500000 },
    { id: 'E-003', number: 'EMP-003', name: 'Grace Achieng', category: 'Casual', department: 'Production', role: 'Line Operator', status: 'Active', salary: 180000 },
    { id: 'E-004', number: 'EMP-004', name: 'Michael Kato', category: 'Casual', department: 'Warehouse', role: 'Store Assistant', status: 'Active', salary: 160000 },
    { id: 'E-005', number: 'EMP-005', name: 'Peter Ssekabira', category: 'Other', department: 'Operations', role: 'Driver', status: 'Inactive', salary: 2400000 },
  ],
  employeeDrafts: [],
  attendanceRecords: [],
  leaveRequests: [],
  payrollRuns: [],
  salaryAdvances: [],
  expenses: [
    { id: 'EX-209', reference: 'EXP-209', category: 'Logistics', description: 'Delivery fuel and maintenance', amount: 680000, date: daysAgo(1), status: 'Paid', department: 'Operations' },
    { id: 'EX-208', reference: 'EXP-208', category: 'Utilities', description: 'Factory electricity', amount: 1250000, date: daysAgo(4), status: 'Pending', department: 'Production' },
    { id: 'EX-207', reference: 'EXP-207', category: 'Supplies', description: 'Packaging materials', amount: 430000, date: daysAgo(6), status: 'Paid', department: 'Production' },
    { id: 'EX-206', reference: 'EXP-206', category: 'Payroll', description: 'Casual worker wages', amount: 2100000, date: daysAgo(8), status: 'Paid', department: 'HR' },
  ],
  customers: [
    { id: 'C-001', name: 'Kampala Fresh Mart', type: 'Retail', phone: '+256 701 234 567', email: 'procurement@kfm.ug', status: 'Active', purchases: 15 },
    { id: 'C-002', name: 'Nile Foods Ltd', type: 'Wholesale', phone: '+256 772 555 019', email: 'orders@nilefoods.ug', status: 'Active', purchases: 9 },
    { id: 'C-003', name: 'Acacia Hotels', type: 'Corporate', phone: '+256 783 112 400', email: 'finance@acacia.ug', status: 'Active', purchases: 7 },
    { id: 'C-004', name: 'Green Basket', type: 'Retail', phone: '+256 709 445 201', email: 'hello@greenbasket.ug', status: 'Inactive', purchases: 4 },
  ],
  materials: seedMaterials,
  stockMovements: seedOpeningMovements,
  productionRecipes: [],
  productionRuns: [],
  finishedProducts: [],
  finishedStockMovements: [],
  assets: [],
  assetEvents: [],
  activities: [
    { id: 'A-01', action: 'Sale recorded', module: 'Sales', actor: 'Sarah Namirembe', time: '12 min ago', outcome: 'Success' },
    { id: 'A-02', action: 'Invoice INV-0091 issued', module: 'Invoicing', actor: 'David Okello', time: '38 min ago', outcome: 'Success' },
    { id: 'A-03', action: 'Expense awaiting approval', module: 'Finance', actor: 'System', time: '1 hr ago', outcome: 'Review' },
    { id: 'A-04', action: 'Stock adjustment approved', module: 'Inventory', actor: 'James Mugisha', time: '2 hrs ago', outcome: 'Success' },
  ],
}

export const cloneSeed = (): ErpState => {
  const state = JSON.parse(JSON.stringify(seedState)) as ErpState
  state.invoices = state.sales.map((sale) => createInvoiceDraft(sale, state.customers.find((customer) => customer.id === sale.customerId)
    ?? state.customers.find((customer) => customer.name.trim().toLowerCase() === sale.customer.trim().toLowerCase()), state.companyProfile))
  return state
}
export const money = (value: number) => new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(value)
export const formatDate = (date: string) => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date))
export const sum = (items: number[]) => items.reduce((total, value) => total + value, 0)
export const paidAmountForSale = (saleId: string, payments: SalePayment[]) =>
  sum(payments.filter((payment) => payment.saleId === saleId).map((payment) => payment.amount))
export const balanceForSale = (sale: Sale, payments: SalePayment[]) =>
  Math.max(0, sale.total - paidAmountForSale(sale.id, payments))
export const paymentStateForSale = (sale: Sale, payments: SalePayment[], today = new Date().toISOString().slice(0, 10)) => {
  const balance = balanceForSale(sale, payments)
  if (balance === 0) return 'Paid' as const
  const paymentState = paidAmountForSale(sale.id, payments) > 0 ? 'Partially paid' as const : 'Unpaid' as const
  return sale.dueDate && sale.dueDate < today ? `${paymentState} · Overdue` : paymentState
}
export const isWithinDays = (date: string, days: number) => (Date.now() - new Date(date).getTime()) / 86400000 <= days
export const simulate = <T,>(value: T, delay = 260) => new Promise<T>((resolve) => setTimeout(() => resolve(value), delay))
const STORAGE_KEY = 'lumina-erp-demo-v1'
const LEGACY_EMPLOYEE_IMPORT_KEY = 'lumina-erp-employee-import-v1'
const LEGACY_ATTENDANCE_KEY = 'lumina-erp-attendance-archive-v1'
const LEGACY_SALARY_ADVANCE_KEY = 'lumina-erp-salary-advance-archive-v1'
const LEGACY_LEAVE_IMPORT_KEY = 'lumina-erp-leave-import-v1'
const LEGACY_DEMO_EMPLOYEE_NUMBERS = new Set(['EMP-001', 'EMP-002', 'EMP-003', 'EMP-004', 'EMP-005'])
const LEGACY_DEMO_EMPLOYEE_IDS = new Set(['E-001', 'E-002', 'E-003', 'E-004', 'E-005'])
const preserveLegacyEmployeeData = (saved: string) => {
  try {
    if (window.localStorage.getItem(LEGACY_EMPLOYEE_IMPORT_KEY)) return
    const parsed = JSON.parse(saved) as Partial<ErpState>
    const employees = Array.isArray(parsed.employees)
      ? parsed.employees.filter((employee) => employee
        && !LEGACY_DEMO_EMPLOYEE_NUMBERS.has(String(employee.number || ''))
        && !LEGACY_DEMO_EMPLOYEE_IDS.has(String(employee.id || '')))
      : []
    const employeeDrafts = Array.isArray(parsed.employeeDrafts) ? parsed.employeeDrafts : []
    if (employees.length || employeeDrafts.length) {
      window.localStorage.setItem(LEGACY_EMPLOYEE_IMPORT_KEY, JSON.stringify({ employees, employeeDrafts }))
    }
  } catch {
    return
  }
}
const preserveLegacyAttendanceData = (saved: string) => {
  try {
    if (window.localStorage.getItem(LEGACY_ATTENDANCE_KEY)) return true
    const parsed = JSON.parse(saved) as Partial<ErpState>
    const records = normalizeAttendanceRecords(parsed.attendanceRecords)
    if (records.length) {
      window.localStorage.setItem(LEGACY_ATTENDANCE_KEY, JSON.stringify(records))
    }
    return true
  } catch {
    return false
  }
}

const preserveLegacySalaryAdvanceData = (saved: string) => {
  try {
    if (typeof window === 'undefined') return false
    if (window.localStorage.getItem(LEGACY_SALARY_ADVANCE_KEY)) return true
    const parsed = JSON.parse(saved) as Partial<ErpState>
    if (!Array.isArray(parsed.salaryAdvances) || !parsed.salaryAdvances.length) return false
    window.localStorage.setItem(LEGACY_SALARY_ADVANCE_KEY, JSON.stringify({
      advances: parsed.salaryAdvances,
      preservedAt: new Date().toISOString(),
      importedAt: null,
    }))
    return true
  } catch {
    console.error('Could not retain the previous browser salary-advance snapshot.')
    return false
  }
}

export const getLegacySalaryAdvanceImport = (): { advances: SalaryAdvance[]; preservedAt: string; importedAt: string | null } | null => {
  if (typeof window === 'undefined') return null
  try {
    const value = window.localStorage.getItem(LEGACY_SALARY_ADVANCE_KEY)
    if (!value) return null
    const parsed = JSON.parse(value) as { advances?: unknown; preservedAt?: unknown; importedAt?: unknown }
    return {
      advances: normalizeSalaryAdvances(parsed.advances),
      preservedAt: typeof parsed.preservedAt === 'string' ? parsed.preservedAt : '',
      importedAt: typeof parsed.importedAt === 'string' ? parsed.importedAt : null,
    }
  } catch {
    console.error('Could not read the preserved browser salary-advance snapshot.')
    return null
  }
}

export const markLegacySalaryAdvancesImported = () => {
  if (typeof window === 'undefined') return
  try {
    const preserved = getLegacySalaryAdvanceImport()
    if (!preserved) return
    window.localStorage.setItem(LEGACY_SALARY_ADVANCE_KEY, JSON.stringify({
      ...preserved,
      importedAt: new Date().toISOString(),
    }))
  } catch {
    console.error('Could not mark the preserved salary-advance snapshot as imported.')
  }
}

export const getLegacyEmployeeImport = (): { employees: Partial<Employee>[]; employeeDrafts: EmployeeDraft[] } | null => {
  if (typeof window === 'undefined') return null
  try {
    const saved = window.localStorage.getItem(LEGACY_EMPLOYEE_IMPORT_KEY)
    if (!saved) return null
    const parsed = JSON.parse(saved) as { employees?: unknown; employeeDrafts?: unknown }
    return {
      employees: Array.isArray(parsed.employees) ? parsed.employees as Partial<Employee>[] : [],
      employeeDrafts: Array.isArray(parsed.employeeDrafts) ? parsed.employeeDrafts as EmployeeDraft[] : [],
    }
  } catch {
    return null
  }
}

export const clearLegacyEmployeeImport = () => {
  if (typeof window !== 'undefined') window.localStorage.removeItem(LEGACY_EMPLOYEE_IMPORT_KEY)
}
const stockMovementTypes: StockMovementType[] = ['Opening balance', 'Stock in', 'Stock out', 'Production use', 'Transfer', 'Adjustment increase', 'Adjustment decrease']

const normalizeStockMovements = (value: unknown): StockMovement[] => {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((movement, index) => ({
      id: String(movement.id || `MOV-${index + 1}`),
      reference: String(movement.reference || `MOV-${String(index + 1).padStart(5, '0')}`),
      receiptReference: typeof movement.receiptReference === 'string' ? movement.receiptReference : undefined,
      productionRunId: typeof movement.productionRunId === 'string' ? movement.productionRunId : undefined,
      materialId: String(movement.materialId || ''),
      type: stockMovementTypes.includes(String(movement.type) as StockMovementType) ? movement.type as StockMovementType : 'Adjustment increase',
      quantity: Math.max(0, Number(movement.quantity) || 0),
      unit: String(movement.unit || ''),
      date: /^\d{4}-\d{2}-\d{2}$/.test(String(movement.date || '')) ? String(movement.date) : new Date().toISOString().slice(0, 10),
      recordedAt: typeof movement.recordedAt === 'string' ? movement.recordedAt : new Date().toISOString(),
      fromLocation: typeof movement.fromLocation === 'string' ? movement.fromLocation : undefined,
      toLocation: typeof movement.toLocation === 'string' ? movement.toLocation : undefined,
      supplier: typeof movement.supplier === 'string' ? movement.supplier : undefined,
      sourceReference: typeof movement.sourceReference === 'string' ? movement.sourceReference : undefined,
      unitCost: Number.isFinite(Number(movement.unitCost)) && Number(movement.unitCost) >= 0 ? Number(movement.unitCost) : undefined,
      reason: typeof movement.reason === 'string' ? movement.reason : undefined,
      actor: String(movement.actor || 'Administrator'),
    }))
    .filter((movement) => movement.materialId && movement.quantity > 0 && movement.unit)
}

const normalizeProductionRecipes = (value: unknown): ProductionRecipe[] => {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((recipe, index) => {
      const ingredients: RecipeIngredient[] = Array.isArray(recipe.ingredients)
        ? recipe.ingredients.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
          .map((item) => ({ materialId: String(item.materialId || ''), quantityPerTank: Number(item.quantityPerTank) }))
          .filter((item) => item.materialId && Number.isFinite(item.quantityPerTank) && item.quantityPerTank > 0)
        : []
      const createdAt = typeof recipe.createdAt === 'string' ? recipe.createdAt : new Date().toISOString()
      return {
        id: String(recipe.id || `RECIPE-${index + 1}`),
        productName: String(recipe.productName || ''),
        tankUnit: String(recipe.tankUnit || 'tank'),
        ingredients,
        createdAt,
        updatedAt: typeof recipe.updatedAt === 'string' ? recipe.updatedAt : createdAt,
      }
    })
    .filter((recipe) => recipe.productName && recipe.ingredients.length > 0)
}

const normalizeProductionRuns = (value: unknown): ProductionRun[] => {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((run, index) => {
      const lines: ProductionRunLine[] = Array.isArray(run.lines)
        ? run.lines.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
          .map((item) => ({
            materialId: String(item.materialId || ''),
            materialName: String(item.materialName || ''),
            quantityPerTank: Math.max(0, Number(item.quantityPerTank) || 0),
            totalQuantity: Math.max(0, Number(item.totalQuantity) || 0),
            unit: String(item.unit || ''),
          })).filter((item) => item.materialId && item.totalQuantity > 0 && item.unit)
        : []
      const productionDate = String(run.productionDate || '')
      const recordedAt = typeof run.recordedAt === 'string' ? run.recordedAt : new Date().toISOString()
      return {
        id: String(run.id || `PROD-${index + 1}`),
        reference: String(run.reference || `PROD-${String(index + 1).padStart(5, '0')}`),
        recipeId: String(run.recipeId || ''),
        productId: typeof run.productId === 'string' ? run.productId : undefined,
        productName: String(run.productName || ''),
        productUnit: String(run.productUnit || 'unit'),
        productionDate,
        tankCount: Math.max(0, Number(run.tankCount) || 0),
        producedQuantity: Number.isFinite(Number(run.producedQuantity)) ? Math.max(0, Number(run.producedQuantity)) : Math.max(0, Number(run.tankCount) || 0),
        openingStock: Number.isFinite(Number(run.openingStock)) ? Math.max(0, Number(run.openingStock)) : undefined,
        salesQuantity: Number.isFinite(Number(run.salesQuantity)) ? Math.max(0, Number(run.salesQuantity)) : undefined,
        damagedQuantity: Number.isFinite(Number(run.damagedQuantity)) ? Math.max(0, Number(run.damagedQuantity)) : undefined,
        closingStock: Number.isFinite(Number(run.closingStock)) ? Math.max(0, Number(run.closingStock)) : undefined,
        damageReason: typeof run.damageReason === 'string' ? run.damageReason : undefined,
        salesSource: 'Manual' as const,
        location: String(run.location || ''),
        lines,
        recordedAt,
        actor: String(run.actor || 'Administrator'),
      }
    })
    .filter((run) => run.productName && /^\d{4}-\d{2}-\d{2}$/.test(run.productionDate) && run.tankCount > 0 && run.lines.length > 0)
}

const finishedMovementTypes: FinishedStockMovementType[] = ['Opening balance', 'Production', 'Sales dispatch', 'Damage/write-off', 'Internal use/sample', 'Transfer in', 'Transfer out', 'Other stock in', 'Adjustment increase', 'Adjustment decrease']

const normalizeFinishedProducts = (value: unknown): FinishedProduct[] => {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((product, index) => {
      const createdAt = typeof product.createdAt === 'string' ? product.createdAt : new Date().toISOString()
      return {
        id: String(product.id || `FP-${index + 1}`),
        code: String(product.code || `PRODUCT-${String(index + 1).padStart(3, '0')}`),
        name: String(product.name || ''),
        category: String(product.category || 'Finished goods'),
        unit: String(product.unit || 'unit'),
        flavour: product.flavour === 'Mango' ? 'Mango' as const : product.flavour === 'Pineapple milk' ? 'Pineapple milk' as const : undefined,
        packType: (product.packType === 'Box' ? 'Box' : product.packType === 'Carton' ? 'Carton' : undefined) as FinishedProduct['packType'],
        piecesPerPack: Number.isInteger(Number(product.piecesPerPack)) && Number(product.piecesPerPack) > 0 ? Number(product.piecesPerPack) : undefined,
        packWeightKg: Number.isFinite(Number(product.packWeightKg)) && Number(product.packWeightKg) > 0 ? Number(product.packWeightKg) : undefined,
        recipeId: typeof product.recipeId === 'string' ? product.recipeId : undefined,
        recipeRequired: Boolean(product.recipeRequired),
        active: product.active !== false,
        createdAt,
        updatedAt: typeof product.updatedAt === 'string' ? product.updatedAt : createdAt,
      }
    }).filter((product) => product.name)
}

const normalizeFinishedStockMovements = (value: unknown): FinishedStockMovement[] => {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((movement, index) => ({
      id: String(movement.id || `FG-MOV-${index + 1}`),
      reference: String(movement.reference || `FG-${String(index + 1).padStart(5, '0')}`),
      productId: String(movement.productId || ''),
      type: finishedMovementTypes.includes(String(movement.type) as FinishedStockMovementType) ? movement.type as FinishedStockMovementType : 'Adjustment increase',
      quantity: Math.max(0, Number(movement.quantity) || 0),
      date: /^\d{4}-\d{2}-\d{2}$/.test(String(movement.date || '')) ? String(movement.date) : new Date().toISOString().slice(0, 10),
      recordedAt: typeof movement.recordedAt === 'string' ? movement.recordedAt : new Date().toISOString(),
      reason: typeof movement.reason === 'string' ? movement.reason : undefined,
      note: typeof movement.note === 'string' ? movement.note : undefined,
      actor: String(movement.actor || 'Administrator'),
    })).filter((movement) => movement.productId && movement.quantity > 0)
}

const assetCategories: AssetCategory[] = ['Office assets', 'Vehicles', 'Production assets', 'Store', 'Machinery', 'Others']
const assetConditions: AssetCondition[] = ['Good', 'Fair', 'Needs repair', 'Unserviceable']
const assetStatuses: AssetStatus[] = ['Active', 'Under maintenance', 'Disposed']
const assetEventTypes: AssetEventType[] = ['Acquired', 'Inspection', 'Transfer', 'Assignment', 'Maintenance', 'Maintenance completed', 'Profile correction', 'Status change', 'Disposed']
const optionalDate = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined

const normalizeAssets = (value: unknown): CompanyAsset[] => {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((asset, index) => {
      const createdAt = typeof asset.createdAt === 'string' ? asset.createdAt : new Date().toISOString()
      return {
        id: String(asset.id || `ASSET-${index + 1}`),
        assetTag: String(asset.assetTag || `ASSET-${String(index + 1).padStart(4, '0')}`),
        name: String(asset.name || ''),
        category: assetCategories.includes(String(asset.category) as AssetCategory) ? asset.category as AssetCategory : 'Others',
        assetType: typeof asset.assetType === 'string' ? asset.assetType : undefined,
        makeModel: typeof asset.makeModel === 'string' ? asset.makeModel : undefined,
        serialNumber: typeof asset.serialNumber === 'string' ? asset.serialNumber : undefined,
        registration: typeof asset.registration === 'string' ? asset.registration : undefined,
        vin: typeof asset.vin === 'string' ? asset.vin : undefined,
        mileage: Number.isFinite(Number(asset.mileage)) && asset.mileage !== '' ? Math.max(0, Number(asset.mileage)) : undefined,
        capacity: typeof asset.capacity === 'string' ? asset.capacity : undefined,
        productionLine: typeof asset.productionLine === 'string' ? asset.productionLine : undefined,
        serviceInterval: typeof asset.serviceInterval === 'string' ? asset.serviceInterval : undefined,
        acquisitionDate: optionalDate(asset.acquisitionDate),
        acquisitionCost: Number.isFinite(Number(asset.acquisitionCost)) && asset.acquisitionCost !== '' ? Math.max(0, Number(asset.acquisitionCost)) : undefined,
        supplier: typeof asset.supplier === 'string' ? asset.supplier : undefined,
        warrantyEnd: optionalDate(asset.warrantyEnd),
        location: String(asset.location || 'Unassigned'),
        assignee: typeof asset.assignee === 'string' ? asset.assignee : undefined,
        department: typeof asset.department === 'string' ? asset.department : undefined,
        condition: assetConditions.includes(String(asset.condition) as AssetCondition) ? asset.condition as AssetCondition : 'Good',
        status: assetStatuses.includes(String(asset.status) as AssetStatus) ? asset.status as AssetStatus : 'Active',
        conditionNotes: typeof asset.conditionNotes === 'string' ? asset.conditionNotes : undefined,
        nextInspectionDate: optionalDate(asset.nextInspectionDate),
        nextServiceDate: optionalDate(asset.nextServiceDate),
        insuranceDueDate: optionalDate(asset.insuranceDueDate),
        notes: typeof asset.notes === 'string' ? asset.notes : undefined,
        createdAt,
        updatedAt: typeof asset.updatedAt === 'string' ? asset.updatedAt : createdAt,
      }
    }).filter((asset) => asset.name)
}

const normalizeAssetEvents = (value: unknown): AssetEvent[] => {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((event, index) => ({
      id: String(event.id || `AEVT-${index + 1}`),
      assetId: String(event.assetId || ''),
      type: assetEventTypes.includes(String(event.type) as AssetEventType) ? event.type as AssetEventType : 'Inspection',
      date: optionalDate(event.date) || new Date().toISOString().slice(0, 10),
      recordedAt: typeof event.recordedAt === 'string' ? event.recordedAt : new Date().toISOString(),
      actor: String(event.actor || 'Administrator'),
      reference: typeof event.reference === 'string' ? event.reference : undefined,
      fromLocation: typeof event.fromLocation === 'string' ? event.fromLocation : undefined,
      toLocation: typeof event.toLocation === 'string' ? event.toLocation : undefined,
      fromAssignee: typeof event.fromAssignee === 'string' ? event.fromAssignee : undefined,
      toAssignee: typeof event.toAssignee === 'string' ? event.toAssignee : undefined,
      previousCondition: assetConditions.includes(String(event.previousCondition) as AssetCondition) ? event.previousCondition as AssetCondition : undefined,
      newCondition: assetConditions.includes(String(event.newCondition) as AssetCondition) ? event.newCondition as AssetCondition : undefined,
      previousStatus: assetStatuses.includes(String(event.previousStatus) as AssetStatus) ? event.previousStatus as AssetStatus : undefined,
      newStatus: assetStatuses.includes(String(event.newStatus) as AssetStatus) ? event.newStatus as AssetStatus : undefined,
      reason: typeof event.reason === 'string' ? event.reason : undefined,
      note: typeof event.note === 'string' ? event.note : undefined,
      provider: typeof event.provider === 'string' ? event.provider : undefined,
      cost: Number.isFinite(Number(event.cost)) && event.cost !== '' ? Math.max(0, Number(event.cost)) : undefined,
      nextInspectionDate: optionalDate(event.nextInspectionDate),
      nextServiceDate: optionalDate(event.nextServiceDate),
    })).filter((event) => event.assetId)
}

const migrateFinishedProducts = (recipes: ProductionRecipe[], runs: ProductionRun[]): FinishedProduct[] => {
  const names = new Map<string, { recipeId?: string; unit: string }>()
  recipes.forEach((recipe) => names.set(recipe.productName.trim().toLowerCase(), { recipeId: recipe.id, unit: recipe.tankUnit || 'unit' }))
  runs.forEach((run) => {
    const key = run.productName.trim().toLowerCase()
    if (!names.has(key)) names.set(key, { recipeId: run.recipeId || undefined, unit: run.productUnit || 'unit' })
  })
  const createdAt = new Date().toISOString()
  return [...names.entries()].map(([key, value], index) => {
    const name = recipes.find((recipe) => recipe.productName.trim().toLowerCase() === key)?.productName
      ?? runs.find((run) => run.productName.trim().toLowerCase() === key)?.productName
      ?? key
    return { id: `FG-MIG-${index + 1}`, code: `LEGACY-${String(index + 1).padStart(3, '0')}`, name, category: 'Finished goods', unit: value.unit, recipeId: value.recipeId, recipeRequired: false, active: true, createdAt, updatedAt: createdAt }
  })
}

const migrateFinishedMovements = (products: FinishedProduct[], runs: ProductionRun[]): FinishedStockMovement[] => {
  const productByName = new Map(products.map((product) => [product.name.trim().toLowerCase(), product]))
  const earliestRun = new Map<string, ProductionRun>()
  runs.forEach((run) => {
    const key = run.productName.trim().toLowerCase()
    const current = earliestRun.get(key)
    if (!current || run.productionDate < current.productionDate) earliestRun.set(key, run)
  })
  return runs.flatMap((run) => {
    const product = productByName.get(run.productName.trim().toLowerCase())
    if (!product) return []
    const opening: FinishedStockMovement[] = []
    if (run.openingStock !== undefined && earliestRun.get(run.productName.trim().toLowerCase())?.id === run.id && run.openingStock > 0) {
      opening.push({ id: `FG-OPEN-${run.id}`, reference: `OPEN-${run.reference}`, productId: product.id, type: 'Opening balance', quantity: run.openingStock, date: run.productionDate, recordedAt: run.recordedAt, reason: 'Opening balance migrated from daily production history', actor: 'System' })
    }
    const runQuantity = run.producedQuantity ?? run.tankCount
    return [
      ...opening,
      ...(runQuantity > 0 ? [{ id: `FG-PROD-${run.id}`, reference: run.reference, productId: product.id, type: 'Production' as const, quantity: runQuantity, date: run.productionDate, recordedAt: run.recordedAt, reason: 'Migrated production output', actor: run.actor }] : []),
      ...((run.salesQuantity ?? 0) > 0 ? [{ id: `FG-SALES-${run.id}`, reference: run.reference, productId: product.id, type: 'Sales dispatch' as const, quantity: run.salesQuantity!, date: run.productionDate, recordedAt: run.recordedAt, reason: 'Migrated daily sales quantity', actor: run.actor }] : []),
      ...((run.damagedQuantity ?? 0) > 0 ? [{ id: `FG-DAMAGE-${run.id}`, reference: run.reference, productId: product.id, type: 'Damage/write-off' as const, quantity: run.damagedQuantity!, date: run.productionDate, recordedAt: run.recordedAt, reason: run.damageReason || 'Migrated daily damage quantity', actor: run.actor }] : []),
    ]
  })
}

const openingMovementsFor = (materials: RawMaterial[]): StockMovement[] => materials
  .filter((material) => material.quantity > 0)
  .map((material) => ({
    id: `OPEN-${material.id}`, reference: `OPEN-${material.code}`, materialId: material.id,
    type: 'Opening balance', quantity: material.quantity, unit: material.unit,
    date: new Date().toISOString().slice(0, 10), recordedAt: new Date().toISOString(),
    toLocation: material.location || 'Main Warehouse', unitCost: material.cost,
    reason: 'Opening stock migrated from existing inventory balance', actor: 'System',
  }))

export const stockQuantityAtLocation = (materialId: string, movements: StockMovement[], location?: string) => movements
  .filter((movement) => movement.materialId === materialId)
  .reduce((quantity, movement) => {
    const sourceMatch = !location || movement.fromLocation === location
    const destinationMatch = !location || movement.toLocation === location
    if (['Opening balance', 'Stock in', 'Adjustment increase'].includes(movement.type) && destinationMatch) return quantity + movement.quantity
    if (['Stock out', 'Production use', 'Adjustment decrease'].includes(movement.type) && sourceMatch) return quantity - movement.quantity
    if (movement.type === 'Transfer') return quantity + (destinationMatch ? movement.quantity : 0) - (sourceMatch ? movement.quantity : 0)
    return quantity
  }, 0)

export const stockUnitCost = (material: RawMaterial, movements: StockMovement[]) => {
  const receipts = movements.filter((movement) => movement.materialId === material.id && ['Opening balance', 'Stock in'].includes(movement.type) && movement.unitCost !== undefined)
  const receiptQuantity = receipts.reduce((total, movement) => total + movement.quantity, 0)
  const receiptValue = receipts.reduce((total, movement) => total + movement.quantity * (movement.unitCost ?? 0), 0)
  return receiptQuantity > 0 ? receiptValue / receiptQuantity : material.cost
}

export const stockValue = (materials: RawMaterial[], movements: StockMovement[]) => materials.reduce((total, material) => {
  return total + Math.max(0, stockQuantityAtLocation(material.id, movements)) * stockUnitCost(material, movements)
}, 0)

const normalizeOrder = (value: unknown, index: number): Order => {
  const legacy = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const reference = String(legacy.reference || legacy.id || `ORD-${index + 1}`)
  const date = String(legacy.date || new Date().toISOString().slice(0, 10))
  const quantity = Math.max(1, Number(legacy.quantity) || 1)
  const total = Math.max(0, Number(legacy.total) || 0)
  const legacyItems = Array.isArray(legacy.items) ? legacy.items : null
  const items: OrderItem[] = legacyItems
    ? legacyItems.map((value, itemIndex) => {
        const item = value && typeof value === 'object' ? value as Record<string, unknown> : {}
        const itemQuantity = Math.max(1, Number(item.quantity) || 1)
        const lineTotal = Math.max(0, Number(item.lineTotal) || 0)
        return {
          id: String(item.id || `${reference}-${itemIndex + 1}`),
          product: String(item.product || 'Unspecified product'),
          quantity: itemQuantity,
          unitPrice: Math.max(0, Number(item.unitPrice) || lineTotal / itemQuantity),
          lineTotal: lineTotal || Math.max(0, Number(item.unitPrice) || 0) * itemQuantity,
        }
      })
    : [{
        id: `${reference}-1`,
        product: String(legacy.product || 'Unspecified product'),
        quantity,
        unitPrice: total / quantity,
        lineTotal: total,
      }]
  const legacyStatus = String(legacy.status || 'Pending')
  const status: OrderStatus = legacyStatus === 'Approved'
    ? 'Confirmed'
    : legacyStatus === 'Draft' || !['Pending', 'Confirmed', 'In progress', 'Ready', 'Completed', 'Cancelled'].includes(legacyStatus)
      ? 'Pending'
      : legacyStatus as OrderStatus
  const createdAt = typeof legacy.createdAt === 'string'
    ? legacy.createdAt
    : `${date}T12:00:00.000Z`
  const statusHistory: OrderStatusChange[] = Array.isArray(legacy.statusHistory)
    ? legacy.statusHistory as OrderStatusChange[]
    : [{ status, at: createdAt }]
  const requestedDate = typeof legacy.requestedDate === 'string' ? legacy.requestedDate : date
  const fulfilmentMethod = legacy.fulfilmentMethod === 'Pickup' ? 'Pickup' : 'Delivery'
  const paymentTerms = ['Paid now', 'Same-day', 'Credit'].includes(String(legacy.paymentTerms))
    ? String(legacy.paymentTerms) as Order['paymentTerms']
    : 'Same-day'

  return {
    id: String(legacy.id || reference),
    reference,
    date,
    createdAt,
    customer: String(legacy.customer || 'Walk-in customer'),
    customerId: typeof legacy.customerId === 'string' ? legacy.customerId : undefined,
    items,
    total: legacyItems ? items.reduce((sum, item) => sum + item.lineTotal, 0) : total,
    requestedDate,
    fulfilmentMethod,
    destination: String(legacy.destination || legacy.notes || ''),
    paymentTerms,
    dueDate: typeof legacy.dueDate === 'string' ? legacy.dueDate : undefined,
    status,
    statusHistory,
    priority: legacy.priority === 'High' ? 'High' : 'Normal',
    priorityReason: typeof legacy.priorityReason === 'string' ? legacy.priorityReason : undefined,
    completedAt: typeof legacy.completedAt === 'string' ? legacy.completedAt : undefined,
    archivedAt: typeof legacy.archivedAt === 'string' ? legacy.archivedAt : undefined,
    notes: String(legacy.notes || ''),
  }
}

const normalizedCustomerName = (name: string) =>
  name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US')

const resolveCustomerId = (
  customerId: string | undefined,
  name: string,
  customers: Customer[],
) => {
  if (customerId && customers.some((customer) => customer.id === customerId)) {
    return customerId
  }
  const matches = customers.filter(
    (customer) => normalizedCustomerName(customer.name) === normalizedCustomerName(name),
  )
  return matches.length === 1 ? matches[0].id : undefined
}

export const linkCustomerTransactions = (state: ErpState): ErpState => ({
  ...state,
  sales: state.sales.map((sale) => {
    const customerId = resolveCustomerId(sale.customerId, sale.customer, state.customers)
    return {
      ...sale,
      customerId,
      creditNeedsReview: sale.paymentTerms === 'Credit' && (!sale.dueDate || !customerId),
    }
  }),
  orders: state.orders.map((order) => ({
    ...order,
    customerId: resolveCustomerId(order.customerId, order.customer, state.customers),
  })),
})

const invoiceStatuses: InvoiceStatus[] = ['Draft', 'Ready to submit', 'Submitted', 'Issued', 'Failed', 'Cancelled', 'Credit note']
const normalizeInvoiceParty = (value: unknown, fallback: InvoicePartySnapshot): InvoicePartySnapshot => {
  const party = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return {
    name: typeof party.name === 'string' ? party.name : fallback.name,
    tin: typeof party.tin === 'string' ? party.tin : fallback.tin,
    email: typeof party.email === 'string' ? party.email : fallback.email,
    phone: typeof party.phone === 'string' ? party.phone : fallback.phone,
    address: typeof party.address === 'string' ? party.address : fallback.address,
    logoUrl: typeof party.logoUrl === 'string' ? party.logoUrl : undefined,
  }
}

const normalizeInvoices = (value: unknown, sales: Sale[], customers: Customer[], profile: CompanyProfile): Invoice[] => {
  const salesById = new Map(sales.map((sale) => [sale.id, sale]))
  const seenSaleIds = new Set<string>()
  const saved = Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object')).flatMap((item) => {
    const saleId = typeof item.saleId === 'string' ? item.saleId : ''
    const sale = salesById.get(saleId)
    if (!sale || seenSaleIds.has(saleId)) return []
    seenSaleIds.add(saleId)
    const customer = customers.find((entry) => entry.id === sale.customerId)
      ?? customers.find((entry) => entry.name.trim().toLowerCase() === sale.customer.trim().toLowerCase())
    const fallback = createInvoiceDraft(sale, customer, profile)
    const status = invoiceStatuses.includes(String(item.status) as InvoiceStatus) ? item.status as InvoiceStatus : 'Draft'
    const lines = Array.isArray(item.lines) ? item.lines.filter((line): line is Record<string, unknown> => Boolean(line && typeof line === 'object')).map((line, index) => ({
      id: String(line.id || `${sale.id}-LINE-${index + 1}`),
      description: String(line.description || sale.product),
      quantity: Math.max(0, Number(line.quantity) || 0),
      unitPrice: Math.max(0, Number(line.unitPrice) || 0),
      lineTotal: Math.max(0, Number(line.lineTotal) || 0),
      taxCategory: typeof line.taxCategory === 'string' ? line.taxCategory : undefined,
      taxRate: Number.isFinite(Number(line.taxRate)) && line.taxRate !== '' ? Number(line.taxRate) : undefined,
      taxAmount: Number.isFinite(Number(line.taxAmount)) && line.taxAmount !== '' ? Number(line.taxAmount) : undefined,
    })) : fallback.lines
    const events = Array.isArray(item.events) ? item.events.filter((event): event is Record<string, unknown> => Boolean(event && typeof event === 'object')).map((event, index) => ({
      id: String(event.id || `${sale.id}-IEVT-${index + 1}`),
      type: String(event.type || 'Draft updated'),
      at: typeof event.at === 'string' ? event.at : fallback.createdAt,
      actor: String(event.actor || 'System'),
      note: typeof event.note === 'string' ? event.note : undefined,
    })) : fallback.events
    return [{
      ...fallback,
      id: String(item.id || fallback.id),
      invoiceNumber: String(item.invoiceNumber || fallback.invoiceNumber),
      status,
      issueDate: typeof item.issueDate === 'string' ? item.issueDate : fallback.issueDate,
      dueDate: typeof item.dueDate === 'string' ? item.dueDate : undefined,
      currency: 'UGX' as const,
      paymentTerms: String(item.paymentTerms || fallback.paymentTerms),
      seller: normalizeInvoiceParty(item.seller, fallback.seller),
      buyer: normalizeInvoiceParty(item.buyer, fallback.buyer),
      lines,
      subtotal: Math.max(0, Number(item.subtotal) || fallback.subtotal),
      taxTotal: Number.isFinite(Number(item.taxTotal)) && item.taxTotal !== '' ? Math.max(0, Number(item.taxTotal)) : undefined,
      total: Math.max(0, Number(item.total) || fallback.total),
      uraReference: typeof item.uraReference === 'string' ? item.uraReference : undefined,
      verificationUrl: typeof item.verificationUrl === 'string' ? item.verificationUrl : undefined,
      qrCodeData: typeof item.qrCodeData === 'string' ? item.qrCodeData : undefined,
      events,
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : fallback.createdAt,
      updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : fallback.updatedAt,
    }]
  }) : []
  return [...saved, ...sales.filter((sale) => !seenSaleIds.has(sale.id)).map((sale) => {
    const customer = customers.find((entry) => entry.id === sale.customerId)
      ?? customers.find((entry) => entry.name.trim().toLowerCase() === sale.customer.trim().toLowerCase())
    return createInvoiceDraft(sale, customer, profile)
  })]
}

export const loadState = (): ErpState => {
  if (typeof window === 'undefined') return linkCustomerTransactions(cloneSeed())
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (!saved) return linkCustomerTransactions(cloneSeed())
    preserveLegacyEmployeeData(saved)
    const attendancePreserved = preserveLegacyAttendanceData(saved)
    preserveLegacySalaryAdvanceData(saved)
    const parsed = JSON.parse(saved) as Partial<ErpState>
    const defaults = cloneSeed()
    const customers = Array.isArray(parsed.customers) ? parsed.customers : defaults.customers
    const sales = Array.isArray(parsed.sales) ? parsed.sales : defaults.sales
    const payments = Array.isArray(parsed.payments) ? parsed.payments : []
    const orders = Array.isArray(parsed.orders) ? parsed.orders.map(normalizeOrder) : defaults.orders
    const employees: Employee[] = []
    const employeeDrafts: EmployeeDraft[] = []
    const attendanceRecords: AttendanceRecord[] = []
    const leaveRequests = normalizeLeaveRequests(parsed.leaveRequests)
    const payrollRuns = normalizePayrollRuns(parsed.payrollRuns)
    const salaryAdvances: SalaryAdvance[] = []
    const materials = Array.isArray(parsed.materials) ? parsed.materials as RawMaterial[] : defaults.materials
    const stockMovements = Array.isArray(parsed.stockMovements) ? normalizeStockMovements(parsed.stockMovements) : openingMovementsFor(materials)
    const productionRecipes = normalizeProductionRecipes(parsed.productionRecipes)
    const productionRuns = normalizeProductionRuns(parsed.productionRuns)
    const finishedProducts = Array.isArray(parsed.finishedProducts) ? normalizeFinishedProducts(parsed.finishedProducts) : migrateFinishedProducts(productionRecipes, productionRuns)
    const finishedStockMovements = Array.isArray(parsed.finishedStockMovements) ? normalizeFinishedStockMovements(parsed.finishedStockMovements) : migrateFinishedMovements(finishedProducts, productionRuns)
    const assets = normalizeAssets(parsed.assets)
    const assetEvents = normalizeAssetEvents(parsed.assetEvents)
    const companyProfile = normalizeCompanyProfile(parsed.companyProfile)
    const invoices = normalizeInvoices(parsed.invoices, sales, customers, companyProfile)
    const state = linkCustomerTransactions({ ...defaults, ...parsed, customers, sales, invoices, payments, orders, employees, employeeDrafts, attendanceRecords, leaveRequests, payrollRuns, salaryAdvances, materials, stockMovements, productionRecipes, productionRuns, finishedProducts, finishedStockMovements, assets, assetEvents, companyProfile })
    state.materials = state.materials.map((material) => ({ ...material, quantity: Math.max(0, stockQuantityAtLocation(material.id, stockMovements)) }))
    if (attendancePreserved) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, assets: parsed.assets, assetEvents: parsed.assetEvents, employees: [], employeeDrafts: [], attendanceRecords: [], salaryAdvances: [], companyProfile: emptyCompanyProfile }))
    }
    return state
  } catch {
    return linkCustomerTransactions(cloneSeed())
  }
}

export const exportLegacyRawMaterialMigration = () => {
  if (typeof window === 'undefined') throw new Error('Legacy inventory export is only available in a browser.')
  const saved = window.localStorage.getItem(STORAGE_KEY)
  if (!saved) throw new Error('No legacy browser inventory data was found.')
  const parsed = JSON.parse(saved) as Partial<ErpState>
  const legacyMaterials = Array.isArray(parsed.materials) ? parsed.materials as RawMaterial[] : []
  const stockMovements = Array.isArray(parsed.stockMovements)
    ? normalizeStockMovements(parsed.stockMovements)
    : openingMovementsFor(legacyMaterials)
  return {
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    materials: legacyMaterials.map((material) => ({
      ...material,
      quantity: Math.max(0, stockQuantityAtLocation(material.id, stockMovements)),
    })),
    stockMovements,
    productionRecipes: normalizeProductionRecipes(parsed.productionRecipes),
    productionRuns: normalizeProductionRuns(parsed.productionRuns),
  }
}

export const normalizeSalaryAdvances = (value: unknown): SalaryAdvance[] => {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((advance, index) => {
      const status: AdvanceStatus = ['Pending HR review', 'Pending GM review', 'Pending review', 'Approved', 'Rejected', 'Active', 'Settled', 'Legacy archive'].includes(String(advance.status)) ? advance.status as AdvanceStatus : 'Pending review'
      const frequency = (input: unknown): AdvanceRepaymentFrequency => input === 'Weekly' ? 'Weekly' : 'Monthly'
      const method = (input: unknown): AdvanceRepaymentMethod => ['Cash', 'Mobile Money', 'Bank Transfer', 'Payroll'].includes(String(input)) ? input as AdvanceRepaymentMethod : 'Cash'
      const schedule: AdvanceScheduleEntry[] = Array.isArray(advance.schedule)
        ? advance.schedule.filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object')).map((entry, entryIndex) => ({
            id: String(entry.id || `ASCH-${index + 1}-${entryIndex + 1}`),
            dueDate: String(entry.dueDate || ''),
            plannedAmount: Math.max(0, Number(entry.plannedAmount) || 0),
          })).filter((entry) => /^\d{4}-\d{2}-\d{2}$/.test(entry.dueDate))
        : []
      const repayments: AdvanceRepayment[] = Array.isArray(advance.repayments)
        ? advance.repayments.filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object')).map((entry, entryIndex) => ({
            id: String(entry.id || `AREP-${index + 1}-${entryIndex + 1}`),
            date: String(entry.date || ''),
            amount: Math.max(0, Number(entry.amount) || 0),
            method: method(entry.method),
            reference: typeof entry.reference === 'string' ? entry.reference : undefined,
            note: typeof entry.note === 'string' ? entry.note : undefined,
            recordedAt: typeof entry.recordedAt === 'string' ? entry.recordedAt : new Date().toISOString(),
          })).filter((entry) => /^\d{4}-\d{2}-\d{2}$/.test(entry.date) && entry.amount > 0)
        : []
      const activity: AdvanceActivity[] = Array.isArray(advance.activity)
        ? advance.activity.filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object')).map((entry, entryIndex) => ({
            id: String(entry.id || `AACT-${index + 1}-${entryIndex + 1}`),
            action: String(entry.action || 'Record updated'),
            actor: String(entry.actor || 'Administrator'),
            at: typeof entry.at === 'string' ? entry.at : new Date().toISOString(),
            note: typeof entry.note === 'string' ? entry.note : undefined,
          }))
        : []
      const disbursementValue = advance.disbursement && typeof advance.disbursement === 'object' ? advance.disbursement as Record<string, unknown> : undefined
      const disbursement = disbursementValue && Number(disbursementValue.amount) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(String(disbursementValue.date || ''))
        ? { amount: Math.max(0, Number(disbursementValue.amount)), date: String(disbursementValue.date), method: method(disbursementValue.method) as Exclude<AdvanceRepaymentMethod, 'Payroll'>, reference: typeof disbursementValue.reference === 'string' ? disbursementValue.reference : undefined, recordedAt: typeof disbursementValue.recordedAt === 'string' ? disbursementValue.recordedAt : new Date().toISOString() }
        : undefined
      const createdAt = typeof advance.createdAt === 'string' ? advance.createdAt : new Date().toISOString()
      return {
        id: String(advance.id || createId('ADV')),
        reference: String(advance.reference || `ADV-${String(index + 1).padStart(4, '0')}`),
        employeeId: String(advance.employeeId || ''),
        employeeNumber: String(advance.employeeNumber || ''),
        employeeName: String(advance.employeeName || 'Unknown employee'),
        department: String(advance.department || ''),
        role: String(advance.role || ''),
        category: String(advance.category || 'Other') as EmployeeCategory,
        paymentFrequency: advance.paymentFrequency === 'Weekly' || advance.paymentFrequency === 'Monthly' ? advance.paymentFrequency as Employee['paymentFrequency'] : undefined,
        requestedAmount: Math.max(0, Number(advance.requestedAmount) || 0),
        reason: String(advance.reason || ''),
        dateTaken: typeof advance.dateTaken === 'string'
          ? advance.dateTaken
          : String(advance.requestedAt || createdAt).slice(0, 10),
        dateApproved: status === 'Approved' || status === 'Active' || status === 'Settled'
          ? (typeof advance.dateApproved === 'string'
            ? advance.dateApproved
            : typeof advance.decisionAt === 'string' ? advance.decisionAt.slice(0, 10) : undefined)
          : undefined,
        attachments: Array.isArray(advance.attachments)
          ? advance.attachments.filter((attachment): attachment is Record<string, unknown> => Boolean(attachment && typeof attachment === 'object'))
            .map((attachment, attachmentIndex) => ({
              id: String(attachment.id || `AATT-${index + 1}-${attachmentIndex + 1}`),
              name: String(attachment.name || 'Attachment'),
              dataUrl: typeof attachment.dataUrl === 'string' ? attachment.dataUrl : undefined,
              url: typeof attachment.url === 'string' ? attachment.url : undefined,
              publicId: typeof attachment.publicId === 'string' ? attachment.publicId : undefined,
              resourceType: attachment.resourceType === 'raw' ? 'raw' as const : attachment.resourceType === 'image' ? 'image' as const : undefined,
              mediaType: typeof attachment.mediaType === 'string' ? attachment.mediaType : 'image/jpeg',
              sizeBytes: Math.max(0, Number(attachment.sizeBytes) || 0),
            }))
            .filter((attachment) => Boolean(attachment.dataUrl?.startsWith('data:image/') || attachment.url))
          : [],
        requestedAt: typeof advance.requestedAt === 'string' ? advance.requestedAt : createdAt,
        proposedFrequency: frequency(advance.proposedFrequency),
        proposedInstallmentAmount: Math.max(0, Number(advance.proposedInstallmentAmount) || 0),
        status,
        approvedAmount: Number(advance.approvedAmount) > 0 ? Number(advance.approvedAmount) : undefined,
        approvedFrequency: advance.approvedFrequency === 'Weekly' || advance.approvedFrequency === 'Monthly' ? advance.approvedFrequency as AdvanceRepaymentFrequency : undefined,
        approvedInstallmentAmount: Number(advance.approvedInstallmentAmount) > 0 ? Number(advance.approvedInstallmentAmount) : undefined,
        decisionAt: typeof advance.decisionAt === 'string' ? advance.decisionAt : undefined,
        decisionBy: typeof advance.decisionBy === 'string' ? advance.decisionBy : undefined,
        rejectionReason: typeof advance.rejectionReason === 'string' ? advance.rejectionReason : undefined,
        disbursement,
        schedule,
        repayments,
        activity,
        legacyUnverified: Boolean(advance.legacyUnverified),
        legacyStatus: typeof advance.legacyStatus === 'string' ? advance.legacyStatus : undefined,
        legacyReference: typeof advance.legacyReference === 'string' ? advance.legacyReference : undefined,
        hrDecision: advance.hrDecision && typeof advance.hrDecision === 'object' ? advance.hrDecision as AdvanceDecision : undefined,
        gmDecision: advance.gmDecision && typeof advance.gmDecision === 'object' ? advance.gmDecision as AdvanceDecision : undefined,
        createdAt,
        updatedAt: typeof advance.updatedAt === 'string' ? advance.updatedAt : createdAt,
      }
    }).filter((advance) => advance.employeeId)
}

const normalizePayrollLineItems = (value: unknown): PayrollLineItem[] => {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item, index) => ({
      id: String(item.id || `LINE-${index + 1}`),
      label: String(item.label || 'Unspecified item'),
      amount: Number.isFinite(Number(item.amount)) && item.amount !== null && item.amount !== '' ? Math.max(0, Number(item.amount)) : undefined,
      source: item.source === 'Salary advance' ? 'Salary advance' as const : undefined,
    }))
}

const normalizePayrollRuns = (value: unknown): PayrollRun[] => {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((run, runIndex) => {
      const frequency: PayrollFrequency = run.frequency === 'Weekly' ? 'Weekly' : 'Monthly'
      const status: PayrollRunStatus = ['Draft', 'In review', 'Approved', 'Paid'].includes(String(run.status)) ? run.status as PayrollRunStatus : 'Draft'
      const payslips: PayrollPayslipSnapshot[] = Array.isArray(run.payslips)
        ? run.payslips.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object')).map((slip, slipIndex) => ({
            id: String(slip.id || `SLIP-${runIndex + 1}-${slipIndex + 1}`),
            employeeId: String(slip.employeeId || ''),
            employeeNumber: String(slip.employeeNumber || ''),
            employeeName: String(slip.employeeName || 'Unknown employee'),
            category: String(slip.category || 'Other') as EmployeeCategory,
            department: String(slip.department || ''),
            role: String(slip.role || ''),
            compensationType: slip.compensationType === 'Salary earner' || slip.compensationType === 'Wage earner' ? slip.compensationType as Employee['compensationType'] : undefined,
            paymentFrequency: slip.paymentFrequency === 'Weekly' ? 'Weekly' as const : 'Monthly' as const,
            configuredRate: Number.isFinite(Number(slip.configuredRate)) && slip.configuredRate !== null && slip.configuredRate !== '' ? Math.max(0, Number(slip.configuredRate)) : undefined,
            attendanceUnits: Number.isFinite(Number(slip.attendanceUnits)) && slip.attendanceUnits !== null && slip.attendanceUnits !== '' ? Math.max(0, Number(slip.attendanceUnits)) : undefined,
            earnings: normalizePayrollLineItems(slip.earnings),
            deductions: normalizePayrollLineItems(slip.deductions),
            grossPay: Number.isFinite(Number(slip.grossPay)) && slip.grossPay !== null && slip.grossPay !== '' ? Math.max(0, Number(slip.grossPay)) : undefined,
            deductionTotal: Number.isFinite(Number(slip.deductionTotal)) && slip.deductionTotal !== null && slip.deductionTotal !== '' ? Math.max(0, Number(slip.deductionTotal)) : undefined,
            netPay: Number.isFinite(Number(slip.netPay)) && slip.netPay !== null && slip.netPay !== '' ? Math.max(0, Number(slip.netPay)) : undefined,
            reviewStatus: slip.reviewStatus === 'Ready' ? 'Ready' as const : 'Needs review' as const,
            paymentStatus: slip.paymentStatus === 'Paid' ? 'Paid' as const : 'Unpaid' as const,
          })).filter((slip) => slip.employeeId)
        : []
      const createdAt = typeof run.createdAt === 'string' ? run.createdAt : new Date().toISOString()
      return {
        id: String(run.id || createId('PRUN')),
        reference: String(run.reference || `PR-${runIndex + 1}`),
        frequency,
        periodStart: String(run.periodStart || ''),
        periodEnd: String(run.periodEnd || ''),
        status,
        createdAt,
        updatedAt: typeof run.updatedAt === 'string' ? run.updatedAt : createdAt,
        approvedAt: typeof run.approvedAt === 'string' ? run.approvedAt : undefined,
        paidAt: typeof run.paidAt === 'string' ? run.paidAt : undefined,
        notes: typeof run.notes === 'string' ? run.notes : undefined,
        payslips,
      }
    })
}

const normalizeAttendanceRecords = (value: unknown): AttendanceRecord[] => {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is AttendanceRecord => Boolean(item && typeof item === 'object'))
    .map((record) => ({
      id: String(record.id || createId('ATT')),
      employeeId: String(record.employeeId || ''),
      workDate: String(record.workDate || ''),
      status: ['Present', 'Absent', 'On leave', 'Unmarked'].includes(String(record.status)) ? record.status as AttendanceStatus : 'Unmarked',
      halfDay: Boolean(record.halfDay),
      late: Boolean(record.late),
      checkIn: typeof record.checkIn === 'string' ? record.checkIn : undefined,
      checkOut: typeof record.checkOut === 'string' ? record.checkOut : undefined,
      note: typeof record.note === 'string' ? record.note : undefined,
      updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : new Date().toISOString(),
    }))
    .filter((record) => record.employeeId && /^\d{4}-\d{2}-\d{2}$/.test(record.workDate))
}

const normalizeLeaveRequests = (value: unknown): LeaveRequest[] => {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((request, index) => {
      const status: LeaveStatus = ['Pending', 'Approved', 'Rejected', 'Cancelled'].includes(String(request.status)) ? request.status as LeaveStatus : 'Pending'
      const leaveType: LeaveType = ['Sick', 'Maternity/Paternity', 'Compassionate', 'Other'].includes(String(request.leaveType)) ? request.leaveType as LeaveType : 'Other'
      const decisions: LeaveDecision[] = Array.isArray(request.decisions)
        ? request.decisions.filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object')).map((entry, decisionIndex) => ({
            id: String(entry.id || `LDEC-${index + 1}-${decisionIndex + 1}`),
            decision: ['Approved', 'Rejected', 'Cancelled'].includes(String(entry.decision)) ? entry.decision as LeaveDecision['decision'] : 'Rejected',
            actor: String(entry.actor || 'Administrator'),
            at: typeof entry.at === 'string' ? entry.at : new Date().toISOString(),
            note: typeof entry.note === 'string' ? entry.note : undefined,
          }))
        : []
      const createdAt = typeof request.requestedAt === 'string' ? request.requestedAt : new Date().toISOString()
      return {
        id: String(request.id || createId('LEAVE')),
        reference: String(request.reference || `LV-${String(index + 1).padStart(4, '0')}`),
        employeeId: String(request.employeeId || ''),
        employeeName: String(request.employeeName || 'Unknown employee'),
        employeeNumber: String(request.employeeNumber || ''),
        department: String(request.department || ''),
        role: String(request.role || ''),
        employeeContact: String(request.employeeContact || ''),
        leaveType,
        otherLeaveType: typeof request.otherLeaveType === 'string' ? request.otherLeaveType : undefined,
        reason: String(request.reason || ''),
        startDate: String(request.startDate || ''),
        endDate: String(request.endDate || ''),
        requestedDays: Math.max(0, Number(request.requestedDays) || 0),
        handoverEmployeeId: String(request.handoverEmployeeId || ''),
        handoverName: String(request.handoverName || ''),
        handoverContact: String(request.handoverContact || ''),
        status,
        requestedAt: createdAt,
        updatedAt: typeof request.updatedAt === 'string' ? request.updatedAt : createdAt,
        decisions,
      }

    }).filter((request) => request.employeeId && /^\d{4}-\d{2}-\d{2}$/.test(request.startDate) && /^\d{4}-\d{2}-\d{2}$/.test(request.endDate))
}

export const preserveLegacyLeaveRequests = (requests: LeaveRequest[]) => {
  if (typeof window === 'undefined' || !requests.length || window.localStorage.getItem(LEGACY_LEAVE_IMPORT_KEY)) return
  window.localStorage.setItem(LEGACY_LEAVE_IMPORT_KEY, JSON.stringify(requests))
}

export const getLegacyLeaveRequests = (): LeaveRequest[] => {
  if (typeof window === 'undefined') return []
  try {
    const saved = window.localStorage.getItem(LEGACY_LEAVE_IMPORT_KEY)
    if (!saved) return []
    return normalizeLeaveRequests(JSON.parse(saved))
  } catch {
    console.error('Could not read the preserved browser leave snapshot.')
    return []
  }
}

export const clearLegacyLeaveRequests = () => {
  if (typeof window !== 'undefined') window.localStorage.removeItem(LEGACY_LEAVE_IMPORT_KEY)
}

export const employeeDisplayName = (employee: Partial<Employee>) => {
  const structuredName = [employee.firstName, employee.secondName, employee.otherNames]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(' ')
  return structuredName || employee.name || 'New employee'
}

const normalizeEmployee = (value: unknown): Employee => {
  const legacy = value && typeof value === 'object' ? value as Partial<Employee> : {}
  const category = legacy.category === 'Staff' ? 'Staff employee'
    : legacy.category === 'Casual' ? 'Casual worker'
      : legacy.category || 'Other'
  const employee: Employee = {
    id: String(legacy.id || createId('E')),
    name: String(legacy.name || employeeDisplayName(legacy)),
    number: String(legacy.number || createId('EMP')),
    department: String(legacy.department || 'Operations'),
    role: String(legacy.role || 'Team member'),
    status: legacy.status === 'Inactive' ? 'Inactive' : 'Active',
    salary: Math.max(0, Number(legacy.salary) || 0),
    ...legacy,
    category,
    documents: Array.isArray(legacy.documents) ? legacy.documents : [],
    mother: legacy.mother || { name: '', phone: '', address: '', status: '' },
    father: legacy.father || { name: '', phone: '', address: '', status: '' },
  }
  employee.name = employeeDisplayName(employee)
  return employee
}

export const saveState = (state: ErpState) => {
  if (typeof window === 'undefined') return
  const saved = window.localStorage.getItem(STORAGE_KEY)
  if (saved) preserveLegacySalaryAdvanceData(saved)
  const preserved = !saved || preserveLegacyAttendanceData(saved)
  const payload: Partial<ErpState> = { ...state, employees: [], employeeDrafts: [], attendanceRecords: [], salaryAdvances: [], companyProfile: emptyCompanyProfile }
  try {
    const previous = saved ? JSON.parse(saved) as Partial<ErpState> : {}
    if (Array.isArray(previous.assets)) payload.assets = previous.assets
    else delete payload.assets
    if (Array.isArray(previous.assetEvents)) payload.assetEvents = previous.assetEvents
    else delete payload.assetEvents
  } catch {
    delete payload.assets
    delete payload.assetEvents
  }
  if (!preserved && saved) {
    try {
      const previous = JSON.parse(saved) as Partial<ErpState>
      payload.attendanceRecords = Array.isArray(previous.attendanceRecords)
        ? normalizeAttendanceRecords(previous.attendanceRecords)
        : []
    } catch {
      console.error('Could not retain the previous browser attendance snapshot.')
    }
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}
export const getSavedCustomersForImport = (): Customer[] => {
  if (typeof window === 'undefined') return []
  const saved = window.localStorage.getItem(STORAGE_KEY)
  if (!saved) return []
  let parsed: Partial<ErpState>
  try {
    parsed = JSON.parse(saved) as Partial<ErpState>
  } catch {
    throw new Error('Saved browser data could not be read for customer import.')
  }
  return Array.isArray(parsed.customers) ? parsed.customers : []
}
export const getSavedSalesForImport = (): { sales: Sale[]; payments: SalePayment[] } => {
  if (typeof window === 'undefined') return { sales: [], payments: [] }
  const saved = window.localStorage.getItem(STORAGE_KEY)
  if (!saved) return { sales: [], payments: [] }
  let parsed: Partial<ErpState>
  try {
    parsed = JSON.parse(saved) as Partial<ErpState>
  } catch {
    throw new Error('Saved browser data could not be read for sales import.')
  }
  return {
    sales: Array.isArray(parsed.sales) ? parsed.sales : [],
    payments: Array.isArray(parsed.payments) ? parsed.payments : [],
  }
}
export const clearState = () => { if (typeof window !== 'undefined') { window.localStorage.removeItem(STORAGE_KEY); window.localStorage.removeItem(LEGACY_EMPLOYEE_IMPORT_KEY); window.localStorage.removeItem(LEGACY_ATTENDANCE_KEY); window.localStorage.removeItem(LEGACY_SALARY_ADVANCE_KEY); window.localStorage.removeItem(LEGACY_LEAVE_IMPORT_KEY) } }
export const createId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
export const exportCsv = (filename: string, rows: Record<string, unknown>[]) => { if (!rows.length) return; const headers = Object.keys(rows[0]); const csv = [headers.join(','), ...rows.map(row => headers.map(header => JSON.stringify(row[header] ?? '')).join(','))].join('\n'); const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url) }
export const navGroups = [
  { label: 'Overview', items: [{ label: 'Dashboard', icon: 'LayoutDashboard' }, { label: 'Approvals', icon: 'ClipboardCheck' }, { label: 'Invoicing', icon: 'FileText' }] },
  { label: 'Sales Department', items: [{ label: 'Sales', icon: 'ShoppingCart' }, { label: 'Credit Sales', icon: 'HandCoins' }, { label: 'Orders', icon: 'ClipboardList' }, { label: 'Receipt Management', icon: 'ReceiptText' }, { label: 'Customer Management', icon: 'Users' }] },
  { label: 'HR Department', items: [{ label: 'Employee Profiles', icon: 'ContactRound' }, { label: 'Attendance Management', icon: 'CalendarCheck' }, { label: 'Payroll Management', icon: 'WalletCards' }, { label: 'Salary Advance Management', icon: 'HandCoins' }, { label: 'Leave Management', icon: 'CalendarDays' }, { label: 'Disciplinary Letters', icon: 'ShieldAlert' }] },
  { label: 'Finance Department', items: [
    { label: 'Expenses', icon: 'Receipt' },
    // { label: 'Reporting', icon: 'ChartNoAxesCombined' },
    { label: 'Analysis', icon: 'ChartSpline' },
    { label: 'Auditing', icon: 'ScrollText' },
  ] },
  { label: 'Inventory Department', items: [{ label: 'Raw Material Management', icon: 'Boxes' }, { label: 'Production Management', icon: 'Factory' }, { label: 'Assets Management', icon: 'Building2' }, { label: 'Data Backup', icon: 'DatabaseBackup' }] },
  { label: 'Settings', items: [
    { label: 'Company Profile Management', icon: 'Building' },
    { label: 'User Management', icon: 'UserCog' },
    // { label: 'Finance Settings', icon: 'SlidersHorizontal' },
    { label: 'Security Settings', icon: 'LockKeyhole' },
  ] },
]
export const allNavItems = navGroups.flatMap(group => group.items)
export const chartData = [{ day: 'Mon', sales: 3.8, expenses: 1.2 }, { day: 'Tue', sales: 5.2, expenses: 1.7 }, { day: 'Wed', sales: 4.1, expenses: 1.1 }, { day: 'Thu', sales: 6.4, expenses: 2.2 }, { day: 'Fri', sales: 7.8, expenses: 1.8 }, { day: 'Sat', sales: 5.6, expenses: 1.4 }, { day: 'Sun', sales: 4.9, expenses: 1.1 }]
export const productMix = [{ name: 'Maize Flour', value: 42 }, { name: 'Wheat Flour', value: 28 }, { name: 'Rice', value: 18 }, { name: 'Sugar', value: 12 }]
export const initials = (name: string) => name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase()
export { STORAGE_KEY }
