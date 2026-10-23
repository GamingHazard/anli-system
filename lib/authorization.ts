import type { UserRole } from '@/lib/user-api'

export function hasDepartmentRole(roles: readonly UserRole[], requiredRole: UserRole) {
  return roles.includes('Super Admin') || roles.includes(requiredRole)
}

export function hasAnyDepartmentRole(roles: readonly UserRole[], requiredRoles: readonly UserRole[]) {
  return roles.includes('Super Admin') || roles.some((role) => requiredRoles.includes(role))
}
