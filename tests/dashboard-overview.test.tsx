import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DashboardOverview from '@/components/dashboard-overview'
import type { UserRole } from '@/lib/user-api'

const dashboardApi = vi.hoisted(() => ({ getDashboardSummary: vi.fn() }))

vi.mock('@/lib/user-api', () => ({ getDashboardSummary: dashboardApi.getDashboardSummary }))

const summary = {
  version: 1,
  range: { from: '2026-10-18', to: '2026-10-24', timeZone: 'Africa/Kampala' },
  generatedAt: '2026-10-24T08:00:00.000Z',
  sections: {
    sales: {
      status: 'available',
      revenue: 1_200_000,
      collected: 900_000,
      outstanding: 300_000,
      overdueReceivables: 2,
      trend: [{ date: '2026-10-24', revenue: 1_200_000, collected: 900_000 }],
      products: [{ name: 'Maize flour', revenue: 700_000 }],
    },
    orders: {
      status: 'available',
      open: 4,
      late: 1,
      highPriority: 2,
      byStatus: [{ status: 'Pending', count: 4 }],
    },
    production: {
      status: 'available',
      produced: 120,
      damaged: 3,
      trend: [{ date: '2026-10-24', produced: 120, damaged: 3 }],
    },
    inventory: { status: 'available', activeLowStock: 1 },
    expenses: {
      status: 'available',
      total: 500_000,
      pendingApproval: 2,
      trend: [{ date: '2026-10-24', amount: 500_000 }],
    },
  },
}

function renderDashboard(roles: readonly UserRole[] = ['General Manager']) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <QueryClientProvider client={client}>
      <DashboardOverview
        companyName="ANLI"
        companyLogoUrl=""
        userName="Ada User"
        roles={roles}
        onNavigate={vi.fn()}
        onExportSales={vi.fn()}
      />
    </QueryClientProvider>,
  )
}

describe('live dashboard overview', () => {
  afterEach(() => {
    cleanup()
    dashboardApi.getDashboardSummary.mockReset()
  })

  it('renders live role-authorized KPIs and actionable exceptions', async () => {
    dashboardApi.getDashboardSummary.mockResolvedValue(summary)
    renderDashboard()

    expect(await screen.findByText('Sales revenue')).toBeTruthy()
    expect(screen.getByText('Open orders')).toBeTruthy()
    expect(screen.getAllByText('Production output').length).toBeGreaterThan(0)
    expect(screen.getByText('Approved expenses')).toBeTruthy()
    expect(screen.getByText('1 late orders')).toBeTruthy()
    expect(screen.getByText('1 low-stock materials')).toBeTruthy()
    expect(dashboardApi.getDashboardSummary).toHaveBeenCalled()
  })

  it('changes the selected date range and fetches fresh dashboard data', async () => {
    dashboardApi.getDashboardSummary.mockResolvedValue(summary)
    renderDashboard()
    await screen.findByText('Sales revenue')
    const initialFrom = dashboardApi.getDashboardSummary.mock.calls.at(-1)?.[0]

    fireEvent.change(screen.getByLabelText('Dashboard date range'), { target: { value: '30d' } })
    await waitFor(() => {
      expect(dashboardApi.getDashboardSummary.mock.calls.some(([from]) => from !== initialFrom)).toBe(true)
    })
  })

  it('renders only the HR aggregates returned for an HR account', async () => {
    dashboardApi.getDashboardSummary.mockResolvedValue({
      ...summary,
      sections: {
        people: {
          status: 'available',
          recordedAttendance: 8,
          pendingLeave: 1,
          attendanceByStatus: [{ status: 'Present', count: 8 }],
        },
      },
    })
    renderDashboard(['Human Resource'])

    expect(await screen.findByText('Attendance records')).toBeTruthy()
    expect(screen.getByText('People operations')).toBeTruthy()
    expect(screen.queryByText('Sales revenue')).toBeNull()
    expect(screen.queryByText('Approved expenses')).toBeNull()
  })

  it('shows a retryable error instead of displaying failed data as zero', async () => {
    dashboardApi.getDashboardSummary.mockRejectedValue(new Error('offline'))
    renderDashboard()
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText('Dashboard data could not be loaded.')).toBeTruthy()
  })

  it('keeps the last successful snapshot visible if a refresh fails', async () => {
    dashboardApi.getDashboardSummary
      .mockResolvedValueOnce(summary)
      .mockRejectedValueOnce(new Error('offline'))
    renderDashboard()
    expect(await screen.findByText('Sales revenue')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Refresh dashboard data' }))
    expect(await screen.findByText(/showing the last successful dashboard snapshot/i)).toBeTruthy()
    expect(screen.getByText('Sales revenue')).toBeTruthy()
  })
})
