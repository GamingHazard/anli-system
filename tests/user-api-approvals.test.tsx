import { afterEach, describe, expect, it, vi } from 'vitest'
import { getApprovalInbox } from '@/lib/user-api'

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response
}

afterEach(() => vi.unstubAllGlobals())

describe('approval inbox API client', () => {
  it('loads normalized approval items from the server inbox endpoint', async () => {
    const payload = {
      items: [{
        id: 'leave:1',
        source: 'Leave',
        recordId: '1',
        subRecordId: null,
        reference: 'LV-001',
        requester: 'Amina',
        submittedAt: '2026-10-01T10:00:00.000Z',
        summary: 'Annual leave',
        detail: 'Family event',
        status: 'Awaiting review',
        stage: 'Assigned reviewer',
        canAct: true,
        history: [],
      }],
      counts: { actionable: 1, inProgress: 0, history: 0 },
    }
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(payload))
    vi.stubGlobal('fetch', fetchMock)

    await expect(getApprovalInbox()).resolves.toEqual(payload)
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:5000/api/approvals',
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    )
  })

  it('surfaces inbox permission errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({ error: 'Authentication required.' }, 401),
    ))

    await expect(getApprovalInbox()).rejects.toMatchObject({
      status: 401,
      message: 'Authentication required.',
    })
  })
})
