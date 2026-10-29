"use client";

import Approvals from "@/components/approvals";
import { useWorkspace } from "@/features/workspace/workspace-context";

export default function ApprovalsPage() {
  const { currentUser, openPayrollRun, openSalaryAdvance } = useWorkspace();
  return (
    <Approvals
      currentUser={currentUser}
      onViewSalaryAdvance={openSalaryAdvance}
      onViewPayrollRun={openPayrollRun}
    />
  );
}
