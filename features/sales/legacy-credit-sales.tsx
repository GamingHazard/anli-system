"use client";

import { useEffect, useRef, useState } from "react";
import * as Icons from "lucide-react";
import { Download, Search, X } from "lucide-react";
import { balanceForSale, createId, exportCsv, formatDate, money, paidAmountForSale, paymentStateForSale, sum, ErpState, SalePayment } from "@/lib/erp";
import { Kpi, Status } from "@/features/workspace/legacy-widgets";

export function CreditSalesPage({
  state,
  updateState,
}: {
  state: ErpState;
  updateState: (next: ErpState) => void;
}) {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<
    "outstanding" | "overdue" | "due-soon" | "paid"
  >("outstanding");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [paymentSaleId, setPaymentSaleId] = useState<string | null>(null);
  const [actionSaleId, setActionSaleId] = useState<string | null>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!actionSaleId) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !actionsRef.current?.contains(event.target)
      ) {
        setActionSaleId(null);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [actionSaleId]);
  const today = new Date().toISOString().slice(0, 10);
  const dueSoonLimit = new Date(`${today}T00:00:00.000Z`);
  dueSoonLimit.setUTCDate(dueSoonLimit.getUTCDate() + 7);
  const dueSoonDate = dueSoonLimit.toISOString().slice(0, 10);
  const creditSales = state.sales.filter(
    (sale) => sale.paymentTerms === "Credit",
  );
  const outstandingSales = creditSales.filter(
    (sale) => balanceForSale(sale, state.payments) > 0,
  );
  const overdueSales = outstandingSales.filter((sale) =>
    Boolean(sale.dueDate && sale.dueDate < today),
  );
  const dueSoonSales = outstandingSales.filter((sale) =>
    Boolean(
      sale.dueDate && sale.dueDate >= today && sale.dueDate <= dueSoonDate,
    ),
  );
  const settledSales = creditSales.filter(
    (sale) => balanceForSale(sale, state.payments) === 0,
  );
  const activeSales =
    view === "outstanding"
      ? outstandingSales
      : view === "overdue"
        ? overdueSales
        : view === "due-soon"
          ? dueSoonSales
          : settledSales;
  const visibleSales = activeSales
    .filter((sale) => {
      const customer = state.customers.find(
        (item) => item.id === sale.customerId,
      );
      const matchesSearch =
        `${sale.reference} ${sale.customer} ${customer?.phone ?? ""}`
          .toLowerCase()
          .includes(search.toLowerCase());
      const paymentState = paymentStateForSale(sale, state.payments, today);
      const matchesStatus =
        statusFilter === "All statuses" ||
        paymentState === statusFilter ||
        (statusFilter === "Needs review" && sale.creditNeedsReview);
      return matchesSearch && matchesStatus;
    })
    .sort(
      (left, right) =>
        (left.dueDate || "9999-12-31").localeCompare(
          right.dueDate || "9999-12-31",
        ) || left.date.localeCompare(right.date),
    );
  const openBalance = (sales: ErpState["sales"]) =>
    sum(sales.map((sale) => balanceForSale(sale, state.payments)));
  const customersWithBalances = new Set(
    outstandingSales.map(
      (sale) => sale.customerId || sale.customer.trim().toLowerCase(),
    ),
  ).size;
  const selectedSale =
    creditSales.find((sale) => sale.id === selectedSaleId) ?? null;
  const paymentSale =
    creditSales.find((sale) => sale.id === paymentSaleId) ?? null;

  const recordPayment = (payment: Omit<SalePayment, "id" | "recordedAt">) => {
    if (!paymentSale) return;
    const balance = balanceForSale(paymentSale, state.payments);
    if (
      !Number.isFinite(payment.amount) ||
      payment.amount <= 0 ||
      payment.amount > balance
    )
      return;
    updateState({
      ...state,
      payments: [
        ...state.payments,
        {
          ...payment,
          id: createId("PAY"),
          recordedAt: new Date().toISOString(),
        },
      ],
    });
    setPaymentSaleId(null);
  };

  const views = [
    ["outstanding", "Outstanding", outstandingSales.length],
    ["overdue", "Overdue", overdueSales.length],
    ["due-soon", "Due soon", dueSoonSales.length],
    ["paid", "Paid / settled", settledSales.length],
  ] as const;

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 text-xs font-medium text-slate-400">
            Workspace / Sales Department
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Credit Sales</h2>
          <p className="mt-1 text-sm text-slate-500">
            Monitor receivables and record customer repayments.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            exportCsv(
              "credit-sales.csv",
              visibleSales.map((sale) => ({
                reference: sale.reference,
                customer: sale.customer,
                saleDate: sale.date,
                dueDate: sale.dueDate ?? "Needs review",
                total: sale.total,
                paid: paidAmountForSale(sale.id, state.payments),
                balance: balanceForSale(sale, state.payments),
                status: paymentStateForSale(sale, state.payments, today),
              })),
            )
          }
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
        >
          <Download className="size-4" /> Export CSV
        </button>
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Total outstanding"
          value={money(openBalance(outstandingSales))}
          change={`${outstandingSales.length} open credit sales`}
          icon="WalletCards"
          tone="purple"
          onClick={() => setView("outstanding")}
        />
        <Kpi
          label="Overdue amount"
          value={money(openBalance(overdueSales))}
          change={`${overdueSales.length} overdue sales`}
          icon="CalendarAlert"
          tone="amber"
          onClick={() => setView("overdue")}
        />
        <Kpi
          label="Due in the next 7 days"
          value={money(openBalance(dueSoonSales))}
          change={`${dueSoonSales.length} sales due soon`}
          icon="CalendarClock"
          tone="blue"
          onClick={() => setView("due-soon")}
        />
        <Kpi
          label="Customers with balances"
          value={String(customersWithBalances)}
          change={`${settledSales.length} settled credit sales`}
          icon="UsersRound"
          tone="green"
          onClick={() => setView("outstanding")}
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        {views.map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            aria-pressed={view === key}
            onClick={() => setView(key)}
            className={`border-b-2 px-3 py-2.5 text-xs font-semibold ${view === key ? "border-[#6d28d9] text-[#6d28d9]" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            {label}
            <span className="ml-2 text-[10px] text-slate-400">{count}</span>
          </button>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <Search className="size-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full bg-transparent text-xs outline-none placeholder:text-slate-400 sm:w-64"
              placeholder="Search customer or reference"
            />
          </div>
          <select
            aria-label="Filter credit sales by status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
          >
            <option>All statuses</option>
            <option>Unpaid</option>
            <option>Partially paid</option>
            <option>Paid</option>
            <option>Unpaid · Overdue</option>
            <option>Partially paid · Overdue</option>
            <option>Needs review</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3">Sale</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Sale date</th>
                <th className="px-4 py-3">Due date</th>
                <th className="px-4 py-3 text-right">Original</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3">Payment state</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleSales.map((sale) => {
                const paid = paidAmountForSale(sale.id, state.payments);
                const balance = balanceForSale(sale, state.payments);
                const paymentState = sale.creditNeedsReview
                  ? "Needs review"
                  : paymentStateForSale(sale, state.payments, today);
                return (
                  <tr
                    key={sale.id}
                    className="border-b border-slate-50 text-xs text-slate-600 last:border-0 hover:bg-slate-50/50"
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setSelectedSaleId(sale.id)}
                        className="font-semibold text-slate-800 hover:text-[#6d28d9] hover:underline"
                      >
                        {sale.reference}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">
                        {sale.customer}
                      </div>
                      {sale.creditNeedsReview && (
                        <div className="mt-1 text-[10px] font-medium text-amber-700">
                          Customer/due date needs review
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">{formatDate(sale.date)}</td>
                    <td
                      className={`px-4 py-3 ${sale.dueDate && sale.dueDate < today && balance > 0 ? "font-semibold text-red-600" : ""}`}
                    >
                      {sale.dueDate ? formatDate(sale.dueDate) : "Needs review"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {money(sale.total)}
                    </td>
                    <td className="px-4 py-3 text-right">{money(paid)}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">
                      {money(balance)}
                    </td>
                    <td className="px-4 py-3">
                      <Status text={paymentState} />
                    </td>
                    <td className="px-4 py-3">
                      <div
                        className="relative"
                        ref={actionSaleId === sale.id ? actionsRef : undefined}
                      >
                        <button
                          type="button"
                          aria-label={`Actions for ${sale.reference}`}
                          aria-expanded={actionSaleId === sale.id}
                          onClick={() =>
                            setActionSaleId((current) =>
                              current === sale.id ? null : sale.id,
                            )
                          }
                          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-[#6d28d9]"
                        >
                          <Icons.MoreHorizontal className="size-4" />
                        </button>
                        {actionSaleId === sale.id && (
                          <div
                            role="dialog"
                            aria-label={`Actions for ${sale.reference}`}
                            className="absolute right-0 top-full z-30 mt-1 w-44 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setActionSaleId(null);
                                setSelectedSaleId(sale.id);
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"
                            >
                              <Icons.Eye className="size-3.5 text-slate-400" />{" "}
                              View details
                            </button>
                            <button
                              type="button"
                              disabled={balance <= 0}
                              onClick={() => {
                                setActionSaleId(null);
                                setPaymentSaleId(sale.id);
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Icons.CircleDollarSign className="size-3.5 text-slate-400" />{" "}
                              Record payment
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!visibleSales.length && (
            <div className="py-14 text-center text-xs text-slate-400">
              No credit sales match this view.
            </div>
          )}
        </div>
        <div className="border-t border-slate-100 px-4 py-3 text-[11px] text-slate-400">
          Showing {visibleSales.length} of {activeSales.length} credit sales ·
          balances are calculated from recorded payments
        </div>
      </section>
      {paymentSale && (
        <RecordCreditPaymentDialog
          sale={paymentSale}
          balance={balanceForSale(paymentSale, state.payments)}
          onClose={() => setPaymentSaleId(null)}
          onSave={recordPayment}
        />
      )}
      {selectedSale && (
        <CreditSaleDetailsDialog
          sale={selectedSale}
          payments={state.payments.filter(
            (payment) => payment.saleId === selectedSale.id,
          )}
          onClose={() => setSelectedSaleId(null)}
        />
      )}
    </div>
  );
}

export function RecordCreditPaymentDialog({
  sale,
  balance,
  onClose,
  onSave,
}: {
  sale: ErpState["sales"][number];
  balance: number;
  onClose: () => void;
  onSave: (payment: Omit<SalePayment, "id" | "recordedAt">) => void;
}) {
  const [method, setMethod] = useState<SalePayment["method"]>("Cash");
  const [error, setError] = useState("");
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get("amount"));
    const txnID = String(form.get("txnID") || "").trim();
    if (!Number.isFinite(amount) || amount <= 0 || amount > balance) {
      setError(
        `Enter an amount greater than zero and no more than ${money(balance)}.`,
      );
      return;
    }
    if (method !== "Cash" && !txnID) {
      setError("Enter the transaction ID for this payment method.");
      return;
    }
    onSave({
      saleId: sale.id,
      amount,
      date: String(form.get("date")),
      method,
      txnID: txnID || undefined,
      note: String(form.get("note") || "").trim() || undefined,
    });
  };
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
        aria-labelledby="credit-payment-title"
        className="w-full max-w-md rounded-xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id="credit-payment-title" className="text-base font-bold">
              Record payment
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {sale.reference} · Balance {money(balance)}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close payment form"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"
          >
            <X className="size-4" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4 p-5">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-600">
            Amount (UGX)
            <input
              required
              autoFocus
              name="amount"
              type="number"
              min="1"
              max={balance}
              step="1"
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-600">
            Received date
            <input
              required
              name="date"
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-600">
            Payment method
            <select
              value={method}
              onChange={(event) =>
                setMethod(event.target.value as SalePayment["method"])
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal"
            >
              <option>Cash</option>
              <option>Mobile Money</option>
              <option>Bank Transfer</option>
              <option>Check</option>
            </select>
          </label>
          {method !== "Cash" && (
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-600">
              Transaction ID
              <input
                required
                name="txnID"
                className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal"
              />
            </label>
          )}
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-600">
            Note (optional)
            <textarea
              name="note"
              rows={2}
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal"
            />
          </label>
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
            >
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#6d28d9] px-3 py-2 text-xs font-semibold text-white"
            >
              Save payment
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function CreditSaleDetailsDialog({
  sale,
  payments,
  onClose,
}: {
  sale: ErpState["sales"][number];
  payments: SalePayment[];
  onClose: () => void;
}) {
  const paid = paidAmountForSale(sale.id, payments);
  const balance = balanceForSale(sale, payments);
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
        aria-labelledby="credit-sale-details-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id="credit-sale-details-title" className="text-base font-bold">
              Credit sale details
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {sale.reference} · {sale.customer}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close credit sale details"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div>
            <div className="text-[11px] text-slate-400">Sale date</div>
            <div className="mt-1 text-sm font-semibold">
              {formatDate(sale.date)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Due date</div>
            <div className="mt-1 text-sm font-semibold">
              {sale.dueDate ? formatDate(sale.dueDate) : "Needs review"}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Original amount</div>
            <div className="mt-1 text-sm font-semibold">
              {money(sale.total)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Payment state</div>
            <Status text={paymentStateForSale(sale, payments)} />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Paid</div>
            <div className="mt-1 text-sm font-semibold">{money(paid)}</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Outstanding</div>
            <div className="mt-1 text-sm font-bold">{money(balance)}</div>
          </div>
          <div className="sm:col-span-2">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
              Payment history
            </h3>
            {payments.length ? (
              <div className="divide-y divide-slate-100 border-y border-slate-100">
                {[...payments]
                  .sort(
                    (a, b) =>
                      b.date.localeCompare(a.date) ||
                      b.recordedAt.localeCompare(a.recordedAt),
                  )
                  .map((payment) => (
                    <div
                      key={payment.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs"
                    >
                      <div>
                        <div className="font-semibold text-slate-800">
                          {payment.method}
                          {payment.txnID ? ` · ${payment.txnID}` : ""}
                        </div>
                        <div className="mt-1 text-slate-400">
                          {formatDate(payment.date)}
                          {payment.note ? ` · ${payment.note}` : ""}
                        </div>
                      </div>
                      <strong>{money(payment.amount)}</strong>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="rounded-lg bg-slate-50 p-4 text-xs text-slate-500">
                No payments recorded yet.
              </p>
            )}
          </div>
        </div>
        <div className="flex justify-end border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
          >
            Close
          </button>
        </div>
      </section>
    </div>
  );
}
