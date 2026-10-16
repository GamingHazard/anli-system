export type Status = 'Paid' | 'Pending' | 'Overdue' | 'Approved' | 'Draft' | 'Active' | 'Inactive'

export type Sale = { id: string; date: string; customer: string; customerId?: string; product: string; quantity: number; total: number; status: 'Paid' | 'Pending'; method: string; txnID?: string; paymentTerms?: 'Same-day' | 'Credit'; dueDate?: string; creditNeedsReview?: boolean; reference: string }
export type SalePayment = { id: string; saleId: string; amount: number; date: string; method: 'Cash' | 'Mobile Money' | 'Bank Transfer' | 'Check'; txnID?: string; note?: string; recordedAt: string }
export type OrderStatus = 'Pending' | 'Confirmed' | 'In progress' | 'Ready' | 'Completed' | 'Cancelled'
export type OrderItem = { id: string; product: string; quantity: number; unitPrice: number; lineTotal: number }
export type OrderStatusChange = { status: OrderStatus; at: string }
export type Order = {
  id: string
  reference: string
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
  status: OrderStatus
  statusHistory: OrderStatusChange[]
  completedAt?: string
  priority: 'Normal' | 'High'
  priorityReason?: string
  archivedAt?: string
  notes: string
}
export type EmployeeCategory = 'Staff employee' | 'Casual worker' | 'Other' | 'Staff' | 'Casual'
export type EmployeeDocument = { title: string; url: string; publicId: string; download_Url: string }
export type EmployeeParent = { name: string; phone: string; address: string; status: 'Alive' | 'Deceased' | '' }
export type Employee = {
  id: string
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
export type PayrollFrequency = 'Monthly' | 'Weekly'
export type PayrollRunStatus = 'Draft' | 'In review' | 'Approved' | 'Paid'
export type PayrollReviewStatus = 'Needs review' | 'Ready'
export type PayrollPaymentStatus = 'Unpaid' | 'Paid'
export type PayrollLineItem = { id: string; label: string; amount?: number }
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
  approvedAt?: string
  paidAt?: string
  notes?: string
  payslips: PayrollPayslipSnapshot[]
}
export type Expense = { id: string; reference: string; category: string; description: string; amount: number; date: string; status: 'Paid' | 'Pending'; department: string }
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
export type Activity = { id: string; action: string; module: string; actor: string; time: string; outcome: 'Success' | 'Review' }
export type ErpState = { sales: Sale[]; payments: SalePayment[]; orders: Order[]; employees: Employee[]; employeeDrafts: EmployeeDraft[]; attendanceRecords: AttendanceRecord[]; payrollRuns: PayrollRun[]; expenses: Expense[]; customers: Customer[]; materials: RawMaterial[]; activities: Activity[] }

const daysAgo = (days: number) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
const daysFromNow = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
export const seedState: ErpState = {
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
  payrollRuns: [],
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
  materials: [
    { id: 'RM-001', code: 'RM-MZ-01', name: 'Maize grain', category: 'Grains', quantity: 2840, unit: 'kg', threshold: 1000, cost: 1250, location: 'Main Warehouse' },
    { id: 'RM-002', code: 'RM-PK-02', name: 'Packaging bags', category: 'Packaging', quantity: 620, unit: 'pcs', threshold: 800, cost: 420, location: 'Packaging Store' },
    { id: 'RM-003', code: 'RM-WH-03', name: 'Wheat grain', category: 'Grains', quantity: 1640, unit: 'kg', threshold: 900, cost: 1850, location: 'Main Warehouse' },
    { id: 'RM-004', code: 'RM-SG-04', name: 'Sugar', category: 'Ingredients', quantity: 410, unit: 'kg', threshold: 500, cost: 2900, location: 'Ingredients Store' },
  ],
  activities: [
    { id: 'A-01', action: 'Sale recorded', module: 'Sales', actor: 'Sarah Namirembe', time: '12 min ago', outcome: 'Success' },
    { id: 'A-02', action: 'Invoice INV-0091 issued', module: 'Invoicing', actor: 'David Okello', time: '38 min ago', outcome: 'Success' },
    { id: 'A-03', action: 'Expense awaiting approval', module: 'Finance', actor: 'System', time: '1 hr ago', outcome: 'Review' },
    { id: 'A-04', action: 'Stock adjustment approved', module: 'Inventory', actor: 'James Mugisha', time: '2 hrs ago', outcome: 'Success' },
  ],
}

export const cloneSeed = (): ErpState => JSON.parse(JSON.stringify(seedState))
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
    status,
    statusHistory,
    priority: legacy.priority === 'High' ? 'High' : 'Normal',
    priorityReason: typeof legacy.priorityReason === 'string' ? legacy.priorityReason : undefined,
    completedAt: typeof legacy.completedAt === 'string' ? legacy.completedAt : undefined,
    archivedAt: typeof legacy.archivedAt === 'string' ? legacy.archivedAt : undefined,
    notes: String(legacy.notes || ''),
  }
}

const linkCustomerTransactions = (state: ErpState): ErpState => ({
  ...state,
  sales: state.sales.map((sale) => {
    const customerId = sale.customerId || state.customers.find((customer) =>
      customer.name.trim().toLowerCase() === sale.customer.trim().toLowerCase())?.id
    return {
      ...sale,
      customerId,
      creditNeedsReview: sale.paymentTerms === 'Credit' && (!sale.dueDate || !customerId),
    }
  }),
  orders: state.orders.map((order) => ({
    ...order,
    customerId: order.customerId || state.customers.find((customer) =>
      customer.name.trim().toLowerCase() === order.customer.trim().toLowerCase())?.id,
  })),
})

export const loadState = (): ErpState => {
  if (typeof window === 'undefined') return linkCustomerTransactions(cloneSeed())
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (!saved) return linkCustomerTransactions(cloneSeed())
    const parsed = JSON.parse(saved) as Partial<ErpState>
    const defaults = cloneSeed()
    const customers = Array.isArray(parsed.customers) ? parsed.customers : defaults.customers
    const sales = Array.isArray(parsed.sales) ? parsed.sales : defaults.sales
    const payments = Array.isArray(parsed.payments) ? parsed.payments : []
    const orders = Array.isArray(parsed.orders) ? parsed.orders.map(normalizeOrder) : defaults.orders
    const employees = (Array.isArray(parsed.employees) ? parsed.employees : defaults.employees).map(normalizeEmployee)
    const employeeDrafts = Array.isArray(parsed.employeeDrafts) ? parsed.employeeDrafts : []
    const attendanceRecords = normalizeAttendanceRecords(parsed.attendanceRecords)
    const payrollRuns = normalizePayrollRuns(parsed.payrollRuns)
    return linkCustomerTransactions({ ...defaults, ...parsed, customers, sales, payments, orders, employees, employeeDrafts, attendanceRecords, payrollRuns })
  } catch {
    return linkCustomerTransactions(cloneSeed())
  }
}

const normalizePayrollLineItems = (value: unknown): PayrollLineItem[] => {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item, index) => ({
      id: String(item.id || `LINE-${index + 1}`),
      label: String(item.label || 'Unspecified item'),
      amount: Number.isFinite(Number(item.amount)) && item.amount !== null && item.amount !== '' ? Math.max(0, Number(item.amount)) : undefined,
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

export const saveState = (state: ErpState) => { if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) }
export const clearState = () => { if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY) }
export const createId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
export const exportCsv = (filename: string, rows: Record<string, unknown>[]) => { if (!rows.length) return; const headers = Object.keys(rows[0]); const csv = [headers.join(','), ...rows.map(row => headers.map(header => JSON.stringify(row[header] ?? '')).join(','))].join('\n'); const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url) }
export const navGroups = [
  { label: 'Overview', items: [{ label: 'Dashboard', icon: 'LayoutDashboard' }] },
  { label: 'Sales Department', items: [{ label: 'Sales', icon: 'ShoppingCart' }, { label: 'Credit Sales', icon: 'HandCoins' }, { label: 'Orders', icon: 'ClipboardList' }, { label: 'Receipt Management', icon: 'ReceiptText' }, { label: 'Customer Management', icon: 'Users' }, { label: 'Invoicing', icon: 'FileText' }] },
  { label: 'HR Department', items: [{ label: 'Employee Profiles', icon: 'ContactRound' }, { label: 'Attendance Management', icon: 'CalendarCheck' }, { label: 'Payroll Management', icon: 'WalletCards' }, { label: 'Salary Advance Management', icon: 'HandCoins' }, { label: 'Leave Management', icon: 'CalendarDays' }, { label: 'Punishment Management', icon: 'ShieldAlert' }] },
  { label: 'Finance Department', items: [{ label: 'Expenses', icon: 'Receipt' }, { label: 'Reporting', icon: 'ChartNoAxesCombined' }, { label: 'Analysis', icon: 'ChartSpline' }, { label: 'Auditing', icon: 'ScrollText' }] },
  { label: 'Inventory Department', items: [{ label: 'Raw Material Management', icon: 'Boxes' }, { label: 'Production Management', icon: 'Factory' }, { label: 'Assets Management', icon: 'Building2' }, { label: 'Data Backup', icon: 'DatabaseBackup' }] },
  { label: 'Settings', items: [{ label: 'Company Profile Management', icon: 'Building' }, { label: 'User Management', icon: 'UserCog' }, { label: 'Finance Settings', icon: 'SlidersHorizontal' }, { label: 'Security Settings', icon: 'LockKeyhole' }] },
]
export const allNavItems = navGroups.flatMap(group => group.items)
export const chartData = [{ day: 'Mon', sales: 3.8, expenses: 1.2 }, { day: 'Tue', sales: 5.2, expenses: 1.7 }, { day: 'Wed', sales: 4.1, expenses: 1.1 }, { day: 'Thu', sales: 6.4, expenses: 2.2 }, { day: 'Fri', sales: 7.8, expenses: 1.8 }, { day: 'Sat', sales: 5.6, expenses: 1.4 }, { day: 'Sun', sales: 4.9, expenses: 1.1 }]
export const productMix = [{ name: 'Maize Flour', value: 42 }, { name: 'Wheat Flour', value: 28 }, { name: 'Rice', value: 18 }, { name: 'Sugar', value: 12 }]
export const initials = (name: string) => name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase()
export { STORAGE_KEY }
