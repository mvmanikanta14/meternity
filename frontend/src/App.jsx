import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import Layout from './components/Layout.jsx'
import AuthPage from './pages/AuthPage.jsx'
import SetupPage from './pages/SetupPage.jsx'
import HomePage from './pages/HomePage.jsx'
import WeeksPage from './pages/WeeksPage.jsx'
import HealthPage from './pages/HealthPage.jsx'
import AppointmentsPage from './pages/AppointmentsPage.jsx'
import KickCounterPage from './pages/KickCounterPage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import DailyPage from './pages/DailyPage.jsx'
import ContractionPage from './pages/ContractionPage.jsx'
import BagPage from './pages/BagPage.jsx'
import NamesPage from './pages/NamesPage.jsx'
import ReportsPage from './pages/ReportsPage.jsx'
import BackupPage from './pages/BackupPage.jsx'
import PartnerPage from './pages/PartnerPage.jsx'

function Splash() {
  return (
    <div className="splash">
      <img src="/icon.svg" alt="" width="72" height="72" />
      <div className="spinner" />
    </div>
  )
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) return <Splash />

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  if (!user.lmp_date) {
    return (
      <Routes>
        <Route path="/setup" element={<SetupPage />} />
        <Route path="*" element={<Navigate to="/setup" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/weeks" element={<WeeksPage />} />
        <Route path="/health" element={<HealthPage />} />
        <Route path="/visits" element={<AppointmentsPage />} />
        <Route path="/kicks" element={<KickCounterPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/daily" element={<DailyPage />} />
        <Route path="/contractions" element={<ContractionPage />} />
        <Route path="/bag" element={<BagPage />} />
        <Route path="/names" element={<NamesPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/backup" element={<BackupPage />} />
        <Route path="/partner" element={<PartnerPage />} />
      </Route>
      <Route path="/setup" element={<SetupPage edit />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
