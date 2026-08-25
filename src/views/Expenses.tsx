import { useMemo, useRef, useState } from 'react'
import { RankedBars } from '../components/charts'
import { Card, Empty, Kpi } from '../components/ui'
import { MONTHS } from '../lib/finance'
import { money, num } from '../lib/format'
import {
  CAPITAL_LEANING, EXPENSE_CATEGORIES, download, expensesToCsv, humanSize, newId,
  openReceipt, putReceipt, deleteReceipt, rollup, storageAvailable,
  type Expense, type ExpenseCategory, type ExpenseKind, type ReceiptMeta,
} from '../lib/expenses'
import type { PortfolioKpis } from '../lib/portfolio'
import { PROPERTIES } from '../data/properties'

const today = () => new Date().toISOString().slice(0, 10)

interface Draft {
  id?: string
  propertyId: string
  date: string
  category: ExpenseCategory
  kind: ExpenseKind
  vendor: string
  amount: string
  description: string
  unit: string
  receipts: ReceiptMeta[]
}

const emptyDraft = (propertyId: string): Draft => ({
  propertyId,
  date: today(),
  category: 'Contractor work',
  kind: 'operating',
  vendor: '',
  amount: '',
  description: '',
  unit: '',
  receipts: [],
})

export function Expenses({
  k, expenses, setExpenses, initialProperty,
}: {
  k: PortfolioKpis
  expenses: Expense[]
  setExpenses: (next: Expense[]) => void
  initialProperty?: string
}) {
  const [propertyFilter, setPropertyFilter] = useState<string>(initialProperty ?? 'all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [kindFilter, setKindFilter] = useState<'all' | ExpenseKind>('all')
  const [editing, setEditing] = useState<Draft | null>(null)

  const propName = (id: string) => PROPERTIES.find((p) => p.id === id)?.name ?? id

  const filtered = useMemo(
    () =>
      expenses
        .filter((e) => propertyFilter === 'all' || e.propertyId === propertyFilter)
        .filter((e) => categoryFilter === 'all' || e.category === categoryFilter)
        .filter((e) => kindFilter === 'all' || e.kind === kindFilter)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [expenses, propertyFilter, categoryFilter, kindFilter],
  )

  const roll = rollup(filtered)
  const scopedIncome = propertyFilter === 'all'
    ? k.grossCollected
    : k.properties.find((p) => p.property.id === propertyFilter)?.collected ?? 0

  const byProperty = PROPERTIES.map((p) => ({
    id: p.id,
    label: p.name,
    value: expenses.filter((e) => e.propertyId === p.id).reduce((a, e) => a + e.amount, 0),
  })).filter((r) => r.value > 0).sort((a, b) => b.value - a.value)

  const save = (d: Draft) => {
    const amount = Number.parseFloat(d.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      alert('Enter an amount greater than zero.')
      return
    }
    if (!d.vendor.trim()) {
      alert('Enter who was paid.')
      return
    }
    const record: Expense = {
      id: d.id ?? newId(),
      propertyId: d.propertyId,
      date: d.date,
      category: d.category,
      kind: d.kind,
      vendor: d.vendor.trim(),
      amount,
      description: d.description.trim(),
      unit: d.unit.trim() || undefined,
      receipts: d.receipts,
      createdAt: d.id ? expenses.find((e) => e.id === d.id)?.createdAt ?? new Date().toISOString() : new Date().toISOString(),
    }
    setExpenses(d.id ? expenses.map((e) => (e.id === d.id ? record : e)) : [record, ...expenses])
    setEditing(null)
  }

  const remove = async (e: Expense) => {
    if (!confirm(`Delete the ${money(e.amount)} expense to ${e.vendor}? This also removes its receipts.`)) return
    for (const r of e.receipts) await deleteReceipt(r.id)
    setExpenses(expenses.filter((x) => x.id !== e.id))
  }

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Expenses</h1>
        <p className="page-sub">
          Log every cost against the property it belongs to and attach the receipt or invoice.
          Operating costs reduce NOI; capital work is tracked separately because it is depreciated
          against the building instead. Everything is stored in this browser and exports to CSV.
        </p>
      </div>

      {!storageAvailable() && (
        <div className="callout">
          <div className="callout-title">This copy can’t save anything</div>
          <p>
            The page is open directly from a file, and the browser blocks storage on files opened that
            way. You can look around, but any expense entered here will be gone when the tab closes.
            Open the hosted copy instead, or run the app with <code>npm run dev</code>.
          </p>
        </div>
      )}
      <div className="toolbar">
        <button className="btn primary" onClick={() => setEditing(emptyDraft(propertyFilter === 'all' ? PROPERTIES[0].id : propertyFilter))}>
          + Add expense
        </button>
        <div className="spacer" />
        <label className="field" style={{ minWidth: 190 }}>
          <span>Property</span>
          <select value={propertyFilter} onChange={(e) => setPropertyFilter(e.target.value)}>
            <option value="all">All properties</option>
            {PROPERTIES.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="field" style={{ minWidth: 170 }}>
          <span>Category</span>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="all">All categories</option>
            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="field" style={{ minWidth: 140 }}>
          <span>Type</span>
          <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as 'all' | ExpenseKind)}>
            <option value="all">Operating + capital</option>
            <option value="operating">Operating only</option>
            <option value="capital">Capital only</option>
          </select>
        </label>
        <button
          className="btn"
          disabled={filtered.length === 0}
          onClick={() => download(`ntp-expenses-${today()}.csv`, expensesToCsv(filtered, propName))}
        >
          Export CSV
        </button>
      </div>

      <div className="kpi-grid">
        <Kpi accent label="Total logged" value={money(roll.total)} note={`${num(roll.count)} entries`} />
        <Kpi label="Operating" value={money(roll.operating)}
          note={scopedIncome > 0 ? `${((roll.operating / scopedIncome) * 100).toFixed(1)}% of gross income` : undefined} />
        <Kpi label="Capital" value={money(roll.capital)} note="Excluded from NOI" />
        <Kpi label="Receipts attached" value={num(filtered.reduce((a, e) => a + e.receipts.length, 0))}
          note={`${filtered.filter((e) => e.receipts.length === 0).length} entries without one`} />
        <Kpi label="Largest single cost" value={filtered.length ? money(Math.max(...filtered.map((e) => e.amount))) : '—'}
          note={filtered.length ? filtered.reduce((a, b) => (b.amount > a.amount ? b : a)).vendor : undefined} />
        <Kpi label="Average expense" value={roll.count ? money(roll.total / roll.count) : '—'} />
      </div>

      {roll.count > 0 && (
        <div className="section">
          <div className="grid-2">
            <Card title="By category">
              <RankedBars items={roll.byCategory.map((c) => ({ id: c.category, label: c.category, value: c.amount, sub: `${c.count} ${c.count === 1 ? 'entry' : 'entries'}` }))} />
            </Card>
            <Card title="By property">
              {byProperty.length ? <RankedBars items={byProperty} /> : <Empty>Nothing logged yet.</Empty>}
            </Card>
          </div>
          <Card title="By month">
            <div className="table-wrap" style={{ border: 0 }}>
              <table>
                <thead><tr><th>Month</th>{MONTHS.map((m) => <th key={m} className="num">{m}</th>)}</tr></thead>
                <tbody>
                  <tr>
                    <td className="t-mute">Spend</td>
                    {roll.byMonth.map((v, i) => <td key={i} className="num">{v ? money(v) : <span className="t-mute">—</span>}</td>)}
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      <div className="section">
        <div className="section-title">Expense ledger</div>
        {filtered.length === 0 ? (
          <Empty>
            No expenses logged{propertyFilter !== 'all' ? ` for ${propName(propertyFilter)}` : ''} yet.
            <div style={{ marginTop: 12 }}>
              <button className="btn primary" onClick={() => setEditing(emptyDraft(propertyFilter === 'all' ? PROPERTIES[0].id : propertyFilter))}>
                Add the first one
              </button>
            </div>
          </Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th><th>Property</th><th>Category</th><th>Type</th>
                  <th>Paid to</th><th>Description</th><th>Receipts</th>
                  <th className="num">Amount</th><th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id}>
                    <td className="t-mono t-nowrap">{e.date}</td>
                    <td className="t-mute">{propName(e.propertyId)}{e.unit && <span className="t-mono"> · {e.unit}</span>}</td>
                    <td>{e.category}</td>
                    <td><span className={`badge ${e.kind === 'capital' ? 'mute' : 'ok'}`}>{e.kind === 'capital' ? 'Capital' : 'Operating'}</span></td>
                    <td className="t-strong">{e.vendor}</td>
                    <td className="t-mute" style={{ maxWidth: 260 }}>{e.description || '—'}</td>
                    <td>
                      {e.receipts.length === 0 ? <span className="t-mute">—</span> : (
                        <div className="stack" style={{ gap: 3 }}>
                          {e.receipts.map((r) => (
                            <button key={r.id} className="btn ghost sm" onClick={() => openReceipt(r)} title={`${r.name} · ${humanSize(r.size)}`}>
                              View {r.name.length > 18 ? `${r.name.slice(0, 17)}…` : r.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="num t-strong">{money(e.amount)}</td>
                    <td className="t-nowrap">
                      <button className="btn ghost sm" onClick={() => setEditing({ ...e, amount: String(e.amount), unit: e.unit ?? '' })}>Edit</button>
                      <button className="btn ghost sm danger" onClick={() => remove(e)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="label" colSpan={7}>{filtered.length} entries</td>
                  <td className="num">{money(roll.total)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {editing && <ExpenseForm draft={editing} setDraft={setEditing} onSave={save} onCancel={() => setEditing(null)} />}
    </>
  )
}

/* ── Entry form ──────────────────────────────────────────────────────────── */

function ExpenseForm({
  draft, setDraft, onSave, onCancel,
}: {
  draft: Draft
  setDraft: (d: Draft) => void
  onSave: (d: Draft) => void
  onCancel: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft({ ...draft, [key]: value })

  const attach = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    const added: ReceiptMeta[] = []
    for (const file of Array.from(files)) {
      const meta: ReceiptMeta = {
        id: newId(),
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        addedAt: new Date().toISOString(),
      }
      try {
        await putReceipt(meta.id, file)
        added.push(meta)
      } catch {
        alert(`Could not store ${file.name}.`)
      }
    }
    setDraft({ ...draft, receipts: [...draft.receipts, ...added] })
    setBusy(false)
  }

  const detach = async (id: string) => {
    await deleteReceipt(id)
    setDraft({ ...draft, receipts: draft.receipts.filter((r) => r.id !== id) })
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 className="modal-title">{draft.id ? 'Edit expense' : 'Add expense'}</h2>
          <button className="btn ghost sm" onClick={onCancel}>Close</button>
        </div>

        <div className="form-grid">
          <label className="field">
            <span>Property</span>
            <select value={draft.propertyId} onChange={(e) => set('propertyId', e.target.value)}>
              {PROPERTIES.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>

          <label className="field">
            <span>Unit / suite (optional)</span>
            <input value={draft.unit} onChange={(e) => set('unit', e.target.value)} placeholder="e.g. 1505 A&B" />
          </label>

          <label className="field">
            <span>Date</span>
            <input type="date" value={draft.date} onChange={(e) => set('date', e.target.value)} />
          </label>

          <label className="field">
            <span>Amount (USD)</span>
            <input
              type="number" min="0" step="0.01" inputMode="decimal" placeholder="0.00"
              value={draft.amount} onChange={(e) => set('amount', e.target.value)}
            />
          </label>

          <label className="field">
            <span>Category</span>
            <select
              value={draft.category}
              onChange={(e) => {
                const c = e.target.value as ExpenseCategory
                // Structural, roofing, TI and appliances are usually capitalised —
                // preselect that, but leave it editable.
                setDraft({ ...draft, category: c, kind: CAPITAL_LEANING.includes(c) ? 'capital' : 'operating' })
              }}
            >
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>

          <label className="field">
            <span>Operating or capital</span>
            <select value={draft.kind} onChange={(e) => set('kind', e.target.value as ExpenseKind)}>
              <option value="operating">Operating — reduces NOI</option>
              <option value="capital">Capital — depreciated, excluded from NOI</option>
            </select>
          </label>

          <label className="field full">
            <span>Paid to</span>
            <input value={draft.vendor} onChange={(e) => set('vendor', e.target.value)} placeholder="Contractor, supplier or service" />
          </label>

          <label className="field full">
            <span>Description</span>
            <textarea rows={2} value={draft.description} onChange={(e) => set('description', e.target.value)}
              placeholder="What the work was — e.g. replaced rooftop HVAC unit, suite 1505C" />
          </label>

          <div className="field full">
            <span style={{ fontWeight: 600, letterSpacing: '0.03em', textTransform: 'uppercase', fontSize: 10.5, color: 'var(--ink-3)' }}>
              Receipts & invoices
            </span>
            <div
              className={`dropzone${over ? ' over' : ''}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setOver(true) }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => { e.preventDefault(); setOver(false); attach(e.dataTransfer.files) }}
            >
              {busy ? 'Storing…' : 'Drop files here, or click to choose. PDFs and photos both work.'}
            </div>
            <input
              ref={fileRef} type="file" multiple hidden
              accept="image/*,application/pdf,.pdf,.png,.jpg,.jpeg,.heic,.webp"
              onChange={(e) => { attach(e.target.files); e.target.value = '' }}
            />
            {draft.receipts.length > 0 && (
              <div className="stack" style={{ gap: 5, marginTop: 8 }}>
                {draft.receipts.map((r) => (
                  <div key={r.id} className="receipt-item">
                    <span className="name">{r.name}</span>
                    <span className="t-mute t-mono">{humanSize(r.size)}</span>
                    <button className="btn ghost sm" onClick={() => openReceipt(r)}>View</button>
                    <button className="btn ghost sm danger" onClick={() => detach(r.id)}>Remove</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="form-actions">
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn primary" onClick={() => onSave(draft)} disabled={busy}>
            {draft.id ? 'Save changes' : 'Add expense'}
          </button>
        </div>
      </div>
    </div>
  )
}
