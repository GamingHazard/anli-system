import type { UserAccount, UserRole } from '@/lib/user-api'
import { sectionForPath } from '@/lib/app-routes'

const salesSections = new Set([
  'Sales',
  'Credit Sales',
  'Orders',
  'Invoicing',
  'Receipt Management',
  'Customer Management',
])
const hrSections = new Set([
  'Employee Profiles',
  'Attendance Management',
  'Payroll Management',
  'Salary Advance Management',
  'Leave Management',
  'Disciplinary Letters',
])
const inventorySections = new Set([
  'Raw Material Management',
  'Production Management',
  'Assets Management',
  'Data Backup',
])
const overviewSections = new Set([
  'Dashboard',
  'Approvals',
  'Auditing',
  'Analysis',
])
const settingsSections = new Set([
  'Company Profile Management',
  'User Management',
  'Security Settings',
])

export function hasDepartmentRole(roles: readonly UserRole[], requiredRole: UserRole) {
  return roles.includes('Super Admin') || roles.includes(requiredRole)
}

export function hasAnyDepartmentRole(roles: readonly UserRole[], requiredRoles: readonly UserRole[]) {
  return roles.includes('Super Admin') || roles.some((role) => requiredRoles.includes(role))
}

export function canAccessSection(roles: readonly UserRole[], section: string) {
  if (section === 'Employee Profile Details') section = 'Employee Profiles'
  if (section === 'Customer Details') section = 'Customer Management'
  if (roles.includes('Super Admin')) return true
  if (settingsSections.has(section)) {
    if (section === 'User Management') {
      return roles.some((role) => ['General Manager', 'Human Resource'].includes(role))
    }
    return roles.includes('General Manager') && section === 'Company Profile Management'
  }
  if (overviewSections.has(section)) {
    return roles.some((role) => ['Admin', 'General Manager'].includes(role))
  }
  if (section === 'Expenses') {
    return roles.some((role) => ['Admin', 'General Manager', 'Accountant'].includes(role))
  }
  if (salesSections.has(section)) {
    return roles.some((role) =>
      section === 'Orders' || section === 'Customer Management'
        ? ['Admin', 'General Manager', 'Sales Manager', 'Marketing Manager'].includes(role)
        : ['Admin', 'General Manager', 'Sales Manager'].includes(role),
    )
  }
  if (hrSections.has(section)) {
    if (roles.includes('Admin') || roles.includes('Human Resource')) return true
    if (roles.includes('General Manager')) {
      return [
        'Employee Profiles',
        'Payroll Management',
        'Salary Advance Management',
        'Leave Management',
        'Disciplinary Letters',
      ].includes(section)
    }
    return false
  }
  if (inventorySections.has(section)) {
    if (roles.includes('Admin') || roles.includes('General Manager') || roles.includes('Inventory Manager')) {
      return true
    }
    return section === 'Production Management' && roles.includes('Production Manager')
  }
  return false
}

export function canAccessPath(roles: readonly UserRole[], pathname: string) {
  const section = sectionForPath(pathname)
  return section ? canAccessSection(roles, section) : false
}

export function defaultPathForRoles(roles: readonly UserRole[]) {
  if (roles.includes('Super Admin') || roles.includes('Admin') || roles.includes('General Manager')) {
    return '/dashboard'
  }
  if (roles.includes('Sales Manager')) return '/sales'
  if (roles.includes('Marketing Manager')) return '/customers'
  if (roles.includes('Human Resource')) return '/employees'
  if (roles.includes('Accountant')) return '/expenses'
  if (roles.includes('Inventory Manager')) return '/inventory/materials'
  if (roles.includes('Production Manager')) return '/inventory/production'
  return '/'
}

export function creatableRolesForAccountManager(roles: readonly UserRole[]): UserRole[] {
  if (roles.includes('Super Admin')) return ['Admin', 'General Manager']
  if (roles.includes('General Manager')) return ['Human Resource']
  if (roles.includes('Human Resource')) {
    return [
      'Human Resource',
      'Marketing Manager',
      'Sales Manager',
      'Production Manager',
      'Inventory Manager',
      'Accountant',
    ]
  }
  return []
}

export function canManageAccount(currentUser: UserAccount, account: UserAccount) {
  if (currentUser.id === account.id) return false
  const roles = currentUser.roles
  const targetRoles = account.roles
  if (roles.includes('Super Admin')) {
    return targetRoles.some((role) => ['Admin', 'General Manager'].includes(role))
      && targetRoles.every((role) => ['Admin', 'General Manager'].includes(role))
  }
  if (roles.includes('General Manager')) {
    return targetRoles.includes('Human Resource') && targetRoles.length === 1
  }
  if (roles.includes('Human Resource')) {
    return targetRoles.length > 0
      && targetRoles.every((role) => !['Super Admin', 'Admin', 'General Manager'].includes(role))
  }
  return false
}

export function canCreateOrders(roles: readonly UserRole[]) {
  return roles.includes('Marketing Manager')
    || roles.includes('Sales Manager')
    || roles.includes('General Manager')
    || roles.includes('Super Admin')
}
