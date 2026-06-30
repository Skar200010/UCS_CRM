import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './store'
import Layout from './components/Layout'
import Splash from './components/Splash'
import Login from './components/Login'
import Home from './components/Home'
import Profile from './components/Profile'
import AttendanceList from './components/AttendanceList'
import EditProfile from './components/EditProfile'
import Scanner from './components/Scanner'
import CorrectionTicket from './components/CorrectionTicket'
import PrintForm from './components/PrintForm'
import Onboarding from './components/Onboarding'

function Protected({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function Public({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/home" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Splash />} />
      <Route path="/login" element={<Public><Login /></Public>} />
      <Route path="/onboarding" element={<Protected><Onboarding /></Protected>} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route path="/home" element={<Home />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/attendance" element={<AttendanceList />} />
        <Route path="/edit-profile" element={<EditProfile />} />
        <Route path="/scanner" element={<Scanner />} />
        <Route path="/raise-ticket" element={<CorrectionTicket />} />
        <Route path="/print" element={<PrintForm />} />
      </Route>
    </Routes>
  )
}
