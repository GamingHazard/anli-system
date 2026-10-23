import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createExpense,
  decideExpense,
  getExpenseAttachmentDownload,
  importLegacyExpenses,
  listExpenses,
  recordExpensePayment,
  removeExpenseAttachment,
  uploadExpenseAttachment,
} from '@/lib/user-api'
import type { CreateExpenseInput, ExpenseFilters } from '@/lib/expenses'

export const expenseQueryKeys = {
  all: ['expenses'] as const,
  list: (filters: ExpenseFilters) => ['expenses', 'list', filters] as const,
}

export function useExpenses(filters: ExpenseFilters = {}, enabled = true) {
  return useQuery({
    queryKey: expenseQueryKeys.list(filters),
    queryFn: async () => {
      const all = []
      const visited = new Set<string>()
      let cursor = filters.cursor
      do {
        const page = await listExpenses({ ...filters, limit: Math.min(filters.limit ?? 200, 200), cursor })
        all.push(...page.expenses)
        cursor = page.nextCursor || undefined
        if (cursor && visited.has(cursor)) throw new Error('The expense list returned a repeated pagination cursor.')
        if (cursor) visited.add(cursor)
      } while (cursor)
      return { expenses: all, nextCursor: null }
    },
    enabled,
  })
}

function useExpenseMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: expenseQueryKeys.all })
    },
  })
}

export function useCreateExpense() {
  return useExpenseMutation((input: CreateExpenseInput) => createExpense(input))
}

export function useExpenseDecision() {
  return useExpenseMutation((input: { id: string; decision: 'Approved' | 'Rejected'; note: string }) =>
    decideExpense(input.id, { decision: input.decision, note: input.note }))
}

export function useRecordExpensePayment() {
  return useExpenseMutation((input: {
    id: string
    amount: number
    date: string
    method: 'Cash' | 'Bank transfer' | 'Mobile Money' | 'Cheque'
    reference: string
    note: string
  }) => recordExpensePayment(input.id, {
    amount: input.amount,
    date: input.date,
    method: input.method,
    reference: input.reference,
    note: input.note,
  }))
}

export function useUploadExpenseAttachment() {
  return useExpenseMutation((input: { id: string; receipt: File }) => uploadExpenseAttachment(input.id, input.receipt))
}

export function useRemoveExpenseAttachment() {
  return useExpenseMutation((input: { id: string; attachmentId: string }) =>
    removeExpenseAttachment(input.id, input.attachmentId))
}

export function useExpenseAttachmentDownload() {
  return (input: { id: string; attachmentId: string }) =>
    getExpenseAttachmentDownload(input.id, input.attachmentId)
}

export function useImportLegacyExpenses() {
  return useExpenseMutation((expenses: unknown[]) => importLegacyExpenses(expenses))
}
