const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const usd2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const money = (n: number): string => usd0.format(n)
export const moneyExact = (n: number): string => usd2.format(n)

/** Compact form for tight spaces: $2.55M, $378.9K. */
export function moneyShort(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${n < 0 ? '-' : ''}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${n < 0 ? '-' : ''}$${(abs / 1_000).toFixed(1)}K`
  return usd0.format(n)
}

export const pct = (n: number, digits = 1): string => `${n.toFixed(digits)}%`
export const signedPct = (n: number, digits = 1): string => `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%`
export const num = (n: number): string => n.toLocaleString('en-US')

export function dateLabel(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function monthsLabel(m?: number): string {
  if (m === undefined) return 'No end date'
  if (m < 0) return `Expired ${Math.abs(m)} mo ago`
  if (m === 0) return 'Expires this month'
  if (m < 24) return `${m} mo`
  return `${(m / 12).toFixed(1)} yr`
}
