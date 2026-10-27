import { useState } from 'react'
import { setDoc, serverTimestamp } from 'firebase/firestore'
import { useApp } from '../context/AppContext'
import { farmDoc, ref } from '../lib/db'
import { logout, emailToUsername } from '../lib/auth'

// Muncul sekali saja: saat data peternakan belum ada. Akun yang login pertama jadi Owner.
export default function Setup() {
  const { user } = useApp()
  const [nama, setNama] = useState('Peternakan Telur')
  const [namaOwner, setNamaOwner] = useState(emailToUsername(user.email))
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      await setDoc(farmDoc(), {
        nama: nama.trim(),
        ownerEmail: user.email,
        kgPerPeti: 15,
        batasSisaHariPakan: 5,
        createdAt: serverTimestamp(),
      })
      await setDoc(ref('members', user.email), {
        role: 'owner',
        nama: namaOwner.trim() || emailToUsername(user.email),
        aktif: true,
        createdAt: serverTimestamp(),
      })
    } catch (e2) {
      setErr(
        e2.code === 'permission-denied'
          ? 'Ditolak oleh Firestore rules. Pastikan rules dari file firestore.rules sudah dipasang di Firebase Console.'
          : e2.message,
      )
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-logo">🐔</div>
        <h1>Setup awal</h1>
        <p className="muted">
          Data peternakan belum dibuat. Akun <b>{emailToUsername(user.email)}</b> akan menjadi <b>Owner</b>.
          Langkah ini hanya sekali.
        </p>
        <label className="field">
          <span className="field-label">Nama peternakan</span>
          <input value={nama} onChange={(e) => setNama(e.target.value)} required />
        </label>
        <label className="field">
          <span className="field-label">Nama owner (tampilan)</span>
          <input value={namaOwner} onChange={(e) => setNamaOwner(e.target.value)} />
        </label>
        {err && <div className="notice notice-error">{err}</div>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Menyimpan…' : 'Buat peternakan'}
        </button>
        <button type="button" className="btn btn-block" onClick={logout}>
          Keluar
        </button>
      </form>
    </div>
  )
}
