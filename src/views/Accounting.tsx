import { useMemo, useState } from 'react'
import { Card, Kpi } from '../components/ui'
import { MonthlyAreaChart } from '../components/charts'
import { money, num, pct } from '../lib/format'
import { MONTHS } from '../lib/finance'
import {
  DEFAULT_LATE_FEE_CAP, GRACE_THROUGH_DAY, LATE_FEE_PER_DAY, MONTH_NAMES, cappedLateDays,
  chargesForYear, inTrackingWindow, statusOf, trackedCharges,
  type ChargeStatus, type CollectionSettings, type LateFeeCap, type Payment, type RentCharge,
} from '../lib/receivables'
import { PAYMENT_METHODS, methodLabel, resolveProfile, type PaymentMethodId, type TenantProfiles } from '../lib/tenants'
import type { PortfolioKpis } from '../lib/portfolio'
import { rentRoll } from '../data/rentRolls'
import { newId } from '../lib/expenses'

/** Status is carried by shape as well as colour, so it never depends on hue. */
const glyph = (s: ChargeStatus['state']): string =>
  s === 'paid' ? '✓' : s === 'partial' ? '½' : s === 'late' ? '!' : s === 'upcoming' ? '–' : '·'

export function Accounting({
  k, payments, setPayments, profiles, onTenant, settings, setSettings,
}: {
  k: PortfolioKpis
  payments: Payment[]
  setPayments: (next: Payment[]) => void
  profiles: TenantProfiles
  onTenant: (leaseId: string) => void
  settings: CollectionSettings
  setSettings: (next: CollectionSettings) => void
}) {
  const [propertyFilter, setPropertyFilter] = useState('all')
  const [recording, setRecording] = useState<{ charge: RentCharge; status: ChargeStatus } | null>(null)

  // The sheet stops when the year does; rent does not, so collection looks
  // past it and marks what it carried.
  const carry = { reportedMonths: rentRoll(k.fiscalYear).monthsReported, carryForward: true }

  const leases = useMemo(
    () => k.properties.flatMap((p) => p.leases)
      .filter((l) => propertyFilter === 'all' || l.propertyId === propertyFilter),
    [k, propertyFilter],
  )

  const allCharges = useMemo(
    () => chargesForYear(leases, k.fiscalYear, carry),
    [leases, k.fiscalYear, carry],
  )
  // Months before tracking began are out of scope entirely — see CollectionSettings.
  const charges = useMemo(
    () => trackedCharges(allCharges, settings.startPeriod),
    [allCharges, settings.startPeriod],
  )
  const statuses = useMemo(
    () => charges.map((c) => statusOf(c, payments, k.asOf, settings)),
    [charges, payments, k.asOf, settings],
  )
  const untracked = allCharges.length - charges.length
  const projected = charges.filter((c) => c.projected).length

  const byLease = useMemo(() => {
    const m = new Map<string, ChargeStatus[]>()
    for (const s of statuses) {
      const list = m.get(s.charge.leaseId) ?? []
      list.push(s)
      m.set(s.charge.leaseId, list)
    }
    return m
  }, [statuses])

  // Everything on the sheet, and — separately — the part of it that has actually
  // fallen due. Rent for December is billed but not owed, so measuring collection
  // against the whole year would read as months of arrears every January.
  const billed = statuses.reduce((a, s) => a + s.charge.amountDue, 0)
  const due = statuses.filter((s) => s.isDue)
  const upcoming = statuses.filter((s) => !s.isDue)
  const dueBilled = due.reduce((a, s) => a + s.charge.amountDue, 0)
  const collected = due.reduce((a, s) => a + s.paid, 0)
  const outstanding = due.reduce((a, s) => a + s.balance, 0)
  const lateFees = statuses.reduce((a, s) => a + s.lateFee, 0)
  // A fee charged and a fee collected are different questions, and the second
  // is the one with money still to come in behind it.
  const feeMonths = statuses.filter((s) => s.lateFeeOutstanding > 0)
  const feesOwed = feeMonths.reduce((a, s) => a + s.lateFeeOutstanding, 0)
  const settled = due.filter((s) => s.state === 'paid').length

  // Billed and collected side by side, month by month.
  const billedByMonth = new Array(12).fill(0)
  const collectedByMonth = new Array(12).fill(0)
  for (const s of statuses) {
    billedByMonth[s.charge.month] += s.charge.amountDue
    collectedByMonth[s.charge.month] += s.paid
  }

  const propName = (id: string) => k.properties.find((p) => p.property.id === id)?.property.name ?? id

  const savePayment = (p: Payment) => {
    const existing = payments.findIndex((x) => x.id === p.id)
    setPayments(existing >= 0
      ? payments.map((x) => (x.id === p.id ? p : x))
      : [...payments, p])
    setRecording(null)
  }
  const deletePayment = (id: string) => setPayments(payments.filter((p) => p.id !== id))

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Rent collection — {k.fiscalYear}</h1>
        <p className="page-sub">
          Every month of rent owed, and what has come in against it. Rent falls due on the 1st with a
          grace period through the {GRACE_THROUGH_DAY}th; after that a late fee of {money(LATE_FEE_PER_DAY)} a
          day accrues until the balance clears. Click any cell to record a payment — it turns green once
          the month is settled.
        </p>
      </div>

      <div className="toolbar">
        <label className="field" style={{ minWidth: 210 }}>
          <span>Property</span>
          <select value={propertyFilter} onChange={(e) => setPropertyFilter(e.target.value)}>
            <option value="all">All properties</option>
            {k.properties.filter((p) => p.leases.length > 0).map((p) => (
              <option key={p.property.id} value={p.property.id}>{p.property.name}</option>
            ))}
          </select>
        </label>
        <label className="field" style={{ minWidth: 230 }}>
          <span>Everything collected through</span>
          <select
            value={settings.settledThrough ?? ''}
            onChange={(e) => setSettings({
              ...settings,
              settledThrough: e.target.value || undefined,
              settledDeclaredOn: e.target.value ? new Date().toISOString().slice(0, 10) : undefined,
            })}
          >
            <option value="">Nothing declared</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={`${k.fiscalYear}-${String(i + 1).padStart(2, '0')}`}>
                {MONTH_NAMES[i]} {k.fiscalYear} and earlier
              </option>
            ))}
          </select>
        </label>
        <label className="field" style={{ minWidth: 210 }}>
          <span>Track collection from</span>
          <select
            value={settings.startPeriod ?? ''}
            onChange={(e) => setSettings({ ...settings, startPeriod: e.target.value || undefined })}
          >
            <option value="">The whole year</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={`${k.fiscalYear}-${String(i + 1).padStart(2, '0')}`}>
                {MONTH_NAMES[i]} {k.fiscalYear} onward
              </option>
            ))}
          </select>
        </label>
        <div className="spacer" />
        <span className="t-mute">
          {charges.length} monthly charges · {payments.length} payments recorded
          {untracked > 0 && ` · ${untracked} before tracking`}
        </span>
      </div>

      <div className="kpi-grid">
        <Kpi accent label="Billed to date" value={money(dueBilled)}
          note={`${num(due.length)} months fallen due of ${num(charges.length)}`} />
        <Kpi accent label="Collected" value={money(collected)}
          note={dueBilled > 0 ? `${pct((collected / dueBilled) * 100)} of what has come due` : undefined} />
        <Kpi label="Outstanding" value={money(outstanding)} warn={outstanding > 0}
          note={outstanding > 0
            ? `${num(due.filter((s) => s.balance > 0.005).length)} months unsettled`
            : 'Every month that has come due is settled'} />
        <Kpi label="Late fees accrued" value={money(lateFees)} warn={lateFees > 0}
          note={(() => {
            const n = statuses.filter((s) => s.lateDays > 0).length
            return `${num(n)} ${n === 1 ? 'month' : 'months'} past grace`
          })()} />
        <Kpi label="Late fees still owed" value={money(feesOwed)} warn={feesOwed > 0}
          note={feesOwed > 0
            ? `${num(feeMonths.length)} ${feeMonths.length === 1 ? 'month where' : 'months where'} `
              + 'the rent is in and the fee is not'
            : 'Every fee charged has been collected or waived'} />
        <Kpi label="Months settled" value={`${num(settled)} of ${num(due.length)}`}
          note="Of those that have fallen due" />
        <Kpi label="Not yet due" value={money(upcoming.reduce((a, s) => a + s.charge.amountDue, 0))}
          note={upcoming.length
            ? `${num(upcoming.length)} months still to come${projected > 0 ? `, ${num(projected)} carried forward` : ''}`
            : 'The year is fully billed'} />
      </div>

      {settings.settledThrough && (
        <div className="callout" style={{ marginTop: 18 }}>
          <div className="callout-title">
            Everything through {MONTH_NAMES[Number(settings.settledThrough.slice(5)) - 1]}{' '}
            {settings.settledThrough.slice(0, 4)} is settled by declaration
          </div>
          <p>
            {settings.settledNote
              ?? 'Those months read as collected because the owner said so, not because a payment '
                + 'was recorded against each one.'}
            {' '}They show green with a dashed outline to keep them apart from a month with a real
            payment behind it, and they carry no payment date — so they never appear in days-to-pay
            or in the on-time record. Recording an actual payment on any of them replaces the
            declaration for that month.
          </p>
        </div>
      )}

      {payments.length === 0 && !settings.settledThrough && (
        <div className="callout" style={{ marginTop: 18 }}>
          <div className="callout-title">No payments recorded — every month below reads as unpaid</div>
          <p>
            The charges come from the rent roll: this is what each tenant owes for each month of{' '}
            {k.fiscalYear}. Nothing has been marked collected yet, so the outstanding balance and the
            late fees above are what <em>would</em> be owed if none of this rent had ever come in —
            not a claim that it is genuinely unpaid. As money arrives, click the month and record it;
            the receivables ledger and the payer analytics build from those entries.
          </p>
          <p style={{ marginTop: 8 }}>
            If you are starting from today rather than backfilling the year, set{' '}
            <strong>Track collection from</strong> above to the month you are starting in. Earlier
            months then fall out of scope instead of counting as debt.
          </p>
        </div>
      )}

      <div className="section">
        <Card title="Billed against collected" hint="by month">
          <MonthlyAreaChart series={billedByMonth} label="Rent billed" />
          <div className="row" style={{ marginTop: 12, gap: 24 }}>
            <div className="stack">
              <span className="kpi-label">Billed</span>
              <span className="t-mono t-strong">{money(billed)}</span>
            </div>
            <div className="stack">
              <span className="kpi-label">Collected</span>
              <span className="t-mono t-paid">{money(collected)}</span>
            </div>
            <div className="stack">
              <span className="kpi-label">Outstanding</span>
              <span className="t-mono t-red">{money(outstanding)}</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="section">
        <div className="section-title">
          Collection grid
          <span className="hint">
            ✓ paid · ✓ dashed = settled by declaration · · due · ! past grace · – not yet due ·
            ~ rent carried past the end of the sheet
          </span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ minWidth: 190 }}>Tenant</th>
                <th style={{ minWidth: 130 }}>Property</th>
                {MONTHS.map((m) => <th key={m} className="num" style={{ minWidth: 82 }}>{m}</th>)}
                <th className="num">Owed</th>
              </tr>
            </thead>
            <tbody>
              {[...byLease.entries()].map(([leaseId, list]) => {
                const first = list[0]
                const owed = list.reduce((a, s) => a + s.balance, 0)
                return (
                  <tr key={leaseId}>
                    <td>
                      <button className="btn ghost sm" onClick={() => onTenant(leaseId)} style={{ padding: 0 }}>
                        {first.charge.tenant}
                      </button>
                      <div className="t-mute" style={{ fontSize: 11 }}>Unit {first.charge.unit}</div>
                    </td>
                    <td className="t-mute" style={{ fontSize: 12 }}>{propName(first.charge.propertyId)}</td>
                    {MONTHS.map((_, month) => {
                      const s = list.find((x) => x.charge.month === month)
                      if (!s) {
                        const before = !inTrackingWindow(
                          { period: `${k.fiscalYear}-${String(month + 1).padStart(2, '0')}` } as RentCharge,
                          settings.startPeriod,
                        )
                        return (
                          <td key={month}>
                            <span className="collect-cell none" title={before ? 'Before tracking began' : 'No rent billed'}>
                              {before ? '·' : '—'}
                            </span>
                          </td>
                        )
                      }
                      return (
                        <td key={month}>
                          <button
                            className={`collect-cell ${s.state}${s.settledByDeclaration ? ' declared' : ''}`
                              + `${s.lateFeeOutstanding > 0 ? ' fee-owed' : ''}`}
                            title={[
                              `${MONTH_NAMES[month]}: ${money(s.charge.amountDue)} due, ${money(s.paid)} paid`,
                              s.lateFeeOutstanding > 0
                                ? `${money(s.lateFeeOutstanding)} of late fee still owed`
                                : s.lateFee > 0 ? `${money(s.lateFee)} late fee, collected` : '',
                              s.settledByDeclaration
                                ? `Settled by declaration through ${settings.settledThrough} — click to record the actual payment`
                                : '',
                              s.charge.projected
                                ? 'Carried forward from the last month the rent roll covers'
                                : '',
                            ].filter(Boolean).join(' · ')}
                            onClick={() => setRecording({ charge: s.charge, status: s })}
                          >
                            {glyph(s.state)} {Math.round(s.state === 'paid' ? s.paid : s.balance).toLocaleString()}
                            {s.charge.projected && <span aria-hidden> ~</span>}
                            {s.lateFeeOutstanding > 0 && (
                              <span className="fee-flag" aria-hidden>+{Math.round(s.lateFeeOutstanding)}</span>
                            )}
                          </button>
                        </td>
                      )
                    })}
                    <td className={`num t-strong ${owed > 0 ? 't-red' : 't-paid'}`}>
                      {owed > 0 ? money(owed) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="label" colSpan={2}>{byLease.size} tenants</td>
                {MONTHS.map((_, month) => {
                  const b = billedByMonth[month]
                  const c = collectedByMonth[month]
                  return (
                    <td key={month} className="num" style={{ fontSize: 11 }}>
                      {b > 0 ? (
                        <>
                          <div className={c >= b - 0.005 ? 't-paid' : ''}>{Math.round(c / 1000)}k</div>
                          <div className="t-mute">of {Math.round(b / 1000)}k</div>
                        </>
                      ) : <span className="t-mute">—</span>}
                    </td>
                  )
                })}
                <td className="num">{money(outstanding)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="section">
        <div className="section-title">By property</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Property</th><th className="num">Billed</th><th className="num">Collected</th>
                <th className="num">Outstanding</th><th className="num">Rate</th><th className="num">Late fees</th>
              </tr>
            </thead>
            <tbody>
              {k.properties.filter((p) => p.leases.length > 0).map((p) => {
                const mine = statuses.filter((s) => s.charge.propertyId === p.property.id)
                if (mine.length === 0) return null
                const b = mine.reduce((a, s) => a + s.charge.amountDue, 0)
                const c = mine.reduce((a, s) => a + s.paid, 0)
                const o = mine.reduce((a, s) => a + s.balance, 0)
                const f = mine.reduce((a, s) => a + s.lateFee, 0)
                return (
                  <tr key={p.property.id}>
                    <td className="t-strong">{p.property.name}</td>
                    <td className="num">{money(b)}</td>
                    <td className={`num ${c > 0 ? 't-paid' : 't-mute'}`}>{money(c)}</td>
                    <td className={`num ${o > 0 ? 't-red' : 't-mute'}`}>{o > 0 ? money(o) : '—'}</td>
                    <td className="num">{b > 0 ? pct((c / b) * 100, 0) : '—'}</td>
                    <td className={`num ${f > 0 ? 't-red' : 't-mute'}`}>{f > 0 ? money(f) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="label">Total</td>
                <td className="num">{money(billed)}</td>
                <td className="num">{money(collected)}</td>
                <td className="num">{money(outstanding)}</td>
                <td className="num">{billed > 0 ? pct((collected / billed) * 100, 0) : '—'}</td>
                <td className="num">{money(lateFees)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {payments.length > 0 && (
        <div className="section">
          <div className="section-title">Payments recorded</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Paid on</th><th>Tenant</th><th>For</th><th className="num">Amount</th><th>Method</th><th>Reference</th><th /></tr>
              </thead>
              <tbody>
                {[...payments].sort((a, b) => b.paidOn.localeCompare(a.paidOn)).map((p) => {
                  const lease = leases.find((l) => l.id === p.leaseId)
                  return (
                    <tr key={p.id}>
                      <td className="t-mono t-nowrap">{p.paidOn}</td>
                      <td className="t-strong">{lease?.tenant ?? p.leaseId}</td>
                      <td className="t-mute">{p.period}</td>
                      <td className="num t-paid">{money(p.amount)}</td>
                      <td>{methodLabel(p.method, p.customMethodLabel)}</td>
                      <td className="t-mute">{p.reference ?? '—'}</td>
                      <td><button className="btn ghost sm danger" onClick={() => deletePayment(p.id)}>Delete</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {recording && (
        <RecordPayment
          charge={recording.charge}
          status={recording.status}
          suggestedMethod={resolveProfile(recording.charge.leaseId, [], profiles).preferredPayment}
          cap={settings.lateFeeCap ?? DEFAULT_LATE_FEE_CAP}
          onSave={savePayment}
          onDelete={deletePayment}
          onClose={() => setRecording(null)}
        />
      )}
    </>
  )
}

function RecordPayment({
  charge, status, suggestedMethod, cap, onSave, onDelete, onClose,
}: {
  charge: RentCharge
  status: ChargeStatus
  suggestedMethod?: PaymentMethodId
  /** Where the landlord stops the fee, so the dialog quotes what he charges. */
  cap: LateFeeCap
  onSave: (p: Payment) => void
  onDelete: (id: string) => void
  onClose: () => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [amount, setAmount] = useState(status.balance > 0 ? String(status.balance) : '')
  const [paidOn, setPaidOn] = useState(today)
  const [method, setMethod] = useState<PaymentMethodId | ''>(suggestedMethod ?? '')
  const [customLabel, setCustomLabel] = useState('')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [waive, setWaive] = useState(false)
  const [feeCollected, setFeeCollected] = useState('')

  // Everything recalculates from the date typed in, because that is the one
  // fact the person recording a payment actually knows. Days past grace, the
  // fee those days come to, and the total to collect all move with it.
  const preview = useMemo(() => {
    const paid = new Date(`${paidOn}T00:00:00`)
    const days = Number.isNaN(paid.getTime()) ? 0 : Math.max(0, Math.floor(
      (new Date(paid.getFullYear(), paid.getMonth(), paid.getDate()).getTime()
        - new Date(charge.graceThrough.getFullYear(), charge.graceThrough.getMonth(), charge.graceThrough.getDate()).getTime())
      / 86_400_000))
    // Once the rent has cleared the fee is history, not a projection: it stopped
    // the day the balance did. Typing a later date must not make it grow again.
    const settled = status.balance <= 0.005
    const runDays = settled ? status.lateDays : days
    // The landlord's standing cap, so the figure here is what he would actually
    // charge rather than what the days multiply out to.
    const charged = cappedLateDays(runDays, charge, cap)
    const fee = waive ? 0 : charged * LATE_FEE_PER_DAY
    const owing = Math.max(0, fee - status.lateFeePaid)
    return {
      days: runDays,
      charged,
      capped: charged < runDays,
      settled,
      fee,
      feeOwing: owing,
      rentOwing: status.balance,
      total: status.balance + owing,
    }
  }, [paidOn, charge, waive, cap, status.balance, status.lateDays, status.lateFeePaid])

  const submit = () => {
    const value = Number.parseFloat(amount.replace(/[$,]/g, '')) || 0
    const fee = Number.parseFloat(feeCollected.replace(/[$,]/g, '')) || 0
    // A fee paid on its own is a real thing to record, so an empty rent amount
    // is only an error when there is no fee either.
    if (value <= 0 && fee <= 0) {
      alert('Enter a rent amount or a late fee greater than zero.')
      return
    }
    onSave({
      id: newId(),
      leaseId: charge.leaseId,
      period: charge.period,
      amount: value,
      paidOn,
      method: method || undefined,
      customMethodLabel: method === 'custom' ? customLabel : undefined,
      reference: reference.trim() || undefined,
      note: note.trim() || undefined,
      waiveLateFee: waive || undefined,
      lateFeeCollected: fee > 0 ? fee : undefined,
      recordedBy: localStorage.getItem('ntp.editor') ?? undefined,
      recordedAt: new Date().toISOString(),
    })
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2 className="modal-title">Record a payment</h2>
            <div className="t-mute" style={{ fontSize: 12 }}>
              {charge.tenant} · {MONTH_NAMES[charge.month]} {charge.year} · {money(charge.amountDue)} due on the 1st
            </div>
          </div>
          <button className="btn ghost sm" onClick={onClose}>Close</button>
        </div>

        <div className="kpi-grid" style={{ marginBottom: 16 }}>
          <Kpi label="Due" value={money(charge.amountDue)} />
          <Kpi label="Paid so far" value={money(status.paid)} />
          <Kpi label="Balance" value={money(status.balance)} warn={status.balance > 0} />
        </div>

        <div className="form-grid">
          <label className="field"><span>Amount</span>
            <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label className="field"><span>Date received</span>
            <input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
          </label>
          <label className="field"><span>Method</span>
            <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethodId | '')}>
              <option value="">Not recorded</option>
              {PAYMENT_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </label>
          {method === 'custom' && (
            <label className="field"><span>Describe it</span>
              <input value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} />
            </label>
          )}
          <label className="field"><span>Reference</span>
            <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Check no., confirmation" />
          </label>
          <label className="field full"><span>Note</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        </div>

        {/* The whole point of this panel: type the date the money arrived and
            read off what is owed. Nobody should be counting days on a calendar
            or multiplying by fifteen in their head. */}
        <div className={`callout${preview.days > 0 && !waive ? '' : ' neutral'}`}
          style={{ marginTop: 16, marginBottom: 0 }}>
          <div className="callout-title">
            {waive ? 'Late fee waived'
              : preview.days === 0 ? 'Paid within grace — no late fee'
                : preview.settled
                  ? `Settled ${preview.days} days past grace`
                  : `${preview.days} day${preview.days === 1 ? '' : 's'} past grace and counting`}
          </div>

          <div className="table-wrap" style={{ border: 0, marginTop: 4 }}>
            <table>
              <tbody>
                <tr>
                  <td>Rent outstanding</td>
                  <td className="num t-strong">{money(preview.rentOwing)}</td>
                </tr>
                <tr>
                  <td>
                    Late fee
                    <span className="t-mute" style={{ fontSize: 11.5 }}>
                      {' '}· {money(LATE_FEE_PER_DAY)} a day from{' '}
                      {new Date(charge.graceThrough.getTime() + 86_400_000)
                        .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {preview.charged > 0 && !waive
                        && ` · ${preview.charged} × ${money(LATE_FEE_PER_DAY)}`}
                    </span>
                    {preview.capped && !waive && (
                      <div className="t-mute" style={{ fontSize: 11.5 }}>
                        Ran {preview.days} days; charged {preview.charged}, where the fee stops.
                      </div>
                    )}
                  </td>
                  <td className={`num t-strong ${preview.feeOwing > 0 ? 't-red' : 't-mute'}`}>
                    {money(preview.feeOwing)}
                  </td>
                </tr>
                {status.lateFeePaid > 0 && (
                  <tr>
                    <td className="t-mute">Late fee already collected</td>
                    <td className="num t-mute">− {money(status.lateFeePaid)}</td>
                  </tr>
                )}
                <tr>
                  <td className="label">Total to collect</td>
                  <td className="num t-strong">{money(preview.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {preview.rentOwing > 0 && (
              <button className="btn ghost sm" type="button"
                onClick={() => { setAmount(String(preview.rentOwing)); setFeeCollected('') }}>
                Rent only — {money(preview.rentOwing)}
              </button>
            )}
            {preview.feeOwing > 0 && (
              <button className="btn ghost sm" type="button"
                onClick={() => {
                  setAmount(String(preview.rentOwing))
                  setFeeCollected(String(preview.feeOwing))
                }}>
                {preview.rentOwing > 0
                  ? `Rent and fee — ${money(preview.total)}`
                  : `Fee only — ${money(preview.feeOwing)}`}
              </button>
            )}
          </div>

          <div className="form-grid" style={{ marginTop: 12 }}>
            <label className="field">
              <span>Late fee collected</span>
              <input type="number" step="0.01" value={feeCollected} placeholder="0.00"
                onChange={(e) => setFeeCollected(e.target.value)} />
            </label>
            <label className="row" style={{ gap: 7, fontSize: 13, alignItems: 'center' }}>
              <input type="checkbox" checked={waive} style={{ minWidth: 'auto' }}
                onChange={(e) => { setWaive(e.target.checked); if (e.target.checked) setFeeCollected('') }} />
              Waive the fee for this month
            </label>
          </div>

          <p className="t-mute" style={{ fontSize: 12, marginTop: 8 }}>
            Rent fell due {charge.dueDate.toLocaleDateString()} with grace through{' '}
            {charge.graceThrough.toLocaleDateString()}. The fee runs from the date above until
            the rent clears
            {cap.mode === 'days' && `, and stops at ${cap.days ?? 25} days — ${money((cap.days ?? 25) * LATE_FEE_PER_DAY)}`}
            {cap.mode === 'month-end' && ', and stops at the last day of the month'}
            .
          </p>
        </div>

        {status.payments.length > 0 && (
          <>
            <div className="section-title" style={{ marginTop: 18, marginBottom: 8 }}>Already recorded</div>
            <div className="stack" style={{ gap: 5 }}>
              {status.payments.map((p) => (
                <div key={p.id} className="receipt-item">
                  <span className="name">{p.paidOn} · {money(p.amount)} · {methodLabel(p.method, p.customMethodLabel)}</span>
                  <button className="btn ghost sm danger" onClick={() => { onDelete(p.id); onClose() }}>Remove</button>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="form-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={submit}>Record payment</button>
        </div>
      </div>
    </div>
  )
}
