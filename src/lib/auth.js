import { signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { auth } from './firebase'

// Login pakai username; di belakang layar dikonversi ke email sintetis.
// Waktu bikin user di Firebase Console, isi Email: <username>@usaha.local
export const EMAIL_DOMAIN = 'usaha.local'

export const usernameToEmail = (u) => `${String(u).trim().toLowerCase()}@${EMAIL_DOMAIN}`
export const emailToUsername = (e = '') => String(e).split('@')[0]

export const login = (username, password) =>
  signInWithEmailAndPassword(auth, usernameToEmail(username), password)

export const logout = () => signOut(auth)
