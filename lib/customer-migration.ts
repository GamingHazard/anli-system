import type { Customer } from "@/lib/erp";
import {
  CUSTOMER_IMPORT_MARKER_KEY,
  CUSTOMER_IMPORT_SNAPSHOT_KEY,
} from "@/lib/workspace-storage-keys";

export { CUSTOMER_IMPORT_MARKER_KEY } from "@/lib/workspace-storage-keys";

type CustomerImporter = (customers: Customer[]) => Promise<{
  rejected: { id: string; index: number; reason: string }[];
}>;

export async function importLegacyCustomersOnce(
  canManage: boolean,
  customers: Customer[],
  importer: CustomerImporter,
  storage: Storage = window.localStorage,
) {
  if (storage.getItem(CUSTOMER_IMPORT_MARKER_KEY)) return "";
  let retainedCustomers = customers;
  const savedSnapshot = storage.getItem(CUSTOMER_IMPORT_SNAPSHOT_KEY);
  if (savedSnapshot) {
    try {
      const parsed: unknown = JSON.parse(savedSnapshot);
      if (!Array.isArray(parsed))
        throw new Error("Invalid customer import snapshot.");
      retainedCustomers = parsed as Customer[];
    } catch {
      return "Saved browser customers could not be read for import. The original data was retained; contact an administrator before clearing browser storage.";
    }
  } else if (customers.length) {
    storage.setItem(CUSTOMER_IMPORT_SNAPSHOT_KEY, JSON.stringify(customers));
  }
  if (!retainedCustomers.length) {
    if (canManage) storage.setItem(CUSTOMER_IMPORT_MARKER_KEY, "complete");
    return "";
  }
  if (!canManage) {
    return "Browser-saved customer records are retained but have not been imported. Ask a customer manager to sign in to complete the import.";
  }
  try {
    const result = await importer(retainedCustomers);
    if (result.rejected.length) {
      const examples = result.rejected
        .slice(0, 3)
        .map(({ id, reason }) => `${id}: ${reason}`)
        .join("; ");
      const remainder =
        result.rejected.length > 3
          ? `; and ${result.rejected.length - 3} more`
          : "";
      return `${result.rejected.length} browser-saved customer record(s) could not be imported (${examples}${remainder}). Local data was retained; resolve the conflicts and retry.`;
    }
    storage.setItem(CUSTOMER_IMPORT_MARKER_KEY, "complete");
    storage.removeItem(CUSTOMER_IMPORT_SNAPSHOT_KEY);
    return "";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return `Customer import did not complete: ${message} Local data was retained.`;
  }
}
