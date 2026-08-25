import { useState } from 'react'
import { MONTHS, cellAmount, collected } from '../lib/finance'
import { money } from '../lib/format'
import type { LeaseOverride, Overrides } from '../lib/overrides'
import { changedFields } from '../lib/overrides'
import type { Lease, LeaseType, MonthCell } from '../lib/types'

const LEASE_TYPES: { value: LeaseType; label: string }[] = [
  { value: 'UNKNOWN', label: 'Not yet classified' },
  { value: 'NNN', label: 'Triple net (NNN) — tenant pays taxes, insurance, CAM' },
  { value: 'MG', label: 'Modified gross — expenses split per the lease' },
  { value: 'GROSS', label: 'Full service gross — landlord pays everything' },
]

/** Parse a typed month cell: a number, blank/V for vacant, or FREE. */
function parseCell(raw: string): MonthCell {
  const t = raw.trim().toUpperCase()
  if (t === 'V' || t === '') return 'V'
  if (t === 'FREE' || t === 'F') return 'FREE'
  const n = Number.parseFloat(t.replace(/[$,]/g, ''))
  return Number.isFinite(n) ? n : 'V'
}

const cellText = (c: MonthCell): string => (typeof c === 'number' ? String(c) : c)

export function EditLease({
  lease,
  original,
  overrides,
  setOverrides,
  onClose,
}: {
  /** The lease as currently shown, edits included. */
  lease: Lease
  /** The same lease straight from the source document, for comparison. */
  original: Lease
  overrides: Overrides
  setOverrides: (next: Overrides) => void
  onClose: () => void
}) {
  const [tenant, setTenant] = useState(lease.tenant)
  const [unit, setUnit] = useState(lease.unit)
  const [months, setMonths] = useState<string[]>(lease.months.map(cellText))
  const [start, setStart] = useState(lease.leaseStart ?? '')
  const [end, setEnd] = useState(lease.leaseEnd ?? '')
  const [esc, setEsc] = useState(lease.statedEscalationPct?.toString() ?? '')
  const [type, setType] = useState<LeaseType>(lease.leaseType)
  const [sqft, setSqft] = useState(lease.squareFeet?.toString() ?? '')
  const [note, setNote] = useState('')
  const [by, setBy] = useState(localStorage.getItem('ntp.editor') ?? '')

  const parsed = months.map(parseCell)
  const newTotal = parsed.reduce<number>((a, c) => a + cellAmount(c), 0)
  const oldTotal = collected(original)
  const existing = changedFields(overrides.leases[lease.id])

  const applyToAll = (value: string) => setMonths(new Array(12).fill(value))

  const save = () => {
    const patch: LeaseOverride = { meta: { by: by.trim() || undefined, at: new Date().toISOString(), note: note.trim() || undefined } }
    if (tenant !== original.tenant) patch.tenant = tenant
    if (unit !== original.unit) patch.unit = unit
    if (JSON.stringify(parsed) !== JSON.stringify(original.months)) patch.months = parsed
    if ((start || undefined) !== original.leaseStart) patch.leaseStart = start || null
    if ((end || undefined) !== original.leaseEnd) patch.leaseEnd = end || null
    const escNum = esc.trim() === '' ? null : Number.parseFloat(esc)
    if (escNum !== (original.statedEscalationPct ?? null)) patch.statedEscalationPct = escNum
    if (type !== original.leaseType) patch.leaseType = type
    const sqftNum = sqft.trim() === '' ? null : Number.parseFloat(sqft)
    if (sqftNum !== (original.squareFeet ?? null)) patch.squareFeet = sqftNum

    if (by.trim()) localStorage.setItem('ntp.editor', by.trim())

    const next = { ...overrides, leases: { ...overrides.leases } }
    if (changedFields(patch).length === 0) delete next.leases[lease.id]
    else next.leases[lease.id] = patch
    setOverrides(next)
    onClose()
  }

  const revert = () => {
    const next = { ...overrides, leases: { ...overrides.leases } }
    delete next.leases[lease.id]
    setOverrides(next)
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 780 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2 className="modal-title">Edit {original.tenant}</h2>
            <div className="t-mute" style={{ fontSize: 12 }}>
              Unit {original.unit}
              {existing.length > 0 && (
                <span className="badge warn" style={{ marginLeft: 8 }}>
                  {existing.length} field{existing.length === 1 ? '' : 's'} already edited
                </span>
              )}
            </div>
          </div>
          <button className="btn ghost sm" onClick={onClose}>Close</button>
        </div>

        <div className="form-grid">
          <label className="field"><span>Tenant</span>
            <input value={tenant} onChange={(e) => setTenant(e.target.value)} />
          </label>
          <label className="field"><span>Unit</span>
            <input value={unit} onChange={(e) => setUnit(e.target.value)} />
          </label>
          <label className="field"><span>Lease start</span>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="field"><span>Lease end</span>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
          <label className="field"><span>Annual bump %</span>
            <input type="number" step="0.1" placeholder="e.g. 5" value={esc} onChange={(e) => setEsc(e.target.value)} />
          </label>
          <label className="field"><span>Square feet</span>
            <input type="number" placeholder="unknown" value={sqft} onChange={(e) => setSqft(e.target.value)} />
          </label>
          <label className="field full"><span>Lease type</span>
            <select value={type} onChange={(e) => setType(e.target.value as LeaseType)}>
              {LEASE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
        </div>

        <div className="section-title" style={{ marginTop: 20, marginBottom: 8 }}>
          Monthly rent
          <span className="hint">Type an amount, or V for a vacant month and FREE for a concession.</span>
        </div>
        <div className="row" style={{ marginBottom: 10 }}>
          <button className="btn sm" onClick={() => applyToAll(months[0] || '0')}>
            Apply January's figure to every month
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))', gap: 8 }}>
          {MONTHS.map((m, i) => (
            <label key={m} className="field">
              <span>{m}</span>
              <input
                value={months[i]}
                onChange={(e) => {
                  const next = [...months]
                  next[i] = e.target.value
                  setMonths(next)
                }}
              />
            </label>
          ))}
        </div>

        <div className="row" style={{ marginTop: 14, gap: 22 }}>
          <div className="stack">
            <span className="kpi-label">New annual total</span>
            <span className="t-mono t-strong">{money(newTotal)}</span>
          </div>
          <div className="stack">
            <span className="kpi-label">On the source sheet</span>
            <span className="t-mono t-mute">{money(oldTotal)}</span>
          </div>
          {Math.abs(newTotal - oldTotal) > 0.005 && (
            <div className="stack">
              <span className="kpi-label">Difference</span>
              <span className="t-mono t-red">{newTotal > oldTotal ? '+' : ''}{money(newTotal - oldTotal)}</span>
            </div>
          )}
        </div>

        <div className="form-grid" style={{ marginTop: 16 }}>
          <label className="field"><span>Your name</span>
            <input value={by} onChange={(e) => setBy(e.target.value)} placeholder="so others know who changed it" />
          </label>
          <label className="field"><span>Why (optional)</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. corrected from signed lease" />
          </label>
        </div>

        <div className="form-actions">
          {existing.length > 0 && (
            <button className="btn danger" onClick={revert} style={{ marginRight: 'auto' }}>
              Revert to the original sheet
            </button>
          )}
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save}>Save changes</button>
        </div>
      </div>
    </div>
  )
}
