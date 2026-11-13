import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import Alert from "./Alert";
import Spinner from "./Spinner";
import { type UserRole } from "../context/auth-context";
import { useAuth } from "../context/useAuth";

interface ProtectedRouteProps {
  children: ReactNode;
  role?: UserRole;
}

export default function ProtectedRoute({ children, role }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return <Spinner />;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (role && user.role !== role) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <Alert variant="error" message="Not authorised" />
      </div>
    );
  }
  return children;
}
