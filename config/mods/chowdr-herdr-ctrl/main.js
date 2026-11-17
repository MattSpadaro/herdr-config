import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { theme, focused, agents, terminals, shared, setShared, run, nextCommand, notify } from "herdr";

const CHAT_KEY = "chowdr-herdr-ctrl.chat";
const SCREEN_KEY = "flockbook.screen";
const REQUEST_KEY = "flockbook.request";
const STACK = "term-view";
const CHILD = { terminal: "live-terminals", chat: "term-chat" };
const TICK_MS = 200;

const chatList = () => {
  const v = shared(CHAT_KEY);
  return Array.isArray(v) ? v.filter((a) => typeof a === "string") : [];
};

const onModPane = () => {
  const f = focused();
  return Boolean(f?.pane && !f.terminal);
};

const focusedAddress = () => {
  if (onModPane()) return null;
  const f = focused();
  return f?.terminal ?? f?.agent ?? null;
};

const isAgent = (address) => Boolean(address) && agents().some((a) => a.address === address);

export default class ChowdrHerdrCtrl extends View {
  init(_props, cx) {
    this.view = null;
    this.lastAddress = null;
    this.requestAt = Date.now();
    this.seen = new Set();
    this.snapshot = "";
    this.tick();
    cx.timer.every(TICK_MS, (cx) => { if (this.tick()) cx.notify(); });
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        this.command(c);
        cx.notify();
      }
    });
  }

  command(c) {
    if (c === "toggle-chat") return this.setChat(!chatList().includes(this.target()));
    if (c === "show-chat") return this.setChat(true);
    if (c === "show-terminal") return this.setChat(false);
  }

  target() {
    const address = focusedAddress();
    if (address) this.lastAddress = address;
    return address ?? this.lastAddress;
  }

  handleRequest() {
    const r = shared(REQUEST_KEY);
    if (!r || typeof r !== "object" || !(Number(r.at) > this.requestAt)) return;
    this.requestAt = Number(r.at);
    setShared(REQUEST_KEY, null);
    if (r.kind === "show-terminal" && typeof r.address === "string") {
      this.setChat(false, r.address);
      run("pane.focus", { terminal: r.address });
    }
  }

  setChat(on, address = this.target()) {
    if (!address || (on && onModPane())) return;
    if (on && !isAgent(address)) {
      notify({ title: "Chat view", body: "The focused terminal runs no agent.", level: "info", timeout: 3000 });
      return;
    }
    const list = chatList().filter((a) => a !== address);
    setShared(CHAT_KEY, on ? [...list, address] : list);
    this.tick();
  }

  prune() {
    const alive = new Set(terminals().map((t) => t.address).filter(Boolean));
    for (const a of alive) this.seen.add(a);
    const list = chatList();
    const kept = list.filter((a) => alive.has(a) || !this.seen.has(a));
    if (kept.length !== list.length) setShared(CHAT_KEY, kept);
  }

  wanted() {
    if (onModPane()) return "terminal";
    const address = focusedAddress();
    if (!address) return this.view ?? "terminal";
    return chatList().includes(address) && isAgent(address) ? "chat" : "terminal";
  }

  tick() {
    this.handleRequest();
    this.prune();
    const view = this.wanted();
    if (view !== this.view) {
      this.view = view;
      run("layout.select", { stack: STACK, child: CHILD[view] });
      setShared(SCREEN_KEY, view === "chat" ? "chat" : "tab");
    }
    const address = focusedAddress();
    const snapshot = `${address}|${isAgent(address)}|${view}|${onModPane()}`;
    const changed = snapshot !== this.snapshot;
    this.snapshot = snapshot;
    return changed;
  }

  render() {
    const t = theme();
    const canChat = !onModPane() && isAgent(this.target());
    const chip = (id, label, selected, enabled, onClick) =>
      h_flex().id(id).h(27).px(11).items_center().rounded(6).text_size(11)
        .bg(selected ? t.selected : t.surface).border(1).border_color(selected ? t.accent : t.border)
        .text_color(selected ? t.accent : enabled ? t.muted : t.dim)
        .when(enabled && !selected, (el) => el.cursor_pointer().hover((s) => s.text_color(t.foreground)).on_click(onClick))
        .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
        .child(label);
    return h_flex().size_full().bg(t.surface).pr(26).gap(7).items_center().justify_end()
      .child(chip("view-terminal", "Terminal", this.view !== "chat", true, () => this.setChat(false)))
      .child(chip("view-chat", "Chat", this.view === "chat", canChat, () => this.setChat(true)));
  }
}
