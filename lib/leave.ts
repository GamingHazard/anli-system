import type { Employee, LeaveDecision, LeaveRequest, LeaveStatus } from '@/lib/erp'

export function calculateWorkingDays(startDate: string, endDate: string, workingDays = [1, 2, 3, 4, 5, 6], holidays: string[] = []) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || startDate > endDate) return 0
  const cursor = new Date(`${startDate}T12:00:00.000Z`)
  const end = new Date(`${endDate}T12:00:00.000Z`)
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime()) || cursor.toISOString().slice(0, 10) !== startDate || end.toISOString().slice(0, 10) !== endDate) return 0
  const workingDaySet = new Set(workingDays)
  const holidaySet = new Set(holidays)
  let count = 0
  while (cursor <= end) {
    const weekday = cursor.getUTCDay()
    const date = cursor.toISOString().slice(0, 10)
    if (workingDaySet.has(weekday) && !holidaySet.has(date)) count += 1
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return count
}

export function findLeaveConflict(employeeId: string, startDate: string, endDate: string, requests: LeaveRequest[], ignoreId?: string) {
  return requests.find((request) => request.id !== ignoreId && request.employeeId === employeeId
    && ['Pending', 'Approved'].includes(request.status)
    && request.startDate <= endDate && request.endDate >= startDate)
}

export function validateLeaveRequest(input: {
  employee: Employee | undefined
  handover: Employee | undefined
  leaveType: string
  otherLeaveType: string
  reason: string
  startDate: string
  endDate: string
  handoverContact: string
}, requests: LeaveRequest[], workingDays = [1, 2, 3, 4, 5, 6], holidays: string[] = []) {
  if (!input.employee || input.employee.status !== 'Active') return 'Select an active employee.'
  if (!input.handover || input.handover.status !== 'Active') return 'Select an active handover employee.'
  if (!['Annual', 'Sick', 'Maternity/Paternity', 'Compassionate', 'Other'].includes(input.leaveType)) return 'Select a leave type.'
  if (input.leaveType === 'Other' && !input.otherLeaveType.trim()) return 'Specify the other leave type.'
  if (!input.reason.trim()) return 'Enter a reason for leave.'
  if (!input.startDate || !input.endDate) return 'Select both leave dates.'
  if (input.startDate > input.endDate) return 'End date must be on or after start date.'
  if (calculateWorkingDays(input.startDate, input.endDate, workingDays, holidays) === 0) return 'The selected period contains no working days.'
  if (!input.handoverContact.trim()) return 'Enter a handover contact.'
  if (findLeaveConflict(input.employee.id, input.startDate, input.endDate, requests)) return 'This employee already has a pending or approved request for overlapping dates.'
  return ''
}

export function decideLeaveRequest(request: LeaveRequest, decision: Exclude<LeaveStatus, 'Pending'>, actor: string, note = ''): LeaveRequest {
  if (request.status !== 'Pending') return request
  const at = new Date().toISOString()
  const entry: LeaveDecision = { id: `LDEC-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, decision, actor, at, note: note.trim() || undefined }
  return { ...request, status: decision, decisions: [...request.decisions, entry], updatedAt: at }
}

export function leaveBalanceFor(employeeId: string, entitlement: number | undefined, requests: LeaveRequest[]) {
  const employeeRequests = requests.filter((request) => request.employeeId === employeeId)
  const used = employeeRequests.filter((request) => request.status === 'Approved').reduce((total, request) => total + request.requestedDays, 0)
  const pending = employeeRequests.filter((request) => request.status === 'Pending').reduce((total, request) => total + request.requestedDays, 0)
  return { entitlement, used, pending, available: entitlement === undefined ? undefined : entitlement - used }
}