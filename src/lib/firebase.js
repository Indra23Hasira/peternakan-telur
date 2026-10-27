import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyCZ5Y9cln6JX3kB4wgQZj7M1zO2sHyNmv8',
  authDomain: 'jastip-9cc2a.firebaseapp.com',
  projectId: 'jastip-9cc2a',
  storageBucket: 'jastip-9cc2a.firebasestorage.app',
  messagingSenderId: '805417777650',
  appId: '1:805417777650:web:4ddd3d2fd194920b73936b',
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)

// Offline persistence: form harian tetap bisa diisi saat sinyal kandang jelek,
// data tersimpan di HP dan otomatis tersinkron saat online lagi.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})

// Satu peternakan per aplikasi. Kalau nanti punya farm kedua, cukup ganti/parametrisasi ini.
export const FARM_ID = 'utama'
