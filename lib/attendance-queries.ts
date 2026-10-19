import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { listAttendance, saveDailyAttendance } from './user-api'
import type { AttendanceRecord } from './erp'

export const attendanceQueryKeys = {
  all: ['attendance'] as const,
  month: (month: string, employeeId?: string) => ['attendance', 'month', month, employeeId ?? null] as const,
}

export function useAttendanceMonth(month: string, employeeId?: string, enabled = true) {
  return useQuery({
    queryKey: attendanceQueryKeys.month(month, employeeId),
    queryFn: () => listAttendance(month, employeeId),
    enabled: enabled && /^\d{4}-\d{2}$/.test(month),
  })
}

export function useAttendanceYear(year: number, enabled = true) {
  const months = Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}`)
  const queries = useQueries({
    queries: months.map((month) => ({
      queryKey: attendanceQueryKeys.month(month),
      queryFn: () => listAttendance(month),
      enabled,
    })),
  })
  return {
    records: queries.flatMap((query) => query.data?.records ?? []),
    isLoading: enabled && queries.some((query) => query.isLoading),
    isError: queries.some((query) => query.isError),
    error: queries.find((query) => query.error)?.error,
    refetch: () => Promise.all(queries.map((query) => query.refetch())),
  }
}

export function useSaveDailyAttendance() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ workDate, entries }: {
      workDate: string
      entries: Array<Pick<AttendanceRecord, 'employeeId' | 'status' | 'halfDay' | 'late' | 'note'>>
    }) => saveDailyAttendance(workDate, entries),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: attendanceQueryKeys.all }),
  })
}
