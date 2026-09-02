import { cellAmount, isUnreported } from './finance'
import type { Lease } from './types'
import type { PaymentMethodId } from './tenants'

/**
 * Rent collection: what is owed, what came in, and how late it was.
 *
 * The rules are the landlord's own. Rent falls due on the 1st. There is a grace
 * period through the 5th, so a payment made any time on the 5th is on time. From
 * the 6th a late fee of $15 a day accrues, counted per calendar day, and it keeps
 * accruing on an unpaid balance until the balance clears.
 */

export const RENT_DUE_DAY = 1
/** Payment on or before this day of the month carries no penalty. */
export const GRACE_THROUGH_DAY = 5
export const LATE_FEE_PER_DAY = 15

export interface Payment {
  id: string
  leaseId: string
  /** The month the payment settles, as `YYYY-MM`. */
  period: string
  amount: number
  /** Date the money arrived, ISO `YYYY-MM-DD`. */
  paidOn: string
  method?: PaymentMethodId
  customMethodLabel?: string
  reference?: string
  note?: string
  /** True when the landlord has waived the late fee on this month. */
  waiveLateFee?: boolean
  /**
   * Late fee collected alongside the rent, where the tenant paid it.
   *
   * Kept apart from `amount`, which settles the rent charge: a payment that
   * covered both would otherwise look like an overpayment of rent and leave the
   * fee reading as still owed. Until this existed a late fee could only ever
   * accrue — there was nowhere to say it had been paid.
   */
  lateFeeCollected?: number
  recordedBy?: string
  recordedAt: string
}

export interface RentCharge {
  id: string
  leaseId: string
  propertyId: string
  tenant: string
  unit: string
  year: number
  /** 0-indexed, matching the month cells. */
  month: number
  period: string
  amountDue: number
  dueDate: Date
  /** End of the grace period — the last day a payment is on time. */
  graceThrough: Date
  /**
   * True when the sheet does not cover this month and the amount was carried
   * forward from the last one it does.
   *
   * A rent roll pulled in August says nothing about September, but the rent does
   * not stop — so collection has to look ahead of the document. What is carried
   * is an expectation, not a figure anyone published, and it is marked as such
   * everywhere it appears.
   */
  projected?: boolean
}

export const periodOf = (year: number, month: number): string =>
  `${year}-${String(month + 1).padStart(2, '0')}`

const MS_PER_DAY = 86_400_000
const atMidnight = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const wholeDaysBetween = (from: Date, to: Date): number =>
  Math.floor((atMidnight(to).getTime() - atMidnight(from).getTime()) / MS_PER_DAY)

/**
 * Every month a lease actually owes rent.
 *
 * Only months with a rent figure generate a charge. A vacant month owes nothing,
 * a free-rent month owes nothing by agreement, and a month the sheet does not
 * cover is not a debt — it is simply unknown.
 */
export interface ChargeOptions {
  /**
   * How many months the sheet actually covers. Beyond this the rent is carried
   * forward from the last reported month.
   *
   * It has to come from the sheet rather than from each lease: West Plaza's
   * units stop reporting in April because the building was sold, and reading
   * that as "the sheet ends in April for them" would carry rent forward on a
   * property the trust no longer owns.
   */
  reportedMonths?: number
  /** Off by default — a caller has to ask to look past the document. */
  carryForward?: boolean
}

export function chargesForLease(
  lease: Lease,
  year: number,
  opts: ChargeOptions = {},
): RentCharge[] {
  const make = (month: number, amount: number, projected: boolean): RentCharge => ({
    id: `${lease.id}:${periodOf(year, month)}`,
    leaseId: lease.id,
    propertyId: lease.propertyId,
    tenant: lease.tenant,
    unit: lease.unit,
    year,
    month,
    period: periodOf(year, month),
    amountDue: amount,
    dueDate: new Date(year, month, RENT_DUE_DAY),
    graceThrough: new Date(year, month, GRACE_THROUGH_DAY),
    ...(projected && { projected: true }),
  })

  const out: RentCharge[] = []
  lease.months.forEach((cell, month) => {
    if (isUnreported(cell)) return
    const amount = cellAmount(cell)
    if (amount <= 0) return
    out.push(make(month, amount, false))
  })

  const reported = opts.reportedMonths ?? 12
  if (opts.carryForward && reported < 12) {
    const last = lease.months[reported - 1]
    // Only a unit that was actually paying in the last covered month keeps
    // paying. A vacancy owes nothing, and a lease the sheet stopped reporting
    // before the end — a sold building — has no rate to carry.
    const rate = last === undefined || isUnreported(last) ? 0 : cellAmount(last)
    if (rate > 0) {
      for (let month = reported; month < 12; month += 1) out.push(make(month, rate, true))
    }
  }
  return out
}

export const chargesForYear = (
  leases: Lease[],
  year: number,
  opts: ChargeOptions = {},
): RentCharge[] => leases.flatMap((l) => chargesForLease(l, year, opts))

/**
 * `upcoming` is a month that has been billed but whose 1st has not arrived. It
 * is deliberately not `due`: rent for December is not owed in September, and
 * counting it would put the rest of the year into the arrears figure.
 */
export type ChargeState = 'paid' | 'partial' | 'upcoming' | 'due' | 'late'

export interface ChargeStatus {
  charge: RentCharge
  payments: Payment[]
  paid: number
  balance: number
  state: ChargeState
  /**
   * Days from the due date to the day the balance cleared. Paying on the 1st is
   * zero. Undefined while the balance is still outstanding.
   */
  daysToPay?: number
  /** Days past the grace period. Accrues to today while a balance is open. */
  lateDays: number
  /** What the fee comes to, before anything paid against it. */
  lateFee: number
  /** How much of that fee has actually been collected. */
  lateFeePaid: number
  /** Fee still owed: what it comes to, less what came in. Zero when waived. */
  lateFeeOutstanding: number
  lateFeeWaived: boolean
  /** The date the balance reached zero, if it has. */
  settledOn?: Date
  /**
   * The moment this status was evaluated. Carried on the result so anything
   * derived from it — aging, in particular — measures against the same date
   * rather than quietly substituting today's.
   */
  asOf: Date
  /**
   * Settled by the owner's blanket declaration rather than by a recorded
   * payment. Paid, but with no payment date, so it carries no days-to-pay.
   */
  settledByDeclaration: boolean
  /** True once the 1st has arrived. A charge that is not due is not owed. */
  isDue: boolean
}

/**
 * Resolve one month's rent against the payments made toward it.
 *
 * Payments are applied oldest first, and the charge is only settled once the
 * full amount is covered — a partial payment stops nothing from accruing, which
 * is how a late fee actually works.
 */
export function statusOf(
  charge: RentCharge,
  payments: Payment[],
  asOf: Date = new Date(),
  settings: CollectionSettings = {},
): ChargeStatus {
  // Money that had not arrived yet cannot settle a month. Reading the books as
  // at a date means as at that date: a payment dated afterwards is invisible,
  // so a past month reads the way it actually read at the time.
  const asOfDay = `${asOf.getFullYear()}-${String(asOf.getMonth() + 1).padStart(2, '0')}-${String(asOf.getDate()).padStart(2, '0')}`
  const mine = payments
    .filter((p) => p.leaseId === charge.leaseId && p.period === charge.period)
    .filter((p) => p.paidOn <= asOfDay)
    .sort((a, b) => a.paidOn.localeCompare(b.paidOn))

  const paid = mine.reduce((a, p) => a + p.amount, 0)
  const balance = Math.max(0, charge.amountDue - paid)

  // The date the running total first covered the charge.
  let settledOn: Date | undefined
  let running = 0
  for (const p of mine) {
    running += p.amount
    if (running >= charge.amountDue - 0.005) {
      settledOn = new Date(`${p.paidOn}T00:00:00`)
      break
    }
  }

  const isDue = wholeDaysBetween(charge.dueDate, asOf) >= 0

  // A month covered by the owner's declaration is settled, unless a real payment
  // was recorded against it — recorded fact always beats a blanket assertion.
  const declared = Boolean(settings.settledThrough)
    && charge.period <= settings.settledThrough!
    && mine.length === 0

  if (declared) {
    return {
      charge,
      payments: [],
      paid: charge.amountDue,
      balance: 0,
      state: 'paid',
      // No payment date exists, so there is no days-to-pay. Inventing one would
      // corrupt every payer statistic built on it.
      daysToPay: undefined,
      lateDays: 0,
      lateFee: 0,
      lateFeePaid: 0,
      lateFeeOutstanding: 0,
      lateFeeWaived: false,
      settledOn: undefined,
      asOf,
      settledByDeclaration: true,
      isDue,
    }
  }

  const waived = mine.some((p) => p.waiveLateFee)
  const lateFrom = settledOn ?? asOf
  const lateDays = balance > 0.005 || settledOn
    ? Math.max(0, wholeDaysBetween(charge.graceThrough, lateFrom))
    : 0

  const fee = waived ? 0 : lateDays * LATE_FEE_PER_DAY
  const feePaid = mine.reduce((a, p) => a + (p.lateFeeCollected ?? 0), 0)

  const state: ChargeState =
    balance <= 0.005 ? 'paid'
      : paid > 0.005 ? 'partial'
      : !isDue ? 'upcoming'
      : wholeDaysBetween(charge.graceThrough, asOf) > 0 ? 'late'
      : 'due'

  return {
    charge,
    payments: mine,
    paid,
    balance,
    state,
    daysToPay: settledOn ? wholeDaysBetween(charge.dueDate, settledOn) : undefined,
    lateDays,
    lateFee: fee,
    lateFeePaid: feePaid,
    lateFeeOutstanding: Math.max(0, fee - feePaid),
    lateFeeWaived: waived,
    settledOn,
    asOf,
    settledByDeclaration: false,
    isDue,
  }
}

/** Aging buckets, measured from the due date. */
export type AgingBucket = 'current' | '1-30' | '31-60' | '61-90' | '90+'

export function agingOf(status: ChargeStatus, asOf: Date = status.asOf): AgingBucket {
  if (status.balance <= 0.005 || !status.isDue) return 'current'
  const days = wholeDaysBetween(status.charge.dueDate, asOf)
  if (days <= 0) return 'current'
  if (days <= 30) return '1-30'
  if (days <= 60) return '31-60'
  if (days <= 90) return '61-90'
  return '90+'
}

export interface PayerRecord {
  leaseId: string
  tenant: string
  unit: string
  propertyId: string
  /** Months settled by a recorded payment — the only ones with a days-to-pay. */
  chargesSettled: number
  /** Months settled by the owner's declaration. Paid, but timing unknown. */
  chargesDeclared: number
  chargesOpen: number
  /** Mean days to pay across settled months. Lower is better. */
  averageDaysToPay?: number
  fastestDaysToPay?: number
  slowestDaysToPay?: number
  /** Share of settled months paid within the grace period. */
  onTimeRatePct: number
  monthsLate: number
  totalLateFees: number
  /** Of those fees, how much is still to come in. */
  lateFeesOutstanding: number
  totalBilled: number
  totalPaid: number
  balance: number
  /** A 0–100 read on reliability: on-time record, weighted down by lateness. */
  reliabilityScore: number
}

const GRACE_DAYS = GRACE_THROUGH_DAY - RENT_DUE_DAY

/**
 * A tenant's payment record across a year.
 *
 * Reliability blends how often they pay within grace with how far past it they
 * go when they don't — a tenant who is one day late every month is a different
 * problem from one who is thirty days late twice.
 */
export function payerRecordsFor(
  charges: RentCharge[],
  payments: Payment[],
  asOf: Date = new Date(),
  settings: CollectionSettings = {},
): PayerRecord[] {
  const byLease = new Map<string, RentCharge[]>()
  for (const c of charges) {
    const list = byLease.get(c.leaseId) ?? []
    list.push(c)
    byLease.set(c.leaseId, list)
  }

  const out: PayerRecord[] = []
  for (const [leaseId, list] of byLease) {
    const statuses = list.map((c) => statusOf(c, payments, asOf, settings))
    // Only a recorded payment tells us when the money arrived. A declared month
    // is paid but undated, so it is counted separately and kept out of every
    // timing statistic rather than being scored as a perfect payment.
    const settled = statuses.filter((s) => s.daysToPay !== undefined)
    const declared = statuses.filter((s) => s.settledByDeclaration)
    const dtp = settled.map((s) => s.daysToPay!)
    const onTime = settled.filter((s) => s.daysToPay! <= GRACE_DAYS).length
    const monthsLate = statuses.filter((s) => s.lateDays > 0).length
    const openNow = statuses.filter((s) => s.balance > 0.005 && s.isDue).length

    const onTimeRatePct = settled.length ? (onTime / settled.length) * 100 : 0
    const avg = dtp.length ? dtp.reduce((a, b) => a + b, 0) / dtp.length : undefined
    // Start from the on-time rate, then dock for how far past grace they run.
    const overage = avg === undefined ? 0 : Math.max(0, avg - GRACE_DAYS)
    const reliabilityScore = settled.length
      ? Math.max(0, Math.min(100, onTimeRatePct - Math.min(40, overage * 2)))
      : 0

    out.push({
      leaseId,
      tenant: list[0].tenant,
      unit: list[0].unit,
      propertyId: list[0].propertyId,
      chargesSettled: settled.length,
      chargesDeclared: declared.length,
      // Only months that have fallen due can be open; next quarter's rent is not
      // an outstanding item.
      chargesOpen: openNow,
      averageDaysToPay: avg,
      fastestDaysToPay: dtp.length ? Math.min(...dtp) : undefined,
      slowestDaysToPay: dtp.length ? Math.max(...dtp) : undefined,
      onTimeRatePct,
      monthsLate,
      totalLateFees: statuses.reduce((a, s) => a + s.lateFee, 0),
      lateFeesOutstanding: statuses.reduce((a, s) => a + s.lateFeeOutstanding, 0),
      totalBilled: list.reduce((a, c) => a + c.amountDue, 0),
      totalPaid: statuses.reduce((a, s) => a + s.paid, 0),
      balance: statuses.reduce((a, s) => a + (s.isDue ? s.balance : 0), 0),
      reliabilityScore,
    })
  }
  return out
}

/**
 * When collection tracking begins.
 *
 * Rent rolls go back years, but nobody is going to retro-enter every payment
 * ever made. Without a start date every historic month reads as unpaid, and the
 * receivables screen would claim millions owed and years of late fees that were
 * in fact collected on time. Months before the start are simply out of scope:
 * not receivable, not late, not counted.
 */
export interface CollectionSettings {
  /** First month tracked, as `YYYY-MM`. Unset means the whole rent roll. */
  startPeriod?: string
  /**
   * Everything billed on or before this month is declared collected, as
   * `YYYY-MM`.
   *
   * Nobody is going to retro-enter six hundred payments to say the arrears are
   * nil. This is the owner asserting, on a date, that the book was clean to
   * here — so those months read as settled instead of as debt, and the ledger
   * starts from the next one.
   *
   * It is a declaration, not a payment record, and is kept distinct from one
   * throughout: a month settled this way has no payment date, so it never
   * invents a days-to-pay figure or an on-time record it cannot know.
   */
  settledThrough?: string
  /** When the declaration was made, and by whom, so it can be read back later. */
  settledDeclaredOn?: string
  settledNote?: string
  /**
   * Which batch of documented payments this ledger has already taken.
   *
   * Payments read off invoices ship with the application rather than being
   * keyed in on every device. Kept here rather than beside the payments, which
   * are a plain array with nowhere to record it.
   */
  paymentSeedVersion?: number
}

/**
 * Merge payments that ship with the application into the stored ledger.
 *
 * The version marker lives in the collection settings because the payments are
 * a plain array with nowhere to keep it — which means two stored documents with
 * four combinations of "saved" between them, and getting that wrong is how a
 * month that was short reads as settled. The rules:
 *
 *  - Behind the version, or never stamped: merge in anything missing by id.
 *  - Already at the version: do nothing, so a payment deleted on purpose stays
 *    deleted rather than reappearing on the next load.
 *  - A payment already present is never restated — an edited amount survives.
 *
 * Returns null when there is nothing to do, so the caller can skip the write.
 */
export function seedPayments(
  payments: Payment[],
  settings: CollectionSettings,
  seeded: Payment[],
  version: number,
): { payments: Payment[]; settings: CollectionSettings } | null {
  if ((settings.paymentSeedVersion ?? 0) >= version) return null
  const have = new Set(payments.map((p) => p.id))
  const missing = seeded.filter((p) => !have.has(p.id))
  return {
    payments: missing.length > 0 ? [...payments, ...missing] : payments,
    settings: { ...settings, paymentSeedVersion: version },
  }
}

export const inTrackingWindow = (charge: RentCharge, start?: string): boolean =>
  !start || charge.period >= start

export const trackedCharges = (charges: RentCharge[], start?: string): RentCharge[] =>
  start ? charges.filter((c) => c.period >= start) : charges

/** What a late fee would come to if a balance stays unpaid for another n days. */
export const projectedLateFee = (currentLateDays: number, extraDays: number): number =>
  (currentLateDays + extraDays) * LATE_FEE_PER_DAY

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/**
 * Where the ledger starts.
 *
 * On 31 August 2026 the owner confirmed every tenant was current — nothing in
 * arrears across any property. Rather than fabricate six hundred payment
 * records to say so, that is recorded as a declaration: everything billed
 * through August 2026 reads as collected, and live tracking begins with the
 * September rent due on the 1st.
 *
 * It is a starting position, not a fact about any particular month, and it can
 * be moved or cleared on the Rent collection screen.
 */
export const DEFAULT_COLLECTION: CollectionSettings = {
  settledThrough: '2026-08',
  settledDeclaredOn: '2026-08-31',
  settledNote: 'Confirmed by Mr. Shirazi on 31 August 2026: every tenant current through August '
    + 'bar one. Months to August are settled by that declaration rather than by recorded '
    + 'payments, so they carry no payment date and are excluded from days-to-pay. The '
    + 'declaration does not cover a month with a payment on file — Gotti\'s Hideaway paid half '
    + 'of August, and that month is worked out from the money rather than declared clean.',
}
