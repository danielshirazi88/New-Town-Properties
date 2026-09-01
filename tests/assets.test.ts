import { describe, expect, it } from 'vitest'
import {
  EMPTY_REGISTER, annualInterest, applySeed, assetBreakdown, assetTotals, blendedRate,
  byInstitution, maturities, needsSeed, realEstateTotals, registerInterest, vehicleValued,
  type AssetRegister, type InvestmentAsset, type VehicleAsset,
} from '../src/lib/assets'
import {
  INVESTMENT_SEED_VERSION, SEEDED_INVESTMENTS, SEEDED_INVESTMENT_TOTAL,
} from '../src/data/investments'

/** A trust holding as the register sees it: use, value and debt. */
const prop = (use: 'rental' | 'personal' | 'resale', estimatedValue?: number, debt?: number) =>
  ({ use, estimatedValue, debt })
const inv = (o: Partial<InvestmentAsset>): InvestmentAsset => ({
  id: 'i1', kind: 'investment', name: 'CD', institution: 'A Bank',
  investmentKind: 'cd', balance: 100_000, ...o,
})
const car = (o: Partial<VehicleAsset>): VehicleAsset => ({
  id: 'v1', kind: 'vehicle', name: 'A car', ...o,
})

const reg = (o: Partial<AssetRegister>): AssetRegister =>
  ({ investments: [], vehicles: [], ...o })

/** No property at all — the register on its own. */
const noProperty = realEstateTotals([])

describe('asset totals', () => {
  it('splits real estate by how it is used', () => {
    const t = assetTotals(reg({}), realEstateTotals([
      prop('rental', 1_000_000), prop('personal', 400_000),
    ]))
    expect(t.rentalRealEstate).toBe(1_000_000)
    expect(t.personalRealEstate).toBe(400_000)
    expect(t.realEstate).toBe(1_400_000)
  })

  it('keeps a holding kept for resale off the rental side', () => {
    // It is not let, so counting it as rental would overstate the income estate.
    const c = realEstateTotals([prop('rental', 1_000_000), prop('resale', 1_500_000)])
    expect(c.rental).toBe(1_000_000)
    expect(c.personal).toBe(1_500_000)
  })

  it('nets debt off the gross', () => {
    const t = assetTotals(reg({}), realEstateTotals([prop('rental', 1_000_000, 250_000)]))
    expect(t.gross).toBe(1_000_000)
    expect(t.debt).toBe(250_000)
    expect(t.net).toBe(750_000)
  })

  it('counts an unvalued car as zero and says how many there are', () => {
    const t = assetTotals(reg({
      vehicles: [car({ id: 'a', currentValue: 60_000 }), car({ id: 'b' }), car({ id: 'c' })],
    }), noProperty)
    expect(t.vehicles).toBe(60_000)
    expect(t.unvaluedVehicles).toBe(2)
  })

  it('does not invent a value from a purchase price', () => {
    // A car bought for $90,000 with no current value entered is not worth
    // $90,000 today, and guessing the depreciation would put a made-up number
    // into a net-worth total.
    const c = car({ purchasePrice: 90_000 })
    expect(vehicleValued(c)).toBe(false)
    expect(assetTotals(reg({ vehicles: [c] }), noProperty).vehicles).toBe(0)
  })

  it('reports real estate with no value anywhere', () => {
    const t = assetTotals(reg({}), realEstateTotals([prop('rental', 500_000), prop('rental')]))
    expect(t.unvaluedRealEstate).toBe(1)
    expect(t.realEstate).toBe(500_000)
  })
})

describe('investment income', () => {
  it('works out a year of interest at the stated rate', () => {
    expect(annualInterest(inv({ balance: 250_000, ratePct: 4.8 }))).toBeCloseTo(12_000, 6)
  })

  it('earns nothing from an account with no rate on it', () => {
    expect(annualInterest(inv({ balance: 250_000 }))).toBe(0)
  })

  it('blends the rate by size, not by count', () => {
    // A large account at a low rate must not be averaged flat against a small
    // one at a high rate.
    const r = reg({
      investments: [
        inv({ id: 'a', balance: 900_000, ratePct: 4 }),
        inv({ id: 'b', balance: 100_000, ratePct: 14 }),
      ],
    })
    expect(registerInterest(r)).toBeCloseTo(50_000, 6)
    expect(blendedRate(r)).toBeCloseTo(5, 6)
  })

  it('has no blended rate when nothing carries one', () => {
    expect(blendedRate(reg({ investments: [inv({})] }))).toBeUndefined()
  })

  it('leaves an unrated balance out of the blend rather than treating it as zero', () => {
    const r = reg({
      investments: [inv({ id: 'a', balance: 100_000, ratePct: 5 }), inv({ id: 'b', balance: 900_000 })],
    })
    expect(blendedRate(r)).toBeCloseTo(5, 6)
  })
})

describe('institutions', () => {
  it('adds up several accounts at the same bank', () => {
    const rows = byInstitution(reg({
      investments: [
        inv({ id: 'a', institution: 'Millennium Bank', balance: 500_000, ratePct: 4 }),
        inv({ id: 'b', institution: 'Millennium Bank', balance: 300_000, ratePct: 5 }),
        inv({ id: 'c', institution: 'Fifth Third Bank', balance: 100_000 }),
      ],
    }))
    expect(rows).toHaveLength(2)
    expect(rows[0].institution).toBe('Millennium Bank')
    expect(rows[0].balance).toBe(800_000)
    expect(rows[0].accounts).toBe(2)
    expect(rows[0].rate).toBeCloseTo(4.375, 4)
  })

  it('gives an unnamed institution somewhere to sit', () => {
    expect(byInstitution(reg({ investments: [inv({ institution: '  ' })] }))[0].institution)
      .toBe('Not recorded')
  })
})

describe('maturities', () => {
  const asOf = new Date('2026-09-01T12:00:00')

  it('orders by how soon, and marks the ones already past', () => {
    const rows = maturities(reg({
      investments: [
        inv({ id: 'later', maturityDate: '2026-12-01' }),
        inv({ id: 'past', maturityDate: '2026-08-01' }),
        inv({ id: 'soon', maturityDate: '2026-09-15' }),
        inv({ id: 'none' }),
      ],
    }), asOf)
    expect(rows.map((m) => m.investment.id)).toEqual(['past', 'soon', 'later'])
    expect(rows[0].matured).toBe(true)
    expect(rows[1].matured).toBe(false)
    expect(rows[1].daysAway).toBe(14)
  })

  it('treats a maturity today as due, not overdue', () => {
    const [m] = maturities(reg({ investments: [inv({ maturityDate: '2026-09-01' })] }), asOf)
    expect(m.daysAway).toBe(0)
    expect(m.matured).toBe(false)
  })
})

describe('the breakdown chart', () => {
  it('drops empty slices and orders by size', () => {
    const t = assetTotals(
      reg({ investments: [inv({ balance: 4_300_000 })] }),
      realEstateTotals([prop('rental', 5_000_000), prop('personal', 800_000)]),
    )
    expect(assetBreakdown(t).map((s) => s.id)).toEqual(['rental', 'investments', 'personal'])
  })
})

/**
 * The certificates, as given from the statements on 1 September 2026. These are
 * the figures anyone will quote, so each is checked against what was said rather
 * than only in total.
 */
describe('the Millennium Bank certificates', () => {
  it('records every certificate as given', () => {
    const given: [string, number, number, string, string][] = [
      ['cd-mb-251107-a', 1_033_470.65, 4.5, '2025-11-07', '2026-11-07'],
      ['cd-mb-251107-b', 516_735.32, 4.5, '2025-11-07', '2026-11-07'],
      ['cd-mb-251107-c', 1_033_470.65, 4.5, '2025-11-07', '2026-11-07'],
      ['cd-mb-251107-d', 1_033_470.65, 4.5, '2025-11-07', '2026-11-07'],
      ['cd-mb-251204-a', 5_104_391.56, 4.25, '2025-12-04', '2026-12-04'],
      ['cd-mb-251011-a', 516_750.52, 4.5, '2025-10-11', '2026-10-11'],
      ['cd-mb-260116-a', 1_020_850.67, 4.25, '2026-01-16', '2027-01-16'],
      ['cd-mb-260501-a', 1_010_543.45, 4.25, '2026-05-01', '2027-05-01'],
      ['cd-mb-260501-b', 1_010_543.45, 4.25, '2026-05-01', '2027-05-01'],
    ]
    expect(SEEDED_INVESTMENTS).toHaveLength(given.length)
    for (const [id, balance, ratePct, opened, matures] of given) {
      const cd = SEEDED_INVESTMENTS.find((i) => i.id === id)!
      expect(cd, id).toBeDefined()
      expect(cd.balance, id).toBe(balance)
      expect(cd.ratePct, id).toBe(ratePct)
      expect(cd.openedDate, id).toBe(opened)
      expect(cd.maturityDate, id).toBe(matures)
      expect(cd.institution, id).toBe('Millennium Bank')
      expect(cd.investmentKind, id).toBe('cd')
    }
  })

  it('adds up to what the statements come to', () => {
    expect(SEEDED_INVESTMENT_TOTAL).toBeCloseTo(12_280_226.92, 2)
  })

  it('throws off half a million a year at the stated rates', () => {
    const r: AssetRegister = { ...EMPTY_REGISTER, investments: SEEDED_INVESTMENTS }
    expect(registerInterest(r)).toBeCloseTo(532_244.39, 2)
    expect(blendedRate(r)).toBeCloseTo(4.3342, 3)
  })

  it('keeps the certificates that look like duplicates and are not', () => {
    // Three at $1,033,470.65 on the same day, and two at $1,010,543.45 on the
    // same day. Deduplicating either set would lose real money.
    const same = (n: number) => SEEDED_INVESTMENTS.filter((i) => i.balance === n)
    expect(same(1_033_470.65)).toHaveLength(3)
    expect(same(1_010_543.45)).toHaveLength(2)
    expect(new Set(SEEDED_INVESTMENTS.map((i) => i.id)).size).toBe(SEEDED_INVESTMENTS.length)
  })

  it('runs every certificate exactly one year', () => {
    for (const cd of SEEDED_INVESTMENTS) {
      const opened = new Date(`${cd.openedDate}T00:00:00Z`)
      const expected = new Date(opened)
      expected.setUTCFullYear(expected.getUTCFullYear() + 1)
      expect(cd.maturityDate, cd.id).toBe(expected.toISOString().slice(0, 10))
    }
  })

  it('lists them by maturity, soonest first', () => {
    const r: AssetRegister = { ...EMPTY_REGISTER, investments: SEEDED_INVESTMENTS }
    const due = maturities(r, new Date('2026-09-01T12:00:00'))
    expect(due).toHaveLength(9)
    expect(due[0].investment.maturityDate).toBe('2026-10-11')
    expect(due.at(-1)!.investment.maturityDate).toBe('2027-05-01')
    // None has matured yet as of the day the figures were given.
    expect(due.every((m) => !m.matured)).toBe(true)
  })
})

describe('seeding the register', () => {
  it('fills an empty register', () => {
    const r = applySeed(EMPTY_REGISTER, SEEDED_INVESTMENTS, INVESTMENT_SEED_VERSION)
    expect(r.investments).toHaveLength(9)
    expect(r.seedVersion).toBe(INVESTMENT_SEED_VERSION)
    expect(needsSeed(r, INVESTMENT_SEED_VERSION)).toBe(false)
  })

  it('does not run twice, so a deleted row stays deleted', () => {
    const seeded = applySeed(EMPTY_REGISTER, SEEDED_INVESTMENTS, INVESTMENT_SEED_VERSION)
    const pruned = { ...seeded, investments: seeded.investments.slice(1) }
    expect(applySeed(pruned, SEEDED_INVESTMENTS, INVESTMENT_SEED_VERSION).investments)
      .toHaveLength(8)
  })

  it('never overwrites a balance somebody corrected', () => {
    // The seed adds missing rows; it does not restate the ones already there.
    const edited: AssetRegister = {
      ...EMPTY_REGISTER,
      investments: [{ ...SEEDED_INVESTMENTS[0], balance: 1_040_000 }],
    }
    const r = applySeed(edited, SEEDED_INVESTMENTS, INVESTMENT_SEED_VERSION)
    expect(r.investments.find((i) => i.id === 'cd-mb-251107-a')!.balance).toBe(1_040_000)
    expect(r.investments).toHaveLength(9)
  })

  it('reaches a register saved before the deposits existed', () => {
    // A register with vehicles in it but no seedVersion — the case that would
    // otherwise never see the certificates at all.
    const old: AssetRegister = { investments: [], vehicles: [] }
    expect(needsSeed(old, INVESTMENT_SEED_VERSION)).toBe(true)
    expect(applySeed(old, SEEDED_INVESTMENTS, INVESTMENT_SEED_VERSION).investments)
      .toHaveLength(9)
  })
})
