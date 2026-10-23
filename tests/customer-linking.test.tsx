import { describe, expect, it } from 'vitest'
import { cloneSeed, linkCustomerTransactions } from '@/lib/erp'

describe('customer transaction linking', () => {
  it('repairs missing customer IDs by unique normalized name and preserves valid explicit links', () => {
    const state = cloneSeed()
    const customer = { ...state.customers[0], id: 'C-NEW', name: 'Kampala Fresh Mart' }
    state.customers = [customer]
    state.sales = [
      { ...state.sales[0], customer: '  kampala   fresh mart ', customerId: 'C-OLD' },
      { ...state.sales[1], customer: 'Different label', customerId: 'C-NEW' },
    ]
    state.orders = [
      { ...state.orders[0], customer: 'KAMPALA FRESH MART', customerId: undefined },
    ]

    const linked = linkCustomerTransactions(state)

    expect(linked.sales.map((sale) => sale.customerId)).toEqual(['C-NEW', 'C-NEW'])
    expect(linked.orders[0].customerId).toBe('C-NEW')
  })

  it('leaves ambiguous legacy name matches unlinked and marks credit sales for review', () => {
    const state = cloneSeed()
    const first = { ...state.customers[0], id: 'C-A', name: 'Same customer' }
    const second = { ...state.customers[1], id: 'C-B', name: 'same  customer' }
    state.customers = [first, second]
    state.sales = [
      {
        ...state.sales[0],
        customer: 'Same customer',
        customerId: undefined,
        paymentTerms: 'Credit',
      },
    ]
    state.orders = [{ ...state.orders[0], customer: 'Same customer', customerId: undefined }]

    const linked = linkCustomerTransactions(state)

    expect(linked.sales[0].customerId).toBeUndefined()
    expect(linked.sales[0].creditNeedsReview).toBe(true)
    expect(linked.orders[0].customerId).toBeUndefined()
  })
})
