# New Town Properties — Portfolio OS

A bird's-eye operating system for the New Town Properties portfolio: 14 holdings,
52 commercial units, 37 mobile-home lots and 5 tandem parking spaces, with the rent roll, lease calendar,
escalations, expense ledger and valuation model in one place.

Built from the **2025 rent roll workbook** (8 scanned pages) and the **Apollo Mobile
Home Court tenant registry (July 2026)**.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static bundle in dist/
npm test         # 33 tests: figures locked to the source documents, plus storage round-trips
```

The build is a plain static site — `dist/` can be opened from disk or hosted anywhere.
There is no server and no database.

---

## What's in it

| View | What it answers |
|---|---|
| **Executive dashboard** | Total income, net after tax, month-by-month income for the whole portfolio and for every property, what needs attention |
| **Properties** | Every holding, with a rent roll, a month-by-month grid and an expense tab per property |
| **Rent roll** | Every tenant in the portfolio — the 52 commercial suites and the 37 Apollo lots, filterable by segment. Exports to CSV |
| **Lease expirations** | Sorted by urgency, from already-lapsed through to beyond a year |
| **Annual bumps** | Contracted escalation against what the rent actually did |
| **Apollo park** | The trailer park — 37 lots plus 5 parking spaces, water recovery, base rent, full registry (also reachable from Properties) |
| **Expenses** | Manual entry by property and category, with receipt/invoice upload |
| **Valuation** | NOI and implied value across cap rates, on adjustable assumptions |
| **Data integrity** | Reconciliation against the printed totals, and what the source documents don't contain |

---

## The 2025 numbers

Everything reconciles to the workbook exactly, with one exception:

| Figure | This application | Printed on the sheet |
|---|---:|---:|
| Commercial gross | $2,552,599.32 | $2,552,449.32 |
| Commercial taxes | $716,224.68 | $716,224.68 |
| Apollo gross | $378,870.00 | $378,870.00 |
| Apollo taxes | $57,077.58 | $57,077.58 |
| **Total gross** | **$2,931,469.32** | $2,931,319.32 |
| **Total net** | **$2,158,167.06** | $2,158,017.06 |

**The $150 difference is an error in the source workbook.** SL Envios Inc (Plaza #2, unit
1681A) has twelve month cells of 5 × $3,330 and 7 × $3,495, which sum to **$41,115** — but
the row total is printed as **$40,965**, and that understated figure rolls up into the
Plaza #2 total, the commercial total and the grand total. The cells were re-read at 400 dpi
to confirm it. Every other one of the 52 rows ties exactly.

Two further typos in the source are read through rather than reproduced: 1511 N Mannheim's
net is written as an addition but the printed result is the subtraction, and Panda Dance
Studio's expiry is written 04/31/2026, which is not a real date.

---

## Two things worth knowing before quoting a number

**1. The workbook's "net income" is not NOI.** It subtracts property taxes and nothing
else — no insurance, water and sewer, maintenance, management, landscaping, snow removal
or legal. Capitalising that figure overstates what the portfolio is worth, because a buyer
inherits those costs. The Valuation view reports both bases and lets you set an operating
expense allowance, or swap it for real costs once they're logged in Expenses.

**2. Nothing states whether these leases are triple net or modified gross.** All 52 sit
unclassified. The bookkeeping hints at the answer — the sheets subtract the tax bill from
gross rent, and a landlord only carries that cost when the tenant isn't reimbursing it,
which points to gross or modified gross. But that is an inference, not a fact from the
documents. Confirming it against the actual leases is the highest-value data fix available:
it moves both the NOI and the valuation.

---

## Running it as a shared platform

The app runs two ways, and the sidebar always says which:

- **This browser only** — no server. Everything typed stays on that machine.
- **Shared** — a Node server and Postgres behind it, so everyone sees the same
  numbers and edits show up within about fifteen seconds.

Shared mode is a Railway deploy from this repo: one service, one database, two
environment variables. See **[docs/HOSTING.md](docs/HOSTING.md)**.

```bash
npm run build
DATABASE_URL=postgresql://localhost/ntp APP_PASSWORD=secret npm start
```

## Adding your own data

**Expenses** are entered in the app: pick the property from the dropdown, choose a category
(appliances, structural, contractor, plumbing, roofing, and fourteen more), mark it operating
or capital, and drag in the receipt or invoice. Categories that are normally capitalised
preselect "capital" for you, and capital spend is kept out of NOI because it's depreciated
against the building instead.

Expense records live in this browser's `localStorage`; receipt files live in IndexedDB.
Nothing is uploaded anywhere — there is no server. That also means the data is per-browser
and per-machine, so **export to CSV regularly** if it matters. Both the expense ledger and
the rent roll have an Export CSV button.

**Rent roll corrections** are made in the app: the Rent roll tab has an Edit button on
every line for rent, dates, annual bump, lease type and square footage. Edits are stored
as patches over the source documents rather than replacing them, so the original figure
from the workbook is never lost, every edited line is badged, and any change can be
reverted. The person's name and an optional reason are recorded with each one.

**Bulk or structural changes** still go in `src/data/leases.ts`. Each lease carries twelve month cells
(a number, `'V'` for vacant or `'FREE'` for a concession) plus the annual total printed on
the sheet. The test suite checks the two against each other, so a mistyped month fails the
build rather than quietly changing the dashboard.

`src/data/properties.ts` holds the parcels and tax bills; `src/data/apollo.ts` holds the
trailer-park registry.

---

## What the source documents don't have

These are the gaps, in rough order of how much they'd improve the picture:

- **Lease type** (triple net vs modified gross) — changes NOI and value
- **Square footage** — without it there's no rent per square foot, the standard way to
  test a rent against the market
- **Mortgage and debt detail** — no debt service, DSCR, equity position or cash-on-cash return
- **Operating expenses** — the Expenses view is there to close this one
- **Cap rate or appraised value** — nothing in the documents implies what these are worth
- **Apollo month-by-month** — only an annual total exists for 2025, so the dashboard chart
  spreads it evenly rather than showing a measured pattern
- **Three of the five parking spaces have no lot number** — the registry names only 4211 and
  4209 Apollo Lane, and gives no rent for either; the count and the $100 rate came from the owner
- **Whether the 2025 Apollo gross includes parking** — $500 a month is $6,000 a year, and the
  sheet's single annual figure gives no way to tell if it is already in there

---

## Design

Black, red and white throughout. Because the palette is a single accent hue, the charts
never use colour to tell one property from another — identity comes from position, ordering
and direct labels, and colour is reserved for magnitude (the month × property grid) and for
flagging what needs attention. The one graded ramp is validated for monotone lightness,
step separation and contrast against the background.

## Layout

```
src/
  data/        properties, leases, Apollo registry — the transcribed source
  lib/         types, finance engine, portfolio KPIs, expense store, formatting
  components/  charts (hand-rolled SVG) and shared UI
  views/       one file per screen
tests/         reconciliation against the printed workbook
```
