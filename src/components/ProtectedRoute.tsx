import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { BrandLoading } from '@/components/brand/BrandLayout';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return <BrandLoading />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}