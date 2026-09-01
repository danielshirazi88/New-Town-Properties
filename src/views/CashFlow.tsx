import { Card, Empty, Kpi } from '../components/ui'
import { money, moneyShort, num, pct } from '../lib/format'
import { cashFlow, cashFlowTotals, TAX_INSTALMENTS } from '../lib/cashflow'
import type { CashMonth } from '../lib/cashflow'
import type { AssetRegister } from '../lib/assets'
import type { PortfolioKpis } from '../lib/portfolio'

/**
 * The year ahead: what arrives, what leaves, and when.
 *
 * Deliberately a cash view rather than an income one. It carries no operating
 * allowance, because an allowance is an estimate and this screen is for
 * planning around real dates — so it will read higher than net income until the
 * actual costs are logged, and it says so rather than quietly splitting the
 * difference.
 */
export function CashFlowView({
  k, register, onNav,
}: {
  k: PortfolioKpis
  register: AssetRegister
  onNav: (tab: string) => void
}) {
  const monthlyRent = k.exitMonthlyRent + k.apolloMonthlyBilled
  const rows = cashFlow({ monthlyRent, annualTax: k.totalTaxes, register }, k.asOf)
  const totals = cashFlowTotals(rows)

  if (!totals) return <Empty>Nothing to project.</Empty>

  const peak = Math.max(...rows.map((r) => Math.max(r.inflow, Math.abs(r.outflow))), 1)

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Cash flow</h1>
        <p className="page-sub">
          The next twelve months from today, {k.asOf.toLocaleDateString('en-US',
            { month: 'long', day: 'numeric', year: 'numeric' })}. Rent at the rate currently
          billing, the property tax bills as they fall, and interest landing with the certificate
          it belongs to.
        </p>
      </div>

      <div className="kpi-grid">
        <Kpi accent label="Net over the year" value={money(totals.net)}
          note={`${money(totals.inflow)} in, ${money(Math.abs(totals.outflow))} out`} />
        <Kpi accent label="A normal month" value={money(monthlyRent)}
          note="Rent and lot fees, before the tax bills land" />
        <Kpi label="Tightest month" value={money(totals.tightest.net)}
          note={`${totals.tightest.label} — a tax instalment falls`}
          warn={totals.tightest.net < 0} />
        <Kpi label="Months in deficit" value={num(totals.negativeMonths)}
          note={totals.negativeMonths > 0 ? 'More leaves than arrives' : 'None'}
          warn={totals.negativeMonths > 0} />
        <Kpi label="Principal maturing" value={moneyShort(totals.maturingPrincipal)}
          note={`${money(totals.maturingPrincipal)} of certificates to roll or move`} />
        <Kpi label="Interest earned" value={money(rows.reduce((a, r) =>
          a + r.events.filter((e) => e.kind === 'interest').reduce((x, e) => x + e.amount, 0), 0))}
          note="Paid at maturity, not spread across the year" />
      </div>

      <div className="callout neutral">
        <div className="callout-title">Two things this screen assumes, and one it leaves out</div>
        <p>
          <strong>The tax bills are real; their timing is modelled.</strong> Illinois bills a year
          in arrears in two instalments, taken here as{' '}
          {TAX_INSTALMENTS.map((t) => `${Math.round(t.share * 100)}% in month ${t.month}`).join(' and ')}.
          The amounts come off the rent rolls. The months are an assumption — the two deficits below
          move if the dates do.
        </p>
        <p>
          <strong>A certificate maturing is not income.</strong> {money(totals.maturingPrincipal)} of
          principal comes back inside the year, and it is the same money in a different place.
          It is tracked as a decision falling due rather than added to any month; only the interest
          counts.
        </p>
        <p>
          <strong>Operating costs are not in here.</strong> Insurance, water, maintenance and
          management have never been recorded, so the only outgoing below is property tax. Every
          net figure on this page is therefore higher than what actually reaches the bank.{' '}
          <button className="link" onClick={() => onNav('expenses')}>Log real costs</button> and
          they will appear.
        </p>
      </div>

      <div className="section">
        <Card title="Month by month" hint="rent in, tax out, interest at maturity">
          <FlowBars rows={rows} peak={peak} />
        </Card>
      </div>

      <div className="section">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th className="num">In</th>
                <th className="num">Out</th>
                <th className="num">Net</th>
                <th className="num">Running</th>
                <th>What happens</th>
                <th className="num">Principal maturing</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className="t-strong t-nowrap">{r.label}</td>
                  <td className="num">{money(r.inflow)}</td>
                  <td className="num t-mute">{r.outflow < 0 ? money(r.outflow) : '—'}</td>
                  <td className={`num t-strong ${r.net < 0 ? 't-red' : ''}`}>{money(r.net)}</td>
                  <td className="num t-mute">{money(r.running)}</td>
                  <td className="t-mute" style={{ fontSize: 12, maxWidth: 340 }}>
                    {r.events.filter((e) => e.kind !== 'rent').map((e) => (
                      <div key={e.id}>
                        {e.label}
                        {e.assumedTiming && (
                          <span className="badge mute" style={{ marginLeft: 6 }}>timing assumed</span>
                        )}
                      </div>
                    ))}
                    {r.events.every((e) => e.kind === 'rent') && <span>Rent only</span>}
                  </td>
                  <td className="num t-mute">
                    {r.maturingPrincipal > 0 ? (
                      <span title={r.maturing.map((m) => `${m.institution} ${money(m.principal)}`).join('\n')}>
                        {money(r.maturingPrincipal)}
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="label">Twelve months</td>
                <td className="num">{money(totals.inflow)}</td>
                <td className="num">{money(totals.outflow)}</td>
                <td className="num">{money(totals.net)}</td>
                <td className="num">—</td>
                <td />
                <td className="num">{money(totals.maturingPrincipal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="section">
        <Card
          title="Certificates coming due"
          hint={`${money(totals.maturingPrincipal)} to roll, move or spend`}
        >
          {totals.maturingPrincipal === 0 ? (
            <Empty>Nothing matures inside the year.</Empty>
          ) : (
            <div className="table-wrap" style={{ border: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Matures</th><th>Institution</th>
                    <th className="num">Principal</th><th className="num">Interest over the term</th>
                    <th className="num">Share of the deposits</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.flatMap((r) => r.maturing.map((m) => (
                    <tr key={m.id}>
                      <td className="t-mono t-nowrap">{m.date}</td>
                      <td className="t-mute">{m.institution}</td>
                      <td className="num t-strong">{money(m.principal)}</td>
                      <td className="num t-mute">{money(m.interest)}</td>
                      <td className="num t-mute">
                        {pct((m.principal / totals.maturingPrincipal) * 100, 1)}
                      </td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  )
}

/**
 * Net by month.
 *
 * Bars run from a zero line rather than from the floor, because a month that
 * takes more than it brings is a different kind of month and should not be a
 * short bar among tall ones.
 */
function FlowBars({ rows, peak }: { rows: CashMonth[]; peak: number }) {
  const W = 1000
  const H = 240
  const padL = 56
  const padR = 14
  const padT = 20
  const padB = 40
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const max = Math.max(...rows.map((r) => Math.abs(r.net)), peak * 0.2, 1)
  const zero = padT + innerH / 2
  const bw = innerW / rows.length

  return (
    <div className="chart-shell">
      <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label="Net cash by month for the year ahead">
        <line className="axis-line" x1={padL} x2={W - padR} y1={zero} y2={zero} />
        {rows.map((r, i) => {
          const h = (Math.abs(r.net) / max) * (innerH / 2)
          const up = r.net >= 0
          const x = padL + i * bw + 1
          const w = Math.max(bw - 2, 1)
          return (
            <g key={r.key}>
              <rect
                x={x} y={up ? zero - h : zero} width={w} height={Math.max(h, 2)} rx={4}
                fill={up ? '#5c8fa8' : '#d33a3b'}
              >
                <title>{`${r.label}: ${money(r.net)}`}</title>
              </rect>
              <text className="mark-label" x={x + w / 2} y={up ? zero - h - 6 : zero + h + 14}
                textAnchor="middle">
                {moneyShort(r.net)}
              </text>
              <text className="axis-text" x={x + w / 2} y={H - 14} textAnchor="middle">
                {r.label}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="legend">
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: '#5c8fa8' }} />More arrives than leaves
        </span>
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: '#d33a3b' }} />A tax instalment falls
        </span>
      </div>
    </div>
  )
}
