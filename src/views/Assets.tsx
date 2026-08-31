import { useMemo, useState } from 'react'
import { Card, Empty, Kpi } from '../components/ui'
import { DonutChart, RankedBars } from '../components/charts'
import { dateLabel, money, num, pct } from '../lib/format'
import {
  INTEREST_FREQUENCIES, INVESTMENT_KINDS, annualInterest, assetBreakdown, assetTotals,
  blendedRate, byInstitution, frequencyLabel, investmentKindLabel, maturities, newAssetId,
  registerInterest, vehicleValued,
  type AssetRegister, type InvestmentAsset, type InvestmentKind, type InterestFrequency,
  type RealEstateAsset, type VehicleAsset,
} from '../lib/assets'
import type { PortfolioKpis } from '../lib/portfolio'

type Tab = 'overview' | 'real-estate' | 'investments' | 'vehicles'

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'real-estate', label: 'Real estate' },
  { id: 'investments', label: 'Investments' },
  { id: 'vehicles', label: 'Vehicles' },
]

const n = (v: string): number | undefined => {
  const x = Number(v.replace(/[^0-9.-]/g, ''))
  return v.trim() === '' || Number.isNaN(x) ? undefined : x
}

export function Assets({
  k, register, setRegister, capRate,
}: {
  k: PortfolioKpis
  register: AssetRegister
  setRegister: (next: AssetRegister) => void
  /** Cap rate the valuation view is set to, so both screens agree. */
  capRate: number
}) {
  const [tab, setTab] = useState<Tab>('overview')

  /**
   * What a portfolio building is worth: its own NOI capitalised, the same
   * calculation the valuation screen shows. The register never stores a second
   * opinion of the commercial estate's value.
   */
  const propertyValue = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of k.properties) {
      if (p.netAfterTax > 0 && capRate > 0) m.set(p.property.id, (p.netAfterTax / capRate) * 100)
    }
    return (id: string) => m.get(id)
  }, [k, capRate])

  const totals = useMemo(() => assetTotals(register, propertyValue), [register, propertyValue])
  const slices = assetBreakdown(totals)
  const interest = registerInterest(register)
  const rate = blendedRate(register)
  const due = maturities(register, k.asOf)
  const dueSoon = due.filter((m) => !m.matured && m.daysAway <= 90)
  const matured = due.filter((m) => m.matured)

  const patch = (next: Partial<AssetRegister>) => setRegister({ ...register, ...next })

  return (
    <div className="stack">
      <div className="page-head">
        <h1 className="page-title">Assets</h1>
        <p className="page-sub">
          Everything owned, not just what pays rent — property, deposits and vehicles in one
          register. Rental buildings take their value from the portfolio at the{' '}
          {capRate.toFixed(2)}% cap rate; everything else is entered here by hand.
        </p>
      </div>

      <div className="kpi-grid">
        <Kpi accent label="Total assets" value={money(totals.gross)}
          note={`${num(register.realEstate.length + register.investments.length + register.vehicles.length)} recorded`} />
        <Kpi accent label="Net of debt" value={money(totals.net)}
          note={totals.debt > 0 ? `${money(totals.debt)} of debt recorded` : 'No debt recorded'} />
        <Kpi label="Real estate" value={money(totals.realEstate)}
          note={`${money(totals.rentalRealEstate)} rental · ${money(totals.personalRealEstate)} personal`} />
        <Kpi label="Investments" value={money(totals.investments)}
          note={rate !== undefined ? `${pct(rate, 2)} blended · ${money(interest)} a year` : 'No rates entered'} />
        <Kpi label="Vehicles" value={money(totals.vehicles)}
          note={totals.unvaluedVehicles > 0
            ? `${num(totals.unvaluedVehicles)} with no value entered`
            : `${num(register.vehicles.length)} recorded`}
          warn={totals.unvaluedVehicles > 0} />
        <Kpi label="Maturing within 90 days" value={money(dueSoon.reduce((a, m) => a + m.investment.balance, 0))}
          note={matured.length > 0
            ? `${num(matured.length)} already matured`
            : `${num(dueSoon.length)} ${dueSoon.length === 1 ? 'account' : 'accounts'}`}
          warn={matured.length > 0} />
      </div>

      <div className="row" style={{ gap: 8 }}>
        {TABS.map((t) => (
          <button key={t.id} className={`chip${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
            {t.id !== 'overview' && (
              <span style={{ opacity: 0.7, marginLeft: 6 }}>
                {t.id === 'real-estate' ? register.realEstate.length
                  : t.id === 'investments' ? register.investments.length
                  : register.vehicles.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <Overview
          k={k} register={register} totals={totals} slices={slices}
          matured={matured} dueSoon={dueSoon} onTab={setTab}
        />
      )}
      {tab === 'real-estate' && (
        <RealEstate
          k={k} rows={register.realEstate} propertyValue={propertyValue}
          onChange={(realEstate) => patch({ realEstate })}
        />
      )}
      {tab === 'investments' && (
        <Investments rows={register.investments} asOf={k.asOf}
          onChange={(investments) => patch({ investments })} />
      )}
      {tab === 'vehicles' && (
        <Vehicles rows={register.vehicles} onChange={(vehicles) => patch({ vehicles })} />
      )}
    </div>
  )
}

/* ── Overview ────────────────────────────────────────────────────────────── */

function Overview({
  k, register, totals, slices, matured, dueSoon, onTab,
}: {
  k: PortfolioKpis
  register: AssetRegister
  totals: ReturnType<typeof assetTotals>
  slices: { id: string; label: string; value: number }[]
  matured: ReturnType<typeof maturities>
  dueSoon: ReturnType<typeof maturities>
  onTab: (t: Tab) => void
}) {
  const banks = byInstitution(register)
  const empty = slices.length === 0

  return (
    <>
      {empty ? (
        <div className="callout">
          <div className="callout-title">Nothing recorded yet</div>
          <p>
            The register starts empty. Add the personal property, the bank accounts and the cars on
            the tabs above and this page fills in. The {num(k.properties.length)} rental buildings
            can be pulled in with one click on the <strong>Real estate</strong> tab — their values
            come from the portfolio, so they never need retyping.
          </p>
        </div>
      ) : (
        <div className="grid-2">
          <Card title="What the estate is made of" hint={`${money(totals.gross)} in total`}>
            <DonutChart
              slices={slices}
              centreValue={money(totals.gross)}
              centreLabel="Total assets"
              onSelect={(id) => onTab(id === 'investments' ? 'investments'
                : id === 'vehicles' ? 'vehicles' : 'real-estate')}
            />
          </Card>
          <Card title="Where the money is held" hint="deposits by institution">
            {banks.length === 0 ? (
              <Empty>No accounts recorded yet.</Empty>
            ) : (
              <RankedBars
                items={banks.map((b) => ({
                  id: b.institution,
                  label: b.institution,
                  value: b.balance,
                  sub: `${num(b.accounts)} ${b.accounts === 1 ? 'account' : 'accounts'}`
                    + (b.rate !== undefined ? ` · ${pct(b.rate, 2)}` : ''),
                }))}
              />
            )}
          </Card>
        </div>
      )}

      {(matured.length > 0 || dueSoon.length > 0) && (
        <Card title="Coming due" hint="deposits at or near maturity">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Account</th><th>Institution</th><th className="num">Balance</th>
                  <th className="num">Rate</th><th>Matures</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {[...matured, ...dueSoon].map((m) => (
                  <tr key={m.investment.id}>
                    <td className="t-strong">{m.investment.name}</td>
                    <td className="t-mute">{m.investment.institution}</td>
                    <td className="num">{money(m.investment.balance)}</td>
                    <td className="num t-mute">
                      {m.investment.ratePct !== undefined ? pct(m.investment.ratePct, 2) : '—'}
                    </td>
                    <td className="t-mono t-mute">{dateLabel(m.investment.maturityDate)}</td>
                    <td>
                      {m.matured ? (
                        <span className="badge critical">
                          Matured {num(Math.abs(m.daysAway))} {Math.abs(m.daysAway) === 1 ? 'day' : 'days'} ago
                        </span>
                      ) : (
                        <span className={`badge ${m.daysAway <= 30 ? 'warn' : 'mute'}`}>
                          {m.daysAway === 0 ? 'Due today' : `In ${num(m.daysAway)} days`}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {matured.length > 0 && (
            <p className="t-mute" style={{ fontSize: 12, marginTop: 8 }}>
              A matured deposit usually rolls into a low-rate sweep until someone moves it, so a
              date in the past is worth acting on rather than noting.
            </p>
          )}
        </Card>
      )}

      {(totals.unvaluedVehicles > 0 || totals.unvaluedRealEstate > 0) && (
        <div className="callout">
          <div className="callout-title">Some rows carry no value, so the total is understated</div>
          <p>
            {totals.unvaluedRealEstate > 0 && (
              <>{num(totals.unvaluedRealEstate)} property {totals.unvaluedRealEstate === 1 ? 'row has' : 'rows have'} no
              estimated value. </>
            )}
            {totals.unvaluedVehicles > 0 && (
              <>{num(totals.unvaluedVehicles)} {totals.unvaluedVehicles === 1 ? 'vehicle has' : 'vehicles have'} no
              current value. </>
            )}
            They count as zero above rather than being guessed at — a purchase price is not what
            something is worth today, and a made-up figure in a net-worth total is worse than a
            gap you can see.
          </p>
        </div>
      )}
    </>
  )
}

/* ── Real estate ─────────────────────────────────────────────────────────── */

function RealEstate({
  k, rows, propertyValue, onChange,
}: {
  k: PortfolioKpis
  rows: RealEstateAsset[]
  propertyValue: (id: string) => number | undefined
  onChange: (next: RealEstateAsset[]) => void
}) {
  const [editing, setEditing] = useState<RealEstateAsset | null>(null)

  const linked = new Set(rows.map((r) => r.propertyId).filter(Boolean))
  const missing = k.properties.filter((p) => !linked.has(p.property.id))

  const importAll = () => {
    onChange([
      ...rows,
      ...missing.map((p): RealEstateAsset => ({
        id: newAssetId(),
        kind: 'real-estate',
        name: p.property.name,
        address: `${p.property.address}, ${p.property.city}${p.property.state !== '—' ? `, ${p.property.state}` : ''}`,
        use: 'rental',
        propertyId: p.property.id,
        updatedAt: new Date().toISOString(),
      })),
    ])
  }

  const save = (a: RealEstateAsset) => {
    const at = { ...a, updatedAt: new Date().toISOString() }
    onChange(rows.some((r) => r.id === a.id) ? rows.map((r) => (r.id === a.id ? at : r)) : [...rows, at])
    setEditing(null)
  }

  const rental = rows.filter((r) => r.use === 'rental')
  const personal = rows.filter((r) => r.use === 'personal')

  return (
    <>
      <div className="toolbar">
        <button className="btn" onClick={() => setEditing({
          id: newAssetId(), kind: 'real-estate', name: '', use: 'personal',
        })}>Add a property</button>
        {missing.length > 0 && (
          <button className="btn ghost" onClick={importAll}>
            Pull in {num(missing.length)} rental {missing.length === 1 ? 'building' : 'buildings'} from the portfolio
          </button>
        )}
        <div className="spacer" />
        <span className="t-mute">
          {num(rental.length)} rental · {num(personal.length)} personal
        </span>
      </div>

      {rows.length === 0 ? (
        <Empty>
          No property recorded yet. Pull in the rental buildings from the portfolio, then add the
          personal ones — the Chicago condo at 1211 S Prairie is reported as a residence on the 2023
          return, so it belongs under personal rather than rental.
        </Empty>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Property</th><th>Address</th><th>Use</th>
                <th className="num">Value</th><th className="num">Bought for</th>
                <th>Bought</th><th className="num">Debt</th><th />
              </tr>
            </thead>
            <tbody>
              {[...rows].sort((a, b) => (propertyValue(b.propertyId ?? '') ?? b.estimatedValue ?? 0)
                - (propertyValue(a.propertyId ?? '') ?? a.estimatedValue ?? 0)).map((a) => {
                const fromPortfolio = a.propertyId ? propertyValue(a.propertyId) : undefined
                const value = fromPortfolio ?? a.estimatedValue
                return (
                  <tr key={a.id}>
                    <td className="t-strong">{a.name || <span className="t-mute">Unnamed</span>}</td>
                    <td className="t-mute" style={{ fontSize: 12 }}>{a.address || '—'}</td>
                    <td>
                      <span className={`badge ${a.use === 'rental' ? 'ok' : 'mute'}`}>
                        {a.use === 'rental' ? 'Rental' : 'Personal'}
                      </span>
                    </td>
                    <td className="num">
                      {value === undefined ? <span className="t-mute">—</span> : (
                        <span title={fromPortfolio !== undefined ? 'Capitalised from the portfolio' : undefined}>
                          {money(value)}{fromPortfolio !== undefined ? '*' : ''}
                        </span>
                      )}
                    </td>
                    <td className="num t-mute">{a.purchasePrice ? money(a.purchasePrice) : '—'}</td>
                    <td className="t-mono t-mute" style={{ fontSize: 12 }}>{dateLabel(a.purchaseDate)}</td>
                    <td className="num t-mute">{a.debt ? money(a.debt) : '—'}</td>
                    <td>
                      <button className="btn ghost sm" onClick={() => setEditing(a)}>Edit</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {rows.some((r) => r.propertyId) && (
        <p className="t-mute" style={{ fontSize: 12, marginTop: 8 }}>
          * Value capitalised from that building's own net income at the cap rate set on the
          Valuation screen. Change the cap rate there and these move with it.
        </p>
      )}

      {editing && (
        <RealEstateForm
          asset={editing}
          onSave={save}
          onDelete={() => { onChange(rows.filter((r) => r.id !== editing.id)); setEditing(null) }}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}

function RealEstateForm({
  asset, onSave, onDelete, onClose,
}: {
  asset: RealEstateAsset
  onSave: (a: RealEstateAsset) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [d, setD] = useState(asset)
  const linked = Boolean(d.propertyId)
  return (
    <Modal title={asset.name ? `Edit ${asset.name}` : 'Add a property'} onClose={onClose}>
      <div className="form-grid">
        <Field label="Name"><input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></Field>
        <Field label="Address">
          <input value={d.address ?? ''} onChange={(e) => setD({ ...d, address: e.target.value })} />
        </Field>
        <Field label="Use">
          <select value={d.use} onChange={(e) => setD({ ...d, use: e.target.value as RealEstateAsset['use'] })}>
            <option value="rental">Rental — it earns rent</option>
            <option value="personal">Personal — lived in or held</option>
          </select>
        </Field>
        <Field label="Estimated value" hint={linked ? 'Taken from the portfolio for this building' : undefined}>
          <input
            inputMode="decimal" disabled={linked}
            value={d.estimatedValue ?? ''}
            onChange={(e) => setD({ ...d, estimatedValue: n(e.target.value) })}
          />
        </Field>
        <Field label="Purchase price">
          <input inputMode="decimal" value={d.purchasePrice ?? ''}
            onChange={(e) => setD({ ...d, purchasePrice: n(e.target.value) })} />
        </Field>
        <Field label="Purchase date">
          <input type="date" value={d.purchaseDate ?? ''}
            onChange={(e) => setD({ ...d, purchaseDate: e.target.value || undefined })} />
        </Field>
        <Field label="Debt outstanding">
          <input inputMode="decimal" value={d.debt ?? ''}
            onChange={(e) => setD({ ...d, debt: n(e.target.value) })} />
        </Field>
      </div>
      <Field label="Notes">
        <textarea rows={2} value={d.notes ?? ''} onChange={(e) => setD({ ...d, notes: e.target.value })} />
      </Field>
      <FormActions onSave={() => onSave(d)} onDelete={onDelete} onClose={onClose} canSave={d.name.trim().length > 0} />
    </Modal>
  )
}

/* ── Investments ─────────────────────────────────────────────────────────── */

function Investments({
  rows, asOf, onChange,
}: {
  rows: InvestmentAsset[]
  asOf: Date
  onChange: (next: InvestmentAsset[]) => void
}) {
  const [editing, setEditing] = useState<InvestmentAsset | null>(null)

  const save = (a: InvestmentAsset) => {
    const at = { ...a, updatedAt: new Date().toISOString() }
    onChange(rows.some((r) => r.id === a.id) ? rows.map((r) => (r.id === a.id ? at : r)) : [...rows, at])
    setEditing(null)
  }

  const total = rows.reduce((a, i) => a + i.balance, 0)
  const income = rows.reduce((a, i) => a + annualInterest(i), 0)
  const due = new Map(maturities({ realEstate: [], investments: rows, vehicles: [] }, asOf)
    .map((m) => [m.investment.id, m]))

  return (
    <>
      <div className="toolbar">
        <button className="btn" onClick={() => setEditing({
          id: newAssetId(), kind: 'investment', name: '', institution: '',
          investmentKind: 'cd', balance: 0,
        })}>Add an account</button>
        <div className="spacer" />
        <span className="t-mute">
          {num(rows.length)} {rows.length === 1 ? 'account' : 'accounts'} · {money(total)}
          {income > 0 && ` · ${money(income)} a year`}
        </span>
      </div>

      {rows.length === 0 ? (
        <Empty>
          No accounts recorded yet. The 2023 return shows $214,965 of interest across nine
          institutions — Millennium Bank, GreenState Credit Union and Schaumburg Bank &amp; Trust
          between them accounted for $210,888 of it. The Tax returns tab has the full list.
        </Empty>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Account</th><th>Institution</th><th>Type</th>
                <th className="num">Balance</th><th className="num">Rate</th>
                <th className="num">Interest / yr</th><th>Pays</th>
                <th>Next interest</th><th>Matures</th><th />
              </tr>
            </thead>
            <tbody>
              {[...rows].sort((a, b) => b.balance - a.balance).map((i) => {
                const m = due.get(i.id)
                return (
                  <tr key={i.id}>
                    <td>
                      <div className="t-strong">{i.name || <span className="t-mute">Unnamed</span>}</div>
                      {i.accountLast4 && <div className="t-mute" style={{ fontSize: 11 }}>····{i.accountLast4}</div>}
                    </td>
                    <td className="t-mute">{i.institution || '—'}</td>
                    <td><span className="badge mute">{investmentKindLabel(i.investmentKind)}</span></td>
                    <td className="num t-strong">{money(i.balance)}</td>
                    <td className="num">{i.ratePct !== undefined ? pct(i.ratePct, 2) : <span className="t-mute">—</span>}</td>
                    <td className="num t-mute">{annualInterest(i) > 0 ? money(annualInterest(i)) : '—'}</td>
                    <td className="t-mute" style={{ fontSize: 12 }}>{i.interestFrequency ? frequencyLabel(i.interestFrequency) : '—'}</td>
                    <td className="t-mono t-mute" style={{ fontSize: 12 }}>{dateLabel(i.nextInterestDate)}</td>
                    <td className="t-mono" style={{ fontSize: 12 }}>
                      {i.maturityDate ? (
                        <span className={m?.matured ? 't-red' : undefined}>
                          {dateLabel(i.maturityDate)}
                          {m?.matured && <div style={{ fontSize: 11 }}>matured</div>}
                        </span>
                      ) : <span className="t-mute">—</span>}
                    </td>
                    <td><button className="btn ghost sm" onClick={() => setEditing(i)}>Edit</button></td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="label" colSpan={3}>
                  {num(rows.length)} {rows.length === 1 ? 'account' : 'accounts'}
                </td>
                <td className="num">{money(total)}</td>
                <td className="num">{blendedRate({ realEstate: [], investments: rows, vehicles: [] }) !== undefined
                  ? pct(blendedRate({ realEstate: [], investments: rows, vehicles: [] })!, 2) : '—'}</td>
                <td className="num">{money(income)}</td>
                <td colSpan={4} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {editing && (
        <InvestmentForm
          asset={editing}
          onSave={save}
          onDelete={() => { onChange(rows.filter((r) => r.id !== editing.id)); setEditing(null) }}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}

function InvestmentForm({
  asset, onSave, onDelete, onClose,
}: {
  asset: InvestmentAsset
  onSave: (a: InvestmentAsset) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [d, setD] = useState(asset)
  const yearly = annualInterest(d)
  return (
    <Modal title={asset.name ? `Edit ${asset.name}` : 'Add an account'} onClose={onClose}>
      <div className="form-grid">
        <Field label="Account name" hint="e.g. “13-month CD”">
          <input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
        </Field>
        <Field label="Bank or brokerage">
          <input value={d.institution} onChange={(e) => setD({ ...d, institution: e.target.value })}
            list="ntp-institutions" />
          <datalist id="ntp-institutions">
            {['Millennium Bank', 'GreenState Credit Union', 'Schaumburg Bank & Trust Company',
              'Pan American Bank', 'Fifth Third Bank', 'PNC Investments, LLC', 'Wells Fargo',
              'Wells Fargo Clearing Services'].map((b) => <option key={b} value={b} />)}
          </datalist>
        </Field>
        <Field label="Type">
          <select value={d.investmentKind}
            onChange={(e) => setD({ ...d, investmentKind: e.target.value as InvestmentKind })}>
            {INVESTMENT_KINDS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </Field>
        <Field label="Balance">
          <input inputMode="decimal" value={d.balance}
            onChange={(e) => setD({ ...d, balance: n(e.target.value) ?? 0 })} />
        </Field>
        <Field label="Rate %" hint="as written on the statement">
          <input inputMode="decimal" value={d.ratePct ?? ''}
            onChange={(e) => setD({ ...d, ratePct: n(e.target.value) })} />
        </Field>
        <Field label="Interest paid">
          <select value={d.interestFrequency ?? ''}
            onChange={(e) => setD({ ...d, interestFrequency: (e.target.value || undefined) as InterestFrequency | undefined })}>
            <option value="">Not recorded</option>
            {INTEREST_FREQUENCIES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </Field>
        <Field label="Next interest date">
          <input type="date" value={d.nextInterestDate ?? ''}
            onChange={(e) => setD({ ...d, nextInterestDate: e.target.value || undefined })} />
        </Field>
        <Field label="Opened">
          <input type="date" value={d.openedDate ?? ''}
            onChange={(e) => setD({ ...d, openedDate: e.target.value || undefined })} />
        </Field>
        <Field label="Matures">
          <input type="date" value={d.maturityDate ?? ''}
            onChange={(e) => setD({ ...d, maturityDate: e.target.value || undefined })} />
        </Field>
        <Field label="Last 4 of the account" hint="never the whole number">
          <input maxLength={4} value={d.accountLast4 ?? ''}
            onChange={(e) => setD({ ...d, accountLast4: e.target.value.replace(/\D/g, '').slice(0, 4) || undefined })} />
        </Field>
      </div>
      {yearly > 0 && (
        <div className="callout" style={{ marginTop: 4 }}>
          <div className="callout-title">
            {money(d.balance)} at {pct(d.ratePct ?? 0, 2)} earns {money(yearly)} a year
          </div>
          <p>
            Simple interest on the balance as entered — {money(yearly / 12)} a month if it pays
            monthly. It is not compounded, because a deposit paying out to another account does not
            compound.
          </p>
        </div>
      )}
      <Field label="Notes">
        <textarea rows={2} value={d.notes ?? ''} onChange={(e) => setD({ ...d, notes: e.target.value })} />
      </Field>
      <FormActions onSave={() => onSave(d)} onDelete={onDelete} onClose={onClose}
        canSave={d.name.trim().length > 0} />
    </Modal>
  )
}

/* ── Vehicles ────────────────────────────────────────────────────────────── */

function Vehicles({ rows, onChange }: { rows: VehicleAsset[]; onChange: (next: VehicleAsset[]) => void }) {
  const [editing, setEditing] = useState<VehicleAsset | null>(null)

  const save = (a: VehicleAsset) => {
    const at = { ...a, updatedAt: new Date().toISOString() }
    onChange(rows.some((r) => r.id === a.id) ? rows.map((r) => (r.id === a.id ? at : r)) : [...rows, at])
    setEditing(null)
  }

  const value = rows.reduce((a, v) => a + (v.currentValue ?? 0), 0)
  const cost = rows.reduce((a, v) => a + (v.purchasePrice ?? 0), 0)
  // Only cars with both figures can be compared; the rest would skew it.
  const comparable = rows.filter((v) => v.currentValue !== undefined && v.purchasePrice !== undefined)
  const paid = comparable.reduce((a, v) => a + v.purchasePrice!, 0)
  const worth = comparable.reduce((a, v) => a + v.currentValue!, 0)

  return (
    <>
      <div className="toolbar">
        <button className="btn" onClick={() => setEditing({ id: newAssetId(), kind: 'vehicle', name: '' })}>
          Add a vehicle
        </button>
        <div className="spacer" />
        <span className="t-mute">
          {num(rows.length)} {rows.length === 1 ? 'vehicle' : 'vehicles'} · {money(value)} of stated value
        </span>
      </div>

      {rows.length === 0 ? (
        <Empty>
          No vehicles recorded yet. Each one takes a purchase price, where it was bought, its VIN,
          current mileage and what it is worth today.
        </Empty>
      ) : (
        <>
          {comparable.length > 0 && (
            <div className="kpi-grid" style={{ marginBottom: 14 }}>
              <Kpi label="Stated value" value={money(value)}
                note={`${num(rows.filter((v) => vehicleValued(v)).length)} of ${num(rows.length)} valued`} />
              <Kpi label="Total paid" value={money(cost)} note="Across every vehicle with a price on it" />
              <Kpi label="Held against cost" value={paid > 0 ? pct((worth / paid) * 100) : '—'}
                note={`${money(worth)} against ${money(paid)} on ${num(comparable.length)} with both figures`}
                warn={paid > 0 && worth < paid * 0.5} />
            </div>
          )}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Vehicle</th><th>VIN</th><th>Bought from</th><th>Bought</th>
                  <th className="num">Paid</th><th className="num">Miles</th>
                  <th className="num">Worth now</th><th className="num">Change</th><th />
                </tr>
              </thead>
              <tbody>
                {[...rows].sort((a, b) => (b.currentValue ?? 0) - (a.currentValue ?? 0)).map((v) => {
                  const delta = v.currentValue !== undefined && v.purchasePrice
                    ? (v.currentValue - v.purchasePrice) / v.purchasePrice * 100
                    : undefined
                  return (
                    <tr key={v.id}>
                      <td>
                        <div className="t-strong">{v.name || <span className="t-mute">Unnamed</span>}</div>
                        {v.plate && <div className="t-mute" style={{ fontSize: 11 }}>{v.plate}</div>}
                      </td>
                      <td className="t-mono t-mute" style={{ fontSize: 11.5 }}>{v.vin || '—'}</td>
                      <td className="t-mute" style={{ fontSize: 12 }}>{v.purchasedFrom || '—'}</td>
                      <td className="t-mono t-mute" style={{ fontSize: 12 }}>{dateLabel(v.purchaseDate)}</td>
                      <td className="num t-mute">{v.purchasePrice ? money(v.purchasePrice) : '—'}</td>
                      <td className="num t-mute">{v.currentMiles !== undefined ? num(v.currentMiles) : '—'}</td>
                      <td className="num t-strong">
                        {v.currentValue !== undefined ? money(v.currentValue)
                          : <span className="t-mute" title="Not counted in any total">not valued</span>}
                      </td>
                      <td className="num">
                        {delta === undefined ? <span className="t-mute">—</span> : (
                          <span className={delta < 0 ? 't-red' : 't-paid'}>
                            {delta >= 0 ? '+' : ''}{delta.toFixed(0)}%
                          </span>
                        )}
                      </td>
                      <td><button className="btn ghost sm" onClick={() => setEditing(v)}>Edit</button></td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td className="label" colSpan={4}>
                    {num(rows.length)} {rows.length === 1 ? 'vehicle' : 'vehicles'}
                  </td>
                  <td className="num">{money(cost)}</td>
                  <td />
                  <td className="num">{money(value)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      {editing && (
        <VehicleForm
          asset={editing}
          onSave={save}
          onDelete={() => { onChange(rows.filter((r) => r.id !== editing.id)); setEditing(null) }}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}

function VehicleForm({
  asset, onSave, onDelete, onClose,
}: {
  asset: VehicleAsset
  onSave: (a: VehicleAsset) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [d, setD] = useState(asset)
  // A VIN is 17 characters and never uses I, O or Q.
  const vinOdd = Boolean(d.vin) && !/^[A-HJ-NPR-Z0-9]{17}$/i.test(d.vin!.trim())
  const name = [d.year, d.make, d.model].filter(Boolean).join(' ')

  return (
    <Modal title={asset.name ? `Edit ${asset.name}` : 'Add a vehicle'} onClose={onClose}>
      <div className="form-grid">
        <Field label="Name" hint={name && name !== d.name ? `Suggested: ${name}` : undefined}>
          <input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
        </Field>
        <Field label="Year">
          <input inputMode="numeric" value={d.year ?? ''} onChange={(e) => setD({ ...d, year: n(e.target.value) })} />
        </Field>
        <Field label="Make">
          <input value={d.make ?? ''} onChange={(e) => setD({ ...d, make: e.target.value || undefined })} />
        </Field>
        <Field label="Model">
          <input value={d.model ?? ''} onChange={(e) => setD({ ...d, model: e.target.value || undefined })} />
        </Field>
        <Field label="VIN" hint={vinOdd ? '17 characters, no I, O or Q' : undefined}>
          <input
            maxLength={17}
            style={vinOdd ? { borderColor: 'var(--red)' } : undefined}
            value={d.vin ?? ''}
            onChange={(e) => setD({ ...d, vin: e.target.value.toUpperCase() || undefined })}
          />
        </Field>
        <Field label="Bought from" hint="dealer or private seller">
          <input value={d.purchasedFrom ?? ''}
            onChange={(e) => setD({ ...d, purchasedFrom: e.target.value || undefined })} />
        </Field>
        <Field label="Purchase price">
          <input inputMode="decimal" value={d.purchasePrice ?? ''}
            onChange={(e) => setD({ ...d, purchasePrice: n(e.target.value) })} />
        </Field>
        <Field label="Purchase date">
          <input type="date" value={d.purchaseDate ?? ''}
            onChange={(e) => setD({ ...d, purchaseDate: e.target.value || undefined })} />
        </Field>
        <Field label="Current miles">
          <input inputMode="numeric" value={d.currentMiles ?? ''}
            onChange={(e) => setD({ ...d, currentMiles: n(e.target.value) })} />
        </Field>
        <Field label="Current value" hint="left blank, it counts as zero rather than being guessed">
          <input inputMode="decimal" value={d.currentValue ?? ''}
            onChange={(e) => setD({ ...d, currentValue: n(e.target.value) })} />
        </Field>
        <Field label="Plate">
          <input value={d.plate ?? ''} onChange={(e) => setD({ ...d, plate: e.target.value || undefined })} />
        </Field>
      </div>
      <Field label="Notes">
        <textarea rows={2} value={d.notes ?? ''} onChange={(e) => setD({ ...d, notes: e.target.value })} />
      </Field>
      <FormActions onSave={() => onSave(d)} onDelete={onDelete} onClose={onClose}
        canSave={d.name.trim().length > 0 || Boolean(name)} />
    </Modal>
  )
}

/* ── Form furniture ──────────────────────────────────────────────────────── */

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="btn ghost sm" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}{hint && <em className="field-hint"> {hint}</em>}</span>
      {children}
    </label>
  )
}

function FormActions({
  onSave, onDelete, onClose, canSave,
}: {
  onSave: () => void
  onDelete: () => void
  onClose: () => void
  canSave: boolean
}) {
  return (
    <div className="row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
      <button className="btn ghost" onClick={onDelete} style={{ marginRight: 'auto', color: 'var(--red)' }}>
        Delete
      </button>
      <button className="btn ghost" onClick={onClose}>Cancel</button>
      <button className="btn" onClick={onSave} disabled={!canSave}>Save</button>
    </div>
  )
}
