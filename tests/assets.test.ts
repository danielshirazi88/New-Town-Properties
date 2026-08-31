import { describe, expect, it } from 'vitest'
import {
  annualInterest, assetBreakdown, assetTotals, blendedRate, byInstitution, maturities,
  realEstateTotals, registerInterest, vehicleValued,
  type AssetRegister, type InvestmentAsset, type VehicleAsset,
} from '../src/lib/assets'

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
