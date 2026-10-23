import type { UgandaTaxType } from '@/lib/erp'

export const EXPENSE_CATEGORIES = [
  'Rent and premises', 'Utilities', 'Production consumables', 'Packaging',
  'Repairs and maintenance', 'Fuel', 'Transport and delivery',
  'Travel and accommodation', 'Office supplies and printing',
  'Telephone and internet', 'IT and software', 'Professional services',
  'Marketing and advertising', 'Insurance', 'Licenses and compliance fees',
  'Bank and transaction charges', 'Staff welfare and training',
  'Cleaning and security', 'Tax', 'Other',
] as const

export type ExpenseStatus = 'Pending approval' | 'Approved' | 'Rejected' | 'Partially paid' | 'Paid' | 'Legacy unverified'
export type ExpensePaymentMethod = 'Cash' | 'Bank transfer' | 'Mobile Money' | 'Cheque'
export type ExpenseDecision = {
  id: string
  decision: 'Approved' | 'Rejected'
  actor: string
  at: string
  note: string
}
export type ExpensePayment = {
  id: string
  amount: number
  date: string
  method: ExpensePaymentMethod
  reference: string
  note: string
  recordedBy: string
  recordedAt: string | null
}
export type ExpenseAttachment = {
  id: string
  name: string
  url?: string
  mediaType: string
  sizeBytes: number
  uploadedAt: string
}
export type ManualExpense = {
  id: string
  source: 'Manual'
  reference: string
  category: typeof EXPENSE_CATEGORIES[number] | 'Payroll'
  taxType?: UgandaTaxType
  expenseType: 'Supplier bill' | 'Employee reimbursement' | 'Petty cash / other'
  date: string
  payee: string
  description: string
  department: string
  amount: number
  status: ExpenseStatus
  requestedBy: string
  createdAt: string | null
  decidedAt?: string | null
  decision?: ExpenseDecision | null
  decisions: ExpenseDecision[]
  paidAmount: number
  remainingAmount: number
  payments: ExpensePayment[]
  attachments: ExpenseAttachment[]
  legacyStatus?: string
  legacyAttachments?: Array<{ name: string; mediaType?: string; sizeBytes?: number }>
}
export type PayrollExpense = {
  id: string
  source: 'Payroll'
  sourceRunId: string
  reference: string
  category: 'Payroll'
  payrollSubtype: 'Salary' | 'Wages' | 'Feeding allowance'
  date: string
  periodStart: string
  periodEnd: string
  payee: string
  description: string
  department: string
  amount: number
  status: 'Approved' | 'Paid'
  requestedBy: string
  createdAt: string | null
  decidedAt?: string | null
  paidAt?: string | null
  paidAmount: number
  remainingAmount: number
  payments: ExpensePayment[]
  attachments: []
  readOnly: true
}
export type ExpenseRecord = ManualExpense | PayrollExpense
export type ExpenseEvent = {
  id: string
  type: string
  actor: string
  createdAt: string
  details: Record<string, unknown>
}
export type ExpenseFilters = {
  limit?: number
  cursor?: string
  status?: ExpenseStatus
  category?: typeof EXPENSE_CATEGORIES[number] | 'Payroll'
  taxType?: UgandaTaxType
  department?: string
  from?: string
  to?: string
  search?: string
  source?: 'Manual' | 'Payroll'
}
export type CreateExpenseInput = {
  category: typeof EXPENSE_CATEGORIES[number]
  taxType?: UgandaTaxType
  expenseType: ManualExpense['expenseType']
  date: string
  payee: string
  description: string
  department: string
  amount: number
}
