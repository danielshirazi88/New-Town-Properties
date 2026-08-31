import { SCHEDULE_E_2023, SCHEDULE_E_2023_TOTALS } from './scheduleE2023'
import { SCHEDULE_E_2024, SCHEDULE_E_2024_TOTALS } from './scheduleE'
import type { ScheduleELine } from '../lib/taxes'

/**
 * Returns as actually filed.
 *
 * This is the archive: what went to the IRS, not what the app thinks the numbers
 * should be. Nothing here is editable, and nothing is derived from the rent roll
 * — where the two disagree, that gap is itself worth seeing, so both are shown
 * rather than reconciled away.
 *
 * The taxpayer's social security number appears on every page of the filed
 * returns and is deliberately NOT stored.
 */

/** A line on the 1040, in the order the form asks for it. */
export interface ReturnLine {
  /** The form line, as printed — "2b", "15", "37". */
  line: string
  label: string
  amount: number
  /** Set on the lines that carry the story, so the view can lead with them. */
  headline?: boolean
  note?: string
}

export interface FiledReturn {
  year: number
  /** Filing status as checked on the return. */
  status: string
  /** Federal 1040, top to bottom. */
  federal: ReturnLine[]
  /** Illinois IL-1040. Empty when the state return was not part of the file. */
  illinois: ReturnLine[]
  scheduleE: ScheduleELine[]
  scheduleETotals: {
    rents: number
    depreciation: number
    totalExpenses: number
    taxes: number
    /** True when the return printed its own subtotals on lines 23a–23e. */
    printedOnReturn: boolean
  }
  /** Interest and dividends by payer — Schedule B, Parts I and II. */
  interestByPayer: { payer: string; amount: number }[]
  dividendsByPayer: { payer: string; amount: number }[]
  preparer?: { name: string; firmAddress: string; phone: string }
  /** What this return does and does not contain. */
  notes: string[]
}

const R = (line: string, label: string, amount: number, extra: Partial<ReturnLine> = {}): ReturnLine =>
  ({ line, label, amount, ...extra })

/**
 * 2023 — the complete filed package: federal 1040 with Schedules 1, 2, 3, B, D,
 * E and C, Form 4562 depreciation, Form 8582 passive activity, Form 7203 S-corp
 * basis, and the Illinois IL-1040.
 */
export const RETURN_2023: FiledReturn = {
  year: 2023,
  status: 'Single',
  federal: [
    R('1z', 'Wages', 1350),
    R('2a', 'Tax-exempt interest', 14),
    R('2b', 'Taxable interest', 214965, {
      headline: true,
      note: 'From nine bank and brokerage accounts — see the Schedule B breakdown below.',
    }),
    R('3b', 'Ordinary dividends', 471, { note: '$426 of it qualified.' }),
    R('7', 'Capital gain', 30852),
    R('8', 'Additional income — Schedule 1', 690673, {
      headline: true,
      note: 'Rental real estate, net of expenses. This is Schedule E line 41.',
    }),
    R('9', 'Total income', 938311, { headline: true }),
    R('11', 'Adjusted gross income', 938311, { note: 'No above-the-line adjustments were claimed.' }),
    R('12', 'Standard deduction', 13850),
    R('13', 'Qualified business income deduction', 99814, {
      note: 'Section 199A, computed on Form 8995-A.',
    }),
    R('15', 'Taxable income', 824647, { headline: true }),
    R('16', 'Tax', 260135),
    R('23', 'Other taxes', 28056, {
      note: 'All of it net investment income tax — the 3.8% surtax on Form 8960.',
    }),
    R('24', 'Total tax', 288191, { headline: true }),
    R('26', 'Estimated tax payments', 210000),
    R('31', 'Credits from Schedule 3', 50000),
    R('33', 'Total payments', 260000),
    R('37', 'Amount owed', 28191, {
      headline: true,
      note: 'Paid with the return — payments of $260,000 against a $288,191 bill.',
    }),
  ],
  illinois: [
    R('9', 'Illinois base income', 938325),
    R('11', 'Net income', 938325),
    R('23', 'Total Illinois tax', 46447, { headline: true, note: 'The flat 4.95% rate.' }),
    R('30', 'Total payments and credits', 42067),
    R('', 'Amount owed to Illinois', 4380, { headline: true }),
  ],
  scheduleE: SCHEDULE_E_2023,
  scheduleETotals: {
    rents: SCHEDULE_E_2023_TOTALS.rents,
    depreciation: SCHEDULE_E_2023_TOTALS.depreciation,
    totalExpenses: SCHEDULE_E_2023_TOTALS.totalExpenses,
    taxes: SCHEDULE_E_2023_TOTALS.taxes,
    printedOnReturn: false,
  },
  // Schedule B Part I, in the order the return lists them.
  interestByPayer: [
    { payer: 'Millennium Bank', amount: 87625 },
    { payer: 'GreenState Credit Union', amount: 73823 },
    { payer: 'Schaumburg Bank & Trust Company', amount: 49440 },
    { payer: 'Pan American Bank', amount: 2112 },
    { payer: 'Schaumburg Bank & Trust Company', amount: 1493 },
    { payer: 'Fifth Third Bank', amount: 234 },
    { payer: 'PNC Investments, LLC', amount: 219 },
    { payer: 'Wells Fargo', amount: 17 },
    { payer: 'Wells Fargo Clearing Services', amount: 2 },
  ],
  dividendsByPayer: [
    { payer: 'Wells Fargo', amount: 435 },
    { payer: 'Wells Fargo', amount: 36 },
  ],
  preparer: {
    name: 'Nori Kordvani',
    firmAddress: '1559 N Mannheim Rd Ste 2E, Stone Park, IL 60165',
    phone: '(708) 674-7415',
  },
  notes: [
    'Schedule E lines 23a–23e are blank on this return, so it prints no subtotals of '
    + 'its own. The transcription is checked end to end instead: rents of $1,930,302 less '
    + 'expenses of $1,239,629 comes to $690,673, which is exactly Schedule 1 line 5.',
    '1211 S Prairie is reported as a single-family residence with 365 personal-use days and '
    + 'no fair-rental days. Its $35,959 of listed costs were correctly not deducted.',
    '3913 W Lake appears on this return and not on 2024, and earned no rent in either year. '
    + 'Only its carrying costs are shown.',
    'New Town Properties Inc. (an S corporation) is listed in Schedule E Part II with no income '
    + 'or loss, which is why line 5 of Schedule 1 equals the rental total exactly.',
    'The whole $28,056 of other taxes is net investment income tax. There is no self-employment '
    + 'tax on this return.',
  ],
}

/**
 * 2024 — only the Schedule E was provided, so the 1040 summary is absent rather
 * than guessed. Its Schedule E does print its own control totals, which the
 * transcription matches.
 */
export const RETURN_2024: FiledReturn = {
  year: 2024,
  status: 'Single',
  federal: [],
  illinois: [],
  scheduleE: SCHEDULE_E_2024,
  scheduleETotals: {
    rents: SCHEDULE_E_2024_TOTALS.rents,
    depreciation: SCHEDULE_E_2024_TOTALS.depreciation,
    totalExpenses: SCHEDULE_E_2024_TOTALS.totalExpenses,
    taxes: SCHEDULE_E_2024_TOTALS.taxes,
    printedOnReturn: true,
  },
  interestByPayer: [],
  dividendsByPayer: [],
  notes: [
    'Only the Schedule E was provided for 2024. The 1040 summary, Schedule B and the state '
    + 'return are not in the file, so nothing above the rental line can be shown.',
    'This Schedule E does print its control totals, and the transcription matches them: line 23a '
    + 'rents of $1,917,768 and line 23d depreciation of $171,952.',
  ],
}

export const FILED_RETURNS: FiledReturn[] = [RETURN_2024, RETURN_2023]

export const RETURN_YEARS: number[] = FILED_RETURNS.map((r) => r.year)

/**
 * Which year the screen opens on.
 *
 * The newest year is not always the most useful one: 2024 is only a Schedule E,
 * so opening on it shows a page with the whole 1040 summary missing. Prefer the
 * most recent complete return and let the picker reach the rest.
 */
export const DEFAULT_RETURN_YEAR: number =
  (FILED_RETURNS.find((r) => r.federal.length > 0) ?? FILED_RETURNS[0]).year

/** True when only part of a year's package was provided. */
export const isPartialReturn = (r: FiledReturn): boolean => r.federal.length === 0

export const filedReturn = (year: number): FiledReturn | undefined =>
  FILED_RETURNS.find((r) => r.year === year)

/** Interest by institution, with the same bank's several accounts added up. */
export function interestByInstitution(r: FiledReturn): { payer: string; amount: number }[] {
  const m = new Map<string, number>()
  for (const { payer, amount } of r.interestByPayer) m.set(payer, (m.get(payer) ?? 0) + amount)
  return [...m].map(([payer, amount]) => ({ payer, amount })).sort((a, b) => b.amount - a.amount)
}
