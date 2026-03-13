import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'client';
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // If role is missing (old session), infer it: admins always have email set, clients have document
  const effectiveRole = user.role || (user.email && !user.document ? 'admin' : 'client');

  if (requiredRole && effectiveRole !== requiredRole) {
    // Prevent infinite loop: if we'd redirect to "/" and "/" would send us back here, go to login instead
    if (requiredRole === 'client' && effectiveRole !== 'admin') {
      // User is likely a client with missing role - allow through
      return <>{children}</>;
    }
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
