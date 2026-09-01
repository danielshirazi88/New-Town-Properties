import type { Lease, MonthCell } from '../../lib/types'
import { APOLLO_TENANTS } from '../apollo'

const r = (value: MonthCell, n: number): MonthCell[] => Array.from({ length: n }, () => value)
/** September onward is not on this sheet yet — not reported, not vacant. */
const rest = r('NR', 4)

/**
 * The 2026 rent roll, covering January through August.
 *
 * Two things make this sheet different from the earlier ones.
 *
 * It is the first to carry **square footage**, **security deposits** and
 * **renewal options** — so rent per square foot, deposits held and option terms
 * become computable for the first time.
 *
 * And it records a **disposal**: West Plaza was sold on 30 April 2026. Its
 * tenants pay through April and stop, and from June a monthly owner-financing
 * payment from the buyer replaces them. That payment is note income, not rent,
 * and is marked as such so it is never divided by square footage or counted as
 * occupancy.
 *
 * The sheet prints no row or page totals, so unlike 2024 and 2025 there is
 * nothing here to reconcile the transcription against.
 */
export const LEASES_2026: Lease[] = [
  // ─── Plaza #1 — 1559 N Mannheim ────────────────────────────────────────────
  { id: 'p1-michoacana', propertyId: 'plaza-1', unit: '1A&B', tenant: 'Michocana',
    contacts: [{ name: 'Yvonne Cisneros', phone: '630-492-6404' }, { name: 'Joaquin Gaspar', phone: '224-245-7009' }, { name: 'Estela', phone: '708-262-3371' }],
    months: [...r(5963, 6), ...r(6260, 2), ...rest], statedAnnualTotal: 48298,
    leaseStart: '2013-07-01', leaseEnd: '2028-06-30', statedEscalationPct: 5, leaseType: 'MG',
    squareFeet: 1630, securityDeposit: 15000, renewalOptions: '5YR + 5YR' },
  { id: 'p1-metropcs', propertyId: 'plaza-1', unit: '1C', tenant: 'Metro PCS',
    contacts: [{ name: 'Harry', phone: '630-965-4139' }],
    months: [...r(2840, 8), ...rest], statedAnnualTotal: 22720,
    leaseStart: '2017-10-01', leaseEnd: '2026-09-30', statedEscalationPct: 3, leaseType: 'MG',
    squareFeet: 720, securityDeposit: 1700, renewalOptions: '1YR + 1YR + 1YR',
    notes: 'Back on a current lease after holding over since 2023. Runs out again in September 2026.' },
  { id: 'p1-premier', propertyId: 'plaza-1', unit: '1D&1E', tenant: 'Premier Stone Park',
    contacts: [{ name: 'Syam Kumar', phone: '312-626-4828' }, { name: 'Aathira Gopinath', phone: '312-358-1381' }],
    months: [...r(6015, 8), ...rest], statedAnnualTotal: 48120,
    leaseStart: '2024-09-01', leaseEnd: '2027-08-31', statedEscalationPct: 5, leaseType: 'MG',
    squareFeet: 1650, securityDeposit: 10000, renewalOptions: '5YR + 5YR' },
  { id: 'p1-purpura', propertyId: 'plaza-1', unit: '1F', tenant: 'Purpura Beauty Spa',
    contacts: [{ name: 'Diana Bernal', phone: '630-850-0291' }],
    months: [...r(3640, 4), ...r(3822, 4), ...rest], statedAnnualTotal: 29848,
    leaseStart: '2022-06-01', leaseEnd: '2026-05-31', statedEscalationPct: 5, leaseType: 'MG',
    squareFeet: 2100, securityDeposit: 3000, renewalOptions: '2YR' },
  { id: 'p1-superbubble', propertyId: 'plaza-1', unit: '1G', tenant: 'Superbubble',
    contacts: [{ name: 'Oscar Martinez', phone: '847-769-2183' }],
    months: [...r(5962, 3), ...r(6248, 5), ...rest], statedAnnualTotal: 49126,
    leaseStart: '2021-04-01', leaseEnd: '2029-03-31', statedEscalationPct: 5, leaseType: 'MG',
    squareFeet: 2300, securityDeposit: 10000, renewalOptions: '5YR' },
  { id: 'p1-carone', propertyId: 'plaza-1', unit: '2A', tenant: 'Franco Carone',
    contacts: [{ phone: '630-212-1885' }],
    months: [...r(2200, 8), ...rest], statedAnnualTotal: 17600,
    leaseStart: '2015-01-01', leaseEnd: '2031-12-30', statedEscalationPct: 5, leaseType: 'MG',
    squareFeet: 800, securityDeposit: 1500, renewalOptions: '5YR + 5YR' },
  { id: 'p1-unstoppable', propertyId: 'plaza-1', unit: '2B', tenant: 'Unstoppable Beauty Lounge',
    contacts: [{ name: 'Mariela Ibarra Valdez', phone: '773-934-3617' }],
    months: [1835, ...r(1915, 7), ...rest], statedAnnualTotal: 15240,
    leaseStart: '2025-01-14', leaseEnd: '2027-01-31', statedEscalationPct: 5, leaseType: 'MG',
    squareFeet: 700, securityDeposit: 3000, renewalOptions: '2YR',
    notes: 'Finally let. This unit produced nothing in either 2024 or 2025.' },
  { id: 'p1-bonita', propertyId: 'plaza-1', unit: '2C', tenant: 'Bonita Beauty Bar',
    contacts: [{ name: 'Jose "Rudy" Salmeron', phone: '708-407-6233' }, { name: 'Lilia Rodriguez', phone: '708-838-5846' }],
    months: [1716, ...r(1802, 7), ...rest], statedAnnualTotal: 14330,
    leaseStart: '2024-02-01', leaseEnd: '2027-01-31', statedEscalationPct: 5, leaseType: 'MG',
    squareFeet: 640, securityDeposit: 1635, renewalOptions: '2YR + 2YR + 2YR' },
  { id: 'p1-casa-migrante', propertyId: 'plaza-1', unit: '2D', tenant: 'Casa Migrante Binacional LLC',
    contacts: [{ name: 'Maricela Medina', phone: '708-435-3449' }],
    months: [...r(1737, 8), ...rest], statedAnnualTotal: 13896,
    leaseStart: '2024-01-01', leaseEnd: '2026-12-31', statedEscalationPct: 5, leaseType: 'MG',
    squareFeet: 700, securityDeposit: 1595 },
  { id: 'p1-farmers', propertyId: 'plaza-1', unit: '2E', tenant: 'Farmers Insurance',
    contacts: [{ name: 'Nori', phone: '773-412-8987' }, { phone: '708-865-0330' }],
    months: [1400, ...r(1495, 7), ...rest], statedAnnualTotal: 11865,
    leaseStart: '2005-02-01', leaseEnd: '2029-01-31', statedEscalationPct: 5, leaseType: 'MG',
    squareFeet: 700, securityDeposit: 1500, renewalOptions: '2YR + 2YR + 2YR' },
  // The four empty units at Plaza #1. The sheet prints square footage and
  // nothing else, so until the owner priced them their downtime was valued at
  // zero and the space looked free to leave empty. The asking rents below are
  // his, given 1 September 2026 — what the space should fetch, not what anyone
  // is paying. They value the vacancy; they are never counted as income.
  { id: 'p1-apartment', propertyId: 'plaza-1', unit: '2F', tenant: 'Apartment — vacant',
    contacts: [], months: [...r('V', 8), ...rest], statedAnnualTotal: 0, leaseType: 'MG',
    squareFeet: 800, askingRent: 1495, notes: 'Empty all year so far.' },
  { id: 'p1-rw-warehouse', propertyId: 'plaza-1', unit: 'RW Warehouse', tenant: 'Warehouse — vacant',
    contacts: [], months: [...r('V', 8), ...rest], statedAnnualTotal: 0, leaseType: 'MG',
    squareFeet: 2500, askingRent: 4000, notes: 'First appears on the 2026 sheet. At 2,500 sq ft this is the largest empty space in the portfolio.' },
  { id: 'p1-r1', propertyId: 'plaza-1', unit: 'R1', tenant: 'R1 — vacant',
    contacts: [], months: [...r('V', 8), ...rest], statedAnnualTotal: 0, leaseType: 'MG',
    squareFeet: 560, askingRent: 500 },
  { id: 'p1-r2', propertyId: 'plaza-1', unit: 'R2', tenant: 'R2 — vacant',
    contacts: [], months: [...r('V', 8), ...rest], statedAnnualTotal: 0, leaseType: 'MG',
    squareFeet: 310, askingRent: 500 },

  // ─── Plaza #2 — 1681–93 N Mannheim ─────────────────────────────────────────
  { id: 'p2-stone-park-gold', propertyId: 'plaza-2', unit: '1693', tenant: 'Stone Park Gold',
    contacts: [{ name: 'Anthony Cascio', phone: '773-504-2009' }],
    months: [...r(5389, 7), 5658, ...rest], statedAnnualTotal: 43381,
    leaseStart: '2017-07-31', leaseEnd: '2027-07-31', statedEscalationPct: 5, leaseType: 'MG',
    squareFeet: 1925, securityDeposit: 5300, renewalOptions: '2YR' },
  { id: 'p2-la-michoacana', propertyId: 'plaza-2', unit: '1691', tenant: 'La Michoacana Stone Park',
    contacts: [{ name: 'Yesenia', phone: '708-314-6775' }, { name: 'Raul', phone: '708-314-6771' }],
    months: [3765, ...r(3941, 7), ...rest], statedAnnualTotal: 31352,
    leaseStart: '2025-02-01', leaseEnd: '2028-01-31', statedEscalationPct: 5, leaseType: 'MG',
    squareFeet: 1100, securityDeposit: 15000, renewalOptions: '3YR + 3YR' },
  { id: 'p2-washland', propertyId: 'plaza-2', unit: '1687–1689', tenant: 'Washland',
    contacts: [{ name: 'Lyda Hernandez', phone: '708-852-9369' }, { name: 'Oscar Martinez', phone: '847-769-2184' }],
    months: [...r(5740, 2), ...r(6015, 6), ...rest], statedAnnualTotal: 47570,
    leaseStart: '2025-03-01', leaseEnd: '2027-02-28', statedEscalationPct: 5, leaseType: 'MG',
    squareFeet: 2200, securityDeposit: 10000, renewalOptions: '3YR + 3YR' },
  { id: 'p2-lucky29-cafe', propertyId: 'plaza-2', unit: '1683–1685', tenant: 'Lucky 29 Gaming Café',
    contacts: [{ name: 'Simplisio Roman', phone: '773-851-7338' }, { name: 'Maria Roman', phone: '773-851-7340' }],
    months: [...r(8045, 8), ...rest], statedAnnualTotal: 64360,
    leaseStart: '2022-11-01', leaseEnd: '2028-10-31', statedEscalationPct: 5, leaseType: 'MG',
    squareFeet: 2200, securityDeposit: 9000, renewalOptions: '3YR + 3YR + 3YR',
    notes: 'Units 1683 and 1685 are now one tenancy. In 2025 they were let separately and their December rates came to exactly this $8,045.' },
  { id: 'p2-northwest-ins', propertyId: 'plaza-2', unit: '1681', tenant: 'Northwest Insurance',
    contacts: [{ name: 'Martin Joseph', phone: '312-427-1777' }, { name: 'David', phone: '312-239-2717' }],
    months: [...r(3155, 5), ...r(3375, 3), ...rest], statedAnnualTotal: 25900,
    leaseStart: '2010-07-31', leaseEnd: '2026-05-31', statedEscalationPct: 5, leaseType: 'MG',
    squareFeet: 1100, securityDeposit: 2900, renewalOptions: 'Month to month',
    notes: 'Lease ran out in May 2026 and continues month to month.' },
  { id: 'p2-sl-envios', propertyId: 'plaza-2', unit: '1681A', tenant: 'SL Envios Inc',
    contacts: [{ name: 'Cindy Esmoris', phone: '773-642-3199' }, { name: 'Luis Almanza', phone: '773-575-4174' }],
    months: [...r(3495, 4), ...r(3670, 4), ...rest], statedAnnualTotal: 28660,
    leaseStart: '2022-06-01', leaseEnd: '2028-03-31', statedEscalationPct: 5, leaseType: 'MG',
    squareFeet: 1100, securityDeposit: 4000, renewalOptions: '5YR + 5YR' },

  // ─── Mannheim Plaza — triple net ──────────────────────────────────────────
  { id: 'mp-pizza-hub', propertyId: 'mannheim-plaza', unit: '1505 A&B', tenant: 'Pizza Hub',
    contacts: [{ phone: '708-731-3170' }, { name: 'Ken Urbieta', phone: '312-399-4457' }],
    months: [8579, ...r(8806, 4), ...r(8440, 3), ...rest], statedAnnualTotal: 69123,
    leaseStart: '2018-02-01', leaseEnd: '2031-01-31', statedEscalationPct: 2, leaseType: 'NNN',
    squareFeet: 1980, securityDeposit: 10000, renewalOptions: '5YR + 5YR + 5YR' },
  { id: 'mp-evas-cafe', propertyId: 'mannheim-plaza', unit: '1505 C', tenant: "Eva's Café",
    contacts: [{ name: 'Mihir Patel', phone: '773-716-9757' }, { name: 'Naresh Patel', phone: '847-638-1143' }],
    months: [...r(8420, 5), ...r(7983, 3), ...rest], statedAnnualTotal: 66049,
    leaseStart: '2022-01-01', leaseEnd: '2026-12-31', statedEscalationPct: 2, leaseType: 'NNN',
    squareFeet: 1900, securityDeposit: 20000, renewalOptions: '5YR + 5YR' },
  { id: 'mp-tobacco-liquor', propertyId: 'mannheim-plaza', unit: '1501 E&F', tenant: 'Tobacco / Liquor Store',
    contacts: [{ name: 'Diluji "Danny" Gohil', phone: '708-833-2228' }, { name: 'Kautshik H Patel', phone: '224-565-0711' }],
    months: [...r(6849, 5), ...r(6500, 3), ...rest], statedAnnualTotal: 53745,
    leaseStart: '2024-07-01', leaseEnd: '2029-06-30', statedEscalationPct: 2, leaseType: 'NNN',
    squareFeet: 1750, securityDeposit: 10000, renewalOptions: '5YR + 5YR + 5YR' },
  { id: 'mp-gottis', propertyId: 'mannheim-plaza', unit: '1501 G&H', tenant: "Gotti's Hideaway",
    contacts: [{ name: 'Gio Gotti', phone: '219-406-6871' }, { name: 'Jackie Noack', phone: '630-888-1130' }],
    months: [...r(8149, 5), ...r(7700, 3), ...rest], statedAnnualTotal: 63845,
    leaseStart: '2020-11-01', leaseEnd: '2030-10-31', statedEscalationPct: 2, leaseType: 'NNN',
    squareFeet: 1750, securityDeposit: 7000, renewalOptions: '5YR + 5YR' },
]

LEASES_2026.push(
  // ─── 1500 / 1506–1510 / 1511 N Mannheim ──────────────────────────────────
  { id: 'm1500-cilantro', propertyId: 'mannheim-1500', unit: '1500', tenant: 'Cilantro',
    contacts: [{ name: 'Temo', phone: '708-205-7072' }],
    months: [...r(8704, 5), ...r(8971, 3), ...rest], statedAnnualTotal: 70433,
    leaseStart: '2013-06-01', leaseEnd: '2028-05-30', statedEscalationPct: 5, leaseType: 'MG',
    squareFeet: 600, securityDeposit: 7000, renewalOptions: 'None',
    notes: 'At 600 sq ft this is far and away the highest rent per square foot in the portfolio — worth confirming the square footage is right.' },
  { id: 'm1506-rts', propertyId: 'mannheim-1506', unit: '1510', tenant: 'RTS',
    contacts: [{ name: 'Fernando', phone: '708-878-9208' }],
    months: [...r(4961, 8), ...rest], statedAnnualTotal: 39688,
    leaseStart: '2005-11-01', statedEscalationPct: 5, leaseType: 'MG',
    squareFeet: 2200, securityDeposit: 4000, renewalOptions: 'Month to month' },
  { id: 'm1506-studio29', propertyId: 'mannheim-1506', unit: '1506–08', tenant: 'Studio 29 Suites',
    contacts: [{ name: 'Maria Roman', phone: '773-851-7340' }],
    months: [...r(6269, 8), ...rest], statedAnnualTotal: 50152,
    leaseStart: '2024-01-15', leaseEnd: '2029-01-31', statedEscalationPct: 5, leaseType: 'MG',
    squareFeet: 2800, securityDeposit: 6000, renewalOptions: '5YR' },
  { id: 'm1511-enviyon', propertyId: 'mannheim-1511', unit: '1511', tenant: 'Enviyon Entertainment',
    contacts: [{ name: 'Romel Williams', phone: '708-954-7023' }, { name: 'Pedro Ramirez', phone: '708-949-1757' }],
    months: [...r(7730, 2), ...r(8025, 6), ...rest], statedAnnualTotal: 63610,
    leaseStart: '2025-03-07', leaseEnd: '2030-02-28', statedEscalationPct: 5, leaseType: 'MG',
    squareFeet: 5500, securityDeposit: 20000, renewalOptions: '5YR + 5YR' },
  { id: 'm1511-apt', propertyId: 'mannheim-1511', unit: '1511 Apt', tenant: '1511 N Mannheim Apartment',
    contacts: [{ name: 'Ilarion', phone: '708-407-3566' }, { name: 'Rogelio', phone: '708-539-1074' }, { name: 'Rodolfo', phone: '708-709-1277' }],
    months: [...r(2700, 8), ...rest], statedAnnualTotal: 21600,
    leaseStart: '2025-10-01', leaseEnd: '2026-09-30', leaseType: 'MG',
    squareFeet: 1630, securityDeposit: 5000 },

  // ─── Playpen 1536 / 1538 ─────────────────────────────────────────────────
  { id: 'pp1536-patrones', propertyId: 'playpen-1536', unit: '1536', tenant: 'Patrones Inc',
    contacts: [{ name: 'Vicente', phone: '708-833-1791' }, { name: 'Vicente Jr', phone: '708-543-3032' }, { name: 'Ivan', phone: '708-368-1120' }],
    months: [...r(8730, 7), 9166, ...rest], statedAnnualTotal: 70276,
    leaseStart: '2025-08-01', leaseEnd: '2028-07-31', statedEscalationPct: 5, leaseType: 'MG',
    squareFeet: 3000, securityDeposit: 20000, renewalOptions: '3YR + 3YR + 3YR' },
  { id: 'pp1538-warehouse', propertyId: 'playpen-1538', unit: '1538', tenant: 'Warehouse',
    contacts: [{ name: 'Vicente', phone: '708-833-1791' }, { name: 'Vicente Jr', phone: '708-543-3032' }, { name: 'Ivan', phone: '708-368-1120' }],
    months: [...r(3926, 7), 4122, ...rest], statedAnnualTotal: 31604,
    leaseStart: '2025-08-01', leaseEnd: '2028-07-31', statedEscalationPct: 5, leaseType: 'MG',
    squareFeet: 3000, securityDeposit: 5000, renewalOptions: '3YR + 3YR + 3YR' },
  { id: 'pp1538-lamar', propertyId: 'playpen-1538', unit: '1538 Billboard', tenant: 'Lamar Billboard Company',
    contacts: [{ name: 'Sean', phone: '219-980-1147' }, { name: 'C', phone: '219-746-7269' }],
    months: [...r(377, 4), ...r(1083, 4), ...rest], statedAnnualTotal: 5840,
    leaseStart: '2017-05-01', leaseEnd: '2036-05-01', leaseType: 'MG', incomeType: 'billboard',
    renewalOptions: 'N/A',
    notes: 'The ground rent nearly tripled in May, from $377 to $1,083 a month, on a lease that now runs to 2036.' },

  // ─── Nu River Landing / 1643 N 43rd ──────────────────────────────────────
  { id: 'florida-tenant', propertyId: 'florida', unit: 'Unit 1918', tenant: 'Andrew Beck',
    contacts: [{ name: 'Andrew Beck', phone: '267-255-0425' }],
    months: [...r(2300, 8), ...rest], statedAnnualTotal: 18400,
    leaseStart: '2025-02-01', leaseEnd: '2026-11-30', leaseType: 'MG',
    squareFeet: 600, securityDeposit: 2300, renewalOptions: 'None' },
  { id: 'n43-pedroza', propertyId: 'n-43rd-1643', unit: '1643 N 43rd', tenant: 'Jean Pedroza',
    contacts: [{ name: 'Jean Pedroza', phone: '847-636-7868' }],
    months: [...r(2200, 4), ...r('V', 4), ...rest], statedAnnualTotal: 8800,
    leaseStart: '2024-04-01', leaseEnd: '2025-03-31', leaseType: 'MG',
    squareFeet: 1500,
    notes: 'Vacant since May 2026 — the lease ran out in March 2025 and the tenant has now gone.' },
  { id: 'n43-garage', propertyId: 'n-43rd-1643', unit: '1643 N 43rd Garage', tenant: 'Garage rental — Gustavo',
    contacts: [{ name: 'Gustavo', phone: '773-936-2204' }],
    months: [...r(900, 8), ...rest], statedAnnualTotal: 7200,
    leaseStart: '2024-04-01', leaseType: 'MG', incomeType: 'parking',
    securityDeposit: 0, renewalOptions: 'Month to month',
    notes: 'Eleven parking spaces rather than a floor area, so it carries no rent per square foot.' },

  // ─── 1638–46 N Mannheim ──────────────────────────────────────────────────
  { id: 'm1638-pedroza-shop', propertyId: 'mannheim-1638', unit: '1638A', tenant: 'Jean Pedroza — Shop',
    contacts: [{ name: 'Jean Pedroza', phone: '708-681-0844' }, { name: 'Jean Pedroza', phone: '847-636-7868', label: 'cell' }],
    months: [...r(5552, 7), 5734, ...rest], statedAnnualTotal: 44598,
    leaseStart: '2021-08-01', leaseEnd: '2027-07-31', statedEscalationPct: 5, leaseType: 'MG',
    squareFeet: 4300, securityDeposit: 4500, renewalOptions: '3YR' },
  { id: 'm1638-divine-studio', propertyId: 'mannheim-1638', unit: '1638B', tenant: 'Divine Design Studio',
    contacts: [{ name: 'Alvanetta Davis', phone: '708-384-9388' }],
    months: [...r(2000, 6), ...r(2090, 2), ...rest], statedAnnualTotal: 16180,
    leaseStart: '2025-06-16', leaseEnd: '2030-06-30', statedEscalationPct: 5, leaseType: 'MG',
    squareFeet: 700, securityDeposit: 5000, renewalOptions: '3YR + 3YR' },
  { id: 'm1638-jc-body-shop', propertyId: 'mannheim-1638', unit: '1642', tenant: 'JC Body Shop',
    contacts: [{ name: 'Gustavo Garza', phone: '773-936-2204' }],
    months: [...r(5700, 6), ...r(5985, 2), ...rest], statedAnnualTotal: 46170,
    leaseStart: '2025-07-01', leaseEnd: '2028-06-30', statedEscalationPct: 5, leaseType: 'MG',
    squareFeet: 5000, securityDeposit: 7000, renewalOptions: '3YR + 3YR' },
  { id: 'm1638-integra', propertyId: 'mannheim-1638', unit: '1646 A&B', tenant: 'Integra',
    contacts: [{ name: 'Gustavo Garza', phone: '773-936-2204' }],
    months: [...r(5700, 6), ...r(5985, 2), ...rest], statedAnnualTotal: 46170,
    leaseStart: '2025-07-01', leaseEnd: '2028-06-30', statedEscalationPct: 5, leaseType: 'MG',
    squareFeet: 5000, securityDeposit: 7000, renewalOptions: '3YR + 3YR' },

  // ─── 1401 N 25th Avenue ──────────────────────────────────────────────────
  { id: 'a25-advanced-auto', propertyId: 'ave-25-1401', unit: 'Advanced Auto', tenant: 'Advanced Auto',
    contacts: [{ name: 'Rodrigo Paniagua', phone: '708-334-2831' }, { name: 'Laura Paniagua', phone: '708-345-6711', label: 'work' }, { phone: '708-790-8173' }],
    months: [...r(4211, 8), ...rest], statedAnnualTotal: 33688,
    leaseStart: '2013-10-01', leaseEnd: '2030-09-30', statedEscalationPct: 5, leaseType: 'MG',
    squareFeet: 3600, securityDeposit: 4000, renewalOptions: 'None' },
  { id: 'a25-jbg-auto', propertyId: 'ave-25-1401', unit: 'JBG Auto Repair', tenant: 'JBG Auto Repair',
    contacts: [{ name: 'Jose Zumaya', phone: '773-712-7401' }],
    months: [...r(4583, 3), ...r(4803, 5), ...rest], statedAnnualTotal: 37764,
    leaseStart: '2016-12-01', leaseEnd: '2028-03-31', statedEscalationPct: 5, leaseType: 'MG',
    squareFeet: 4000, securityDeposit: 3800, renewalOptions: '3YR + 3YR' },
  { id: 'a25-autotech', propertyId: 'ave-25-1401', unit: 'Fast Cars Group', tenant: 'Fast Cars Group',
    contacts: [{ name: 'Yurii Zubryk', phone: '786-901-2602' }, { name: 'Max', phone: '224-382-3815' }],
    months: [...r(3675, 8), ...rest], statedAnnualTotal: 29400,
    leaseStart: '2025-11-01', leaseEnd: '2028-10-31', statedEscalationPct: 5, leaseType: 'MG',
    squareFeet: 2000, securityDeposit: 4000, renewalOptions: '2YR + 2YR + 2YR',
    notes: 'Shown as "Mechanic" on the 2025 sheet and "Autotech Garage" in 2024 — the same unit under three names.' },
  { id: 'a25-body-shop', propertyId: 'ave-25-1401', unit: 'KGZ Collision', tenant: 'KGZ Collision',
    contacts: [{ name: 'Bektur Karimov', phone: '773-815-7770' }, { name: 'Russ Ikramov', phone: '224-661-2714' }],
    months: [...r(6370, 8), ...rest], statedAnnualTotal: 50960,
    leaseStart: '2024-10-01', leaseEnd: '2027-10-31', statedEscalationPct: 5, leaseType: 'MG',
    squareFeet: 5900, securityDeposit: 6075, renewalOptions: '3YR + 3YR',
    concession: { months: 1, periods: ['2024-10'], note: 'First month free at commencement — October 2024. Collection began 1 November 2024.' },
    notes: 'Listed simply as "Body Shop" in earlier years.' },
  { id: 'a25-genuine-detailing', propertyId: 'ave-25-1401', unit: 'Genuine Automotive Detailing', tenant: 'Genuine Automotive Detailing',
    contacts: [{ name: 'Rudy', phone: '708-296-2707' }],
    months: [...r(3700, 3), ...r(3931, 5), ...rest], statedAnnualTotal: 30755,
    leaseStart: '2006-12-01', leaseEnd: '2028-03-31', statedEscalationPct: 5, leaseType: 'MG',
    squareFeet: 4200, securityDeposit: 3995, renewalOptions: '3YR' },

  // ─── West Plaza — sold 30 April 2026 ─────────────────────────────────────
  { id: 'wp-las-delicias', propertyId: 'west-plaza', unit: '1901', tenant: 'Las Delicias de Michoacan',
    contacts: [{ name: 'Abel Cortes', phone: '708-359-1373' }, { name: 'Guadalupe', phone: '708-574-7360' }],
    months: [...r(6290, 4), ...r('NR', 8)], statedAnnualTotal: 25160,
    leaseStart: '2018-09-01', leaseEnd: '2029-08-31', statedEscalationPct: 5, leaseType: 'MG' },
  { id: 'wp-wrist-work-cuts', propertyId: 'west-plaza', unit: '1905', tenant: 'Wrist Work Cuts',
    contacts: [{ name: 'Teonelle L Binon', phone: '708-378-6511' }],
    months: [...r(2533, 4), ...r('NR', 8)], statedAnnualTotal: 10132,
    leaseStart: '2021-05-01', leaseEnd: '2026-04-30', statedEscalationPct: 5, leaseType: 'MG' },
  { id: 'wp-massage-spa', propertyId: 'west-plaza', unit: '1907', tenant: 'Massage Spa',
    contacts: [{ name: 'Enfu Bi', phone: '312-532-1891' }, { name: 'Enfu Bi', phone: '312-898-6160' }],
    months: [...r(2491, 4), ...r('NR', 8)], statedAnnualTotal: 9964,
    leaseStart: '2023-10-07', leaseEnd: '2028-11-30', statedEscalationPct: 5, leaseType: 'MG' },
  { id: 'wp-silk-royal-nails', propertyId: 'west-plaza', unit: '1911', tenant: 'Silk Royal Nails LLC',
    contacts: [{ name: 'Hoa Ksor', phone: '773-750-6789' }],
    months: [...r(2552, 3), 2680, ...r('NR', 8)], statedAnnualTotal: 10336,
    leaseStart: '2023-04-01', leaseEnd: '2028-03-31', statedEscalationPct: 5, leaseType: 'MG' },
  { id: 'wp-panda-dance', propertyId: 'west-plaza', unit: '1913', tenant: 'Panda Dance Studio',
    contacts: [{ name: 'Patricia Reis', phone: '708-689-8352' }, { name: 'Patricia Reis', phone: '708-829-4941' }],
    months: [...r(3545, 4), ...r('NR', 8)], statedAnnualTotal: 14180,
    leaseStart: '2014-07-01', leaseEnd: '2026-04-30', statedEscalationPct: 5, leaseType: 'MG' },
  { id: 'wp-fc-salon', propertyId: 'west-plaza', unit: '1919', tenant: 'FC Salon Suites',
    contacts: [{ name: 'Dontazia Blalock', phone: '708-879-2940' }, { name: 'Eric Jordan', phone: '773-641-7208' }],
    months: [...r(3375, 4), ...r('NR', 8)], statedAnnualTotal: 13500,
    leaseStart: '2025-11-11', leaseEnd: '2028-11-30', statedEscalationPct: 5, leaseType: 'MG' },
  { id: 'wp-powells-kenpo', propertyId: 'west-plaza', unit: '1921', tenant: "Powell's Way of Kenpo",
    contacts: [{ name: 'David Saboe', phone: '815-531-9330' }],
    months: [...r(3538, 4), ...r('NR', 8)], statedAnnualTotal: 14152,
    leaseStart: '2019-11-01', leaseEnd: '2028-10-30', statedEscalationPct: 5, leaseType: 'MG' },
  { id: 'wp-perkins', propertyId: 'west-plaza', unit: '1923', tenant: 'Perkins & Sons Funeral Home',
    contacts: [{ name: 'Dante Perkins', phone: '773-587-8840' }, { name: 'Calvin Blissit', phone: '224-217-8597' }, { name: 'Ivan Perkins', phone: '773-719-3362' }],
    months: [...r(4773, 4), ...r('NR', 8)], statedAnnualTotal: 19092,
    leaseStart: '2023-08-01', leaseEnd: '2027-07-31', statedEscalationPct: 5, leaseType: 'MG' },
  { id: 'wp-kapil', propertyId: 'west-plaza', unit: '1925', tenant: 'Kapil Inc — Convenience / Liquor Store',
    contacts: [{ name: 'Dipesh Soni', phone: '847-791-3839' }],
    months: [...r(6804, 4), ...r('NR', 8)], statedAnnualTotal: 27216,
    leaseStart: '2023-05-01', leaseEnd: '2026-04-30', statedEscalationPct: 5, leaseType: 'MG' },
  { id: 'wp-castaldo-note', propertyId: 'west-plaza', unit: 'Owner financing', tenant: 'Anthony Castaldo — West Plaza note',
    contacts: [{ name: 'Anthony Castaldo', phone: '630-253-6257' }],
    months: [...r('NR', 5), ...r(6140.87, 3), ...r('NR', 4)], statedAnnualTotal: 18422.61,
    leaseStart: '2026-06-01', leaseEnd: '2029-05-31', leaseType: 'MG', incomeType: 'note',
    notes: 'Seller financing on the West Plaza sale. $6,140.87 a month from June 2026 to May 2029 — a note receivable, not rent, so it is excluded from occupancy and from rent per square foot.' },
)

/**
 * Property tax on the 2026 sheet. Note that it still carries the **2024** bills
 * for the Illinois properties — the sheet has not been updated with the 2025
 * bills, so these are the same figures 2025 income was charged against and are
 * almost certainly understated for 2026.
 */
export const TAX_2026: Record<string, { bill: number; billYear: number }> = {
  'plaza-1': { bill: 168992.55, billYear: 2024 },
  'plaza-2': { bill: 92707.03, billYear: 2024 },
  'mannheim-plaza': { bill: 83142.43, billYear: 2024 },
  'mannheim-1500': { bill: 20776.45, billYear: 2024 },
  'mannheim-1506': { bill: 42263.7, billYear: 2024 },
  'mannheim-1511': { bill: 25050.37, billYear: 2024 },
  'playpen-1536': { bill: 26352.42, billYear: 2024 },
  'playpen-1538': { bill: 15862.05, billYear: 2024 },
  'florida': { bill: 5186.0, billYear: 2025 },
  'n-43rd-1643': { bill: 6671.66, billYear: 2024 },
  'mannheim-1638': { bill: 69974.53, billYear: 2024 },
  'ave-25-1401': { bill: 89380.35, billYear: 2024 },
  // West Plaza sold 30 April 2026; the 2026 sheet prints no tax for it.
  'west-plaza': { bill: 0, billYear: 2024 },
  'apollo': { bill: 57077.58, billYear: 2024 },
  'prairie-1211': { bill: 15080, billYear: 2024 },
}

/** Months the 2026 sheet covers. */
export const MONTHS_REPORTED_2026 = 8

/**
 * What the park is billing a month, from the registry rather than a rent roll.
 *
 * The 2026 sheet leaves Apollo out altogether. The tenant registry does cover
 * it and is itself a 2026 document — dated July — so it is the better source for
 * the year, and the only one there is. Thirty-seven lots and five parking spaces
 * come to $33,100 a month, water charge included.
 */
export const APOLLO_MONTHLY_2026 = APOLLO_TENANTS.reduce((a, t) => a + t.amountDue, 0)

/**
 * Apollo's 2026 income to date — the registry's monthly figure across the eight
 * months the rent roll covers, so the park and the commercial suites span the
 * same period and can be added together.
 *
 * This is derived, not transcribed. The registry states what is due each month
 * as of July; applying it to January assumes the rents did not move earlier in
 * the year, which is an assumption rather than a fact — 2025's $378,870 against
 * this $397,200 annualised says they do move. It is marked as derived wherever
 * it is shown, and the moment a real 2026 figure arrives it should replace this.
 */
export const APOLLO_GROSS_2026 = APOLLO_MONTHLY_2026 * MONTHS_REPORTED_2026

/**
 * The 2026 sheet prints no row or page totals, so there is nothing to reconcile
 * the transcription against — unlike 2024 and 2025, which both tie exactly.
 * These are computed from the month cells rather than read off the page.
 */
export const STATED_TOTALS_2026 = {
  commercialGross: 0,
  commercialTaxes: 0,
  apolloGross: 0,
  apolloTaxes: 0,
  totalGross: 0,
  totalNet: 0,
}

export const KNOWN_VARIANCES_2026: { leaseId: string; computed: number; stated: number; note: string }[] = []
