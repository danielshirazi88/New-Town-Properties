import { useState, type ReactNode } from 'react'
import { MONTHS } from '../lib/finance'
import { money, moneyShort } from '../lib/format'

/** Validated 6-step ordinal ramp — one hue, monotone lightness, clears the surface. */
export const RAMP = ['#8f151d', '#b32029', '#d33a3b', '#e86a60', '#f79a8c', '#ffc4b8']

export function rampStep(value: number, max: number): string {
  if (max <= 0 || value <= 0) return '#1b1b1b'
  const i = Math.min(RAMP.length - 1, Math.floor((value / max) * RAMP.length))
  return RAMP[i]
}

/** Above this ramp index the fill is light enough to need dark ink on top. */
const LIGHT_FROM = 3

interface Tip { x: number; y: number; node: ReactNode }

function Tooltip({ tip, width }: { tip: Tip; width: number }) {
  const flip = tip.x > width * 0.6
  return (
    <div
      className="tooltip"
      style={{
        left: flip ? undefined : tip.x + 14,
        right: flip ? width - tip.x + 14 : undefined,
        top: Math.max(0, tip.y - 12),
      }}
    >
      {tip.node}
    </div>
  )
}

/* ══ Monthly income — single series, so no legend; the title names it ══════ */

export function MonthlyAreaChart({
  series,
  height = 220,
  label = 'Total collected',
}: {
  series: number[]
  height?: number
  label?: string
}) {
  const [tip, setTip] = useState<Tip | null>(null)
  const W = 1000
  const padL = 62
  const padR = 16
  const padT = 16
  const padB = 28
  const innerW = W - padL - padR
  const innerH = height - padT - padB

  const max = Math.max(...series) * 1.08
  const min = Math.min(...series) * 0.9
  const span = max - min || 1
  const x = (i: number) => padL + (i / (series.length - 1)) * innerW
  const y = (v: number) => padT + innerH - ((v - min) / span) * innerH

  const line = series.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ')
  const area = `${line} L${x(series.length - 1)},${padT + innerH} L${padL},${padT + innerH} Z`

  const ticks = 4
  const gridVals = Array.from({ length: ticks + 1 }, (_, i) => min + (span * i) / ticks)

  return (
    <div className="chart-shell" onMouseLeave={() => setTip(null)}>
      <svg className="chart-svg" viewBox={`0 0 ${W} ${height}`} role="img" aria-label={`${label} by month`}>
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e5484d" stopOpacity="0.42" />
            <stop offset="100%" stopColor="#e5484d" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {gridVals.map((v, i) => (
          <g key={i}>
            <line className="grid-line" x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} />
            <text className="axis-text mono" x={padL - 8} y={y(v) + 3.5} textAnchor="end">
              {moneyShort(v)}
            </text>
          </g>
        ))}

        <path d={area} fill="url(#areaFill)" />
        <path d={line} fill="none" stroke="#e5484d" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {series.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r={4} fill="#e5484d" stroke="#0a0a0a" strokeWidth={2} />
        ))}

        {series.map((_, i) => (
          <text key={i} className="axis-text" x={x(i)} y={height - 8} textAnchor="middle">
            {MONTHS[i]}
          </text>
        ))}

        {/* Hit targets sit above the marks and are wider than them. */}
        {series.map((v, i) => (
          <rect
            key={`hit-${i}`}
            x={x(i) - innerW / (series.length - 1) / 2}
            y={padT}
            width={innerW / (series.length - 1)}
            height={innerH}
            fill="transparent"
            onMouseEnter={(e) => {
              const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect()
              setTip({
                x: (x(i) / W) * r.width,
                y: (y(v) / height) * r.height,
                node: (
                  <>
                    <div className="tooltip-title">{MONTHS[i]} 2025</div>
                    <div className="tooltip-row">
                      <span>{label}</span>
                      <b>{money(v)}</b>
                    </div>
                    {i > 0 && (
                      <div className="tooltip-row">
                        <span>vs {MONTHS[i - 1]}</span>
                        <b>{series[i] >= series[i - 1] ? '+' : ''}{money(series[i] - series[i - 1])}</b>
                      </div>
                    )}
                  </>
                ),
              })
            }}
          />
        ))}
      </svg>
      {tip && <Tooltip tip={tip} width={1000} />}
    </div>
  )
}

/* ══ Month × property heatmap — magnitude, so one hue light→dark ══════════ */

export interface HeatRow {
  id: string
  name: string
  values: number[]
  total: number
}

export function MonthPropertyHeatmap({
  rows,
  onSelect,
}: {
  rows: HeatRow[]
  onSelect?: (id: string) => void
}) {
  const [tip, setTip] = useState<Tip | null>(null)
  const labelW = 210
  const cellW = 62
  const cellH = 30
  const headH = 24
  const W = labelW + cellW * 12 + 92
  const H = headH + rows.length * cellH

  /**
   * Each row is shaded against its own range, not the whole grid — otherwise the
   * large properties swamp the small ones and nobody's seasonality is visible.
   *
   * A row whose months barely move is painted one flat mid-tone rather than
   * stretched across the ramp: amplifying a 2% wobble into the full colour range
   * would invent a pattern that is not there. Rows that genuinely swing — a
   * vacancy, a re-let, a step in rent — grade across the ramp and stand out.
   */
  const shading = rows.map((r) => {
    const live = r.values.filter((v) => v > 0)
    const hi = live.length ? Math.max(...live) : 0
    const lo = live.length ? Math.min(...live) : 0
    return { hi, lo, flat: hi <= 0 || (hi - lo) / hi < 0.06 }
  })

  const stepFor = (value: number, ri: number): number => {
    if (value <= 0) return -1
    const { hi, lo, flat } = shading[ri]
    if (flat) return 2
    return Math.min(RAMP.length - 1, Math.floor(((value - lo) / (hi - lo)) * (RAMP.length - 0.001)))
  }

  return (
    <div className="chart-shell" onMouseLeave={() => setTip(null)}>
      <div style={{ overflowX: 'auto' }}>
        <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} style={{ minWidth: W * 0.7 }} role="img" aria-label="Monthly income by property">
          {MONTHS.map((m, i) => (
            <text key={m} className="axis-text" x={labelW + i * cellW + cellW / 2} y={16} textAnchor="middle">
              {m}
            </text>
          ))}
          <text className="axis-text" x={labelW + 12 * cellW + 46} y={16} textAnchor="middle">
            Year
          </text>

          {rows.map((row, ri) => (
            <g key={row.id}>
              <text
                className="axis-text"
                x={0}
                y={headH + ri * cellH + cellH / 2 + 3.5}
                style={{ fill: '#b4b4b4', fontSize: 11.5, cursor: onSelect ? 'pointer' : 'default' }}
                onClick={() => onSelect?.(row.id)}
              >
                {row.name.length > 28 ? `${row.name.slice(0, 27)}…` : row.name}
              </text>

              {row.values.map((v, ci) => {
                const idx = stepFor(v, ri)
                const fill = idx < 0 ? '#1b1b1b' : RAMP[idx]
                return (
                  <g key={ci}>
                    <rect
                      className={`heat-cell${onSelect ? ' interactive' : ''}`}
                      x={labelW + ci * cellW}
                      y={headH + ri * cellH}
                      width={cellW}
                      height={cellH}
                      fill={fill}
                      onClick={() => onSelect?.(row.id)}
                      onMouseEnter={(e) => {
                        const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect()
                        setTip({
                          x: ((labelW + ci * cellW + cellW / 2) / W) * r.width,
                          y: ((headH + ri * cellH) / H) * r.height,
                          node: (
                            <>
                              <div className="tooltip-title">{row.name}</div>
                              <div className="tooltip-row">
                                <span>{MONTHS[ci]} 2025</span>
                                <b>{money(v)}</b>
                              </div>
                              <div className="tooltip-row">
                                <span>Share of year</span>
                                <b>{row.total > 0 ? `${((v / row.total) * 100).toFixed(1)}%` : '—'}</b>
                              </div>
                            </>
                          ),
                        })
                      }}
                    />
                    {v > 0 && (
                      <text
                        className={`heat-label${idx >= LIGHT_FROM ? ' dark' : ''}`}
                        x={labelW + ci * cellW + cellW / 2}
                        y={headH + ri * cellH + cellH / 2 + 3.5}
                        textAnchor="middle"
                      >
                        {(v / 1000).toFixed(0)}k
                      </text>
                    )}
                  </g>
                )
              })}

              <text
                className="mark-label"
                x={W - 8}
                y={headH + ri * cellH + cellH / 2 + 3.5}
                textAnchor="end"
              >
                {moneyShort(row.total)}
              </text>
            </g>
          ))}
        </svg>
      </div>
      {tip && <Tooltip tip={tip} width={W} />}
      <div className="legend">
        <span className="t-mute">Shaded within each row, low → high:</span>
        {RAMP.map((c, i) => (
          <span key={c} className="legend-item">
            <span className="legend-swatch" style={{ background: c }} />
            {i === 0 ? 'low' : i === RAMP.length - 1 ? 'high' : ''}
          </span>
        ))}
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: '#1b1b1b', border: '1px solid #3a3a3a' }} />
          no rent collected
        </span>
        <span className="t-mute">
          Values in $000s. A row that held steady all year is painted one flat tone. Click a row for the property.
        </span>
      </div>
    </div>
  )
}

/* ══ Nominal bars — all one hue; length carries the magnitude ═════════════ */

export function RankedBars({
  items,
  height = 20,
  formatValue = money,
  onSelect,
}: {
  items: { id: string; label: string; value: number; sub?: string }[]
  height?: number
  formatValue?: (n: number) => string
  onSelect?: (id: string) => void
}) {
  const max = Math.max(...items.map((i) => i.value), 1)
  return (
    <div className="stack" style={{ gap: 9 }}>
      {items.map((it) => (
        <div
          key={it.id}
          className="timeline-row"
          style={{ cursor: onSelect ? 'pointer' : 'default' }}
          onClick={() => onSelect?.(it.id)}
        >
          <div style={{ width: 190, flex: 'none', fontSize: 12.5 }} className="t-nowrap">
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.label}</div>
            {it.sub && <div className="t-mute" style={{ fontSize: 11 }}>{it.sub}</div>}
          </div>
          <div className="timeline-track" style={{ height }}>
            <div
              className="timeline-fill"
              style={{ left: 0, width: `${(it.value / max) * 100}%`, background: '#e5484d' }}
            />
          </div>
          <div className="t-mono" style={{ width: 96, textAlign: 'right', flex: 'none', fontSize: 12.5 }}>
            {formatValue(it.value)}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ══ Small multiple — one property's twelve months ════════════════════════ */

export function Sparkline({ values, height = 42 }: { values: number[]; height?: number }) {
  const W = 220
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1
  const x = (i: number) => (i / (values.length - 1)) * W
  const y = (v: number) => height - 4 - ((v - min) / span) * (height - 10)
  const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ')
  const area = `${line} L${W},${height} L0,${height} Z`
  return (
    <svg className="chart-svg" viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" style={{ height }}>
      <path d={area} fill="rgba(229,72,77,0.16)" />
      <path d={line} fill="none" stroke="#e5484d" strokeWidth={2} strokeLinejoin="round" />
    </svg>
  )
}

/* ══ Lease expiration ladder ══════════════════════════════════════════════ */

export function LadderChart({
  buckets,
  height = 190,
}: {
  buckets: { year: number; count: number; rent: number }[]
  height?: number
}) {
  const [tip, setTip] = useState<Tip | null>(null)
  const W = 1000
  const padL = 62
  const padR = 14
  const padT = 18
  const padB = 40
  const innerW = W - padL - padR
  const innerH = height - padT - padB
  const max = Math.max(...buckets.map((b) => b.rent), 1)
  const bw = innerW / buckets.length
  const thisYear = new Date().getFullYear()

  return (
    <div className="chart-shell" onMouseLeave={() => setTip(null)}>
      <svg className="chart-svg" viewBox={`0 0 ${W} ${height}`} role="img" aria-label="Annual rent expiring by year">
        <line className="axis-line" x1={padL} x2={W - padR} y1={padT + innerH} y2={padT + innerH} />
        {buckets.map((b, i) => {
          const h = (b.rent / max) * innerH
          const bx = padL + i * bw + bw * 0.16
          const bwid = bw * 0.68
          const past = b.year < thisYear
          return (
            <g key={b.year}>
              <rect
                x={bx}
                y={padT + innerH - h}
                width={bwid}
                height={h}
                rx={4}
                fill={past ? '#ff5a5f' : '#b32029'}
                onMouseEnter={(e) => {
                  const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect()
                  setTip({
                    x: ((bx + bwid / 2) / W) * r.width,
                    y: ((padT + innerH - h) / height) * r.height,
                    node: (
                      <>
                        <div className="tooltip-title">{b.year}{past ? ' — already lapsed' : ''}</div>
                        <div className="tooltip-row"><span>Leases</span><b>{b.count}</b></div>
                        <div className="tooltip-row"><span>Annual rent</span><b>{money(b.rent)}</b></div>
                      </>
                    ),
                  })
                }}
              />
              <text className="mark-label" x={bx + bwid / 2} y={padT + innerH - h - 6} textAnchor="middle">
                {moneyShort(b.rent)}
              </text>
              <text className="axis-text" x={bx + bwid / 2} y={padT + innerH + 15} textAnchor="middle">
                {b.year}
              </text>
              <text className="axis-text" x={bx + bwid / 2} y={padT + innerH + 28} textAnchor="middle" style={{ fill: '#7d7d7d' }}>
                {b.count} {b.count === 1 ? 'lease' : 'leases'}
              </text>
            </g>
          )
        })}
      </svg>
      {tip && <Tooltip tip={tip} width={1000} />}
      <div className="legend">
        <span className="legend-item"><span className="legend-swatch" style={{ background: '#ff5a5f' }} />Already lapsed — on holdover</span>
        <span className="legend-item"><span className="legend-swatch" style={{ background: '#b32029' }} />Still running</span>
      </div>
    </div>
  )
}
