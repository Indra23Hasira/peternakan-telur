import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { logout, emailToUsername } from '../lib/auth'
import { ROLE_LABEL } from '../lib/constants'

const ALL = ['owner', 'admin', 'petugas']
const ADM = ['owner', 'admin']

export const NAV = [
  { section: 'Ringkasan' },
  { to: '/', label: 'Dashboard', roles: ADM, end: true },
  { section: 'Kandang' },
  { to: '/harian', label: 'Input harian', roles: ALL },
  { to: '/produksi', label: 'Riwayat produksi', roles: ALL },
  { to: '/kandang', label: 'Kandang & batch', roles: ADM },
  { section: 'Penjualan' },
  { to: '/penjualan', label: 'Penjualan & piutang', roles: ADM },
  { to: '/pengiriman', label: 'Pengiriman', roles: ADM },
  { to: '/pelanggan', label: 'Pelanggan', roles: ADM },
  { to: '/harga', label: 'Harga jual', roles: ADM },
  { to: '/gudang-telur', label: 'Gudang telur', roles: ADM },
  { section: 'Pembelian' },
  { to: '/pembelian', label: 'Pembelian & hutang', roles: ADM },
  { to: '/stok', label: 'Stok barang', roles: ADM },
  { to: '/barang', label: 'Barang & supplier', roles: ADM },
  { section: 'Keuangan' },
  { to: '/kas', label: 'Kas operasional', roles: ADM },
  { section: 'Sistem' },
  { to: '/pengaturan', label: 'Pengaturan & anggota', roles: ['owner'] },
  { to: '/akun', label: 'Akun & password', roles: ALL },
]

export default function Layout({ children }) {
  const { user, role, settings, member } = useApp()
  const [open, setOpen] = useState(false)

  // buang judul section yang tidak punya menu untuk role ini
  const items = []
  for (const it of NAV) {
    if (it.section) items.push(it)
    else if (it.roles.includes(role)) items.push(it)
  }
  const nav = items.filter((it, i) => !it.section || (items[i + 1] && !items[i + 1].section))

  return (
    <div className="app">
      <header className="topbar">
        <button className="menu-btn" onClick={() => setOpen((o) => !o)} aria-label="Menu">
          ☰
        </button>
        <div className="brand">🥚 {settings.nama}</div>
        <div className="user-box">
          <span className="user-name">{member?.nama || emailToUsername(user?.email)}</span>
          <span className={`badge badge-role-${role}`}>{ROLE_LABEL[role]}</span>
        </div>
      </header>
      <div className="body">
        <nav className={`sidebar ${open ? 'open' : ''}`} onClick={() => setOpen(false)}>
          {nav.map((it, i) =>
            it.section ? (
              <div key={`s${i}`} className="nav-section">
                {it.section}
              </div>
            ) : (
              <NavLink key={it.to} to={it.to} end={it.end} className="nav-link">
                {it.label}
              </NavLink>
            ),
          )}
          <button className="nav-link nav-logout" onClick={logout}>
            Keluar
          </button>
        </nav>
        {open && <div className="backdrop" onClick={() => setOpen(false)} />}
        <main className="content">{children}</main>
      </div>
    </div>
  )
}
