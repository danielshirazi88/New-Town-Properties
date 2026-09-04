import type { VehicleAsset } from '../lib/assets'

/**
 * The cars, from the owner's "Autos Owned" schedule.
 *
 * Both printed totals reconcile exactly: $918,759.71 paid across the eleven, and
 * $659,000 of current value — a fall of $259,759.71, or 28.3% of cost. Nearly
 * half of what is left sits in one car.
 *
 * Two things on the schedule are worth knowing before quoting from it:
 *
 *  - **The Tacoma's odometer runs backwards.** It is written as 179,187 miles at
 *    purchase and 115,582 now. A car does not un-drive 63,605 miles, so one of
 *    the two figures is wrong or the columns were filled in the wrong order.
 *    Both are recorded as written and the contradiction is flagged rather than
 *    quietly corrected.
 *  - **The 2026 Range Rover has no VIN on the sheet.** It is the only one
 *    missing, and it is the most recent purchase.
 */
export const SEEDED_VEHICLES: VehicleAsset[] = [
  {
    id: 'car-ford-f250-lariat-2011',
    kind: 'vehicle',
    name: '2011 Ford F250 Lariat',
    year: 2011,
    make: 'Ford',
    model: 'F250 Lariat',
    vin: '1FT7X2B64BEB29789',
    purchaseDate: '2010-11-01',
    purchasePrice: 40952.35,
    purchaseMiles: 13,
    currentMiles: 55000,
    currentValue: 25000,
  },
  {
    id: 'car-mercedes-benz-cls63-amg-2012',
    kind: 'vehicle',
    name: '2012 Mercedes-Benz CLS63 AMG',
    year: 2012,
    make: 'Mercedes-Benz',
    model: 'CLS63 AMG',
    vin: 'WDDLJ7EB2CA050951',
    purchaseDate: '2012-05-10',
    purchasePrice: 103832.0,
    purchaseMiles: 25,
    currentMiles: 35000,
    currentValue: 40000,
  },
  {
    id: 'car-land-rover-range-rover-sport-svr-2016',
    kind: 'vehicle',
    name: '2016 Land Rover Range Rover Sport SVR',
    year: 2016,
    make: 'Land Rover',
    model: 'Range Rover Sport SVR',
    vin: 'SALWZ2EF6GA552379',
    purchaseDate: '2016-12-13',
    purchasePrice: 100000.0,
    purchaseMiles: 16566,
    currentMiles: 55807,
    currentValue: 30000,
  },
  {
    id: 'car-gmc-sierra-denali-2020',
    kind: 'vehicle',
    name: '2020 GMC Sierra Denali',
    year: 2020,
    make: 'GMC',
    model: 'Sierra Denali',
    vin: '1GTU9FEL3LZ297052',
    purchaseDate: '2020-08-03',
    purchasePrice: 63386.36,
    purchaseMiles: 160,
    currentMiles: 30000,
    currentValue: 40000,
  },
  {
    id: 'car-porsche-panamera-turbo-2018',
    kind: 'vehicle',
    name: '2018 Porsche Panamera Turbo',
    year: 2018,
    make: 'Porsche',
    model: 'Panamera Turbo',
    vin: 'WP0AF2A73JL140859',
    purchaseDate: '2020-12-02',
    purchasePrice: 96990.0,
    purchaseMiles: 4585,
    currentMiles: 11000,
    currentValue: 60000,
  },
  {
    id: 'car-toyota-tacoma-trd-sport-2009',
    kind: 'vehicle',
    name: '2009 Toyota Tacoma TRD Sport',
    year: 2009,
    make: 'Toyota',
    model: 'Tacoma TRD Sport',
    vin: '5TEUU42N89Z666199',
    purchaseDate: '2021-08-16',
    purchasePrice: 10000.0,
    purchaseMiles: 179187,
    currentMiles: 115582,
    currentValue: 10000,
  },
  {
    id: 'car-infiniti-q50-2014',
    kind: 'vehicle',
    name: '2014 Infiniti Q50',
    year: 2014,
    make: 'Infiniti',
    model: 'Q50',
    vin: 'JN1BV7AR9EM697123',
    purchaseDate: '2022-02-01',
    purchasePrice: 15000.0,
    purchaseMiles: 80000,
    currentMiles: 116480,
    currentValue: 10000,
  },
  {
    id: 'car-lamborghini-urus-2024',
    kind: 'vehicle',
    name: '2024 Lamborghini Urus',
    year: 2024,
    make: 'Lamborghini',
    model: 'Urus',
    vin: 'ZPBUC3ZL6RLA29806',
    purchaseDate: '2024-04-24',
    purchasePrice: 326242.0,
    purchaseMiles: 41,
    currentMiles: 1500,
    currentValue: 300000,
  },
  {
    id: 'car-infiniti-qx60-2023',
    kind: 'vehicle',
    name: '2023 Infiniti QX60',
    year: 2023,
    make: 'Infiniti',
    model: 'QX60',
    vin: '5N1DL1GS7PC359453',
    purchaseDate: '2024-11-19',
    purchasePrice: 37145.0,
    purchaseMiles: 19124,
    currentMiles: 34617,
    currentValue: 32000,
  },
  {
    id: 'car-mercedes-benz-s63-amg-2020',
    kind: 'vehicle',
    name: '2020 Mercedes-Benz S63 AMG',
    year: 2020,
    make: 'Mercedes-Benz',
    model: 'S63 AMG',
    vin: 'W1KUG8JB8LA558288',
    purchaseDate: '2025-04-25',
    purchasePrice: 75212.0,
    purchaseMiles: 41532,
    currentMiles: 45000,
    currentValue: 70000,
  },
  {
    id: 'car-land-rover-range-rover-sport-svr-2020',
    kind: 'vehicle',
    name: '2020 Land Rover Range Rover Sport SVR',
    year: 2020,
    make: 'Land Rover',
    model: 'Range Rover Sport SVR',
    purchaseDate: '2026-04-01',
    purchasePrice: 50000.0,
    purchaseMiles: 42000,
    currentMiles: 43000,
    currentValue: 42000,
  },
]

/** What the schedule prints at the foot of each column, for checking the rows. */
export const VEHICLE_TOTALS = { purchase: 918_759.71, currentValue: 659_000 }
