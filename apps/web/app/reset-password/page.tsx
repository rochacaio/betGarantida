"use client";

import { FormEvent, useState } from "react";
import { authApi } from "../../features/auth/api";
import { ApiClientError } from "../../lib/api/client";
import Link from "next/link";
import { showToast } from "../../lib/toast";

export default function ResetPasswordPage() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const password = String(
      new FormData(event.currentTarget).get("password") ?? "",
    );
    try {
      const result = await authApi.reset(
        new URLSearchParams(window.location.search).get("token") ?? "",
        password,
      );
      setMessage(result.message);
      showToast("success", "Senha atualizada", result.message);
    } catch (error) {
      const detail =
        error instanceof ApiClientError
          ? error.message
          : "Não foi possível trocar a senha.";
      setMessage(detail);
      showToast("error", "Erro ao trocar senha", detail);
    } finally {
      setLoading(false);
    }
  };
  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <form className="auth-card" onSubmit={submit}>
          <span className="eyebrow">RECUPERAR ACESSO</span>
          <h2>Defina sua nova senha</h2>
          <p>O link é válido por tempo limitado e só pode ser usado uma vez.</p>
          <label className="field">
            <span>Nova senha</span>
            <input name="password" type="password" minLength={8} required />
          </label>
          {message && <p role="status">{message}</p>}
          <button className="primary wide" disabled={loading}>
            {loading ? "Atualizando..." : "Atualizar senha"}
          </button>
          <Link href="/">Voltar ao login</Link>
        </form>
      </section>
    </main>
  );
}
