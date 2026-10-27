import { useEffect, useState } from 'react'
import { onSnapshot, query, where } from 'firebase/firestore'
import { col, ref } from '../lib/db'

/**
 * Langganan realtime ke satu koleksi farm.
 * wheres: [['tanggal', '>=', '2026-10-01'], ...] — hanya pakai filter 1 field
 * (range/equality) supaya tidak butuh composite index; sorting dilakukan di client.
 */
export function useCol(name, { wheres = [], enabled = true } = {}) {
  const key = JSON.stringify([name, wheres, enabled])
  const [state, setState] = useState({ data: [], loading: true, error: null })

  useEffect(() => {
    if (!enabled) {
      setState({ data: [], loading: false, error: null })
      return undefined
    }
    setState((s) => ({ ...s, loading: true }))
    const q = query(col(name), ...wheres.map((w) => where(...w)))
    return onSnapshot(
      q,
      (snap) =>
        setState({ data: snap.docs.map((d) => ({ id: d.id, ...d.data() })), loading: false, error: null }),
      (error) => {
        console.error(`[useCol ${name}]`, error)
        setState({ data: [], loading: false, error })
      },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return state
}

export function useDocData(name, id) {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  useEffect(() => {
    if (!id) {
      setState({ data: null, loading: false, error: null })
      return undefined
    }
    return onSnapshot(
      ref(name, id),
      (s) => setState({ data: s.exists() ? { id: s.id, ...s.data() } : null, loading: false, error: null }),
      (error) => setState({ data: null, loading: false, error }),
    )
  }, [name, id])
  return state
}
