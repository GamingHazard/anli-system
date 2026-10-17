import type { Expense, ExpenseDecision, PayrollRun, SalaryAdvance } from '@/lib/erp'

export type ApprovalDecision = 'Approved' | 'Rejected'

const approvalEventId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`

export function decideExpense(expense: Expense, decision: ApprovalDecision, actor: string, note = ''): Expense {
  if (expense.status !== 'Pending approval') return expense
  const at = new Date().toISOString()
  const event: ExpenseDecision = { id: approvalEventId('EDEC'), decision, actor, at, note: note.trim() || undefined }
  return {
    ...expense,
    status: decision,
    decisions: [...(expense.decisions ?? []), event],
    rejectionReason: decision === 'Rejected' ? note.trim() : undefined,
  }
}

function addInstallments(firstDueDate: string, frequency: SalaryAdvance['proposedFrequency'], installment: number, amount: number, makeId: () => string) {
  const schedule: SalaryAdvance['schedule'] = []
  if (!firstDueDate || installment <= 0 || amount <= 0) return schedule
  let remaining = amount
  let dueDate = firstDueDate
  while (remaining > 0 && schedule.length < 120) {
    const plannedAmount = Math.min(installment, remaining)
    schedule.push({ id: makeId(), dueDate, plannedAmount })
    remaining -= plannedAmount
    const next = new Date(`${dueDate}T12:00:00.000Z`)
    if (frequency === 'Weekly') next.setUTCDate(next.getUTCDate() + 7)
    else next.setUTCMonth(next.getUTCMonth() + 1)
    dueDate = next.toISOString().slice(0, 10)
  }
  return schedule
}

export function decideSalaryAdvance(advance: SalaryAdvance, decision: ApprovalDecision, actor: string, note = '', terms?: { amount: number; frequency: SalaryAdvance['proposedFrequency']; installment: number; firstDueDate: string }): SalaryAdvance {
  if (advance.status !== 'Pending review') return advance
  const now = new Date().toISOString()
  const entry = { id: approvalEventId('AACT'), actor, at: now, action: decision === 'Approved' ? 'Request approved' : 'Request rejected', note: note.trim() || (decision === 'Approved' ? `Approved ${advance.requestedAmount} with proposed repayment terms.` : undefined) }
  if (decision === 'Rejected') {
    return { ...advance, status: 'Rejected', rejectionReason: note.trim(), decisionAt: now, decisionBy: actor, activity: [...advance.activity, entry], updatedAt: now }
  }
  const approvedAmount = terms?.amount ?? advance.requestedAmount
  const approvedFrequency = terms?.frequency ?? advance.proposedFrequency
  const approvedInstallment = terms?.installment ?? advance.proposedInstallmentAmount
  const firstDueDate = terms?.firstDueDate ?? advance.proposedFirstDueDate
  const schedule = addInstallments(firstDueDate, approvedFrequency, approvedInstallment, approvedAmount, () => approvalEventId('ASCH'))
  return {
    ...advance,
    status: 'Approved',
    approvedAmount,
    approvedFrequency,
    approvedInstallmentAmount: approvedInstallment,
    firstDueDate,
    decisionAt: now,
    decisionBy: actor,
    schedule,
    activity: [...advance.activity, entry],
    updatedAt: now,
  }
}

export function approvePayrollRun(run: PayrollRun, actor: string, note = ''): PayrollRun {
  if (run.status !== 'In review' || run.payslips.some((slip) => slip.reviewStatus !== 'Ready')) return run
  const now = new Date().toISOString()
  return { ...run, status: 'Approved', approvedAt: now, approvedBy: actor, approvalNote: note.trim() || undefined, updatedAt: now }
}
