import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  closePayrollAttendancePeriod,
  createPayrollRun,
  decidePayrollRun,
  getPayrollPolicy,
  getPayrollAttendancePeriod,
  getPayrollRun,
  listEmployeePayslips,
  listPayrollRuns,
  recordPayrollCashPayment,
  recalculatePayrollRun,
  reopenPayrollAttendancePeriod,
  submitPayrollRun,
  updatePayrollPolicy,
  type PayrollRunFilters,
} from './user-api'
import type { PayrollPolicy } from './payroll'

export const payrollQueryKeys = {
  all: ['payroll'] as const,
  policy: ['payroll', 'policy'] as const,
  runs: (filters: PayrollRunFilters) => ['payroll', 'runs', filters] as const,
  run: (id: string) => ['payroll', 'run', id] as const,
  employeePayslips: (employeeId: string) => ['payroll', 'employee-payslips', employeeId] as const,
  attendancePeriod: (periodStart: string, periodEnd: string) => ['payroll', 'attendance-period', periodStart, periodEnd] as const,
}

export function usePayrollPolicy(enabled = true) {
  return useQuery({
    queryKey: payrollQueryKeys.policy,
    queryFn: getPayrollPolicy,
    enabled,
  })
}

export function usePayrollRuns(filters: PayrollRunFilters = {}, enabled = true) {
  return useQuery({
    queryKey: payrollQueryKeys.runs(filters),
    queryFn: () => listPayrollRuns(filters),
    enabled,
  })
}

export function usePayrollRun(id: string | null, enabled = true) {
  return useQuery({
    queryKey: payrollQueryKeys.run(id || ''),
    queryFn: () => getPayrollRun(id || ''),
    enabled: enabled && Boolean(id),
  })
}

export function usePayrollAttendancePeriod(periodStart: string, periodEnd: string, enabled = true) {
  return useQuery({
    queryKey: payrollQueryKeys.attendancePeriod(periodStart, periodEnd),
    queryFn: () => getPayrollAttendancePeriod(periodStart, periodEnd),
    enabled: enabled && /^\d{4}-\d{2}-\d{2}$/.test(periodStart) && /^\d{4}-\d{2}-\d{2}$/.test(periodEnd),
  })
}

export function useEmployeePayslips(employeeId: string, enabled = true) {
  return useQuery({
    queryKey: payrollQueryKeys.employeePayslips(employeeId),
    queryFn: () => listEmployeePayslips(employeeId),
    enabled: enabled && Boolean(employeeId),
  })
}

function usePayrollMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: payrollQueryKeys.all }),
  })
}

export function useUpdatePayrollPolicy() {
  return usePayrollMutation((policy: Omit<PayrollPolicy, 'updatedAt' | 'updatedByName'>) => updatePayrollPolicy(policy))
}

export function useCreatePayrollRun() {
  return usePayrollMutation((input: Parameters<typeof createPayrollRun>[0]) => createPayrollRun(input))
}

export function useRecalculatePayrollRun() {
  return usePayrollMutation((id: string) => recalculatePayrollRun(id))
}

export function useSubmitPayrollRun() {
  return usePayrollMutation((id: string) => submitPayrollRun(id))
}

export function useDecidePayrollRun() {
  return usePayrollMutation((variables: { id: string; decision: 'Approved' | 'Returned'; note: string }) =>
    decidePayrollRun(variables.id, { decision: variables.decision, note: variables.note }))
}

export function useRecordPayrollCashPayment() {
  return usePayrollMutation((variables: { id: string; date: string; reference: string; note: string }) =>
    recordPayrollCashPayment(variables.id, { date: variables.date, reference: variables.reference, note: variables.note }))
}

export function useClosePayrollAttendancePeriod() {
  return usePayrollMutation((input: Parameters<typeof closePayrollAttendancePeriod>[0]) => closePayrollAttendancePeriod(input))
}

export function useReopenPayrollAttendancePeriod() {
  return usePayrollMutation((input: { periodStart: string; periodEnd: string; reason: string }) =>
    reopenPayrollAttendancePeriod(input.periodStart, input.periodEnd, input.reason))
}
