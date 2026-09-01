import { useMemo, useState } from 'react'
import { LadderChart } from '../components/charts'
import { Card, Empty, ExpiryBadge, Kpi, expiryInfo, type ExpiryStatus } from '../components/ui'
import { collected, monthsRemaining } from '../lib/finance'
import { dateLabel, money, num, pct } from '../lib/format'
import type { PortfolioKpis } from '../lib/portfolio'
import type { Lease } from '../lib/types'

type Filter =
  | 'all' | 'expired' | 'vacated' | 'rolling' | 'critical' | 'soon' | 'watch' | 'safe'
  | 'none' | 'conveyed'

const FILTERS: { id: Filter; label: string; match: (s: ExpiryStatus) => boolean }[] = [
  { id: 'all', label: 'All leases', match: () => true },
  { id: 'expired', label: 'On holdover', match: (s) => s === 'expired' },
  { id: 'vacated', label: 'Lapsed and vacant', match: (s) => s === 'vacated' },
  { id: 'critical', label: 'Under 3 months', match: (s) => s === 'critical' },
  { id: 'soon', label: '3–6 months', match: (s) => s === 'soon' },
  { id: 'watch', label: '6–12 months', match: (s) => s === 'watch' },
  { id: 'safe', label: 'Over a year', match: (s) => s === 'safe' },
  { id: 'rolling', label: 'Month to month', match: (s) => s === 'rolling' },
  { id: 'none', label: 'No end date', match: (s) => s === 'none' },
  { id: 'conveyed', label: 'Sold with a building', match: (s) => s === 'conveyed' },
]

export function Expirations({ k, onProperty }: { k: PortfolioKpis; onProperty: (id: string) => void }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')

  const propName = (id: string) => k.properties.find((p) => p.property.id === id)?.property.name ?? id
  const holdoverRent = k.holdoverLeases.reduce((a, l) => a + collected(l), 0)

  const rows = useMemo(() => {
    const all = k.properties.flatMap((p) => p.leases)
    const f = FILTERS.find((x) => x.id === filter)!
    const q = query.trim().toLowerCase()
    return all
      .map((l) => ({ lease: l, info: expiryInfo(l, k.asOf), rent: collected(l) }))
      .filter((r) => f.match(r.info.status))
      .filter((r) =>
        !q ||
        r.lease.tenant.toLowerCase().includes(q) ||
        r.lease.unit.toLowerCase().includes(q) ||
        propName(r.lease.propertyId).toLowerCase().includes(q))
      .sort((a, b) => {
        const am = monthsRemaining(a.lease, k.asOf)
        const bm = monthsRemaining(b.lease, k.asOf)
        if (am === undefined) return 1
        if (bm === undefined) return -1
        return am - bm
      })
  }, [k, filter, query])

  const counts = useMemo(() => {
    const all = k.properties.flatMap((p) => p.leases)
    const c: Record<string, number> = {}
    for (const f of FILTERS) c[f.id] = all.filter((l) => f.match(expiryInfo(l, k.asOf).status)).length
    return c
  }, [k])

  const rentIn = (lo: number, hi: number) =>
    k.properties.flatMap((p) => p.leases)
      .filter((l) => {
        const m = monthsRemaining(l, k.asOf)
        return m !== undefined && m >= lo && m <= hi
      })
      .reduce((a, l) => a + collected(l), 0)

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Lease expirations</h1>
        <p className="page-sub">
          Every lease sorted by how soon it runs out, measured from today. A lapsed lease means the
          tenant is paying on holdover with no term protection on either side — those sit at the top.
        </p>
      </div>

      <div className="kpi-grid">
        <Kpi accent label="On holdover" value={num(k.holdoverLeases.length)}
          note={k.holdoverLeases.length > 0
            ? `${money(holdoverRent)} of rent, ${pct((holdoverRent / k.grossCollected) * 100)} of income`
            : 'Nobody is paying past a lease end date'}
          warn={k.holdoverLeases.length > 0} />
        <Kpi label="Lapsed and vacant" value={num(k.vacatedLeases.length)}
          note={k.vacatedLeases.length > 0 ? 'Units to re-let' : 'None'}
          warn={k.vacatedLeases.length > 0} />
        <Kpi label="Month to month" value={num(k.monthToMonthLeases.length)}
          note="Rolling by agreement, not lapsed" />
        <Kpi label="Next 3 months" value={num(counts.critical)} note={money(rentIn(0, 3))} warn />
        <Kpi label="3 – 6 months" value={num(counts.soon)} note={money(rentIn(4, 6))} warn />
        <Kpi label="6 – 12 months" value={num(counts.watch)} note={money(rentIn(7, 12))} />
        <Kpi label="Beyond a year" value={num(counts.safe)} note={money(rentIn(13, 600))} />
        <Kpi label="No end date recorded" value={num(counts.none)} note="Needs a lease document" warn />
      </div>

      <div className="section">
        <Card title="Rent expiring by year">
          <LadderChart buckets={k.expirationLadder} />
        </Card>
      </div>

      <div className="section">
        <div className="toolbar">
          <div className="chip-row">
            {FILTERS.map((f) => (
              <button key={f.id} className={`chip${filter === f.id ? ' active' : ''}`} onClick={() => setFilter(f.id)}>
                {f.label} <span style={{ opacity: 0.7 }}>{counts[f.id]}</span>
              </button>
            ))}
          </div>
          <div className="spacer" />
          <input
            placeholder="Search tenant, unit or property…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ minWidth: 230 }}
          />
        </div>

        {rows.length === 0 ? (
          <Empty>No leases match that filter.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Tenant</th>
                  <th>Property</th>
                  <th>Unit</th>
                  <th>Commenced</th>
                  <th>Expires</th>
                  <th className="num">{k.fiscalYear} rent</th>
                  <th className="num">Monthly (Dec)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ lease, rent }) => (
                  <tr key={lease.id} className="clickable" onClick={() => onProperty(lease.propertyId)}>
                    <td><ExpiryBadge lease={lease} asOf={k.asOf} /></td>
                    <td className="t-strong">{lease.tenant}</td>
                    <td className="t-mute">{propName(lease.propertyId)}</td>
                    <td className="t-mono t-mute">{lease.unit}</td>
                    <td className="t-mono t-mute t-nowrap">{dateLabel(lease.leaseStart)}</td>
                    <td className="t-mono t-nowrap">{dateLabel(lease.leaseEnd)}</td>
                    <td className="num">{money(rent)}</td>
                    <td className="num t-mute">{money(lastMonthly(lease))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="label" colSpan={6}>{rows.length} leases shown</td>
                  <td className="num">{money(rows.reduce((a, r) => a + r.rent, 0))}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

function lastMonthly(l: Lease): number {
  for (let i = l.months.length - 1; i >= 0; i--) {
    const m = l.months[i]
    if (typeof m === 'number' && m > 0) return m
  }
  return 0
}
