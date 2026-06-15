import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { tenant } = useParams<{ tenant: string }>();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!user || user.role !== 'tenant_user') {
    return <Navigate to={`/${tenant}/login`} replace />;
  }

  // Ensure the user belongs to the correct tenant
  if (tenant && user.tenant_slug !== tenant) {
    return <Navigate to={`/${tenant}/login`} replace />;
  }

  return <>{children}</>;
}
