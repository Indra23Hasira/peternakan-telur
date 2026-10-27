import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { changePassword, emailToUsername, isRealEmail } from '../lib/auth'
import { ROLE_LABEL } from '../lib/constants'
import { PageHeader, Panel, Field, Notice } from '../components/ui'

const ERR = {
  'auth/invalid-credential': 'Password lama salah.',
  'auth/wrong-password': 'Password lama salah.',
  'auth/weak-password': 'Password baru terlalu lemah (minimal 6 karakter).',
  'auth/too-many-requests': 'Terlalu banyak percobaan. Coba lagi nanti.',
  'auth/network-request-failed': 'Ganti password butuh koneksi internet.',
}

export default function Akun() {
  const { user, member, role } = useApp()
  const [f, setF] = useState({ lama: '', baru: '', ulang: '' })
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setMsg(null)
    if (f.baru.length < 6) return setMsg({ type: 'error', text: 'Password baru minimal 6 karakter.' })
    if (f.baru !== f.ulang) return setMsg({ type: 'error', text: 'Ulangi password baru tidak sama.' })
    if (f.baru === f.lama) return setMsg({ type: 'error', text: 'Password baru harus berbeda dari yang lama.' })
    setBusy(true)
    try {
      await changePassword(f.lama, f.baru)
      setMsg({ type: 'success', text: 'Password berhasil diganti. Pakai password baru saat login berikutnya.' })
      setF({ lama: '', baru: '', ulang: '' })
    } catch (e2) {
      setMsg({ type: 'error', text: ERR[e2.code] || e2.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Akun saya" />
      <Panel title="Info akun">
        <div className="info-row">
          <span>
            Login: <b>{emailToUsername(user.email)}</b>
          </span>
          <span>Nama: {member?.nama || '–'}</span>
          <span>Peran: {ROLE_LABEL[role]}</span>
        </div>
        {!isRealEmail(user.email) && (
          <p className="muted small">
            Akun ini login dengan username (tanpa email asli), jadi kalau lupa password tidak bisa reset lewat email —
            minta owner me-reset. Simpan password baru Anda baik-baik.
          </p>
        )}
      </Panel>
      <Panel title="Ganti password">
        <form className="form-grid" onSubmit={submit}>
          <Field label="Password lama">
            <input type="password" value={f.lama} onChange={(e) => setF({ ...f, lama: e.target.value })} autoComplete="current-password" required />
          </Field>
          <Field label="Password baru" hint="Minimal 6 karakter.">
            <input type="password" value={f.baru} onChange={(e) => setF({ ...f, baru: e.target.value })} autoComplete="new-password" required />
          </Field>
          <Field label="Ulangi password baru">
            <input type="password" value={f.ulang} onChange={(e) => setF({ ...f, ulang: e.target.value })} autoComplete="new-password" required />
          </Field>
          <div className="form-actions">
            <button className="btn btn-primary" disabled={busy}>
              {busy ? 'Menyimpan…' : 'Ganti password'}
            </button>
          </div>
          <Notice msg={msg} />
        </form>
      </Panel>
    </>
  )
}
