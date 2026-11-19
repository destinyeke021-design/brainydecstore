
import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Role, useAuth } from "../contexts/AuthContext";

export const Spinner = () => (
  <div className="flex items-center justify-center gap-3 p-8 text-sm font-medium text-slate-600">
    <span className="h-5 w-5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-700" />
    Loading...
  </div>
);

export const ErrorBox = ({ msg }: { msg: string }) => (
  <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
    {msg}
  </div>
);

export const Empty = ({ children }: { children: ReactNode }) => (
  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500">
    {children}
  </div>
);

export const Success = ({ children }: { children: ReactNode }) => (
  <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-medium text-blue-800">
    {children}
  </div>
);

export function RequireRole({
  roles,
  children,
}: {
  roles?: Role[];
  children: ReactNode;
}) {
  const { user, loading } = useAuth();

  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  // UX protection only; the API enforces permissions.
  return <>{children}</>;
}

export function Countdown({ endsAt }: { endsAt: string }) {
  const left = Math.max(0, new Date(endsAt).getTime() - Date.now());
  const h = Math.floor(left / 3.6e6);
  const m = Math.floor((left % 3.6e6) / 6e4);

  return (
    <span
      className={`inline-flex rounded-md px-2 py-1 font-mono text-xs font-semibold ${
        left
          ? "bg-blue-50 text-blue-800"
          : "bg-slate-100 text-slate-500"
      }`}
    >
      {left ? `${h}h ${m}m left` : "Ended"}
    </span>
  );
}
