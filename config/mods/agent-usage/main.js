import { View, div, svg } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { exec, hc, appHome, agents, terminals, panes, spaces, focused, layout, props, run, theme, notify, openOverlay, nextCommand } from "herdr";
import { WARN, URGENT, tokens, money, percent, ago, resetShort, resetLong, elapsed, levelColor, cacheHit, modelName, find } from "./format.js";

const PANEL = "panel";
const STACK = "panel-body";
const CHILD = "usage";
const LIMITS_MS = 10000;
const SESSIONS_MS = 5000;
const PID_RETRY_MS = 30000;
const CLEAR_ARM_MS = 3000;
const ICON = "mods/agent-usage/gauge.svg";
const STATUS_LABEL = { working: "working", blocked: "needs you", done: "done", idle: "idle", waiting: "waiting" };
const COST_TIP = "API list-price equivalent of the tokens, not what a subscription bills";

const script = () => `${appHome()}/mods/agent-usage/usage.py`;
const kindOf = (app) => (/codex/i.test(app ?? "") ? "codex" : /claude/i.test(app ?? "") ? "claude" : null);
const stop = (_e, cx) => cx.stop_propagation();
const WINDOW_1M = /(fable|mythos|opus|sonnet|haiku)-5|opus-4-[678]|sonnet-4-6/;

// Agents Herdr can't see (Windows ConPTY drops OSC 7501; Harry runs over ssh) report through cc.state
// labels, the same contract agent-columns' patches 0019/0020 read. Harry also puts its usage in hermes.usage.
function labelled() {
  const known = new Set(agents().map((a) => a.address));
  const byAddr = Object.fromEntries(terminals().map((t) => [t.address, t]));
  return panes().flatMap((p) => {
    const t = p.terminal && byAddr[p.terminal];
    const st = t?.labels?.["cc.state"];
    if (!t || known.has(p.terminal) || t.state !== "live" || !["idle", "working", "blocked", "done"].includes(st)) return [];
    const sp = spaces().find((x) => x.tabs.some((tb) => tb.id === p.tab));
    const hermes = t.labels["cc.agent"] === "hermes";
    return [{ address: p.terminal, pane: p.pane, space: sp?.id, tab: p.tab, tab_name: sp?.tabs.find((tb) => tb.id === p.tab)?.name,
      title: p.title, focused: p.focused, status: st, app: hermes ? "hermes" : "claude-code", labelled: true,
      usage: hermes ? t.labels["hermes.usage"] : null }];
  });
}

function hermesSession(json) {
  let u;
  try { u = JSON.parse(json ?? ""); } catch { return null; }
  if (!u?.id) return null;
  const bucket = (b) => ({ in: b.in ?? 0, out: b.out ?? 0, cr: b.cr ?? 0, cw: b.cw ?? 0, usd: b.usd ?? null, estimated: true });
  return { id: u.id, agent: "hermes", model: u.model, title: u.title, turns: u.calls, tools: u.tools, active: u.active || null,
    total: bucket(u), turn: bucket(u.turn ?? {}),
    ctx: { used: u.ctx ?? 0, window: WINDOW_1M.test(u.model ?? "") ? 1_000_000 : 200_000, base: 0, exact: false, growth: 0 } };
}

const focusAgent = (a) => a.labelled
  ? (run("space.select", { id: a.space }), run("tab.select", { id: a.tab }), run("pane.focus", { pane: a.pane }))
  : run("agent.focus", { terminal: a.address });

async function usage(cmd) {
  const r = await exec("python3", ["-I", script(), cmd], { timeout: 60000 });
  let out = null;
  try {
    out = JSON.parse(r.stdout);
  } catch {
    throw new Error((r.stderr || r.stdout).trim().split("\n").pop() || `usage.py exited ${r.code}`);
  }
  if (out?.error) throw new Error(out.error);
  return out;
}

function panelState() {
  const root = layout();
  const panel = find(root, PANEL), body = find(root, STACK);
  return { open: Boolean(panel && !panel.hidden && body?.active === CHILD), exists: Boolean(find(root, CHILD)) };
}

function openPanel() {
  run("layout.select", { stack: STACK, child: CHILD });
  run("layout.show", { id: PANEL });
}

function togglePanel() {
  if (panelState().open) run("layout.hide", { id: PANEL });
  else openPanel();
}

export default class AgentUsage extends View {
  init(_p, cx) {
    this.role = props()?.role === "strip" ? "strip" : "panel";
    this.token = Math.random().toString(36).slice(2, 10);
    this.providers = null;
    this.sessions = [];
    this.error = null;
    this.busy = false;
    this.last = 0;
    this.pids = new Map();
    this.armed = {};
    this.view = this.load("view", "session");
    this.scope = this.load("scope", "space");
    this.alerts = this.loadJson("alerts", {});
    this.height = 0;
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        await this.command(c, cx);
        cx.notify();
      }
    });
    cx.timer.every(1000, (cx) => this.tick(cx));
    this.tick(cx);
  }

  load(key, fallback) {
    try {
      return localStorage.getItem(key) ?? fallback;
    } catch {
      return fallback;
    }
  }

  loadJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
    } catch {
      return fallback;
    }
  }

  save(key, value) {
    try {
      localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
    } catch {}
  }

  tick(cx) {
    if (this.busy) return;
    const strip = this.role === "strip";
    if (!strip && !panelState().open) return;
    if (Date.now() - this.last < (strip ? LIMITS_MS : SESSIONS_MS)) return;
    this.refresh(cx);
  }

  refresh(cx) {
    this.busy = true;
    this.last = Date.now();
    const strip = this.role === "strip";
    cx.spawn(async (cx) => {
      try {
        const r = await usage(strip ? "limits" : "all");
        this.providers = r.providers ?? [];
        this.now = r.now;
        if (strip) this.alert(this.providers);
        else {
          this.sessions = r.sessions ?? [];
          await this.resolve();
        }
        this.error = null;
      } catch (e) {
        this.error = String(e?.message ?? e);
      }
      this.busy = false;
      if (strip) this.fit();
      cx.notify();
    });
  }

  async command(c, cx) {
    if (c === `connect-${this.token}`) return this.change("connect", cx);
    if (c === `disconnect-${this.token}`) return this.change("disconnect", cx);
    if (this.role !== "strip") return;
    if (c === "toggle") togglePanel();
    else if (c === "open") openPanel();
  }

  async change(cmd, cx) {
    try {
      const r = await usage(cmd);
      notify({
        title: cmd === "connect" ? "Claude Code connected" : "Claude Code disconnected",
        body: cmd === "connect" ? "Plan limits show after the next Claude reply." : `statusLine restored in ${r.settings}.`,
        level: "success",
        timeout: 5000,
      });
    } catch (e) {
      notify({ title: `Couldn't ${cmd} Claude Code`, body: String(e?.message ?? e), level: "error" });
    }
    this.last = 0;
    this.refresh(cx);
  }

  ask(cmd) {
    const connect = cmd === "connect";
    openOverlay({
      mod: "confirm",
      kind: "dialog",
      width: 480,
      height: connect ? 300 : 240,
      props: {
        title: connect ? "Connect Claude Code?" : "Disconnect Claude Code?",
        detail: connect
          ? "Puts mods/agent-usage/tap.sh in front of the statusLine command in Claude Code's settings.json. After each reply, Claude Code passes its plan limits to the statusline; tap.sh saves them under data/agent-usage and hands the input on unchanged, so your statusline looks the same. A copy of settings.json is kept in data/agent-usage/settings.backup.json. Disconnect restores the command."
          : "Takes tap.sh out of the statusLine command in Claude Code's settings.json and restores what was there before Connect, keeping any edit you made to your own command.",
        command: { name: `agent-usage.${cmd}-${this.token}` },
      },
    });
  }

  alert(providers) {
    const now = Date.now();
    for (const [k, resets] of Object.entries(this.alerts)) if (resets && resets < now) delete this.alerts[k];
    for (const p of providers) {
      if (!p.connected) continue;
      for (const w of p.windows ?? []) {
        if (w.expired || w.used < WARN) continue;
        const level = w.used >= URGENT ? "urgent" : "warn";
        const key = `${p.id}:${w.key}:${w.resets}:${level}`;
        if (key in this.alerts) continue;
        this.alerts[key] = w.resets ?? now + 7 * 864e5;
        notify({
          title: `${p.name} ${w.label} limit at ${percent(w.used)}`,
          body: resetLong(w.resets, now),
          level: level === "urgent" ? "error" : "warning",
          action: { name: "agent-usage.open" },
        });
      }
    }
    this.save("alerts", this.alerts);
  }

  fit() {
    const block = props()?.block;
    if (!block) return;
    const providers = this.providers ?? [];
    let h = 10 + 18;
    if (!providers.length || this.error) h += 20 + (providers.length ? 8 : 0);
    for (const [i, p] of providers.entries()) {
      const rows = this.rowsOf(p);
      h += (i ? 8 : 0) + 16 + 4 + (rows ? rows * 16 + (rows - 1) * 4 : 20);
    }
    if (h === this.height) return;
    this.height = h;
    run("layout.resize", { id: block, px: h });
  }

  rowsOf(p) {
    return p.connected && p.windows?.length ? p.windows.length : 0;
  }

  async resolve() {
    const now = Date.now();
    const known = new Set(this.sessions.map((s) => s.pid).filter(Boolean));
    const wanted = agents().filter((a) => kindOf(a.app));
    for (const a of wanted) {
      const cached = this.pids.get(a.address);
      if (cached && (known.has(cached.pid) || now - cached.at < PID_RETRY_MS)) continue;
      try {
        const r = await hc(["get", a.address, "--json"]);
        const fg = JSON.parse(r.stdout)?.foreground;
        this.pids.set(a.address, { pid: fg?.pid ?? null, cwd: fg?.cwd ?? null, at: now });
      } catch {
        this.pids.set(a.address, { pid: null, cwd: null, at: now });
      }
    }
    const live = new Set(wanted.map((a) => a.address));
    for (const k of [...this.pids.keys()]) if (!live.has(k)) this.pids.delete(k);
  }

  match(list) {
    const out = new Map(), taken = new Set();
    for (const a of list) {
      const h = a.labelled && hermesSession(a.usage);
      if (h) out.set(a.address, h);
    }
    for (const a of list) {
      const info = this.pids.get(a.address);
      if (kindOf(a.app) !== "claude" || !info?.pid) continue;
      const s = this.sessions.find((x) => x.agent === "claude" && x.pid === info.pid);
      if (s) {
        out.set(a.address, s);
        taken.add(s.id);
      }
    }
    const codex = this.sessions.filter((x) => x.agent === "codex").sort((a, b) => (b.mtime ?? 0) - (a.mtime ?? 0));
    for (const a of list) {
      if (kindOf(a.app) !== "codex") continue;
      const cwd = this.pids.get(a.address)?.cwd;
      const s = codex.find((x) => !taken.has(x.id) && (!cwd || x.cwd === cwd));
      if (s) {
        out.set(a.address, s);
        taken.add(s.id);
      }
    }
    return out;
  }

  rows() {
    const space = focused()?.space;
    const all = [...agents(), ...labelled()];
    const shown = this.scope === "all" ? all : all.filter((a) => a.space === space);
    const parentOf = new Map(terminals().map((t) => [t.address, t.parent ?? null]));
    const addresses = new Set(shown.map((a) => a.address));
    const children = new Map();
    const roots = [];
    for (const a of shown) {
      const parent = parentOf.get(a.address);
      if (parent && addresses.has(parent)) {
        if (!children.has(parent)) children.set(parent, []);
        children.get(parent).push(a);
      } else roots.push(a);
    }
    const out = [];
    const walk = (a, depth) => {
      const kids = children.get(a.address) ?? [];
      const busy = kids.some((k) => k.status === "working" || k.status === "blocked");
      const status = a.status === "blocked" ? "blocked" : busy ? "waiting" : a.status;
      out.push({ agent: a, depth, status });
      for (const k of kids) walk(k, depth + 1);
    };
    for (const a of roots) walk(a, 0);
    return out;
  }

  render() {
    return this.role === "strip" ? this.renderStrip() : this.renderPanel();
  }

  limitRow(p, w, wide) {
    const t = theme(), now = Date.now();
    const used = w.expired ? 0 : w.used;
    const color = levelColor(used, t);
    const e = wide ? elapsed(w, now) : null;
    const label = w.expired ? "--" : percent(w.used);
    const money_ = w.usd != null && w.limit_usd != null ? ` · $${Math.round(w.usd)} of $${Math.round(w.limit_usd)}` : "";
    return h_flex().id(`lim-${p.id}-${w.key}`).h(16).gap(8).items_center().text_size(11)
      .tooltip(resetLong(w.resets, now) + money_)
      .child(div().w(wide ? 40 : 34).flex_none().text_color(t.muted).child(w.label))
      .child(div().flex_1().min_w(0).h(wide ? 6 : 5).relative().rounded(3).bg(t.raised)
        .when(used > 0, (el) => el.child(div().absolute().top(0).bottom(0).left(0).w(`${Math.min(100, used)}%`).rounded(3).bg(color)))
        .when(e !== null, (el) => el.child(div().absolute().top(-2).bottom(-2).w(2).rounded(1).bg(t.foreground).opacity(0.7).left(`${Math.min(99, e * 100)}%`))))
      .child(div().w(34).flex_none().text_right().font_semibold().text_color(w.expired ? t.dim : used >= WARN ? color : t.foreground).child(label))
      .child(div().w(wide ? 92 : 54).flex_none().text_right().text_color(t.dim).truncate().child(w.expired ? "reset" : wide ? resetLong(w.resets, now).replace(/^Resets /, "") : resetShort(w.resets, now)));
  }

  provider(p, wide) {
    const t = theme(), now = Date.now();
    const stale = p.updated && now - p.updated > 36e5;
    const head = h_flex().h(16).gap(6).items_center().text_size(11)
      .child(div().font_semibold().text_color(t.foreground).child(p.name))
      .when(Boolean(p.plan), (el) => el.child(div().text_color(t.dim).child(String(p.plan))))
      .child(div().flex_1())
      .when(Boolean(p.updated), (el) => el.child(div().text_color(stale ? t.working : t.dim).tooltip("When the last report arrived").child(ago(p.updated, now))))
      .when(wide && p.id === "claude" && p.connected, (el) => el.child(this.link("disconnect", "Disconnect", () => this.ask("disconnect"))));
    let body;
    if (p.error) body = this.note(p.error, t.blocked);
    else if (p.id === "claude" && !p.connected) {
      body = h_flex().id(`conn-${p.id}`).h(20).gap(8).items_center()
        .tooltip("Plan limits come from Claude Code's statusline. Connect adds tap.sh to it.")
        .child(div().flex_1().min_w(0).truncate().text_size(11).text_color(t.muted).child("Not connected"))
        .child(this.button("connect", "Connect", () => this.ask("connect")));
    } else if (!p.windows?.length) {
      body = this.note(p.id === "claude" ? "Limits arrive with the next Claude reply." : "No limits reported yet.", t.dim);
    } else body = v_flex().gap(4).opacity(stale ? 0.6 : 1).children(p.windows.map((w) => this.limitRow(p, w, wide)));
    return v_flex().gap(wide ? 6 : 4).child(head).child(body);
  }

  note(text, color) {
    return div().h(20).flex().items_center().text_size(11).text_color(color).truncate().child(text);
  }

  button(id, label, onClick) {
    const t = theme();
    return h_flex().id(`btn-${id}`).h(20).px(8).flex_none().items_center().rounded(5).text_size(11)
      .bg(t.solid).text_color(t.solid_foreground).cursor_pointer().hover((s) => s.opacity(0.88))
      .on_mouse_down("left", stop).on_click((_e, cx) => { cx.stop_propagation(); onClick(); }).child(label);
  }

  link(id, label, onClick) {
    const t = theme();
    return div().id(`link-${id}`).text_size(10.5).text_color(t.dim).cursor_pointer().hover((s) => s.text_color(t.foreground))
      .on_mouse_down("left", stop).on_click((_e, cx) => { cx.stop_propagation(); onClick(); }).child(label);
  }

  renderStrip() {
    const t = theme();
    const providers = this.providers ?? [];
    const open = panelState().open;
    return v_flex().id("root").size_full().px(8).pb(8).pt(2).bg(t.chrome)
      .child(v_flex().id("usage-card").w_full().p(8).gap(8).rounded(8).bg(t.surface).border(1)
        .border_color(open ? t.accent : t.border).cursor_pointer().hover((s) => s.border_color(t.input))
        .tooltip(open ? "Hide usage panel" : "Show usage panel")
        .on_click(() => togglePanel())
        .when(!this.providers && !this.error, (el) => el.child(this.note("Reading usage…", t.dim)))
        .when(Boolean(this.error), (el) => el.child(this.note(this.error, t.blocked)))
        .children(providers.map((p) => this.provider(p, false))));
  }

  segmented(id, value, options, onPick) {
    const t = theme();
    return h_flex().h(22).p(2).gap(2).rounded(6).bg(t.raised).text_size(11).children(options.map(([v, label]) =>
      div().id(`${id}-${v}`).h(18).px(8).flex().items_center().rounded(4)
        .bg(value === v ? t.surface : t.raised).text_color(value === v ? t.foreground : t.muted)
        .cursor_pointer().hover((s) => s.text_color(t.foreground)).on_click((_e, cx) => { onPick(v); cx.notify(); }).child(label)));
  }

  cell(label, value, color, tip) {
    const t = theme();
    return v_flex().id(`cell-${label}`).flex_1().min_w(0).items_center().gap(1).when(Boolean(tip), (el) => el.tooltip(tip))
      .child(div().text_size(14).font_semibold().text_color(color ?? t.foreground).child(value))
      .child(div().text_size(10).text_color(t.dim).child(label));
  }

  renderPanel() {
    const t = theme();
    const now = Date.now();
    const rows = this.rows();
    const matched = this.match(rows.map((r) => r.agent));
    const pick = (s) => (s ? (this.view === "turn" ? s.turn : s.total) : null);
    let usd = 0, est = false, priced = 0, tin = 0, tout = 0, tcr = 0, tcw = 0, ctxMax = null;
    for (const r of rows) {
      const s = matched.get(r.agent.address), u = pick(s);
      if (!u) continue;
      if (u.usd != null) {
        usd += u.usd;
        priced++;
      }
      est = est || u.estimated;
      tin += u.in; tout += u.out; tcr += u.cr; tcw += u.cw;
      if (s.ctx?.window) ctxMax = Math.max(ctxMax ?? 0, (s.ctx.used / s.ctx.window) * 100);
    }
    const hit = cacheHit({ in: tin, cr: tcr, cw: tcw });
    const needs = rows.filter((r) => r.status === "blocked").length;
    const header = h_flex().h(40).px(12).gap(8).items_center().border_b(1).border_color(t.border)
      .child(svg(ICON).size(14).text_color(t.muted))
      .child(div().text_size(13).font_semibold().child("Usage"))
      .child(div().flex_1())
      .child(this.segmented("scope", this.scope, [["space", "Space"], ["all", "All"]], (v) => { this.scope = v; this.save("scope", v); }))
      .child(this.segmented("view", this.view, [["turn", "Turn"], ["session", "Session"]], (v) => { this.view = v; this.save("view", v); }));
    const limits = v_flex().p(12).gap(12).border_b(1).border_color(t.border)
      .when(!this.providers && !this.error, (el) => el.child(this.note("Reading usage…", t.dim)))
      .when(Boolean(this.error), (el) => el.child(this.note(this.error, t.blocked)))
      .children((this.providers ?? []).map((p) => this.provider(p, true)));
    const totals = v_flex().p(12).gap(10).border_b(1).border_color(t.border)
      .child(h_flex().items_end().gap(8)
        .child(div().id("total-cost").text_size(26).font_semibold().text_color(t.foreground).tooltip(COST_TIP).child(priced ? money(usd, est) : "—"))
        .child(div().pb(4).text_size(11).text_color(t.dim).child(this.view === "turn" ? "last turn" : "this session"))
        .child(div().flex_1())
        .when(needs > 0, (el) => el.child(div().h(20).px(8).flex().items_center().rounded(5).text_size(11).font_semibold().bg(t.blocked).text_color(t.background).child(`${needs} needs you`))))
      .child(h_flex().gap(4)
        .child(this.cell("agents", String(rows.length)))
        .child(this.cell("tokens", tokens(tin + tout + tcw), null, `in ${tokens(tin)} · out ${tokens(tout)} · cache write ${tokens(tcw)} · cache read ${tokens(tcr)}`))
        .child(this.cell("cache hit", hit == null ? "—" : percent(hit), null, "cache read / (input + cache read + cache write)"))
        .child(this.cell("ctx max", ctxMax == null ? "—" : percent(ctxMax), ctxMax != null && ctxMax >= WARN ? t.blocked : null)));
    const list = v_flex().id("cards").flex_1().min_h(0).overflow_y_scrollbar().p(10).gap(8)
      .when(rows.length === 0, (el) => el.child(this.note(this.scope === "all" ? "No agents running." : "No agents in this space.", t.dim)))
      .children(rows.map((r) => this.card(r, matched.get(r.agent.address), now)));
    return v_flex().id("root").size_full().min_h(0).rounded(10).overflow_hidden().bg(t.background).border(1).border_color(t.border)
      .text_color(t.foreground).text_size(12)
      .child(header).child(limits).child(totals).child(list);
  }

  card(r, s, now) {
    const t = theme();
    const a = r.agent;
    const u = s ? (this.view === "turn" ? s.turn : s.total) : null;
    const statusColor = t[r.status === "waiting" ? "accent" : r.status] ?? t.unknown;
    const name = a.tab_name && !/^\d+$/.test(a.tab_name) ? a.tab_name : s?.title ?? a.title ?? a.address;
    const sub = r.depth > 0;
    const card = v_flex().id(`card-${a.address}`).ml(r.depth * 14).p(10).gap(6).rounded(8).bg(t.surface).border(1)
      .border_color(a.focused ? t.accent : r.status === "blocked" ? t.blocked : t.border)
      .child(h_flex().gap(7).items_center()
        .child(div().size(7).flex_none().rounded(4).bg(statusColor))
        .child(div().flex_1().min_w(0).truncate().text_size(sub ? 11.5 : 12.5).font_semibold().text_color(a.focused ? t.accent : t.foreground).tooltip(s?.title ?? a.title ?? "").child(name))
        .child(div().id(`addr-${a.address}`).flex_none().text_size(10.5).text_color(t.dim).cursor_pointer()
          .hover((st) => st.text_color(t.accent).underline()).tooltip("Focus this agent")
          .on_click(() => focusAgent(a)).child(a.address))
        .child(div().id(`cost-${a.address}`).flex_none().text_size(13).font_semibold().tooltip(COST_TIP).child(u ? money(u.usd, u.estimated) : "")))
      .child(h_flex().gap(6).text_size(10.5).text_color(t.dim)
        .child(div().text_color(statusColor).child(STATUS_LABEL[r.status] ?? r.status))
        .when(Boolean(s?.model), (el) => el.child(div().child("·")).child(div().child(modelName(s.model))))
        .when(Boolean(s), (el) => el.child(div().child("·")).child(div().child(`${s.turns} calls · ${s.tools} tools`)))
        .child(div().flex_1())
        .when(Boolean(s?.active), (el) => el.child(div().child(ago(s.active, now)))));
    if (!s) return card.child(div().text_size(11).text_color(t.dim).child(kindOf(a.app) || a.labelled ? "No session data yet." : "Usage is read for Claude Code and Codex only."));
    card.child(this.contextBar(s));
    const ctx = s.ctx ?? {};
    const pct = ctx.window ? (ctx.used / ctx.window) * 100 : null;
    const left = ctx.window && ctx.growth > 0 ? Math.floor((ctx.window - ctx.used) / ctx.growth) : null;
    const hit = cacheHit(u);
    card.child(h_flex().gap(8).text_size(11).text_color(t.muted)
      .child(div().id(`ctx-${a.address}`).font_semibold().text_color(pct != null && pct >= WARN ? t.blocked : t.foreground)
        .tooltip(ctx.exact ? "Context window reported by Claude Code" : "Context window guessed from the model")
        .child(`${tokens(ctx.used)} / ${ctx.window ? tokens(ctx.window) : "?"}`))
      .when(hit != null, (el) => el.child(div().id(`hit-${a.address}`).tooltip("Cache hit").child(`cache ${percent(hit)}`)))
      .when(left != null, (el) => el.child(div().id(`left-${a.address}`).text_color(left <= 10 ? t.working : t.muted)
        .tooltip("Calls left before the context is full, at the recent growth").child(`~${left > 99 ? "99+" : left} calls left`)))
      .child(div().flex_1())
      .child(div().id(`tok-${a.address}`).text_color(t.dim).tooltip(`in ${tokens(u.in)} · out ${tokens(u.out)} · cache write ${tokens(u.cw)} · cache read ${tokens(u.cr)}`)
        .child(`${tokens(u.in + u.out + u.cw)} tok`)));
    const active = r.status === "working" || r.status === "blocked" || r.status === "waiting";
    if (active && s.tool) card.child(div().text_size(10.5).text_color(t.muted).truncate().child(`▸ ${s.tool}`));
    if (s.agent === "claude") card.child(h_flex().gap(6).justify_end().child(this.action(a, "compact")).child(this.action(a, "clear")));
    return card;
  }

  contextBar(s) {
    const t = theme();
    const ctx = s.ctx ?? {};
    if (!ctx.window) return div().h(5).rounded(3).bg(t.raised);
    const base = Math.min(100, (ctx.base / ctx.window) * 100);
    const used = Math.min(100, (ctx.used / ctx.window) * 100);
    const color = used >= WARN ? t.blocked : used >= 60 ? t.working : t.accent;
    return div().id(`bar-${s.id}`).h(5).relative().rounded(3).bg(t.raised).overflow_hidden()
      .tooltip(`Base ${tokens(ctx.base)} (system prompt, tools, memory) · conversation ${tokens(Math.max(0, ctx.used - ctx.base))}`)
      .when(used > 0, (el) => el.child(div().absolute().top(0).bottom(0).left(0).w(`${used}%`).bg(color)))
      .when(base > 0, (el) => el.child(div().absolute().top(0).bottom(0).left(0).w(`${Math.min(base, used)}%`).bg(t.muted)));
  }

  action(a, cmd) {
    const t = theme();
    const armed = cmd === "clear" && this.armed[a.address] > Date.now();
    return div().id(`${cmd}-${a.address}`).h(20).px(8).flex().items_center().rounded(5).text_size(10.5)
      .border(1).border_color(armed ? t.blocked : t.border).text_color(armed ? t.blocked : t.muted)
      .cursor_pointer().hover((st) => st.text_color(t.foreground).border_color(t.input))
      .tooltip(cmd === "compact" ? "Send /compact: keep the conversation as a summary" : "Send /clear: start over with an empty context")
      .on_click((_e, cx) => {
        if (cmd === "clear" && !armed) {
          this.armed[a.address] = Date.now() + CLEAR_ARM_MS;
          cx.spawn(async (cx) => {
            await cx.sleep(CLEAR_ARM_MS + 50);
            cx.notify();
          });
          return;
        }
        delete this.armed[a.address];
        cx.spawn(async () => {
          const r = await hc(["send", a.address, `/${cmd}`]).catch((e) => ({ code: 1, stderr: String(e?.message ?? e) }));
          if (r.code !== 0) notify({ title: `Couldn't send /${cmd}`, body: (r.stderr || r.stdout || "").trim(), level: "error" });
        });
      })
      .child(armed ? "confirm /clear" : `/${cmd}`);
  }
}
