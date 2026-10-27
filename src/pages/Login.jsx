import { useState } from 'react'
import { login } from '../lib/auth'

const ERR = {
  'auth/invalid-credential': 'Username atau password salah.',
  'auth/wrong-password': 'Username atau password salah.',
  'auth/user-not-found': 'Username tidak terdaftar.',
  'auth/too-many-requests': 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.',
  'auth/network-request-failed': 'Tidak ada koneksi internet.',
  'auth/invalid-email': 'Format username tidak valid.',
}

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      await login(username, password)
    } catch (e2) {
      setErr(ERR[e2.code] || e2.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-logo">🥚</div>
        <h1>Peternakan Telur</h1>
        <p className="muted">Masuk dengan username & password</p>
        <label className="field">
          <span className="field-label">Username</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            required
          />
        </label>
        <label className="field">
          <span className="field-label">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {err && <div className="notice notice-error">{err}</div>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Memproses…' : 'Masuk'}
        </button>
      </form>
    </div>
  )
}
