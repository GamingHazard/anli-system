"use client";

import { useParams } from "next/navigation";
import { CustomerDetails } from "@/features/customers/legacy-screens";
import { useWorkspace } from "@/features/workspace/workspace-context";

export function CustomerDetailsRoute() {
  const params = useParams<{ customerId: string }>();
  const customerId = params.customerId;
  const {
    state,
    selectedCustomer,
    customerCanRead,
    customersLoaded,
    customerLoadError,
    retryCustomers,
    navigateToSection,
  } = useWorkspace();

  if (!customerCanRead) {
    return (
      <section
        role="alert"
        className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
      >
        You do not have permission to view customer records.
      </section>
    );
  }
  if (!customersLoaded) {
    return <p role="status" className="p-8 text-sm text-slate-500">Loading customer profile…</p>;
  }
  if (selectedCustomer?.id === customerId) {
    return (
      <>
        {customerLoadError && (
          <p
            role="alert"
            className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
          >
            {customerLoadError}
          </p>
        )}
        <CustomerDetails
          customer={selectedCustomer}
          state={state}
          onBack={() => navigateToSection("Customer Management")}
        />
      </>
    );
  }
  return (
    <section
      role="alert"
      className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
    >
      {customerLoadError || "This customer profile could not be found."}
      <button
        type="button"
        onClick={retryCustomers}
        className="ml-3 font-semibold underline"
      >
        Retry
      </button>
    </section>
  );
}
