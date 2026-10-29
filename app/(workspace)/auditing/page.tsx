"use client";

import AuditWorkspace from "@/components/audit-workspace";
import { useWorkspace } from "@/features/workspace/workspace-context";

export default function AuditingPage() {
  const { currentUser } = useWorkspace();
  return <AuditWorkspace currentUser={currentUser} />;
}
