import { useMemo, useState } from 'react'
import { Card, ConcessionBadge, Empty, ExpiryBadge, Kpi } from '../components/ui'
import { MONTHS, collected, concessionSummary, lastRate, rentPerSqFt, tenancyYears } from '../lib/finance'
import { dateLabel, money, pct } from '../lib/format'
import { PAYMENT_METHODS, methodLabel, profileCompleteness, resolveProfile,
  type PaymentMethodId, type TenantProfile as Profile, type TenantProfiles } from '../lib/tenants'
import { MONTH_NAMES, chargesForLease, payerRecordsFor, statusOf,
  type ChargeState, type CollectionSettings, type Payment } from '../lib/receivables'
import type { PortfolioKpis } from '../lib/portfolio'
import type { Lease } from '../lib/types'
import { rentRoll } from '../data/rentRolls'

const STATE_STYLE: Record<ChargeState, { cls: string; label: string }> = {
  paid: { cls: 'paid', label: 'Paid' },
  partial: { cls: 'warn', label: 'Part paid' },
  upcoming: { cls: 'mute', label: 'Not yet due' },
  due: { cls: 'mute', label: 'Due' },
  late: { cls: 'critical', label: 'Late' },
}

/** Typed against ChargeState, so a new state cannot silently fall through. */
const styleFor = (s: ChargeState) => STATE_STYLE[s] ?? { cls: 'mute', label: s }

export function TenantProfileView({
  k, lease, profiles, setProfiles, payments, settings, onBack, onProperty,
}: {
  k: PortfolioKpis
  lease: Lease
  profiles: TenantProfiles
  setProfiles: (next: TenantProfiles) => void
  payments: Payment[]
  settings: CollectionSettings
  onBack: () => void
  onProperty: (id: string) => void
}) {
  const property = k.properties.find((p) => p.property.id === lease.propertyId)
  const resolved = resolveProfile(lease.id, lease.contacts, profiles)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Profile>(resolved)

  const charges = useMemo(
    () => chargesForLease(lease, k.fiscalYear,
      { reportedMonths: rentRoll(k.fiscalYear).monthsReported, carryForward: true }),
    [lease, k.fiscalYear],
  )
  const statuses = useMemo(
    () => charges.map((c) => statusOf(c, payments, k.asOf, settings)),
    [charges, payments, k.asOf, settings],
  )
  const record = useMemo(
    () => payerRecordsFor(charges, payments, k.asOf, settings)[0],
    [charges, payments, k.asOf, settings],
  )

  const completeness = profileCompleteness(resolved)
  const years = tenancyYears(lease)
  const psf = rentPerSqFt(lease)
  const concession = concessionSummary(lease)

  const save = () => {
    const clean: Profile = {
      ...draft,
      leaseId: lease.id,
      phones: draft.phones.filter((p) => p.number.trim()),
      updatedAt: new Date().toISOString(),
      updatedBy: localStorage.getItem('ntp.editor') ?? undefined,
    }
    setProfiles({ ...profiles, [lease.id]: clean })
    setEditing(false)
  }

  return (
    <>
      <div className="page-head">
        <button className="btn ghost sm" onClick={onBack} style={{ marginBottom: 12 }}>← Back</button>
        <h1 className="page-title">{resolved.displayName || lease.tenant}</h1>
        <p className="page-sub">
          Unit {lease.unit} ·{' '}
          <button className="btn ghost sm" onClick={() => onProperty(lease.propertyId)}>
            {property?.property.name}
          </button>
          {resolved.businessName && ` · ${resolved.businessName}`}
        </p>
      </div>

      <div className="kpi-grid">
        <Kpi accent label="Current rent" value={money(lastRate(lease))} note="Per month" />
        <Kpi label={`${k.fiscalYear} billed`} value={money(collected(lease))} />
        <Kpi label="Lease ends" value={lease.leaseEnd ? dateLabel(lease.leaseEnd) : 'Not recorded'} small
          note={<ExpiryBadge lease={lease} asOf={k.asOf} />} />
        <Kpi label="In place" value={years !== undefined ? `${years.toFixed(1)} yr` : '—'}
          note={lease.leaseStart ? (
            <>
              Since {dateLabel(lease.leaseStart)}
              {concession && <> · <ConcessionBadge lease={lease} /></>}
            </>
          ) : undefined} />
        <Kpi label="Area" value={lease.squareFeet ? `${lease.squareFeet.toLocaleString()} sf` : '—'}
          note={psf !== undefined ? `$${psf.toFixed(2)} per sq ft` : undefined} />
        <Kpi label="Deposit held" value={lease.securityDeposit ? money(lease.securityDeposit) : '—'}
          note={lease.renewalOptions ? `Options: ${lease.renewalOptions}` : undefined} />
      </div>

      {concession && (
        <div className="callout neutral" style={{ marginTop: 12 }}>
          <div className="callout-title">
            <span className="badge warn">{concession.label}</span>
            {lease.leaseStart && <>Lease commenced {dateLabel(lease.leaseStart)}</>}
          </div>
          <p>
            {concession.periodLabel
              ? `${concession.periodLabel} was rent-free, so the first rent was collected the month after.`
              : 'Free rent was granted at commencement.'}
            {concession.lossThisYear > 0
              && ` ${money(concession.lossThisYear)} forgone in ${k.fiscalYear} — a concession, not a missed payment.`}
          </p>
          {concession.note && <p className="t-mute">{concession.note}</p>}
        </div>
      )}

      {record && record.chargesSettled > 0 && (
        <div className="kpi-grid" style={{ marginTop: 12 }}>
          <Kpi accent label="Average days to pay" value={record.averageDaysToPay!.toFixed(1)}
            note="From the 1st. Under 4 is inside the grace period" />
          <Kpi label="Paid on time" value={pct(record.onTimeRatePct, 0)}
            note={`${record.chargesSettled} months settled`} />
          <Kpi label="Reliability" value={record.reliabilityScore.toFixed(0)}
            note="0–100, on-time record adjusted for how late" />
          <Kpi label="Late fees" value={money(record.totalLateFees)}
            note={`${record.monthsLate} months late`} warn={record.totalLateFees > 0} />
        </div>
      )}

      <div className="section">
        <Card
          title="Contact directory"
          hint={completeness.filled < completeness.total
            ? `${completeness.filled} of ${completeness.total} fields — missing ${completeness.missing.join(', ').toLowerCase()}`
            : 'Complete'}
          actions={editing
            ? undefined
            : <button className="btn sm" onClick={() => { setDraft(resolved); setEditing(true) }}>Edit</button>}
        >
          {!editing ? (
            <div className="grid-2">
              <div className="stack" style={{ gap: 10 }}>
                <Field label="Contact person" value={resolved.contactPerson} />
                <Field label="Business name" value={resolved.businessName} />
                <Field label="Email" value={resolved.email} href={resolved.email ? `mailto:${resolved.email}` : undefined} />
                <Field label="Mailing address" value={resolved.mailingAddress} />
                <Field label="Emergency contact" value={resolved.emergencyContact} />
              </div>
              <div className="stack" style={{ gap: 10 }}>
                <div>
                  <span className="kpi-label">Phone numbers</span>
                  {resolved.phones.length === 0 ? <div className="t-mute">None recorded</div> : (
                    <div className="stack" style={{ gap: 4, marginTop: 4 }}>
                      {resolved.phones.map((p, i) => (
                        <div key={i} className="row" style={{ gap: 8 }}>
                          <span className="t-mute" style={{ minWidth: 120, fontSize: 12 }}>{p.label}</span>
                          <a className="t-mono" href={`tel:${p.number.replace(/[^\d+]/g, '')}`}>{p.number}</a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <span className="kpi-label">Preferred payment</span>
                  <div style={{ marginTop: 4 }}>
                    <span className={`badge ${resolved.preferredPayment ? 'ok' : 'warn'}`}>
                      {methodLabel(resolved.preferredPayment, resolved.customPaymentLabel)}
                    </span>
                  </div>
                  {resolved.paymentDetails && (
                    <div className="t-mono t-mute" style={{ fontSize: 12, marginTop: 5 }}>{resolved.paymentDetails}</div>
                  )}
                </div>
                <Field label="Notes" value={resolved.notes} />
                {resolved.updatedAt && (
                  <div className="t-mute" style={{ fontSize: 11 }}>
                    Last updated {new Date(resolved.updatedAt).toLocaleDateString()}
                    {resolved.updatedBy ? ` by ${resolved.updatedBy}` : ''}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <ProfileForm draft={draft} setDraft={setDraft} onSave={save} onCancel={() => setEditing(false)} />
          )}
        </Card>
      </div>

      <div className="section">
        <div className="section-title">
          {k.fiscalYear} rent ledger
          <span className="hint">green once collected · rent falls due on the 1st, grace through the 5th</span>
        </div>
        {statuses.length === 0 ? <Empty>No rent charged in {k.fiscalYear}.</Empty> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Month</th><th className="num">Due</th><th className="num">Paid</th>
                  <th className="num">Balance</th><th>Status</th>
                  <th className="num">Days to pay</th><th className="num">Late fee</th><th>Paid on</th>
                </tr>
              </thead>
              <tbody>
                {statuses.map((s) => {
                  const style = styleFor(s.state)
                  return (
                    <tr key={s.charge.id} style={s.state === 'paid' ? { background: 'rgba(40,160,90,0.10)' } : undefined}>
                      <td className="t-strong">{MONTH_NAMES[s.charge.month]}</td>
                      <td className="num">{money(s.charge.amountDue)}</td>
                      <td className="num">{s.paid > 0 ? money(s.paid) : <span className="t-mute">—</span>}</td>
                      <td className={`num ${s.balance > 0 ? 't-red' : 't-mute'}`}>
                        {s.balance > 0 ? money(s.balance) : '—'}
                      </td>
                      <td><span className={`badge ${style.cls}`}>{style.label}</span></td>
                      <td className="num">{s.daysToPay !== undefined ? s.daysToPay : <span className="t-mute">—</span>}</td>
                      <td className={`num ${s.lateFee > 0 ? 't-red' : 't-mute'}`}>
                        {s.lateFeeWaived ? <span className="badge mute">waived</span>
                          : s.lateFee > 0 ? money(s.lateFee) : '—'}
                      </td>
                      <td className="t-mono t-mute">{s.settledOn ? s.settledOn.toLocaleDateString() : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td className="label">Total</td>
                  <td className="num">{money(statuses.reduce((a, s) => a + s.charge.amountDue, 0))}</td>
                  <td className="num">{money(statuses.reduce((a, s) => a + s.paid, 0))}</td>
                  <td className="num">{money(statuses.reduce((a, s) => a + s.balance, 0))}</td>
                  <td colSpan={2} />
                  <td className="num">{money(statuses.reduce((a, s) => a + s.lateFee, 0))}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <div className="section">
        <Card title="Rent through the year" hint="V = vacant, FREE = concession, — = not on the sheet">
          <div className="table-wrap" style={{ border: 0 }}>
            <table>
              <thead><tr>{MONTHS.map((m) => <th key={m} className="num">{m}</th>)}</tr></thead>
              <tbody>
                <tr>
                  {lease.months.map((cell, i) => (
                    <td key={i} className="num" style={{ fontSize: 12 }}>
                      {cell === 'V' ? <span className="badge critical">V</span>
                        : cell === 'FREE' ? <span className="badge warn">FREE</span>
                        : cell === 'NR' ? <span className="t-mute">—</span>
                        : money(cell)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  )
}

function Field({ label, value, href }: { label: string; value?: string; href?: string }) {
  return (
    <div>
      <span className="kpi-label">{label}</span>
      <div style={{ marginTop: 2 }}>
        {value
          ? href ? <a href={href}>{value}</a> : value
          : <span className="t-mute">Not recorded</span>}
      </div>
    </div>
  )
}

function ProfileForm({
  draft, setDraft, onSave, onCancel,
}: {
  draft: Profile
  setDraft: (p: Profile) => void
  onSave: () => void
  onCancel: () => void
}) {
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setDraft({ ...draft, [k]: v })
  return (
    <>
      <div className="form-grid">
        <label className="field"><span>Display name</span>
          <input value={draft.displayName ?? ''} onChange={(e) => set('displayName', e.target.value)} placeholder="Overrides the rent roll" />
        </label>
        <label className="field"><span>Business name</span>
          <input value={draft.businessName ?? ''} onChange={(e) => set('businessName', e.target.value)} />
        </label>
        <label className="field"><span>Contact person</span>
          <input value={draft.contactPerson ?? ''} onChange={(e) => set('contactPerson', e.target.value)} />
        </label>
        <label className="field"><span>Email</span>
          <input type="email" value={draft.email ?? ''} onChange={(e) => set('email', e.target.value)} placeholder="name@example.com" />
        </label>
        <label className="field full"><span>Mailing address</span>
          <input value={draft.mailingAddress ?? ''} onChange={(e) => set('mailingAddress', e.target.value)} />
        </label>
        <label className="field full"><span>Emergency contact</span>
          <input value={draft.emergencyContact ?? ''} onChange={(e) => set('emergencyContact', e.target.value)} placeholder="Name and number" />
        </label>
      </div>

      <div className="section-title" style={{ marginTop: 18, marginBottom: 8 }}>Phone numbers</div>
      <div className="stack" style={{ gap: 8 }}>
        {draft.phones.map((p, i) => (
          <div key={i} className="row" style={{ gap: 8 }}>
            <input style={{ width: 160 }} value={p.label} placeholder="Label"
              onChange={(e) => {
                const next = [...draft.phones]; next[i] = { ...p, label: e.target.value }; set('phones', next)
              }} />
            <input style={{ flex: 1, minWidth: 160 }} value={p.number} placeholder="708-555-0100"
              onChange={(e) => {
                const next = [...draft.phones]; next[i] = { ...p, number: e.target.value }; set('phones', next)
              }} />
            <button className="btn ghost sm danger"
              onClick={() => set('phones', draft.phones.filter((_, j) => j !== i))}>Remove</button>
          </div>
        ))}
        <div>
          <button className="btn sm" onClick={() => set('phones', [...draft.phones, { label: 'Phone', number: '' }])}>
            + Add a number
          </button>
        </div>
      </div>

      <div className="section-title" style={{ marginTop: 18, marginBottom: 8 }}>How they pay</div>
      <div className="form-grid">
        <label className="field"><span>Preferred method</span>
          <select value={draft.preferredPayment ?? ''}
            onChange={(e) => set('preferredPayment', (e.target.value || undefined) as PaymentMethodId | undefined)}>
            <option value="">Not recorded</option>
            {PAYMENT_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
        {draft.preferredPayment === 'custom' && (
          <label className="field"><span>Describe it</span>
            <input value={draft.customPaymentLabel ?? ''} placeholder="e.g. Venmo, cashier's check"
              onChange={(e) => set('customPaymentLabel', e.target.value)} />
          </label>
        )}
        <label className="field full"><span>Payment details</span>
          <input value={draft.paymentDetails ?? ''} placeholder="Zelle handle, account reference, whatever helps reconcile it"
            onChange={(e) => set('paymentDetails', e.target.value)} />
        </label>
        <label className="field full"><span>Notes</span>
          <textarea rows={2} value={draft.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
        </label>
      </div>

      <div className="form-actions">
        <button className="btn" onClick={onCancel}>Cancel</button>
        <button className="btn primary" onClick={onSave}>Save profile</button>
      </div>
    </>
  )
}
