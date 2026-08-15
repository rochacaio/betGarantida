"use client";
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions -- native dialogs close when their backdrop is clicked; both dialogs also expose explicit close buttons */

import { FormEvent, useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { ApiClientError } from "../lib/api/client";
import { authApi, SessionUser } from "../features/auth/api";
import {
  ApiBookmaker,
  ApiWalletTransaction,
  bookmakersApi,
} from "../features/bookmakers/api";
import {
  ApiOperation,
  OperationInput,
  operationsApi,
} from "../features/operations/api";
import { DashboardData, dashboardApi } from "../features/dashboard/api";
import { errorMessage, showToast } from "../lib/toast";

type Screen =
  | "login"
  | "register"
  | "recover"
  | "dashboard"
  | "bookmakers"
  | "surebets"
  | "editor";
type Bookmaker = {
  id: string;
  name: string;
  balance: number;
  openStake: number;
  equity: number;
  color: string;
  version: number;
  status: "ACTIVE" | "ARCHIVED";
};
type Leg = {
  id: string;
  bookmakerId: string;
  stake: number | "";
  odd: number | "";
  commission: number;
  cashback: number;
  increase: number;
  result: "PENDING" | "WON" | "LOST";
  usesBetCredit?: boolean;
  usesFreeBetCredit?: boolean;
  creditSourceSurebetId?: string;
  stakeManuallyEdited?: boolean;
  existingOperation?: boolean;
};
type Surebet = {
  id: string;
  title: string;
  event: string;
  date: string;
  status: "OPEN" | "WAITING_CREDIT_USE" | "SETTLED";
  profit: number;
  roi: number;
  legs: Leg[];
  version: number;
  generatesBetCredit?: boolean;
  expectedBetCredit?: number;
  generatedCreditId?: string;
  generatedCreditStatus?: string;
  generatedCreditConsumerOperationId?: string;
  creditGenerated?: boolean;
  combinedPromotionProfit?: number;
};

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const pct = (value: number) => `${value.toFixed(2).replace(".", ",")}%`;
const uid = () => crypto.randomUUID();

const colors = ["#f4c542", "#ff6a2a", "#ec3d57", "#4e8cff", "#a469ff"];
const mapBookmaker = (item: ApiBookmaker, index: number): Bookmaker => ({
  id: item.id,
  name: item.nickname || item.name,
  balance: Number(item.availableBalance),
  openStake: Number(item.openStake),
  equity: Number(item.equity),
  version: item.version,
  status: item.status as "ACTIVE" | "ARCHIVED",
  color: colors[index % colors.length]!,
});
const mapOperation = (item: ApiOperation): Surebet => ({
  id: item.id,
  title: `Arbitragem #${item.sequenceNumber}`,
  event: item.eventName,
  date: new Date(item.createdAt).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }),
  status: item.status === "CANCELLED" ? "SETTLED" : item.status,
  profit: Number(item.realizedProfit ?? item.projectedProfit),
  roi: Number(item.realizedRoiPercent ?? item.projectedRoiPercent),
  version: item.version,
  generatesBetCredit: item.generatesBetCredit,
  expectedBetCredit: item.generatedCredit
    ? Number(
        item.generatedCredit.grantedAmount ??
          item.generatedCredit.expectedAmount,
      )
    : undefined,
  generatedCreditId: item.generatedCredit?.id,
  generatedCreditStatus: item.generatedCredit?.status,
  generatedCreditConsumerOperationId:
    item.generatedCredit?.consumerOperation?.id ?? undefined,
  creditGenerated:
    item.generatedCredit?.status === "AVAILABLE" ||
    item.generatedCredit?.status === "CONSUMED",
  combinedPromotionProfit:
    item.combinedPromotionProfit === null
      ? undefined
      : Number(item.combinedPromotionProfit),
  legs: item.legs.map((leg) => ({
    id: leg.id,
    bookmakerId: leg.bookmakerAccountId,
    stake: Number(leg.stake),
    odd: Number(leg.odd),
    commission: Number(leg.commissionPercent),
    cashback: Number(leg.cashbackPercent),
    increase: Number(leg.increasePercent),
    result: leg.result,
    usesBetCredit: leg.usesBetCredit,
    usesFreeBetCredit: leg.usesFreeBetCredit,
    creditSourceSurebetId: leg.betCreditId ?? undefined,
  })),
});

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function AuthScreen({
  screen,
  setScreen,
  onAuthenticate,
}: {
  screen: Screen;
  setScreen: (s: Screen) => void;
  onAuthenticate: (
    screen: "login" | "register" | "recover",
    values: { email: string; password: string; cpf: string },
  ) => Promise<void>;
}) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    const data = new FormData(event.currentTarget);
    try {
      await onAuthenticate(screen as "login" | "register" | "recover", {
        email: String(data.get("email") ?? ""),
        password: String(data.get("password") ?? ""),
        cpf: String(data.get("cpf") ?? ""),
      });
    } catch (failure) {
      const message =
        failure instanceof ApiClientError
          ? failure.message
          : "Não foi possível concluir a solicitação.";
      setError(message);
      showToast("error", "Falha na autenticação", message);
    } finally {
      setLoading(false);
    }
  };
  const content = {
    login: {
      eyebrow: "Bem-vindo de volta",
      title: "Acesse sua conta",
      text: "Suas entradas, saldos e resultados em um só lugar.",
      action: "Entrar",
    },
    register: {
      eyebrow: "Comece agora",
      title: "Crie sua conta",
      text: "Organize suas operações e acompanhe seus resultados.",
      action: "Criar minha conta",
    },
    recover: {
      eyebrow: "Recuperar acesso",
      title: "Recupere sua senha",
      text: "Enviaremos um link de troca para o seu e-mail.",
      action: "Enviar instruções",
    },
  }[screen as "login" | "register" | "recover"];

  return (
    <main className="auth-shell">
      <section className="auth-brand">
        <div className="auth-logo">
          <Image
            src="/logo-login-bet-garantida.png"
            alt="BetGarantida"
            width={1452}
            height={1086}
            priority
          />
        </div>
        <div className="auth-pitch">
          <span className="eyebrow">CONTROLE SEM COMPLICAÇÃO</span>
          <h1>
            Mais clareza.
            <br />
            <em>Menos medo.</em>
          </h1>
          <p>
            Calcule, registre e acompanhe cada operação. Saiba exatamente onde
            está seu dinheiro e quanto ele está rendendo.
          </p>
        </div>
        <div className="auth-proof">
          <span>✓</span>
          <div>
            <strong>Seu histórico financeiro, preservado.</strong>
            <small>Da entrada ao resultado final.</small>
          </div>
        </div>
      </section>
      <section className="auth-panel">
        <form className="auth-card" onSubmit={submit}>
          <span className="eyebrow">{content.eyebrow}</span>
          <h2>{content.title}</h2>
          <p>{content.text}</p>
          {(screen === "register" || screen === "recover") && (
            <Field label="CPF">
              <input
                name="cpf"
                required
                inputMode="numeric"
                placeholder="000.000.000-00"
              />
            </Field>
          )}
          <Field label="E-mail">
            <input
              name="email"
              required
              type="email"
              placeholder="voce@email.com"
            />
          </Field>
          {screen !== "recover" && (
            <Field label="Senha">
              <input
                name="password"
                required
                type="password"
                placeholder="Mínimo de 8 caracteres"
              />
            </Field>
          )}
          {error && (
            <p className="negative-text" role="alert">
              {error}
            </p>
          )}
          {screen === "login" && (
            <button
              type="button"
              className="text-button right"
              onClick={() => setScreen("recover")}
            >
              Esqueci minha senha
            </button>
          )}
          <button className="primary wide" type="submit" disabled={loading}>
            {loading ? "Aguarde..." : content.action}
            <span>→</span>
          </button>
          {screen === "login" ? (
            <p className="auth-switch">
              Ainda não tem conta?{" "}
              <button type="button" onClick={() => setScreen("register")}>
                Criar conta
              </button>
            </p>
          ) : (
            <p className="auth-switch">
              Já tem uma conta?{" "}
              <button type="button" onClick={() => setScreen("login")}>
                Voltar ao login
              </button>
            </p>
          )}
        </form>
      </section>
    </main>
  );
}

function Sidebar({
  screen,
  navigate,
  logout,
  user,
}: {
  screen: Screen;
  navigate: (s: Screen) => void;
  logout: () => void;
  user: SessionUser;
}) {
  const nav = [
    ["dashboard", "⌂", "Visão geral"],
    ["surebets", "↗", "Minhas entradas"],
    ["editor", "+", "Nova surebet"],
    ["bookmakers", "▣", "Casas de aposta"],
  ] as const;
  return (
    <aside className="sidebar">
      <button
        className="brand sidebar-logo"
        onClick={() => navigate("dashboard")}
        aria-label="Ir para a visão geral"
        title="Ir para a visão geral"
      >
        <Image
          src="/logo-bet-garantida.png"
          alt="BetGarantida"
          width={2048}
          height={512}
          priority
        />
      </button>
      <nav>
        {nav.map(([id, icon, label]) => (
          <button
            key={id}
            className={screen === id ? "active" : ""}
            onClick={() => navigate(id)}
          >
            <span>{icon}</span>
            {label}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="user">
          <span>{user.email.slice(0, 2).toUpperCase()}</span>
          <div>
            <strong>Minha conta</strong>
            <small>{user.email}</small>
          </div>
        </div>
        <button className="logout" onClick={logout}>
          Sair
        </button>
      </div>
    </aside>
  );
}

function Topbar({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="topbar">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </header>
  );
}

function Dashboard({
  surebets,
  bookmakers,
  navigate,
  dashboard,
  month,
  onMonthChange,
}: {
  surebets: Surebet[];
  bookmakers: Bookmaker[];
  navigate: (s: Screen) => void;
  dashboard?: DashboardData;
  month: string;
  onMonthChange: (month: string) => void;
}) {
  const profit = Number(dashboard?.metrics.netResult ?? 0);
  const definitiveLoss = Number(dashboard?.metrics.realizedLoss ?? 0);
  const creditGeneratingLoss = Number(
    dashboard?.metrics.creditGeneratingLoss ?? 0,
  );
  const creditConversionProfit = Number(
    dashboard?.metrics.creditConversionProfit ?? 0,
  );
  const daily = dashboard?.dailyEvolution ?? [];
  const max = Math.max(
    1,
    ...daily.map((item) => Math.abs(Number(item.accumulated))),
  );
  const months = daily
    .slice(-12)
    .map((item) =>
      Math.max(8, (Math.abs(Number(item.accumulated)) / max) * 100),
    );
  const [year, monthNumber] = month.split("-").map(Number);
  const monthDate = new Date(Date.UTC(year ?? 2026, (monthNumber ?? 1) - 1, 1));
  const monthLabel = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(monthDate);
  const shortMonth = new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    timeZone: "UTC",
  })
    .format(monthDate)
    .replace(".", "");
  const today = new Date();
  const isCurrentMonth =
    year === today.getFullYear() && monthNumber === today.getMonth() + 1;
  const chartDaily = isCurrentMonth
    ? daily.slice(0, Math.min(today.getDate(), daily.length))
    : daily;
  const chartValues = chartDaily.map((item) => Number(item.accumulated));
  const rawChartMin = Math.min(0, ...chartValues);
  const rawChartMax = Math.max(0, ...chartValues);
  const rawChartRange = rawChartMax - rawChartMin;
  const chartPadding = rawChartRange === 0 ? 1 : rawChartRange * 0.12;
  const chartMin =
    rawChartRange === 0
      ? 0
      : rawChartMin - (rawChartMin < 0 ? chartPadding : 0);
  const chartMax =
    rawChartRange === 0
      ? 1
      : rawChartMax + (rawChartMax > 0 ? chartPadding : 0);
  const chartRange = Math.max(1, chartMax - chartMin);
  const chartWidth = 1000;
  const chartHeight = 140;
  const chartX = (index: number) =>
    chartDaily.length <= 1
      ? chartWidth
      : (index / (chartDaily.length - 1)) * chartWidth;
  const chartY = (value: number) =>
    ((chartMax - value) / chartRange) * chartHeight;
  const chartPoints = chartValues
    .map((value, index) => `${chartX(index)},${chartY(value)}`)
    .join(" ");
  const zeroY = chartY(0);
  const chartAreaPath = chartValues.length
    ? `M ${chartValues
        .map((value, index) => `${chartX(index)} ${chartY(value)}`)
        .join(
          " L ",
        )} L ${chartX(chartValues.length - 1)} ${zeroY} L ${chartX(0)} ${zeroY} Z`
    : "";
  const chartTicks = Array.from(
    { length: 5 },
    (_, index) => chartMax - (index / 4) * chartRange,
  );
  const chartColor = profit >= 0 ? "var(--green)" : "var(--red)";
  const changeMonth = (offset: number) => {
    const next = new Date(
      Date.UTC(year ?? 2026, (monthNumber ?? 1) - 1 + offset, 1),
    );
    onMonthChange(
      `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`,
    );
  };
  return (
    <>
      <Topbar
        title="Visão geral"
        subtitle={`Acompanhe seu desempenho em ${monthLabel}`}
        action={
          <div className="header-actions">
            <button className="month-select" onClick={() => changeMonth(-1)}>
              ‹
            </button>
            <button className="month-pill">{monthLabel}</button>
            <button className="month-select" onClick={() => changeMonth(1)}>
              ›
            </button>
            <button className="primary" onClick={() => navigate("editor")}>
              + Nova surebet
            </button>
          </div>
        }
      />
      <section className="content">
        <div className="hero-grid">
          <article className="profit-card">
            <span className="card-label">RESULTADO DO MÊS</span>
            <strong>{money.format(profit)}</strong>
            <div className={profit >= 0 ? "positive" : "negative-text"}>
              Resultado líquido realizado
            </div>
            <div className="sparkline">
              {months.map((h, i) => (
                <i
                  key={i}
                  style={{ height: `${h}%` }}
                  className={i === months.length - 1 ? "current" : ""}
                />
              ))}
            </div>
          </article>
          <article className="metric-card">
            <span className="metric-icon green">↗</span>
            <div>
              <span>Lucro realizado</span>
              <strong>
                {money.format(Number(dashboard?.metrics.realizedProfit ?? 0))}
              </strong>
              <small>
                {dashboard?.metrics.settledOperations ?? 0} entradas liquidadas
                {Number(dashboard?.metrics.freeWinnings ?? 0) > 0 &&
                  ` · ${money.format(Number(dashboard?.metrics.freeWinnings ?? 0))} em ganhos grátis`}
              </small>
            </div>
          </article>
          <article className="metric-card">
            <span className="metric-icon red">↘</span>
            <div>
              <span>Perdas</span>
              <strong>{money.format(definitiveLoss)}</strong>
              <small>Perdas definitivas no período</small>
            </div>
          </article>
          <article className="metric-card credit-conversion-card">
            <span className="metric-icon credit">⇄</span>
            <div>
              <span>Perdas que geraram crédito</span>
              <strong className="credit-conversion-values">
                <span className="negative-text">
                  − {money.format(creditGeneratingLoss)}
                </span>
                <span>/</span>
                <span
                  className={
                    creditConversionProfit >= 0
                      ? "positive-text"
                      : "negative-text"
                  }
                >
                  {creditConversionProfit >= 0 ? "+ " : "− "}
                  {money.format(Math.abs(creditConversionProfit))}
                </span>
              </strong>
              <small>Perda inicial / lucro convertido</small>
            </div>
          </article>
          <article className="metric-card">
            <span className="metric-icon amber">%</span>
            <div>
              <span>Lucro sobre aportes</span>
              <strong>{pct(Number(dashboard?.metrics.roiPercent ?? 0))}</strong>
              <small>
                Sobre{" "}
                {money.format(
                  Number(dashboard?.metrics.contributedCapital ?? 0),
                )}
                em depósitos e saldos iniciais
              </small>
            </div>
          </article>
        </div>
        <div className="dashboard-grid">
          <article className="panel chart-panel">
            <div className="panel-head">
              <div>
                <span className="card-label">EVOLUÇÃO DO RESULTADO</span>
                <h3>Ganhos e perdas</h3>
              </div>
              <div className="legend">
                <span>
                  <i className="dot green-dot" />
                  Lucro
                </span>
                <span>
                  <i className="dot red-dot" />
                  Perda
                </span>
              </div>
            </div>
            <div className="chart">
              <div className="chart-lines">
                {chartTicks.map((tick, index) => (
                  <span key={index}>{money.format(tick)}</span>
                ))}
              </div>
              <div className="chart-area">
                {chartValues.length > 0 && (
                  <svg
                    className="result-chart"
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    preserveAspectRatio="none"
                    role="img"
                    aria-label={`Evolução do resultado no mês, encerrando em ${money.format(profit)}`}
                  >
                    <defs>
                      <linearGradient
                        id="result-chart-fill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor={chartColor}
                          stopOpacity="0.3"
                        />
                        <stop
                          offset="100%"
                          stopColor={chartColor}
                          stopOpacity="0.02"
                        />
                      </linearGradient>
                    </defs>
                    <line
                      className="result-chart-zero"
                      x1="0"
                      x2={chartWidth}
                      y1={zeroY}
                      y2={zeroY}
                    />
                    <path d={chartAreaPath} fill="url(#result-chart-fill)" />
                    <polyline
                      points={chartPoints}
                      fill="none"
                      stroke={chartColor}
                      strokeWidth="4"
                      vectorEffect="non-scaling-stroke"
                    />
                    {chartValues.map((value, index) =>
                      Number(chartDaily[index]?.result) !== 0 ? (
                        <circle
                          key={chartDaily[index]?.date}
                          cx={chartX(index)}
                          cy={chartY(value)}
                          r="5"
                          fill={
                            Number(chartDaily[index]?.result) >= 0
                              ? "var(--green)"
                              : "var(--red)"
                          }
                          vectorEffect="non-scaling-stroke"
                        />
                      ) : null,
                    )}
                  </svg>
                )}
                <div className="axis">
                  <span>01 {shortMonth}</span>
                  <span>08 {shortMonth}</span>
                  <span>15 {shortMonth}</span>
                  <span>22 {shortMonth}</span>
                  <span>
                    {chartDaily.length} {shortMonth}
                  </span>
                </div>
              </div>
            </div>
          </article>
          <article className="panel">
            <div className="panel-head">
              <div>
                <span className="card-label">PATRIMÔNIO</span>
                <h3>Saldo por casa</h3>
              </div>
              <button
                className="text-button"
                onClick={() => navigate("bookmakers")}
              >
                Ver todas
              </button>
            </div>
            <div className="balance-total">
              <span>Saldo disponível</span>
              <strong>
                {money.format(bookmakers.reduce((s, b) => s + b.balance, 0))}
              </strong>
            </div>
            <div className="bookmaker-mini-list">
              {bookmakers.map((b) => (
                <div key={b.id}>
                  <span
                    className="bookmaker-avatar"
                    style={{ background: b.color }}
                  >
                    {b.name.slice(0, 2).toUpperCase()}
                  </span>
                  <strong>{b.name}</strong>
                  <span>{money.format(b.balance)}</span>
                </div>
              ))}
            </div>
          </article>
        </div>
        <article className="panel recent">
          <div className="panel-head">
            <div>
              <span className="card-label">ATIVIDADE RECENTE</span>
              <h3>Últimas entradas</h3>
            </div>
            <button
              className="text-button"
              onClick={() => navigate("surebets")}
            >
              Ver histórico completo →
            </button>
          </div>
          <SurebetTable
            surebets={surebets.slice(0, 4)}
            bookmakers={bookmakers}
          />
        </article>
      </section>
    </>
  );
}

function SurebetTable({
  surebets,
  bookmakers,
  onEdit,
  onDelete,
  onCreditLost,
}: {
  surebets: Surebet[];
  bookmakers: Bookmaker[];
  onEdit?: (s: Surebet) => void;
  onDelete?: (s: Surebet) => void;
  onCreditLost?: (s: Surebet) => void;
}) {
  const statusLabel = (status: Surebet["status"]) =>
    status === "OPEN"
      ? "Em aberto"
      : status === "WAITING_CREDIT_USE"
        ? "Aguardando uso do crédito"
        : "Liquidada";
  return (
    <div className="table-wrap surebet-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Entrada</th>
            <th>Casas</th>
            <th>Investido</th>
            <th>Resultado</th>
            <th>ROI</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {surebets.map((s) => {
            const displayedProfit = s.profit;
            return (
              <tr key={s.id}>
                <td>
                  <strong>{s.event}</strong>
                  <small>
                    {s.title} · {s.date}
                  </small>
                  {(s.generatesBetCredit ||
                    s.legs.some((leg) => leg.usesBetCredit)) && (
                    <div className="credit-badges">
                      {s.generatesBetCredit && (
                        <span className="credit-badge generated">
                          {s.creditGenerated
                            ? "↗ Crédito gerado"
                            : "↗ Gera crédito"}
                        </span>
                      )}
                      {s.legs.some((leg) => leg.usesBetCredit) && (
                        <span className="credit-badge used">
                          {s.legs.some((leg) => leg.usesFreeBetCredit)
                            ? "● Usou crédito livre"
                            : "● Usou crédito de bet"}
                        </span>
                      )}
                    </div>
                  )}
                </td>
                <td>
                  <div className="avatar-stack">
                    {s.legs.map((l) => {
                      const b = bookmakers.find((x) => x.id === l.bookmakerId);
                      return (
                        <span key={l.id} style={{ background: b?.color }}>
                          {b?.name.slice(0, 2).toUpperCase()}
                        </span>
                      );
                    })}
                  </div>
                </td>
                <td>
                  {money.format(
                    s.legs.reduce((a, l) => a + Number(l.stake || 0), 0),
                  )}
                </td>
                <td
                  className={
                    displayedProfit >= 0 ? "positive-text" : "negative-text"
                  }
                >
                  {s.status === "OPEN"
                    ? "—"
                    : `${displayedProfit >= 0 ? "+ " : "− "}${money.format(Math.abs(displayedProfit))}`}
                  {s.status !== "OPEN" &&
                    s.combinedPromotionProfit !== undefined && (
                      <small
                        className={`operation-combined ${s.combinedPromotionProfit >= 0 ? "positive-text" : "negative-text"}`}
                      >
                        Combinado com crédito:{" "}
                        {s.combinedPromotionProfit >= 0 ? "+ " : "− "}
                        {money.format(Math.abs(s.combinedPromotionProfit))}
                      </small>
                    )}
                </td>
                <td>{s.status === "OPEN" ? "—" : pct(s.roi)}</td>
                <td>
                  <span className={`status ${s.status.toLowerCase()}`}>
                    {statusLabel(s.status)}
                  </span>
                </td>
                <td>
                  <div className="surebet-actions">
                    {onCreditLost &&
                      s.status === "WAITING_CREDIT_USE" &&
                      s.generatedCreditStatus === "AVAILABLE" &&
                      !s.generatedCreditConsumerOperationId && (
                        <button
                          type="button"
                          className="credit-lost-operation"
                          onClick={() => onCreditLost(s)}
                        >
                          Crédito de aposta perdido
                        </button>
                      )}
                    {onDelete && (
                      <button
                        type="button"
                        className="delete-operation"
                        onClick={() => onDelete(s)}
                        aria-label={`Excluir ${s.event}`}
                      >
                        Excluir
                      </button>
                    )}
                    <button className="icon-button" onClick={() => onEdit?.(s)}>
                      •••
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Bookmakers({
  bookmakers,
  onAdd,
  onRefresh,
}: {
  bookmakers: Bookmaker[];
  onAdd: (name: string, balance: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const [modal, setModal] = useState(false);
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [menuId, setMenuId] = useState<string>();
  const [selected, setSelected] = useState<Bookmaker>();
  const [transactions, setTransactions] = useState<ApiWalletTransaction[]>([]);
  const [statementTab, setStatementTab] = useState<StatementTab>("all");
  const [action, setAction] = useState<
    "deposit" | "withdraw" | "adjust" | "bonus" | "edit"
  >();
  const [actionAmount, setActionAmount] = useState("");
  const [actionReason, setActionReason] = useState("");
  const [actionName, setActionName] = useState("");
  const [transferModal, setTransferModal] = useState(false);
  const [transferSourceId, setTransferSourceId] = useState("");
  const [transferDestinationId, setTransferDestinationId] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferDescription, setTransferDescription] = useState("");
  const add = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onAdd(name, balance || "0");
      setName("");
      setBalance("");
      setModal(false);
      showToast(
        "success",
        "Casa cadastrada",
        "A nova casa foi salva com sucesso.",
      );
    } catch (failure) {
      const message = errorMessage(
        failure,
        "Não foi possível cadastrar a casa.",
      );
      setError(message);
      showToast("error", "Erro ao cadastrar casa", message);
    } finally {
      setSaving(false);
    }
  };
  const total = bookmakers.reduce((s, b) => s + b.balance, 0);
  const totalOpen = bookmakers.reduce((s, b) => s + b.openStake, 0);
  const openStatement = async (bookmaker: Bookmaker) => {
    setError("");
    setSelected(bookmaker);
    setTransactions([]);
    setStatementTab("all");
    setMenuId(undefined);
    try {
      setTransactions((await bookmakersApi.transactions(bookmaker.id)).data);
    } catch (failure) {
      const message = errorMessage(
        failure,
        "Não foi possível carregar o extrato.",
      );
      setError(message);
      showToast("error", "Erro ao carregar extrato", message);
    }
  };
  const openAction = (
    bookmaker: Bookmaker,
    next: "deposit" | "withdraw" | "adjust" | "bonus" | "edit",
  ) => {
    setSelected(bookmaker);
    setAction(next);
    setActionAmount("");
    setActionReason("");
    setActionName(bookmaker.name);
    setError("");
    setMenuId(undefined);
  };
  const submitAction = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !action) return;
    setSaving(true);
    setError("");
    try {
      if (action === "edit")
        await bookmakersApi.update(selected, { name: actionName });
      else if (action === "deposit")
        await bookmakersApi.deposit(
          selected.id,
          Number(actionAmount).toFixed(2),
          actionReason || undefined,
        );
      else if (action === "withdraw")
        await bookmakersApi.withdraw(
          selected.id,
          Number(actionAmount).toFixed(2),
          actionReason || undefined,
        );
      else if (action === "bonus")
        await bookmakersApi.freeWinning(
          selected.id,
          Number(actionAmount).toFixed(2),
          actionReason,
        );
      else
        await bookmakersApi.adjust(
          selected.id,
          Number(actionAmount).toFixed(2),
          actionReason,
        );
      setAction(undefined);
      setSelected(undefined);
      await onRefresh();
      showToast(
        "success",
        "Alteração concluída",
        `${actionTitle(action)} realizado com sucesso.`,
      );
    } catch (failure) {
      const message = errorMessage(
        failure,
        "Não foi possível concluir a movimentação.",
      );
      setError(message);
      showToast("error", "Erro na movimentação", message);
    } finally {
      setSaving(false);
    }
  };
  const archive = async (bookmaker: Bookmaker) => {
    setSaving(true);
    setError("");
    try {
      await bookmakersApi.update(bookmaker, { status: "ARCHIVED" });
      setMenuId(undefined);
      await onRefresh();
      showToast(
        "success",
        "Casa arquivada",
        `${bookmaker.name} foi arquivada.`,
      );
    } catch (failure) {
      const message = errorMessage(
        failure,
        "Não foi possível arquivar a casa.",
      );
      setError(message);
      showToast("error", "Erro ao arquivar", message);
    } finally {
      setSaving(false);
    }
  };
  const submitTransfer = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await bookmakersApi.transfer(
        transferSourceId,
        transferDestinationId,
        Number(transferAmount).toFixed(2),
        transferDescription || undefined,
      );
      setTransferModal(false);
      setTransferSourceId("");
      setTransferDestinationId("");
      setTransferAmount("");
      setTransferDescription("");
      await onRefresh();
      showToast(
        "success",
        "Transferência concluída",
        "Os saldos e extratos foram atualizados.",
      );
    } catch (failure) {
      const message = errorMessage(
        failure,
        "Não foi possível concluir a transferência.",
      );
      setError(message);
      showToast("error", "Erro na transferência", message);
    } finally {
      setSaving(false);
    }
  };
  const restore = async (bookmaker: Bookmaker) => {
    setSaving(true);
    setError("");
    try {
      await bookmakersApi.update(bookmaker, { status: "ACTIVE" });
      setMenuId(undefined);
      await onRefresh();
      showToast(
        "success",
        "Casa desarquivada",
        `${bookmaker.name} voltou a ficar ativa.`,
      );
    } catch (failure) {
      const message = errorMessage(
        failure,
        "Não foi possível desarquivar a casa.",
      );
      setError(message);
      showToast("error", "Erro ao desarquivar", message);
    } finally {
      setSaving(false);
    }
  };
  const visibleTransactions = transactions.filter((transaction) =>
    transactionMatchesStatementTab(transaction, statementTab),
  );
  return (
    <>
      <Topbar
        title="Casas de aposta"
        subtitle="Gerencie suas contas e acompanhe onde está seu saldo"
        action={
          <div className="topbar-actions">
            <button
              className="secondary transfer-balance"
              onClick={() => {
                setError("");
                setTransferModal(true);
              }}
              disabled={
                bookmakers.filter((item) => item.status === "ACTIVE").length < 2
              }
            >
              Transferir saldo
            </button>
            <button className="primary" onClick={() => setModal(true)}>
              + Adicionar casa
            </button>
          </div>
        }
      />
      <section className="content">
        <div className="summary-strip">
          <div>
            <span>Saldo total disponível</span>
            <strong>{money.format(total)}</strong>
          </div>
          <div>
            <span>Casas ativas</span>
            <strong>
              {bookmakers.filter((item) => item.status === "ACTIVE").length}
            </strong>
          </div>
          <div>
            <span>Em apostas abertas</span>
            <strong>{money.format(totalOpen)}</strong>
          </div>
          <div>
            <span>Patrimônio total</span>
            <strong>{money.format(total + totalOpen)}</strong>
          </div>
        </div>
        <div className="section-heading">
          <div>
            <span className="card-label">SUAS CONTAS</span>
            <h2>Onde está seu dinheiro</h2>
          </div>
          <div className="search">
            ⌕ <input placeholder="Buscar casa..." />
          </div>
        </div>
        <div className="bookmaker-grid">
          {bookmakers.map((b) => (
            <article
              className={`bookmaker-card ${b.status === "ARCHIVED" ? "archived" : ""}`}
              key={b.id}
            >
              <div className="bookmaker-card-top">
                <span
                  className="bookmaker-logo"
                  style={{ background: b.color }}
                >
                  {b.name.slice(0, 2).toUpperCase()}
                </span>
                <div className="bookmaker-menu-wrap">
                  <button
                    className="icon-button"
                    aria-label={`Ações de ${b.name}`}
                    onClick={() =>
                      setMenuId(menuId === b.id ? undefined : b.id)
                    }
                  >
                    •••
                  </button>
                  {menuId === b.id && (
                    <div className="bookmaker-menu">
                      <button onClick={() => openAction(b, "edit")}>
                        Editar casa
                      </button>
                      {b.status === "ACTIVE" && (
                        <>
                          <button onClick={() => openAction(b, "deposit")}>
                            Depositar
                          </button>
                          <button onClick={() => openAction(b, "withdraw")}>
                            Sacar
                          </button>
                          <button onClick={() => openAction(b, "adjust")}>
                            Ajustar saldo
                          </button>
                          <button onClick={() => openAction(b, "bonus")}>
                            Adicionar ganho grátis
                          </button>
                        </>
                      )}
                      <button
                        className={
                          b.status === "ACTIVE"
                            ? "negative-text"
                            : "positive-text"
                        }
                        onClick={() =>
                          b.status === "ACTIVE"
                            ? void archive(b)
                            : void restore(b)
                        }
                      >
                        {b.status === "ACTIVE" ? "Arquivar" : "Desarquivar"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <h3>{b.name}</h3>
              <span className="muted">
                {b.status === "ARCHIVED" ? "Conta arquivada" : "Conta ativa"}
              </span>
              <div className="balance-block">
                <span>Saldo disponível</span>
                <strong>{money.format(b.balance)}</strong>
              </div>
              <div className="bookmaker-stats">
                <div>
                  <span>Em apostas</span>
                  <strong>{money.format(b.openStake)}</strong>
                </div>
                <div>
                  <span>Patrimônio</span>
                  <strong>{money.format(b.equity)}</strong>
                </div>
              </div>
              <button
                className="secondary wide"
                onClick={() => void openStatement(b)}
              >
                Ver extrato <span>→</span>
              </button>
            </article>
          ))}
        </div>
      </section>
      {modal && (
        <dialog
          open
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setModal(false);
          }}
        >
          <form className="modal" onSubmit={add}>
            <div className="modal-head">
              <div>
                <span className="card-label">NOVA CONTA</span>
                <h2>Adicionar casa de aposta</h2>
              </div>
              <button type="button" onClick={() => setModal(false)}>
                ×
              </button>
            </div>
            <p>Cadastre a casa e o valor que está disponível nela hoje.</p>
            <Field label="Nome da casa">
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Bet365"
              />
            </Field>
            <Field label="Saldo inicial">
              <div className="money-input">
                <span>R$</span>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                  placeholder="0,00"
                />
              </div>
            </Field>
            {error && <p className="negative-text">{error}</p>}
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setModal(false)}
              >
                Cancelar
              </button>
              <button className="primary" disabled={saving}>
                {saving ? "Salvando..." : "Adicionar casa"}
              </button>
            </div>
          </form>
        </dialog>
      )}
      {transferModal && (
        <dialog
          open
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setTransferModal(false);
          }}
        >
          <form className="modal" onSubmit={submitTransfer}>
            <div className="modal-head">
              <div>
                <span className="card-label">MOVIMENTAÇÃO ENTRE CASAS</span>
                <h2>Transferir saldo</h2>
              </div>
              <button type="button" onClick={() => setTransferModal(false)}>
                Ã—
              </button>
            </div>
            <p>
              O valor será debitado da origem e creditado no destino na mesma
              operação.
            </p>
            <Field label="Casa de origem">
              <select
                required
                value={transferSourceId}
                onChange={(event) => {
                  setTransferSourceId(event.target.value);
                  if (transferDestinationId === event.target.value)
                    setTransferDestinationId("");
                }}
              >
                <option value="">Selecione a casa</option>
                {bookmakers
                  .filter((item) => item.status === "ACTIVE")
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} Â· {money.format(item.balance)}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Casa de destino">
              <select
                required
                value={transferDestinationId}
                onChange={(event) =>
                  setTransferDestinationId(event.target.value)
                }
              >
                <option value="">Selecione a casa</option>
                {bookmakers
                  .filter(
                    (item) =>
                      item.status === "ACTIVE" && item.id !== transferSourceId,
                  )
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Valor da transferência">
              <div className="money-input">
                <span>R$</span>
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={transferAmount}
                  onChange={(event) => setTransferAmount(event.target.value)}
                />
              </div>
            </Field>
            <Field label="DescriÃ§Ã£o opcional">
              <input
                value={transferDescription}
                maxLength={240}
                onChange={(event) => setTransferDescription(event.target.value)}
              />
            </Field>
            {error && <p className="negative-text">{error}</p>}
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setTransferModal(false)}
              >
                Cancelar
              </button>
              <button className="primary" disabled={saving}>
                {saving ? "Transferindo..." : "Confirmar transferência"}
              </button>
            </div>
          </form>
        </dialog>
      )}
      {selected && !action && (
        <dialog
          open
          className="edit-drawer-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelected(undefined);
          }}
        >
          <div className="statement-drawer">
            <div className="drawer-header">
              <div>
                <span className="card-label">EXTRATO DA CONTA</span>
                <h2>{selected.name}</h2>
                <p>Saldo atual: {money.format(selected.balance)}</p>
              </div>
              <button
                className="secondary"
                onClick={() => setSelected(undefined)}
              >
                Fechar
              </button>
            </div>
            <div
              className="statement-tabs"
              role="tablist"
              aria-label="Filtrar extrato"
            >
              {statementTabs.map((tab) => {
                const count = transactions.filter((transaction) =>
                  transactionMatchesStatementTab(transaction, tab.id),
                ).length;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={statementTab === tab.id}
                    className={statementTab === tab.id ? "active" : ""}
                    onClick={() => setStatementTab(tab.id)}
                  >
                    {tab.label}
                    <span>{count}</span>
                  </button>
                );
              })}
            </div>
            <div className="statement-content">
              {error && <p className="negative-text">{error}</p>}
              {!error && visibleTransactions.length === 0 && (
                <div className="empty-state">
                  <h3>Nenhuma movimentação nesta aba</h3>
                  <p>{statementEmptyMessages[statementTab]}</p>
                </div>
              )}
              {visibleTransactions.map((item) => {
                const counterparty = transferCounterparty(item, bookmakers);
                const reason = transactionReason(item);
                return (
                  <div className="statement-row" key={item.id}>
                    <div>
                      <strong>{transactionLabel(item)}</strong>
                      {counterparty && (
                        <span className="statement-counterparty">
                          {item.type === "TRANSFER_IN"
                            ? `Recebida de ${counterparty}`
                            : `Enviada para ${counterparty}`}
                        </span>
                      )}
                      {reason && (
                        <span className="statement-counterparty">{reason}</span>
                      )}
                      <small>
                        {new Date(item.occurredAt).toLocaleString("pt-BR")}
                      </small>
                    </div>
                    <strong
                      className={
                        Number(item.amount) >= 0
                          ? "positive-text"
                          : "negative-text"
                      }
                    >
                      {Number(item.amount) >= 0 ? "+ " : "− "}
                      {money.format(Math.abs(Number(item.amount)))}
                    </strong>
                  </div>
                );
              })}
            </div>
          </div>
        </dialog>
      )}
      {selected && action && (
        <dialog open className="modal-backdrop">
          <form className="modal" onSubmit={submitAction}>
            <div className="modal-head">
              <div>
                <span className="card-label">
                  {action === "edit" ? "EDITAR CONTA" : "MOVIMENTAÇÃO"}
                </span>
                <h2>
                  {actionTitle(action)} · {selected.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAction(undefined);
                  setSelected(undefined);
                }}
              >
                ×
              </button>
            </div>
            {action === "edit" ? (
              <Field label="Nome da casa">
                <input
                  required
                  value={actionName}
                  onChange={(event) => setActionName(event.target.value)}
                />
              </Field>
            ) : (
              <>
                <Field
                  label={action === "adjust" ? "Novo saldo final" : "Valor"}
                >
                  <div className="money-input">
                    <span>R$</span>
                    <input
                      required
                      type="number"
                      step="0.01"
                      min={action === "adjust" ? "0" : "0.01"}
                      value={actionAmount}
                      onChange={(event) => setActionAmount(event.target.value)}
                    />
                  </div>
                </Field>
                <Field
                  label={
                    action === "adjust"
                      ? "Motivo obrigatório"
                      : action === "bonus"
                        ? "Origem do ganho"
                        : "Descrição opcional"
                  }
                >
                  <input
                    required={action === "adjust" || action === "bonus"}
                    minLength={
                      action === "adjust" || action === "bonus" ? 3 : undefined
                    }
                    value={actionReason}
                    onChange={(event) => setActionReason(event.target.value)}
                    placeholder={
                      action === "bonus"
                        ? "Ex.: 40 giros grátis no jogo X"
                        : undefined
                    }
                  />
                </Field>
              </>
            )}
            {error && <p className="negative-text">{error}</p>}
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setAction(undefined);
                  setSelected(undefined);
                }}
              >
                Cancelar
              </button>
              <button className="primary" disabled={saving}>
                {saving ? "Salvando..." : "Confirmar"}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </>
  );
}

const transactionLabels: Record<string, string> = {
  INITIAL_BALANCE: "Saldo inicial",
  DEPOSIT: "Depósito",
  WITHDRAWAL: "Saque",
  TRANSFER_OUT: "Transferência enviada",
  TRANSFER_IN: "Transferência recebida",
  BET_STAKE: "Valor apostado",
  BET_RETURN: "Retorno da aposta",
  BET_REFUND: "Estorno da aposta",
  BONUS_RECEIVED: "Ganho grátis",
  BONUS_USED: "Crédito utilizado",
  ADJUSTMENT: "Ajuste manual",
};
const transactionLabel = (transaction: ApiWalletTransaction) => {
  if (transaction.activity === "BET_EDIT_REFUND")
    return "Saldo devolvido para edição";
  if (transaction.activity === "BET_EDIT_STAKE")
    return "Valor reaplicado após edição";
  if (transaction.activity === "BET_CANCEL_REFUND")
    return "Estorno por exclusão da aposta";
  return transactionLabels[transaction.type] ?? transaction.type;
};

type StatementTab =
  | "all"
  | "withdrawals"
  | "deposits"
  | "winnings"
  | "free-winnings"
  | "refunds"
  | "transfers";

const statementTabs: { id: StatementTab; label: string }[] = [
  { id: "all", label: "Tudo" },
  { id: "withdrawals", label: "Saques" },
  { id: "deposits", label: "Depósitos" },
  { id: "winnings", label: "Ganhos das bets" },
  { id: "free-winnings", label: "Ganhos grátis" },
  { id: "refunds", label: "Dinheiro retornado" },
  { id: "transfers", label: "Transferências" },
];

const statementTabTypes: Record<StatementTab, string[]> = {
  all: [],
  withdrawals: ["WITHDRAWAL"],
  deposits: ["INITIAL_BALANCE", "DEPOSIT"],
  winnings: ["BET_RETURN"],
  "free-winnings": ["BONUS_RECEIVED"],
  refunds: ["BET_REFUND"],
  transfers: ["TRANSFER_IN", "TRANSFER_OUT"],
};

const transactionMatchesStatementTab = (
  transaction: ApiWalletTransaction,
  tab: StatementTab,
) => tab === "all" || statementTabTypes[tab].includes(transaction.type);

const statementEmptyMessages: Record<StatementTab, string> = {
  all: "Depósitos, apostas, retornos e ajustes aparecerão aqui.",
  withdrawals: "Os saques realizados nesta casa aparecerão aqui.",
  deposits: "Os depósitos e o saldo inicial aparecerão aqui.",
  winnings: "Os valores recebidos pelas bets ganhadoras aparecerão aqui.",
  "free-winnings": "Prêmios, giros e outros ganhos gratuitos aparecerão aqui.",
  refunds: "Valores devolvidos por exclusões ou cancelamentos aparecerão aqui.",
  transfers: "Transferências recebidas e enviadas aparecerão aqui.",
};

const transferCounterparty = (
  transaction: ApiWalletTransaction,
  bookmakers: Bookmaker[],
) => {
  if (transaction.type !== "TRANSFER_IN" && transaction.type !== "TRANSFER_OUT")
    return undefined;
  if (
    !transaction.metadata ||
    typeof transaction.metadata !== "object" ||
    Array.isArray(transaction.metadata)
  )
    return "outra casa";
  const id = (transaction.metadata as Record<string, unknown>)[
    "counterpartyBookmakerAccountId"
  ];
  if (typeof id !== "string") return "outra casa";
  return (
    bookmakers.find((bookmaker) => bookmaker.id === id)?.name ?? "outra casa"
  );
};
const transactionReason = (transaction: ApiWalletTransaction) => {
  if (
    !transaction.metadata ||
    typeof transaction.metadata !== "object" ||
    Array.isArray(transaction.metadata)
  )
    return undefined;
  const reason = (transaction.metadata as Record<string, unknown>)["reason"];
  return typeof reason === "string" ? reason : undefined;
};

const actionTitle = (
  action: "deposit" | "withdraw" | "adjust" | "bonus" | "edit",
) =>
  ({
    deposit: "Depositar",
    withdraw: "Sacar",
    adjust: "Ajustar saldo",
    bonus: "Adicionar ganho grátis",
    edit: "Editar",
  })[action];

function Surebets({
  surebets,
  bookmakers,
  navigate,
  save,
  onDelete,
  onCreditLost,
}: {
  surebets: Surebet[];
  bookmakers: Bookmaker[];
  navigate: (s: Screen) => void;
  save: (s: Surebet, stay?: boolean) => Promise<void>;
  onDelete: (s: Surebet) => Promise<void>;
  onCreditLost: (s: Surebet) => Promise<void>;
}) {
  const [editing, setEditing] = useState<Surebet>();
  return (
    <>
      <Topbar
        title="Minhas entradas"
        subtitle="Consulte, acompanhe e liquide suas operações"
        action={
          <button className="primary" onClick={() => navigate("editor")}>
            + Nova surebet
          </button>
        }
      />
      <section className="content">
        <div className="tabs">
          <button className="active">
            Todas <span>{surebets.length}</span>
          </button>
          <button>
            Em aberto{" "}
            <span>{surebets.filter((s) => s.status === "OPEN").length}</span>
          </button>
          <button>
            Liquidadas{" "}
            <span>{surebets.filter((s) => s.status === "SETTLED").length}</span>
          </button>
        </div>
        <article className="panel list-panel">
          <div className="filters">
            <div className="search grow">
              ⌕ <input placeholder="Buscar por evento ou casa..." />
            </div>
            <button className="secondary">Agosto 2026⌄</button>
            <button className="secondary">Filtros</button>
          </div>
          <SurebetTable
            surebets={surebets}
            bookmakers={bookmakers}
            onEdit={setEditing}
            onDelete={(surebet) => {
              if (
                window.confirm(
                  `Excluir a surebet "${surebet.event}"? Os lançamentos serão estornados nas respectivas casas.`,
                )
              )
                void onDelete(surebet);
            }}
            onCreditLost={(surebet) => {
              if (
                window.confirm(
                  `Marcar o crédito de "${surebet.event}" como perdido? A bet será finalizada com seu resultado original e o crédito não poderá mais ser usado.`,
                )
              )
                void onCreditLost(surebet);
            }}
          />
        </article>
      </section>
      {editing && (
        <dialog
          open
          className="edit-drawer-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setEditing(undefined);
          }}
        >
          <div className="edit-drawer">
            <Editor
              bookmakers={bookmakers}
              surebets={surebets}
              editing={editing}
              embedded
              onSave={async (updated) => {
                await save(updated, true);
                setEditing(undefined);
              }}
              cancel={() => setEditing(undefined)}
            />
          </div>
        </dialog>
      )}
    </>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`toggle ${checked ? "on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <i />
      <span>{label}</span>
    </button>
  );
}

function LegRow({
  leg,
  index,
  bookmakers,
  creditSources,
  scenarioResult,
  update,
  updateStake,
  remove,
}: {
  leg: Leg;
  index: number;
  bookmakers: Bookmaker[];
  creditSources: Surebet[];
  scenarioResult: number | null;
  update: (patch: Partial<Leg>) => void;
  updateStake: (stake: number | "") => void;
  remove: () => void;
}) {
  const b = bookmakers.find((x) => x.id === leg.bookmakerId);
  return (
    <div className="leg-row-wrap">
      <div className="leg-row">
        <div className="leg-number">{String.fromCharCode(65 + index)}</div>
        <Field label="Casa de aposta">
          <select
            value={leg.bookmakerId}
            onChange={(e) => update({ bookmakerId: e.target.value })}
          >
            <option value="">Selecione a casa</option>
            {bookmakers
              .filter((x) => x.status === "ACTIVE" || x.id === leg.bookmakerId)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name} · {money.format(x.balance)}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Valor">
          <div className="money-input compact">
            <span>R$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={leg.stake}
              readOnly={!!leg.usesBetCredit && !!leg.creditSourceSurebetId}
              title={
                leg.usesBetCredit && leg.creditSourceSurebetId
                  ? "O valor é definido pelo crédito de aposta selecionado."
                  : undefined
              }
              onChange={(e) =>
                updateStake(e.target.value === "" ? "" : Number(e.target.value))
              }
            />
          </div>
        </Field>
        <Field label="ODD">
          <input
            className={leg.odd === "" || leg.odd <= 1 ? "input-pending" : ""}
            type="number"
            min="1.01"
            step="0.01"
            placeholder="Digite a odd"
            value={leg.odd}
            onChange={(e) =>
              update({
                odd: e.target.value === "" ? "" : Number(e.target.value),
              })
            }
          />
        </Field>
        <Field label="Comissão">
          <div className="percent-input">
            <input
              type="number"
              min="0"
              max="99"
              value={leg.commission}
              onChange={(e) => update({ commission: Number(e.target.value) })}
            />
            <span>%</span>
          </div>
        </Field>
        <Field label="Cashback">
          <div className="percent-input">
            <input
              type="number"
              min="0"
              value={leg.cashback}
              onChange={(e) => update({ cashback: Number(e.target.value) })}
            />
            <span>%</span>
          </div>
        </Field>
        <Field label="Aumento">
          <div className="percent-input">
            <input
              type="number"
              min="0"
              value={leg.increase}
              onChange={(e) => update({ increase: Number(e.target.value) })}
            />
            <span>%</span>
          </div>
        </Field>
        <div
          className={`effective scenario-result ${scenarioResult === null ? "neutral" : scenarioResult >= 0 ? "profit" : "loss"}`}
        >
          <span>
            {scenarioResult === null
              ? "Resultado"
              : scenarioResult >= 0
                ? "Lucro"
                : "Prejuízo"}
          </span>
          <strong>
            {scenarioResult === null
              ? "—"
              : `${scenarioResult >= 0 ? "+ " : "− "}${money.format(Math.abs(scenarioResult))}`}
          </strong>
          <small>{b?.name}</small>
        </div>
        {index > 1 && (
          <button className="remove-leg" onClick={remove}>
            −
          </button>
        )}
      </div>
      <div className="leg-credit">
        <Toggle
          label="Usar crédito de aposta nesta entrada"
          checked={!!leg.usesBetCredit}
          onChange={(value) =>
            update({
              usesBetCredit: value,
              usesFreeBetCredit: value ? leg.usesFreeBetCredit : false,
              creditSourceSurebetId: value
                ? leg.creditSourceSurebetId
                : undefined,
            })
          }
        />
        {leg.usesBetCredit && (
          <Field label="Crédito gerado pela surebet">
            <select
              value={
                leg.usesFreeBetCredit
                  ? "__FREE_CREDIT__"
                  : (leg.creditSourceSurebetId ?? "")
              }
              onChange={(e) => {
                if (e.target.value === "__FREE_CREDIT__") {
                  update({
                    usesFreeBetCredit: true,
                    creditSourceSurebetId: undefined,
                    stakeManuallyEdited: true,
                  });
                  return;
                }
                const source = creditSources.find(
                  (item) => item.generatedCreditId === e.target.value,
                );
                update({
                  creditSourceSurebetId: e.target.value || undefined,
                  usesFreeBetCredit: false,
                  ...(source
                    ? {
                        stake: source.expectedBetCredit ?? 0,
                        stakeManuallyEdited: true,
                      }
                    : {}),
                });
              }}
            >
              <option value="">Selecione a origem do crédito</option>
              <option value="__FREE_CREDIT__">Crédito livre</option>
              {creditSources.map((source) => (
                <option key={source.id} value={source.generatedCreditId}>
                  {source.event} · {money.format(source.expectedBetCredit ?? 0)}
                </option>
              ))}
            </select>
          </Field>
        )}
        {leg.existingOperation && (
          <div className="outcome-control">
            <span>Resultado da entrada</span>
            <div>
              <button
                type="button"
                className={leg.result === "WON" ? "won active" : "won"}
                onClick={() => update({ result: "WON" })}
              >
                ✓ Green
              </button>
              <button
                type="button"
                className={leg.result === "LOST" ? "lost active" : "lost"}
                onClick={() => update({ result: "LOST" })}
              >
                × Red
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Editor({
  bookmakers,
  surebets,
  editing,
  onSave,
  cancel,
  embedded = false,
}: {
  bookmakers: Bookmaker[];
  surebets: Surebet[];
  editing?: Surebet;
  onSave: (s: Surebet) => Promise<void>;
  cancel: () => void;
  embedded?: boolean;
}) {
  const [event, setEvent] = useState(editing?.event ?? "");
  const [legs, setLegs] = useState<Leg[]>(
    editing
      ? editing.legs.map((leg) => ({
          ...leg,
          stakeManuallyEdited: true,
          existingOperation: true,
        }))
      : [
          {
            id: uid(),
            bookmakerId: "",
            stake: "",
            odd: "",
            commission: 0,
            cashback: 0,
            increase: 0,
            result: "PENDING",
          },
          {
            id: uid(),
            bookmakerId: "",
            stake: "",
            odd: "",
            commission: 0,
            cashback: 0,
            increase: 0,
            result: "PENDING",
          },
        ],
  );
  const [generatesBetCredit, setGeneratesBetCredit] = useState(
    !!editing?.generatesBetCredit,
  );
  const [expectedBetCredit, setExpectedBetCredit] = useState(
    editing?.expectedBetCredit ?? 0,
  );
  const creditSources = surebets.filter(
    (s) =>
      s.generatedCreditId &&
      s.generatedCreditStatus === "AVAILABLE" &&
      (!s.generatedCreditConsumerOperationId ||
        s.generatedCreditConsumerOperationId === editing?.id) &&
      s.id !== editing?.id,
  );
  const payoutMultiplier = (leg: Leg) => {
    if (leg.odd === "" || leg.odd <= 1) return 0;
    const profitFactor =
      (leg.odd - 1) * (1 + leg.increase / 100) * (1 - leg.commission / 100);
    return leg.usesBetCredit ? profitFactor : 1 + profitFactor;
  };
  const total = legs.reduce(
    (s, l) => s + (l.usesBetCredit ? 0 : Number(l.stake || 0)),
    0,
  );
  const isCalculationReady = legs.every(
    (l) => l.stake !== "" && l.stake > 0 && l.odd !== "" && l.odd > 1,
  );
  const pendingCalculationLabel = (() => {
    const index = legs.findIndex(
      (leg) =>
        leg.stake === "" || leg.stake <= 0 || leg.odd === "" || leg.odd <= 1,
    );
    if (index < 0) return "";
    const leg = legs[index]!;
    const label = String.fromCharCode(65 + index);
    return leg.stake === "" || leg.stake <= 0
      ? `Informe o valor da entrada ${label}`
      : `Informe a ODD da entrada ${label}`;
  })();
  const returns = legs.map((l) => Number(l.stake || 0) * payoutMultiplier(l));
  const allStakesReady = legs.every((leg) => leg.stake !== "" && leg.stake > 0);
  const localScenarioResults = legs.map((leg, index) =>
    allStakesReady && leg.odd !== "" && leg.odd > 1
      ? returns[index] - total
      : null,
  );
  const localProtectedReturn = isCalculationReady ? Math.min(...returns) : 0;
  const localProfit = isCalculationReady ? localProtectedReturn - total : 0;
  const localRoi = total ? (localProfit / total) * 100 : 0;
  const [canonical, setCanonical] = useState<{
    results: number[];
    protectedReturn: number;
    profit: number;
    roi: number;
  }>();
  const scenarioResults = isCalculationReady
    ? (canonical?.results ?? localScenarioResults)
    : localScenarioResults;
  const protectedReturn = isCalculationReady
    ? (canonical?.protectedReturn ?? localProtectedReturn)
    : localProtectedReturn;
  const profit = isCalculationReady
    ? (canonical?.profit ?? localProfit)
    : localProfit;
  const roi = isCalculationReady ? (canonical?.roi ?? localRoi) : localRoi;
  const rebalanceLegs = (nextLegs: Leg[]) => {
    const anchor = nextLegs[0];
    if (
      !anchor ||
      anchor.stake === "" ||
      anchor.stake <= 0 ||
      anchor.odd === "" ||
      anchor.odd <= 1
    )
      return nextLegs;
    const anchorPayoutMultiplier = payoutMultiplier(anchor);
    return nextLegs.map((leg, index) => {
      if (
        index === 0 ||
        leg.stakeManuallyEdited ||
        leg.odd === "" ||
        leg.odd <= 1
      )
        return leg;
      const legPayoutMultiplier = payoutMultiplier(leg);
      return {
        ...leg,
        stake:
          Math.round(
            ((Number(anchor.stake) * anchorPayoutMultiplier) /
              legPayoutMultiplier +
              Number.EPSILON) *
              100,
          ) / 100,
      };
    });
  };
  const updateLeg = (id: string, patch: Partial<Leg>) =>
    setLegs((current) =>
      rebalanceLegs(
        current.map((leg) => (leg.id === id ? { ...leg, ...patch } : leg)),
      ),
    );
  const updateLegStake = (id: string, index: number, stake: number | "") =>
    setLegs((current) =>
      rebalanceLegs(
        current.map((leg) =>
          leg.id === id
            ? { ...leg, stake, stakeManuallyEdited: index > 0 }
            : leg,
        ),
      ),
    );
  const showValidationToast = (message: string) => {
    showToast("error", "Não foi possível concluir", message);
  };
  useEffect(() => {
    const anchor = legs[0];
    if (
      !anchor ||
      anchor.stake === "" ||
      Number(anchor.stake) <= 0 ||
      legs.some((leg) => leg.odd === "" || Number(leg.odd) <= 1)
    )
      return;
    const timer = window.setTimeout(() => {
      void operationsApi
        .preview(
          legs.map((leg, index) => ({
            stake: leg.stake === "" ? undefined : Number(leg.stake).toFixed(2),
            odd: Number(leg.odd).toString(),
            commissionPercent: leg.commission.toString(),
            cashbackPercent: leg.cashback.toString(),
            increasePercent: leg.increase.toString(),
            usesBetCredit: !!leg.usesBetCredit,
            manualStake: index === 0 || !!leg.stakeManuallyEdited,
          })),
        )
        .then((response) => {
          const snapshot = response.snapshot as {
            legs?: Array<{ scenarioResult?: string }>;
            protectedReturn?: string;
            projectedProfit?: string;
            projectedRoiPercent?: string;
          };
          setCanonical({
            results:
              snapshot.legs?.map((leg) => Number(leg.scenarioResult ?? 0)) ??
              [],
            protectedReturn: Number(snapshot.protectedReturn ?? 0),
            profit: Number(snapshot.projectedProfit ?? 0),
            roi: Number(snapshot.projectedRoiPercent ?? 0),
          });
          setLegs((current) => {
            let changed = false;
            const next = current.map((leg, index) => {
              const stake = response.stakes[index];
              if (
                !leg.stakeManuallyEdited &&
                stake &&
                Number(leg.stake || 0) !== Number(stake)
              ) {
                changed = true;
                return { ...leg, stake: Number(stake) };
              }
              return leg;
            });
            return changed ? next : current;
          });
        })
        .catch(() => setCanonical(undefined));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [legs]);
  const save = () => {
    if (!event.trim())
      return showValidationToast(
        "Preencha o evento ou identificação da surebet.",
      );
    if (legs.length < 2)
      return showValidationToast(
        "A surebet precisa ter pelo menos duas entradas.",
      );
    const invalidLegIndex = legs.findIndex(
      (leg) =>
        !leg.bookmakerId ||
        leg.stake === "" ||
        leg.stake <= 0 ||
        leg.odd === "" ||
        leg.odd <= 1,
    );
    if (invalidLegIndex >= 0) {
      const leg = legs[invalidLegIndex];
      const label = String.fromCharCode(65 + invalidLegIndex);
      if (!leg.bookmakerId)
        return showValidationToast(
          `Selecione a casa de aposta da entrada ${label}.`,
        );
      if (leg.stake === "" || leg.stake <= 0)
        return showValidationToast(
          `Preencha um valor válido na entrada ${label}.`,
        );
      return showValidationToast(
        `Preencha uma odd maior que 1 na entrada ${label}.`,
      );
    }
    if (generatesBetCredit && expectedBetCredit <= 0)
      return showValidationToast(
        "Informe o valor do crédito de aposta que será gerado.",
      );
    const missingCreditSource = legs.findIndex(
      (leg) =>
        leg.usesBetCredit &&
        !leg.usesFreeBetCredit &&
        !leg.creditSourceSurebetId,
    );
    if (missingCreditSource >= 0)
      return showValidationToast(
        `Selecione a origem do crédito usado na entrada ${String.fromCharCode(65 + missingCreditSource)}.`,
      );
    const invalidCreditAmount = legs.findIndex((leg) => {
      if (!leg.usesBetCredit || !leg.creditSourceSurebetId) return false;
      const source = creditSources.find(
        (item) => item.generatedCreditId === leg.creditSourceSurebetId,
      );
      return (
        !source ||
        Number(leg.stake).toFixed(2) !==
          Number(source.expectedBetCredit ?? 0).toFixed(2)
      );
    });
    if (invalidCreditAmount >= 0)
      return showValidationToast(
        `O valor da entrada ${String.fromCharCode(65 + invalidCreditAmount)} deve ser igual ao crédito selecionado. Selecione novamente a origem do crédito.`,
      );
    void Promise.resolve(
      onSave({
        id: editing?.id ?? "",
        title: editing?.title ?? "Nova arbitragem",
        event: event.trim(),
        date: editing?.date ?? "agora",
        status: editing?.status ?? "OPEN",
        profit,
        roi,
        legs,
        version: editing?.version ?? 0,
        generatesBetCredit,
        expectedBetCredit: generatesBetCredit ? expectedBetCredit : undefined,
      }),
    ).catch((failure) =>
      showValidationToast(
        failure instanceof Error
          ? failure.message
          : "Não foi possível salvar a operação.",
      ),
    );
  };
  const completeFinalization = (creditWasGenerated: boolean) => {
    if (!editing) return;
    const realizedReturn = legs.reduce(
      (sum, leg, index) => sum + (leg.result === "WON" ? returns[index] : 0),
      0,
    );
    const realizedProfit = realizedReturn - total;
    const realizedRoi = total > 0 ? (realizedProfit / total) * 100 : 0;
    const sourceIds = new Set(
      legs
        .map((leg) => leg.creditSourceSurebetId)
        .filter((id): id is string => !!id),
    );
    const qualificationResult = surebets
      .filter(
        (operation) =>
          operation.generatedCreditId &&
          sourceIds.has(operation.generatedCreditId),
      )
      .reduce((sum, operation) => sum + operation.profit, 0);
    void Promise.resolve(
      onSave({
        ...editing,
        event: event.trim(),
        status: creditWasGenerated ? "WAITING_CREDIT_USE" : "SETTLED",
        profit: realizedProfit,
        roi: realizedRoi,
        legs,
        generatesBetCredit,
        expectedBetCredit: generatesBetCredit ? expectedBetCredit : undefined,
        creditGenerated: creditWasGenerated,
        combinedPromotionProfit: sourceIds.size
          ? realizedProfit + qualificationResult
          : undefined,
      }),
    ).catch((failure) =>
      showValidationToast(
        failure instanceof Error
          ? failure.message
          : "Não foi possível finalizar a operação.",
      ),
    );
  };
  const askIfCreditWasGenerated = () => {
    document.querySelector(".credit-decision-backdrop")?.remove();
    const backdrop = document.createElement("div");
    backdrop.className = "credit-decision-backdrop";
    backdrop.innerHTML = `<div class="credit-decision"><span class="card-label">CRÉDITO DE APOSTA</span><h2>O crédito foi gerado?</h2><p>Se o crédito foi concedido, esta operação ficará aguardando a utilização. Se o ganho foi imediato e não houve crédito, ela será encerrada agora.</p><div><button type="button" data-answer="no" class="secondary">Não foi gerado</button><button type="button" data-answer="yes" class="primary">Sim, foi gerado</button></div></div>`;
    backdrop.addEventListener("click", (event) => {
      const answer = (event.target as HTMLElement).closest<HTMLButtonElement>(
        "[data-answer]",
      )?.dataset.answer;
      if (!answer) return;
      backdrop.remove();
      completeFinalization(answer === "yes");
    });
    document.body.appendChild(backdrop);
  };
  const finalizeBet = () => {
    if (!editing) return;
    if (legs.some((leg) => leg.result === "PENDING"))
      return showValidationToast(
        "Marque todas as entradas como Green ou Red antes de finalizar.",
      );
    if (!legs.some((leg) => leg.result === "WON"))
      return showValidationToast("Selecione pelo menos uma entrada vencedora.");
    if (generatesBetCredit) return askIfCreditWasGenerated();
    completeFinalization(false);
  };
  useEffect(() => {
    const handler = () => finalizeBet();
    document.addEventListener("finalize-bet", handler);
    const actions = document.querySelector(".drawer-header .header-actions");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "settle-button";
    button.textContent =
      editing?.status === "SETTLED" ? "Atualizar finalização" : "Finalizar bet";
    button.addEventListener("click", handler);
    if (embedded && editing) actions?.appendChild(button);
    return () => {
      document.removeEventListener("finalize-bet", handler);
      button.removeEventListener("click", handler);
      button.remove();
    };
  });
  const header = (
    <Topbar
      title={editing ? "Editar surebet" : "Nova surebet"}
      subtitle="Distribua as entradas e confira o retorno antes de salvar"
      action={
        <div className="header-actions">
          <button className="secondary" onClick={cancel}>
            Cancelar
          </button>
          <button className="primary" onClick={save}>
            Salvar alterações
          </button>
        </div>
      }
    />
  );
  return (
    <>
      {!embedded && header}
      {embedded && (
        <div className="drawer-header">
          <div>
            <span className="card-label">EDIÇÃO DA ENTRADA</span>
            <h2>{editing?.event}</h2>
            <p>Altere os dados sem sair do histórico.</p>
          </div>
          <div className="header-actions">
            <button className="secondary" onClick={cancel}>
              Cancelar
            </button>
            <button className="primary" onClick={save}>
              Salvar alterações
            </button>
          </div>
        </div>
      )}
      <section
        className={`content editor-content ${embedded ? "embedded-editor" : ""}`}
      >
        <div className="editor-intro">
          <div className="field event-field">
            <span>EVENTO OU IDENTIFICAÇÃO</span>
            <input
              value={event}
              onChange={(e) => setEvent(e.target.value)}
              placeholder="Ex.: Palmeiras x Corinthians"
            />
          </div>
          <div className="operation-summary">
            <div>
              <span>Investimento</span>
              <strong>{money.format(total)}</strong>
            </div>
            <div>
              <span>Lucro estimado</span>
              <strong className="positive-text">
                + {money.format(profit)}
              </strong>
            </div>
            <div>
              <span>ROI</span>
              <strong className="positive-text">{pct(roi)}</strong>
            </div>
          </div>
        </div>
        <div className="credit-generator">
          <div>
            <Toggle
              label="Esta surebet vai gerar crédito de aposta"
              checked={generatesBetCredit}
              onChange={setGeneratesBetCredit}
            />
            <p>
              Ao usar esse crédito em outra entrada, as duas operações ficarão
              vinculadas.
            </p>
          </div>
          {generatesBetCredit && (
            <Field label="Valor esperado do crédito">
              <div className="money-input">
                <span>R$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={expectedBetCredit}
                  onChange={(e) => setExpectedBetCredit(Number(e.target.value))}
                />
              </div>
            </Field>
          )}
        </div>
        {editing?.status === "WAITING_CREDIT_USE" && (
          <p className="muted">
            Esta surebet já foi finalizada. Você pode corrigir o valor do
            crédito enquanto ele ainda não tiver sido reservado ou utilizado.
          </p>
        )}
        <article className="surebet-builder">
          <div className="builder-top">
            <div>
              <span className="card-label">DISTRIBUIÇÃO DA SUREBET</span>
              <h2>Entradas da operação</h2>
            </div>
            <div className="guarantee">
              <span>✓</span>
              <div>
                <small>Resultado protegido</small>
                <strong className={profit < 0 ? "negative-text" : ""}>
                  {isCalculationReady
                    ? `${profit >= 0 ? "+ " : "− "}${money.format(Math.abs(profit))}`
                    : pendingCalculationLabel}{" "}
                  {isCalculationReady ? `| ${pct(roi)}` : ""}
                </strong>
              </div>
            </div>
          </div>
          <div className="legs">
            {legs.map((leg, index) => (
              <LegRow
                key={leg.id}
                leg={leg}
                index={index}
                bookmakers={bookmakers}
                creditSources={creditSources}
                scenarioResult={scenarioResults[index]}
                update={(patch) => updateLeg(leg.id, patch)}
                updateStake={(stake) => updateLegStake(leg.id, index, stake)}
                remove={() => setLegs(legs.filter((x) => x.id !== leg.id))}
              />
            ))}
          </div>
          <button
            className="add-leg"
            onClick={() =>
              setLegs((current) =>
                rebalanceLegs([
                  ...current,
                  {
                    id: uid(),
                    bookmakerId: "",
                    stake: "",
                    odd: "",
                    commission: 0,
                    cashback: 0,
                    increase: 0,
                    result: "PENDING",
                  },
                ]),
              )
            }
          >
            ＋ Adicionar outra entrada
          </button>
        </article>
        <div className="editor-bottom">
          <article className="panel notes">
            <span className="card-label">OBSERVAÇÕES</span>
            <textarea placeholder="Adicione informações importantes sobre esta operação..." />
          </article>
          <article className="panel calculation">
            <span className="card-label">RESUMO DO CÁLCULO</span>
            <div>
              <span>Total apostado</span>
              <strong>{money.format(total)}</strong>
            </div>
            <div>
              <span>Pior retorno</span>
              <strong>{money.format(protectedReturn)}</strong>
            </div>
            <div className="calculation-result">
              <span>Lucro garantido</span>
              <strong>+ {money.format(profit)}</strong>
            </div>
          </article>
        </div>
      </section>
    </>
  );
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("login");
  const [logged, setLogged] = useState(false);
  const [user, setUser] = useState<SessionUser>();
  const [bookmakers, setBookmakers] = useState<Bookmaker[]>([]);
  const [surebets, setSurebets] = useState<Surebet[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData>();
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const refresh = useCallback(async () => {
    const [accounts, operations, metrics] = await Promise.all([
      bookmakersApi.list(),
      operationsApi.list(),
      dashboardApi.monthly(month),
    ]);
    setBookmakers(accounts.data.map(mapBookmaker));
    setSurebets(operations.data.map(mapOperation));
    setDashboard(metrics);
  }, [month]);
  useEffect(() => {
    authApi
      .me()
      .then(async (response) => {
        setUser(response.user);
        setLogged(true);
        setScreen("dashboard");
        await refresh();
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [refresh]);
  const navigate = (s: Screen) => setScreen(s);
  const input = (surebet: Surebet): OperationInput => ({
    eventName: surebet.event,
    generatesBetCredit: !!surebet.generatesBetCredit,
    expectedBetCredit: surebet.generatesBetCredit
      ? Number(surebet.expectedBetCredit ?? 0).toFixed(2)
      : undefined,
    legs: surebet.legs.map((leg) => ({
      bookmakerAccountId: leg.bookmakerId,
      stake: Number(leg.stake).toFixed(2),
      odd: Number(leg.odd).toString(),
      commissionPercent: leg.commission.toString(),
      cashbackPercent: leg.cashback.toString(),
      increasePercent: leg.increase.toString(),
      usesBetCredit: !!leg.usesBetCredit,
      usesFreeBetCredit: !!leg.usesFreeBetCredit,
      betCreditId: leg.usesBetCredit ? leg.creditSourceSurebetId : undefined,
    })),
  });
  const save = async (surebet: Surebet, stay = false) => {
    const previous = surebets.find((operation) => operation.id === surebet.id);
    let successMessage = "Surebet salva com sucesso.";
    if (previous?.status === "WAITING_CREDIT_USE") {
      await operationsApi.correctGeneratedCredit(
        previous,
        Number(surebet.expectedBetCredit ?? 0).toFixed(2),
      );
      successMessage = "Valor do crédito corrigido com sucesso.";
    } else if (
      previous &&
      previous.status === "OPEN" &&
      surebet.status !== "OPEN"
    ) {
      await operationsApi.settle(
        previous,
        surebet.legs.map((leg) => ({
          legId: leg.id,
          result: leg.result as "WON" | "LOST",
        })),
        surebet.generatesBetCredit ? surebet.creditGenerated : undefined,
        surebet.creditGenerated
          ? Number(surebet.expectedBetCredit ?? 0).toFixed(2)
          : undefined,
      );
      successMessage = surebet.creditGenerated
        ? "Surebet finalizada e crédito disponibilizado."
        : "Surebet finalizada com sucesso.";
    } else if (previous) {
      await operationsApi.update(previous.id, previous.version, input(surebet));
      successMessage = "Alterações salvas com sucesso.";
    } else {
      await operationsApi.create(input(surebet));
      successMessage = "Surebet criada com sucesso.";
    }
    await refresh();
    showToast("success", "Operação concluída", successMessage);
    if (!stay) setScreen("surebets");
  };
  const authenticate = async (
    kind: "login" | "register" | "recover",
    values: { email: string; password: string; cpf: string },
  ) => {
    if (kind === "recover") {
      await authApi.recover(values.email, values.cpf);
      setScreen("login");
      showToast(
        "success",
        "Recuperação solicitada",
        "Confira seu e-mail para continuar a troca de senha.",
      );
      return;
    }
    const response =
      kind === "login"
        ? await authApi.login(values.email, values.password)
        : await authApi.register(values.email, values.password, values.cpf);
    setUser(response.user);
    setLogged(true);
    setScreen("dashboard");
    await refresh();
    showToast(
      "success",
      kind === "login" ? "Login realizado" : "Conta criada",
      kind === "login"
        ? "Bem-vindo de volta."
        : "Sua conta foi criada com sucesso.",
    );
  };
  const logout = async () => {
    try {
      await authApi.logout();
      showToast("success", "Sessão encerrada", "Você saiu da sua conta.");
    } catch (failure) {
      showToast(
        "error",
        "Erro ao encerrar sessão",
        errorMessage(failure, "A sessão local será encerrada mesmo assim."),
      );
    }
    setLogged(false);
    setUser(undefined);
    setBookmakers([]);
    setSurebets([]);
    setDashboard(undefined);
    setScreen("login");
  };
  const addBookmaker = async (name: string, balance: string) => {
    await bookmakersApi.create(name, Number(balance).toFixed(2));
    await refresh();
  };
  const deleteSurebet = async (surebet: Surebet) => {
    try {
      await operationsApi.delete(surebet);
      await refresh();
      showToast(
        "success",
        "Surebet excluída",
        "Os saldos das casas foram estornados com sucesso.",
      );
    } catch (failure) {
      showToast(
        "error",
        "Não foi possível excluir",
        errorMessage(failure, "Tente novamente."),
      );
    }
  };
  const markCreditAsLost = async (surebet: Surebet) => {
    try {
      await operationsApi.expireGeneratedCredit(surebet);
      await refresh();
      showToast(
        "success",
        "Crédito marcado como perdido",
        "A surebet foi finalizada com seu resultado original.",
      );
    } catch (failure) {
      showToast(
        "error",
        "Não foi possível finalizar",
        errorMessage(failure, "Tente novamente."),
      );
    }
  };
  const body = (() => {
    if (screen === "dashboard")
      return (
        <Dashboard
          surebets={surebets}
          bookmakers={bookmakers}
          navigate={navigate}
          dashboard={dashboard}
          month={month}
          onMonthChange={setMonth}
        />
      );
    if (screen === "bookmakers")
      return (
        <Bookmakers
          bookmakers={bookmakers}
          onAdd={addBookmaker}
          onRefresh={refresh}
        />
      );
    if (screen === "surebets")
      return (
        <Surebets
          surebets={surebets}
          bookmakers={bookmakers}
          navigate={navigate}
          save={save}
          onDelete={deleteSurebet}
          onCreditLost={markCreditAsLost}
        />
      );
    return (
      <Editor
        bookmakers={bookmakers}
        surebets={surebets}
        onSave={save}
        cancel={() => setScreen("surebets")}
      />
    );
  })();
  if (loading)
    return (
      <main className="auth-shell">
        <section className="auth-panel">
          <div className="auth-card">
            <h2>Carregando...</h2>
          </div>
        </section>
      </main>
    );
  if (!logged || !user)
    return (
      <AuthScreen
        screen={screen}
        setScreen={setScreen}
        onAuthenticate={authenticate}
      />
    );
  return (
    <div className="app-shell">
      <Sidebar
        screen={screen}
        navigate={navigate}
        logout={() => void logout()}
        user={user}
      />
      <main className="workspace">{body}</main>
    </div>
  );
}
