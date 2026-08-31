import { useEffect, useState } from 'react'

/**
 * Today's date, kept current while the page is open.
 *
 * Everything time-sensitive hangs off this — whether the rent is due, how many
 * days past grace a tenant is, what the late fee has reached. A date captured
 * once when the module loaded would freeze all of that the moment someone leaves
 * the tab open, and this is a screen that gets left open: on the morning of the
 * 1st it would still be showing the 31st, with the month's rent not yet due.
 *
 * The identity of the returned date only changes when the calendar day does, so
 * the minute-by-minute check costs nothing — React sees the same object and does
 * not re-render.
 */
export function useToday(): Date {
  const [today, setToday] = useState(() => new Date())

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setToday((prev) => (prev.toDateString() === now.toDateString() ? prev : now))
    }

    // A minute is fine: nothing here turns on the hour, and the day boundary is
    // caught within sixty seconds of passing.
    const id = window.setInterval(tick, 60_000)

    // Background tabs get their timers throttled, and a sleeping laptop stops
    // them entirely — so also check whenever the page comes back into use.
    window.addEventListener('focus', tick)
    document.addEventListener('visibilitychange', tick)

    return () => {
      window.clearInterval(id)
      window.removeEventListener('focus', tick)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])

  return today
}
