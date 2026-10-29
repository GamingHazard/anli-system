"use client";

import { X } from "lucide-react";
import { formatDate, AttendanceRecord } from "@/lib/erp";

export function AttendanceRecordDialog({
  employeeName,
  record,
  onClose,
}: {
  employeeName: string;
  record: AttendanceRecord;
  onClose: () => void;
}) {
  const closeFromBackdrop = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };
  const detail = (label: string, value: string) => (
    <div key={label} className="border-b border-slate-100 py-3 last:border-0">
      <div className="text-[10px] font-medium uppercase text-slate-400">
        {label}
      </div>
      <div className="mt-1 break-words text-sm font-semibold text-slate-800">
        {value || "—"}
      </div>
    </div>
  );
  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/40 p-4"
      onMouseDown={closeFromBackdrop}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="attendance-record-title"
        className="w-full max-w-lg rounded-xl bg-white shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id="attendance-record-title" className="text-base font-bold">
              Attendance record
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {employeeName} · {formatDate(record.workDate)}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close attendance record"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="px-5 py-2">
          {detail("Status", record.status)}
          {detail(
            "Day length",
            record.status === "Present"
              ? record.halfDay
                ? "Half day"
                : "Full day"
              : "Not applicable",
          )}
          {detail(
            "Late",
            record.status === "Present"
              ? record.late
                ? "Yes"
                : "No"
              : "Not applicable",
          )}
          {detail("Note", record.note ?? "No note")}
          {detail("Last updated", new Date(record.updatedAt).toLocaleString())}
        </div>
        <footer className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
          <p className="text-[10px] text-slate-400">
            Attendance changes are recorded in the system audit log.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#6d28d9] px-4 py-2 text-xs font-semibold text-white"
          >
            Close
          </button>
        </footer>
      </section>
    </div>
  );
}
