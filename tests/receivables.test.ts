import { describe, expect, it } from 'vitest'
import {
  GRACE_THROUGH_DAY, LATE_FEE_PER_DAY, agingOf, chargesForLease, payerRecordsFor, periodOf, statusOf,
  trackedCharges, type Payment, type RentCharge,
} from '../src/lib/receivables'
import type { Lease } from '../src/lib/types'

const lease = (months: Lease['months']): Lease => ({
  id: 'test-lease', propertyId: 'p', unit: '1A', tenant: 'Test Tenant',
  contacts: [], months, statedAnnualTotal: 0, leaseType: 'MG',
})

const pay = (over: Partial<Payment> & { paidOn: string; amount: number }): Payment => ({
  id: 'x', leaseId: 'test-lease', period: '2026-01', recordedAt: '', ...over,
})

const janCharge = (): RentCharge => chargesForLease(lease(Array(12).fill(1000)), 2026)[0]

describe('rent charges', () => {
  it('bills only months that carry rent', () => {
    const l = lease([1000, 'V', 'FREE', 'NR', ...Array(8).fill(1000)])
    const charges = chargesForLease(l, 2026)
    // A vacancy owes nothing, a free month owes nothing, and an unreported
    // month is unknown rather than a debt.
    expect(charges).toHaveLength(9)
    expect(charges.map((c) => c.month)).not.toContain(1)
    expect(charges.map((c) => c.month)).not.toContain(2)
    expect(charges.map((c) => c.month)).not.toContain(3)
  })

  it('falls due on the first with grace through the fifth', () => {
    const c = janCharge()
    expect(c.dueDate.getDate()).toBe(1)
    expect(c.graceThrough.getDate()).toBe(GRACE_THROUGH_DAY)
    expect(c.period).toBe('2026-01')
    expect(periodOf(2026, 0)).toBe('2026-01')
  })
})

describe('the grace period', () => {
  const asOf = new Date('2026-03-01T00:00:00')

  it('charges nothing when paid on the first', () => {
    const s = statusOf(janCharge(), [pay({ paidOn: '2026-01-01', amount: 1000 })], asOf)
    expect(s.state).toBe('paid')
    expect(s.daysToPay).toBe(0)
    expect(s.lateDays).toBe(0)
    expect(s.lateFee).toBe(0)
  })

  it('charges nothing when paid on the fifth, the last on-time day', () => {
    const s = statusOf(janCharge(), [pay({ paidOn: '2026-01-05', amount: 1000 })], asOf)
    expect(s.daysToPay).toBe(4)
    expect(s.lateDays).toBe(0)
    expect(s.lateFee).toBe(0)
  })

  it('charges one day on the sixth', () => {
    const s = statusOf(janCharge(), [pay({ paidOn: '2026-01-06', amount: 1000 })], asOf)
    expect(s.lateDays).toBe(1)
    expect(s.lateFee).toBe(LATE_FEE_PER_DAY)
  })

  it('charges $15 a day thereafter', () => {
    const s = statusOf(janCharge(), [pay({ paidOn: '2026-01-15', amount: 1000 })], asOf)
    expect(s.lateDays).toBe(10)
    expect(s.lateFee).toBe(150)
    expect(s.daysToPay).toBe(14)
  })

  it('keeps accruing while nothing is paid', () => {
    const s = statusOf(janCharge(), [], new Date('2026-01-20T00:00:00'))
    expect(s.state).toBe('late')
    expect(s.lateDays).toBe(15)
    expect(s.lateFee).toBe(225)
    expect(s.balance).toBe(1000)
  })

  it('is not late before the grace period runs out', () => {
    const s = statusOf(janCharge(), [], new Date('2026-01-03T00:00:00'))
    expect(s.state).toBe('due')
    expect(s.lateFee).toBe(0)
  })

  it('honours a waiver', () => {
    const s = statusOf(janCharge(), [pay({ paidOn: '2026-01-20', amount: 1000, waiveLateFee: true })], asOf)
    expect(s.lateDays).toBe(15)
    expect(s.lateFee).toBe(0)
    expect(s.lateFeeWaived).toBe(true)
  })
})

describe('partial payments', () => {
  const asOf = new Date('2026-01-20T00:00:00')

  it('keeps the fee running until the balance actually clears', () => {
    const s = statusOf(janCharge(), [pay({ paidOn: '2026-01-02', amount: 400 })], asOf)
    expect(s.state).toBe('partial')
    expect(s.balance).toBe(600)
    // Part-paying on the 2nd does not stop the clock.
    expect(s.lateDays).toBe(15)
    expect(s.daysToPay).toBeUndefined()
  })

  it('settles on the payment that covers the balance, not the first one', () => {
    const s = statusOf(janCharge(), [
      pay({ id: 'a', paidOn: '2026-01-02', amount: 400 }),
      pay({ id: 'b', paidOn: '2026-01-09', amount: 600 }),
    ], asOf)
    expect(s.state).toBe('paid')
    expect(s.daysToPay).toBe(8)
    expect(s.lateDays).toBe(4)
    expect(s.lateFee).toBe(60)
  })
})

describe('aging', () => {
  it('buckets an unpaid charge by how long it has been outstanding', () => {
    const c = janCharge()
    // agingOf inherits the date the status was evaluated at, so the two can
    // never disagree about "now".
    expect(agingOf(statusOf(c, [], new Date('2026-01-01T00:00:00')))).toBe('current')
    expect(agingOf(statusOf(c, [], new Date('2026-01-20T00:00:00')))).toBe('1-30')
    expect(agingOf(statusOf(c, [], new Date('2026-02-20T00:00:00')))).toBe('31-60')
    expect(agingOf(statusOf(c, [], new Date('2026-03-20T00:00:00')))).toBe('61-90')
    expect(agingOf(statusOf(c, [], new Date('2026-05-20T00:00:00')))).toBe('90+')
  })

  it('never ages a settled charge', () => {
    const s = statusOf(janCharge(), [pay({ paidOn: '2026-06-01', amount: 1000 })], new Date('2026-07-01T00:00:00'))
    expect(agingOf(s)).toBe('current')
  })
})

describe('payer records', () => {
  const charges = chargesForLease(lease(Array(12).fill(1000)), 2026).slice(0, 3)
  const asOf = new Date('2026-04-10T00:00:00')

  it('scores a tenant who always pays on the first', () => {
    const payments = charges.map((c, i) => pay({
      id: `p${i}`, period: c.period, paidOn: `2026-0${i + 1}-01`, amount: 1000,
    }))
    const [r] = payerRecordsFor(charges, payments, asOf)
    expect(r.averageDaysToPay).toBe(0)
    expect(r.onTimeRatePct).toBe(100)
    expect(r.monthsLate).toBe(0)
    expect(r.reliabilityScore).toBe(100)
    expect(r.balance).toBe(0)
  })

  it('marks down a tenant who is consistently late', () => {
    const payments = charges.map((c, i) => pay({
      id: `p${i}`, period: c.period, paidOn: `2026-0${i + 1}-25`, amount: 1000,
    }))
    const [r] = payerRecordsFor(charges, payments, asOf)
    expect(r.averageDaysToPay).toBe(24)
    expect(r.onTimeRatePct).toBe(0)
    expect(r.monthsLate).toBe(3)
    expect(r.reliabilityScore).toBe(0)
    expect(r.totalLateFees).toBe(3 * 20 * LATE_FEE_PER_DAY)
  })

  it('separates a fast payer from a slow one', () => {
    const fast = payerRecordsFor(charges, charges.map((c, i) => pay({
      id: `f${i}`, period: c.period, paidOn: `2026-0${i + 1}-02`, amount: 1000,
    })), asOf)[0]
    const slow = payerRecordsFor(charges, charges.map((c, i) => pay({
      id: `s${i}`, period: c.period, paidOn: `2026-0${i + 1}-18`, amount: 1000,
    })), asOf)[0]
    expect(fast.averageDaysToPay!).toBeLessThan(slow.averageDaysToPay!)
    expect(fast.reliabilityScore).toBeGreaterThan(slow.reliabilityScore)
    expect(fast.totalLateFees).toBe(0)
    expect(slow.totalLateFees).toBeGreaterThan(0)
  })
})

describe('the tracking window', () => {
  const charges = chargesForLease(lease(Array(12).fill(1000)), 2026)

  it('keeps everything when no start month is set', () => {
    expect(trackedCharges(charges, undefined)).toHaveLength(12)
  })

  it('drops the months before the start and keeps the start month itself', () => {
    const kept = trackedCharges(charges, '2026-08')
    expect(kept).toHaveLength(5)
    expect(kept[0].period).toBe('2026-08')
    expect(kept.at(-1)!.period).toBe('2026-12')
  })

  it('excludes an untracked month from the receivable entirely', () => {
    const owed = (start?: string) => trackedCharges(charges, start)
      .reduce((a, c) => a + statusOf(c, [], new Date('2026-12-31')).balance, 0)
    expect(owed(undefined)).toBe(12_000)
    expect(owed('2026-08')).toBe(5_000)
  })
})
