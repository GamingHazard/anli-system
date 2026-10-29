"use client";

import PayrollManagementPage from "@/components/payroll-management";
import { useWorkspace } from "@/features/workspace/workspace-context";

export default function PayrollPage() {
  const { state, currentUser, selectedPayrollRunId } = useWorkspace();
  return (
    <PayrollManagementPage
      state={state}
      currentUser={currentUser}
      initialRunId={selectedPayrollRunId}
    />
  );
}
