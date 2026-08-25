import { describe, expect, it } from 'vitest'
import { LEASES } from '../src/data/leases'
import { PROPERTIES } from '../src/data/properties'
import { APOLLO_TENANTS, APOLLO_WATER_CHARGE } from '../src/data/apollo'
import { collected, grossPotential, realisedEscalationPct, valueAtCap, walt } from '../src/lib/finance'
import { computeKpis, valuationModel } from '../src/lib/portfolio'

/**
 * These lock the transcription to the printed workbook. If a lease line is ever
 * edited, the property and portfolio assertions below fail loudly rather than
 * letting a wrong number reach the dashboard.
 */

const SHEET = {
  commercialGross: 2552449.32,
  commercialTaxes: 716224.68,
  apolloGross: 378870.0,
  apolloTaxes: 57077.58,
  totalGross: 2931319.32,
  totalNet: 2158017.06,
}

/** The one row where the workbook contradicts its own month cells. */
const KNOWN_SHEET_ERROR = 150.0

describe('lease transcription', () => {
  it('gives every lease exactly twelve months', () => {
    for (const l of LEASES) expect(l.months, l.id).toHaveLength(12)
  })

  it('matches each printed row total, except the one known source error', () => {
    for (const l of LEASES) {
      if (l.id === 'p2-sl-envios') continue
      expect(collected(l), l.id).toBeCloseTo(l.statedAnnualTotal, 2)
    }
  })

  it('reads SL Envios as $41,115 against a printed $40,965', () => {
    const sl = LEASES.find((l) => l.id === 'p2-sl-envios')!
    expect(collected(sl)).toBeCloseTo(41115, 2)
    expect(sl.statedAnnualTotal).toBeCloseTo(40965, 2)
    expect(collected(sl) - sl.statedAnnualTotal).toBeCloseTo(KNOWN_SHEET_ERROR, 2)
  })

  it('points every lease at a real property', () => {
    const ids = new Set(PROPERTIES.map((p) => p.id))
    for (const l of LEASES) expect(ids.has(l.propertyId), l.id).toBe(true)
  })

  it('keeps lease ids unique', () => {
    expect(new Set(LEASES.map((l) => l.id)).size).toBe(LEASES.length)
  })
})

describe('property totals', () => {
  it('sums each property to its printed gross', () => {
    for (const p of PROPERTIES) {
      if (p.id === 'apollo') continue
      const gross = LEASES.filter((l) => l.propertyId === p.id).reduce((a, l) => a + l.statedAnnualTotal, 0)
      expect(gross, p.id).toBeCloseTo(p.statedGross, 2)
    }
  })

  it('reproduces each printed net after tax', () => {
    for (const p of PROPERTIES) {
      expect(p.statedGross - p.taxBill, p.id).toBeCloseTo(p.statedNetAfterTax, 2)
    }
  })
})

describe('portfolio reconciliation', () => {
  const k = computeKpis(new Date('2026-08-25T00:00:00'))

  it('ties commercial taxes to the workbook exactly', () => {
    expect(k.commercialTaxes).toBeCloseTo(SHEET.commercialTaxes, 2)
  })

  it('ties Apollo to the workbook exactly', () => {
    expect(k.apolloGross).toBeCloseTo(SHEET.apolloGross, 2)
    expect(k.apolloTaxes).toBeCloseTo(SHEET.apolloTaxes, 2)
  })

  it('exceeds the printed gross by exactly the known source error', () => {
    expect(k.commercialGross - SHEET.commercialGross).toBeCloseTo(KNOWN_SHEET_ERROR, 2)
    expect(k.grossCollected - SHEET.totalGross).toBeCloseTo(KNOWN_SHEET_ERROR, 2)
    expect(k.netAfterTax - SHEET.totalNet).toBeCloseTo(KNOWN_SHEET_ERROR, 2)
  })

  it('never reports collected above potential', () => {
    expect(k.grossCollected).toBeLessThanOrEqual(k.grossPotential + 0.01)
    expect(k.economicOccupancyPct).toBeLessThanOrEqual(100.0001)
  })

  it('accounts for every dark month in the loss figures', () => {
    const darkTotal = k.vacancyLoss + k.concessionLoss
    expect(darkTotal).toBeGreaterThan(0)
    expect(k.grossCollected + darkTotal).toBeCloseTo(k.grossPotential, 2)
  })
})

describe('escalations', () => {
  it('measures the realised bump from first to last collecting month', () => {
    const michoacana = LEASES.find((l) => l.id === 'p1-michoacana')!
    expect(realisedEscalationPct(michoacana)).toBeCloseTo(5.0, 1)
  })

  it('reports Washland as a decrease, not a bump', () => {
    const washland = LEASES.find((l) => l.id === 'p2-washland')!
    expect(realisedEscalationPct(washland)).toBeLessThan(0)
  })

  it('flags a flat year against a contracted bump', () => {
    const k = computeKpis(new Date('2026-08-25T00:00:00'))
    const evas = k.bumpsNotTaken.find((b) => b.lease.id === 'mp-evas-cafe')
    expect(evas).toBeDefined()
    expect(evas!.realisedPct).toBeCloseTo(0, 2)
  })
})

describe('vacancy handling', () => {
  it('values FC Salon Suites downtime at the imputed rate', () => {
    const fc = LEASES.find((l) => l.id === 'wp-fc-salon')!
    expect(collected(fc)).toBeCloseTo(24135, 2)
    expect(grossPotential(fc)).toBeGreaterThan(collected(fc))
  })

  it('treats a never-let unit as fully vacant', () => {
    const unstoppable = LEASES.find((l) => l.id === 'p1-unstoppable')!
    expect(collected(unstoppable)).toBe(0)
  })
})

describe('lease term', () => {
  it('scores an expired lease as zero remaining term', () => {
    const asOf = new Date('2026-08-25T00:00:00')
    const k = computeKpis(asOf)
    expect(k.walt).toBeLessThanOrEqual(k.waltActiveOnly)
    expect(k.expiredLeases.length).toBeGreaterThan(0)
  })

  it('returns zero WALT for an empty set', () => {
    expect(walt([])).toBe(0)
  })
})

describe('Apollo', () => {
  it('bills 37 lots plus two parking spaces', () => {
    const paying = APOLLO_TENANTS.filter((t) => !t.isParking)
    expect(paying).toHaveLength(37)
    expect(APOLLO_TENANTS.filter((t) => t.isParking)).toHaveLength(2)
  })

  it('sums the July 2026 registry to $32,600 a month', () => {
    const total = APOLLO_TENANTS.reduce((a, t) => a + t.amountDue, 0)
    expect(total).toBe(32600)
  })

  it('separates the water charge from base rent', () => {
    const k = computeKpis()
    expect(k.apolloWaterRevenueMonthly).toBe(37 * APOLLO_WATER_CHARGE)
    expect(k.apolloBaseRentMonthly + k.apolloWaterRevenueMonthly).toBeCloseTo(k.apolloMonthlyBilled, 2)
  })
})

describe('valuation', () => {
  it('capitalises NOI at the given rate', () => {
    expect(valueAtCap(100000, 8)).toBeCloseTo(1250000, 2)
  })

  it('returns zero rather than infinity at a zero cap rate', () => {
    expect(valueAtCap(100000, 0)).toBe(0)
  })

  it('values true NOI below the sheet net, since the sheet omits opex', () => {
    const k = computeKpis()
    const v = valuationModel(k, 8, 12)
    expect(v.trueNoi).toBeLessThan(k.netAfterTax)
    expect(v.valueOnTrueNoi).toBeLessThan(v.valueOnSheetNet)
  })
})
