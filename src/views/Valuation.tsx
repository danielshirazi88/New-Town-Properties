import { useState } from 'react'
import { Card, Kpi } from '../components/ui'
import { money, moneyShort, pct } from '../lib/format'
import { CAP_RATE_CHOICES, DEFAULT_CAP_RATE, DEFAULT_OPEX_LOAD_PCT, valuationModel, type PortfolioKpis } from '../lib/portfolio'
import { valueAtCap } from '../lib/finance'
import { rollup, type Expense } from '../lib/expenses'
import { rentRoll } from '../data/rentRolls'
import type { PropertyMetrics } from '../lib/finance'
import { BASIS_LABEL, appraisalsByProperty, impliedCapRate } from '../lib/trust'
import { APPRAISAL_DATE, TRUST_HOLDINGS } from '../data/trust'
import { dateLabel } from '../lib/format'

export function Valuation({ k, expenses, onProperty }: { k: PortfolioKpis; expenses: Expense[]; onProperty: (id: string) => void }) {
  const [cap, setCap] = useState<number>(DEFAULT_CAP_RATE)
  const [opexPct, setOpexPct] = useState<number>(DEFAULT_OPEX_LOAD_PCT)
  const [useLogged, setUseLogged] = useState(false)

  const logged = rollup(expenses)
  const effectiveOpexPct = useLogged && logged.operating > 0
    ? (logged.operating / k.grossCollected) * 100
    : opexPct

  const v = valuationModel(k, cap, effectiveOpexPct, rentRoll(k.fiscalYear).monthsReported)

  const appraisals = appraisalsByProperty(TRUST_HOLDINGS)

  // A cap rate is a rate per YEAR. On a part year the rent roll holds eight
  // months of income and the tax bill for all twelve, so comparing the two
  // straight would price every building as though it earned two-thirds of what
  // it does. Income is scaled to a full year; the tax bill already is one.
  const months = rentRoll(k.fiscalYear).monthsReported
  const annualise = (income: number) => (months >= 12 ? income : (income / months) * 12)

  const noiOf = (p: PropertyMetrics) => {
    const gross = annualise(p.collected)
    const isNNN = p.leases.length > 0 && p.leases.every((l) => l.leaseType === 'NNN')
    return gross - p.taxBill - (isNNN ? 0 : gross * (effectiveOpexPct / 100))
  }

  // Only the properties that have both an appraisal and income can be compared.
  // Totalling all the appraisals against a model that covers a different set of
  // buildings would be two unrelated numbers sitting in the same row.
  const compared = k.properties.filter((p) => appraisals.has(p.property.id) && p.collected > 0)
  const appraisedTotal = compared
    .reduce((a, p) => a + (appraisals.get(p.property.id)?.value ?? 0), 0)
  const comparedNoi = compared.reduce((a, p) => a + noiOf(p), 0)
  const portfolioImplied = impliedCapRate(comparedNoi, appraisedTotal)
  const modelOnCompared = valueAtCap(comparedNoi, cap)
  /** Every property, annualised — what the by-property table foots to. */
  const annualNoi = k.properties.reduce((a, p) => a + noiOf(p), 0)

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Valuation</h1>
        <p className="page-sub">
          The rent roll states no cap rate, so the model below follows whatever assumptions you set.
          The appraised values are a separate thing entirely — they came from outside the app, and
          the model is measured against them rather than the other way round.
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
          <Kpi label={v.annualised ? 'Gross income, annualised' : 'Gross income'}
            value={money(v.annualGross)}
            note={v.annualised
              ? `${money(k.grossCollected)} over ${v.monthsReported} months on the sheet`
              : undefined} />
          <Kpi label="Less property taxes" value={`− ${money(k.totalTaxes)}`}
            note={`${pct((k.totalTaxes / v.annualGross) * 100)} of gross · a full year's bills`} />
          <Kpi label="Less operating expenses" value={`− ${money(v.opex)}`} note={`${pct(effectiveOpexPct)} allowance`} />
          <Kpi accent label="True NOI" value={money(v.trueNoi)} note={`${pct(v.noiMarginPct)} margin`} />
          <Kpi label="Net on the sheet's basis" value={money(v.annualGross - k.totalTaxes)}
            note="Taxes only, no other costs" />
          <Kpi accent label={`Value at ${cap.toFixed(1)}% cap`} value={moneyShort(v.valueOnTrueNoi)}
            note={`${money(v.valueOnTrueNoi)} on true NOI`} />
        </div>
      </div>

      {compared.length > 0 && (
        <div className="section">
          <Card
            title="What the buildings were appraised at"
            hint={`${compared.length} properties valued ${dateLabel(APPRAISAL_DATE)}`
              + (months < 12 ? ` · income annualised from ${months} months` : '')}
          >
            <div className="kpi-grid">
              <Kpi accent label="Appraised" value={moneyShort(appraisedTotal)}
                note={`${money(appraisedTotal)} across ${compared.length} properties`} />
              <Kpi label={`Model at ${cap.toFixed(1)}%`} value={moneyShort(modelOnCompared)}
                note="Same properties, their own NOI capitalised" />
              <Kpi label="Difference" value={moneyShort(appraisedTotal - modelOnCompared)}
                note={modelOnCompared > 0
                  ? `${pct(((appraisedTotal - modelOnCompared) / modelOnCompared) * 100)} above the model`
                  : '—'} />
              <Kpi accent label="Cap rate implied" value={portfolioImplied === undefined ? '—' : `${portfolioImplied.toFixed(2)}%`}
                note={months < 12
                  ? `On ${money(comparedNoi)} NOI, annualised from ${months} months`
                  : `On ${money(comparedNoi)} NOI`} />
            </div>
            <p className="t-mute" style={{ fontSize: 12.5, marginTop: 12, lineHeight: 1.55 }}>
              The implied rate is the honest way to read these together, and it sits{' '}
              {portfolioImplied !== undefined && portfolioImplied < cap ? 'below' : 'above'} the{' '}
              {cap.toFixed(1)}% in the model. A gap is not evidence either figure is wrong: an
              appraiser prices the land, the road frontage and what the site could become, and a cap
              rate prices only the rent currently coming in. It does mean the model's total should
              not be quoted as what the portfolio is worth — the appraisals are the better number,
              and the model is best read as what the income alone supports.
            </p>
          </Card>
        </div>
      )}

      <div className="section">
        <Card
          title="Value across cap rates"
          hint={"on true NOI, and on the sheet's tax-only net"
            + (v.annualised ? ` · income annualised from ${v.monthsReported} months` : '')}
        >
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
                  const onSheet = valueAtCap(v.annualGross - k.totalTaxes, c)
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
        <div className="section-title">
          Value by property
          <span className="hint">
            taxes and the expense allowance applied to each, except the triple-net property whose
            tenants carry their own operating costs
            {months < 12 && ` · gross is the ${months} months on the sheet; NOI and the values `
              + 'beside it are annualised, because a cap rate is a rate per year'}
          </span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Property</th>
                <th className="num">Gross</th>
                <th className="num">Taxes</th>
                <th className="num">Opex allowance</th>
                <th className="num">NOI{months < 12 && <span className="t-mute"> ann.</span>}</th>
                <th className="num">Margin</th>
                <th className="num">Value at {cap.toFixed(1)}%</th>
                <th className="num">Appraised</th>
                <th className="num">Cap implied</th>
              </tr>
            </thead>
            <tbody>
              {[...k.properties].sort((a, b) => b.collected - a.collected).map((p) => {
                const own = expenses.filter((e) => e.propertyId === p.property.id && e.kind === 'operating')
                  .reduce((a, e) => a + e.amount, 0)
                const gross = annualise(p.collected)
                // Under triple net the tenants reimburse the operating costs, so
                // loading a landlord's expense allowance onto that property would
                // understate it. Taxes are left in place: the source sheet
                // subtracts them, and whether the reimbursements are already
                // inside the rent figure is an open question, not an assumption
                // to bake in here.
                const isNNN = p.leases.length > 0 && p.leases.every((l) => l.leaseType === 'NNN')
                const opex = isNNN ? 0 : useLogged && own > 0 ? own : gross * (effectiveOpexPct / 100)
                // Annualised, so this column, the value beside it and the rate
                // implied from the appraisal are all the same kind of number.
                const noi = gross - p.taxBill - opex
                const ap = appraisals.get(p.property.id)
                const implied = ap ? impliedCapRate(noi, ap.value) : undefined
                return (
                  <tr key={p.property.id} className="clickable" onClick={() => onProperty(p.property.id)}>
                    <td className="t-strong">{p.property.name}</td>
                    <td className="num">{money(p.collected)}</td>
                    <td className="num t-mute">{money(p.taxBill)}</td>
                    <td className="num t-mute">
                      {isNNN ? <span title="Triple net — tenants carry the operating costs">— NNN</span> : money(opex)}
                    </td>
                    <td className="num t-strong">{money(noi)}</td>
                    <td className="num t-mute">
                      {gross > 0 ? pct((noi / gross) * 100) : '—'}
                    </td>
                    <td className="num t-strong">{money(valueAtCap(noi, cap))}</td>
                    <td className="num">
                      {ap ? (
                        <span title={[
                          `${BASIS_LABEL[ap.basis]} ${dateLabel(ap.asOf)}`, ap.note,
                        ].filter(Boolean).join(' — ')}>
                          {money(ap.value)}
                        </span>
                      ) : <span className="t-mute">—</span>}
                    </td>
                    <td className="num t-mute">
                      {implied === undefined ? '—' : `${implied.toFixed(1)}%`}
                    </td>
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
                <td className="num">{money(annualNoi)}</td>
                <td className="num">{pct((annualNoi / v.annualGross) * 100)}</td>
                <td className="num">{money(valueAtCap(annualNoi, cap))}</td>
                <td className="num">{money(appraisedTotal)}</td>
                <td className="num">{portfolioImplied === undefined ? '—' : `${portfolioImplied.toFixed(1)}%`}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  )
}
