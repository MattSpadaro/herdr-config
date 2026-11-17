export const WARN = 80;
export const URGENT = 95;
const WINDOW_MS = { "5h": 5 * 36e5, week: 7 * 864e5, month: 30 * 864e5 };
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const pad = (n) => String(n).padStart(2, "0");

export function tokens(n) {
  if (!n) return "0";
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}k`;
  return String(n);
}

export function money(usd, estimated) {
  if (usd == null) return "—";
  const v = usd >= 100 ? `$${Math.round(usd)}` : usd >= 10 ? `$${usd.toFixed(1)}` : `$${usd.toFixed(2)}`;
  return (estimated ? "~" : "") + v;
}

export const percent = (n) => `${Math.round(n)}%`;

export function span(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return h ? `${d}d ${h}h` : `${d}d`;
  if (h > 0) return m ? `${h}h ${m}m` : `${h}h`;
  return `${Math.max(m, 1)}m`;
}

export function ago(ms, now) {
  if (!ms) return "";
  const diff = now - ms;
  return diff < 60000 ? "now" : `${span(diff)} ago`;
}

export function clock(ms) {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function resetShort(ms, now) {
  if (!ms) return "";
  if (ms <= now) return "reset";
  return ms - now < 864e5 ? span(ms - now) : `${DAYS[new Date(ms).getDay()]} ${clock(ms)}`;
}

export function resetLong(ms, now) {
  if (!ms) return "Reset time unknown";
  const d = new Date(ms);
  const when = `${DAYS[d.getDay()]} ${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${clock(ms)}`;
  return ms <= now ? `Reset at ${when}` : `Resets ${when}, in ${span(ms - now)}`;
}

export function elapsed(w, now) {
  const len = WINDOW_MS[w.label];
  if (!len || !w.resets || w.resets <= now) return null;
  return Math.max(0, Math.min(1, 1 - (w.resets - now) / len));
}

export function levelColor(used, t) {
  return used >= URGENT ? t.blocked : used >= WARN ? t.working : t.accent;
}

export function cacheHit(u) {
  const denom = (u?.in ?? 0) + (u?.cr ?? 0) + (u?.cw ?? 0);
  return denom > 0 ? (u.cr / denom) * 100 : null;
}

export function modelName(id) {
  const m = /claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?:-|$)/.exec(id ?? "");
  if (m) return m[3] ? `${m[1]} ${m[2]}.${m[3]}` : `${m[1]} ${m[2]}`;
  return id ?? "";
}

export function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}
