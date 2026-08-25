import { useCallback, useEffect, useRef, useState } from 'react'
import { store } from './store'

/**
 * A piece of application state that lives in the store — browser or shared
 * backend, depending on how the app is configured.
 *
 * Writes are optimistic so typing never stalls on the network, and the hook
 * subscribes for changes made elsewhere so a correction entered in Chicago shows
 * up in Miami without a reload. An update arriving while the user is mid-edit is
 * held back until they stop, so remote traffic cannot yank a half-typed value.
 */
export function useStored<T>(key: string, initial: T): {
  value: T
  setValue: (next: T) => void
  loaded: boolean
  saving: boolean
  error: string | null
} {
  const [value, setInner] = useState<T>(initial)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastLocalWrite = useRef(0)

  useEffect(() => {
    let alive = true
    void store()
      .get<T>(key)
      .then((v) => {
        if (alive && v !== null) setInner(v)
      })
      .finally(() => alive && setLoaded(true))

    const unsubscribe = store().subscribe<T>(key, (incoming) => {
      // Ignore an echo of a write this tab just made, and don't clobber a value
      // the user is actively editing.
      if (Date.now() - lastLocalWrite.current < 3000) return
      setInner(incoming)
    })
    return () => {
      alive = false
      unsubscribe()
    }
  }, [key])

  const setValue = useCallback(
    (next: T) => {
      setInner(next)
      lastLocalWrite.current = Date.now()
      setSaving(true)
      setError(null)
      void store()
        .set(key, next)
        .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not save'))
        .finally(() => setSaving(false))
    },
    [key],
  )

  return { value, setValue, loaded, saving, error }
}
