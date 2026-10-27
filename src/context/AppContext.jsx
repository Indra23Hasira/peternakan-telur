import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { onSnapshot } from 'firebase/firestore'
import { auth } from '../lib/firebase'
import { farmDoc, ref } from '../lib/db'

const Ctx = createContext(null)

export function AppProvider({ children }) {
  const [user, setUser] = useState(undefined) // undefined = loading, null = belum login
  const [farm, setFarm] = useState(undefined) // null = farm belum dibuat
  const [member, setMember] = useState(undefined) // null = bukan anggota

  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u || null)), [])

  useEffect(() => {
    if (!user) {
      setFarm(undefined)
      setMember(undefined)
      return undefined
    }
    const u1 = onSnapshot(
      farmDoc(),
      (s) => setFarm(s.exists() ? { id: s.id, ...s.data() } : null),
      () => setFarm(null),
    )
    const u2 = onSnapshot(
      ref('members', user.email),
      (s) => setMember(s.exists() ? { id: s.id, ...s.data() } : null),
      () => setMember(null),
    )
    return () => {
      u1()
      u2()
    }
  }, [user])

  const role = member && member.aktif !== false ? member.role : null
  const settings = {
    nama: farm?.nama || 'Peternakan',
    kgPerPeti: Number(farm?.kgPerPeti) || 15,
    batasSisaHariPakan: Number(farm?.batasSisaHariPakan) || 5,
  }

  return (
    <Ctx.Provider
      value={{
        user,
        farm,
        member,
        role,
        settings,
        isOwner: role === 'owner',
        isAdmin: role === 'owner' || role === 'admin',
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

export const useApp = () => useContext(Ctx)
