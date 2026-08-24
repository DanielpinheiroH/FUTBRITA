import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Loading } from '../components/ui/States'
import { useAuth } from '../features/auth/AuthContext'
import { AdminLayout } from '../layouts/AdminLayout'
import { PublicLayout } from '../layouts/PublicLayout'
import { AdminDashboardPage } from '../pages/admin/AdminDashboardPage'
import { AdminJogadoresPage } from '../pages/admin/AdminJogadoresPage'
import { LoginPage } from '../pages/admin/LoginPage'
import { HomePage } from '../pages/public/HomePage'
import { JogadorProfilePage } from '../pages/public/JogadorProfilePage'
import { JogadoresPage } from '../pages/public/JogadoresPage'
import { NotFoundPage } from '../pages/NotFoundPage'

function ProtectedRoute() { const { admin, loading } = useAuth(); const location = useLocation(); if (loading) return <div className="min-h-svh bg-neutral-950"><Loading label="Verificando acesso..." /></div>; return admin ? <AdminLayout /> : <Navigate to="/admin/login" state={{ from: location }} replace /> }

export function App() { return <Routes><Route element={<PublicLayout />}><Route path="/" element={<HomePage />} /><Route path="/jogadores" element={<JogadoresPage />} /><Route path="/jogadores/:id" element={<JogadorProfilePage />} /></Route><Route path="/admin/login" element={<LoginPage />} /><Route path="/admin" element={<ProtectedRoute />}><Route index element={<AdminDashboardPage />} /><Route path="jogadores" element={<AdminJogadoresPage />} /></Route><Route path="*" element={<NotFoundPage />} /></Routes> }
