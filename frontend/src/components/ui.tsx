import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Role, useAuth } from "../contexts/AuthContext";

export const Spinner = () => <div className="p-8 text-center text-stone-500">Loading…</div>;
export const ErrorBox = ({ msg }: { msg: string }) => <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{msg}</div>;
export const Empty = ({ children }: { children: ReactNode }) => <div className="p-10 text-center text-stone-500">{children}</div>;
export const Success = ({ children }: { children: ReactNode }) => <div className="rounded-lg bg-brand-light p-3 text-sm text-brand-dark">{children}</div>;

export function RequireRole({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />; // UX only; the API enforces permissions
  return <>{children}</>;
}

export function Countdown({ endsAt }: { endsAt: string }) {
  const left = Math.max(0, new Date(endsAt).getTime() - Date.now());
  const h = Math.floor(left / 3.6e6), m = Math.floor((left % 3.6e6) / 6e4);
  return <span className="font-mono text-xs">{left ? `${h}h ${m}m left` : "ended"}</span>;
}
