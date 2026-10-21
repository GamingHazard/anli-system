import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  acknowledgeDisciplinaryLetter,
  createDisciplinaryCase,
  decideDisciplinaryApproval,
  getDisciplinaryApproverCandidates,
  getDisciplinaryPolicy,
  issueDisciplinaryCase,
  listDisciplinaryCases,
  listDisciplinaryIndicators,
  listMyDisciplinaryCases,
  recordDisciplinaryNoResponse,
  recordDisciplinaryOfflineResponse,
  requestDisciplinaryResponse,
  resolveDisciplinaryAppeal,
  rescindDisciplinaryCase,
  submitDisciplinaryAppeal,
  submitDisciplinaryCaseForApproval,
  submitDisciplinaryEmployeeResponse,
  updateDisciplinaryCase,
  updateDisciplinaryPolicy,
  uploadDisciplinaryEvidence,
  removeDisciplinaryEvidence,
  type DisciplinaryApproverAssignments,
  type DisciplinaryCaseInput,
  type DisciplinaryPolicy,
} from './user-api'

export const disciplinaryQueryKeys = {
  all: ['disciplinary'] as const,
  cases: ['disciplinary', 'cases'] as const,
  myCases: ['disciplinary', 'my-cases'] as const,
  approvers: ['disciplinary', 'approvers'] as const,
  policy: ['disciplinary', 'policy'] as const,
  indicators: ['disciplinary', 'indicators'] as const,
}

export function useDisciplinaryCases(enabled = true) {
  return useQuery({
    queryKey: disciplinaryQueryKeys.cases,
    queryFn: listDisciplinaryCases,
    enabled,
  })
}

export function useMyDisciplinaryCases(enabled = true) {
  return useQuery({
    queryKey: disciplinaryQueryKeys.myCases,
    queryFn: listMyDisciplinaryCases,
    enabled,
  })
}

export function useDisciplinaryApprovers(enabled = true) {
  return useQuery({
    queryKey: disciplinaryQueryKeys.approvers,
    queryFn: getDisciplinaryApproverCandidates,
    enabled,
  })
}

export function useDisciplinaryPolicy(enabled = true) {
  return useQuery({
    queryKey: disciplinaryQueryKeys.policy,
    queryFn: getDisciplinaryPolicy,
    enabled,
  })
}

export function useDisciplinaryIndicators(enabled = true) {
  return useQuery({
    queryKey: disciplinaryQueryKeys.indicators,
    queryFn: listDisciplinaryIndicators,
    enabled,
  })
}

function useDisciplinaryMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: disciplinaryQueryKeys.all })
    },
  })
}

export function useCreateDisciplinaryCase() {
  return useDisciplinaryMutation((input: DisciplinaryCaseInput) => createDisciplinaryCase(input))
}

export function useUpdateDisciplinaryCase() {
  return useDisciplinaryMutation((variables: { id: string; input: Partial<DisciplinaryCaseInput> }) =>
    updateDisciplinaryCase(variables.id, variables.input))
}

export function useRequestDisciplinaryResponse() {
  return useDisciplinaryMutation((variables: { id: string; notice: string; dueDate: string }) =>
    requestDisciplinaryResponse(variables.id, variables.notice, variables.dueDate))
}

export function useSubmitDisciplinaryEmployeeResponse() {
  return useDisciplinaryMutation((variables: { id: string; text: string }) =>
    submitDisciplinaryEmployeeResponse(variables.id, variables.text))
}

export function useRecordDisciplinaryNoResponse() {
  return useDisciplinaryMutation((variables: { id: string; note: string }) =>
    recordDisciplinaryNoResponse(variables.id, variables.note))
}

export function useRecordDisciplinaryOfflineResponse() {
  return useDisciplinaryMutation((variables: { id: string; text: string; source: 'In person' | 'Written externally' }) =>
    recordDisciplinaryOfflineResponse(variables.id, variables.text, variables.source))
}

export function useSubmitDisciplinaryCaseForApproval() {
  return useDisciplinaryMutation((id: string) => submitDisciplinaryCaseForApproval(id))
}

export function useDecideDisciplinaryApproval() {
  return useDisciplinaryMutation((variables: { id: string; decision: 'Approved' | 'Rejected'; note?: string }) =>
    decideDisciplinaryApproval(variables.id, variables.decision, variables.note))
}

export function useIssueDisciplinaryCase() {
  return useDisciplinaryMutation((id: string) => issueDisciplinaryCase(id))
}

export function useAcknowledgeDisciplinaryLetter() {
  return useDisciplinaryMutation((variables: { id: string; status: 'Received' | 'Declined' | 'Disputed'; note?: string }) =>
    acknowledgeDisciplinaryLetter(variables.id, variables.status, variables.note))
}

export function useSubmitDisciplinaryAppeal() {
  return useDisciplinaryMutation((variables: { id: string; text: string }) =>
    submitDisciplinaryAppeal(variables.id, variables.text))
}

export function useResolveDisciplinaryAppeal() {
  return useDisciplinaryMutation((variables: { id: string; appealId: string; resolution: 'Upheld' | 'Varied' | 'Overturned'; note: string }) =>
    resolveDisciplinaryAppeal(variables.id, variables.appealId, variables.resolution, variables.note))
}

export function useRescindDisciplinaryCase() {
  return useDisciplinaryMutation((variables: { id: string; reason: string }) =>
    rescindDisciplinaryCase(variables.id, variables.reason))
}

export function useUploadDisciplinaryEvidence() {
  return useDisciplinaryMutation((variables: { id: string; file: File }) =>
    uploadDisciplinaryEvidence(variables.id, variables.file))
}

export function useRemoveDisciplinaryEvidence() {
  return useDisciplinaryMutation((variables: { id: string; evidenceId: string }) =>
    removeDisciplinaryEvidence(variables.id, variables.evidenceId))
}

export function useUpdateDisciplinaryPolicy() {
  return useDisciplinaryMutation((policy: DisciplinaryPolicy) => updateDisciplinaryPolicy(policy))
}

export type { DisciplinaryApproverAssignments }
