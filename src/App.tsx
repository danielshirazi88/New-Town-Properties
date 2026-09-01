import { useEffect, useMemo, useState } from 'react'
import { Dashboard } from './views/Dashboard'
import { Properties } from './views/Properties'
import { RentRoll } from './views/RentRoll'
import { Expirations } from './views/Expirations'
import { Escalations } from './views/Escalations'
import { Expenses } from './views/Expenses'
import { Valuation } from './views/Valuation'
import { CashFlowView } from './views/CashFlow'
import { Apollo } from './views/Apollo'
import { DataIntegrity } from './views/DataIntegrity'
import { computeKpis, resolveData } from './lib/portfolio'
import { type Expense } from './lib/expenses'
import { money } from './lib/format'
import { Taxes } from './views/Taxes'
import { EMPTY_OVERRIDES, editCount, type Overrides } from './lib/overrides'
import { useStored } from './lib/useStored'
import { useToday } from './lib/useToday'
import { STORE_KEYS, server, setAccount, store } from './lib/store'
import { SignIn } from './components/SignIn'
import { Team } from './views/Team'
import { canReach, type AccountSummary, type SectionId } from './lib/access'
import type { TaxEntries } from './lib/taxes'
import { YearOverYear } from './views/YearOverYear'
import { SquareFootage } from './views/SquareFootage'
import { Accounting } from './views/Accounting'
import { Receivables } from './views/Receivables'
import { SlowPayers } from './views/SlowPayers'
import { Assets } from './views/Assets'
import { TaxReturns } from './views/TaxReturns'
import { EMPTY_REGISTER, applySeed, needsSeed, type AssetRegister } from './lib/assets'
import { INVESTMENT_SEED_VERSION, SEEDED_INVESTMENTS } from './data/investments'
import { PAYMENT_SEED_VERSION, SEEDED_PAYMENTS } from './data/payments'
import { Trust } from './views/Trust'
import { EMPTY_TRUST_STATE, resolveTrust, type TrustState } from './lib/trust'
import { TRUST_HOLDINGS } from './data/trust'
import { TenantProfileView } from './views/TenantProfile'
import type { TenantProfiles } from './lib/tenants'
import { DEFAULT_COLLECTION, chargesForYear, payerRecordsFor, seedPayments, statusOf, trackedCharges,
  type CollectionSettings, type Payment } from './lib/receivables'
import { AVAILABLE_YEARS, CURRENT_YEAR, isPartYear, rentRoll, yearLabel } from './data/rentRolls'
import { DEFAULT_CAP_RATE, DEFAULT_OPEX_LOAD_PCT } from './lib/portfolio'
import { FILED_RETURNS } from './data/taxReturns'

type Tab =
  | 'dashboard' | 'properties' | 'rentroll' | 'expirations'
  | 'escalations' | 'expenses' | 'taxes' | 'valuation' | 'apollo' | 'integrity' | 'yoy' | 'sqft'
  | 'cashflow'
  | 'accounting' | 'receivables' | 'slowpayers' | 'tenant' | 'assets' | 'returns' | 'trust' | 'team'

/** Which section governs each tab, for the redirect below. */
const TAB_SECTIONS: Partial<Record<Tab, SectionId>> = {
  dashboard: 'dashboard', yoy: 'dashboard', sqft: 'dashboard',
  properties: 'properties', rentroll: 'properties', expirations: 'properties',
  escalations: 'properties', apollo: 'properties', integrity: 'properties',
  tenant: 'tenants',
  accounting: 'collection', receivables: 'collection', slowpayers: 'collection',
  expenses: 'expenses',
  taxes: 'taxes', returns: 'taxes',
  trust: 'wealth', assets: 'wealth', valuation: 'wealth',
  team: 'team',
}

/** The first tab this account can actually open. */
const FIRST_TAB_FOR = (account: AccountSummary): Tab => {
  const found = (Object.keys(TAB_SECTIONS) as Tab[])
    .find((t) => canReach(account, TAB_SECTIONS[t]!))
  return found ?? 'dashboard'
}

export default function App() {
  const info = server()
  const [signedIn, setSignedIn] = useState(!info.authRequired || info.authenticated)
  const [me, setMe] = useState<AccountSummary | null>(info.account)
  const [tab, setTab] = useState<Tab>('dashboard')
  const [selectedProperty, setSelectedProperty] = useState<string | undefined>()
  const [expenseSeed, setExpenseSeed] = useState<string | undefined>()
  const [selectedLease, setSelectedLease] = useState<string | undefined>()
  // Where the tenant profile was opened from, so Back returns there.
  const [tenantFrom, setTenantFrom] = useState<Tab>('properties')
  const [year, setYear] = useState<number>(CURRENT_YEAR)
  // Live, so a tab left open overnight rolls the rent over at midnight instead
  // of waiting for someone to reload it.
  const today = useToday()

  const overridesState = useStored<Overrides>(STORE_KEYS.overrides, EMPTY_OVERRIDES)
  const expensesState = useStored<Expense[]>(STORE_KEYS.expenses, [])
  const taxState = useStored<TaxEntries>(STORE_KEYS.taxes, {})
  const profileState = useStored<TenantProfiles>(STORE_KEYS.profiles, {})
  const paymentState = useStored<Payment[]>(STORE_KEYS.payments, SEEDED_PAYMENTS)
  // Deliberately NOT pre-stamped with the payment seed version. Doing that told
  // an instance whose collection settings had never been saved that the seed had
  // already run, so a saved-but-empty payment list never received it and a month
  // that was short read as settled.
  const collectionState = useStored<CollectionSettings>(STORE_KEYS.collection, DEFAULT_COLLECTION)
  const assetState = useStored<AssetRegister>(
    STORE_KEYS.assets,
    applySeed(EMPTY_REGISTER, SEEDED_INVESTMENTS, INVESTMENT_SEED_VERSION),
  )
  const trustState = useStored<TrustState>(STORE_KEYS.trust, EMPTY_TRUST_STATE)

  // Deposits ship with the application, so a new device shows them without
  // anyone retyping the statements. The merge runs once — see `applySeed`.
  const assetSetValue = assetState.setValue
  const assetLoaded = assetState.loaded
  const assetRegister = assetState.value
  useEffect(() => {
    if (!assetLoaded) return
    if (!needsSeed(assetRegister, INVESTMENT_SEED_VERSION)) return
    assetSetValue(applySeed(assetRegister, SEEDED_INVESTMENTS, INVESTMENT_SEED_VERSION))
  }, [assetLoaded, assetRegister, assetSetValue])

  // Payments read off invoices ship with the application, the same way the bank
  // accounts do. The merge runs once, keyed on a version in the collection
  // settings, so a payment deleted afterwards stays deleted.
  const collectionSetValue = collectionState.setValue
  const paymentSetValue = paymentState.setValue
  const collectionLoaded = collectionState.loaded
  const paymentsLoaded = paymentState.loaded
  const collectionValue = collectionState.value
  const paymentsValue = paymentState.value
  useEffect(() => {
    // Both must have loaded: acting on a default while the other is still in
    // flight is what stamped the seed as done before it had run.
    if (!collectionLoaded || !paymentsLoaded) return
    const next = seedPayments(paymentsValue, collectionValue, SEEDED_PAYMENTS, PAYMENT_SEED_VERSION)
    if (!next) return
    if (next.payments !== paymentsValue) paymentSetValue(next.payments)
    collectionSetValue(next.settings)
  }, [collectionLoaded, paymentsLoaded, collectionValue, paymentsValue,
    collectionSetValue, paymentSetValue])

  const overrides = overridesState.value
  const payments = paymentState.value
  const expenses = expensesState.value
  const setExpenses = expensesState.setValue

  // Edits are layered over the source documents, then everything is recomputed.
  const data = useMemo(() => resolveData(overrides, year), [overrides, year])
  const k = useMemo(() => computeKpis(today, data), [data, today])
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
      chargesForYear(k.properties.flatMap((p) => p.leases), k.fiscalYear,
      { reportedMonths: rentRoll(k.fiscalYear).monthsReported, carryForward: true }),
      collectionState.value.startPeriod,
    )
    return {
      openCount: charges.filter((c) => {
        const s = statusOf(c, payments, k.asOf, collectionState.value)
        return s.isDue && s.balance > 0.005
      }).length,
      slowCount: payerRecordsFor(charges, payments, k.asOf, collectionState.value)
        .filter((r) => r.chargesSettled > 0 && (r.onTimeRatePct < 80 || r.monthsLate >= 2)).length,
    }
  }, [k, payments, collectionState.value])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [tab, selectedProperty, selectedLease])

  // If the selected tab is not reachable — access changed, or a bookmark from
  // another account — fall back to the first one that is.
  useEffect(() => {
    if (!info.authRequired || !me) return
    const section = TAB_SECTIONS[tab]
    if (section && !canReach(me, section)) {
      setTab(canReach(me, 'dashboard') ? 'dashboard' : FIRST_TAB_FOR(me))
    }
  }, [tab, me, info.authRequired])

  // The server rejects a request once the session lapses; show the gate again
  // rather than letting saves fail silently.
  useEffect(() => {
    const onExpired = () => setSignedIn(false)
    window.addEventListener('ntp:unauthenticated', onExpired)
    return () => window.removeEventListener('ntp:unauthenticated', onExpired)
  }, [])

  if (!signedIn) {
    return (
      <SignIn onDone={(account) => { setAccount(account); setMe(account); setSignedIn(true) }} />
    )
  }

  // With no server there is nobody to be — the app runs open on one browser, so
  // everything is reachable. With a server, the section list decides.
  const allowed = (section: SectionId) =>
    !info.authRequired ? true : canReach(me, section)

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

  const nav: { id: Tab; label: string; count?: string; group: string; section: SectionId }[] = [
    { id: 'dashboard', label: 'Executive dashboard', group: 'Overview', section: 'dashboard' },
    { id: 'yoy', label: 'Year over year', count: String(AVAILABLE_YEARS.length), group: 'Overview', section: 'dashboard' },
    { id: 'properties', label: 'Properties', count: String(k.propertyCount), group: 'Overview', section: 'properties' },
    { id: 'rentroll', label: 'Rent roll', count: String(k.unitCount + data.apolloTenants.filter((t) => !t.isParking).length), group: 'Tenants', section: 'properties' },
    { id: 'expirations', label: 'Lease expirations', count: String(k.expiredLeases.length + k.expiring12.length), group: 'Tenants', section: 'properties' },
    { id: 'escalations', label: 'Annual bumps', count: String(k.bumpsNotTaken.length), group: 'Tenants', section: 'properties' },
    { id: 'apollo', label: 'Apollo park', count: String(k.apolloLots), group: 'Tenants', section: 'properties' },
    { id: 'sqft', label: 'Square footage', count: k.totalSquareFeet ? `${Math.round(k.totalSquareFeet / 1000)}k` : undefined, group: 'Tenants', section: 'dashboard' },
    { id: 'accounting', label: 'Rent collection', count: paymentState.value.length ? String(paymentState.value.length) : undefined, group: 'Money', section: 'collection' },
    { id: 'receivables', label: 'Accounts receivable', count: openCount ? String(openCount) : undefined, group: 'Money', section: 'collection' },
    { id: 'slowpayers', label: 'Slow payers & late fees', count: slowCount ? String(slowCount) : undefined, group: 'Money', section: 'collection' },
    { id: 'expenses', label: 'Expenses', count: expenses.length ? String(expenses.length) : undefined, group: 'Money', section: 'expenses' },
    { id: 'taxes', label: 'Taxes — Schedule E', group: 'Money', section: 'taxes' },
    { id: 'returns', label: 'Tax returns', count: String(FILED_RETURNS.length), group: 'Money', section: 'taxes' },
    { id: 'trust', label: 'Shirazi Trust', count: String(TRUST_HOLDINGS.length), group: 'Money', section: 'wealth' },
    { id: 'assets', label: 'Assets', count: assetCount ? String(assetCount) : undefined, group: 'Money', section: 'wealth' },
    { id: 'cashflow', label: 'Cash flow', group: 'Money', section: 'wealth' },
    { id: 'valuation', label: 'Valuation', group: 'Money', section: 'wealth' },
    { id: 'integrity', label: 'Data integrity', group: 'Money', section: 'properties' },
    { id: 'team', label: 'People & access', group: 'Money', section: 'team' },
  ]

  // Hide what this account cannot reach. The server refuses it as well — this
  // is so nobody is shown a door they cannot open, not the lock itself.
  const visible = nav.filter((n) => allowed(n.section))
  const groups = [...new Set(visible.map((n) => n.group))]


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
          {me && (
            <div className="brand-sub" style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span className="t-strong">{me.name}</span>
              <span style={{ opacity: 0.7 }}>{me.role === 'owner' ? 'owner' : 'staff'}</span>
              <button
                className="link"
                style={{ marginLeft: 'auto', fontSize: 11 }}
                onClick={async () => {
                  await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' })
                  window.location.reload()
                }}
              >Sign out</button>
            </div>
          )}
          {saving && <div className="brand-sub" style={{ marginTop: 3 }}>Saving…</div>}
          {saveError && <div className="brand-sub" style={{ color: 'var(--red)', marginTop: 3 }}>{saveError}</div>}
        </div>

        {groups.map((g) => (
          <div className="nav-group" key={g}>
            <div className="nav-label">{g}</div>
            {visible.filter((n) => n.group === g).map((n) => (
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
            register={assetState.value}
            holdings={trustHoldings}
            opexLoadPct={DEFAULT_OPEX_LOAD_PCT}
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
            onYear={setYear}
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
        {tab === 'cashflow' && (
          <CashFlowView k={k} register={assetState.value} onNav={(t) => setTab(t as Tab)} />
        )}
        {tab === 'valuation' && <Valuation k={k} expenses={expenses} onProperty={goProperty} />}
        {tab === 'apollo' && <Apollo k={k} tenants={data.apolloTenants} />}
        {tab === 'integrity' && <DataIntegrity k={k} onProperty={goProperty} />}
        {tab === 'yoy' && <YearOverYear overrides={overrides} onProperty={goProperty} />}
        {tab === 'sqft' && <SquareFootage k={k} onProperty={goProperty} />}
        {tab === 'returns' && <TaxReturns k={k} onProperty={goProperty} />}
        {tab === 'team' && me && <Team me={me} />}
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
              settings={collectionState.value}
              onBack={() => setTab(tenantFrom)}
              onProperty={goProperty}
              onTenant={goTenant}
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
