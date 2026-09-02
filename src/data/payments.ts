import type { Payment } from '../lib/receivables'

/**
 * Payments recorded from documents rather than typed into the ledger.
 *
 * Months through August 2026 are settled by the owner's declaration, not by
 * recorded payments — see `DEFAULT_COLLECTION`. That declaration is deliberately
 * overridden wherever an actual payment exists for a charge, so a month that
 * really was short reads as short instead of being waved through as clean.
 *
 * This file is what does the overriding.
 */

/** Bumped whenever entries are added, so a saved ledger picks them up once. */
export const PAYMENT_SEED_VERSION = 2

export const SEEDED_PAYMENTS: Payment[] = [
  {
    id: 'pay-gottis-2026-08',
    leaseId: 'mp-gottis',
    period: '2026-08',
    amount: 3850,
    // The final invoice of 30 August shows the money already received but does
    // not say when it arrived. Dated to the invoice, which is the day it is
    // evidenced. A partial payment carries no days-to-pay, so this date cannot
    // corrupt the on-time record either way.
    paidOn: '2026-08-30',
    note: 'Half of August’s $7,700, per the final invoice dated 30 August 2026. '
      + 'The invoice bills the $3,850 balance plus $375 of late fees — 25 days at $15 '
      + 'from 6 August — for $4,225 due.',
    recordedBy: 'Final invoice 30 Aug 2026',
    recordedAt: '2026-08-30T00:00:00.000Z',
  },
  {
    id: 'pay-gottis-2026-08-balance',
    leaseId: 'mp-gottis',
    period: '2026-08',
    amount: 3850,
    // The date is fixed by the fee. The owner says $390 is still owed, and at
    // $15 a day that is 26 days past grace, which puts the money in on the 31st
    // — the same convention his own invoice used on the 30th, where 25 days
    // came to $375. The fee stops the day the balance clears.
    paidOn: '2026-08-31',
    note: 'The balance of August. Settles the month 26 days past grace, leaving $390 of '
      + 'late fees outstanding — which the owner expects a few days behind the rent, as usual '
      + 'with this tenant.',
    recordedBy: 'Reported by the owner, 2 September 2026',
    recordedAt: '2026-09-02T00:00:00.000Z',
  },
]
