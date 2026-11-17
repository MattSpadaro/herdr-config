import { View, div, svg } from "gpui-kit";
import { h_flex, v_flex, InputState, Input, ScrollHandle } from "gpui-base";
import { theme, run, props, closeOverlay, exec, home, appHome, readTextFile, writeTextFile, pickFolder, checking } from "herdr";

const ICONS = "mods/workspace-chrome";
const OWN = "mods/folder-picker";
const CONTEXT = "FolderPicker";
const ACTIONS = { tab: "folder_picker_complete", up: "folder_picker_up", down: "folder_picker_down" };
const statePath = () => `${appHome()}/data/folder-picker.json`;

const emptyState = () => ({ defaultFolder: null, favorites: [] });

const parseState = (text) => {
  try {
    const v = JSON.parse(text ?? "");
    return {
      defaultFolder: typeof v?.defaultFolder === "string" && v.defaultFolder ? v.defaultFolder : null,
      favorites: Array.isArray(v?.favorites) ? [...new Set(v.favorites.filter((f) => typeof f === "string" && f))] : [],
    };
  } catch {
    return emptyState();
  }
};

const expand = (p) => {
  if (p === "~") return home();
  if (p.startsWith("~/")) return `${home()}/${p.slice(2)}`;
  return p;
};

const tilde = (p) => (p === home() ? "~" : p.startsWith(`${home()}/`) ? `~${p.slice(home().length)}` : p);

const normalize = (p) => {
  const parts = [];
  for (const part of p.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return `/${parts.join("/")}`;
};

const join = (dir, name) => (dir === "/" ? `/${name}` : `${dir}/${name}`);
const parent = (dir) => (dir === "/" ? "/" : normalize(`${dir}/..`));
const base = (p) => (p === "/" ? "/" : p.slice(p.lastIndexOf("/") + 1));
const byName = (a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
const isPath = (text) => text.startsWith("/") || text.startsWith("~");

const commonPrefix = (names) => {
  let prefix = names[0] ?? "";
  for (const n of names.slice(1)) {
    let i = 0;
    while (i < prefix.length && i < n.length && prefix[i].toLowerCase() === n[i].toLowerCase()) i++;
    prefix = prefix.slice(0, i);
  }
  return prefix;
};

const isDir = async (p) => {
  try {
    return (await exec("test", ["-d", p], { timeout: 5000 })).code === 0;
  } catch {
    return false;
  }
};

const listDirs = async (dir) => {
  const res = await exec("find", ["-L", dir, "-mindepth", "1", "-maxdepth", "1", "-type", "d", "-printf", "%f\\n"], { timeout: 10000 });
  return res.stdout.split("\n").filter(Boolean).sort(byName);
};

let keysBound = false;
const bindKeys = (cx) => {
  if (keysBound || typeof cx?.bind_keys !== "function") return;
  try {
    cx.bind_keys(Object.entries(ACTIONS).flatMap(([keystroke, action]) => [
      { keystroke, action, context: CONTEXT },
      { keystroke, action, context: `${CONTEXT} > Input` },
    ]));
    keysBound = true;
  } catch {}
};

export default class FolderPicker extends View {
  init(_props, cx) {
    bindKeys(cx);
    this.state = emptyState();
    this.dir = home();
    this.names = [];
    this.loading = true;
    this.error = null;
    this.text = "";
    this.sel = 0;
    this.childIndex = [];
    this.scroll = ScrollHandle.new();
    this.input = InputState.new({ value: "", placeholder: "Filter, or type a path (Tab completes)" });
    this.input.on("change", (_e, cx) => this.changed(cx));
    this.input.on("submit", () => this.submit());
    this.input.focus();
    cx.timer.after(300, () => this.input.focus());
    this.handle = cx.focus_handle();
    cx.spawn(async (cx) => {
      this.state = parseState(await readTextFile(statePath()));
      const start = this.state.defaultFolder && (await isDir(this.state.defaultFolder)) ? this.state.defaultFolder : home();
      await this.browse(start, cx);
    });
  }

  async browse(dir, cx) {
    this.dir = dir;
    this.loading = true;
    this.error = null;
    cx.notify();
    let names = [];
    let error = null;
    if (await isDir(dir)) {
      try {
        names = await listDirs(dir);
      } catch (e) {
        error = String(e?.message ?? e);
      }
    } else {
      error = `Not a folder: ${dir}`;
    }
    if (this.dir !== dir) return;
    this.names = names;
    this.error = error;
    this.loading = false;
    this.resetSelection();
    cx.notify();
  }

  typed() {
    if (!isPath(this.text)) return null;
    const cut = this.text.lastIndexOf("/");
    const head = cut < 0 ? this.text : this.text.slice(0, cut + 1);
    const frag = cut < 0 ? "" : this.text.slice(cut + 1);
    return { head, frag, dir: normalize(expand(head === "~" ? "~/" : head)) };
  }

  changed(cx) {
    this.text = this.input.value();
    const t = this.typed();
    if (t && t.dir !== this.dir) {
      cx.spawn(async (cx) => this.browse(t.dir, cx));
      return;
    }
    this.resetSelection();
    cx.notify();
  }

  resetSelection() {
    const rows = this.rows();
    const t = this.typed();
    const firstDir = rows.findIndex((r) => r.kind === "dir");
    if (t && t.frag && firstDir >= 0) this.sel = firstDir;
    else if (!t && this.text.trim()) this.sel = 0;
    else this.sel = Math.max(0, rows.findIndex((r) => r.kind === "here"));
  }

  matchingNames() {
    const t = this.typed();
    const q = (t ? t.frag : this.text.trim()).toLowerCase();
    const showHidden = q.startsWith(".");
    return this.names.filter((n) => {
      if (!showHidden && n.startsWith(".")) return false;
      if (!q) return true;
      return t ? n.toLowerCase().startsWith(q) : n.toLowerCase().includes(q);
    });
  }

  rows() {
    const t = this.typed();
    const q = this.text.trim().toLowerCase();
    const favs = this.state.favorites
      .filter((p) => !q || (t ? p.toLowerCase().startsWith(normalize(expand(this.text)).toLowerCase()) : p.toLowerCase().includes(q)))
      .map((path) => ({ kind: "fav", path }));
    const dirs = this.matchingNames().map((n) => ({ kind: "dir", path: join(this.dir, n) }));
    return [...favs, { kind: "here", path: this.dir }, ...dirs];
  }

  async mutate(fn, cx) {
    if (checking()) return;
    for (let attempt = 0; attempt < 2; attempt++) {
      const raw = await readTextFile(statePath());
      const next = parseState(raw);
      fn(next);
      try {
        await writeTextFile(statePath(), `${JSON.stringify(next, null, 2)}\n`, raw);
        this.state = next;
        this.error = null;
        cx.notify();
        return;
      } catch (e) {
        this.error = `Could not save ${statePath()}: ${e?.message ?? e}`;
      }
    }
    cx.notify();
  }

  toggleFavorite(path, cx) {
    cx.spawn(async (cx) => this.mutate((s) => {
      s.favorites = s.favorites.includes(path) ? s.favorites.filter((f) => f !== path) : [...s.favorites, path];
    }, cx));
  }

  setDefault(path, cx) {
    cx.spawn(async (cx) => this.mutate((s) => { s.defaultFolder = path; }, cx));
  }

  setText(text, cx) {
    this.input.set_value(text);
    this.input.set_selected_range({ start: text.length, end: text.length });
    this.changed(cx);
  }

  goTo(dir, cx) {
    this.input.set_value("");
    this.text = "";
    cx.spawn(async (cx) => this.browse(dir, cx));
  }

  open(path) {
    closeOverlay(props().overlay);
    run("space.new", { folder: path, machine: "" });
  }

  submit() {
    const row = this.rows()[this.sel];
    if (row) this.open(row.path);
  }

  complete(cx) {
    const t = this.typed();
    if (!t) {
      const row = this.rows()[this.sel];
      if (row && row.kind !== "here") this.setText(`${tilde(row.path)}/`, cx);
      return;
    }
    const names = this.matchingNames();
    if (!names.length) return;
    if (names.length === 1) return this.setText(`${t.head}${names[0]}/`, cx);
    const prefix = commonPrefix(names);
    if (prefix.length > t.frag.length) this.setText(`${t.head}${t.frag}${prefix.slice(t.frag.length)}`, cx);
  }

  move(delta, cx) {
    const rows = this.rows();
    this.sel = Math.max(0, Math.min(rows.length - 1, this.sel + delta));
    const child = this.childIndex[this.sel];
    if (child !== undefined) this.scroll.scroll_to_item(child);
    cx.notify();
  }

  key(e, cx) {
    if (e.key === "escape") { closeOverlay(props().overlay); cx.stop_propagation(); return; }
    if (e.key === "backspace" && !this.text && this.dir !== "/") { this.goTo(parent(this.dir), cx); cx.stop_propagation(); }
  }

  render() {
    const t = theme();
    const rows = this.rows();
    const isDefault = this.state.defaultFolder ? this.state.defaultFolder === this.dir : this.dir === home();

    const icon = (name, color, size = 14) => svg(name).size(size).flex_none().text_color(color);
    const iconBtn = (id, name, color, title, fn) => div().id(id).flex_none().size(24).flex().items_center().justify_center()
      .rounded(5).cursor_pointer().text_color(color).hover((s) => s.bg(t.hover).text_color(t.foreground))
      .tooltip(title)
      .on_click((_e, cx) => { cx.stop_propagation(); fn(cx); })
      .child(svg(name).size(13));
    const star = (id, path) => {
      const fav = this.state.favorites.includes(path);
      return iconBtn(id, `${OWN}/${fav ? "star-filled" : "star"}.svg`, fav ? t.accent : t.dim,
        fav ? "Remove from favorites" : "Add to favorites", (cx) => this.toggleFavorite(path, cx));
    };
    const sectionTitle = (text) => div().px(10).pt(10).pb(4).text_size(10.5).font_semibold().text_color(t.dim).child(text);

    const row = (r, i) => {
      const selected = i === this.sel;
      const el = h_flex().id(`row-${i}`).items_center().gap(9).px(10).py(r.kind === "dir" ? 5 : 6).rounded(6)
        .bg(selected ? t.selected : t.popover).hover((s) => s.bg(selected ? t.selected : t.hover)).cursor_pointer()
        .on_click(() => this.open(r.path));
      if (r.kind === "fav") {
        return el
          .child(star(`fav-star-${i}`, r.path))
          .child(v_flex().flex_1().min_w(0)
            .child(div().truncate().text_size(13).text_color(t.foreground).child(base(r.path)))
            .child(div().truncate().text_size(11).text_color(t.dim).child(r.path)))
          .child(iconBtn(`fav-in-${i}`, `${ICONS}/chevron-right.svg`, t.dim, "Browse this folder", (cx) => this.goTo(r.path, cx)));
      }
      if (r.kind === "here") {
        return el
          .child(icon(`${ICONS}/terminal.svg`, t.accent))
          .child(div().flex_1().min_w(0).truncate().text_size(13).text_color(t.foreground).child(`Open ${base(this.dir)}`))
          .child(star("here-star", r.path));
      }
      return el
        .child(icon(`${ICONS}/folder.svg`, t.muted))
        .child(div().flex_1().min_w(0).truncate().text_size(13).text_color(t.foreground).child(base(r.path)))
        .child(star(`star-${i}`, r.path))
        .child(iconBtn(`in-${i}`, `${ICONS}/chevron-right.svg`, t.dim, "Browse this folder", (cx) => this.goTo(r.path, cx)));
    };

    const items = [];
    this.childIndex = [];
    if (rows[0]?.kind === "fav") items.push(sectionTitle("FAVORITES"));
    rows.forEach((r, i) => {
      if (r.kind === "here") items.push(sectionTitle("FOLDERS"));
      this.childIndex.push(items.length);
      items.push(row(r, i));
    });
    if (this.loading) items.push(div().px(10).py(6).text_size(12).text_color(t.dim).child("Loading..."));
    else if (!this.error && !rows.some((r) => r.kind === "dir")) items.push(div().px(10).py(6).text_size(12).text_color(t.dim).child(this.text ? "No folder matches" : "No subfolders"));

    const defaultChip = h_flex().id("default").flex_none().px(7).py(2).rounded(5).border_1().text_size(10.5)
      .border_color(isDefault ? t.accent : t.border).text_color(isDefault ? t.accent : t.muted)
      .when(!isDefault, (el) => el.cursor_pointer().hover((s) => s.text_color(t.foreground).bg(t.hover))
        .on_click((_e, cx) => this.setDefault(this.dir, cx)))
      .child(isDefault ? "Default" : "Set as default");

    return v_flex().id("folder-picker").key_context(CONTEXT).track_focus(this.handle)
      .on_key_down((e, cx) => this.key(e, cx))
      .on_action(ACTIONS.tab, (_e, cx) => { this.complete(cx); cx.stop_propagation(); })
      .on_action(ACTIONS.up, (_e, cx) => { this.move(-1, cx); cx.stop_propagation(); })
      .on_action(ACTIONS.down, (_e, cx) => { this.move(1, cx); cx.stop_propagation(); })
      .size_full().bg(t.popover).text_color(t.foreground)
      .child(v_flex().p(10).gap(8).border_b(1).border_color(t.border)
        .child(h_flex().items_center().gap(8)
          .child(icon(`${ICONS}/search.svg`, t.dim))
          .child(Input.new(this.input).flex_1().h(30).px(8).rounded(6).border_1().border_color(t.input).bg(t.background).text_size(12.5).text_color(t.foreground)))
        .child(h_flex().items_center().gap(4)
          .child(iconBtn("up", `${ICONS}/chevron-left.svg`, t.muted, "Parent folder", (cx) => this.goTo(parent(this.dir), cx)))
          .child(div().flex_1().min_w(0).truncate().text_size(11.5).text_color(t.muted).child(this.dir))
          .child(defaultChip)))
      .when(Boolean(this.error), (el) => el.child(div().px(12).pt(6).text_size(11).text_color(t.blocked).truncate().child(this.error ?? "")))
      .child(v_flex().id("rows").h(372).px(4).py(2).overflow_y_scrollbar().track_scroll(this.scroll).children(items))
      .child(h_flex().px(10).py(7).gap(8).items_center().border_t(1).border_color(t.border)
        .child(h_flex().id("system-picker").gap(6).items_center().px(8).py(4).rounded(6).cursor_pointer()
          .text_size(11.5).text_color(t.muted).hover((s) => s.bg(t.hover).text_color(t.foreground))
          .on_click((_e, cx) => { cx.spawn(async (cx) => { const p = await pickFolder({ prompt: "Open" }); if (p) this.open(p); else cx.notify(); }); })
          .child(svg(`${ICONS}/folder-plus.svg`).size(13)).child("Browse..."))
        .child(div().flex_1())
        .child(div().text_size(10.5).text_color(t.dim).child("Enter open · Tab complete · Bksp up")));
  }
}
