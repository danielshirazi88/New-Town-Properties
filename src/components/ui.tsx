import type { ReactNode } from 'react'
import { monthsRemaining, type PropertyMetrics } from '../lib/finance'
import type { Lease } from '../lib/types'

export function Kpi({
  label, value, note, warn, accent, small,
}: {
  label: string
  value: ReactNode
  note?: ReactNode
  warn?: boolean
  accent?: boolean
  small?: boolean
}) {
  return (
    <div className={`kpi${accent ? ' accent' : ''}`}>
      <span className="kpi-label">{label}</span>
      <div className={`kpi-value${small ? ' sm' : ''}`}>{value}</div>
      {note && <div className={`kpi-note${warn ? ' warn' : ''}`}>{note}</div>}
    </div>
  )
}

export function Card({ title, hint, children, actions }: {
  title?: string
  hint?: ReactNode
  children: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="card">
      {title && (
        <div className="section-title" style={{ marginBottom: 12 }}>
          {title}
          {hint && <span className="hint">{hint}</span>}
          {actions && <span style={{ marginLeft: 'auto' }}>{actions}</span>}
        </div>
      )}
      {children}
    </div>
  )
}

/* ── Lease expiry status ─────────────────────────────────────────────────── */

export type ExpiryStatus = 'expired' | 'critical' | 'soon' | 'watch' | 'safe' | 'none'

export interface ExpiryInfo {
  status: ExpiryStatus
  months?: number
  label: string
  tone: 'critical' | 'warn' | 'ok' | 'mute'
}

/**
 * How urgent a lease renewal is. The thresholds mirror how a landlord actually
 * works a renewal: six months out you start the conversation, three months out
 * it is pressing, and past the end date the tenant is on holdover with no
 * contractual protection on either side.
 */
export function expiryInfo(lease: Lease, asOf?: Date): ExpiryInfo {
  const m = monthsRemaining(lease, asOf)
  if (m === undefined) return { status: 'none', label: 'No end date on file', tone: 'warn' }
  if (m < 0) return { status: 'expired', months: m, label: `Lapsed ${Math.abs(m)} mo ago`, tone: 'critical' }
  if (m <= 3) return { status: 'critical', months: m, label: m === 0 ? 'Ends this month' : `${m} mo left`, tone: 'critical' }
  if (m <= 6) return { status: 'soon', months: m, label: `${m} mo left`, tone: 'warn' }
  if (m <= 12) return { status: 'watch', months: m, label: `${m} mo left`, tone: 'warn' }
  return { status: 'safe', months: m, label: m < 24 ? `${m} mo left` : `${(m / 12).toFixed(1)} yr left`, tone: 'ok' }
}

const DOT_CLASS: Record<ExpiryStatus, string> = {
  expired: 'expired', critical: 'soon', soon: 'soon', watch: 'watch', safe: 'safe', none: 'none',
}

export function ExpiryBadge({ lease, asOf }: { lease: Lease; asOf?: Date }) {
  const info = expiryInfo(lease, asOf)
  return (
    <span className={`badge ${info.tone}`}>
      <span className={`status-dot ${DOT_CLASS[info.status]}`} aria-hidden />
      {info.label}
    </span>
  )
}

export function Bar({ value, max }: { value: number; max: number }) {
  return (
    <div className="bar-track">
      <div className="bar-fill" style={{ width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%` }} />
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>
}

export const propertyLabel = (m: PropertyMetrics): string => m.property.name
