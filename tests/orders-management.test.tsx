import { cleanup, render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import OrdersManagement from '@/components/orders-management'
import { cloneSeed, money, type Order } from '@/lib/erp'
import { ORDER_IMPORT_MARKER_KEY } from '@/lib/order-migration'
import type { OrderPaymentRecord, UserAccount } from '@/lib/user-api'

const ordersApi = vi.hoisted(() => ({
  listOrders: vi.fn(),
  getOrderDetails: vi.fn(),
  listProductionProducts: vi.fn(),
}))

vi.mock('@/lib/user-api', () => ({
  archiveOrder: vi.fn(),
  changeOrderStatus: vi.fn(),
  confirmOrder: vi.fn(),
  createOrder: vi.fn(),
  fulfillOrder: vi.fn(),
  getOrderDetails: ordersApi.getOrderDetails,
  importLegacyOrders: vi.fn(),
  listOrders: ordersApi.listOrders,
  listProductionProducts: ordersApi.listProductionProducts,
  recordOrderPayment: vi.fn(),
  restoreOrder: vi.fn(),
  updateOrder: vi.fn(),
}))

const manager: UserAccount = {
  id: 'sales-manager-1',
  name: 'Sales Manager',
  email: 'sales@example.test',
  roles: ['Sales Manager'],
  status: 'Active',
  createdAt: '2026-10-01T00:00:00.000Z',
  mustChangePassword: false,
}

function createOrderRecord(id: string, status: Order['status'], total: number, overrides: Partial<Order> = {}): Order {
  return {
    id,
    reference: `ORD-${id}`,
    date: '2026-10-23',
    createdAt: '2026-10-23T10:00:00.000Z',
    customer: 'Saved Customer',
    customerId: 'C-100',
    items: [{ id: `${id}-line`, product: 'Mango juice', quantity: 2, unitPrice: total / 2, lineTotal: total }],
    total,
    requestedDate: '2026-10-24',
    fulfilmentMethod: 'Delivery',
    destination: 'Kampala',
    paymentTerms: 'Same-day',
    status,
    statusHistory: [{ status, type: status.toLowerCase(), at: '2026-10-23T10:00:00.000Z' }],
    priority: 'Normal',
    notes: '',
    paidAmount: 0,
    reserved: ['Confirmed', 'In progress', 'Ready'].includes(status),
    ...overrides,
  }
}

function renderOrders() {
  const state = { ...cloneSeed(), orders: [] }
  render(
    <OrdersManagement
      state={state}
      currentUser={manager}
      customersLoaded
      customersApiLoaded
      customerLoadError=""
      onRetryCustomers={vi.fn()}
      onStateChange={vi.fn()}
    />,
  )
}

describe('orders-management', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem(ORDER_IMPORT_MARKER_KEY, 'complete')
    ordersApi.listProductionProducts.mockResolvedValue({ products: [] })
    ordersApi.getOrderDetails.mockImplementation(async (id: string) => ({
      order: orderRecords.find((order) => order.id === id)!,
      payments: [{
        id: 'PAY-1',
        orderId: id,
        amount: 12000,
        date: '2026-10-23',
        method: 'Cash',
        txnID: 'TX-1',
      } satisfies OrderPaymentRecord],
    }))
  })

  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  const orderRecords = [
    createOrderRecord('PENDING-1', 'Pending', 50000, { paidAmount: 10000 }),
    createOrderRecord('PROGRESS-1', 'In progress', 70000),
    createOrderRecord('READY-1', 'Ready', 80000),
    createOrderRecord('COMPLETE-1', 'Completed', 100000),
    createOrderRecord('CANCELLED-1', 'Cancelled', 20000),
    createOrderRecord('LEGACY-PENDING-1', 'Pending', 90000, { legacyImported: true }),
  ]

  it('summarizes KPI cards from the orders loaded through the server API', async () => {
    ordersApi.listOrders.mockResolvedValue(orderRecords)
    renderOrders()

    await waitFor(() => expect(screen.getByText('Order history')).toBeTruthy())
    expect(screen.getByText('Based on 6 orders loaded from the server')).toBeTruthy()
    const summary = screen.getByLabelText('Order summary from backend')
    expect(within(summary).getByText('Total orders')).toBeTruthy()
    expect(within(summary).getByText('Pending confirmation')).toBeTruthy()
    expect(within(summary).getByText('In progress')).toBeTruthy()
    expect(within(summary).getByText('Ready for fulfilment')).toBeTruthy()
    expect(within(summary).getByText('Completed order value')).toBeTruthy()
    expect(within(summary).getByText('Open order balance')).toBeTruthy()
    const pendingCard = within(summary).getByText('Pending confirmation').closest('article')
    expect(pendingCard && within(pendingCard).getByText('1')).toBeTruthy()
    const summaryText = summary.textContent?.replace(/\s/g, '')
    expect(summaryText).toContain(money(100000).replace(/\s/g, ''))
    expect(summaryText).toContain(money(190000).replace(/\s/g, ''))
  })

  it('shows detailed payment and status history for an order', async () => {
    ordersApi.listOrders.mockResolvedValue(orderRecords)
    renderOrders()

    fireEvent.click(await screen.findByRole('button', { name: 'Actions for ORD-PENDING-1' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'View details' }))

    const dialog = await screen.findByRole('dialog', { name: 'ORD-PENDING-1' })
    expect(await within(dialog).findByText('Payment history')).toBeTruthy()
    expect(within(dialog).getByText('TX-1')).toBeTruthy()
    expect(within(dialog).getByText('pending')).toBeTruthy()
    expect(ordersApi.getOrderDetails).toHaveBeenCalledWith('PENDING-1')
  })

  it('opens order actions from the three-dot menu and closes it on outside click', async () => {
    ordersApi.listOrders.mockResolvedValue(orderRecords)
    renderOrders()

    fireEvent.click(await screen.findByRole('button', { name: 'Actions for ORD-PENDING-1' }))

    expect(screen.getByRole('menu', { name: 'Actions for ORD-PENDING-1' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Edit order' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Confirm' })).toBeTruthy()

    fireEvent.pointerDown(document.body)
    await waitFor(() => expect(screen.queryByRole('menu', { name: 'Actions for ORD-PENDING-1' })).toBeNull())
  })

  it('lets users clear and type a whole-number quantity in the order form', async () => {
    ordersApi.listOrders.mockResolvedValue(orderRecords)
    renderOrders()

    fireEvent.click(await screen.findByRole('button', { name: 'Create order' }))
    const dialog = await screen.findByRole('dialog', { name: 'Create order' })
    const quantity = dialog.querySelector('input[type="number"]')
    expect(quantity).not.toBeNull()

    fireEvent.change(quantity!, { target: { value: '' } })
    expect((quantity as HTMLInputElement).value).toBe('')
    fireEvent.change(quantity!, { target: { value: '12' } })
    expect((quantity as HTMLInputElement).value).toBe('12')
  })
})
