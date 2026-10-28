import { afterEach, describe, expect, it, vi } from 'vitest'
import { packUnitLabel } from '@/lib/erp'
import { adjustFinishedStock, getDailyProductionStockSummary, postProductionRun, receiveFinishedStock } from '@/lib/user-api'

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response
}

afterEach(() => vi.unstubAllGlobals())

describe('finished stock pack API', () => {
  it('uses the configured box or carton in singular and plural labels', () => {
    expect(packUnitLabel('Box', 1)).toBe('box')
    expect(packUnitLabel('Box', 2)).toBe('boxes')
    expect(packUnitLabel('Carton', 1)).toBe('carton')
    expect(packUnitLabel('Carton', 2)).toBe('cartons')
  })

  it('requests a date-specific pack opening, sales, and other-movement summary', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      productId: 'product-1',
      productionDate: '2026-10-28',
      packType: 'Box',
      piecesPerPack: 12,
      openingStockPacks: 20,
      salesQuantityPacks: 3,
      otherMovementNetPacks: -1,
      loosePieces: 5,
    }))
    vi.stubGlobal('fetch', fetchMock)

    const summary = await getDailyProductionStockSummary('product-1', '2026-10-28')

    expect(summary.openingStockPacks).toBe(20)
    expect(summary.salesQuantityPacks).toBe(3)
    expect(summary.otherMovementNetPacks).toBe(-1)
    expect(String(fetchMock.mock.calls[0][0])).toContain('productId=product-1')
    expect(String(fetchMock.mock.calls[0][0])).toContain('date=2026-10-28')
  })

  it('posts daily production counts as packs without accepting manual sales', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ run: { id: 'run-1' }, balancePacks: 14 }, 201))
    vi.stubGlobal('fetch', fetchMock)

    await postProductionRun({
      productId: 'product-1',
      productionDate: '2026-10-28',
      openingStockPacks: 20,
      damagedQuantityPacks: 1,
      closingStockPacks: 14,
      idempotencyKey: 'run-key',
    })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(String(init.body))).toEqual({
      productId: 'product-1',
      productionDate: '2026-10-28',
      openingStockPacks: 20,
      damagedQuantityPacks: 1,
      closingStockPacks: 14,
      idempotencyKey: 'run-key',
    })
    expect(JSON.parse(String(init.body))).not.toHaveProperty('salesQuantityPacks')
  })

  it('sends finished-stock receipts and adjustments in pack quantities', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ balancePacks: 5, movement: { id: 'receipt-1' } }, 201))
      .mockResolvedValueOnce(jsonResponse({ balancePacks: 4, movement: { id: 'adjustment-1' } }, 201))
    vi.stubGlobal('fetch', fetchMock)

    const input = {
      productId: 'product-1',
      quantityPacks: 2,
      date: '2026-10-28',
      reason: 'Supplier receipt',
      idempotencyKey: 'stock-key',
    }
    await receiveFinishedStock(input)
    await adjustFinishedStock({ ...input, quantityPacks: 1, direction: 'out' })

    expect(JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))).toMatchObject({ quantityPacks: 2 })
    expect(JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body))).toMatchObject({ quantityPacks: 1, direction: 'out' })
  })
})
