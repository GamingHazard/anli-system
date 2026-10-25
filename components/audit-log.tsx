'use client'

import AuditWorkspace from '@/components/audit-workspace'
import type { UserAccount } from '@/lib/user-api'

export default function AuditLogPanel({
  currentUser,
  targetUserId,
}: {
  currentUser: UserAccount
  targetUserId?: string
}) {
  return <AuditWorkspace currentUser={currentUser} targetUserId={targetUserId} />
}
