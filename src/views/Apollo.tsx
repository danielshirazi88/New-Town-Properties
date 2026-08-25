import { useMemo, useState } from 'react'
import { Card, Kpi } from '../components/ui'
import { money, num, pct } from '../lib/format'
import {
  APOLLO_FLAG_NOTE, APOLLO_PARKING_NOTE, APOLLO_PARKING_RENT, APOLLO_REGISTRY_LABEL,
  APOLLO_TENANTS, APOLLO_WATER_CHARGE,
} from '../data/apollo'
import type { PortfolioKpis } from '../lib/portfolio'

export function Apollo({ k }: { k: PortfolioKpis }) {
  const [query, setQuery] = useState('')
  const paying = APOLLO_TENANTS.filter((t) => !t.isParking)

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return APOLLO_TENANTS
      .filter((t) => !q || t.name.toLowerCase().includes(q) || t.address.toLowerCase().includes(q) || t.contacts.some((c) => c.phone.includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [query])

  // Rent bands, for a quick read on where the lots sit.
  const bands = [
    { label: 'Under $750', test: (n: number) => n < 750 },
    { label: '$750 – $874', test: (n: number) => n >= 750 && n < 875 },
    { label: '$875 – $974', test: (n: number) => n >= 875 && n < 975 },
    { label: '$975 and above', test: (n: number) => n >= 975 },
  ].map((b) => ({ ...b, count: paying.filter((t) => b.test(t.amountDue)).length }))

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Apollo Mobile Home Court</h1>
        <p className="page-sub">
          The trailer park. {k.apolloLots} lots plus {k.apolloParkingSpaces} tandem parking spaces, all
          month-to-month. Roster below is the {APOLLO_REGISTRY_LABEL}; the income figures are 2025.
        </p>
      </div>

      <div className="kpi-grid">
        <Kpi accent label="2025 gross income" value={money(k.apolloGross)} note={`${money(k.apolloGross / 12)} per month average`} />
        <Kpi label="2024 property tax" value={money(k.apolloTaxes)} note={`${pct((k.apolloTaxes / k.apolloGross) * 100)} of gross`} warn />
        <Kpi accent label="Net after tax" value={money(k.apolloNet)} />
        <Kpi label="Lots billed" value={num(k.apolloLots)} note={`plus ${k.apolloParkingSpaces} tandem parking spaces`} />
        <Kpi label="Currently billed monthly" value={money(k.apolloMonthlyBilled)}
          note={`${money(k.apolloLotMonthly)} lots + ${money(k.apolloParkingMonthly)} parking · ${money(k.apolloAnnualisedCurrent)} annualised`} />
        <Kpi label="Parking income" value={money(k.apolloParkingMonthly)}
          note={`${k.apolloParkingSpaces} spaces at ${money(APOLLO_PARKING_RENT)} · ${money(k.apolloParkingMonthly * 12)} a year`} />
        <Kpi label="Average lot" value={money(k.apolloAvgLotRent)} note={`Median ${money(k.apolloMedianLotRent)}`} />
        <Kpi label="Range" value={`${money(k.apolloMinLotRent)} – ${money(k.apolloMaxLotRent)}`} small
          note="Lowest to highest lot" />
        <Kpi label="Water recovery" value={money(k.apolloWaterRevenueMonthly)}
          note={`${money(APOLLO_WATER_CHARGE)} per lot per month, included in the amount due`} />
        <Kpi label="Base lot rent" value={money(k.apolloBaseRentMonthly)} note="Monthly, net of the water charge" />
        <Kpi label="Share of portfolio" value={pct((k.apolloGross / k.grossCollected) * 100)} />
        <Kpi label="Flagged on the registry" value={num(k.apolloFlaggedCount)} note="Marked with an asterisk" warn />
        <Kpi label="Rent per lot per year" value={money(k.apolloAvgLotRent * 12)} />
      </div>

      <div className="section">
        <div className="grid-2">
          <Card title="Where the lots sit">
            <div className="table-wrap" style={{ border: 0 }}>
              <table>
                <thead><tr><th>Band</th><th className="num">Lots</th><th className="num">Share</th></tr></thead>
                <tbody>
                  {bands.map((b) => (
                    <tr key={b.label}>
                      <td>{b.label}</td>
                      <td className="num">{b.count}</td>
                      <td className="num t-mute">{pct((b.count / paying.length) * 100, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card title="Two things to confirm">
            <div className="stack" style={{ gap: 12 }}>
              <div>
                <div className="t-strong" style={{ marginBottom: 3 }}>The asterisks</div>
                <p className="page-sub" style={{ margin: 0 }}>{APOLLO_FLAG_NOTE}</p>
              </div>
              <div>
                <div className="t-strong" style={{ marginBottom: 3 }}>Three parking spaces need a lot number</div>
                <p className="page-sub" style={{ margin: 0 }}>{APOLLO_PARKING_NOTE}</p>
              </div>
              <div>
                <div className="t-strong" style={{ marginBottom: 3 }}>Roster against 2025</div>
                <p className="page-sub" style={{ margin: 0 }}>
                  Today's roster bills {money(k.apolloMonthlyBilled)} a month — {money(k.apolloAnnualisedCurrent)} a
                  year, against {money(k.apolloGross)} collected in 2025. Most of that gap is a year of rent
                  increases; part of it may be the parking, which the 2025 sheet may never have counted.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="section">
        <div className="toolbar">
          <div className="section-title" style={{ margin: 0 }}>Tenant registry <span className="hint">{APOLLO_REGISTRY_LABEL}</span></div>
          <div className="spacer" />
          <input placeholder="Search name, address or phone…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ minWidth: 260 }} />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tenant</th><th>Address</th>
                <th className="num">Amount due</th><th className="num">Water</th><th className="num">Base rent</th>
                <th>Contacts</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td>
                    <span className="t-strong">{t.name}</span>
                    {t.flagged && <span className="badge warn" style={{ marginLeft: 6 }}>flagged</span>}
                    {t.isParking && <span className="badge mute" style={{ marginLeft: 6 }}>parking</span>}
                  </td>
                  <td className="t-mute">{t.address}</td>
                  <td className="num t-strong">{t.amountDue > 0 ? money(t.amountDue) : <span className="t-mute">Not listed</span>}</td>
                  <td className="num t-mute">{t.amountDue > 0 ? money(APOLLO_WATER_CHARGE) : '—'}</td>
                  <td className="num">{t.amountDue > 0 ? money(t.amountDue - APOLLO_WATER_CHARGE) : '—'}</td>
                  <td className="t-mute" style={{ fontSize: 11.5 }}>
                    {t.contacts.length === 0 ? '—' : t.contacts.map((c, i) => (
                      <span key={i} className="t-nowrap">{i > 0 ? ' · ' : ''}{c.label ? `${c.label} ` : ''}{c.phone}</span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="label" colSpan={2}>{paying.length} lots billed</td>
                <td className="num">{money(k.apolloMonthlyBilled)}</td>
                <td className="num">{money(k.apolloWaterRevenueMonthly)}</td>
                <td className="num">{money(k.apolloBaseRentMonthly)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  )
}
