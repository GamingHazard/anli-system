'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as Icons from 'lucide-react'
import { createId, exportCsv, formatDate } from '@/lib/erp'
import {
  adjustFinishedStock,
  createProductionProduct,
  listFinishedStockMovements,
  listProductionMaterials,
  listProductionProducts,
  listProductionRuns,
  postProductionRun,
  receiveFinishedStock,
  updateProductionProduct,
  updateProductionRecipe,
  type ProductionMaterial,
  type ProductionProduct,
  type ProductionRunRecord,
} from '@/lib/user-api'

type View = 'Daily production' | 'Products' | 'Finished stock' | 'Production history'
type IngredientDraft = { materialId: string; quantityPerTank: string }

const productPackSizes = ['150 ml', '180 ml', '200 ml', '250 ml', '300 ml', '350 ml', '500 ml']
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const queryKey = ['production-workspace']
const inputClass = 'mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 disabled:bg-slate-50 disabled:text-slate-400'

function messageFor(error: unknown) {
  return error instanceof Error ? error.message : 'The request could not be completed.'
}

function stockLabel(product: ProductionProduct) {
  const availablePieces = product.availablePieces ?? Math.max(0, product.balancePieces - (product.reservedPieces ?? 0))
  const reservedPieces = product.reservedPieces ?? 0
  if (!product.piecesPerPack) return `${product.balancePieces.toLocaleString()} on hand · ${reservedPieces.toLocaleString()} reserved · ${availablePieces.toLocaleString()} available pieces`
  const packs = Math.floor(product.balancePieces / product.piecesPerPack)
  const loose = product.balancePieces % product.piecesPerPack
  return `${product.balancePieces.toLocaleString()} pcs on hand · ${packs} ${product.packType?.toLowerCase() ?? 'packs'}${loose ? ` + ${loose} loose` : ''} · ${reservedPieces.toLocaleString()} reserved · ${availablePieces.toLocaleString()} available`
}

function Metric({ label, value, detail, icon, tone }: { label: string; value: string; detail: string; icon: string; tone: 'purple' | 'blue' | 'amber' | 'rose' }) {
  const Icon = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[icon] ?? Icons.Factory
  const color = tone === 'purple' ? 'bg-secondary text-primary' : tone === 'blue' ? 'bg-sky-50 text-sky-700' : tone === 'amber' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
  return <article className="rounded-lg border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><span className={`grid size-9 place-items-center rounded-md ${color}`}><Icon className="size-4" /></span><span className="text-[9px] font-semibold uppercase text-slate-400">Live</span></div><div className="mt-3 text-xl font-bold tracking-tight">{value}</div><h3 className="mt-0.5 text-xs font-semibold text-slate-700">{label}</h3><p className="mt-1 text-[10px] text-slate-500">{detail}</p></article>
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={`block text-xs font-semibold text-slate-600 ${wide ? 'sm:col-span-2' : ''}`}>{label}{children}</label>
}

export default function ProductionManagement() {
  const client = useQueryClient()
  const [view, setView] = useState<View>('Daily production')
  const [search, setSearch] = useState('')
  const [productFilter, setProductFilter] = useState('All products')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showProductForm, setShowProductForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductionProduct | null>(null)
  const [selectedRun, setSelectedRun] = useState<ProductionRunRecord | null>(null)
  const [message, setMessage] = useState('')

  const workspace = useQuery({
    queryKey,
    queryFn: async () => {
      const [productsResult, materialsResult, runsResult, movementsResult] = await Promise.all([
        listProductionProducts(),
        listProductionMaterials(),
        listProductionRuns(),
        listFinishedStockMovements(),
      ])
      return {
        products: productsResult.products,
        materials: materialsResult.materials,
        runs: runsResult.runs,
        movements: movementsResult.movements,
      }
    },
  })
  const products = workspace.data?.products ?? []
  const materials = workspace.data?.materials ?? []
  const runs = workspace.data?.runs ?? []
  const movements = workspace.data?.movements ?? []
  const todayRuns = runs.filter((run) => run.productionDate === today())
  const todayProduced = todayRuns.reduce((total, run) => total + run.producedQuantityPieces, 0)
  const todaySales = movements
    .filter((movement) => movement.date === today() && movement.type === 'Sales dispatch')
    .reduce((total, movement) => total + movement.quantityPieces, 0)
  const todayDamage = todayRuns.reduce((total, run) => total + run.damagedQuantityPieces, 0)
  const totalStock = products.reduce((total, product) => total + product.balancePieces, 0)

  const visibleProducts = useMemo(() => products.filter((product) =>
    `${product.code} ${product.name} ${product.category} ${product.flavour} ${product.unit}`.toLowerCase().includes(search.trim().toLowerCase()),
  ), [products, search])
  const visibleRuns = useMemo(() => runs.filter((run) =>
    `${run.reference} ${run.productName}`.toLowerCase().includes(search.trim().toLowerCase())
      && (productFilter === 'All products' || run.productId === productFilter)
      && (!dateFrom || run.productionDate >= dateFrom)
      && (!dateTo || run.productionDate <= dateTo),
  ), [runs, search, productFilter, dateFrom, dateTo])
  const visibleMovements = useMemo(() => movements.filter((movement) =>
    `${movement.reference} ${movement.productName} ${movement.reason} ${movement.type}`.toLowerCase().includes(search.trim().toLowerCase())
      && (productFilter === 'All products' || movement.productId === productFilter)
      && (!dateFrom || movement.date >= dateFrom)
      && (!dateTo || movement.date <= dateTo),
  ), [movements, search, productFilter, dateFrom, dateTo])

  const refresh = () => client.invalidateQueries({ queryKey })
  const runMutation = useMutation({
    mutationFn: postProductionRun,
    onSuccess: async ({ run }) => {
      setMessage(`${run.reference} posted: ${run.producedQuantityPieces.toLocaleString()} pieces produced.`)
      await refresh()
    },
    onError: (error) => setMessage(messageFor(error)),
  })
  const finishedReceiptMutation = useMutation({
    mutationFn: receiveFinishedStock,
    onSuccess: async ({ movement }) => {
      setMessage(`Stock receipt posted for ${movement.productName}.`)
      await refresh()
    },
    onError: (error) => setMessage(messageFor(error)),
  })
  const adjustmentMutation = useMutation({
    mutationFn: adjustFinishedStock,
    onSuccess: async ({ movement }) => {
      setMessage(`${movement.type} posted for ${movement.productName}.`)
      await refresh()
    },
    onError: (error) => setMessage(messageFor(error)),
  })
  const productMutation = useMutation({
    mutationFn: async ({ id, input, ingredients }: { id?: string; input: Parameters<typeof createProductionProduct>[0]; ingredients: Parameters<typeof updateProductionRecipe>[1] }) => {
      if (!id) return createProductionProduct(input)
      return updateProductionProduct(id, {
        code: input.code,
        name: input.name,
        category: input.category,
        unit: input.unit,
        flavour: input.flavour,
        price: input.price,
        packType: input.packType ?? '',
        piecesPerPack: input.packType ? input.piecesPerPack : null,
        packWeightKg: input.packType ? input.packWeightKg : null,
        recipeRequired: input.recipeRequired,
        ingredients,
      })
    },
    onSuccess: async ({ product }) => {
      setMessage(`${product.name} saved.`)
      setShowProductForm(false)
      setEditingProduct(null)
      await refresh()
    },
    onError: (error) => setMessage(messageFor(error)),
  })

  const submitProduction = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setMessage('')
    runMutation.mutate({
      productId: String(form.get('productId')),
      productionDate: String(form.get('productionDate')),
      openingStockPieces: Number(form.get('openingStockPieces')),
      damagedQuantityPieces: Number(form.get('damagedQuantityPieces')),
      closingStockPieces: Number(form.get('closingStockPieces')),
      damageReason: String(form.get('damageReason') || ''),
      idempotencyKey: createId('RUN'),
    })
  }

  const submitFinishedMovement = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const productId = String(form.get('productId'))
    const movementKind = String(form.get('movementKind'))
    const input = {
      productId,
      quantityPieces: Number(form.get('quantityPieces')),
      date: String(form.get('date')),
      reason: String(form.get('reason')).trim(),
      reference: String(form.get('reference') || '').trim() || undefined,
      idempotencyKey: createId('FG'),
    }
    setMessage('')
    if (movementKind === 'receipt') finishedReceiptMutation.mutate(input)
    else adjustmentMutation.mutate({ ...input, direction: movementKind === 'adjustment-in' ? 'in' : 'out' })
  }

  const saveProduct = (input: Parameters<typeof createProductionProduct>[0], ingredients: Parameters<typeof updateProductionRecipe>[1]) => {
    setMessage('')
    productMutation.mutate({ id: editingProduct?.id, input: { ...input, ingredients }, ingredients })
  }

  const exportCurrent = () => {
    if (view === 'Products') exportCsv('finished-products.csv', visibleProducts.map((product) => ({
      code: product.code, product: product.name, category: product.category, flavour: product.flavour, unit: product.unit,
      packType: product.packType ?? '', piecesPerPack: product.piecesPerPack ?? '', packWeightKg: product.packWeightKg ?? '',
      balancePieces: product.balancePieces, status: product.active ? 'Active' : 'Inactive',
      reservedPieces: product.reservedPieces ?? 0,
      availablePieces: product.availablePieces ?? Math.max(0, product.balancePieces - (product.reservedPieces ?? 0)),
    })))
    else if (view === 'Finished stock') exportCsv('finished-stock-movements.csv', visibleMovements)
    else exportCsv('production-history.csv', visibleRuns.map((run) => ({
      date: run.productionDate, reference: run.reference, product: run.productName, openingPieces: run.openingStockPieces,
      legacySalesPieces: run.salesQuantityPieces, damagedPieces: run.damagedQuantityPieces, closingPieces: run.closingStockPieces,
      producedPieces: run.producedQuantityPieces, recipeVersion: run.recipeVersion ?? '', actor: run.createdAt,
    })))
  }

  if (workspace.isLoading) return <section className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Loading production workspace…</section>
  if (workspace.isError) return <section className="rounded-xl border border-rose-200 bg-rose-50 p-6"><h2 className="font-semibold text-rose-800">Production data could not be loaded</h2><p className="mt-2 text-sm text-rose-700">{messageFor(workspace.error)}</p><button type="button" onClick={() => workspace.refetch()} className="mt-3 rounded-lg border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-800">Retry</button></section>

  return <div className="animate-in fade-in duration-300">
    <header className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="mb-2 text-xs font-medium text-slate-400">Workspace / Inventory Department</div><h2 className="text-2xl font-bold tracking-tight">Production management</h2><p className="mt-1 text-sm text-slate-500">Products, recipes, production, and finished-goods stock.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={exportCurrent} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700"><Icons.Download className="size-4" /> Export</button><button type="button" onClick={() => { setEditingProduct(null); setShowProductForm(true); setMessage('') }} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-700"><Icons.PackagePlus className="size-4" /> Add product</button></div></header>

    <section aria-label="Production summary" className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Produced today" value={todayProduced.toLocaleString()} detail={`${todayRuns.length} production records`} icon="Factory" tone="purple" />
      <Metric label="Finished stock on hand" value={totalStock.toLocaleString()} detail="Sellable pieces across active products" icon="PackageCheck" tone="blue" />
      <Metric label="Sales dispatched today" value={todaySales.toLocaleString()} detail="Posted by confirmed sales" icon="Truck" tone="amber" />
      <Metric label="Damage today" value={todayDamage.toLocaleString()} detail="Recorded write-offs" icon="PackageX" tone="rose" />
    </section>

    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div role="tablist" aria-label="Production views" className="flex gap-1 overflow-x-auto border-b border-slate-200 px-4 pt-2">{(['Daily production', 'Products', 'Finished stock', 'Production history'] as View[]).map((item) => <button key={item} type="button" role="tab" aria-selected={view === item} onClick={() => setView(item)} className={`shrink-0 border-b-2 px-3 py-3 text-xs font-semibold ${view === item ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{item}</button>)}</div>
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 xl:flex-row xl:items-center xl:justify-between"><div><h3 className="text-sm font-bold">{view}</h3><p className="mt-1 text-xs text-slate-500">{view === 'Daily production' ? 'Record finished-goods counts here; raw-material use is recorded separately in Raw Material Management.' : view === 'Products' ? `${visibleProducts.length} finished products` : view === 'Finished stock' ? `${visibleMovements.length} movements` : `${visibleRuns.length} daily production records`}</p></div><div className="flex flex-wrap gap-2"><label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><Icons.Search className="size-4 text-slate-400" /><input aria-label={`Search ${view.toLowerCase()}`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products or references" className="w-44 bg-transparent text-xs outline-none" /></label>{view !== 'Products' && view !== 'Daily production' && <><select aria-label="Filter by product" value={productFilter} onChange={(event) => setProductFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><option>All products</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select><input aria-label="From date" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="rounded-lg border border-slate-200 px-2 py-2 text-xs" /><input aria-label="To date" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="rounded-lg border border-slate-200 px-2 py-2 text-xs" /></>}</div></div>

      {view === 'Daily production' && <DailyProductionForm products={products.filter((product) => product.active)} runs={runs} onSubmit={submitProduction} disabled={runMutation.isPending} />}
      {view === 'Products' && <ProductTable products={visibleProducts} onEdit={(product) => { setEditingProduct(product); setShowProductForm(true); setMessage('') }} onToggle={async (product) => {
        try {
          await updateProductionProduct(product.id, { active: !product.active })
          setMessage(`${product.name} ${product.active ? 'deactivated' : 'activated'}.`)
          await refresh()
        } catch (error) { setMessage(messageFor(error)) }
      }} />}
      {view === 'Finished stock' && <FinishedStockView products={products.filter((product) => product.active)} movements={visibleMovements} onSubmit={submitFinishedMovement} disabled={finishedReceiptMutation.isPending || adjustmentMutation.isPending} />}
      {view === 'Production history' && <ProductionHistory runs={visibleRuns} onSelect={setSelectedRun} />}

      {message && <p role="status" className="border-t border-slate-100 bg-amber-50 px-4 py-3 text-xs text-amber-800">{message}</p>}
      <footer className="border-t border-slate-100 px-4 py-3 text-[10px] text-slate-400">Sales dispatches are posted by confirmed sales. Daily production records calculate production from opening stock, damage, and physical closing stock; legacy sales entries remain visible in history.</footer>
    </section>

    {showProductForm && <ProductDialog key={editingProduct?.id ?? 'new'} product={editingProduct} materials={materials} message={message} onClose={() => { setShowProductForm(false); setEditingProduct(null) }} onSave={saveProduct} disabled={productMutation.isPending} />}
    {selectedRun && <ProductionRunDetails run={selectedRun} onClose={() => setSelectedRun(null)} />}
  </div>
}

function DailyProductionForm({ products, runs, onSubmit, disabled }: { products: ProductionProduct[]; runs: ProductionRunRecord[]; onSubmit: (event: FormEvent<HTMLFormElement>) => void; disabled: boolean }) {
  const [productId, setProductId] = useState(products[0]?.id ?? '')
  const [date, setDate] = useState(today())
  const [damage, setDamage] = useState('0')
  const [closing, setClosing] = useState('0')
  const [damageReason, setDamageReason] = useState('')
  const product = products.find((item) => item.id === productId)
  const opening = product?.balancePieces ?? 0
  const produced = Number(closing) + Number(damage) - opening
  const duplicate = runs.some((run) => run.productId === productId && run.productionDate === date)
  const invalidCount = [opening, Number(damage), Number(closing), produced].some((value) => !Number.isFinite(value) || value < 0)
  const blocked = !product || invalidCount || duplicate || (Number(damage) > 0 && !damageReason.trim()) || (product.recipeRequired && !product.recipe)

  return <form onSubmit={onSubmit} className="p-4">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <Field label="Production date"><input required name="productionDate" type="date" value={date} onChange={(event) => setDate(event.target.value)} className={inputClass} /></Field>
      <Field label="Product"><select required name="productId" value={productId} onChange={(event) => setProductId(event.target.value)} className={inputClass}><option value="">Select product</option>{products.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}</select></Field>
      <Field label="Current opening stock (pieces)"><input name="openingStockPieces" type="number" value={opening} readOnly className={`${inputClass} bg-slate-50`} /><span className="mt-1 block text-[10px] font-normal text-slate-400">{product ? stockLabel(product) : 'Select a product'}</span></Field>
      {product?.packType && <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs"><div className="font-semibold">{product.packType}: {product.piecesPerPack} pieces</div><div className="mt-1 text-slate-500">{product.packWeightKg} kg net product weight per pack</div></div>}
      <Field label="Damaged / written off (pieces)"><input required name="damagedQuantityPieces" type="number" min="0" step="1" value={damage} onChange={(event) => setDamage(event.target.value)} className={inputClass} /></Field>
      <Field label="Damage reason"><input name="damageReason" required={Number(damage) > 0} value={damageReason} onChange={(event) => setDamageReason(event.target.value)} className={inputClass} /></Field>
      <Field label="Physical closing stock (pieces)"><input required name="closingStockPieces" type="number" min="0" step="1" value={closing} onChange={(event) => setClosing(event.target.value)} className={inputClass} /></Field>
      <div className="rounded-lg border border-primary/20 bg-secondary/50 p-3"><div className="text-[10px] font-semibold uppercase text-secondary-foreground">Calculated production</div><div className="mt-1 text-lg font-bold text-primary">{Number.isFinite(produced) ? produced.toLocaleString() : '—'} pieces</div><p className="mt-1 text-[10px] text-slate-600">Closing + damage − opening. Sales are dispatched from Sales.</p></div>
    </div>
    {product?.recipe && <p className="mt-3 text-xs text-slate-500">This product recipe is measured per 1,000-litre tank. Record the number of tanks made in Raw Material Management to calculate and deduct ingredient use.</p>}
    {product?.recipeRequired && !product.recipe && <p role="alert" className="mt-3 text-xs text-rose-700">This product requires a recipe before production can be posted.</p>}
    {duplicate && <p role="alert" className="mt-3 text-xs text-rose-700">A daily production record already exists for this product and date.</p>}
    <button type="submit" disabled={disabled || blocked} className="mt-4 rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40">{disabled ? 'Posting…' : 'Post daily production'}</button>
  </form>
}

function ProductTable({ products, onEdit, onToggle }: { products: ProductionProduct[]; onEdit: (product: ProductionProduct) => void; onToggle: (product: ProductionProduct) => void }) {
  if (!products.length) return <EmptyState title="No finished products" detail="Add a product profile, packaging details, and its recipe composition." />
  return <div className="overflow-x-auto"><table className="w-full min-w-220 text-left text-xs"><thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-400"><tr>{['Code', 'Product', 'Category', 'Flavour', 'Unit', 'Outer pack', 'Price / pack', 'On hand / available', 'Recipe', 'Status', ''].map((label) => <th key={label} className="px-3 py-3">{label}</th>)}</tr></thead><tbody>{products.map((product) => <tr key={product.id} className="border-t border-slate-100 text-slate-600"><td className="px-3 py-3 font-mono font-semibold">{product.code}</td><td className="px-3 py-3 font-semibold text-slate-800">{product.name}</td><td className="px-3 py-3">{product.category}</td><td className="px-3 py-3">{product.flavour}</td><td className="px-3 py-3">{product.unit}</td><td className="px-3 py-3">{product.packType ? `${product.packType}: ${product.piecesPerPack} pcs · ${product.packWeightKg} kg` : '—'}</td><td className="px-3 py-3 font-semibold">{product.price ? new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(product.price) : 'Set price'}</td><td className="px-3 py-3 font-semibold">{stockLabel(product)}</td><td className="px-3 py-3">{product.recipe ? `${product.recipe.ingredients.length} ingredients · v${product.recipe.version}` : product.recipeRequired ? <span className="text-rose-700">Required</span> : 'Not set'}</td><td className="px-3 py-3">{product.active ? 'Active' : 'Inactive'}</td><td className="px-3 py-3"><div className="flex gap-1"><button type="button" onClick={() => onEdit(product)} className="rounded-md border border-slate-200 px-2 py-1.5 font-semibold">Edit</button><button type="button" onClick={() => onToggle(product)} className="rounded-md border border-slate-200 px-2 py-1.5">{product.active ? 'Deactivate' : 'Activate'}</button></div></td></tr>)}</tbody></table></div>
}

function ProductDialog({ product, materials, message, onClose, onSave, disabled }: { product: ProductionProduct | null; materials: ProductionMaterial[]; message: string; onClose: () => void; onSave: (input: Parameters<typeof createProductionProduct>[0], ingredients: Parameters<typeof updateProductionRecipe>[1]) => void; disabled: boolean }) {
  const initialIngredients = product?.recipe?.ingredients.map((ingredient) => ({
    materialId: ingredient.materialId,
    quantityPerTank: String(ingredient.quantityPerTank),
  })) ?? []
  const [ingredients, setIngredients] = useState<IngredientDraft[]>(initialIngredients)
  const [recipeRequired, setRecipeRequired] = useState(product?.recipeRequired ?? false)
  const [packType, setPackType] = useState<'' | 'Box' | 'Carton'>(product?.packType ?? '')

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const submittedPackType = String(form.get('packType') || '') as '' | 'Box' | 'Carton'
    const validIngredients = ingredients
      .filter((ingredient) => ingredient.materialId && Number(ingredient.quantityPerTank) > 0)
      .map((ingredient) => ({ materialId: ingredient.materialId, quantityPerTank: Number(ingredient.quantityPerTank) }))
    onSave({
      code: String(form.get('code')).trim(),
      name: String(form.get('name')).trim(),
      category: String(form.get('category')) as 'Cup' | 'Bottle',
      unit: String(form.get('unit')),
      flavour: String(form.get('flavour')) as 'Mango' | 'Pineapple milk',
      price: Number(form.get('price')),
      packType: submittedPackType || undefined,
      piecesPerPack: submittedPackType ? Number(form.get('piecesPerPack')) : undefined,
      packWeightKg: submittedPackType ? Number(form.get('packWeightKg')) : undefined,
      recipeRequired,
      ingredients: validIngredients,
    }, validIngredients)
  }

  return <div className="fixed inset-0 z-80 grid place-items-center bg-slate-950/45 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget && !disabled) onClose() }}>
    <section role="dialog" aria-modal="true" aria-labelledby="product-dialog-title" className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white shadow-2xl">
      <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 id="product-dialog-title" className="text-base font-bold">{product ? 'Edit finished product' : 'Add finished product'}</h2><p className="mt-1 text-xs text-slate-500">Product details, outer packaging, and product-specific recipe composition.</p></div><button type="button" aria-label="Close product form" onClick={onClose} disabled={disabled} className="grid size-8 place-items-center rounded-md text-slate-400"><Icons.X className="size-4" /></button></header>
      <form onSubmit={submit} className="space-y-5 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Product code"><input required name="code" defaultValue={product?.code} className={inputClass} /></Field>
          <Field label="Product name"><input required name="name" defaultValue={product?.name} className={inputClass} /></Field>
          <Field label="Category"><select required name="category" defaultValue={product?.category ?? 'Cup'} className={inputClass}><option value="Cup">Cup</option><option value="Bottle">Bottle</option></select></Field>
          <Field label="Unit / pack size (ml)"><select required name="unit" defaultValue={product?.unit ?? '150 ml'} className={inputClass}>{productPackSizes.map((size) => <option key={size}>{size}</option>)}</select></Field>
          <Field label="Flavour"><select required name="flavour" defaultValue={product?.flavour ?? 'Mango'} className={inputClass}><option value="Mango">Mango</option><option value="Pineapple milk">Pineapple milk</option></select></Field>
          <Field label="Outer pack type"><select name="packType" value={packType} onChange={(event) => setPackType(event.target.value as '' | 'Box' | 'Carton')} className={inputClass}><option value="">Not specified</option><option value="Box">Box</option><option value="Carton">Carton</option></select></Field>
          <Field label="Pieces per box/carton"><input name="piecesPerPack" type="number" min="1" step="1" required={Boolean(packType)} disabled={!packType} defaultValue={product?.piecesPerPack} className={inputClass} placeholder="e.g. 24" /></Field>
          <Field label="Net product weight per box/carton (kg)"><input name="packWeightKg" type="number" min="0.001" step="any" required={Boolean(packType)} disabled={!packType} defaultValue={product?.packWeightKg} className={inputClass} placeholder="e.g. 4.8" /></Field>
          <Field label="Selling price per box/carton (UGX)"><input required name="price" type="number" min="1" step="1" defaultValue={product?.price} className={inputClass} placeholder="e.g. 24000" /><span className="mt-1 block text-[10px] font-normal text-slate-400">Sales uses this whole-UGX catalog price per outer pack.</span></Field>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 sm:col-span-2"><input type="checkbox" checked={recipeRequired} onChange={(event) => setRecipeRequired(event.target.checked)} className="size-4 accent-primary" /> Production requires a recipe</label>
        </div>
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-bold">Product recipe</h3><p className="mt-1 text-[10px] text-slate-500">Set the amount of each shared raw material needed for one 1,000-litre tank. Manage the catalog and stock in Raw Material Management.</p></div><button type="button" onClick={() => setIngredients((current) => [...current, { materialId: '', quantityPerTank: '' }])} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-[10px] font-semibold"><Icons.Plus className="size-3.5" /> Add ingredient</button></div>
          {ingredients.map((ingredient, index) => <div key={`${index}-${ingredient.materialId}`} className="grid items-end gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1.2fr_1fr_32px]">
            <Field label="Shared raw material"><select required value={ingredient.materialId} onChange={(event) => setIngredients((current) => current.map((item, i) => i === index ? { ...item, materialId: event.target.value } : item))} className={inputClass}><option value="">Select a material</option>{materials.filter((material) => material.active).map((material) => <option key={material.id} value={material.id}>{material.name} ({material.unit}) · {material.balance} available</option>)}</select></Field>
            <Field label={`Quantity per 1,000-litre tank (${materials.find((material) => material.id === ingredient.materialId)?.unit ?? 'unit'})`}><input required type="number" min="0.000001" step="any" value={ingredient.quantityPerTank} onChange={(event) => setIngredients((current) => current.map((item, i) => i === index ? { ...item, quantityPerTank: event.target.value } : item))} className={inputClass} /></Field>
            <button type="button" aria-label={`Remove ingredient ${index + 1}`} onClick={() => setIngredients((current) => current.filter((_, i) => i !== index))} className="grid size-8 place-items-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-700"><Icons.Trash2 className="size-4" /></button>
          </div>)}
        </section>
        {message && <p role="alert" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{message}</p>}
        <footer className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={onClose} disabled={disabled} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold">Cancel</button><button type="submit" disabled={disabled || (recipeRequired && !ingredients.length)} className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40">{disabled ? 'Saving…' : 'Save product'}</button></footer>
      </form>
    </section>
  </div>
}

function FinishedStockView({ products, movements, onSubmit, disabled }: { products: ProductionProduct[]; movements: Awaited<ReturnType<typeof listFinishedStockMovements>>['movements']; onSubmit: (event: FormEvent<HTMLFormElement>) => void; disabled: boolean }) {
  return <div className="space-y-5 p-4">
    <form onSubmit={onSubmit} className="grid items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2 xl:grid-cols-6">
      <Field label="Product"><select required name="productId" className={inputClass}><option value="">Select product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} ({stockLabel(product)})</option>)}</select></Field>
      <Field label="Movement"><select name="movementKind" className={inputClass}><option value="receipt">Stock in / receipt</option><option value="adjustment-in">Adjustment increase</option><option value="adjustment-out">Adjustment decrease</option></select></Field>
      <Field label="Quantity (pieces)"><input required name="quantityPieces" type="number" min="1" step="1" className={inputClass} /></Field>
      <Field label="Date"><input required name="date" type="date" defaultValue={today()} className={inputClass} /></Field>
      <Field label="Reason"><input required name="reason" className={inputClass} placeholder="Receipt or adjustment reason" /></Field>
      <button type="submit" disabled={disabled} className="rounded-lg bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-40">Post movement</button>
    </form>
    {!movements.length ? <EmptyState title="No finished-stock movements" detail="Production, receipts, sales dispatches, damage, and adjustments appear here." /> : <div className="overflow-x-auto"><table className="w-full min-w-180 text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase text-slate-400"><tr>{['Date', 'Product', 'Movement', 'Quantity', 'Reason', 'Reference'].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{movements.map((movement) => <tr key={movement.id} className="border-t border-slate-100 text-slate-600"><td className="px-4 py-3">{formatDate(movement.date)}</td><td className="px-4 py-3 font-semibold">{movement.productName}</td><td className="px-4 py-3">{movement.type}</td><td className={`px-4 py-3 font-semibold ${movement.direction === 'in' ? 'text-emerald-700' : 'text-rose-700'}`}>{movement.direction === 'in' ? '+' : '−'}{movement.quantityPieces.toLocaleString()} pcs</td><td className="px-4 py-3">{movement.reason || '—'}</td><td className="px-4 py-3">{movement.reference}</td></tr>)}</tbody></table></div>}
  </div>
}

function ProductionHistory({ runs, onSelect }: { runs: ProductionRunRecord[]; onSelect: (run: ProductionRunRecord) => void }) {
  if (!runs.length) return <EmptyState title="No production records" detail="Post a daily production record to see it here." />
  return <div className="overflow-x-auto"><table className="w-full min-w-220 text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase text-slate-400"><tr>{['Date', 'Product', 'Opening', 'Legacy sales', 'Damage', 'Closing', 'Produced', 'Recipe', 'Reference', ''].map((label) => <th key={label} className="px-3 py-3">{label}</th>)}</tr></thead><tbody>{runs.map((run) => <tr key={run.id} className="border-t border-slate-100 text-slate-600"><td className="px-3 py-3">{formatDate(run.productionDate)}</td><td className="px-3 py-3 font-semibold">{run.productName}</td><td className="px-3 py-3">{run.openingStockPieces.toLocaleString()} pcs</td><td className="px-3 py-3">{run.salesQuantityPieces.toLocaleString()} pcs</td><td className="px-3 py-3">{run.damagedQuantityPieces.toLocaleString()} pcs</td><td className="px-3 py-3">{run.closingStockPieces.toLocaleString()} pcs</td><td className="px-3 py-3 font-bold text-primary">{run.producedQuantityPieces.toLocaleString()} pcs</td><td className="px-3 py-3">{run.recipeVersion ? `v${run.recipeVersion}` : 'No recipe'}</td><td className="px-3 py-3 font-semibold">{run.reference}</td><td className="px-3 py-3"><button type="button" onClick={() => onSelect(run)} aria-label={`View production record ${run.reference}`} className="grid size-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100"><Icons.Eye className="size-4" /></button></td></tr>)}</tbody></table></div>
}

function ProductionRunDetails({ run, onClose }: { run: ProductionRunRecord; onClose: () => void }) {
  return <div className="fixed inset-0 z-80 grid place-items-center bg-slate-950/45 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section role="dialog" aria-modal="true" aria-labelledby="production-run-detail-title" className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-2xl">
      <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><p className="text-xs text-slate-400">{run.reference} · {formatDate(run.productionDate)}</p><h2 id="production-run-detail-title" className="mt-1 text-base font-bold">{run.productName}</h2></div><button type="button" aria-label="Close production details" onClick={onClose} className="grid size-8 place-items-center rounded-md text-slate-400"><Icons.X className="size-4" /></button></header>
      <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3"><Detail label="Opening stock" value={`${run.openingStockPieces.toLocaleString()} pcs`} /><Detail label="Legacy sales entries" value={`${run.salesQuantityPieces.toLocaleString()} pcs`} /><Detail label="Damage" value={`${run.damagedQuantityPieces.toLocaleString()} pcs`} /><Detail label="Closing stock" value={`${run.closingStockPieces.toLocaleString()} pcs`} /><Detail label="Produced" value={`${run.producedQuantityPieces.toLocaleString()} pcs`} /><Detail label="Recipe" value={run.recipeVersion ? `Version ${run.recipeVersion}` : 'No recipe'} /></div>
      <p className="border-t border-slate-100 px-5 py-4 text-xs text-slate-500">Raw-material usage is recorded separately in Raw Material Management using the number of 1,000-litre tanks made.</p>
      {run.damageReason && <p className="border-t border-slate-100 px-5 py-4 text-xs"><span className="font-semibold">Damage reason:</span> {run.damageReason}</p>}
      <footer className="flex justify-end border-t border-slate-100 px-5 py-4"><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold">Close</button></footer>
    </section>
  </div>
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-slate-50 p-3"><div className="text-[10px] text-slate-500">{label}</div><div className="mt-1 text-xs font-bold text-slate-800">{value}</div></div>
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="px-5 py-14 text-center"><span className="mx-auto grid size-10 place-items-center rounded-full bg-slate-100 text-slate-500"><Icons.Factory className="size-4" /></span><h4 className="mt-3 text-sm font-semibold text-slate-800">{title}</h4><p className="mx-auto mt-1 max-w-md text-xs text-slate-500">{detail}</p></div>
}
