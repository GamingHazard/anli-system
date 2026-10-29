import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  decideDisciplinaryApproval,
  decideExpense,
  decideLeaveAmendment,
  decideLeaveRequest,
  decidePayrollRun,
  decideSalaryAdvanceGeneralManager,
  decideSalaryAdvanceHr,
  getApprovalInbox,
} from './user-api'
import type { ApprovalDecisionInput } from './approval-inbox'
import type { SalaryAdvanceDecisionInput } from './user-api'

export const approvalInboxQueryKeys = {
  all: ['approval-inbox'] as const,
  inbox: ['approval-inbox', 'list'] as const,
}

export function useApprovalInbox(enabled = true) {
  return useQuery({
    queryKey: approvalInboxQueryKeys.inbox,
    queryFn: getApprovalInbox,
    enabled,
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}

export function useApprovalDecision() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: ApprovalDecisionInput): Promise<void> => {
      switch (input.source) {
        case 'Leave':
          await decideLeaveRequest(input.recordId, { decision: input.decision, note: input.note })
          return
        case 'Leave amendment':
          if (!input.subRecordId) throw new Error('The leave amendment reference is missing.')
          await decideLeaveAmendment(input.recordId, input.subRecordId, { decision: input.decision, note: input.note })
          return
        case 'Salary advance': {
          const salaryInput: SalaryAdvanceDecisionInput = {
            decision: input.decision,
            note: input.note,
            ...(input.terms ? {
              amount: input.terms.amount,
              frequency: input.terms.frequency,
              installmentAmount: input.terms.installmentAmount,
            } : {}),
          }
          if (input.stage === 'Human Resource') {
            await decideSalaryAdvanceHr(input.recordId, salaryInput)
          } else {
            await decideSalaryAdvanceGeneralManager(input.recordId, salaryInput)
          }
          return
        }
        case 'Payroll':
          await decidePayrollRun(input.recordId, { decision: input.decision, note: input.note })
          return
        case 'Expense':
          await decideExpense(input.recordId, { decision: input.decision, note: input.note })
          return
        case 'Disciplinary':
          await decideDisciplinaryApproval(input.recordId, input.decision, input.note)
          return
      }
    },
    onSuccess: async (_result, input) => {
      const invalidations = [queryClient.invalidateQueries({ queryKey: approvalInboxQueryKeys.all })]
      if (input.source === 'Leave' || input.source === 'Leave amendment') {
        invalidations.push(queryClient.invalidateQueries({ queryKey: ['leave'] }))
      }
      if (input.source === 'Salary advance') {
        invalidations.push(queryClient.invalidateQueries({ queryKey: ['salary-advances'] }))
      }
      if (input.source === 'Payroll') {
        invalidations.push(queryClient.invalidateQueries({ queryKey: ['payroll'] }))
      }
      if (input.source === 'Expense') {
        invalidations.push(queryClient.invalidateQueries({ queryKey: ['expenses'] }))
      }
      await Promise.all(invalidations)
    },
  })
}
