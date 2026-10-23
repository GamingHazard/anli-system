import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, importLegacyAssets, listAssets } from '@/lib/user-api'
import type { AssetEvent, CompanyAsset } from '@/lib/erp'

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('asset API client', () => {
  it('sends asset filters and returns paginated records', async () => {
    const payload = { assets: [], nextCursor: 'cursor-1' }
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(payload))
    vi.stubGlobal('fetch', fetchMock)

    await expect(listAssets({
      category: 'Vehicles',
      status: 'Active',
      search: 'van',
    })).resolves.toEqual(payload)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const query = new URL(url).searchParams
    expect(new URL(url).pathname).toBe('/api/assets')
    expect(query.get('limit')).toBe('200')
    expect(query.get('category')).toBe('Vehicles')
    expect(query.get('status')).toBe('Active')
    expect(query.get('search')).toBe('van')
    expect(init.credentials).toBe('include')
  })

  it('surfaces asset API authorization failures without a success fallback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({ error: 'You do not have permission.' }, 403),
    ))

    await expect(listAssets()).rejects.toMatchObject({
      name: 'ApiError',
      status: 403,
      message: 'You do not have permission.',
    } satisfies Partial<ApiError>)
  })

  it('sends legacy asset and event records together for server-side idempotent import', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ imported: 1, importedEvents: 1, duplicates: 0, rejected: [] }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const asset = { id: 'legacy-asset', assetTag: 'AST-001' } as CompanyAsset
    const event = { id: 'legacy-event', assetId: asset.id, type: 'Inspection' } as AssetEvent

    await importLegacyAssets([asset], [event])

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/assets/import')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ assets: [asset], events: [event] })
  })
})
