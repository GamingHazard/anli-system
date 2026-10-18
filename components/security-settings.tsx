'use client'

import { useCallback, useEffect, useState } from 'react'
import * as Icons from 'lucide-react'
import AuditLogPanel from '@/components/audit-log'
import {
  ApiError,
  getSessionProtectionSettings,
  listActiveSessions,
  listUsers,
  revokeActiveSession,
  updateSessionProtectionSettings,
  type ActiveSession,
  type SessionProtectionSettings,
  type UserAccount,
} from '@/lib/user-api'

type Role = 'Super Admin' | 'Admin' | 'General Manager' | 'Human Resource' | 'Marketing Manager' | 'Sales Manager' | 'Production Manager' | 'Inventory Manager' | 'Accountant'
type Capability = 'view' | 'create' | 'edit' | 'delete'
type Section = 'Protection' | 'Permissions' | 'Backups & recovery' | 'Audit'

const roles: Role[] = ['Super Admin', 'Admin', 'General Manager', 'Human Resource', 'Marketing Manager', 'Sales Manager', 'Production Manager', 'Inventory Manager', 'Accountant']
const areas = ['User Management', 'Company Profile', 'Sales & orders', 'Customer records', 'HR & payroll', 'Expenses & finance', 'Inventory & production', 'Company assets', 'Data backup']
const capabilities: Capability[] = ['view', 'create', 'edit', 'delete']
const unavailableButton = 'inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-400'
const fieldClass = 'mt-1.5 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-700 outline-none focus:border-primary focus:ring-2 focus:ring-ring/30'

const initialPermissions = Object.fromEntries(roles.map((role) => [role, Object.fromEntries(areas.map((area) => [area, {
  view: role === 'Super Admin' || role === 'Admin' || role === 'General Manager',
  create: role === 'Super Admin' || role === 'Admin',
  edit: role === 'Super Admin' || role === 'Admin',
  delete: role === 'Super Admin',
}]))])) as Record<Role, Record<string, Record<Capability, boolean>>>

function Toggle({ checked, onChange, title, description }: { checked: boolean; onChange: (value: boolean) => void; title: string; description: string }) {
  return <label className="flex cursor-pointer items-start gap-3"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="peer sr-only" /><span aria-hidden="true" className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:shadow-sm after:transition ${checked ? 'bg-emerald-600 after:translate-x-4' : 'bg-slate-300'}`} /><span><span className="block text-xs font-semibold text-slate-800">{title}</span><span className="mt-0.5 block text-[10px] leading-4 text-slate-500">{description}</span></span></label>
}

function NumberField({ label, value, suffix, min, max, onChange }: { label: string; value: number; suffix: string; min: number; max: number; onChange: (value: number) => void }) {
  return <label className="block text-[10px] font-semibold leading-4 text-slate-600">{label}<span className="mt-1 flex items-center rounded-lg border border-slate-200 bg-white focus-within:border-primary"><input type="number" min={min} max={max} value={value} onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value) || min)))} className="w-full min-w-0 bg-transparent px-3 py-2 text-xs font-semibold text-slate-800 outline-none" /><span className="pr-3 text-[10px] font-normal text-slate-400">{suffix}</span></span></label>
}

function Card({ title, detail, icon, children }: { title: string; detail: string; icon: string; children: React.ReactNode }) {
  const Icon = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[icon] ?? Icons.Settings2
  return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><header className="flex items-start gap-3 border-b border-slate-100 px-5 py-4"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600"><Icon className="size-4" /></span><div><h3 className="text-sm font-bold text-slate-900">{title}</h3><p className="mt-1 text-xs leading-4 text-slate-500">{detail}</p></div></header><div className="p-5">{children}</div></section>
}

function SessionDevicePanel({
  currentUser,
  onCurrentSessionRevoked,
}: {
  currentUser: UserAccount
  onCurrentSessionRevoked: () => void
}) {
  const isSuperAdmin = currentUser.roles.includes('Super Admin')
  const [settings, setSettings] = useState<SessionProtectionSettings>({
    privilegedIdle: 15,
    generalIdle: 30,
    warningPeriod: 2,
  })
  const [accounts, setAccounts] = useState<UserAccount[]>([])
  const [targetUserId, setTargetUserId] = useState(currentUser.id)
  const [sessions, setSessions] = useState<ActiveSession[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let mounted = true
    if (isSuperAdmin) {
      Promise.all([getSessionProtectionSettings(), listUsers()])
        .then(([result, users]) => {
          if (!mounted) return
          setSettings(result.sessionProtection)
          setAccounts(users)
        })
        .catch((cause: unknown) => {
          if (mounted) setError(cause instanceof ApiError ? cause.message : 'Could not load session settings.')
        })
    }
    return () => { mounted = false }
  }, [isSuperAdmin])

  const refreshSessions = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await listActiveSessions(
        isSuperAdmin && targetUserId !== currentUser.id ? targetUserId : undefined,
      )
      setSessions(result.sessions)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not load active sessions.')
    } finally {
      setLoading(false)
    }
  }, [currentUser.id, isSuperAdmin, targetUserId])

  useEffect(() => {
    void refreshSessions()
  }, [refreshSessions])

  const saveSettings = async () => {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const result = await updateSessionProtectionSettings(settings)
      setSettings(result.sessionProtection)
      setNotice('Session protection settings saved.')
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not save session settings.')
    } finally {
      setSaving(false)
    }
  }

  const revokeSession = async (session: ActiveSession) => {
    if (!window.confirm(`Revoke ${session.current ? 'this session' : 'this device session'}?`)) return
    setError('')
    setNotice('')
    try {
      await revokeActiveSession(session.id)
      if (session.current) {
        onCurrentSessionRevoked()
        return
      }
      setNotice('Session revoked.')
      await refreshSessions()
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not revoke this session.')
    }
  }

  return <>
    <Card title="Session & device protection" detail="Idle expiry is enforced by the server; this browser shows a warning and signs out at the deadline." icon="MonitorLock">
      <div className="space-y-5">
        {isSuperAdmin ? <>
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField label="Privileged idle timeout" value={settings.privilegedIdle} min={5} max={240} suffix="minutes" onChange={(value) => setSettings((current) => ({ ...current, privilegedIdle: value }))} />
            <NumberField label="General idle timeout" value={settings.generalIdle} min={5} max={480} suffix="minutes" onChange={(value) => setSettings((current) => ({ ...current, generalIdle: value }))} />
          </div>
          <NumberField label="Warn before sign-out" value={settings.warningPeriod} min={1} max={10} suffix="minutes" onChange={(value) => setSettings((current) => ({ ...current, warningPeriod: value }))} />
          <p className="rounded-md bg-sky-50 px-3 py-2.5 text-[10px] leading-4 text-sky-900">Super Admin and Admin accounts use the privileged timeout. Other roles use the general timeout. Sessions also have a fixed eight-hour maximum lifetime.</p>
          <button type="button" disabled={saving} onClick={saveSettings} className="rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{saving ? 'Saving…' : 'Save session settings'}</button>
        </> : <p className="rounded-md bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600">Session timeouts are enforced by the server. Contact a Super Admin to change the workspace policy.</p>}
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-[10px] leading-4 text-amber-900"><strong>MFA is not enforced.</strong> Multi-factor sign-in requires enrollment and challenge flows that are not yet implemented.</div>
      </div>
    </Card>
    <Card title="Active sessions" detail="Review signed-in devices and revoke sessions you no longer recognize." icon="LaptopMinimalCheck">
      <div className="space-y-4">
        {isSuperAdmin && <label className="block max-w-md text-xs font-semibold text-slate-600">Sessions for account<select value={targetUserId} onChange={(event) => setTargetUserId(event.target.value)} className={fieldClass}><option value={currentUser.id}>My sessions</option>{accounts.filter((account) => account.id !== currentUser.id).map((account) => <option key={account.id} value={account.id}>{account.name} · {account.email}</option>)}</select></label>}
        {error && <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
        {notice && <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{notice}</p>}
        {loading ? <p className="py-5 text-center text-xs text-slate-500">Loading sessions…</p> : sessions.length ? <ul className="divide-y divide-slate-100">{sessions.map((session) => <li key={session.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-800">{session.userAgent}{session.current && <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] text-emerald-700">This device</span>}</p><p className="mt-1 text-[10px] text-slate-500">Last active {new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(session.lastActivityAt))} · Expires {new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(session.absoluteExpiresAt))}</p></div><button type="button" onClick={() => void revokeSession(session)} className="inline-flex w-fit items-center gap-1.5 rounded-md border border-rose-200 px-2.5 py-1.5 text-[10px] font-semibold text-rose-700 hover:bg-rose-50"><Icons.LogOut className="size-3.5" />Revoke</button></li>)}</ul> : <p className="py-5 text-center text-xs text-slate-500">No active sessions found.</p>}
        <button type="button" onClick={() => void refreshSessions()} disabled={loading} className="text-xs font-semibold text-primary hover:underline disabled:opacity-50">Refresh sessions</button>
      </div>
    </Card>
  </>
}

export default function SecuritySettings({ currentUser, onCurrentSessionRevoked }: { currentUser: UserAccount; onCurrentSessionRevoked: () => void }) {
  const [section, setSection] = useState<Section>('Protection')
  const [selectedRole, setSelectedRole] = useState<Role>('Admin')
  const [lockoutEnabled, setLockoutEnabled] = useState(true)
  const [maxAttempts, setMaxAttempts] = useState(5)
  const [attemptWindow, setAttemptWindow] = useState(15)
  const [lockDuration, setLockDuration] = useState(15)
  const [notifyLockouts, setNotifyLockouts] = useState(true)
  const [permissions, setPermissions] = useState(initialPermissions)

  const updatePermission = (area: string, capability: Capability, enabled: boolean) => {
    setPermissions((current) => ({ ...current, [selectedRole]: { ...current[selectedRole], [area]: { ...current[selectedRole][area], [capability]: enabled } } }))
  }

  return <div className="animate-in fade-in duration-300">
    <header className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="mb-2 text-xs font-medium text-slate-400">Workspace / Settings</div><h2 className="text-2xl font-bold tracking-tight text-slate-900">Security settings</h2><p className="mt-1 max-w-2xl text-sm text-slate-500">Configure sign-in protection, role permissions, account recovery, and device backups.</p></div><span className="inline-flex w-fit items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-800"><span className="size-1.5 rounded-full bg-emerald-500" />Session protection connected</span></header>

    <div role="status" className="mb-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-950"><Icons.TriangleAlert className="mt-0.5 size-4 shrink-0" /><p><strong>Some controls are previews only.</strong> Session idle expiry, device revocation, and account security audit records are server-backed. Failed-sign-in policy, MFA, permissions, recovery notifications, and backups are not yet enforced or persisted.</p></div>

    <div role="tablist" aria-label="Security settings sections" className="mb-5 flex gap-1 overflow-x-auto border-b border-slate-200">{(['Protection', 'Permissions', 'Backups & recovery', 'Audit'] as const).map((item) => <button key={item} type="button" role="tab" aria-selected={section === item} onClick={() => setSection(item)} className={`shrink-0 border-b-2 px-3 py-3 text-xs font-semibold ${section === item ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{item}</button>)}</div>

    {section === 'Protection' && <div className="grid gap-5 xl:grid-cols-2">
      <Card title="Failed sign-in protection" detail="Limit repeated password guesses and make recovery auditable." icon="ShieldAlert"><div className="space-y-5"><Toggle checked={lockoutEnabled} onChange={setLockoutEnabled} title="Enable automatic lockout" description="Lock an account after repeated failed sign-in attempts." /><div className={`grid gap-3 sm:grid-cols-3 ${lockoutEnabled ? '' : 'pointer-events-none opacity-45'}`}><NumberField label="Failed attempts" value={maxAttempts} min={3} max={20} suffix="attempts" onChange={setMaxAttempts} /><NumberField label="Attempt window" value={attemptWindow} min={1} max={120} suffix="minutes" onChange={setAttemptWindow} /><NumberField label="Lock duration" value={lockDuration} min={1} max={1440} suffix="minutes" onChange={setLockDuration} /></div><p className="rounded-md bg-slate-50 px-3 py-2.5 text-[10px] leading-4 text-slate-600">Preview defaults: {maxAttempts} attempts in {attemptWindow} minutes, then a {lockDuration}-minute lock. Add progressive delays, recovery, and rate limits in the authentication service.</p><Toggle checked={notifyLockouts} onChange={setNotifyLockouts} title="Notify Super Admins of lockouts" description="Notification delivery and event history require backend integration." /></div></Card>

      <SessionDevicePanel currentUser={currentUser} onCurrentSessionRevoked={onCurrentSessionRevoked} />

      <Card title="Account recovery" detail="Prevent recovery from bypassing sign-in protection." icon="KeyRound"><ul className="space-y-3 text-xs text-slate-600"><li className="flex gap-2"><Icons.Check className="mt-0.5 size-3.5 shrink-0 text-emerald-700" />Verify identity using a registered second factor.</li><li className="flex gap-2"><Icons.Check className="mt-0.5 size-3.5 shrink-0 text-emerald-700" />Notify the user and Super Admin after credential reset.</li><li className="flex gap-2"><Icons.Check className="mt-0.5 size-3.5 shrink-0 text-emerald-700" />Revoke existing sessions after password or MFA recovery.</li><li className="flex gap-2"><Icons.Check className="mt-0.5 size-3.5 shrink-0 text-emerald-700" />Use generic recovery responses to avoid account enumeration.</li></ul><span className="mt-4 inline-flex rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">Policy not applied</span></Card>

      <Card title="Remove accounts" detail="Bulk account removal is guarded to prevent administrative lockout." icon="UserRoundX"><div className="rounded-lg border border-rose-200 bg-rose-50/60 p-4"><div className="flex items-start gap-3"><Icons.ShieldCheck className="mt-0.5 size-4 shrink-0 text-rose-700" /><div><h4 className="text-xs font-bold text-rose-900">Remove all accounts except the active Super Admin</h4><p className="mt-1 text-[10px] leading-4 text-rose-800">Requires recent re-authentication, typed confirmation, session revocation, historical-reference retention, and an audit record.</p></div></div><button type="button" disabled className={`${unavailableButton} mt-4`} title="Requires backend account management and re-authentication"><Icons.Trash2 className="size-4" />Backend required</button></div></Card>
    </div>}

    {section === 'Permissions' && <div className="space-y-5"><Card title="Role permissions" detail="Preview least-privilege access by role and business area. Super Admin protections are fixed." icon="Shield"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><label htmlFor="permission-role" className="text-xs font-semibold text-slate-600">Edit preview for role<select id="permission-role" value={selectedRole} onChange={(event) => setSelectedRole(event.target.value as Role)} className={fieldClass}>{roles.map((role) => <option key={role}>{role}</option>)}</select></label><button type="button" onClick={() => setPermissions((current) => ({ ...current, [selectedRole]: initialPermissions[selectedRole] }))} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"><Icons.RotateCcw className="size-3.5" />Reset preview</button></div><div className="mt-4 flex items-start gap-2 rounded-md bg-sky-50 px-3 py-2.5 text-[10px] leading-4 text-sky-900"><Icons.Info className="mt-0.5 size-3.5 shrink-0" /><p>Checkboxes change only this unsaved preview. Server/API authorization must enforce every permission, including direct requests.</p></div><div className="mt-4 overflow-x-auto rounded-lg border border-slate-200"><table className="w-full min-w-155 text-left text-xs"><thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-400"><tr><th className="px-4 py-3">Business area</th>{capabilities.map((item) => <th key={item} className="px-4 py-3 text-center capitalize">{item}</th>)}</tr></thead><tbody>{areas.map((area) => <tr key={area} className="border-t border-slate-100"><th scope="row" className="px-4 py-3 text-left text-xs font-semibold text-slate-700">{area}</th>{capabilities.map((capability) => <td key={capability} className="px-4 py-3 text-center"><input type="checkbox" aria-label={`${selectedRole} ${capability} ${area}`} checked={permissions[selectedRole][area][capability]} onChange={(event) => updatePermission(area, capability, event.target.checked)} className="size-4 accent-primary" /></td>)}</tr>)}</tbody></table></div><p className="mt-3 text-[10px] text-slate-400">Grant delete access narrowly. Financial records, audit history, and account security require additional controls and retention safeguards.</p></Card><Card title="Sensitive actions" detail="Require fresh authentication and an audit event for high-impact changes." icon="AlertTriangle"><p className="text-xs leading-5 text-slate-600">Recommended for role changes, security-policy updates, sensitive exports, bulk account actions, and backup configuration.</p></Card></div>}

    {section === 'Backups & recovery' && <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]"><Card title="Registered computers" detail="Select whose enrolled computers and approved folders participate in automatic backups." icon="Laptop"><div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/70 px-5 py-10 text-center"><span className="mx-auto grid size-10 place-items-center rounded-lg bg-white text-slate-500 shadow-sm ring-1 ring-slate-200"><Icons.LaptopMinimal className="size-5" /></span><h4 className="mt-3 text-sm font-semibold text-slate-800">No computers enrolled</h4><p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">Install and register a trusted desktop agent on each user’s computer before assigning users or folders to scheduled backups.</p><button type="button" disabled className={`${unavailableButton} mt-4`}><Icons.Download className="size-4" />Desktop agent required</button></div><p className="mt-4 rounded-md bg-sky-50 px-3 py-2.5 text-[10px] leading-4 text-sky-900">Scheduled backups should run when the selected user is logged out. Folder access must be explicitly approved on that computer.</p></Card><div className="space-y-5"><Card title="Backup safeguards" detail="Controls needed before automatic backups are enabled." icon="ShieldCheck"><ul className="space-y-3 text-xs text-slate-600"><li className="flex gap-2"><Icons.LockKeyhole className="size-4 shrink-0 text-slate-400" />Encrypt archives in transit and at rest.</li><li className="flex gap-2"><Icons.Fingerprint className="size-4 shrink-0 text-slate-400" />Verify archive integrity after upload.</li><li className="flex gap-2"><Icons.History className="size-4 shrink-0 text-slate-400" />Define retention and test restoration.</li><li className="flex gap-2"><Icons.BellRing className="size-4 shrink-0 text-slate-400" />Alert on missed runs or agent failures.</li></ul></Card><Card title="Recovery readiness" detail="A successful upload is not enough to prove recoverability." icon="RotateCcw"><div className="flex items-center justify-between gap-3"><span className="text-xs text-slate-500">Last restore test</span><span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">Not recorded</span></div><p className="mt-3 text-[10px] leading-4 text-slate-500">Verify integrity and test restoration before treating an archive as a reliable backup.</p></Card></div></div>}

    {section === 'Audit' && <Card title="Account security audit" detail="Review server-recorded account and session security events. Actor and affected account are shown separately." icon="ScrollText"><AuditLogPanel currentUser={currentUser} /></Card>}

    <footer className="mt-5 flex flex-col gap-2 border-t border-slate-200 pt-4 text-[10px] text-slate-400 sm:flex-row sm:items-center sm:justify-between"><span>Draft control values are not saved or applied.</span><button type="button" disabled className={unavailableButton}><Icons.Save className="size-3.5" />Save requires authentication backend</button></footer>
  </div>
}