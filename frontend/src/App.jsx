import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './context/authStore';
import AppShell from './components/layout/AppShell';
import LoginPage from './components/auth/LoginPage';
import RegisterPage from './components/auth/RegisterPage';
import Dashboard from './components/dashboard/Dashboard';
import Appointments from './components/appointments/Appointments';
import Contacts from './components/contacts/Contacts';
import Chat from './components/chat/Chat';
import Analytics from './components/analytics/Analytics';
import Staff from './components/staff/Staff';
import Services from './components/services/Services';
import Settings from './components/settings/Settings';
import AdminDashboard from "./components/Admindashboard";

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { isAuthenticated } = useAuthStore();
  return !isAuthenticated ? children : <Navigate to="/" replace />;
}

export default function App() {
  const { isAuthenticated, fetchMe } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) fetchMe();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
        <Route
          path="/"
          element={<ProtectedRoute><AppShell /></ProtectedRoute>}
        >
          <Route index element={<Dashboard />} />
          <Route path="appointments" element={<Appointments />} />
          <Route path="contacts" element={<Contacts />} />
          <Route path="chat" element={<Chat />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="staff" element={<Staff />} />
          <Route path="services" element={<Services />} />
          <Route path="settings" element={<Settings />} />
          <Route path="admin" element={<AdminDashboard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
