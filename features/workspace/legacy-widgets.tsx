"use client";

import { iconMap } from "@/features/workspace/legacy-shell";
import * as Icons from "lucide-react";
import { Boxes, ChevronRight, TrendingUp } from "lucide-react";
import { formatDate, initials, money, ErpState } from "@/lib/erp";

export function Kpi({
  label,
  value,
  change,
  icon,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  change: string;
  icon: string;
  tone: string;
  onClick: () => void;
}) {
  const Icon = iconMap[icon] || TrendingUp;
  return (
    <button
      onClick={onClick}
      className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-purple-200 hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <span
          className={`grid size-9 place-items-center rounded-xl ${tone === "purple" ? "bg-[#f1eafd] text-[#6d28d9]" : tone === "blue" ? "bg-blue-50 text-blue-600" : tone === "amber" ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"}`}
        >
          <Icon className="size-[18px]" />
        </span>
        <ChevronRight className="size-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-purple-400" />
      </div>
      <div className="mt-4 text-xl font-bold tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{label}</div>
      <div
        className={`mt-3 text-[11px] font-semibold ${change.startsWith("-") ? "text-emerald-600" : "text-emerald-600"}`}
      >
        {change}
      </div>
    </button>
  );
}

export function MiniMetric({
  label,
  value,
  meta,
  icon,
}: {
  label: string;
  value: string;
  meta: string;
  icon: string;
}) {
  const Icon = iconMap[icon] || Boxes;
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-500">
        <Icon className="size-[19px]" />
      </div>
      <div>
        <div className="text-[11px] text-slate-400">{label}</div>
        <div className="mt-1 text-lg font-bold">{value}</div>
        <div className="mt-0.5 text-[10px] text-slate-400">{meta}</div>
      </div>
    </div>
  );
}

export function RecentSales({
  state,
  setActive,
}: {
  state: ErpState;
  setActive: (value: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <SectionHead
        title="Recent transactions"
        link="View sales"
        onClick={() => setActive("Sales")}
      />{" "}
      <div className="mt-4 flex flex-col gap-4">
        {state.sales.slice(0, 4).map((s) => (
          <div key={s.id} className="flex items-center gap-3">
            <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#f1eafd] text-[10px] font-bold text-[#6d28d9]">
              {initials(s.customer)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold">{s.customer}</div>
              <div className="text-[10px] text-slate-400">
                {s.reference} · {formatDate(s.date)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-bold">{money(s.total)}</div>
              <Status text={s.status} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function LowStock({
  state,
  setActive,
}: {
  state: ErpState;
  setActive: (value: string) => void;
}) {
  const low = state.materials.filter((m) => m.quantity <= m.threshold);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <SectionHead
        title="Low stock alerts"
        link="Inventory"
        onClick={() => setActive("Raw Material Management")}
      />
      <div className="mt-4 flex flex-col gap-4">
        {low.map((m) => (
          <div key={m.id} className="flex items-center gap-3">
            <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-600">
              <Icons.AlertTriangle className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold">{m.name}</div>
              <div className="text-[10px] text-slate-400">
                Reorder at {m.threshold} {m.unit}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-bold">
                {m.quantity} {m.unit}
              </div>
              <div className="text-[10px] font-medium text-amber-600">
                Reorder soon
              </div>
            </div>
          </div>
        ))}
        {!low.length && (
          <div className="py-5 text-center text-xs text-slate-400">
            All materials are well stocked.
          </div>
        )}
      </div>
    </section>
  );
}

export function Activity({ state }: { state: ErpState }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <SectionHead title="System activity" link="Auditing" />
      <div className="mt-4 flex flex-col gap-4">
        {state.activities.map((a) => (
          <div key={a.id} className="flex gap-3">
            <div
              className={`mt-1 size-2 shrink-0 rounded-full ${a.outcome === "Success" ? "bg-emerald-500" : "bg-amber-500"}`}
            />
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-700">
                {a.action}
              </div>
              <div className="mt-0.5 text-[10px] text-slate-400">
                {a.actor} · {a.time}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function SectionHead({
  title,
  link,
  onClick,
}: {
  title: string;
  link: string;
  onClick?: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-bold">{title}</h3>
      <button
        onClick={onClick}
        className="text-[11px] font-semibold text-[#6d28d9] hover:underline"
      >
        {link}
      </button>
    </div>
  );
}

export function Status({ text }: { text: string }) {
  const color = ["Paid", "Approved", "Active", "Success"].includes(text)
    ? "bg-emerald-50 text-emerald-700"
    : ["Pending", "Review", "Draft", "Suspended"].includes(text)
      ? "bg-amber-50 text-amber-700"
      : "bg-slate-100 text-slate-600";
  return (
    <span
      className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[9px] font-semibold ${color}`}
    >
      {text}
    </span>
  );
}
