import { useMemo, useState } from 'react'
import { Card, Empty, Kpi } from '../components/ui'
import { RankedBars } from '../components/charts'
import { money, moneyShort, num, pct, signedPct } from '../lib/format'
import { collected, firstRate, lastRate } from '../lib/finance'
import { AVAILABLE_YEARS, rentRoll } from '../data/rentRolls'
import { computeKpis, resolveData } from '../lib/portfolio'
import type { Overrides } from '../lib/overrides'
import type { Lease } from '../lib/types'

export function YearOverYear({
  overrides, onProperty,
}: {
  overrides: Overrides
  onProperty: (id: string) => void
}) {
  const years = AVAILABLE_YEARS
  const [from, setFrom] = useState(years[0])
  const [to, setTo] = useState(years[years.length - 1])

  const byYear = useMemo(
    () => Object.fromEntries(years.map((y) => [y, computeKpis(undefined, resolveData(overrides, y))])),
    [years, overrides],
  )
  const a = byYear[from]
  const b = byYear[to]

  // Match units across years by lease id, which is stable per unit.
  const changes = useMemo(() => {
    const prior = new Map(rentRoll(from).leases.map((l) => [l.id, l]))
    const now = new Map(rentRoll(to).leases.map((l) => [l.id, l]))
    const ids = new Set([...prior.keys(), ...now.keys()])
    const rows: {
      id: string; unit: string; propertyId: string
      before?: Lease; after?: Lease
      wasRent: number; nowRent: number
      kind: 'same' | 'new-tenant' | 'left' | 'arrived'
    }[] = []
    for (const id of ids) {
      const before = prior.get(id)
      const after = now.get(id)
      const wasRent = before ? collected(before) : 0
      const nowRent = after ? collected(after) : 0
      let kind: 'same' | 'new-tenant' | 'left' | 'arrived' = 'same'
      if (before && !after) kind = 'left'
      else if (!before && after) kind = 'arrived'
      else if (before && after && before.tenant !== after.tenant) kind = 'new-tenant'
      rows.push({
        id, unit: (after ?? before)!.unit, propertyId: (after ?? before)!.propertyId,
        before, after, wasRent, nowRent, kind,
      })
    }
    return rows.sort((x, y) => (y.nowRent - y.wasRent) - (x.nowRent - x.wasRent))
  }, [from, to])

  const turnover = changes.filter((c) => c.kind !== 'same')
  const propName = (id: string) => b.properties.find((p) => p.property.id === id)?.property.name ?? id

  const growth = a.grossCollected > 0 ? ((b.grossCollected - a.grossCollected) / a.grossCollected) * 100 : 0
  const biggestGain = changes[0]
  const biggestDrop = changes[changes.length - 1]

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Year over year</h1>
        <p className="page-sub">
          What actually moved between one rent roll and the next — which units turned over, which sat
          empty, and where the rent went up. Comparing complete calendar years against each other, not a
          rent roll against a tax return.
        </p>
      </div>

      <div className="toolbar">
        <label className="field" style={{ minWidth: 130 }}>
          <span>From</span>
          <select value={from} onChange={(e) => setFrom(Number(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <label className="field" style={{ minWidth: 130 }}>
          <span>To</span>
          <select value={to} onChange={(e) => setTo(Number(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <div className="spacer" />
        <span className="t-mute">{years.length} year{years.length === 1 ? '' : 's'} loaded: {years.join(', ')}</span>
      </div>

      <div className="kpi-grid">
        <Kpi accent label={`Gross ${from}`} value={money(a.grossCollected)} />
        <Kpi accent label={`Gross ${to}`} value={money(b.grossCollected)}
          note={`${signedPct(growth)} on ${from}`} />
        <Kpi label="Change" value={money(b.grossCollected - a.grossCollected)} />
        <Kpi label="Net after tax" value={money(b.netAfterTax - a.netAfterTax)}
          note={`${money(a.netAfterTax)} → ${money(b.netAfterTax)}`} />
        <Kpi label="Units turned over" value={num(turnover.filter((t) => t.kind === 'new-tenant').length)}
          note="Same unit, different tenant" />
        <Kpi label="Tax bill change" value={money(b.totalTaxes - a.totalTaxes)}
          note={`${signedPct(((b.totalTaxes - a.totalTaxes) / a.totalTaxes) * 100)}`} warn />
      </div>

      {(biggestGain || biggestDrop) && (
        <div className="section">
          <div className="grid-2">
            {biggestGain && biggestGain.nowRent > biggestGain.wasRent && (
              <div className="callout neutral">
                <div className="callout-title">Biggest gain — {biggestGain.after?.tenant}</div>
                <p>
                  {propName(biggestGain.propertyId)}, unit {biggestGain.unit}:{' '}
                  {money(biggestGain.wasRent)} → {money(biggestGain.nowRent)}, up{' '}
                  <strong>{money(biggestGain.nowRent - biggestGain.wasRent)}</strong>.
                  {biggestGain.after?.notes && ` ${biggestGain.after.notes}`}
                </p>
              </div>
            )}
            {biggestDrop && biggestDrop.nowRent < biggestDrop.wasRent && (
              <div className="callout">
                <div className="callout-title">Biggest fall — {biggestDrop.before?.tenant}</div>
                <p>
                  {propName(biggestDrop.propertyId)}, unit {biggestDrop.unit}:{' '}
                  {money(biggestDrop.wasRent)} → {money(biggestDrop.nowRent)}, down{' '}
                  <strong>{money(biggestDrop.wasRent - biggestDrop.nowRent)}</strong>.
                  {(biggestDrop.after ?? biggestDrop.before)?.notes && ` ${(biggestDrop.after ?? biggestDrop.before)!.notes}`}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="section">
        <div className="section-title">Every property, every year</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Property</th>
                {years.map((y) => <th key={y} className="num">{y}</th>)}
                <th className="num">{from} → {to}</th>
                <th className="num">Change</th>
              </tr>
            </thead>
            <tbody>
              {b.properties.map((p) => {
                const vals = years.map((y) =>
                  byYear[y].properties.find((x) => x.property.id === p.property.id)?.collected ?? 0)
                const was = byYear[from].properties.find((x) => x.property.id === p.property.id)?.collected ?? 0
                const now = byYear[to].properties.find((x) => x.property.id === p.property.id)?.collected ?? 0
                const d = now - was
                return (
                  <tr key={p.property.id} className="clickable" onClick={() => onProperty(p.property.id)}>
                    <td className="t-strong">{p.property.name}</td>
                    {vals.map((v, i) => (
                      <td key={i} className="num">{v > 0 ? money(v) : <span className="t-mute">—</span>}</td>
                    ))}
                    <td className={`num t-strong ${d < 0 ? 't-red' : ''}`}>{money(d)}</td>
                    <td className={`num ${d < 0 ? 't-red' : 't-mute'}`}>
                      {was > 0 ? signedPct((d / was) * 100) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="label">Portfolio</td>
                {years.map((y) => <td key={y} className="num">{money(byYear[y].grossCollected)}</td>)}
                <td className="num">{money(b.grossCollected - a.grossCollected)}</td>
                <td className="num">{signedPct(growth)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="section">
        <div className="section-title">
          Units that changed hands
          <span className="hint">{turnover.length} between {from} and {to}</span>
        </div>
        {turnover.length === 0 ? <Empty>No turnover between these years.</Empty> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Property</th><th>Unit</th>
                  <th>{from}</th><th className="num">{from} rent</th>
                  <th>{to}</th><th className="num">{to} rent</th>
                  <th className="num">Change</th>
                </tr>
              </thead>
              <tbody>
                {turnover.map((c) => (
                  <tr key={c.id} className="clickable" onClick={() => onProperty(c.propertyId)}>
                    <td className="t-mute">{propName(c.propertyId)}</td>
                    <td className="t-mono t-mute">{c.unit}</td>
                    <td>{c.before ? c.before.tenant : <span className="badge ok">arrived</span>}</td>
                    <td className="num t-mute">{c.wasRent > 0 ? money(c.wasRent) : '—'}</td>
                    <td>{c.after ? c.after.tenant : <span className="badge critical">gone</span>}</td>
                    <td className="num">{c.nowRent > 0 ? money(c.nowRent) : '—'}</td>
                    <td className={`num t-strong ${c.nowRent < c.wasRent ? 't-red' : ''}`}>
                      {money(c.nowRent - c.wasRent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="section">
        <div className="grid-2">
          <Card title={`Largest increases, ${from} → ${to}`}>
            <RankedBars
              onSelect={(id) => onProperty(changes.find((c) => c.id === id)?.propertyId ?? '')}
              items={changes.filter((c) => c.nowRent > c.wasRent).slice(0, 10).map((c) => ({
                id: c.id,
                label: (c.after ?? c.before)!.tenant,
                value: c.nowRent - c.wasRent,
                sub: `${moneyShort(c.wasRent)} → ${moneyShort(c.nowRent)}`,
              }))}
            />
          </Card>
          <Card title={`Largest decreases, ${from} → ${to}`}>
            {changes.filter((c) => c.nowRent < c.wasRent).length === 0 ? <Empty>None.</Empty> : (
              <RankedBars
                onSelect={(id) => onProperty(changes.find((c) => c.id === id)?.propertyId ?? '')}
                items={changes.filter((c) => c.nowRent < c.wasRent)
                  .sort((x, y) => (x.nowRent - x.wasRent) - (y.nowRent - y.wasRent))
                  .slice(0, 10).map((c) => ({
                    id: c.id,
                    label: (c.before ?? c.after)!.tenant,
                    value: c.wasRent - c.nowRent,
                    sub: `${moneyShort(c.wasRent)} → ${moneyShort(c.nowRent)}`,
                  }))}
              />
            )}
          </Card>
        </div>
      </div>

      <div className="section">
        <div className="section-title">
          Rent per month, {from} against {to}
          <span className="hint">the rate each unit carried out of each year</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tenant</th><th>Property</th>
                <th className="num">{from} exit rate</th><th className="num">{to} exit rate</th>
                <th className="num">Increase</th><th className="num">Contracted</th>
              </tr>
            </thead>
            <tbody>
              {changes.filter((c) => c.before && c.after && c.kind === 'same').map((c) => {
                const was = lastRate(c.before!)
                const now = lastRate(c.after!)
                const realised = was > 0 ? ((now - was) / was) * 100 : 0
                const stated = c.after!.statedEscalationPct
                const short = stated !== undefined && realised < stated - 0.75
                return (
                  <tr key={c.id} className="clickable" onClick={() => onProperty(c.propertyId)}>
                    <td className="t-strong">{c.after!.tenant}</td>
                    <td className="t-mute">{propName(c.propertyId)}</td>
                    <td className="num t-mute">{money(was)}</td>
                    <td className="num">{money(now)}</td>
                    <td className={`num ${short ? 't-red' : ''}`}>{signedPct(realised)}</td>
                    <td className="num t-mute">{stated !== undefined ? pct(stated, 0) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="page-sub" style={{ marginTop: 10 }}>
          This is the honest way to measure an annual bump. Reading it inside a single year misses any
          lease whose anniversary falls in January — the increase happens at the year boundary, so the
          twelve cells look flat even though the rent rose. Comparing the rate each unit carried out of
          one year against the next catches those.
        </p>
      </div>
    </>
  )
}

/** Kept for callers that only need one year's exit rate. */
export const exitRateOf = (l: Lease): number => lastRate(l) || firstRate(l)
