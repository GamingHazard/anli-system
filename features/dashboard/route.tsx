"use client";

import DashboardOverview from "@/components/dashboard-overview";
import { exportCsv } from "@/lib/erp";
import { useWorkspace } from "@/features/workspace/workspace-context";

export default function DashboardRoute() {
  const { currentUser, state, companyName, companyLogoUrl, navigateToSection } =
    useWorkspace();

  return (
    <DashboardOverview
      companyName={companyName}
      companyLogoUrl={companyLogoUrl}
      userName={currentUser.name}
      roles={currentUser.roles}
      onNavigate={navigateToSection}
      onExportSales={() =>
        exportCsv(
          `${
            companyName
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "") || "company"
          }-sales.csv`,
          state.sales as unknown as Record<string, unknown>[],
        )
      }
    />
  );
}
