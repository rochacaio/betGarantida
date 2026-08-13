import { api } from "../../lib/api/client";

export type SessionUser = {
  id: string;
  email: string;
  status: string;
  createdAt: string;
};
export const authApi = {
  me: () => api<{ user: SessionUser }>("/auth/me"),
  login: (email: string, password: string) =>
    api<{ user: SessionUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (email: string, password: string, cpf: string) =>
    api<{ user: SessionUser }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, cpf }),
    }),
  logout: () => api<void>("/auth/logout", { method: "POST" }),
  recover: (email: string, cpf: string) =>
    api<{ message: string }>("/auth/password-recovery", {
      method: "POST",
      body: JSON.stringify({ email, cpf }),
    }),
  reset: (token: string, newPassword: string) =>
    api<{ message: string }>("/auth/password-reset", {
      method: "POST",
      body: JSON.stringify({ token, newPassword }),
    }),
};
