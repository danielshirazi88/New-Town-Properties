import { useEffect, useMemo, useState } from 'react'
import { Dashboard } from './views/Dashboard'
import { Properties } from './views/Properties'
import { RentRoll } from './views/RentRoll'
import { Expirations } from './views/Expirations'
import { Escalations } from './views/Escalations'
import { Expenses } from './views/Expenses'
import { Valuation } from './views/Valuation'
import { Apollo } from './views/Apollo'
import { DataIntegrity } from './views/DataIntegrity'
import { computeKpis, resolveData } from './lib/portfolio'
import { type Expense } from './lib/expenses'
import { money } from './lib/format'
import { Taxes } from './views/Taxes'
import { EMPTY_OVERRIDES, editCount, type Overrides } from './lib/overrides'
import { useStored } from './lib/useStored'
import { STORE_KEYS, store } from './lib/store'
import type { TaxEntries } from './lib/taxes'
import { LEASES } from './data/leases'

type Tab =
  | 'dashboard' | 'properties' | 'rentroll' | 'expirations'
  | 'escalations' | 'expenses' | 'taxes' | 'valuation' | 'apollo' | 'integrity'

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [selectedProperty, setSelectedProperty] = useState<string | undefined>()
  const [expenseSeed, setExpenseSeed] = useState<string | undefined>()

  const overridesState = useStored<Overrides>(STORE_KEYS.overrides, EMPTY_OVERRIDES)
  const expensesState = useStored<Expense[]>(STORE_KEYS.expenses, [])
  const taxState = useStored<TaxEntries>(STORE_KEYS.taxes, {})

  const overrides = overridesState.value
  const expenses = expensesState.value
  const setExpenses = expensesState.setValue

  // Edits are layered over the source documents, then everything is recomputed.
  const data = useMemo(() => resolveData(overrides), [overrides])
  const k = useMemo(() => computeKpis(undefined, data), [data])
  const edits = editCount(overrides)
  const saving = overridesState.saving || expensesState.saving || taxState.saving
  const saveError = overridesState.error ?? expensesState.error ?? taxState.error

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [tab, selectedProperty])

  const goProperty = (id?: string) => {
    setSelectedProperty(id)
    setTab('properties')
  }

  const nav: { id: Tab; label: string; count?: string; group: string }[] = [
    { id: 'dashboard', label: 'Executive dashboard', group: 'Overview' },
    { id: 'properties', label: 'Properties', count: String(k.propertyCount), group: 'Overview' },
    { id: 'rentroll', label: 'Rent roll', count: String(k.unitCount + data.apolloTenants.filter((t) => !t.isParking).length), group: 'Tenants' },
    { id: 'expirations', label: 'Lease expirations', count: String(k.expiredLeases.length + k.expiring12.length), group: 'Tenants' },
    { id: 'escalations', label: 'Annual bumps', count: String(k.bumpsNotTaken.length), group: 'Tenants' },
    { id: 'apollo', label: 'Apollo park', count: String(k.apolloLots), group: 'Tenants' },
    { id: 'expenses', label: 'Expenses', count: expenses.length ? String(expenses.length) : undefined, group: 'Money' },
    { id: 'taxes', label: 'Taxes — Schedule E', group: 'Money' },
    { id: 'valuation', label: 'Valuation', group: 'Money' },
    { id: 'integrity', label: 'Data integrity', group: 'Money' },
  ]

  const groups = [...new Set(nav.map((n) => n.group))]

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">Portfolio OS</div>
          <div className="brand-name">New Town Properties</div>
          <div className="brand-sub">{money(k.grossCollected)} gross · FY {k.fiscalYear}</div>
          <div className="brand-sub" style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className={`status-dot ${store().kind === 'remote' ? 'safe' : 'watch'}`} aria-hidden />
            {store().label}
          </div>
          {edits > 0 && (
            <div className="brand-sub" style={{ color: 'var(--red)', marginTop: 3 }}>
              {edits} manual {edits === 1 ? 'edit' : 'edits'} applied
            </div>
          )}
          {saving && <div className="brand-sub" style={{ marginTop: 3 }}>Saving…</div>}
          {saveError && <div className="brand-sub" style={{ color: 'var(--red)', marginTop: 3 }}>{saveError}</div>}
        </div>

        {groups.map((g) => (
          <div className="nav-group" key={g}>
            <div className="nav-label">{g}</div>
            {nav.filter((n) => n.group === g).map((n) => (
              <button
                key={n.id}
                className={`nav-item${tab === n.id ? ' active' : ''}`}
                onClick={() => {
                  if (n.id === 'properties') setSelectedProperty(undefined)
                  setTab(n.id)
                }}
              >
                <span>{n.label}</span>
                {n.count && <span className="nav-count">{n.count}</span>}
              </button>
            ))}
          </div>
        ))}
      </aside>

      <main className="main">
        {tab === 'dashboard' && (
          <Dashboard k={k} expenses={expenses} onProperty={goProperty} onNav={(t) => setTab(t as Tab)} />
        )}
        {tab === 'properties' && (
          <Properties
            k={k}
            expenses={expenses}
            selected={selectedProperty}
            onSelect={setSelectedProperty}
            onAddExpense={(id) => { setExpenseSeed(id); setTab('expenses') }}
          />
        )}
        {tab === 'rentroll' && (
          <RentRoll
            k={k}
            onProperty={goProperty}
            apolloTenants={data.apolloTenants}
            overrides={overrides}
            setOverrides={overridesState.setValue}
            originalLeases={LEASES}
          />
        )}
        {tab === 'expirations' && <Expirations k={k} onProperty={goProperty} />}
        {tab === 'escalations' && <Escalations k={k} onProperty={goProperty} />}
        {tab === 'expenses' && (
          <Expenses k={k} expenses={expenses} setExpenses={setExpenses} initialProperty={expenseSeed} />
        )}
        {tab === 'taxes' && (
          <Taxes k={k} expenses={expenses} entries={taxState.value} setEntries={taxState.setValue} />
        )}
        {tab === 'valuation' && <Valuation k={k} expenses={expenses} onProperty={goProperty} />}
        {tab === 'apollo' && <Apollo k={k} tenants={data.apolloTenants} />}
        {tab === 'integrity' && <DataIntegrity k={k} onProperty={goProperty} />}
      </main>
    </div>
  )
}
