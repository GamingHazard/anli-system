"use client";

import { useParams } from "next/navigation";
import { hasAnyDepartmentRole } from "@/lib/authorization";
import {
  EmployeeDetails,
  EmployeeDirectory,
} from "@/features/employees/legacy-screens";
import { useWorkspace } from "@/features/workspace/workspace-context";

export function EmployeeDirectoryRoute() {
  const {
    state,
    updateState,
    employeesLoaded,
    employeeLoadError,
    currentUser,
    retryEmployees,
    openEmployee,
    addEmployee,
  } = useWorkspace();

  return (
    <EmployeeDirectory
      state={state}
      updateState={updateState}
      loading={!employeesLoaded}
      loadError={employeeLoadError}
      currentUser={currentUser}
      onRetry={retryEmployees}
      onView={openEmployee}
      onEmployeeCreated={addEmployee}
    />
  );
}

export function EmployeeDetailsRoute() {
  const params = useParams<{ employeeId: string }>();
  const employeeId = params.employeeId;
  const {
    currentUser,
    state,
    updateState,
    selectedEmployee,
    employeesLoaded,
    employeeLoadError,
    employeeDetailLoading,
    retryEmployees,
    updateEmployee,
    navigateToSection,
    openPayrollRun,
    openSalaryAdvance,
  } = useWorkspace();

  if (!employeesLoaded) {
    return <p role="status" className="p-8 text-sm text-slate-500">Loading employee profile…</p>;
  }
  if (employeeLoadError) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
      >
        {employeeLoadError}
        <button
          type="button"
          onClick={retryEmployees}
          className="ml-3 font-semibold underline"
        >
          Try again
        </button>
      </div>
    );
  }
  if (employeeDetailLoading) {
    return <p role="status" className="p-8 text-sm text-slate-500">Loading employee profile…</p>;
  }
  if (!selectedEmployee || selectedEmployee.id !== employeeId) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm text-slate-600">
          Select an employee profile from the directory.
        </p>
        <button
          type="button"
          onClick={() => navigateToSection("Employee Profiles")}
          className="mt-3 text-sm font-semibold text-primary"
        >
          Back to employee directory
        </button>
      </section>
    );
  }

  return (
    <EmployeeDetails
      employee={selectedEmployee}
      state={state}
      updateState={updateState}
      canManage={hasAnyDepartmentRole(currentUser.roles, [
        "Admin",
        "Human Resource",
      ])}
      canReadAdvances={hasAnyDepartmentRole(currentUser.roles, [
        "Admin",
        "Human Resource",
        "General Manager",
      ])}
      canReadDisciplinary={hasAnyDepartmentRole(currentUser.roles, [
        "Human Resource",
        "General Manager",
      ])}
      onEmployeeUpdated={updateEmployee}
      onBack={() => navigateToSection("Employee Profiles")}
      onViewPayrollRun={openPayrollRun}
      onViewAdvance={openSalaryAdvance}
    />
  );
}
