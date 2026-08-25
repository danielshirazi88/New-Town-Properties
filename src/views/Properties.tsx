import { useState } from 'react'
import { MonthlyAreaChart, RankedBars } from '../components/charts'
import { Card, Empty, ExpiryBadge, Kpi } from '../components/ui'
import { MONTHS, cellAmount, collected, isDark, realisedEscalationPct } from '../lib/finance'
import { dateLabel, money, num, pct, signedPct } from '../lib/format'
import { rollup, type Expense } from '../lib/expenses'
import { ApolloRoll } from '../components/ApolloRoll'
import { APOLLO_PARKING_RENT, APOLLO_REGISTRY_LABEL, APOLLO_TENANTS, APOLLO_WATER_CHARGE } from '../data/apollo'
import type { PortfolioKpis } from '../lib/portfolio'
import type { PropertyMetrics } from '../lib/finance'

export function Properties({
  k, expenses, selected, onSelect, onAddExpense,
}: {
  k: PortfolioKpis
  expenses: Expense[]
  selected?: string
  onSelect: (id?: string) => void
  onAddExpense: (propertyId: string) => void
}) {
  const metrics = selected ? k.properties.find((p) => p.property.id === selected) : undefined
  if (metrics) {
    return <PropertyDetail k={k} m={metrics} expenses={expenses} onBack={() => onSelect(undefined)} onAddExpense={onAddExpense} />
  }

  const ranked = [...k.properties].sort((a, b) => b.collected - a.collected)

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Properties</h1>
        <p className="page-sub">
          Fourteen holdings. Select any one for its rent roll, monthly income, lease dates and expenses.
        </p>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Property</th>
              <th>Location</th>
              <th className="num">Units</th>
              <th className="num">Occupancy</th>
              <th className="num">Gross 2025</th>
              <th className="num">Taxes</th>
              <th className="num">Net after tax</th>
              <th className="num">Tax load</th>
              <th className="num">Expenses</th>
              <th className="num">Lapsed</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((m) => {
              const spend = expenses.filter((e) => e.propertyId === m.property.id).reduce((a, e) => a + e.amount, 0)
              // Apollo's tenants live in the lot registry rather than in lease rows.
              const isApollo = m.property.id === 'apollo'
              const units = isApollo ? APOLLO_TENANTS.filter((t) => !t.isParking).length : m.unitCount
              return (
                <tr key={m.property.id} className="clickable" onClick={() => onSelect(m.property.id)}>
                  <td className="t-strong">{m.property.name}</td>
                  <td className="t-mute t-nowrap">{m.property.city}{m.property.state !== '—' ? `, ${m.property.state}` : ''}</td>
                  <td className="num">{units || <span className="t-mute">—</span>}</td>
                  <td className="num">{isApollo ? <span className="t-mute">—</span> : m.unitCount ? pct(m.physicalOccupancyPct, 0) : <span className="t-mute">—</span>}</td>
                  <td className="num t-strong">{money(m.collected)}</td>
                  <td className="num t-mute">{money(m.taxBill)}</td>
                  <td className="num">{money(m.netAfterTax)}</td>
                  <td className="num t-mute">{pct(m.taxLoadPct)}</td>
                  <td className="num">{spend > 0 ? money(spend) : <span className="t-mute">—</span>}</td>
                  <td className="num">{m.expiredCount > 0 ? <span className="badge critical">{m.expiredCount}</span> : <span className="t-mute">—</span>}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="label" colSpan={2}>Portfolio</td>
              <td className="num">{num(k.unitCount + APOLLO_TENANTS.filter((t) => !t.isParking).length)}</td>
              <td className="num">{pct(k.physicalOccupancyPct, 0)}</td>
              <td className="num">{money(k.grossCollected)}</td>
              <td className="num">{money(k.totalTaxes)}</td>
              <td className="num">{money(k.netAfterTax)}</td>
              <td className="num">{pct(k.taxLoadPct)}</td>
              <td className="num">{money(expenses.reduce((a, e) => a + e.amount, 0))}</td>
              <td className="num">{num(k.expiredLeases.length)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="section">
        <div className="grid-2">
          <Card title="Gross income" hint="2025">
            <RankedBars onSelect={onSelect} items={ranked.map((m) => ({ id: m.property.id, label: m.property.name, value: m.collected }))} />
          </Card>
          <Card title="Tax load" hint="taxes as a share of gross">
            <RankedBars
              onSelect={onSelect}
              formatValue={(n) => pct(n)}
              items={[...ranked].sort((a, b) => b.taxLoadPct - a.taxLoadPct)
                .map((m) => ({ id: m.property.id, label: m.property.name, value: m.taxLoadPct, sub: money(m.taxBill) }))}
            />
          </Card>
        </div>
      </div>
    </>
  )
}

/* ── Detail ──────────────────────────────────────────────────────────────── */

function PropertyDetail({
  k, m, expenses, onBack, onAddExpense,
}: {
  k: PortfolioKpis
  m: PropertyMetrics
  expenses: Expense[]
  onBack: () => void
  onAddExpense: (id: string) => void
}) {
  const [tab, setTab] = useState<'rent' | 'months' | 'expenses'>('rent')

  const apolloStats = (() => {
    const paying = APOLLO_TENANTS.filter((t) => !t.isParking)
    const parking = APOLLO_TENANTS.filter((t) => t.isParking)
    // Averages cover dwelling lots only; a $100 parking space is not a lot rate.
    const rents = paying.map((t) => t.amountDue).sort((a, b) => a - b)
    const lotMonthly = rents.reduce((a, b) => a + b, 0)
    const parkingMonthly = parking.reduce((a, t) => a + t.amountDue, 0)
    const mid = Math.floor(rents.length / 2)
    return {
      lotMonthly,
      parkingMonthly,
      parkingCount: parking.length,
      monthly: lotMonthly + parkingMonthly,
      avg: lotMonthly / rents.length,
      median: rents.length % 2 ? rents[mid] : (rents[mid - 1] + rents[mid]) / 2,
      min: rents[0],
      max: rents[rents.length - 1],
      water: paying.length * APOLLO_WATER_CHARGE,
    }
  })()

  const mine = expenses.filter((e) => e.propertyId === m.property.id)
  const roll = rollup(mine)
  const noiAfterExpenses = m.netAfterTax - roll.operating

  return (
    <>
      <div className="page-head">
        <button className="btn ghost sm" onClick={onBack} style={{ marginBottom: 12 }}>← All properties</button>
        <h1 className="page-title">{m.property.name}</h1>
        <p className="page-sub">
          {m.property.address}{m.property.city !== 'Unconfirmed' ? ` · ${m.property.city}, ${m.property.state}` : ''}
          {m.property.notes && <><br />{m.property.notes}</>}
        </p>
      </div>

      <div className="kpi-grid">
        <Kpi accent label="Gross income 2025" value={money(m.collected)} note={`${pct(m.portfolioSharePct)} of the portfolio`} />
        <Kpi label={`Property tax (${m.property.taxBillYear})`} value={money(m.taxBill)} note={`${pct(m.taxLoadPct)} of gross`} warn />
        <Kpi accent label="Net after tax" value={money(m.netAfterTax)} />
        <Kpi label="Logged expenses" value={money(roll.total)}
          note={roll.count ? `${roll.count} entries · ${money(roll.operating)} operating` : 'None logged yet'} />
        <Kpi label="Net after tax & expenses" value={money(noiAfterExpenses)} note="Capital spend excluded" />
        <Kpi label={m.property.id === 'apollo' ? 'Lots' : 'Units'}
          value={m.property.id === 'apollo'
            ? num(APOLLO_TENANTS.filter((t) => !t.isParking).length)
            : m.unitCount ? num(m.unitCount) : '—'}
          note={m.property.id === 'apollo'
            ? `plus ${APOLLO_TENANTS.filter((t) => t.isParking).length} tandem parking spaces`
            : m.unitCount ? `${m.occupiedUnits} occupied · ${m.vacantUnits} vacant` : 'Reported as a single annual figure'} />
        {m.property.id === 'apollo' ? (
          // Occupancy, WALT and expiry mean nothing on month-to-month lots —
          // show what actually varies between them instead of six dashes.
          <>
            <Kpi label="Average lot" value={money(apolloStats.avg)} note={`Median ${money(apolloStats.median)}`} />
            <Kpi label="Cheapest lot" value={money(apolloStats.min)} />
            <Kpi label="Priciest lot" value={money(apolloStats.max)} />
            <Kpi label="Billed monthly" value={money(apolloStats.monthly)}
              note={`${money(apolloStats.lotMonthly)} lots + ${money(apolloStats.parkingMonthly)} parking · ${money(apolloStats.monthly * 12)} a year`} />
            <Kpi label="Parking" value={money(apolloStats.parkingMonthly)}
              note={`${apolloStats.parkingCount} spaces at ${money(APOLLO_PARKING_RENT)} a month`} />
            <Kpi label="Water recovery" value={money(apolloStats.water)}
              note={`${money(APOLLO_WATER_CHARGE)} per lot, included in the amount due`} />
            <Kpi label="Base lot rent" value={money(apolloStats.lotMonthly - apolloStats.water)} note="Monthly, net of water" />
          </>
        ) : (
          <>
            <Kpi label="Occupancy" value={m.unitCount ? pct(m.physicalOccupancyPct, 0) : '—'}
              note={m.unitCount ? `${pct(m.economicOccupancyPct)} economic` : undefined} />
            <Kpi label="WALT" value={m.walt > 0 ? `${m.walt.toFixed(2)} yr` : '—'}
              note={m.expiredCount ? `${m.expiredCount} lease${m.expiredCount === 1 ? '' : 's'} already lapsed` : undefined}
              warn={m.expiredCount > 0} />
            <Kpi label="Expiring within a year" value={num(m.expiringNext12)} note={money(m.rentAtRiskNext12)} warn={m.expiringNext12 > 0} />
            <Kpi label="Largest tenant" value={m.largestTenant ? pct(m.largestTenant.sharePct) : '—'} small note={m.largestTenant?.tenant} />
            <Kpi label="Vacancy & free rent" value={money(m.vacancyLoss + m.concessionLoss)} note={`${m.darkMonths} dark months`} />
            <Kpi label="December monthly rent" value={money(m.exitMonthlyRent)} note={`${money(m.runRate)} annualised`} />
        {m.leases.length > 0 && (
          <Kpi label="Lease structure"
            value={leaseStructureLabel(m.leases.map((l) => l.leaseType))}
            small
            note={m.leases.every((l) => l.leaseType === 'NNN')
              ? 'Tenants reimburse taxes, insurance and CAM'
              : 'Landlord carries the operating costs'} />
        )}
          </>
        )}
      </div>

      <div className="section">
        <div className="chip-row" style={{ marginBottom: 14 }}>
          <button className={`chip${tab === 'rent' ? ' active' : ''}`} onClick={() => setTab('rent')}>Rent roll</button>
          <button className={`chip${tab === 'months' ? ' active' : ''}`} onClick={() => setTab('months')}>Month by month</button>
          <button className={`chip${tab === 'expenses' ? ' active' : ''}`} onClick={() => setTab('expenses')}>
            Expenses {roll.count > 0 && <span style={{ opacity: 0.75 }}>{roll.count}</span>}
          </button>
        </div>

        {tab === 'rent' && (
          m.property.id === 'apollo'
            ? (
              <>
                <p className="page-sub" style={{ marginTop: 0 }}>
                  {APOLLO_TENANTS.filter((t) => !t.isParking).length} lots plus{' '}
                  {APOLLO_TENANTS.filter((t) => t.isParking).length} tandem parking spaces at{' '}
                  {money(APOLLO_PARKING_RENT)} a month. Lots come from the {APOLLO_REGISTRY_LABEL}; the
                  parking count and rate come from the owner. Everything here is month to month, so there
                  are no lease end dates or annual bumps to show. The 2025 sheet gives Apollo only as an annual total, which is why
                  the month-by-month tab shows it spread evenly rather than measured.
                </p>
                <ApolloRoll tenants={[...APOLLO_TENANTS].sort((a, b) => a.name.localeCompare(b.name))} />
              </>
            )
            : m.leases.length === 0
            ? <Empty>This property is reported as a single annual figure with no unit-level detail.</Empty>
            : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Unit</th><th>Tenant</th><th>Lease term</th><th>Status</th>
                      <th className="num">Jan rent</th><th className="num">Dec rent</th>
                      <th className="num">Bump</th><th className="num">2025 total</th><th>Contacts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...m.leases].sort((a, b) => collected(b) - collected(a)).map((l) => {
                      const first = l.months.find((x) => !isDark(x))
                      const realised = realisedEscalationPct(l)
                      return (
                        <tr key={l.id}>
                          <td className="t-mono">{l.unit}</td>
                          <td>
                            <div className="t-strong">{l.tenant}</div>
                            {l.notes && <div className="t-mute" style={{ fontSize: 11.5, maxWidth: 320 }}>{l.notes}</div>}
                          </td>
                          <td className="t-mono t-mute t-nowrap" style={{ fontSize: 12 }}>
                            {dateLabel(l.leaseStart)}<br />{dateLabel(l.leaseEnd)}
                          </td>
                          <td><ExpiryBadge lease={l} asOf={k.asOf} /></td>
                          <td className="num">{first !== undefined ? money(cellAmount(first)) : <span className="t-mute">—</span>}</td>
                          <td className="num">{money(m.leases.length ? lastNumeric(l.months) : 0)}</td>
                          <td className="num">
                            {realised === undefined ? <span className="t-mute">—</span> : (
                              <span className={realised < (l.statedEscalationPct ?? 0) - 0.75 ? 't-red' : ''}>
                                {signedPct(realised, 1)}
                                {l.statedEscalationPct !== undefined && (
                                  <span className="t-mute" style={{ fontSize: 11 }}> / {l.statedEscalationPct}%</span>
                                )}
                              </span>
                            )}
                          </td>
                          <td className="num t-strong">{money(collected(l))}</td>
                          <td className="t-mute" style={{ fontSize: 11.5 }}>
                            {l.contacts.length === 0 ? '—' : l.contacts.map((c, i) => (
                              <div key={i} className="t-nowrap">{c.name ? `${c.name} · ` : ''}{c.phone}</div>
                            ))}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="label" colSpan={7}>{m.leases.length} units</td>
                      <td className="num">{money(m.collected)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )
        )}

        {tab === 'months' && (
          <>
            <Card title="Income by month">
              <MonthlyAreaChart series={m.monthly} label={m.property.name} />
            </Card>
            {m.leases.length > 0 && (
              <Card title="Unit by month" hint="V = vacant, FREE = concession">
                <div className="table-wrap" style={{ border: 0 }}>
                  <table>
                    <thead>
                      <tr><th>Unit</th><th>Tenant</th>{MONTHS.map((mo) => <th key={mo} className="num">{mo}</th>)}<th className="num">Total</th></tr>
                    </thead>
                    <tbody>
                      {m.leases.map((l) => (
                        <tr key={l.id}>
                          <td className="t-mono t-mute">{l.unit}</td>
                          <td className="t-strong t-nowrap">{l.tenant}</td>
                          {l.months.map((cell, i) => (
                            <td key={i} className="num" style={{ fontSize: 12 }}>
                              {cell === 'V' ? <span className="badge critical">V</span>
                                : cell === 'FREE' ? <span className="badge warn">FREE</span>
                                : money(cell)}
                            </td>
                          ))}
                          <td className="num t-strong">{money(collected(l))}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td className="label" colSpan={2}>Total</td>
                        {m.monthly.map((v, i) => <td key={i} className="num">{money(v)}</td>)}
                        <td className="num">{money(m.collected)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Card>
            )}
          </>
        )}

        {tab === 'expenses' && (
          <>
            <div className="toolbar">
              <button className="btn primary" onClick={() => onAddExpense(m.property.id)}>+ Add expense for {m.property.name}</button>
            </div>
            {mine.length === 0 ? (
              <Empty>No expenses logged for this property yet.</Empty>
            ) : (
              <>
                <div className="kpi-grid" style={{ marginBottom: 14 }}>
                  <Kpi label="Total" value={money(roll.total)} note={`${roll.count} entries`} />
                  <Kpi label="Operating" value={money(roll.operating)} note={`${((roll.operating / m.collected) * 100).toFixed(1)}% of gross`} />
                  <Kpi label="Capital" value={money(roll.capital)} />
                  <Kpi label="Net after tax & operating" value={money(noiAfterExpenses)} />
                </div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Date</th><th>Category</th><th>Type</th><th>Paid to</th><th>Description</th><th className="num">Amount</th></tr></thead>
                    <tbody>
                      {[...mine].sort((a, b) => b.date.localeCompare(a.date)).map((e) => (
                        <tr key={e.id}>
                          <td className="t-mono t-nowrap">{e.date}</td>
                          <td>{e.category}</td>
                          <td><span className={`badge ${e.kind === 'capital' ? 'mute' : 'ok'}`}>{e.kind === 'capital' ? 'Capital' : 'Operating'}</span></td>
                          <td className="t-strong">{e.vendor}</td>
                          <td className="t-mute">{e.description || '—'}</td>
                          <td className="num t-strong">{money(e.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr><td className="label" colSpan={5}>Total</td><td className="num">{money(roll.total)}</td></tr></tfoot>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  )
}

/** "Triple net", "Modified gross", or a mix if the property has both. */
function leaseStructureLabel(types: string[]): string {
  const unique = [...new Set(types)]
  if (unique.length > 1) return 'Mixed'
  const label: Record<string, string> = {
    NNN: 'Triple net', MG: 'Modified gross', GROSS: 'Full service', UNKNOWN: 'Not stated',
  }
  return label[unique[0]] ?? 'Not stated'
}

function lastNumeric(months: readonly (number | 'V' | 'FREE')[]): number {
  for (let i = months.length - 1; i >= 0; i--) {
    const m = months[i]
    if (typeof m === 'number') return m
  }
  return 0
}
