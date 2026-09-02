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
    // The money was outstanding 26 days past grace, but the fee is capped at 25
    // — "$375.00 where I stop it" — so the extra day is not charged. The same
    // figure his own invoice reached on the 30th.
    paidOn: '2026-08-31',
    note: 'The balance of August, 26 days past grace. The fee stops at the 25-day cap, so '
      + '$375 is outstanding rather than $390 — which the owner expects a few days behind '
      + 'the rent, as usual with this tenant.',
    recordedBy: 'Reported by the owner, 2 September 2026',
    recordedAt: '2026-09-02T00:00:00.000Z',
  },
]
