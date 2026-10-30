import { describe, expect, it } from "vitest";
import {
  canAccessPath,
  canAccessSection,
  canCreateOrders,
  canManageAccount,
  creatableRolesForAccountManager,
  defaultPathForRoles,
} from "@/lib/authorization";
import type { UserAccount, UserRole } from "@/lib/user-api";

describe("role-based section access", () => {
  it("limits department roles to their entitled features", () => {
    expect(canAccessSection(["Sales Manager"], "Sales")).toBe(true);
    expect(canAccessSection(["Sales Manager"], "Expenses")).toBe(false);
    expect(canAccessSection(["Accountant"], "Expenses")).toBe(true);
    expect(canAccessSection(["Accountant"], "Payroll Management")).toBe(false);
    expect(canAccessSection(["Human Resource"], "Attendance Management")).toBe(true);
    expect(canAccessSection(["Inventory Manager"], "Assets Management")).toBe(true);
    expect(canAccessSection(["Production Manager"], "Production Management")).toBe(true);
    expect(canAccessSection(["Production Manager"], "Raw Material Management")).toBe(false);
    expect(canAccessSection(["Marketing Manager"], "Customer Management")).toBe(true);
    expect(canAccessSection(["Marketing Manager"], "Orders")).toBe(true);
    expect(canAccessSection(["Marketing Manager"], "Sales")).toBe(false);
  });

  it("restricts overview and settings to the configured roles", () => {
    for (const section of ["Dashboard", "Approvals", "Auditing", "Analysis"]) {
      expect(canAccessSection(["General Manager"], section)).toBe(true);
      expect(canAccessSection(["Admin"], section)).toBe(true);
      expect(canAccessSection(["Sales Manager"], section)).toBe(false);
    }
    expect(canAccessSection(["Admin"], "User Management")).toBe(false);
    expect(canAccessSection(["Super Admin"], "User Management")).toBe(true);
  });

  it("applies the settings role matrix to every settings page", () => {
    expect(canAccessSection(["Human Resource"], "User Management")).toBe(true);
    expect(canAccessSection(["Human Resource"], "Company Profile Management")).toBe(false);
    expect(canAccessSection(["Human Resource"], "Security Settings")).toBe(false);

    expect(canAccessSection(["General Manager"], "User Management")).toBe(true);
    expect(canAccessSection(["General Manager"], "Company Profile Management")).toBe(true);
    expect(canAccessSection(["General Manager"], "Security Settings")).toBe(false);

    expect(canAccessSection(["Super Admin"], "Security Settings")).toBe(true);
    expect(canAccessSection(["Admin"], "Company Profile Management")).toBe(false);
  });

  it("limits account creation roles by account manager role", () => {
    expect(creatableRolesForAccountManager(["Super Admin"])).toEqual(["Admin", "General Manager"]);
    expect(creatableRolesForAccountManager(["General Manager"])).toEqual(["Human Resource"]);
    expect(creatableRolesForAccountManager(["Human Resource"])).toContain("Sales Manager");
    expect(creatableRolesForAccountManager(["Sales Manager"])).toEqual([]);
  });

  it("allows marketing managers to create orders", () => {
    expect(canCreateOrders(["Marketing Manager"])).toBe(true);
    expect(canCreateOrders(["Sales Manager"])).toBe(true);
    expect(canCreateOrders(["General Manager"])).toBe(true);
  });

  it("limits account management targets by account manager role", () => {
    const account = (id: string, roles: UserRole[]): UserAccount => ({
      id,
      name: id,
      email: `${id}@example.com`,
      roles,
      status: "Active",
      createdAt: "2026-01-01T00:00:00.000Z",
      mustChangePassword: false,
    });

    const superAdmin = account("super-admin", ["Super Admin"]);
    const gm = account("gm", ["General Manager"]);
    const hr = account("hr", ["Human Resource"]);
    expect(canManageAccount(superAdmin, account("admin", ["Admin"]))).toBe(true);
    expect(canManageAccount(superAdmin, account("sales", ["Sales Manager"]))).toBe(false);
    expect(canManageAccount(gm, hr)).toBe(true);
    expect(canManageAccount(gm, account("gm2", ["General Manager"]))).toBe(false);
    expect(canManageAccount(hr, account("sales", ["Sales Manager"]))).toBe(true);
    expect(canManageAccount(hr, account("gm2", ["General Manager"]))).toBe(false);
    expect(canManageAccount(hr, hr)).toBe(false);
  });

  it("limits GM inventory to read-access routes and preserves existing HR access", () => {
    expect(canAccessSection(["General Manager"], "Raw Material Management")).toBe(true);
    expect(canAccessSection(["General Manager"], "Payroll Management")).toBe(true);
    expect(canAccessSection(["General Manager"], "Employee Profiles")).toBe(true);
    expect(canAccessSection(["General Manager"], "Attendance Management")).toBe(false);
  });

  it("protects direct feature and record URLs and selects a role-appropriate landing page", () => {
    expect(canAccessPath(["Marketing Manager"], "/customers/customer-1")).toBe(true);
    expect(canAccessPath(["Marketing Manager"], "/employees/employee-1")).toBe(false);
    expect(canAccessPath(["Accountant"], "/payroll")).toBe(false);
    expect(defaultPathForRoles(["Production Manager"])).toBe("/inventory/production");
    expect(defaultPathForRoles(["Human Resource"] as UserRole[])).toBe("/employees");
  });
});
