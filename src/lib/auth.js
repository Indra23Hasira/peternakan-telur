import {
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth'
import { auth } from './firebase'

// Login bisa pakai:
//  - username  → dikonversi ke email sintetis <username>@usaha.local (untuk petugas/admin)
//  - email asli (mengandung "@") → dipakai apa adanya, dan bisa reset password lewat email
export const EMAIL_DOMAIN = 'usaha.local'

export const isRealEmail = (s = '') => String(s).includes('@') && !String(s).toLowerCase().endsWith(`@${EMAIL_DOMAIN}`)

export const usernameToEmail = (u) => {
  const v = String(u).trim().toLowerCase()
  return v.includes('@') ? v : `${v}@${EMAIL_DOMAIN}`
}

// Untuk tampilan: email sintetis ditampilkan sebagai username saja, email asli ditampilkan utuh
export const emailToUsername = (e = '') => {
  const v = String(e)
  return v.toLowerCase().endsWith(`@${EMAIL_DOMAIN}`) ? v.split('@')[0] : v
}

export const login = (username, password) =>
  signInWithEmailAndPassword(auth, usernameToEmail(username), password)

export const logout = () => signOut(auth)

export const resetPassword = (email) => sendPasswordResetEmail(auth, email.trim().toLowerCase())

export async function changePassword(currentPassword, newPassword) {
  const user = auth.currentUser
  const cred = EmailAuthProvider.credential(user.email, currentPassword)
  await reauthenticateWithCredential(user, cred)
  await updatePassword(user, newPassword)
}
