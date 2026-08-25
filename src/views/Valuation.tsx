import { useState } from 'react'
import { Card, Kpi } from '../components/ui'
import { money, moneyShort, pct } from '../lib/format'
import { CAP_RATE_CHOICES, DEFAULT_CAP_RATE, DEFAULT_OPEX_LOAD_PCT, valuationModel, type PortfolioKpis } from '../lib/portfolio'
import { valueAtCap } from '../lib/finance'
import { rollup, type Expense } from '../lib/expenses'

export function Valuation({ k, expenses, onProperty }: { k: PortfolioKpis; expenses: Expense[]; onProperty: (id: string) => void }) {
  const [cap, setCap] = useState<number>(DEFAULT_CAP_RATE)
  const [opexPct, setOpexPct] = useState<number>(DEFAULT_OPEX_LOAD_PCT)
  const [useLogged, setUseLogged] = useState(false)

  const logged = rollup(expenses)
  const effectiveOpexPct = useLogged && logged.operating > 0
    ? (logged.operating / k.grossCollected) * 100
    : opexPct

  const v = valuationModel(k, cap, effectiveOpexPct)

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Valuation</h1>
        <p className="page-sub">
          Nothing in the rent roll states a cap rate or an appraised value, so none is asserted here.
          Set the assumptions and the model follows them.
        </p>
      </div>

      <div className="callout">
        <div className="callout-title">Read this before quoting a number</div>
        <p>
          The workbook's "net income" subtracts <em>property taxes only</em>. It carries no insurance,
          water and sewer, maintenance, management, landscaping, snow removal or legal cost. Capitalising
          that figure would overstate the portfolio's worth, because the buyer inherits those costs too.
        </p>
        <p>
          The panel below therefore reports two values: one on the sheet's own basis, and one on a true NOI
          after an operating-expense allowance. Log real costs in Expenses and the allowance can be replaced
          with actuals.
        </p>
      </div>

      <Card title="Assumptions">
        <div className="row" style={{ gap: 22, alignItems: 'flex-end' }}>
          <label className="field" style={{ minWidth: 170 }}>
            <span>Cap rate</span>
            <select value={cap} onChange={(e) => setCap(Number(e.target.value))}>
              {CAP_RATE_CHOICES.map((c) => <option key={c} value={c}>{c.toFixed(1)}%</option>)}
            </select>
          </label>
          <label className="field" style={{ minWidth: 260 }}>
            <span>Operating expense allowance — {pct(effectiveOpexPct)} of gross</span>
            <input
              type="range" min={0} max={40} step={0.5} value={opexPct} disabled={useLogged && logged.operating > 0}
              onChange={(e) => setOpexPct(Number(e.target.value))}
            />
          </label>
          <label className="row" style={{ gap: 7, fontSize: 12.5, paddingBottom: 8 }}>
            <input type="checkbox" checked={useLogged} onChange={(e) => setUseLogged(e.target.checked)} style={{ minWidth: 'auto' }} />
            Use logged expenses instead
            {logged.operating > 0
              ? <span className="t-mute">({money(logged.operating)} operating)</span>
              : <span className="t-mute">(none logged yet)</span>}
          </label>
        </div>
      </Card>

      <div className="section">
        <div className="kpi-grid">
          <Kpi label="Gross income" value={money(k.grossCollected)} />
          <Kpi label="Less property taxes" value={`− ${money(k.totalTaxes)}`} note={pct(k.taxLoadPct) + ' of gross'} />
          <Kpi label="Less operating expenses" value={`− ${money(v.opex)}`} note={`${pct(effectiveOpexPct)} allowance`} />
          <Kpi accent label="True NOI" value={money(v.trueNoi)} note={`${pct(v.noiMarginPct)} margin`} />
          <Kpi label="Net on the sheet's basis" value={money(k.netAfterTax)} note="Taxes only, no other costs" />
          <Kpi accent label={`Value at ${cap.toFixed(1)}% cap`} value={moneyShort(v.valueOnTrueNoi)}
            note={`${money(v.valueOnTrueNoi)} on true NOI`} />
        </div>
      </div>

      <div className="section">
        <Card title="Value across cap rates" hint="on true NOI, and on the sheet's tax-only net">
          <div className="table-wrap" style={{ border: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Cap rate</th>
                  <th className="num">Value on true NOI</th>
                  <th className="num">Value on sheet net</th>
                  <th className="num">Difference</th>
                </tr>
              </thead>
              <tbody>
                {CAP_RATE_CHOICES.map((c) => {
                  const onTrue = valueAtCap(v.trueNoi, c)
                  const onSheet = valueAtCap(k.netAfterTax, c)
                  return (
                    <tr key={c} style={c === cap ? { background: 'var(--red-dim)' } : undefined}>
                      <td className="t-mono t-strong">{c.toFixed(1)}%</td>
                      <td className="num t-strong">{money(onTrue)}</td>
                      <td className="num t-mute">{money(onSheet)}</td>
                      <td className="num t-red">{money(onSheet - onTrue)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="section">
        <div className="section-title">Value by property <span className="hint">taxes and the same expense allowance applied to each</span></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Property</th>
                <th className="num">Gross</th>
                <th className="num">Taxes</th>
                <th className="num">Opex allowance</th>
                <th className="num">NOI</th>
                <th className="num">Margin</th>
                <th className="num">Value at {cap.toFixed(1)}%</th>
              </tr>
            </thead>
            <tbody>
              {[...k.properties].sort((a, b) => b.collected - a.collected).map((p) => {
                const own = expenses.filter((e) => e.propertyId === p.property.id && e.kind === 'operating')
                  .reduce((a, e) => a + e.amount, 0)
                const opex = useLogged && own > 0 ? own : p.collected * (effectiveOpexPct / 100)
                const noi = p.collected - p.taxBill - opex
                return (
                  <tr key={p.property.id} className="clickable" onClick={() => onProperty(p.property.id)}>
                    <td className="t-strong">{p.property.name}</td>
                    <td className="num">{money(p.collected)}</td>
                    <td className="num t-mute">{money(p.taxBill)}</td>
                    <td className="num t-mute">{money(opex)}</td>
                    <td className="num t-strong">{money(noi)}</td>
                    <td className="num t-mute">{pct((noi / p.collected) * 100)}</td>
                    <td className="num t-strong">{money(valueAtCap(noi, cap))}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="label">Portfolio</td>
                <td className="num">{money(k.grossCollected)}</td>
                <td className="num">{money(k.totalTaxes)}</td>
                <td className="num">{money(v.opex)}</td>
                <td className="num">{money(v.trueNoi)}</td>
                <td className="num">{pct(v.noiMarginPct)}</td>
                <td className="num">{money(v.valueOnTrueNoi)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  )
}
