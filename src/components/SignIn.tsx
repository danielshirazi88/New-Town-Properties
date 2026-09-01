import { useState } from 'react'
import { activateSharedStore } from '../lib/store'
import type { AccountSummary } from '../lib/access'

/**
 * The gate in front of the portfolio.
 *
 * Everyone has their own account now, which is what lets an edit be attributed
 * and a sign-in be noticed. A brand-new account is made to pick its own password
 * before it can reach anything: the one it was handed was typed by someone else
 * and probably sent over text.
 */
export function SignIn({ onDone }: { onDone: (account: AccountSummary | null) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [mustChange, setMustChange] = useState<AccountSummary | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      })
      const body = await res.json().catch(() => ({}))

      if (res.status === 429) {
        setError('Too many attempts on that account. Try again in fifteen minutes.')
        return
      }
      if (res.status === 403) {
        setError('That account has been turned off. Ask Mr. Shirazi to switch it back on.')
        return
      }
      if (res.status === 401) {
        // Deliberately does not say which of the two was wrong.
        setError('That username and password do not match.')
        return
      }
      if (!res.ok) {
        setError('Could not sign in. Try again in a moment.')
        return
      }

      const account = body.account as AccountSummary | undefined
      activateSharedStore(account?.name ?? null)
      if (account?.mustChangePassword) {
        setMustChange(account)
        return
      }
      onDone(account ?? null)
    } catch {
      setError('Could not reach the server.')
    } finally {
      setBusy(false)
    }
  }

  if (mustChange) {
    return <ChoosePassword account={mustChange} current={password} onDone={onDone} />
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
            <span>Username</span>
            <input
              autoFocus value={username} autoComplete="username" autoCapitalize="none"
              spellCheck={false}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password" value={password} autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        </div>

        {error && (
          <p className="t-red" style={{ fontSize: 13, marginTop: 12, marginBottom: 0 }}>{error}</p>
        )}

        <button className="btn" type="submit" disabled={busy || !username.trim() || !password}
          style={{ marginTop: 16, width: '100%' }}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="t-mute" style={{ fontSize: 12, marginTop: 16 }}>
          Every sign-in is recorded, successful or not. If you have forgotten your password, ask
          Mr. Shirazi to set a new one — nobody, including him, can read the one you had.
        </p>
      </form>
    </div>
  )
}

/**
 * Forced on first use of a handed-out password.
 *
 * The password an owner typed and sent over a text message is known to at least
 * two people and a phone company; it gets the person in once and no further.
 */
function ChoosePassword({
  account, current, onDone,
}: {
  account: AccountSummary
  current: string
  onDone: (account: AccountSummary) => void
}) {
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const tooShort = next.length > 0 && next.length < 10
  const mismatch = again.length > 0 && next !== again
  const ready = next.length >= 10 && next === again && next !== current

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/password', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current, password: next }),
      })
      if (!res.ok) {
        setError('Could not set that password. Try again.')
        return
      }
      onDone({ ...account, mustChangePassword: false })
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
        <h1 className="page-title" style={{ marginTop: 4, marginBottom: 6 }}>
          Welcome, {account.name.split(' ')[0]}
        </h1>
        <p className="page-sub" style={{ marginTop: 0, marginBottom: 22 }}>
          Pick a password only you know. The one you were given was typed by someone else, so it
          stops working now. Ten characters or more.
        </p>

        <div className="stack" style={{ gap: 12 }}>
          <label className="field">
            <span>New password</span>
            <input type="password" autoFocus value={next} autoComplete="new-password"
              onChange={(e) => setNext(e.target.value)} />
          </label>
          <label className="field">
            <span>Type it again</span>
            <input type="password" value={again} autoComplete="new-password"
              onChange={(e) => setAgain(e.target.value)} />
          </label>
        </div>

        {(tooShort || mismatch || error) && (
          <p className="t-red" style={{ fontSize: 13, marginTop: 12, marginBottom: 0 }}>
            {error ?? (tooShort ? 'Ten characters or more, please.' : 'Those two do not match.')}
          </p>
        )}

        <button className="btn" type="submit" disabled={busy || !ready}
          style={{ marginTop: 16, width: '100%' }}>
          {busy ? 'Saving…' : 'Set my password'}
        </button>
      </form>
    </div>
  )
}
