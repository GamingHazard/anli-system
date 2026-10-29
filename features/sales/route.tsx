"use client";

import SalesManagementPage from "@/components/sales-management";
import ReceiptManagementPage from "@/components/receipt-management";
import { useWorkspace } from "@/features/workspace/workspace-context";

export function SalesRoute({ mode }: { mode: "sales" | "credit" }) {
  const {
    currentUser,
    state,
    updateSale,
    salesCanRead,
    salesLoaded,
    salesLoadError,
    salesMigrationWarning,
    retrySales,
    customersApiLoaded,
    retryCustomers,
    companyName,
    companyLogoUrl,
  } = useWorkspace();

  if (!salesCanRead) {
    return (
      <section
        role="alert"
        className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
      >
        You do not have permission to access sales records.
      </section>
    );
  }

  return (
    <SalesManagementPage
      mode={mode}
      state={state}
      currentUser={currentUser}
      salesLoading={!salesLoaded}
      salesError={salesLoadError}
      onRetrySales={retrySales}
      onSaleUpdated={updateSale}
      salesWarning={salesMigrationWarning}
      customersAvailable={customersApiLoaded}
      onRetryCustomers={retryCustomers}
      companyName={companyName}
      companyLogoUrl={companyLogoUrl}
    />
  );
}

export function ReceiptsRoute() {
  const { salesCanRead, companyName, companyLogoUrl } = useWorkspace();
  if (!salesCanRead) {
    return (
      <section
        role="alert"
        className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
      >
        You do not have permission to access receipts.
      </section>
    );
  }
  return (
    <ReceiptManagementPage
      companyName={companyName}
      companyLogoUrl={companyLogoUrl}
    />
  );
}
