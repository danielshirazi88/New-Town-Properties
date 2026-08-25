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
import { computeKpis } from './lib/portfolio'
import { loadExpenses, saveExpenses, type Expense } from './lib/expenses'
import { money } from './lib/format'

type Tab =
  | 'dashboard' | 'properties' | 'rentroll' | 'expirations'
  | 'escalations' | 'expenses' | 'valuation' | 'apollo' | 'integrity'

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [selectedProperty, setSelectedProperty] = useState<string | undefined>()
  const [expenses, setExpensesState] = useState<Expense[]>(() => loadExpenses())
  const [expenseSeed, setExpenseSeed] = useState<string | undefined>()

  const k = useMemo(() => computeKpis(), [])

  const setExpenses = (next: Expense[]) => {
    setExpensesState(next)
    saveExpenses(next)
  }

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
    { id: 'rentroll', label: 'Rent roll', count: String(k.unitCount), group: 'Tenants' },
    { id: 'expirations', label: 'Lease expirations', count: String(k.expiredLeases.length + k.expiring12.length), group: 'Tenants' },
    { id: 'escalations', label: 'Annual bumps', count: String(k.bumpsNotTaken.length), group: 'Tenants' },
    { id: 'apollo', label: 'Apollo park', count: String(k.apolloLots), group: 'Tenants' },
    { id: 'expenses', label: 'Expenses', count: expenses.length ? String(expenses.length) : undefined, group: 'Money' },
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
        {tab === 'rentroll' && <RentRoll k={k} onProperty={goProperty} />}
        {tab === 'expirations' && <Expirations k={k} onProperty={goProperty} />}
        {tab === 'escalations' && <Escalations k={k} onProperty={goProperty} />}
        {tab === 'expenses' && (
          <Expenses k={k} expenses={expenses} setExpenses={setExpenses} initialProperty={expenseSeed} />
        )}
        {tab === 'valuation' && <Valuation k={k} expenses={expenses} onProperty={goProperty} />}
        {tab === 'apollo' && <Apollo k={k} />}
        {tab === 'integrity' && <DataIntegrity k={k} onProperty={goProperty} />}
      </main>
    </div>
  )
}
