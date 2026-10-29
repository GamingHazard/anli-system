"use client";

import SalaryAdvanceManagement from "@/components/salary-advance-management";
import { useWorkspace } from "@/features/workspace/workspace-context";

export default function SalaryAdvancesPage() {
  const { state, currentUser, selectedAdvanceId, openEmployee } = useWorkspace();
  return (
    <SalaryAdvanceManagement
      state={state}
      currentUser={currentUser}
      initialAdvanceId={selectedAdvanceId}
      onViewEmployee={openEmployee}
    />
  );
}
