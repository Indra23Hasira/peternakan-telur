import { useApp } from '../context/AppContext'
import { logout, emailToUsername } from '../lib/auth'

export default function NoAccess() {
  const { user, member } = useApp()
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">🔒</div>
        <h1>Belum ada akses</h1>
        <p className="muted">
          {member && member.aktif === false
            ? 'Akun ini sedang dinonaktifkan oleh owner.'
            : 'Akun ini belum terdaftar sebagai anggota peternakan.'}{' '}
          Minta owner menambahkan username <b>{emailToUsername(user.email)}</b> di menu Pengaturan & anggota.
        </p>
        <button className="btn btn-block" onClick={logout}>
          Keluar
        </button>
      </div>
    </div>
  )
}
