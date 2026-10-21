import { employeeDisplayName, type AdvanceRepaymentMethod, type AdvanceRepaymentFrequency, type AttendanceRecord, type AttendanceStatus, type CompanyProfile, type Employee, type EmployeeDraft, type EmployeeDocument, type LeaveRequest, type LeaveType, type SalaryAdvance } from './erp'

export const USER_ROLES = [
  'Super Admin',
  'Admin',
  'General Manager',
  'Human Resource',
  'Marketing Manager',
  'Sales Manager',
  'Production Manager',
  'Inventory Manager',
  'Accountant',
] as const

export type UserRole = (typeof USER_ROLES)[number]
export type AccountStatus = 'Active' | 'Suspended' | 'Deactivated'

export type UserAccount = {
  id: string
  name: string
  email: string
  roles: UserRole[]
  status: AccountStatus
  createdAt: string
  updatedAt?: string
  lastActive?: string
  suspensionReason?: string
  mustChangePassword: boolean
}

export type ActiveSession = {
  id: string
  userAgent: string
  createdAt: string
  lastActivityAt: string
  idleTimeoutMs: number
  warningPeriodMs: number
  idleExpiresAt: string
  absoluteExpiresAt: string
  current: boolean
}

export type SessionProtectionSettings = {
  privilegedIdle: number
  generalIdle: number
  warningPeriod: number
}

export type CompanyLogo = { url: string; publicId: string }
export type PublicCompanyBrand = { companyName: string; logoUrl: string }

export const AUDIT_EVENT_TYPES = [
  'auth.login.succeeded',
  'auth.login.failed',
  'auth.login.rejected_suspended',
  'auth.login.rejected_deactivated',
  'auth.login.temporary_password_expired',
  'auth.logout',
  'auth.password_changed',
  'account.created',
  'account.updated',
  'account.status_changed',
  'account.password_reset',
  'session.revoked',
  'session.idle_expired',
  'session.absolute_expired',
  'security.session_policy_updated',
  'security.authorization_denied',
  'company.profile_updated',
  'leave.policy_updated',
  'leave.routing_updated',
  'leave.requested',
  'leave.approved',
  'leave.rejected',
  'leave.cancelled',
  'leave.amendment_requested',
  'leave.amendment_approved',
  'leave.amendment_rejected',
  'leave.return_confirmed',
  'leave.legacy_imported',
] as const

export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number]
export type AuditEvent = {
  id: string
  eventType: AuditEventType
  outcome: 'success' | 'failure' | 'denied'
  reason?: string
  actor: { id: string; name?: string; roles: UserRole[] } | null
  target: { id: string; name?: string; email?: string } | null
  sessionId: string | null
  ipAddress?: string
  userAgent?: string
  details: Record<string, unknown>
  createdAt: string
}

export type AuditFilters = {
  eventType?: AuditEventType
  outcome?: AuditEvent['outcome']
  actorId?: string
  targetUserId?: string
  from?: string
  to?: string
  limit?: number
  cursor?: string
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message)
    this.name = 'ApiError'
  }
}

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '')

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      credentials: 'include',
      cache: 'no-store',
      headers: {
        ...(init.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    })
  } catch {
    throw new ApiError('Could not reach the server. Check that the API is running and try again.', 0)
  }

  if (response.status === 204) return undefined as T
  const body = await response.json().catch(() => ({})) as { error?: string; code?: string }
  if (!response.ok) {
    throw new ApiError(body.error || 'The request could not be completed.', response.status, body.code)
  }
  return body as T
}

export function getPublicCompanyBrand() {
  return request<PublicCompanyBrand>('/profile-settings/public-brand')
}

export function getCompanyProfile() {
  return request<{ profile: CompanyProfile }>('/profile-settings')
}

export function updateCompanyProfile(profile: Omit<CompanyProfile, 'logo'>) {
  return request<{ profile: CompanyProfile }>('/profile-settings', {
    method: 'PUT',
    body: JSON.stringify(profile),
  })
}

export function uploadCompanyLogo(file: File) {
  const body = new FormData()
  body.set('logo', file)
  return request<{ logo: CompanyLogo }>('/profile-settings/logo', {
    method: 'POST',
    body,
  })
}

export function removeCompanyLogo() {
  return request<{ logo: CompanyLogo }>('/profile-settings/logo', { method: 'DELETE' })
}

export type EmployeeDraftRecord = {
  id: string
  employee: Partial<Employee>
  currentStep: number
  updatedAt: string
}

function normalizeEmployee(employee: Employee): Employee {
  const documents = (employee.documents ?? []).map((document) => {
    const absoluteUrl = document.url.startsWith('http')
      ? document.url
      : `${apiBaseUrl}${document.url}`;
    return { ...document, url: absoluteUrl, download_Url: absoluteUrl }
  })
  return {
    ...employee,
    dateOfBirth: employee.dateOfBirth?.slice(0, 10),
    image: employee.image ?? {
      url: employee.photoUrl ?? '',
      publicId: '',
    },
    photoUrl: employee.image?.url ?? employee.photoUrl ?? '',
    documents,
    salary: employee.salary ?? 0,
  }
}

export async function listEmployees(filters: {
  q?: string
  department?: string
  category?: string
  frequency?: string
  status?: string
} = {}) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value) search.set(key, value)
  }
  const suffix = search.size ? `?${search.toString()}` : ''
  const result = await request<{ employees: Employee[]; limited: boolean }>(`/employees${suffix}`)
  return { ...result, employees: result.employees.map(normalizeEmployee) }
}

export async function getEmployee(id: string) {
  const result = await request<{ employee: Employee; limited: boolean }>(`/employees/${encodeURIComponent(id)}`)
  return { ...result, employee: normalizeEmployee(result.employee) }
}

export async function createEmployee(employee: Omit<Employee, 'id' | 'number' | 'documents' | 'image' | 'photoUrl'>) {
  const result = await request<{ employee: Employee }>('/employees', {
    method: 'POST',
    body: JSON.stringify(employee),
  })
  return normalizeEmployee(result.employee)
}

export async function updateEmployee(id: string, employee: Partial<Employee>) {
  const result = await request<{ employee: Employee }>(`/employees/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(employee),
  })
  return normalizeEmployee(result.employee)
}

export async function deactivateEmployee(id: string) {
  const result = await request<{ employee: Employee }>(`/employees/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  return normalizeEmployee(result.employee)
}

export function uploadEmployeeImage(id: string, file: File) {
  const body = new FormData()
  body.set('image', file)
  return request<{ image: { url: string; publicId: string } }>(`/employees/${encodeURIComponent(id)}/image`, {
    method: 'POST',
    body,
  })
}

export function removeEmployeeImage(id: string) {
  return request<{ image: { url: string; publicId: string } }>(`/employees/${encodeURIComponent(id)}/image`, {
    method: 'DELETE',
  })
}

export function uploadEmployeeDocument(id: string, title: string, file: File) {
  const body = new FormData()
  body.set('title', title)
  body.set('document', file)
  return request<{ document: EmployeeDocument }>(`/employees/${encodeURIComponent(id)}/documents`, {
    method: 'POST',
    body,
  })
}

export function removeEmployeeDocument(employeeId: string, documentId: string) {
  return request<{ removed: boolean }>(
    `/employees/${encodeURIComponent(employeeId)}/documents/${encodeURIComponent(documentId)}`,
    { method: 'DELETE' },
  )
}

export function getEmployeeDocumentDownload(employeeId: string, documentId: string) {
  return request<{ url: string; expiresInSeconds: number }>(
    `/employees/${encodeURIComponent(employeeId)}/documents/${encodeURIComponent(documentId)}/download`,
  )
}

export function listEmployeeDrafts() {
  return request<{ drafts: EmployeeDraftRecord[] }>('/employees/drafts')
}

export function saveEmployeeDraft(draft: EmployeeDraft) {
  return request<{ draft: EmployeeDraftRecord }>(`/employees/drafts/${encodeURIComponent(draft.id)}`, {
    method: 'PUT',
    body: JSON.stringify({ employee: draft.employee, currentStep: draft.currentStep }),
  })
}

export function deleteEmployeeDraft(id: string) {
  return request<{ removed: boolean }>(`/employees/drafts/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function importLocalEmployees(employees: Array<{ migrationKey: string; employee: Record<string, unknown> }>) {
  return request<{
    imported: number
    alreadyImported: number
    failed: number
    results: Array<{ index: number; migrationKey?: string; status: string; error?: string; employeeId?: string }>
  }>('/employees/import', {
    method: 'POST',
    body: JSON.stringify({ employees }),
  })
}

export async function listAttendance(month: string, employeeId?: string) {
  const search = new URLSearchParams({ month })
  if (employeeId) search.set('employeeId', employeeId)
  const result = await request<{ records: AttendanceRecord[] }>(`/attendance?${search.toString()}`)
  return {
    records: result.records.map((record) => ({
      ...record,
      id: String(record.id),
      employeeId: String(record.employeeId),
      status: record.status as AttendanceStatus,
      updatedAt: String(record.updatedAt),
    })),
  }
}

export function saveDailyAttendance(
  workDate: string,
  entries: Array<Pick<AttendanceRecord, 'employeeId' | 'status' | 'halfDay' | 'late' | 'note'>>,
) {
  return request<{ records: AttendanceRecord[] }>(`/attendance/daily/${encodeURIComponent(workDate)}`, {
    method: 'PUT',
    body: JSON.stringify({ entries }),
  })
}

export type LeavePolicy = {
  workingDays: number[]
  holidays: string[]
  leaveYearStart: string
  entitlements: Partial<Record<LeaveType, number>>
  carryoverEnabled: boolean
  carryoverLimit: number
  reminderThresholds: {
    pendingApprovalBusinessDays: number
    beforeStartDays: number[]
    onStartDate: boolean
    returnFollowUp: boolean
  }
}

export type LeaveRoutingEmployee = {
  id: string
  name: string
  number: string
  department: string
  role: string
  userId: string | null
  supervisorUserId: string | null
}

export type LeaveRoutingUser = {
  id: string
  name: string
  email: string
  roles: UserRole[]
}

export type LeaveRequestInput = {
  employeeId?: string
  leaveType: LeaveType
  otherLeaveType?: string
  reason: string
  startDate: string
  endDate: string
  handoverEmployeeId: string
  handoverContact?: string
}

export type LegacyLeaveArchiveRecord = {
  id: string
  reference: string
  employeeNumber: string
  employeeName: string
  department: string
  role: string
  leaveType: LeaveType
  otherLeaveType: string
  reason: string
  startDate: string
  endDate: string
  requestedDays: number
  handoverName: string
  handoverContact: string
  originalStatus: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled' | 'Unknown'
  createdAt: string
}

export type LegacyLeaveImportPreview = {
  records: Array<{
    index: number
    reference: string
    employeeName?: string
    originalStatus?: LegacyLeaveArchiveRecord['originalStatus']
    employeeMatched: boolean
    importable: boolean
    duplicate: boolean
    reason: string
  }>
  importableCount: number
  duplicateCount: number
}

function legacyLeaveImportPayload(leaves: LeaveRequest[]) {
  return leaves.map((leave) => ({
    id: leave.id,
    reference: leave.reference,
    employeeNumber: leave.employeeNumber,
    employeeName: leave.employeeName,
    department: leave.department,
    role: leave.role,
    leaveType: leave.leaveType,
    otherLeaveType: leave.otherLeaveType,
    reason: leave.reason,
    startDate: leave.startDate,
    endDate: leave.endDate,
    handoverName: leave.handoverName,
    handoverContact: leave.handoverContact,
    status: leave.status,
    requestedAt: leave.requestedAt,
  }))
}

export function listLegacyLeaveArchive() {
  return request<{ records: LegacyLeaveArchiveRecord[] }>('/leave/legacy-archive')
}

export function previewLegacyLeaveRequests(leaves: LeaveRequest[]) {
  return request<LegacyLeaveImportPreview>('/leave/legacy-import/preview', {
    method: 'POST',
    body: JSON.stringify({ leaves: legacyLeaveImportPayload(leaves) }),
  })
}

export function importLegacyLeaveRequests(leaves: LeaveRequest[]) {
  return request<{
    imported: LegacyLeaveArchiveRecord[]
    skipped: Array<{ index: number; reference: string; reason: string }>
  }>('/leave/legacy-import', {
    method: 'POST',
    body: JSON.stringify({ leaves: legacyLeaveImportPayload(leaves) }),
  })
}

function normalizeLeaveRequest(request: LeaveRequest): LeaveRequest {
  const raw = request as LeaveRequest & Record<string, unknown>
  const decisions = (raw.decisions ?? []).map((entry) => {
    const decision = entry as LeaveRequest['decisions'][number] & { actorId?: string; actorName?: string; _id?: string; id?: string }
    return {
      ...decision,
      id: String(decision.id || decision._id || ''),
      actor: decision.actorName || decision.actor || 'Administrator',
      at: typeof decision.at === 'string' ? decision.at : new Date(String(decision.at)).toISOString(),
    }
  })
  const employee = raw.employeeId && typeof raw.employeeId === 'object'
    ? raw.employeeId as Employee & { _id?: string; phone?: string }
    : undefined
  const referenceId = (value: unknown) => value && typeof value === 'object'
    ? String((value as { id?: string; _id?: string }).id || (value as { _id?: string })._id || '')
    : String(value || '')
  return {
    ...request,
    id: String(raw.id || raw._id || ''),
    employeeId: String(employee?.id || employee?._id || referenceId(raw.employeeId)),
    employeeName: String(raw.employeeName || employeeDisplayName(employee ?? {})),
    employeeNumber: String(raw.employeeNumber || employee?.number || ''),
    department: String(raw.department || employee?.department || ''),
    role: String(raw.role || employee?.role || ''),
    employeeContact: String(raw.employeeContact || employee?.phone || ''),
    handoverEmployeeId: String(raw.handoverEmployeeId || ''),
    handoverName: String(raw.handoverName || ''),
    handoverContact: String(raw.handoverContact || ''),
    requestedAt: String(raw.requestedAt || raw.createdAt || ''),
    updatedAt: String(raw.updatedAt || raw.createdAt || ''),
    requesterUserId: referenceId(raw.requesterUserId),
    approverUserId: referenceId(raw.approverUserId),
    decisions,
    amendments: (raw.amendments ?? []).map((item) => {
      const amendment = item as NonNullable<LeaveRequest['amendments']>[number] & { _id?: string; id?: string }
      return { ...amendment, id: String(amendment.id || amendment._id || '') }
    }),
  }
}

export async function listLeaveRequests(filters: { status?: LeaveRequest['status'] } = {}) {
  const query = filters.status ? `?status=${encodeURIComponent(filters.status)}` : ''
  const result = await request<{ requests: LeaveRequest[] }>(`/leave${query}`)
  return { requests: result.requests.map(normalizeLeaveRequest) }
}

export async function createLeaveRequest(input: LeaveRequestInput) {
  const result = await request<{ request: LeaveRequest }>('/leave', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return normalizeLeaveRequest(result.request)
}

export async function decideLeaveRequest(id: string, input: { decision: 'Approved' | 'Rejected'; note?: string }) {
  const result = await request<{ request: LeaveRequest }>(`/leave/${encodeURIComponent(id)}/decision`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return normalizeLeaveRequest(result.request)
}

export async function cancelLeaveRequest(id: string, note: string) {
  const result = await request<{ request: LeaveRequest }>(`/leave/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  })
  return normalizeLeaveRequest(result.request)
}

export async function createLeaveAmendment(id: string, input: { startDate: string; endDate: string; reason: string }) {
  const result = await request<{ request: LeaveRequest }>(`/leave/${encodeURIComponent(id)}/amendments`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return normalizeLeaveRequest(result.request)
}

export async function decideLeaveAmendment(id: string, amendmentId: string, input: { decision: 'Approved' | 'Rejected'; note?: string }) {
  const result = await request<{ request: LeaveRequest }>(`/leave/${encodeURIComponent(id)}/amendments/${encodeURIComponent(amendmentId)}/decision`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return normalizeLeaveRequest(result.request)
}

export async function confirmLeaveReturn(id: string, actualDate: string) {
  const result = await request<{ request: LeaveRequest }>(`/leave/${encodeURIComponent(id)}/return-confirmation`, {
    method: 'POST',
    body: JSON.stringify({ actualDate }),
  })
  return normalizeLeaveRequest(result.request)
}

export async function getLeavePolicy() {
  return request<{ policy: LeavePolicy }>('/leave/policy')
}

export async function updateLeavePolicy(policy: Partial<LeavePolicy>) {
  return request<{ policy: LeavePolicy }>('/leave/policy', {
    method: 'PUT',
    body: JSON.stringify(policy),
  })
}

export function listLeavePeople() {
  return request<{ employees: LeaveRoutingEmployee[]; users: LeaveRoutingUser[] }>('/leave/people')
}

export function updateLeaveRouting(employeeId: string, input: { userId?: string | null; supervisorUserId?: string | null }) {
  return request<{ employee: Pick<LeaveRoutingEmployee, 'id' | 'userId' | 'supervisorUserId'> }>(
    `/leave/people/${encodeURIComponent(employeeId)}/routing`,
    { method: 'PUT', body: JSON.stringify(input) },
  )
}

export async function listLeaveBalances() {
  return request<{ balances: Array<{
    employeeId: string
    employeeName: string
    employeeNumber: string
    department: string
    leaveYear: { start: string; end: string }
    byType: Record<LeaveType, { configured: boolean; entitlement: number | null; carryover: number; used: number; pending: number; available: number | null }>
  }> }>('/leave/balances')
}

export async function listLeaveReminderCandidates() {
  return request<{ candidates: Array<{ key: string; type: string; dueDate: string; requestId: string; recipientUserId: string }> }>('/leave/reminder-candidates')
}

export type DisciplinaryLetterType = 'Written warning' | 'Suspension' | 'Termination'
export type DisciplinaryCaseStatus =
  | 'Draft'
  | 'Under investigation'
  | 'Awaiting employee response'
  | 'Pending Human Resource approval'
  | 'Pending General Manager approval'
  | 'Pending Super Admin approval'
  | 'Changes requested'
  | 'Approved'
  | 'Issued'
  | 'Closed'
  | 'Rescinded'

export type DisciplinaryApproverStage = 'Human Resource' | 'General Manager' | 'Super Admin'
export type DisciplinaryApproverAssignments = {
  humanResource: string
  generalManager: string
  superAdmin: string
}

export type DisciplinaryCase = {
  id: string
  reference: string
  employeeId: string
  employeeName: string
  employeeNumber: string
  department: string
  role: string
  type: DisciplinaryLetterType
  status: DisciplinaryCaseStatus
  incidentDate: string
  allegation: string
  reason?: string
  expectations?: string
  reviewDate?: string
  suspensionStartDate?: string
  suspensionEndDate?: string
  returnDate?: string
  suspensionPayStatus?: 'Paid' | 'Unpaid' | 'Not specified'
  conditions?: string
  effectiveDate?: string
  noticeDetails?: string
  handoverDetails?: string
  signatory?: string
  responseRequired: boolean
  responseDueDate?: string
  responseNotice?: string
  response?: { text: string; submittedAt: string; submittedBy: string; source: 'Employee portal' | 'In person' | 'Written externally' }
  responseHistory?: Array<{ text: string; submittedAt: string; submittedBy: string; source: 'Employee portal' | 'In person' | 'Written externally' }>
  noResponseRecordedAt?: string
  noResponseNote?: string
  assignedApprovers?: DisciplinaryApproverAssignments
  approvals?: Array<{ id: string; round: number; stage: DisciplinaryApproverStage; decision: 'Approved' | 'Rejected'; actorId: string; actorName: string; note: string; decidedAt: string }>
  approvalRound?: number
  evidence?: Array<{ id: string; name: string; mediaType: string; sizeBytes: number; uploadedBy: string; uploadedAt: string }>
  acknowledgements?: Array<{ id: string; status: 'Received' | 'Declined' | 'Disputed'; note: string; actorId: string; recordedAt: string }>
  appeals?: Array<{ id: string; text: string; submittedAt: string; resolution?: 'Upheld' | 'Varied' | 'Overturned'; resolutionNote?: string }>
  issuedAt?: string
  issuedLetterVersion?: number
  letterVersion?: number
  rescindReason?: string
  createdAt?: string
  updatedAt?: string
}

export type DisciplinaryCaseInput = {
  employeeId: string
  type: DisciplinaryLetterType
  incidentDate: string
  allegation: string
  reason: string
  expectations?: string
  reviewDate?: string
  suspensionStartDate?: string
  suspensionEndDate?: string
  returnDate?: string
  suspensionPayStatus?: 'Paid' | 'Unpaid' | 'Not specified'
  conditions?: string
  effectiveDate?: string
  noticeDetails?: string
  handoverDetails?: string
  signatory: string
  responseRequired?: boolean
  responseDueDate?: string
  assignedApprovers: DisciplinaryApproverAssignments
}

export type DisciplinaryPolicy = {
  responseRules: Record<DisciplinaryLetterType, { required: boolean; responseWindowDays: number }>
}

export type DisciplinaryIndicator = {
  type: DisciplinaryLetterType
  label: string
  icon: 'flag-outline' | 'flag-filled' | 'user-x'
  reference: string
}

export async function listDisciplinaryCases() {
  return request<{ cases: DisciplinaryCase[] }>('/disciplinary-cases')
}

export async function listMyDisciplinaryCases() {
  return request<{ cases: DisciplinaryCase[] }>('/disciplinary-cases/my-cases')
}

export async function getDisciplinaryCase(id: string) {
  return request<{ case: DisciplinaryCase }>(`/disciplinary-cases/${encodeURIComponent(id)}`)
}

export async function getDisciplinaryApproverCandidates() {
  return request<{ candidates: Record<DisciplinaryApproverStage, Array<{ id: string; name: string; role: DisciplinaryApproverStage }>> }>('/disciplinary-cases/approvers')
}

export async function getDisciplinaryPolicy() {
  return request<{ policy: DisciplinaryPolicy }>('/disciplinary-cases/policy')
}

export async function updateDisciplinaryPolicy(policy: DisciplinaryPolicy) {
  return request<{ policy: DisciplinaryPolicy }>('/disciplinary-cases/policy', {
    method: 'PUT',
    body: JSON.stringify(policy),
  })
}

export async function listDisciplinaryIndicators() {
  return request<{ indicators: Record<string, DisciplinaryIndicator[]> }>('/disciplinary-cases/employee-indicators')
}

export async function createDisciplinaryCase(input: DisciplinaryCaseInput) {
  return request<{ case: DisciplinaryCase }>('/disciplinary-cases', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateDisciplinaryCase(id: string, input: Partial<DisciplinaryCaseInput>) {
  return request<{ case: DisciplinaryCase }>(`/disciplinary-cases/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export async function requestDisciplinaryResponse(id: string, responseNotice: string, responseDueDate: string) {
  return request<{ case: DisciplinaryCase }>(`/disciplinary-cases/${encodeURIComponent(id)}/response-request`, {
    method: 'POST',
    body: JSON.stringify({ responseNotice, responseDueDate }),
  })
}

export async function submitDisciplinaryEmployeeResponse(id: string, text: string) {
  return request<{ case: DisciplinaryCase }>(`/disciplinary-cases/my-cases/${encodeURIComponent(id)}/responses`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  })
}

export async function recordDisciplinaryOfflineResponse(id: string, text: string, source: 'In person' | 'Written externally') {
  return request<{ case: DisciplinaryCase }>(`/disciplinary-cases/${encodeURIComponent(id)}/response-record`, {
    method: 'POST',
    body: JSON.stringify({ text, source }),
  })
}

export async function recordDisciplinaryNoResponse(id: string, note: string) {
  return request<{ case: DisciplinaryCase }>(`/disciplinary-cases/${encodeURIComponent(id)}/no-response`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  })
}

export async function submitDisciplinaryCaseForApproval(id: string) {
  return request<{ case: DisciplinaryCase }>(`/disciplinary-cases/${encodeURIComponent(id)}/submit`, { method: 'POST' })
}

export async function decideDisciplinaryApproval(id: string, decision: 'Approved' | 'Rejected', note = '') {
  return request<{ case: DisciplinaryCase }>(`/disciplinary-cases/${encodeURIComponent(id)}/approvals`, {
    method: 'POST',
    body: JSON.stringify({ decision, note }),
  })
}

export async function issueDisciplinaryCase(id: string) {
  return request<{ case: DisciplinaryCase }>(`/disciplinary-cases/${encodeURIComponent(id)}/issue`, { method: 'POST' })
}

export async function acknowledgeDisciplinaryLetter(id: string, status: 'Received' | 'Declined' | 'Disputed', note = '') {
  return request<{ case: DisciplinaryCase }>(`/disciplinary-cases/my-cases/${encodeURIComponent(id)}/acknowledgements`, {
    method: 'POST',
    body: JSON.stringify({ status, note }),
  })
}

export async function submitDisciplinaryAppeal(id: string, text: string) {
  return request<{ case: DisciplinaryCase }>(`/disciplinary-cases/my-cases/${encodeURIComponent(id)}/appeals`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  })
}

export async function resolveDisciplinaryAppeal(id: string, appealId: string, resolution: 'Upheld' | 'Varied' | 'Overturned', note: string) {
  return request<{ case: DisciplinaryCase }>(`/disciplinary-cases/${encodeURIComponent(id)}/appeals/${encodeURIComponent(appealId)}/resolution`, {
    method: 'POST',
    body: JSON.stringify({ resolution, note }),
  })
}

export async function rescindDisciplinaryCase(id: string, reason: string) {
  return request<{ case: DisciplinaryCase }>(`/disciplinary-cases/${encodeURIComponent(id)}/rescind`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

export async function uploadDisciplinaryEvidence(id: string, file: File) {
  const body = new FormData()
  body.set('file', file)
  return request<{ case: DisciplinaryCase }>(`/disciplinary-cases/${encodeURIComponent(id)}/evidence`, {
    method: 'POST',
    body,
  })
}

export async function removeDisciplinaryEvidence(id: string, evidenceId: string) {
  return request<{ case: DisciplinaryCase }>(`/disciplinary-cases/${encodeURIComponent(id)}/evidence/${encodeURIComponent(evidenceId)}`, {
    method: 'DELETE',
  })
}

export async function getDisciplinaryEvidenceDownload(id: string, evidenceId: string) {
  return request<{ url: string; expiresInSeconds: number }>(`/disciplinary-cases/${encodeURIComponent(id)}/evidence/${encodeURIComponent(evidenceId)}/download`)
}

function normalizeSalaryAdvance(advance: SalaryAdvance): SalaryAdvance {
  const raw = advance as SalaryAdvance & Record<string, unknown>
  const hr = raw.hrDecision as (SalaryAdvance['hrDecision'] & { _id?: string }) | undefined
  const gm = raw.gmDecision as (SalaryAdvance['gmDecision'] & { _id?: string }) | undefined
  return {
    ...advance,
    id: String(raw.id || raw._id || ''),
    employeeId: raw.employeeId ? String(raw.employeeId) : '',
    requestedAt: typeof raw.requestedAt === 'string' ? raw.requestedAt : new Date(String(raw.requestedAt)).toISOString(),
    dateTaken: String(raw.dateTaken).slice(0, 10),
    dateApproved: typeof raw.dateApproved === 'string' ? raw.dateApproved.slice(0, 10) : undefined,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date(String(raw.createdAt)).toISOString(),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date(String(raw.updatedAt)).toISOString(),
    legacyUnverified: Boolean(raw.legacyUnverified),
    legacyStatus: typeof raw.legacyStatus === 'string' ? raw.legacyStatus : undefined,
    legacyReference: typeof raw.legacyReference === 'string' ? raw.legacyReference : undefined,
    hrDecision: hr ? { ...hr, actorId: String(hr.actorId), decidedAt: new Date(hr.decidedAt).toISOString() } : undefined,
    gmDecision: gm ? { ...gm, actorId: String(gm.actorId), decidedAt: new Date(gm.decidedAt).toISOString() } : undefined,
    decisionAt: gm?.decidedAt || hr?.decidedAt,
    decisionBy: gm?.actorName || hr?.actorName,
    attachments: (raw.attachments || []).map((attachment) => {
      const item = attachment as typeof advance.attachments[number] & { _id?: string; uploadedBy?: string }
      return { ...item, id: String(item.id || item._id || ''), url: String(item.url || ''), dataUrl: undefined }
    }),
    schedule: (raw.schedule || []).map((entry) => {
      const item = entry as SalaryAdvance['schedule'][number] & { _id?: string }
      return { ...item, id: String(item.id || item._id || ''), dueDate: String(item.dueDate).slice(0, 10) }
    }),
    repayments: (raw.repayments || []).map((repayment) => {
      const item = repayment as SalaryAdvance['repayments'][number] & { _id?: string }
      return {
        ...item,
        id: String(item.id || item._id || ''),
        date: String(item.date).slice(0, 10),
        recordedAt: typeof item.recordedAt === 'string' ? item.recordedAt : new Date(String(item.recordedAt)).toISOString(),
        scheduleEntryIds: item.scheduleEntryIds?.map(String),
      }
    }),
    activity: (raw.activity || []).map((entry) => {
      const item = entry as SalaryAdvance['activity'][number] & { _id?: string; actorName?: string; actorId?: string }
      return { ...item, id: String(item.id || item._id || ''), actor: item.actorName || 'System', at: typeof item.at === 'string' ? item.at : new Date(String(item.at)).toISOString() }
    }),
  }
}

export type SalaryAdvanceRequestInput = {
  employeeId: string
  requestedAmount: number
  reason: string
  dateTaken: string
  proposedFrequency: AdvanceRepaymentFrequency
  proposedInstallmentAmount: number
}

export type SalaryAdvanceDecisionInput = {
  decision: 'Approved' | 'Rejected'
  note: string
  amount?: number
  frequency?: AdvanceRepaymentFrequency
  installmentAmount?: number
}

export type LegacySalaryAdvanceImportRecord = Pick<
  SalaryAdvance,
  | 'id'
  | 'reference'
  | 'employeeId'
  | 'employeeNumber'
  | 'employeeName'
  | 'department'
  | 'role'
  | 'category'
  | 'paymentFrequency'
  | 'requestedAmount'
  | 'reason'
  | 'dateTaken'
  | 'requestedAt'
  | 'proposedFrequency'
  | 'proposedInstallmentAmount'
  | 'status'
  | 'approvedAmount'
  | 'approvedFrequency'
  | 'approvedInstallmentAmount'
  | 'dateApproved'
  | 'disbursement'
  | 'schedule'
  | 'repayments'
>

export type LegacySalaryAdvanceImportPreview = {
  records: Array<{
    index: number
    reference: string
    employeeName?: string
    employeeMatched: boolean
    importable: boolean
    duplicate: boolean
    reason: string
  }>
  importableCount: number
  duplicateCount: number
}

export function previewLegacySalaryAdvances(advances: LegacySalaryAdvanceImportRecord[]) {
  return request<LegacySalaryAdvanceImportPreview>('/salary-advances/legacy-import/preview', {
    method: 'POST',
    body: JSON.stringify({ advances }),
  })
}

export function importLegacySalaryAdvances(advances: LegacySalaryAdvanceImportRecord[]) {
  return request<{ imported: SalaryAdvance[]; skipped: Array<{ index: number; reference: string; reason: string }> }>('/salary-advances/legacy-import', {
    method: 'POST',
    body: JSON.stringify({ advances }),
  })
}

export async function listSalaryAdvances(filters: { employeeId?: string; status?: string } = {}) {
  const search = new URLSearchParams()
  if (filters.employeeId) search.set('employeeId', filters.employeeId)
  if (filters.status) search.set('status', filters.status)
  const suffix = search.size ? `?${search.toString()}` : ''
  const result = await request<{ advances: SalaryAdvance[] }>(`/salary-advances${suffix}`)
  return { advances: result.advances.map(normalizeSalaryAdvance) }
}

export async function createSalaryAdvance(input: SalaryAdvanceRequestInput) {
  const result = await request<{ advance: SalaryAdvance }>('/salary-advances', { method: 'POST', body: JSON.stringify(input) })
  return normalizeSalaryAdvance(result.advance)
}

export async function decideSalaryAdvanceHr(id: string, input: SalaryAdvanceDecisionInput) {
  const result = await request<{ advance: SalaryAdvance }>(`/salary-advances/${encodeURIComponent(id)}/hr-decision`, { method: 'POST', body: JSON.stringify(input) })
  return normalizeSalaryAdvance(result.advance)
}

export async function decideSalaryAdvanceGeneralManager(id: string, input: SalaryAdvanceDecisionInput) {
  const result = await request<{ advance: SalaryAdvance }>(`/salary-advances/${encodeURIComponent(id)}/gm-decision`, { method: 'POST', body: JSON.stringify(input) })
  return normalizeSalaryAdvance(result.advance)
}

export async function recordSalaryAdvanceDisbursement(id: string, input: { amount: number; date: string; method: Exclude<AdvanceRepaymentMethod, 'Payroll'>; reference?: string }) {
  const result = await request<{ advance: SalaryAdvance }>(`/salary-advances/${encodeURIComponent(id)}/disbursement`, { method: 'POST', body: JSON.stringify(input) })
  return normalizeSalaryAdvance(result.advance)
}

export async function recordSalaryAdvanceRepayment(id: string, input: { amount: number; date: string; method: Exclude<AdvanceRepaymentMethod, 'Payroll'>; reference?: string; note?: string }) {
  const result = await request<{ advance: SalaryAdvance }>(`/salary-advances/${encodeURIComponent(id)}/repayments`, { method: 'POST', body: JSON.stringify(input) })
  return normalizeSalaryAdvance(result.advance)
}

export function uploadSalaryAdvanceAttachment(id: string, file: File) {
  const body = new FormData()
  body.set('file', file)
  return request<{ attachment: SalaryAdvance['attachments'][number] }>(`/salary-advances/${encodeURIComponent(id)}/attachments`, { method: 'POST', body })
}

export function removeSalaryAdvanceAttachment(id: string, attachmentId: string) {
  return request<{ removed: boolean }>(`/salary-advances/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}`, { method: 'DELETE' })
}

export function getSalaryAdvanceAttachmentDownload(id: string, attachmentId: string) {
  return request<{ url: string; expiresInSeconds: number }>(`/salary-advances/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}/download`)
}

export function recordPayrollSalaryAdvanceRepayments(input: { payrollRunId: string; payslipId: string; employeeId: string; periodEnd: string }) {
  return request<{ repayments: Array<{ advanceId: string; advanceReference: string; amount: number; date: string; method: 'Payroll'; id: string; idempotent: boolean }>; idempotent: boolean }>('/salary-advances/payroll-repayments', { method: 'POST', body: JSON.stringify(input) })
}

export function signIn(email: string, password: string) {
  return request<{ user: UserAccount; session: ActiveSession }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export async function getCurrentSession(): Promise<{ user: UserAccount; session: ActiveSession } | null> {
  try {
    return await request<{ user: UserAccount; session: ActiveSession }>('/auth/session')
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
}

export function signOut() {
  return request<void>('/auth/logout', { method: 'POST' })
}

export function changePassword(currentPassword: string, newPassword: string) {
  return request<{ user: UserAccount; session: ActiveSession }>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
}

export function reportSessionActivity() {
  return request<{ session: ActiveSession }>('/sessions/activity', { method: 'POST' })
}

export function listActiveSessions(userId?: string) {
  const path = userId
    ? `/sessions/users/${encodeURIComponent(userId)}`
    : '/sessions'
  return request<{ sessions: ActiveSession[] }>(path)
}

export function revokeActiveSession(sessionId: string) {
  return request<void>(`/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' })
}

export function getSessionProtectionSettings() {
  return request<{ sessionProtection: SessionProtectionSettings }>('/security-settings')
}

export function updateSessionProtectionSettings(settings: SessionProtectionSettings) {
  return request<{ sessionProtection: SessionProtectionSettings }>('/security-settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  })
}

export function listAuditEvents(filters: AuditFilters = {}) {
  const { targetUserId, ...query } = filters
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  const suffix = params.size ? `?${params.toString()}` : ''
  const path = targetUserId
    ? `/audit/users/${encodeURIComponent(targetUserId)}${suffix}`
    : `/audit${suffix}`
  return request<{ events: AuditEvent[]; nextCursor: string | null }>(path)
}

export async function listUsers() {
  const result = await request<{ users: UserAccount[] }>('/users')
  return result.users
}

export function createUser(input: { name: string; email: string; password: string; roles: UserRole[] }) {
  return request<{ user: UserAccount }>('/users', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateUser(id: string, input: { name: string; email: string; roles: UserRole[] }) {
  return request<{ user: UserAccount }>(`/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function updateUserStatus(id: string, status: AccountStatus, suspensionReason?: string) {
  return request<{ user: UserAccount }>(`/users/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, suspensionReason }),
  })
}

export function resetUserPassword(id: string) {
  return request<{ temporaryPassword: string; expiresAt: string; message: string }>(
    `/users/${encodeURIComponent(id)}/reset-password`,
    { method: 'POST' },
  )
}
