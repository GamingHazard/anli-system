'use client'

import { useEffect, useState } from 'react'
import * as Icons from 'lucide-react'
import type { CompanyProfile } from '@/lib/erp'
import { ApiError, removeCompanyLogo, updateCompanyProfile, uploadCompanyLogo } from '@/lib/user-api'

type Props = {
  profile: CompanyProfile
  canEdit: boolean
  onSave: (profile: CompanyProfile) => void
}

const fieldClass = 'mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-ring/20'
const labelClass = 'block text-xs font-semibold text-slate-600'

type CompanyTextField = Exclude<keyof CompanyProfile, 'logo'>

export default function CompanyProfileManagement({ profile, canEdit, onSave }: Props) {
  const [values, setValues] = useState<CompanyProfile>(profile)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoError, setLogoError] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const hasProfile = Boolean(profile.legalName.trim())
  const isDirty = JSON.stringify(values) !== JSON.stringify(profile)
  const hasChanges = isDirty || Boolean(logoFile)

  useEffect(() => setValues(profile), [profile])
  useEffect(() => {
    if (!logoFile) {
      setLogoPreview(null)
      return
    }
    const previewUrl = URL.createObjectURL(logoFile)
    setLogoPreview(previewUrl)
    return () => URL.revokeObjectURL(previewUrl)
  }, [logoFile])

  const update = (key: CompanyTextField, value: string) => {
    setValues((current) => ({ ...current, [key]: value }))
    setSaveMessage('')
    setErrorMessage('')
  }

  const cancel = () => {
    setValues(profile)
    setLogoFile(null)
    setLogoError('')
    setSaveMessage('')
    setErrorMessage('')
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const legalName = values.legalName.trim()
    if (!legalName) {
      setErrorMessage('Enter the company’s legal name before saving.')
      return
    }
    setSaving(true)
    setSaveMessage('')
    setErrorMessage('')
    const textFields: Omit<CompanyProfile, 'logo'> = {
      legalName: values.legalName.trim(),
      tradingName: values.tradingName.trim(),
      email: values.email.trim(),
      phone: values.phone.trim(),
      website: values.website.trim(),
      addressLine1: values.addressLine1.trim(),
      addressLine2: values.addressLine2.trim(),
      city: values.city.trim(),
      region: values.region.trim(),
      postalCode: values.postalCode.trim(),
      country: values.country.trim(),
      tin: values.tin.trim(),
      registrationNumber: values.registrationNumber.trim(),
      registrationAuthority: values.registrationAuthority.trim(),
    }
    let profileTextSaved = false
    try {
      const result = await updateCompanyProfile(textFields)
      let next = result.profile
      profileTextSaved = true
      onSave(next)
      setValues(next)
      if (logoFile) {
        const logoResult = await uploadCompanyLogo(logoFile)
        next = { ...next, logo: logoResult.logo }
        onSave(next)
        setValues(next)
        setLogoFile(null)
      }
      setSaveMessage('Company profile saved to the server.')
    } catch (cause) {
      const message = cause instanceof ApiError ? cause.message : 'Could not save the company profile.'
      setErrorMessage(profileTextSaved ? `Profile text was saved, but the logo upload failed: ${message}` : message)
    } finally {
      setSaving(false)
    }
  }

  const selectLogo = (file?: File) => {
    setLogoError('')
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setLogoError('Choose a PNG, JPEG, or WebP image.')
      setSaveMessage('')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError('Choose an image smaller than 2 MB.')
      setSaveMessage('')
      return
    }
    setLogoFile(file)
    setSaveMessage('')
    setErrorMessage('')
  }

  const removeLogo = async () => {
    setLogoError('')
    setErrorMessage('')
    setSaving(true)
    try {
      if (logoFile) {
        setLogoFile(null)
        return
      }
      const result = await removeCompanyLogo()
      const next = { ...profile, logo: result.logo }
      onSave(next)
      setValues((current) => ({ ...current, logo: result.logo }))
      setSaveMessage('Company logo removed.')
    } catch (cause) {
      setErrorMessage(cause instanceof ApiError ? cause.message : 'Could not remove the company logo.')
    } finally {
      setSaving(false)
    }
  }

  const field = (key: CompanyTextField, label: string, options: { type?: string; required?: boolean; placeholder?: string; wide?: boolean } = {}) => (
    <label key={key} className={`${labelClass} ${options.wide ? 'sm:col-span-2' : ''}`}>
      {label}{options.required && <span className="ml-1 text-rose-600">*</span>}
      <input
        name={key}
        type={options.type ?? 'text'}
        required={options.required}
        disabled={!canEdit || saving}
        value={values[key]}
        onChange={(event) => update(key, event.target.value)}
        placeholder={options.placeholder}
        autoComplete={key === 'legalName' ? 'organization' : key === 'email' ? 'email' : key === 'phone' ? 'tel' : undefined}
        className={fieldClass}
      />
    </label>
  )

  const displayName = values.tradingName.trim() || values.legalName.trim() || 'Your company name'

  return <div className="animate-in fade-in duration-300">
    <header className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <div className="mb-2 text-xs font-medium text-slate-400">Workspace / Settings</div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Company profile</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">Manage the official business details used across your workspace and company documents.</p>
      </div>
      <span className={`inline-flex w-fit items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-semibold ${hasProfile ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
        <span className={`size-1.5 rounded-full ${hasProfile ? 'bg-emerald-500' : 'bg-amber-500'}`} />{hasProfile ? 'Profile saved' : 'Setup required'}
      </span>
    </header>

    {!canEdit && <p role="status" className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-900">Profile editing is available to Super Admins after the current server profile has loaded.</p>}
    <form onSubmit={submit}>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <section aria-labelledby="company-identity-title" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-4"><h3 id="company-identity-title" className="text-sm font-bold text-slate-900">Company identity</h3><p className="mt-1 text-xs text-slate-500">Enter the registered name and any public-facing trading name.</p></div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {field('legalName', 'Registered legal name', { required: true, placeholder: 'As shown on company registration' })}
              {field('tradingName', 'Trading name', { placeholder: 'Optional name used with customers' })}
              <div className="sm:col-span-2">
                <div className={labelClass}>Company logo <span className="font-normal text-slate-400">Optional</span></div>
                <div className="mt-2 flex flex-col gap-4 rounded-lg border border-slate-200 bg-slate-50/60 p-4 sm:flex-row sm:items-center">
                  <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-lg border border-slate-200 bg-white text-slate-400">
                    {logoPreview || profile.logo.url ? <img src={logoPreview || profile.logo.url} alt="Company logo preview" className="size-full object-contain p-2" /> : <Icons.Building2 className="size-7" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {canEdit && <label className={`inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 ${saving ? 'pointer-events-none opacity-50' : ''}`}><Icons.Upload className="size-3.5" />{logoFile || profile.logo.url ? 'Replace logo' : 'Choose logo'}<input type="file" accept="image/png,image/jpeg,image/webp" aria-label="Choose company logo" disabled={saving} onChange={(event) => { selectLogo(event.target.files?.[0]); event.currentTarget.value = ''; }} className="sr-only" /></label>}
                      {canEdit && (logoFile || profile.logo.url) && <button type="button" disabled={saving} onClick={() => void removeLogo()} className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"><Icons.Trash2 className="size-3.5" />{logoFile ? 'Discard selection' : 'Remove logo'}</button>}
                    </div>
                    <p className="mt-2 text-[11px] leading-4 text-slate-500">PNG, JPG, or WebP · up to 2 MB. Uploaded securely and stored with Cloudinary.</p>
                    {logoFile && <p className="mt-1 truncate text-[10px] text-slate-600">Selected: {logoFile.name}</p>}
                    {logoError && <p role="alert" className="mt-2 text-xs text-rose-700">{logoError}</p>}
                    {errorMessage && <p role="alert" className="mt-2 text-xs text-rose-700">{errorMessage}</p>}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section aria-labelledby="company-contact-title" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-4"><h3 id="company-contact-title" className="text-sm font-bold text-slate-900">Contact details</h3><p className="mt-1 text-xs text-slate-500">Primary contact information for customers, suppliers, and official correspondence.</p></div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {field('email', 'Primary email', { type: 'email', placeholder: 'office@company.com' })}
              {field('phone', 'Primary phone', { type: 'tel', placeholder: '+256 700 000 000' })}
              {field('website', 'Website', { type: 'url', placeholder: 'https://www.company.com', wide: true })}
            </div>
          </section>

          <section aria-labelledby="company-address-title" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-4"><h3 id="company-address-title" className="text-sm font-bold text-slate-900">Registered address</h3><p className="mt-1 text-xs text-slate-500">Use the official registered location for business records.</p></div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {field('addressLine1', 'Address line 1', { placeholder: 'Building, street, or plot', wide: true })}
              {field('addressLine2', 'Address line 2', { placeholder: 'Suite, floor, or area', wide: true })}
              {field('city', 'City / district', { placeholder: 'City or district' })}
              {field('region', 'Region / state', { placeholder: 'Region or state' })}
              {field('postalCode', 'Postal code', { placeholder: 'Optional' })}
              {field('country', 'Country', { placeholder: 'Country' })}
            </div>
          </section>

          <section aria-labelledby="company-legal-title" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-4"><h3 id="company-legal-title" className="text-sm font-bold text-slate-900">Legal and tax details</h3><p className="mt-1 text-xs text-slate-500">Registration identifiers are stored as provided; jurisdiction-specific verification is not connected.</p></div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {field('tin', 'Tax identification number (TIN)', { placeholder: 'Enter TIN' })}
              {field('registrationNumber', 'Company registration number', { placeholder: 'Enter registration number' })}
              {field('registrationAuthority', 'Registration authority', { placeholder: 'Optional authority or jurisdiction', wide: true })}
            </div>
          </section>
        </div>

        <aside className="min-w-0 space-y-5 xl:sticky xl:top-24 xl:self-start">
          <section aria-labelledby="company-preview-title" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-4"><h3 id="company-preview-title" className="text-sm font-bold text-slate-900">Identity preview</h3><p className="mt-1 text-xs text-slate-500">Preview updates as you edit.</p></div>
            <div className="p-5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-slate-400">{logoPreview || profile.logo.url ? <img src={logoPreview || profile.logo.url} alt="" className="size-full object-contain p-1" /> : <Icons.Building2 className="size-5" />}</span>
                <div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900">{displayName}</p><p className="mt-1 truncate text-[11px] text-slate-500">{values.legalName.trim() || 'Registered company name'}</p></div>
              </div>
              <dl className="mt-5 divide-y divide-slate-100 border-y border-slate-100 text-xs">
                <div className="flex items-center gap-3 py-3"><Icons.Mail className="size-3.5 shrink-0 text-slate-400" /><dt className="sr-only">Email</dt><dd className="min-w-0 truncate text-slate-600">{values.email || 'Email not added'}</dd></div>
                <div className="flex items-center gap-3 py-3"><Icons.Phone className="size-3.5 shrink-0 text-slate-400" /><dt className="sr-only">Phone</dt><dd className="min-w-0 truncate text-slate-600">{values.phone || 'Phone not added'}</dd></div>
                <div className="flex items-start gap-3 py-3"><Icons.MapPin className="mt-0.5 size-3.5 shrink-0 text-slate-400" /><dt className="sr-only">Address</dt><dd className="min-w-0 break-words text-slate-600">{[values.addressLine1, values.city, values.region, values.country].filter(Boolean).join(', ') || 'Address not added'}</dd></div>
              </dl>
              <div className="mt-4 flex items-start gap-2 rounded-md bg-sky-50 px-3 py-2.5 text-[11px] leading-4 text-sky-800"><Icons.Info className="mt-0.5 size-3.5 shrink-0" /><p>Company profile is shared from the server. Changes to branding apply to current workspace views; issued documents keep their original details.</p></div>
            </div>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-bold text-slate-900">Profile checklist</h3>
            <ul className="mt-3 space-y-2.5 text-xs">
              {[
                ['Registered name', Boolean(values.legalName.trim())],
                ['Contact email', Boolean(values.email.trim())],
                ['Phone number', Boolean(values.phone.trim())],
                ['Registered address', Boolean(values.addressLine1.trim() && values.country.trim())],
                ['Tax and registration IDs', Boolean(values.tin.trim() || values.registrationNumber.trim())],
              ].map(([label, complete]) => <li key={String(label)} className="flex items-center gap-2"><span className={`grid size-4 shrink-0 place-items-center rounded-full ${complete ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>{complete ? <Icons.Check className="size-2.5" /> : <span className="size-1 rounded-full bg-current" />}</span><span className={complete ? 'text-slate-700' : 'text-slate-500'}>{label}</span><span className="ml-auto text-[10px] text-slate-400">{complete ? 'Added' : 'Not added'}</span></li>)}
            </ul>
          </section>
        </aside>
      </div>

      {canEdit && <footer className="sticky bottom-0 z-10 mt-5 flex flex-col gap-3 border-t border-slate-200 bg-[#f7f8fc]/95 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="min-h-5 text-xs" aria-live="polite">{saveMessage && <span className="text-emerald-700">{saveMessage}</span>}{errorMessage && <span role="alert" className="text-rose-700">{errorMessage}</span>}</div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={cancel} disabled={saving || (!isDirty && !logoFile && !logoError)} className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Cancel</button>
          <button type="submit" disabled={saving || !hasChanges} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-45"><Icons.Save className="size-4" />{saving ? 'Saving…' : 'Save changes'}</button>
        </div>
      </footer>}
    </form>
  </div>
}
