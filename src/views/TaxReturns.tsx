import { useState } from 'react'
import { Card, Empty, Kpi } from '../components/ui'
import { RankedBars } from '../components/charts'
import { money, num, pct, signedPct } from '../lib/format'
import {
  DEFAULT_RETURN_YEAR, FILED_RETURNS, interestByInstitution, isPartialReturn, type ReturnLine,
} from '../data/taxReturns'
import { PROPERTY_TYPE_LABEL } from '../lib/taxes'
import type { PortfolioKpis } from '../lib/portfolio'

/**
 * Returns as filed — the archive, not the worksheet.
 *
 * The Taxes tab builds the coming year's Schedule E from the rent roll and the
 * expense ledger. This one shows what was actually sent to the IRS, and never
 * edits it. Where the two disagree, the gap is the point.
 */
export function TaxReturns({ k, onProperty }: { k: PortfolioKpis; onProperty: (id: string) => void }) {
  const [year, setYear] = useState(DEFAULT_RETURN_YEAR)
  const r = FILED_RETURNS.find((x) => x.year === year)!
  const prior = FILED_RETURNS.find((x) => x.year === year - 1)

  const line = (l: string): ReturnLine | undefined => r.federal.find((x) => x.line === l)
  const netRental = r.scheduleETotals.rents - r.scheduleETotals.totalExpenses

  return (
    <div className="stack">
      <div className="page-head">
        <h1 className="page-title">Tax returns — as filed</h1>
        <p className="page-sub">
          What actually went to the IRS, kept as a record. Nothing on this screen is editable and
          nothing is recomputed from the rent roll — the <strong>Taxes</strong> tab is where the
          next return gets built. The taxpayer's social security number appears on every page of
          the filed return and is deliberately not stored in this app.
        </p>
      </div>

      <div className="row" style={{ gap: 8 }}>
        {FILED_RETURNS.map((x) => (
          <button key={x.year} className={`chip${year === x.year ? ' active' : ''}`}
            onClick={() => setYear(x.year)}>
            {x.year}
            {isPartialReturn(x) && <span style={{ opacity: 0.7, marginLeft: 6 }}>Sch. E only</span>}
          </button>
        ))}
      </div>

      {r.federal.length > 0 ? (
        <div className="kpi-grid">
          <Kpi accent label="Total income" value={money(line('9')?.amount ?? 0)}
            note={`Adjusted gross ${money(line('11')?.amount ?? 0)}`} />
          <Kpi accent label="Taxable income" value={money(line('15')?.amount ?? 0)}
            note={`After ${money((line('12')?.amount ?? 0) + (line('13')?.amount ?? 0))} of deductions`} />
          <Kpi label="Total federal tax" value={money(line('24')?.amount ?? 0)}
            note={(line('15')?.amount ?? 0) > 0
              ? `${pct(((line('24')?.amount ?? 0) / (line('15')!.amount)) * 100)} of taxable income`
              : undefined} />
          <Kpi label="Illinois tax" value={money(r.illinois.find((x) => x.line === '23')?.amount ?? 0)}
            note="Flat 4.95% on base income" />
          <Kpi label="Owed on filing" value={money(line('37')?.amount ?? 0)}
            note={`${money(line('33')?.amount ?? 0)} already paid in`}
            warn={(line('37')?.amount ?? 0) > 0} />
          <Kpi label="Interest income" value={money(line('2b')?.amount ?? 0)}
            note={`${num(r.interestByPayer.length)} accounts across ${num(interestByInstitution(r).length)} institutions`} />
        </div>
      ) : (
        <div className="callout">
          <div className="callout-title">Only the Schedule E was provided for {r.year}</div>
          <p>
            The 1040 summary, Schedule B and the state return are not in the file, so nothing above
            the rental line can be shown for this year. Send the full return and it will fill in.
          </p>
        </div>
      )}

      {r.federal.length > 0 && (
        <div className="grid-2">
          <Card title={`Form 1040 — ${r.year}`} hint={r.status}>
            <div className="table-wrap" style={{ border: 0 }}>
              <table>
                <thead><tr><th style={{ width: 44 }}>Line</th><th>Item</th><th className="num">Amount</th></tr></thead>
                <tbody>
                  {r.federal.map((l) => (
                    <tr key={l.line}>
                      <td className="t-mono t-mute">{l.line}</td>
                      <td>
                        <span className={l.headline ? 't-strong' : undefined}>{l.label}</span>
                        {l.note && <div className="t-mute" style={{ fontSize: 11.5, maxWidth: 380 }}>{l.note}</div>}
                      </td>
                      <td className={`num${l.headline ? ' t-strong' : ' t-mute'}`}>{money(l.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="stack">
            <Card title={`Illinois IL-1040 — ${r.year}`}>
              {r.illinois.length === 0 ? <Empty>Not in the file.</Empty> : (
                <div className="table-wrap" style={{ border: 0 }}>
                  <table>
                    <tbody>
                      {r.illinois.map((l) => (
                        <tr key={l.label}>
                          <td className="t-mono t-mute" style={{ width: 44 }}>{l.line || '—'}</td>
                          <td className={l.headline ? 't-strong' : undefined}>
                            {l.label}
                            {l.note && <div className="t-mute" style={{ fontSize: 11.5 }}>{l.note}</div>}
                          </td>
                          <td className={`num${l.headline ? ' t-strong' : ' t-mute'}`}>{money(l.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {r.interestByPayer.length > 0 && (
              <Card
                title="Interest by institution"
                hint={`Schedule B — ${money(r.interestByPayer.reduce((a, x) => a + x.amount, 0))}`}
              >
                <RankedBars
                  items={interestByInstitution(r).map((x) => ({
                    id: x.payer, label: x.payer, value: x.amount,
                  }))}
                />
                <p className="t-mute" style={{ fontSize: 12, marginTop: 10 }}>
                  These are the institutions to record on the <strong>Assets</strong> tab. Interest
                  of this size implies a substantial deposit balance behind it — at 5% it would be
                  roughly {money((r.interestByPayer.reduce((a, x) => a + x.amount, 0) / 0.05))},
                  though the actual rates and balances are what should be entered.
                </p>
              </Card>
            )}
          </div>
        </div>
      )}

      <Card
        title={`Schedule E as filed — ${r.year}`}
        hint={r.scheduleETotals.printedOnReturn
          ? 'reconciled against the return’s printed control totals'
          : 'the return prints no subtotals; checked against Schedule 1 instead'}
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 34 }}>#</th><th>Property</th><th>Type</th>
                <th className="num">Rental days</th>
                <th className="num">Rents</th><th className="num">Taxes</th>
                <th className="num">Depreciation</th><th className="num">Total expenses</th>
                <th className="num">Net</th>
              </tr>
            </thead>
            <tbody>
              {r.scheduleE.map((l) => {
                const known = k.properties.some((p) => p.property.id === l.propertyId)
                const net = l.rents - l.totalExpenses
                return (
                  <tr
                    key={l.letter}
                    className={known ? 'clickable' : undefined}
                    onClick={known ? () => onProperty(l.propertyId) : undefined}
                  >
                    <td className="t-mono t-mute">{l.letter}</td>
                    <td>
                      <div className="t-strong">
                        {k.properties.find((p) => p.property.id === l.propertyId)?.property.name
                          ?? l.address.split(',')[0]}
                      </div>
                      <div className="t-mute" style={{ fontSize: 11.5 }}>{l.address}</div>
                    </td>
                    <td>
                      <span className="badge mute">{PROPERTY_TYPE_LABEL[l.propertyType] ?? l.propertyType}</span>
                    </td>
                    <td className="num">
                      {l.personalUseDays > 0
                        ? <span className="t-red" title="Reported as personal use">
                            {num(l.personalUseDays)} personal
                          </span>
                        : l.fairRentalDays > 0 ? num(l.fairRentalDays) : <span className="t-mute">—</span>}
                    </td>
                    <td className="num">{l.rents > 0 ? money(l.rents) : <span className="t-mute">—</span>}</td>
                    <td className="num t-mute">{money(l.taxes)}</td>
                    <td className="num t-mute">{money(l.depreciation)}</td>
                    <td className="num">{l.totalExpenses > 0 ? money(l.totalExpenses) : <span className="t-mute">—</span>}</td>
                    <td className={`num t-strong ${net < 0 ? 't-red' : ''}`}>{money(net)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="label" colSpan={4}>{num(r.scheduleE.length)} properties</td>
                <td className="num">{money(r.scheduleETotals.rents)}</td>
                <td className="num">{money(r.scheduleETotals.taxes)}</td>
                <td className="num">{money(r.scheduleETotals.depreciation)}</td>
                <td className="num">{money(r.scheduleETotals.totalExpenses)}</td>
                <td className="num">{money(netRental)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {prior && (
        <Card title={`What moved between ${prior.year} and ${r.year}`}>
          <div className="table-wrap" style={{ border: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Line</th><th className="num">{prior.year}</th><th className="num">{r.year}</th>
                  <th className="num">Change</th><th className="num">%</th>
                </tr>
              </thead>
              <tbody>
                {([
                  ['Rents received', prior.scheduleETotals.rents, r.scheduleETotals.rents],
                  ['Property taxes', prior.scheduleETotals.taxes, r.scheduleETotals.taxes],
                  ['Depreciation', prior.scheduleETotals.depreciation, r.scheduleETotals.depreciation],
                  ['Total expenses', prior.scheduleETotals.totalExpenses, r.scheduleETotals.totalExpenses],
                  ['Net rental income',
                    prior.scheduleETotals.rents - prior.scheduleETotals.totalExpenses,
                    netRental],
                ] as [string, number, number][]).map(([label, a, b]) => (
                  <tr key={label}>
                    <td className="t-strong">{label}</td>
                    <td className="num t-mute">{money(a)}</td>
                    <td className="num t-mute">{money(b)}</td>
                    <td className={`num ${b - a < 0 ? 't-red' : ''}`}>
                      {b - a >= 0 ? '+' : ''}{money(b - a)}
                    </td>
                    <td className={`num ${b < a ? 't-red' : ''}`}>
                      {a > 0 ? signedPct(((b - a) / a) * 100) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card title={`Reading the ${r.year} return`}>
        <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--ink-2)', lineHeight: 1.75 }}>
          {r.notes.map((note, i) => <li key={i}>{note}</li>)}
        </ul>
        {r.preparer && (
          <p className="t-mute" style={{ fontSize: 12, marginTop: 14 }}>
            Prepared by {r.preparer.name} — {r.preparer.firmAddress}, {r.preparer.phone}.
          </p>
        )}
      </Card>
    </div>
  )
}
