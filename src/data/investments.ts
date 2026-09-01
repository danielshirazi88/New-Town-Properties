import type { InvestmentAsset } from '../lib/assets'

/**
 * Bank deposits, entered from the statements one account at a time.
 *
 * These are seeded into the asset register rather than typed into it, so they
 * are under version control and arrive with the application instead of having to
 * be keyed in again on every device. Once seeded they behave like any other row:
 * editable, and deletable without coming back.
 *
 * Two things on this list look like transcription errors and are not:
 *
 *  - **Three CDs of $1,033,470.65** all opened 7 November 2025 on the same
 *    terms. They are three separate certificates, not one row copied twice.
 *  - **Two CDs of $1,010,543.45** both opened 1 May 2026. Confirmed as
 *    two distinct certificates when the figures were given.
 *
 * The near-match between $516,735.32 and $516,750.52 is not a duplicate either —
 * they were opened four weeks apart and differ by $15.20.
 *
 * Payout frequency is not recorded on any of them, because it was not stated.
 * `annualInterest` treats a rate as simple interest on the balance, which is the
 * right reading for a certificate that pays out rather than compounds; where one
 * of these turns out to compound, its frequency can be set on the row.
 */

/** Bumped whenever rows are added below, so a saved register picks them up once. */
export const INVESTMENT_SEED_VERSION = 1

const MILLENNIUM = 'Millennium Bank'

/** A one-year certificate, which is what every row below is. */
const cd = (
  id: string,
  balance: number,
  ratePct: number,
  openedDate: string,
  maturityDate: string,
): InvestmentAsset => ({
  id,
  kind: 'investment',
  name: 'One-year CD',
  institution: MILLENNIUM,
  investmentKind: 'cd',
  balance,
  ratePct,
  openedDate,
  maturityDate,
})

export const SEEDED_INVESTMENTS: InvestmentAsset[] = [
  cd('cd-mb-251107-a', 1_033_470.65, 4.5, '2025-11-07', '2026-11-07'),
  cd('cd-mb-251107-b', 516_735.32, 4.5, '2025-11-07', '2026-11-07'),
  cd('cd-mb-251107-c', 1_033_470.65, 4.5, '2025-11-07', '2026-11-07'),
  cd('cd-mb-251107-d', 1_033_470.65, 4.5, '2025-11-07', '2026-11-07'),
  cd('cd-mb-251204-a', 5_104_391.56, 4.25, '2025-12-04', '2026-12-04'),
  cd('cd-mb-251011-a', 516_750.52, 4.5, '2025-10-11', '2026-10-11'),
  cd('cd-mb-260116-a', 1_020_850.67, 4.25, '2026-01-16', '2027-01-16'),
  cd('cd-mb-260501-a', 1_010_543.45, 4.25, '2026-05-01', '2027-05-01'),
  cd('cd-mb-260501-b', 1_010_543.45, 4.25, '2026-05-01', '2027-05-01'),
]

/** What the certificates hold between them, for checking the transcription. */
export const SEEDED_INVESTMENT_TOTAL = SEEDED_INVESTMENTS
  .reduce((a, i) => a + i.balance, 0)
