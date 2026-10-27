import { Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import Layout from './components/Layout'
import { Loading } from './components/ui'
import Login from './pages/Login'
import Setup from './pages/Setup'
import NoAccess from './pages/NoAccess'
import Dashboard from './pages/Dashboard'
import InputHarian from './pages/InputHarian'
import Produksi from './pages/Produksi'
import KandangBatch from './pages/KandangBatch'
import Barang from './pages/Barang'
import Pembelian from './pages/Pembelian'
import StokBarang from './pages/StokBarang'
import GudangTelur from './pages/GudangTelur'
import HargaJual from './pages/HargaJual'
import Pelanggan from './pages/Pelanggan'
import Penjualan from './pages/Penjualan'
import PenjualanDetail from './pages/PenjualanDetail'
import Pengiriman from './pages/Pengiriman'
import TripDetail from './pages/TripDetail'
import Kas from './pages/Kas'
import Pengaturan from './pages/Pengaturan'

const ADM = ['owner', 'admin']

function Guard({ roles, children }) {
  const { role } = useApp()
  if (!roles.includes(role)) return <Navigate to="/" replace />
  return children
}

function Gate() {
  const { user, farm, member, role } = useApp()
  if (user === undefined) return <Loading />
  if (!user) return <Login />
  if (farm === undefined || member === undefined) return <Loading />
  if (farm === null) return <Setup />
  if (!member || !role) return <NoAccess />

  const g = (roles, el) => <Guard roles={roles}>{el}</Guard>
  return (
    <Layout>
      <Routes>
        <Route path="/" element={role === 'petugas' ? <InputHarian /> : <Dashboard />} />
        <Route path="/harian" element={<InputHarian />} />
        <Route path="/produksi" element={<Produksi />} />
        <Route path="/kandang" element={g(ADM, <KandangBatch />)} />
        <Route path="/barang" element={g(ADM, <Barang />)} />
        <Route path="/pembelian" element={g(ADM, <Pembelian />)} />
        <Route path="/stok" element={g(ADM, <StokBarang />)} />
        <Route path="/gudang-telur" element={g(ADM, <GudangTelur />)} />
        <Route path="/harga" element={g(ADM, <HargaJual />)} />
        <Route path="/pelanggan" element={g(ADM, <Pelanggan />)} />
        <Route path="/penjualan" element={g(ADM, <Penjualan />)} />
        <Route path="/penjualan/:id" element={g(ADM, <PenjualanDetail />)} />
        <Route path="/pengiriman" element={g(ADM, <Pengiriman />)} />
        <Route path="/trip/:id" element={g(ADM, <TripDetail />)} />
        <Route path="/kas" element={g(ADM, <Kas />)} />
        <Route path="/pengaturan" element={g(['owner'], <Pengaturan />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Gate />
    </AppProvider>
  )
}
