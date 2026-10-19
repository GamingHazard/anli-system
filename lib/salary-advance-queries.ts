import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createSalaryAdvance,
  decideSalaryAdvanceGeneralManager,
  decideSalaryAdvanceHr,
  listSalaryAdvances,
  recordPayrollSalaryAdvanceRepayments,
  recordSalaryAdvanceDisbursement,
  recordSalaryAdvanceRepayment,
  removeSalaryAdvanceAttachment,
  uploadSalaryAdvanceAttachment,
} from './user-api'
import type { SalaryAdvanceDecisionInput, SalaryAdvanceRequestInput } from './user-api'

export const salaryAdvanceQueryKeys = {
  all: ['salary-advances'] as const,
  list: (employeeId?: string) => ['salary-advances', 'list', employeeId ?? null] as const,
}

export function useSalaryAdvances(employeeId?: string, enabled = true) {
  return useQuery({
    queryKey: salaryAdvanceQueryKeys.list(employeeId),
    queryFn: () => listSalaryAdvances({ employeeId }),
    enabled,
  })
}

function useSalaryAdvanceMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: salaryAdvanceQueryKeys.all }),
  })
}

export function useCreateSalaryAdvance() {
  return useSalaryAdvanceMutation((input: SalaryAdvanceRequestInput) => createSalaryAdvance(input))
}

export function useHrSalaryAdvanceDecision() {
  return useSalaryAdvanceMutation((variables: { id: string; input: SalaryAdvanceDecisionInput }) => decideSalaryAdvanceHr(variables.id, variables.input))
}

export function useGeneralManagerSalaryAdvanceDecision() {
  return useSalaryAdvanceMutation((variables: { id: string; input: SalaryAdvanceDecisionInput }) => decideSalaryAdvanceGeneralManager(variables.id, variables.input))
}

export function useSalaryAdvanceDisbursement() {
  return useSalaryAdvanceMutation((variables: { id: string; input: Parameters<typeof recordSalaryAdvanceDisbursement>[1] }) => recordSalaryAdvanceDisbursement(variables.id, variables.input))
}

export function useSalaryAdvanceRepayment() {
  return useSalaryAdvanceMutation((variables: { id: string; input: Parameters<typeof recordSalaryAdvanceRepayment>[1] }) => recordSalaryAdvanceRepayment(variables.id, variables.input))
}

export function useUploadSalaryAdvanceAttachment() {
  return useSalaryAdvanceMutation((variables: { id: string; file: File }) => uploadSalaryAdvanceAttachment(variables.id, variables.file))
}

export function useRemoveSalaryAdvanceAttachment() {
  return useSalaryAdvanceMutation((variables: { id: string; attachmentId: string }) => removeSalaryAdvanceAttachment(variables.id, variables.attachmentId))
}

export function useRecordPayrollSalaryAdvanceRepayments() {
  return useSalaryAdvanceMutation((input: Parameters<typeof recordPayrollSalaryAdvanceRepayments>[0]) => recordPayrollSalaryAdvanceRepayments(input))
}
