import { describe, expect, it } from 'vitest'
import {
  APOLLO_GROSS_2026, APOLLO_LEASES_2026, APOLLO_MONTHLY_TOTALS_2026,
  APOLLO_PARKING_OFF_ROLL_MONTHLY, APOLLO_REGISTRY_CONFLICTS,
} from '../src/data/rentRolls/apollo2026'
import { APOLLO_TENANTS } from '../src/data/apollo'
import { cellAmount, collected, isUnreported } from '../src/lib/finance'
import { computeKpis, resolveData } from '../src/lib/portfolio'
import { chargesForYear, payerRecordsFor, DEFAULT_COLLECTION } from '../src/lib/receivables'
import { rentRoll } from '../src/data/rentRolls'

/**
 * The park's own 2026 rent roll, transcribed from the scan.
 *
 * The sheet prints a total under every month, which is the one thing the
 * commercial 2026 sheet does not — so unlike that one, this transcription can be
 * checked against the document rather than only against itself.
 */
describe('the Apollo 2026 rent roll', () => {
  it('has all thirty-seven lots', () => {
    expect(APOLLO_LEASES_2026).toHaveLength(37)
    expect(new Set(APOLLO_LEASES_2026.map((l) => l.id)).size).toBe(37)
    for (const l of APOLLO_LEASES_2026) expect(l.propertyId, l.id).toBe('apollo')
  })

  it('ties to the total printed under every column', () => {
    for (let i = 0; i < 8; i += 1) {
      const month = APOLLO_LEASES_2026.reduce((a, l) => a + cellAmount(l.months[i]), 0)
      expect(month, `month ${i + 1}`).toBe(APOLLO_MONTHLY_TOTALS_2026[i])
    }
    expect(APOLLO_GROSS_2026).toBe(258_020)
  })

  it('reports nothing for the months the sheet does not reach', () => {
    // September onward is blank, not zero — a lot is not empty because a
    // document stops.
    for (const l of APOLLO_LEASES_2026) {
      expect(l.months.slice(8).every(isUnreported), l.id).toBe(true)
      expect(collected(l), l.id).toBe(l.statedAnnualTotal)
    }
  })

  it('replaces a derived figure that ran $6,780 high', () => {
    // The old number multiplied one month of the July registry across eight,
    // assuming the rents had not moved. Eight of the thirty-seven had.
    expect(33_100 * 8 - APOLLO_GROSS_2026).toBe(6_780)
    const moved = APOLLO_LEASES_2026.filter(
      (l) => cellAmount(l.months[0]) !== cellAmount(l.months[7]),
    )
    expect(moved).toHaveLength(8)
  })

  it('treats a lot as month to month rather than a lease with no end date', () => {
    for (const l of APOLLO_LEASES_2026) {
      expect(l.renewalOptions, l.id).toBe('Month to month')
      expect(l.leaseEnd, l.id).toBeUndefined()
    }
  })

  it('records where the sheet and the July registry disagree', () => {
    // Both are real documents about the same month. The roll wins because it
    // reconciles, but a disagreement is worth seeing rather than resolving.
    expect(APOLLO_REGISTRY_CONFLICTS).toHaveLength(4)
    const july = (unit: string) => cellAmount(
      APOLLO_LEASES_2026.find((l) => l.unit === unit)!.months[6],
    )
    for (const c of APOLLO_REGISTRY_CONFLICTS) {
      expect(july(c.unit), c.unit).toBe(c.rollJuly)
      const reg = APOLLO_TENANTS.find((t) => t.name === c.registryTenant)!
      expect(reg, c.registryTenant).toBeDefined()
      expect(reg.amountDue, c.registryTenant).toBe(c.registryJuly)
    }
  })

  it('keeps the five parking spaces off the roll and says so', () => {
    // They are on the registry at $100 each and nowhere on the sheet. Adding
    // them would break the column totals; ignoring them would lose $4,000.
    const parking = APOLLO_TENANTS.filter((t) => t.isParking)
    expect(parking).toHaveLength(5)
    expect(parking.reduce((a, t) => a + t.amountDue, 0))
      .toBe(APOLLO_PARKING_OFF_ROLL_MONTHLY)
    const addresses = new Set(APOLLO_LEASES_2026.map((l) => l.unit))
    for (const t of parking) expect(addresses.has(t.address), t.name).toBe(false)
  })
})

describe('the park inside the portfolio', () => {
  const asOf = new Date('2026-09-01T12:00:00')
  const k = computeKpis(asOf, resolveData(undefined, 2026))

  it('counts every lot once and only once', () => {
    // The single thing that must not happen: the park added as leases and again
    // as an annual figure.
    expect(k.apolloGross).toBe(258_020)
    expect(k.commercialGross + k.apolloGross).toBeCloseTo(k.grossCollected, 2)
    const apollo = k.properties.find((p) => p.property.id === 'apollo')!
    expect(apollo.collected).toBe(258_020)
  })

  it('keeps lots out of the measures built for commercial suites', () => {
    // Thirty-seven month-to-month lots would swamp WALT, the expiration ladder
    // and tenant concentration, none of which mean anything for a trailer park.
    expect(k.unitCount).toBe(54)
    expect(k.expiring12.some((l) => l.propertyId === 'apollo')).toBe(false)
    expect(k.noEndDateLeases.some((l) => l.propertyId === 'apollo')).toBe(false)
    expect(k.topTenants.some((t) => t.lease.propertyId === 'apollo')).toBe(false)
  })

  it('puts every lot into rent collection, which is the point', () => {
    // Before this the park's households were the only tenants in the portfolio
    // with no charges, no due dates and no late fees.
    const charges = chargesForYear(k.properties.flatMap((p) => p.leases), 2026, {
      reportedMonths: rentRoll(2026).monthsReported, carryForward: true,
    })
    const records = payerRecordsFor(charges, [], asOf, DEFAULT_COLLECTION)
    expect(records).toHaveLength(87)
    expect(records.filter((r) => r.propertyId === 'apollo')).toHaveLength(37)
  })
})
