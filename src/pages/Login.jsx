import { useState } from 'react'
import { login, resetPassword, isRealEmail } from '../lib/auth'

const ERR = {
  'auth/invalid-credential': 'Username/email atau password salah.',
  'auth/wrong-password': 'Username/email atau password salah.',
  'auth/user-not-found': 'Akun tidak terdaftar.',
  'auth/too-many-requests': 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.',
  'auth/network-request-failed': 'Tidak ada koneksi internet.',
  'auth/invalid-email': 'Format username/email tidak valid.',
}

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setMsg(null)
    setBusy(true)
    try {
      await login(username, password)
    } catch (e2) {
      setMsg({ type: 'error', text: ERR[e2.code] || e2.message })
    } finally {
      setBusy(false)
    }
  }

  async function lupa() {
    setMsg(null)
    if (!isRealEmail(username)) {
      setMsg({
        type: 'info',
        text: username.trim()
          ? 'Akun username tidak punya email asli. Minta owner me-reset password Anda.'
          : 'Ketik dulu email Anda di kolom atas. Akun username (tanpa email) di-reset oleh owner.',
      })
      return
    }
    try {
      await resetPassword(username)
      setMsg({ type: 'success', text: `Link reset password dikirim ke ${username.trim()}. Cek inbox/spam.` })
    } catch (e2) {
      setMsg({ type: 'error', text: ERR[e2.code] || e2.message })
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-logo">🥚</div>
        <h1>Peternakan Telur</h1>
        <p className="muted">Masuk dengan username atau email</p>
        <label className="field">
          <span className="field-label">Username / email</span>
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
        {msg && <div className={`notice notice-${msg.type}`}>{msg.text}</div>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Memproses…' : 'Masuk'}
        </button>
        <button type="button" className="link-btn auth-link" onClick={lupa}>
          Lupa password?
        </button>
      </form>
    </div>
  )
}
