import { useMemo, useState } from 'react'
import { Card, Empty, Kpi } from '../components/ui'
import { DonutChart, RankedBars } from '../components/charts'
import { dateLabel, money, moneyExact, num, signedPct } from '../lib/format'
import {
  USE_LABEL, annualisedGrowth, daysToBalloon, editCountFor, impliedNoteRate, newHoldingId,
  resolveTrust, trustTotals, yearsHeld,
  type HoldingUse, type ResolvedHolding, type TrustEdit, type TrustHolding, type TrustState,
} from '../lib/trust'
import { TRUST_HOLDINGS, TRUST_NAME, TRUST_SCHEDULE_DATE } from '../data/trust'
import type { PortfolioKpis } from '../lib/portfolio'

const USES: HoldingUse[] = ['rental', 'personal', 'resale', 'note']

const n = (v: string): number | undefined => {
  const x = Number(v.replace(/[^0-9.-]/g, ''))
  return v.trim() === '' || Number.isNaN(x) ? undefined : x
}

/**
 * The trust's schedule of assets.
 *
 * The paper schedule is the ownership record and is kept as transcribed. Every
 * field can be corrected here, but a correction is stored as a patch over the
 * document rather than replacing it, so what the trust actually says stays
 * recoverable and every hand edit is visible as one.
 */
export function Trust({
  k, state, setState, capRate, onProperty,
}: {
  k: PortfolioKpis
  state: TrustState
  setState: (next: TrustState) => void
  capRate: number
  onProperty: (id: string) => void
}) {
  const [editing, setEditing] = useState<ResolvedHolding | null>(null)
  const [useFilter, setUseFilter] = useState<HoldingUse | 'all'>('all')

  // A rental's worth is its own net income capitalised — the same figure the
  // valuation screen shows, so the two can never disagree.
  const portfolioValue = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of k.properties) {
      if (p.netAfterTax > 0 && capRate > 0) m.set(p.property.id, (p.netAfterTax / capRate) * 100)
    }
    return (id: string) => m.get(id)
  }, [k, capRate])

  const rows = useMemo(
    () => resolveTrust(TRUST_HOLDINGS, state, portfolioValue),
    [state, portfolioValue],
  )
  const totals = trustTotals(rows)
  const edits = editCountFor(state)
  const shown = rows.filter((r) => useFilter === 'all' || r.use === useFilter)
  const flagged = rows.filter((r) => r.needsConfirmation)

  const saveEdit = (id: string, patch: TrustEdit) => {
    const next = { ...state.edits[id], ...patch, updatedAt: new Date().toISOString() }
    // Drop keys the user cleared, so an emptied field stops counting as an edit.
    for (const key of Object.keys(next) as (keyof TrustEdit)[]) {
      if (next[key] === undefined) delete next[key]
    }
    setState({ ...state, edits: { ...state.edits, [id]: next } })
    setEditing(null)
  }

  const revert = (id: string) => {
    const { [id]: _dropped, ...rest } = state.edits
    setState({ ...state, edits: rest })
    setEditing(null)
  }

  const remove = (h: ResolvedHolding) => {
    setState(h.isAdded
      ? { ...state, added: state.added.filter((a) => a.id !== h.id) }
      : { ...state, removed: [...state.removed, h.id] })
    setEditing(null)
  }

  const addHolding = () => {
    const seq = Math.max(0, ...rows.map((r) => r.seq)) + 1
    const fresh: TrustHolding = {
      id: newHoldingId(), seq, purchaseDate: '', address: '', propertyType: '', use: 'rental',
    }
    setState({ ...state, added: [...state.added, fresh] })
    setEditing({ ...fresh, valueFromPortfolio: false, editedFields: [], isAdded: true })
  }

  const notes = rows.filter((r) => r.sellerNote)

  const gain = totals.comparableCost > 0
    ? ((totals.comparableValue - totals.comparableCost) / totals.comparableCost) * 100
    : undefined

  return (
    <div className="stack">
      <div className="page-head">
        <h1 className="page-title">{TRUST_NAME}</h1>
        <p className="page-sub">
          Schedule of assets, as updated {dateLabel(TRUST_SCHEDULE_DATE)} — {num(TRUST_HOLDINGS.length)}{' '}
          holdings with the purchase date, address and price the trust records. Every field is
          editable; corrections are kept as changes over the document rather than replacing it, so
          what the schedule itself says stays recoverable.
          {edits > 0 && ` ${edits} ${edits === 1 ? 'change has' : 'changes have'} been made.`}
        </p>
      </div>

      <div className="kpi-grid">
        <Kpi accent label="Total paid" value={money(totals.purchaseTotal)}
          note={`Across ${num(totals.count)} holdings since 1993`} />
        <Kpi accent label="Estimated value" value={money(totals.valueTotal)}
          note={totals.withoutValue > 0
            ? `${num(totals.withoutValue)} with no value yet — total is understated`
            : 'Every holding valued'}
          warn={totals.withoutValue > 0} />
        <Kpi label="Gain on cost" value={gain === undefined ? '—' : signedPct(gain, 0)}
          note={gain === undefined ? 'Needs both figures'
            : `${money(totals.comparableValue - totals.comparableCost)} on the holdings with both`} />
        <Kpi label="Rental" value={money(totals.byUse.rental.value)}
          note={`${num(totals.byUse.rental.count)} let · ${money(totals.byUse.rental.purchase)} paid`} />
        <Kpi label="Personal" value={money(totals.byUse.personal.value)}
          note={`${num(totals.byUse.personal.count)} held · ${money(totals.byUse.personal.purchase)} paid`} />
        <Kpi label="Held for resale" value={money(totals.byUse.resale.purchase)}
          note={`${num(totals.byUse.resale.count)} — at cost until it is valued`} />
        <Kpi label="Notes receivable" value={money(totals.byUse.note.value)}
          note={notes.length
            ? `${num(notes.length)} sold on seller financing`
            : 'None'} />
      </div>

      {flagged.length > 0 && (
        <div className="callout">
          <div className="callout-title">
            {num(flagged.length)} {flagged.length === 1 ? 'figure is' : 'figures are'} worth
            confirming against the closing paperwork
          </div>
          {flagged.map((f) => (
            <p key={f.id} style={{ marginTop: 6 }}>
              <strong>{f.address}</strong> — {f.needsConfirmation}{' '}
              <button className="link" onClick={() => setEditing(f)}>Correct it</button>
            </p>
          ))}
        </div>
      )}

      {notes.length > 0 && (
        <Card
          title="Sold on seller financing"
          hint="what the trust holds is the buyer's note, not the building"
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Property</th><th>Buyer</th><th>Sold</th>
                  <th className="num">Balance</th><th className="num">Monthly</th>
                  <th className="num">Rate implied</th><th>Balloon due</th><th className="num">Paid for</th>
                </tr>
              </thead>
              <tbody>
                {notes.map((r) => {
                  const sn = r.sellerNote!
                  const days = daysToBalloon(sn, k.asOf)
                  const rate = impliedNoteRate(sn)
                  return (
                    <tr key={r.id}>
                      <td className="t-strong">{r.address.split(',')[0]}</td>
                      <td className="t-mute">{sn.buyer ?? '—'}</td>
                      <td className="t-mono t-mute" style={{ fontSize: 12 }}>{dateLabel(sn.soldDate)}</td>
                      <td className="num t-strong">{money(sn.balance)}</td>
                      <td className="num">{sn.monthlyPayment ? moneyExact(sn.monthlyPayment) : '—'}</td>
                      <td className="num t-mute">{rate === undefined ? '—' : `${rate.toFixed(2)}%`}</td>
                      <td>
                        <span className="t-mono" style={{ fontSize: 12 }}>{dateLabel(sn.maturityDate)}</span>
                        {days !== undefined && (
                          <div className={`${days < 180 ? 't-red' : 't-mute'}`} style={{ fontSize: 11 }}>
                            {days < 0
                              ? `${num(Math.abs(days))} days overdue`
                              : `in ${num(days)} days`}
                          </div>
                        )}
                      </td>
                      <td className="num t-mute">{r.purchasePrice ? money(r.purchasePrice) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="t-mute" style={{ fontSize: 12, marginTop: 8 }}>
            A seller-financed note is worth the balance outstanding, not what the building would
            capitalise at — so these are valued at their balance and kept out of the rental estate.
            The rate shown is the annual payment against the balance: a sanity check on the terms,
            not the note's stated interest rate.
            {notes.some((r) => r.sellerNote?.note) && ' '}
            {notes.map((r) => r.sellerNote?.note).filter(Boolean).join(' ')}
          </p>
        </Card>
      )}

      <div className="grid-2">
        <Card title="What the trust holds" hint="by estimated value">
          {totals.valueTotal > 0 ? (
            <DonutChart
              slices={USES
                .map((u) => ({ id: u, label: USE_LABEL[u], value: totals.byUse[u].value }))
                .filter((s) => s.value > 0)}
              centreValue={money(totals.valueTotal)}
              centreLabel="Estimated"
              onSelect={(id) => setUseFilter(useFilter === id ? 'all' : id as HoldingUse)}
            />
          ) : <Empty>No values recorded yet.</Empty>}
        </Card>
        <Card title="Largest holdings" hint="estimated value, highest first">
          <RankedBars
            items={[...rows]
              .filter((r) => (r.estimatedValue ?? 0) > 0)
              .sort((a, b) => (b.estimatedValue ?? 0) - (a.estimatedValue ?? 0))
              .slice(0, 10)
              .map((r) => ({
                id: r.id,
                label: r.address.split(',')[0],
                value: r.estimatedValue ?? 0,
                sub: `${r.propertyType.split('(')[0].trim()} · bought ${r.purchaseDate.slice(0, 4)}`,
              }))}
            onSelect={(id) => {
              const row = rows.find((r) => r.id === id)
              if (row?.propertyId && k.properties.some((p) => p.property.id === row.propertyId)) {
                onProperty(row.propertyId)
              }
            }}
          />
        </Card>
      </div>

      <Card
        title="Schedule of assets"
        hint={shown.length === rows.length
          ? `${num(rows.length)} holdings`
          : `${num(shown.length)} of ${num(rows.length)}`}
        actions={
          <div className="row" style={{ gap: 8 }}>
            <select value={useFilter} onChange={(e) => setUseFilter(e.target.value as HoldingUse | 'all')}>
              <option value="all">All holdings</option>
              {USES.map((u) => <option key={u} value={u}>{USE_LABEL[u]}</option>)}
            </select>
            <button className="btn sm" onClick={addHolding}>Add a holding</button>
          </div>
        }
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 32 }}>#</th>
                <th>Purchased</th>
                <th>Address</th>
                <th>Property type</th>
                <th>Use</th>
                <th className="num">Purchase price</th>
                <th className="num">Estimated value</th>
                <th className="num">Gain</th>
                <th className="num">Per year</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const years = yearsHeld(r, k.asOf)
                const growth = annualisedGrowth(r, k.asOf)
                const gainPct = r.purchasePrice && r.estimatedValue
                  ? ((r.estimatedValue - r.purchasePrice) / r.purchasePrice) * 100
                  : undefined
                const linked = r.propertyId
                  && k.properties.some((p) => p.property.id === r.propertyId)
                return (
                  <tr key={r.id}>
                    <td className="t-mono t-mute">{r.seq}</td>
                    <td className="t-mono t-nowrap" style={{ fontSize: 12 }}>
                      {dateLabel(r.purchaseDate)}
                      {years !== undefined && (
                        <div className="t-mute" style={{ fontSize: 11 }}>{years.toFixed(0)} yr</div>
                      )}
                    </td>
                    <td>
                      {linked ? (
                        <button className="link t-strong" onClick={() => onProperty(r.propertyId!)}>
                          {r.address}
                        </button>
                      ) : <span className="t-strong">{r.address || <span className="t-mute">No address</span>}</span>}
                      {r.note && (
                        <div className="t-mute" style={{ fontSize: 11.5, maxWidth: 340 }}>{r.note}</div>
                      )}
                    </td>
                    <td className="t-mute" style={{ fontSize: 12, maxWidth: 240 }}>{r.propertyType}</td>
                    <td>
                      <span className={`badge ${r.use === 'rental' ? 'ok' : r.use === 'resale' ? 'warn' : 'mute'}`}>
                        {USE_LABEL[r.use]}
                      </span>
                    </td>
                    <td className="num">
                      {r.purchasePrice === undefined ? <span className="t-mute">—</span> : money(r.purchasePrice)}
                      {r.needsConfirmation && (
                        <div className="t-red" style={{ fontSize: 11 }} title={r.needsConfirmation}>check</div>
                      )}
                      {r.editedFields.includes('purchasePrice') && (
                        <div className="t-mute" style={{ fontSize: 11 }}>edited</div>
                      )}
                    </td>
                    <td className="num">
                      {r.estimatedValue === undefined ? <span className="t-mute">not valued</span> : (
                        <span title={r.valueFromPortfolio
                          ? `Capitalised from this building's net income at ${capRate}%`
                          : 'Entered by hand'}>
                          {money(r.estimatedValue)}{r.valueFromPortfolio ? '*' : ''}
                        </span>
                      )}
                    </td>
                    <td className="num">
                      {gainPct === undefined ? <span className="t-mute">—</span> : (
                        <span className={gainPct < 0 ? 't-red' : 't-paid'}>{signedPct(gainPct, 0)}</span>
                      )}
                    </td>
                    <td className="num t-mute">
                      {growth === undefined ? '—' : `${growth.toFixed(1)}%`}
                    </td>
                    <td>
                      <button className="btn ghost sm" onClick={() => setEditing(r)}>Edit</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="label" colSpan={5}>
                  {num(shown.length)} {shown.length === 1 ? 'holding' : 'holdings'}
                </td>
                <td className="num">{money(shown.reduce((a, r) => a + (r.purchasePrice ?? 0), 0))}</td>
                <td className="num">{money(shown.reduce((a, r) => a + (r.estimatedValue ?? 0), 0))}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="t-mute" style={{ fontSize: 12, marginTop: 8 }}>
          * Value capitalised from that building's own net income at the {capRate}% cap rate, rather
          than typed. Enter a figure and it takes over — an appraisal knows more than a cap rate
          does. Rows with no value are counted as zero and reported above, never guessed at.
          {totals.withoutValue > 0 && ` ${num(totals.withoutValue)} still need one.`}
        </p>
      </Card>

      {editing && (
        <HoldingForm
          holding={editing}
          edit={state.edits[editing.id] ?? {}}
          capRate={capRate}
          onSave={(patch) => saveEdit(editing.id, patch)}
          onRevert={() => revert(editing.id)}
          onRemove={() => remove(editing)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function HoldingForm({
  holding, edit, capRate, onSave, onRevert, onRemove, onClose,
}: {
  holding: ResolvedHolding
  edit: TrustEdit
  capRate: number
  onSave: (patch: TrustEdit) => void
  onRevert: () => void
  onRemove: () => void
  onClose: () => void
}) {
  const [d, setD] = useState<TrustEdit>({
    purchaseDate: holding.purchaseDate,
    address: holding.address,
    propertyType: holding.propertyType,
    purchasePrice: holding.purchasePrice,
    use: holding.use,
    estimatedValue: edit.estimatedValue,
    debt: edit.debt,
    note: holding.note,
  })

  const changed = holding.editedFields.length > 0

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{holding.address || 'New holding'}</h3>
          <button className="btn ghost sm" onClick={onClose}>Close</button>
        </div>

        {holding.needsConfirmation && (
          <div className="callout" style={{ marginBottom: 14 }}>
            <div className="callout-title">This figure was flagged when the schedule was read</div>
            <p>{holding.needsConfirmation}</p>
          </div>
        )}

        <div className="form-grid">
          <label className="field">
            <span>Purchase date</span>
            <input type="date" value={d.purchaseDate ?? ''}
              onChange={(e) => setD({ ...d, purchaseDate: e.target.value || undefined })} />
          </label>
          <label className="field">
            <span>Use</span>
            <select value={d.use} onChange={(e) => setD({ ...d, use: e.target.value as HoldingUse })}>
              {USES.map((u) => <option key={u} value={u}>{USE_LABEL[u]}</option>)}
            </select>
          </label>
          <label className="field" style={{ gridColumn: '1 / -1' }}>
            <span>Address</span>
            <input value={d.address ?? ''} onChange={(e) => setD({ ...d, address: e.target.value })} />
          </label>
          <label className="field" style={{ gridColumn: '1 / -1' }}>
            <span>Property type</span>
            <input value={d.propertyType ?? ''}
              onChange={(e) => setD({ ...d, propertyType: e.target.value })} />
          </label>
          <label className="field">
            <span>Purchase price</span>
            <input inputMode="decimal" value={d.purchasePrice ?? ''}
              onChange={(e) => setD({ ...d, purchasePrice: n(e.target.value) })} />
          </label>
          <label className="field">
            <span>
              Estimated value
              {holding.valueFromPortfolio && (
                <em className="field-hint"> now {money(holding.estimatedValue ?? 0)} from the portfolio</em>
              )}
            </span>
            <input inputMode="decimal" value={d.estimatedValue ?? ''}
              placeholder={holding.valueFromPortfolio ? String(Math.round(holding.estimatedValue ?? 0)) : ''}
              onChange={(e) => setD({ ...d, estimatedValue: n(e.target.value) })} />
          </label>
          <label className="field">
            <span>Debt outstanding</span>
            <input inputMode="decimal" value={d.debt ?? ''}
              onChange={(e) => setD({ ...d, debt: n(e.target.value) })} />
          </label>
        </div>

        <label className="field">
          <span>Note</span>
          <textarea rows={2} value={d.note ?? ''} onChange={(e) => setD({ ...d, note: e.target.value })} />
        </label>

        {holding.propertyId && (
          <p className="t-mute" style={{ fontSize: 12, marginTop: 10 }}>
            Leave the estimated value blank and this holding takes its worth from the portfolio —
            its own net income at the {capRate}% cap rate. Type a figure and yours is used instead.
          </p>
        )}

        <div className="row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={onRemove}
            style={{ marginRight: 'auto', color: 'var(--red)' }}>
            Remove from the schedule
          </button>
          {changed && <button className="btn ghost" onClick={onRevert}>Revert to the schedule</button>}
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={() => onSave(d)}>Save</button>
        </div>
      </div>
    </div>
  )
}
