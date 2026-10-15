export type Status = 'Paid' | 'Pending' | 'Overdue' | 'Approved' | 'Draft' | 'Active' | 'Inactive'

export type Sale = { id: string; date: string; customer: string; product: string; quantity: number; total: number; status: 'Paid' | 'Pending'; method: string; reference: string }
export type Order = { id: string; reference: string; date: string; customer: string; product: string; quantity: number; total: number; status: 'Draft' | 'Pending' | 'Approved' | 'Cancelled'; priority: 'Normal' | 'High'; notes: string }
export type Employee = { id: string; name: string; number: string; category: 'Staff' | 'Casual' | 'Other'; department: string; role: string; status: 'Active' | 'Inactive'; salary: number }
export type Expense = { id: string; reference: string; category: string; description: string; amount: number; date: string; status: 'Paid' | 'Pending'; department: string }
export type Customer = { id: string; name: string; type: string; phone: string; email: string; status: 'Active' | 'Inactive'; purchases: number }
export type RawMaterial = { id: string; code: string; name: string; category: string; quantity: number; unit: string; threshold: number; cost: number; location: string }
export type Activity = { id: string; action: string; module: string; actor: string; time: string; outcome: 'Success' | 'Review' }
export type ErpState = { sales: Sale[]; orders: Order[]; employees: Employee[]; expenses: Expense[]; customers: Customer[]; materials: RawMaterial[]; activities: Activity[] }

const daysAgo = (days: number) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
export const seedState: ErpState = {
  orders: [
    { id: 'ORD-1008', reference: 'ORD-1008', date: daysAgo(0), customer: 'Nile Foods Ltd', product: 'Wheat Flour 25kg', quantity: 36, total: 2880000, status: 'Pending', priority: 'High', notes: 'Deliver with the next wholesale run.' },
    { id: 'ORD-1007', reference: 'ORD-1007', date: daysAgo(2), customer: 'Kampala Fresh Mart', product: 'Premium Maize Flour', quantity: 60, total: 2700000, status: 'Approved', priority: 'Normal', notes: 'Customer requested delivery before Friday.' },
    { id: 'ORD-1006', reference: 'ORD-1006', date: daysAgo(5), customer: 'Acacia Hotels', product: 'Rice 50kg', quantity: 20, total: 1800000, status: 'Draft', priority: 'Normal', notes: 'Awaiting confirmation of quantities.' },
  ],
  sales: [
    { id: 'S-1048', reference: 'SAL-1048', date: daysAgo(0), customer: 'Kampala Fresh Mart', product: 'Premium Maize Flour', quantity: 42, total: 1890000, status: 'Paid', method: 'Mobile Money' },
    { id: 'S-1047', reference: 'SAL-1047', date: daysAgo(1), customer: 'Nile Foods Ltd', product: 'Wheat Flour 25kg', quantity: 18, total: 1440000, status: 'Pending', method: 'Bank Transfer' },
    { id: 'S-1046', reference: 'SAL-1046', date: daysAgo(2), customer: 'Acacia Hotels', product: 'Rice 50kg', quantity: 24, total: 2160000, status: 'Paid', method: 'Cash' },
    { id: 'S-1045', reference: 'SAL-1045', date: daysAgo(4), customer: 'Green Basket', product: 'Premium Maize Flour', quantity: 30, total: 1350000, status: 'Paid', method: 'Card' },
    { id: 'S-1044', reference: 'SAL-1044', date: daysAgo(8), customer: 'Kampala Fresh Mart', product: 'Sugar 25kg', quantity: 12, total: 780000, status: 'Paid', method: 'Mobile Money' },
  ],
  employees: [
    { id: 'E-001', number: 'EMP-001', name: 'Sarah Namirembe', category: 'Staff', department: 'Finance', role: 'Finance Manager', status: 'Active', salary: 4200000 },
    { id: 'E-002', number: 'EMP-002', name: 'David Okello', category: 'Staff', department: 'Sales', role: 'Sales Lead', status: 'Active', salary: 3500000 },
    { id: 'E-003', number: 'EMP-003', name: 'Grace Achieng', category: 'Casual', department: 'Production', role: 'Line Operator', status: 'Active', salary: 180000 },
    { id: 'E-004', number: 'EMP-004', name: 'Michael Kato', category: 'Casual', department: 'Warehouse', role: 'Store Assistant', status: 'Active', salary: 160000 },
    { id: 'E-005', number: 'EMP-005', name: 'Peter Ssekabira', category: 'Other', department: 'Operations', role: 'Driver', status: 'Inactive', salary: 2400000 },
  ],
  expenses: [
    { id: 'EX-209', reference: 'EXP-209', category: 'Logistics', description: 'Delivery fuel and maintenance', amount: 680000, date: daysAgo(1), status: 'Paid', department: 'Operations' },
    { id: 'EX-208', reference: 'EXP-208', category: 'Utilities', description: 'Factory electricity', amount: 1250000, date: daysAgo(4), status: 'Pending', department: 'Production' },
    { id: 'EX-207', reference: 'EXP-207', category: 'Supplies', description: 'Packaging materials', amount: 430000, date: daysAgo(6), status: 'Paid', department: 'Production' },
    { id: 'EX-206', reference: 'EXP-206', category: 'Payroll', description: 'Casual worker wages', amount: 2100000, date: daysAgo(8), status: 'Paid', department: 'HR' },
  ],
  customers: [
    { id: 'C-001', name: 'Kampala Fresh Mart', type: 'Retail', phone: '+256 701 234 567', email: 'procurement@kfm.ug', status: 'Active', purchases: 15 },
    { id: 'C-002', name: 'Nile Foods Ltd', type: 'Wholesale', phone: '+256 772 555 019', email: 'orders@nilefoods.ug', status: 'Active', purchases: 9 },
    { id: 'C-003', name: 'Acacia Hotels', type: 'Corporate', phone: '+256 783 112 400', email: 'finance@acacia.ug', status: 'Active', purchases: 7 },
    { id: 'C-004', name: 'Green Basket', type: 'Retail', phone: '+256 709 445 201', email: 'hello@greenbasket.ug', status: 'Inactive', purchases: 4 },
  ],
  materials: [
    { id: 'RM-001', code: 'RM-MZ-01', name: 'Maize grain', category: 'Grains', quantity: 2840, unit: 'kg', threshold: 1000, cost: 1250, location: 'Main Warehouse' },
    { id: 'RM-002', code: 'RM-PK-02', name: 'Packaging bags', category: 'Packaging', quantity: 620, unit: 'pcs', threshold: 800, cost: 420, location: 'Packaging Store' },
    { id: 'RM-003', code: 'RM-WH-03', name: 'Wheat grain', category: 'Grains', quantity: 1640, unit: 'kg', threshold: 900, cost: 1850, location: 'Main Warehouse' },
    { id: 'RM-004', code: 'RM-SG-04', name: 'Sugar', category: 'Ingredients', quantity: 410, unit: 'kg', threshold: 500, cost: 2900, location: 'Ingredients Store' },
  ],
  activities: [
    { id: 'A-01', action: 'Sale recorded', module: 'Sales', actor: 'Sarah Namirembe', time: '12 min ago', outcome: 'Success' },
    { id: 'A-02', action: 'Invoice INV-0091 issued', module: 'Invoicing', actor: 'David Okello', time: '38 min ago', outcome: 'Success' },
    { id: 'A-03', action: 'Expense awaiting approval', module: 'Finance', actor: 'System', time: '1 hr ago', outcome: 'Review' },
    { id: 'A-04', action: 'Stock adjustment approved', module: 'Inventory', actor: 'James Mugisha', time: '2 hrs ago', outcome: 'Success' },
  ],
}

export const cloneSeed = (): ErpState => JSON.parse(JSON.stringify(seedState))
export const money = (value: number) => new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(value)
export const formatDate = (date: string) => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date))
export const sum = (items: number[]) => items.reduce((total, value) => total + value, 0)
export const isWithinDays = (date: string, days: number) => (Date.now() - new Date(date).getTime()) / 86400000 <= days
export const simulate = <T,>(value: T, delay = 260) => new Promise<T>((resolve) => setTimeout(() => resolve(value), delay))
const STORAGE_KEY = 'lumina-erp-demo-v1'
export const loadState = (): ErpState => { if (typeof window === 'undefined') return cloneSeed(); try { const saved = window.localStorage.getItem(STORAGE_KEY); return saved ? JSON.parse(saved) : cloneSeed() } catch { return cloneSeed() } }
export const saveState = (state: ErpState) => { if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) }
export const clearState = () => { if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY) }
export const createId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
export const exportCsv = (filename: string, rows: Record<string, unknown>[]) => { if (!rows.length) return; const headers = Object.keys(rows[0]); const csv = [headers.join(','), ...rows.map(row => headers.map(header => JSON.stringify(row[header] ?? '')).join(','))].join('\n'); const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url) }
export const navGroups = [
  { label: 'Overview', items: [{ label: 'Dashboard', icon: 'LayoutDashboard' }] },
  { label: 'Sales Department', items: [{ label: 'Sales', icon: 'ShoppingCart' }, { label: 'Orders', icon: 'ClipboardList' }, { label: 'Receipt Management', icon: 'ReceiptText' }, { label: 'Customer Management', icon: 'Users' }, { label: 'Invoicing', icon: 'FileText' }] },
  { label: 'HR Department', items: [{ label: 'Employee Profiles', icon: 'ContactRound' }, { label: 'Attendance Management', icon: 'CalendarCheck' }, { label: 'Payroll Management', icon: 'WalletCards' }, { label: 'Salary Advance Management', icon: 'HandCoins' }, { label: 'Leave Management', icon: 'CalendarDays' }, { label: 'Punishment Management', icon: 'ShieldAlert' }] },
  { label: 'Finance Department', items: [{ label: 'Expenses', icon: 'Receipt' }, { label: 'Reporting', icon: 'ChartNoAxesCombined' }, { label: 'Analysis', icon: 'ChartSpline' }, { label: 'Auditing', icon: 'ScrollText' }] },
  { label: 'Inventory Department', items: [{ label: 'Raw Material Management', icon: 'Boxes' }, { label: 'Production Management', icon: 'Factory' }, { label: 'Assets Management', icon: 'Building2' }, { label: 'Data Backup', icon: 'DatabaseBackup' }] },
  { label: 'Settings', items: [{ label: 'Company Profile Management', icon: 'Building' }, { label: 'User Management', icon: 'UserCog' }, { label: 'Finance Settings', icon: 'SlidersHorizontal' }, { label: 'Security Settings', icon: 'LockKeyhole' }] },
]
export const allNavItems = navGroups.flatMap(group => group.items)
export const chartData = [{ day: 'Mon', sales: 3.8, expenses: 1.2 }, { day: 'Tue', sales: 5.2, expenses: 1.7 }, { day: 'Wed', sales: 4.1, expenses: 1.1 }, { day: 'Thu', sales: 6.4, expenses: 2.2 }, { day: 'Fri', sales: 7.8, expenses: 1.8 }, { day: 'Sat', sales: 5.6, expenses: 1.4 }, { day: 'Sun', sales: 4.9, expenses: 1.1 }]
export const productMix = [{ name: 'Maize Flour', value: 42 }, { name: 'Wheat Flour', value: 28 }, { name: 'Rice', value: 18 }, { name: 'Sugar', value: 12 }]
export const initials = (name: string) => name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase()
export { STORAGE_KEY }
