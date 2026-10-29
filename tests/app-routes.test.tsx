import { describe, expect, it } from "vitest";
import {
  customerPath,
  employeePath,
  pathForSection,
  payrollPath,
  salaryAdvancePath,
  sectionForPath,
} from "@/lib/app-routes";
import { allNavItems } from "@/lib/erp";

describe("app route mapping", () => {
  it("maps existing navigation labels to stable feature routes", () => {
    for (const item of allNavItems) {
      const path = pathForSection(item.label);
      expect(path).not.toBeNull();
      expect(sectionForPath(path!)).toBe(item.label);
    }
    expect(pathForSection("Dashboard")).toBe("/dashboard");
    expect(pathForSection("Credit Sales")).toBe("/credit-sales");
    expect(pathForSection("Raw Material Management")).toBe(
      "/inventory/materials",
    );
    expect(pathForSection("Security Settings")).toBe("/settings/security");
  });

  it("resolves normal and detail routes to the existing section labels", () => {
    expect(sectionForPath("/dashboard")).toBe("Dashboard");
    expect(sectionForPath("/employees/employee-123")).toBe(
      "Employee Profile Details",
    );
    expect(sectionForPath("/customers/customer-123")).toBe("Customer Details");
    expect(sectionForPath("/unknown")).toBeNull();
  });

  it("encodes record IDs and preserves selected payroll and advance records in URLs", () => {
    expect(employeePath("employee 123")).toBe("/employees/employee%20123");
    expect(customerPath("customer 123")).toBe("/customers/customer%20123");
    expect(payrollPath("run 123")).toBe("/payroll?runId=run%20123");
    expect(salaryAdvancePath("advance 123")).toBe(
      "/salary-advances?advanceId=advance%20123",
    );
  });
});
