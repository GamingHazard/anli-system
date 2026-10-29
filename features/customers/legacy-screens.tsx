"use client";

import { useEffect, useRef, useState } from "react";
import * as Icons from "lucide-react";
import { ChevronLeft, Download, Plus, Search, X } from "lucide-react";
import { balanceForSale, exportCsv, formatDate, initials, money, paymentStateForSale, sum, ErpState } from "@/lib/erp";
import { ApiError, archiveCustomer as archiveCustomerApi, changeCustomerStatus as changeCustomerStatusApi, createCustomer as createCustomerApi, restoreCustomer as restoreCustomerApi, updateCustomer as updateCustomerApi } from "@/lib/user-api";
import { iconMap } from "@/features/workspace/legacy-shell";
import { Status } from "@/features/workspace/legacy-widgets";

export function customerSalesFor(
  customer: ErpState["customers"][number],
  state: ErpState,
) {
  return state.sales.filter((sale) => {
    if (sale.customerId === customer.id) return true;
    if (
      sale.customerId &&
      state.customers.some((item) => item.id === sale.customerId)
    ) {
      return false;
    }
    const matches = state.customers.filter(
      (item) =>
        item.name.trim().replace(/\s+/g, " ").toLowerCase() ===
        sale.customer.trim().replace(/\s+/g, " ").toLowerCase(),
    );
    return matches.length === 1 && matches[0].id === customer.id;
  });
}

export function customerOrdersFor(
  customer: ErpState["customers"][number],
  state: ErpState,
) {
  return state.orders.filter((order) => {
    if (order.customerId === customer.id) return true;
    if (
      order.customerId &&
      state.customers.some((item) => item.id === order.customerId)
    ) {
      return false;
    }
    const matches = state.customers.filter(
      (item) =>
        item.name.trim().replace(/\s+/g, " ").toLowerCase() ===
        order.customer.trim().replace(/\s+/g, " ").toLowerCase(),
    );
    return matches.length === 1 && matches[0].id === customer.id;
  });
}

export function customerCreditBalance(
  customer: ErpState["customers"][number],
  state: ErpState,
) {
  return sum(
    customerSalesFor(customer, state)
      .filter((sale) => sale.paymentTerms === "Credit")
      .map((sale) => balanceForSale(sale, state.payments)),
  );
}

export function CustomerManagementPage({
  state,
  updateCustomers,
  customersLoaded,
  loadError,
  onRetry,
  canManage,
  onView,
}: {
  state: ErpState;
  updateCustomers: (customers: ErpState["customers"]) => void;
  customersLoaded: boolean;
  loadError: string;
  onRetry: () => void;
  canManage: boolean;
  onView: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All types");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [regionFilter, setRegionFilter] = useState("All regions");
  const [districtFilter, setDistrictFilter] = useState("All districts");
  const [referrerFilter, setReferrerFilter] = useState("All referrers");
  const [period, setPeriod] = useState<"all" | "month" | "year">("month");
  const [editingCustomer, setEditingCustomer] = useState<
    ErpState["customers"][number] | null
  >(null);
  const [showForm, setShowForm] = useState(false);
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState("");
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!openActionId) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !actionsRef.current?.contains(event.target)
      ) {
        setOpenActionId(null);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [openActionId]);
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const yearStart = `${now.getFullYear()}-01-01`;
  const selectedPeriodStart =
    period === "month" ? monthStart : period === "year" ? yearStart : "";
  const runCustomerMutation = async (
    work: () => Promise<ErpState["customers"][number]>,
    successMessage: string,
  ) => {
    if (!canManage || !customersLoaded || saving) return null;
    setSaving(true);
    setActionError("");
    try {
      const updatedCustomer = await work();
      updateCustomers([
        updatedCustomer,
        ...state.customers.filter((item) => item.id !== updatedCustomer.id),
      ]);
      setToast(successMessage);
      window.setTimeout(() => setToast(""), 2600);
      return updatedCustomer;
    } catch (error) {
      setActionError(
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "The customer change could not be saved.",
      );
      return null;
    } finally {
      setSaving(false);
    }
  };
  const activeCustomers = state.customers.filter(
    (customer) => customer.status === "Active" && !customer.archivedAt,
  );
  const addedThisMonth = state.customers.filter(
    (customer) =>
      !customer.archivedAt &&
      customer.createdAt?.slice(0, 7) === monthStart.slice(0, 7),
  ).length;
  const debtors = state.customers.filter(
    (customer) =>
      !customer.archivedAt && customerCreditBalance(customer, state) > 0,
  );
  const types = [
    ...new Set(
      state.customers.map((customer) => customer.type).filter(Boolean),
    ),
  ].sort();
  const regions = [
    ...new Set(
      state.customers
        .map((customer) => customer.region)
        .filter((value): value is string => Boolean(value)),
    ),
  ].sort();
  const districts = [
    ...new Set(
      state.customers
        .map((customer) => customer.district)
        .filter((value): value is string => Boolean(value)),
    ),
  ].sort();
  const referrers = [
    ...new Set(
      state.customers
        .map((customer) => customer.referredBy)
        .filter((value): value is string => Boolean(value)),
    ),
  ].sort();
  const filteredCustomers = state.customers.filter((customer) => {
    const sales = customerSalesFor(customer, state);
    const orders = customerOrdersFor(customer, state);
    const searchable = [
      customer.name,
      customer.id,
      customer.contact,
      customer.phone,
      customer.email,
      customer.region,
      customer.district,
      customer.country,
      customer.tin,
      customer.referredBy,
      ...sales.map((sale) => sale.reference),
      ...orders.map((order) => order.reference),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return (
      (statusFilter === "Archived"
        ? Boolean(customer.archivedAt)
        : !customer.archivedAt) &&
      searchable.includes(search.trim().toLowerCase()) &&
      (typeFilter === "All types" || customer.type === typeFilter) &&
      (statusFilter === "All statuses" ||
        statusFilter === "Archived" ||
        customer.status === statusFilter) &&
      (regionFilter === "All regions" || customer.region === regionFilter) &&
      (districtFilter === "All districts" ||
        customer.district === districtFilter) &&
      (referrerFilter === "All referrers" ||
        customer.referredBy === referrerFilter)
    );
  });
  const saveCustomer = async (form: FormData) => {
    const existing = editingCustomer;
    const customer = {
      name: String(form.get("name") || "").trim(),
      type: String(form.get("type") || "Small dealer"),
      contact: String(form.get("contact") || "").trim(),
      phone: String(form.get("phone") || "").trim(),
      email: String(form.get("email") || "").trim(),
      region: String(form.get("region") || "").trim() || undefined,
      district: String(form.get("district") || "").trim() || undefined,
      tin: String(form.get("tin") || "").trim() || undefined,
      country: String(form.get("country") || "").trim() || undefined,
      referredBy: String(form.get("referredBy") || "").trim(),
      notes: String(form.get("notes") || "").trim() || undefined,
      status: String(form.get("status") || "Active") as
        | "Active"
        | "Inactive"
        | "Suspended",
    };
    const saved = await runCustomerMutation(
      () =>
        existing
          ? updateCustomerApi(existing.id, customer)
          : createCustomerApi({
              name: customer.name,
              type: customer.type,
              phone: customer.phone,
              contact: customer.contact,
              email: customer.email,
              region: customer.region,
              district: customer.district,
              tin: customer.tin,
              country: customer.country,
              referredBy: customer.referredBy,
              notes: customer.notes,
              status: customer.status,
            }),
      existing ? "Customer updated" : "Customer added",
    );
    if (!saved) return;
    setEditingCustomer(null);
    setShowForm(false);
  };
  const setCustomerStatus = (
    customer: ErpState["customers"][number],
    status: "Active" | "Suspended",
  ) => {
    void runCustomerMutation(
      () => changeCustomerStatusApi(customer.id, status),
      status === "Suspended" ? "Customer suspended" : "Customer set to active",
    );
    setOpenActionId(null);
  };
  const setCustomerArchived = (
    customer: ErpState["customers"][number],
    archived: boolean,
  ) => {
    void runCustomerMutation(
      () =>
        archived
          ? archiveCustomerApi(customer.id)
          : restoreCustomerApi(customer.id),
      archived ? "Customer archived" : "Customer restored",
    );
    setOpenActionId(null);
  };
  const activateCustomer = (customer: ErpState["customers"][number]) => {
    void runCustomerMutation(
      () =>
        updateCustomerApi(customer.id, { status: "Active", archivedAt: null }),
      "Customer set to active",
    );
    setOpenActionId(null);
  };
  const downloadCustomer = (customer: ErpState["customers"][number]) => {
    const sales = customerSalesFor(customer, state);
    exportCsv(
      `${customer.id.toLowerCase()}-${customer.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`,
      [
        {
          id: customer.id,
          name: customer.name,
          type: customer.type,
          contact: customer.contact ?? "",
          phone: customer.phone,
          email: customer.email,
          region: customer.region ?? "",
          district: customer.district ?? "",
          tin: customer.tin ?? "",
          country: customer.country ?? "",
          referredBy: customer.referredBy ?? "",
          salesCount: sales.length,
          lifetimeSales: sum(sales.map((sale) => sale.total)),
          outstandingCredit: customerCreditBalance(customer, state),
          status: customer.status,
          archived: Boolean(customer.archivedAt),
        },
      ],
    );
    setOpenActionId(null);
  };

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 text-xs font-medium text-slate-400">
            Workspace / Customer Management
          </div>
          <h2 className="text-2xl font-bold tracking-tight">
            Customer directory
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            One customer record, linked to every sale, order and repayment.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() =>
              exportCsv(
                "customers.csv",
                filteredCustomers.map((customer) => {
                  const sales = customerSalesFor(customer, state);
                  const periodSales = sales.filter(
                    (sale) =>
                      !selectedPeriodStart || sale.date >= selectedPeriodStart,
                  );
                  return {
                    id: customer.id,
                    name: customer.name,
                    type: customer.type,
                    contact: customer.contact ?? "",
                    phone: customer.phone,
                    email: customer.email,
                    region: customer.region ?? "",
                    district: customer.district ?? "",
                    country: customer.country ?? "",
                    referredBy: customer.referredBy ?? "",
                    salesCount: sales.length,
                    periodSales: sum(periodSales.map((sale) => sale.total)),
                    outstanding: sum(
                      sales.map((sale) => balanceForSale(sale, state.payments)),
                    ),
                    status: customer.status,
                  };
                }),
              )
            }
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <Download className="size-4" /> Export CSV
          </button>
          {canManage && (
            <button
              disabled={!customersLoaded || saving}
              onClick={() => {
                setEditingCustomer(null);
                setActionError("");
                setShowForm(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-[#6d28d9] px-3 py-2 text-xs font-semibold text-white hover:bg-[#5b21b6] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="size-4" /> Add customer
            </button>
          )}
        </div>
      </div>

      {!customersLoaded && (
        <p
          role="status"
          className="mb-4 rounded-lg bg-white px-4 py-3 text-sm text-slate-500"
        >
          Loading customer records…
        </p>
      )}
      {loadError && (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <span>{loadError}</span>
          <button
            type="button"
            onClick={onRetry}
            className="font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}
      {actionError && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          {actionError}
        </p>
      )}
      {toast && (
        <div
          role="status"
          className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700"
        >
          {toast}
        </div>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CustomerMetric
          label="Total customers"
          value={state.customers.length}
          detail="All customer records"
          icon="UsersRound"
          tone="purple"
        />
        <CustomerMetric
          label="Active customers"
          value={activeCustomers.length}
          detail={`${state.customers.length - activeCustomers.length} inactive accounts`}
          icon="UserRoundCheck"
          tone="green"
        />
        <CustomerMetric
          label="Added this month"
          value={addedThisMonth}
          detail="Based on recorded creation dates"
          icon="UserRoundPlus"
          tone="blue"
        />
        <CustomerMetric
          label="Outstanding credit"
          value={debtors.length}
          detail={`${money(sum(state.customers.map((customer) => customerCreditBalance(customer, state))))} balance`}
          icon="HandCoins"
          tone="amber"
        />
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-1 flex-wrap gap-2">
            <label className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 sm:max-w-sm sm:flex-1">
              <Search className="size-4 shrink-0 text-slate-400" />
              <input
                aria-label="Search customers"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-slate-400"
                placeholder="Name, ID, contact, location or transaction"
              />
            </label>
            <select
              aria-label="Filter by customer type"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
            >
              <option>All types</option>
              {types.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
            <select
              aria-label="Filter by account status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
            >
              <option>All statuses</option>
              <option>Active</option>
              <option>Suspended</option>
              <option>Inactive</option>
              <option>Archived</option>
            </select>
            {regions.length > 0 && (
              <select
                aria-label="Filter by region"
                value={regionFilter}
                onChange={(event) => setRegionFilter(event.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
              >
                <option>All regions</option>
                {regions.map((region) => (
                  <option key={region}>{region}</option>
                ))}
              </select>
            )}
            {districts.length > 0 && (
              <select
                aria-label="Filter by district"
                value={districtFilter}
                onChange={(event) => setDistrictFilter(event.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
              >
                <option>All districts</option>
                {districts.map((district) => (
                  <option key={district}>{district}</option>
                ))}
              </select>
            )}
            {referrers.length > 0 && (
              <select
                aria-label="Filter by referrer"
                value={referrerFilter}
                onChange={(event) => setReferrerFilter(event.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
              >
                <option>All referrers</option>
                {referrers.map((referrer) => (
                  <option key={referrer}>{referrer}</option>
                ))}
              </select>
            )}
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
            Revenue period
            <select
              aria-label="Revenue period"
              value={period}
              onChange={(event) =>
                setPeriod(event.target.value as typeof period)
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
            >
              <option value="month">This month</option>
              <option value="year">This year</option>
              <option value="all">All time</option>
            </select>
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1150px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-400">
              <tr>
                {[
                  "Customer",
                  "Type",
                  "Contact",
                  "Operating area",
                  "Referred by",
                  "Sales",
                  "Revenue",
                  "Credit balance",
                  "Last sale",
                  "Status",
                  "Actions",
                ].map((heading) => (
                  <th key={heading} className="px-4 py-3">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer) => {
                const sales = customerSalesFor(customer, state);
                const lastSale = [...sales].sort((left, right) =>
                  right.date.localeCompare(left.date),
                )[0];
                const periodSales = sales.filter(
                  (sale) =>
                    !selectedPeriodStart || sale.date >= selectedPeriodStart,
                );
                const balance = customerCreditBalance(customer, state);
                const area =
                  customer.type === "Big dealer"
                    ? [customer.region, customer.district]
                        .filter(Boolean)
                        .join(" · ")
                    : customer.type === "Export customer"
                      ? customer.country
                      : "—";
                return (
                  <tr
                    key={customer.id}
                    className="border-t border-slate-100 text-slate-600 hover:bg-slate-50/70"
                  >
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => onView(customer.id)}
                        className="text-left font-semibold text-slate-800 hover:text-[#6d28d9] hover:underline"
                      >
                        {customer.name}
                        <span className="mt-1 block font-mono text-[10px] font-normal text-slate-400">
                          {customer.id}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3.5">{customer.type}</td>
                    <td className="px-4 py-3.5">
                      <span className="font-medium text-slate-700">
                        {customer.contact || "—"}
                      </span>
                      <span className="mt-1 block">{customer.phone}</span>
                      <span className="mt-0.5 block text-[10px] text-slate-400">
                        {customer.email || ""}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">{area || "—"}</td>
                    <td className="px-4 py-3.5">
                      {customer.referredBy || "—"}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-700">
                      {sales.length}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-700">
                      {money(sum(periodSales.map((sale) => sale.total)))}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-700">
                      {money(balance)}
                    </td>
                    <td className="px-4 py-3.5">
                      {lastSale ? formatDate(lastSale.date) : "—"}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1">
                        {customer.archivedAt && (
                          <span className="mr-1 rounded bg-slate-100 px-1.5 py-1 text-[9px] font-semibold uppercase text-slate-500">
                            Archived
                          </span>
                        )}
                        <Status text={customer.status} />
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div
                        className="relative"
                        ref={openActionId === customer.id ? actionsRef : null}
                      >
                        <button
                          type="button"
                          disabled={!customersLoaded || saving}
                          aria-label={`Actions for ${customer.name}`}
                          aria-expanded={openActionId === customer.id}
                          aria-haspopup="menu"
                          onClick={() =>
                            setOpenActionId((current) =>
                              current === customer.id ? null : customer.id,
                            )
                          }
                          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                        >
                          <Icons.MoreHorizontal className="size-4" />
                        </button>
                        {openActionId === customer.id && (
                          <div
                            role="menu"
                            aria-label={`Actions for ${customer.name}`}
                            className="absolute right-0 top-full z-30 mt-1 w-48 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg"
                          >
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setOpenActionId(null);
                                onView(customer.id);
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"
                            >
                              <Icons.UserRound className="size-3.5 text-slate-400" />{" "}
                              View profile
                            </button>
                            {canManage && (
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setEditingCustomer(customer);
                                  setActionError("");
                                  setShowForm(true);
                                  setOpenActionId(null);
                                }}
                                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"
                              >
                                <Icons.PencilLine className="size-3.5 text-slate-400" />{" "}
                                Edit customer
                              </button>
                            )}
                            {canManage &&
                              !customer.archivedAt &&
                              customer.status !== "Suspended" && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() =>
                                    setCustomerStatus(customer, "Suspended")
                                  }
                                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"
                                >
                                  <Icons.Pause className="size-3.5 text-slate-400" />{" "}
                                  Suspend
                                </button>
                              )}
                            {canManage &&
                              (customer.status !== "Active" ||
                                customer.archivedAt) && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => activateCustomer(customer)}
                                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"
                                >
                                  <Icons.CircleCheck className="size-3.5 text-slate-400" />{" "}
                                  Set active
                                </button>
                              )}
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => downloadCustomer(customer)}
                              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"
                            >
                              <Icons.Download className="size-3.5 text-slate-400" />{" "}
                              Download
                            </button>
                            {canManage && (
                              <div className="my-1 border-t border-slate-100" />
                            )}
                            {canManage && (
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() =>
                                  setCustomerArchived(
                                    customer,
                                    !customer.archivedAt,
                                  )
                                }
                                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-rose-700 hover:bg-rose-50"
                              >
                                {customer.archivedAt ? (
                                  <>
                                    <Icons.ArchiveRestore className="size-3.5" />{" "}
                                    Restore from archive
                                  </>
                                ) : (
                                  <>
                                    <Icons.Archive className="size-3.5" />{" "}
                                    Archive customer
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filteredCustomers.length && (
                <tr>
                  <td
                    colSpan={11}
                    className="px-4 py-12 text-center text-sm text-slate-400"
                  >
                    No customers match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 px-4 py-3 text-[11px] text-slate-400">
          Showing {filteredCustomers.length}{" "}
          {statusFilter === "Archived" ? "archived" : "active directory"}{" "}
          records · Sales counts are calculated from linked transactions
        </div>
      </section>

      {showForm && (
        <CustomerFormDialog
          customer={editingCustomer}
          isSaving={saving}
          saveError={actionError}
          onClose={() => {
            setShowForm(false);
            setEditingCustomer(null);
          }}
          onSave={saveCustomer}
        />
      )}
    </div>
  );
}

export function CustomerMetric({
  label,
  value,
  detail,
  icon,
  tone,
}: {
  label: string;
  value: number | string;
  detail: string;
  icon: string;
  tone: string;
}) {
  const Icon = iconMap[icon] || Icons.UsersRound;
  const toneClass =
    tone === "green"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "blue"
        ? "bg-sky-50 text-sky-700"
        : tone === "amber"
          ? "bg-amber-50 text-amber-700"
          : "bg-violet-50 text-violet-700";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <span
          className={`grid size-9 place-items-center rounded-lg ${toneClass}`}
        >
          <Icon className="size-[17px]" />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Live
        </span>
      </div>
      <div className="mt-3 text-xl font-bold tracking-tight">{value}</div>
      <div className="mt-0.5 text-xs font-semibold text-slate-700">{label}</div>
      <div className="mt-1 text-[10px] text-slate-400">{detail}</div>
    </div>
  );
}

export function CustomerFormDialog({
  customer,
  isSaving,
  saveError,
  onClose,
  onSave,
}: {
  customer: ErpState["customers"][number] | null;
  isSaving: boolean;
  saveError: string;
  onClose: () => void;
  onSave: (form: FormData) => void;
}) {
  const [type, setType] = useState(customer?.type ?? "Small dealer");
  const fieldClass =
    "mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#8b5cf6] focus:ring-2 focus:ring-purple-100";
  const labelClass = "block text-xs font-semibold text-slate-600";
  const isBigDealer = type === "Big dealer";
  const isExport = type === "Export customer";

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
        aria-labelledby="customer-form-title"
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <div>
            <h3 id="customer-form-title" className="text-base font-bold">
              {customer ? "Edit customer" : "Add customer"}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Customer records stay linked to their transaction history.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close customer form"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"
          >
            <X className="size-4" />
          </button>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSave(new FormData(event.currentTarget));
          }}
          className="p-5"
        >
          {saveError && (
            <p
              role="alert"
              className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
            >
              {saveError}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={`${labelClass} sm:col-span-2`}>
              Customer or business name
              <input
                required
                name="name"
                defaultValue={customer?.name ?? ""}
                className={fieldClass}
                placeholder="Registered customer name"
              />
            </label>
            <label className={labelClass}>
              Customer type
              <select
                required
                name="type"
                value={type}
                onChange={(event) => setType(event.target.value)}
                className={fieldClass}
              >
                {customer &&
                  !["Big dealer", "Small dealer", "Export customer"].includes(
                    customer.type,
                  ) && (
                    <option value={customer.type}>
                      {customer.type} (existing)
                    </option>
                  )}
                <option>Big dealer</option>
                <option>Small dealer</option>
                <option>Export customer</option>
              </select>
            </label>
            <label className={labelClass}>
              Primary contact person
              <input
                required={!customer || Boolean(customer.contact)}
                name="contact"
                defaultValue={customer?.contact ?? ""}
                className={fieldClass}
                placeholder="Full name"
              />
            </label>
            <label className={labelClass}>
              Contact number
              <input
                required
                name="phone"
                type="tel"
                defaultValue={customer?.phone ?? ""}
                className={fieldClass}
                placeholder="+256 700 000 000"
              />
            </label>
            <label className={labelClass}>
              Email address{" "}
              <span className="font-normal text-slate-400">Optional</span>
              <input
                name="email"
                type="email"
                defaultValue={customer?.email ?? ""}
                className={fieldClass}
                placeholder="name@business.com"
              />
            </label>
            {isBigDealer && (
              <>
                <label className={labelClass}>
                  Region of operation
                  <input
                    required
                    name="region"
                    defaultValue={customer?.region ?? ""}
                    className={fieldClass}
                    placeholder="Region"
                  />
                </label>
                <label className={labelClass}>
                  District
                  <input
                    required
                    name="district"
                    defaultValue={customer?.district ?? ""}
                    className={fieldClass}
                    placeholder="District"
                  />
                </label>
                <label className={labelClass}>
                  TIN{" "}
                  <span className="font-normal text-slate-400">Optional</span>
                  <input
                    name="tin"
                    defaultValue={customer?.tin ?? ""}
                    className={fieldClass}
                    placeholder="Tax identification number"
                  />
                </label>
              </>
            )}
            {isExport && (
              <label className={labelClass}>
                Country of operation
                <input
                  required
                  name="country"
                  defaultValue={customer?.country ?? ""}
                  className={fieldClass}
                  placeholder="Country"
                />
              </label>
            )}
            <label className={labelClass}>
              Referred by
              <input
                required={!customer || Boolean(customer.referredBy)}
                name="referredBy"
                defaultValue={customer?.referredBy ?? ""}
                className={fieldClass}
                placeholder="Staff member or external referrer"
              />
            </label>
            <label className={labelClass}>
              Account status
              <select
                name="status"
                defaultValue={customer?.status ?? "Active"}
                className={fieldClass}
              >
                <option>Active</option>
                <option>Suspended</option>
                <option>Inactive</option>
              </select>
            </label>
            <label className={`${labelClass} sm:col-span-2`}>
              Notes <span className="font-normal text-slate-400">Optional</span>
              <textarea
                name="notes"
                rows={3}
                defaultValue={customer?.notes ?? ""}
                className={fieldClass}
                placeholder="Account preferences or relationship notes"
              />
            </label>
          </div>
          <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              disabled={isSaving}
              className="rounded-lg bg-[#6d28d9] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#5b21b6] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving
                ? "Saving…"
                : customer
                  ? "Save changes"
                  : "Create customer"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function CustomerDetails({
  customer,
  state,
  onBack,
}: {
  customer: ErpState["customers"][number];
  state: ErpState;
  onBack: () => void;
}) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "sales" | "orders" | "payments"
  >("overview");
  const sales = customerSalesFor(customer, state).sort((left, right) =>
    right.date.localeCompare(left.date),
  );
  const orders = customerOrdersFor(customer, state).sort((left, right) =>
    right.date.localeCompare(left.date),
  );
  const saleIds = new Set(sales.map((sale) => sale.id));
  const payments = state.payments
    .filter((payment) => saleIds.has(payment.saleId))
    .sort((left, right) => right.date.localeCompare(left.date));
  const totalSales = sum(sales.map((sale) => sale.total));
  const outstanding = customerCreditBalance(customer, state);
  const area =
    customer.type === "Big dealer"
      ? [customer.region, customer.district].filter(Boolean).join(" · ")
      : (customer.country ?? "—");
  const tabs = [
    ["overview", "Overview"],
    ["sales", "Sales history", sales.length],
    ["orders", "Order history", orders.length],
    ["payments", "Payment history", payments.length],
  ] as const;
  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const tabButtons = Array.from(
      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
        "[role=tab]",
      ) ?? [],
    );
    const currentIndex = tabButtons.indexOf(event.currentTarget);
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabButtons.length - 1
          : (currentIndex +
              (event.key === "ArrowRight" ? 1 : tabButtons.length - 1)) %
            tabButtons.length;
    tabButtons[nextIndex]?.focus();
    tabButtons[nextIndex]?.click();
  };

  return (
    <DetailView
      title="Customer details"
      subtitle="Customer profile and linked commercial history."
      name={customer.name}
      meta={`${customer.type} · ${customer.status}`}
      onBack={onBack}
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CustomerMetric
          label="Number of sales"
          value={sales.length}
          detail="Derived from linked sales"
          icon="ReceiptText"
          tone="purple"
        />
        <CustomerMetric
          label="Total sales"
          value={money(totalSales)}
          detail="Lifetime sales value"
          icon="ChartNoAxesCombined"
          tone="blue"
        />
        <CustomerMetric
          label="Outstanding credit"
          value={money(outstanding)}
          detail="Current unpaid balance"
          icon="HandCoins"
          tone="amber"
        />
        <CustomerMetric
          label="Customer orders"
          value={orders.length}
          detail="Linked order records"
          icon="ClipboardList"
          tone="green"
        />
      </div>
      <div
        role="tablist"
        aria-label={`${customer.name} details`}
        className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200"
      >
        {tabs.map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`customer-tab-${id}`}
            aria-selected={activeTab === id}
            aria-controls={`customer-panel-${id}`}
            tabIndex={activeTab === id ? 0 : -1}
            onClick={() => setActiveTab(id)}
            onKeyDown={handleTabKeyDown}
            className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-xs font-semibold transition ${activeTab === id ? "border-[#6d28d9] text-[#6d28d9]" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            {label}
            {count !== undefined && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] ${activeTab === id ? "bg-[#f1eafd] text-[#6d28d9]" : "bg-slate-100 text-slate-500"}`}
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      <section
        id={`customer-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`customer-tab-${activeTab}`}
        tabIndex={0}
      >
        {activeTab === "overview" && (
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-bold">Customer information</h3>
            <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Customer ID", customer.id],
                ["Primary contact", customer.contact || "—"],
                ["Phone", customer.phone],
                ["Email", customer.email || "—"],
                ["Operating area", area],
                ["TIN", customer.tin || "—"],
                ["Referred by", customer.referredBy || "—"],
                ["Account status", customer.status],
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="text-[11px] text-slate-400">{label}</div>
                  <div className="mt-1 break-words text-sm font-semibold text-slate-800">
                    {value}
                  </div>
                </div>
              ))}
            </div>
            {customer.notes && (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <div className="text-[11px] text-slate-400">Notes</div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                  {customer.notes}
                </p>
              </div>
            )}
          </section>
        )}

        {activeTab === "sales" && (
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="text-sm font-bold">Sales history</h3>
              <p className="mt-1 text-xs text-slate-400">
                {sales.length} linked transactions · {money(totalSales)}{" "}
                lifetime value
              </p>
            </div>
            {sales.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase text-slate-400">
                    <tr>
                      {[
                        "Reference",
                        "Date",
                        "Product",
                        "Total",
                        "Balance",
                        "Status",
                      ].map((label) => (
                        <th key={label} className="px-5 py-3">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map((sale) => (
                      <tr
                        key={sale.id}
                        className="border-t border-slate-100 text-slate-600"
                      >
                        <td className="px-5 py-3 font-semibold text-slate-800">
                          {sale.reference}
                        </td>
                        <td className="px-5 py-3">{formatDate(sale.date)}</td>
                        <td className="px-5 py-3">{sale.product}</td>
                        <td className="px-5 py-3 font-semibold">
                          {money(sale.total)}
                        </td>
                        <td className="px-5 py-3">
                          {money(
                            sale.paymentTerms === "Credit"
                              ? balanceForSale(sale, state.payments)
                              : 0,
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <Status
                            text={
                              sale.paymentTerms === "Credit"
                                ? paymentStateForSale(sale, state.payments)
                                : sale.status
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-5 py-8 text-center text-xs text-slate-400">
                No sales linked to this customer yet.
              </p>
            )}
          </section>
        )}

        {activeTab === "orders" && (
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="text-sm font-bold">Order history</h3>
              <p className="mt-1 text-xs text-slate-400">
                Customer orders linked to this account
              </p>
            </div>
            {orders.length ? (
              <div className="divide-y divide-slate-100">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="flex flex-col gap-2 px-5 py-3 text-xs sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <span className="font-semibold text-slate-800">
                        {order.reference}
                      </span>
                      <span className="ml-2 text-slate-400">
                        {formatDate(order.date)} · {order.items.length} items
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-slate-700">
                        {money(order.total)}
                      </span>
                      <Status text={order.status} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-5 py-8 text-center text-xs text-slate-400">
                No orders linked to this customer yet.
              </p>
            )}
          </section>
        )}

        {activeTab === "payments" && (
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="text-sm font-bold">Payment history</h3>
              <p className="mt-1 text-xs text-slate-400">
                Repayments recorded against this customer&apos;s credit sales
              </p>
            </div>
            {payments.length ? (
              <div className="divide-y divide-slate-100">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex flex-col gap-1 px-5 py-3 text-xs sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <span className="font-semibold text-slate-800">
                        {
                          sales.find((sale) => sale.id === payment.saleId)
                            ?.reference
                        }
                      </span>
                      <span className="ml-2 text-slate-400">
                        {formatDate(payment.date)} · {payment.method}
                      </span>
                      {payment.note && (
                        <span className="ml-2 text-slate-400">
                          {payment.note}
                        </span>
                      )}
                    </div>
                    <span className="font-semibold text-emerald-700">
                      {money(payment.amount)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-5 py-8 text-center text-xs text-slate-400">
                No payments recorded.
              </p>
            )}
          </section>
        )}
      </section>
    </DetailView>
  );
}

export function DetailView({
  title,
  subtitle,
  name,
  meta,
  onBack,
  children,
}: {
  title: string;
  subtitle: string;
  name: string;
  meta: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="animate-in fade-in duration-300">
      <button
        onClick={onBack}
        className="mb-5 inline-flex items-center gap-2 text-xs font-semibold text-[#6d28d9] hover:underline"
      >
        <ChevronLeft className="size-4" /> Back to list
      </button>
      <div className="mb-6 flex items-start gap-4">
        <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#f1eafd] text-lg font-bold text-[#6d28d9]">
          {initials(name)}
        </div>
        <div>
          <div className="text-xs font-medium text-slate-400">
            Workspace / {title}
          </div>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">{name}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {meta} · {subtitle}
          </p>
        </div>
      </div>
      {children}
    </div>
  );
}

export function DetailGrid({ items }: { items: string[][] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-bold">Profile information</h3>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-slate-50 p-4">
            <div className="text-[11px] font-medium text-slate-400">
              {label}
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-800">
              {value}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Related({ title, rows }: { title: string; rows: string[][] }) {
  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-bold">{title}</h3>
      <div className="mt-4 divide-y divide-slate-100">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="text-slate-500">{label}</span>
            <span className="font-semibold text-slate-800 sm:text-right">
              {value}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
