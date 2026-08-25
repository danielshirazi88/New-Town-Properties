import type { ScheduleELine } from '../lib/taxes'

/**
 * The 2024 Schedule E as actually filed — fifteen properties, lettered A to O.
 *
 * Transcribed from the filed return by reading word coordinates out of the PDF
 * rather than its text flow, because the form's dotted leaders scramble column
 * order. The parse reconciles against the form's own control totals: line 23a
 * (rents) comes to 1,917,768 and line 23d (depreciation) to 171,952, both
 * matching the figures printed on the return.
 *
 * This is prior-year reference data: it is what the 2025 worksheet is measured
 * against, and the app never edits it.
 *
 * The taxpayer's name and social security number appear on the filed return and
 * are deliberately NOT stored here.
 */
export const SCHEDULE_E_2024: ScheduleELine[] = [
  {
    letter: 'A',
    propertyId: 'mannheim-plaza',
    address: '1505 N MANNHEIM RD STONE PARK, IL 60165',
    propertyType: 4,
    fairRentalDays: 365,
    personalUseDays: 0,
    rents: 298700, advertising: 960, autoTravel: 0, cleaning: 5860, commissions: 0, insurance: 2863, legal: 1000, management: 0, mortgageInterest: 0, otherInterest: 0, repairs: 6750, supplies: 0, taxes: 81797, utilities: 4470, depreciation: 35567, other: 0, totalExpenses: 139267,
  },
  {
    letter: 'B',
    propertyId: 'mannheim-1511',
    address: '1511 N MANNHEIM RD STONE PARK, IL 60165',
    propertyType: 4,
    fairRentalDays: 365,
    personalUseDays: 0,
    rents: 75177, advertising: 825, autoTravel: 0, cleaning: 1740, commissions: 0, insurance: 1450, legal: 1000, management: 0, mortgageInterest: 0, otherInterest: 0, repairs: 7650, supplies: 0, taxes: 24363, utilities: 0, depreciation: 4122, other: 0, totalExpenses: 41150,
  },
  {
    letter: 'C',
    propertyId: 'mannheim-1506',
    address: '1506-1510 N MANNHEIM RD STONE PARK, IL 60165',
    propertyType: 4,
    fairRentalDays: 365,
    personalUseDays: 0,
    rents: 82550, advertising: 770, autoTravel: 0, cleaning: 1850, commissions: 0, insurance: 1925, legal: 1000, management: 0, mortgageInterest: 0, otherInterest: 0, repairs: 6280, supplies: 0, taxes: 42111, utilities: 0, depreciation: 4102, other: 0, totalExpenses: 58038,
  },
  {
    letter: 'D',
    propertyId: 'plaza-1',
    address: '1559 N MANNHEIM RD STONE PARK, IL 60165',
    propertyType: 4,
    fairRentalDays: 365,
    personalUseDays: 0,
    rents: 268600, advertising: 740, autoTravel: 0, cleaning: 8850, commissions: 0, insurance: 2279, legal: 1000, management: 0, mortgageInterest: 0, otherInterest: 0, repairs: 14350, supplies: 1820, taxes: 164361, utilities: 4720, depreciation: 15954, other: 0, totalExpenses: 214074,
  },
  {
    letter: 'E',
    propertyId: 'apollo',
    address: '4208 APOLLO STONE PARK, IL 60165',
    propertyType: 4,
    fairRentalDays: 365,
    personalUseDays: 0,
    rents: 185320, advertising: 0, autoTravel: 0, cleaning: 8380, commissions: 0, insurance: 1885, legal: 1000, management: 0, mortgageInterest: 0, otherInterest: 0, repairs: 6870, supplies: 0, taxes: 56870, utilities: 28620, depreciation: 475, other: 0, totalExpenses: 104100,
  },
  {
    letter: 'F',
    propertyId: 'mannheim-1638',
    address: '1642-46 N. MANNHEIM STONE PARK, IL 60165',
    propertyType: 4,
    fairRentalDays: 365,
    personalUseDays: 0,
    rents: 136400, advertising: 0, autoTravel: 0, cleaning: 6750, commissions: 0, insurance: 1612, legal: 1000, management: 0, mortgageInterest: 0, otherInterest: 0, repairs: 7750, supplies: 0, taxes: 69725, utilities: 0, depreciation: 601, other: 0, totalExpenses: 87438,
  },
  {
    letter: 'G',
    propertyId: 'mannheim-1500',
    address: '4205 W LAKE ST (1500 N MANNHEIM) STONE PARK, IL 60165',
    propertyType: 4,
    fairRentalDays: 365,
    personalUseDays: 0,
    rents: 63376, advertising: 0, autoTravel: 0, cleaning: 1420, commissions: 0, insurance: 960, legal: 1000, management: 0, mortgageInterest: 0, otherInterest: 0, repairs: 1630, supplies: 0, taxes: 21360, utilities: 0, depreciation: 7692, other: 0, totalExpenses: 34062,
  },
  {
    letter: 'H',
    propertyId: 'ave-25-1401',
    address: '1401 N 25TH MELROSE PARK, IL 60160',
    propertyType: 4,
    fairRentalDays: 365,
    personalUseDays: 0,
    rents: 163350, advertising: 0, autoTravel: 0, cleaning: 3620, commissions: 0, insurance: 1867, legal: 1000, management: 0, mortgageInterest: 0, otherInterest: 0, repairs: 7260, supplies: 0, taxes: 87219, utilities: 0, depreciation: 16625, other: 0, totalExpenses: 117591,
  },
  {
    letter: 'I',
    propertyId: 'florida',
    address: '511 SE 5TH AVE # 1918 FT LAUDERDALE, FL 33301',
    propertyType: 4,
    fairRentalDays: 365,
    personalUseDays: 0,
    rents: 17200, advertising: 0, autoTravel: 0, cleaning: 1130, commissions: 0, insurance: 0, legal: 0, management: 8935, mortgageInterest: 0, otherInterest: 0, repairs: 1460, supplies: 0, taxes: 4707, utilities: 0, depreciation: 9890, other: 0, totalExpenses: 26122,
  },
  {
    letter: 'J',
    propertyId: 'prairie-1211',
    address: '1211 S PRAIRIE UNIT 2605 CHICAGO, IL 60605',
    propertyType: 4,
    fairRentalDays: 365,
    personalUseDays: 0,
    rents: 0, advertising: 0, autoTravel: 0, cleaning: 0, commissions: 0, insurance: 215, legal: 0, management: 12961, mortgageInterest: 0, otherInterest: 0, repairs: 0, supplies: 0, taxes: 15080, utilities: 0, depreciation: 21045, other: 0, totalExpenses: 12961,
  },
  {
    letter: 'K',
    propertyId: 'plaza-2',
    address: '1681 N MANNHEIM RD STONE PARK, IL 60185',
    propertyType: 4,
    fairRentalDays: 365,
    personalUseDays: 0,
    rents: 224750, advertising: 0, autoTravel: 0, cleaning: 4860, commissions: 0, insurance: 2570, legal: 1000, management: 0, mortgageInterest: 0, otherInterest: 0, repairs: 8230, supplies: 0, taxes: 90166, utilities: 4560, depreciation: 18186, other: 0, totalExpenses: 129572,
  },
  {
    letter: 'L',
    propertyId: 'west-plaza',
    address: '1901 S MANNHEIM RD WESTCHESTER, IL 60154',
    propertyType: 4,
    fairRentalDays: 365,
    personalUseDays: 0,
    rents: 275495, advertising: 870, autoTravel: 0, cleaning: 5230, commissions: 0, insurance: 1980, legal: 1000, management: 0, mortgageInterest: 0, otherInterest: 0, repairs: 6250, supplies: 0, taxes: 66587, utilities: 2420, depreciation: 22552, other: 0, totalExpenses: 106889,
  },
  {
    letter: 'M',
    propertyId: 'playpen-1536',
    address: '1536 N MANNHEIM RD STONE PARK, IL 60165',
    propertyType: 4,
    fairRentalDays: 365,
    personalUseDays: 0,
    rents: 76340, advertising: 0, autoTravel: 0, cleaning: 920, commissions: 0, insurance: 1420, legal: 1000, management: 0, mortgageInterest: 0, otherInterest: 0, repairs: 1820, supplies: 0, taxes: 26257, utilities: 0, depreciation: 7144, other: 0, totalExpenses: 38561,
  },
  {
    letter: 'N',
    propertyId: 'playpen-1538',
    address: '1538 N MANNHEIM RD STONE PARK, IL 60165',
    propertyType: 4,
    fairRentalDays: 365,
    personalUseDays: 0,
    rents: 36510, advertising: 0, autoTravel: 0, cleaning: 420, commissions: 0, insurance: 915, legal: 1000, management: 0, mortgageInterest: 0, otherInterest: 0, repairs: 870, supplies: 0, taxes: 15805, utilities: 0, depreciation: 3235, other: 0, totalExpenses: 22245,
  },
  {
    letter: 'O',
    propertyId: 'n-43rd-1643',
    address: '1643 43RD STONE PARK, IL 60165',
    propertyType: 1,
    fairRentalDays: 365,
    personalUseDays: 0,
    rents: 14000, advertising: 0, autoTravel: 0, cleaning: 1630, commissions: 0, insurance: 936, legal: 0, management: 0, mortgageInterest: 0, otherInterest: 0, repairs: 4280, supplies: 0, taxes: 6638, utilities: 0, depreciation: 4762, other: 0, totalExpenses: 18246,
  },
]

/** Control totals printed on the filed return, used to verify the transcription. */
export const SCHEDULE_E_2024_TOTALS = {
  rents: 1917768,            // line 23a
  mortgageInterest: 0, // line 23c
  depreciation: 171952,     // line 23d
  totalExpenses: 1150316,    // line 23e
  taxes: 773046,
}
