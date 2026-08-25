import { useState } from 'react'
import { activateSharedStore } from '../lib/store'

/**
 * The gate in front of the portfolio when the server is running with a
 * passphrase set. The name is not a login — it is so an edit made in Chicago
 * shows up in Miami attributed to whoever made it.
 */
export function SignIn({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [name, setName] = useState(localStorage.getItem('ntp.editor') ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, name: name.trim() }),
      })
      if (res.status === 401) {
        setError('That passphrase is not right.')
        return
      }
      if (!res.ok) {
        setError('Could not sign in. Try again in a moment.')
        return
      }
      if (name.trim()) localStorage.setItem('ntp.editor', name.trim())
      activateSharedStore(name.trim() || null)
      onDone()
    } catch {
      setError('Could not reach the server.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <form onSubmit={submit} style={{ width: '100%', maxWidth: 380 }}>
        <div className="brand-mark">Portfolio OS</div>
        <h1 className="page-title" style={{ marginTop: 4, marginBottom: 6 }}>New Town Properties</h1>
        <p className="page-sub" style={{ marginTop: 0, marginBottom: 22 }}>
          This portfolio carries tenants' names, addresses and phone numbers. Sign in to continue.
        </p>

        <div className="stack" style={{ gap: 12 }}>
          <label className="field">
            <span>Passphrase</span>
            <input
              type="password" autoFocus value={password} autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Your name</span>
            <input
              value={name} placeholder="so edits are attributed"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          {error && (
            <div className="callout" style={{ margin: 0, padding: '10px 12px' }}>
              <p style={{ color: 'var(--red-bright)' }}>{error}</p>
            </div>
          )}
          <button className="btn primary" type="submit" disabled={busy || !password}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </div>
      </form>
    </div>
  )
}
