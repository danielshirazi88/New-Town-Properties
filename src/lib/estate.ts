/**
 * The whole estate in one place: what it earns and what it is worth.
 *
 * Every other module here answers a narrower question — what the rent roll
 * billed, what the deposits pay, what the trust holds. This one puts them
 * together, because "what does he actually make" is not a question about rent.
 *
 * Three rules keep the total honest:
 *
 *  - **Annualise before adding.** A part-year rent roll holds eight months of
 *    income against a full year's tax bills. Interest is already a yearly rate.
 *    Adding one to the other unscaled understates the property side by a third.
 *  - **Never count a thing twice.** The West Plaza seller note is a row on the
 *    rent roll, so it arrives inside the property figure and must not be added
 *    again from the trust schedule.
 *  - **Say what is not in here.** This is income before income tax, before debt
 *    service and before anything personal. It is what the assets throw off, not
 *    what lands in a current account.
 */

import type { AssetRegister } from './assets'
import { registerInterest, vehicleValue } from './assets'
import type { ResolvedHolding } from './trust'

export interface IncomeSource {
  id: 'property' | 'investment'
  label: string
  /** Net for the year, after the costs that belong to that source. */
  net: number
  note: string
}

export interface EstateIncome {
  /** Gross rent for a full year, including the seller note on the rent roll. */
  propertyGross: number
  propertyTaxes: number
  propertyOpex: number
  propertyNet: number
  /** Interest at the stated rates. A fund with no rate contributes nothing. */
  investmentIncome: number
  /** Everything, before income tax and before anything personal. */
  totalNet: number
  monthlyNet: number
  sources: IncomeSource[]
  /** Months of the rent roll the figures were scaled up from. */
  monthsReported: number
  annualised: boolean
}

/**
 * What the estate earns in a year.
 *
 * `opexLoadPct` is the allowance for the operating costs the rent roll never
 * captured — insurance, water, maintenance, management. The source sheets
 * subtract property tax and nothing else, so without it "net" is not net.
 */
export function estateIncome(
  gross: number,
  taxes: number,
  register: AssetRegister,
  opexLoadPct: number,
  monthsReported = 12,
): EstateIncome {
  const months = monthsReported > 0 && monthsReported < 12 ? monthsReported : 12
  const propertyGross = (gross / months) * 12
  const propertyOpex = propertyGross * (opexLoadPct / 100)
  const propertyNet = propertyGross - taxes - propertyOpex
  const investmentIncome = registerInterest(register)
  const totalNet = propertyNet + investmentIncome

  return {
    propertyGross,
    propertyTaxes: taxes,
    propertyOpex,
    propertyNet,
    investmentIncome,
    totalNet,
    monthlyNet: totalNet / 12,
    sources: [
      {
        id: 'property',
        label: 'Property',
        net: propertyNet,
        note: 'Rent after property tax and an operating allowance',
      },
      {
        id: 'investment',
        label: 'Investments',
        net: investmentIncome,
        note: 'Interest on deposits at their stated rates',
      },
    ].filter((s) => s.net !== 0) as IncomeSource[],
    monthsReported: months,
    annualised: months < 12,
  }
}

export interface EstateValue {
  /** Buildings that pay rent. */
  rentalRealEstate: number
  /** Residences and anything held but not let. */
  personalRealEstate: number
  /** Held for resale — carried at cost until someone values it. */
  resaleRealEstate: number
  /** Seller-financed notes: a receivable, not a building. */
  notesReceivable: number
  deposits: number
  vehicles: number
  gross: number
  debt: number
  net: number
  /** Holdings carrying no value from any source, counted as zero. */
  unvalued: number
}

/**
 * What the estate is worth.
 *
 * Real estate comes from the trust's schedule rather than from the rent roll,
 * because the schedule is the list of what is owned — it includes the two
 * residences and the condo held for resale, which pay no rent and would
 * otherwise be missing from a net-worth figure entirely.
 */
export function estateValue(holdings: ResolvedHolding[], register: AssetRegister): EstateValue {
  let rentalRealEstate = 0
  let personalRealEstate = 0
  let resaleRealEstate = 0
  let notesReceivable = 0
  let debt = 0
  let unvalued = 0

  for (const h of holdings) {
    if (h.estimatedValue === undefined) unvalued += 1
    const v = h.estimatedValue ?? 0
    debt += h.debt ?? 0
    if (h.use === 'note') notesReceivable += v
    else if (h.use === 'personal') personalRealEstate += v
    // A holding kept for resale has no value until one is entered; falling back
    // to its purchase price is the closest honest figure.
    else if (h.use === 'resale') resaleRealEstate += h.estimatedValue ?? h.purchasePrice ?? 0
    else rentalRealEstate += v
  }

  const deposits = register.investments.reduce((a, i) => a + i.balance, 0)
  const vehicles = register.vehicles.reduce((a, v) => a + vehicleValue(v), 0)
  const gross = rentalRealEstate + personalRealEstate + resaleRealEstate
    + notesReceivable + deposits + vehicles

  return {
    rentalRealEstate,
    personalRealEstate,
    resaleRealEstate,
    notesReceivable,
    deposits,
    vehicles,
    gross,
    debt,
    net: gross - debt,
    unvalued,
  }
}

/** What each part contributes, largest first, for a breakdown chart. */
export const valueSlices = (v: EstateValue): { id: string; label: string; value: number }[] =>
  [
    { id: 'rental', label: 'Rental property', value: v.rentalRealEstate },
    { id: 'deposits', label: 'Bank deposits', value: v.deposits },
    { id: 'personal', label: 'Personal property', value: v.personalRealEstate },
    { id: 'resale', label: 'Held for resale', value: v.resaleRealEstate },
    { id: 'notes', label: 'Notes receivable', value: v.notesReceivable },
    { id: 'vehicles', label: 'Vehicles', value: v.vehicles },
  ].filter((s) => s.value > 0).sort((a, b) => b.value - a.value)
