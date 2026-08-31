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
 * Three things on the sheet are worth knowing about before quoting from it:
 *
 *  - **129 E Foster Ave is written as $2,100,000.** That is the literal reading
 *    and it is what is recorded here, but it is far above what a Roselle house
 *    would normally fetch and the comma is placed oddly. It is flagged on the
 *    trust screen for confirmation rather than quietly corrected to $210,000.
 *  - **1681–1693 N Mannheim has an earlier figure scribbled out** and $625,000
 *    written beside it. The struck figure is deliberately illegible, so only the
 *    surviving one is recorded.
 *  - **153 N Seabreeze Blvd's $1,539,500 includes $100,000 for parking**, per
 *    the note beside it.
 *
 * The trust's own note on the sheet asks for a column of estimated values. That
 * column exists in the app rather than on paper: rental buildings take their
 * value from the portfolio at the chosen cap rate, and anything else can be
 * typed in.
 */
export const TRUST_NAME = 'Kambiz M. Shirazi Trust'
export const TRUST_SCHEDULE_DATE = '2026-04-27'

export const TRUST_HOLDINGS: TrustHolding[] = [
  {
    id: 't01', seq: 1, purchaseDate: '1993-03-30',
    address: '1501-1505 N Mannheim Rd, Stone Park, IL',
    propertyType: 'Strip mall (Mannheim Plaza) new construction 2016',
    purchasePrice: 575000, use: 'rental', propertyId: 'mannheim-plaza',
  },
  {
    id: 't02', seq: 2, purchaseDate: '1996-05-09',
    address: '1511 N Mannheim Rd, Stone Park, IL',
    propertyType: 'Mixed-use (recording studio & 2nd floor apt)',
    purchasePrice: 200000, use: 'rental', propertyId: 'mannheim-1511',
  },
  {
    id: 't03', seq: 3, purchaseDate: '1998-09-04',
    address: '1638-46 N Mannheim Rd, Stone Park, IL',
    propertyType: 'Automotive building (4 units)',
    purchasePrice: 315000, use: 'rental', propertyId: 'mannheim-1638',
  },
  {
    id: 't04', seq: 4, purchaseDate: '2001-01-12',
    address: '1506-10 N Mannheim Rd, Stone Park, IL',
    propertyType: 'Salon suites & automotive (tire shop)',
    purchasePrice: 200000, use: 'rental', propertyId: 'mannheim-1506',
  },
  {
    id: 't05', seq: 5, purchaseDate: '2001-07-25',
    address: '1500 N Mannheim Rd, Stone Park, IL',
    propertyType: 'Restaurant',
    purchasePrice: 375000, use: 'rental', propertyId: 'mannheim-1500',
  },
  {
    id: 't06', seq: 6, purchaseDate: '2004-02-10',
    address: '1559 N Mannheim Rd, Stone Park, IL',
    propertyType: 'Strip mall (New Town Plaza)',
    purchasePrice: 695000, use: 'rental', propertyId: 'plaza-1',
  },
  {
    id: 't07', seq: 7, purchaseDate: '2005-05-06',
    address: '1401 N 25th Ave, Melrose Park, IL',
    propertyType: 'Automotive building (5 units)',
    purchasePrice: 734000, use: 'rental', propertyId: 'ave-25-1401',
  },
  {
    id: 't08', seq: 8, purchaseDate: '2005-09-14',
    address: '4208 Apollo Ln, Stone Park, IL',
    propertyType: 'Mobile home court (trailer park)',
    purchasePrice: 600000, use: 'rental', propertyId: 'apollo',
  },
  {
    id: 't09', seq: 9, purchaseDate: '2006-04-24',
    address: '511 SE 5th Ave #1918, Fort Lauderdale, FL',
    propertyType: 'Condo (rental)',
    purchasePrice: 340000, use: 'rental', propertyId: 'florida',
    note: 'Parking space #236, per the note on the schedule.',
  },
  {
    id: 't10', seq: 10, purchaseDate: '2008-05-27',
    address: '1211 S Prairie Ave Unit 2605, Chicago, IL',
    propertyType: 'Condo (personal)',
    purchasePrice: 723500, use: 'personal', propertyId: 'prairie-1211',
    note: 'On the 2023 Schedule E as a residence — 365 personal-use days, no fair-rental days '
      + 'and no expenses deducted.',
  },
  {
    id: 't11', seq: 11, purchaseDate: '2010-11-17',
    address: '129 E Foster Ave, Roselle, IL',
    propertyType: 'Primary home',
    purchasePrice: 2100000, use: 'personal',
    needsConfirmation: 'The schedule reads $2,100,000, which is well above what a Roselle house '
      + 'would usually fetch, and the comma sits oddly. Recorded as written rather than corrected '
      + 'to $210,000 — worth checking against the closing statement.',
  },
  {
    id: 't12', seq: 12, purchaseDate: '2012-10-12',
    address: '1681-1693 N Mannheim Rd, Stone Park, IL',
    propertyType: 'Strip mall (ParknShop)',
    purchasePrice: 625000, use: 'rental', propertyId: 'plaza-2',
    note: 'An earlier figure is scribbled out on the schedule and $625,000 written beside it. '
      + 'The struck figure is illegible, so only the surviving one is recorded.',
  },
  {
    id: 't13', seq: 13, purchaseDate: '2017-03-16',
    address: '1901-25 S Mannheim Rd, Westchester, IL',
    propertyType: 'Strip mall (West Plaza)',
    purchasePrice: 975000, use: 'note', propertyId: 'west-plaza',
    // The schedule lists it as a building because it was drawn up on 27 April,
    // three days before the sale closed. What the trust holds now is the note.
    sellerNote: {
      soldDate: '2026-04-30',
      buyer: 'Anthony Castaldo',
      balance: 1000000,
      monthlyPayment: 6140.87,
      maturityDate: '2029-04-30',
      note: 'Payments of $6,140.87 a month run from June 2026 on the rent roll, which carries '
        + 'them to May 2029; the schedule notes the balloon as due by 30 April 2029.',
    },
    note: 'Sold on seller financing 30 April 2026, three days after this schedule was drawn up. '
      + 'The trust holds the buyer\'s note, not the building.',
    needsConfirmation: 'A second figure, "$6,000…", is written beside the $6,140.87 payment and '
      + 'it is not clear what it refers to — a rounded payment, an interest-only portion, or '
      + 'something else. Only the $6,140.87 the rent roll confirms is recorded.',
  },
  {
    id: 't14', seq: 14, purchaseDate: '2019-11-15',
    address: '43 Ventada St, Ladera Ranch, CA',
    propertyType: 'SFH (personal)',
    purchasePrice: 1278584.65, use: 'personal',
  },
  {
    id: 't15', seq: 15, purchaseDate: '2020-01-07',
    address: '1536 N Mannheim Rd, Stone Park, IL',
    propertyType: 'Restaurant',
    purchasePrice: 150000, use: 'rental', propertyId: 'playpen-1536',
  },
  {
    id: 't16', seq: 16, purchaseDate: '2020-01-07',
    address: '1538 N Mannheim Rd, Stone Park, IL',
    propertyType: 'Warehouse',
    purchasePrice: 75000, use: 'rental', propertyId: 'playpen-1538',
  },
  {
    id: 't17', seq: 17, purchaseDate: '2024-03-28',
    address: '1643 N 43rd Ave, Stone Park, IL',
    propertyType: 'SFH (rental)',
    purchasePrice: 205000, use: 'rental', propertyId: 'n-43rd-1643',
  },
  {
    id: 't18', seq: 18, purchaseDate: '2025-11-25',
    address: '153 N Seabreeze Blvd #2404-S, Fort Lauderdale, FL',
    propertyType: 'Condo for resale',
    purchasePrice: 1539500, use: 'resale',
    note: 'The $1,539,500 includes $100,000 for parking, per the note on the schedule.',
  },
]

/** What the hand-written prices add up to, for checking the transcription. */
export const TRUST_PURCHASE_TOTAL = TRUST_HOLDINGS
  .reduce((a, h) => a + (h.purchasePrice ?? 0), 0)
