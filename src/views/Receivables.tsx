import { useMemo, useState } from 'react'
import { Card, Empty, Kpi } from '../components/ui'
import { RankedBars } from '../components/charts'
import { money, num, pct } from '../lib/format'
import {
  GRACE_THROUGH_DAY, LATE_FEE_PER_DAY, MONTH_NAMES, agingOf, chargesForYear, statusOf, trackedCharges,
  type AgingBucket, type ChargeStatus, type CollectionSettings, type Payment,
} from '../lib/receivables'
import { resolveProfile, type TenantProfiles } from '../lib/tenants'
import type { PortfolioKpis } from '../lib/portfolio'

const BUCKETS: { id: AgingBucket; label: string; note: string }[] = [
  { id: 'current', label: 'Current', note: 'Not yet past due' },
  { id: '1-30', label: '1–30 days', note: 'This month' },
  { id: '31-60', label: '31–60 days', note: 'One month behind' },
  { id: '61-90', label: '61–90 days', note: 'Two months behind' },
  { id: '90+', label: 'Over 90 days', note: 'Collection risk' },
]

const BUCKET_CLASS: Record<AgingBucket, string> = {
  current: 'mute',
  '1-30': 'warn',
  '31-60': 'warn',
  '61-90': 'critical',
  '90+': 'critical',
}

/**
 * Accounts receivable — what is owed, by whom, and for how long.
 *
 * A month only appears here once it is genuinely outstanding. Months the rent
 * roll does not cover are not debts, and a paid month drops out entirely, so the
 * balance on this screen is the real one rather than a running gross.
 */
export function Receivables({
  k, payments, profiles, settings, onTenant, onProperty,
}: {
  k: PortfolioKpis
  payments: Payment[]
  profiles: TenantProfiles
  settings: CollectionSettings
  onTenant: (leaseId: string) => void
  onProperty: (id: string) => void
}) {
  const [bucketFilter, setBucketFilter] = useState<AgingBucket | 'all'>('all')
  const [propertyFilter, setPropertyFilter] = useState('all')

  const leases = useMemo(() => k.properties.flatMap((p) => p.leases), [k])
  const charges = useMemo(
    () => trackedCharges(chargesForYear(leases, k.fiscalYear), settings.startPeriod),
    [leases, k.fiscalYear, settings.startPeriod],
  )

  // Only unsettled months are receivable. Everything else is history.
  const open = useMemo(
    () => charges
      .map((c) => statusOf(c, payments))
      .filter((s) => s.balance > 0.005)
      .map((s) => ({ status: s, bucket: agingOf(s) }))
      .sort((a, b) => b.status.charge.dueDate.getTime() - a.status.charge.dueDate.getTime()),
    [charges, payments],
  )

  const totals = useMemo(() => {
    const byBucket = new Map<AgingBucket, { amount: number; count: number }>()
    for (const row of open) {
      const cur = byBucket.get(row.bucket) ?? { amount: 0, count: 0 }
      cur.amount += row.status.balance
      cur.count += 1
      byBucket.set(row.bucket, cur)
    }
    return byBucket
  }, [open])

  const owed = open.reduce((a, r) => a + r.status.balance, 0)
  const lateFees = open.reduce((a, r) => a + r.status.lateFee, 0)
  const billed = charges.reduce((a, c) => a + c.amountDue, 0)
  const pastDue = open.filter((r) => r.bucket !== 'current')
  const pastDueAmount = pastDue.reduce((a, r) => a + r.status.balance, 0)

  const byTenant = useMemo(() => {
    const m = new Map<string, { leaseId: string; tenant: string; unit: string; propertyId: string; balance: number; months: number; lateFee: number; oldest: AgingBucket }>()
    for (const { status, bucket } of open) {
      const c = status.charge
      const cur = m.get(c.leaseId) ?? {
        leaseId: c.leaseId, tenant: c.tenant, unit: c.unit, propertyId: c.propertyId,
        balance: 0, months: 0, lateFee: 0, oldest: bucket,
      }
      cur.balance += status.balance
      cur.months += 1
      cur.lateFee += status.lateFee
      if (BUCKETS.findIndex((b) => b.id === bucket) > BUCKETS.findIndex((b) => b.id === cur.oldest)) {
        cur.oldest = bucket
      }
      m.set(c.leaseId, cur)
    }
    return [...m.values()].sort((a, b) => b.balance - a.balance)
  }, [open])

  const byProperty = useMemo(() => {
    const m = new Map<string, { id: string; name: string; balance: number; tenants: Set<string> }>()
    for (const { status } of open) {
      const p = k.properties.find((x) => x.property.id === status.charge.propertyId)
      const cur = m.get(status.charge.propertyId)
        ?? { id: status.charge.propertyId, name: p?.property.name ?? status.charge.propertyId, balance: 0, tenants: new Set<string>() }
      cur.balance += status.balance
      cur.tenants.add(status.charge.leaseId)
      m.set(status.charge.propertyId, cur)
    }
    return [...m.values()].sort((a, b) => b.balance - a.balance)
  }, [open, k])

  const rows = open.filter(
    (r) => (bucketFilter === 'all' || r.bucket === bucketFilter)
      && (propertyFilter === 'all' || r.status.charge.propertyId === propertyFilter),
  )

  const collectedPct = billed > 0 ? ((billed - owed) / billed) * 100 : 0

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Accounts receivable</h1>
          <p className="page-sub">
            Every month of {k.fiscalYear} rent still outstanding, aged from its due date. Rent falls
            due on the 1st; a payment made any time through the {GRACE_THROUGH_DAY}th is on time.
            From the 6th, ${LATE_FEE_PER_DAY} a day accrues until the balance clears.
            {settings.startPeriod && ` Tracking begins ${MONTH_NAMES[Number(settings.startPeriod.slice(5)) - 1]} ${settings.startPeriod.slice(0, 4)}; earlier months are out of scope.`}
          </p>
        </div>
      </div>

      {payments.length === 0 && (
        <div className="callout">
          <div className="callout-title">No payments recorded — these figures are a worst case, not a debt</div>
          <p>
            Nothing has been marked collected for {k.fiscalYear} yet, so every billed month counts as
            outstanding and the late fees are what would have accrued if none of it had ever come in.
            Record rent on the <strong>Rent collection</strong> tab as it arrives, or set a tracking
            start month there so earlier months fall out of scope.
          </p>
        </div>
      )}

      <div className="kpi-grid">
        <Kpi
          label="Outstanding balance"
          value={money(owed)}
          note={`${num(open.length)} unpaid ${open.length === 1 ? 'month' : 'months'} across ${num(byTenant.length)} ${byTenant.length === 1 ? 'tenant' : 'tenants'}`}
          accent
          warn={owed > 0}
        />
        <Kpi
          label="Past due"
          value={money(pastDueAmount)}
          note={pastDue.length ? `${num(pastDue.length)} months beyond grace` : 'Nothing beyond grace'}
          warn={pastDueAmount > 0}
        />
        <Kpi
          label="Late fees accrued"
          value={money(lateFees)}
          note={`$${LATE_FEE_PER_DAY}/day past the ${GRACE_THROUGH_DAY}th`}
          warn={lateFees > 0}
        />
        <Kpi
          label="Collected"
          value={pct(collectedPct)}
          note={`${money(billed - owed)} of ${money(billed)} billed`}
        />
        <Kpi
          label="Oldest balance"
          value={open.length ? BUCKETS.find((b) => b.id === open[open.length - 1].bucket)?.label ?? '—' : 'None'}
          note={open.length
            ? `${MONTH_NAMES[open[open.length - 1].status.charge.month]} ${open[open.length - 1].status.charge.year}`
            : 'Every billed month is settled'}
          warn={open.some((r) => r.bucket === '61-90' || r.bucket === '90+')}
        />
      </div>

      <Card title="Aging" hint="Measured from the 1st of the month the rent was due">
        <div className="aging-grid">
          {BUCKETS.map((b) => {
            const t = totals.get(b.id) ?? { amount: 0, count: 0 }
            const share = owed > 0 ? (t.amount / owed) * 100 : 0
            return (
              <button
                key={b.id}
                className={`aging-cell${bucketFilter === b.id ? ' active' : ''}${t.amount > 0 ? ` ${BUCKET_CLASS[b.id]}` : ''}`}
                onClick={() => setBucketFilter(bucketFilter === b.id ? 'all' : b.id)}
              >
                <span className="aging-label">{b.label}</span>
                <span className="aging-value t-mono">{money(t.amount)}</span>
                <span className="aging-note">
                  {t.count ? `${num(t.count)} ${t.count === 1 ? 'month' : 'months'} · ${pct(share, 0)}` : b.note}
                </span>
              </button>
            )
          })}
        </div>
      </Card>

      {byTenant.length > 0 && (
        <div className="grid-2">
          <Card title="Owed by tenant" hint="Largest balance first">
            <RankedBars
              items={byTenant.slice(0, 12).map((t) => ({
                id: t.leaseId,
                label: t.tenant,
                value: t.balance,
                sub: `${t.unit} · ${num(t.months)} ${t.months === 1 ? 'month' : 'months'}`,
              }))}
              onSelect={onTenant}
            />
          </Card>
          <Card title="Owed by property">
            <RankedBars
              items={byProperty.map((p) => ({
                id: p.id,
                label: p.name,
                value: p.balance,
                sub: `${num(p.tenants.size)} ${p.tenants.size === 1 ? 'tenant' : 'tenants'}`,
              }))}
              onSelect={onProperty}
            />
          </Card>
        </div>
      )}

      <Card
        title="Open items"
        hint={rows.length === open.length ? `${num(rows.length)} unpaid months` : `${num(rows.length)} of ${num(open.length)}`}
        actions={
          <div className="row" style={{ gap: 8 }}>
            <select value={propertyFilter} onChange={(e) => setPropertyFilter(e.target.value)}>
              <option value="all">All properties</option>
              {k.properties.map((p) => (
                <option key={p.property.id} value={p.property.id}>{p.property.name}</option>
              ))}
            </select>
            <select value={bucketFilter} onChange={(e) => setBucketFilter(e.target.value as AgingBucket | 'all')}>
              <option value="all">All ages</option>
              {BUCKETS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
          </div>
        }
      >
        {rows.length === 0 ? (
          <Empty>
            {open.length === 0
              ? `Nothing outstanding. Every ${k.fiscalYear} month with rent recorded has been paid in full — or no payments have been entered yet, in which case record them on the Accounting tab.`
              : 'No open items match this filter.'}
          </Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Unit</th>
                  <th>Month</th>
                  <th className="num">Billed</th>
                  <th className="num">Paid</th>
                  <th className="num">Balance</th>
                  <th className="num">Days late</th>
                  <th className="num">Late fee</th>
                  <th>Age</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ status, bucket }) => {
                  const c = status.charge
                  const profile = resolveProfile(c.leaseId, [], profiles)
                  return (
                    <tr key={status.charge.id} className="clickable" onClick={() => onTenant(c.leaseId)}>
                      <td>
                        <span className="t-strong">{profile.displayName || c.tenant}</span>
                      </td>
                      <td className="t-mute">{c.unit}</td>
                      <td>{MONTH_NAMES[c.month]} {c.year}</td>
                      <td className="num">{money(c.amountDue)}</td>
                      <td className="num">{status.paid > 0 ? money(status.paid) : '—'}</td>
                      <td className="num t-strong">{money(status.balance)}</td>
                      <td className="num">{status.lateDays > 0 ? num(status.lateDays) : '—'}</td>
                      <td className="num">
                        {status.lateFeeWaived ? <span className="t-mute">Waived</span>
                          : status.lateFee > 0 ? money(status.lateFee) : '—'}
                      </td>
                      <td>
                        <span className={`badge ${BUCKET_CLASS[bucket]}`}>
                          {BUCKETS.find((b) => b.id === bucket)?.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td className="label" colSpan={5}>Total</td>
                  <td className="num t-strong">{money(rows.reduce((a, r) => a + r.status.balance, 0))}</td>
                  <td />
                  <td className="num">{money(rows.reduce((a, r) => a + r.status.lateFee, 0))}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <div className="callout">
        <div className="callout-title">What this screen counts</div>
        <p>
          A month appears here only once rent was actually billed for it. Vacant months, free-rent
          months, and months the {k.fiscalYear} rent roll does not cover owe nothing and are left
          out. Balances come from payments recorded on the Rent collection tab — until a payment is
          entered, a month reads as unpaid, so a balance here means “not recorded as paid”, not
          “confirmed unpaid”. Set a tracking start month on that tab if you are not backfilling the
          whole year.
        </p>
      </div>
    </div>
  )
}

/** Shared helper so the slow-payer screen labels aging the same way. */
export const bucketLabel = (b: AgingBucket): string =>
  BUCKETS.find((x) => x.id === b)?.label ?? b

export type { ChargeStatus }
