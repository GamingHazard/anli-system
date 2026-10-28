import { afterEach, describe, expect, it, vi } from 'vitest'
import { createProductionMaterial, deleteProductionMaterial, postProductionMaterialUsage, receiveProductionMaterial, updateProductionMaterial, updateProductionMaterialUsage } from '@/lib/user-api'

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response
}

afterEach(() => vi.unstubAllGlobals())

describe('raw-material packaging API', () => {
  it('sends packaging levels when creating a material', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      material: {
        id: 'material-1',
        code: 'POWDER',
        name: 'Powder',
        category: 'Ingredients',
        unit: 'kg',
        packagingLevels: [
          { name: 'sachet', quantity: 1 },
          { name: 'box', quantity: 20 },
        ],
        active: true,
        balance: 0,
        locations: [],
      },
    }))
    vi.stubGlobal('fetch', fetchMock)

    await createProductionMaterial({
      code: 'POWDER',
      name: 'Powder',
      category: 'Ingredients',
      unit: 'kg',
      packagingLevels: [
        { name: 'sachet', quantity: 1 },
        { name: 'box', quantity: 20 },
      ],
    })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(String(init.body)).packagingLevels).toEqual([
      { name: 'sachet', quantity: 1 },
      { name: 'box', quantity: 20 },
    ])
  })

  it('sends package counts and package prices for receipts', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      balance: 60,
      movement: {
        id: 'movement-1',
        receiptPackaging: {
          packageQuantity: 3,
          packageUnit: 'box',
          baseUnitsPerPackage: 20,
          packagePrice: 240000,
        },
      },
    }))
    vi.stubGlobal('fetch', fetchMock)

    await receiveProductionMaterial('material-1', {
      packageUnit: 'box',
      packageQuantity: 3,
      packagePrice: 240000,
      date: '2026-10-28',
      reason: 'Supplier delivery',
      location: 'Main Warehouse',
      idempotencyKey: 'receipt-key',
    })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(String(init.body))).toMatchObject({
      packageUnit: 'box',
      packageQuantity: 3,
      packagePrice: 240000,
    })
    expect(JSON.parse(String(init.body))).not.toHaveProperty('unitCost')
  })

  it('updates material profile fields through the material endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ material: { id: 'material-1' } }))
    vi.stubGlobal('fetch', fetchMock)

    await updateProductionMaterial('material-1', {
      code: 'POWDER',
      name: 'Powder',
      category: 'Ingredients',
      unit: 'kg',
      packagingLevels: [{ name: 'sack', quantity: 25 }],
    })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/production/materials/material-1')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(String(init.body))).toMatchObject({
      code: 'POWDER',
      name: 'Powder',
      packagingLevels: [{ name: 'sack', quantity: 25 }],
    })
  })

  it('deletes a material profile through its dedicated endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      deleted: true,
      materialId: 'material-1',
      deletedUnit: 'kg',
      deletedStock: 12,
      deletedLocationCount: 1,
      preservedMovementCount: 3,
    }))
    vi.stubGlobal('fetch', fetchMock)

    await deleteProductionMaterial('material-1')

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/production/materials/material-1')
    expect(init.method).toBe('DELETE')
  })

  it('posts product-based production use with its production date', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      usage: {
        id: 'usage-1',
        productId: 'product-1',
        productionDate: '2026-10-28',
        tanksProduced: 2,
      },
    }))
    vi.stubGlobal('fetch', fetchMock)

    await postProductionMaterialUsage({
      productId: 'product-1',
      productionDate: '2026-10-28',
      tanksProduced: 2,
      location: 'Main Warehouse',
      idempotencyKey: 'usage-key',
    })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/production/materials/production-usages')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({
      productId: 'product-1',
      productionDate: '2026-10-28',
      tanksProduced: 2,
      location: 'Main Warehouse',
      idempotencyKey: 'usage-key',
    })
  })

  it('updates production use through the dedicated reconciliation endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ usage: { id: 'usage-1' } }))
    vi.stubGlobal('fetch', fetchMock)

    await updateProductionMaterialUsage('usage-1', {
      productId: 'product-1',
      productionDate: '2026-10-28',
      tanksProduced: 3,
      location: 'Main Warehouse',
    })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/production/materials/production-usages/usage-1')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(String(init.body))).toEqual({
      productId: 'product-1',
      productionDate: '2026-10-28',
      tanksProduced: 3,
      location: 'Main Warehouse',
    })
  })
})
