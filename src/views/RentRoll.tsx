import { useMemo, useState } from 'react'
import { Card, Empty, ExpiryBadge, Kpi } from '../components/ui'
import { cellAmount, collected, darkMonths, isDark, realisedEscalationPct, tenancyYears } from '../lib/finance'
import { dateLabel, money, num, signedPct } from '../lib/format'
import { download } from '../lib/expenses'
import { ApolloRoll } from '../components/ApolloRoll'
import { APOLLO_REGISTRY_LABEL, APOLLO_WATER_CHARGE } from '../data/apollo'
import { EditLease } from '../components/EditLease'
import { changedFields, type Overrides } from '../lib/overrides'
import type { ApolloTenant } from '../lib/types'
import type { PortfolioKpis } from '../lib/portfolio'
import type { Lease } from '../lib/types'

type SortKey = 'tenant' | 'property' | 'rent' | 'end' | 'bump' | 'tenure'

/**
 * Commercial suites and Apollo lots are different animals — one has terms,
 * escalations and expiries, the other is month-to-month lot rent. They get
 * separate tables rather than one table with half its columns dashed out, but
 * both live here so "the rent roll" means every tenant, not just the shops.
 */
type Segment = 'all' | 'commercial' | 'apollo'

export function RentRoll({
  k, onProperty, apolloTenants: APOLLO_TENANTS, overrides, setOverrides, originalLeases,
}: {
  k: PortfolioKpis
  onProperty: (id: string) => void
  apolloTenants: ApolloTenant[]
  overrides: Overrides
  setOverrides: (next: Overrides) => void
  originalLeases: Lease[]
}) {
  const [editing, setEditing] = useState<Lease | null>(null)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('rent')
  const [asc, setAsc] = useState(false)
  const [segment, setSegment] = useState<Segment>('all')

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

  const apolloRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...APOLLO_TENANTS]
      .filter((t) =>
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.address.toLowerCase().includes(q) ||
        t.contacts.some((c) => c.phone.includes(q)))
      .sort((a, b) => (sort === 'rent' ? (asc ? a.amountDue - b.amountDue : b.amountDue - a.amountDue) : a.name.localeCompare(b.name)))
  }, [query, sort, asc])

  const apolloPaying = APOLLO_TENANTS.filter((t) => !t.isParking)
  const apolloMonthly = apolloPaying.reduce((a, t) => a + t.amountDue, 0)
  const totalTenants = k.unitCount + apolloPaying.length

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
        <Kpi accent label="Tenants in total" value={num(totalTenants)}
          note={`${k.unitCount} commercial units + ${apolloPaying.length} Apollo lots`} />
        <Kpi label="Commercial annual rent" value={money(k.commercialGross)} note={`${k.occupiedUnits} paying rent`} />
        <Kpi accent label="Apollo billed monthly" value={money(apolloMonthly)}
          note={`${money(apolloMonthly * 12)} annualised · ${APOLLO_REGISTRY_LABEL}`} />
        <Kpi label="Average per tenant" value={money(k.commercialGross / k.occupiedUnits)} note="Commercial only" />
        <Kpi label="Largest" value={money(k.topTenants[0]?.rent ?? 0)} small note={k.topTenants[0]?.lease.tenant} />
        <Kpi label="Smallest" value={money(k.topTenants[k.topTenants.length - 1]?.rent ?? 0)} small
          note={k.topTenants[k.topTenants.length - 1]?.lease.tenant} />
        <Kpi label="Longest tenancy" value={longestTenancy(k)} small />
      </div>

      <div className="section">
        <div className="toolbar">
          <div className="chip-row">
            <button className={`chip${segment === 'all' ? ' active' : ''}`} onClick={() => setSegment('all')}>
              All tenants <span style={{ opacity: 0.7 }}>{totalTenants}</span>
            </button>
            <button className={`chip${segment === 'commercial' ? ' active' : ''}`} onClick={() => setSegment('commercial')}>
              Commercial <span style={{ opacity: 0.7 }}>{k.unitCount}</span>
            </button>
            <button className={`chip${segment === 'apollo' ? ' active' : ''}`} onClick={() => setSegment('apollo')}>
              Apollo lots <span style={{ opacity: 0.7 }}>{apolloPaying.length}</span>
            </button>
          </div>
          <input
            placeholder="Search tenant, unit, property or phone…"
            value={query} onChange={(e) => setQuery(e.target.value)} style={{ minWidth: 300, flex: 1, maxWidth: 460 }}
          />
          <span className="t-mute">{rows.length} of {k.unitCount}</span>
          <div className="spacer" />
          <button
            className="btn"
            onClick={() => download(
              `ntp-rent-roll-${new Date().toISOString().slice(0, 10)}.csv`,
              buildCsv(segment, rows, apolloRows, propName),
            )}
          >
            Export CSV
          </button>
        </div>

        {segment !== 'apollo' && (rows.length === 0 ? <Empty>No commercial tenants match that search.</Empty> : (
          <>
          {segment === 'all' && (
            <div className="section-title" style={{ marginTop: 4 }}>
              Commercial suites <span className="hint">terms, escalations and expiry dates</span>
            </div>
          )}
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
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => {
                  const realised = realisedEscalationPct(l)
                  const years = tenancyYears(l)
                  const dark = darkMonths(l)
                  const edited = changedFields(overrides.leases[l.id])
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
                      <td className="t-nowrap" onClick={(e) => e.stopPropagation()}>
                        {edited.length > 0 && (
                          <span className="badge warn" title={`Edited: ${edited.join(', ')}`}>edited</span>
                        )}
                        <button className="btn ghost sm" onClick={() => setEditing(l)}>Edit</button>
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
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          </>
        ))}

        {segment !== 'commercial' && (
          <div style={{ marginTop: segment === 'all' ? 26 : 0 }}>
            <div className="section-title">
              Apollo Mobile Home Court
              <span className="hint">
                {apolloPaying.length} lots, month to month, from the {APOLLO_REGISTRY_LABEL}. Every amount
                includes {money(APOLLO_WATER_CHARGE)} for water.
              </span>
            </div>
            {apolloRows.length === 0
              ? <Empty>No Apollo tenants match that search.</Empty>
              : <ApolloRoll tenants={apolloRows} caption={`${apolloRows.filter((t) => !t.isParking).length} lots shown`} />}
          </div>
        )}
      </div>

      <div className="section">
        <Card title="Lease structure" hint="modified gross throughout">
          <p className="page-sub" style={{ marginTop: 0 }}>
            All {k.unitCount} leases are <strong>modified gross</strong>, confirmed by the owner —
            covering {money(k.commercialGross)} of income. Not one is triple net.
          </p>
          <div className="callout neutral" style={{ marginTop: 12, marginBottom: 0 }}>
            <div className="callout-title">What that means for the numbers</div>
            <p>
              Under modified gross the landlord carries the operating costs rather than billing them
              back, which is exactly what the source sheets show: they reach net by subtracting the
              property tax bill from gross rent. A triple net portfolio would pass those taxes through
              to tenants and the same rent roll would be worth more.
            </p>
            <p>
              So the {money(k.totalTaxes)} tax bill is genuinely the landlord's, and so is everything
              logged in Expenses. The valuation model charges both against NOI rather than assuming
              any recovery — which is the conservative and, here, the correct treatment.
            </p>
          </div>
        </Card>
      </div>

      {editing && (
        <EditLease
          lease={editing}
          original={originalLeases.find((l) => l.id === editing.id) ?? editing}
          overrides={overrides}
          setOverrides={setOverrides}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}

const csvCell = (v: unknown): string => {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Apollo lots as their own block, since they carry no month cells or lease dates. */
function apolloCsv(tenants: ApolloTenant[]): string {
  const header = ['Tenant', 'Lot address', 'Tenancy', 'Monthly due', 'Water', 'Base rent', 'Annualised', 'Contacts']
  const rows = tenants.map((t) => [
    t.name,
    t.address,
    t.isParking ? 'Parking space' : 'Month to month',
    t.amountDue > 0 ? t.amountDue.toFixed(2) : '',
    t.amountDue > 0 ? APOLLO_WATER_CHARGE.toFixed(2) : '',
    t.amountDue > 0 ? (t.amountDue - APOLLO_WATER_CHARGE).toFixed(2) : '',
    t.amountDue > 0 ? (t.amountDue * 12).toFixed(2) : '',
    t.contacts.map((c) => `${c.label ? `${c.label} ` : ''}${c.phone}`).join('; '),
  ])
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n')
}

/** One file matching whatever the screen is showing. */
function buildCsv(
  segment: Segment,
  commercial: Lease[],
  apollo: ApolloTenant[],
  propName: (id: string) => string,
): string {
  if (segment === 'apollo') return `Apollo Mobile Home Court — ${APOLLO_REGISTRY_LABEL}\n${apolloCsv(apollo)}`
  if (segment === 'commercial') return `Commercial suites — 2025\n${toCsv(commercial, propName)}`
  return [
    `Commercial suites — 2025`,
    toCsv(commercial, propName),
    '',
    `Apollo Mobile Home Court — ${APOLLO_REGISTRY_LABEL}`,
    apolloCsv(apollo),
  ].join('\n')
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
