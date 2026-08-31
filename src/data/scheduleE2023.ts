import type { ScheduleELine } from '../lib/taxes'

/**
 * The 2023 Schedule E as filed — fifteen properties, lettered A to O.
 *
 * Read out of the PDF by word coordinate rather than text flow, because the
 * form's dotted leaders scramble column order. The return leaves lines 23a–23e
 * blank, so there are no printed subtotals to check against; instead the parse
 * reconciles end to end — rents of 1,930,302 less expenses of 1,239,629 comes to
 * 690,673, which is exactly Schedule 1 line 5 on the filed 1040.
 *
 * Two rows differ from the rest and are not mistakes:
 *
 *  - **C, 3913 W Lake** appears in 2023 but not in 2024, and earned no rent in
 *    either — only its carrying costs are on the return. It matches nothing in
 *    the current portfolio, so its id is one only this file uses.
 *  - **K, 1211 S Prairie** is marked single-family with 365 personal-use days
 *    and no fair-rental days, so its line 20 is blank and none of its $35,959 of
 *    listed costs was deducted. That is correct for a residence, not an omission.
 *
 * Prior-year reference data — the app never edits it. The taxpayer's name and
 * social security number appear on the filed return and are deliberately NOT
 * stored here.
 */
export const SCHEDULE_E_2023: ScheduleELine[] = [
  {
    letter: 'A',
    propertyId: 'mannheim-plaza',
    address: '1505 N MANNHEIM RD STONE PARK, IL 60165',
    propertyType: 4,
    fairRentalDays: 365,
    personalUseDays: 0,
    rents: 296200, advertising: 650, autoTravel: 0, cleaning: 5430, commissions: 0, insurance: 2749, legal: 1000, management: 0, mortgageInterest: 0, otherInterest: 0, repairs: 8875, supplies: 0, taxes: 126001, utilities: 4320, depreciation: 39822, other: 0, totalExpenses: 188847,
  },
  {
    letter: 'B',
    propertyId: 'mannheim-1511',
    address: '1511 N MANNHEIM RD STONE PARK, IL 60165',
    propertyType: 4,
    fairRentalDays: 365,
    personalUseDays: 0,
    rents: 106057, advertising: 0, autoTravel: 0, cleaning: 0, commissions: 0, insurance: 1370, legal: 1000, management: 0, mortgageInterest: 0, otherInterest: 0, repairs: 3475, supplies: 0, taxes: 30776, utilities: 0, depreciation: 4102, other: 0, totalExpenses: 40723,
  },
  {
    letter: 'C',
    propertyId: 'lake-3913',
    address: '3913 W LAKE STONE PARK, IL 60165',
    propertyType: 4,
    fairRentalDays: 0,
    personalUseDays: 0,
    rents: 0, advertising: 550, autoTravel: 0, cleaning: 0, commissions: 0, insurance: 0, legal: 0, management: 0, mortgageInterest: 0, otherInterest: 0, repairs: 8620, supplies: 0, taxes: 5943, utilities: 0, depreciation: 0, other: 0, totalExpenses: 15113,
  },
  {
    letter: 'D',
    propertyId: 'mannheim-1506',
    address: '1510 N MANNHEIM RD STONE PARK, IL 60165',
    propertyType: 4,
    fairRentalDays: 365,
    personalUseDays: 0,
    rents: 66840, advertising: 575, autoTravel: 0, cleaning: 620, commissions: 0, insurance: 930, legal: 1000, management: 0, mortgageInterest: 0, otherInterest: 0, repairs: 3870, supplies: 0, taxes: 48188, utilities: 0, depreciation: 4102, other: 0, totalExpenses: 59285,
  },
  {
    letter: 'E',
    propertyId: 'plaza-1',
    address: '1559 N MANNHEIM RD STONE PARK, IL 60165',
    propertyType: 4,
    fairRentalDays: 365,
    personalUseDays: 0,
    rents: 264500, advertising: 930, autoTravel: 0, cleaning: 8640, commissions: 0, insurance: 2030, legal: 1000, management: 0, mortgageInterest: 0, otherInterest: 0, repairs: 12650, supplies: 1575, taxes: 150602, utilities: 4460, depreciation: 14866, other: 0, totalExpenses: 196753,
  },
  {
    letter: 'F',
    propertyId: 'apollo',
    address: '4208 APOLLO STONE PARK, IL 60165',
    propertyType: 4,
    fairRentalDays: 365,
    personalUseDays: 0,
    rents: 182880, advertising: 0, autoTravel: 0, cleaning: 7820, commissions: 0, insurance: 1885, legal: 1000, management: 0, mortgageInterest: 0, otherInterest: 0, repairs: 9560, supplies: 0, taxes: 41726, utilities: 28265, depreciation: 20250, other: 0, totalExpenses: 110506,
  },
  {
    letter: 'G',
    propertyId: 'mannheim-1638',
    address: '1642-46 N. MANNHEIM STONE PARK, IL 60165',
    propertyType: 4,
    fairRentalDays: 365,
    personalUseDays: 0,
    rents: 151600, advertising: 0, autoTravel: 0, cleaning: 865, commissions: 0, insurance: 1540, legal: 1000, management: 0, mortgageInterest: 0, otherInterest: 0, repairs: 7860, supplies: 0, taxes: 73167, utilities: 0, depreciation: 601, other: 0, totalExpenses: 85033,
  },
  {
    letter: 'H',
    propertyId: 'mannheim-1500',
    address: '4205 W LAKE ST (1500 N MANNHEIM) STONE PARK, IL 60165',
    propertyType: 4,
    fairRentalDays: 365,
    personalUseDays: 0,
    rents: 58044, advertising: 0, autoTravel: 0, cleaning: 0, commissions: 0, insurance: 850, legal: 1000, management: 0, mortgageInterest: 0, otherInterest: 0, repairs: 3460, supplies: 0, taxes: 27701, utilities: 0, depreciation: 7692, other: 0, totalExpenses: 40703,
  },
  {
    letter: 'I',
    propertyId: 'ave-25-1401',
    address: '1401 N 25TH MELROSE PARK, IL 60160',
    propertyType: 4,
    fairRentalDays: 365,
    personalUseDays: 0,
    rents: 182400, advertising: 0, autoTravel: 0, cleaning: 0, commissions: 0, insurance: 1760, legal: 1000, management: 0, mortgageInterest: 0, otherInterest: 0, repairs: 8860, supplies: 0, taxes: 79939, utilities: 0, depreciation: 16082, other: 0, totalExpenses: 107641,
  },
  {
    letter: 'J',
    propertyId: 'florida',
    address: '511 SE 5TH AVE # 1918 FT LAUDERDALE, FL 33301',
    propertyType: 1,
    fairRentalDays: 365,
    personalUseDays: 0,
    rents: 22740, advertising: 0, autoTravel: 0, cleaning: 0, commissions: 0, insurance: 0, legal: 0, management: 6360, mortgageInterest: 0, otherInterest: 0, repairs: 1870, supplies: 0, taxes: 4539, utilities: 0, depreciation: 9893, other: 0, totalExpenses: 22662,
  },
  {
    letter: 'K',
    propertyId: 'prairie-1211',
    address: '1211 S PRAIRIE UNIT 2605 CHICAGO, IL 60605',
    propertyType: 1,
    fairRentalDays: 0,
    personalUseDays: 365,
    rents: 0, advertising: 0, autoTravel: 0, cleaning: 0, commissions: 0, insurance: 210, legal: 0, management: 0, mortgageInterest: 0, otherInterest: 0, repairs: 0, supplies: 0, taxes: 14698, utilities: 0, depreciation: 21051, other: 0, totalExpenses: 0,
  },
  {
    letter: 'L',
    propertyId: 'plaza-2',
    address: '1681 N MANNHEIM RD STONE PARK, IL 60185',
    propertyType: 4,
    fairRentalDays: 365,
    personalUseDays: 0,
    rents: 218250, advertising: 0, autoTravel: 0, cleaning: 4730, commissions: 0, insurance: 2485, legal: 1000, management: 0, mortgageInterest: 0, otherInterest: 0, repairs: 9680, supplies: 0, taxes: 98424, utilities: 0, depreciation: 17605, other: 0, totalExpenses: 133924,
  },
  {
    letter: 'M',
    propertyId: 'west-plaza',
    address: '1901 S MANNHEIM RD WESTCHESTER, IL 60154',
    propertyType: 4,
    fairRentalDays: 365,
    personalUseDays: 0,
    rents: 247300, advertising: 0, autoTravel: 0, cleaning: 5620, commissions: 0, insurance: 1960, legal: 1000, management: 0, mortgageInterest: 0, otherInterest: 0, repairs: 9860, supplies: 0, taxes: 131925, utilities: 2340, depreciation: 22114, other: 0, totalExpenses: 174819,
  },
  {
    letter: 'N',
    propertyId: 'playpen-1536',
    address: '1536 N MANNHEIM RD STONE PARK, IL 60165',
    propertyType: 4,
    fairRentalDays: 365,
    personalUseDays: 0,
    rents: 88192, advertising: 0, autoTravel: 0, cleaning: 0, commissions: 0, insurance: 1240, legal: 1000, management: 0, mortgageInterest: 0, otherInterest: 0, repairs: 3870, supplies: 0, taxes: 23593, utilities: 0, depreciation: 7144, other: 0, totalExpenses: 36847,
  },
  {
    letter: 'O',
    propertyId: 'playpen-1538',
    address: '1538 N MANNHEIM RD STONE PARK, IL 60165',
    propertyType: 4,
    fairRentalDays: 365,
    personalUseDays: 0,
    rents: 45299, advertising: 0, autoTravel: 0, cleaning: 0, commissions: 0, insurance: 780, legal: 1000, management: 0, mortgageInterest: 0, otherInterest: 0, repairs: 2420, supplies: 0, taxes: 19338, utilities: 0, depreciation: 3235, other: 0, totalExpenses: 26773,
  },
]

/**
 * There are no printed control totals on this return — lines 23a to 23e are
 * blank — so these are summed from the per-property columns. The one figure that
 * can be checked against the filed forms is the net, and it ties exactly.
 */
export const SCHEDULE_E_2023_TOTALS = {
  rents: 1930302,
  mortgageInterest: 0,
  depreciation: 188559,
  totalExpenses: 1239629,
  taxes: 876560,
  /** Rents less expenses. Equals Schedule 1 line 5 on the filed 1040. */
  net: 690673,
  printedOnReturn: false,
}
