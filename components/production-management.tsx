'use client'

import { useMemo, useState } from 'react'
import * as Icons from 'lucide-react'
import { createId, exportCsv, formatDate, money, stockQuantityAtLocation, stockUnitCost, type ErpState, type FinishedProduct, type FinishedStockMovement, type FinishedStockMovementType, type ProductionRecipe, type ProductionRun, type ProductionRunLine, type RecipeIngredient, type StockMovement } from '@/lib/erp'

type Props = { state: ErpState; updateState: (next: ErpState) => void }
type View = 'Products' | 'Daily production' | 'Finished stock' | 'Production history'
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const actor = 'Sarah Namirembe'
const inputClass = 'mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-ring/30'
const reasonOptions = ['Sales dispatch', 'Damage/write-off', 'Internal use/sample', 'Transfer', 'Other']
const productPackSizes = ['150 ml', '180 ml', '200 ml', '250 ml', '300 ml', '350 ml', '500 ml']

function stockBalance(productId: string, movements: FinishedStockMovement[]) {
  return movements.filter((movement) => movement.productId === productId).reduce((balance, movement) => {
    if (['Opening balance', 'Production', 'Transfer in', 'Other stock in', 'Adjustment increase'].includes(movement.type)) return balance + movement.quantity
    return balance - movement.quantity
  }, 0)
}

function reconcile(opening: number, sales: number, damage: number, closing: number) {
  return closing + sales + damage - opening
}

function Metric({ label, value, detail, icon, tone }: { label: string; value: string; detail: string; icon: string; tone: 'purple' | 'blue' | 'amber' | 'rose' }) {
  const Icon = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[icon] ?? Icons.Factory
  const color = tone === 'purple' ? 'bg-secondary text-primary' : tone === 'blue' ? 'bg-sky-50 text-sky-700' : tone === 'amber' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
  return <article className="rounded-lg border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><span className={`grid size-9 place-items-center rounded-md ${color}`}><Icon className="size-4" /></span><span className="text-[9px] font-semibold uppercase text-slate-400">Today</span></div><div className="mt-3 text-xl font-bold tracking-tight">{value}</div><h3 className="mt-0.5 text-xs font-semibold text-slate-700">{label}</h3><p className="mt-1 text-[10px] text-slate-500">{detail}</p></article>
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={`block text-xs font-semibold text-slate-600 ${wide ? 'sm:col-span-2' : ''}`}>{label}{children}</label>
}

export default function ProductionManagement({ state, updateState }: Props) {
  const [view, setView] = useState<View>('Daily production')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [productFilter, setProductFilter] = useState('All products')
  const [showProductForm, setShowProductForm] = useState(false)
  const [showRunForm, setShowRunForm] = useState(false)
  const [showFinishedMovement, setShowFinishedMovement] = useState(false)
  const [selectedRun, setSelectedRun] = useState<ProductionRun | null>(null)
  const [message, setMessage] = useState('')

  const productBalances = state.finishedProducts.map((product) => ({ product, balance: stockBalance(product.id, state.finishedStockMovements) }))
  const todayRuns = state.productionRuns.filter((run) => run.productionDate === today())
  const todayProduced = todayRuns.reduce((total, run) => total + (run.producedQuantity ?? run.tankCount), 0)
  const todaySold = todayRuns.reduce((total, run) => total + (run.salesQuantity ?? 0), 0)
  const todayDamaged = todayRuns.reduce((total, run) => total + (run.damagedQuantity ?? 0), 0)
  const finishedUnits = productBalances.reduce((total, item) => total + item.balance, 0)
  const visibleProducts = useMemo(() => productBalances.filter(({ product }) => `${product.code} ${product.name} ${product.category} ${product.flavour ?? ''} ${product.unit}`.toLowerCase().includes(search.trim().toLowerCase())), [state.finishedProducts, state.finishedStockMovements, search])
  const visibleRuns = useMemo(() => state.productionRuns.filter((run) => {
    return `${run.reference} ${run.productName}`.toLowerCase().includes(search.trim().toLowerCase())
      && (productFilter === 'All products' || run.productId === productFilter)
      && (!dateFrom || run.productionDate >= dateFrom)
      && (!dateTo || run.productionDate <= dateTo)
  }).sort((left, right) => right.productionDate.localeCompare(left.productionDate) || right.recordedAt.localeCompare(left.recordedAt)), [state.productionRuns, search, productFilter, dateFrom, dateTo])
  const visibleFinishedMovements = state.finishedStockMovements.filter((movement) => {
    const product = state.finishedProducts.find((item) => item.id === movement.productId)
    return `${movement.reference} ${movement.reason ?? ''} ${movement.note ?? ''} ${product?.name ?? ''} ${product?.code ?? ''}`.toLowerCase().includes(search.trim().toLowerCase())
      && (productFilter === 'All products' || movement.productId === productFilter)
      && (!dateFrom || movement.date >= dateFrom)
      && (!dateTo || movement.date <= dateTo)
  }).sort((left, right) => right.date.localeCompare(left.date) || right.recordedAt.localeCompare(left.recordedAt))

  const saveProduct = (form: FormData, ingredients: RecipeIngredient[]) => {
    const code = String(form.get('code') || '').trim()
    const name = String(form.get('name') || '').trim()
    const category = String(form.get('category') || '').trim()
    const unit = String(form.get('unit') || '').trim()
    const flavour = String(form.get('flavour') || '')
    const recipeRequired = form.get('recipeRequired') === 'on'
    if (!code || !name || !['Cup', 'Bottle'].includes(category) || !productPackSizes.includes(unit) || !['Mango', 'Pineapple milk'].includes(flavour) || state.finishedProducts.some((product) => product.code.toLowerCase() === code.toLowerCase()) || state.finishedProducts.some((product) => product.name.toLowerCase() === name.toLowerCase())) {
      setMessage('Enter valid product details and a unique product code and name.')
      return false
    }
    if (recipeRequired && !ingredients.length) {
      setMessage('Add at least one raw material to a recipe-required product.')
      return false
    }
    const now = new Date().toISOString()
    const productId = createId('FG')
    let recipe: ProductionRecipe | undefined
    if (ingredients.length) recipe = { id: createId('RECIPE'), productName: name, tankUnit: unit, ingredients, createdAt: now, updatedAt: now }
    const product: FinishedProduct = { id: productId, code, name, category, unit, flavour: flavour as NonNullable<FinishedProduct['flavour']>, recipeId: recipe?.id, recipeRequired, active: true, createdAt: now, updatedAt: now }
    updateState({ ...state, finishedProducts: [product, ...state.finishedProducts], productionRecipes: recipe ? [recipe, ...state.productionRecipes] : state.productionRecipes })
    setShowProductForm(false)
    setMessage(`${name} added to finished products.`)
    return true
  }

  const openBalance = (productId: string, date: string) => {
    const priorRuns = state.productionRuns.filter((run) => run.productId === productId && run.productionDate < date).sort((left, right) => right.productionDate.localeCompare(left.productionDate) || right.recordedAt.localeCompare(left.recordedAt))
    if (priorRuns.length && priorRuns[0].closingStock !== undefined) return priorRuns[0].closingStock
    return state.finishedStockMovements.filter((movement) => movement.productId === productId && (movement.date < date || (movement.date === date && movement.type === 'Opening balance'))).reduce((balance, movement) => {
      if (['Opening balance', 'Production', 'Transfer in', 'Other stock in', 'Adjustment increase'].includes(movement.type)) return balance + movement.quantity
      return balance - movement.quantity
    }, 0)
  }

  const postRun = (form: FormData) => {
    const product = state.finishedProducts.find((item) => item.id === String(form.get('productId') || ''))
    const productionDate = String(form.get('productionDate') || '')
    const openingStock = Number(form.get('openingStock'))
    const salesQuantity = Number(form.get('salesQuantity') || 0)
    const damagedQuantity = Number(form.get('damagedQuantity') || 0)
    const closingStock = Number(form.get('closingStock'))
    const damageReason = String(form.get('damageReason') || '').trim()
    const calculatedProduction = reconcile(openingStock, salesQuantity, damagedQuantity, closingStock)
    if (!product || !/^\d{4}-\d{2}-\d{2}$/.test(productionDate) || [openingStock, salesQuantity, damagedQuantity, closingStock].some((value) => !Number.isFinite(value) || value < 0) || calculatedProduction < 0) {
      setMessage('Enter a product, date, and non-negative stock counts. Calculated production cannot be negative.')
      return false
    }
    if (damagedQuantity > 0 && !damageReason) {
      setMessage('Add a damage reason when damaged quantity is greater than zero.')
      return false
    }
    const recipe = state.productionRecipes.find((item) => item.id === product.recipeId)
    if (product.recipeRequired && !recipe) {
      setMessage('This product requires a recipe before production can be recorded.')
      return false
    }
    const recipeIngredients = recipe?.ingredients ?? []
    const lines = recipeIngredients.map((ingredient) => {
      const material = state.materials.find((item) => item.id === ingredient.materialId)
      return material ? { material, quantityPerTank: ingredient.quantityPerTank, totalQuantity: ingredient.quantityPerTank * calculatedProduction } : null
    })
    if (lines.some((line) => line === null)) {
      setMessage('A recipe ingredient no longer exists in Raw Material Management. Update the product recipe before posting.')
      return false
    }
    const validLines = lines.filter((line): line is NonNullable<typeof line> => line !== null)
    const ingredientShortage = validLines.find(({ material, totalQuantity }) => stockQuantityAtLocation(material.id, state.stockMovements, material.location) < totalQuantity)
    if (ingredientShortage) {
      setMessage(`Insufficient ${ingredientShortage.material.name}: need ${ingredientShortage.totalQuantity} ${ingredientShortage.material.unit}; available ${stockQuantityAtLocation(ingredientShortage.material.id, state.stockMovements, ingredientShortage.material.location)}.`)
      return false
    }
    const now = new Date().toISOString()
    const reference = createId('PROD')
    const run: ProductionRun = {
      id: createId('PRUN'), reference, recipeId: recipe?.id ?? '', productId: product.id,
      productName: product.name, productUnit: product.unit, productionDate, tankCount: calculatedProduction, producedQuantity: calculatedProduction,
      openingStock, salesQuantity, damagedQuantity, closingStock, damageReason: damageReason || undefined,
      salesSource: 'Manual', location: 'Finished goods', lines: validLines.map(({ material, quantityPerTank, totalQuantity }) => ({ materialId: material.id, materialName: material.name, quantityPerTank, totalQuantity, unit: material.unit })), recordedAt: now, actor,
    }
    const finishedMoves: FinishedStockMovement[] = [
      { id: createId('FG-MOV'), reference, productId: product.id, type: 'Production', quantity: calculatedProduction, date: productionDate, recordedAt: now, reason: 'Calculated daily production', actor },
      ...(salesQuantity > 0 ? [{ id: createId('FG-MOV'), reference, productId: product.id, type: 'Sales dispatch' as const, quantity: salesQuantity, date: productionDate, recordedAt: now, reason: 'Sales quantity entered on daily production record', actor }] : []),
      ...(damagedQuantity > 0 ? [{ id: createId('FG-MOV'), reference, productId: product.id, type: 'Damage/write-off' as const, quantity: damagedQuantity, date: productionDate, recordedAt: now, reason: damageReason, actor }] : []),
    ]
    const materialDeductions: StockMovement[] = validLines.map(({ material, totalQuantity }) => ({
      id: createId('MOV'), reference, productionRunId: run.id, materialId: material.id, type: 'Production use', quantity: totalQuantity,
      unit: material.unit, date: productionDate, recordedAt: now, fromLocation: material.location,
      sourceReference: `${product.name} · ${calculatedProduction} ${product.unit}`, reason: `Production consumption for ${reference}`, actor,
    }))
    const stockMovements = [...materialDeductions, ...state.stockMovements]
    const materials = state.materials.map((material) => ({ ...material, quantity: Math.max(0, stockQuantityAtLocation(material.id, stockMovements)), cost: stockUnitCost(material, stockMovements) }))
    updateState({ ...state, finishedStockMovements: [...finishedMoves, ...state.finishedStockMovements], productionRuns: [run, ...state.productionRuns], stockMovements, materials })
    setShowRunForm(false)
    setMessage(`${reference} posted: ${calculatedProduction} ${product.unit} produced, ${salesQuantity} sold, ${damagedQuantity} damaged.`)
    return true
  }

  const postFinishedMovement = (form: FormData) => {
    const product = state.finishedProducts.find((item) => item.id === String(form.get('productId') || ''))
    const type = String(form.get('type') || '') as FinishedStockMovementType
    const date = String(form.get('date') || '')
    const quantity = Number(form.get('quantity'))
    const reason = String(form.get('reason') || '').trim()
    const note = String(form.get('note') || '').trim()
    const inbound: FinishedStockMovementType[] = ['Other stock in', 'Adjustment increase']
    const outbound: FinishedStockMovementType[] = ['Sales dispatch', 'Damage/write-off', 'Internal use/sample', 'Transfer out', 'Adjustment decrease']
    const allowed = [...inbound, ...outbound]
    if (!product || !allowed.includes(type) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(quantity) || quantity <= 0) {
      setMessage('Select a product, movement type, date, and positive quantity.')
      return false
    }
    if (!reason || (reason === 'Other' && !note)) {
      setMessage('Choose a reason; add a note when the reason is Other.')
      return false
    }
    const currentBalance = stockBalance(product.id, state.finishedStockMovements)
    if (outbound.includes(type) && quantity > currentBalance) {
      setMessage(`Only ${currentBalance} ${product.unit} is available in finished stock.`)
      return false
    }
    const movement: FinishedStockMovement = { id: createId('FG-MOV'), reference: String(form.get('reference') || '').trim() || createId('FG-MOV'), productId: product.id, type, quantity, date, recordedAt: new Date().toISOString(), reason, note: note || undefined, actor }
    updateState({ ...state, finishedStockMovements: [movement, ...state.finishedStockMovements] })
    setShowFinishedMovement(false)
    setMessage(`${type} recorded for ${product.name}.`)
    return true
  }

  const exportHistory = () => exportCsv('daily-production-history.csv', visibleRuns.map((run) => ({
    date: run.productionDate, reference: run.reference, product: run.productName, openingStock: run.openingStock ?? 'Unavailable',
    sales: run.salesQuantity ?? 'Unavailable', damaged: run.damagedQuantity ?? 'Unavailable', closingStock: run.closingStock ?? 'Unavailable',
    produced: run.producedQuantity ?? run.tankCount, recipeIngredients: run.lines.map((line) => `${line.materialName}: ${line.totalQuantity} ${line.unit}`).join('; '), actor: run.actor,
  })))

  const exportProducts = () => exportCsv('finished-products.csv', visibleProducts.map(({ product, balance }) => ({
    code: product.code, product: product.name, category: product.category, flavour: product.flavour ?? '', unit: product.unit, onHand: balance,
    recipe: state.productionRecipes.find((recipe) => recipe.id === product.recipeId)?.productName ?? 'No recipe', status: product.active ? 'Active' : 'Inactive',
  })))

  return <div className="animate-in fade-in duration-300">
    <header className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="mb-2 text-xs font-medium text-slate-400">Workspace / Inventory Department</div><h2 className="text-2xl font-bold tracking-tight">Production management</h2><p className="mt-1 text-sm text-slate-500">Daily output, finished stock, sales, and damage reconciliation.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={view === 'Products' ? exportProducts : exportHistory} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Icons.Download className="size-4" /> Export {view === 'Products' ? 'products' : 'history'}</button><button type="button" onClick={() => { setMessage(''); setShowProductForm(true) }} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Icons.PackagePlus className="size-4" /> Add product</button><button type="button" onClick={() => { setMessage(''); setShowRunForm(true) }} disabled={!state.finishedProducts.some((product) => product.active)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-45"><Icons.Factory className="size-4" /> Record daily production</button></div></header>

    <section aria-label="Daily production summary" className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Produced today" value={todayProduced.toLocaleString()} detail={`${todayRuns.length} daily record${todayRuns.length === 1 ? '' : 's'}`} icon="Factory" tone="purple" /><Metric label="Finished stock on hand" value={finishedUnits.toLocaleString()} detail={`${state.finishedProducts.length} finished products`} icon="PackageCheck" tone="blue" /><Metric label="Sales entered today" value={todaySold.toLocaleString()} detail="Manually entered until Sales is linked" icon="Truck" tone="amber" /><Metric label="Damage today" value={todayDamaged.toLocaleString()} detail="Recorded write-offs" icon="PackageX" tone="rose" /></section>

    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div role="tablist" aria-label="Production views" className="flex gap-1 overflow-x-auto border-b border-slate-200 px-4 pt-2">{(['Products', 'Daily production', 'Finished stock', 'Production history'] as View[]).map((item) => <button key={item} type="button" role="tab" aria-selected={view === item} onClick={() => setView(item)} className={`shrink-0 border-b-2 px-3 py-3 text-xs font-semibold ${view === item ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{item}<span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] ${view === item ? 'bg-secondary text-secondary-foreground' : 'bg-slate-100 text-slate-500'}`}>{view === 'Products' ? state.finishedProducts.length : view === 'Daily production' ? todayRuns.length : view === 'Finished stock' ? state.finishedStockMovements.length : state.productionRuns.length}</span></button>)}</div>
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 xl:flex-row xl:items-center xl:justify-between"><div><h3 className="text-sm font-bold">{view}</h3><p className="mt-1 text-xs text-slate-500">{view === 'Daily production' ? 'Formula: closing stock + sales + damage − opening stock' : view === 'Products' ? `${visibleProducts.length} products` : view === 'Finished stock' ? `${visibleFinishedMovements.length} stock movements` : `${visibleRuns.length} daily production records`}</p></div><div className="flex flex-wrap gap-2">{view === 'Finished stock' && <button type="button" onClick={() => { setMessage(''); setShowFinishedMovement(true) }} className="inline-flex items-center gap-2 rounded-lg border border-primary px-3 py-2 text-xs font-semibold text-primary hover:bg-secondary"><Icons.ArrowLeftRight className="size-4" /> Record stock movement</button>}<label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><Icons.Search className="size-4 text-slate-400" /><input aria-label={`Search ${view.toLowerCase()}`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products or references" className="w-44 bg-transparent text-xs outline-none" /></label>{view !== 'Products' && <><select aria-label="Filter production by product" value={productFilter} onChange={(event) => setProductFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><option>All products</option>{state.finishedProducts.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select><label className="sr-only" htmlFor="production-from-date">From date</label><input id="production-from-date" aria-label="Production from date" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="rounded-lg border border-slate-200 px-2 py-2 text-xs" /><label className="sr-only" htmlFor="production-to-date">To date</label><input id="production-to-date" aria-label="Production to date" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="rounded-lg border border-slate-200 px-2 py-2 text-xs" /></>}</div></div>
      {view === 'Products' ? <ProductTable products={visibleProducts} recipes={state.productionRecipes} /> : view === 'Daily production' || view === 'Production history' ? <ProductionHistoryTable runs={visibleRuns} products={state.finishedProducts} onSelect={setSelectedRun} /> : <FinishedStockTable movements={visibleFinishedMovements} products={state.finishedProducts} />}
      <footer className="border-t border-slate-100 px-4 py-3 text-[10px] text-slate-400">Sales are entered manually on daily records in this phase to prevent duplicate deductions; linked recipe ingredient use is posted to Raw Material Management.</footer>
    </section>
    {showProductForm && <ProductDialog materials={state.materials} message={message} onClose={() => setShowProductForm(false)} onSave={saveProduct} />}
    {showRunForm && <DailyProductionDialog products={state.finishedProducts.filter((product) => product.active)} runs={state.productionRuns} finishedMovements={state.finishedStockMovements} recipes={state.productionRecipes} materials={state.materials} rawMovements={state.stockMovements} message={message} onClose={() => setShowRunForm(false)} onSubmit={postRun} openingBalance={openBalance} />}
    {showFinishedMovement && <FinishedMovementDialog products={state.finishedProducts.filter((product) => product.active)} message={message} onClose={() => setShowFinishedMovement(false)} onSubmit={postFinishedMovement} />}
    {selectedRun && <ProductionRunDetails run={selectedRun} product={state.finishedProducts.find((item) => item.id === selectedRun.productId)} onClose={() => setSelectedRun(null)} />}
  </div>
}

function ProductTable({ products, recipes }: { products: Array<{ product: FinishedProduct; balance: number }>; recipes: ProductionRecipe[] }) {
  if (!products.length) return <EmptyState title="No finished products yet" detail="Add a product profile and define its stock unit and optional raw-material recipe." />
  return <div className="overflow-x-auto"><table className="w-full min-w-180 text-left text-xs"><thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-400"><tr>{['Code', 'Product', 'Category', 'Flavour', 'Pack size', 'On hand', 'Recipe', 'Status'].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{products.map(({ product, balance }) => <tr key={product.id} className="border-t border-slate-100 text-slate-600"><td className="px-4 py-3 font-mono font-semibold">{product.code}</td><td className="px-4 py-3 font-semibold text-slate-800">{product.name}</td><td className="px-4 py-3">{product.category}</td><td className="px-4 py-3">{product.flavour ?? '—'}</td><td className="px-4 py-3">{product.unit}</td><td className="px-4 py-3 font-semibold">{balance.toLocaleString()}</td><td className="px-4 py-3">{recipes.find((recipe) => recipe.id === product.recipeId) ? 'Recipe set' : product.recipeRequired ? <span className="font-semibold text-rose-700">Recipe required</span> : 'Not linked'}</td><td className="px-4 py-3"><span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${product.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{product.active ? 'Active' : 'Inactive'}</span></td></tr>)}</tbody></table></div>
}

function ProductionHistoryTable({ runs, products, onSelect }: { runs: ProductionRun[]; products: FinishedProduct[]; onSelect: (run: ProductionRun) => void }) {
  if (!runs.length) return <EmptyState title="No daily records yet" detail="Record production to reconcile opening stock, sales, damage, closing stock, and calculated output." />
  return <div className="overflow-x-auto"><table className="w-full min-w-250 text-left text-xs"><thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-400"><tr>{['Date', 'Product', 'Opening stock', 'Sales', 'Damage', 'Closing stock', 'Produced', 'Ingredient use', 'Reference', ''].map((label) => <th key={label} className="px-3 py-3">{label}</th>)}</tr></thead><tbody>{runs.map((run) => { const unit = run.productUnit ?? products.find((product) => product.id === run.productId)?.unit ?? 'unit'; return <tr key={run.id} className="border-t border-slate-100 text-slate-600 hover:bg-slate-50/70"><td className="whitespace-nowrap px-3 py-3">{formatDate(run.productionDate)}</td><td className="px-3 py-3 font-semibold text-slate-800">{run.productName}</td><td className="px-3 py-3">{run.openingStock === undefined ? 'Unavailable' : `${run.openingStock} ${unit}`}</td><td className="px-3 py-3">{run.salesQuantity === undefined ? 'Unavailable' : `${run.salesQuantity} ${unit}`}</td><td className="px-3 py-3">{run.damagedQuantity === undefined ? 'Unavailable' : `${run.damagedQuantity} ${unit}`}</td><td className="px-3 py-3">{run.closingStock === undefined ? 'Unavailable' : `${run.closingStock} ${unit}`}</td><td className="px-3 py-3 font-bold text-primary">{run.producedQuantity ?? run.tankCount} {unit}</td><td className="px-3 py-3">{run.lines.length} ingredient lines</td><td className="px-3 py-3 font-semibold">{run.reference}</td><td className="px-3 py-3"><button type="button" onClick={() => onSelect(run)} aria-label={`View production record ${run.reference}`} className="grid size-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100"><Icons.Eye className="size-4" /></button></td></tr> })}</tbody></table></div>
}

function FinishedStockTable({ movements, products }: { movements: FinishedStockMovement[]; products: FinishedProduct[] }) {
  if (!movements.length) return <EmptyState title="No finished-stock movements" detail="Production output, sales dispatches, damage, and corrections will appear here." />
  return <div className="overflow-x-auto"><table className="w-full min-w-180 text-left text-xs"><thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-400"><tr>{['Date', 'Product', 'Movement', 'Quantity', 'Reason / note', 'Reference', 'Recorded by'].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{movements.map((movement) => { const incoming = ['Opening balance', 'Production', 'Transfer in', 'Other stock in', 'Adjustment increase'].includes(movement.type); const product = products.find((item) => item.id === movement.productId); return <tr key={movement.id} className="border-t border-slate-100 text-slate-600"><td className="px-4 py-3 whitespace-nowrap">{formatDate(movement.date)}</td><td className="px-4 py-3 font-semibold text-slate-800">{product?.name ?? movement.productId}</td><td className="px-4 py-3">{movement.type}</td><td className={`px-4 py-3 font-semibold ${incoming ? 'text-emerald-700' : 'text-rose-700'}`}>{incoming ? '+' : '−'}{movement.quantity.toLocaleString()} {product?.unit ?? ''}</td><td className="px-4 py-3">{movement.reason || movement.note || '—'}</td><td className="px-4 py-3">{movement.reference}</td><td className="px-4 py-3">{movement.actor}</td></tr> })}</tbody></table></div>
}

function FinishedMovementDialog({ products, message, onClose, onSubmit }: { products: FinishedProduct[]; message: string; onClose: () => void; onSubmit: (form: FormData) => boolean }) {
  const [type, setType] = useState<FinishedStockMovementType>('Other stock in')
  const [reason, setReason] = useState('')
  const submit = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); onSubmit(new FormData(event.currentTarget)) }
  return <DialogShell title="Record finished-stock movement" subtitle="Use this for separate receipts or reason-coded stock-outs. Production output is posted from Daily production." message={message} onClose={onClose} onSubmit={submit} submitLabel="Post movement">
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Product"><select required name="productId" className={inputClass}><option value="">Select product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} ({product.unit})</option>)}</select></Field><Field label="Movement date"><input required name="date" type="date" defaultValue={today()} className={inputClass} /></Field><Field label="Movement type"><select name="type" value={type} onChange={(event) => setType(event.target.value as FinishedStockMovementType)} className={inputClass}><option value="Other stock in">Other stock in</option><option value="Sales dispatch">Sales dispatch</option><option value="Damage/write-off">Damage/write-off</option><option value="Internal use/sample">Internal use/sample</option><option value="Transfer in">Transfer in</option><option value="Transfer out">Transfer out</option><option value="Adjustment increase">Adjustment increase</option><option value="Adjustment decrease">Adjustment decrease</option></select></Field><Field label={`Quantity${products[0] ? ` (${products[0].unit})` : ''}`}><input required name="quantity" type="number" min="0.001" step="any" className={inputClass} placeholder="0" /></Field><Field label="Stock-out reason"><select required name="reason" value={reason} onChange={(event) => setReason(event.target.value)} className={inputClass}><option value="">Select reason</option>{reasonOptions.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Reference (optional)"><input name="reference" className={inputClass} placeholder="Delivery note, dispatch, or adjustment reference" /></Field><Field label="Note" wide><textarea name="note" required={reason === 'Other'} rows={2} className={inputClass} placeholder={reason === 'Other' ? 'Required when reason is Other' : 'Optional details'} /></Field></div>
  </DialogShell>
}

function ProductDialog({ materials, message, onClose, onSave }: { materials: ErpState['materials']; message: string; onClose: () => void; onSave: (form: FormData, ingredients: RecipeIngredient[]) => boolean }) {
  const [ingredients, setIngredients] = useState<Array<{ materialId: string; perUnit: string }>>([])
  const [recipeRequired, setRecipeRequired] = useState(false)
  const submit = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); onSave(new FormData(event.currentTarget), ingredients.map((item) => ({ materialId: item.materialId, quantityPerTank: Number(item.perUnit) }))) }
  return <DialogShell title="Add finished product" subtitle="Create a stock profile and optionally define its ingredient recipe." message={message} onClose={onClose} onSubmit={submit} submitLabel="Save product">
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Product code"><input required name="code" className={inputClass} placeholder="e.g. JU-MAN-01" /></Field><Field label="Product name"><input required name="name" className={inputClass} placeholder="e.g. Mango juice" /></Field><Field label="Category"><select required name="category" defaultValue="" className={inputClass}><option value="" disabled>Select category</option><option value="Cup">Cup</option><option value="Bottle">Bottle</option></select></Field><Field label="Unit / pack size"><select required name="unit" defaultValue="" className={inputClass}><option value="" disabled>Select pack size</option>{productPackSizes.map((size) => <option key={size} value={size}>{size}</option>)}</select></Field><Field label="Flavour"><select required name="flavour" defaultValue="" className={inputClass}><option value="" disabled>Select flavour</option><option value="Mango">Mango</option><option value="Pineapple milk">Pineapple milk</option></select></Field><label className="flex items-center gap-2 text-xs font-semibold text-slate-700 sm:col-span-2"><input type="checkbox" checked={recipeRequired} onChange={(event) => setRecipeRequired(event.target.checked)} className="size-4 accent-primary" /> Production requires a recipe</label><input type="hidden" name="recipeRequired" value={recipeRequired ? 'on' : ''} />
      <section className="space-y-2 sm:col-span-2"><div className="flex items-center justify-between"><div><h3 className="text-xs font-bold">Raw-material recipe</h3><p className="mt-1 text-[10px] text-slate-500">Ingredient quantity needed for one product unit.</p></div><button type="button" onClick={() => setIngredients((current) => [...current, { materialId: materials[0]?.id ?? '', perUnit: '' }])} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-[10px] font-semibold"><Icons.Plus className="size-3.5" /> Add ingredient</button></div>{ingredients.map((ingredient, index) => <div key={index} className="grid items-end gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_1fr_32px]"><Field label="Raw material"><select value={ingredient.materialId} onChange={(event) => setIngredients((current) => current.map((item, i) => i === index ? { ...item, materialId: event.target.value } : item))} className={inputClass}><option value="">Select material</option>{materials.map((material) => <option key={material.id} value={material.id}>{material.name} ({material.unit})</option>)}</select></Field><Field label={`Quantity per product (${materials.find((item) => item.id === ingredient.materialId)?.unit ?? 'unit'})`}><input type="number" min="0.000001" step="any" value={ingredient.perUnit} onChange={(event) => setIngredients((current) => current.map((item, i) => i === index ? { ...item, perUnit: event.target.value } : item))} className={inputClass} /></Field><button type="button" aria-label={`Remove ingredient ${index + 1}`} onClick={() => setIngredients((current) => current.filter((_, i) => i !== index))} className="grid size-8 place-items-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-700"><Icons.Trash2 className="size-4" /></button></div>)}</section>
    </div>
  </DialogShell>
}

function DailyProductionDialog({ products, runs, finishedMovements, recipes, materials, rawMovements, message, onClose, onSubmit, openingBalance }: { products: FinishedProduct[]; runs: ProductionRun[]; finishedMovements: FinishedStockMovement[]; recipes: ProductionRecipe[]; materials: ErpState['materials']; rawMovements: StockMovement[]; message: string; onClose: () => void; onSubmit: (form: FormData) => boolean; openingBalance: (productId: string, date: string) => number }) {
  const [productId, setProductId] = useState(products[0]?.id ?? '')
  const [productionDate, setProductionDate] = useState(today())
  const [sales, setSales] = useState('0')
  const [damage, setDamage] = useState('0')
  const [closing, setClosing] = useState('0')
  const [damageReason, setDamageReason] = useState('')
  const product = products.find((item) => item.id === productId)
  const opening = product ? openingBalance(product.id, productionDate) : 0
  const salesNumber = Number(sales)
  const damageNumber = Number(damage)
  const closingNumber = Number(closing)
  const produced = reconcile(opening, salesNumber, damageNumber, closingNumber)
  const recipe = recipes.find((item) => item.id === product?.recipeId)
  const ingredientLines = recipe?.ingredients.map((ingredient) => {
    const material = materials.find((item) => item.id === ingredient.materialId)
    const required = ingredient.quantityPerTank * produced
    const available = material ? stockQuantityAtLocation(material.id, rawMovements, material.location) : 0
    return { ingredient, material, required, available }
  }) ?? []
  const ingredientShort = ingredientLines.find((line) => !line.material || line.required > line.available)
  const duplicate = runs.some((run) => run.productId === productId && run.productionDate === productionDate)
  const submit = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); onSubmit(new FormData(event.currentTarget)) }
  const valid = Boolean(product && productionDate && [salesNumber, damageNumber, closingNumber, opening].every((value) => Number.isFinite(value) && value >= 0) && produced >= 0 && (damageNumber === 0 || damageReason.trim()) && (!product.recipeRequired || recipe) && !ingredientShort && !duplicate)
  return <DialogShell title="Record daily production" subtitle="Enter the physical counts; production quantity is calculated automatically." message={message || (duplicate ? 'A daily record already exists for this product and date. Use a correction/adjustment flow rather than posting twice.' : '')} onClose={onClose} onSubmit={submit} submitLabel="Post daily record" submitDisabled={!valid}>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Production date"><input required name="productionDate" type="date" value={productionDate} onChange={(event) => setProductionDate(event.target.value)} className={inputClass} /></Field><Field label="Product"><select required name="productId" value={productId} onChange={(event) => setProductId(event.target.value)} className={inputClass}><option value="">Select product</option>{products.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}</select></Field><Field label={`Opening stock${product ? ` (${product.unit})` : ''}`}><input required name="openingStock" type="number" min="0" step="any" value={opening} readOnly className={`${inputClass} bg-slate-50`} /><span className="mt-1 block text-[10px] font-normal text-slate-400">From previous closing count or opening stock.</span></Field><Field label={`Sales / dispatched${product ? ` (${product.unit})` : ''}`}><input required name="salesQuantity" type="number" min="0" step="any" value={sales} onChange={(event) => setSales(event.target.value)} className={inputClass} /></Field><Field label={`Damaged / written off${product ? ` (${product.unit})` : ''}`}><input required name="damagedQuantity" type="number" min="0" step="any" value={damage} onChange={(event) => setDamage(event.target.value)} className={inputClass} /></Field><Field label="Damage reason"><input name="damageReason" required={damageNumber > 0} value={damageReason} onChange={(event) => setDamageReason(event.target.value)} className={inputClass} placeholder="Required when damage is recorded" /></Field><Field label={`Physical closing stock${product ? ` (${product.unit})` : ''}`}><input required name="closingStock" type="number" min="0" step="any" value={closing} onChange={(event) => setClosing(event.target.value)} className={inputClass} /></Field><div className="flex items-end"><div className="w-full rounded-lg border border-primary/20 bg-secondary/50 p-3"><div className="text-[10px] font-semibold uppercase text-secondary-foreground">Calculated production</div><div className="mt-1 text-lg font-bold text-primary">{Number.isFinite(produced) ? produced.toLocaleString() : '—'} {product?.unit ?? ''}</div><p className="mt-1 text-[10px] text-slate-600">Closing + sales + damage − opening</p></div></div>
      {product && product.recipeRequired && !recipe && <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 sm:col-span-2">This product requires a recipe before production can be posted.</p>}
      {recipe && <section className="overflow-hidden rounded-lg border border-slate-200 sm:col-span-2"><div className="border-b border-slate-100 bg-slate-50 px-3 py-2"><h3 className="text-xs font-bold">Raw materials to deduct for {produced > 0 ? produced : 0} {product?.unit}</h3></div><div className="divide-y divide-slate-100">{ingredientLines.map(({ ingredient, material, required, available }) => <div key={ingredient.materialId} className="flex items-center justify-between gap-3 px-3 py-2 text-xs"><span className="font-semibold">{material?.name ?? 'Missing material'}</span><span className="text-slate-600">{required.toLocaleString()} {material?.unit ?? ''}</span><span className={`text-[10px] font-semibold ${required <= available ? 'text-emerald-700' : 'text-rose-700'}`}>Available {available.toLocaleString()} {material?.unit ?? ''}</span></div>)}</div>{ingredientShort && <p className="border-t border-rose-100 bg-rose-50 px-3 py-2 text-[10px] text-rose-700">Insufficient ingredient stock; posting is blocked.</p>}</section>}
      {product && !recipe && !product.recipeRequired && <p className="text-[10px] text-amber-700 sm:col-span-2">No recipe is linked; finished output will be recorded, but no raw-material deductions will be made.</p>}
      <p className="text-[10px] text-slate-500 sm:col-span-2">Sales are manually entered in this phase and are not imported from Sales, preventing duplicate deductions.</p>
    </div>
  </DialogShell>
}

function DialogShell({ title, subtitle, message, onClose, onSubmit, submitLabel, submitDisabled = false, children }: { title: string; subtitle: string; message: string; onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; submitLabel: string; submitDisabled?: boolean; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-80 grid place-items-center bg-slate-950/45 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section role="dialog" aria-modal="true" aria-labelledby="production-dialog-title" className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 id="production-dialog-title" className="text-base font-bold">{title}</h2><p className="mt-1 text-xs text-slate-500">{subtitle}</p></div><button type="button" aria-label={`Close ${title}`} onClick={onClose} className="grid size-8 place-items-center rounded-md text-slate-400 hover:bg-slate-100"><Icons.X className="size-4" /></button></header><form onSubmit={onSubmit} className="p-5"><div className="space-y-4">{children}{message && <p role="alert" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{message}</p>}</div><footer className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Cancel</button><button type="submit" disabled={submitDisabled} className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40">{submitLabel}</button></footer></form></section></div>
}

function ProductionRunDetails({ run, product, onClose }: { run: ProductionRun; product?: FinishedProduct; onClose: () => void }) {
  const value = (quantity?: number) => quantity === undefined ? 'Unavailable' : `${quantity.toLocaleString()} ${product?.unit ?? 'unit'}`
  return <div className="fixed inset-0 z-80 grid place-items-center bg-slate-950/45 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section role="dialog" aria-modal="true" aria-labelledby="production-detail-title" className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><p className="text-xs text-slate-400">{run.reference} · {formatDate(run.productionDate)}</p><h2 id="production-detail-title" className="mt-1 text-base font-bold">{run.productName}</h2></div><button type="button" aria-label="Close production details" onClick={onClose} className="grid size-8 place-items-center rounded-md text-slate-400 hover:bg-slate-100"><Icons.X className="size-4" /></button></header><div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 lg:grid-cols-6">{[['Opening stock', value(run.openingStock)], ['Sales', value(run.salesQuantity)], ['Damage', value(run.damagedQuantity)], ['Closing stock', value(run.closingStock)], ['Produced', value(run.producedQuantity ?? run.tankCount)], ['Damage reason', run.damageReason || '—']].map(([label, amount]) => <div key={label} className="rounded-lg bg-slate-50 p-3"><div className="text-[10px] text-slate-500">{label}</div><div className="mt-1 wrap-break-word text-xs font-bold text-slate-800">{amount}</div></div>)}</div><section className="border-t border-slate-100"><div className="px-5 py-4"><h3 className="text-sm font-bold">Raw materials consumed</h3></div>{run.lines.length ? <div className="overflow-x-auto"><table className="w-full min-w-140 text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase text-slate-400"><tr>{['Ingredient', 'Per product unit', 'Total deducted'].map((item) => <th key={item} className="px-4 py-3">{item}</th>)}</tr></thead><tbody>{run.lines.map((line) => <tr key={line.materialId} className="border-t border-slate-100"><td className="px-4 py-3 font-semibold">{line.materialName}</td><td className="px-4 py-3">{line.quantityPerTank} {line.unit}</td><td className="px-4 py-3 font-semibold text-rose-700">−{line.totalQuantity.toLocaleString()} {line.unit}</td></tr>)}</tbody></table></div> : <p className="px-5 pb-5 text-xs text-amber-700">No recipe snapshot was available for this production run.</p>}</section><footer className="flex justify-end border-t border-slate-100 px-5 py-4"><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Close</button></footer></section></div>
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="px-5 py-14 text-center"><span className="mx-auto grid size-10 place-items-center rounded-full bg-slate-100 text-slate-500"><Icons.Factory className="size-4" /></span><h4 className="mt-3 text-sm font-semibold text-slate-800">{title}</h4><p className="mx-auto mt-1 max-w-md text-xs text-slate-500">{detail}</p></div>
}