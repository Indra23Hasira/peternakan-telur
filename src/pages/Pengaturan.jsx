import { useEffect, useState } from 'react'
import { setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { useApp } from '../context/AppContext'
import { useCol } from '../hooks/useFirestore'
import { farmDoc, ref, settle, statusText } from '../lib/db'
import { usernameToEmail, emailToUsername } from '../lib/auth'
import { ROLES, ROLE_LABEL } from '../lib/constants'
import { num } from '../lib/format'
import { PageHeader, Panel, Field, Notice, NumInput, RowActions, Badge, EmptyRow } from '../components/ui'

export default function Pengaturan() {
  const { farm, user } = useApp()
  const [s, setS] = useState({ nama: '', kgPerPeti: '', batasSisaHariPakan: '' })
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    if (farm)
      setS({
        nama: farm.nama || '',
        kgPerPeti: String(farm.kgPerPeti ?? 15),
        batasSisaHariPakan: String(farm.batasSisaHariPakan ?? 5),
      })
  }, [farm?.nama, farm?.kgPerPeti, farm?.batasSisaHariPakan]) // eslint-disable-line

  async function saveSettings(e) {
    e.preventDefault()
    if (num(s.kgPerPeti) <= 0) return setMsg({ type: 'error', text: 'Kg per peti harus lebih dari 0.' })
    const st = await settle(
      setDoc(
        farmDoc(),
        {
          nama: s.nama.trim(),
          kgPerPeti: num(s.kgPerPeti),
          batasSisaHariPakan: num(s.batasSisaHariPakan) || 5,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ),
    )
    setMsg({ type: 'success', text: statusText(st) })
  }

  /* ---------- anggota ---------- */
  const { data: members, loading } = useCol('members')
  const blankM = { username: '', nama: '', role: 'petugas' }
  const [m, setM] = useState(blankM)
  const [editId, setEditId] = useState(null)
  const [mMsg, setMMsg] = useState(null)

  async function saveMember(e) {
    e.preventDefault()
    const uname = m.username.trim().toLowerCase()
    const okUsername = /^[a-z0-9._-]+$/.test(uname)
    const okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(uname)
    if (!okUsername && !okEmail)
      return setMMsg({
        type: 'error',
        text: 'Isi username (huruf kecil, angka, titik, minus, underscore) atau email asli.',
      })
    const id = editId || usernameToEmail(uname)
    if (id === user.email && m.role !== 'owner')
      return setMMsg({ type: 'error', text: 'Tidak bisa menurunkan role akun sendiri.' })
    const existing = members.find((x) => x.id === id)
    const st = await settle(
      setDoc(
        ref('members', id),
        {
          nama: m.nama.trim() || uname,
          role: m.role,
          aktif: existing ? existing.aktif !== false : true,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ),
    )
    setMMsg({
      type: 'success',
      text: `${statusText(st)} Pastikan akun login sudah dibuat di Firebase Console → Authentication dengan email ${id}.`,
    })
    setM(blankM)
    setEditId(null)
  }

  async function toggleAktif(row) {
    if (row.id === user.email) return
    await settle(setDoc(ref('members', row.id), { aktif: row.aktif === false }, { merge: true }))
  }

  const sorted = [...members].sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role))

  return (
    <>
      <PageHeader title="Pengaturan & anggota" />
      <Panel title="Pengaturan peternakan">
        <form className="form-grid" onSubmit={saveSettings}>
          <Field label="Nama peternakan">
            <input value={s.nama} onChange={(e) => setS({ ...s, nama: e.target.value })} />
          </Field>
          <Field label="Kg per peti" hint="Dipakai untuk konversi stok & default berat penjualan per peti.">
            <NumInput value={s.kgPerPeti} onChange={(v) => setS({ ...s, kgPerPeti: v })} />
          </Field>
          <Field label="Batas sisa hari stok pakan" hint="Muncul peringatan kalau stok pakan cukup untuk kurang dari ini.">
            <NumInput value={s.batasSisaHariPakan} onChange={(v) => setS({ ...s, batasSisaHariPakan: v })} />
          </Field>
          <div className="form-actions">
            <button className="btn btn-primary">Simpan pengaturan</button>
          </div>
          <Notice msg={msg} />
        </form>
      </Panel>

      <Panel title="Anggota & hak akses">
        <p className="muted small">
          Langkah menambah orang: (1) buat akun di Firebase Console → Authentication → Add user, email{' '}
          <code>username@usaha.local</code> (atau email asli) + password awal; (2) daftarkan username/email yang sama di
          sini beserta perannya; (3) minta orangnya ganti password di menu Akun & password. Kalau ada yang lupa password:
          hapus user-nya di Console lalu Add user lagi dengan email yang sama — peran & data tetap aman.
        </p>
        <form className="form-grid" onSubmit={saveMember}>
          <Field label="Username / email *">
            <input
              value={m.username}
              disabled={!!editId}
              onChange={(e) => setM({ ...m, username: e.target.value })}
              autoCapitalize="none"
              required
            />
          </Field>
          <Field label="Nama tampilan">
            <input value={m.nama} onChange={(e) => setM({ ...m, nama: e.target.value })} />
          </Field>
          <Field label="Peran *">
            <select value={m.role} onChange={(e) => setM({ ...m, role: e.target.value })}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </Field>
          <div className="form-actions">
            <button className="btn btn-primary">{editId ? 'Simpan perubahan' : 'Tambah anggota'}</button>
            {editId && (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setEditId(null)
                  setM(blankM)
                }}
              >
                Batal
              </button>
            )}
          </div>
          <Notice msg={mMsg} />
        </form>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Nama</th>
                <th>Peran</th>
                <th>Status</th>
                <th className="col-actions" />
              </tr>
            </thead>
            <tbody>
              {loading && <EmptyRow cols={5} text="Memuat…" />}
              {sorted.map((r) => (
                <tr key={r.id} className={editId === r.id ? 'row-editing' : ''}>
                  <td>{emailToUsername(r.id)}</td>
                  <td>{r.nama}</td>
                  <td>{ROLE_LABEL[r.role] || r.role}</td>
                  <td>
                    <button
                      className="link-btn"
                      onClick={() => toggleAktif(r)}
                      disabled={r.id === user.email}
                      title="Klik untuk aktif/nonaktifkan"
                    >
                      {r.aktif === false ? <Badge tone="gray">Nonaktif</Badge> : <Badge tone="green">Aktif</Badge>}
                    </button>
                  </td>
                  <td className="col-actions">
                    <RowActions
                      onEdit={() => {
                        setEditId(r.id)
                        setM({ username: emailToUsername(r.id), nama: r.nama || '', role: r.role })
                      }}
                      onDelete={r.id === user.email ? null : () => settle(deleteDoc(ref('members', r.id)))}
                      confirmText="Hapus anggota ini? Akun login-nya tetap ada di Firebase, tapi tidak bisa mengakses data."
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
