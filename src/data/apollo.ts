import type { ApolloTenant } from '../lib/types'

/**
 * Apollo Mobile Home Court — the trailer park.
 *
 * Roster transcribed from the "Month of JULY 2026" registry, which states that
 * every amount shown "INCLUDES $75 FOR WATER". Base lot rent is therefore the
 * amount due less $75.
 *
 * This is a *current* roster, one period ahead of the 2025 rent roll used for the
 * rest of the portfolio. The 2025 sheet gives Apollo only as an annual figure
 * ($378,870 gross, $57,077.58 tax), with no month-by-month or per-lot detail —
 * so the two are reported side by side rather than merged.
 */
export const APOLLO_WATER_CHARGE = 75

export const APOLLO_REGISTRY_LABEL = 'July 2026 registry'

export const APOLLO_TENANTS: ApolloTenant[] = [
  { id: 'ap-alvarez', name: 'Alvarez, Galaxia', address: '4216 Apollo Lane', amountDue: 825, flagged: false, contacts: [{ phone: '773-414-0100', label: 'G' }, { phone: '773-443-1515', label: 'E' }] },
  { id: 'ap-avalos', name: 'Avalos, Jose / Chagolla', address: '4208 ½ Apollo', amountDue: 775, flagged: false, contacts: [{ phone: '708-600-2782' }, { phone: '708-600-2234', label: 'M' }] },
  { id: 'ap-barradas-e', name: 'Barradas, Esperanza', address: '4215 W Lake Ter', amountDue: 900, flagged: false, contacts: [{ phone: '708-300-4096', label: 'M' }, { phone: '708-300-4641', label: 'E' }] },
  { id: 'ap-barradas-j', name: 'Barradas, Jesus', address: '1420 N 42nd Ave', amountDue: 825, flagged: false, contacts: [{ phone: '773-459-4110', label: 'J' }, { phone: '708-495-8086', label: 'M' }] },
  { id: 'ap-cardoso', name: 'Cardoso, Felix', address: '1417 N 43rd Ave', amountDue: 900, flagged: false, contacts: [{ phone: '224-715-5659', label: 'F' }, { phone: '224-659-0545', label: 'T' }] },
  { id: 'ap-cazho', name: 'Cazho, Edwin / Yupa', address: '4203 W Lake Ter', amountDue: 1020, flagged: false, contacts: [{ phone: '708-228-6763', label: 'R' }] },
  { id: 'ap-cisneros', name: 'Cisneros, Ricardo', address: '4211 W Lake Ter', amountDue: 800, flagged: false, contacts: [{ phone: '630-452-7666' }, { phone: '708-770-2363', label: 'wife' }] },
  { id: 'ap-estrella', name: 'Estrella, Veronica', address: '1422 N 42nd Ct', amountDue: 900, flagged: false, contacts: [{ phone: '708-513-1917' }] },
  { id: 'ap-gonzalez', name: 'Gonzalez, Carlos', address: '4207 W Lake #A', amountDue: 700, flagged: true, contacts: [{ phone: '312-771-7051' }, { phone: '773-800-6100', label: 'J' }] },
  { id: 'ap-gomez', name: 'Gomez, Ismael', address: '4208 Apollo #B', amountDue: 945, flagged: true, contacts: [{ phone: '630-709-4813', label: 'I' }] },
  { id: 'ap-goytia', name: 'Goytia, Javier', address: '1424 42nd Court', amountDue: 800, flagged: false, contacts: [{ phone: '708-673-4371', label: 'J' }, { phone: '708-501-1902', label: 'M' }] },
  { id: 'ap-guzman', name: 'Guzman, Marisol', address: '4210 Apollo Ln', amountDue: 725, flagged: false, contacts: [{ phone: '708-670-8880' }, { phone: '708-639-5378' }] },
  { id: 'ap-gregg', name: 'Gregg, John A, Jr', address: '4208 Apollo Ln', amountDue: 650, flagged: false, contacts: [{ phone: '708-315-4779' }] },
  { id: 'ap-hernandez', name: 'Hernandez, Jose / Manriquez', address: '4215 Apollo', amountDue: 850, flagged: false, contacts: [{ phone: '312-508-2145' }, { phone: '773-441-4548', label: 'A' }] },
  { id: 'ap-herrera', name: 'Herrera, Salvador', address: '1421 N 42nd Ave', amountDue: 1095, flagged: false, contacts: [{ phone: '708-518-1674', label: 'S' }] },
  { id: 'ap-jimenez', name: 'Jimenez, Eddi & Erick', address: '4207 W Lake Ter #B', amountDue: 800, flagged: true, contacts: [{ phone: '630-965-5764' }] },
  { id: 'ap-magana', name: 'Magaña, Maria', address: '4213 W Lake Ter', amountDue: 725, flagged: false, contacts: [{ phone: '630-997-4460', label: 'M' }, { phone: '773-742-8173', label: 'N' }] },
  { id: 'ap-martinez-g', name: 'Martinez, Guadalupe', address: '1406 43rd Ct', amountDue: 975, flagged: false, contacts: [{ phone: '708-646-0667', label: 'G' }, { phone: '708-679-4151', label: 'L' }] },
  { id: 'ap-martinez-n', name: 'Martinez, Nomalit', address: '4219 Apollo Lane', amountDue: 1000, flagged: false, contacts: [{ phone: '847-454-4678' }] },
  { id: 'ap-mejia', name: 'Mejia, Leonardo', address: '4208 Apollo Bsmt', amountDue: 1095, flagged: true, contacts: [{ phone: '708-545-7238' }] },
  { id: 'ap-moran', name: 'Moran, Monica', address: '1404 N 43rd Ct', amountDue: 950, flagged: false, contacts: [{ phone: '708-800-2954' }] },
  { id: 'ap-navarrete', name: 'Navarrete, Valentin', address: '4218 W Apollo Ln', amountDue: 970, flagged: false, contacts: [{ phone: '708-890-0296', label: 'V' }, { phone: '708-759-0466', label: 'M' }] },
  { id: 'ap-navarro-m', name: 'Navarro, Miguel', address: '1421 43rd Ave', amountDue: 850, flagged: false, contacts: [{ phone: '708-982-9892' }] },
  { id: 'ap-navarro-r', name: 'Navarro, Raul', address: '4213 Apollo Ln', amountDue: 850, flagged: false, contacts: [{ phone: '708-441-1514' }, { phone: '708-417-4037' }] },
  { id: 'ap-ortega', name: 'Ortega, Alma', address: '1423 42nd Ct', amountDue: 870, flagged: false, contacts: [{ phone: '630-670-4610', label: 'A' }] },
  { id: 'ap-ramirez', name: 'Ramirez, Delio', address: '1419 N 43rd Ave', amountDue: 825, flagged: false, contacts: [{ phone: '773-708-4193' }] },
  { id: 'ap-resendez', name: 'Resendez, Mayra', address: '1419 N 42nd Ave', amountDue: 970, flagged: false, contacts: [{ phone: '507-382-5080', label: 'M' }, { phone: '708-765-2241', label: 'S' }] },
  { id: 'ap-rivera', name: 'Rivera, Graciela', address: '1417 42nd Ct', amountDue: 875, flagged: false, contacts: [{ phone: '630-935-7781' }, { phone: '708-252-5447' }] },
  { id: 'ap-rodriguez', name: 'Rodriguez, Sofia', address: '4209 W Lake Ter', amountDue: 725, flagged: false, contacts: [{ name: 'David Vasquez', phone: '708-733-3292' }] },
  { id: 'ap-rojo', name: 'Rojo, Jose', address: '4217 Apollo Ln', amountDue: 1000, flagged: false, contacts: [{ phone: '708-731-1525', label: 'J' }] },
  { id: 'ap-saavedra', name: 'Saavedra, Francisco', address: '4205 W Lake Ter', amountDue: 850, flagged: false, contacts: [{ phone: '708-983-4973' }] },
  { id: 'ap-salas', name: 'Salas, Mayra', address: '1403 N 44th Ave', amountDue: 1320, flagged: false, contacts: [{ phone: '708-275-9903' }] },
  { id: 'ap-tapia', name: 'Tapia, Maria', address: '4212 W Apollo', amountDue: 825, flagged: false, contacts: [{ phone: '630-870-9657', label: 'M' }, { phone: '773-790-3640', label: 'R' }] },
  { id: 'ap-torres', name: 'Torres, Chelenin', address: '1425 N 43rd', amountDue: 920, flagged: false, contacts: [{ phone: '312-837-7835' }] },
  { id: 'ap-valdovinos', name: 'Valdovinos, Gloria', address: '4214 Apollo', amountDue: 870, flagged: false, contacts: [{ phone: '708-506-5292' }] },
  { id: 'ap-weir', name: 'Weir, George', address: '1426 42nd Court', amountDue: 725, flagged: false, contacts: [{ phone: '630-240-1734' }] },
  { id: 'ap-zavala', name: 'Zavala, Jose', address: '1423 N 43rd Ave', amountDue: 900, flagged: false, contacts: [{ name: 'Jose', phone: '773-691-3817' }, { phone: '773-691-5252', label: 'M' }] },
  // Five tandem parking spaces at $100 a month each, per the owner. The July 2026
  // registry lists only two of them and shows no amount against either, so the
  // count and the rate both come from the owner rather than the document.
  // Parking carries no water charge — that $75 applies to dwelling lots only.
  { id: 'ap-parking-4211', name: 'Tandem parking', address: '4211 Apollo Lane', amountDue: 100, flagged: false, isParking: true, contacts: [] },
  { id: 'ap-parking-4209', name: 'Tandem parking', address: '4209 Apollo Lane', amountDue: 100, flagged: false, isParking: true, contacts: [] },
  { id: 'ap-parking-3', name: 'Tandem parking', address: 'Lot not identified on registry', amountDue: 100, flagged: true, isParking: true, contacts: [] },
  { id: 'ap-parking-4', name: 'Tandem parking', address: 'Lot not identified on registry', amountDue: 100, flagged: true, isParking: true, contacts: [] },
  { id: 'ap-parking-5', name: 'Tandem parking', address: 'Lot not identified on registry', amountDue: 100, flagged: true, isParking: true, contacts: [] },
]

/**
 * The registry marks four names with an asterisk and never says what it means.
 * Surfaced in the UI as an unexplained flag rather than guessed at.
 */
export const APOLLO_FLAG_NOTE =
  'Four names carry an asterisk on the registry (Gonzalez, Gomez, Jimenez, Mejia). The registry does not say what it denotes.'

/** Monthly rent per tandem parking space. Owner-supplied; not on the registry. */
export const APOLLO_PARKING_RENT = 100

export const APOLLO_PARKING_NOTE =
  'Five tandem spaces at $100 a month, confirmed by the owner. The registry names only two of them (4211 and 4209 Apollo Lane) and gives no amount for either, so three spaces still need their lot identified. Whether the $500 a month is already inside the 2025 Apollo gross of $378,870 is not determinable from the sheet.'
