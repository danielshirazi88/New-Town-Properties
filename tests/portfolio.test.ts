import { describe, expect, it } from 'vitest'
import { LEASES } from '../src/data/leases'
import { PROPERTIES } from '../src/data/properties'
import { APOLLO_TENANTS, APOLLO_WATER_CHARGE } from '../src/data/apollo'
import { collected, grossPotential, realisedEscalationPct, rentPerSqFt, valueAtCap, walt } from '../src/lib/finance'
import { computeKpis, resolveData, valuationModel } from '../src/lib/portfolio'
import { AVAILABLE_YEARS, CURRENT_YEAR, LATEST_YEAR, isPartYear, rentRoll, yearLabel } from '../src/data/rentRolls'

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
  const k = computeKpis(new Date('2026-08-25T00:00:00'), resolveData(undefined, 2025))

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
    const k = computeKpis(new Date('2026-08-25T00:00:00'), resolveData(undefined, 2025))
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
  it('bills 37 dwelling lots plus five parking spaces', () => {
    expect(APOLLO_TENANTS.filter((t) => !t.isParking)).toHaveLength(37)
    expect(APOLLO_TENANTS.filter((t) => t.isParking)).toHaveLength(5)
  })

  it('sums the July 2026 lot registry to $32,600 a month', () => {
    const lots = APOLLO_TENANTS.filter((t) => !t.isParking).reduce((a, t) => a + t.amountDue, 0)
    expect(lots).toBe(32600)
  })

  it('bills parking at $100 a space, $500 a month in total', () => {
    const parking = APOLLO_TENANTS.filter((t) => t.isParking)
    for (const space of parking) expect(space.amountDue).toBe(100)
    const k = computeKpis(undefined, resolveData(undefined, 2025))
    expect(k.apolloParkingMonthly).toBe(500)
    expect(k.apolloMonthlyBilled).toBe(33100)
    expect(k.apolloAnnualisedCurrent).toBe(397200)
  })

  it('charges water on dwelling lots only, never on parking', () => {
    const k = computeKpis(undefined, resolveData(undefined, 2025))
    expect(k.apolloWaterRevenueMonthly).toBe(37 * APOLLO_WATER_CHARGE)
    // Base + water reconstructs the LOT bill; parking sits outside both.
    expect(k.apolloBaseRentMonthly + k.apolloWaterRevenueMonthly).toBeCloseTo(k.apolloLotMonthly, 2)
    expect(k.apolloLotMonthly + k.apolloParkingMonthly).toBeCloseTo(k.apolloMonthlyBilled, 2)
  })

  it('keeps parking out of the lot averages', () => {
    const k = computeKpis(undefined, resolveData(undefined, 2025))
    // A $100 space must not become "the cheapest lot".
    expect(k.apolloMinLotRent).toBe(650)
    expect(k.apolloMaxLotRent).toBe(1320)
    expect(k.apolloAvgLotRent).toBeCloseTo(32600 / 37, 2)
  })
})

describe('confirmed by the owner', () => {
  it('classifies every lease, modified gross except Mannheim Plaza', () => {
    const k = computeKpis(undefined, resolveData(undefined, 2025))
    expect(k.leaseTypeCounts.UNKNOWN ?? 0).toBe(0)
    expect(k.leaseTypeCounts.NNN).toBe(4)
    expect(k.leaseTypeCounts.MG).toBe(LEASES.length - 4)
  })

  it('puts triple net on Mannheim Plaza and nowhere else', () => {
    for (const l of LEASES) {
      expect(l.leaseType, `${l.tenant} (${l.propertyId})`)
        .toBe(l.propertyId === 'mannheim-plaza' ? 'NNN' : 'MG')
    }
  })

  it('marks four Apollo homes as park-owned', () => {
    const owned = APOLLO_TENANTS.filter((t) => t.parkOwned)
    expect(owned).toHaveLength(4)
    expect(owned.map((t) => t.name.split(',')[0]).sort())
      .toEqual(['Gomez', 'Gonzalez', 'Jimenez', 'Mejia'])
    // Park-owned status attaches to homes, never to a parking space.
    for (const t of APOLLO_TENANTS.filter((x) => x.isParking)) expect(t.parkOwned).toBe(false)
  })

  it('puts all five parking spaces on the two named lots', () => {
    const parking = APOLLO_TENANTS.filter((t) => t.isParking)
    expect(parking).toHaveLength(5)
    for (const p of parking) expect(p.address).toMatch(/42(11|09) Apollo Lane/)
  })

  it('carries the vacant Chicago unit as a cost, not as income', () => {
    const k = computeKpis(undefined, resolveData(undefined, 2025))
    const prairie = k.properties.find((p) => p.property.id === 'prairie-1211')!
    expect(prairie.collected).toBe(0)
    expect(prairie.taxBill).toBe(15080)
    expect(prairie.netAfterTax).toBe(-15080)
    // Vacant and off the rent roll, so it must not disturb the reconciliation.
    expect(prairie.property.onRentRoll).toBe(false)
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
    const k = computeKpis(undefined, resolveData(undefined, 2025))
    const v = valuationModel(k, 8, 12)
    expect(v.trueNoi).toBeLessThan(k.netAfterTax)
    expect(v.valueOnTrueNoi).toBeLessThan(v.valueOnSheetNet)
  })
})


describe('multi-year rent rolls', () => {
  it('loads every registered year', () => {
    expect(AVAILABLE_YEARS).toContain(2024)
    expect(AVAILABLE_YEARS).toContain(2025)
  })

  it('gives every lease in every year exactly twelve months', () => {
    for (const y of AVAILABLE_YEARS) {
      for (const l of rentRoll(y).leases) expect(l.months, `${y} ${l.id}`).toHaveLength(12)
    }
  })

  it('reconciles each year to its own printed totals', () => {
    for (const y of AVAILABLE_YEARS) {
      const roll = rentRoll(y)
      // A part-year sheet prints no totals, so there is nothing to reconcile.
      if (!roll.hasControlTotals) continue
      const gross = roll.leases.reduce((a, l) => a + l.statedAnnualTotal, 0)
      expect(gross, `${y} commercial gross`).toBeCloseTo(roll.statedTotals.commercialGross, 2)

      const taxes = Object.entries(roll.tax)
        .filter(([id]) => id !== 'apollo' && id !== 'prairie-1211')
        .reduce((a, [, v]) => a + v.bill, 0)
      expect(taxes, `${y} commercial taxes`).toBeCloseTo(roll.statedTotals.commercialTaxes, 2)

      expect(gross + roll.apolloGross, `${y} total gross`).toBeCloseTo(roll.statedTotals.totalGross, 2)
    }
  })

  it('matches month cells to row totals except the documented variances', () => {
    for (const y of AVAILABLE_YEARS) {
      const roll = rentRoll(y)
      const known = new Set(roll.variances.map((v) => v.leaseId))
      for (const l of roll.leases) {
        if (known.has(l.id)) continue
        const sum = l.months.reduce<number>((a, mth) => a + (typeof mth === 'number' ? mth : 0), 0)
        expect(sum, `${y} ${l.id}`).toBeCloseTo(l.statedAnnualTotal, 2)
      }
    }
  })

  it('carries the $175 error the 2024 workbook makes on Genuine Automotive Detailing', () => {
    const v = rentRoll(2024).variances.find((x) => x.leaseId === 'a25-genuine-detailing')!
    expect(v.stated - v.computed).toBeCloseTo(175, 2)
  })

  it('applies each year its own tax bills', () => {
    const a = computeKpis(undefined, resolveData(undefined, 2024))
    const b = computeKpis(undefined, resolveData(undefined, 2025))
    // 2024 income is taxed on the 2023 bills, 2025 on the 2024 bills.
    expect(a.properties.find((p) => p.property.id === 'plaza-1')!.taxBill).toBeCloseTo(164360.68, 2)
    expect(b.properties.find((p) => p.property.id === 'plaza-1')!.taxBill).toBeCloseTo(168992.55, 2)
    expect(a.totalTaxes).toBeLessThan(b.totalTaxes)
  })

  it('shows the portfolio growing 2024 to 2025', () => {
    const a = computeKpis(undefined, resolveData(undefined, 2024))
    const b = computeKpis(undefined, resolveData(undefined, 2025))
    expect(b.grossCollected).toBeGreaterThan(a.grossCollected)
  })

  it('reports Mannheim Plaza rising 8%, not 26%', () => {
    const a = computeKpis(undefined, resolveData(undefined, 2024))
    const b = computeKpis(undefined, resolveData(undefined, 2025))
    const was = a.properties.find((p) => p.property.id === 'mannheim-plaza')!.collected
    const now = b.properties.find((p) => p.property.id === 'mannheim-plaza')!.collected
    expect(was).toBeCloseTo(349822.37, 2)
    expect(now).toBeCloseTo(377925.32, 2)
    expect(((now - was) / was) * 100).toBeCloseTo(8.0, 1)
  })

  it("catches Eva's Café bump, which is invisible inside a single year", () => {
    const before = rentRoll(2024).leases.find((l) => l.id === 'mp-evas-cafe')!
    const after = rentRoll(2025).leases.find((l) => l.id === 'mp-evas-cafe')!
    // Flat within each year — its anniversary is 1 January.
    expect(new Set(before.months).size).toBe(1)
    expect(new Set(after.months).size).toBe(1)
    // But the rate did rise between the years.
    expect(after.months[0]).toBeGreaterThan(before.months[0] as number)
  })
})


describe('2026 rent roll', () => {
  const k = computeKpis(undefined, resolveData(undefined, 2026))

  it('is a part-year sheet covering January to August', () => {
    expect(rentRoll(2026).monthsReported).toBe(8)
    expect(rentRoll(2026).hasControlTotals).toBe(false)
  })

  it('does not mistake unreported months for vacancy', () => {
    const lease = rentRoll(2026).leases.find((l) => l.id === 'p1-michoacana')!
    // Four months the sheet simply does not cover.
    expect(lease.months.filter((m) => m === 'NR')).toHaveLength(4)
    // ...and none of them count as lost rent.
    expect(lease.months.filter((m) => m === 'V')).toHaveLength(0)
  })

  it('keeps West Plaza in 2026 and drops it afterwards', () => {
    expect(k.properties.some((p) => p.property.id === 'west-plaza')).toBe(true)
    expect(resolveData(undefined, 2027).properties.some((p) => p.id === 'west-plaza')).toBe(false)
  })

  it('treats the seller-financing payment as a note, not rent', () => {
    const note = rentRoll(2026).leases.find((l) => l.id === 'wp-castaldo-note')!
    expect(note.incomeType).toBe('note')
    // A note has no floor area, so it must never produce a rent per square foot.
    expect(rentPerSqFt(note)).toBeUndefined()
  })

  it('records square footage and computes a rate from it', () => {
    expect(k.totalSquareFeet).toBeGreaterThan(80_000)
    expect(k.rentPerSqFt).toBeGreaterThan(0)
    expect(k.leasedSquareFeet + k.vacantSquareFeet).toBe(k.totalSquareFeet)
  })

  it('excludes billboard, parking and note income from the rate', () => {
    for (const id of ['pp1538-lamar', 'n43-garage', 'wp-castaldo-note']) {
      const l = rentRoll(2026).leases.find((x) => x.id === id)!
      expect(rentPerSqFt(l), id).toBeUndefined()
    }
  })

  it('counts the newly listed empty units at Plaza #1', () => {
    const empties = rentRoll(2026).leases.filter(
      (l) => l.propertyId === 'plaza-1' && l.squareFeet && collected(l) === 0,
    )
    // 2F apartment, RW warehouse, R1 and R2.
    expect(empties).toHaveLength(4)
    expect(empties.reduce((a, l) => a + (l.squareFeet ?? 0), 0)).toBe(4170)
  })

  it('finally lets unit 2B, empty in both prior years', () => {
    expect(collected(rentRoll(2024).leases.find((l) => l.id === 'p1-unstoppable')!)).toBe(0)
    expect(collected(rentRoll(2025).leases.find((l) => l.id === 'p1-unstoppable')!)).toBe(0)
    expect(collected(rentRoll(2026).leases.find((l) => l.id === 'p1-unstoppable')!)).toBeGreaterThan(0)
  })
})


describe('the default year', () => {
  it('opens on the most recent complete year, not a part year', () => {
    expect(CURRENT_YEAR).toBe(2025)
    expect(LATEST_YEAR).toBe(2026)
    expect(isPartYear(CURRENT_YEAR)).toBe(false)
    expect(isPartYear(LATEST_YEAR)).toBe(true)
  })

  it('labels a part year so it cannot be read as a full one', () => {
    expect(yearLabel(2025)).toBe('2025')
    expect(yearLabel(2026)).toContain('through August')
  })
})
