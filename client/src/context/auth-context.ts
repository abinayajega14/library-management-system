import { createContext } from "react";

export type UserRole = "member" | "admin";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  address?: string;
  membershipExpiresAt?: string;
  createdAt: string;
}

export interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  restoreError: string | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (name: string, email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  updateUser: (user: AuthUser) => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
