import { LadderChart, MonthPropertyHeatmap, MonthlyAreaChart, RankedBars, Sparkline } from '../components/charts'
import { Card, Kpi } from '../components/ui'
import { MONTHS, collected } from '../lib/finance'
import { money, moneyShort, num, pct, signedPct } from '../lib/format'
import type { PortfolioKpis } from '../lib/portfolio'
import { rentRoll } from '../data/rentRolls'
import type { Expense } from '../lib/expenses'
import { rollup } from '../lib/expenses'
import {
  MONTH_NAMES, chargesForYear, statusOf, trackedCharges,
  type CollectionSettings, type Payment,
} from '../lib/receivables'
import { DEBT_FREE_CONFIRMED_ON, VALUE_CLASSES, estateIncome, estateValue, valueSlices } from '../lib/estate'
import { blendedRate, maturities, type AssetRegister } from '../lib/assets'
import type { ResolvedHolding } from '../lib/trust'
import { DonutChart, categoryColour } from '../components/charts'

export function Dashboard({
  k, expenses, payments, collection, register, holdings, opexLoadPct, onProperty, onNav,
}: {
  k: PortfolioKpis
  expenses: Expense[]
  payments: Payment[]
  collection: CollectionSettings
  /** Deposits and vehicles — the income that is not rent. */
  register: AssetRegister
  /** The trust's schedule, which is the register of what is owned. */
  holdings: ResolvedHolding[]
  /** The operating allowance the valuation screen is set to, so both agree. */
  opexLoadPct: number
  onProperty: (id: string) => void
  onNav: (tab: string) => void
}) {
  // Rent is one source of income, not the whole of it. These put the property
  // and the deposits on the same footing before either is quoted.
  const income = estateIncome(
    k.grossCollected, k.totalTaxes, register, opexLoadPct, k.reportedMonths,
  )
  const worth = estateValue(holdings, register)
  // Hue follows the class, not the row: a slice that moves up the order when a
  // certificate matures keeps the colour the reader already learned.
  const slices = valueSlices(worth)
    .map((s) => ({ ...s, colour: categoryColour(s.id, VALUE_CLASSES) }))
  const blended = blendedRate(register)
  const due = maturities(register, k.asOf)
  const matured = due.filter((m) => m.matured)
  const dueSoon = due.filter((m) => !m.matured && m.daysAway <= 90)
  const maturingSoon = dueSoon.reduce((a, m) => a + m.investment.balance, 0)
  // Rent still arriving from tenants whose lease end date has passed — the
  // figure that says how much income is running without a contract behind it.
  const holdoverRent = k.holdoverLeases.reduce((a, l) => a + collected(l), 0)

  const heatRows = [...k.properties]
    .sort((a, b) => b.collected - a.collected)
    .map((p) => ({ id: p.property.id, name: p.property.name, values: p.monthly, total: p.collected }))

  const ranked = [...k.properties].sort((a, b) => b.collected - a.collected)

  // Collection, for the month a rent cheque would actually be arriving. When the
  // rent roll is a past year there is no "this month", so fall back to the last
  // month it bills for rather than showing an empty panel.
  const month = (() => {
    const charges = trackedCharges(
      chargesForYear(k.properties.flatMap((p) => p.leases), k.fiscalYear,
      { reportedMonths: rentRoll(k.fiscalYear).monthsReported, carryForward: true }),
      collection.startPeriod,
    )
    if (charges.length === 0) return undefined
    const today = k.asOf
    const target = today.getFullYear() === k.fiscalYear
      ? today.getMonth()
      : Math.max(...charges.map((c) => c.month))
    const forMonth = charges.filter((c) => c.month === target)
    if (forMonth.length === 0) return undefined
    const statuses = forMonth.map((c) => statusOf(c, payments, today, collection))
    return {
      index: target,
      isCurrent: today.getFullYear() === k.fiscalYear,
      billed: statuses.reduce((a, s) => a + s.charge.amountDue, 0),
      paid: statuses.reduce((a, s) => a + s.paid, 0),
      outstanding: statuses.reduce((a, s) => a + s.balance, 0),
      lateFees: statuses.reduce((a, s) => a + s.lateFee, 0),
      settled: statuses.filter((s) => s.state === 'paid').length,
      late: statuses.filter((s) => s.state === 'late').length,
      count: statuses.length,
    }
  })()
  const exp = rollup(expenses)
  const netOfExpenses = k.netAfterTax - exp.operating

  return (
    <>
      <div className="page-head">
        <h1 className="welcome">Welcome, <em>Mr. Shirazi</em></h1>
        <p className="page-sub">
          {k.propertyCount} properties · {num(k.unitCount)} commercial units · {k.apolloLots} mobile-home
          lots · {num(register.investments.length)} bank accounts. The estate first, then the
          property behind it; each tab on the left goes further into one part.
          Lease timing is measured from today,{' '}
          {k.asOf.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.
          <br />
          <span className="t-mute">
            Gross reads $150 above the workbook's printed $2,931,319.32 — one row total on the sheet
            disagrees with its own monthly cells. See Data integrity.
          </span>
        </p>
      </div>

      {/* ── The whole estate, before anything is broken down ─────────────── */}
      <div className="section">
        <div className="section-title">
          What the estate earns
          <span className="hint">
            property and deposits together, for a full year
            {income.annualised && ` · rent scaled up from ${income.monthsReported} months`}
          </span>
        </div>
        <div className="kpi-grid">
          <Kpi accent label="Net income a month" value={money(income.monthlyNet)}
            note="Everything, after property tax and running costs" />
          <Kpi accent label="Net income a year" value={money(income.totalNet)}
            note={`${money(income.propertyGross)} of rent and ${money(income.investmentIncome)} of interest`} />
          <Kpi label="From property" value={money(income.propertyNet)}
            note={`${pct((income.propertyNet / income.totalNet) * 100)} of the total · ${money(income.propertyNet / 12)} a month`} />
          <Kpi label="From investments" value={money(income.investmentIncome)}
            note={`${pct((income.investmentIncome / income.totalNet) * 100)} of the total · ${money(income.investmentIncome / 12)} a month`} />
          <Kpi label="What the estate is worth" value={moneyShort(worth.net)}
            note={worth.debt > 0
              ? `${money(worth.gross)} of assets, less ${money(worth.debt)} of debt`
              : `${money(worth.gross)} of assets, owned outright`} />
          <Kpi label="Yield on the whole estate" value={pct((income.totalNet / worth.net) * 100, 2)}
            note="Net income against what it is all worth" />
        </div>
        <p className="t-mute" style={{ fontSize: 12.5, marginTop: 10, lineHeight: 1.6 }}>
          Income before income tax and before anything personal — what the assets throw off, not
          what reaches a current account. There is no debt service to take off: the estate carries
          no mortgages, confirmed {new Date(`${DEBT_FREE_CONFIRMED_ON}T00:00:00`).toLocaleDateString('en-US',
            { month: 'long', day: 'numeric', year: 'numeric' })}. Rent is net of property tax and a{' '}
          {pct(opexLoadPct)} operating allowance for the costs the rent roll never captured;
          interest is at the rates on the certificates.{' '}
          <button className="link" onClick={() => onNav('valuation')}>Change the allowance</button>.
        </p>
      </div>

      {/* ── Where it comes from, and what it is made of ──────────────────── */}
      <div className="section">
        <div className="grid-2">
          <Card title="How the year's rent becomes income" hint="annualised, before income tax">
            <div className="table-wrap" style={{ border: 0 }}>
              <table>
                <tbody>
                  <tr><td>Gross rent</td><td className="num t-strong">{money(income.propertyGross)}</td></tr>
                  <tr><td className="t-mute">Less property tax</td><td className="num t-mute">− {money(income.propertyTaxes)}</td></tr>
                  <tr><td className="t-mute">Less operating allowance</td><td className="num t-mute">− {money(income.propertyOpex)}</td></tr>
                  <tr><td className="t-strong">Net from property</td><td className="num t-strong">{money(income.propertyNet)}</td></tr>
                  <tr><td>Interest on deposits</td><td className="num t-strong">{money(income.investmentIncome)}</td></tr>
                  <tr>
                    <td className="label">Net income</td>
                    <td className="num t-strong">{money(income.totalNet)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
          <Card title="What the estate is made of" hint={`${money(worth.gross)} across every holding`}>
            <DonutChart
              slices={slices}
              centreValue={moneyShort(worth.gross)}
              centreLabel="Total assets"
              onSelect={(id) => onNav(id === 'deposits' || id === 'vehicles' ? 'assets' : 'trust')}
            />
          </Card>
        </div>
      </div>

      {/* ── The deposits, which the dashboard used to ignore entirely ────── */}
      {register.investments.length > 0 && (
        <div className="section">
          <div className="section-title">
            Deposits and investments
            <span className="hint">
              <button className="link" onClick={() => onNav('assets')}>every account</button>
            </span>
          </div>
          <div className="kpi-grid">
            <Kpi accent label="Held on deposit" value={money(worth.deposits)}
              note={`${num(register.investments.length)} accounts`} />
            <Kpi accent label="Interest a year" value={money(income.investmentIncome)}
              note={`${money(income.investmentIncome / 12)} a month`} />
            <Kpi label="Blended rate" value={blended === undefined ? '—' : pct(blended, 2)}
              note="Across everything carrying a rate" />
            <Kpi label="Maturing within 90 days" value={money(maturingSoon)}
              note={dueSoon.length > 0
                ? `${num(dueSoon.length)} ${dueSoon.length === 1 ? 'account' : 'accounts'} — a decision each`
                : 'Nothing due'}
              warn={dueSoon.length > 0} />
            {matured.length > 0 && (
              <Kpi label="Already matured" value={num(matured.length)}
                note="Sitting uninvested" warn />
            )}
          </div>
        </div>
      )}

      {/* ── The property side on its own ─────────────────────────────────── */}
      <div className="section">
        <div className="section-title">
          Property income
          <span className="hint">
            as the {k.fiscalYear} sheet reports it — {k.reportedMonths} months, not annualised
          </span>
        </div>
      <div className="kpi-grid">
        <Kpi accent label={`Gross income ${k.fiscalYear}`} value={money(k.grossCollected)}
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
          note={`Exit rent annualised · ${signedPct(k.runRateVsActualPct)} vs ${k.fiscalYear}`} />
      </div>
      </div>

      {k.apolloBasis === 'derived' && (
        <div className="callout" style={{ marginBottom: 18 }}>
          <div className="callout-title">
            Apollo's {k.fiscalYear} income is worked out from the tenant registry, not read off
            the rent roll
          </div>
          <p>
            {k.apolloNote} It comes to {money(k.apolloGross)} across the {k.reportedMonths} months
            the sheet covers, and it is included in every total on this page — so the figures are
            complete, but that part of them is an estimate rather than a transcription.
          </p>
        </div>
      )}

      {/* ── Rent collection, this month ──────────────────────────────────── */}
      {month && (
        <div className="section">
          <div className="section-title">
            Rent collection — {MONTH_NAMES[month.index]} {k.fiscalYear}
            <span className="hint">
              {month.isCurrent ? 'the current month' : 'the last month this rent roll bills for'}
            </span>
            <span style={{ marginLeft: 'auto' }}>
              <button className="btn sm" onClick={() => onNav('accounting')}>Record a payment</button>
            </span>
          </div>
          {payments.length === 0 ? (
            <div className="callout">
              <div className="callout-title">Collection tracking is set up but nothing has been recorded</div>
              <p>
                {money(month.billed)} of rent is billed across {num(month.count)} tenants for{' '}
                {MONTH_NAMES[month.index]}. Mark each one as it comes in and this panel, the
                receivables ledger and the payer analytics all fill in from those entries.
              </p>
            </div>
          ) : (
            <div className="kpi-grid">
              <Kpi accent label="Billed this month" value={money(month.billed)}
                note={`${num(month.count)} tenants`} />
              <Kpi accent label="Collected" value={money(month.paid)}
                note={month.billed > 0 ? `${pct((month.paid / month.billed) * 100)} of billed` : undefined} />
              <Kpi label="Still outstanding" value={money(month.outstanding)}
                note={`${num(month.count - month.settled)} of ${num(month.count)} unsettled`}
                warn={month.outstanding > 0} />
              <Kpi label="Past grace" value={num(month.late)}
                note={month.lateFees > 0 ? `${money(month.lateFees)} in late fees` : 'No late fees'}
                warn={month.late > 0} />
              <Kpi label="Paid in full" value={`${num(month.settled)} of ${num(month.count)}`}
                note="Tenants settled for the month" />
            </div>
          )}
        </div>
      )}

      {/* ── What needs attention ─────────────────────────────────────────── */}
      <div className="section">
        <div className="section-title">Needs attention</div>
        <div className="kpi-grid">
          <Kpi accent label="Tenants on holdover" value={num(k.holdoverLeases.length)}
            note={k.holdoverLeases.length > 0
              ? `${money(holdoverRent)} of rent past a lease end date`
              : 'Every paying tenant is inside its term'}
            warn={k.holdoverLeases.length > 0} />
          <Kpi label="Lapsed and vacant" value={num(k.vacatedLeases.length)}
            note={k.vacatedLeases.length > 0 ? 'Units to re-let' : 'None'}
            warn={k.vacatedLeases.length > 0} />
          <Kpi label="Expiring within 12 months" value={num(k.expiring12.length)}
            note={`${money(k.rentAtRisk12)} at risk`} warn />
          <Kpi label="Escalations not taken" value={num(k.bumpsNotTaken.length)}
            note={`${money(k.totalForgoneFromMissedBumps)} left on the table`} warn />
          {k.unitsOnMarket > 0 && (
            <Kpi label="Empty space on the market" value={`${money(k.askingRentMonthly)}/mo`}
              note={`${k.unitsOnMarket} units · ${money(k.askingRentAnnual)} a year at the asking rents`}
              warn />
          )}
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
              <span className="kpi-label">Commercial Jan → {MONTHS[k.reportedMonths - 1]}</span>
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
              <span className="kpi-label">Apollo</span>
              <span className="t-mono t-mute">
                {money(k.apolloGross / k.reportedMonths)}/mo
                {k.apolloBasis === 'derived' ? ' from the registry' : ' assumed flat'}
              </span>
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
          <Card title={`Gross income ${k.fiscalYear}`}>
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
          {k.totalSquareFeet > 0 && (
            <>
              <Kpi label="Rentable area" value={`${Math.round(k.totalSquareFeet / 1000)}k sf`}
                note={`${k.totalSquareFeet.toLocaleString()} sq ft recorded`} />
              <Kpi accent label="Rent per sq ft" value={`$${k.rentPerSqFt.toFixed(2)}`}
                note="Annualised across let space" />
              <Kpi label="Occupancy (area)" value={pct(k.occupancyBySqFtPct)}
                note={`${k.vacantSquareFeet.toLocaleString()} sq ft empty`} />
            </>
          )}
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
                <th className="num">{k.fiscalYear} rent</th>
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
