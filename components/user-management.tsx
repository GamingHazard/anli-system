'use client'

import { useEffect, useMemo, useState } from 'react'
import * as Icons from 'lucide-react'
import AuditLogPanel from '@/components/audit-log'
import { ApiError, USER_ROLES, createUser, listUsers, resetUserPassword, updateUser, updateUserStatus, type AccountStatus, type UserAccount, type UserRole } from '@/lib/user-api'

type ActivityEntry = { id: string; message: string; time: string }
type PendingStatus = { account: UserAccount; status: 'Suspended' | 'Deactivated' | 'Active' }
type PasswordReset = { account: UserAccount; temporaryPassword: string; expiresAt: string }

const roles = [...USER_ROLES]
const statusTone: Record<AccountStatus, string> = {
  Active: 'bg-emerald-50 text-emerald-700',
  Suspended: 'bg-amber-50 text-amber-800',
  Deactivated: 'bg-slate-100 text-slate-600',
}
const fieldClass = 'mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-ring/30'

function formatTimestamp(value?: string) {
  if (!value) return 'Never recorded'
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export default function UserManagement({ currentUser }: { currentUser: UserAccount }) {
  const [accounts, setAccounts] = useState<UserAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'All statuses' | AccountStatus>('All statuses')
  const [roleFilter, setRoleFilter] = useState<'All roles' | UserRole>('All roles')
  const [view, setView] = useState<'accounts' | 'roles'>('accounts')
  const [editing, setEditing] = useState<UserAccount | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<PendingStatus | null>(null)
  const [pendingPasswordReset, setPendingPasswordReset] = useState<UserAccount | null>(null)
  const [passwordReset, setPasswordReset] = useState<PasswordReset | null>(null)
  const [auditTarget, setAuditTarget] = useState<UserAccount | null>(null)
  const [copyMessage, setCopyMessage] = useState('')
  const [suspensionReason, setSuspensionReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const refreshUsers = async () => {
    setLoading(true)
    setLoadError('')
    try {
      setAccounts(await listUsers())
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : 'Could not load user accounts.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true
    listUsers().then((users) => {
      if (mounted) setAccounts(users)
    }).catch((error: unknown) => {
      if (mounted) setLoadError(error instanceof ApiError ? error.message : 'Could not load user accounts.')
    }).finally(() => {
      if (mounted) setLoading(false)
    })
    return () => { mounted = false }
  }, [])

  const activeAccounts = accounts.filter((account) => account.status === 'Active')
  const suspendedAccounts = accounts.filter((account) => account.status === 'Suspended')
  const assignedUniqueRoles = new Set(accounts.filter((account) => account.status !== 'Deactivated').flatMap((account) => account.roles).filter((role) => role !== 'Admin')).size
  const vacantRoles = roles.length - 1 - assignedUniqueRoles
  const filteredAccounts = useMemo(() => accounts.filter((account) => {
    const searchable = `${account.name} ${account.email} ${account.roles.join(' ')}`.toLowerCase()
    return searchable.includes(search.trim().toLowerCase())
      && (statusFilter === 'All statuses' || account.status === statusFilter)
      && (roleFilter === 'All roles' || account.roles.includes(roleFilter))
  }).sort((left, right) => left.name.localeCompare(right.name)), [accounts, search, statusFilter, roleFilter])

  const addActivity = (messageText: string) => setActivity((entries) => [{ id: `${Date.now()}-${Math.random()}`, message: messageText, time: new Date().toISOString() }, ...entries].slice(0, 6))
  const openCreate = () => { setEditing(null); setMessage(''); setShowForm(true) }
  const openEdit = (account: UserAccount) => { setEditing(account); setMessage(''); setShowForm(true) }

  const saveAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') || '').trim()
    const email = String(form.get('email') || '').trim().toLowerCase()
    const password = String(form.get('password') || '')
    const selectedRoles = form.getAll('roles').map(String) as UserRole[]
    if (!name || !email || selectedRoles.length === 0) {
      setMessage('Enter a name, email address, and at least one role.')
      return
    }
    if (!editing && password.length < 8) {
      setMessage('Set an initial password with at least 8 characters.')
      return
    }
    if (accounts.some((account) => account.email.toLowerCase() === email && account.id !== editing?.id)) {
      setMessage('That email address is already in use.')
      return
    }
    const unavailableRole = selectedRoles.find((role) => role !== 'Admin' && accounts.some((account) => account.id !== editing?.id && account.status !== 'Deactivated' && account.roles.includes(role)))
    if (unavailableRole) {
      setMessage(`${unavailableRole} is already assigned to another account.`)
      return
    }
    if (editing?.status === 'Active' && editing.roles.includes('Super Admin') && !selectedRoles.includes('Super Admin') && !activeAccounts.some((account) => account.id !== editing.id && account.roles.includes('Super Admin'))) {
      setMessage('At least one active Super Admin must remain assigned.')
      return
    }
    setSaving(true)
    try {
      const { user } = editing
        ? await updateUser(editing.id, { name, email, roles: selectedRoles })
        : await createUser({ name, email, password, roles: selectedRoles })
      setAccounts((current) => editing
        ? current.map((account) => account.id === user.id ? user : account)
        : [user, ...current])
      addActivity(`${editing ? 'Updated' : 'Created'} account for ${user.name}`)
      setShowForm(false)
      setMessage(`${editing ? 'Account updated' : 'Account created'} successfully.`)
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : 'Could not save this account.')
    } finally {
      setSaving(false)
    }
  }

  const requestStatus = (account: UserAccount, status: PendingStatus['status']) => {
    if (account.status === status) return
    if (account.status === 'Active' && account.roles.includes('Super Admin') && status !== 'Active' && !activeAccounts.some((candidate) => candidate.id !== account.id && candidate.roles.includes('Super Admin'))) {
      setMessage('This is the only active Super Admin. Assign the role to another active user before changing this account.')
      return
    }
    setSuspensionReason('')
    setPendingStatus({ account, status })
  }

  const confirmStatus = async () => {
    if (!pendingStatus) return
    const { account, status } = pendingStatus
    if (status === 'Suspended' && !suspensionReason.trim()) return
    setSaving(true)
    try {
      const { user } = await updateUserStatus(account.id, status, suspensionReason)
      setAccounts((current) => current.map((candidate) => candidate.id === user.id ? user : candidate))
      addActivity(`${status === 'Active' ? 'Reactivated' : status === 'Suspended' ? 'Suspended' : 'Deactivated'} ${user.name}${status === 'Suspended' ? ` · ${suspensionReason.trim()}` : ''}`)
      setPendingStatus(null)
      setMessage(`${user.name} is now ${status.toLowerCase()}.`)
    } catch (error) {
      setPendingStatus(null)
      setMessage(error instanceof ApiError ? error.message : 'Could not update this account status.')
    } finally {
      setSaving(false)
    }
  }

  const confirmPasswordReset = async () => {
    if (!pendingPasswordReset) return
    const account = pendingPasswordReset
    setSaving(true)
    try {
      const result = await resetUserPassword(account.id)
      setPasswordReset({ account, ...result })
      setPendingPasswordReset(null)
      setCopyMessage('')
      addActivity(`Reset password for ${account.name}`)
    } catch (error) {
      setPendingPasswordReset(null)
      setMessage(error instanceof ApiError ? error.message : 'Could not reset this password.')
    } finally {
      setSaving(false)
    }
  }

  const copyTemporaryPassword = async () => {
    if (!passwordReset) return
    try {
      await navigator.clipboard.writeText(passwordReset.temporaryPassword)
      setCopyMessage('Temporary password copied.')
    } catch {
      setCopyMessage('Could not copy automatically. Select and copy the password manually.')
    }
  }

  const roleOwner = (role: UserRole) => accounts.filter((account) => account.roles.includes(role))
  const roleAssignees = (role: UserRole) => roleOwner(role).filter((account) => account.status !== 'Deactivated')
  const clearFilters = () => { setSearch(''); setStatusFilter('All statuses'); setRoleFilter('All roles') }

  return <div className="animate-in fade-in duration-300">
    <header className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><div className="mb-2 text-xs font-medium text-slate-400">Workspace / Settings</div><h2 className="text-2xl font-bold tracking-tight text-slate-900">User management</h2><p className="mt-1 max-w-2xl text-sm text-slate-500">Manage account profiles, access status, and operational role assignments.</p></div>
      <button type="button" onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3.5 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"><Icons.UserRoundPlus className="size-4" />Create user</button>
    </header>

    <div role="status" className="mb-5 flex items-start gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-xs leading-5 text-sky-900"><Icons.ShieldCheck className="mt-0.5 size-4 shrink-0" /><p>Accounts are stored on the server. New accounts must change their initial password the first time they sign in.</p></div>

    <section aria-label="Account summary" className="mb-5 grid gap-3 sm:grid-cols-3">
      <SummaryMetric label="Active accounts" value={activeAccounts.length} detail="Enabled accounts" icon="UsersRound" tone="green" />
      <SummaryMetric label="Suspended" value={suspendedAccounts.length} detail="Temporarily restricted" icon="UserRoundX" tone="amber" />
      <SummaryMetric label="Vacant unique roles" value={vacantRoles} detail="Admin may have multiple owners" icon="ShieldAlert" tone="blue" />
    </section>

    <div className="mb-4 flex gap-1 border-b border-slate-200" role="tablist" aria-label="User management views">
      {(['accounts', 'roles'] as const).map((item) => <button key={item} type="button" role="tab" aria-selected={view === item} onClick={() => setView(item)} className={`border-b-2 px-3 py-2.5 text-xs font-semibold capitalize ${view === item ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{item === 'accounts' ? 'Accounts' : 'Role coverage'}</button>)}
    </div>

    {view === 'accounts' ? <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 xl:flex-row xl:items-center xl:justify-between">
        <div><h3 className="text-sm font-bold text-slate-900">Accounts</h3><p className="mt-1 text-xs text-slate-500">{filteredAccounts.length} shown · server directory</p></div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><Icons.Search className="size-4 text-slate-400" /><input aria-label="Search users" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, email, or role" className="w-full bg-transparent text-xs outline-none sm:w-52" /></label>
          <select aria-label="Filter users by role" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as typeof roleFilter)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><option>All roles</option>{roles.map((role) => <option key={role}>{role}</option>)}</select>
          <select aria-label="Filter users by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><option>All statuses</option><option>Active</option><option>Suspended</option><option>Deactivated</option></select>
          {(search || roleFilter !== 'All roles' || statusFilter !== 'All statuses') && <button type="button" onClick={clearFilters} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Clear</button>}
        </div>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-190 text-left text-xs"><thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-400"><tr>{['User', 'Assigned roles', 'Last active', 'Status', ''].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead><tbody>
        {loading && <tr><td colSpan={5} className="px-5 py-12 text-center text-xs text-slate-500">Loading accounts…</td></tr>}
        {loadError && <tr><td colSpan={5} className="px-5 py-8 text-center"><p role="alert" className="text-xs text-rose-700">{loadError}</p><button type="button" onClick={refreshUsers} className="mt-2 text-xs font-semibold text-primary hover:underline">Try again</button></td></tr>}
        {filteredAccounts.map((account) => <tr key={account.id} className="border-t border-slate-100 text-slate-600 hover:bg-slate-50/70"><td className="px-4 py-3"><div className="flex items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold text-primary">{account.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><span className="min-w-0"><span className="block truncate font-semibold text-slate-800">{account.name}</span><span className="mt-0.5 block truncate text-[10px] text-slate-400">{account.email}</span></span></div></td><td className="px-4 py-3"><div className="flex max-w-md flex-wrap gap-1.5">{account.roles.map((role) => <span key={role} className={`rounded-md px-2 py-1 text-[10px] font-semibold ${role === 'Super Admin' ? 'bg-violet-50 text-violet-800' : role === 'Admin' ? 'bg-slate-100 text-slate-700' : 'bg-sky-50 text-sky-800'}`}>{role}</span>)}</div></td><td className="whitespace-nowrap px-4 py-3 text-[11px] text-slate-500">{formatTimestamp(account.lastActive)}</td><td className="px-4 py-3"><span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-semibold ${statusTone[account.status]}`}><span className="size-1.5 rounded-full bg-current" />{account.status}</span>{account.suspensionReason && <span className="mt-1 block max-w-36 truncate text-[10px] text-slate-400" title={account.suspensionReason}>{account.suspensionReason}</span>}</td><td className="px-4 py-3"><div className="flex justify-end gap-1">{currentUser.roles.includes('Super Admin') && <button type="button" onClick={() => setAuditTarget(account)} aria-label={`View audit history for ${account.name}`} title="Audit history" className="grid size-8 place-items-center rounded-md text-primary hover:bg-secondary"><Icons.ScrollText className="size-4" /></button>}<button type="button" onClick={() => setPendingPasswordReset(account)} aria-label={`Reset password for ${account.name}`} title="Reset password" className="grid size-8 place-items-center rounded-md text-violet-700 hover:bg-violet-50"><Icons.KeyRound className="size-4" /></button><button type="button" onClick={() => openEdit(account)} aria-label={`Edit ${account.name}`} title="Edit account" className="grid size-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"><Icons.PencilLine className="size-4" /></button>{account.status === 'Active' ? <button type="button" onClick={() => requestStatus(account, 'Suspended')} aria-label={`Suspend ${account.name}`} title="Suspend account" className="grid size-8 place-items-center rounded-md text-amber-700 hover:bg-amber-50"><Icons.Pause className="size-4" /></button> : account.status === 'Suspended' ? <button type="button" onClick={() => requestStatus(account, 'Active')} aria-label={`Reactivate ${account.name}`} title="Reactivate account" className="grid size-8 place-items-center rounded-md text-emerald-700 hover:bg-emerald-50"><Icons.CircleCheck className="size-4" /></button> : <button type="button" onClick={() => requestStatus(account, 'Active')} aria-label={`Restore ${account.name}`} title="Restore account" className="grid size-8 place-items-center rounded-md text-emerald-700 hover:bg-emerald-50"><Icons.RotateCcw className="size-4" /></button>}{account.status !== 'Deactivated' && <button type="button" onClick={() => requestStatus(account, 'Deactivated')} aria-label={`Deactivate ${account.name}`} title="Deactivate account" className="grid size-8 place-items-center rounded-md text-rose-700 hover:bg-rose-50"><Icons.UserRoundMinus className="size-4" /></button>}</div></td></tr>)}
        {!loading && !loadError && !filteredAccounts.length && <tr><td colSpan={5} className="px-5 py-14 text-center"><Icons.UsersRound className="mx-auto size-5 text-slate-300" /><p className="mt-3 text-xs font-semibold text-slate-700">No accounts match these filters</p><button type="button" onClick={clearFilters} className="mt-1 text-xs font-semibold text-primary hover:underline">Clear filters</button></td></tr>}
      </tbody></table></div>
      <footer className="border-t border-slate-100 px-4 py-3 text-[10px] text-slate-400">Role ownership rules are validated by the server.</footer>
    </section> : <section aria-label="Role coverage" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <header className="border-b border-slate-100 px-5 py-4"><h3 className="text-sm font-bold text-slate-900">Role coverage</h3><p className="mt-1 text-xs text-slate-500">Admin can be shared; all other roles have a single owner in this preview.</p></header>
      <div className="divide-y divide-slate-100">{roles.map((role) => { const owners = roleAssignees(role); return <div key={role} className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2"><Icons.Shield className="size-4 text-slate-400" /><span className="text-xs font-semibold text-slate-800">{role}</span>{role !== 'Admin' && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-500">Single owner</span>}</div><div className="flex flex-wrap gap-2">{owners.length ? owners.map((owner) => <span key={owner.id} className="inline-flex items-center gap-1.5 rounded-md bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-700"><span className="size-1.5 rounded-full bg-emerald-500" />{owner.name}</span>) : <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800"><Icons.CircleAlert className="size-3.5" />Unassigned</span>}</div></div> })}</div>
    </section>}

    {activity.length > 0 && <section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white"><header className="border-b border-slate-100 px-5 py-4"><h3 className="text-sm font-bold text-slate-900">Recent changes</h3><p className="mt-1 text-xs text-slate-500">Actions in this browser session; authoritative audit logging is not included.</p></header><div className="divide-y divide-slate-100">{activity.map((entry) => <div key={entry.id} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"><span className="text-xs font-medium text-slate-700">{entry.message}</span><time className="text-[10px] text-slate-400">{formatTimestamp(entry.time)}</time></div>)}</div></section>}

    {showForm && <UserForm account={editing} accounts={accounts} message={message} saving={saving} onClose={() => setShowForm(false)} onSave={saveAccount} />}
    {pendingStatus && <StatusDialog pending={pendingStatus} reason={suspensionReason} setReason={setSuspensionReason} saving={saving} onClose={() => setPendingStatus(null)} onConfirm={confirmStatus} />}
    {pendingPasswordReset && <Modal title="Reset user password" subtitle={`${pendingPasswordReset.name} · ${pendingPasswordReset.email}`} onClose={() => { if (!saving) setPendingPasswordReset(null) }}><div className="p-5"><p className="text-xs leading-5 text-slate-600">This will replace the current password, sign the user out of existing sessions, and require a password change at next sign-in. The generated six-character temporary password expires in 24 hours.</p><div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" disabled={saving} onClick={() => setPendingPasswordReset(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-50">Cancel</button><button type="button" disabled={saving} onClick={confirmPasswordReset} className="rounded-lg bg-violet-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-violet-800 disabled:opacity-50">{saving ? 'Resetting…' : 'Generate temporary password'}</button></div></div></Modal>}
    {passwordReset && <Modal title="Temporary password" subtitle={`${passwordReset.account.name} · ${passwordReset.account.email}`} onClose={() => { setPasswordReset(null); setCopyMessage('') }}><div className="p-5"><p className="text-xs leading-5 text-slate-600">Share this six-character temporary password with the user using a secure channel. It is shown only now, expires {formatTimestamp(passwordReset.expiresAt)}, and must be changed at their next sign-in.</p><code className="mt-4 block select-all break-all rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-sm text-slate-900">{passwordReset.temporaryPassword}</code>{copyMessage && <p role="status" className="mt-2 text-xs text-slate-600">{copyMessage}</p>}<div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={copyTemporaryPassword} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Icons.Copy className="size-3.5" />Copy password</button><button type="button" onClick={() => { setPasswordReset(null); setCopyMessage('') }} className="rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90">Done</button></div></div></Modal>}
    {auditTarget && <Modal title="Account audit history" subtitle={`${auditTarget.name} · ${auditTarget.email}`} onClose={() => setAuditTarget(null)}><div className="p-4"><AuditLogPanel currentUser={currentUser} targetUserId={auditTarget.id} /></div></Modal>}
    {message && !showForm && <div role="alert" className="fixed bottom-5 right-5 z-50 flex max-w-sm items-start gap-2 rounded-lg border border-amber-200 bg-white px-4 py-3 text-xs text-amber-900 shadow-lg"><Icons.Info className="mt-0.5 size-4 shrink-0" /><span>{message}</span><button type="button" aria-label="Dismiss message" onClick={() => setMessage('')} className="ml-2 text-slate-400 hover:text-slate-800"><Icons.X className="size-4" /></button></div>}
  </div>
}

function SummaryMetric({ label, value, detail, icon, tone }: { label: string; value: number; detail: string; icon: string; tone: string }) {
  const Icon = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[icon] ?? Icons.UsersRound
  const iconTone = tone === 'green' ? 'bg-emerald-50 text-emerald-700' : tone === 'amber' ? 'bg-amber-50 text-amber-700' : 'bg-sky-50 text-sky-700'
  return <article className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><span className={`grid size-9 place-items-center rounded-lg ${iconTone}`}><Icon className="size-4" /></span><span className="text-[9px] font-semibold uppercase text-slate-400">Live</span></div><div className="mt-3 text-xl font-bold tracking-tight text-slate-900">{value}</div><h3 className="mt-0.5 text-xs font-semibold text-slate-700">{label}</h3><p className="mt-1 text-[10px] text-slate-500">{detail}</p></article>
}

function UserForm({ account, accounts, message, saving, onClose, onSave }: { account: UserAccount | null; accounts: UserAccount[]; message: string; saving: boolean; onClose: () => void; onSave: (event: React.FormEvent<HTMLFormElement>) => void | Promise<void> }) {
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>(account?.roles ?? [])
  const activeSuperAdmins = accounts.filter((candidate) => candidate.status === 'Active' && candidate.roles.includes('Super Admin'))
  const availableRoles = (role: UserRole) => role === 'Admin' || !accounts.some((candidate) => candidate.id !== account?.id && candidate.status !== 'Deactivated' && candidate.roles.includes(role))
  const toggleRole = (role: UserRole) => {
    const next = selectedRoles.includes(role) ? selectedRoles.filter((item) => item !== role) : [...selectedRoles, role]
    if (role === 'Super Admin') {
      if (!next.includes(role) && account?.status === 'Active' && account.roles.includes(role) && activeSuperAdmins.length === 1) return
    }
    setSelectedRoles(next)
  }
  return <Modal title={account ? 'Edit user' : 'Create user'} subtitle={account ? 'Update the profile and assigned roles.' : 'Create a server account with its initial sign-in password.'} onClose={onClose}>
    <form onSubmit={onSave} className="p-5">
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Full name"><input required name="name" defaultValue={account?.name ?? ''} autoComplete="name" className={fieldClass} placeholder="Enter full name" /></Field><Field label="Email address"><input required name="email" type="email" defaultValue={account?.email ?? ''} autoComplete="email" className={fieldClass} placeholder="name@company.com" /></Field></div>
      {!account && <div className="mt-4"><Field label="Initial password"><input required name="password" type="password" minLength={8} autoComplete="new-password" className={fieldClass} placeholder="At least 8 characters" /></Field><p className="mt-1 text-[10px] text-slate-500">The password is hashed by the server. The new user must change it at first sign-in.</p></div>}
      <section className="mt-5"><div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-xs font-bold text-slate-800">Assign roles</h3><span className="text-[10px] text-slate-400">Select one or more</span></div><div className="mt-2 grid gap-2 sm:grid-cols-2">{roles.map((role) => { const available = availableRoles(role); const selected = selectedRoles.includes(role); const owner = accounts.find((candidate) => candidate.id !== account?.id && candidate.roles.includes(role) && candidate.status !== 'Deactivated'); const disabled = (!available && !selected) || (role === 'Super Admin' && selected && account?.status === 'Active' && account.roles.includes(role) && activeSuperAdmins.length === 1); return <label key={role} className={`flex min-h-11 items-center gap-2.5 rounded-md border px-3 py-2.5 text-xs ${selected ? 'border-primary/40 bg-secondary/50 text-slate-800' : disabled ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}><input type="checkbox" name="roles" value={role} checked={selected} disabled={disabled} onChange={() => toggleRole(role)} className="size-4 accent-primary" /><span className="min-w-0 flex-1 font-medium">{role}{role === 'Admin' && <small className="ml-1.5 text-[9px] text-slate-400">Shared</small>}{!available && !selected && owner && <small className="mt-0.5 block truncate text-[9px] text-amber-700">Assigned to {owner.name}</small>}</span>{selected && <Icons.Check className="size-4 shrink-0 text-primary" />}</label> })}</div><p className="mt-2 text-[10px] leading-4 text-slate-500">Admin can have multiple users. Each other role can have one active or suspended owner. Deactivated accounts release their roles.</p></section>
      {message && <p role="alert" className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{message}</p>}
      <footer className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancel</button><button type="submit" disabled={saving} className="rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{saving ? 'Saving…' : account ? 'Save changes' : 'Create account'}</button></footer>
    </form>
  </Modal>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-xs font-semibold text-slate-600">{label}{children}</label> }

function StatusDialog({ pending, reason, setReason, saving, onClose, onConfirm }: { pending: PendingStatus; reason: string; setReason: (value: string) => void; saving: boolean; onClose: () => void; onConfirm: () => void | Promise<void> }) {
  const heading = pending.status === 'Active' ? 'Reactivate user' : pending.status === 'Suspended' ? 'Suspend user' : 'Deactivate user'
  const description = pending.status === 'Active' ? 'This user will regain access to the workspace.' : pending.status === 'Suspended' ? 'This user will lose access until reactivated. Add a reason for the record.' : 'This user will be deactivated and their account history will remain visible.'
  return <Modal title={heading} subtitle={`${pending.account.name} · ${pending.account.email}`} onClose={onClose}><div className="p-5"><p className="text-xs leading-5 text-slate-600">{description}</p>{pending.status === 'Suspended' && <Field label="Reason"><textarea autoFocus required value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className={fieldClass} placeholder="Reason for suspension" /></Field>}<div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" disabled={saving} onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-50">Cancel</button><button type="button" disabled={saving || (pending.status === 'Suspended' && !reason.trim())} onClick={onConfirm} className={`rounded-lg px-3.5 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${pending.status === 'Active' ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-rose-700 hover:bg-rose-800'}`}>{saving ? 'Saving…' : heading}</button></div></div></Modal>
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-80 grid place-items-center bg-slate-950/45 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section role="dialog" aria-modal="true" aria-labelledby="user-dialog-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl"><header className="flex items-start justify-between border-b border-slate-100 px-5 py-4"><div><h2 id="user-dialog-title" className="text-base font-bold text-slate-900">{title}</h2><p className="mt-1 text-xs text-slate-500">{subtitle}</p></div><button type="button" aria-label={`Close ${title}`} onClick={onClose} className="grid size-8 place-items-center rounded-md text-slate-400 hover:bg-slate-100"><Icons.X className="size-4" /></button></header>{children}</section></div>
}
