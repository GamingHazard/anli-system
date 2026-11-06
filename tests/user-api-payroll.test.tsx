import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getPayrollRun,
  listAllPayrollRunPayslips,
  listPayrollRunPayslips,
  listPayrollRuns,
} from "@/lib/user-api";

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response;
}

afterEach(() => vi.unstubAllGlobals());

const summary = {
  id: "run-1",
  reference: "PAY-M-20261031-ABC123",
  runType: "Monthly",
  periodStart: "2026-10-01",
  periodEnd: "2026-10-31",
  status: "Paid",
  policyVersion: "2026-10-01T00:00:00.000Z",
  approvals: [],
  createdAt: "2026-10-31T12:00:00.000Z",
  updatedAt: "2026-10-31T12:00:00.000Z",
  createdBy: "HR User",
  submittedAt: null,
  paidAt: null,
  payment: null,
  returnedNote: "",
  currency: "UGX",
  attendanceClosedByName: "HR User",
  employeeCount: 400,
  grossTotal: 1000000,
  netTotal: 900000,
  employerContributionTotal: 50000,
};

describe("payroll API client", () => {
  it("sends payroll search and cursor parameters to the summary endpoint", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ runs: [summary], nextCursor: "next-run" }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      listPayrollRuns({ limit: 50, search: "Employee" }, "next-run"),
    ).resolves.toEqual({
      runs: [summary],
      nextCursor: "next-run",
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("search=Employee");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("cursor=next-run");
  });

  it("loads one bounded payslip page and drains cursors only when requested", async () => {
    const first = { id: "slip-1", employeeName: "Employee One" };
    const second = { id: "slip-2", employeeName: "Employee Two" };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ payslips: [first], nextCursor: "next-slip" }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ payslips: [second], nextCursor: null }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(listAllPayrollRunPayslips("run-1")).resolves.toEqual([
      first,
      second,
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("cursor=next-slip");

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ payslips: [first], nextCursor: "next-slip" }),
        ),
    );
    await expect(listPayrollRunPayslips("run-1")).resolves.toEqual({
      payslips: [first],
      nextCursor: "next-slip",
    });
  });

  it("rejects repeated payslip cursors during full export retrieval", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(jsonResponse({ payslips: [], nextCursor: "same" })),
    );

    await expect(listAllPayrollRunPayslips("run-1")).rejects.toThrow(
      /inconsistent pagination metadata/,
    );
  });

  it("loads summary-only run detail without requesting payslips", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ run: summary }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getPayrollRun("run-1")).resolves.toEqual({ run: summary });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/payroll/runs/run-1",
    );
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain("payslips");
  });
});
