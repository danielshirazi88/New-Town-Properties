import { Card, Empty, Kpi } from '../components/ui'
import { RankedBars } from '../components/charts'
import { collected, firstRate, lastRate, realisedEscalationPct } from '../lib/finance'
import { money, num, pct, signedPct } from '../lib/format'
import type { PortfolioKpis } from '../lib/portfolio'

export function Escalations({ k, onProperty }: { k: PortfolioKpis; onProperty: (id: string) => void }) {
  const all = k.properties.flatMap((p) => p.leases)
  const propName = (id: string) => k.properties.find((p) => p.property.id === id)?.property.name ?? id

  const withEsc = all
    .map((l) => ({ lease: l, stated: l.statedEscalationPct, realised: realisedEscalationPct(l), rent: collected(l) }))
    .filter((r) => r.realised !== undefined)
    .sort((a, b) => (b.realised ?? 0) - (a.realised ?? 0))

  const statedCounts = new Map<number, number>()
  for (const l of all) {
    if (l.statedEscalationPct === undefined) continue
    statedCounts.set(l.statedEscalationPct, (statedCounts.get(l.statedEscalationPct) ?? 0) + 1)
  }

  // What another year of the stated escalation would add on December's rate.
  const nextYearUplift = all.reduce((a, l) => {
    const rate = lastRate(l)
    const esc = l.statedEscalationPct ?? 0
    return a + rate * 12 * (esc / 100)
  }, 0)

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Annual bumps</h1>
        <p className="page-sub">
          What each lease is contracted to escalate, set against what the rent actually did during {k.fiscalYear}.
          Where the two disagree, a scheduled increase was not applied.
        </p>
      </div>

      <div className="kpi-grid">
        <Kpi accent label="Average contracted bump" value={pct(k.avgStatedEscalationPct, 2)}
          note={`Across ${num(all.filter((l) => l.statedEscalationPct !== undefined).length)} leases`} />
        <Kpi accent label="Average realised bump" value={pct(k.avgRealisedEscalationPct, 2)}
          note="What the rent actually rose" />
        <Kpi label="Bumps not taken" value={num(k.bumpsNotTaken.length)} warn
          note={`${money(k.totalForgoneFromMissedBumps)} forgone in ${k.fiscalYear}`} />
        <Kpi label="Next year's uplift" value={money(nextYearUplift)}
          note="If every stated escalation is applied to December's rate" />
        <Kpi label="Rent rise, Jan → Dec" value={signedPct(k.janToDecGrowthPct, 2)}
          note={`${money(k.exitMonthlyRent)} monthly at year end`} />
        <Kpi label="Escalation rates in use" value={[...statedCounts.keys()].sort((a, b) => a - b).map((r) => `${r}%`).join(' · ') || '—'}
          small note={[...statedCounts.entries()].sort((a, b) => a[0] - b[0]).map(([r, c]) => `${c} at ${r}%`).join(', ')} />
      </div>

      {k.bumpsNotTaken.length > 0 && (
        <div className="section">
          <div className="callout">
            <div className="callout-title">Escalations that did not land</div>
            <p>
              {k.bumpsNotTaken.length} leases are marked for an annual increase that the {k.fiscalYear} rent does not
              show in full — together <strong>{money(k.totalForgoneFromMissedBumps)}</strong> of rent. Two of
              these are explained by the lease itself: Washland reset downward on a new March lease, and FC
              Salon Suites re-let below the prior rate after four vacant months. The rest are worth checking
              against the lease documents.
            </p>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tenant</th><th>Property</th>
                  <th className="num">Contracted</th><th className="num">Realised</th><th className="num">Shortfall</th>
                  <th className="num">Jan rate</th><th className="num">Dec rate</th><th className="num">Rent forgone</th>
                </tr>
              </thead>
              <tbody>
                {k.bumpsNotTaken.map(({ lease, statedPct, realisedPct, forgone }) => (
                  <tr key={lease.id} className="clickable" onClick={() => onProperty(lease.propertyId)}>
                    <td className="t-strong">{lease.tenant}</td>
                    <td className="t-mute">{propName(lease.propertyId)}</td>
                    <td className="num">{pct(statedPct, 0)}</td>
                    <td className="num t-red">{signedPct(realisedPct)}</td>
                    <td className="num t-red">{pct(statedPct - realisedPct)}</td>
                    <td className="num t-mute">{money(firstRate(lease))}</td>
                    <td className="num t-mute">{money(lastRate(lease))}</td>
                    <td className="num t-strong">{money(forgone)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td className="label" colSpan={7}>Total forgone</td><td className="num">{money(k.totalForgoneFromMissedBumps)}</td></tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <div className="section">
        <div className="grid-2">
          <Card title="Largest realised increases">
            <RankedBars
              onSelect={(id) => onProperty(all.find((l) => l.id === id)?.propertyId ?? '')}
              formatValue={(n) => signedPct(n)}
              items={withEsc.slice(0, 12).map((r) => ({
                id: r.lease.id, label: r.lease.tenant, value: r.realised ?? 0,
                sub: `${money(firstRate(r.lease))} → ${money(lastRate(r.lease))}`,
              }))}
            />
          </Card>
          <Card title="Flat or falling">
            {withEsc.filter((r) => (r.realised ?? 0) <= 0).length === 0 ? <Empty>None.</Empty> : (
              <RankedBars
                onSelect={(id) => onProperty(all.find((l) => l.id === id)?.propertyId ?? '')}
                formatValue={(n) => signedPct(n)}
                items={withEsc.filter((r) => (r.realised ?? 0) <= 0).map((r) => ({
                  id: r.lease.id, label: r.lease.tenant, value: Math.abs(r.realised ?? 0),
                  sub: `${signedPct(r.realised ?? 0)} · ${money(r.rent)}`,
                }))}
              />
            )}
          </Card>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Every lease, contracted against realised</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tenant</th><th>Property</th><th>Unit</th>
                <th className="num">Contracted</th><th className="num">Realised</th>
                <th className="num">Jan rate</th><th className="num">Dec rate</th>
                <th className="num">Monthly gain</th><th className="num">{k.fiscalYear} rent</th>
              </tr>
            </thead>
            <tbody>
              {withEsc.map(({ lease, stated, realised, rent }) => (
                <tr key={lease.id} className="clickable" onClick={() => onProperty(lease.propertyId)}>
                  <td className="t-strong">{lease.tenant}</td>
                  <td className="t-mute">{propName(lease.propertyId)}</td>
                  <td className="t-mono t-mute">{lease.unit}</td>
                  <td className="num">{stated !== undefined ? pct(stated, 0) : <span className="t-mute">Not stated</span>}</td>
                  <td className={`num ${(realised ?? 0) < (stated ?? 0) - 0.75 ? 't-red' : ''}`}>{signedPct(realised ?? 0)}</td>
                  <td className="num t-mute">{money(firstRate(lease))}</td>
                  <td className="num t-mute">{money(lastRate(lease))}</td>
                  <td className="num">{money(lastRate(lease) - firstRate(lease))}</td>
                  <td className="num t-strong">{money(rent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
