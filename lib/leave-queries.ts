import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  cancelLeaveRequest,
  confirmLeaveReturn,
  createLeaveAmendment,
  createLeaveRequest,
  decideLeaveAmendment,
  decideLeaveRequest,
  getLeavePolicy,
  importLegacyLeaveRequests,
  listLeaveBalances,
  listLegacyLeaveArchive,
  listLeavePeople,
  listLeaveRequests,
  previewLegacyLeaveRequests,
  listLeaveReminderCandidates,
  updateLeavePolicy,
  updateLeaveRouting,
  type LeavePolicy,
  type LeaveRequestInput,
} from './user-api'

export const leaveQueryKeys = {
  all: ['leave'] as const,
  requests: ['leave', 'requests'] as const,
  policy: ['leave', 'policy'] as const,
  balances: ['leave', 'balances'] as const,
  reminderCandidates: ['leave', 'reminder-candidates'] as const,
  people: ['leave', 'people'] as const,
}

export function useLeaveRequests(enabled = true) {
  return useQuery({
    queryKey: leaveQueryKeys.requests,
    queryFn: () => listLeaveRequests(),
    enabled,
  })
}

export function useLeavePolicy(enabled = true) {
  return useQuery({
    queryKey: leaveQueryKeys.policy,
    queryFn: getLeavePolicy,
    enabled,
  })
}

export function useLeaveBalances(enabled = true) {
  return useQuery({
    queryKey: leaveQueryKeys.balances,
    queryFn: listLeaveBalances,
    enabled,
  })
}

export function useLeaveReminderCandidates(enabled = true) {
  return useQuery({
    queryKey: leaveQueryKeys.reminderCandidates,
    queryFn: listLeaveReminderCandidates,
    enabled,
  })
}

export function useLeavePeople(enabled = true) {
  return useQuery({
    queryKey: leaveQueryKeys.people,
    queryFn: listLeavePeople,
    enabled,
  })
}

export function useLegacyLeaveArchive(enabled = true) {
  return useQuery({
    queryKey: ['leave', 'legacy-archive'],
    queryFn: listLegacyLeaveArchive,
    enabled,
  })
}

function useLeaveMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: leaveQueryKeys.all })
    },
  })
}

export function useCreateLeaveRequest() {
  return useLeaveMutation((input: LeaveRequestInput) => createLeaveRequest(input))
}

export function useLeaveDecision() {
  return useLeaveMutation((variables: { id: string; input: { decision: 'Approved' | 'Rejected'; note?: string } }) =>
    decideLeaveRequest(variables.id, variables.input))
}

export function useLeaveCancellation() {
  return useLeaveMutation((variables: { id: string; note: string }) =>
    cancelLeaveRequest(variables.id, variables.note))
}

export function useCreateLeaveAmendment() {
  return useLeaveMutation((variables: { id: string; input: { startDate: string; endDate: string; reason: string } }) =>
    createLeaveAmendment(variables.id, variables.input))
}

export function useLeaveAmendmentDecision() {
  return useLeaveMutation((variables: {
    id: string
    amendmentId: string
    input: { decision: 'Approved' | 'Rejected'; note?: string }
  }) => decideLeaveAmendment(variables.id, variables.amendmentId, variables.input))
}

export function useConfirmLeaveReturn() {
  return useLeaveMutation((variables: { id: string; actualDate: string }) =>
    confirmLeaveReturn(variables.id, variables.actualDate))
}

export function useUpdateLeavePolicy() {
  return useLeaveMutation((policy: Partial<LeavePolicy>) => updateLeavePolicy(policy))
}

export function useUpdateLeaveRouting() {
  return useLeaveMutation((variables: {
    employeeId: string
    input: { userId?: string | null; supervisorUserId?: string | null }
  }) => updateLeaveRouting(variables.employeeId, variables.input))
}

export function useImportLegacyLeaveRequests() {
  return useLeaveMutation((leaves: Parameters<typeof importLegacyLeaveRequests>[0]) => importLegacyLeaveRequests(leaves))
}

export function usePreviewLegacyLeaveRequests() {
  return useMutation({
    mutationFn: (leaves: Parameters<typeof previewLegacyLeaveRequests>[0]) => previewLegacyLeaveRequests(leaves),
  })
}
