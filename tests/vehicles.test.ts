import { describe, expect, it } from 'vitest'
import { SEEDED_VEHICLES, VEHICLE_TOTALS } from '../src/data/vehicles'
import {
  EMPTY_REGISTER, applySeed, assetTotals, milesDriven, odometerContradicts,
  vehicleDepreciation, vehicleValue, vehicleValued, type AssetRegister,
} from '../src/lib/assets'
import { SEEDED_INVESTMENTS } from '../src/data/investments'
import { estateValue } from '../src/lib/estate'
import { resolveTrust } from '../src/lib/trust'
import { TRUST_HOLDINGS } from '../src/data/trust'

/**
 * The "Autos Owned" schedule. It prints both totals, so the transcription can be
 * checked against the document rather than only against itself.
 */
describe('the cars', () => {
  it('has all eleven, each with its own id', () => {
    expect(SEEDED_VEHICLES).toHaveLength(11)
    expect(new Set(SEEDED_VEHICLES.map((v) => v.id)).size).toBe(11)
  })

  it('ties to both printed totals', () => {
    expect(SEEDED_VEHICLES.reduce((a, v) => a + (v.purchasePrice ?? 0), 0))
      .toBeCloseTo(VEHICLE_TOTALS.purchase, 2)
    expect(SEEDED_VEHICLES.reduce((a, v) => a + vehicleValue(v), 0))
      .toBe(VEHICLE_TOTALS.currentValue)
    expect(VEHICLE_TOTALS.purchase).toBeCloseTo(918_759.71, 2)
    expect(VEHICLE_TOTALS.currentValue).toBe(659_000)
  })

  it('values every one of them, so none is silently excluded', () => {
    for (const v of SEEDED_VEHICLES) expect(vehicleValued(v), v.name).toBe(true)
  })

  it('records the VIN where the schedule gives one, and says so where it does not', () => {
    const noVin = SEEDED_VEHICLES.filter((v) => !v.vin)
    expect(noVin.map((v) => v.name)).toEqual(['2020 Land Rover Range Rover Sport SVR'])
    for (const v of SEEDED_VEHICLES) {
      if (v.vin) expect(v.vin.length, v.name).toBe(17)
    }
  })

  it('refuses to invent mileage for the car whose odometer runs backwards', () => {
    // The Tacoma reads 179,187 at purchase and 115,582 now. A car does not
    // un-drive 63,605 miles, and returning a negative would bury it in a total.
    const tacoma = SEEDED_VEHICLES.find((v) => v.model?.startsWith('Tacoma'))!
    expect(tacoma.purchaseMiles).toBe(179_187)
    expect(tacoma.currentMiles).toBe(115_582)
    expect(odometerContradicts(tacoma)).toBe(true)
    expect(milesDriven(tacoma)).toBeUndefined()
  })

  it('computes miles driven everywhere the readings agree', () => {
    const sound = SEEDED_VEHICLES.filter((v) => !odometerContradicts(v))
    expect(sound).toHaveLength(10)
    for (const v of sound) expect(milesDriven(v), v.name).toBeGreaterThanOrEqual(0)
    const urus = SEEDED_VEHICLES.find((v) => v.model === 'Urus')!
    expect(milesDriven(urus)).toBe(1_459)
  })

  it('shows what the fleet has lost against what was paid', () => {
    const lost = VEHICLE_TOTALS.currentValue - VEHICLE_TOTALS.purchase
    expect(Math.round(lost)).toBe(-259_760)
    const urus = SEEDED_VEHICLES.find((v) => v.model === 'Urus')!
    expect(vehicleDepreciation(urus)).toBeCloseTo(-26_242, 2)
    // Nearly half of what is left sits in that one car.
    expect(vehicleValue(urus) / VEHICLE_TOTALS.currentValue).toBeGreaterThan(0.45)
  })

  it('says nothing about a car with no figures either way', () => {
    expect(vehicleDepreciation({ id: 'x', kind: 'vehicle', name: 'X' })).toBeUndefined()
    expect(milesDriven({ id: 'x', kind: 'vehicle', name: 'X' })).toBeUndefined()
    expect(odometerContradicts({ id: 'x', kind: 'vehicle', name: 'X' })).toBe(false)
  })
})

describe('the cars in the estate', () => {
  const register = applySeed(EMPTY_REGISTER, SEEDED_INVESTMENTS, 4, SEEDED_VEHICLES)

  it('seeds the accounts and the cars together, once', () => {
    expect(register.vehicles).toHaveLength(11)
    expect(register.investments).toHaveLength(12)
    expect(register.seedVersion).toBe(4)
    // Already at the version: nothing runs again, so a car deleted stays deleted.
    const pruned: AssetRegister = { ...register, vehicles: register.vehicles.slice(1) }
    expect(applySeed(pruned, SEEDED_INVESTMENTS, 4, SEEDED_VEHICLES).vehicles).toHaveLength(10)
  })

  it('adds them to what the estate is worth', () => {
    const worth = estateValue(resolveTrust(TRUST_HOLDINGS), register)
    expect(worth.vehicles).toBe(659_000)
    const totals = assetTotals(register, { rental: 0, personal: 0, notes: 0, debt: 0, unvalued: 0 })
    expect(totals.vehicles).toBe(659_000)
    expect(totals.unvaluedVehicles).toBe(0)
  })
})
