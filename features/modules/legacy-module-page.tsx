"use client";

import { useEffect, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import * as Icons from "lucide-react";
import { ChevronLeft, ChevronRight, Download, Plus, Search, TrendingUp, X } from "lucide-react";
import ExpenseManagement from "@/components/expense-management";
import RawMaterialManagement from "@/components/raw-material-management";
import ProductionManagement from "@/components/production-management";
import AssetManagement from "@/components/asset-management";
import CompanyProfileManagement from "@/components/company-profile-management";
import UserManagement from "@/components/user-management";
import SecuritySettings from "@/components/security-settings";
import Approvals from "@/components/approvals";
import LeaveManagement from "@/components/leave-management";
import DisciplinaryLettersPage from "@/components/disciplinary-letters";
import OrdersManagement from "@/components/orders-management";
import { hasAnyDepartmentRole } from "@/lib/authorization";
import { chartData, createId, createInvoiceDraft, exportCsv, formatDate, money, sum, CompanyProfile, ErpState, Invoice } from "@/lib/erp";
import { UserAccount } from "@/lib/user-api";
import { CustomerManagementPage } from "@/features/customers/legacy-screens";
import { Kpi, Status } from "@/features/workspace/legacy-widgets";

export function ModulePage({
  active,
  state,
  updateState,
  currentUser,
  companyName,
  companyLogoUrl,
  companyProfileEditable,
  onCompanyProfileSave,
  onCurrentSessionRevoked,
  onViewSalaryAdvance,
  onViewPayrollRun,
  onView,
  updateCustomers,
  customersLoaded,
  customersApiLoaded,
  customerLoadError,
  onRetryCustomers,
  customerCanManage,
}: {
  active: string;
  state: ErpState;
  updateState: (next: ErpState) => void;
  currentUser: UserAccount;
  companyName: string;
  companyLogoUrl: string;
  companyProfileEditable: boolean;
  onCompanyProfileSave: (profile: CompanyProfile) => void;
  onCurrentSessionRevoked: () => void;
  onViewSalaryAdvance: (id: string) => void;
  onViewPayrollRun: (id: string) => void;
  onView: (id: string) => void;
  updateCustomers: (customers: ErpState["customers"]) => void;
  customersLoaded: boolean;
  customersApiLoaded: boolean;
  customerLoadError: string;
  onRetryCustomers: () => void;
  customerCanManage: boolean;
}) {
  const customerCanRead = hasAnyDepartmentRole(currentUser.roles, [
    "Sales Manager",
    "Marketing Manager",
    "General Manager",
    "Admin",
  ]);
  const assetCanRead = currentUser.roles.some((role) =>
    ["Inventory Manager", "General Manager", "Admin", "Super Admin"].includes(role),
  );
  const assetCanEdit = currentUser.roles.some((role) =>
    ["Inventory Manager", "Super Admin"].includes(role),
  );
  const isReadOnlyAdmin =
    currentUser.roles.includes("Admin") &&
    !currentUser.roles.includes("Super Admin");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState("");
  const [salesFromDate, setSalesFromDate] = useState("");
  const [showSalesDatePicker, setShowSalesDatePicker] = useState(false);
  const salesDatePickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showSalesDatePicker) return;
    const handleOutsideClick = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !salesDatePickerRef.current?.contains(event.target)
      ) {
        setShowSalesDatePicker(false);
      }
    };
    document.addEventListener("pointerdown", handleOutsideClick);
    return () =>
      document.removeEventListener("pointerdown", handleOutsideClick);
  }, [showSalesDatePicker]);
  const [salesPeriod, setSalesPeriod] = useState<
    "all" | "today" | "week" | "month" | "year"
  >("all");
  const [showSalesFilters, setShowSalesFilters] = useState(false);
  const salesFiltersRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showSalesFilters) return;
    const handleOutsideClick = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !salesFiltersRef.current?.contains(event.target)
      ) {
        setShowSalesFilters(false);
      }
    };
    document.addEventListener("pointerdown", handleOutsideClick);
    return () =>
      document.removeEventListener("pointerdown", handleOutsideClick);
  }, [showSalesFilters]);
  const [orderStatusFilter, setOrderStatusFilter] = useState<
    | ""
    | "Pending"
    | "Confirmed"
    | "In progress"
    | "Ready"
    | "Completed"
    | "Cancelled"
  >("");
  const [orderPeriod, setOrderPeriod] = useState<
    "all" | "today" | "week" | "month" | "year"
  >("all");
  const [orderView, setOrderView] = useState<
    "open" | "completed" | "cancelled" | "archived"
  >("open");
  const [showOrderFilters, setShowOrderFilters] = useState(false);
  const orderFiltersRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showOrderFilters) return;
    const handleOutsideClick = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !orderFiltersRef.current?.contains(event.target)
      ) {
        setShowOrderFilters(false);
      }
    };
    document.addEventListener("pointerdown", handleOutsideClick);
    return () =>
      document.removeEventListener("pointerdown", handleOutsideClick);
  }, [showOrderFilters]);
  if (active === "Expenses")
    return (
      <ExpenseManagement
        state={state}
        currentUser={currentUser}
        onViewPayrollRun={onViewPayrollRun}
      />
    );
  if (active === "Raw Material Management") {
    return <RawMaterialManagement canEdit={assetCanEdit} />;
  }
  if (active === "Orders")
    return (
      <OrdersManagement
        state={state}
        currentUser={currentUser}
        customersLoaded={customersLoaded}
        customersApiLoaded={customersApiLoaded}
        customerLoadError={customerLoadError}
        onRetryCustomers={onRetryCustomers}
        onStateChange={updateState}
      />
    );
  if (active === "Production Management") return <ProductionManagement />;
  if (active === "Assets Management")
    return (
      <AssetManagement
        state={state}
        canRead={assetCanRead}
        canEdit={assetCanEdit}
      />
    );
  if (active === "Data Backup")
    return (
      <section
        role="status"
        className="rounded-xl border border-slate-200 bg-white p-8 text-center"
      >
        <h2 className="text-lg font-semibold text-slate-900">
          Data Backup is coming soon
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          This section is not available yet.
        </p>
      </section>
    );
  if (active === "Company Profile Management")
    return (
      <CompanyProfileManagement
        profile={state.companyProfile}
        canEdit={companyProfileEditable}
        onSave={onCompanyProfileSave}
      />
    );
  if (active === "User Management")
    return <UserManagement currentUser={currentUser} />;
  if (active === "Security Settings")
    return (
      <SecuritySettings
        currentUser={currentUser}
        onCurrentSessionRevoked={onCurrentSessionRevoked}
      />
    );
  if (active === "Approvals")
    return (
      <Approvals
        currentUser={currentUser}
        onViewSalaryAdvance={onViewSalaryAdvance}
        onViewPayrollRun={onViewPayrollRun}
      />
    );
  const kind = active.split(" ")[0];
  const data =
    active === "Sales"
      ? state.sales
      : active === "Orders"
        ? state.orders
        : active === "Customer Management"
          ? state.customers
          : active === "Employee Profiles"
            ? state.employees
            : state.activities;
  const today = new Date().toISOString().slice(0, 10);
  const periodStartDate = new Date(`${today}T00:00:00.000Z`);
  if (salesPeriod === "week") {
    periodStartDate.setUTCDate(
      periodStartDate.getUTCDate() - ((periodStartDate.getUTCDay() + 6) % 7),
    );
  } else if (salesPeriod === "month") {
    periodStartDate.setUTCDate(1);
  } else if (salesPeriod === "year") {
    periodStartDate.setUTCMonth(0, 1);
  }
  const periodStart =
    salesPeriod === "all" ? "" : periodStartDate.toISOString().slice(0, 10);
  const orderPeriodStartDate = new Date(`${today}T00:00:00.000Z`);
  if (orderPeriod === "week") {
    orderPeriodStartDate.setUTCDate(
      orderPeriodStartDate.getUTCDate() -
        ((orderPeriodStartDate.getUTCDay() + 6) % 7),
    );
  } else if (orderPeriod === "month") {
    orderPeriodStartDate.setUTCDate(1);
  } else if (orderPeriod === "year") {
    orderPeriodStartDate.setUTCMonth(0, 1);
  }
  const orderPeriodStart =
    orderPeriod === "all"
      ? ""
      : orderPeriodStartDate.toISOString().slice(0, 10);
  const filtered = data.filter((item) => {
    const matchesSearch = JSON.stringify(item)
      .toLowerCase()
      .includes(search.toLowerCase());
    const itemDate = (item as { date?: string }).date;
    const matchesStartDate =
      active !== "Sales" || !salesFromDate || (itemDate ?? "") >= salesFromDate;
    const matchesPeriod =
      active !== "Sales" ||
      !periodStart ||
      ((itemDate ?? "") >= periodStart && (itemDate ?? "") <= today);
    const matchesOrderStatus =
      active !== "Orders" ||
      !orderStatusFilter ||
      (item as { status?: string }).status === orderStatusFilter;
    const matchesOrderPeriod =
      active !== "Orders" ||
      !orderPeriodStart ||
      ((itemDate ?? "") >= orderPeriodStart && (itemDate ?? "") <= today);
    const order = item as ErpState["orders"][number];
    const matchesOrderView =
      active !== "Orders" ||
      (orderView === "open"
        ? !order.archivedAt &&
          !["Completed", "Cancelled"].includes(order.status)
        : orderView === "completed"
          ? order.status === "Completed" && !order.archivedAt
          : orderView === "cancelled"
            ? order.status === "Cancelled" && !order.archivedAt
            : Boolean(order.archivedAt));
    return (
      matchesSearch &&
      matchesStartDate &&
      matchesPeriod &&
      matchesOrderStatus &&
      matchesOrderPeriod &&
      matchesOrderView
    );
  });
  const displayedData =
    active === "Orders"
      ? [...filtered].sort((left, right) => {
          const leftOrder = left as ErpState["orders"][number];
          const rightOrder = right as ErpState["orders"][number];
          const leftOverride =
            leftOrder.priority === "High" && Boolean(leftOrder.priorityReason);
          const rightOverride =
            rightOrder.priority === "High" &&
            Boolean(rightOrder.priorityReason);
          if (orderView === "open" && leftOverride !== rightOverride)
            return leftOverride ? -1 : 1;
          return leftOrder.createdAt.localeCompare(rightOrder.createdAt);
        })
      : filtered;
  const isDashboardLike = active === "Reporting";
  const updateOrder = (
    orderId: string,
    updates: Partial<ErpState["orders"][number]>,
  ) => {
    updateState({
      ...state,
      orders: state.orders.map((order) => {
        if (order.id !== orderId) return order;
        const statusHistory =
          updates.status && updates.status !== order.status
            ? [
                ...order.statusHistory,
                { status: updates.status, at: new Date().toISOString() },
              ]
            : order.statusHistory;
        return { ...order, ...updates, statusHistory };
      }),
    });
  };
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = { ...state };
    if (active === "Sales") {
      const paymentTerms = String(form.get("paymentTerms") || "Same-day");
      const selectedCustomerId = String(form.get("customerId") || "");
      const customerId =
        selectedCustomerId === "__walkin__" ? "" : selectedCustomerId;
      const customerName = customerId
        ? state.customers.find((customer) => customer.id === customerId)
            ?.name || ""
        : "Walk-in customer";
      const sale: ErpState["sales"][number] = {
        id: createId("S"),
        reference: createId("SAL"),
        date: new Date().toISOString().slice(0, 10),
        customer: customerName,
        customerId: customerId || undefined,
        product: String(form.get("product") || "Premium Maize Flour"),
        quantity: Number(form.get("quantity") || 1),
        total: Number(form.get("amount") || 0),
        status: String(
          paymentTerms === "Credit" ? "Pending" : form.get("status") || "Paid",
        ) as "Paid" | "Pending",
        method: String(
          paymentTerms === "Credit"
            ? "Credit terms"
            : form.get("method") || "Cash",
        ),
        txnID: String(form.get("txnID") || "") || undefined,
        paymentTerms: paymentTerms as "Same-day" | "Credit",
        dueDate:
          String(paymentTerms === "Credit" ? form.get("dueDate") || "" : "") ||
          undefined,
      };
      next.sales = [sale, ...state.sales];
      const saleCustomer = state.customers.find(
        (customer) => customer.id === sale.customerId,
      );
      next.invoices = [
        createInvoiceDraft(sale, saleCustomer, state.companyProfile),
        ...state.invoices,
      ];
    }
    if (active === "Orders") {
      const submittedItems = JSON.parse(
        String(form.get("items") || "[]"),
      ) as ErpState["orders"][number]["items"];
      const newCustomer = form.get("customer") === "__new__";
      const customerId = newCustomer
        ? createId("C")
        : String(form.get("customer") || "");
      const selectedCustomer = state.customers.find(
        (customer) => customer.id === customerId,
      );
      const customerName = newCustomer
        ? String(form.get("newCustomerName") || "").trim()
        : selectedCustomer?.name || "";
      if (newCustomer) {
        next.customers = [
          {
            id: customerId,
            name: customerName,
            type: String(form.get("newCustomerType") || "Small dealer"),
            contact: String(form.get("newCustomerContact") || "").trim(),
            phone: String(form.get("newCustomerPhone") || ""),
            email: String(form.get("newCustomerEmail") || ""),
            region: String(form.get("newCustomerRegion") || "") || undefined,
            district:
              String(form.get("newCustomerDistrict") || "") || undefined,
            tin: String(form.get("newCustomerTin") || "") || undefined,
            country: String(form.get("newCustomerCountry") || "") || undefined,
            referredBy: String(form.get("newCustomerReferredBy") || "").trim(),
            createdAt: new Date().toISOString(),
            status: "Active",
            purchases: 0,
          },
          ...state.customers,
        ];
      }
      next.orders = [
        {
          id: createId("ORD"),
          reference: createId("ORD"),
          date: new Date().toISOString().slice(0, 10),
          createdAt: new Date().toISOString(),
          customer: customerName,
          customerId,
          items: submittedItems.map((item) => ({
            ...item,
            id: createId("ITEM"),
          })),
          total: submittedItems.reduce(
            (total, item) => total + item.lineTotal,
            0,
          ),
          requestedDate: String(form.get("requestedDate")),
          fulfilmentMethod: String(form.get("fulfilmentMethod")) as
            | "Delivery"
            | "Pickup",
          destination: String(form.get("destination") || ""),
          paymentTerms: String(form.get("paymentTerms")) as
            | "Paid now"
            | "Same-day"
            | "Credit",
          status: "Pending",
          statusHistory: [{ status: "Pending", at: new Date().toISOString() }],
          priority: String(form.get("priority")) as "Normal" | "High",
          priorityReason: String(form.get("priorityReason") || "") || undefined,
          notes: String(form.get("notes") || ""),
        },
        ...state.orders,
      ];
    }
    if (active === "Customer Management")
      next.customers = [
        {
          id: createId("C"),
          name: String(form.get("name") || "New customer"),
          type: "Retail",
          phone: String(form.get("phone") || ""),
          email: String(form.get("email") || ""),
          status: "Active",
          purchases: 0,
        },
        ...state.customers,
      ];
    if (active === "Employee Profiles")
      next.employees = [
        {
          id: createId("E"),
          number: createId("EMP"),
          name: String(form.get("name") || "New employee"),
          category: "Staff",
          department: String(form.get("department") || "Operations"),
          role: String(form.get("role") || "Team member"),
          status: "Active",
          salary: Number(form.get("salary") || 0),
        },
        ...state.employees,
      ];
    updateState(next);
    setShowForm(false);
    setToast(`${kind} record saved successfully`);
    setTimeout(() => setToast(""), 2600);
  };
  if (active === "Leave Management") {
    return (
      <LeaveManagement
        state={state}
        updateState={updateState}
        currentUser={currentUser}
        onViewEmployee={(id) =>
          window.dispatchEvent(
            new CustomEvent("erp:view", { detail: { type: "employee", id } }),
          )
        }
      />
    );
  }
  if (active === "Disciplinary Letters") {
    return <DisciplinaryLettersPage state={state} currentUser={currentUser} />;
  }
  if (active === "Customer Management") {
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
    return (
      <CustomerManagementPage
        state={state}
        updateCustomers={updateCustomers}
        customersLoaded={customersLoaded}
        loadError={customerLoadError}
        onRetry={onRetryCustomers}
        canManage={customerCanManage}
        onView={onView}
      />
    );
  }
  if (active === "Invoicing") {
    return (
      <section
        role="status"
        className="rounded-xl border border-slate-200 bg-white p-8 text-center"
      >
        <h2 className="text-lg font-semibold text-slate-900">
          Invoicing is coming soon
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          This section is not available yet.
        </p>
      </section>
    );
  }
  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 text-xs font-medium text-slate-400">
            Workspace / {active}
          </div>
          <h2 className="text-2xl font-bold tracking-tight">{active}</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Manage {active.toLowerCase()} with connected mock workflows and
            local demonstration persistence.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() =>
              exportCsv(
                `${active.toLowerCase().replaceAll(" ", "-")}.csv`,
                displayedData as unknown as Record<string, unknown>[],
              )
            }
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm"
          >
            <Download className="size-4" /> Export CSV
          </button>
          {!isReadOnlyAdmin && ![
            "Auditing",
            "Analysis",
            "Reporting",
            "Data Backup",
            "Security Settings",
          ].includes(active) && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-[#6d28d9] px-3 py-2 text-xs font-semibold text-white shadow-sm shadow-purple-200"
            >
              <Plus className="size-4" /> Add {kind}
            </button>
          )}
        </div>
      </div>
      {toast && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {toast}
        </div>
      )}
      {isDashboardLike ? (
        <AnalyticsPanel active={active} state={state} />
      ) : (
        <>
          {active === "Sales" ? (
            <SalesKpis sales={state.sales} />
          ) : active === "Orders" ? (
            <OrdersKpis orders={state.orders} />
          ) : (
            <div className="mb-4 grid gap-4 sm:grid-cols-3">
              <Kpi
                label="Total records"
                value={String(data.length)}
                change="Live demo data"
                icon="Layers3"
                tone="purple"
                onClick={() => undefined}
              />
              <Kpi
                label="Active / approved"
                value={String(
                  data.filter((item: any) =>
                    ["Active", "Paid", "Approved", "Success"].includes(
                      item.status || item.outcome,
                    ),
                  ).length,
                )}
                change="Across this module"
                icon="CircleCheck"
                tone="green"
                onClick={() => undefined}
              />
              <Kpi
                label="Updated today"
                value={String(Math.max(1, Math.ceil(data.length / 3)))}
                change="Recent activity"
                icon="Clock3"
                tone="blue"
                onClick={() => undefined}
              />
            </div>
          )}
          {active === "Orders" && (
            <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
              {(
                [
                  ["open", "Open queue"],
                  ["completed", "Completed"],
                  ["cancelled", "Cancelled"],
                  ["archived", "Archived"],
                ] as const
              ).map(([view, label]) => (
                <button
                  key={view}
                  type="button"
                  aria-pressed={orderView === view}
                  onClick={() => {
                    setOrderView(view);
                    setOrderStatusFilter("");
                  }}
                  className={`border-b-2 px-3 py-2.5 text-xs font-semibold ${orderView === view ? "border-[#6d28d9] text-[#6d28d9]" : "border-transparent text-slate-500 hover:text-slate-800"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <Search className="size-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-transparent text-xs outline-none placeholder:text-slate-400 sm:w-64"
                  placeholder={`Search ${active.toLowerCase()}...`}
                />
              </div>
              <div className="flex gap-2">
                {active === "Sales" && (
                  <div className="relative" ref={salesDatePickerRef}>
                    <button
                      type="button"
                      aria-expanded={showSalesDatePicker}
                      onClick={() => setShowSalesDatePicker((open) => !open)}
                      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${salesFromDate ? "border-[#c4b5fd] bg-[#f5f0ff] text-[#5b21b6]" : "border-slate-200 bg-white text-slate-600"}`}
                    >
                      <Icons.CalendarDays className="size-4" />
                      {salesFromDate
                        ? `Sales from ${salesFromDate}`
                        : "Sales from"}
                    </button>
                    {showSalesDatePicker && (
                      <div className="absolute right-0 top-full z-20 mt-2 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
                        <label className="flex flex-col gap-2 text-xs font-semibold text-slate-600">
                          <span>Show sales from date</span>
                          <input
                            autoFocus
                            type="date"
                            value={salesFromDate}
                            onChange={(event) => {
                              setSalesFromDate(event.target.value);
                              setShowSalesDatePicker(false);
                            }}
                            className="rounded-md border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-[#8b5cf6]"
                          />
                        </label>
                        {salesFromDate && (
                          <button
                            type="button"
                            onClick={() => {
                              setSalesFromDate("");
                              setShowSalesDatePicker(false);
                            }}
                            className="mt-2 text-xs font-medium text-slate-500 hover:text-slate-900"
                          >
                            Clear date filter
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {active === "Orders" ? (
                  <select
                    aria-label="Filter orders by status"
                    value={orderStatusFilter}
                    onChange={(event) =>
                      setOrderStatusFilter(
                        event.target.value as typeof orderStatusFilter,
                      )
                    }
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
                  >
                    <option value="">All statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="In progress">In progress</option>
                    <option value="Ready">Ready</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                ) : (
                  <select className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                    <option>All statuses</option>
                    <option>Active</option>
                    <option>Pending</option>
                    <option>Paid</option>
                  </select>
                )}
                {active === "Sales" ? (
                  <div className="relative" ref={salesFiltersRef}>
                    <button
                      type="button"
                      aria-label="Filter sales by period"
                      aria-expanded={showSalesFilters}
                      aria-haspopup="dialog"
                      onClick={() => setShowSalesFilters((open) => !open)}
                      className={`rounded-lg border p-2 ${salesPeriod !== "all" ? "border-[#c4b5fd] bg-[#f5f0ff] text-[#5b21b6]" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
                    >
                      <Icons.SlidersHorizontal className="size-4" />
                    </button>
                    {showSalesFilters && (
                      <div
                        role="dialog"
                        aria-label="Filter sales by date"
                        className="absolute right-0 top-full z-20 mt-2 w-48 rounded-lg border border-slate-200 bg-white p-2 shadow-lg"
                      >
                        <div className="px-2 py-1.5 text-xs font-semibold text-slate-500">
                          Filter sales by
                        </div>
                        {(
                          [
                            ["today", "Today"],
                            ["week", "This week"],
                            ["month", "This month"],
                            ["year", "This year"],
                          ] as const
                        ).map(([period, label]) => (
                          <button
                            key={period}
                            type="button"
                            aria-pressed={salesPeriod === period}
                            onClick={() => {
                              setSalesPeriod(period);
                              setShowSalesFilters(false);
                            }}
                            className={`flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-xs ${salesPeriod === period ? "bg-[#f5f0ff] font-semibold text-[#5b21b6]" : "text-slate-600 hover:bg-slate-50"}`}
                          >
                            {label}
                            {salesPeriod === period && (
                              <Icons.Check className="size-3.5" />
                            )}
                          </button>
                        ))}
                        <div className="my-1 border-t border-slate-100" />
                        <button
                          type="button"
                          onClick={() => {
                            setOrderView("archived");
                            setShowOrderFilters(false);
                            setOrderStatusFilter("");
                          }}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"
                        >
                          <Icons.Archive className="size-3.5 text-slate-400" />
                          Archived sales
                        </button>
                      </div>
                    )}
                  </div>
                ) : active === "Orders" ? (
                  <div className="relative" ref={orderFiltersRef}>
                    <button
                      type="button"
                      aria-label="Filter orders by period"
                      aria-expanded={showOrderFilters}
                      aria-haspopup="dialog"
                      onClick={() => setShowOrderFilters((open) => !open)}
                      className={`rounded-lg border p-2 ${orderPeriod !== "all" ? "border-[#c4b5fd] bg-[#f5f0ff] text-[#5b21b6]" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
                    >
                      <Icons.SlidersHorizontal className="size-4" />
                    </button>
                    {showOrderFilters && (
                      <div
                        role="dialog"
                        aria-label="Filter orders by date"
                        className="absolute right-0 top-full z-20 mt-2 w-48 rounded-lg border border-slate-200 bg-white p-2 shadow-lg"
                      >
                        <div className="px-2 py-1.5 text-xs font-semibold text-slate-500">
                          Filter orders by
                        </div>
                        {(
                          [
                            ["today", "Today"],
                            ["week", "This week"],
                            ["month", "This month"],
                            ["year", "This year"],
                            ["all", "All dates"],
                          ] as const
                        ).map(([period, label]) => (
                          <button
                            key={period}
                            type="button"
                            aria-pressed={orderPeriod === period}
                            onClick={() => {
                              setOrderPeriod(period);
                              setShowOrderFilters(false);
                            }}
                            className={`flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-xs ${orderPeriod === period ? "bg-[#f5f0ff] font-semibold text-[#5b21b6]" : "text-slate-600 hover:bg-slate-50"}`}
                          >
                            {label}
                            {orderPeriod === period && (
                              <Icons.Check className="size-3.5" />
                            )}
                          </button>
                        ))}
                        <div className="my-1 border-t border-slate-100" />
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"
                        >
                          <Icons.Archive className="size-3.5 text-slate-400" />
                          Archived
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <button className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50">
                    <Icons.SlidersHorizontal className="size-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {tableHeaders(active).map((header) => (
                      <th key={header} className="px-5 py-3">
                        {header}
                      </th>
                    ))}
                    <th className="px-5 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedData.map((item: any, index) => (
                    <TableRow
                      key={item.id || index}
                      item={item}
                      active={active}
                      invoice={
                        active === "Sales"
                          ? state.invoices.find(
                              (invoice) => invoice.saleId === item.id,
                            )
                          : undefined
                      }
                      companyName={
                        state.companyProfile.tradingName ||
                        state.companyProfile.legalName ||
                        companyName
                      }
                      companyLogoUrl={companyLogoUrl}
                      queuePosition={index + 1}
                      onOrderStatusChange={(orderId, status) =>
                        updateOrder(orderId, {
                          status,
                          completedAt:
                            status === "Completed"
                              ? new Date().toISOString()
                              : undefined,
                        })
                      }
                      onArchiveOrder={(orderId, archived) =>
                        updateOrder(orderId, {
                          archivedAt: archived
                            ? new Date().toISOString()
                            : undefined,
                        })
                      }
                    />
                  ))}
                </tbody>
              </table>
              {!filtered.length && (
                <div className="py-16 text-center">
                  <div className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-slate-100">
                    <Search className="size-4 text-slate-400" />
                  </div>
                  <div className="text-sm font-semibold">No records found</div>
                  <div className="mt-1 text-xs text-slate-400">
                    Try a different search or add a new record.
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-[11px] text-slate-400">
              <span>
                Showing {displayedData.length} of {data.length} records
              </span>
              <div className="flex gap-1">
                <button className="rounded border border-slate-200 p-1.5">
                  <ChevronLeft className="size-3.5" />
                </button>
                <button className="rounded bg-[#6d28d9] px-2.5 py-1.5 font-semibold text-white">
                  1
                </button>
                <button className="rounded border border-slate-200 p-1.5">
                  <ChevronRight className="size-3.5" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      {showForm && (
        <FormDialog
          active={active}
          customers={state.customers}
          onClose={() => setShowForm(false)}
          onSubmit={submit}
        />
      )}
    </div>
  );
}

export function SalesKpis({ sales }: { sales: ErpState["sales"] }) {
  const today = new Date().toISOString().slice(0, 10);
  const weekStartDate = new Date();
  weekStartDate.setHours(0, 0, 0, 0);
  weekStartDate.setDate(
    weekStartDate.getDate() - ((weekStartDate.getDay() + 6) % 7),
  );
  const weekStart = weekStartDate.toISOString().slice(0, 10);
  const todaysSales = sales.filter((sale) => sale.date === today);
  const pendingSales = sales.filter(
    (sale) =>
      sale.status === "Pending" &&
      (sale.paymentTerms ?? "Same-day") === "Same-day",
  );
  const pendingCustomerCount = new Set(
    pendingSales.map((sale) => sale.customer.trim().toLowerCase()),
  ).size;
  const debtSales = sales.filter(
    (sale) => sale.status === "Pending" && sale.paymentTerms === "Credit",
  );
  const currentWeekSales = sales.filter(
    (sale) => sale.date >= weekStart && sale.date <= today,
  );
  const debtorCount = new Set(
    debtSales.map((sale) => sale.customer.trim().toLowerCase()),
  ).size;

  return (
    <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi
        label="Total sales today"
        value={money(sum(todaysSales.map((sale) => sale.total)))}
        change={`${todaysSales.length} sales`}
        icon="TrendingUp"
        tone="purple"
        onClick={() => undefined}
      />
      <Kpi
        label="Pending sales"
        value={`${pendingSales.length} sales`}
        change={`Total ${money(sum(pendingSales.map((sale) => sale.total)))} · ${pendingCustomerCount} customers`}
        icon="Clock3"
        tone="amber"
        onClick={() => undefined}
      />
      <Kpi
        label="Outstanding debt sales"
        value={money(sum(debtSales.map((sale) => sale.total)))}
        change={`${debtSales.length} sales · ${debtorCount} customers`}
        icon="HandCoins"
        tone="blue"
        onClick={() => undefined}
      />
      <Kpi
        label="Sales this week"
        value={money(sum(currentWeekSales.map((sale) => sale.total)))}
        change={`${currentWeekSales.length} sales · Since ${weekStart}`}
        icon="BarChart3"
        tone="green"
        onClick={() => undefined}
      />
    </div>
  );
}

export function OrdersKpis({ orders }: { orders: ErpState["orders"] }) {
  const today = new Date().toISOString().slice(0, 10);
  const currentDate = new Date(`${today}T00:00:00.000Z`);
  const weekStartDate = new Date(currentDate);
  weekStartDate.setUTCDate(
    weekStartDate.getUTCDate() - ((weekStartDate.getUTCDay() + 6) % 7),
  );
  const weekStart = weekStartDate.toISOString().slice(0, 10);
  const openOrders = orders.filter(
    (order) =>
      !order.archivedAt && !["Completed", "Cancelled"].includes(order.status),
  );
  const completedThisWeek = orders.filter(
    (order) =>
      order.status === "Completed" &&
      (order.completedAt ?? "").slice(0, 10) >= weekStart &&
      (order.completedAt ?? "").slice(0, 10) <= today,
  );
  const dueToday = openOrders.filter((order) => order.requestedDate === today);
  const overdue = openOrders.filter((order) => order.requestedDate < today);
  const openCustomerCount = new Set(
    openOrders.map((order) => order.customer.trim().toLowerCase()),
  ).size;

  return (
    <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi
        label="Open orders"
        value={`${openOrders.length} orders`}
        change={`Expected ${money(sum(openOrders.map((order) => order.total)))} · ${openCustomerCount} customers`}
        icon="ClipboardList"
        tone="amber"
        onClick={() => undefined}
      />
      <Kpi
        label="Due today"
        value={`${dueToday.length} orders`}
        change={money(sum(dueToday.map((order) => order.total)))}
        icon="CalendarCheck"
        tone="green"
        onClick={() => undefined}
      />
      <Kpi
        label="Overdue orders"
        value={`${overdue.length} orders`}
        change={money(sum(overdue.map((order) => order.total)))}
        icon="CalendarDays"
        tone="blue"
        onClick={() => undefined}
      />
      <Kpi
        label="Completed this week"
        value={`${completedThisWeek.length} orders`}
        change="Fulfilment completed"
        icon="ChartNoAxesCombined"
        tone="purple"
        onClick={() => undefined}
      />
    </div>
  );
}

export function tableHeaders(active: string) {
  if (active === "Sales")
    return ["Reference", "Customer", "Product", "Date", "Total", "Status"];
  if (active === "Orders")
    return [
      "Order / queue",
      "Customer",
      "Items",
      "Received / due",
      "Total",
      "Priority / status",
    ];
  if (active === "Customer Management")
    return ["Customer", "Type", "Contact", "Transactions", "Status"];
  if (active === "Employee Profiles")
    return ["Employee", "Department", "Role", "Category", "Salary", "Status"];
  return ["Reference / name", "Module", "Details", "Date", "Owner", "Status"];
}

export function TableRow({
  item,
  active,
  invoice,
  companyName,
  companyLogoUrl,
  queuePosition,
  onOrderStatusChange,
  onArchiveOrder,
}: {
  item: any;
  active: string;
  invoice?: Invoice;
  companyName: string;
  companyLogoUrl: string;
  queuePosition?: number;
  onOrderStatusChange?: (
    orderId: string,
    status: ErpState["orders"][number]["status"],
  ) => void;
  onArchiveOrder?: (orderId: string, archived: boolean) => void;
}) {
  const [showSalesActions, setShowSalesActions] = useState(false);
  const [showSalesDetails, setShowSalesDetails] = useState(false);
  const [showOrderActions, setShowOrderActions] = useState(false);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const salesActionsRef = useRef<HTMLDivElement>(null);
  const orderActionsRef = useRef<HTMLDivElement>(null);
  const orderStatusTransitions: Partial<
    Record<
      ErpState["orders"][number]["status"],
      ErpState["orders"][number]["status"]
    >
  > = {
    Pending: "Confirmed",
    Confirmed: "In progress",
    "In progress": "Ready",
    Ready: "Completed",
  };
  const nextOrderStatus =
    orderStatusTransitions[item.status as ErpState["orders"][number]["status"]];
  useEffect(() => {
    if (!showSalesActions) return;
    const handleOutsideClick = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !salesActionsRef.current?.contains(event.target)
      ) {
        setShowSalesActions(false);
      }
    };
    document.addEventListener("pointerdown", handleOutsideClick);
    return () =>
      document.removeEventListener("pointerdown", handleOutsideClick);
  }, [showSalesActions]);
  useEffect(() => {
    if (!showOrderActions) return;
    const handleOutsideClick = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !orderActionsRef.current?.contains(event.target)
      ) {
        setShowOrderActions(false);
      }
    };
    document.addEventListener("pointerdown", handleOutsideClick);
    return () =>
      document.removeEventListener("pointerdown", handleOutsideClick);
  }, [showOrderActions]);
  let cells: React.ReactNode[] = [];
  if (active === "Sales")
    cells = [
      <span className="font-semibold text-slate-700">{item.reference}</span>,
      item.customer,
      item.product,
      formatDate(item.date),
      money(item.total),
      <Status text={item.status} />,
    ];
  else if (active === "Orders")
    cells = [
      <div>
        <div className="font-semibold text-slate-700">
          #{queuePosition} · {item.reference}
        </div>
        <div className="mt-1 text-[10px] text-slate-400">
          Received {item.createdAt.slice(11, 16)}
        </div>
      </div>,
      item.customer,
      <div className="max-w-[260px]">
        {item.items.map(
          (orderItem: ErpState["orders"][number]["items"][number]) => (
            <div key={orderItem.id} className="truncate">
              {orderItem.product}{" "}
              <span className="text-slate-400">× {orderItem.quantity}</span>
            </div>
          ),
        )}
      </div>,
      <div>
        <div>{formatDate(item.date)}</div>
        <div
          className={`mt-1 text-[10px] font-semibold ${item.requestedDate < new Date().toISOString().slice(0, 10) && !["Completed", "Cancelled"].includes(item.status) ? "text-red-600" : item.requestedDate === new Date().toISOString().slice(0, 10) ? "text-amber-600" : "text-slate-400"}`}
        >
          {item.requestedDate < new Date().toISOString().slice(0, 10) &&
          !["Completed", "Cancelled"].includes(item.status)
            ? "Overdue · "
            : "Due "}
          {formatDate(item.requestedDate)}
        </div>
      </div>,
      money(item.total),
      <span>
        <Status text={item.priority} />
        {item.priorityReason && (
          <span
            className="block max-w-28 truncate text-[9px] text-amber-700"
            title={item.priorityReason}
          >
            Override recorded
          </span>
        )}
        <Status text={item.status} />
      </span>,
    ];
  else if (active === "Customer Management")
    cells = [
      <button
        onClick={() =>
          window.dispatchEvent(
            new CustomEvent("erp:view", {
              detail: { type: "customer", id: item.id },
            }),
          )
        }
        className="font-semibold text-slate-700 hover:text-[#6d28d9] hover:underline"
      >
        {item.name}
      </button>,
      item.type,
      <span>
        {item.phone}
        <br />
        <span className="text-[10px] text-slate-400">{item.email}</span>
      </span>,
      item.purchases,
      <Status text={item.status} />,
    ];
  else if (active === "Employee Profiles")
    cells = [
      <button
        onClick={() =>
          window.dispatchEvent(
            new CustomEvent("erp:view", {
              detail: { type: "employee", id: item.id },
            }),
          )
        }
        className="text-left font-semibold text-slate-700 hover:text-[#6d28d9] hover:underline"
      >
        {item.name}
        <br />
        <span className="text-[10px] font-normal text-slate-400">
          {item.number}
        </span>
      </button>,
      item.department,
      item.role,
      item.category,
      money(item.salary),
      <Status text={item.status} />,
    ];
  else
    cells = [
      <span className="font-semibold text-slate-700">
        {item.action || item.name || item.id}
      </span>,
      item.module || item.category || "General",
      item.description || item.actor || item.role || "—",
      item.time || item.date || "Today",
      item.actor || item.department || "System",
      <Status text={item.outcome || item.status || "Active"} />,
    ];
  return (
    <tr className="border-b border-slate-50 text-xs text-slate-500 last:border-0 hover:bg-slate-50/50">
      {cells.map((cell, i) => (
        <td key={i} className="px-5 py-4 align-middle">
          {cell}
        </td>
      ))}
      <td className="px-5 py-4">
        {active === "Sales" ? (
          <div className="relative" ref={salesActionsRef}>
            <button
              type="button"
              aria-label={`Actions for ${item.reference}`}
              aria-expanded={showSalesActions}
              onClick={() => setShowSalesActions((open) => !open)}
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-[#6d28d9]"
            >
              <Icons.MoreHorizontal className="size-4" />
            </button>
            {showSalesActions && (
              <div
                role="dialog"
                aria-label={`Sales actions for ${item.reference}`}
                className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg"
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowSalesActions(false);
                    setShowSalesDetails(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"
                >
                  <Icons.Eye className="size-3.5 text-slate-400" /> View details
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSalesActions(false);
                    setShowSalesDetails(true);
                    window.setTimeout(() => window.print(), 0);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"
                >
                  <Icons.Printer className="size-3.5 text-slate-400" /> Print
                  receipt
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"
                >
                  <Icons.Download className="size-3.5 text-slate-400" />{" "}
                  Download
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"
                >
                  <Icons.Archive className="size-3.5 text-slate-400" /> Archive
                </button>
                {item.status === "Pending" && (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"
                  >
                    <Icons.CircleCheck className="size-3.5 text-slate-400" />{" "}
                    Set paid
                  </button>
                )}
              </div>
            )}
          </div>
        ) : active === "Orders" ? (
          <div className="relative" ref={orderActionsRef}>
            <button
              type="button"
              aria-label={`Actions for ${item.reference}`}
              aria-expanded={showOrderActions}
              onClick={() => setShowOrderActions((open) => !open)}
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-[#6d28d9]"
            >
              <Icons.MoreHorizontal className="size-4" />
            </button>
            {showOrderActions && (
              <div
                role="menu"
                className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setShowOrderDetails(true);
                    setShowOrderActions(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"
                >
                  <Icons.Eye className="size-3.5 text-slate-400" /> View order
                  details
                </button>
                {nextOrderStatus && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onOrderStatusChange?.(item.id, nextOrderStatus);
                      setShowOrderActions(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"
                  >
                    <Icons.ArrowRight className="size-3.5 text-slate-400" />{" "}
                    Move to {nextOrderStatus}
                  </button>
                )}
                {!item.archivedAt &&
                  !["Completed", "Cancelled"].includes(item.status) && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onOrderStatusChange?.(item.id, "Cancelled");
                        setShowOrderActions(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"
                    >
                      <Icons.CircleX className="size-3.5 text-slate-400" />{" "}
                      Cancel order
                    </button>
                  )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onArchiveOrder?.(item.id, !item.archivedAt);
                    setShowOrderActions(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"
                >
                  {item.archivedAt ? (
                    <>
                      <Icons.ArchiveRestore className="size-3.5 text-slate-400" />{" "}
                      Restore order
                    </>
                  ) : (
                    <>
                      <Icons.Archive className="size-3.5 text-slate-400" />{" "}
                      Archive order
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        ) : (
          <button className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-[#6d28d9]">
            <Icons.MoreHorizontal className="size-4" />
          </button>
        )}
        {active === "Sales" && showSalesDetails && (
          <SalesDetailsDialog
            sale={item}
            invoice={invoice}
            companyName={companyName}
            companyLogoUrl={companyLogoUrl}
            onClose={() => setShowSalesDetails(false)}
          />
        )}
        {active === "Orders" && showOrderDetails && (
          <OrderDetailsDialog
            order={item}
            onClose={() => setShowOrderDetails(false)}
          />
        )}
      </td>
    </tr>
  );
}

export function OrderDetailsDialog({
  order,
  onClose,
}: {
  order: ErpState["orders"][number];
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-details-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2
              id="order-details-title"
              className="text-base font-bold text-slate-900"
            >
              Order details
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {order.reference} · Received {formatDate(order.date)}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close order details"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div>
            <div className="text-[11px] text-slate-400">Customer</div>
            <div className="mt-1 text-sm font-semibold">{order.customer}</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Status</div>
            <Status text={order.status} />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Requested date</div>
            <div className="mt-1 text-sm font-semibold">
              {formatDate(order.requestedDate)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Fulfilment</div>
            <div className="mt-1 text-sm font-semibold">
              {order.fulfilmentMethod}
              {order.destination ? ` · ${order.destination}` : ""}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Payment terms</div>
            <div className="mt-1 text-sm font-semibold">
              {order.paymentTerms}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Priority</div>
            <div className="mt-1 text-sm font-semibold">{order.priority}</div>
            {order.priorityReason && (
              <p className="mt-1 text-xs text-amber-700">
                Override: {order.priorityReason}
              </p>
            )}
          </div>
          <div className="sm:col-span-2">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
              Items
            </h3>
            <div className="divide-y divide-slate-100 border-y border-slate-100">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between gap-4 py-2.5 text-sm"
                >
                  <span>
                    {item.product}{" "}
                    <span className="text-slate-400">
                      × {item.quantity} at {money(item.unitPrice)}
                    </span>
                  </span>
                  <strong>{money(item.lineTotal)}</strong>
                </div>
              ))}
            </div>
            <div className="mt-3 text-right text-base font-bold">
              Total: {money(order.total)}
            </div>
          </div>
          {order.notes && (
            <div className="sm:col-span-2">
              <div className="text-[11px] text-slate-400">Notes</div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                {order.notes}
              </p>
            </div>
          )}
          <div className="sm:col-span-2">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
              Status history
            </h3>
            <div className="space-y-2">
              {order.statusHistory.map((change, index) => (
                <div
                  key={`${change.at}-${index}`}
                  className="flex justify-between gap-4 text-xs"
                >
                  <span className="font-semibold text-slate-700">
                    {change.status}
                  </span>
                  <time className="text-slate-400">
                    {new Intl.DateTimeFormat("en-GB", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(change.at))}
                  </time>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </section>
    </div>
  );
}

export function SalesDetailsDialog({
  sale,
  invoice,
  companyName,
  companyLogoUrl,
  onClose,
}: {
  sale: ErpState["sales"][number];
  invoice?: Invoice;
  companyName: string;
  companyLogoUrl: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="sale-details-title"
        className="w-full max-w-lg rounded-xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2
              id="sale-details-title"
              className="text-base font-bold text-slate-900"
            >
              Sale details
            </h2>
            <p className="mt-1 text-xs text-slate-500">{sale.reference}</p>
          </div>
          <button
            type="button"
            aria-label="Close sale details"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2">
          {[
            ["Sale reference", sale.reference],
            ["Date", formatDate(sale.date)],
            ["Customer", sale.customer],
            ["Product", sale.product],
            ["Quantity", String(sale.quantity)],
            ["Payment method", sale.method],
            ...(sale.txnID ? [["Transaction ID", sale.txnID]] : []),
            ["Payment terms", sale.paymentTerms ?? "Same-day"],
            ["Status", sale.status],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="text-[11px] font-medium text-slate-400">
                {label}
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-800">
                {value}
              </div>
            </div>
          ))}
          <div className="sm:col-span-2">
            <div className="text-[11px] font-medium text-slate-400">Total</div>
            <div className="mt-1 text-lg font-bold text-slate-900">
              {money(sale.total)}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
          {invoice && (
            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("erp:view", {
                    detail: { type: "invoice", id: invoice.id },
                  }),
                )
              }
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Icons.ReceiptText className="size-4" />
              Open invoice draft
            </button>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-[#6d28d9] px-3 py-2 text-xs font-semibold text-white hover:bg-[#5b21b6]"
          >
            <Icons.Printer className="size-4" /> Print receipt
          </button>
        </div>
        <div className="sale-receipt-print" aria-hidden="true">
          <div className="receipt-brand">
            {companyLogoUrl && (
              <img
                src={companyLogoUrl}
                alt=""
                className="mx-auto mb-2 max-h-12 max-w-32 object-contain"
              />
            )}
            {companyName}
          </div>
          <h1>Sales receipt</h1>
          <div className="receipt-reference">{sale.reference}</div>
          <div className="receipt-divider" />
          <div className="receipt-line">
            <span>Date</span>
            <strong>{formatDate(sale.date)}</strong>
          </div>
          <div className="receipt-line">
            <span>Customer</span>
            <strong>{sale.customer}</strong>
          </div>
          <div className="receipt-line">
            <span>Product</span>
            <strong>{sale.product}</strong>
          </div>
          <div className="receipt-line">
            <span>Quantity</span>
            <strong>{sale.quantity}</strong>
          </div>
          <div className="receipt-line">
            <span>Payment method</span>
            <strong>{sale.method}</strong>
          </div>
          {sale.txnID && (
            <div className="receipt-line">
              <span>Transaction ID</span>
              <strong>{sale.txnID}</strong>
            </div>
          )}
          <div className="receipt-line">
            <span>Payment terms</span>
            <strong>{sale.paymentTerms ?? "Same-day"}</strong>
          </div>
          <div className="receipt-line">
            <span>Status</span>
            <strong>{sale.status}</strong>
          </div>
          <div className="receipt-divider" />
          <div className="receipt-total">
            <span>Total paid / due</span>
            <strong>{money(sale.total)}</strong>
          </div>
          <p className="receipt-thanks">Thank you for your business.</p>
        </div>
      </section>
    </div>
  );
}

export function FormDialog({
  active,
  customers,
  onClose,
  onSubmit,
}: {
  active: string;
  customers: ErpState["customers"];
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [salePaymentTerms, setSalePaymentTerms] = useState("Same-day");
  if (active === "Orders") {
    return (
      <FormDialogShell active={active} onClose={onClose} onSubmit={onSubmit}>
        <form onSubmit={onSubmit}>
          <OrderFormFields customers={customers} onCancel={onClose} />
        </form>
      </FormDialogShell>
    );
  }
  const fieldConfig =
    active === "Sales"
      ? [
          ["customer", "Customer name", "Kampala Fresh Mart"],
          ["product", "Product", "Premium Maize Flour"],
          ["quantity", "Quantity", "1"],
          ["amount", "Total amount (UGX)", "0"],
          ["method", "Payment method", "Cash"],
          ["txnID", "Transaction ID", "Enter transaction ID"],
          ["paymentTerms", "Payment terms", "Same-day"],
          ["dueDate", "Credit due date", ""],
        ]
      : active === "Customer Management"
        ? [
            ["name", "Customer or business name", "New customer"],
            ["phone", "Telephone", "+256 700 000 000"],
            ["email", "Email address", "customer@example.com"],
          ]
        : [
            ["name", "Full name", "New team member"],
            ["department", "Department", "Operations"],
            ["role", "Job title", "Team member"],
            ["salary", "Salary / wage (UGX)", "0"],
          ];

  return (
    <FormDialogShell active={active} onClose={onClose} onSubmit={onSubmit}>
      <form onSubmit={onSubmit} className="p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {fieldConfig
            .filter(
              ([name]) =>
                (name !== "txnID" ||
                  (salePaymentTerms !== "Credit" &&
                    (paymentMethod === "Mobile Money" ||
                      paymentMethod === "Bank Transfer" ||
                      paymentMethod === "Check"))) &&
                (name !== "dueDate" || salePaymentTerms === "Credit") &&
                (name !== "method" || salePaymentTerms !== "Credit"),
            )
            .map(([name, label, placeholder]) => (
              <label
                key={name}
                className="flex flex-col gap-1.5 text-xs font-semibold text-slate-600"
              >
                <span>{label}</span>
                {name === "customer" ? (
                  <select
                    required
                    name="customerId"
                    defaultValue=""
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#8b5cf6] focus:ring-2 focus:ring-purple-100"
                  >
                    <option value="" disabled>
                      Select a customer
                    </option>
                    {customers
                      .filter((customer) => customer.status === "Active")
                      .map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name}
                        </option>
                      ))}
                    {salePaymentTerms !== "Credit" && (
                      <option value="__walkin__">Walk-in customer</option>
                    )}
                  </select>
                ) : name === "dueDate" ? (
                  <input
                    required
                    name={name}
                    type="date"
                    min={new Date().toISOString().slice(0, 10)}
                    placeholder={placeholder}
                    className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-[#8b5cf6] focus:ring-2 focus:ring-purple-100"
                  />
                ) : name === "method" ? (
                  <select
                    name={name}
                    defaultValue="Cash"
                    onChange={(event) => setPaymentMethod(event.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#8b5cf6] focus:ring-2 focus:ring-purple-100"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Mobile Money">Mobile Money</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Check">Check</option>
                  </select>
                ) : name === "paymentTerms" ? (
                  <select
                    name={name}
                    defaultValue="Same-day"
                    onChange={(event) =>
                      setSalePaymentTerms(event.target.value)
                    }
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#8b5cf6] focus:ring-2 focus:ring-purple-100"
                  >
                    <option value="Same-day">Same-day payment</option>
                    <option value="Credit">Credit sale</option>
                  </select>
                ) : (
                  <input
                    required
                    name={name}
                    type={
                      name === "amount" ||
                      name === "quantity" ||
                      name === "salary"
                        ? "number"
                        : "text"
                    }
                    placeholder={placeholder}
                    className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none transition placeholder:text-slate-300 focus:border-[#8b5cf6] focus:ring-2 focus:ring-purple-100"
                  />
                )}
              </label>
            ))}
        </div>
        {active === "Sales" && salePaymentTerms !== "Credit" && (
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-600">
            <span>Status</span>
            <select
              name="status"
              defaultValue="Paid"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#8b5cf6] focus:ring-2 focus:ring-purple-100"
            >
              <option value="Paid">Paid</option>
              <option value="Pending">Pending</option>
            </select>
          </label>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600"
          >
            Cancel
          </button>
          <button className="rounded-lg bg-[#6d28d9] px-4 py-2.5 text-xs font-semibold text-white shadow-sm">
            Save record
          </button>
        </div>
      </form>
    </FormDialogShell>
  );
}

export function FormDialogShell({
  active,
  onClose,
  onSubmit,
  children,
}: {
  active: string;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/35 p-4">
      <div
        className={`max-h-[92vh] w-full overflow-y-auto rounded-2xl bg-white shadow-2xl ${active === "Orders" ? "max-w-3xl" : "max-w-lg"}`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <div>
            <h3 className="font-bold">Add {active}</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              {active === "Orders"
                ? "Add a customer order to the fulfilment queue."
                : "This record will persist in the demo workspace."}
            </p>
          </div>
          <button
            type="button"
            aria-label={`Close add ${active} form`}
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
          >
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function OrderFormFields({
  customers,
  onCancel,
}: {
  customers: ErpState["customers"];
  onCancel: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [customer, setCustomer] = useState("");
  const [newCustomerType, setNewCustomerType] = useState("Small dealer");
  const [priority, setPriority] = useState<"Normal" | "High">("Normal");
  const [fulfilmentMethod, setFulfilmentMethod] = useState<
    "Delivery" | "Pickup"
  >("Delivery");
  const [items, setItems] = useState([
    { id: "line-1", product: "", quantity: 1, unitPrice: 0 },
  ]);
  const total = items.reduce(
    (amount, item) => amount + item.quantity * item.unitPrice,
    0,
  );
  const serializedItems = JSON.stringify(
    items.map((item) => ({
      id: item.id,
      product: item.product,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.quantity * item.unitPrice,
    })),
  );
  const fieldClass =
    "rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#8b5cf6] focus:ring-2 focus:ring-purple-100";
  const labelClass =
    "flex flex-col gap-1.5 text-xs font-semibold text-slate-600";

  return (
    <>
      <div className="space-y-5 p-5">
        <section>
          <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">
            Customer
          </h4>
          <label className={labelClass}>
            Customer
            <select
              required
              name="customer"
              value={customer}
              onChange={(event) => setCustomer(event.target.value)}
              className={fieldClass}
            >
              <option value="" disabled>
                Select customer
              </option>
              {customers
                .filter((item) => item.status === "Active")
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              <option value="__new__">+ Add a new customer</option>
            </select>
          </label>
          {customer === "__new__" && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className={labelClass}>
                Customer name
                <input
                  required
                  name="newCustomerName"
                  className={fieldClass}
                  placeholder="Business or person"
                />
              </label>
              <label className={labelClass}>
                Customer type
                <select
                  required
                  name="newCustomerType"
                  value={newCustomerType}
                  onChange={(event) => setNewCustomerType(event.target.value)}
                  className={fieldClass}
                >
                  <option>Big dealer</option>
                  <option>Small dealer</option>
                  <option>Export customer</option>
                </select>
              </label>
              <label className={labelClass}>
                Primary contact
                <input
                  required
                  name="newCustomerContact"
                  className={fieldClass}
                  placeholder="Contact person's name"
                />
              </label>
              <label className={labelClass}>
                Phone
                <input
                  required
                  name="newCustomerPhone"
                  type="tel"
                  className={fieldClass}
                  placeholder="+256..."
                />
              </label>
              <label className={labelClass}>
                Email
                <input
                  name="newCustomerEmail"
                  type="email"
                  className={fieldClass}
                  placeholder="orders@example.com"
                />
              </label>
              <label className={labelClass}>
                Referred by
                <input
                  required
                  name="newCustomerReferredBy"
                  className={fieldClass}
                  placeholder="Staff member or referrer"
                />
              </label>
              {newCustomerType === "Big dealer" && (
                <>
                  <label className={labelClass}>
                    Region
                    <input
                      required
                      name="newCustomerRegion"
                      className={fieldClass}
                    />
                  </label>
                  <label className={labelClass}>
                    District
                    <input
                      required
                      name="newCustomerDistrict"
                      className={fieldClass}
                    />
                  </label>
                  <label className={labelClass}>
                    TIN (optional)
                    <input name="newCustomerTin" className={fieldClass} />
                  </label>
                </>
              )}
              {newCustomerType === "Export customer" && (
                <label className={labelClass}>
                  Country of operation
                  <input
                    required
                    name="newCustomerCountry"
                    className={fieldClass}
                  />
                </label>
              )}
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Order items
            </h4>
            <button
              type="button"
              onClick={() =>
                setItems((current) => [
                  ...current,
                  {
                    id: `line-${Date.now()}`,
                    product: "",
                    quantity: 1,
                    unitPrice: 0,
                  },
                ])
              }
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#6d28d9] hover:underline"
            >
              <Plus className="size-3.5" /> Add item
            </button>
          </div>
          <input type="hidden" name="items" value={serializedItems} />
          <div className="space-y-3">
            {items.map((item, index) => (
              <div
                key={item.id}
                className="grid items-end gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[minmax(0,1fr)_100px_150px_36px]"
              >
                <label className={labelClass}>
                  Product / description
                  <input
                    required
                    value={item.product}
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((line) =>
                          line.id === item.id
                            ? { ...line, product: event.target.value }
                            : line,
                        ),
                      )
                    }
                    className={fieldClass}
                    placeholder="Product name"
                  />
                </label>
                <label className={labelClass}>
                  Quantity
                  <input
                    required
                    min="1"
                    step="1"
                    type="number"
                    value={item.quantity}
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((line) =>
                          line.id === item.id
                            ? {
                                ...line,
                                quantity: Math.max(
                                  1,
                                  Number(event.target.value),
                                ),
                              }
                            : line,
                        ),
                      )
                    }
                    className={fieldClass}
                  />
                </label>
                <label className={labelClass}>
                  Unit price (UGX)
                  <input
                    required
                    min="0"
                    step="1"
                    type="number"
                    value={item.unitPrice}
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((line) =>
                          line.id === item.id
                            ? {
                                ...line,
                                unitPrice: Math.max(
                                  0,
                                  Number(event.target.value),
                                ),
                              }
                            : line,
                        ),
                      )
                    }
                    className={fieldClass}
                  />
                </label>
                <button
                  type="button"
                  aria-label={`Remove item ${index + 1}`}
                  disabled={items.length === 1}
                  onClick={() =>
                    setItems((current) =>
                      current.filter((line) => line.id !== item.id),
                    )
                  }
                  className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                >
                  <Icons.Trash2 className="size-4" />
                </button>
                <div className="text-right text-xs text-slate-500 sm:col-span-4">
                  Line total:{" "}
                  <strong className="text-slate-800">
                    {money(item.quantity * item.unitPrice)}
                  </strong>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-end border-t border-slate-100 pt-3 text-sm font-bold">
            Order total:{" "}
            <span className="ml-2 text-[#5b21b6]">{money(total)}</span>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Requested fulfilment date
            <input
              required
              name="requestedDate"
              type="date"
              min={today}
              defaultValue={today}
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            Fulfilment method
            <select
              name="fulfilmentMethod"
              value={fulfilmentMethod}
              onChange={(event) =>
                setFulfilmentMethod(event.target.value as "Delivery" | "Pickup")
              }
              className={fieldClass}
            >
              <option value="Delivery">Delivery</option>
              <option value="Pickup">Customer pickup</option>
            </select>
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            {fulfilmentMethod === "Delivery"
              ? "Delivery address / instructions"
              : "Pickup instructions"}
            <input
              name="destination"
              className={fieldClass}
              placeholder={
                fulfilmentMethod === "Delivery"
                  ? "Delivery location"
                  : "Pickup details"
              }
            />
          </label>
          <label className={labelClass}>
            Payment terms
            <select
              name="paymentTerms"
              defaultValue="Same-day"
              className={fieldClass}
            >
              <option value="Paid now">Paid now</option>
              <option value="Same-day">Same-day payment</option>
              <option value="Credit">Credit terms</option>
            </select>
          </label>
          <label className={labelClass}>
            Priority
            <select
              name="priority"
              value={priority}
              onChange={(event) =>
                setPriority(event.target.value as "Normal" | "High")
              }
              className={fieldClass}
            >
              <option value="Normal">Normal</option>
              <option value="High">High priority</option>
            </select>
          </label>
          {priority === "High" && (
            <label className={`${labelClass} sm:col-span-2`}>
              Reason for priority override
              <textarea
                required
                name="priorityReason"
                rows={2}
                className={fieldClass}
                placeholder="Explain why this order must move ahead of older orders"
              />
            </label>
          )}
          <label className={`${labelClass} sm:col-span-2`}>
            Order notes
            <textarea
              name="notes"
              rows={3}
              className={fieldClass}
              placeholder="Customer instructions or internal notes"
            />
          </label>
        </section>
      </div>
      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-100 bg-white px-5 py-4">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-lg bg-[#6d28d9] px-4 py-2.5 text-xs font-semibold text-white shadow-sm"
        >
          Add to order queue
        </button>
      </div>
    </>
  );
}

export function AnalyticsPanel({
  active,
  state,
}: {
  active: string;
  state: ErpState;
}) {
  const lowStock = state.materials.filter(
    (material) => material.quantity <= material.threshold,
  ).length;
  const insights = [
    {
      title: "Sales momentum",
      text: "Weekly revenue is trending above the previous period.",
      Icon: TrendingUp,
    },
    {
      title: "Inventory watch",
      text: `${lowStock} materials need replenishment planning.`,
      Icon: Icons.AlertTriangle,
    },
    {
      title: "Data boundary",
      text: "All figures are simulated and stored only in this browser.",
      Icon: Icons.Info,
    },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:col-span-2">
        <h3 className="text-sm font-bold">{active} overview</h3>
        <p className="mt-1 text-xs text-slate-400">
          Derived from your shared demonstration records.
        </p>
        <div className="mt-5 h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid vertical={false} stroke="#eef0f4" />
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="sales" fill="#6d28d9" radius={[5, 5, 0, 0]} />
              <Bar dataKey="expenses" fill="#c4b5fd" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-bold">Management insights</h3>
        <div className="mt-5 flex flex-col gap-4">
          {insights.map(({ title, text, Icon }) => (
            <div key={title} className="flex gap-3 rounded-xl bg-slate-50 p-4">
              <Icon className="mt-0.5 size-4 shrink-0 text-[#6d28d9]" />
              <div>
                <div className="text-xs font-bold">{title}</div>
                <div className="mt-1 text-xs leading-relaxed text-slate-500">
                  {text}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-bold">Report controls</h3>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-600">
            From
            <input
              type="date"
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal"
            />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            To
            <input
              type="date"
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal"
            />
          </label>
        </div>
        <button
          onClick={() =>
            exportCsv(
              "company-report.csv",
              state.sales as unknown as Record<string, unknown>[],
            )
          }
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#6d28d9] px-4 py-2.5 text-xs font-semibold text-white"
        >
          <Download className="size-4" /> Export report
        </button>
      </section>
    </div>
  );
}
