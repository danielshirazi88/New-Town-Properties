import type { Lease, MonthCell } from '../../lib/types'

const r = (value: MonthCell, n: number): MonthCell[] => Array.from({ length: n }, () => value)
/** September onward is not on this sheet — not reported, not vacant. */
const rest = r('NR', 4)

/**
 * Apollo Mobile Home Court — the 2026 rent roll, January to August.
 *
 * Until this sheet arrived the park was a single annual figure, which meant its
 * thirty-seven households were the only tenants in the portfolio the collection
 * engine could not see: no charges, no due dates, no late fees, no arrears. A
 * seventh of the rent sat outside the system that exists to watch whether rent
 * turns up. These are lease rows like any other, so the park is now tracked the
 * same way the shops are.
 *
 * Every month reconciles to the total printed on the sheet — $32,070 from
 * January to June, $32,750 in July and $32,850 in August, $258,020 across the
 * eight. That is $6,780 below the $264,800 the app had been deriving from the
 * July registry by multiplying one month out, which is why a derived figure was
 * flagged as derived.
 *
 * A lot has no lease term: these are month-to-month tenancies, recorded as such
 * so they are not reported as leases with a missing expiry date.
 */
export const APOLLO_LEASES_2026: Lease[] = [
  { id: 'ap-alvarez', propertyId: 'apollo', unit: '4216 Apollo Lane', tenant: 'Alvarez, Galaxia',
    contacts: [{ phone: '773-414-0100', label: 'G' }, { phone: '773-443-1515', label: 'E' }],
    months: [...r(825, 8), ...rest], statedAnnualTotal: 6600,
    leaseType: 'MG', incomeType: 'rent', renewalOptions: 'Month to month' },
  { id: 'ap-avalos', propertyId: 'apollo', unit: '4208 ½ Apollo', tenant: 'Avalos, Jose / Chagolla',
    contacts: [{ phone: '708-600-2782' }, { phone: '708-600-2234', label: 'M' }],
    months: [...r(775, 8), ...rest], statedAnnualTotal: 6200,
    leaseType: 'MG', incomeType: 'rent', renewalOptions: 'Month to month' },
  { id: 'ap-barradas-jesu', propertyId: 'apollo', unit: '1420 N 42nd Ave', tenant: 'Barradas, Jesus',
    contacts: [{ phone: '773-459-4110', label: 'J' }, { phone: '708-495-8086', label: 'M' }],
    months: [...r(825, 8), ...rest], statedAnnualTotal: 6600,
    leaseType: 'MG', incomeType: 'rent', renewalOptions: 'Month to month' },
  { id: 'ap-barradas-espe', propertyId: 'apollo', unit: '4215 W Lake Ter', tenant: 'Barradas, Esperanza',
    contacts: [{ phone: '708-300-4096', label: 'M' }, { phone: '708-300-4641', label: 'E' }],
    months: [...r(900, 8), ...rest], statedAnnualTotal: 7200,
    leaseType: 'MG', incomeType: 'rent', renewalOptions: 'Month to month' },
  { id: 'ap-cardoso', propertyId: 'apollo', unit: '1417 N 43rd Ave', tenant: 'Cardoso, Felix',
    contacts: [{ phone: '224-715-5659', label: 'F' }, { phone: '224-659-0545', label: 'T' }],
    months: [...r(900, 8), ...rest], statedAnnualTotal: 7200,
    leaseType: 'MG', incomeType: 'rent', renewalOptions: 'Month to month' },
  { id: 'ap-cisneros', propertyId: 'apollo', unit: '4211 W Lake Ter', tenant: 'Cisneros, Ricardo',
    contacts: [{ phone: '630-452-7666' }, { phone: '708-770-2363' }],
    months: [...r(800, 8), ...rest], statedAnnualTotal: 6400,
    leaseType: 'MG', incomeType: 'rent', renewalOptions: 'Month to month' },
  { id: 'ap-escobar', propertyId: 'apollo', unit: '4203 W Lake Ter', tenant: 'Escobar, Lilian & Gomez, M',
    contacts: [{ phone: '323-396-1461', label: 'L' }, { phone: '323-944-9384', label: 'M' }],
    months: [...r(850, 6), 1020, 1120, ...rest], statedAnnualTotal: 7240,
    leaseType: 'MG', incomeType: 'rent', renewalOptions: 'Month to month' },
  { id: 'ap-estrella', propertyId: 'apollo', unit: '1422 N 42nd Ct', tenant: 'Estrella, Veronica',
    contacts: [{ phone: '708-513-1917' }],
    months: [...r(900, 8), ...rest], statedAnnualTotal: 7200,
    leaseType: 'MG', incomeType: 'rent', renewalOptions: 'Month to month' },
  { id: 'ap-gomez', propertyId: 'apollo', unit: '4208 Apollo #B', tenant: 'Gomez, Ismael',
    contacts: [{ phone: '630-709-4813', label: 'I' }],
    months: [...r(945, 8), ...rest], statedAnnualTotal: 7560,
    leaseType: 'MG', incomeType: 'rent', renewalOptions: 'Month to month' },
  { id: 'ap-gonzalez', propertyId: 'apollo', unit: '4207 W Lake #A', tenant: 'Gonzalez, Carlos',
    contacts: [{ phone: '312-771-7051' }, { phone: '773-800-6100', label: 'J' }],
    months: [...r(700, 8), ...rest], statedAnnualTotal: 5600,
    leaseType: 'MG', incomeType: 'rent', renewalOptions: 'Month to month' },
  { id: 'ap-goytia', propertyId: 'apollo', unit: '1424 42nd Court', tenant: 'Goytia, Javier',
    contacts: [{ phone: '708-673-4371', label: 'J' }, { phone: '708-501-1902', label: 'M' }],
    months: [...r(800, 8), ...rest], statedAnnualTotal: 6400,
    leaseType: 'MG', incomeType: 'rent', renewalOptions: 'Month to month' },
  { id: 'ap-gregg', propertyId: 'apollo', unit: '4208 Apollo Ln', tenant: 'Gregg, John A, Jr',
    contacts: [{ phone: '708-315-4779' }],
    months: [...r(650, 8), ...rest], statedAnnualTotal: 5200,
    leaseType: 'MG', incomeType: 'rent', renewalOptions: 'Month to month' },
  { id: 'ap-guzman', propertyId: 'apollo', unit: '4210 Apollo Ln', tenant: 'Guzman, Marisol',
    contacts: [{ phone: '708-670-8880' }, { phone: '708-639-5378' }],
    months: [...r(725, 8), ...rest], statedAnnualTotal: 5800,
    leaseType: 'MG', incomeType: 'rent', renewalOptions: 'Month to month' },
  { id: 'ap-hernandez', propertyId: 'apollo', unit: '4215 Apollo', tenant: 'Hernandez, Jose / Manriquez',
    contacts: [{ phone: '312-508-2145' }, { phone: '773-441-4548', label: 'A' }],
    months: [...r(850, 8), ...rest], statedAnnualTotal: 6800,
    leaseType: 'MG', incomeType: 'rent', renewalOptions: 'Month to month' },
  { id: 'ap-herrera', propertyId: 'apollo', unit: '1421 N 42nd Ave', tenant: 'Herrera, Salvador',
    contacts: [{ phone: '708-518-1674', label: 'S' }],
    months: [...r(975, 6), ...r(1095, 2), ...rest], statedAnnualTotal: 8040,
    leaseType: 'MG', incomeType: 'rent', renewalOptions: 'Month to month' },
  { id: 'ap-jimenez', propertyId: 'apollo', unit: '4207 W Lake Ter #B', tenant: 'Jimenez, Eddi & Erick',
    contacts: [{ phone: '630-965-5764' }],
    months: [...r(800, 8), ...rest], statedAnnualTotal: 6400,
    leaseType: 'MG', incomeType: 'rent', renewalOptions: 'Month to month' },
  { id: 'ap-magana', propertyId: 'apollo', unit: '4213 W Lake Ter', tenant: 'Magaña, Maria',
    contacts: [{ phone: '630-997-4460', label: 'M' }, { phone: '773-742-8173', label: 'N' }],
    months: [...r(775, 6), ...r(725, 2), ...rest], statedAnnualTotal: 6100,
    leaseType: 'MG', incomeType: 'rent', renewalOptions: 'Month to month' },
  { id: 'ap-martinez-guad', propertyId: 'apollo', unit: '1406 43rd Ct', tenant: 'Martinez, Guadalupe',
    contacts: [{ phone: '708-646-0667', label: 'G' }, { phone: '708-679-4151', label: 'L' }],
    months: [...r(975, 8), ...rest], statedAnnualTotal: 7800,
    leaseType: 'MG', incomeType: 'rent', renewalOptions: 'Month to month' },
  { id: 'ap-martinez-noma', propertyId: 'apollo', unit: '4219 Apollo Lane', tenant: 'Martinez, Nomalit',
    contacts: [{ phone: '847-454-4678' }],
    months: [...r(1300, 8), ...rest], statedAnnualTotal: 10400,
    leaseType: 'MG', incomeType: 'rent', renewalOptions: 'Month to month' },
  { id: 'ap-mejia', propertyId: 'apollo', unit: '4208 Apollo Bsmt', tenant: 'Mejia, Leonardo',
    contacts: [{ phone: '708-545-7238' }],
    months: [...r(1095, 8), ...rest], statedAnnualTotal: 8760,
    leaseType: 'MG', incomeType: 'rent', renewalOptions: 'Month to month' },
  { id: 'ap-moran', propertyId: 'apollo', unit: '1404 N 43rd Ct', tenant: 'Moran, Monica',
    contacts: [{ phone: '708-800-2954' }],
    months: [...r(950, 8), ...rest], statedAnnualTotal: 7600,
    leaseType: 'MG', incomeType: 'rent', renewalOptions: 'Month to month' },
  { id: 'ap-navarrete', propertyId: 'apollo', unit: '4218 W Apollo Ln', tenant: 'Navarrete, Valentin',
    contacts: [{ phone: '708-890-0296', label: 'V' }, { phone: '708-759-0466', label: 'M' }],
    months: [...r(950, 6), ...r(970, 2), ...rest], statedAnnualTotal: 7640,
    leaseType: 'MG', incomeType: 'rent', renewalOptions: 'Month to month' },
  { id: 'ap-navarro-migu', propertyId: 'apollo', unit: '1421 43rd Ave', tenant: 'Navarro, Miguel',
    contacts: [{ phone: '708-982-9892' }],
    months: [...r(850, 8), ...rest], statedAnnualTotal: 6800,
    leaseType: 'MG', incomeType: 'rent', renewalOptions: 'Month to month' },
  { id: 'ap-navarro-raul', propertyId: 'apollo', unit: '4213 Apollo Ln', tenant: 'Navarro, Raul',
    contacts: [{ phone: '708-441-1514' }, { phone: '708-417-4037' }],
    months: [...r(850, 8), ...rest], statedAnnualTotal: 6800,
    leaseType: 'MG', incomeType: 'rent', renewalOptions: 'Month to month' },
  { id: 'ap-ortega', propertyId: 'apollo', unit: '1423 42nd Ct', tenant: 'Ortega, Alma',
    contacts: [{ phone: '630-670-4610', label: 'A' }],
    months: [...r(770, 6), ...r(870, 2), ...rest], statedAnnualTotal: 6360,
    leaseType: 'MG', incomeType: 'rent', renewalOptions: 'Month to month' },
  { id: 'ap-ramirez', propertyId: 'apollo', unit: '1419 N 43rd Ave', tenant: 'Ramirez, Delio',
    contacts: [{ phone: '773-708-4193' }],
    months: [...r(825, 8), ...rest], statedAnnualTotal: 6600,
    leaseType: 'MG', incomeType: 'rent', renewalOptions: 'Month to month' },
  { id: 'ap-resendez', propertyId: 'apollo', unit: '1419 N 42nd Ave', tenant: 'Resendez, Mayra',
    contacts: [{ phone: '507-382-5080', label: 'M' }, { phone: '708-765-2241', label: 'S' }],
    months: [...r(970, 8), ...rest], statedAnnualTotal: 7760,
    leaseType: 'MG', incomeType: 'rent', renewalOptions: 'Month to month' },
  { id: 'ap-rivera', propertyId: 'apollo', unit: '1417 42nd Ct', tenant: 'Rivera, Graciela',
    contacts: [{ phone: '630-935-7781' }, { phone: '708-252-5447' }],
    months: [...r(875, 6), ...r(825, 2), ...rest], statedAnnualTotal: 6900,
    leaseType: 'MG', incomeType: 'rent', renewalOptions: 'Month to month' },
  { id: 'ap-rodriguez', propertyId: 'apollo', unit: '4209 W Lake Ter', tenant: 'Rodriguez, Sofia',
    contacts: [{ phone: '708-735-5436', label: 'S' }, { phone: '708-733-3292', label: 'D' }],
    months: [...r(725, 8), ...rest], statedAnnualTotal: 5800,
    leaseType: 'MG', incomeType: 'rent', renewalOptions: 'Month to month' },
  { id: 'ap-rojo', propertyId: 'apollo', unit: '4217 Apollo Ln', tenant: 'Rojo, Jose',
    contacts: [{ phone: '708-731-1525', label: 'J' }],
    months: [...r(775, 6), ...r(1000, 2), ...rest], statedAnnualTotal: 6650,
    leaseType: 'MG', incomeType: 'rent', renewalOptions: 'Month to month' },
  { id: 'ap-saavedra', propertyId: 'apollo', unit: '4205 W Lake Ter', tenant: 'Saavedra, Francisco',
    contacts: [{ phone: '708-983-4973' }],
    months: [...r(850, 8), ...rest], statedAnnualTotal: 6800,
    leaseType: 'MG', incomeType: 'rent', renewalOptions: 'Month to month' },
  { id: 'ap-salas', propertyId: 'apollo', unit: '1403 N 44th Ave', tenant: 'Salas, Mayra',
    contacts: [{ phone: '708-275-9903' }],
    months: [...r(1075, 6), ...r(1220, 2), ...rest], statedAnnualTotal: 8890,
    leaseType: 'MG', incomeType: 'rent', renewalOptions: 'Month to month' },
  { id: 'ap-tapia', propertyId: 'apollo', unit: '4212 W Apollo', tenant: 'Tapia, Maria',
    contacts: [{ phone: '630-870-9657', label: 'M' }, { phone: '773-790-3640', label: 'R' }],
    months: [...r(825, 8), ...rest], statedAnnualTotal: 6600,
    leaseType: 'MG', incomeType: 'rent', renewalOptions: 'Month to month' },
  { id: 'ap-torres', propertyId: 'apollo', unit: '1425 N 43rd', tenant: 'Torres, Chelenin',
    contacts: [{ phone: '312-837-7835' }],
    months: [...r(920, 8), ...rest], statedAnnualTotal: 7360,
    leaseType: 'MG', incomeType: 'rent', renewalOptions: 'Month to month' },
  { id: 'ap-valdovinos', propertyId: 'apollo', unit: '4214 Apollo', tenant: 'Valdovinos, Gloria',
    contacts: [{ phone: '708-506-5292' }],
    months: [...r(870, 8), ...rest], statedAnnualTotal: 6960,
    leaseType: 'MG', incomeType: 'rent', renewalOptions: 'Month to month' },
  { id: 'ap-weir', propertyId: 'apollo', unit: '1426 42nd Court', tenant: 'Weir, George',
    contacts: [{ phone: '630-240-1734' }],
    months: [...r(725, 8), ...rest], statedAnnualTotal: 5800,
    leaseType: 'MG', incomeType: 'rent', renewalOptions: 'Month to month' },
  { id: 'ap-zavala', propertyId: 'apollo', unit: '1423 N 43rd Ave', tenant: 'Zavala, Jose',
    contacts: [{ phone: '773-691-3817', label: 'Jose' }, { phone: '773-691-5252', label: 'M' }],
    months: [...r(900, 8), ...rest], statedAnnualTotal: 7200,
    leaseType: 'MG', incomeType: 'rent', renewalOptions: 'Month to month' },
]

/** What the sheet prints at the foot of each column, for checking the rows. */
export const APOLLO_MONTHLY_TOTALS_2026 = [
  32070, 32070, 32070, 32070, 32070, 32070, 32750, 32850,
]

/** Gross across the eight months the sheet covers. */
export const APOLLO_GROSS_2026 = APOLLO_MONTHLY_TOTALS_2026.reduce((a, b) => a + b, 0)

/**
 * Where the park's rent roll and the July registry disagree.
 *
 * Both are real documents about the same month and they do not match. The rent
 * roll wins here because it reconciles to its own printed totals, but a
 * disagreement is worth seeing rather than resolving quietly — three of these
 * are money and one is a name that means a lot changed hands.
 */
export const APOLLO_REGISTRY_CONFLICTS: {
  unit: string
  rollTenant: string
  rollJuly: number
  registryTenant: string
  registryJuly: number
  note: string
}[] = [
  {
    unit: '4203 W Lake Ter',
    rollTenant: 'Escobar, Lilian & Gomez, M',
    rollJuly: 1020,
    registryTenant: 'Cazho, Edwin / Yupa',
    registryJuly: 1020,
    note: 'Same rent, different tenant. One of the two documents has not caught a change '
      + 'of occupant — worth knowing which, because the rent rose from $850 to $1,020 in '
      + 'July and again to $1,120 in August.',
  },
  {
    unit: '4219 Apollo Lane',
    rollTenant: 'Martinez, Nomalit',
    rollJuly: 1300,
    registryTenant: 'Martinez, Nomalit',
    registryJuly: 1000,
    note: '$300 a month apart, and the roll shows $1,300 every month from January. '
      + 'The largest single disagreement between the two documents.',
  },
  {
    unit: '1417 42nd Ct',
    rollTenant: 'Rivera, Graciela',
    rollJuly: 825,
    registryTenant: 'Rivera, Graciela',
    registryJuly: 875,
    note: 'The roll shows a $50 reduction in July; the registry still bills the old rate.',
  },
  {
    unit: '1403 N 44th Ave',
    rollTenant: 'Salas, Mayra',
    rollJuly: 1220,
    registryTenant: 'Salas, Mayra',
    registryJuly: 1320,
    note: 'A $100 rise in July on the roll, $200 on the registry.',
  },
]

/**
 * Five tandem parking spaces at $100 a month are on the July registry and
 * nowhere on the rent roll.
 *
 * $500 a month, $4,000 across the eight months covered. They are left off the
 * lease rows above, because the rent roll is what those are transcribed from
 * and its column totals would stop tying if they were added. But the income is
 * either real and missing from the roll, or the registry is billing for spaces
 * nobody is paying for, and both are worth someone's attention.
 */
export const APOLLO_PARKING_OFF_ROLL_MONTHLY = 500
