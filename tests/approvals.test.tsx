import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Approvals from '@/components/approvals'
import type { ApprovalInboxResponse } from '@/lib/approval-inbox'
import type { UserAccount } from '@/lib/user-api'

const approvalApi = vi.hoisted(() => ({
  data: null as ApprovalInboxResponse | null,
  isLoading: false,
  isError: false,
  error: null as Error | null,
  refetch: vi.fn(),
  decide: vi.fn(),
}))

vi.mock('@/lib/approval-inbox-queries', () => ({
  useApprovalInbox: () => ({
    data: approvalApi.data,
    isLoading: approvalApi.isLoading,
    isError: approvalApi.isError,
    error: approvalApi.error,
    isFetching: false,
    refetch: approvalApi.refetch,
  }),
  useApprovalDecision: () => ({ mutateAsync: approvalApi.decide, isPending: false }),
}))

const user: UserAccount = {
  id: 'reviewer-1',
  name: 'Reviewer',
  email: 'reviewer@example.test',
  roles: ['Human Resource'],
  status: 'Active',
  createdAt: '2025-01-01T00:00:00.000Z',
  mustChangePassword: false,
}

function renderApprovals() {
  render(<Approvals currentUser={user} onViewSalaryAdvance={vi.fn()} onViewPayrollRun={vi.fn()} />)
}

function sampleInbox(): ApprovalInboxResponse {
  return {
    items: [
      {
        id: 'leave:1',
        source: 'Leave',
        recordId: 'leave-id',
        subRecordId: null,
        reference: 'LV-001',
        requester: 'Amina',
        submittedAt: '2026-10-01T10:00:00.000Z',
        summary: 'Annual · 2 working days',
        detail: 'Family event',
        status: 'Awaiting review',
        stage: 'Assigned reviewer',
        canAct: true,
        history: [],
      },
      {
        id: 'expense:1',
        source: 'Expense',
        recordId: 'expense-id',
        subRecordId: null,
        reference: 'EXP-001',
        requester: 'Finance',
        submittedAt: '2026-10-02T10:00:00.000Z',
        summary: 'Utilities · Operations',
        detail: 'Power',
        status: 'In progress',
        stage: 'General Manager',
        canAct: false,
        history: [],
      },
      {
        id: 'payroll:1',
        source: 'Payroll',
        recordId: 'run-id',
        subRecordId: null,
        reference: 'PAY-001',
        requester: 'HR',
        submittedAt: '2026-09-25T10:00:00.000Z',
        summary: 'Monthly payroll',
        detail: 'Approved by GM',
        status: 'Approved',
        stage: '',
        canAct: false,
        history: [{ stage: 'General Manager', decision: 'Approved', actor: 'Manager', at: '2026-09-26T10:00:00.000Z', note: '' }],
      },
    ],
    counts: { actionable: 1, inProgress: 1, history: 1 },
  }
}

describe('approvals work inbox', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    approvalApi.data = sampleInbox()
    approvalApi.isLoading = false
    approvalApi.isError = false
    approvalApi.error = null
    approvalApi.decide.mockResolvedValue({})
  })

  afterEach(() => cleanup())

  it('separates assigned actions, in-progress items, and history', () => {
    renderApprovals()
    expect(screen.getByText('LV-001')).toBeTruthy()
    expect(screen.queryByText('EXP-001')).toBeNull()

    fireEvent.click(screen.getByRole('tab', { name: /In progress/ }))
    expect(screen.getByText('EXP-001')).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: /History/ }))
    expect(screen.getByText('PAY-001')).toBeTruthy()
  })

  it('submits a leave decision and displays its decision trail', async () => {
    renderApprovals()
    fireEvent.click(screen.getByRole('button', { name: /Review/ }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText('Family event')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Approve · Assigned reviewer/ }))
    await waitFor(() => expect(approvalApi.decide).toHaveBeenCalledWith({
      source: 'Leave',
      recordId: 'leave-id',
      decision: 'Approved',
      note: '',
    }))
  })

  it('filters by workflow, stage, status, date, and search text', () => {
    renderApprovals()
    fireEvent.change(screen.getByLabelText('Filter approvals by workflow'), { target: { value: 'Leave' } })
    fireEvent.change(screen.getByLabelText('Filter approvals by stage'), { target: { value: 'Assigned reviewer' } })
    fireEvent.change(screen.getByLabelText('Filter approvals by status'), { target: { value: 'Awaiting review' } })
    fireEvent.change(screen.getByLabelText('Filter approvals from date'), { target: { value: '2026-10-01' } })
    fireEvent.change(screen.getByLabelText('Filter approvals to date'), { target: { value: '2026-10-01' } })
    fireEvent.change(screen.getByLabelText('Search approvals'), { target: { value: 'Amina' } })
    expect(screen.getByText('LV-001')).toBeTruthy()
    expect(screen.queryByText('EXP-001')).toBeNull()
  })

  it('shows explicit loading and retryable error states', () => {
    approvalApi.isLoading = true
    renderApprovals()
    expect(screen.getByLabelText('Loading approval inbox')).toBeTruthy()
    cleanup()

    approvalApi.isLoading = false
    approvalApi.isError = true
    approvalApi.error = new Error('Inbox unavailable')
    renderApprovals()
    expect(screen.getByRole('alert').textContent).toContain('Inbox unavailable')
  })
})
