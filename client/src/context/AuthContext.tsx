import axios from "axios";
import { useEffect, useState, type PropsWithChildren } from "react";
import api, { TOKEN_STORAGE_KEY } from "../api/client";
import { getApiError } from "../api/errors";
import { AuthContext, type AuthUser } from "./auth-context";

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem(TOKEN_STORAGE_KEY)));
  const [restoreError, setRestoreError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);

    if (!token) {
      return () => {
        active = false;
      };
    }

    api
      .get<{ user: AuthUser }>("/auth/me")
      .then(({ data }) => {
        if (active) {
          setUser(data.user);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          const details = getApiError(error);
          setUser(null);
          if (!(axios.isAxiosError(error) && error.response?.status === 401)) {
            setRestoreError(details.message);
          }
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function login(email: string, password: string): Promise<AuthUser> {
    const { data } = await api.post<{ token: string; user: AuthUser }>("/auth/login", {
      email,
      password,
    });
    localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
    setUser(data.user);
    setRestoreError(null);
    return data.user;
  }

  async function register(name: string, email: string, password: string): Promise<AuthUser> {
    await api.post("/auth/register", { name, email, password });
    return login(email, password);
  }

  function logout() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setUser(null);
    setRestoreError(null);
  }

  function updateUser(updatedUser: AuthUser) {
    setUser(updatedUser);
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, restoreError, login, register, logout, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}
