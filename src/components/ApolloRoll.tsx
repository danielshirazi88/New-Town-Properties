import { APOLLO_WATER_CHARGE } from '../data/apollo'
import { money } from '../lib/format'
import type { ApolloTenant } from '../lib/types'

/**
 * The Apollo lot rent roll.
 *
 * Lot tenants are month-to-month and the source gives a single current amount
 * per lot rather than twelve monthly cells, so this table is shaped around what
 * actually exists: the amount due, the water charge inside it, and the base rent
 * left over. It deliberately does not show lease dates or annual bumps — those
 * columns would be empty for every row, which reads as missing data rather than
 * as "these tenancies do not work that way".
 */
export function ApolloRoll({
  tenants,
  caption,
}: {
  tenants: ApolloTenant[]
  caption?: string
}) {
  const paying = tenants.filter((t) => !t.isParking)
  const parking = tenants.filter((t) => t.isParking)
  const monthly = tenants.reduce((a, t) => a + t.amountDue, 0)
  // The $75 water charge rides on dwelling lots only, never on a parking space.
  const water = paying.length * APOLLO_WATER_CHARGE

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Tenant</th>
            <th>Lot address</th>
            <th>Home</th>
            <th className="num">Monthly due</th>
            <th className="num">Water</th>
            <th className="num">Base rent</th>
            <th className="num">Annualised</th>
            <th>Contacts</th>
          </tr>
        </thead>
        <tbody>
          {tenants.map((t) => (
            <tr key={t.id}>
              <td>
                <span className="t-strong">{t.name}</span>
                {t.parkOwned && (
                  <span className="badge ok" style={{ marginLeft: 6 }} title="The park owns this home, not the tenant">
                    park-owned home
                  </span>
                )}
                {t.isParking && <span className="badge mute" style={{ marginLeft: 6 }}>parking</span>}
              </td>
              <td className="t-mute">{t.address}</td>
              <td>
                <span className="badge mute">
                  {t.isParking ? 'Parking space' : t.parkOwned ? 'Park-owned' : 'Tenant-owned'}
                </span>
              </td>
              <td className="num t-strong">
                {t.amountDue > 0 ? money(t.amountDue) : <span className="t-mute">Not listed</span>}
              </td>
              <td className="num t-mute">{t.isParking || t.amountDue === 0 ? '—' : money(APOLLO_WATER_CHARGE)}</td>
              <td className="num">
                {t.amountDue === 0 ? '—' : money(t.isParking ? t.amountDue : t.amountDue - APOLLO_WATER_CHARGE)}
              </td>
              <td className="num t-mute">{t.amountDue > 0 ? money(t.amountDue * 12) : '—'}</td>
              <td className="t-mute" style={{ fontSize: 11.5 }}>
                {t.contacts.length === 0 ? '—' : t.contacts.map((c, i) => (
                  <span key={i} className="t-nowrap">
                    {i > 0 ? ' · ' : ''}{c.label ? `${c.label} ` : ''}{c.phone}
                  </span>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="label" colSpan={3}>
              {caption ?? `${paying.length} lots + ${parking.length} parking`}
            </td>
            <td className="num">{money(monthly)}</td>
            <td className="num">{money(water)}</td>
            <td className="num">{money(monthly - water)}</td>
            <td className="num">{money(monthly * 12)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
