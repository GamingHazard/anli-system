import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, createCustomer, importLegacyCustomers, listCustomers } from '@/lib/user-api'
import type { Customer } from '@/lib/erp'

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response
}

afterEach(() => vi.unstubAllGlobals())

describe('customer API client', () => {
  it('loads all pages and stops safely when cursors repeat', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ customers: [{ id: 'C-1' }], nextCursor: 'next' }))
      .mockResolvedValueOnce(jsonResponse({ customers: [{ id: 'C-2' }], nextCursor: null }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(listCustomers()).resolves.toEqual([{ id: 'C-1' }, { id: 'C-2' }])
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const repeatedCursorFetch = vi.fn().mockResolvedValue(
      jsonResponse({ customers: [], nextCursor: 'same' }),
    )
    vi.stubGlobal('fetch', repeatedCursorFetch)
    await expect(listCustomers()).rejects.toThrow(/repeated pagination cursor/)
  })

  it('surfaces authorization errors without a local success fallback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({ error: 'You do not have permission.' }, 403),
    ))

    await expect(listCustomers()).rejects.toMatchObject({
      name: 'ApiError',
      status: 403,
      message: 'You do not have permission.',
    } satisfies Partial<ApiError>)
  })

  it('uses server IDs for newly created customer records', async () => {
    const customer: Customer = {
      id: 'C-SERVER',
      name: 'New customer',
      type: 'Small dealer',
      phone: '+256 700 000 000',
      email: '',
      status: 'Active',
      purchases: 0,
    }
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ customer }, 201))
    vi.stubGlobal('fetch', fetchMock)

    await expect(createCustomer({
      name: customer.name,
      type: customer.type,
      phone: customer.phone,
    })).resolves.toEqual(customer)
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(String(init.body))).toEqual({
      name: customer.name,
      type: customer.type,
      phone: customer.phone,
    })
  })

  it('chunks legacy imports and collects server rejections for retry', async () => {
    const customers = Array.from({ length: 201 }, (_, index) => ({
      id: `C-${index}`,
      name: `Customer ${index}`,
      type: 'Small dealer',
      phone: '+256700000000',
      email: '',
      status: 'Active' as const,
      purchases: 0,
    }))
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        imported: [], existing: [], rejected: [{ id: 'C-0', index: 0, reason: 'duplicate' }],
      }, 201))
      .mockResolvedValueOnce(jsonResponse({ imported: [], existing: [], rejected: [] }, 201))
    vi.stubGlobal('fetch', fetchMock)

    const result = await importLegacyCustomers(customers)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.rejected[0].index).toBe(0)
    expect(JSON.parse(String((fetchMock.mock.calls[1] as [string, RequestInit])[1].body)).customers).toHaveLength(1)
  })
})
