import { useMemo, useState } from 'react'
import { Card, Empty, Kpi } from '../components/ui'
import { RankedBars } from '../components/charts'
import { money, num, pct } from '../lib/format'
import {
  GRACE_THROUGH_DAY, LATE_FEE_PER_DAY, chargesForYear, payerRecordsFor, projectedLateFee, statusOf,
  trackedCharges, type CollectionSettings, type Payment, type PayerRecord,
} from '../lib/receivables'
import { resolveProfile, type TenantProfiles } from '../lib/tenants'
import type { PortfolioKpis } from '../lib/portfolio'
import { rentRoll } from '../data/rentRolls'

/** How a payer reads at a glance. Ordered worst to best. */
type Tier = 'chronic' | 'slow' | 'watch' | 'reliable'

const TIER: Record<Tier, { label: string; cls: string; note: string }> = {
  chronic: { label: 'Chronic', cls: 'critical', note: 'Late most months' },
  slow: { label: 'Slow', cls: 'critical', note: 'Regularly past grace' },
  watch: { label: 'Watch', cls: 'warn', note: 'Occasionally late' },
  reliable: { label: 'Reliable', cls: 'paid', note: 'Pays within grace' },
}

/**
 * An on-time rate needs months that actually settled with a payment date behind
 * them. Where none have — because the months before were declared clean rather
 * than recorded one by one — the rate comes back 0%, which is not a bad record
 * but no record at all. Judging on it turns a tenant's first late month into
 * "late most months".
 */
const tierOf = (r: PayerRecord): Tier => {
  if (r.chargesSettled === 0 && r.chargesOpen === 0) return 'reliable'
  const rated = r.chargesSettled > 0
  if ((rated && r.onTimeRatePct < 50) || r.monthsLate >= 4) return 'chronic'
  if ((rated && r.onTimeRatePct < 80) || r.monthsLate >= 2) return 'slow'
  if (r.monthsLate > 0) return 'watch'
  return 'reliable'
}

const dtp = (n?: number): string => (n === undefined ? '—' : `${n} ${n === 1 ? 'day' : 'days'}`)

/**
 * Slow payers, days-to-pay, and what the late fees come to.
 *
 * DTP is measured from the 1st — the day rent falls due — to the day the balance
 * was fully covered, so paying on the 1st is zero days and paying on the 5th is
 * four. Anything within the grace period counts as on time even though the DTP
 * is not zero; the two numbers answer different questions and are kept apart.
 */
export function SlowPayers({
  k, payments, profiles, settings, onTenant, onProperty,
}: {
  k: PortfolioKpis
  payments: Payment[]
  profiles: TenantProfiles
  settings: CollectionSettings
  onTenant: (leaseId: string) => void
  onProperty: (id: string) => void
}) {
  const [propertyFilter, setPropertyFilter] = useState('all')
  const [projectDays, setProjectDays] = useState(30)

  // The sheet stops when the year does; rent does not, so collection looks
  // past it and marks what it carried.
  const carry = { reportedMonths: rentRoll(k.fiscalYear).monthsReported, carryForward: true }

  const leases = useMemo(
    () => k.properties.flatMap((p) => p.leases)
      .filter((l) => propertyFilter === 'all' || l.propertyId === propertyFilter),
    [k, propertyFilter],
  )
  const charges = useMemo(
    () => trackedCharges(chargesForYear(leases, k.fiscalYear, carry), settings.startPeriod),
    [leases, k.fiscalYear, settings.startPeriod, carry],
  )
  const records = useMemo(
    () => payerRecordsFor(charges, payments, k.asOf, settings),
    [charges, payments, k.asOf, settings],
  )

  const nameOf = (r: PayerRecord): string =>
    resolveProfile(r.leaseId, [], profiles).displayName || r.tenant

  const propertyName = (id: string): string =>
    k.properties.find((p) => p.property.id === id)?.property.name ?? id

  // Only tenants with a settled month have a payment history worth ranking.
  // Only a recorded payment carries a date, so only those tenants can be ranked
  // on speed. A declared month says the rent came in, not when.
  const rated = records.filter((r) => r.chargesSettled > 0)
  const unrated = records.filter((r) => r.chargesSettled === 0)
  const declaredOnly = records.filter((r) => r.chargesSettled === 0 && r.chargesDeclared > 0)

  const slowest = [...rated].sort((a, b) => (b.averageDaysToPay ?? 0) - (a.averageDaysToPay ?? 0))
  const fastest = [...rated].sort((a, b) => (a.averageDaysToPay ?? 0) - (b.averageDaysToPay ?? 0))
  const problem = slowest.filter((r) => tierOf(r) === 'chronic' || tierOf(r) === 'slow')

  const portfolioDtp = rated.length
    ? rated.reduce((a, r) => a + (r.averageDaysToPay ?? 0), 0) / rated.length
    : undefined
  const settledMonths = rated.reduce((a, r) => a + r.chargesSettled, 0)
  const onTimeMonths = rated.reduce((a, r) => a + Math.round((r.onTimeRatePct / 100) * r.chargesSettled), 0)

  // Late fees: what has accrued, and what an unpaid balance keeps adding.
  const fees = useMemo(() => {
    const statuses = charges.map((c) => statusOf(c, payments, k.asOf, settings))
    const byLease = new Map<string, {
      leaseId: string; tenant: string; unit: string; propertyId: string
      earned: number; waived: number; openLateDays: number; openBalance: number; lateMonths: number
    }>()
    for (const s of statuses) {
      const c = s.charge
      const cur = byLease.get(c.leaseId) ?? {
        leaseId: c.leaseId, tenant: c.tenant, unit: c.unit, propertyId: c.propertyId,
        earned: 0, waived: 0, openLateDays: 0, openBalance: 0, lateMonths: 0,
      }
      cur.earned += s.lateFee
      if (s.lateFeeWaived) cur.waived += s.lateDays * LATE_FEE_PER_DAY
      if (s.lateDays > 0) cur.lateMonths += 1
      if (s.balance > 0.005 && s.isDue) {
        cur.openBalance += s.balance
        // Only an unwaived open month keeps the meter running.
        if (!s.lateFeeWaived) cur.openLateDays += s.lateDays
      }
      byLease.set(c.leaseId, cur)
    }
    return [...byLease.values()]
      .filter((f) => f.earned > 0 || f.waived > 0 || f.openBalance > 0)
      .sort((a, b) => b.earned - a.earned)
  }, [charges, payments])

  const feesEarned = fees.reduce((a, f) => a + f.earned, 0)
  const feesWaived = fees.reduce((a, f) => a + f.waived, 0)
  const openLateDays = fees.reduce((a, f) => a + f.openLateDays, 0)
  const stillAccruing = fees.filter((f) => f.openLateDays > 0 || f.openBalance > 0).length
  const projected = fees.reduce(
    (a, f) => a + (f.openBalance > 0 ? projectedLateFee(f.openLateDays, projectDays) : f.earned),
    0,
  )

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Slow payers &amp; late fees</h1>
          <p className="page-sub">
            Days to pay (DTP) runs from the 1st, when rent falls due, to the day the month was fully
            covered. Paying on the 1st is 0 days; paying on the {GRACE_THROUGH_DAY}th is{' '}
            {GRACE_THROUGH_DAY - 1} days and still on time. From the 6th, ${LATE_FEE_PER_DAY} a day
            accrues until the balance clears.
          </p>
        </div>
        <select value={propertyFilter} onChange={(e) => setPropertyFilter(e.target.value)}>
          <option value="all">All properties</option>
          {k.properties.map((p) => (
            <option key={p.property.id} value={p.property.id}>{p.property.name}</option>
          ))}
        </select>
      </div>

      {payments.length === 0 && !settings.settledThrough && (
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
          label="Portfolio DTP"
          value={portfolioDtp === undefined ? '—' : `${portfolioDtp.toFixed(1)} days`}
          note={rated.length ? `Mean across ${num(rated.length)} rated tenants` : 'No payments recorded yet'}
          accent
        />
        <Kpi
          label="Paid within grace"
          value={settledMonths ? pct((onTimeMonths / settledMonths) * 100) : '—'}
          note={settledMonths ? `${num(onTimeMonths)} of ${num(settledMonths)} settled months` : 'Nothing settled yet'}
          warn={Boolean(settledMonths) && onTimeMonths / settledMonths < 0.8}
        />
        <Kpi
          label="Slow payers"
          value={num(problem.length)}
          note={problem.length ? `${money(problem.reduce((a, r) => a + r.balance, 0))} outstanding` : 'None flagged'}
          warn={problem.length > 0}
        />
        <Kpi
          label="Late fees earned"
          value={money(feesEarned)}
          note={stillAccruing ? `${num(stillAccruing)} still accruing` : 'Nothing accruing'}
          warn={feesEarned > 0}
        />
        <Kpi
          label="Fees waived"
          value={money(feesWaived)}
          note={feesWaived > 0 ? 'Forgiven at the landlord’s discretion' : 'None waived'}
        />
      </div>

      {rated.length === 0 ? (
        <Empty>
          {declaredOnly.length > 0 ? (
            <>
              {num(declaredOnly.length)} tenants are settled through{' '}
              {settings.settledThrough ?? 'the declared month'}, but by declaration rather than by
              recorded payments — so the rent is known to have come in, not when. Days to pay starts
              building from the first payment recorded on the Rent collection tab.
            </>
          ) : (
            <>
              No payments have been recorded for {k.fiscalYear} yet, so there is no payment history
              to rank. Record rent as it comes in on the Rent collection tab and this screen fills in.
            </>
          )}
        </Empty>
      ) : (
        <div className="grid-2">
          <Card title="Slowest payers" hint="Average days to pay, highest first">
            <RankedBars
              items={slowest.slice(0, 10).map((r) => ({
                id: r.leaseId,
                label: nameOf(r),
                value: r.averageDaysToPay ?? 0,
                sub: `${propertyName(r.propertyId)} · ${num(r.monthsLate)} late ${r.monthsLate === 1 ? 'month' : 'months'}`,
              }))}
              formatValue={(n) => `${n.toFixed(1)} d`}
              onSelect={onTenant}
              tone="alert"
            />
          </Card>
          <Card title="Fastest payers" hint="Average days to pay, lowest first">
            <RankedBars
              items={fastest.slice(0, 10).map((r) => ({
                id: r.leaseId,
                label: nameOf(r),
                value: r.averageDaysToPay ?? 0,
                sub: `${propertyName(r.propertyId)} · ${pct(r.onTimeRatePct, 0)} on time`,
              }))}
              formatValue={(n) => `${n.toFixed(1)} d`}
              onSelect={onTenant}
            />
          </Card>
        </div>
      )}

      <Card
        title="Payment record by tenant"
        hint={`${num(rated.length)} rated${unrated.length ? ` · ${num(unrated.length)} with nothing settled` : ''}`}
      >
        {records.length === 0 ? (
          <Empty>No rent charges for {k.fiscalYear} under this filter.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Property</th>
                  <th className="num">Avg DTP</th>
                  <th className="num">Fastest</th>
                  <th className="num">Slowest</th>
                  <th className="num">On time</th>
                  <th className="num">Late months</th>
                  <th className="num">Balance</th>
                  <th className="num">Late fees</th>
                  <th>Standing</th>
                </tr>
              </thead>
              <tbody>
                {[...records].sort((a, b) => {
                  const t = tierOf(a) === tierOf(b) ? 0 : Object.keys(TIER).indexOf(tierOf(a)) - Object.keys(TIER).indexOf(tierOf(b))
                  return t || (b.averageDaysToPay ?? -1) - (a.averageDaysToPay ?? -1)
                }).map((r) => {
                  const tier = TIER[tierOf(r)]
                  return (
                    <tr key={r.leaseId} className="clickable" onClick={() => onTenant(r.leaseId)}>
                      <td>
                        <div className="t-strong">{nameOf(r)}</div>
                        <div className="t-mute" style={{ fontSize: 11.5 }}>{r.unit}</div>
                      </td>
                      <td className="t-mute">{propertyName(r.propertyId)}</td>
                      <td className="num">{r.averageDaysToPay === undefined ? '—' : r.averageDaysToPay.toFixed(1)}</td>
                      <td className="num t-mute">{dtp(r.fastestDaysToPay)}</td>
                      <td className="num t-mute">{dtp(r.slowestDaysToPay)}</td>
                      <td className="num">{r.chargesSettled ? pct(r.onTimeRatePct, 0) : '—'}</td>
                      <td className="num">{r.monthsLate || '—'}</td>
                      <td className="num">{r.balance > 0.005 ? money(r.balance) : '—'}</td>
                      <td className="num">
                        {r.totalLateFees > 0 ? money(r.totalLateFees) : '—'}
                        {r.lateFeesOutstanding > 0 && (
                          <div className="t-red" style={{ fontSize: 11 }}>
                            {money(r.lateFeesOutstanding)} still owed
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${tier.cls}`}>{tier.label}</span>
                        {r.chargesSettled === 0 && r.chargesOpen > 0 && (
                          <div className="t-mute" style={{ fontSize: 11 }}>Nothing settled</div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td className="label" colSpan={2}>{num(records.length)} tenants</td>
                  <td className="num">{portfolioDtp === undefined ? '—' : portfolioDtp.toFixed(1)}</td>
                  <td colSpan={3} />
                  <td className="num">{num(records.reduce((a, r) => a + r.monthsLate, 0))}</td>
                  <td className="num">{money(records.reduce((a, r) => a + r.balance, 0))}</td>
                  <td className="num">{money(records.reduce((a, r) => a + r.totalLateFees, 0))}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <Card
        title="Late fee revenue by tenant"
        hint={`$${LATE_FEE_PER_DAY} per day past the ${GRACE_THROUGH_DAY}th`}
        actions={
          <label className="row" style={{ gap: 7, fontSize: 12.5 }}>
            <span className="t-mute">Project unpaid balances forward</span>
            <select value={projectDays} onChange={(e) => setProjectDays(Number(e.target.value))}>
              <option value={0}>as of today</option>
              <option value={7}>+7 days</option>
              <option value={30}>+30 days</option>
              <option value={60}>+60 days</option>
              <option value={90}>+90 days</option>
            </select>
          </label>
        }
      >
        {fees.length === 0 ? (
          <Empty>
            No late fees have accrued for {k.fiscalYear}. A fee only starts once a month passes the{' '}
            {GRACE_THROUGH_DAY}th with a balance still open.
          </Empty>
        ) : (
          <>
            <div className="row" style={{ gap: 24, marginBottom: 12 }}>
              <div>
                <div className="t-mute" style={{ fontSize: 11.5 }}>Accrued to date</div>
                <div className="t-mono t-strong" style={{ fontSize: 19 }}>{money(feesEarned)}</div>
              </div>
              <div>
                <div className="t-mute" style={{ fontSize: 11.5 }}>
                  If unpaid balances run another {projectDays} days
                </div>
                <div className="t-mono t-strong" style={{ fontSize: 19, color: 'var(--red)' }}>
                  {money(projected)}
                </div>
              </div>
              <div>
                <div className="t-mute" style={{ fontSize: 11.5 }}>Late days still running</div>
                <div className="t-mono t-strong" style={{ fontSize: 19 }}>{num(openLateDays)}</div>
              </div>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Tenant</th>
                    <th>Property</th>
                    <th className="num">Late months</th>
                    <th className="num">Late days</th>
                    <th className="num">Fees earned</th>
                    <th className="num">Waived</th>
                    <th className="num">Open balance</th>
                    <th className="num">+{projectDays} days</th>
                  </tr>
                </thead>
                <tbody>
                  {fees.map((f) => {
                    const forward = f.openBalance > 0
                      ? projectedLateFee(f.openLateDays, projectDays)
                      : f.earned
                    return (
                      <tr key={f.leaseId} className="clickable" onClick={() => onTenant(f.leaseId)}>
                        <td>
                          <div className="t-strong">
                            {resolveProfile(f.leaseId, [], profiles).displayName || f.tenant}
                          </div>
                          <div className="t-mute" style={{ fontSize: 11.5 }}>{f.unit}</div>
                        </td>
                        <td className="t-mute">
                          <button className="link" onClick={(e) => { e.stopPropagation(); onProperty(f.propertyId) }}>
                            {propertyName(f.propertyId)}
                          </button>
                        </td>
                        <td className="num">{f.lateMonths || '—'}</td>
                        <td className="num">{f.openLateDays || '—'}</td>
                        <td className="num t-strong">{f.earned > 0 ? money(f.earned) : '—'}</td>
                        <td className="num t-mute">{f.waived > 0 ? money(f.waived) : '—'}</td>
                        <td className="num">{f.openBalance > 0 ? money(f.openBalance) : '—'}</td>
                        <td className="num" style={forward > f.earned ? { color: 'var(--red)' } : undefined}>
                          {money(forward)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="label" colSpan={2}>{num(fees.length)} tenants</td>
                    <td className="num">{num(fees.reduce((a, f) => a + f.lateMonths, 0))}</td>
                    <td className="num">{num(openLateDays)}</td>
                    <td className="num">{money(feesEarned)}</td>
                    <td className="num">{money(feesWaived)}</td>
                    <td className="num">{money(fees.reduce((a, f) => a + f.openBalance, 0))}</td>
                    <td className="num">{money(projected)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </Card>

      <div className="callout">
        <div className="callout-title">How these numbers are worked out</div>
        <p>
          A month counts as late only after the {GRACE_THROUGH_DAY}th, and the fee is{' '}
          ${LATE_FEE_PER_DAY} for each calendar day beyond it — so a payment landing on the 6th
          carries one day, ${LATE_FEE_PER_DAY}. A part payment does not stop the clock; the fee runs
          until the month is covered in full. Fees marked waived were forgiven when the payment was
          recorded and are shown separately rather than dropped, so the amount given up stays
          visible. The projection is a what-if on today’s open balances, not an amount billed.
        </p>
      </div>
    </div>
  )
}
