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
| **Square footage** | Area, rent per square foot, empty space and what it costs |
| **Year over year** | What moved between rent rolls — turnover, vacancy, rent growth, per property and per unit |
| **Rent roll** | Every tenant in the portfolio — the 52 commercial suites and the 37 Apollo lots, filterable by segment. Exports to CSV |
| **Lease expirations** | Sorted by urgency, from already-lapsed through to beyond a year |
| **Annual bumps** | Contracted escalation against what the rent actually did |
| **Apollo park** | The trailer park — 37 lots plus 5 parking spaces, water recovery, base rent, full registry (also reachable from Properties) |
| **Tenant profile** | Contact directory per tenant — phone, email, mailing address, preferred payment method (Zelle, ACH, check, cash, wire, or a custom one), plus that tenant's rent ledger and payment record. Reached by clicking a tenant on any property |
| **Rent collection** | The month-by-month collection grid: every tenant against every month, green once settled. Record a payment on any cell, with a live late-fee reading |
| **Accounts receivable** | What is outstanding, aged from the due date — by tenant, by property, by bucket |
| **Slow payers & late fees** | Days to pay per tenant, fastest against slowest, and what the late fees come to — accrued and projected |
| **Expenses** | Manual entry by property and category, with receipt/invoice upload |
| **Tax returns** | Returns as filed — the 1040 and IL-1040 line by line, Schedule E per property, interest by bank, and what moved between years. Read-only: this is the archive, not the worksheet |
| **Shirazi Trust** | The trust's schedule of assets — all 18 holdings with purchase date, address, type and price, plus the estimated-value column the schedule asks for. Every field editable |
| **Assets** | The whole estate: property from the trust schedule, deposits with their bank, rate, interest dates and maturities, and vehicles with VIN, mileage, what was paid and what it is worth now. Charted by class |
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

**2. Mannheim Plaza is triple net; everything else is modified gross.** Confirmed by the
owner — the source documents never state it. That matters for one figure in particular: under
triple net the tenants reimburse the property tax, yet the sheet still subtracts Mannheim
Plaza's full $83,142.43 bill from its rent to reach net. If those reimbursements are billed
separately and are not inside the $377,925.32 rent figure, that property earns up to
$83,142.43 more than shown — about $1.04M of value at an 8% cap. Nothing is adjusted on that
basis; the app reports the sheet's figures and surfaces the question.

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

**Adding a year.** Each rent roll lives in `src/data/rentRolls/y<year>.ts` with its own
lease lines, its own tax bills and its own printed totals, registered in
`src/data/rentRolls/index.ts`. Years are kept whole and separate rather than merged,
because tenants turn over, units sit empty and properties get bought and sold — a
portfolio modelled as one list with dates attached loses all of that. A property carries
`acquiredYear` and `soldYear`, so selling a building removes it from later years without
rewriting the years you owned it.

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

## Rent collection, in the landlord's own terms

Rent falls due on the 1st. A payment made any time through the **5th** is on time — no
penalty. From the **6th**, **$15 a day** accrues, counted per calendar day, and it keeps
accruing until the balance clears. A part payment does not stop the clock; the month has to
be covered in full. Any month's fee can be waived when the payment is recorded, and waived
fees are shown separately rather than dropped, so what was given up stays visible.

**Days to pay (DTP)** runs from the 1st to the day the month was fully covered — paying on
the 1st is 0 days, paying on the 5th is 4 days and still on time. DTP and on-time rate answer
different questions and are kept apart.

Two things to know before reading the receivables figures:

- **A balance means "not recorded as paid", not "confirmed unpaid."** Nothing is imported
  from a bank; a month is outstanding until someone marks it collected. With an empty ledger
  the receivables screen shows the whole year as owed, which is why it says so in a banner.
- **Set a tracking start month** on the Rent collection tab if you are starting from today
  rather than backfilling. Months before it fall out of scope — not receivable, not late, not
  counted — instead of reading as years of unpaid rent.

---

## The trust schedule and the asset register

**The trust's Schedule of Assets is the ownership record.** Eighteen holdings,
transcribed from the trust's own paper as updated 27 April 2026, with the
purchase date, address, type and price it records. It is wider than the rent
roll on purpose: the rent roll covers what pays rent, and this covers
everything, including the two residences and the condo held for resale.

The schedule is kept as transcribed and edits are stored as patches over it, the
same way rent-roll overrides work — so a correction never destroys what the
document says, every hand edit is visible as one, and any of them can be
reverted.

**West Plaza was sold on seller financing** on 30 April 2026, three days after
the schedule was drawn up, so the schedule still lists it as a building. What
the trust holds is the buyer's note: $1,000,000 outstanding, $6,140.87 a month,
balloon due 30 April 2029. It is valued at the balance rather than at what the
building would capitalise at — otherwise the estate would count the property and
the note it was exchanged for, and a receivable that can default would be
recorded as bricks that can only go vacant.

A rental's estimated value is its own net income capitalised at the cap rate set
on the Valuation screen. Type a figure over it and yours wins: an appraisal
knows more than a cap rate does. **Real estate lives only here** — the asset
register reads it rather than keeping a second list that could drift.

The register itself covers what the schedule does not:

- **Investments** record the institution, the type, the balance, the rate, how
  often interest pays, the next interest date and the maturity. Deposits at or
  near maturity are surfaced, because a matured CD usually sits in a low-rate
  sweep until somebody moves it.
- **Vehicles** record purchase price, where it was bought, VIN, current mileage
  and current value.

**Anything with no value entered counts as zero, never as its purchase price.**
Guessing depreciation would put an invented number into a net-worth total, so
unvalued rows are excluded and counted separately in plain sight.

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
