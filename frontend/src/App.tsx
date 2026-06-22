import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';

// Admin pages
import SystemLoginPage from './pages/admin/SystemLoginPage';
import SystemDashboardPage from './pages/admin/SystemDashboardPage';

// Tenant pages
import LoginPage from './pages/tenant/LoginPage';
import DashboardPage from './pages/tenant/DashboardPage';
import EventsPage from './pages/tenant/EventsPage';
import EventDetailPage from './pages/tenant/EventDetailPage';
import PersonsPage from './pages/tenant/PersonsPage';
import MailsPage from './pages/tenant/MailsPage';
import UsersPage from './pages/tenant/UsersPage';
import SettingsPage from './pages/tenant/SettingsPage';
import TextsPage from './pages/tenant/TextsPage';

// Public pages
import RsvpPage from './pages/public/RsvpPage';

// Guards
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';

export default function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: { borderRadius: '10px', background: '#333', color: '#fff' },
            success: { style: { background: '#059669' } },
            error: { style: { background: '#DC2626' } },
          }}
        />
        <Routes>
          {/* Public RSVP */}
          <Route path="/rsvp/:token" element={<RsvpPage />} />

          {/* System Admin */}
          <Route path="/admin/login" element={<SystemLoginPage />} />
          <Route path="/admin" element={
            <AdminRoute>
              <SystemDashboardPage />
            </AdminRoute>
          } />
          <Route path="/admin/dashboard" element={
            <AdminRoute>
              <SystemDashboardPage />
            </AdminRoute>
          } />

          {/* Tenant routes */}
          <Route path="/:tenant/login" element={<LoginPage />} />
          <Route path="/:tenant/dashboard" element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          } />
          <Route path="/:tenant/events" element={
            <ProtectedRoute>
              <EventsPage />
            </ProtectedRoute>
          } />
          <Route path="/:tenant/events/:eventId" element={
            <ProtectedRoute>
              <EventDetailPage />
            </ProtectedRoute>
          } />
          <Route path="/:tenant/persons" element={
            <ProtectedRoute>
              <PersonsPage />
            </ProtectedRoute>
          } />
          <Route path="/:tenant/mails" element={
            <ProtectedRoute>
              <MailsPage />
            </ProtectedRoute>
          } />
          <Route path="/:tenant/users" element={
            <ProtectedRoute>
              <UsersPage />
            </ProtectedRoute>
          } />
          <Route path="/:tenant/events/:eventId/texts" element={
            <ProtectedRoute>
              <TextsPage />
            </ProtectedRoute>
          } />
          <Route path="/:tenant/settings" element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          } />

          {/* Redirects */}
          <Route path="/" element={<Navigate to="/admin/login" replace />} />
          <Route path="/:tenant" element={<TenantRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ThemeProvider>
  );
}

function TenantRedirect() {
  const { tenant } = useParams();
  return <Navigate to={`/${tenant}/login`} replace />;
}
