import type { Lease, MonthCell } from '../../lib/types'

const r = (value: MonthCell, n: number): MonthCell[] => Array.from({ length: n }, () => value)

/**
 * The 2024 rent roll, transcribed from the eight-page workbook.
 *
 * Read alongside 2025 this is where the portfolio's real movement shows: tenants
 * that turned over, spaces that sat empty, and rents that stepped up. Several
 * units carry a different tenant here than they do a year later.
 *
 * Property taxes on this sheet are the 2023 bills, applied to 2024 income —
 * Illinois bills a year in arrears. The Fort Lauderdale property is the one
 * exception and carries its own year's bill, exactly as it does in 2025.
 */
export const LEASES_2024: Lease[] = [
  // ─── Plaza #1 — 1559 N Mannheim ────────────────────────────────────────────
  { id: 'p1-michoacana', propertyId: 'plaza-1', unit: '1A&B', tenant: 'Michoacana',
    contacts: [{ name: 'Yvonne Cisneros', phone: '630-492-5404' }, { name: 'Joaquin Gaspar', phone: '224-245-7009' }, { name: 'Estela', phone: '708-262-3371' }],
    months: [...r(5420, 6), ...r(5679, 6)], statedAnnualTotal: 66594, leaseStart: '2013-07-01', leaseEnd: '2025-06-30', statedEscalationPct: 5, leaseType: 'MG' },
  { id: 'p1-metropcs', propertyId: 'plaza-1', unit: '1C', tenant: 'Metro PCS',
    contacts: [{ name: 'Harry', phone: '630-965-4139' }],
    months: [...r(2140, 9), ...r(2190, 3)], statedAnnualTotal: 25830, leaseStart: '2017-10-01', leaseEnd: '2023-09-30', leaseType: 'MG',
    notes: 'Already holding over — the lease ran out in September 2023.' },
  { id: 'p1-premier', propertyId: 'plaza-1', unit: '1D&1E', tenant: 'Premier Stone Park',
    contacts: [{ name: 'Syam Kumar', phone: '312-358-1381' }, { name: 'Aathira Gopinath', phone: '312-626-4828' }],
    months: [...r(5469, 8), ...r(5740, 4)], statedAnnualTotal: 66712, leaseStart: '2014-09-01', leaseEnd: '2027-08-31', statedEscalationPct: 5, leaseType: 'MG' },
  { id: 'p1-purpura', propertyId: 'plaza-1', unit: '1F', tenant: 'Purpura Beauty Spa',
    contacts: [{ name: 'Diana Bernal', phone: '630-850-0291' }],
    months: [...r(3315, 5), ...r(3467, 7)], statedAnnualTotal: 40844, leaseStart: '2022-06-01', leaseEnd: '2024-05-31', statedEscalationPct: 5, leaseType: 'MG' },
  { id: 'p1-superbubble', propertyId: 'plaza-1', unit: '1G', tenant: 'Superbubble',
    contacts: [{ name: 'Oscar Martinez', phone: '847-769-2183' }],
    months: [...r(5431.75, 3), ...r(5691, 9)], statedAnnualTotal: 67514.25, leaseStart: '2021-04-01', leaseEnd: '2024-03-31', statedEscalationPct: 5, leaseType: 'MG' },
  { id: 'p1-carone', propertyId: 'plaza-1', unit: '2A', tenant: 'Franco Carone',
    contacts: [{ phone: '630-212-1885' }],
    months: r(1946, 12), statedAnnualTotal: 23352, leaseStart: '2015-01-01', leaseEnd: '2024-12-30', statedEscalationPct: 5, leaseType: 'MG' },
  { id: 'p1-unstoppable', propertyId: 'plaza-1', unit: '2B', tenant: 'Vacant',
    contacts: [], months: r('V', 12), statedAnnualTotal: 0, leaseType: 'MG',
    notes: 'Marked simply VACANT on the 2024 sheet. Unstoppable Beauty Lounge appears against this unit in 2025, still with no rent.' },
  { id: 'p1-bonita', propertyId: 'plaza-1', unit: '2C', tenant: 'Bonita Beauty Bar',
    contacts: [{ name: 'Jose "Rudy" Salmeron', phone: '708-407-6233' }, { name: 'Lilia Rodriguez', phone: '708-838-5846' }],
    months: ['V', 'FREE', ...r(1635, 10)], statedAnnualTotal: 16350, leaseStart: '2024-02-01', leaseEnd: '2027-01-31', statedEscalationPct: 5, leaseType: 'MG',
    notes: 'Moved in during 2024: January vacant, February free, paying from March.' },
  { id: 'p1-casa-migrante', propertyId: 'plaza-1', unit: '2D', tenant: 'Casa Migrante Binacional LLC',
    contacts: [{ name: 'Maricela Medina', phone: '708-435-3449' }],
    months: r(1575, 12), statedAnnualTotal: 18900, leaseStart: '2024-01-01', leaseEnd: '2026-12-31', statedEscalationPct: 5, leaseType: 'MG' },
  { id: 'p1-farmers', propertyId: 'plaza-1', unit: '2E', tenant: 'Farmers Insurance',
    contacts: [{ name: 'Nori', phone: '773-412-8987' }, { phone: '708-865-0330' }],
    months: r(1350, 12), statedAnnualTotal: 16200, leaseStart: '2005-02-01', leaseEnd: '2026-01-31', leaseType: 'MG' },
  { id: 'p1-apartment', propertyId: 'plaza-1', unit: '2F', tenant: 'Apartment',
    contacts: [{ name: 'Diana Bernal', phone: '630-850-0291' }],
    months: [...r('V', 8), ...r(1100, 4)], statedAnnualTotal: 4400, leaseStart: '2024-09-01', leaseEnd: '2025-08-31', leaseType: 'MG',
    notes: 'Empty for two thirds of the year; first let in September.' },

  // ─── Plaza #2 — 1681–93 N Mannheim ─────────────────────────────────────────
  { id: 'p2-stone-park-gold', propertyId: 'plaza-2', unit: '1693', tenant: 'Stone Park Gold',
    contacts: [{ name: 'Anthony Cascio', phone: '773-504-2009' }],
    months: [...r(4905, 7), ...r(5141, 5)], statedAnnualTotal: 60040, leaseStart: '2017-07-31', leaseEnd: '2025-07-31', statedEscalationPct: 5, leaseType: 'MG' },
  { id: 'p2-la-michoacana', propertyId: 'plaza-2', unit: '1691', tenant: 'Las Delicias de las Jalisquillas',
    contacts: [{ name: 'Abel', phone: '708-359-1373' }, { name: 'Lupe', phone: '708-574-7360' }, { name: 'Edgar', phone: '708-574-2824' }],
    months: [...r(3377.25, 4), ...r(3537.11, 8)], statedAnnualTotal: 41805.88, leaseStart: '2021-05-01', leaseEnd: '2024-04-30', statedEscalationPct: 5, leaseType: 'MG',
    notes: 'La Michoacana Stone Park takes this unit in February 2025.' },
  { id: 'p2-washland', propertyId: 'plaza-2', unit: '1687–1689', tenant: 'Washland',
    contacts: [{ name: 'Cosme Ruano', phone: '681-1184' }],
    months: [...r(4368.87, 3), ...r(6205, 9)], statedAnnualTotal: 68951.61, leaseStart: '2014-04-01', leaseEnd: '2024-03-30', statedEscalationPct: 2.5, leaseType: 'MG' },
  { id: 'p2-lucky29-cafe', propertyId: 'plaza-2', unit: '1685', tenant: 'Lucky 29 Gaming Café',
    contacts: [{ name: 'Simplisio Roman', phone: '773-851-7338' }, { name: 'Maria Roman', phone: '773-851-7340' }],
    months: [...r(3925, 10), ...r(4108, 2)], statedAnnualTotal: 47466, leaseStart: '2022-11-01', leaseEnd: '2025-10-31', statedEscalationPct: 5, leaseType: 'MG' },
  { id: 'p2-lucky29', propertyId: 'plaza-2', unit: '1683', tenant: 'Side Track Tattoo',
    contacts: [{ name: 'Anthony Solis', phone: '708-785-8323' }, { name: 'Darryl Melzer', phone: '847-533-8287' }],
    months: [...r(2863.5, 6), ...r(3006.67, 6)], statedAnnualTotal: 35221.02, leaseStart: '2019-07-01', leaseEnd: '2025-06-30', statedEscalationPct: 5, leaseType: 'MG',
    notes: 'Lucky 29 takes this unit from July 2025.' },
  { id: 'p2-northwest-ins', propertyId: 'plaza-2', unit: '1681', tenant: 'Northwest Insurance',
    contacts: [{ name: 'Martin Joseph', phone: '312-427-1777' }, { name: 'David', phone: '312-239-2717' }],
    months: [...r(2982.5, 5), ...r(3067.47, 7)], statedAnnualTotal: 36384.79, leaseStart: '2010-07-31', leaseEnd: '2024-05-31', statedEscalationPct: 5, leaseType: 'MG' },
  { id: 'p2-sl-envios', propertyId: 'plaza-2', unit: '1681A', tenant: 'SL Envios Inc',
    contacts: [{ name: 'Cindy Esmoris', phone: '773-642-3199' }, { name: 'Luis Almanza', phone: '773-575-4174' }],
    months: [...r(3180, 5), ...r(3330, 7)], statedAnnualTotal: 39210, leaseStart: '2022-06-01', leaseEnd: '2028-03-31', statedEscalationPct: 5, leaseType: 'MG' },

  // ─── Mannheim Plaza — 1501–1505 N Mannheim (triple net) ────────────────────
  { id: 'mp-pizza-hub', propertyId: 'mannheim-plaza', unit: '1505 A&B', tenant: 'Pizza Hub',
    contacts: [{ phone: '708-731-3170' }, { name: 'Ken Urbieta', phone: '312-399-4457' }],
    months: [8149.77, ...r(8360.32, 11)], statedAnnualTotal: 100113.29, leaseStart: '2018-02-01', leaseEnd: '2026-01-31', statedEscalationPct: 4, leaseType: 'NNN' },
  { id: 'mp-evas-cafe', propertyId: 'mannheim-plaza', unit: '1505 C', tenant: "Eva's Café",
    contacts: [{ name: 'Mihir Patel', phone: '773-716-9757' }, { name: 'Naresh Patel', phone: '847-638-1143' }],
    months: r(8023.96, 12), statedAnnualTotal: 96287.52, leaseStart: '2022-01-01', leaseEnd: '2026-12-31', statedEscalationPct: 4, leaseType: 'NNN' },
  { id: 'mp-tobacco-liquor', propertyId: 'mannheim-plaza', unit: '1501 E&F', tenant: 'Tobacco / Liquor Store',
    contacts: [{ name: 'Diluji "Danny" Gohil', phone: '708-833-2228' }, { name: 'Kautshik H Patel', phone: '224-565-0711' }],
    months: [...r(3619, 5), 'V', 'FREE', 'FREE', ...r(6633, 4)], statedAnnualTotal: 44627, leaseStart: '2024-07-01', leaseEnd: '2029-06-30', statedEscalationPct: 4, leaseType: 'NNN',
    notes: 'The prior tenant paid $3,619 through May. June vacant, July and August free while the new tenant fitted out, then $6,633 from September. This is why 2025 looks so much stronger.' },
  { id: 'mp-loya', propertyId: 'mannheim-plaza', unit: 'LOYA', tenant: 'Loya',
    contacts: [], months: [...r(3886.64, 4), 'V', 'V', ...r('V', 6)], statedAnnualTotal: 15546.56, leaseType: 'NNN',
    notes: 'Paid through April, vacant from May, and absent from the 2025 rent roll entirely. Worth confirming whether this space is still empty.' },
  { id: 'mp-gottis', propertyId: 'mannheim-plaza', unit: '1501 G&H', tenant: "Gotti's Hideaway",
    contacts: [{ name: 'Gio Gotti', phone: '219-406-6871' }, { name: 'Jackie Noack', phone: '630-888-1130' }],
    months: [...r(7737, 10), ...r(7939, 2)], statedAnnualTotal: 93248, leaseStart: '2020-11-01', leaseEnd: '2025-10-31', statedEscalationPct: 4, leaseType: 'NNN' },
]

// ─── West Plaza — 1901–1925 N Mannheim ─────────────────────────────────────
LEASES_2024.push(
  { id: 'wp-las-delicias', propertyId: 'west-plaza', unit: '1901', tenant: 'Las Delicias de Michoacan',
    contacts: [{ name: 'Abel Cortes', phone: '708-359-1373' }, { name: 'Guadalupe', phone: '708-574-7360' }],
    months: r(6000, 12), statedAnnualTotal: 72000, leaseStart: '2018-09-01', leaseEnd: '2024-08-31', statedEscalationPct: 5, leaseType: 'MG' },
  { id: 'wp-wrist-work-cuts', propertyId: 'west-plaza', unit: '1905', tenant: 'Wrist Work Cuts',
    contacts: [{ name: 'Teonelle L Binon', phone: '708-378-6511' }],
    months: [...r(2300, 4), ...r(2412, 8)], statedAnnualTotal: 28496, leaseStart: '2021-05-01', leaseEnd: '2026-04-30', statedEscalationPct: 5, leaseType: 'MG' },
  { id: 'wp-massage-spa', propertyId: 'west-plaza', unit: '1907', tenant: 'Massage Spa',
    contacts: [{ name: 'Enfu Bi', phone: '312-532-1891' }, { name: 'Enfu Bi', phone: '312-898-6160' }],
    months: [...r(2263, 9), ...r(2376, 3)], statedAnnualTotal: 27495, leaseStart: '2023-10-07', leaseEnd: '2028-11-30', statedEscalationPct: 5, leaseType: 'MG' },
  { id: 'wp-silk-royal-nails', propertyId: 'west-plaza', unit: '1911', tenant: 'Silk Royal Nails LLC',
    contacts: [{ name: 'Hoa Ksor', phone: '773-750-6789' }],
    months: [...r(2320, 3), ...r(2430, 9)], statedAnnualTotal: 28830, leaseStart: '2023-04-01', leaseEnd: '2028-03-31', statedEscalationPct: 5, leaseType: 'MG' },
  { id: 'wp-panda-dance', propertyId: 'west-plaza', unit: '1913', tenant: 'Panda Dance Studio',
    contacts: [{ name: 'Patricia Reis', phone: '708-689-8352' }, { name: 'Patricia Reis', phone: '708-829-4941' }],
    months: [...r(3226, 4), ...r(3378, 8)], statedAnnualTotal: 39928, leaseStart: '2014-07-01', leaseEnd: '2024-04-30', statedEscalationPct: 5, leaseType: 'MG' },
  { id: 'wp-sha-poppin', propertyId: 'west-plaza', unit: '1917', tenant: "Sha-Poppin' Gourmet Popcorn",
    contacts: [{ name: 'Stacy Armstrong', phone: '877-742-7671' }],
    months: r(4345, 12), statedAnnualTotal: 52140, leaseStart: '2023-10-17', leaseEnd: '2025-05-31', statedEscalationPct: 5, leaseType: 'MG' },
  { id: 'wp-fc-salon', propertyId: 'west-plaza', unit: '1919', tenant: 'FC Salon Studios',
    contacts: [{ name: 'Deja Ewings', phone: '630-452-4409' }, { name: 'Talonda Howard', phone: '630-460-4501' }],
    months: [...r(3303.75, 6), ...r(3460, 6)], statedAnnualTotal: 40582.5, leaseStart: '2022-07-01', leaseEnd: '2025-06-30', statedEscalationPct: 5, leaseType: 'MG',
    notes: 'Different operators here than in 2025, when the unit re-lets as FC Salon Suites after four vacant months.' },
  { id: 'wp-powells-kenpo', propertyId: 'west-plaza', unit: '1921', tenant: "Powell's Way of Kenpo",
    contacts: [{ name: 'David Saboe', phone: '815-531-9330' }],
    months: [...r(3226, 10), ...r(3378, 2)], statedAnnualTotal: 39016, leaseStart: '2019-11-01', leaseEnd: '2025-10-30', statedEscalationPct: 5, leaseType: 'MG' },
  { id: 'wp-perkins', propertyId: 'west-plaza', unit: '1923', tenant: 'Perkins & Sons Funeral Home',
    contacts: [{ name: 'Dante Perkins', phone: '773-587-8840' }, { name: 'Calvin Blissit', phone: '224-217-8597' }, { name: 'Ivan Perkins', phone: '773-719-3362' }],
    months: [...r(4346, 7), ...r(4554, 5)], statedAnnualTotal: 53192, leaseStart: '2023-08-01', leaseEnd: '2025-07-31', statedEscalationPct: 5, leaseType: 'MG' },
  { id: 'wp-kapil', propertyId: 'west-plaza', unit: '1925', tenant: 'Kapil Inc — Convenience / Liquor Store',
    contacts: [{ name: 'Dipesh Soni', phone: '847-791-3839' }],
    months: [...r(6180, 4), ...r(6480, 8)], statedAnnualTotal: 76560, leaseStart: '2023-05-01', leaseEnd: '2026-04-30', statedEscalationPct: 5, leaseType: 'MG' },

  // ─── 1500 / 1506–1510 / 1511 N Mannheim ──────────────────────────────────
  { id: 'm1500-cilantro', propertyId: 'mannheim-1500', unit: '1500', tenant: 'Cilantro',
    contacts: [{ name: 'Temo', phone: '708-205-7072' }],
    months: [...r(8112.82, 5), ...r(8401.81, 7)], statedAnnualTotal: 99376.77, leaseStart: '2013-06-01', leaseEnd: '2025-05-30', statedEscalationPct: 5, leaseType: 'MG' },
  { id: 'm1506-rts', propertyId: 'mannheim-1506', unit: '1510', tenant: 'RTS',
    contacts: [{ name: 'Fernando', phone: '708-878-9208' }],
    months: [...r(4500, 9), ...r(4725, 3)], statedAnnualTotal: 54675, leaseStart: '2005-11-01', statedEscalationPct: 5, leaseType: 'MG' },
  { id: 'm1506-studio29', propertyId: 'mannheim-1506', unit: '1506–08', tenant: 'Studio 29 Suites',
    contacts: [{ name: 'Maria Roman', phone: '773-851-7340' }],
    months: [...r('FREE', 4), ...r(5982.32, 8)], statedAnnualTotal: 47858.56, leaseStart: '2024-01-15', leaseEnd: '2029-01-31', statedEscalationPct: 5, leaseType: 'MG',
    notes: 'Four months rent free at the start of the lease, then $5,982.32 from May.' },
  { id: 'm1511-enviyon', propertyId: 'mannheim-1511', unit: '1511', tenant: 'Chicago Cycle — 1511 N Mannheim Showroom',
    contacts: [{ name: 'Ed Hanson', phone: '630-441-2355' }],
    months: r(8352.81, 12), statedAnnualTotal: 100233.72, leaseStart: '2015-12-01', leaseEnd: '2025-11-30', statedEscalationPct: 5, leaseType: 'MG',
    notes: 'Enviyon takes this showroom in March 2025 after three vacant months and two free.' },
  { id: 'm1511-apt', propertyId: 'mannheim-1511', unit: '1511 Apt', tenant: '1511 N Mannheim Apartment',
    contacts: [{ name: 'Chris', phone: '630-835-7119' }],
    months: r(1500, 12), statedAnnualTotal: 18000, leaseType: 'MG' },

  // ─── Playpen 1536 / 1538 ─────────────────────────────────────────────────
  { id: 'pp1536-patrones', propertyId: 'playpen-1536', unit: '1536', tenant: 'Sr. Jesus Sepulveda',
    contacts: [{ name: 'Jesus Sepulveda', phone: '773-569-8165' }, { name: 'Jesse', phone: '630-398-9026' }],
    months: [...r(8137.42, 10), ...r(8426, 2)], statedAnnualTotal: 98226.22, leaseStart: '2020-11-01', leaseEnd: '2025-10-31', statedEscalationPct: 5, leaseType: 'MG',
    notes: 'Patrones takes this unit from August 2025. The printed row total is two cents above the sum of its cells — rounding on the sheet.' },
  { id: 'pp1538-warehouse', propertyId: 'playpen-1538', unit: '1538', tenant: 'Jesus Sepulveda',
    contacts: [{ name: 'Jesus Sepulveda', phone: '630-398-9026' }, { name: 'Jesse', phone: '630-398-9026' }],
    months: [...r(3713, 10), ...r(3817, 2)], statedAnnualTotal: 44764, leaseStart: '2020-11-01', leaseEnd: '2025-10-31', statedEscalationPct: 5, leaseType: 'MG' },
  { id: 'pp1538-lamar', propertyId: 'playpen-1538', unit: '1538 Billboard', tenant: 'Lamar Billboard Company',
    contacts: [{ name: 'Sean', phone: '219-980-1147' }, { name: 'C', phone: '219-746-7269' }],
    months: r(377, 12), statedAnnualTotal: 4524, leaseType: 'MG' },

  // ─── Nu River Landing / 1643 N 43rd ──────────────────────────────────────
  { id: 'florida-tenant', propertyId: 'florida', unit: 'Unit 1918', tenant: 'Charles R Clark',
    contacts: [{ name: 'Charles R Clark', phone: '602-980-5211' }],
    months: [...r(2545, 9), ...r('V', 3)], statedAnnualTotal: 22905, leaseType: 'MG',
    notes: 'Paid through September, then vacant for the rest of 2024. A tenant at $2,300 appears from February 2025.' },
  { id: 'n43-pedroza', propertyId: 'n-43rd-1643', unit: '1643 N 43rd', tenant: 'Jean Pedroza',
    contacts: [{ name: 'Jean Pedroza', phone: '847-636-7868' }],
    months: [...r('V', 3), ...r(2000, 9)], statedAnnualTotal: 18000, leaseStart: '2024-04-01', leaseEnd: '2025-03-31', leaseType: 'MG' },
  { id: 'n43-garage', propertyId: 'n-43rd-1643', unit: '1643 N 43rd Garage', tenant: 'Garage rental — Cesar',
    contacts: [{ name: 'Cesar', phone: '708-248-4737' }],
    months: [...r('V', 3), 300, ...r(900, 8)], statedAnnualTotal: 7500, leaseStart: '2024-04-01', leaseType: 'MG',
    notes: 'April billed at $300, then $900 a month.' },

  // ─── 1638–46 N Mannheim ──────────────────────────────────────────────────
  { id: 'm1638-pedroza-shop', propertyId: 'mannheim-1638', unit: '1638A', tenant: 'Jean Pedroza — Shop',
    contacts: [{ name: 'Jean Pedroza', phone: '708-681-0844' }, { name: 'Jean Pedroza', phone: '847-636-7868', label: 'cell' }],
    months: [...r(5212.82, 7), ...r(5378, 5)], statedAnnualTotal: 63379.74, leaseStart: '2021-08-01', leaseEnd: '2024-07-31', statedEscalationPct: 5, leaseType: 'MG' },
  { id: 'm1638-divine-studio', propertyId: 'mannheim-1638', unit: '1638B', tenant: 'The Gurus Choice',
    contacts: [{ name: 'Yazmine Brown', phone: '708-315-4424' }],
    months: [...r(1803, 9), ...r(1886.43, 3)], statedAnnualTotal: 21886.29, leaseStart: '2021-10-01', leaseEnd: '2024-09-30', statedEscalationPct: 5, leaseType: 'MG',
    notes: 'Divine Studio takes this unit in June 2025.' },
  { id: 'm1638-jc-body-shop', propertyId: 'mannheim-1638', unit: '1642', tenant: 'JC Body Shop',
    contacts: [{ name: 'Vicente', phone: '708-979-3592' }, { name: 'Cesar', phone: '708-248-4737' }],
    months: [...r(5362.82, 7), ...r(5527, 5)], statedAnnualTotal: 65174.74, leaseStart: '2021-08-01', leaseEnd: '2024-07-31', statedEscalationPct: 5, leaseType: 'MG' },
  { id: 'm1638-integra', propertyId: 'mannheim-1638', unit: '1646 A&B', tenant: 'Integra',
    contacts: [{ name: 'Cesar Santana', phone: '708-248-4737' }],
    months: [...r(5209.31, 7), ...r(5469, 5)], statedAnnualTotal: 63810.17, leaseStart: '2019-08-01', leaseEnd: '2025-07-31', statedEscalationPct: 5, leaseType: 'MG' },

  // ─── 1401 N 25th Avenue ──────────────────────────────────────────────────
  { id: 'a25-advanced-auto', propertyId: 'ave-25-1401', unit: 'Advanced Auto', tenant: 'Advanced Auto',
    contacts: [{ name: 'Rodrigo Paniagua', phone: '708-334-2831' }, { name: 'Laura', phone: '708-345-6711', label: 'work' }, { phone: '708-790-8173' }],
    months: [...r(3820, 9), ...r(4011, 3)], statedAnnualTotal: 46413, leaseStart: '2013-10-01', leaseEnd: '2025-09-30', statedEscalationPct: 5, leaseType: 'MG' },
  { id: 'a25-jbg-auto', propertyId: 'ave-25-1401', unit: 'JBG Auto Repair', tenant: 'JBG Auto Repair',
    contacts: [{ name: 'Jose Zumaya', phone: '773-712-7401' }],
    months: [...r(4165, 3), ...r(4365, 9)], statedAnnualTotal: 51780, leaseStart: '2016-12-01', leaseEnd: '2025-03-31', statedEscalationPct: 5, leaseType: 'MG' },
  { id: 'a25-autotech', propertyId: 'ave-25-1401', unit: 'Autotech Garage', tenant: 'Autotech Garage',
    contacts: [{ name: 'Vitalii Golyk', phone: '312-866-6726' }],
    months: [...r(6875, 9), 'V', ...r(3675, 2)], statedAnnualTotal: 69225, leaseStart: '2024-11-01', leaseEnd: '2027-10-31', statedEscalationPct: 5, leaseType: 'MG',
    notes: 'Two separate totals on the sheet — $61,875 through September at $6,875, then $7,350 across November and December at $3,675. The unit appears as "Mechanic" in 2025.' },
  // The sheet prints a 2021 commencement for this bay, which cannot be right:
  // it billed nothing from January to September 2024. The lease began 1 October
  // 2024 with the first month free, so October is a concession — the unit was
  // let and the landlord chose to forgo the rent, which is a different thing
  // from nobody being in it. One free month plus 36 paid from October 2024
  // lands exactly on the 31 October 2027 expiry the sheet does print.
  { id: 'a25-body-shop', propertyId: 'ave-25-1401', unit: 'Body Shop', tenant: 'Body Shop',
    contacts: [{ name: 'Bektur Karimov', phone: '773-815-7770' }, { name: 'Russ Ikramov', phone: '224-661-2714' }],
    months: [...r('V', 9), 'FREE', ...r(6075, 2)], statedAnnualTotal: 12150, leaseStart: '2024-10-01', leaseEnd: '2027-10-31', statedEscalationPct: 5, leaseType: 'MG',
    concession: { months: 1, periods: ['2024-10'], note: 'First month free at commencement — October 2024. Collection began 1 November 2024.' },
    notes: 'Took the bay 1 October 2024 with October free, so the first rent came in on 1 November. The sheet prints a 2021 commencement it contradicts.' },
  { id: 'a25-genuine-detailing', propertyId: 'ave-25-1401', unit: 'Genuine Automotive Detailing', tenant: 'Genuine Automotive Detailing',
    contacts: [{ name: 'Rudy', phone: '708-296-2707' }],
    months: [...r(3445, 3), ...r(3655, 8), 3480], statedAnnualTotal: 43230, leaseStart: '2006-12-01', leaseEnd: '2025-03-31', statedEscalationPct: 5, leaseType: 'MG',
    notes: 'The month cells sum to $43,055 but the row total prints $43,230 — a $175 error on the sheet, which carries into the property and portfolio totals.' },
)

/**
 * Property tax charged against 2024 income. These are the 2023 bills — Illinois
 * bills a year in arrears, and the sheets follow that. Nu River Landing is the
 * exception and carries its own year's bill, as it does in 2025.
 */
export const TAX_2024: Record<string, { bill: number; billYear: number }> = {
  'plaza-1': { bill: 164360.68, billYear: 2023 },
  'plaza-2': { bill: 90165.53, billYear: 2023 },
  'mannheim-plaza': { bill: 81796.93, billYear: 2023 },
  'west-plaza': { bill: 66587.0, billYear: 2023 },
  'mannheim-1500': { bill: 21359.56, billYear: 2023 },
  'mannheim-1506': { bill: 42111.44, billYear: 2023 },
  'mannheim-1511': { bill: 24362.63, billYear: 2023 },
  'playpen-1536': { bill: 26257.38, billYear: 2023 },
  'playpen-1538': { bill: 15804.94, billYear: 2023 },
  'florida': { bill: 4706.95, billYear: 2024 },
  'n-43rd-1643': { bill: 6638.12, billYear: 2023 },
  'mannheim-1638': { bill: 69724.86, billYear: 2023 },
  'ave-25-1401': { bill: 87218.52, billYear: 2023 },
  'apollo': { bill: 56870.15, billYear: 2023 },
}

/** Apollo appears on the 2024 sheet as a single annual figure, as it does in 2025. */
export const APOLLO_GROSS_2024 = 358870.0

/** The totals printed on the sheets, for reconciliation. */
export const STATED_TOTALS_2024 = {
  commercialGross: 2436949.63,
  commercialTaxes: 701094.54,
  apolloGross: 358870.0,
  apolloTaxes: 56870.15,
  totalGross: 2795819.63,
  totalNet: 2037854.94,
}

/**
 * Where the 2024 workbook disagrees with itself, mirroring the $150 SL Envios
 * error in 2025. Both numbers are kept so the gap can be shown rather than
 * silently resolved.
 */
export const KNOWN_VARIANCES_2024 = [
  {
    leaseId: 'a25-genuine-detailing',
    computed: 43055.0,
    stated: 43230.0,
    note: 'Genuine Automotive Detailing: three months at $3,445, eight at $3,655 and December at $3,480 sum to $43,055, but the row prints $43,230. The $175 flows into the 1401 N 25th Avenue total and the portfolio total.',
  },
  {
    leaseId: 'pp1536-patrones',
    computed: 98226.2,
    stated: 98226.22,
    note: 'Two cents of rounding on the 1536 row. Immaterial, recorded for completeness.',
  },
]
