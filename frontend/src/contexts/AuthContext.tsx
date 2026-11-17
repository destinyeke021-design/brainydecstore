import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { api, clearGuestCart, tokens } from "../api/client";

export type Role = "super_admin" | "store_admin" | "customer" | "delivery_agent" | "support_agent";
export interface User { id: number; email: string; first_name: string; last_name: string; role: Role }
interface Ctx { user: User | null; loading: boolean; login(e: string, p: string): Promise<User>; logout(): void; refresh(): Promise<void> }

const AuthCtx = createContext<Ctx>(null as unknown as Ctx);
export const useAuth = () => useContext(AuthCtx);
export const isStaff = (u: User | null) => !!u && (u.role === "super_admin" || u.role === "store_admin");
export const homeFor = (u: User) => isStaff(u) ? "/admin" : u.role === "delivery_agent" ? "/delivery" : u.role === "support_agent" ? "/support-desk" : "/";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!tokens.get()) { setUser(null); setLoading(false); return; }
    try { setUser((await api.get("/auth/me/")).data); } catch { tokens.clear(); setUser(null); }
    setLoading(false);
  };
  useEffect(() => { refresh(); }, []);

  const login = async (email: string, password: string) => {
    const { data } = await api.post("/auth/login/", { email, password });
    tokens.set(data.access, data.refresh);
    const me = (await api.get("/auth/me/")).data as User;
    setUser(me);
    clearGuestCart();
    return me;
  };
  const logout = () => { tokens.clear(); setUser(null); };
  return <AuthCtx.Provider value={{ user, loading, login, logout, refresh }}>{children}</AuthCtx.Provider>;
}
