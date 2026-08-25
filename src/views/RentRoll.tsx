import { useMemo, useState } from 'react'
import { Card, Empty, ExpiryBadge, Kpi } from '../components/ui'
import { cellAmount, collected, darkMonths, isDark, realisedEscalationPct, tenancyYears } from '../lib/finance'
import { dateLabel, money, num, signedPct } from '../lib/format'
import { download } from '../lib/expenses'
import type { PortfolioKpis } from '../lib/portfolio'
import type { Lease } from '../lib/types'

type SortKey = 'tenant' | 'property' | 'rent' | 'end' | 'bump' | 'tenure'

export function RentRoll({ k, onProperty }: { k: PortfolioKpis; onProperty: (id: string) => void }) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('rent')
  const [asc, setAsc] = useState(false)

  const propName = (id: string) => k.properties.find((p) => p.property.id === id)?.property.name ?? id

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const all = k.properties.flatMap((p) => p.leases)
    const filtered = all.filter((l) =>
      !q ||
      l.tenant.toLowerCase().includes(q) ||
      l.unit.toLowerCase().includes(q) ||
      propName(l.propertyId).toLowerCase().includes(q) ||
      l.contacts.some((c) => c.phone.includes(q) || (c.name ?? '').toLowerCase().includes(q)))

    const dir = asc ? 1 : -1
    return [...filtered].sort((a, b) => {
      switch (sort) {
        case 'tenant': return dir * a.tenant.localeCompare(b.tenant)
        case 'property': return dir * propName(a.propertyId).localeCompare(propName(b.propertyId))
        case 'end': return dir * (a.leaseEnd ?? '9999').localeCompare(b.leaseEnd ?? '9999')
        case 'bump': return dir * ((realisedEscalationPct(a) ?? -99) - (realisedEscalationPct(b) ?? -99))
        case 'tenure': return dir * ((tenancyYears(a) ?? -1) - (tenancyYears(b) ?? -1))
        default: return dir * (collected(a) - collected(b))
      }
    })
  }, [k, query, sort, asc])

  const head = (key: SortKey, label: string, numeric = false) => (
    <th
      className={`sortable${numeric ? ' num' : ''}`}
      onClick={() => { if (sort === key) setAsc(!asc); else { setSort(key); setAsc(false) } }}
    >
      {label}{sort === key && <span className="sort-caret">{asc ? '▲' : '▼'}</span>}
    </th>
  )

  const totalRent = rows.reduce((a, l) => a + collected(l), 0)

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Rent roll</h1>
        <p className="page-sub">
          Every commercial tenant in one list — what they pay, what their bump was, when their lease
          ends and how to reach them. Apollo's lot tenants are on their own page.
        </p>
      </div>

      <div className="kpi-grid">
        <Kpi accent label="Commercial tenants" value={num(k.unitCount)} note={`${k.occupiedUnits} paying rent`} />
        <Kpi label="Combined annual rent" value={money(k.commercialGross)} />
        <Kpi label="Average per tenant" value={money(k.commercialGross / k.occupiedUnits)} />
        <Kpi label="Largest" value={money(k.topTenants[0]?.rent ?? 0)} small note={k.topTenants[0]?.lease.tenant} />
        <Kpi label="Smallest" value={money(k.topTenants[k.topTenants.length - 1]?.rent ?? 0)} small
          note={k.topTenants[k.topTenants.length - 1]?.lease.tenant} />
        <Kpi label="Longest tenancy" value={longestTenancy(k)} small />
      </div>

      <div className="section">
        <div className="toolbar">
          <input
            placeholder="Search tenant, unit, property or phone…"
            value={query} onChange={(e) => setQuery(e.target.value)} style={{ minWidth: 300, flex: 1, maxWidth: 460 }}
          />
          <span className="t-mute">{rows.length} of {k.unitCount}</span>
          <div className="spacer" />
          <button className="btn" onClick={() => download(`ntp-rent-roll-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows, propName))}>
            Export CSV
          </button>
        </div>

        {rows.length === 0 ? <Empty>Nothing matches that search.</Empty> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {head('tenant', 'Tenant')}
                  {head('property', 'Property')}
                  <th>Unit</th>
                  <th>Lease type</th>
                  {head('tenure', 'In place', true)}
                  <th>Term</th>
                  <th>Status</th>
                  {head('bump', 'Bump', true)}
                  {head('rent', '2025 rent', true)}
                  <th className="num">Monthly</th>
                  <th>Contacts</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => {
                  const realised = realisedEscalationPct(l)
                  const years = tenancyYears(l)
                  const dark = darkMonths(l)
                  return (
                    <tr key={l.id} className="clickable" onClick={() => onProperty(l.propertyId)}>
                      <td>
                        <div className="t-strong">{l.tenant}</div>
                        {dark > 0 && <span className="badge warn" style={{ marginTop: 3 }}>{dark} dark {dark === 1 ? 'month' : 'months'}</span>}
                      </td>
                      <td className="t-mute t-nowrap">{propName(l.propertyId)}</td>
                      <td className="t-mono t-mute">{l.unit}</td>
                      <td><span className="badge mute">{l.leaseType === 'UNKNOWN' ? 'Not stated' : l.leaseType}</span></td>
                      <td className="num t-mute">{years !== undefined ? `${years.toFixed(1)} yr` : '—'}</td>
                      <td className="t-mono t-mute t-nowrap" style={{ fontSize: 12 }}>
                        {dateLabel(l.leaseStart)}<br />{dateLabel(l.leaseEnd)}
                      </td>
                      <td><ExpiryBadge lease={l} asOf={k.asOf} /></td>
                      <td className="num">
                        {realised === undefined ? <span className="t-mute">—</span> : (
                          <span className={realised < (l.statedEscalationPct ?? 0) - 0.75 ? 't-red' : ''}>
                            {signedPct(realised)}
                            {l.statedEscalationPct !== undefined && <span className="t-mute" style={{ fontSize: 11 }}> / {l.statedEscalationPct}%</span>}
                          </span>
                        )}
                      </td>
                      <td className="num t-strong">{money(collected(l))}</td>
                      <td className="num t-mute">{money(currentMonthly(l))}</td>
                      <td className="t-mute" style={{ fontSize: 11.5 }}>
                        {l.contacts.length === 0 ? '—' : l.contacts.slice(0, 2).map((c, i) => (
                          <div key={i} className="t-nowrap">{c.name ? `${c.name} · ` : ''}{c.phone}</div>
                        ))}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td className="label" colSpan={8}>{rows.length} tenants</td>
                  <td className="num">{money(totalRent)}</td>
                  <td className="num">{money(rows.reduce((a, l) => a + currentMonthly(l), 0))}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <div className="section">
        <Card title="Lease structure" hint="triple net vs modified gross">
          <p className="page-sub" style={{ marginTop: 0 }}>
            The source workbook records rent, dates and escalations, but never states whether a lease is
            triple net or modified gross — so all {k.unitCount} sit unclassified, covering{' '}
            <strong>{money(k.unknownLeaseTypeRent)}</strong> of income.
          </p>
          <div className="callout" style={{ marginTop: 12, marginBottom: 0 }}>
            <div className="callout-title">What the numbers imply</div>
            <p>
              The sheets compute each property's net by subtracting the property tax bill from gross rent.
              A landlord only carries that cost when the tenant is <em>not</em> reimbursing it — under a true
              triple net lease the taxes pass through to the tenant. That points to these being gross or
              modified gross leases, but it is an inference from the bookkeeping, not something the documents
              say. Confirming it against the actual lease documents is the single highest-value data fix
              available: it changes both the NOI and the valuation.
            </p>
          </div>
        </Card>
      </div>
    </>
  )
}

const csvCell = (v: unknown): string => {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** The rent roll as a spreadsheet — every month cell, so nothing is lost in export. */
function toCsv(leases: Lease[], propName: (id: string) => string): string {
  const header = [
    'Property', 'Unit', 'Tenant', 'Lease type', 'Lease start', 'Lease end',
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    '2025 total', 'Stated bump %', 'Realised bump %', 'Contacts',
  ]
  const rows = leases.map((l) => [
    propName(l.propertyId), l.unit, l.tenant,
    l.leaseType === 'UNKNOWN' ? 'Not stated' : l.leaseType,
    l.leaseStart ?? '', l.leaseEnd ?? '',
    ...l.months.map((m) => (typeof m === 'number' ? m.toFixed(2) : m)),
    collected(l).toFixed(2),
    l.statedEscalationPct ?? '',
    realisedEscalationPct(l)?.toFixed(2) ?? '',
    l.contacts.map((c) => `${c.name ? `${c.name} ` : ''}${c.phone}`).join('; '),
  ])
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n')
}

function currentMonthly(l: Lease): number {
  for (let i = l.months.length - 1; i >= 0; i--) {
    if (!isDark(l.months[i])) return cellAmount(l.months[i])
  }
  return 0
}

function longestTenancy(k: PortfolioKpis): string {
  const all = k.properties.flatMap((p) => p.leases)
  let best: { lease: Lease; years: number } | undefined
  for (const l of all) {
    const y = tenancyYears(l)
    if (y !== undefined && (!best || y > best.years)) best = { lease: l, years: y }
  }
  return best ? `${best.years.toFixed(0)} yr — ${best.lease.tenant}` : '—'
}
