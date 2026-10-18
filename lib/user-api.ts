import type { CompanyProfile } from './erp'

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
