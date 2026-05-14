import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/store/auth'
import Login from '@/pages/Login'
import Layout from '@/components/layout/Layout'
import Dashboard from '@/pages/Dashboard'
import Accounts from '@/pages/Accounts'
import ProxyUsers from '@/pages/ProxyUsers'
import Usage from '@/pages/Usage'
import Logs from '@/pages/Logs'
import Settings from '@/pages/Settings'

function App() {
  const { token, hydrated } = useAuth()

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/admin/login" element={!token ? <Login /> : <Navigate to="/admin" replace />} />
      <Route path="/admin/*" element={token ? <Layout /> : <Navigate to="/admin/login" replace />}>
        <Route index element={<Dashboard />} />
        <Route path="accounts" element={<Accounts />} />
        <Route path="users" element={<ProxyUsers />} />
        <Route path="usage" element={<Usage />} />
        <Route path="logs" element={<Logs />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  )
}

export default App
