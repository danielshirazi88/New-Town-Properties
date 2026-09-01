import { describe, expect, it } from 'vitest'
import { TAX_INSTALMENTS, cashFlow, cashFlowTotals, termInterest } from '../src/lib/cashflow'
import { EMPTY_REGISTER, type AssetRegister } from '../src/lib/assets'
import { SEEDED_INVESTMENTS } from '../src/data/investments'
import { computeKpis, resolveData } from '../src/lib/portfolio'

const register: AssetRegister = { ...EMPTY_REGISTER, investments: SEEDED_INVESTMENTS }
const from = new Date('2026-09-01T12:00:00')
const k = computeKpis(from, resolveData(undefined, 2026))
const rows = cashFlow({
  monthlyRent: k.exitMonthlyRent + k.apolloMonthlyBilled,
  annualTax: k.totalTaxes,
  register,
}, from)

describe('the year ahead', () => {
  it('starts with the month we are in and runs twelve', () => {
    expect(rows).toHaveLength(12)
    expect(rows[0].key).toBe('2026-09')
    expect(rows.at(-1)!.key).toBe('2027-08')
  })

  it('bills the same rent every month, at the rate currently running', () => {
    const rent = (r: typeof rows[number]) =>
      r.events.filter((e) => e.kind === 'rent').reduce((a, e) => a + e.amount, 0)
    const first = rent(rows[0])
    expect(first).toBeCloseTo(k.exitMonthlyRent + k.apolloMonthlyBilled, 2)
    for (const r of rows) expect(rent(r), r.key).toBeCloseTo(first, 2)
  })

  it('drops the tax bills in the modelled months and nowhere else', () => {
    const withTax = rows.filter((r) => r.events.some((e) => e.kind === 'tax'))
    expect(withTax.map((r) => r.key)).toEqual(['2027-03', '2027-08'])
    // Every instalment is marked as modelled, because the months are the guess.
    for (const r of withTax) {
      for (const e of r.events.filter((x) => x.kind === 'tax')) {
        expect(e.assumedTiming, r.key).toBe(true)
        expect(e.amount).toBeLessThan(0)
      }
    }
  })

  it('takes exactly one year of tax across the window, no more', () => {
    const tax = rows.reduce((a, r) =>
      a + r.events.filter((e) => e.kind === 'tax').reduce((x, e) => x + e.amount, 0), 0)
    expect(Math.abs(tax)).toBeCloseTo(k.totalTaxes, 2)
    expect(TAX_INSTALMENTS.reduce((a, t) => a + t.share, 0)).toBeCloseTo(1, 6)
  })

  it('never counts returning principal as money earned', () => {
    // $13.3m of certificates come back inside the year. Adding that to a month
    // would show cash nobody made.
    const totals = cashFlowTotals(rows)!
    expect(totals.maturingPrincipal).toBeCloseTo(13_288_108.77, 2)
    expect(totals.inflow).toBeLessThan(totals.maturingPrincipal)
    for (const r of rows) {
      const events = r.events.reduce((a, e) => a + e.amount, 0)
      expect(r.net, r.key).toBeCloseTo(events, 6)
    }
  })

  it('lands interest with the certificate rather than smearing it', () => {
    // A one-year CD pays at maturity. A twelfth every month would describe
    // money that is not there yet.
    const withInterest = rows.filter((r) => r.events.some((e) => e.kind === 'interest'))
    expect(withInterest.map((r) => r.key))
      .toEqual(['2026-10', '2026-11', '2026-12', '2027-01', '2027-05', '2027-08'])
    for (const r of withInterest) expect(r.maturingPrincipal).toBeGreaterThan(0)
  })

  it('values a term shorter than a year proportionately', () => {
    const republic = SEEDED_INVESTMENTS.find((i) => i.id === 'cd-mb-260406-a')!
    // Eight months at 5% on $507,881.85.
    expect(termInterest(republic)).toBeCloseTo(507_881.85 * 0.05 * (8 / 12), 2)
    const year = SEEDED_INVESTMENTS.find((i) => i.id === 'cd-pa-260805-a')!
    expect(termInterest(year)).toBeCloseTo(500_000 * 0.041, 2)
  })

  it('earns nothing from an account with no rate or no dates', () => {
    const fund = SEEDED_INVESTMENTS.find((i) => i.id === 'mf-pnc-a')!
    expect(termInterest(fund)).toBe(0)
  })

  it('runs a total that agrees with the months under it', () => {
    const totals = cashFlowTotals(rows)!
    expect(totals.net).toBeCloseTo(totals.inflow + totals.outflow, 2)
    expect(totals.net).toBeCloseTo(rows.at(-1)!.running, 2)
    expect(totals.negativeMonths).toBe(2)
    expect(totals.tightest.key).toBe('2027-03')
  })

  it('says nothing at all with nothing to project', () => {
    const empty = cashFlow({ monthlyRent: 0, annualTax: 0, register: EMPTY_REGISTER }, from)
    expect(empty).toHaveLength(12)
    expect(empty.every((r) => r.net === 0 && r.events.length === 0)).toBe(true)
    expect(cashFlowTotals([])).toBeUndefined()
  })
})
