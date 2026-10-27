import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { useCol } from '../hooks/useFirestore'
import { saveWithEffects, statusText } from '../lib/db'
import { produksiEffect } from '../lib/effects'
import { GRADES, GRADE_LABEL } from '../lib/constants'
import { umurMinggu, populasiKini, hdp } from '../lib/calc'
import { today } from '../lib/dates'
import { num, fmtNum, fmtPct, fmtKg, byNama } from '../lib/format'
import { PageHeader, Panel, Field, Notice, NumInput } from '../components/ui'

const blankForm = (pakanId = '') => ({
  butir: Object.fromEntries(GRADES.map((g) => [g, ''])),
  kg: Object.fromEntries(GRADES.map((g) => [g, ''])),
  pakanBarangId: pakanId,
  pakanKg: '',
  mati: '',
  afkir: '',
  catatan: '',
})

export default function InputHarian() {
  const { user } = useApp()
  const [params] = useSearchParams()
  const [tanggal, setTanggal] = useState(params.get('tanggal') || today())
  const [kandangId, setKandangId] = useState('')
  const [blokId, setBlokId] = useState(params.get('blok') || '')

  const { data: kandang } = useCol('kandang')
  const { data: blok } = useCol('blok')
  const { data: batch } = useCol('batch')
  const { data: barang } = useCol('barang')
  const { data: stok } = useCol('stokBarang')
  const { data: prodHari } = useCol('produksiHarian', { wheres: [['tanggal', '==', tanggal]] })

  const kandangSorted = [...kandang].sort(byNama)
  const pakanList = barang.filter((b) => b.kategori === 'pakan').sort(byNama)

  // kandang default: dari blok di URL, atau kandang pertama
  useEffect(() => {
    if (kandangId) return
    const fromBlok = blok.find((b) => b.id === blokId)?.kandangId
    if (fromBlok) setKandangId(fromBlok)
    else if (kandangSorted[0]) setKandangId(kandangSorted[0].id)
  }, [kandang.length, blok.length]) // eslint-disable-line

  const blokKandang = blok.filter((b) => b.kandangId === kandangId).sort(byNama)
  const batchOf = (bid) => batch.find((x) => x.status !== 'afkir' && (x.blokIds || []).includes(bid))
  const curBatch = batchOf(blokId)
  const existing = prodHari.find((p) => p.blokId === blokId)

  const [form, setForm] = useState(blankForm())
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  // isi ulang form saat ganti tanggal/blok, atau saat data lama ditemukan
  const loadKey = `${tanggal}_${blokId}_${existing ? 'ada' : `baru${pakanList.length}`}_${curBatch?.id || ''}`
  useEffect(() => {
    if (existing) {
      setForm({
        butir: Object.fromEntries(GRADES.map((g) => [g, existing.butir?.[g] ? String(existing.butir[g]) : ''])),
        kg: Object.fromEntries(GRADES.map((g) => [g, existing.kg?.[g] ? String(existing.kg[g]) : ''])),
        pakanBarangId: existing.pakanBarangId || '',
        pakanKg: existing.pakanKg ? String(existing.pakanKg) : '',
        mati: existing.mati ? String(existing.mati) : '',
        afkir: existing.afkir ? String(existing.afkir) : '',
        catatan: existing.catatan || '',
      })
    } else {
      setForm(blankForm(curBatch?.jenisPakanId || (pakanList.length === 1 ? pakanList[0].id : '')))
    }
    setMsg(null)
  }, [loadKey]) // eslint-disable-line

  const setG = (k, g, v) => setForm((f) => ({ ...f, [k]: { ...f[k], [g]: v } }))
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const totButir = GRADES.reduce((s, g) => s + num(form.butir[g]), 0)
  const totKg = GRADES.reduce((s, g) => s + num(form.kg[g]), 0)
  // populasi sebelum deplesi hari ini
  const popAwal = curBatch
    ? populasiKini(curBatch) + (existing && existing.batchId === curBatch.id ? num(existing.mati) + num(existing.afkir) : 0)
    : 0
  // HDP batch: gabungkan blok lain dari batch yang sama di hari yang sama
  const butirBlokLain = useMemo(
    () =>
      prodHari
        .filter((p) => p.batchId === curBatch?.id && p.blokId !== blokId)
        .reduce((s, p) => s + GRADES.reduce((a, g) => a + num(p.butir?.[g]), 0), 0),
    [prodHari, curBatch?.id, blokId],
  )
  const hdpPreview = curBatch ? hdp(totButir + butirBlokLain, popAwal) : null
  const stokPakan = stok.find((s) => s.id === form.pakanBarangId)?.jumlah
  const gramPerEkor = popAwal > 0 ? (num(form.pakanKg) / popAwal) * 1000 : null

  async function submit(e) {
    e.preventDefault()
    setMsg(null)
    if (!blokId) return setMsg({ type: 'error', text: 'Pilih blok dulu.' })
    if (!curBatch) return setMsg({ type: 'error', text: 'Blok ini belum punya batch aktif. Minta admin mengatur di menu Kandang & batch.' })
    if (num(form.pakanKg) > 0 && !form.pakanBarangId) return setMsg({ type: 'error', text: 'Pilih jenis pakan.' })
    for (const g of GRADES) {
      if (num(form.butir[g]) > 0 && num(form.kg[g]) <= 0)
        return setMsg({ type: 'error', text: `Isi berat (kg) telur ${GRADE_LABEL[g].toLowerCase()}.` })
    }
    if (num(form.mati) + num(form.afkir) > popAwal)
      return setMsg({ type: 'error', text: 'Jumlah mati + afkir melebihi populasi batch.' })

    const data = {
      tanggal,
      kandangId,
      blokId,
      batchId: curBatch.id,
      butir: Object.fromEntries(GRADES.map((g) => [g, num(form.butir[g])])),
      kg: Object.fromEntries(GRADES.map((g) => [g, num(form.kg[g])])),
      pakanBarangId: num(form.pakanKg) > 0 ? form.pakanBarangId : '',
      pakanKg: num(form.pakanKg),
      mati: num(form.mati),
      afkir: num(form.afkir),
      catatan: form.catatan.trim(),
      petugas: user.email,
    }
    setBusy(true)
    try {
      const { status } = await saveWithEffects('produksiHarian', `${tanggal}_${blokId}`, data, produksiEffect)
      setMsg({ type: 'success', text: statusText(status) })
      // lompat ke blok berikutnya yang belum diisi
      const next = blokKandang.find((b) => b.id !== blokId && !prodHari.some((p) => p.blokId === b.id))
      if (next) setTimeout(() => setBlokId(next.id), 900)
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Input harian kandang" subtitle="Satu form per blok per hari. Bisa diedit lagi kapan saja." />

      <Panel>
        <div className="form-grid">
          <Field label="Tanggal">
            <input type="date" value={tanggal} max={today()} onChange={(e) => setTanggal(e.target.value)} />
          </Field>
          <Field label="Kandang">
            <select
              value={kandangId}
              onChange={(e) => {
                setKandangId(e.target.value)
                setBlokId('')
              }}
            >
              {!kandangSorted.length && <option value="">Belum ada kandang</option>}
              {kandangSorted.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nama}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="blok-chips">
          {blokKandang.map((b) => {
            const done = prodHari.some((p) => p.blokId === b.id)
            const bt = batchOf(b.id)
            return (
              <button
                key={b.id}
                type="button"
                className={`blok-chip ${b.id === blokId ? 'active' : ''} ${done ? 'done' : ''}`}
                onClick={() => setBlokId(b.id)}
              >
                {done ? '✓ ' : ''}
                {b.nama}
                <small>{bt ? bt.nama : 'kosong'}</small>
              </button>
            )
          })}
          {kandangId && !blokKandang.length && (
            <span className="muted">Kandang ini belum punya blok.</span>
          )}
        </div>
      </Panel>

      {blokId && (
        <form onSubmit={submit}>
          <Panel
            title={`${blok.find((b) => b.id === blokId)?.nama || ''} ${existing ? '· edit data tersimpan' : ''}`}
          >
            {curBatch ? (
              <div className="info-row">
                <span>
                  Batch <b>{curBatch.nama}</b>
                </span>
                <span>Umur {fmtNum(umurMinggu(curBatch, tanggal), 1)} minggu</span>
                <span>Populasi {fmtNum(popAwal)} ekor</span>
                <span>
                  HDP batch hari ini <b>{fmtPct(hdpPreview)}</b>
                </span>
              </div>
            ) : (
              <div className="notice notice-error">Blok ini belum punya batch aktif.</div>
            )}

            <h3 className="sub-title">Produksi telur</h3>
            <div className="grade-grid">
              <div className="grade-head" />
              <div className="grade-head">Butir</div>
              <div className="grade-head">Kg</div>
              {GRADES.map((g) => (
                <div className="grade-row" key={g}>
                  <div className="grade-name">{GRADE_LABEL[g]}</div>
                  <NumInput value={form.butir[g]} onChange={(v) => setG('butir', g, v)} placeholder="0" />
                  <NumInput value={form.kg[g]} onChange={(v) => setG('kg', g, v)} placeholder="0" />
                </div>
              ))}
              <div className="grade-row grade-total">
                <div className="grade-name">Total</div>
                <div>{fmtNum(totButir)} butir</div>
                <div>{fmtKg(totKg)}</div>
              </div>
            </div>
            <p className="muted small">Timbangan di-nol-kan dengan peti di atasnya, jadi isi berat bersih telur.</p>

            <h3 className="sub-title">Pakan & deplesi</h3>
            <div className="form-grid">
              <Field
                label="Jenis pakan"
                hint={stokPakan !== undefined ? `Sisa stok gudang: ${fmtKg(stokPakan)}` : null}
              >
                <select value={form.pakanBarangId} onChange={(e) => set('pakanBarangId', e.target.value)}>
                  <option value="">— pilih —</option>
                  {pakanList.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.nama}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Pakan terpakai (kg)" hint={gramPerEkor ? `≈ ${fmtNum(gramPerEkor)} g/ekor` : null}>
                <NumInput value={form.pakanKg} onChange={(v) => set('pakanKg', v)} placeholder="0" />
              </Field>
              <Field label="Ayam mati (ekor)">
                <NumInput value={form.mati} onChange={(v) => set('mati', v)} placeholder="0" />
              </Field>
              <Field label="Ayam afkir (ekor)">
                <NumInput value={form.afkir} onChange={(v) => set('afkir', v)} placeholder="0" />
              </Field>
              <Field label="Catatan kesehatan" wide>
                <textarea
                  rows={2}
                  value={form.catatan}
                  onChange={(e) => set('catatan', e.target.value)}
                  placeholder="Gejala, obat/vitamin yang diberikan, kejadian lain…"
                />
              </Field>
            </div>
            <div className="form-actions sticky-actions">
              <button className="btn btn-primary btn-lg" disabled={busy || !curBatch}>
                {busy ? 'Menyimpan…' : existing ? 'Simpan perubahan' : 'Simpan'}
              </button>
              <Link to="/produksi" className="btn">
                Riwayat
              </Link>
            </div>
            <Notice msg={msg} />
          </Panel>
        </form>
      )}
    </>
  )
}
