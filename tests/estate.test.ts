import { describe, expect, it } from 'vitest'
import { estateIncome, estateValue, valueSlices } from '../src/lib/estate'
import { EMPTY_REGISTER, type AssetRegister } from '../src/lib/assets'
import { SEEDED_INVESTMENTS } from '../src/data/investments'
import { resolveTrust } from '../src/lib/trust'
import { TRUST_HOLDINGS } from '../src/data/trust'
import { computeKpis, resolveData, DEFAULT_CAP_RATE, DEFAULT_OPEX_LOAD_PCT } from '../src/lib/portfolio'
import { rentRoll } from '../src/data/rentRolls'

const register: AssetRegister = { ...EMPTY_REGISTER, investments: SEEDED_INVESTMENTS }

const k = computeKpis(new Date('2026-09-01T12:00:00'), resolveData(undefined, 2026))
const capValue = new Map<string, number>()
for (const p of k.properties) {
  if (p.netAfterTax > 0) capValue.set(p.property.id, (p.netAfterTax / DEFAULT_CAP_RATE) * 100)
}
const holdings = resolveTrust(TRUST_HOLDINGS, undefined, (id) => capValue.get(id))

describe('what the estate earns', () => {
  const income = estateIncome(
    k.grossCollected, k.totalTaxes, register, DEFAULT_OPEX_LOAD_PCT, rentRoll(2026).monthsReported,
  )

  it('puts rent and interest on the same footing before adding them', () => {
    // Eight months of rent against a full year of interest would understate the
    // property side by a third and make the split look wrong.
    expect(income.annualised).toBe(true)
    expect(income.monthsReported).toBe(8)
    expect(income.propertyGross).toBeCloseTo((k.grossCollected / 8) * 12, 2)
    expect(income.propertyGross).toBeGreaterThan(k.grossCollected)
  })

  it('takes property tax and an operating allowance off the rent', () => {
    expect(income.propertyOpex).toBeCloseTo(income.propertyGross * 0.12, 2)
    expect(income.propertyNet).toBeCloseTo(
      income.propertyGross - income.propertyTaxes - income.propertyOpex, 2,
    )
    // Net is well below gross: a "net" that only subtracted tax would not be net.
    expect(income.propertyNet).toBeLessThan(income.propertyGross - income.propertyTaxes)
  })

  it('adds the interest the deposits actually pay', () => {
    expect(income.investmentIncome).toBeCloseTo(578_138.48, 2)
    expect(income.totalNet).toBeCloseTo(income.propertyNet + income.investmentIncome, 2)
    expect(income.monthlyNet).toBeCloseTo(income.totalNet / 12, 6)
  })

  it('comes to what the dashboard quotes', () => {
    expect(Math.round(income.totalNet)).toBe(2_402_859)
    expect(Math.round(income.monthlyNet)).toBe(200_238)
  })

  it('leaves the property side alone on a full year', () => {
    const full = estateIncome(1_200_000, 200_000, EMPTY_REGISTER, 10, 12)
    expect(full.annualised).toBe(false)
    expect(full.propertyGross).toBe(1_200_000)
    expect(full.propertyNet).toBe(1_200_000 - 200_000 - 120_000)
  })

  it('reports a source only where it earns something', () => {
    expect(estateIncome(1_000, 0, EMPTY_REGISTER, 0, 12).sources.map((s) => s.id))
      .toEqual(['property'])
    expect(income.sources.map((s) => s.id)).toEqual(['property', 'investment'])
  })

  it('never counts the seller note twice', () => {
    // It is a row on the rent roll, so it arrives inside the property figure.
    // The trust also carries it, at the balance outstanding — a value, not income.
    const note = holdings.find((h) => h.use === 'note')!
    expect(note.estimatedValue).toBe(1_000_000)
    const noteRow = k.properties.flatMap((p) => p.leases).find((l) => l.incomeType === 'note')!
    expect(noteRow.months.some((m) => m === 6140.87)).toBe(true)
  })
})

describe('what the estate is worth', () => {
  const worth = estateValue(holdings, register)

  it('reads real estate from the trust schedule, not the rent roll', () => {
    // The schedule is wider on purpose: two residences and a condo held for
    // resale pay no rent and would be missing from a net-worth figure entirely.
    expect(worth.personalRealEstate).toBe(5_500_000)
    expect(worth.resaleRealEstate).toBe(2_400_000)
    expect(worth.rentalRealEstate).toBe(27_180_000)
  })

  it('carries a sold building at the note, not at the building', () => {
    expect(worth.notesReceivable).toBe(1_000_000)
  })

  it('adds the deposits at their balances', () => {
    expect(worth.deposits).toBeCloseTo(13_332_710.99, 2)
  })

  it('comes to what the dashboard quotes, with nothing unvalued', () => {
    expect(Math.round(worth.gross)).toBe(49_412_711)
    expect(worth.debt).toBe(0)
    expect(worth.net).toBe(worth.gross)
    expect(worth.unvalued).toBe(0)
  })

  it('slices largest first and drops anything empty', () => {
    const slices = valueSlices(worth)
    expect(slices[0].id).toBe('rental')
    expect(slices[1].id).toBe('deposits')
    for (let i = 1; i < slices.length; i += 1) {
      expect(slices[i].value).toBeLessThanOrEqual(slices[i - 1].value)
    }
    // No vehicles recorded yet, so no empty slice for them.
    expect(slices.some((s) => s.id === 'vehicles')).toBe(false)
    expect(slices.reduce((a, s) => a + s.value, 0)).toBeCloseTo(worth.gross, 2)
  })

  it('counts a holding with no value as zero rather than guessing', () => {
    const [row] = resolveTrust([{
      id: 'x', seq: 1, purchaseDate: '2020-01-01', address: 'Nowhere',
      propertyType: 'Land', use: 'rental',
    }])
    const v = estateValue([row], EMPTY_REGISTER)
    expect(v.unvalued).toBe(1)
    expect(v.gross).toBe(0)
  })
})
