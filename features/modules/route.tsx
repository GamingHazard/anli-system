"use client";

import { ModulePage } from "@/features/modules/legacy-module-page";
import { useWorkspace } from "@/features/workspace/workspace-context";

export default function ModuleRoute({ active }: { active: string }) {
  const workspace = useWorkspace();

  return (
    <ModulePage
      active={active}
      state={workspace.state}
      updateState={workspace.updateState}
      currentUser={workspace.currentUser}
      companyName={workspace.companyName}
      companyLogoUrl={workspace.companyLogoUrl}
      companyProfileEditable={workspace.companyProfileEditable}
      onCompanyProfileSave={workspace.applyCompanyProfile}
      onCurrentSessionRevoked={workspace.handleSessionEnded}
      onViewSalaryAdvance={workspace.openSalaryAdvance}
      onViewPayrollRun={workspace.openPayrollRun}
      onView={(id: string) =>
        active === "Employee Profiles"
          ? workspace.openEmployee(id)
          : workspace.openCustomer(id)
      }
      updateCustomers={workspace.updateCustomers}
      customersLoaded={workspace.customersLoaded}
      customersApiLoaded={workspace.customersApiLoaded}
      customerLoadError={workspace.customerLoadError}
      onRetryCustomers={workspace.retryCustomers}
      customerCanManage={workspace.customerCanManage}
    />
  );
}
