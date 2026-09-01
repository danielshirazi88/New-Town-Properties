/**
 * What arrives and what leaves, month by month, for the year ahead.
 *
 * Every other screen looks backwards at what a sheet reported. This one looks
 * forward, which means it is built out of what is contracted rather than what is
 * recorded, and it is careful about the difference:
 *
 *  - **Rent** is the rate the portfolio is currently billing, carried forward.
 *    Leases that end inside the window are not assumed to renew, and a unit
 *    standing empty is not assumed to let.
 *  - **Property tax** is a real annual figure on a modelled timing. The bills
 *    are known; when they fall is an assumption, marked as one everywhere it
 *    appears, so nobody plans a quarter around a date this file invented.
 *  - **A certificate maturing is not income.** The principal coming back is the
 *    same money in a different place, and adding it to a month would show
 *    $5.1m of "cash in" that nobody earned. Maturities are tracked separately,
 *    as decisions falling due. Only the interest counts as income.
 */

import type { AssetRegister, InvestmentAsset } from './assets'
import { annualInterest, maturities } from './assets'

export type FlowKind = 'rent' | 'interest' | 'tax'

export interface CashEvent {
  id: string
  kind: FlowKind
  label: string
  detail?: string
  /** Positive arrives, negative leaves. */
  amount: number
  /** True where the timing is modelled rather than recorded. */
  assumedTiming?: boolean
}

export interface MaturityEvent {
  id: string
  date: string
  institution: string
  principal: number
  /** Interest earned over the certificate's whole term, at its stated rate. */
  interest: number
}

export interface CashMonth {
  /** `YYYY-MM`. */
  key: string
  label: string
  inflow: number
  outflow: number
  net: number
  /** Net summed from the first month of the window. */
  running: number
  events: CashEvent[]
  /** Certificates coming due this month — a decision, not income. */
  maturing: MaturityEvent[]
  maturingPrincipal: number
}

/**
 * When the property tax bills fall.
 *
 * Illinois bills a year in arrears in two instalments. The amounts on the rent
 * rolls are real; these months are the assumption, and the only one in here.
 * Change them and every figure that depends on them moves with it.
 */
export const TAX_INSTALMENTS: { month: number; share: number; label: string }[] = [
  { month: 3, share: 0.55, label: 'First instalment' },
  { month: 8, share: 0.45, label: 'Second instalment' },
]

const MONTH_LABEL = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

/** Interest a certificate earns across its whole term, at its stated rate. */
export function termInterest(i: InvestmentAsset): number {
  if (i.ratePct === undefined || !i.openedDate || !i.maturityDate) return 0
  const from = new Date(`${i.openedDate}T00:00:00Z`)
  const to = new Date(`${i.maturityDate}T00:00:00Z`)
  const months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12
    + (to.getUTCMonth() - from.getUTCMonth())
  return annualInterest(i) * (months / 12)
}

export interface CashFlowInput {
  /** Rent the portfolio is currently billing each month, across every property. */
  monthlyRent: number
  /** Property tax for a full year, across every property. */
  annualTax: number
  register: AssetRegister
  /** Months to project, counting the one containing `from`. */
  months?: number
}

/**
 * The months ahead, in order, starting with the one we are in.
 *
 * Interest lands with the certificate it belongs to rather than being smeared
 * across the year: a one-year CD pays at maturity, and showing a twelfth of it
 * every month would describe money that is not there yet.
 */
export function cashFlow(
  { monthlyRent, annualTax, register, months = 12 }: CashFlowInput,
  from: Date = new Date(),
): CashMonth[] {
  const due = maturities(register, from)
  const start = new Date(from.getFullYear(), from.getMonth(), 1)

  const out: CashMonth[] = []
  let running = 0

  for (let n = 0; n < months; n += 1) {
    const d = new Date(start.getFullYear(), start.getMonth() + n, 1)
    const key = keyOf(d)
    const events: CashEvent[] = []

    if (monthlyRent > 0) {
      events.push({
        id: `${key}-rent`,
        kind: 'rent',
        label: 'Rent and lot fees',
        detail: 'At the rate currently billing',
        amount: monthlyRent,
      })
    }

    for (const inst of TAX_INSTALMENTS) {
      if (d.getMonth() + 1 !== inst.month || annualTax <= 0) continue
      events.push({
        id: `${key}-tax-${inst.month}`,
        kind: 'tax',
        label: `Property tax — ${inst.label.toLowerCase()}`,
        detail: `${Math.round(inst.share * 100)}% of ${Math.round(annualTax).toLocaleString()}`,
        amount: -(annualTax * inst.share),
        assumedTiming: true,
      })
    }

    const maturing: MaturityEvent[] = due
      .filter((m) => m.investment.maturityDate?.slice(0, 7) === key)
      .map((m) => ({
        id: m.investment.id,
        date: m.investment.maturityDate!,
        institution: m.investment.institution,
        principal: m.investment.balance,
        interest: termInterest(m.investment),
      }))

    for (const m of maturing) {
      if (m.interest <= 0) continue
      events.push({
        id: `${m.id}-interest`,
        kind: 'interest',
        label: 'Interest at maturity',
        detail: m.institution,
        amount: m.interest,
      })
    }

    const inflow = events.reduce((a, e) => a + Math.max(0, e.amount), 0)
    const outflow = events.reduce((a, e) => a + Math.min(0, e.amount), 0)
    running += inflow + outflow

    out.push({
      key,
      label: `${MONTH_LABEL[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
      inflow,
      outflow,
      net: inflow + outflow,
      running,
      events,
      maturing,
      maturingPrincipal: maturing.reduce((a, m) => a + m.principal, 0),
    })
  }

  return out
}

export interface CashFlowTotals {
  inflow: number
  outflow: number
  net: number
  /** The worst single month in the window. */
  tightest: CashMonth
  bestMonth: CashMonth
  maturingPrincipal: number
  /** Months where more leaves than arrives. */
  negativeMonths: number
}

export function cashFlowTotals(rows: CashMonth[]): CashFlowTotals | undefined {
  if (rows.length === 0) return undefined
  return {
    inflow: rows.reduce((a, r) => a + r.inflow, 0),
    outflow: rows.reduce((a, r) => a + r.outflow, 0),
    net: rows.reduce((a, r) => a + r.net, 0),
    tightest: rows.reduce((a, r) => (r.net < a.net ? r : a)),
    bestMonth: rows.reduce((a, r) => (r.net > a.net ? r : a)),
    maturingPrincipal: rows.reduce((a, r) => a + r.maturingPrincipal, 0),
    negativeMonths: rows.filter((r) => r.net < 0).length,
  }
}
