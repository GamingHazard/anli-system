"use client";

import { hasAnyDepartmentRole, hasDepartmentRole } from "@/lib/authorization";
import { AttendancePage } from "@/features/attendance/legacy-screens";
import { useWorkspace } from "@/features/workspace/workspace-context";

export default function AttendanceRoute() {
  const { currentUser, state, employeesLoaded, employeeLoadError, retryEmployees } =
    useWorkspace();

  if (
    !hasAnyDepartmentRole(currentUser.roles, ["Admin", "Human Resource"])
  ) {
    return (
      <section
        role="alert"
        className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
      >
        You do not have permission to access attendance records.
      </section>
    );
  }

  return (
    <AttendancePage
      state={state}
      employeesLoaded={employeesLoaded}
      employeeLoadError={employeeLoadError}
      onRetry={retryEmployees}
      canEdit={hasDepartmentRole(currentUser.roles, "Human Resource")}
    />
  );
}
