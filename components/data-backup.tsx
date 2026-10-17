'use client'

import * as Icons from 'lucide-react'

const disabledAction = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-400 cursor-not-allowed'

export default function DataBackup() {
  return <div className="animate-in fade-in duration-300">
    <header className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <div className="mb-2 text-xs font-medium text-slate-400">Workspace / Inventory Department</div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Data backup</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">Prepare a secure archive from selected folders on this computer.</p>
      </div>
      <span className="inline-flex w-fit items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800"><span className="size-1.5 rounded-full bg-amber-500" />Not configured</span>
    </header>

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
      <div className="min-w-0 space-y-5">
        <section aria-labelledby="backup-sources-title" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <header className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 id="backup-sources-title" className="text-sm font-bold text-slate-900">Source folders</h3>
              <p className="mt-1 text-xs text-slate-500">Choose one or more folder roots to include in an archive.</p>
            </div>
            <button type="button" disabled aria-disabled="true" className={disabledAction} title="Folder access will be available in a later implementation phase"><Icons.FolderPlus className="size-4" />Add folders</button>
          </header>
          <div className="p-5">
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/70 px-5 py-10 text-center">
              <span className="mx-auto grid size-11 place-items-center rounded-lg bg-white text-slate-500 shadow-sm ring-1 ring-slate-200"><Icons.FolderOpen className="size-5" /></span>
              <h4 className="mt-3 text-sm font-semibold text-slate-800">No folders selected</h4>
              <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">Add directories to set the backup scope. Files inside each selected folder and its subfolders will be included.</p>
              <button type="button" disabled aria-disabled="true" className={`${disabledAction} mt-4`}><Icons.FolderPlus className="size-4" />Add folders</button>
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-md bg-sky-50 px-3 py-2.5 text-[11px] leading-4 text-sky-800"><Icons.Info className="mt-0.5 size-3.5 shrink-0" /><p>Folder access will require your permission. This page does not scan your computer until folder selection is implemented.</p></div>
          </div>
        </section>

        <section aria-labelledby="backup-history-title" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div><h3 id="backup-history-title" className="text-sm font-bold text-slate-900">Backup history</h3><p className="mt-1 text-xs text-slate-500">Completed archives will appear here.</p></div>
            <button type="button" disabled aria-label="Refresh backup history" className="grid size-8 place-items-center rounded-md text-slate-300" title="History is not available yet"><Icons.RefreshCw className="size-4" /></button>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full min-w-155 text-left">
              <thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-400"><tr><th className="px-5 py-3">Created</th><th className="px-5 py-3">Sources</th><th className="px-5 py-3">Archive size</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Action</th></tr></thead>
              <tbody><tr><td colSpan={5} className="px-5 py-12 text-center"><span className="mx-auto grid size-9 place-items-center rounded-lg bg-slate-100 text-slate-500"><Icons.Archive className="size-4" /></span><p className="mt-3 text-xs font-semibold text-slate-700">No backups yet</p><p className="mt-1 text-[11px] text-slate-500">Your backup activity will be listed here.</p></td></tr></tbody>
            </table>
          </div>
        </section>
      </div>

      <aside className="min-w-0 space-y-5">
        <section aria-labelledby="backup-summary-title" className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-start justify-between gap-3"><div><h3 id="backup-summary-title" className="text-sm font-bold text-slate-900">Backup scope</h3><p className="mt-1 text-xs text-slate-500">Review what will be included.</p></div><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-primary"><Icons.DatabaseBackup className="size-4" /></span></div>
          <dl className="mt-5 divide-y divide-slate-100 border-y border-slate-100 text-xs">
            <div className="flex items-center justify-between gap-3 py-3"><dt className="text-slate-500">Folder roots</dt><dd className="font-semibold text-slate-800">None selected</dd></div>
            <div className="flex items-center justify-between gap-3 py-3"><dt className="text-slate-500">Subfolders</dt><dd className="font-semibold text-slate-800">Included</dd></div>
            <div className="flex items-center justify-between gap-3 py-3"><dt className="text-slate-500">Files and size</dt><dd className="font-semibold text-slate-400">Not scanned</dd></div>
            <div className="flex items-center justify-between gap-3 py-3"><dt className="text-slate-500">Destination</dt><dd className="font-semibold text-slate-400">Not configured</dd></div>
          </dl>
          <button type="button" disabled aria-disabled="true" className="mt-5 inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground opacity-45" title="Folder selection and secure storage are not implemented yet"><Icons.Archive className="size-4" />Create backup</button>
          <p className="mt-2 text-center text-[10px] text-slate-400">Available after folder access and storage are configured.</p>
        </section>

        <section aria-labelledby="backup-guidance-title" className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 id="backup-guidance-title" className="text-sm font-bold text-slate-900">Before you begin</h3>
          <ul className="mt-3 space-y-3 text-xs leading-5 text-slate-600">
            <li className="flex gap-2.5"><Icons.FolderTree className="mt-0.5 size-4 shrink-0 text-slate-400" /><span>Select each folder you want included; nested folders are covered automatically.</span></li>
            <li className="flex gap-2.5"><Icons.HardDriveUpload className="mt-0.5 size-4 shrink-0 text-slate-400" /><span>A secure backup destination must be configured before archives can be uploaded.</span></li>
            <li className="flex gap-2.5"><Icons.ShieldCheck className="mt-0.5 size-4 shrink-0 text-slate-400" /><span>Folder permissions and backup progress will be shown before files are transferred.</span></li>
          </ul>
        </section>
      </aside>
    </div>
  </div>
}
