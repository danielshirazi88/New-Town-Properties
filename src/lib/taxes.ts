import type { Expense, ExpenseCategory } from './expenses'

/**
 * Schedule E (Form 1040), Part I — Income or Loss From Rental Real Estate.
 *
 * The worksheet mirrors the filed form line for line, so what the accountant
 * receives lines up with what he is transcribing onto the return. Line numbers
 * are the IRS's, not ours.
 */

export const SCHEDULE_E_LINES = [
  { line: '3', key: 'rents', label: 'Rents received', kind: 'income' },
  { line: '5', key: 'advertising', label: 'Advertising', kind: 'expense' },
  { line: '6', key: 'autoTravel', label: 'Auto and travel', kind: 'expense' },
  { line: '7', key: 'cleaning', label: 'Cleaning and maintenance', kind: 'expense' },
  { line: '8', key: 'commissions', label: 'Commissions', kind: 'expense' },
  { line: '9', key: 'insurance', label: 'Insurance', kind: 'expense' },
  { line: '10', key: 'legal', label: 'Legal and other professional fees', kind: 'expense' },
  { line: '11', key: 'management', label: 'Management fees', kind: 'expense' },
  { line: '12', key: 'mortgageInterest', label: 'Mortgage interest paid to banks', kind: 'expense' },
  { line: '13', key: 'otherInterest', label: 'Other interest', kind: 'expense' },
  { line: '14', key: 'repairs', label: 'Repairs', kind: 'expense' },
  { line: '15', key: 'supplies', label: 'Supplies', kind: 'expense' },
  { line: '16', key: 'taxes', label: 'Taxes', kind: 'expense' },
  { line: '17', key: 'utilities', label: 'Utilities', kind: 'expense' },
  { line: '18', key: 'depreciation', label: 'Depreciation expense or depletion', kind: 'expense' },
  { line: '19', key: 'other', label: 'Other', kind: 'expense' },
] as const

export type ScheduleEKey = (typeof SCHEDULE_E_LINES)[number]['key']

export const EXPENSE_LINE_KEYS = SCHEDULE_E_LINES
  .filter((l) => l.kind === 'expense')
  .map((l) => l.key) as Exclude<ScheduleEKey, 'rents'>[]

export interface ScheduleELine {
  letter: string
  /**
   * The holding this line belongs to. A filed return can name a property the
   * current portfolio no longer has, in which case the id is one only the return
   * uses and no lookup will match it — views fall back to the printed address.
   */
  propertyId: string
  address: string
  /** IRS line 1b: 1 = single family, 2 = multi-family, 4 = commercial, 7 = self-rental. */
  propertyType: number
  fairRentalDays: number
  personalUseDays: number
  rents: number
  advertising: number
  autoTravel: number
  cleaning: number
  commissions: number
  insurance: number
  legal: number
  management: number
  mortgageInterest: number
  otherInterest: number
  repairs: number
  supplies: number
  taxes: number
  utilities: number
  depreciation: number
  other: number
  totalExpenses: number
}

export const PROPERTY_TYPE_LABEL: Record<number, string> = {
  1: 'Single family residence',
  2: 'Multi-family residence',
  3: 'Vacation / short-term rental',
  4: 'Commercial',
  5: 'Land',
  6: 'Royalties',
  7: 'Self-rental',
  8: 'Other',
}

/** A cell the user has typed into the worksheet, overriding whatever was suggested. */
export type TaxEntries = Record<string, Partial<Record<ScheduleEKey, number>>>

/**
 * Which Schedule E line each expense category belongs on.
 *
 * Capital work is deliberately absent: structural work, roofing and tenant
 * improvements are not deductible as expenses, they are depreciated against the
 * building. Those entries are excluded from the worksheet and flagged separately
 * so the accountant can add them to the depreciation schedule instead.
 */
export const CATEGORY_TO_LINE: Record<ExpenseCategory, ScheduleEKey | null> = {
  'Appliances': null,
  'Structural work': null,
  'Contractor work': 'repairs',
  'Plumbing': 'repairs',
  'Electrical': 'repairs',
  'HVAC': 'repairs',
  'Roofing': null,
  'Landscaping & snow': 'cleaning',
  'Cleaning & janitorial': 'cleaning',
  'Pest control': 'cleaning',
  'Utilities': 'utilities',
  'Insurance': 'insurance',
  'Property taxes': 'taxes',
  'Management fees': 'management',
  'Legal & professional': 'legal',
  'Leasing & marketing': 'advertising',
  'Permits & licenses': 'other',
  'Security': 'other',
  'Tenant improvement': null,
  'Other': 'other',
}

/**
 * What the app can fill in on its own for a property: rent from the rent roll,
 * property tax from the tax bill, and every logged operating expense mapped onto
 * its Schedule E line. Anything the app cannot know — mortgage interest,
 * depreciation, auto and travel — comes back zero and is typed by hand.
 */
export function suggestedValues(
  propertyId: string,
  rentCollected: number,
  taxBill: number,
  expenses: Expense[],
  year: number,
): Partial<Record<ScheduleEKey, number>> {
  const out: Partial<Record<ScheduleEKey, number>> = {
    rents: Math.round(rentCollected),
    taxes: Math.round(taxBill),
  }
  const mine = expenses.filter(
    (e) =>
      e.propertyId === propertyId &&
      e.kind === 'operating' &&
      new Date(e.date + 'T00:00:00').getFullYear() === year,
  )
  for (const e of mine) {
    const key = CATEGORY_TO_LINE[e.category]
    if (!key) continue
    out[key] = Math.round((out[key] ?? 0) + e.amount)
  }
  return out
}

/** Capital spend for a property — not deductible, belongs on the depreciation schedule. */
export function capitalForYear(propertyId: string, expenses: Expense[], year: number): Expense[] {
  return expenses.filter(
    (e) =>
      e.propertyId === propertyId &&
      e.kind === 'capital' &&
      new Date(e.date + 'T00:00:00').getFullYear() === year,
  )
}

/** The value in a cell: what the user typed, else what the app suggests, else zero. */
export function cellValue(
  entries: TaxEntries,
  propertyId: string,
  key: ScheduleEKey,
  suggested: Partial<Record<ScheduleEKey, number>>,
): number {
  const typed = entries[propertyId]?.[key]
  if (typed !== undefined) return typed
  return suggested[key] ?? 0
}

export const isTyped = (entries: TaxEntries, propertyId: string, key: ScheduleEKey): boolean =>
  entries[propertyId]?.[key] !== undefined

export function totalExpensesFor(
  entries: TaxEntries,
  propertyId: string,
  suggested: Partial<Record<ScheduleEKey, number>>,
): number {
  return EXPENSE_LINE_KEYS.reduce((a, k) => a + cellValue(entries, propertyId, k, suggested), 0)
}
