import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ReceiptManagementPage from '@/components/receipt-management'
import type { ManagedReceipt } from '@/lib/erp'

const receiptApi = vi.hoisted(() => ({
  listManagedReceipts: vi.fn(),
  listAllManagedReceipts: vi.fn(),
  recordReceiptBulkExport: vi.fn(),
  setManagedReceiptArchived: vi.fn(),
  setManagedReceiptFavorite: vi.fn(),
}))

vi.mock('@/lib/user-api', () => ({
  ApiError: class ApiError extends Error {},
  listManagedReceipts: receiptApi.listManagedReceipts,
  listAllManagedReceipts: receiptApi.listAllManagedReceipts,
  recordReceiptBulkExport: receiptApi.recordReceiptBulkExport,
  setManagedReceiptArchived: receiptApi.setManagedReceiptArchived,
  setManagedReceiptFavorite: receiptApi.setManagedReceiptFavorite,
}))

const saleReceipt: ManagedReceipt = {
  id: 'SALE-1',
  kind: 'sale',
  receiptNumber: 'SAL-2026-000001',
  date: '2026-10-23',
  amount: 48000,
  customer: { name: 'Saved customer', phone: '+256700000000' },
  company: { name: 'Example Ltd' },
  lines: [{
    productId: 'PRODUCT-1',
    productCode: 'M-1',
    productName: 'Mango juice',
    packType: 'Box',
    piecesPerPack: 12,
    packs: 2,
    quantityPieces: 24,
    catalogPricePerPack: 24000,
    pricePerPack: 24000,
    lineTotal: 48000,
  }],
  saleId: 'SALE-1',
  total: 48000,
  paidAmount: 48000,
  balance: 0,
  isFavorite: false,
  isArchived: false,
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <ReceiptManagementPage companyName="Example Ltd" companyLogoUrl="" />
    </QueryClientProvider>,
  )
}

describe('receipt management page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    receiptApi.listManagedReceipts.mockResolvedValue({
      receipts: [saleReceipt],
      nextCursor: null,
      stats: { count: 1, totalAmount: 48000, totalPaid: 48000, outstanding: 0 },
    })
    receiptApi.setManagedReceiptFavorite.mockResolvedValue({ enabled: true })
    receiptApi.setManagedReceiptArchived.mockResolvedValue({ enabled: true, archivedAt: '2026-10-23T10:00:00.000Z' })
  })

  afterEach(() => cleanup())

  it('shows backend receipts and full-match totals, then applies favorite changes', async () => {
    renderPage()
    expect(await screen.findByText('SAL-2026-000001')).toBeTruthy()
    expect(screen.getByText('Saved customer')).toBeTruthy()
    expect(screen.getAllByText(/48,000/).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: 'Favorite SAL-2026-000001' }))
    await waitFor(() => expect(receiptApi.setManagedReceiptFavorite).toHaveBeenCalledWith('sales', 'SALE-1', true))
  })

  it('switches to credit payment receipts and supports archive restore actions', async () => {
    const paymentReceipt: ManagedReceipt = {
      ...saleReceipt,
      id: 'PAYMENT-1',
      kind: 'credit-payment',
      receiptNumber: 'CPR-2026-000001',
      amount: 12000,
      saleReceiptNumber: saleReceipt.receiptNumber,
      payment: { amount: 12000, method: 'Cash' },
    }
    receiptApi.listManagedReceipts.mockImplementation(async (kind: string) => ({
      receipts: [kind === 'sales' ? saleReceipt : paymentReceipt],
      nextCursor: null,
      stats: { count: 1, totalAmount: 12000, totalPaid: 12000, outstanding: 0 },
    }))
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Credit payment receipts' }))
    expect(await screen.findByText('CPR-2026-000001')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Archive CPR-2026-000001' }))
    await waitFor(() => expect(receiptApi.setManagedReceiptArchived).toHaveBeenCalledWith('credit-payments', 'PAYMENT-1', true))
  })

  it('opens the export options in a compact menu and dismisses it on outside click', async () => {
    renderPage()
    const exportButton = await screen.findByRole('button', { name: 'Export' })
    fireEvent.click(exportButton)
    expect(screen.getByRole('menu', { name: 'Export receipts' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Print all receipts' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Download all receipts' })).toBeTruthy()

    fireEvent.pointerDown(document.body)
    await waitFor(() => expect(screen.queryByRole('menu', { name: 'Export receipts' })).toBeNull())
  })
})
