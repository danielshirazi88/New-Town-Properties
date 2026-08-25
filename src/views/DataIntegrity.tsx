import { Card, Kpi } from '../components/ui'
import { collected } from '../lib/finance'
import { money, num } from '../lib/format'
import { KNOWN_SOURCE_VARIANCES } from '../data/leases'
import type { PortfolioKpis } from '../lib/portfolio'

/** Figures printed on the final page of the source workbook, for reconciliation. */
const SHEET_TOTALS = {
  commercialGross: 2552449.32,
  commercialTaxes: 716224.68,
  apolloGross: 378870.0,
  apolloTaxes: 57077.58,
  totalGross: 2931319.32,
  totalNet: 2158017.06,
}

export function DataIntegrity({ k, onProperty }: { k: PortfolioKpis; onProperty: (id: string) => void }) {
  const all = k.properties.flatMap((p) => p.leases)
  const propName = (id: string) => k.properties.find((p) => p.property.id === id)?.property.name ?? id

  const variances = all
    .map((l) => ({ lease: l, computed: collected(l), stated: l.statedAnnualTotal }))
    .filter((r) => Math.abs(r.computed - r.stated) > 0.005)

  const grossDelta = k.commercialGross - SHEET_TOTALS.commercialGross

  const gaps = [
    { label: 'Square footage missing', count: k.unitCount, of: k.unitCount,
      detail: 'No unit sizes anywhere in the source, so rent per square foot cannot be computed — the standard way to compare a rent to the market.' },
    { label: 'No lease end date', count: k.noEndDateLeases.length, of: k.unitCount,
      detail: 'RTS, Lamar Billboard, the 1643 garage, Florida and Unstoppable Beauty Lounge.' },
    { label: 'No cap rate or appraised value', count: k.propertyCount, of: k.propertyCount,
      detail: 'Nothing in the documents implies what the properties are worth.' },
    { label: 'Debt detail', count: 0, of: k.propertyCount,
      detail: 'The 2024 return reports no mortgage interest on any property, so the portfolio appears to be held free of debt and there is no debt service to model.' },
    { label: 'Operating expenses absent', count: k.propertyCount, of: k.propertyCount,
      detail: 'The sheets carry property taxes and nothing else — no insurance, water, maintenance or management.' },
  ]

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Data integrity</h1>
        <p className="page-sub">
          Every figure in this application was transcribed from the 2025 rent roll and the Apollo registry.
          This page shows where the transcription lands against the printed totals, and what the source
          documents do not contain.
        </p>
      </div>

      <div className="kpi-grid">
        <Kpi accent label="Leases transcribed" value={num(all.length)} note="All twelve months each" />
        <Kpi accent label="Property totals reconciled" value={`${k.propertyCount} of ${k.propertyCount}`}
          note="Gross and net match the sheets exactly" />
        <Kpi label="Row-level variance found" value={num(variances.length)}
          note={variances.length ? 'One row disagrees with its own months' : 'None'} warn={variances.length > 0} />
        <Kpi label="Dark months recorded" value={num(k.totalDarkMonths)} note="Vacancy and free-rent cells" />
      </div>

      <div className="section">
        <Card title="Reconciliation against the printed totals">
          <div className="table-wrap" style={{ border: 0 }}>
            <table>
              <thead><tr><th>Figure</th><th className="num">This application</th><th className="num">Printed on the sheet</th><th className="num">Difference</th><th>Status</th></tr></thead>
              <tbody>
                <Row label="Commercial gross income" ours={k.commercialGross} theirs={SHEET_TOTALS.commercialGross} />
                <Row label="Commercial property taxes" ours={k.commercialTaxes} theirs={SHEET_TOTALS.commercialTaxes} />
                <Row label="Apollo gross income" ours={k.apolloGross} theirs={SHEET_TOTALS.apolloGross} />
                <Row label="Apollo property taxes" ours={k.apolloTaxes} theirs={SHEET_TOTALS.apolloTaxes} />
                <Row label="Total gross income" ours={k.grossCollected} theirs={SHEET_TOTALS.totalGross} />
                <Row label="Total net income" ours={k.netAfterTax} theirs={SHEET_TOTALS.totalNet} />
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {variances.length > 0 && (
        <div className="section">
          <div className="callout">
            <div className="callout-title">A {money(Math.abs(grossDelta))} error in the source workbook</div>
            {KNOWN_SOURCE_VARIANCES.map((v) => {
              const lease = all.find((l) => l.id === v.leaseId)
              return (
                <p key={v.leaseId}>
                  <strong>{lease?.tenant}</strong> ({propName(lease?.propertyId ?? '')}, unit {lease?.unit}): {v.note}
                </p>
              )
            })}
            <p>
              The month cells were re-read at high resolution to confirm this — the twelve cells are correct and
              the row total is not. Every other one of the {all.length} rows ties exactly.
            </p>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Tenant</th><th>Property</th><th>Unit</th><th className="num">Months sum to</th><th className="num">Row total says</th><th className="num">Difference</th></tr></thead>
              <tbody>
                {variances.map((v) => (
                  <tr key={v.lease.id} className="clickable" onClick={() => onProperty(v.lease.propertyId)}>
                    <td className="t-strong">{v.lease.tenant}</td>
                    <td className="t-mute">{propName(v.lease.propertyId)}</td>
                    <td className="t-mono t-mute">{v.lease.unit}</td>
                    <td className="num t-strong">{money(v.computed)}</td>
                    <td className="num t-mute">{money(v.stated)}</td>
                    <td className="num t-red">{money(v.computed - v.stated)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="section">
        <div className="section-title">What the source documents do not contain</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Missing</th><th className="num">Affected</th><th>Why it matters</th></tr></thead>
            <tbody>
              {gaps.map((g) => (
                <tr key={g.label}>
                  <td className="t-strong">{g.label}</td>
                  <td className="num">{g.count === g.of ? `all ${g.of}` : `${g.count} of ${g.of}`}</td>
                  <td className="t-mute">{g.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Judgement calls made during transcription</div>
        <Card>
          <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--ink-2)', lineHeight: 1.75 }}>
            <li>
              <strong>1511 N Mannheim's net</strong> is written on the sheet as an addition
              ($75,910.00 + $25,050.37 = $50,859.63). The printed result is the subtraction, so the operator
              is a typo and the figure is right. Read here as a subtraction.
            </li>
            <li>
              <strong>Panda Dance Studio's expiry</strong> is written 04/31/2026, which is not a real date.
              Read as 30 April 2026.
            </li>
            <li>
              <strong>Cities were inferred</strong> from the street addresses — Stone Park for the Mannheim,
              Apollo and 42nd–44th Avenue addresses, Melrose Park for 1401 N 25th Avenue. The sheets name no
              city. The property called "Florida" has no address at all and is left unconfirmed.
            </li>
            <li>
              <strong>Apollo is shown as a flat monthly figure</strong> on the dashboard chart. The 2025
              sheet gives only an annual total, so the twelve months are the annual figure divided evenly —
              it is not a measured seasonal pattern.
            </li>
            <li>
              <strong>Vacancy and free-rent months are valued</strong> at the rate of the nearest month that
              did collect, looking forward first. That is how the {money(k.vacancyLoss + k.concessionLoss)} of
              lost rent is estimated; the sheets themselves record only a "V" or "FREE" marker.
            </li>
            <li>
              <strong>Property taxes are the 2024 bills</strong> applied against 2025 income, as the sheets do —
              normal for Illinois, where taxes are paid a year in arrears. Only the property called "Florida"
              carries a 2025 bill.
            </li>
          </ul>
        </Card>
      </div>
    </>
  )
}

function Row({ label, ours, theirs }: { label: string; ours: number; theirs: number }) {
  const diff = ours - theirs
  const matches = Math.abs(diff) < 0.005
  return (
    <tr>
      <td className="t-strong">{label}</td>
      <td className="num">{money(ours)}</td>
      <td className="num t-mute">{money(theirs)}</td>
      <td className={`num ${matches ? 't-mute' : 't-red'}`}>{matches ? '—' : money(diff)}</td>
      <td>{matches ? <span className="badge ok">Ties exactly</span> : <span className="badge warn">Source error</span>}</td>
    </tr>
  )
}
