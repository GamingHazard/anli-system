"use client";

import { createContext, useContext } from "react";
import type { CompanyProfile, Employee, ErpState, Sale, SalePayment } from "@/lib/erp";
import type { UserAccount } from "@/lib/user-api";

export type WorkspaceContextValue = {
  currentUser: UserAccount;
  state: ErpState;
  updateState: (next: ErpState) => void;
  updateSale: (sale: Sale, payments: SalePayment[]) => void;
  updateCustomers: (customers: ErpState["customers"]) => void;
  companyName: string;
  companyLogoUrl: string;
  companyProfileEditable: boolean;
  companyProfileError: string;
  retryCompanyProfile: () => void;
  applyCompanyProfile: (profile: CompanyProfile) => void;
  handleSessionEnded: () => void;
  navigateToSection: (section: string) => void;
  openEmployee: (id: string) => void;
  openCustomer: (id: string) => void;
  openPayrollRun: (id: string) => void;
  openSalaryAdvance: (id: string) => void;
  selectedPayrollRunId: string | null;
  selectedAdvanceId: string | null;
  selectedEmployee: Employee | undefined;
  selectedCustomer: ErpState["customers"][number] | undefined;
  employeesLoaded: boolean;
  employeeLoadError: string;
  employeeDetailLoading: boolean;
  retryEmployees: () => void;
  updateEmployee: (employee: Employee) => void;
  addEmployee: (employee: Employee) => void;
  customersLoaded: boolean;
  customersApiLoaded: boolean;
  customerLoadError: string;
  retryCustomers: () => void;
  customerCanRead: boolean;
  customerCanManage: boolean;
  salesLoaded: boolean;
  salesLoadError: string;
  salesMigrationWarning: string;
  retrySales: () => void;
  salesCanRead: boolean;
  canReadAssets: boolean;
  canEditAssets: boolean;
};

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(
  null,
);

export function useWorkspace(): WorkspaceContextValue {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) {
    throw new Error("Workspace feature rendered outside the workspace shell.");
  }
  return workspace;
}
