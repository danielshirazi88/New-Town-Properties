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
import { STORE_KEYS, server, store } from './lib/store'
import { SignIn } from './components/SignIn'
import type { TaxEntries } from './lib/taxes'
import { YearOverYear } from './views/YearOverYear'
import { SquareFootage } from './views/SquareFootage'
import { Accounting } from './views/Accounting'
import { Receivables } from './views/Receivables'
import { SlowPayers } from './views/SlowPayers'
import { Assets } from './views/Assets'
import { TaxReturns } from './views/TaxReturns'
import { EMPTY_REGISTER, type AssetRegister } from './lib/assets'
import { Trust } from './views/Trust'
import { EMPTY_TRUST_STATE, resolveTrust, type TrustState } from './lib/trust'
import { TRUST_HOLDINGS } from './data/trust'
import { TenantProfileView } from './views/TenantProfile'
import type { TenantProfiles } from './lib/tenants'
import { chargesForYear, payerRecordsFor, statusOf, trackedCharges,
  type CollectionSettings, type Payment } from './lib/receivables'
import { AVAILABLE_YEARS, CURRENT_YEAR, isPartYear, rentRoll, yearLabel } from './data/rentRolls'
import { DEFAULT_CAP_RATE } from './lib/portfolio'
import { FILED_RETURNS } from './data/taxReturns'

type Tab =
  | 'dashboard' | 'properties' | 'rentroll' | 'expirations'
  | 'escalations' | 'expenses' | 'taxes' | 'valuation' | 'apollo' | 'integrity' | 'yoy' | 'sqft'
  | 'accounting' | 'receivables' | 'slowpayers' | 'tenant' | 'assets' | 'returns' | 'trust'

export default function App() {
  const info = server()
  const [signedIn, setSignedIn] = useState(!info.authRequired || info.authenticated)
  const [tab, setTab] = useState<Tab>('dashboard')
  const [selectedProperty, setSelectedProperty] = useState<string | undefined>()
  const [expenseSeed, setExpenseSeed] = useState<string | undefined>()
  const [selectedLease, setSelectedLease] = useState<string | undefined>()
  // Where the tenant profile was opened from, so Back returns there.
  const [tenantFrom, setTenantFrom] = useState<Tab>('properties')
  const [year, setYear] = useState<number>(CURRENT_YEAR)

  const overridesState = useStored<Overrides>(STORE_KEYS.overrides, EMPTY_OVERRIDES)
  const expensesState = useStored<Expense[]>(STORE_KEYS.expenses, [])
  const taxState = useStored<TaxEntries>(STORE_KEYS.taxes, {})
  const profileState = useStored<TenantProfiles>(STORE_KEYS.profiles, {})
  const paymentState = useStored<Payment[]>(STORE_KEYS.payments, [])
  const collectionState = useStored<CollectionSettings>(STORE_KEYS.collection, {})
  const assetState = useStored<AssetRegister>(STORE_KEYS.assets, EMPTY_REGISTER)
  const trustState = useStored<TrustState>(STORE_KEYS.trust, EMPTY_TRUST_STATE)

  const overrides = overridesState.value
  const payments = paymentState.value
  const expenses = expensesState.value
  const setExpenses = expensesState.setValue

  // Edits are layered over the source documents, then everything is recomputed.
  const data = useMemo(() => resolveData(overrides, year), [overrides, year])
  const k = useMemo(() => computeKpis(undefined, data), [data])
  const edits = editCount(overrides)
  const saving = overridesState.saving || expensesState.saving || taxState.saving
    || profileState.saving || paymentState.saving || collectionState.saving || assetState.saving || trustState.saving
  const saveError = overridesState.error ?? expensesState.error ?? taxState.error
    ?? profileState.error ?? paymentState.error ?? collectionState.error ?? assetState.error ?? trustState.error

  // Badge counts for the collection tabs: unpaid months, and tenants running
  // late. Both walk every charge, so they are computed once per data change
  // rather than on every render.
  // The trust schedule is the register of what is owned; the asset screen reads
  // real estate from it rather than keeping a second, divergent list.
  const trustHoldings = useMemo(() => {
    const value = new Map<string, number>()
    for (const p of k.properties) {
      if (p.netAfterTax > 0) value.set(p.property.id, (p.netAfterTax / DEFAULT_CAP_RATE) * 100)
    }
    return resolveTrust(TRUST_HOLDINGS, trustState.value, (id) => value.get(id))
  }, [k, trustState.value])

  const { openCount, slowCount } = useMemo(() => {
    const charges = trackedCharges(
      chargesForYear(k.properties.flatMap((p) => p.leases), k.fiscalYear),
      collectionState.value.startPeriod,
    )
    return {
      openCount: charges.filter((c) => statusOf(c, payments).balance > 0.005).length,
      slowCount: payerRecordsFor(charges, payments)
        .filter((r) => r.chargesSettled > 0 && (r.onTimeRatePct < 80 || r.monthsLate >= 2)).length,
    }
  }, [k, payments, collectionState.value.startPeriod])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [tab, selectedProperty, selectedLease])

  // The server rejects a request once the session lapses; show the gate again
  // rather than letting saves fail silently.
  useEffect(() => {
    const onExpired = () => setSignedIn(false)
    window.addEventListener('ntp:unauthenticated', onExpired)
    return () => window.removeEventListener('ntp:unauthenticated', onExpired)
  }, [])

  if (!signedIn) return <SignIn onDone={() => setSignedIn(true)} />

  const goProperty = (id?: string) => {
    setSelectedProperty(id)
    setTab('properties')
  }

  const goTenant = (leaseId: string) => {
    setSelectedLease(leaseId)
    setTenantFrom(tab === 'tenant' ? tenantFrom : tab)
    setTab('tenant')
  }

  // The profile follows the lease, so a lease missing from the selected year has
  // no profile to show — fall back rather than rendering an empty screen.
  const selectedLeaseRecord = selectedLease
    ? k.properties.flatMap((p) => p.leases).find((l) => l.id === selectedLease)
    : undefined

  const assetCount = trustHoldings.length
    + assetState.value.investments.length + assetState.value.vehicles.length

  const nav: { id: Tab; label: string; count?: string; group: string }[] = [
    { id: 'dashboard', label: 'Executive dashboard', group: 'Overview' },
    { id: 'yoy', label: 'Year over year', count: String(AVAILABLE_YEARS.length), group: 'Overview' },
    { id: 'properties', label: 'Properties', count: String(k.propertyCount), group: 'Overview' },
    { id: 'rentroll', label: 'Rent roll', count: String(k.unitCount + data.apolloTenants.filter((t) => !t.isParking).length), group: 'Tenants' },
    { id: 'expirations', label: 'Lease expirations', count: String(k.expiredLeases.length + k.expiring12.length), group: 'Tenants' },
    { id: 'escalations', label: 'Annual bumps', count: String(k.bumpsNotTaken.length), group: 'Tenants' },
    { id: 'apollo', label: 'Apollo park', count: String(k.apolloLots), group: 'Tenants' },
    { id: 'sqft', label: 'Square footage', count: k.totalSquareFeet ? `${Math.round(k.totalSquareFeet / 1000)}k` : undefined, group: 'Tenants' },
    { id: 'accounting', label: 'Rent collection', count: paymentState.value.length ? String(paymentState.value.length) : undefined, group: 'Money' },
    { id: 'receivables', label: 'Accounts receivable', count: openCount ? String(openCount) : undefined, group: 'Money' },
    { id: 'slowpayers', label: 'Slow payers & late fees', count: slowCount ? String(slowCount) : undefined, group: 'Money' },
    { id: 'expenses', label: 'Expenses', count: expenses.length ? String(expenses.length) : undefined, group: 'Money' },
    { id: 'taxes', label: 'Taxes — Schedule E', group: 'Money' },
    { id: 'returns', label: 'Tax returns', count: String(FILED_RETURNS.length), group: 'Money' },
    { id: 'trust', label: 'Shirazi Trust', count: String(TRUST_HOLDINGS.length), group: 'Money' },
    { id: 'assets', label: 'Assets', count: assetCount ? String(assetCount) : undefined, group: 'Money' },
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
          <div className="brand-sub">{money(k.grossCollected)} gross</div>
          <label className="field" style={{ marginTop: 8 }}>
            <span>Rent roll year</span>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {AVAILABLE_YEARS.map((y) => <option key={y} value={y}>{yearLabel(y)}</option>)}
            </select>
          </label>
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
        {isPartYear(year) && (
          <div className="callout" style={{ marginBottom: 18 }}>
            <div className="callout-title">
              {year} is a part year — {rentRoll(year).monthsReported} months of data
            </div>
            <p>
              Every total on this screen covers January to{' '}
              {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
                'September', 'October', 'November', 'December'][rentRoll(year).monthsReported - 1]}{' '}
              only, so it is not comparable with a full year. Months the sheet does not cover are shown
              as — and are not counted as vacancy.
              {!rentRoll(year).hasControlTotals && ' This sheet prints no totals, so the transcription has nothing to be checked against.'}
            </p>
          </div>
        )}
        {tab === 'dashboard' && (
          <Dashboard
            k={k}
            expenses={expenses}
            payments={payments}
            collection={collectionState.value}
            onProperty={goProperty}
            onNav={(t) => setTab(t as Tab)}
          />
        )}
        {tab === 'properties' && (
          <Properties
            k={k}
            expenses={expenses}
            selected={selectedProperty}
            onSelect={setSelectedProperty}
            onAddExpense={(id) => { setExpenseSeed(id); setTab('expenses') }}
            onTenant={goTenant}
            profiles={profileState.value}
          />
        )}
        {tab === 'rentroll' && (
          <RentRoll
            k={k}
            onProperty={goProperty}
            onTenant={goTenant}
            apolloTenants={data.apolloTenants}
            overrides={overrides}
            setOverrides={overridesState.setValue}
            originalLeases={rentRoll(year).leases}
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
        {tab === 'yoy' && <YearOverYear overrides={overrides} onProperty={goProperty} />}
        {tab === 'sqft' && <SquareFootage k={k} onProperty={goProperty} />}
        {tab === 'returns' && <TaxReturns k={k} onProperty={goProperty} />}
        {tab === 'trust' && (
          <Trust
            k={k}
            state={trustState.value}
            setState={trustState.setValue}
            capRate={DEFAULT_CAP_RATE}
            onProperty={goProperty}
          />
        )}
        {tab === 'assets' && (
          <Assets
            k={k}
            register={assetState.value}
            setRegister={assetState.setValue}
            capRate={DEFAULT_CAP_RATE}
            trust={trustHoldings}
            onTrust={() => setTab('trust')}
          />
        )}
        {tab === 'accounting' && (
          <Accounting
            k={k}
            payments={payments}
            setPayments={paymentState.setValue}
            profiles={profileState.value}
            onTenant={goTenant}
            settings={collectionState.value}
            setSettings={collectionState.setValue}
          />
        )}
        {tab === 'receivables' && (
          <Receivables
            k={k}
            payments={payments}
            profiles={profileState.value}
            settings={collectionState.value}
            onTenant={goTenant}
            onProperty={goProperty}
          />
        )}
        {tab === 'slowpayers' && (
          <SlowPayers
            k={k}
            payments={payments}
            profiles={profileState.value}
            settings={collectionState.value}
            onTenant={goTenant}
            onProperty={goProperty}
          />
        )}
        {tab === 'tenant' && (
          selectedLeaseRecord ? (
            <TenantProfileView
              k={k}
              lease={selectedLeaseRecord}
              profiles={profileState.value}
              setProfiles={profileState.setValue}
              payments={payments}
              onBack={() => setTab(tenantFrom)}
              onProperty={goProperty}
            />
          ) : (
            <div className="callout">
              <div className="callout-title">That tenant is not on the {year} rent roll</div>
              <p>
                Profiles are keyed to a lease, and this lease does not appear in the{' '}
                {yearLabel(year)} sheet. Switch the rent roll year in the sidebar to reach it, or{' '}
                <button className="link" onClick={() => setTab(tenantFrom)}>go back</button>.
              </p>
            </div>
          )
        )}
      </main>
    </div>
  )
}
