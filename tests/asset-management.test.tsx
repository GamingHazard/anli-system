import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AssetManagement from '@/components/asset-management'
import { cloneSeed, type CompanyAsset, type ErpState } from '@/lib/erp'

const api = vi.hoisted(() => ({
  listAssets: vi.fn(),
  getAsset: vi.fn(),
  createAsset: vi.fn(),
  updateAsset: vi.fn(),
  recordAssetEvent: vi.fn(),
  importLegacyAssets: vi.fn(),
  uploadAssetPhoto: vi.fn(),
  deleteAssetPhoto: vi.fn(),
}))

vi.mock('@/lib/user-api', () => api)

const sampleAsset: CompanyAsset = {
  id: 'asset-1',
  assetTag: 'VEH-001',
  name: 'Delivery van',
  category: 'Vehicles',
  serialNumber: 'SERIAL-001',
  location: 'Main office',
  condition: 'Good',
  status: 'Active',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function stateWithLegacyAssets(): ErpState {
  return { ...cloneSeed(), assets: [sampleAsset], assetEvents: [] }
}

function renderAssets({ canRead = true, canEdit = false, state = cloneSeed() } = {}) {
  return render(
    <AssetManagement
      state={state}
      canRead={canRead}
      canEdit={canEdit}
    />,
  )
}

describe('asset-management client', () => {
  beforeEach(() => {
    localStorage.clear()
    api.listAssets.mockReset().mockResolvedValue({ assets: [], nextCursor: null })
    api.getAsset.mockReset()
    api.createAsset.mockReset()
    api.updateAsset.mockReset()
    api.recordAssetEvent.mockReset()
    api.importLegacyAssets.mockReset()
    api.uploadAssetPhoto.mockReset()
    api.deleteAssetPhoto.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('blocks users without asset access and does not fetch asset data', () => {
    renderAssets({ canRead: false })

    expect(screen.getByRole('alert').textContent).toMatch(/do not have permission/i)
    expect(api.listAssets).not.toHaveBeenCalled()
  })

  it('shows server assets to read-only users without mutation actions', async () => {
    api.listAssets.mockResolvedValue({ assets: [sampleAsset], nextCursor: null })

    renderAssets({ canRead: true, canEdit: false })

    expect(await screen.findByText('Delivery van')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Add asset' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Import legacy data' })).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: /Vehicles/ }))
    expect(screen.queryByRole('button', { name: 'Add Vehicles asset' })).toBeNull()
  })

  it('exposes create and legacy-import actions to Inventory Managers', async () => {
    renderAssets({ canRead: true, canEdit: true, state: stateWithLegacyAssets() })

    expect(await screen.findByRole('button', { name: 'Add asset' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Import legacy data' })).toBeTruthy()
  })

  it('shows a category-specific create action in every category section', async () => {
    renderAssets({ canRead: true, canEdit: true })

    await screen.findByRole('tab', { name: /Office assets/ })
    for (const category of ['Office assets', 'Vehicles', 'Production assets', 'Store', 'Machinery', 'Others']) {
      fireEvent.click(screen.getByRole('tab', { name: new RegExp(category) }))
      expect(screen.getByRole('button', { name: `Add ${category} asset` })).toBeTruthy()
      expect(screen.queryByRole('button', { name: 'Add asset' })).toBeNull()
    }

    fireEvent.click(screen.getByRole('tab', { name: /Vehicles/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Add Vehicles asset' }))
    const dialog = screen.getByRole('dialog')
    expect((within(dialog).getByLabelText('Category') as HTMLSelectElement).value).toBe('Vehicles')
  })

  it('submits a new asset through the API and reports server-side failures', async () => {
    api.createAsset.mockRejectedValueOnce(new Error('Asset tag already exists.'))

    renderAssets({ canRead: true, canEdit: true })
    fireEvent.click(await screen.findByRole('button', { name: 'Add asset' }))

    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Asset tag'), { target: { value: 'VEH-001' } })
    fireEvent.change(within(dialog).getByLabelText('Asset name'), { target: { value: 'Delivery van' } })
    fireEvent.change(within(dialog).getByLabelText('Location'), { target: { value: 'Main office' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add asset' }))

    await waitFor(() => expect(api.createAsset).toHaveBeenCalled())
    expect((await screen.findByRole('status')).textContent).toContain('Asset tag already exists.')
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('does not fall back to locally stored assets when the server request fails', async () => {
    api.listAssets.mockRejectedValueOnce(new Error('Server unavailable.'))

    renderAssets({ canRead: true, canEdit: false, state: stateWithLegacyAssets() })

    expect(await screen.findByText(/local legacy data is not shown as a fallback/i)).toBeTruthy()
    expect(screen.queryByText('Delivery van')).toBeNull()
  })
})
