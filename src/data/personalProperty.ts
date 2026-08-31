import type { AssetRegister, RealEstateAsset } from '../lib/assets'

/**
 * Personal real estate — property held rather than let.
 *
 * These do not come from a rent roll, because by definition they earn no rent.
 * Each is here because a filed return names it, so the address is the one the
 * IRS has rather than one typed from memory.
 *
 * Values are deliberately absent. Nothing here has an appraisal behind it, and a
 * guess would flow straight into a net-worth total — the register counts an
 * unvalued row as zero and says so, which is the honest treatment until someone
 * enters a real figure.
 */

/** A stable id per property, so the same one is never seeded twice. */
export const PERSONAL_PROPERTY_SEEDS: (Omit<RealEstateAsset, 'id'> & { seedId: string })[] = [
  {
    seedId: 'personal-129-foster',
    kind: 'real-estate',
    name: '129 E Foster Ave',
    address: '129 E Foster Ave, Roselle, IL 60172',
    use: 'personal',
    notes: 'The address on the 2023 federal return. No value recorded — needs one to count '
      + 'toward the asset total.',
  },
  {
    seedId: 'personal-1211-prairie',
    kind: 'real-estate',
    name: '1211 S Prairie, Unit 2605',
    address: '1211 S Prairie Ave Unit 2605, Chicago, IL 60605',
    use: 'personal',
    // It sits on Schedule E, but as a residence: 365 personal-use days, no fair
    // rental days, and no expenses deducted. It belongs here, not with the rentals.
    notes: 'On the 2023 Schedule E as a single-family residence — 365 personal-use days and no '
      + 'fair-rental days, so none of its costs were deducted. Held, not let.',
  },
]

/**
 * Seeded rows carry the seed id so they can be recognised later.
 *
 * Without it, a property the owner deliberately deleted would come back the next
 * time the register offered to add what was missing.
 */
export const seedRealEstate = (seed: (typeof PERSONAL_PROPERTY_SEEDS)[number]): RealEstateAsset => {
  const { seedId, ...rest } = seed
  return { ...rest, id: seedId }
}

export const PERSONAL_PROPERTY: RealEstateAsset[] = PERSONAL_PROPERTY_SEEDS.map(seedRealEstate)

/**
 * What a register holds before anyone has touched it.
 *
 * The known personal property is present from the start so it does not have to
 * be typed. It is an ordinary row once there: editable, and deletable for good —
 * a stored register that no longer contains it is respected rather than
 * re-seeded.
 */
export const DEFAULT_REGISTER: AssetRegister = {
  realEstate: PERSONAL_PROPERTY,
  investments: [],
  vehicles: [],
}
