import type { InvestmentAsset } from '../lib/assets'

/**
 * Bank accounts and investments, entered from the statements one at a time.
 *
 * These are seeded into the asset register rather than typed into it, so they
 * are under version control and arrive with the application instead of having to
 * be keyed in again on every device. Once seeded they behave like any other row:
 * editable, and deletable without coming back.
 *
 * Most of the certificates are with Millennium Bank; Republic and Pan Am hold
 * one each. The Republic certificate is the only one that is not a twelve-month
 * term — it runs eight months, and pays the best rate on the list at 5%.
 *
 * The PNC holding is a mutual fund rather than a deposit. It has no term, no
 * maturity and no contracted rate, so none is recorded: what it returns depends
 * on what the funds do. That means it contributes to the balance but not to the
 * interest figure, and it is left out of the blended rate rather than dragging
 * it down as though it paid nothing.
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

/**
 * Bumped whenever rows are added below — or vehicles are added alongside them —
 * so a saved register picks up the new ones once. It covers the whole register,
 * not only this file.
 */
export const INVESTMENT_SEED_VERSION = 4

const MILLENNIUM = 'Millennium Bank'

/** Add whole months to an ISO date, keeping the day of the month. */
const addMonths = (iso: string, months: number): string => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + months)
  return d.toISOString().slice(0, 10)
}

/**
 * A certificate, described the way the bank does: a balance, a rate, an opening
 * date and a term. The maturity date is derived from the term rather than typed
 * alongside it, so the two can never disagree.
 */
const cd = (
  id: string,
  institution: string,
  balance: number,
  ratePct: number,
  openedDate: string,
  termMonths: number,
): InvestmentAsset => ({
  id,
  kind: 'investment',
  name: termMonths === 12 ? 'One-year CD' : `${termMonths}-month CD`,
  institution,
  investmentKind: 'cd',
  balance,
  ratePct,
  openedDate,
  maturityDate: addMonths(openedDate, termMonths),
})

export const SEEDED_INVESTMENTS: InvestmentAsset[] = [
  cd('cd-mb-251011-a', MILLENNIUM, 516_750.52, 4.5, '2025-10-11', 12),
  cd('cd-mb-251107-a', MILLENNIUM, 1_033_470.65, 4.5, '2025-11-07', 12),
  cd('cd-mb-251107-b', MILLENNIUM, 516_735.32, 4.5, '2025-11-07', 12),
  cd('cd-mb-251107-c', MILLENNIUM, 1_033_470.65, 4.5, '2025-11-07', 12),
  cd('cd-mb-251107-d', MILLENNIUM, 1_033_470.65, 4.5, '2025-11-07', 12),
  cd('cd-mb-251204-a', MILLENNIUM, 5_104_391.56, 4.25, '2025-12-04', 12),
  cd('cd-mb-260116-a', MILLENNIUM, 1_020_850.67, 4.25, '2026-01-16', 12),
  cd('cd-mb-260406-a', 'Republic Bank', 507_881.85, 5, '2026-04-06', 8),
  cd('cd-mb-260501-a', MILLENNIUM, 1_010_543.45, 4.25, '2026-05-01', 12),
  cd('cd-mb-260501-b', MILLENNIUM, 1_010_543.45, 4.25, '2026-05-01', 12),
  cd('cd-pa-260805-a', 'Pan Am Bank', 500_000, 4.1, '2026-08-05', 12),

  // Not a deposit: it has no term, no maturity and no contracted rate. What it
  // returns depends on what the funds do, so no rate is asserted — quoting one
  // would put an invented yield into a total that has to be trustworthy.
  {
    id: 'mf-pnc-a',
    kind: 'investment',
    name: 'Mutual funds',
    institution: 'PNC Bank',
    investmentKind: 'mutual-fund',
    balance: 44_602.22,
  },
]

/** What these hold between them, for checking the transcription. */
export const SEEDED_INVESTMENT_TOTAL = SEEDED_INVESTMENTS
  .reduce((a, i) => a + i.balance, 0)
