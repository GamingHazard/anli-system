import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SalesManagement from '@/components/sales-management'
import { cloneSeed } from '@/lib/erp'
import type { UserAccount } from '@/lib/user-api'

const salesApi = vi.hoisted(() => ({
  listOrders: vi.fn(),
  listProductionProducts: vi.fn(),
}))

vi.mock('@/lib/user-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/user-api')>()
  return {
    ...actual,
    listOrders: salesApi.listOrders,
    listProductionProducts: salesApi.listProductionProducts,
  }
})

const manager: UserAccount = {
  id: 'sales-manager-1',
  name: 'Sales Manager',
  email: 'sales@example.test',
  roles: ['Sales Manager'],
  status: 'Active',
  createdAt: '2026-10-01T00:00:00.000Z',
  mustChangePassword: false,
}

const product = {
  id: 'product-1',
  code: 'JU-MAN-01',
  name: 'Mango juice',
  category: 'Bottle' as const,
  unit: '150 ml',
  flavour: 'Mango' as const,
  packType: 'Box' as const,
  piecesPerPack: 12,
  packWeightKg: 1.8,
  price: 24000,
  recipeRequired: false,
  active: true,
  balancePacks: 0,
  reservedPacks: 0,
  availablePacks: 0,
  loosePieces: 0,
  recipe: null,
  createdAt: '2026-10-01T00:00:00.000Z',
}

function renderSales() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  render(
    <QueryClientProvider client={queryClient}>
      <SalesManagement
        mode="sales"
        state={cloneSeed()}
        currentUser={manager}
        salesLoading={false}
        salesError=""
        salesWarning=""
        onRetrySales={vi.fn()}
        onSaleUpdated={vi.fn()}
        companyName="ANLI"
        companyLogoUrl=""
        customersAvailable
        onRetryCustomers={vi.fn()}
      />
    </QueryClientProvider>,
  )
}

describe('sales stock guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    salesApi.listOrders.mockResolvedValue([])
  })

  afterEach(() => cleanup())

  it('shows a no-stock warning and disables sale completion when no product is available', async () => {
    salesApi.listProductionProducts.mockResolvedValue({ products: [product] })
    renderSales()

    fireEvent.click(screen.getByRole('button', { name: /add sale/i }))
    const dialog = await screen.findByRole('dialog', { name: 'Record sale' })

    const alerts = await screen.findAllByRole('alert')
    expect(alerts.some((alert) => /no sellable stock available/i.test(alert.textContent ?? ''))).toBe(true)
    expect((screen.getByRole('button', { name: 'Complete sale' }) as HTMLButtonElement).disabled).toBe(true)
    expect(dialog).toBeTruthy()
  })

  it('blocks quantities above available stock and enables a valid quantity', async () => {
    salesApi.listProductionProducts.mockResolvedValue({
      products: [{ ...product, balancePacks: 2, availablePacks: 2 }],
    })
    renderSales()
    fireEvent.click(screen.getByRole('button', { name: /add sale/i }))
    const dialog = await screen.findByRole('dialog', { name: 'Record sale' })
    await screen.findByRole('option', { name: /Mango juice/ })
    const productSelect = dialog.querySelector('select')
    expect(productSelect).not.toBeNull()
    fireEvent.change(productSelect!, { target: { value: 'product-1' } })
    expect((productSelect as HTMLSelectElement).value).toBe('product-1')
    const quantity = dialog.querySelector('input[type="number"]')
    expect(quantity).not.toBeNull()
    const submit = screen.getByRole('button', { name: 'Complete sale' })

    fireEvent.change(quantity!, { target: { value: '3' } })
    await waitFor(() => expect(
      screen.getAllByRole('alert').some((alert) => /exceeds available stock/i.test(alert.textContent ?? '')),
    ).toBe(true))
    expect((submit as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(quantity!, { target: { value: '2' } })
    await waitFor(() => expect((submit as HTMLButtonElement).disabled).toBe(false))
  })
})
