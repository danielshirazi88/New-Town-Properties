import { useState } from 'react'
import { Card, Empty, Kpi } from '../components/ui'
import { RankedBars } from '../components/charts'
import { lastRate, rentPerSqFt } from '../lib/finance'
import { money, num, pct } from '../lib/format'
import type { PortfolioKpis } from '../lib/portfolio'
import type { Lease } from '../lib/types'

const sqft = (n: number): string => `${n.toLocaleString('en-US')} sf`
const psf = (n: number): string => `$${n.toFixed(2)}`

export function SquareFootage({ k, onProperty }: { k: PortfolioKpis; onProperty: (id: string) => void }) {
  const [sort, setSort] = useState<'psf' | 'size' | 'rent'>('psf')

  const all = k.properties.flatMap((p) => p.leases)
  const propName = (id: string) => k.properties.find((p) => p.property.id === id)?.property.name ?? id

  const measured = all
    .map((l) => ({ lease: l, rate: rentPerSqFt(l), annual: lastRate(l) * 12 }))
    .filter((x): x is { lease: Lease; rate: number; annual: number } => x.rate !== undefined)

  const sorted = [...measured].sort((a, b) =>
    sort === 'psf' ? b.rate - a.rate
      : sort === 'size' ? (b.lease.squareFeet ?? 0) - (a.lease.squareFeet ?? 0)
      : b.annual - a.annual)

  const vacantUnits = all.filter((l) => l.squareFeet && lastRate(l) === 0)
  const noArea = all.filter((l) => !l.squareFeet && (l.incomeType ?? 'rent') === 'rent')
  const rates = measured.map((x) => x.rate).sort((a, b) => a - b)
  const median = rates.length ? rates[Math.floor(rates.length / 2)] : 0

  if (k.totalSquareFeet === 0) {
    return (
      <>
        <div className="page-head">
          <h1 className="page-title">Square footage</h1>
        </div>
        <Empty>
          No square footage recorded for {k.fiscalYear}. The 2026 rent roll is the first sheet to
          carry unit areas — switch the year in the sidebar to see them.
        </Empty>
      </>
    )
  }

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Square footage & rent per foot</h1>
        <p className="page-sub">
          Rent per square foot is how a rent gets compared to the market — it is the number a broker,
          a lender or a buyer will ask for first. Rates here are annualised from the most recent month
          on the {k.fiscalYear} sheet, across let space only.
        </p>
      </div>

      <div className="kpi-grid">
        <Kpi accent label="Total area" value={sqft(k.totalSquareFeet)}
          note={`Across ${num(measured.length + vacantUnits.length)} measured units`} />
        <Kpi accent label="Leased" value={sqft(k.leasedSquareFeet)}
          note={`${pct(k.occupancyBySqFtPct)} of the portfolio`} />
        <Kpi label="Vacant" value={sqft(k.vacantSquareFeet)}
          note={`${vacantUnits.length} empty ${vacantUnits.length === 1 ? 'unit' : 'units'}`} warn={k.vacantSquareFeet > 0} />
        <Kpi accent label="Rent per sq ft" value={psf(k.rentPerSqFt)}
          note={`Portfolio average, annualised · median ${psf(median)}`} />
        <Kpi label="Empty space is costing" value={money(k.vacantSqFtAnnualValue)}
          note="A year of rent at each property's own rate" warn={k.vacantSqFtAnnualValue > 0} />
        <Kpi label="Deposits held" value={money(k.securityDepositsHeld)}
          note="Refundable — a liability, not income" />
      </div>

      {noArea.length > 0 && (
        <div className="callout" style={{ marginTop: 18 }}>
          <div className="callout-title">{noArea.length} units have no area recorded</div>
          <p>
            {noArea.map((l) => l.tenant).join(', ')}. Their rent is counted everywhere else in the app
            but they are left out of every figure on this page, so the rate above describes only the
            space that has been measured.
          </p>
        </div>
      )}

      <div className="section">
        <div className="section-title">By property</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Property</th>
                <th className="num">Total area</th>
                <th className="num">Leased</th>
                <th className="num">Vacant</th>
                <th className="num">Occupancy</th>
                <th className="num">Rent / sq ft</th>
                <th className="num">Vacant space costing</th>
              </tr>
            </thead>
            <tbody>
              {[...k.properties].filter((p) => p.squareFeet > 0)
                .sort((a, b) => b.squareFeet - a.squareFeet)
                .map((p) => (
                  <tr key={p.property.id} className="clickable" onClick={() => onProperty(p.property.id)}>
                    <td className="t-strong">{p.property.name}</td>
                    <td className="num">{sqft(p.squareFeet)}</td>
                    <td className="num t-mute">{sqft(p.leasedSquareFeet)}</td>
                    <td className={`num ${p.vacantSquareFeet > 0 ? 't-red' : 't-mute'}`}>
                      {p.vacantSquareFeet > 0 ? sqft(p.vacantSquareFeet) : '—'}
                    </td>
                    <td className="num">{pct(p.occupancyBySqFtPct, 0)}</td>
                    <td className="num t-strong">{psf(p.rentPerSqFt)}</td>
                    <td className={`num ${p.vacantSquareFeet > 0 ? 't-red' : 't-mute'}`}>
                      {p.vacantSquareFeet > 0 ? money(p.vacantSquareFeet * p.rentPerSqFt) : '—'}
                    </td>
                  </tr>
                ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="label">Portfolio</td>
                <td className="num">{sqft(k.totalSquareFeet)}</td>
                <td className="num">{sqft(k.leasedSquareFeet)}</td>
                <td className="num">{sqft(k.vacantSquareFeet)}</td>
                <td className="num">{pct(k.occupancyBySqFtPct, 0)}</td>
                <td className="num">{psf(k.rentPerSqFt)}</td>
                <td className="num">{money(k.vacantSqFtAnnualValue)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="section">
        <div className="grid-2">
          <Card title="Highest rent per square foot">
            <RankedBars
              formatValue={psf}
              onSelect={(id) => onProperty(measured.find((x) => x.lease.id === id)?.lease.propertyId ?? '')}
              items={[...measured].sort((a, b) => b.rate - a.rate).slice(0, 10).map((x) => ({
                id: x.lease.id, label: x.lease.tenant, value: x.rate,
                sub: `${sqft(x.lease.squareFeet!)} · ${money(x.annual)}/yr`,
              }))}
            />
          </Card>
          <Card title="Lowest rent per square foot">
            <RankedBars
              formatValue={psf}
              onSelect={(id) => onProperty(measured.find((x) => x.lease.id === id)?.lease.propertyId ?? '')}
              items={[...measured].sort((a, b) => a.rate - b.rate).slice(0, 10).map((x) => ({
                id: x.lease.id, label: x.lease.tenant, value: x.rate,
                sub: `${sqft(x.lease.squareFeet!)} · ${money(x.annual)}/yr`,
              }))}
            />
          </Card>
        </div>
      </div>

      {vacantUnits.length > 0 && (
        <div className="section">
          <div className="section-title">
            Empty space
            <span className="hint">valued at the rate its own property achieves</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Unit</th><th>Property</th><th className="num">Area</th><th className="num">At the property rate</th><th className="num">A year of rent</th></tr>
              </thead>
              <tbody>
                {vacantUnits.sort((a, b) => (b.squareFeet ?? 0) - (a.squareFeet ?? 0)).map((l) => {
                  const p = k.properties.find((x) => x.property.id === l.propertyId)
                  const rate = p?.rentPerSqFt ?? 0
                  return (
                    <tr key={l.id} className="clickable" onClick={() => onProperty(l.propertyId)}>
                      <td className="t-strong">{l.tenant}</td>
                      <td className="t-mute">{propName(l.propertyId)}</td>
                      <td className="num">{sqft(l.squareFeet!)}</td>
                      <td className="num t-mute">{psf(rate)}</td>
                      <td className="num t-red t-strong">{money((l.squareFeet ?? 0) * rate)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td className="label" colSpan={2}>{vacantUnits.length} empty units</td>
                  <td className="num">{sqft(k.vacantSquareFeet)}</td>
                  <td />
                  <td className="num">{money(k.vacantSqFtAnnualValue)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <div className="section">
        <div className="toolbar">
          <div className="section-title" style={{ margin: 0 }}>Every measured unit</div>
          <div className="spacer" />
          <div className="chip-row">
            <button className={`chip${sort === 'psf' ? ' active' : ''}`} onClick={() => setSort('psf')}>Rent / sq ft</button>
            <button className={`chip${sort === 'size' ? ' active' : ''}`} onClick={() => setSort('size')}>Size</button>
            <button className={`chip${sort === 'rent' ? ' active' : ''}`} onClick={() => setSort('rent')}>Annual rent</button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tenant</th><th>Property</th><th>Unit</th>
                <th className="num">Area</th><th className="num">Monthly</th>
                <th className="num">Annualised</th><th className="num">Rent / sq ft</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((x) => (
                <tr key={x.lease.id} className="clickable" onClick={() => onProperty(x.lease.propertyId)}>
                  <td className="t-strong">{x.lease.tenant}</td>
                  <td className="t-mute">{propName(x.lease.propertyId)}</td>
                  <td className="t-mono t-mute">{x.lease.unit}</td>
                  <td className="num">{sqft(x.lease.squareFeet!)}</td>
                  <td className="num t-mute">{money(lastRate(x.lease))}</td>
                  <td className="num">{money(x.annual)}</td>
                  <td className="num t-strong">{psf(x.rate)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="label" colSpan={3}>{sorted.length} units</td>
                <td className="num">{sqft(k.leasedSquareFeet)}</td>
                <td />
                <td className="num">{money(sorted.reduce((a, x) => a + x.annual, 0))}</td>
                <td className="num">{psf(k.rentPerSqFt)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  )
}
