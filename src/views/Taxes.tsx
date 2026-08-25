import { useMemo, useState } from 'react'
import { Card, Empty, Kpi } from '../components/ui'
import { money, num, pct } from '../lib/format'
import { SCHEDULE_E_2024, SCHEDULE_E_2024_TOTALS } from '../data/scheduleE'
import {
  PROPERTY_TYPE_LABEL, SCHEDULE_E_LINES, capitalForYear, cellValue,
  isTyped, suggestedValues, totalExpensesFor, type ScheduleEKey, type TaxEntries,
} from '../lib/taxes'
import { download, type Expense } from '../lib/expenses'
import type { PortfolioKpis } from '../lib/portfolio'

const TAX_YEAR = 2025

export function Taxes({
  k, expenses, entries, setEntries,
}: {
  k: PortfolioKpis
  expenses: Expense[]
  entries: TaxEntries
  setEntries: (next: TaxEntries) => void
}) {
  const [showPrior, setShowPrior] = useState(true)
  const [focus, setFocus] = useState<string | null>(null)
  // A cell reads as money until you click into it, then drops to a plain number
  // so it can be typed over without fighting the formatting.
  const [editingCell, setEditingCell] = useState<string | null>(null)

  // One worksheet row per property on the return, ordered as the form letters it.
  const rows = useMemo(() =>
    SCHEDULE_E_2024.map((prior) => {
      const metrics = k.properties.find((p) => p.property.id === prior.propertyId)
      const suggested = suggestedValues(
        prior.propertyId,
        metrics?.collected ?? 0,
        metrics?.taxBill ?? 0,
        expenses,
        TAX_YEAR,
      )
      return {
        prior,
        name: metrics?.property.name ?? prior.address,
        suggested,
        capital: capitalForYear(prior.propertyId, expenses, TAX_YEAR),
      }
    }), [k, expenses])

  const set = (propertyId: string, key: ScheduleEKey, raw: string) => {
    const next: TaxEntries = { ...entries, [propertyId]: { ...entries[propertyId] } }
    if (raw.trim() === '') delete next[propertyId][key]
    else {
      const n = Number.parseFloat(raw.replace(/[$,]/g, ''))
      if (Number.isFinite(n)) next[propertyId][key] = Math.round(n)
    }
    if (Object.keys(next[propertyId]).length === 0) delete next[propertyId]
    setEntries(next)
  }

  const totals = useMemo(() => {
    const t: Record<string, number> = {}
    for (const l of SCHEDULE_E_LINES) {
      t[l.key] = rows.reduce((a, r) => a + cellValue(entries, r.prior.propertyId, l.key, r.suggested), 0)
    }
    t.totalExpenses = rows.reduce((a, r) => a + totalExpensesFor(entries, r.prior.propertyId, r.suggested), 0)
    t.net = t.rents - t.totalExpenses
    return t
  }, [rows, entries])

  const typedCount = Object.values(entries).reduce((a, e) => a + Object.keys(e).length, 0)
  const capitalTotal = rows.reduce((a, r) => a + r.capital.reduce((s, e) => s + e.amount, 0), 0)
  // Depreciation is the only line the app genuinely cannot derive. Mortgage
  // interest was zero last year, so an empty line 12 is a plausible answer here
  // rather than a gap.
  const missing = ['depreciation'] as ScheduleEKey[]

  const exportCsv = () => {
    const header = ['Line', 'Item', ...rows.map((r) => `${r.prior.letter} — ${r.name}`), 'Total']
    const body = SCHEDULE_E_LINES.map((l) => [
      l.line, l.label,
      ...rows.map((r) => cellValue(entries, r.prior.propertyId, l.key, r.suggested).toFixed(0)),
      totals[l.key].toFixed(0),
    ])
    body.push(['20', 'Total expenses',
      ...rows.map((r) => totalExpensesFor(entries, r.prior.propertyId, r.suggested).toFixed(0)),
      totals.totalExpenses.toFixed(0)])
    body.push(['21', 'Net income or (loss)',
      ...rows.map((r) => (cellValue(entries, r.prior.propertyId, 'rents', r.suggested) - totalExpensesFor(entries, r.prior.propertyId, r.suggested)).toFixed(0)),
      totals.net.toFixed(0)])
    const addr = ['1a', 'Physical address', ...rows.map((r) => r.prior.address), '']
    const csv = [addr, header, ...body]
      .map((r) => r.map((c) => (/[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c)).join(','))
      .join('\n')
    void download(`schedule-e-${TAX_YEAR}-worksheet.csv`, csv)
  }

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Taxes — Schedule E {TAX_YEAR}</h1>
        <p className="page-sub">
          The worksheet your accountant needs, laid out line for line as it appears on Form 1040
          Schedule E Part I. Rent and property tax are filled in from the rent roll, and logged
          operating expenses drop onto the right line automatically. Type over anything.
        </p>
      </div>

      <div className="kpi-grid">
        <Kpi accent label={`${TAX_YEAR} rents received`} value={money(totals.rents)}
          note={`Line 3 · ${money(SCHEDULE_E_2024_TOTALS.rents)} in 2024`} />
        <Kpi label="Total expenses" value={money(totals.totalExpenses)}
          note={`Line 20 · ${money(SCHEDULE_E_2024_TOTALS.totalExpenses)} in 2024`} />
        <Kpi accent label="Net income" value={money(totals.net)} note="Line 21, before loss limitation" />
        <Kpi label="Properties on the return" value={num(SCHEDULE_E_2024.length)} note="Lettered A through O" />
        <Kpi label="Figures you have typed" value={num(typedCount)}
          note={typedCount ? 'Shown in red; the rest are suggestions' : 'Nothing typed yet'} />
        <Kpi label="Depreciation" value={totals.depreciation ? money(totals.depreciation) : 'Not entered'}
          small note={`${money(SCHEDULE_E_2024_TOTALS.depreciation)} in 2024 — from the depreciation schedule`}
          warn={totals.depreciation === 0} />
      </div>

      <div className="callout" style={{ marginTop: 18 }}>
        <div className="callout-title">What the app can and cannot work out</div>
        <p>
          Rent comes from the rent roll, property tax from the tax bills, and every operating expense
          logged in the Expenses tab lands on its Schedule E line. <strong>Depreciation (line 18) it
          cannot know</strong> — that comes from the depreciation schedule, so it starts at zero and
          must be typed. It was {money(SCHEDULE_E_2024_TOTALS.depreciation)} across all fifteen
          properties last year.
        </p>
        <p>
          The 2024 return reports <strong>no mortgage interest on any of the fifteen properties</strong>{' '}
          (line 23c came to zero), which says the portfolio is held free of debt. If that is still true
          for {TAX_YEAR}, line 12 stays empty and there is no debt service to model anywhere in this
          application. Worth confirming before the return is filed.
        </p>
        {capitalTotal > 0 && (
          <p>
            <strong>{money(capitalTotal)} of capital work</strong> is logged for {TAX_YEAR} and is
            deliberately excluded from these expense lines — capital improvements are depreciated
            against the building rather than deducted. It is itemised at the bottom of this page for
            the depreciation schedule.
          </p>
        )}
      </div>

      <div className="toolbar" style={{ marginTop: 18 }}>
        <button className="btn primary" onClick={exportCsv}>Export worksheet for the accountant</button>
        <button className={`chip${showPrior ? ' active' : ''}`} onClick={() => setShowPrior(!showPrior)}>
          {showPrior ? 'Hide' : 'Show'} 2024 comparison
        </button>
        <div className="spacer" />
        {typedCount > 0 && (
          <button className="btn danger" onClick={() => { if (confirm('Clear every figure you have typed on this worksheet?')) setEntries({}) }}>
            Clear my entries
          </button>
        )}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ minWidth: 36 }}>Line</th>
              <th style={{ minWidth: 210 }}>Item</th>
              {rows.map((r) => (
                <th key={r.prior.letter} className="num" style={{ minWidth: 116 }}
                  onMouseEnter={() => setFocus(r.prior.letter)} onMouseLeave={() => setFocus(null)}>
                  <div style={{ color: 'var(--red)' }}>{r.prior.letter}</div>
                  <div style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 600 }}>{r.name}</div>
                </th>
              ))}
              <th className="num" style={{ minWidth: 116 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="t-mono t-mute">1a</td>
              <td className="t-mute">Physical address</td>
              {rows.map((r) => (
                <td key={r.prior.letter} className="t-mute" style={{ fontSize: 10.5, textAlign: 'right' }}>
                  {r.prior.address}
                </td>
              ))}
              <td />
            </tr>
            <tr>
              <td className="t-mono t-mute">1b</td>
              <td className="t-mute">Type of property</td>
              {rows.map((r) => (
                <td key={r.prior.letter} className="t-mute" style={{ fontSize: 11, textAlign: 'right' }}>
                  {r.prior.propertyType} — {PROPERTY_TYPE_LABEL[r.prior.propertyType]}
                </td>
              ))}
              <td />
            </tr>

            {SCHEDULE_E_LINES.map((l) => (
              <tr key={l.key} style={l.key === 'rents' ? { background: 'var(--surface-2)' } : undefined}>
                <td className="t-mono t-mute">{l.line}</td>
                <td className={l.key === 'rents' ? 't-strong' : ''}>
                  {l.label}
                  {missing.includes(l.key) && totals[l.key] === 0 && (
                    <span className="badge warn" style={{ marginLeft: 6 }}>needs input</span>
                  )}
                </td>
                {rows.map((r) => {
                  const v = cellValue(entries, r.prior.propertyId, l.key, r.suggested)
                  const typed = isTyped(entries, r.prior.propertyId, l.key)
                  const prior = r.prior[l.key]
                  return (
                    <td key={r.prior.letter} className="num"
                      style={focus === r.prior.letter ? { background: 'var(--surface-2)' } : undefined}>
                      <input
                        value={
                          editingCell === `${r.prior.propertyId}:${l.key}`
                            ? (v === 0 ? '' : String(v))
                            : (v === 0 ? '' : money(v))
                        }
                        placeholder="$0"
                        inputMode="numeric"
                        onFocus={() => setEditingCell(`${r.prior.propertyId}:${l.key}`)}
                        onBlur={() => setEditingCell(null)}
                        onChange={(e) => set(r.prior.propertyId, l.key, e.target.value)}
                        style={{
                          width: '100%', textAlign: 'right', padding: '4px 6px',
                          fontFamily: 'var(--mono)', fontSize: 12.5,
                          background: typed ? 'var(--red-dim)' : 'transparent',
                          border: '1px solid transparent', borderRadius: 4,
                          color: typed ? 'var(--red-bright)' : 'var(--ink)',
                        }}
                      />
                      {showPrior && (
                        <div className="t-mute" style={{ fontSize: 10, fontFamily: 'var(--mono)', paddingRight: 6 }}>
                          {prior ? money(prior) : '—'}
                        </div>
                      )}
                    </td>
                  )
                })}
                <td className="num t-strong">{money(totals[l.key])}</td>
              </tr>
            ))}

            <tr style={{ background: 'var(--surface-2)' }}>
              <td className="t-mono">20</td>
              <td className="t-strong">Total expenses</td>
              {rows.map((r) => (
                <td key={r.prior.letter} className="num t-strong">
                  {money(totalExpensesFor(entries, r.prior.propertyId, r.suggested))}
                </td>
              ))}
              <td className="num t-strong">{money(totals.totalExpenses)}</td>
            </tr>
            <tr>
              <td className="t-mono">21</td>
              <td className="t-strong">Net income or (loss)</td>
              {rows.map((r) => {
                const net = cellValue(entries, r.prior.propertyId, 'rents', r.suggested)
                  - totalExpensesFor(entries, r.prior.propertyId, r.suggested)
                return (
                  <td key={r.prior.letter} className={`num t-strong ${net < 0 ? 't-red' : ''}`}>
                    {money(net)}
                  </td>
                )
              })}
              <td className={`num t-strong ${totals.net < 0 ? 't-red' : ''}`}>{money(totals.net)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="section">
        <div className="grid-2">
          <Card title={`Capital work in ${TAX_YEAR}`} hint="for the depreciation schedule, not the expense lines">
            {capitalTotal === 0 ? (
              <Empty>No capital spend logged for {TAX_YEAR}.</Empty>
            ) : (
              <div className="table-wrap" style={{ border: 0 }}>
                <table>
                  <thead><tr><th>Date</th><th>Property</th><th>Category</th><th>Paid to</th><th className="num">Amount</th></tr></thead>
                  <tbody>
                    {rows.flatMap((r) => r.capital.map((e) => (
                      <tr key={e.id}>
                        <td className="t-mono t-nowrap">{e.date}</td>
                        <td className="t-mute">{r.name}</td>
                        <td>{e.category}</td>
                        <td className="t-strong">{e.vendor}</td>
                        <td className="num">{money(e.amount)}</td>
                      </tr>
                    )))}
                  </tbody>
                  <tfoot><tr><td className="label" colSpan={4}>Total to depreciate</td><td className="num">{money(capitalTotal)}</td></tr></tfoot>
                </table>
              </div>
            )}
          </Card>

          <Card title="2025 against 2024" hint="the filed return as the comparison">
            <div className="table-wrap" style={{ border: 0 }}>
              <table>
                <thead><tr><th>Line</th><th className="num">2025</th><th className="num">2024 filed</th><th className="num">Change</th></tr></thead>
                <tbody>
                  {(['rents', 'taxes', 'repairs', 'insurance', 'utilities', 'cleaning'] as ScheduleEKey[]).map((key) => {
                    const now = totals[key]
                    const then = SCHEDULE_E_2024.reduce((a, p) => a + (p[key] as number), 0)
                    const line = SCHEDULE_E_LINES.find((l) => l.key === key)!
                    return (
                      <tr key={key}>
                        <td>{line.label}</td>
                        <td className="num t-strong">{money(now)}</td>
                        <td className="num t-mute">{money(then)}</td>
                        <td className={`num ${now < then ? 't-red' : ''}`}>
                          {then > 0 ? pct(((now - then) / then) * 100) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                  <tr>
                    <td className="t-strong">Total expenses</td>
                    <td className="num t-strong">{money(totals.totalExpenses)}</td>
                    <td className="num t-mute">{money(SCHEDULE_E_2024_TOTALS.totalExpenses)}</td>
                    <td className="num t-mute">
                      {pct(((totals.totalExpenses - SCHEDULE_E_2024_TOTALS.totalExpenses) / SCHEDULE_E_2024_TOTALS.totalExpenses) * 100)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
