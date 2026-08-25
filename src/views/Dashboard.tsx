import { LadderChart, MonthPropertyHeatmap, MonthlyAreaChart, RankedBars, Sparkline } from '../components/charts'
import { Card, Kpi } from '../components/ui'
import { MONTHS, collected } from '../lib/finance'
import { money, moneyShort, num, pct, signedPct } from '../lib/format'
import type { PortfolioKpis } from '../lib/portfolio'
import type { Expense } from '../lib/expenses'
import { rollup } from '../lib/expenses'

export function Dashboard({
  k, expenses, onProperty, onNav,
}: {
  k: PortfolioKpis
  expenses: Expense[]
  onProperty: (id: string) => void
  onNav: (tab: string) => void
}) {
  const heatRows = [...k.properties]
    .sort((a, b) => b.collected - a.collected)
    .map((p) => ({ id: p.property.id, name: p.property.name, values: p.monthly, total: p.collected }))

  const ranked = [...k.properties].sort((a, b) => b.collected - a.collected)
  const exp = rollup(expenses)
  const netOfExpenses = k.netAfterTax - exp.operating

  return (
    <>
      <div className="page-head">
        <h1 className="welcome">Welcome, <em>Mr. Shirazi</em></h1>
        <p className="page-sub">
          {k.propertyCount} properties · {num(k.unitCount)} commercial units · {k.apolloLots} mobile-home lots.
          Figures are the 2025 rent roll; lease timing is measured from today,{' '}
          {k.asOf.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.
          <br />
          <span className="t-mute">
            Gross reads $150 above the workbook's printed $2,931,319.32 — one row total on the sheet
            disagrees with its own monthly cells. See Data integrity.
          </span>
        </p>
      </div>

      {/* ── The headline numbers ─────────────────────────────────────────── */}
      <div className="kpi-grid">
        <Kpi accent label="Gross income 2025" value={money(k.grossCollected)}
          note={`${money(k.avgMonth + k.apolloGross / 12)} average month`} />
        <Kpi accent label="Net after property tax" value={money(k.netAfterTax)}
          note={`${pct(100 - k.taxLoadPct)} of gross retained`} />
        <Kpi label="Property taxes" value={money(k.totalTaxes)}
          note={`${pct(k.taxLoadPct)} of gross income`} warn />
        <Kpi label="Logged expenses" value={money(exp.total)}
          note={exp.count === 0 ? 'None entered yet — add them in Expenses' : `${exp.count} entries · ${money(exp.operating)} operating`} />
        <Kpi label="Net after tax & expenses" value={money(netOfExpenses)}
          note="Operating expenses only; capital spend excluded" />
        <Kpi label="Forward run rate" value={money(k.forwardRunRate)}
          note={`December rent annualised · ${signedPct(k.runRateVsActualPct)} vs 2025`} />
      </div>

      {/* ── What needs attention ─────────────────────────────────────────── */}
      <div className="section">
        <div className="section-title">Needs attention</div>
        <div className="kpi-grid">
          <Kpi accent label="Leases already lapsed" value={num(k.expiredLeases.length)}
            note={`${money(k.rentOnExpiredLeases)} of rent on holdover`} warn />
          <Kpi label="Expiring within 12 months" value={num(k.expiring12.length)}
            note={`${money(k.rentAtRisk12)} at risk`} warn />
          <Kpi label="Escalations not taken" value={num(k.bumpsNotTaken.length)}
            note={`${money(k.totalForgoneFromMissedBumps)} left on the table`} warn />
          <Kpi label="Vacancy & free rent" value={money(k.vacancyLoss + k.concessionLoss)}
            note={`${k.totalDarkMonths} months collected nothing`} warn />
          <Kpi label="Vacant unit at 1211 S Prairie" value={money(15080)}
            note="A year of tax on a unit earning nothing" warn />
          <Kpi label="No end date on file" value={num(k.noEndDateLeases.length)}
            note="Leases with no expiration recorded" warn />
        </div>
      </div>

      {/* ── Monthly income, whole portfolio ──────────────────────────────── */}
      <div className="section">
        <div className="section-title">
          Income by month — all properties
          <span className="hint">
            {MONTHS[k.bestMonth.index]} was the strongest commercial month at {money(k.bestMonth.amount)};
            {' '}{MONTHS[k.worstMonth.index]} the weakest at {money(k.worstMonth.amount)}.
          </span>
        </div>
        <Card>
          <MonthlyAreaChart series={k.monthlyWithApollo} label="Portfolio income" />
          <div className="row" style={{ marginTop: 12, gap: 22 }}>
            <div className="stack">
              <span className="kpi-label">Commercial Jan → Dec</span>
              <span className="t-mono t-strong">{signedPct(k.janToDecGrowthPct)}</span>
            </div>
            <div className="stack">
              <span className="kpi-label">Average month</span>
              <span className="t-mono t-strong">{money(k.avgMonth + k.apolloGross / 12)}</span>
            </div>
            <div className="stack">
              <span className="kpi-label">December monthly rent</span>
              <span className="t-mono t-strong">{money(k.exitMonthlyRent + k.apolloGross / 12)}</span>
            </div>
            <div className="stack">
              <span className="kpi-label">Apollo (annual figure only)</span>
              <span className="t-mono t-mute">{money(k.apolloGross / 12)}/mo assumed flat</span>
            </div>
          </div>
        </Card>
      </div>

      {/* ── Month × property ─────────────────────────────────────────────── */}
      <div className="section">
        <div className="section-title">
          Every property, every month
          <span className="hint">Shading compares months within a property, so each row shows its own pattern.</span>
        </div>
        <Card>
          <MonthPropertyHeatmap rows={heatRows} onSelect={onProperty} />
        </Card>
      </div>

      {/* ── Property league table ────────────────────────────────────────── */}
      <div className="section">
        <div className="section-title">Properties by income</div>
        <div className="grid-2">
          <Card title="Gross income 2025">
            <RankedBars
              onSelect={onProperty}
              items={ranked.map((p) => ({
                id: p.property.id,
                label: p.property.name,
                value: p.collected,
                sub: `${pct(p.portfolioSharePct)} of portfolio`,
              }))}
            />
          </Card>
          <Card title="Net after property tax">
            <RankedBars
              onSelect={onProperty}
              items={ranked.map((p) => ({
                id: p.property.id,
                label: p.property.name,
                value: p.netAfterTax,
                sub: `${pct(p.taxLoadPct)} tax load`,
              }))}
            />
          </Card>
        </div>
      </div>

      {/* ── Small multiples ──────────────────────────────────────────────── */}
      <div className="section">
        <div className="section-title">
          Monthly shape, property by property
          <span className="hint">Each panel is scaled to its own range.</span>
        </div>
        <div className="sparks">
          {ranked.map((p) => (
            <div key={p.property.id} className="spark-card" style={{ cursor: 'pointer' }}
              onClick={() => onProperty(p.property.id)}>
              <div className="spark-name">{p.property.name}</div>
              <div className="spark-meta">
                {moneyShort(p.collected)} · {p.unitCount || '—'} {p.unitCount === 1 ? 'unit' : 'units'}
              </div>
              <Sparkline values={p.monthly} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Lease ladder ─────────────────────────────────────────────────── */}
      <div className="section">
        <div className="section-title">
          When the leases run out
          <span className="hint">Annual rent expiring by calendar year.</span>
        </div>
        <Card actions={<button className="btn sm" onClick={() => onNav('expirations')}>Open lease calendar</button>}>
          <LadderChart buckets={k.expirationLadder} />
        </Card>
      </div>

      {/* ── Risk & structure ─────────────────────────────────────────────── */}
      <div className="section">
        <div className="section-title">Portfolio risk & structure</div>
        <div className="kpi-grid">
          <Kpi label="Occupancy (units)" value={pct(k.physicalOccupancyPct)}
            note={`${k.occupiedUnits} of ${k.unitCount} units producing rent`} />
          <Kpi label="Economic occupancy" value={pct(k.economicOccupancyPct)}
            note="Collected against full-year potential" />
          <Kpi label="WALT" value={`${k.walt.toFixed(2)} yr`}
            note={`${k.waltActiveOnly.toFixed(2)} yr excluding lapsed leases`} />
          <Kpi label="Largest tenant" value={pct(k.largestTenantSharePct)} small
            note={k.topTenants[0]?.lease.tenant} />
          <Kpi label="Top 5 tenants" value={pct(k.top5TenantSharePct)}
            note="Share of portfolio income" />
          <Kpi label="Largest property" value={pct(k.largestPropertySharePct)}
            note={ranked[0]?.property.name} />
          <Kpi label="Tenant concentration" value={k.tenantHerfindahl.toFixed(3)}
            note="Herfindahl index — below 0.15 is well spread" />
          <Kpi label="Average escalation" value={pct(k.avgStatedEscalationPct, 2)}
            note={`${pct(k.avgRealisedEscalationPct, 2)} actually realised`} />
          <Kpi label="Rent at risk, 24 mo" value={money(k.rentAtRisk24)}
            note={`${k.expiring24.length} leases`} />
          <Kpi label="Heaviest tax load" value={pct(k.highestTaxLoad.taxLoadPct)} small
            note={k.highestTaxLoad.property.name} warn />
          <Kpi label="Lightest tax load" value={pct(k.lowestTaxLoad.taxLoadPct)} small
            note={k.lowestTaxLoad.property.name} />
          <Kpi label="Apollo average lot" value={money(k.apolloAvgLotRent)}
            note={`${k.apolloLots} lots · ${money(k.apolloMinLotRent)}–${money(k.apolloMaxLotRent)}`} />
        </div>
      </div>

      {/* ── Largest tenants ──────────────────────────────────────────────── */}
      <div className="section">
        <div className="section-title">Ten largest tenants by annual rent</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Property</th>
                <th>Unit</th>
                <th className="num">2025 rent</th>
                <th className="num">Share</th>
                <th>Lease ends</th>
              </tr>
            </thead>
            <tbody>
              {k.topTenants.slice(0, 10).map(({ lease, rent, sharePct }) => {
                const prop = k.properties.find((p) => p.property.id === lease.propertyId)
                return (
                  <tr key={lease.id} className="clickable" onClick={() => onProperty(lease.propertyId)}>
                    <td className="t-strong">{lease.tenant}</td>
                    <td className="t-mute">{prop?.property.name}</td>
                    <td className="t-mono t-mute">{lease.unit}</td>
                    <td className="num">{money(rent)}</td>
                    <td className="num t-mute">{pct(sharePct)}</td>
                    <td className="t-mono t-mute">{lease.leaseEnd ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="label" colSpan={3}>Top 10 combined</td>
                <td className="num">{money(k.topTenants.slice(0, 10).reduce((a, t) => a + t.rent, 0))}</td>
                <td className="num">{pct(k.topTenants.slice(0, 10).reduce((a, t) => a + t.sharePct, 0))}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Segment split ────────────────────────────────────────────────── */}
      <div className="section">
        <div className="section-title">Commercial vs Apollo</div>
        <div className="grid-2">
          <Card title="Commercial portfolio" hint="13 parcels">
            <div className="kpi-grid">
              <Kpi label="Gross" value={money(k.commercialGross)} />
              <Kpi label="Taxes" value={money(k.commercialTaxes)} />
              <Kpi label="Net" value={money(k.commercialNet)} />
              <Kpi label="Units" value={num(k.unitCount)} />
            </div>
          </Card>
          <Card title="Apollo Mobile Home Court" hint="trailer park">
            <div className="kpi-grid">
              <Kpi label="Gross" value={money(k.apolloGross)} />
              <Kpi label="Taxes" value={money(k.apolloTaxes)} />
              <Kpi label="Net" value={money(k.apolloNet)} />
              <Kpi label="Lots" value={num(k.apolloLots)} />
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}

/** Re-exported so the property view can share the dashboard's ranking logic. */
export const rankLeases = (leases: Parameters<typeof collected>[0][]) =>
  [...leases].sort((a, b) => collected(b) - collected(a))
