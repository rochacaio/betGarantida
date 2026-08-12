"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Screen = "login" | "register" | "recover" | "dashboard" | "bookmakers" | "surebets" | "editor";
type Bookmaker = { id: string; name: string; balance: number; color: string };
type Leg = { id: string; bookmakerId: string; stake: number; odd: number; commission: number; cashback: number; increase: number; result: "PENDING" | "WON" | "LOST"; usesBetCredit?: boolean; creditSourceSurebetId?: string };
type Surebet = { id: string; title: string; event: string; date: string; status: "OPEN" | "SETTLED"; profit: number; roi: number; legs: Leg[]; generatesBetCredit?: boolean; expectedBetCredit?: number };

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const pct = (value: number) => `${value.toFixed(2).replace(".", ",")}%`;
const uid = () => Math.random().toString(36).slice(2, 10);

const initialBookmakers: Bookmaker[] = [
  { id: "bet365", name: "bet365", balance: 1840.5, color: "#f4c542" },
  { id: "betano", name: "Betano", balance: 925.3, color: "#ff6a2a" },
  { id: "superbet", name: "Superbet", balance: 612.8, color: "#ec3d57" },
];

const initialSurebets: Surebet[] = [
  {
    id: "op-1042", title: "Arbitragem #1042", event: "Palmeiras x Corinthians", date: "12 ago, 14:30", status: "OPEN", profit: 15.38, roi: 2.63,
    legs: [
      { id: "a", bookmakerId: "bet365", stake: 100, odd: 3, commission: 0, cashback: 0, increase: 0, result: "PENDING" },
      { id: "b", bookmakerId: "betano", stake: 115.38, odd: 2.6, commission: 0, cashback: 0, increase: 0, result: "PENDING" },
      { id: "c", bookmakerId: "superbet", stake: 76.92, odd: 3.9, commission: 0, cashback: 0, increase: 0, result: "PENDING" },
    ],
  },
  {
    id: "op-1038", title: "Arbitragem #1038", event: "Flamengo x Grêmio", date: "08 ago, 21:00", status: "SETTLED", profit: 28.4, roi: 4.18, generatesBetCredit: true, expectedBetCredit: 50,
    legs: [
      { id: "a", bookmakerId: "betano", stake: 280, odd: 2.42, commission: 0, cashback: 0, increase: 0, result: "WON" },
      { id: "b", bookmakerId: "bet365", stake: 399.3, odd: 1.7, commission: 0, cashback: 0, increase: 0, result: "LOST" },
    ],
  },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

function AuthScreen({ screen, setScreen, onLogin }: { screen: Screen; setScreen: (s: Screen) => void; onLogin: () => void }) {
  const submit = (event: FormEvent) => { event.preventDefault(); if (screen === "recover") setScreen("login"); else onLogin(); };
  const content = {
    login: { eyebrow: "Bem-vindo de volta", title: "Acesse sua conta", text: "Suas entradas, saldos e resultados em um só lugar.", action: "Entrar" },
    register: { eyebrow: "Comece agora", title: "Crie sua conta", text: "Organize suas operações e acompanhe seus resultados.", action: "Criar minha conta" },
    recover: { eyebrow: "Recuperar acesso", title: "Troque sua senha", text: "Confirme seus dados para definir uma nova senha.", action: "Atualizar senha" },
  }[screen as "login" | "register" | "recover"];

  return (
    <main className="auth-shell">
      <section className="auth-brand">
        <div className="brand brand-large"><span className="brand-mark">BG</span><span>BetGarantida</span></div>
        <div className="auth-pitch">
          <span className="eyebrow">CONTROLE SEM COMPLICAÇÃO</span>
          <h1>Mais clareza.<br /><em>Menos medo.</em></h1>
          <p>Calcule, registre e acompanhe cada operação. Saiba exatamente onde está seu dinheiro e quanto ele está rendendo.</p>
        </div>
        <div className="auth-proof"><span>✓</span><div><strong>Seu histórico financeiro, preservado.</strong><small>Da entrada ao resultado final.</small></div></div>
      </section>
      <section className="auth-panel">
        <form className="auth-card" onSubmit={submit}>
          <span className="eyebrow">{content.eyebrow}</span>
          <h2>{content.title}</h2>
          <p>{content.text}</p>
          {screen === "register" && <Field label="CPF"><input required inputMode="numeric" placeholder="000.000.000-00" /></Field>}
          {screen === "recover" && <Field label="CPF"><input required inputMode="numeric" placeholder="000.000.000-00" /></Field>}
          <Field label="E-mail"><input required type="email" defaultValue={screen === "login" ? "demo@betgarantida.com" : ""} placeholder="voce@email.com" /></Field>
          <Field label={screen === "recover" ? "Nova senha" : "Senha"}><input required type="password" defaultValue={screen === "login" ? "12345678" : ""} placeholder="Mínimo de 8 caracteres" /></Field>
          {screen === "login" && <button type="button" className="text-button right" onClick={() => setScreen("recover")}>Esqueci minha senha</button>}
          <button className="primary wide" type="submit">{content.action}<span>→</span></button>
          {screen === "login" ? <p className="auth-switch">Ainda não tem conta? <button type="button" onClick={() => setScreen("register")}>Criar conta</button></p> : <p className="auth-switch">Já tem uma conta? <button type="button" onClick={() => setScreen("login")}>Voltar ao login</button></p>}
        </form>
      </section>
    </main>
  );
}

function Sidebar({ screen, navigate, logout }: { screen: Screen; navigate: (s: Screen) => void; logout: () => void }) {
  const nav = [
    ["dashboard", "⌂", "Visão geral"], ["surebets", "↗", "Minhas entradas"], ["editor", "+", "Nova surebet"], ["bookmakers", "▣", "Casas de aposta"],
  ] as const;
  return <aside className="sidebar">
    <button className="brand" onClick={() => navigate("dashboard")}><span className="brand-mark">BG</span><span>BetGarantida</span></button>
    <nav>{nav.map(([id, icon, label]) => <button key={id} className={screen === id ? "active" : ""} onClick={() => navigate(id)}><span>{icon}</span>{label}</button>)}</nav>
    <div className="sidebar-bottom"><div className="user"><span>CR</span><div><strong>Caio Ribeiro</strong><small>demo@betgarantida.com</small></div></div><button className="logout" onClick={logout}>Sair</button></div>
  </aside>;
}

function Topbar({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return <header className="topbar"><div><h1>{title}</h1><p>{subtitle}</p></div>{action}</header>;
}

function Dashboard({ surebets, bookmakers, navigate }: { surebets: Surebet[]; bookmakers: Bookmaker[]; navigate: (s: Screen) => void }) {
  const settled = surebets.filter(s => s.status === "SETTLED");
  const profit = settled.reduce((sum, s) => sum + s.profit, 0) + 313.85;
  const months = [38, 54, 45, 68, 58, 81, 72, 92, 66, 84, 74, 96];
  return <>
    <Topbar title="Visão geral" subtitle="Acompanhe seu desempenho em agosto" action={<div className="header-actions"><button className="month-select">‹</button><button className="month-pill">Agosto 2026⌄</button><button className="month-select">›</button><button className="primary" onClick={() => navigate("editor")}>+ Nova surebet</button></div>} />
    <section className="content">
      <div className="hero-grid">
        <article className="profit-card"><span className="card-label">RESULTADO DO MÊS</span><strong>{money.format(profit)}</strong><div className="positive">↗ 18,4% em relação a julho</div><div className="sparkline">{months.map((h, i) => <i key={i} style={{ height: `${h}%` }} className={i === 11 ? "current" : ""} />)}</div></article>
        <article className="metric-card"><span className="metric-icon green">↗</span><div><span>Lucro realizado</span><strong>{money.format(370.65)}</strong><small>12 entradas liquidadas</small></div></article>
        <article className="metric-card"><span className="metric-icon red">↘</span><div><span>Perdas</span><strong>{money.format(28.4)}</strong><small>2 operações negativas</small></div></article>
        <article className="metric-card"><span className="metric-icon amber">%</span><div><span>ROI mensal</span><strong>7,82%</strong><small>+1,3 p.p. no período</small></div></article>
      </div>
      <div className="dashboard-grid">
        <article className="panel chart-panel"><div className="panel-head"><div><span className="card-label">EVOLUÇÃO DO RESULTADO</span><h3>Ganhos e perdas</h3></div><div className="legend"><span><i className="dot green-dot" />Lucro</span><span><i className="dot red-dot" />Perda</span></div></div><div className="chart"><div className="chart-lines"><span>R$ 400</span><span>R$ 300</span><span>R$ 200</span><span>R$ 100</span><span>R$ 0</span></div><div className="chart-area"><div className="chart-fill" /><div className="chart-path">●</div><div className="axis"><span>01 ago</span><span>08 ago</span><span>15 ago</span><span>22 ago</span><span>31 ago</span></div></div></div></article>
        <article className="panel"><div className="panel-head"><div><span className="card-label">PATRIMÔNIO</span><h3>Saldo por casa</h3></div><button className="text-button" onClick={() => navigate("bookmakers")}>Ver todas</button></div><div className="balance-total"><span>Saldo disponível</span><strong>{money.format(bookmakers.reduce((s, b) => s + b.balance, 0))}</strong></div><div className="bookmaker-mini-list">{bookmakers.map(b => <div key={b.id}><span className="bookmaker-avatar" style={{ background: b.color }}>{b.name.slice(0, 2).toUpperCase()}</span><strong>{b.name}</strong><span>{money.format(b.balance)}</span></div>)}</div></article>
      </div>
      <article className="panel recent"><div className="panel-head"><div><span className="card-label">ATIVIDADE RECENTE</span><h3>Últimas entradas</h3></div><button className="text-button" onClick={() => navigate("surebets")}>Ver histórico completo →</button></div><SurebetTable surebets={surebets.slice(0, 4)} bookmakers={bookmakers} /></article>
    </section>
  </>;
}

function SurebetTable({ surebets, bookmakers, onEdit }: { surebets: Surebet[]; bookmakers: Bookmaker[]; onEdit?: (s: Surebet) => void }) {
  return <div className="table-wrap"><table><thead><tr><th>Entrada</th><th>Casas</th><th>Investido</th><th>Resultado</th><th>ROI</th><th>Status</th><th /></tr></thead><tbody>{surebets.map(s => <tr key={s.id}><td><strong>{s.event}</strong><small>{s.title} · {s.date}</small></td><td><div className="avatar-stack">{s.legs.map(l => { const b = bookmakers.find(x => x.id === l.bookmakerId); return <span key={l.id} style={{ background: b?.color }}>{b?.name.slice(0, 2).toUpperCase()}</span>; })}</div></td><td>{money.format(s.legs.reduce((a, l) => a + l.stake, 0))}</td><td className={s.profit >= 0 ? "positive-text" : "negative-text"}>{s.status === "OPEN" ? "—" : `+ ${money.format(s.profit)}`}</td><td>{s.status === "OPEN" ? "—" : pct(s.roi)}</td><td><span className={`status ${s.status.toLowerCase()}`}>{s.status === "OPEN" ? "Em aberto" : "Liquidada"}</span></td><td><button className="icon-button" onClick={() => onEdit?.(s)}>•••</button></td></tr>)}</tbody></table></div>;
}

function Bookmakers({ bookmakers, setBookmakers }: { bookmakers: Bookmaker[]; setBookmakers: (b: Bookmaker[]) => void }) {
  const [modal, setModal] = useState(false); const [name, setName] = useState(""); const [balance, setBalance] = useState("");
  const add = (e: FormEvent) => { e.preventDefault(); setBookmakers([...bookmakers, { id: uid(), name, balance: Number(balance), color: ["#4e8cff", "#a469ff", "#ff5d7a"][bookmakers.length % 3] }]); setName(""); setBalance(""); setModal(false); };
  const total = bookmakers.reduce((s, b) => s + b.balance, 0);
  return <>
    <Topbar title="Casas de aposta" subtitle="Gerencie suas contas e acompanhe onde está seu saldo" action={<button className="primary" onClick={() => setModal(true)}>+ Adicionar casa</button>} />
    <section className="content"><div className="summary-strip"><div><span>Saldo total disponível</span><strong>{money.format(total)}</strong></div><div><span>Casas ativas</span><strong>{bookmakers.length}</strong></div><div><span>Em apostas abertas</span><strong>{money.format(292.3)}</strong></div><div><span>Patrimônio total</span><strong>{money.format(total + 292.3)}</strong></div></div>
      <div className="section-heading"><div><span className="card-label">SUAS CONTAS</span><h2>Onde está seu dinheiro</h2></div><div className="search">⌕ <input placeholder="Buscar casa..." /></div></div>
      <div className="bookmaker-grid">{bookmakers.map((b, i) => <article className="bookmaker-card" key={b.id}><div className="bookmaker-card-top"><span className="bookmaker-logo" style={{ background: b.color }}>{b.name.slice(0, 2).toUpperCase()}</span><button className="icon-button">•••</button></div><h3>{b.name}</h3><span className="muted">Conta principal</span><div className="balance-block"><span>Saldo disponível</span><strong>{money.format(b.balance)}</strong></div><div className="bookmaker-stats"><div><span>Em apostas</span><strong>{i === 0 ? money.format(100) : "R$ 0,00"}</strong></div><div><span>Resultado no mês</span><strong className="positive-text">+ {money.format(62.4 + i * 31)}</strong></div></div><button className="secondary wide">Ver extrato <span>→</span></button></article>)}</div>
    </section>
    {modal && <div className="modal-backdrop" onMouseDown={() => setModal(false)}><form className="modal" onMouseDown={e => e.stopPropagation()} onSubmit={add}><div className="modal-head"><div><span className="card-label">NOVA CONTA</span><h2>Adicionar casa de aposta</h2></div><button type="button" onClick={() => setModal(false)}>×</button></div><p>Cadastre a casa e o valor que está disponível nela hoje.</p><Field label="Nome da casa"><input required value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Bet365" /></Field><Field label="Saldo inicial"><div className="money-input"><span>R$</span><input required type="number" min="0" step="0.01" value={balance} onChange={e => setBalance(e.target.value)} placeholder="0,00" /></div></Field><div className="modal-actions"><button type="button" className="secondary" onClick={() => setModal(false)}>Cancelar</button><button className="primary">Adicionar casa</button></div></form></div>}
  </>;
}

function Surebets({ surebets, bookmakers, navigate, save }: { surebets: Surebet[]; bookmakers: Bookmaker[]; navigate: (s: Screen) => void; save: (s: Surebet, stay?: boolean) => void }) {
  const [editing, setEditing] = useState<Surebet>();
  return <><Topbar title="Minhas entradas" subtitle="Consulte, acompanhe e liquide suas operações" action={<button className="primary" onClick={() => navigate("editor")}>+ Nova surebet</button>} /><section className="content"><div className="tabs"><button className="active">Todas <span>{surebets.length}</span></button><button>Em aberto <span>{surebets.filter(s => s.status === "OPEN").length}</span></button><button>Liquidadas <span>{surebets.filter(s => s.status === "SETTLED").length}</span></button></div><article className="panel list-panel"><div className="filters"><div className="search grow">⌕ <input placeholder="Buscar por evento ou casa..." /></div><button className="secondary">Agosto 2026⌄</button><button className="secondary">Filtros</button></div><SurebetTable surebets={surebets} bookmakers={bookmakers} onEdit={setEditing} /></article></section>{editing && <div className="edit-drawer-backdrop" onMouseDown={() => setEditing(undefined)}><div className="edit-drawer" onMouseDown={e => e.stopPropagation()}><Editor bookmakers={bookmakers} surebets={surebets} editing={editing} embedded onSave={updated => { save(updated, true); setEditing(undefined); }} cancel={() => setEditing(undefined)} /></div></div>}</>;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} className={`toggle ${checked ? "on" : ""}`} onClick={() => onChange(!checked)}><i /><span>{label}</span></button>;
}

function LegRow({ leg, index, bookmakers, creditSources, update, remove }: { leg: Leg; index: number; bookmakers: Bookmaker[]; creditSources: Surebet[]; update: (patch: Partial<Leg>) => void; remove: () => void }) {
  const b = bookmakers.find(x => x.id === leg.bookmakerId);
  const effectiveOdd = 1 + (leg.odd - 1) * (1 + leg.increase / 100) * (1 - leg.commission / 100);
  return <div className="leg-row-wrap"><div className="leg-row"><div className="leg-number">{String.fromCharCode(65 + index)}</div><Field label="Casa de aposta"><select value={leg.bookmakerId} onChange={e => update({ bookmakerId: e.target.value })}><option value="">Selecione a casa</option>{bookmakers.map(x => <option key={x.id} value={x.id}>{x.name} · {money.format(x.balance)}</option>)}</select></Field><Field label="Valor"><div className="money-input compact"><span>R$</span><input type="number" min="0" step="0.01" value={leg.stake} onChange={e => update({ stake: Number(e.target.value) })} /></div></Field><Field label="ODD"><input type="number" min="1.01" step="0.01" value={leg.odd} onChange={e => update({ odd: Number(e.target.value) })} /></Field><Field label="Comissão"><div className="percent-input"><input type="number" min="0" max="99" value={leg.commission} onChange={e => update({ commission: Number(e.target.value) })} /><span>%</span></div></Field><Field label="Cashback"><div className="percent-input"><input type="number" min="0" value={leg.cashback} onChange={e => update({ cashback: Number(e.target.value) })} /><span>%</span></div></Field><Field label="Aumento"><div className="percent-input"><input type="number" min="0" value={leg.increase} onChange={e => update({ increase: Number(e.target.value) })} /><span>%</span></div></Field><div className="effective"><span>ODD efetiva</span><strong>{effectiveOdd.toFixed(3)}</strong><small>{b?.name}</small></div>{index > 1 && <button className="remove-leg" onClick={remove}>−</button>}</div><div className="leg-credit"><Toggle label="Usar crédito de aposta nesta entrada" checked={!!leg.usesBetCredit} onChange={value => update({ usesBetCredit: value, creditSourceSurebetId: value ? leg.creditSourceSurebetId : undefined })} />{leg.usesBetCredit && <Field label="Crédito gerado pela surebet"><select value={leg.creditSourceSurebetId ?? ""} onChange={e => update({ creditSourceSurebetId: e.target.value })}><option value="">Selecione a origem do crédito</option>{creditSources.map(source => <option key={source.id} value={source.id}>{source.event} · {money.format(source.expectedBetCredit ?? 0)}</option>)}</select></Field>}</div></div>;
}

function Editor({ bookmakers, surebets, editing, onSave, cancel, embedded = false }: { bookmakers: Bookmaker[]; surebets: Surebet[]; editing?: Surebet; onSave: (s: Surebet) => void; cancel: () => void; embedded?: boolean }) {
  const [event, setEvent] = useState(editing?.event ?? "Palmeiras x Corinthians");
  const [legs, setLegs] = useState<Leg[]>(editing?.legs ?? [
    { id: uid(), bookmakerId: "", stake: 100, odd: 3, commission: 0, cashback: 0, increase: 0, result: "PENDING" },
    { id: uid(), bookmakerId: "", stake: 115.38, odd: 2.6, commission: 0, cashback: 0, increase: 0, result: "PENDING" },
    { id: uid(), bookmakerId: "", stake: 76.92, odd: 3.9, commission: 0, cashback: 0, increase: 0, result: "PENDING" },
  ]);
  const [generatesBetCredit, setGeneratesBetCredit] = useState(!!editing?.generatesBetCredit);
  const [expectedBetCredit, setExpectedBetCredit] = useState(editing?.expectedBetCredit ?? 0);
  const creditSources = surebets.filter(s => s.generatesBetCredit && s.id !== editing?.id);
  const total = legs.reduce((s, l) => s + l.stake, 0);
  const returns = legs.map(l => l.stake * (1 + (l.odd - 1) * (1 + l.increase / 100) * (1 - l.commission / 100)));
  const profit = Math.max(0, Math.min(...returns) - total);
  const roi = total ? profit / total * 100 : 0;
  const save = () => onSave({ id: editing?.id ?? `op-${Date.now().toString().slice(-4)}`, title: editing?.title ?? `Arbitragem #${Date.now().toString().slice(-4)}`, event, date: editing?.date ?? "12 ago, agora", status: editing?.status ?? "OPEN", profit, roi, legs, generatesBetCredit, expectedBetCredit: generatesBetCredit ? expectedBetCredit : undefined });
  const header = <Topbar title={editing ? "Editar surebet" : "Nova surebet"} subtitle="Distribua as entradas e confira o retorno antes de salvar" action={<div className="header-actions"><button className="secondary" onClick={cancel}>Cancelar</button><button className="primary" onClick={save}>Salvar alterações</button></div>} />;
  return <>{!embedded && header}{embedded && <div className="drawer-header"><div><span className="card-label">EDIÇÃO DA ENTRADA</span><h2>{editing?.event}</h2><p>Altere os dados sem sair do histórico.</p></div><div className="header-actions"><button className="secondary" onClick={cancel}>Cancelar</button><button className="primary" onClick={save}>Salvar alterações</button></div></div>}<section className={`content editor-content ${embedded ? "embedded-editor" : ""}`}><div className="editor-intro"><div className="field event-field"><span>EVENTO OU IDENTIFICAÇÃO</span><input value={event} onChange={e => setEvent(e.target.value)} placeholder="Ex.: Palmeiras x Corinthians" /></div><div className="operation-summary"><div><span>Investimento</span><strong>{money.format(total)}</strong></div><div><span>Lucro estimado</span><strong className="positive-text">+ {money.format(profit)}</strong></div><div><span>ROI</span><strong className="positive-text">{pct(roi)}</strong></div></div></div><div className="credit-generator"><div><Toggle label="Esta surebet vai gerar crédito de aposta" checked={generatesBetCredit} onChange={setGeneratesBetCredit} /><p>Ao usar esse crédito em outra entrada, as duas operações ficarão vinculadas.</p></div>{generatesBetCredit && <Field label="Valor esperado do crédito"><div className="money-input"><span>R$</span><input type="number" min="0" step="0.01" value={expectedBetCredit} onChange={e => setExpectedBetCredit(Number(e.target.value))} /></div></Field>}</div>
      <article className="surebet-builder"><div className="builder-top"><div><span className="card-label">DISTRIBUIÇÃO DA SUREBET</span><h2>Entradas da operação</h2></div><div className="guarantee"><span>✓</span><div><small>Retorno garantido</small><strong>{money.format(Math.min(...returns))} | {pct(roi)}</strong></div></div></div><div className="legs">{legs.map((leg, index) => <LegRow key={leg.id} leg={leg} index={index} bookmakers={bookmakers} creditSources={creditSources} update={patch => setLegs(legs.map(x => x.id === leg.id ? { ...x, ...patch } : x))} remove={() => setLegs(legs.filter(x => x.id !== leg.id))} />)}</div><button className="add-leg" onClick={() => setLegs([...legs, { id: uid(), bookmakerId: "", stake: 0, odd: 2, commission: 0, cashback: 0, increase: 0, result: "PENDING" }])}>＋ Adicionar outra entrada</button></article>
      <div className="editor-bottom"><article className="panel notes"><span className="card-label">OBSERVAÇÕES</span><textarea placeholder="Adicione informações importantes sobre esta operação..." /></article><article className="panel calculation"><span className="card-label">RESUMO DO CÁLCULO</span><div><span>Total apostado</span><strong>{money.format(total)}</strong></div><div><span>Pior retorno</span><strong>{money.format(Math.min(...returns))}</strong></div><div className="calculation-result"><span>Lucro garantido</span><strong>+ {money.format(profit)}</strong></div></article></div>
    </section></>;
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("login");
  const [logged, setLogged] = useState(false);
  const [bookmakers, setBookmakers] = useState<Bookmaker[]>(initialBookmakers);
  const [surebets, setSurebets] = useState<Surebet[]>(initialSurebets);
  const [ready, setReady] = useState(false);
  useEffect(() => { try { const data = localStorage.getItem("betgarantida-demo"); if (data) { const parsed = JSON.parse(data); setBookmakers(parsed.bookmakers ?? initialBookmakers); setSurebets(parsed.surebets ?? initialSurebets); } } finally { setReady(true); } }, []);
  useEffect(() => { if (ready) localStorage.setItem("betgarantida-demo", JSON.stringify({ bookmakers, surebets })); }, [bookmakers, surebets, ready]);
  const navigate = (s: Screen) => setScreen(s);
  const save = (surebet: Surebet, stay = false) => { setSurebets(prev => prev.some(s => s.id === surebet.id) ? prev.map(s => s.id === surebet.id ? surebet : s) : [surebet, ...prev]); if (!stay) setScreen("surebets"); };
  const body = useMemo(() => {
    if (screen === "dashboard") return <Dashboard surebets={surebets} bookmakers={bookmakers} navigate={navigate} />;
    if (screen === "bookmakers") return <Bookmakers bookmakers={bookmakers} setBookmakers={setBookmakers} />;
    if (screen === "surebets") return <Surebets surebets={surebets} bookmakers={bookmakers} navigate={navigate} save={save} />;
    return <Editor bookmakers={bookmakers} surebets={surebets} onSave={save} cancel={() => setScreen("surebets")} />;
  }, [screen, surebets, bookmakers]);
  if (!logged) return <AuthScreen screen={screen} setScreen={setScreen} onLogin={() => { setLogged(true); setScreen("dashboard"); }} />;
  return <div className="app-shell"><Sidebar screen={screen} navigate={navigate} logout={() => { setLogged(false); setScreen("login"); }} /><main className="workspace">{body}</main></div>;
}
