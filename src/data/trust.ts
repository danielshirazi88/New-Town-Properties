import type { TrustHolding } from '../lib/trust'

/**
 * Schedule of Assets — Kambiz M. Shirazi Trust, updated 27 April 2026.
 *
 * Eighteen holdings, transcribed from the trust's own schedule. The typed
 * columns give the purchase date, the address and the property type as the
 * trust describes it; the purchase prices are the figures written on it by hand.
 *
 * This is the authoritative list of what is owned. It is wider than the rent
 * roll on purpose: the rent roll covers what pays rent, and this covers
 * everything, including the two residences and the condo held for resale.
 *
 * Two things on the sheet are worth knowing about before quoting from it:
 *
 *  - **1681–1693 N Mannheim has an earlier figure scribbled out** and $625,000
 *    written beside it. The struck figure is deliberately illegible, so only the
 *    surviving one is recorded.
 *  - **153 N Seabreeze Blvd's $1,539,500 includes $100,000 for parking**, per
 *    the note beside it.
 *
 * The trust's own note on the sheet asks for a column of estimated values, and
 * as of 1 September 2026 there is one: the owner gave a current figure for every
 * holding except West Plaza, which had already sold. Those are recorded as
 * `appraisal` and take precedence over the cap-rate model, which only ever knew
 * what a building's own net income would capitalise at.
 *
 * That exercise also settled the 129 E Foster figure this file used to flag.
 * The schedule's $2,100,000 was never a purchase price — the house cost
 * $1,500,000 and $2,100,000 is what it is worth now.
 */
export const TRUST_NAME = 'Kambiz M. Shirazi Trust'
export const TRUST_SCHEDULE_DATE = '2026-04-27'

export const TRUST_HOLDINGS: TrustHolding[] = [
  {
    id: 't01', seq: 1, purchaseDate: '1993-03-30',
    address: '1501-1505 N Mannheim Rd, Stone Park, IL',
    propertyType: 'Strip mall (Mannheim Plaza) new construction 2016',
    purchasePrice: 575000, use: 'rental', propertyId: 'mannheim-plaza',
    appraisal: { value: 4000000, asOf: '2026-09-01', basis: 'appraisal' },
  },
  {
    id: 't02', seq: 2, purchaseDate: '1996-05-09',
    address: '1511 N Mannheim Rd, Stone Park, IL',
    propertyType: 'Mixed-use (recording studio & 2nd floor apt)',
    purchasePrice: 200000, use: 'rental', propertyId: 'mannheim-1511',
    appraisal: { value: 1400000, asOf: '2026-09-01', basis: 'appraisal' },
  },
  {
    id: 't03', seq: 3, purchaseDate: '1998-09-04',
    address: '1638-46 N Mannheim Rd, Stone Park, IL',
    propertyType: 'Automotive building (4 units)',
    purchasePrice: 315000, use: 'rental', propertyId: 'mannheim-1638',
    appraisal: { value: 2500000, asOf: '2026-09-01', basis: 'appraisal' },
  },
  {
    id: 't04', seq: 4, purchaseDate: '2001-01-12',
    address: '1506-10 N Mannheim Rd, Stone Park, IL',
    propertyType: 'Salon suites & automotive (tire shop)',
    purchasePrice: 200000, use: 'rental', propertyId: 'mannheim-1506',
    appraisal: { value: 1320000, asOf: '2026-09-01', basis: 'appraisal' },
  },
  {
    id: 't05', seq: 5, purchaseDate: '2001-07-25',
    address: '1500 N Mannheim Rd, Stone Park, IL',
    propertyType: 'Restaurant',
    purchasePrice: 375000, use: 'rental', propertyId: 'mannheim-1500',
    appraisal: { value: 1380000, asOf: '2026-09-01', basis: 'appraisal' },
  },
  {
    id: 't06', seq: 6, purchaseDate: '2004-02-10',
    address: '1559 N Mannheim Rd, Stone Park, IL',
    propertyType: 'Strip mall (New Town Plaza)',
    purchasePrice: 695000, use: 'rental', propertyId: 'plaza-1',
    appraisal: { value: 3950000, asOf: '2026-09-01', basis: 'appraisal' },
  },
  {
    id: 't07', seq: 7, purchaseDate: '2005-05-06',
    address: '1401 N 25th Ave, Melrose Park, IL',
    propertyType: 'Automotive building (5 units)',
    purchasePrice: 734000, use: 'rental', propertyId: 'ave-25-1401',
    appraisal: { value: 2430000, asOf: '2026-09-01', basis: 'appraisal' },
  },
  {
    id: 't08', seq: 8, purchaseDate: '2005-09-14',
    address: '4208 Apollo Ln, Stone Park, IL',
    propertyType: 'Mobile home court (trailer park)',
    purchasePrice: 600000, use: 'rental', propertyId: 'apollo',
    appraisal: { value: 4000000, asOf: '2026-09-01', basis: 'offer', high: 5000000,
      note: 'Multiple offers have come in at $4,000,000 and none is being taken — the owner puts it at $4.5m to $5m. The $4m is what the market has actually put on the table, so it is the figure carried; the range above it is his, not a bid.' },
  },
  {
    id: 't09', seq: 9, purchaseDate: '2006-04-24',
    address: '511 SE 5th Ave #1918, Fort Lauderdale, FL',
    propertyType: 'Condo (rental)',
    purchasePrice: 340000, use: 'rental', propertyId: 'florida',
    appraisal: { value: 350000, asOf: '2026-09-01', basis: 'appraisal' },
    note: 'Parking space #236, per the note on the schedule.',
  },
  {
    id: 't10', seq: 10, purchaseDate: '2008-05-27',
    address: '1211 S Prairie Ave Unit 2605, Chicago, IL',
    propertyType: 'Condo (personal)',
    purchasePrice: 723500, use: 'personal', propertyId: 'prairie-1211',
    appraisal: { value: 900000, asOf: '2026-09-01', basis: 'appraisal' },
    note: 'On the 2023 Schedule E as a residence — 365 personal-use days, no fair-rental days '
      + 'and no expenses deducted.',
  },
  {
    id: 't11', seq: 11, purchaseDate: '2010-11-17',
    address: '129 E Foster Ave, Roselle, IL',
    propertyType: 'Primary home',
    purchasePrice: 1500000, use: 'personal',
    appraisal: { value: 2100000, asOf: '2026-09-01', basis: 'appraisal' },
    note: 'The schedule\'s $2,100,000 was flagged here as an implausible purchase price for a '
      + 'Roselle house. It was not the purchase price: the house cost $1,500,000 and $2,100,000 '
      + 'is what it is worth now. Confirmed by the owner, 1 September 2026.',
  },
  {
    id: 't12', seq: 12, purchaseDate: '2012-10-12',
    address: '1681-1693 N Mannheim Rd, Stone Park, IL',
    propertyType: 'Strip mall (ParknShop)',
    purchasePrice: 625000, use: 'rental', propertyId: 'plaza-2',
    appraisal: { value: 4000000, asOf: '2026-09-01', basis: 'appraisal' },
    note: 'An earlier figure is scribbled out on the schedule and $625,000 written beside it. '
      + 'The struck figure is illegible, so only the surviving one is recorded.',
  },
  {
    id: 't13', seq: 13, purchaseDate: '2017-03-16',
    address: '1901-25 S Mannheim Rd, Westchester, IL',
    propertyType: 'Strip mall (West Plaza)',
    purchasePrice: 975000, capitalSpend: 250000, use: 'note', propertyId: 'west-plaza',
    // The schedule lists it as a building because it was drawn up on 27 April,
    // three days before the sale closed. What the trust holds now is the note.
    sellerNote: {
      soldDate: '2026-04-30',
      buyer: 'Anthony Castaldo',
      soldPrice: 3100000,
      balance: 1000000,
      monthlyPayment: 6140.87,
      maturityDate: '2029-04-30',
      note: 'Payments of $6,140.87 a month run from June 2026 on the rent roll, which carries '
        + 'them to May 2029; the schedule notes the balloon as due by 30 April 2029.',
    },
    note: 'Sold on seller financing 30 April 2026, three days after this schedule was drawn up, '
      + 'for $3,100,000 against $975,000 paid and $250,000 of construction — a gain of $1,875,000 '
      + 'on cost. The trust holds the buyer\'s note, not the building, so it is carried at the '
      + '$1,000,000 outstanding rather than at what it sold for.',
    needsConfirmation: 'A second figure, "$6,000…", is written beside the $6,140.87 payment and '
      + 'it is not clear what it refers to — a rounded payment, an interest-only portion, or '
      + 'something else. Only the $6,140.87 the rent roll confirms is recorded.',
  },
  {
    id: 't14', seq: 14, purchaseDate: '2019-11-15',
    address: '43 Ventada St, Ladera Ranch, CA',
    propertyType: 'SFH (personal)',
    purchasePrice: 1278584.65, use: 'personal',
    appraisal: { value: 2500000, asOf: '2026-09-01', basis: 'appraisal' },
  },
  {
    id: 't15', seq: 15, purchaseDate: '2020-01-07',
    address: '1536 N Mannheim Rd, Stone Park, IL',
    propertyType: 'Restaurant',
    purchasePrice: 150000, use: 'rental', propertyId: 'playpen-1536',
    appraisal: { value: 1000000, asOf: '2026-09-01', basis: 'appraisal' },
  },
  {
    id: 't16', seq: 16, purchaseDate: '2020-01-07',
    address: '1538 N Mannheim Rd, Stone Park, IL',
    propertyType: 'Warehouse',
    purchasePrice: 75000, use: 'rental', propertyId: 'playpen-1538',
    appraisal: { value: 500000, asOf: '2026-09-01', basis: 'appraisal' },
  },
  {
    id: 't17', seq: 17, purchaseDate: '2024-03-28',
    address: '1643 N 43rd Ave, Stone Park, IL',
    propertyType: 'SFH (rental)',
    purchasePrice: 205000, use: 'rental', propertyId: 'n-43rd-1643',
    appraisal: { value: 350000, asOf: '2026-09-01', basis: 'appraisal' },
  },
  {
    id: 't18', seq: 18, purchaseDate: '2025-11-25',
    address: '153 N Seabreeze Blvd #2404-S, Fort Lauderdale, FL',
    propertyType: 'Condo for resale',
    purchasePrice: 1539500, use: 'resale',
    appraisal: { value: 2400000, asOf: '2026-09-01', basis: 'appraisal' },
    note: 'The $1,539,500 includes $100,000 for parking, per the note on the schedule.',
  },
]

/** What the hand-written prices add up to, for checking the transcription. */
export const TRUST_PURCHASE_TOTAL = TRUST_HOLDINGS
  .reduce((a, h) => a + (h.purchasePrice ?? 0), 0)

/** When the owner last went through the schedule putting a value on each row. */
export const APPRAISAL_DATE = '2026-09-01'

/**
 * What the current figures add up to.
 *
 * West Plaza is absent by design — it sold before the figures were given, and
 * the trust holds the buyer's note rather than the building. Its balance is
 * counted in the trust totals, not here.
 */
export const TRUST_APPRAISED_TOTAL = TRUST_HOLDINGS
  .reduce((a, h) => a + (h.appraisal?.value ?? 0), 0)
