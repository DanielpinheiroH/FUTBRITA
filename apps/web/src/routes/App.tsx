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
import { AdminRodadasPage } from '../pages/admin/AdminRodadasPage'
import { NovaRodadaPage } from '../pages/admin/NovaRodadaPage'
import { AdminRodadaDetailPage } from '../pages/admin/AdminRodadaDetailPage'
import { RodadaPublicaPage } from '../pages/public/RodadaPublicaPage'
import { JogoAoVivoPage } from '../pages/admin/JogoAoVivoPage'
import { RankingsPage } from '../pages/public/RankingsPage'
import { HistoricoPage } from '../pages/public/HistoricoPage'
import { HistoricoDetailPage } from '../pages/public/HistoricoDetailPage'

function ProtectedRoute() { const { admin, loading } = useAuth(); const location = useLocation(); if (loading) return <div className="min-h-svh bg-neutral-950"><Loading label="Verificando acesso..." /></div>; return admin ? <AdminLayout /> : <Navigate to="/admin/login" state={{ from: location }} replace /> }

export function App() { return <Routes><Route element={<PublicLayout />}><Route path="/" element={<HomePage />} /><Route path="/rodada" element={<RodadaPublicaPage />} /><Route path="/rankings" element={<RankingsPage />} /><Route path="/jogadores" element={<JogadoresPage />} /><Route path="/jogadores/:id" element={<JogadorProfilePage />} /><Route path="/historico" element={<HistoricoPage />} /><Route path="/historico/:id" element={<HistoricoDetailPage />} /></Route><Route path="/admin/login" element={<LoginPage />} /><Route path="/admin" element={<ProtectedRoute />}><Route index element={<AdminDashboardPage />} /><Route path="jogadores" element={<AdminJogadoresPage />} /><Route path="rodadas" element={<AdminRodadasPage />} /><Route path="rodadas/nova" element={<NovaRodadaPage />} /><Route path="rodadas/:id" element={<AdminRodadaDetailPage />} /><Route path="rodadas/:id/jogo" element={<JogoAoVivoPage />} /></Route><Route path="*" element={<NotFoundPage />} /></Routes> }
