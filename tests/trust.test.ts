import { describe, expect, it } from 'vitest'
import {
  EMPTY_TRUST_STATE, annualisedGrowth, appraisalsByProperty, daysToBalloon, editCountFor,
  impliedCapRate, impliedNoteRate, resolveTrust, trustTotals, yearsHeld,
  type TrustHolding, type TrustState,
} from '../src/lib/trust'
import { APPRAISAL_DATE, TRUST_HOLDINGS, TRUST_PURCHASE_TOTAL } from '../src/data/trust'
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
    // $600,000 below the figure first transcribed: 129 E Foster's $2,100,000 was
    // the current value written in the price column, and the house cost $1.5m.
    expect(TRUST_PURCHASE_TOTAL).toBeCloseTo(11_105_584.65, 2)
  })

  it('gives every row a price', () => {
    expect(TRUST_HOLDINGS.filter((h) => h.purchasePrice === undefined)).toHaveLength(0)
  })

  it('links every rental to a property the app knows, bar none', () => {
    const ids = new Set(PROPERTIES.map((p) => p.id))
    const rentals = TRUST_HOLDINGS.filter((h) => h.use === 'rental')
    // Thirteen still let — West Plaza became a note when it sold.
    expect(rentals).toHaveLength(13)
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

  it('settles the Roselle figure that was flagged for checking', () => {
    // The $2,100,000 on the schedule was never a purchase price. Asked about it,
    // the owner gave both figures: cost $1.5m, worth $2.1m now.
    const foster = TRUST_HOLDINGS.find((h) => h.address.startsWith('129 E Foster'))!
    expect(foster.purchasePrice).toBe(1_500_000)
    expect(foster.appraisal?.value).toBe(2_100_000)
    expect(foster.needsConfirmation).toBeUndefined()
    expect(foster.note).toContain('$1,500,000')
  })
})

describe('the West Plaza seller note', () => {
  const wp = TRUST_HOLDINGS.find((h) => h.address.startsWith('1901-25 S Mannheim'))!

  it('is held as a note, not as a building', () => {
    // The schedule was drawn up on 27 April; the sale closed on the 30th.
    expect(wp.use).toBe('note')
    expect(wp.sellerNote).toMatchObject({
      soldDate: '2026-04-30',
      balance: 1_000_000,
      monthlyPayment: 6140.87,
      maturityDate: '2029-04-30',
    })
  })

  it('is worth the balance outstanding, never the capitalised building', () => {
    // Capitalising a building the trust no longer owns would value it twice: once
    // as property and once as the note it was exchanged for.
    const [r] = resolveTrust([wp], EMPTY_TRUST_STATE, () => 4_000_000)
    expect(r.estimatedValue).toBe(1_000_000)
    expect(r.valueFromPortfolio).toBe(false)
  })

  it('still lets a typed figure win, for a note bought down or written off', () => {
    const [r] = resolveTrust([wp], state({ edits: { [wp.id]: { estimatedValue: 850_000 } } }),
      () => 4_000_000)
    expect(r.estimatedValue).toBe(850_000)
  })

  it('counts the balloon down from today', () => {
    expect(daysToBalloon(wp.sellerNote!, new Date('2026-08-31T12:00:00'))).toBe(973)
    expect(daysToBalloon(wp.sellerNote!, new Date('2029-05-01T12:00:00'))).toBe(-1)
  })

  it('implies a rate the payment and balance can be sanity-checked against', () => {
    // $6,140.87 a month on $1,000,000 is 7.37% of the balance a year — plausible
    // for seller financing, and the figure to challenge if it were not.
    expect(impliedNoteRate(wp.sellerNote!)).toBeCloseTo(7.37, 1)
  })

  it('keeps the payment the rent roll confirms and flags the one it does not', () => {
    expect(wp.needsConfirmation).toContain('6,000')
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

/**
 * The current values, given by the owner on 1 September 2026.
 *
 * These are the figures anyone will actually quote off this screen, so they are
 * checked one by one against what was said rather than only in total.
 */
describe('the appraised values', () => {
  const by = (start: string) => TRUST_HOLDINGS.find((h) => h.address.startsWith(start))!

  it('records the figure given for each address', () => {
    const given: [string, number][] = [
      ['1501-1505 N Mannheim', 4_000_000],
      ['1511 N Mannheim', 1_400_000],
      ['1638-46 N Mannheim', 2_500_000],
      ['1506-10 N Mannheim', 1_320_000],
      ['1500 N Mannheim', 1_380_000],
      ['1559 N Mannheim', 3_950_000],
      ['1401 N 25th Ave', 2_430_000],
      ['4208 Apollo Ln', 4_000_000],
      ['511 SE 5th Ave', 350_000],
      ['1211 S Prairie', 900_000],
      ['129 E Foster', 2_100_000],
      ['1681-1693 N Mannheim', 4_000_000],
      ['43 Ventada St', 2_500_000],
      ['1536 N Mannheim', 1_000_000],
      ['1538 N Mannheim', 500_000],
      ['1643 N 43rd Ave', 350_000],
      ['153 N Seabreeze', 2_400_000],
    ]
    for (const [address, value] of given) {
      expect(by(address).appraisal?.value, address).toBe(value)
    }
    expect(given).toHaveLength(17)
  })

  it('values everything except the building that had already sold', () => {
    const without = TRUST_HOLDINGS.filter((h) => !h.appraisal)
    expect(without.map((h) => h.address)).toEqual(['1901-25 S Mannheim Rd, Westchester, IL'])
    for (const h of TRUST_HOLDINGS) {
      if (h.appraisal) expect(h.appraisal.asOf, h.address).toBe(APPRAISAL_DATE)
    }
  })

  it('carries the offers on Apollo, not the owner’s hoped-for number', () => {
    // He puts it at $4.5m–$5m; $4m is what buyers actually offered. A total built
    // on the top of every range is not a number anyone should act on.
    const apollo = by('4208 Apollo Ln').appraisal!
    expect(apollo.value).toBe(4_000_000)
    expect(apollo.high).toBe(5_000_000)
    expect(apollo.basis).toBe('offer')
  })

  it('keeps the sold building at the note balance, not at what it fetched', () => {
    const wp = by('1901-25 S Mannheim')
    expect(wp.sellerNote?.soldPrice).toBe(3_100_000)
    expect(wp.capitalSpend).toBe(250_000)
    const [row] = resolveTrust([wp])
    expect(row.estimatedValue).toBe(1_000_000)
    expect(row.valueSource).toBe('note')
  })

  it('shows the West Plaza gain against everything put into it', () => {
    const wp = by('1901-25 S Mannheim')
    const cost = (wp.purchasePrice ?? 0) + (wp.capitalSpend ?? 0)
    expect(cost).toBe(1_225_000)
    expect((wp.sellerNote!.soldPrice ?? 0) - cost).toBe(1_875_000)
  })
})

describe('where a value comes from', () => {
  const model = () => 900_000

  it('prefers an appraisal to the cap-rate model', () => {
    const h = holding({ propertyId: 'p1', appraisal: { value: 1_400_000, asOf: '2026-09-01', basis: 'appraisal' } })
    const [r] = resolveTrust([h], EMPTY_TRUST_STATE, model)
    expect(r.estimatedValue).toBe(1_400_000)
    expect(r.valueSource).toBe('appraisal')
    expect(r.valueFromPortfolio).toBe(false)
  })

  it('prefers a typed figure to an appraisal', () => {
    // Someone typing a number is saying they know something newer than the paper.
    const h = holding({ id: 'h1', propertyId: 'p1', appraisal: { value: 1_400_000, asOf: '2026-09-01', basis: 'appraisal' } })
    const [r] = resolveTrust([h], state({ edits: { h1: { estimatedValue: 1_650_000 } } }), model)
    expect(r.estimatedValue).toBe(1_650_000)
    expect(r.valueSource).toBe('edit')
  })

  it('falls back to the model where there is no appraisal', () => {
    const [r] = resolveTrust([holding({ propertyId: 'p1' })], EMPTY_TRUST_STATE, model)
    expect(r.estimatedValue).toBe(900_000)
    expect(r.valueSource).toBe('portfolio')
    expect(r.valueFromPortfolio).toBe(true)
  })

  it('says so plainly when nothing values a holding', () => {
    const [r] = resolveTrust([holding({ purchasePrice: 100, propertyId: undefined })])
    expect(r.estimatedValue).toBeUndefined()
    expect(r.valueSource).toBe('none')
  })
})

describe('the bridge to the portfolio', () => {
  it('maps only holdings that have a building still owned', () => {
    const m = appraisalsByProperty(TRUST_HOLDINGS)
    expect(m.get('mannheim-plaza')?.value).toBe(4_000_000)
    expect(m.get('apollo')?.value).toBe(4_000_000)
    // Sold, so it values something the trust no longer holds.
    expect(m.has('west-plaza')).toBe(false)
    // Every id in the map is a real property.
    for (const id of m.keys()) {
      expect(PROPERTIES.some((p) => p.id === id), id).toBe(true)
    }
  })

  it('leaves out what earns nothing to capitalise', () => {
    const m = appraisalsByProperty(TRUST_HOLDINGS)
    // The two residences and the condo held for resale have no portfolio id at
    // all, so they cannot leak into a cap-rate table.
    expect([...m.keys()]).not.toContain(undefined)
    expect(m.size).toBe(TRUST_HOLDINGS.filter((h) => h.propertyId && h.appraisal && !h.sellerNote).length)
  })

  it('reads a cap rate back out of a price', () => {
    expect(impliedCapRate(80_000, 1_000_000)).toBeCloseTo(8, 6)
    // Nothing to divide by, and nothing to divide.
    expect(impliedCapRate(80_000, 0)).toBeUndefined()
    expect(impliedCapRate(0, 1_000_000)).toBeUndefined()
    expect(impliedCapRate(-5_000, 1_000_000)).toBeUndefined()
  })
})
