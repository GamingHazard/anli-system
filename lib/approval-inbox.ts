import type { AdvanceRepaymentFrequency } from './erp'

export type ApprovalSource =
  | 'Leave'
  | 'Leave amendment'
  | 'Salary advance'
  | 'Payroll'
  | 'Expense'
  | 'Disciplinary'

export type ApprovalStatus =
  | 'Awaiting review'
  | 'In progress'
  | 'Approved'
  | 'Rejected'
  | 'Returned'
  | 'Cancelled'

export type ApprovalHistoryEntry = {
  stage: string
  decision: string
  actor: string
  at: string
  note: string
}

export type ApprovalInboxItem = {
  id: string
  source: ApprovalSource
  recordId: string
  subRecordId: string | null
  reference: string
  requester: string
  submittedAt: string
  summary: string
  detail: string
  amount?: number
  status: ApprovalStatus
  stage: string
  canAct: boolean
  history: ApprovalHistoryEntry[]
  salaryAdvance?: {
    status: string
    requestedAmount: number
    proposedFrequency: AdvanceRepaymentFrequency
    proposedInstallmentAmount: number
    hrDecision: {
      amount?: number
      frequency?: AdvanceRepaymentFrequency
      installmentAmount?: number
    } | null
  }
}

export type ApprovalInboxResponse = {
  items: ApprovalInboxItem[]
  counts: {
    actionable: number
    inProgress: number
    history: number
  }
  truncatedSources?: string[]
}

export type ApprovalDecisionInput =
  | { source: 'Leave' | 'Leave amendment'; recordId: string; subRecordId?: string | null; decision: 'Approved' | 'Rejected'; note: string }
  | { source: 'Salary advance'; recordId: string; stage: string; decision: 'Approved' | 'Rejected'; note: string; terms?: { amount: number; frequency: AdvanceRepaymentFrequency; installmentAmount: number } }
  | { source: 'Payroll'; recordId: string; decision: 'Approved' | 'Returned'; note: string }
  | { source: 'Expense'; recordId: string; decision: 'Approved' | 'Rejected'; note: string }
  | { source: 'Disciplinary'; recordId: string; decision: 'Approved' | 'Rejected'; note: string }
