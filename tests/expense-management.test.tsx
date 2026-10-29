import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ExpenseManagement from '@/components/expense-management'
import { cloneSeed } from '@/lib/erp'
import type { UserAccount } from '@/lib/user-api'

const expenseApi = vi.hoisted(() => ({
  create: vi.fn(),
  payment: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  importLegacy: vi.fn(),
  download: vi.fn(),
  expenses: [] as unknown[],
}))

vi.mock('@/lib/expense-queries', () => ({
  useCreateExpense: () => ({ mutateAsync: expenseApi.create }),
  useExpenses: () => ({
    data: { expenses: expenseApi.expenses },
    isError: false,
    refetch: vi.fn(),
  }),
  useExpenseAttachmentDownload: () => expenseApi.download,
  useImportLegacyExpenses: () => ({ mutateAsync: expenseApi.importLegacy }),
  useRecordExpensePayment: () => ({ mutateAsync: expenseApi.payment }),
  useRemoveExpenseAttachment: () => ({ mutateAsync: expenseApi.remove }),
  useUploadExpenseAttachment: () => ({ mutateAsync: expenseApi.upload }),
}))

const accountant: UserAccount = {
  id: 'accountant-1',
  name: 'Finance User',
  email: 'finance@example.test',
  roles: ['Accountant'],
  status: 'Active',
  createdAt: '2025-01-01T00:00:00.000Z',
  mustChangePassword: false,
}

function renderExpenses(roles: UserAccount['roles'] = accountant.roles) {
  render(
    <ExpenseManagement
      state={cloneSeed()}
      currentUser={{ ...accountant, roles }}
      onViewPayrollRun={vi.fn()}
    />,
  )
}

describe('expense-management', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    expenseApi.expenses = []
  })

  afterEach(() => cleanup())

  it('shows Uganda tax types only for Tax and submits the selected tax type', async () => {
    expenseApi.create.mockResolvedValue({
      expense: { id: 'expense-1', reference: 'EXP-2025-0001' },
    })
    renderExpenses()

    fireEvent.click(screen.getByRole('button', { name: 'Record expense' }))
    const dialog = screen.getByRole('dialog', { name: 'Record expense' })
    expect(within(dialog).queryByLabelText('Tax type')).toBeNull()

    fireEvent.change(within(dialog).getByLabelText('Category'), { target: { value: 'Tax' } })
    const taxType = within(dialog).getByLabelText('Tax type') as HTMLSelectElement
    expect(taxType.required).toBe(true)
    expect(within(dialog).getByRole('option', { name: 'Corporation tax' })).toBeTruthy()
    expect(within(dialog).getByRole('option', { name: 'Local Service Tax (LST)' })).toBeTruthy()
    expect(within(dialog).getByText(/VAT collected and PAYE\/withholding/i)).toBeTruthy()

    fireEvent.change(taxType, { target: { value: 'Corporation tax' } })
    fireEvent.change(within(dialog).getByLabelText('Payee'), { target: { value: 'URA' } })
    fireEvent.change(within(dialog).getByLabelText('Amount (UGX)'), { target: { value: '250000' } })
    fireEvent.change(within(dialog).getByLabelText('Business purpose / description'), {
      target: { value: 'Quarterly corporation tax payment' },
    })
    fireEvent.submit(within(dialog).getByRole('button', { name: 'Submit for approval' }).closest('form')!)

    await waitFor(() => expect(expenseApi.create).toHaveBeenCalledOnce())
    expect(expenseApi.create).toHaveBeenCalledWith(expect.objectContaining({
      category: 'Tax',
      taxType: 'Corporation tax',
      payee: 'URA',
      amount: 250000,
    }))
  })

  it('hides the tax type field when another category is selected', () => {
    renderExpenses()
    fireEvent.click(screen.getByRole('button', { name: 'Record expense' }))
    const dialog = screen.getByRole('dialog', { name: 'Record expense' })

    fireEvent.change(within(dialog).getByLabelText('Category'), { target: { value: 'Utilities' } })

    expect(within(dialog).queryByLabelText('Tax type')).toBeNull()
  })

  it('offers expense actions to a General Manager across finance departments', () => {
    renderExpenses(['General Manager'])
    expect(screen.getByRole('button', { name: 'Record expense' })).not.toBeNull()
    expect(screen.getByRole('heading', { name: 'Expenses' })).not.toBeNull()
  })

  it('offers expense actions to a Super Admin across departments', () => {
    renderExpenses(['Super Admin'])
    expect(screen.getByRole('button', { name: 'Record expense' })).not.toBeNull()
  })
})
