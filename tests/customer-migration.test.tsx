import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CUSTOMER_IMPORT_MARKER_KEY,
  importLegacyCustomersOnce,
} from "@/lib/customer-migration";
import {
  CUSTOMER_IMPORT_SNAPSHOT_KEY,
  ORDER_IMPORT_MARKER_KEY,
  ORDER_IMPORT_SNAPSHOT_KEY,
  SALES_IMPORT_SNAPSHOT_KEY,
} from "@/lib/workspace-storage-keys";
import {
  clearState,
  markLegacyLeaveRequestsImported,
  preserveLegacyLeaveRequests,
} from "@/lib/erp";
import { importLegacyOrdersOnce } from "@/lib/order-migration";

const customers = [
  {
    id: "C-MIGRATION-1",
    name: "Migration Customer",
    type: "Retail",
    phone: "+256 700 000001",
    email: "migration@example.com",
    status: "Active",
    purchases: 0,
  },
] as Parameters<typeof importLegacyCustomersOnce>[1];

describe("safe customer migration", () => {
  beforeEach(() => localStorage.clear());

  it("marks migration complete only after the server confirms all records", async () => {
    const importer = vi.fn().mockResolvedValue({ rejected: [] });

    await expect(
      importLegacyCustomersOnce(true, customers, importer),
    ).resolves.toBe("");
    expect(importer).toHaveBeenCalledWith(customers);
    expect(localStorage.getItem(CUSTOMER_IMPORT_MARKER_KEY)).toBe("complete");
    expect(localStorage.getItem(CUSTOMER_IMPORT_SNAPSHOT_KEY)).toBeNull();
  });

  it("retains local data and leaves migration retryable after a partial rejection", async () => {
    const importer = vi.fn().mockResolvedValue({
      rejected: [{ id: customers[0].id, index: 0, reason: "duplicate name" }],
    });

    await expect(
      importLegacyCustomersOnce(true, customers, importer),
    ).resolves.toMatch(/could not be imported/);
    expect(localStorage.getItem(CUSTOMER_IMPORT_MARKER_KEY)).toBeNull();
  });

  it("does not attempt import or set a marker for read-only users", async () => {
    const importer = vi.fn();

    await expect(
      importLegacyCustomersOnce(false, customers, importer),
    ).resolves.toMatch(/Ask a customer manager/);
    expect(importer).not.toHaveBeenCalled();
    expect(localStorage.getItem(CUSTOMER_IMPORT_MARKER_KEY)).toBeNull();
  });

  it("reports API failures and retries safely without clearing the browser snapshot", async () => {
    const importer = vi.fn().mockRejectedValue(new Error("Server unavailable"));

    await expect(
      importLegacyCustomersOnce(true, customers, importer),
    ).resolves.toMatch(/Server unavailable/);
    expect(localStorage.getItem(CUSTOMER_IMPORT_MARKER_KEY)).toBeNull();
    expect(localStorage.getItem(CUSTOMER_IMPORT_SNAPSHOT_KEY)).not.toBeNull();
  });

  it("clears the workspace cache but retains snapshots needed for pending imports", () => {
    localStorage.setItem(
      "lumina-erp-workspace-v1",
      JSON.stringify({
        customers,
        sales: [{ id: "legacy-sale" }],
        payments: [{ id: "legacy-payment" }],
        orders: [{ id: "legacy-order" }],
        employees: [{ id: "legacy-employee", number: "EMP-777" }],
        attendanceRecords: [],
        salaryAdvances: [],
        leaveRequests: [],
      }),
    );

    clearState();

    expect(localStorage.getItem("lumina-erp-workspace-v1")).toBeNull();
    expect(
      JSON.parse(localStorage.getItem(CUSTOMER_IMPORT_SNAPSHOT_KEY) || "[]"),
    ).toEqual(customers);
    expect(
      JSON.parse(localStorage.getItem(SALES_IMPORT_SNAPSHOT_KEY) || "{}"),
    ).toEqual({
      sales: [{ id: "legacy-sale" }],
      payments: [{ id: "legacy-payment" }],
    });
    expect(
      JSON.parse(localStorage.getItem(ORDER_IMPORT_SNAPSHOT_KEY) || "[]"),
    ).toEqual([{ id: "legacy-order" }]);
  });

  it("can retry pending customer and order snapshots after workspace cache cleanup", async () => {
    const savedCustomers = vi.fn().mockResolvedValue({ rejected: [] });
    const savedOrders = vi
      .fn()
      .mockResolvedValue({ imported: [], duplicates: [], rejected: [] });
    localStorage.setItem(
      CUSTOMER_IMPORT_SNAPSHOT_KEY,
      JSON.stringify(customers),
    );
    localStorage.setItem(
      ORDER_IMPORT_SNAPSHOT_KEY,
      JSON.stringify([{ id: "legacy-order" }]),
    );

    await importLegacyCustomersOnce(true, [], savedCustomers);
    await importLegacyOrdersOnce(true, [], savedOrders);

    expect(savedCustomers).toHaveBeenCalledWith(customers);
    expect(savedOrders).toHaveBeenCalledWith([{ id: "legacy-order" }]);
    expect(localStorage.getItem(CUSTOMER_IMPORT_SNAPSHOT_KEY)).toBeNull();
    expect(localStorage.getItem(ORDER_IMPORT_SNAPSHOT_KEY)).toBeNull();
    expect(localStorage.getItem(ORDER_IMPORT_MARKER_KEY)).toBe("complete");
  });

  it("does not recreate a completed leave snapshot and removes imported salary backups on clear", () => {
    localStorage.setItem(
      "lumina-erp-workspace-v1",
      JSON.stringify({
        leaveRequests: [
          {
            id: "legacy-leave",
            employeeId: "legacy-employee",
            startDate: "2026-01-01",
            endDate: "2026-01-02",
          },
        ],
        salaryAdvances: [],
      }),
    );
    localStorage.setItem(
      "lumina-erp-salary-advance-archive-v1",
      JSON.stringify({
        advances: [{ id: "legacy-advance" }],
        importedAt: "2026-11-05T00:00:00.000Z",
      }),
    );

    markLegacyLeaveRequestsImported();
    preserveLegacyLeaveRequests([{ id: "legacy-leave" } as never]);
    clearState();

    expect(localStorage.getItem("lumina-erp-leave-import-v1-complete")).toBe(
      "complete",
    );
    expect(localStorage.getItem("lumina-erp-leave-import-v1")).toBeNull();
    expect(
      localStorage.getItem("lumina-erp-salary-advance-archive-v1"),
    ).toBeNull();
  });
});
