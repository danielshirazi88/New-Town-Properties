import { useCallback, useEffect, useState } from 'react'
import { Card, Empty, Kpi } from '../components/ui'
import { num } from '../lib/format'
import {
  DEFAULT_STAFF_SECTIONS, SECTIONS, canReach,
  type AccountSummary, type Role, type SectionId,
} from '../lib/access'

interface SignIn {
  id: string
  userId: string | null
  username: string
  name: string | null
  outcome: string
  at: string
  ip: string | null
  userAgent: string | null
}

const OUTCOME: Record<string, { label: string; cls: string }> = {
  ok: { label: 'Signed in', cls: 'paid' },
  wrong_password: { label: 'Wrong password', cls: 'critical' },
  unknown_user: { label: 'No such username', cls: 'critical' },
  disabled: { label: 'Account turned off', cls: 'warn' },
  locked_out: { label: 'Locked out', cls: 'critical' },
}

const when = (iso: string): string => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

const ago = (iso?: string | null): string => {
  if (!iso) return 'never'
  const ms = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(ms)) return '—'
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`
  const days = Math.floor(hrs / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

/** A password nobody has to invent, and nobody will reuse from another site. */
const suggestPassword = (): string => {
  const bytes = new Uint8Array(9)
  crypto.getRandomValues(bytes)
  const chunk = [...bytes].map((b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('')
  return `${chunk.slice(0, 4)}-${chunk.slice(4, 8)}-${chunk.slice(8, 12)}`
}

/**
 * Who can get in, what they can reach, and every attempt to sign in.
 *
 * Owner-only, and enforced on the server rather than by hiding this tab.
 */
export function Team({ me }: { me: AccountSummary }) {
  const [accounts, setAccounts] = useState<AccountSummary[] | null>(null)
  const [signIns, setSignIns] = useState<SignIn[]>([])
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<AccountSummary | null>(null)

  const load = useCallback(async () => {
    try {
      const [a, s] = await Promise.all([
        fetch('/api/accounts', { credentials: 'same-origin' }).then((r) => r.json()),
        fetch('/api/sign-ins?limit=200', { credentials: 'same-origin' }).then((r) => r.json()),
      ])
      setAccounts(a.accounts ?? [])
      setSignIns(s.signIns ?? [])
      setError(null)
    } catch {
      setError('Could not reach the server.')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const failures = signIns.filter((s) => s.outcome !== 'ok')
  const recentFailures = failures.filter((s) => Date.now() - new Date(s.at).getTime() < 7 * 864e5)
  const lastByUser = new Map<string, string>()
  for (const s of signIns) {
    if (s.outcome === 'ok' && s.userId && !lastByUser.has(s.userId)) lastByUser.set(s.userId, s.at)
  }

  return (
    <div className="stack">
      <div className="page-head">
        <h1 className="page-title">People &amp; access</h1>
        <p className="page-sub">
          Everyone signs in as themselves, so an edit can be attributed and a sign-in can be
          noticed. What each person can reach is set here and enforced by the server — hiding a
          tab would only be manners, not security.
        </p>
      </div>

      {error && <div className="callout"><div className="callout-title">{error}</div></div>}

      <div className="kpi-grid">
        <Kpi accent label="People with access" value={num((accounts ?? []).filter((a) => a.active).length)}
          note={`${num((accounts ?? []).filter((a) => !a.active).length)} turned off`} />
        <Kpi label="Sign-ins recorded" value={num(signIns.filter((s) => s.outcome === 'ok').length)}
          note="Most recent 200 attempts" />
        <Kpi label="Refused attempts" value={num(failures.length)}
          note={recentFailures.length
            ? `${num(recentFailures.length)} in the last week`
            : 'None in the last week'}
          warn={recentFailures.length > 0} />
      </div>

      <Card
        title="Who can get in"
        actions={<button className="btn sm" onClick={() => setAdding(true)}>Add someone</button>}
      >
        {accounts === null ? <Empty>Loading…</Empty> : accounts.length === 0 ? (
          <Empty>No accounts yet.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th><th>Username</th><th>Role</th><th>Can reach</th>
                  <th>Last signed in</th><th>Status</th><th />
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id}>
                    <td className="t-strong">
                      {a.name}
                      {a.id === me.id && <span className="t-mute" style={{ fontSize: 11 }}> — you</span>}
                    </td>
                    <td className="t-mono t-mute">{a.username}</td>
                    <td>
                      <span className={`badge ${a.role === 'owner' ? 'ok' : 'mute'}`}>
                        {a.role === 'owner' ? 'Owner' : 'Staff'}
                      </span>
                    </td>
                    <td className="t-mute" style={{ fontSize: 12, maxWidth: 300 }}>
                      {a.role === 'owner'
                        ? 'Everything'
                        : a.sections.length === 0
                          ? <span className="t-red">Nothing yet</span>
                          : SECTIONS.filter((s) => a.sections.includes(s.id))
                            .map((s) => s.label).join(' · ')}
                    </td>
                    <td className="t-mute" style={{ fontSize: 12 }}>
                      {ago(lastByUser.get(a.id) ?? a.lastSeenAt)}
                    </td>
                    <td>
                      {!a.active ? <span className="badge critical">Turned off</span>
                        : a.mustChangePassword ? <span className="badge warn">Password not set</span>
                        : <span className="badge paid">Active</span>}
                    </td>
                    <td>
                      <button className="btn ghost sm" onClick={() => setEditing(a)}>Manage</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Sign-in history" hint="every attempt, successful or not">
        {signIns.length === 0 ? <Empty>Nothing recorded yet.</Empty> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>When</th><th>Who</th><th>Outcome</th><th>From</th><th>Device</th>
                </tr>
              </thead>
              <tbody>
                {signIns.slice(0, 60).map((s) => {
                  const o = OUTCOME[s.outcome] ?? { label: s.outcome, cls: 'mute' }
                  return (
                    <tr key={s.id}>
                      <td className="t-mono t-nowrap" style={{ fontSize: 12 }}>{when(s.at)}</td>
                      <td>
                        <span className="t-strong">{s.name ?? s.username ?? 'unknown'}</span>
                        {s.name && <span className="t-mute" style={{ fontSize: 11 }}> · {s.username}</span>}
                      </td>
                      <td><span className={`badge ${o.cls}`}>{o.label}</span></td>
                      <td className="t-mono t-mute" style={{ fontSize: 11.5 }}>{s.ip ?? '—'}</td>
                      <td className="t-mute" style={{ fontSize: 11, maxWidth: 280 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.userAgent ?? '—'}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="t-mute" style={{ fontSize: 12, marginTop: 8 }}>
          A run of refused attempts against one username is worth looking at. After{' '}
          {num(8)} failures in a quarter of an hour that account stops accepting passwords until
          the quarter-hour is out, whether or not the next one would have been right.
        </p>
      </Card>

      {(adding || editing) && (
        <AccountForm
          account={editing}
          me={me}
          onClose={() => { setAdding(false); setEditing(null) }}
          onSaved={() => { setAdding(false); setEditing(null); void load() }}
        />
      )}
    </div>
  )
}

function AccountForm({
  account, me, onClose, onSaved,
}: {
  account: AccountSummary | null
  me: AccountSummary
  onClose: () => void
  onSaved: () => void
}) {
  const isNew = account === null
  const [name, setName] = useState(account?.name ?? '')
  const [username, setUsername] = useState(account?.username ?? '')
  const [role, setRole] = useState<Role>(account?.role ?? 'staff')
  const [sections, setSections] = useState<SectionId[]>(
    account?.sections ?? DEFAULT_STAFF_SECTIONS,
  )
  const [active, setActive] = useState(account?.active ?? true)
  const [password, setPassword] = useState(isNew ? suggestPassword() : '')
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const toggle = (id: SectionId) =>
    setSections((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))

  const call = async (url: string, method: string, body: unknown) => {
    const res = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const b = await res.json().catch(() => ({}))
      throw new Error({
        username_taken: 'That username is already in use.',
        too_short: 'The password needs ten characters or more.',
        last_owner: 'There has to be at least one active owner.',
        cannot_remove_self: 'You cannot remove your own account.',
        name_and_username_required: 'A name and a username are both needed.',
      }[b.error as string] ?? 'Could not save that.')
    }
    return res.json()
  }

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      if (isNew) {
        await call('/api/accounts', 'POST', { name, username, password, role, sections })
      } else {
        await call(`/api/accounts/${account.id}`, 'PATCH', { name, role, sections, active })
        if (resetting && password) {
          await call(`/api/accounts/${account.id}/password`, 'POST', { password })
        }
      }
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    setError(null)
    try {
      await call(`/api/accounts/${account!.id}`, 'DELETE', {})
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove that account.')
    } finally {
      setBusy(false)
    }
  }

  const showPassword = isNew || resetting

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{isNew ? 'Add someone' : `Manage ${account.name}`}</h3>
          <button className="btn ghost sm" onClick={onClose}>Close</button>
        </div>

        <div className="form-grid">
          <label className="field">
            <span>Name</span>
            <input value={name} autoFocus={isNew} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            <span>Username{!isNew && <em className="field-hint"> cannot be changed</em>}</span>
            <input value={username} disabled={!isNew} autoCapitalize="none" spellCheck={false}
              onChange={(e) => setUsername(e.target.value.toLowerCase())} />
          </label>
          <label className="field">
            <span>Role</span>
            <select value={role} onChange={(e) => setRole(e.target.value as Role)}
              disabled={!isNew && account.id === me.id}>
              <option value="staff">Staff — reaches only what is ticked below</option>
              <option value="owner">Owner — reaches everything, including this screen</option>
            </select>
          </label>
          {!isNew && (
            <label className="field">
              <span>Status</span>
              <select value={active ? 'on' : 'off'} onChange={(e) => setActive(e.target.value === 'on')}
                disabled={account.id === me.id}>
                <option value="on">Active</option>
                <option value="off">Turned off — cannot sign in</option>
              </select>
            </label>
          )}
        </div>

        {role === 'staff' && (
          <div style={{ marginTop: 16 }}>
            <div className="section-title" style={{ marginBottom: 8 }}>
              What they can reach
              <span className="hint">{sections.length} of {SECTIONS.length - 1}</span>
            </div>
            <div className="stack" style={{ gap: 6 }}>
              {SECTIONS.filter((s) => !s.ownerOnly).map((s) => (
                <label key={s.id} className="access-row">
                  <input type="checkbox" checked={sections.includes(s.id)} onChange={() => toggle(s.id)} />
                  <span>
                    <span className="t-strong">{s.label}</span>
                    <span className="t-mute" style={{ display: 'block', fontSize: 11.5 }}>{s.detail}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {role === 'owner' && (
          <div className="callout" style={{ marginTop: 16 }}>
            <div className="callout-title">An owner reaches everything</div>
            <p>
              That includes the trust schedule, the tax returns, what the estate is worth, and this
              screen — so they can add and remove people too. Give it only to someone who should
              have all of it.
            </p>
          </div>
        )}

        {!isNew && !resetting && (
          <button className="btn ghost sm" style={{ marginTop: 16 }}
            onClick={() => { setResetting(true); setPassword(suggestPassword()) }}>
            Set a new password for {account.name.split(' ')[0]}
          </button>
        )}

        {showPassword && (
          <div className="callout" style={{ marginTop: 16 }}>
            <div className="callout-title">
              {isNew ? 'The password to give them' : 'Their new password'}
            </div>
            <div className="row" style={{ gap: 8, marginTop: 8, alignItems: 'center' }}>
              <input className="t-mono" value={password} style={{ flex: 1, fontSize: 15 }}
                onChange={(e) => setPassword(e.target.value)} />
              <button className="btn ghost sm" onClick={() => {
                void navigator.clipboard?.writeText(password)
                setCopied(true)
                window.setTimeout(() => setCopied(false), 1500)
              }}>{copied ? 'Copied' : 'Copy'}</button>
              <button className="btn ghost sm" onClick={() => setPassword(suggestPassword())}>
                Another
              </button>
            </div>
            <p style={{ marginTop: 8 }}>
              Write this down or copy it now — it is not stored anywhere readable, so this is the
              only time it can be seen. They will be made to choose their own the first time they
              sign in, which is what stops the one you text them from being the one that lasts.
            </p>
          </div>
        )}

        {error && <p className="t-red" style={{ fontSize: 13, marginTop: 12 }}>{error}</p>}

        <div className="row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          {!isNew && account.id !== me.id && (
            <button className="btn ghost" onClick={remove} disabled={busy}
              style={{ marginRight: 'auto', color: 'var(--red)' }}>
              Remove entirely
            </button>
          )}
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={save}
            disabled={busy || !name.trim() || (isNew && (!username.trim() || password.length < 10))}>
            {busy ? 'Saving…' : isNew ? 'Create account' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

export { canReach }
