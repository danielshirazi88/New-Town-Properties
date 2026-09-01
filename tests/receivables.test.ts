import { describe, expect, it } from 'vitest'
import {
  DEFAULT_COLLECTION, GRACE_THROUGH_DAY, LATE_FEE_PER_DAY, agingOf, chargesForLease,
  payerRecordsFor, periodOf, statusOf, trackedCharges, type Payment, type RentCharge,
} from '../src/lib/receivables'
import type { Lease } from '../src/lib/types'
import { PAYMENT_SEED_VERSION, SEEDED_PAYMENTS } from '../src/data/payments'
import { computeKpis, resolveData } from '../src/lib/portfolio'
import { rentRoll } from '../src/data/rentRolls'
import { chargesForYear } from '../src/lib/receivables'

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

describe('the settled-through declaration', () => {
  const charges = chargesForLease(lease(Array(12).fill(1000)), 2026)
  const settled = { settledThrough: '2026-08' }
  // Rent for September is due on the 1st; today is the day before.
  const aug31 = new Date('2026-08-31T12:00:00')

  it('reads every month through the declared one as paid', () => {
    for (const c of charges.slice(0, 8)) {
      const s = statusOf(c, [], aug31, settled)
      expect(s.state, c.period).toBe('paid')
      expect(s.balance).toBe(0)
      expect(s.lateFee).toBe(0)
      expect(s.settledByDeclaration).toBe(true)
    }
  })

  it('invents no payment date, so it cannot fake a days-to-pay', () => {
    const s = statusOf(charges[0], [], aug31, settled)
    expect(s.daysToPay).toBeUndefined()
    expect(s.settledOn).toBeUndefined()
    expect(s.payments).toEqual([])
  })

  it('leaves the month after the declaration owing', () => {
    const sep = statusOf(charges[8], [], aug31, settled)
    expect(sep.settledByDeclaration).toBe(false)
    expect(sep.balance).toBe(1000)
  })

  it('lets a recorded payment override the declaration', () => {
    // A real payment is evidence; a blanket assertion is not. If someone records
    // a part payment against a declared month, that is what the month shows.
    const s = statusOf(charges[0], [pay({
      id: 'p', period: '2026-01', paidOn: '2026-01-03', amount: 400,
    })], aug31, settled)
    expect(s.settledByDeclaration).toBe(false)
    expect(s.state).toBe('partial')
    expect(s.balance).toBe(600)
  })

  it('counts declared months apart from ones with a recorded payment', () => {
    const r = payerRecordsFor(charges, [], aug31, settled)[0]
    expect(r.chargesDeclared).toBe(8)
    expect(r.chargesSettled).toBe(0)
    // Nothing is known about how fast they paid, so nothing is claimed.
    expect(r.averageDaysToPay).toBeUndefined()
    expect(r.totalLateFees).toBe(0)
  })
})

describe('rent that has not yet fallen due', () => {
  const charges = chargesForLease(lease(Array(12).fill(1000)), 2026)
  const settled = { settledThrough: '2026-08' }
  const aug31 = new Date('2026-08-31T12:00:00')
  const sep1 = new Date('2026-09-01T09:00:00')
  const sep6 = new Date('2026-09-06T09:00:00')

  it('is upcoming the day before, not due', () => {
    const s = statusOf(charges[8], [], aug31, settled)
    expect(s.state).toBe('upcoming')
    expect(s.isDue).toBe(false)
    expect(s.lateDays).toBe(0)
  })

  it('turns due on the 1st', () => {
    const s = statusOf(charges[8], [], sep1, settled)
    expect(s.state).toBe('due')
    expect(s.isDue).toBe(true)
    expect(s.lateFee).toBe(0)
  })

  it('turns late on the 6th, with the first day of fee', () => {
    const s = statusOf(charges[8], [], sep6, settled)
    expect(s.state).toBe('late')
    expect(s.lateDays).toBe(1)
    expect(s.lateFee).toBe(LATE_FEE_PER_DAY)
  })

  it('does not age a month that has not come due', () => {
    // October rent is not 30 days overdue in September.
    expect(agingOf(statusOf(charges[9], [], sep6, settled))).toBe('current')
  })

  it('keeps the rest of the year out of what is owed', () => {
    // The whole point: on 1 September the arrears are one month, not four.
    const owed = charges
      .map((c) => statusOf(c, [], sep1, settled))
      .filter((s) => s.isDue && s.balance > 0.005)
    expect(owed).toHaveLength(1)
    expect(owed[0].charge.period).toBe('2026-09')
  })

  it('leaves a payer with nothing open until a due month goes unpaid', () => {
    expect(payerRecordsFor(charges, [], aug31, settled)[0].chargesOpen).toBe(0)
    expect(payerRecordsFor(charges, [], sep1, settled)[0].chargesOpen).toBe(1)
  })
})

describe('the shipped starting position', () => {
  it('declares the book clean through August 2026 and no further', () => {
    expect(DEFAULT_COLLECTION.settledThrough).toBe('2026-08')
    expect(DEFAULT_COLLECTION.settledDeclaredOn).toBe('2026-08-31')
    // It says on its face that it is a declaration, not a set of payments.
    expect(DEFAULT_COLLECTION.settledNote).toMatch(/declaration/i)
  })

  it('does not also hide those months behind a tracking start', () => {
    // Settled and out-of-scope are different claims; only one is being made.
    expect(DEFAULT_COLLECTION.startPeriod).toBeUndefined()
  })
})

describe('rent beyond the end of the sheet', () => {
  // A 2026 roll pulled in August: eight months reported, four blank.
  const partYear = (months: (number | 'V' | 'NR')[]) =>
    chargesForLease(lease(months), 2026, { reportedMonths: 8, carryForward: true })

  const paying = [...Array(8).fill(4000), ...Array(4).fill('NR')] as (number | 'NR')[]

  it('carries the last reported rent into the months the sheet does not cover', () => {
    const cs = partYear(paying)
    expect(cs).toHaveLength(12)
    expect(cs.slice(0, 8).every((c) => !c.projected)).toBe(true)
    expect(cs.slice(8).every((c) => c.projected)).toBe(true)
    expect(cs[8].amountDue).toBe(4000)
    expect(cs[8].period).toBe('2026-09')
  })

  it('carries nothing from a vacancy', () => {
    // An empty unit owes nothing next month either.
    const cs = partYear([...Array(7).fill(4000), 'V', ...Array(4).fill('NR')] as (number | 'V' | 'NR')[])
    expect(cs.filter((c) => c.projected)).toHaveLength(0)
  })

  it('carries nothing when the sheet stopped reporting early', () => {
    // West Plaza's units report to April and then stop because the building was
    // sold. Reading that as their own year-end would invent eight months of rent
    // on a property the trust no longer owns.
    const cs = partYear([...Array(4).fill(4773), ...Array(8).fill('NR')] as (number | 'NR')[])
    expect(cs).toHaveLength(4)
    expect(cs.some((c) => c.projected)).toBe(false)
  })

  it('does nothing at all on a complete year', () => {
    const cs = chargesForLease(lease(Array(12).fill(1000)), 2025,
      { reportedMonths: 12, carryForward: true })
    expect(cs).toHaveLength(12)
    expect(cs.some((c) => c.projected)).toBe(false)
  })

  it('stays off unless a caller asks for it', () => {
    expect(chargesForLease(lease(paying), 2026, { reportedMonths: 8 })).toHaveLength(8)
    expect(chargesForLease(lease(paying), 2026)).toHaveLength(8)
  })

  it('makes September collectable, which is the whole point', () => {
    const [sep] = partYear(paying).filter((c) => c.period === '2026-09')
    const settled = { settledThrough: '2026-08' }
    expect(statusOf(sep, [], new Date('2026-08-31T12:00:00'), settled).state).toBe('upcoming')
    expect(statusOf(sep, [], new Date('2026-09-01T09:00:00'), settled).state).toBe('due')
    expect(statusOf(sep, [], new Date('2026-09-06T09:00:00'), settled).state).toBe('late')
  })
})

/**
 * Gotti's Hideaway, the one tenant behind — checked against the final invoice
 * of 30 August 2026, which bills $7,700 of August rent less $3,850 received,
 * plus $375 of late fees, for $4,225 due.
 */
describe("the one tenant in arrears", () => {
  const settings = { ...DEFAULT_COLLECTION, paymentSeedVersion: PAYMENT_SEED_VERSION }
  const leases = computeKpis(new Date('2026-09-01T12:00:00'), resolveData(undefined, 2026))
    .properties.flatMap((p) => p.leases)
  const charges = chargesForYear(leases, 2026, {
    reportedMonths: rentRoll(2026).monthsReported, carryForward: true,
  })
  const august = charges.find((c) => c.leaseId === 'mp-gottis' && c.period === '2026-08')!
  const at = (iso: string) => statusOf(august, SEEDED_PAYMENTS, new Date(`${iso}T12:00:00`), settings)

  it('records half of August against the right lease and month', () => {
    expect(SEEDED_PAYMENTS).toHaveLength(1)
    const [p] = SEEDED_PAYMENTS
    expect(p.leaseId).toBe('mp-gottis')
    expect(p.period).toBe('2026-08')
    expect(p.amount).toBe(3_850)
    expect(august.amountDue).toBe(7_700)
  })

  it('reproduces the invoice exactly on the day it was written', () => {
    // $7,700 rent + $375 late fees − $3,850 received = $4,225 due.
    const s = at('2026-08-30')
    expect(s.paid).toBe(3_850)
    expect(s.balance).toBe(3_850)
    expect(s.lateDays).toBe(25)
    expect(s.lateFee).toBe(375)
    expect(s.balance + s.lateFee).toBe(4_225)
    expect(s.state).toBe('partial')
  })

  it('keeps the fee running after the invoice was cut', () => {
    // The debt does not stop growing because someone printed a total.
    const s = at('2026-09-01')
    expect(s.lateDays).toBe(27)
    expect(s.lateFee).toBe(27 * LATE_FEE_PER_DAY)
    expect(s.balance).toBe(3_850)
  })

  it('charges from the sixth, not from the first', () => {
    // Nothing accrues inside the grace period, however far into it we are.
    expect(at('2026-08-05').lateDays).toBe(0)
    expect(at('2026-08-05').lateFee).toBe(0)
    expect(at('2026-08-06').lateDays).toBe(1)
    expect(august.graceThrough.getDate()).toBe(GRACE_THROUGH_DAY)
  })

  it('overrides the settled-through declaration for this month alone', () => {
    // The declaration says everything to August is clean. A month with a payment
    // on file is worked out from the money instead — which is the whole reason
    // this arrears shows at all.
    expect(settings.settledThrough).toBe('2026-08')
    const s = at('2026-09-01')
    expect(s.settledByDeclaration).toBe(false)

    // Every other tenant's August is still settled by the declaration.
    const otherAugust = charges.filter((c) => c.period === '2026-08' && c.leaseId !== 'mp-gottis')
    expect(otherAugust.length).toBeGreaterThan(30)
    for (const c of otherAugust) {
      const st = statusOf(c, SEEDED_PAYMENTS, new Date('2026-09-01T12:00:00'), settings)
      expect(st.settledByDeclaration, c.leaseId).toBe(true)
      expect(st.balance, c.leaseId).toBe(0)
      expect(st.lateFee, c.leaseId).toBe(0)
    }
  })

  it('leaves Gotti as the only tenant carrying a late fee', () => {
    const asOf = new Date('2026-09-01T12:00:00')
    const owing = charges
      .map((c) => statusOf(c, SEEDED_PAYMENTS, asOf, settings))
      .filter((s) => s.lateFee > 0)
    expect(owing).toHaveLength(1)
    expect(owing[0].charge.leaseId).toBe('mp-gottis')
    expect(owing.reduce((a, s) => a + s.lateFee, 0)).toBe(405)
  })

  it('does not call one late month a chronic payer', () => {
    // The months before August were declared clean rather than recorded one by
    // one, so nothing has settled with a date and the on-time rate comes back
    // 0% — no record at all, not a bad one. Read as a rate it would put a
    // tenant of six years on "late most months" from a single invoice.
    const [gotti] = payerRecordsFor(
      charges.filter((c) => c.leaseId === 'mp-gottis'),
      SEEDED_PAYMENTS, new Date('2026-09-01T12:00:00'), settings,
    )
    expect(gotti.chargesSettled).toBe(0)
    expect(gotti.monthsLate).toBe(1)
    expect(gotti.onTimeRatePct).toBe(0)
  })

  it('has September due but not yet late for everyone', () => {
    // The 1st is inside the grace period, so nothing new is late today.
    const asOf = new Date('2026-09-01T12:00:00')
    const sept = charges.filter((c) => c.period === '2026-09')
      .map((c) => statusOf(c, SEEDED_PAYMENTS, asOf, settings))
    expect(sept.length).toBeGreaterThan(30)
    expect(sept.every((s) => s.state === 'due')).toBe(true)
    expect(sept.every((s) => s.lateFee === 0)).toBe(true)
  })
})
