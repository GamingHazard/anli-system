'use client'

import { useEffect, useMemo, useState } from 'react'
import { Gift, Save } from 'lucide-react'
import {
  ApiError,
  getSalesBonusSettings,
  updateSalesBonusSettings,
  type SalesBonusSettings,
  type UserAccount,
} from '@/lib/user-api'

const defaults: SalesBonusSettings = {
  enabled: true,
  standard: {
    minimumQuantity: 100,
    maximumQuantity: 999,
    qualifyingQuantity: 100,
    bonusQuantity: 1,
  },
  volume: {
    minimumQuantity: 1000,
    qualifyingQuantity: 1000,
    bonusQuantity: 40,
  },
  version: 1,
  updatedAt: null,
}

export default function GeneralSettings({ currentUser }: { currentUser: UserAccount }) {
  const [settings, setSettings] = useState<SalesBonusSettings>(defaults)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const canEdit = currentUser.roles.some((role) => ['General Manager', 'Super Admin'].includes(role))

  useEffect(() => {
    let mounted = true
    getSalesBonusSettings()
      .then((result) => { if (mounted) setSettings(result.salesBonus) })
      .catch((cause) => { if (mounted) setError(cause instanceof ApiError ? cause.message : 'Could not load sales bonus settings.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  const preview = useMemo(() => {
    const standardBonus = Math.floor(250 / settings.standard.qualifyingQuantity) * settings.standard.bonusQuantity
    const volumeBonus = Math.floor(1500 / settings.volume.qualifyingQuantity) * settings.volume.bonusQuantity
    return { standardBonus, volumeBonus }
  }, [settings])

  const update = async () => {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const result = await updateSalesBonusSettings(settings)
      setSettings(result.salesBonus)
      setMessage('Sales bonus settings saved.')
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not save sales bonus settings.')
    } finally {
      setSaving(false)
    }
  }

  const numberChange = (tier: 'standard' | 'volume', field: 'minimumQuantity' | 'maximumQuantity' | 'qualifyingQuantity' | 'bonusQuantity', value: number) => {
    setSettings((current) => ({
      ...current,
      [tier]: { ...current[tier], [field]: Math.max(0, Math.floor(value || 0)) },
    }))
  }

  return (
    <div className="animate-in fade-in duration-300">
      <header className="mb-6 rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-slate-50 p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Configuration</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">General Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Configure sale-wide promotional quantity rules.</p>
      </header>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex items-start gap-3 border-b border-slate-100 p-4 sm:p-5">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Gift className="size-5" /></span>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Sales bonus</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">Bonus eligibility combines all box packs sold in the same sale. Carton packs do not qualify.</p>
          </div>
        </header>

        <div className="space-y-6 p-4 sm:p-5">
          {loading ? <div className="h-24 animate-pulse rounded-xl bg-slate-100" /> : <>
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
              <input type="checkbox" disabled={!canEdit} checked={settings.enabled} onChange={(event) => setSettings((current) => ({ ...current, enabled: event.target.checked }))} className="mt-0.5 size-4 accent-primary" />
              <span>
                <span className="block text-sm font-semibold text-slate-800">Enable sales bonuses</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">Apply configured free-box rules to qualifying sales.</span>
              </span>
            </label>

            <div className="grid gap-4 lg:grid-cols-2">
              <fieldset className="rounded-xl border border-slate-200 p-4">
                <legend className="px-1 text-xs font-bold text-slate-800">100–999 boxes</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <NumberField label="Every" value={settings.standard.qualifyingQuantity} suffix="boxes" disabled={!canEdit} onChange={(value) => numberChange('standard', 'qualifyingQuantity', value)} />
                  <NumberField label="Free bonus" value={settings.standard.bonusQuantity} suffix="boxes" disabled={!canEdit} onChange={(value) => numberChange('standard', 'bonusQuantity', value)} />
                </div>
                <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">250 boxes preview: <strong>{preview.standardBonus} free boxes</strong>.</p>
              </fieldset>
              <fieldset className="rounded-xl border border-slate-200 p-4">
                <legend className="px-1 text-xs font-bold text-slate-800">1,000+ boxes</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <NumberField label="Every" value={settings.volume.qualifyingQuantity} suffix="boxes" disabled={!canEdit} onChange={(value) => numberChange('volume', 'qualifyingQuantity', value)} />
                  <NumberField label="Free bonus" value={settings.volume.bonusQuantity} suffix="boxes" disabled={!canEdit} onChange={(value) => numberChange('volume', 'bonusQuantity', value)} />
                </div>
                <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">1,500 boxes preview: <strong>{preview.volumeBonus} free boxes</strong>.</p>
              </fieldset>
            </div>

            <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-xs leading-5 text-sky-900">
              A 1,500-box sale uses only one complete 1,000-box interval, while 2,000 boxes uses two intervals and receives twice the configured volume bonus.
            </div>

            {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</p>}
            {message && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{message}</p>}

            <div className="flex justify-end">
              <button type="button" disabled={!canEdit || saving || loading} onClick={() => void update()} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto">
                <Save className="size-4" />
                {saving ? 'Saving…' : 'Save sales bonus'}
              </button>
            </div>
          </>}
        </div>
      </section>
    </div>
  )
}

function NumberField({ label, value, suffix, disabled, onChange }: {
  label: string
  value: number
  suffix: string
  disabled: boolean
  onChange: (value: number) => void
}) {
  return (
    <label className="block text-[11px] font-semibold text-slate-600">
      {label}
      <span className="mt-1.5 flex min-h-11 items-center rounded-lg border border-slate-200 bg-white">
        <input type="number" min={1} value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} className="min-w-0 flex-1 bg-transparent px-3 text-sm font-semibold text-slate-800 outline-none disabled:bg-slate-50" />
        <span className="pr-3 text-[10px] font-normal text-slate-400">{suffix}</span>
      </span>
    </label>
  )
}
