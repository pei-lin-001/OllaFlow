import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/store/auth'
import Login from '@/pages/Login'
import Layout from '@/components/layout/Layout'
import { Skeleton } from '@/components/ui/skeleton'

const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Accounts = lazy(() => import('@/pages/Accounts'))
const ProxyUsers = lazy(() => import('@/pages/ProxyUsers'))
const Usage = lazy(() => import('@/pages/Usage'))
const Logs = lazy(() => import('@/pages/Logs'))
const Settings = lazy(() => import('@/pages/Settings'))

function PageSkeleton() {
  return <Skeleton className="h-96" />
}

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
        <Route index element={<Suspense fallback={<PageSkeleton />}><Dashboard /></Suspense>} />
        <Route path="accounts" element={<Suspense fallback={<PageSkeleton />}><Accounts /></Suspense>} />
        <Route path="users" element={<Suspense fallback={<PageSkeleton />}><ProxyUsers /></Suspense>} />
        <Route path="usage" element={<Suspense fallback={<PageSkeleton />}><Usage /></Suspense>} />
        <Route path="logs" element={<Suspense fallback={<PageSkeleton />}><Logs /></Suspense>} />
        <Route path="settings" element={<Suspense fallback={<PageSkeleton />}><Settings /></Suspense>} />
      </Route>
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  )
}

export default App