import { describe, expect, it } from 'vitest'
import {
  EMPTY_REGISTER, annualInterest, applySeed, assetBreakdown, assetTotals, blendedRate,
  byInstitution, byRate, maturities, maturitySchedule, needsSeed, realEstateTotals,
  registerInterest, vehicleValued,
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
 * The accounts, as given from the statements. These are the figures anyone will
 * quote, so each is checked against what was said rather than only in total.
 */
describe('the seeded bank accounts', () => {
  const cds = SEEDED_INVESTMENTS.filter((i) => i.investmentKind === 'cd')

  it('records every certificate as given', () => {
    const M = 'Millennium Bank'
    const given: [string, string, number, number, string, string][] = [
      ['cd-mb-251011-a', M, 516_750.52, 4.5, '2025-10-11', '2026-10-11'],
      ['cd-mb-251107-a', M, 1_033_470.65, 4.5, '2025-11-07', '2026-11-07'],
      ['cd-mb-251107-b', M, 516_735.32, 4.5, '2025-11-07', '2026-11-07'],
      ['cd-mb-251107-c', M, 1_033_470.65, 4.5, '2025-11-07', '2026-11-07'],
      ['cd-mb-251107-d', M, 1_033_470.65, 4.5, '2025-11-07', '2026-11-07'],
      ['cd-mb-251204-a', M, 5_104_391.56, 4.25, '2025-12-04', '2026-12-04'],
      ['cd-mb-260116-a', M, 1_020_850.67, 4.25, '2026-01-16', '2027-01-16'],
      ['cd-mb-260406-a', 'Republic Bank', 507_881.85, 5, '2026-04-06', '2026-12-06'],
      ['cd-mb-260501-a', M, 1_010_543.45, 4.25, '2026-05-01', '2027-05-01'],
      ['cd-mb-260501-b', M, 1_010_543.45, 4.25, '2026-05-01', '2027-05-01'],
      ['cd-pa-260805-a', 'Pan Am Bank', 500_000, 4.1, '2026-08-05', '2027-08-05'],
    ]
    expect(cds).toHaveLength(given.length)
    for (const [id, institution, balance, ratePct, opened, matures] of given) {
      const cd = SEEDED_INVESTMENTS.find((i) => i.id === id)!
      expect(cd, id).toBeDefined()
      expect(cd.balance, id).toBe(balance)
      expect(cd.ratePct, id).toBe(ratePct)
      expect(cd.openedDate, id).toBe(opened)
      expect(cd.maturityDate, id).toBe(matures)
      expect(cd.institution, id).toBe(institution)
    }
  })

  it('records the PNC mutual fund without inventing a rate for it', () => {
    // It has no term, no maturity and no contracted rate. Asserting one would
    // put a made-up yield into the interest total.
    const mf = SEEDED_INVESTMENTS.find((i) => i.id === 'mf-pnc-a')!
    expect(mf.institution).toBe('PNC Bank')
    expect(mf.investmentKind).toBe('mutual-fund')
    expect(mf.balance).toBe(44_602.22)
    expect(mf.ratePct).toBeUndefined()
    expect(mf.maturityDate).toBeUndefined()
    expect(annualInterest(mf)).toBe(0)
  })

  it('adds up to what the statements come to', () => {
    expect(SEEDED_INVESTMENT_TOTAL).toBeCloseTo(13_332_710.99, 2)
    const cdTotal = cds.reduce((a, i) => a + i.balance, 0)
    expect(cdTotal).toBeCloseTo(13_288_108.77, 2)
  })

  it('throws off half a million a year at the stated rates', () => {
    const r: AssetRegister = { ...EMPTY_REGISTER, investments: SEEDED_INVESTMENTS }
    expect(registerInterest(r)).toBeCloseTo(578_138.48, 2)
  })

  it('leaves the mutual fund out of the blended rate rather than scoring it zero', () => {
    // Including it as 0% would drag the blend down and misstate what the money
    // that does carry a rate is actually earning.
    const r: AssetRegister = { ...EMPTY_REGISTER, investments: SEEDED_INVESTMENTS }
    expect(blendedRate(r)).toBeCloseTo(4.3508, 3)
    const cdsOnly: AssetRegister = { ...EMPTY_REGISTER, investments: cds }
    expect(blendedRate(r)).toBeCloseTo(blendedRate(cdsOnly)!, 6)
  })

  it('keeps the certificates that look like duplicates and are not', () => {
    // Three at $1,033,470.65 on the same day, and two at $1,010,543.45 on the
    // same day. Deduplicating either set would lose real money.
    const same = (n: number) => SEEDED_INVESTMENTS.filter((i) => i.balance === n)
    expect(same(1_033_470.65)).toHaveLength(3)
    expect(same(1_010_543.45)).toHaveLength(2)
    expect(new Set(SEEDED_INVESTMENTS.map((i) => i.id)).size).toBe(SEEDED_INVESTMENTS.length)
  })

  it('names each certificate by its term, and derives maturity from it', () => {
    // Maturity is computed from the opening date and the term rather than typed
    // beside it, so the two cannot disagree. Only Republic is not twelve months.
    const term = (cd: typeof cds[number]) => {
      const a = new Date(`${cd.openedDate}T00:00:00Z`)
      const b = new Date(`${cd.maturityDate}T00:00:00Z`)
      return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth())
    }
    for (const cd of cds) {
      const months = term(cd)
      expect(cd.name, cd.id).toBe(months === 12 ? 'One-year CD' : `${months}-month CD`)
      // Same day of the month at both ends — no drift from the date arithmetic.
      expect(cd.maturityDate!.slice(-2), cd.id).toBe(cd.openedDate!.slice(-2))
    }
    expect(term(cds.find((i) => i.id === 'cd-mb-260406-a')!)).toBe(8)
    expect(cds.filter((i) => term(i) !== 12)).toHaveLength(1)
  })

  it('spreads across four institutions, heavily weighted to one', () => {
    const byBank = byInstitution({ ...EMPTY_REGISTER, investments: SEEDED_INVESTMENTS })
    expect(byBank.map((b) => b.institution).sort())
      .toEqual(['Millennium Bank', 'PNC Bank', 'Pan Am Bank', 'Republic Bank'])
    const mb = byBank.find((b) => b.institution === 'Millennium Bank')!
    expect(mb.balance).toBeCloseTo(12_280_226.92, 2)
    // Over 90% with one bank — a concentration worth being able to see.
    expect(mb.balance / SEEDED_INVESTMENT_TOTAL).toBeGreaterThan(0.9)
  })

  it('pays the best rate on the shortest term', () => {
    const best = [...cds].sort((a, b) => (b.ratePct ?? 0) - (a.ratePct ?? 0))[0]
    expect(best.id).toBe('cd-mb-260406-a')
    expect(best.ratePct).toBe(5)
  })

  it('lists what matures, soonest first, and nothing that cannot', () => {
    const r: AssetRegister = { ...EMPTY_REGISTER, investments: SEEDED_INVESTMENTS }
    const due = maturities(r, new Date('2026-09-01T12:00:00'))
    // The mutual fund has no maturity, so it is not a decision waiting to happen.
    expect(due).toHaveLength(cds.length)
    expect(due[0].investment.maturityDate).toBe('2026-10-11')
    expect(due.at(-1)!.investment.maturityDate).toBe('2027-08-05')
    expect(due.every((m) => !m.matured)).toBe(true)
  })
})

describe('seeding the register', () => {
  const count = SEEDED_INVESTMENTS.length

  it('fills an empty register', () => {
    const r = applySeed(EMPTY_REGISTER, SEEDED_INVESTMENTS, INVESTMENT_SEED_VERSION)
    expect(r.investments).toHaveLength(count)
    expect(r.seedVersion).toBe(INVESTMENT_SEED_VERSION)
    expect(needsSeed(r, INVESTMENT_SEED_VERSION)).toBe(false)
  })

  it('does not run twice, so a deleted row stays deleted', () => {
    const seeded = applySeed(EMPTY_REGISTER, SEEDED_INVESTMENTS, INVESTMENT_SEED_VERSION)
    const pruned = { ...seeded, investments: seeded.investments.slice(1) }
    expect(applySeed(pruned, SEEDED_INVESTMENTS, INVESTMENT_SEED_VERSION).investments)
      .toHaveLength(count - 1)
  })

  it('never overwrites a balance somebody corrected', () => {
    // The seed adds missing rows; it does not restate the ones already there.
    const edited: AssetRegister = {
      ...EMPTY_REGISTER,
      investments: [
        { ...SEEDED_INVESTMENTS.find((i) => i.id === 'cd-mb-251107-a')!, balance: 1_040_000 },
      ],
    }
    const r = applySeed(edited, SEEDED_INVESTMENTS, INVESTMENT_SEED_VERSION)
    expect(r.investments.find((i) => i.id === 'cd-mb-251107-a')!.balance).toBe(1_040_000)
    expect(r.investments).toHaveLength(count)
  })

  it('reaches a register saved before a later batch existed', () => {
    // A register stamped at an earlier version — the case that would otherwise
    // never see the accounts added since.
    const old: AssetRegister = { investments: [], vehicles: [], seedVersion: 1 }
    expect(needsSeed(old, INVESTMENT_SEED_VERSION)).toBe(true)
    expect(applySeed(old, SEEDED_INVESTMENTS, INVESTMENT_SEED_VERSION).investments)
      .toHaveLength(count)
    // And one that predates the mechanism entirely.
    expect(needsSeed({ investments: [], vehicles: [] }, INVESTMENT_SEED_VERSION)).toBe(true)
  })
})

describe('the shape of the deposits', () => {
  const r: AssetRegister = { ...EMPTY_REGISTER, investments: SEEDED_INVESTMENTS }
  const asOf = new Date('2026-09-01T12:00:00')

  it('groups what comes due by month, in order', () => {
    const s = maturitySchedule(r, asOf)
    expect(s.map((b) => b.key)).toEqual([
      '2026-10', '2026-11', '2026-12', '2027-01', '2027-05', '2027-08',
    ])
    expect(s.map((b) => b.label)).toEqual([
      'Oct 26', 'Nov 26', 'Dec 26', 'Jan 27', 'May 27', 'Aug 27',
    ])
    // November holds the four certificates opened the same day.
    const nov = s.find((b) => b.key === '2026-11')!
    expect(nov.count).toBe(4)
    expect(nov.balance).toBeCloseTo(3_617_147.27, 2)
    // December holds the big Millennium CD and the Republic one.
    expect(s.find((b) => b.key === '2026-12')!.count).toBe(2)
  })

  it('accounts for every dated certificate exactly once', () => {
    const s = maturitySchedule(r, asOf)
    const cds = SEEDED_INVESTMENTS.filter((i) => i.maturityDate)
    expect(s.reduce((a, b) => a + b.count, 0)).toBe(cds.length)
    expect(s.reduce((a, b) => a + b.balance, 0))
      .toBeCloseTo(cds.reduce((a, i) => a + i.balance, 0), 2)
  })

  it('leaves out what has no maturity rather than showing it as due', () => {
    // The mutual fund has no term. Putting it in the ladder would imply a
    // decision that does not exist.
    const s = maturitySchedule(r, asOf)
    expect(s.reduce((a, b) => a + b.count, 0)).toBe(SEEDED_INVESTMENTS.length - 1)
  })

  it('marks the months inside the decision window', () => {
    const s = maturitySchedule(r, asOf)
    const soon = s.filter((b) => b.soon)
    expect(soon.map((b) => b.key)).toEqual(['2026-10', '2026-11'])
    expect(soon.reduce((a, b) => a + b.balance, 0)).toBeCloseTo(4_133_897.79, 2)
    // December 4th is 94 days out — just outside, and it should stay outside.
    expect(s.find((b) => b.key === '2026-12')!.soon).toBe(false)
  })

  it('moves the window with the date, not with the data', () => {
    const later = maturitySchedule(r, new Date('2026-10-01T12:00:00'))
    expect(later.find((b) => b.key === '2026-12')!.soon).toBe(true)
  })

  it('bands the balances by rate, lowest first', () => {
    const bands = byRate(r)
    expect(bands.map((b) => b.ratePct)).toEqual([4.1, 4.25, 4.5, 5])
    expect(bands.find((b) => b.ratePct === 4.25)!.balance).toBeCloseTo(8_146_329.13, 2)
    expect(bands.find((b) => b.ratePct === 4.5)!.count).toBe(5)
    expect(bands.find((b) => b.ratePct === 5)!.balance).toBeCloseTo(507_881.85, 2)
  })

  it('leaves an account with no rate out of the bands entirely', () => {
    // Banding it at zero would invent a rate it does not have.
    const bands = byRate(r)
    expect(bands.some((b) => b.ratePct === 0)).toBe(false)
    expect(bands.reduce((a, b) => a + b.count, 0)).toBe(SEEDED_INVESTMENTS.length - 1)
    expect(bands.reduce((a, b) => a + b.interest, 0)).toBeCloseTo(registerInterest(r), 2)
  })

  it('says nothing at all about an empty register', () => {
    expect(maturitySchedule(EMPTY_REGISTER, asOf)).toEqual([])
    expect(byRate(EMPTY_REGISTER)).toEqual([])
  })
})
