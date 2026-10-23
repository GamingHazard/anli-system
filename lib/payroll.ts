export type PayrollRunType = 'Monthly' | 'Weekly wages' | 'Weekly feeding'
export type PayrollRunStatus = 'Draft' | 'In review' | 'Manager approved' | 'Approved' | 'Returned' | 'Paid'
export type PayrollRuleRunType = PayrollRunType
export type PayrollStatutoryRule = {
  code: string
  name: string
  appliesTo: 'Employee deduction' | 'Employer contribution'
  runTypes: PayrollRuleRunType[]
  employeeFlag: 'taxApplies' | 'nssfApplies' | 'all'
  method: 'Percentage' | 'Progressive'
  ratePercent: number
  bands: Array<{ upTo: number | null; ratePercent: number }>
  ceiling: number | null
  effectiveFrom: string
  effectiveTo: string
}
export type PayrollFeedingOverride = {
  employeeId: string
  dailyRate: number
  effectiveFrom: string
  effectiveTo: string
}
export type PayrollPolicy = {
  weekStartDay: number
  attendanceCutoffDelayDays: number
  feedingAllowance: {
    defaultDailyRate: number
    eligibleEmployeeIds: string[]
    employeeOverrides: PayrollFeedingOverride[]
  }
  statutoryRules: PayrollStatutoryRule[]
  updatedAt: string | null
  updatedByName: string
}
export type PayrollLineItem = {
  code: string
  label: string
  amount: number
  source: 'Base pay' | 'Attendance' | 'Feeding allowance' | 'Statutory' | 'Salary advance' | 'Adjustment'
  employerOnly: boolean
  details: Record<string, unknown>
}
export type PayrollAttendanceSnapshot = {
  date: string
  status: 'Present' | 'Absent' | 'On leave'
  units: number
}
export type PayrollPayslip = {
  id: string
  employeeId: string
  employeeNumber: string
  employeeName: string
  category: string
  department: string
  role: string
  compensationType: 'Salary earner' | 'Wage earner' | 'Allowance only'
  configuredRate: number
  attendanceUnits: number
  attendance: PayrollAttendanceSnapshot[]
  earnings: PayrollLineItem[]
  deductions: PayrollLineItem[]
  employerContributions: PayrollLineItem[]
  grossPay: number
  deductionTotal: number
  netPay: number
  employerContributionTotal: number
  reviewStatus: 'Ready' | 'Needs review'
  paymentStatus: 'Unpaid' | 'Paid'
}
export type PayrollApproval = {
  stage: 'General Manager' | 'Super Admin'
  decision: 'Approved' | 'Returned'
  actorId: string
  actorName: string
  note: string
  decidedAt: string
}
export type PayrollPayment = {
  method: 'Cash'
  amount: number
  date: string
  reference: string
  note: string
  recordedByName: string
}
export type PayrollRun = {
  id: string
  reference: string
  runType: PayrollRunType
  periodStart: string
  periodEnd: string
  status: PayrollRunStatus
  policyVersion: string
  calculationSnapshot: {
    currency: string
    periodStart: string
    periodEnd: string
    runType: PayrollRunType
    weekStartDay: number
    attendanceCutoffDelayDays: number
    feedingAllowance?: PayrollPolicy['feedingAllowance']
    statutoryRules: PayrollStatutoryRule[]
    attendanceClosedAt: string
    attendanceClosedByName: string
    attendanceRecordCount: number
  }
  payslips: PayrollPayslip[]
  approvals: PayrollApproval[]
  createdAt: string
  updatedAt: string
  createdBy: string
  submittedAt: string | null
  paidAt: string | null
  payment: PayrollPayment | null
  returnedNote: string
}
