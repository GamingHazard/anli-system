import { afterEach, describe, expect, it, vi } from 'vitest'
import { updateEmployee } from '@/lib/user-api'
import type { Employee } from '@/lib/erp'

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response
}

afterEach(() => vi.unstubAllGlobals())

describe('employee API client', () => {
  it('omits the server-managed deactivation timestamp from profile updates', async () => {
    const employee: Partial<Employee> = {
      name: 'Test Employee',
      department: 'HR',
      role: 'Test Worker',
      status: 'Inactive',
      deactivatedAt: '2026-10-28T10:00:00.000Z',
      deactivatedBy: '507f1f77bcf86cd799439011',
      createdBy: '507f1f77bcf86cd799439012',
      updatedBy: '507f1f77bcf86cd799439013',
      createdAt: '2026-10-01T10:00:00.000Z',
      updatedAt: '2026-10-28T10:00:00.000Z',
    }
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ employee: { id: 'employee-1', ...employee } }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await updateEmployee('employee-1', employee)

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(String(init.body))).toEqual({
      name: 'Test Employee',
      department: 'HR',
      role: 'Test Worker',
      status: 'Inactive',
    })
    expect(String(init.body)).not.toContain('deactivatedAt')
    expect(String(init.body)).not.toContain('deactivatedBy')
    expect(String(init.body)).not.toContain('createdBy')
    expect(String(init.body)).not.toContain('updatedBy')
    expect(String(init.body)).not.toContain('createdAt')
    expect(String(init.body)).not.toContain('updatedAt')
  })
})
