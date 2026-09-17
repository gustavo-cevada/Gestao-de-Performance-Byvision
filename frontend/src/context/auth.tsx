import { createContext, useContext, useEffect, useState } from "react";

import { apiFetch, TOKEN_KEY } from "@/src/api/client";
import { queryClient } from "@/src/query-client";
import { storage } from "@/src/utils/storage";

export type Role = "admin" | "vendedor";
export type User = {
  username: string;
  nome: string | null;
  role: Role;
  cod_vendedor: number | null;
};

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<string | void>;
  logout: () => Promise<void>;
};

const AuthCtx = createContext<AuthState>(null as never);
const USER_KEY = "byvision.user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await storage.secureGet<string>(TOKEN_KEY, "");
        if (!token) return;
        // valida o token no backend
        const me = await apiFetch<User>("/auth/me");
        setUser(me);
        await storage.setItem(USER_KEY, JSON.stringify(me));
      } catch {
        await storage.secureRemove(TOKEN_KEY);
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function login(identifier: string, password: string) {
    try {
      const data = await apiFetch<{ access_token: string; user: User }>("/auth/login", {
        method: "POST",
        auth: false,
        body: { identifier, password },
      });
      await storage.secureSet(TOKEN_KEY, data.access_token);
      await storage.setItem(USER_KEY, JSON.stringify(data.user));
      setUser(data.user);
    } catch (e: any) {
      return e?.message || "Falha no login";
    }
  }

  async function logout() {
    await storage.secureRemove(TOKEN_KEY);
    await storage.removeItem(USER_KEY);
    queryClient.clear();
    setUser(null);
  }

  return (
    <AuthCtx.Provider value={{ user, loading, login, logout }}>{children}</AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
