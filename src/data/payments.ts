import type { Payment } from '../lib/receivables'

/**
 * Payments recorded from documents rather than typed into the ledger.
 *
 * Months through August 2026 are settled by the owner's declaration, not by
 * recorded payments — see `DEFAULT_COLLECTION`. That declaration is deliberately
 * overridden wherever an actual payment exists for a charge, so a month that
 * really was short reads as short instead of being waved through as clean.
 *
 * This file is what does the overriding. One entry so far.
 */

/** Bumped whenever entries are added, so a saved ledger picks them up once. */
export const PAYMENT_SEED_VERSION = 1

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
]
