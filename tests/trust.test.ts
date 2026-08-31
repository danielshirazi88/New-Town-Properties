import { describe, expect, it } from 'vitest'
import {
  EMPTY_TRUST_STATE, annualisedGrowth, editCountFor, resolveTrust, trustTotals, yearsHeld,
  type TrustHolding, type TrustState,
} from '../src/lib/trust'
import { TRUST_HOLDINGS, TRUST_PURCHASE_TOTAL } from '../src/data/trust'
import { PROPERTIES } from '../src/data/properties'

const asOf = new Date('2026-08-31T12:00:00')

const holding = (o: Partial<TrustHolding> = {}): TrustHolding => ({
  id: 'h1', seq: 1, purchaseDate: '2010-01-01', address: 'Somewhere',
  propertyType: 'Strip mall', purchasePrice: 500_000, use: 'rental', ...o,
})

const state = (o: Partial<TrustState> = {}): TrustState => ({ ...EMPTY_TRUST_STATE, ...o })

describe('the transcribed schedule', () => {
  it('has all eighteen rows in the order the paper lists them', () => {
    expect(TRUST_HOLDINGS).toHaveLength(18)
    expect(TRUST_HOLDINGS.map((h) => h.seq)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1))
  })

  it('adds up to the schedule total', () => {
    expect(TRUST_PURCHASE_TOTAL).toBeCloseTo(11_705_584.65, 2)
  })

  it('gives every row a price', () => {
    expect(TRUST_HOLDINGS.filter((h) => h.purchasePrice === undefined)).toHaveLength(0)
  })

  it('links every rental to a property the app knows, bar none', () => {
    const ids = new Set(PROPERTIES.map((p) => p.id))
    const rentals = TRUST_HOLDINGS.filter((h) => h.use === 'rental')
    // Fourteen let, plus the Chicago condo, is every property the rent roll has.
    expect(rentals).toHaveLength(14)
    for (const h of rentals) {
      expect(h.propertyId, h.address).toBeDefined()
      expect(ids.has(h.propertyId!), `${h.address} → ${h.propertyId}`).toBe(true)
    }
  })

  it('covers every property on the rent roll', () => {
    // The schedule is the ownership record; a building earning rent that is not
    // on it would mean one of the two is wrong.
    const linked = new Set(TRUST_HOLDINGS.map((h) => h.propertyId).filter(Boolean))
    const missing = PROPERTIES.filter((p) => !linked.has(p.id)).map((p) => p.id)
    expect(missing).toEqual([])
  })

  it('keeps the two residences and the resale condo off the rental side', () => {
    expect(TRUST_HOLDINGS.filter((h) => h.use === 'personal').map((h) => h.address)).toEqual([
      '1211 S Prairie Ave Unit 2605, Chicago, IL',
      '129 E Foster Ave, Roselle, IL',
      '43 Ventada St, Ladera Ranch, CA',
    ])
    expect(TRUST_HOLDINGS.filter((h) => h.use === 'resale')).toHaveLength(1)
  })

  it('flags the Roselle price rather than correcting it', () => {
    const foster = TRUST_HOLDINGS.find((h) => h.address.startsWith('129 E Foster'))!
    expect(foster.purchasePrice).toBe(2_100_000)
    expect(foster.needsConfirmation).toBeTruthy()
  })
})

describe('the edit layer', () => {
  it('leaves the schedule alone when nothing is edited', () => {
    const [r] = resolveTrust([holding()], EMPTY_TRUST_STATE)
    expect(r.purchasePrice).toBe(500_000)
    expect(r.editedFields).toEqual([])
    expect(r.isAdded).toBe(false)
  })

  it('applies a correction and says which field was touched', () => {
    const [r] = resolveTrust([holding()], state({
      edits: { h1: { purchasePrice: 210_000, updatedAt: 'now' } },
    }))
    expect(r.purchasePrice).toBe(210_000)
    // updatedAt is bookkeeping, not an edit anyone made to the schedule.
    expect(r.editedFields).toEqual(['purchasePrice'])
  })

  it('takes a rental value from the portfolio', () => {
    const [r] = resolveTrust([holding({ propertyId: 'plaza-1' })], EMPTY_TRUST_STATE,
      (id) => (id === 'plaza-1' ? 3_000_000 : undefined))
    expect(r.estimatedValue).toBe(3_000_000)
    expect(r.valueFromPortfolio).toBe(true)
  })

  it('lets a typed value beat the portfolio, because an appraisal knows more', () => {
    const [r] = resolveTrust([holding({ propertyId: 'plaza-1' })],
      state({ edits: { h1: { estimatedValue: 4_200_000 } } }),
      () => 3_000_000)
    expect(r.estimatedValue).toBe(4_200_000)
    expect(r.valueFromPortfolio).toBe(false)
  })

  it('strikes out a row and can bring it back', () => {
    expect(resolveTrust([holding()], state({ removed: ['h1'] }))).toHaveLength(0)
    expect(resolveTrust([holding()], state({ removed: [] }))).toHaveLength(1)
  })

  it('takes in a holding that is not on the schedule', () => {
    const rows = resolveTrust([holding()], state({
      added: [holding({ id: 'h2', seq: 19, address: 'A new one' })],
    }))
    expect(rows).toHaveLength(2)
    expect(rows[1].isAdded).toBe(true)
  })

  it('counts every kind of change', () => {
    expect(editCountFor(state({
      edits: { h1: { purchasePrice: 1, estimatedValue: 2, updatedAt: 'now' } },
      added: [holding({ id: 'h2' })],
      removed: ['h3'],
    }))).toBe(4)
  })
})

describe('trust totals', () => {
  const rows = resolveTrust(
    [
      holding({ id: 'a', seq: 1, purchasePrice: 500_000, use: 'rental', propertyId: 'p1' }),
      holding({ id: 'b', seq: 2, purchasePrice: 300_000, use: 'personal' }),
      holding({ id: 'c', seq: 3, purchasePrice: 100_000, use: 'resale' }),
    ],
    state({ edits: { b: { estimatedValue: 900_000, debt: 200_000 } } }),
    (id) => (id === 'p1' ? 2_000_000 : undefined),
  )
  const t = trustTotals(rows)

  it('adds cost and value separately', () => {
    expect(t.purchaseTotal).toBe(900_000)
    expect(t.valueTotal).toBe(2_900_000)
  })

  it('reports what has no value rather than hiding it in the total', () => {
    expect(t.withoutValue).toBe(1)
    expect(t.withoutPrice).toBe(0)
  })

  it('compares only holdings that carry both figures', () => {
    // The resale condo has a price but no value; counting it would read as a
    // total loss on the whole purchase.
    expect(t.comparableCost).toBe(800_000)
    expect(t.comparableValue).toBe(2_900_000)
  })

  it('nets debt off to give equity', () => {
    expect(t.debt).toBe(200_000)
    expect(t.equity).toBe(2_700_000)
  })

  it('splits by how each holding is used', () => {
    expect(t.byUse.rental.count).toBe(1)
    expect(t.byUse.personal.value).toBe(900_000)
    expect(t.byUse.resale.purchase).toBe(100_000)
  })
})

describe('holding period and growth', () => {
  it('measures years held from the purchase date', () => {
    expect(yearsHeld({ purchaseDate: '2016-08-31' }, asOf)).toBeCloseTo(10, 1)
  })

  it('annualises the gain between cost and value', () => {
    // $500,000 doubling over ten years is a shade over 7% a year.
    const [r] = resolveTrust([holding({ purchaseDate: '2016-08-31' })],
      state({ edits: { h1: { estimatedValue: 1_000_000 } } }))
    expect(annualisedGrowth(r, asOf)).toBeCloseTo(7.18, 1)
  })

  it('says nothing about a holding owned less than a year', () => {
    // Annualising four months of ownership is arithmetic, not information.
    const [r] = resolveTrust([holding({ purchaseDate: '2026-06-01' })],
      state({ edits: { h1: { estimatedValue: 600_000 } } }))
    expect(annualisedGrowth(r, asOf)).toBeUndefined()
  })

  it('says nothing without both figures', () => {
    const [r] = resolveTrust([holding({ purchaseDate: '2010-01-01' })], EMPTY_TRUST_STATE)
    expect(annualisedGrowth(r, asOf)).toBeUndefined()
  })
})
