import { afterEach, describe, expect, it, vi } from "vitest";
import { listLeaveRequests } from "@/lib/user-api";

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response;
}

afterEach(() => vi.unstubAllGlobals());

describe("leave request API pagination", () => {
  it("sends date bounds and cursor and returns one normalized page", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        requests: [
          {
            id: "leave-1",
            employeeId: "507f1f77bcf86cd799439011",
            startDate: "2026-10-12",
            endDate: "2026-10-14",
            leaveType: "Annual",
            status: "Approved",
          },
        ],
        nextCursor: "next-leave",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const page = await listLeaveRequests(
      { from: "2026-10-01", to: "2026-10-31" },
      "after-this",
    );

    expect(page.requests).toHaveLength(1);
    expect(page.nextCursor).toBe("next-leave");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("from=2026-10-01");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("to=2026-10-31");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("cursor=after-this");
  });
});
