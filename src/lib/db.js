import {
  collection,
  doc,
  getDoc,
  getDocFromCache,
  writeBatch,
  increment,
  serverTimestamp,
  setDoc,
  deleteDoc,
  updateDoc,
} from 'firebase/firestore'
import { db, auth, FARM_ID } from './firebase'
import { round } from './format'

export const farmDoc = () => doc(db, 'farms', FARM_ID)
export const col = (name) => collection(db, 'farms', FARM_ID, name)
export const ref = (name, id) => doc(db, 'farms', FARM_ID, name, id)

const who = () => auth.currentUser?.email || null

/**
 * Firestore baru me-resolve promise tulis setelah server konfirmasi.
 * Kalau offline, data sudah tersimpan lokal tapi promise-nya menggantung.
 * settle() menunggu sebentar: 'ok' = sudah sampai server, 'pending' = tersimpan di HP, sync nanti.
 */
export function settle(promise, ms = 2500) {
  promise.catch((e) => console.error('[firestore]', e))
  const timeout = new Promise((res) => setTimeout(() => res('pending'), ms))
  return Promise.race([promise.then(() => 'ok'), timeout])
}

export const statusText = (st) =>
  st === 'pending'
    ? 'Tersimpan di perangkat. Akan tersinkron otomatis saat online.'
    : 'Tersimpan.'

/** Simpan dokumen biasa (master data). Tanpa id = dokumen baru. */
export async function saveDoc(name, id, data) {
  const meta = { updatedAt: serverTimestamp(), updatedBy: who() }
  if (id) {
    const status = await settle(setDoc(ref(name, id), { ...data, ...meta }, { merge: true }))
    return { id, status }
  }
  const r = doc(col(name))
  const status = await settle(
    setDoc(r, { ...data, ...meta, createdAt: serverTimestamp(), createdBy: who() }),
  )
  return { id: r.id, status }
}

export async function patchDoc(name, id, data) {
  return settle(updateDoc(ref(name, id), { ...data, updatedAt: serverTimestamp(), updatedBy: who() }))
}

export const removeDoc = (name, id) => settle(deleteDoc(ref(name, id)))

async function readMaybe(r) {
  try {
    const s = await getDoc(r)
    return s.exists() ? s.data() : null
  } catch {
    try {
      const s = await getDocFromCache(r)
      return s.exists() ? s.data() : null
    } catch {
      return null
    }
  }
}

/* ------------------------------------------------------------------
 * Efek stok.
 * Tiap transaksi (produksi, pembelian, penjualan, opname, mutasi telur)
 * punya fungsi "effect" yang menghasilkan perubahan saldo, mis.:
 *   { 'stokTelur/saldo': { utuh: 30.5 }, 'stokBarang/abc': { jumlah: -290 } }
 * Saat simpan/edit/hapus, yang ditulis hanya SELISIH (efek baru − efek lama),
 * pakai increment() dalam satu batch — jadi edit tidak bikin stok dobel,
 * dan tetap jalan offline.
 * ------------------------------------------------------------------ */
function addInto(acc, eff, sign) {
  for (const [path, fields] of Object.entries(eff || {})) {
    acc[path] = acc[path] || {}
    for (const [f, v] of Object.entries(fields)) {
      acc[path][f] = (acc[path][f] || 0) + sign * (Number(v) || 0)
    }
  }
}

function applyDelta(batch, delta) {
  for (const [path, fields] of Object.entries(delta)) {
    const upd = {}
    for (const [f, v] of Object.entries(fields)) {
      const r = round(v)
      if (Math.abs(r) > 0) upd[f] = increment(r)
    }
    if (Object.keys(upd).length) {
      const [c, i] = path.split('/')
      batch.set(ref(c, i), upd, { merge: true })
    }
  }
}

export async function saveWithEffects(name, id, data, effectFn) {
  const r = id ? ref(name, id) : doc(col(name))
  const old = id ? await readMaybe(r) : null
  const delta = {}
  addInto(delta, effectFn(data), 1)
  if (old) addInto(delta, effectFn(old), -1)

  const b = writeBatch(db)
  b.set(r, {
    ...data,
    createdAt: old?.createdAt ?? serverTimestamp(),
    createdBy: old?.createdBy ?? who(),
    updatedAt: serverTimestamp(),
    updatedBy: who(),
  })
  applyDelta(b, delta)
  const status = await settle(b.commit())
  return { id: r.id, status }
}

export async function deleteWithEffects(name, id, effectFn) {
  const r = ref(name, id)
  const old = await readMaybe(r)
  const b = writeBatch(db)
  b.delete(r)
  if (old) {
    const delta = {}
    addInto(delta, effectFn(old), -1)
    applyDelta(b, delta)
  }
  return settle(b.commit())
}
