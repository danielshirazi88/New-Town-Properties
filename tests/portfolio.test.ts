import { describe, expect, it } from 'vitest'
import { LEASES } from '../src/data/leases'
import { PROPERTIES } from '../src/data/properties'
import { APOLLO_TENANTS, APOLLO_WATER_CHARGE } from '../src/data/apollo'
import { cellAmount, collected, concessionLoss, concessionSummary, firstRate, grossPotential, isDark, lastRate, realisedEscalationPct, rentPerSqFt, vacancyLoss, valueAtCap, walt } from '../src/lib/finance'
import { computeKpis, resolveData, valuationModel } from '../src/lib/portfolio'
import { AVAILABLE_YEARS, CURRENT_YEAR, LATEST_YEAR, isPartYear, rentRoll, unitKey, yearLabel } from '../src/data/rentRolls'
import { RETURN_2023, RETURN_2024 } from '../src/data/taxReturns'
import { appraisalsByProperty, impliedCapRate } from '../src/lib/trust'
import { TRUST_HOLDINGS } from '../src/data/trust'

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
  it('opens on the current calendar year, so the month being collected is on screen', () => {
    const thisYear = new Date().getFullYear()
    expect(CURRENT_YEAR).toBe(AVAILABLE_YEARS.includes(thisYear) ? thisYear : LATEST_YEAR)
  })

  it('opens on a part year rather than a stale complete one', () => {
    // Deliberate: this is an operational tool, and rent is collected in the
    // current month. The part-year figures are labelled instead of avoided.
    expect(CURRENT_YEAR).toBe(2026)
    expect(isPartYear(CURRENT_YEAR)).toBe(true)
  })

  it('falls back to the newest sheet when the year turns before one arrives', () => {
    // There is no 2027 roll yet, so 2027 is not a candidate.
    expect(AVAILABLE_YEARS).not.toContain(2027)
    expect(LATEST_YEAR).toBe(2026)
  })

  it('labels a part year so it cannot be read as a full one', () => {
    expect(yearLabel(2025)).toBe('2025')
    expect(yearLabel(2026)).toContain('through August')
    expect(isPartYear(2025)).toBe(false)
  })
})

describe('square footage across years', () => {
  const leasesFor = (year: number) => resolveData(undefined, year).leases
  const unit = (year: number, propertyId: string, label: string) =>
    leasesFor(year).find((l) => l.propertyId === propertyId && l.unit === label)

  it('carries an area onto a year whose sheet does not state one', () => {
    // Only the 2026 sheet prints square footage; a suite does not change size.
    const l = unit(2025, 'mannheim-plaza', '1505 A&B')!
    expect(l.squareFeet).toBe(1980)
    expect(l.squareFeetFromYear).toBe(2026)
  })

  it('leaves the area untagged on the sheet that actually states it', () => {
    const l = unit(2026, 'mannheim-plaza', '1505 A&B')!
    expect(l.squareFeet).toBe(1980)
    expect(l.squareFeetFromYear).toBeUndefined()
  })

  it('follows a unit that was relabelled when the tenant changed', () => {
    // 1401 N 25th Ave labels each bay by its occupant: Autotech Garage became
    // Mechanic became Fast Cars Group, all one 2,000 sf unit.
    expect(unit(2024, 'ave-25-1401', 'Autotech Garage')!.squareFeet).toBe(2000)
    expect(unit(2025, 'ave-25-1401', 'Mechanic')!.squareFeet).toBe(2000)
    expect(unit(2026, 'ave-25-1401', 'Fast Cars Group')!.squareFeet).toBe(2000)

    expect(unit(2025, 'ave-25-1401', 'Body Shop')!.squareFeet).toBe(5900)
    expect(unit(2026, 'ave-25-1401', 'KGZ Collision')!.squareFeet).toBe(5900)
  })

  it('follows the Nu River condo from its unnamed early listing', () => {
    expect(unit(2025, 'florida', 'Florida')!.squareFeet).toBe(600)
  })

  it('refuses to split a merged unit rather than guessing', () => {
    // 1683 and 1685 became a single 1683–1685 line at 2,200 sf in 2026. Halving
    // that would be an invention, so both stay unmeasured.
    expect(unit(2025, 'plaza-2', '1683')!.squareFeet).toBeUndefined()
    expect(unit(2025, 'plaza-2', '1685')!.squareFeet).toBeUndefined()
    expect(unit(2026, 'plaza-2', '1683–1685')!.squareFeet).toBe(2200)
  })

  it('leaves West Plaza unmeasured, because no sheet states its areas', () => {
    const wp = leasesFor(2025).filter((l) => l.propertyId === 'west-plaza')
    expect(wp.length).toBeGreaterThan(0)
    expect(wp.every((l) => l.squareFeet === undefined)).toBe(true)
  })

  it('classifies the billboard and garage on every year, not just 2026', () => {
    for (const year of [2024, 2025, 2026]) {
      expect(unit(year, 'playpen-1538', '1538 Billboard')?.incomeType).toBe('billboard')
      expect(unit(year, 'n-43rd-1643', '1643 N 43rd Garage')?.incomeType).toBe('parking')
    }
  })

  it('does not change any income total by carrying areas', () => {
    // Area and classification are facts about the unit, not about the money.
    for (const year of [2024, 2025, 2026]) {
      const total = resolveData(undefined, year).leases
        .reduce((a, l) => a + l.statedAnnualTotal, 0)
      const source = rentRoll(year).leases.reduce((a, l) => a + l.statedAnnualTotal, 0)
      expect(total).toBeCloseTo(source, 2)
    }
  })
})

describe('rent per square foot outliers', () => {
  // The same median-based rule the data-integrity view applies.
  const outliers = (year: number) => {
    const rated = resolveData(undefined, year).leases
      .filter((l) => (l.incomeType ?? 'rent') === 'rent')
      .map((l) => ({ lease: l, psf: rentPerSqFt(l) }))
      .filter((r): r is { lease: (typeof r)['lease']; psf: number } => r.psf !== undefined && r.psf > 0)
    const sorted = rated.map((r) => r.psf).sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
    return { median, rows: rated.filter((r) => r.psf > median * 3 || r.psf < median / 3) }
  }

  it('flags Cilantro, whose 600 sq ft cannot support its rent', () => {
    const { rows, median } = outliers(2026)
    expect(median).toBeGreaterThan(20)
    expect(rows.map((r) => r.lease.tenant)).toContain('Cilantro')
  })

  it('does not flag the ordinary spread of the portfolio', () => {
    // A handful of genuine outliers is a signal; a long list would mean the rule
    // is miscalibrated and the screen would be ignored.
    expect(outliers(2026).rows.length).toBeLessThanOrEqual(3)
    expect(outliers(2025).rows.length).toBeLessThanOrEqual(3)
  })
})

describe('the filed 2023 return', () => {
  const r = RETURN_2023
  const sum = (k: keyof (typeof r.scheduleE)[number]) =>
    r.scheduleE.reduce((a, l) => a + (l[k] as number), 0)

  it('lists fifteen properties, lettered A to O', () => {
    expect(r.scheduleE).toHaveLength(15)
    expect(r.scheduleE.map((l) => l.letter).join('')).toBe('ABCDEFGHIJKLMNO')
  })

  it('reconciles rents less expenses to Schedule 1 line 5', () => {
    // The return prints no Schedule E subtotals, so this end-to-end tie is the
    // only check available — and it holds to the dollar.
    const net = sum('rents') - sum('totalExpenses')
    expect(net).toBe(690673)
    expect(r.federal.find((l) => l.line === '8')!.amount).toBe(net)
  })

  it('carries the rental net into total income alongside the other sources', () => {
    const f = (line: string) => r.federal.find((l) => l.line === line)!.amount
    expect(f('1z') + f('2b') + f('3b') + f('7') + f('8')).toBe(f('9'))
    expect(f('9')).toBe(938311)
  })

  it('arrives at taxable income after the standard and QBI deductions', () => {
    const f = (line: string) => r.federal.find((l) => l.line === line)!.amount
    expect(f('11') - f('12') - f('13')).toBe(f('15'))
  })

  it('owes the difference between the tax and what was paid in', () => {
    const f = (line: string) => r.federal.find((l) => l.line === line)!.amount
    expect(f('24') - f('33')).toBe(f('37'))
  })

  it('ties Schedule B to the interest line on the 1040', () => {
    const interest = r.interestByPayer.reduce((a, x) => a + x.amount, 0)
    expect(interest).toBe(214965)
    expect(r.federal.find((l) => l.line === '2b')!.amount).toBe(interest)
  })

  it('reports 1211 S Prairie as a residence with nothing deducted', () => {
    const k = r.scheduleE.find((l) => l.propertyId === 'prairie-1211')!
    expect(k.personalUseDays).toBe(365)
    expect(k.fairRentalDays).toBe(0)
    expect(k.rents).toBe(0)
    // Costs are listed on the return but line 20 is blank, so none was deducted.
    expect(k.totalExpenses).toBe(0)
    expect(k.taxes + k.insurance + k.depreciation).toBe(35959)
  })

  it('keeps the property that is on 2023 but not on 2024', () => {
    const lake = r.scheduleE.find((l) => l.address.startsWith('3913 W LAKE'))!
    expect(lake.rents).toBe(0)
    expect(RETURN_2024.scheduleE.some((l) => l.address.startsWith('3913 W LAKE'))).toBe(false)
  })

  it('shows rents falling between 2023 and 2024 as filed', () => {
    // Worth knowing before anyone reads the rent roll's growth as the whole story.
    expect(RETURN_2024.scheduleETotals.rents).toBeLessThan(RETURN_2023.scheduleETotals.rents)
  })
})

describe('a part year measured honestly', () => {
  it('measures growth to the last reported month, not to December', () => {
    // 2026 covers January to August. Running to December compares January
    // against a month the sheet does not cover and reports the whole portfolio
    // as down 100% — which is what it used to do.
    const k = computeKpis(new Date('2026-08-31T12:00:00'), resolveData(undefined, 2026))
    expect(k.reportedMonths).toBe(8)
    expect(k.janToDecGrowthPct).toBeGreaterThan(-50)
    expect(Math.abs(k.janToDecGrowthPct)).toBeLessThan(25)
  })

  it('still runs to December on a complete year', () => {
    const k = computeKpis(new Date('2026-08-31T12:00:00'), resolveData(undefined, 2025))
    expect(k.reportedMonths).toBe(12)
  })

  it('no longer reports the park as zero income on 2026', () => {
    // It used to read $0, which said "earned nothing" when it meant "not in the
    // document". The registry now fills it, flagged as a derivation.
    const k = computeKpis(undefined, resolveData(undefined, 2026))
    expect(k.apolloGross).toBeGreaterThan(200_000)
    expect(k.apolloBasis).toBe('derived')
  })
})

describe("Apollo's part-year income", () => {
  it('takes 2026 from the July 2026 registry, and says it is derived', () => {
    // The 2026 rent roll leaves the park out; the registry is itself a 2026
    // document, so it is the better source — but it is a derivation and the
    // app has to be able to say so.
    const roll = rentRoll(2026)
    expect(roll.apolloBasis).toBe('derived')
    expect(roll.apolloNote).toBeTruthy()
    // 37 lots and 5 parking spaces at the registry's rates, over eight months.
    expect(roll.apolloGross).toBe(33_100 * 8)
  })

  it('leaves the years whose sheets state a figure alone', () => {
    expect(rentRoll(2025).apolloBasis).toBe('printed')
    expect(rentRoll(2025).apolloGross).toBe(378_870)
    expect(rentRoll(2024).apolloBasis).toBe('printed')
  })

  it('spreads the park across the months its source covers, not across twelve', () => {
    // Dividing eight months of income by twelve would understate every month
    // that happened and credit the park with rent in months nobody has reported.
    const k = computeKpis(new Date('2026-08-31T12:00:00'), resolveData(undefined, 2026))
    const commercial = k.monthly
    expect(k.monthlyWithApollo[0] - commercial[0]).toBeCloseTo(33_100, 2)
    expect(k.monthlyWithApollo[7] - commercial[7]).toBeCloseTo(33_100, 2)
    // September onward is unreported for both.
    expect(k.monthlyWithApollo[8] - commercial[8]).toBe(0)
  })

  it('still divides a full year by twelve', () => {
    const k = computeKpis(new Date('2026-08-31T12:00:00'), resolveData(undefined, 2025))
    expect(k.monthlyWithApollo[11] - k.monthly[11]).toBeCloseTo(378_870 / 12, 2)
  })

  it('annualises the park in the forward run rate rather than adding a part year', () => {
    // Adding eight months of park income to twelve months of rent would drag the
    // run rate down by a third of Apollo.
    const k = computeKpis(new Date('2026-08-31T12:00:00'), resolveData(undefined, 2026))
    expect(k.forwardRunRate).toBeGreaterThan(33_100 * 12)
  })
})

describe('a property reported as one annual figure', () => {
  it('spreads Apollo across the months the sheet covers', () => {
    const k = computeKpis(new Date('2026-08-31T12:00:00'), resolveData(undefined, 2026))
    const apollo = k.properties.find((p) => p.property.id === 'apollo')!
    expect(apollo.monthly.slice(0, 8).every((m) => Math.abs(m - 33_100) < 1)).toBe(true)
    // Nothing in the months nobody has reported.
    expect(apollo.monthly.slice(8)).toEqual([0, 0, 0, 0])
    expect(apollo.collected).toBe(33_100 * 8)
  })

  it('still spreads a full year across twelve', () => {
    const k = computeKpis(new Date('2026-08-31T12:00:00'), resolveData(undefined, 2025))
    const apollo = k.properties.find((p) => p.property.id === 'apollo')!
    expect(apollo.monthly.every((m) => Math.abs(m - 378_870 / 12) < 1)).toBe(true)
  })

  it('makes the park visible on the dashboard grid rather than reading as zero', () => {
    // It used to show $0 for the year while the headline total included it.
    const k = computeKpis(new Date('2026-08-31T12:00:00'), resolveData(undefined, 2026))
    expect(k.properties.find((p) => p.property.id === 'apollo')!.collected).toBeGreaterThan(0)
  })
})

describe('comparing one year against the next', () => {
  // The same matching the Year over year screen does: by physical unit.
  const rows = (from: number, to: number) => {
    const key = (l: { propertyId: string; unit: string }) => unitKey(l.propertyId, l.unit)
    const prior = new Map(rentRoll(from).leases.map((l) => [key(l), l]))
    const now = new Map(rentRoll(to).leases.map((l) => [key(l), l]))
    return [...new Set([...prior.keys(), ...now.keys()])].map((id) => {
      const before = prior.get(id)
      const after = now.get(id)
      return {
        id,
        before,
        after,
        was: before ? collected(before) : 0,
        now: after ? collected(after) : 0,
      }
    })
  }

  it('follows a bay that was renamed rather than reporting it as gone', () => {
    // 1401 N 25th Ave names each bay after its occupant, so Autotech Garage
    // became Mechanic. Matching on the lease id read that as a $69,225 collapse
    // and a separate $41,225 arrival — one bay counted twice, in both directions.
    const bay = rows(2024, 2025).find((r) => r.before?.unit === 'Autotech Garage')!
    expect(bay.after?.unit).toBe('Mechanic')
    expect(bay.was).toBe(69_225)
    expect(bay.now).toBe(41_225)
    expect(bay.now - bay.was).toBe(-28_000)
  })

  it('no longer shows any unit falling to nothing at that address', () => {
    const gone = rows(2024, 2025).filter((r) => r.before && !r.after
      && r.before.propertyId === 'ave-25-1401')
    expect(gone).toEqual([])
  })

  it('does not call a vacancy ending a rent increase', () => {
    // The Body Shop's rent was $6,075 a month in both years. It was empty for ten
    // months of 2024, which is the whole of the $61,340 "gain".
    const shop = rows(2024, 2025).find((r) => r.before?.unit === 'Body Shop')!
    expect(shop.now - shop.was).toBe(61_340)
    // firstRate reads the first month that billed, skipping the vacancy — so
    // both years opened at the same rate and it never moved until November 2025.
    expect(firstRate(shop.before!)).toBe(6_075)
    expect(lastRate(shop.before!)).toBe(6_075)
    expect(firstRate(shop.after!)).toBe(6_075)
    expect(lastRate(shop.after!)).toBe(6_370)
    const paidMonths = (l: typeof shop.before) =>
      l!.months.filter((m) => !isDark(m) && cellAmount(m) > 0).length
    expect(paidMonths(shop.before)).toBe(2)
    expect(paidMonths(shop.after)).toBe(12)
  })

  it('keeps every unit matched on both sides where the sheets agree', () => {
    // A year-on-year comparison that silently drops units is worse than none.
    const all = rows(2024, 2025)
    const unmatched = all.filter((r) => !r.before || !r.after)
    // Only genuine arrivals and departures, not renames.
    expect(unmatched.every((r) => r.before?.propertyId !== 'ave-25-1401')).toBe(true)
  })
})

/**
 * The Body Shop took 1401 N 25th Avenue in October 2024 with the first month
 * free. All three sheets print a 2021 commencement, which cannot be right — the
 * unit billed nothing from January to September 2024 — and the free month was
 * transcribed as a vacancy, which made a deliberate concession look like
 * downtime nobody could let.
 */
describe('the Body Shop concession', () => {
  const shopIn = (year: number) =>
    rentRoll(year).leases.find((l) => l.id === 'a25-body-shop')!

  it('commences in October 2024 on every sheet, not 2021', () => {
    for (const year of [2024, 2025, 2026]) {
      expect(shopIn(year).leaseStart, String(year)).toBe('2024-10-01')
      expect(shopIn(year).leaseEnd, String(year)).toBe('2027-10-31')
    }
  })

  it('lands on the printed expiry: one free month plus thirty-six paid', () => {
    // The corroboration for the correction. October 2024 free, November 2024
    // through October 2027 paid — exactly the 31 October 2027 the sheets print.
    const start = new Date('2024-10-01T00:00:00Z')
    const end = new Date(start)
    end.setUTCMonth(end.getUTCMonth() + 1 + 36)
    end.setUTCDate(0)
    expect(end.toISOString().slice(0, 10)).toBe('2027-10-31')
  })

  it('counts October 2024 as free rent, not as a vacant month', () => {
    const shop = shopIn(2024)
    expect(shop.months[9]).toBe('FREE')
    expect(shop.months.filter((m) => m === 'V')).toHaveLength(9)
    expect(concessionLoss(shop)).toBe(6_075)
    expect(vacancyLoss(shop)).toBe(9 * 6_075)
    // Both are worth nothing collected, so the printed row total is untouched.
    expect(collected(shop)).toBe(12_150)
    expect(shop.statedAnnualTotal).toBe(12_150)
  })

  it('still says "1 month free" in years with no free cell left to read', () => {
    // 2025 and 2026 collect every month. Counting FREE cells would report no
    // concession at all, which is how the opening month got lost the first time.
    for (const year of [2024, 2025, 2026]) {
      const c = concessionSummary(shopIn(year))!
      expect(c, String(year)).toBeDefined()
      expect(c.months).toBe(1)
      expect(c.label).toBe('1 month free')
      expect(c.periodLabel).toBe('October 2024')
    }
    expect(concessionSummary(shopIn(2024))!.lossThisYear).toBe(6_075)
    expect(concessionSummary(shopIn(2025))!.lossThisYear).toBe(0)
    expect(concessionSummary(shopIn(2026))!.lossThisYear).toBe(0)
  })

  it('leaves every other lease without a concession', () => {
    // A concession invented by a bad edit would quietly reduce vacancy loss.
    for (const year of AVAILABLE_YEARS) {
      for (const l of rentRoll(year).leases) {
        if (l.id === 'a25-body-shop') continue
        const c = concessionSummary(l)
        if (c) expect(c.monthsThisYear, `${year} ${l.id}`).toBeGreaterThan(0)
      }
    }
  })
})

/**
 * A cap rate is a rate per year. The 2026 sheet holds eight months of income and
 * the full year's tax bill, so reading an implied rate off it without scaling
 * prices every building as though it earned two-thirds of what it does.
 */
describe('appraisals against a part year', () => {
  it('annualises the income before implying a rate from a price', () => {
    const k = computeKpis(undefined, resolveData(undefined, 2026))
    const months = rentRoll(2026).monthsReported
    expect(months).toBeLessThan(12)

    const p = k.properties.find((x) => x.property.id === 'mannheim-1500')!
    const price = 1_380_000
    const raw = impliedCapRate(p.collected - p.taxBill, price)!
    const annual = impliedCapRate(((p.collected / months) * 12) - p.taxBill, price)!

    // The unscaled reading is materially lower — the trap this guards against.
    expect(annual).toBeGreaterThan(raw)
    expect(annual / raw).toBeGreaterThan(1.4)
  })

  it('leaves a full year alone', () => {
    const k = computeKpis(undefined, resolveData(undefined, 2025))
    expect(rentRoll(2025).monthsReported).toBe(12)
    const p = k.properties.find((x) => x.property.id === 'mannheim-1500')!
    const noi = p.collected - p.taxBill
    expect(impliedCapRate(noi, 1_380_000)).toBeCloseTo((noi / 1_380_000) * 100, 6)
  })

  it('scales the whole valuation model to a full year', () => {
    const k = computeKpis(undefined, resolveData(undefined, 2026))
    const months = rentRoll(2026).monthsReported
    const part = valuationModel(k, 8, 12, months)
    const naive = valuationModel(k, 8, 12, 12)

    expect(part.annualised).toBe(true)
    expect(part.monthsReported).toBe(months)
    expect(part.annualGross).toBeCloseTo((k.grossCollected / months) * 12, 2)
    // Taxes are already a full year's bills, so they are not scaled — which is
    // why the NOI gap is wider than the income gap.
    expect(part.trueNoi).toBeGreaterThan(naive.trueNoi)
    expect(part.valueOnTrueNoi).toBeGreaterThan(naive.valueOnTrueNoi)
  })

  it('leaves a complete year exactly as it was', () => {
    const k = computeKpis(undefined, resolveData(undefined, 2025))
    const v = valuationModel(k, 8, 12, rentRoll(2025).monthsReported)
    expect(v.annualised).toBe(false)
    expect(v.annualGross).toBe(k.grossCollected)
    expect(v.trueNoi).toBeCloseTo(k.grossCollected - k.totalTaxes - k.grossCollected * 0.12, 6)
  })

  it('has an appraisal for every property that earns, bar the one that sold', () => {
    // A property missing from the map is a blank column on the valuation screen.
    const m = appraisalsByProperty(TRUST_HOLDINGS)
    const earning = computeKpis(undefined, resolveData(undefined, 2026)).properties.filter((p) => p.collected > 0)
    const without = earning.filter((p) => !m.has(p.property.id)).map((p) => p.property.id)
    expect(without).toEqual(['west-plaza'])
  })
})
