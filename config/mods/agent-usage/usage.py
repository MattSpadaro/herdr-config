#!/usr/bin/env python3
"""Usage data for the agent-usage Herdr mod.

Commands (each prints one JSON object):
  limits      plan limits per provider (Claude from the statusline tap, Codex from its rollouts)
  all         limits plus one entry per live agent session with tokens, cost and context
  connect     put tap.sh in front of Claude Code's statusLine command
  disconnect  take it out again

Read-only on Claude Code's and Codex's files, except settings.json on connect and disconnect.
No network access. State lives in <herdr home>/data/agent-usage/.
"""
import glob
import json
import os
import re
import sys
import tempfile
import time
from datetime import datetime

MOD_DIR = os.path.dirname(os.path.abspath(__file__))
APP_HOME = os.path.dirname(os.path.dirname(MOD_DIR))
DATA = os.path.join(APP_HOME, "data", "agent-usage")
TAPS = os.path.join(DATA, "sessions")
CACHE = os.path.join(DATA, "cache.json")
BACKUP = os.path.join(DATA, "settings.backup.json")
TAP = os.path.join(MOD_DIR, "tap.sh")
TAP_MARK = "/mods/agent-usage/tap.sh"
HOME = os.path.expanduser("~")
CLAUDE = os.environ.get("CLAUDE_CONFIG_DIR") or os.path.join(HOME, ".claude")
CODEX = os.environ.get("CODEX_HOME") or os.path.join(HOME, ".codex")

CACHE_VERSION = 1
TAP_KEEP_S = 8 * 86400
CODEX_DAYS = 7
CODEX_LIVE_S = 2 * 86400
CODEX_TAIL = 512 * 1024
HIST = 24

PRICES = {
    "claude-fable-5-2": (8, 40, 0.2, 10, 16),
    "claude-mythos-5-2": (8, 40, 0.2, 10, 16),
    "claude-fable-5-1": (10, 50, 0.25, 12.5, 20),
    "claude-mythos-5-1": (10, 50, 0.25, 12.5, 20),
    "claude-fable-5": (10, 50, 1, 12.5, 20),
    "claude-mythos-5": (10, 50, 1, 12.5, 20),
    "claude-opus-5-5": (4, 20, 0.2, 5, 8),
    "claude-opus-5": (5, 25, 0.5, 6.25, 10),
    "claude-opus-4-8": (5, 25, 0.5, 6.25, 10),
    "claude-opus-4-7": (5, 25, 0.5, 6.25, 10),
    "claude-opus-4-6": (5, 25, 0.5, 6.25, 10),
    "claude-opus-4-5": (5, 25, 0.5, 6.25, 10),
    "claude-opus-4-1": (15, 75, 1.5, 18.75, 30),
    "claude-opus-4": (15, 75, 1.5, 18.75, 30),
    "claude-sonnet-5-5": (2, 10, 0.1, 2.5, 4),
    "claude-sonnet-5": (2, 10, 0.2, 2.5, 4),
    "claude-sonnet-4-6": (3, 15, 0.3, 3.75, 6),
    "claude-sonnet-4-5": (3, 15, 0.3, 3.75, 6),
    "claude-sonnet-4": (3, 15, 0.3, 3.75, 6),
    "claude-haiku-5-5": (0.1, 0.5, 0.01, 0.125, 0.2),
    "claude-haiku-5-5@long": (0.5, 2.5, 0.05, 0.625, 1),
    "claude-haiku-4-5": (1, 5, 0.1, 1.25, 2),
}
LONG_PROMPT = {"claude-haiku-5-5": 100_000}
FAMILY = [
    (re.compile(r"fable|mythos"), "claude-fable-5-2"),
    (re.compile(r"opus"), "claude-opus-5-5"),
    (re.compile(r"haiku"), "claude-haiku-5-5"),
    (re.compile(r"sonnet"), "claude-sonnet-5-5"),
]
WINDOW_1M = re.compile(r"(fable|mythos|opus|sonnet|haiku)-5|opus-4-[678]|sonnet-4-6")
CLAUDE_WINDOWS = (("five_hour", "5h"), ("seven_day", "week"), ("spend_limit", "spend"))


def now_ms():
    return int(time.time() * 1000)


def epoch_ms(value):
    if isinstance(value, (int, float)):
        return int(value if value > 1e12 else value * 1000)
    try:
        return int(datetime.fromisoformat(str(value).replace("Z", "+00:00")).timestamp() * 1000)
    except (TypeError, ValueError):
        return None


def num(value):
    return value if isinstance(value, (int, float)) and value > 0 else 0


def read_json(path, default=None):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def write_private(path, text):
    os.makedirs(os.path.dirname(path), mode=0o700, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".tmp-")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(text)
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def alive(pid):
    try:
        os.kill(int(pid), 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    except (TypeError, ValueError, OSError):
        return False
    return True


def shq(s):
    return "'" + s.replace("'", "'\\''") + "'"


# ---------------------------------------------------------------- pricing

def price_key(model, prompt):
    limit = LONG_PROMPT.get(model or "")
    return (model or "?") + ("@long" if limit and prompt > limit else "")


def price_row(key):
    model, _, tier = key.partition("@")
    base = re.sub(r"-\d{8}$", "", model)
    suffix = "@" + tier if tier else ""
    for k in (model + suffix, base + suffix, base):
        if k in PRICES:
            return PRICES[k], False
    if not base.startswith("claude-"):
        return None, False
    for pattern, fallback in FAMILY:
        if pattern.search(base):
            return PRICES[fallback], True
    return None, False


def cost_of(by):
    usd, estimated, priced = 0.0, False, True
    for key, row in by.items():
        if not any(row):
            continue
        price, guess = price_row(key)
        if price is None:
            priced = False
            continue
        estimated = estimated or guess
        usd += sum(a * b for a, b in zip(row, price)) / 1e6
    return {"usd": round(usd, 6), "estimated": estimated} if priced else {"usd": None, "estimated": False}


def bucket_sum(by):
    t = [0, 0, 0, 0]
    for row in by.values():
        t[0] += row[0]
        t[1] += row[1]
        t[2] += row[2]
        t[3] += row[3] + row[4]
    return {"in": t[0], "out": t[1], "cr": t[2], "cw": t[3]}


def summary(by):
    return {**bucket_sum(by), **cost_of(by)}


# ---------------------------------------------------------------- Claude: tap and limits

def taps():
    out = {}
    cutoff = time.time() - TAP_KEEP_S
    for path in glob.glob(os.path.join(TAPS, "*.json")):
        try:
            mtime = os.path.getmtime(path)
        except OSError:
            continue
        if mtime < cutoff:
            try:
                os.unlink(path)
            except OSError:
                pass
            continue
        payload = read_json(path)
        if isinstance(payload, dict):
            out[os.path.basename(path)[:-5]] = (payload, int(mtime * 1000))
    return out


def settings_path():
    return os.path.realpath(os.path.join(CLAUDE, "settings.json"))


def connection():
    path = settings_path()
    try:
        with open(path, encoding="utf-8") as f:
            text = f.read()
    except FileNotFoundError:
        return {"path": path, "text": None, "settings": {}, "connected": False}
    except OSError as e:
        return {"path": path, "error": str(e)}
    try:
        settings = json.loads(text)
    except ValueError:
        return {"path": path, "error": f"{path} is not valid JSON"}
    if not isinstance(settings, dict):
        return {"path": path, "error": f"{path} is not a JSON object"}
    command = (settings.get("statusLine") or {}).get("command")
    connected = isinstance(command, str) and TAP_MARK in command
    return {"path": path, "text": text, "settings": settings, "connected": connected}


def claude_limits(tapped):
    conn = connection()
    windows, updated = {}, None
    now_s = time.time()
    for payload, mtime in tapped.values():
        rl = payload.get("rate_limits")
        if not isinstance(rl, dict):
            continue
        updated = max(updated or 0, mtime)
        for key, _ in CLAUDE_WINDOWS:
            w = rl.get(key)
            if not isinstance(w, dict) or not isinstance(w.get("used_percentage"), (int, float)):
                continue
            resets = w.get("resets_at") if isinstance(w.get("resets_at"), (int, float)) else 0
            best = windows.get(key)
            if best is None or resets > best["resets"] or (resets == best["resets"] and w["used_percentage"] > best["used"]):
                windows[key] = {"used": float(w["used_percentage"]), "resets": resets,
                                "usd": w.get("used_usd"), "limit_usd": w.get("limit_usd"), "period": w.get("period")}
    out = []
    for key, label in CLAUDE_WINDOWS:
        w = windows.get(key)
        if w:
            out.append({"key": key, "label": label, "used": w["used"], "resets": int(w["resets"] * 1000) or None,
                        "expired": bool(w["resets"]) and w["resets"] < now_s,
                        "usd": w["usd"], "limit_usd": w["limit_usd"], "period": w["period"]})
    return {"id": "claude", "name": "Claude", "installed": os.path.isdir(CLAUDE),
            "connected": conn.get("connected", False), "error": conn.get("error"),
            "settings": conn.get("path"), "reports": len(tapped), "updated": updated, "windows": out}


# ---------------------------------------------------------------- Claude: transcripts

def claude_zero():
    return {"v": CACHE_VERSION, "off": 0, "by": {}, "turn": {}, "turn_start": 0, "turns": 0, "tools": 0,
            "model": None, "ctx": 0, "base": 0, "hist": [], "hist_id": None, "tool": None, "title": None,
            "custom": None, "last_id": None, "last": None, "active": None, "subs": {}}


def add_usage(st, u, model, sign, in_turn):
    i, o, cr = num(u.get("input_tokens")), num(u.get("output_tokens")), num(u.get("cache_read_input_tokens"))
    cw = num(u.get("cache_creation_input_tokens"))
    split = u.get("cache_creation") if isinstance(u.get("cache_creation"), dict) else {}
    w1 = num(split.get("ephemeral_1h_input_tokens"))
    w5 = max(num(split.get("ephemeral_5m_input_tokens")), cw - w1)
    key = price_key(model, i + cr + cw)
    targets = [st["by"]] + ([st["turn"]] if in_turn else [])
    for by in targets:
        row = by.setdefault(key, [0, 0, 0, 0, 0])
        for n, v in enumerate((i, o, cr, w5, w1)):
            row[n] += sign * v


def is_prompt(d):
    if d.get("type") != "user" or d.get("isMeta") or d.get("isSidechain") or d.get("isCompactSummary"):
        return False
    c = (d.get("message") or {}).get("content")
    if isinstance(c, str):
        return not c.startswith("<local-command-") and not c.startswith("<command-")
    return isinstance(c, list) and any(isinstance(x, dict) and x.get("type") in ("text", "image") for x in c)


def tool_label(c):
    name, inp = c.get("name") or "tool", c.get("input") or {}
    if not isinstance(inp, dict):
        return name
    target = inp.get("file_path") or inp.get("path") or inp.get("notebook_path")
    if target:
        target = str(target).replace("\\", "/").rstrip("/").split("/")[-1]
    elif name == "Bash":
        target = " ".join(str(inp.get("command", "")).split())[:60]
    else:
        target = str(inp.get("pattern") or inp.get("query") or inp.get("description") or inp.get("url") or inp.get("subagent_type") or "")[:60]
    return (name + " " + target).strip()


def read_new(path, offset):
    size = os.path.getsize(path)
    if size < offset:
        return None, 0
    with open(path, "rb") as f:
        f.seek(offset)
        data = f.read()
    end = data.rfind(b"\n")
    if end < 0:
        return [], offset
    return data[: end + 1].split(b"\n"), offset + end + 1


def take_usage(st, holder, d, in_turn):
    msg = d.get("message")
    if not isinstance(msg, dict):
        return False
    u, mid, model = msg.get("usage"), msg.get("id"), msg.get("model")
    if not isinstance(u, dict) or not model or model == "<synthetic>":
        return False
    if mid and mid == holder.get("last_id") and holder.get("last"):
        prev_u, prev_model, prev_turn = holder["last"]
        add_usage(st, prev_u, prev_model, -1, prev_turn)
        repeat = True
    else:
        repeat = False
    add_usage(st, u, model, 1, in_turn)
    holder["last_id"], holder["last"] = mid, [u, model, in_turn]
    return not repeat


def scan_claude_main(path, st):
    lines, off = read_new(path, st["off"])
    if lines is None:
        subs = st["subs"]
        st.clear()
        st.update(claude_zero())
        st["subs"] = {k: {"off": 0} for k in subs}
        lines, off = read_new(path, 0)
    st["off"] = off
    for line in lines:
        if not line:
            continue
        if b'"aiTitle"' in line or b'"customTitle"' in line:
            try:
                d = json.loads(line)
            except ValueError:
                continue
            if d.get("type") == "ai-title" and d.get("aiTitle"):
                st["title"] = d["aiTitle"]
            elif d.get("type") == "custom-title" and d.get("customTitle"):
                st["custom"] = d["customTitle"]
            continue
        user = b'"type":"user"' in line and b'"tool_result"' not in line
        if not user and b'"usage"' not in line:
            continue
        try:
            d = json.loads(line)
        except ValueError:
            continue
        ts = epoch_ms(d.get("timestamp"))
        if user:
            if is_prompt(d):
                st["turn"] = {}
                st["turn_start"] = ts or now_ms()
            continue
        if d.get("type") != "assistant":
            continue
        side = bool(d.get("isSidechain"))
        if take_usage(st, st, d, True) and not side:
            st["turns"] += 1
        msg = d["message"]
        if ts:
            st["active"] = max(st["active"] or 0, ts)
        for c in msg.get("content") or []:
            if isinstance(c, dict) and c.get("type") == "tool_use":
                st["tools"] += 1
                if not side:
                    st["tool"] = tool_label(c)
        if side or not isinstance(msg.get("usage"), dict):
            continue
        u = msg["usage"]
        st["model"] = msg.get("model") or st["model"]
        st["ctx"] = num(u.get("input_tokens")) + num(u.get("cache_read_input_tokens")) + num(u.get("cache_creation_input_tokens"))
        st["base"] = st["base"] or st["ctx"]
        if msg.get("id") and msg.get("id") == st.get("hist_id") and st["hist"]:
            st["hist"][-1] = st["ctx"]
        else:
            st["hist"] = (st["hist"] + [st["ctx"]])[-HIST:]
        st["hist_id"] = msg.get("id")


def scan_claude_sub(path, st, sub):
    lines, off = read_new(path, sub.get("off", 0))
    if lines is None:
        return
    sub["off"] = off
    for line in lines:
        if not line or b'"usage"' not in line:
            continue
        try:
            d = json.loads(line)
        except ValueError:
            continue
        if d.get("type") != "assistant":
            continue
        ts = epoch_ms(d.get("timestamp")) or 0
        take_usage(st, sub, d, ts >= st["turn_start"])
        if ts:
            st["active"] = max(st["active"] or 0, ts)


def transcript_of(cwd, sid, tap):
    p = (tap or {}).get("transcript_path")
    if p and os.path.exists(p):
        return p
    enc = "".join("-" if ch in "/\\.:" else ch for ch in cwd or "")
    p = os.path.join(CLAUDE, "projects", enc, sid + ".jsonl")
    if os.path.exists(p):
        return p
    hits = glob.glob(os.path.join(CLAUDE, "projects", "*", sid + ".jsonl"))
    return hits[0] if hits else None


def growth(hist):
    deltas = [b - a for a, b in zip(hist, hist[1:]) if b > a][-8:]
    return int(sum(deltas) / len(deltas)) if deltas else 0


def claude_sessions(old, tapped):
    out, cache = [], {}
    for path in glob.glob(os.path.join(CLAUDE, "sessions", "*.json")):
        s = read_json(path)
        if not isinstance(s, dict):
            continue
        pid, sid, cwd = s.get("pid"), s.get("sessionId"), s.get("cwd")
        if not (pid and sid and alive(pid)):
            continue
        tap = (tapped.get(sid) or (None, None))[0]
        st = old.get(sid)
        if not isinstance(st, dict) or st.get("v") != CACHE_VERSION:
            st = claude_zero()
        cache[sid] = st
        tp = transcript_of(cwd, sid, tap)
        mtime = None
        if tp:
            try:
                scan_claude_main(tp, st)
                for sp in sorted(glob.glob(os.path.join(tp[:-6], "subagents", "*.jsonl"))):
                    scan_claude_sub(sp, st, st["subs"].setdefault(sp, {"off": 0}))
                mtime = int(os.path.getmtime(tp) * 1000)
            except OSError as e:
                print(f"scan {sid}: {e}", file=sys.stderr)
        cw = (tap or {}).get("context_window") if isinstance((tap or {}).get("context_window"), dict) else {}
        window = cw.get("context_window_size") if isinstance(cw.get("context_window_size"), (int, float)) else None
        model = st["model"] or ((tap or {}).get("model") or {}).get("id")
        exact = window is not None
        if window is None:
            window = 1_000_000 if WINDOW_1M.search(model or "") else 200_000
        out.append({
            "agent": "claude", "id": sid, "pid": pid, "cwd": cwd,
            "title": st["custom"] or st["title"] or s.get("name"),
            "model": model, "started": s.get("startedAt"), "mtime": mtime, "active": st["active"],
            "total": summary(st["by"]), "turn": summary(st["turn"]),
            "turns": st["turns"], "tools": st["tools"], "tool": st["tool"],
            "ctx": {"used": st["ctx"], "window": int(window), "base": st["base"], "exact": exact, "growth": growth(st["hist"])},
        })
    return out, cache


# ---------------------------------------------------------------- Codex

def codex_window(w, at_ms):
    if not isinstance(w, dict) or not isinstance(w.get("used_percent"), (int, float)):
        return None
    mins = w.get("window_minutes") or 0
    resets = None
    if isinstance(w.get("resets_at"), (int, float)):
        resets = epoch_ms(w["resets_at"])
    elif isinstance(w.get("resets_in_seconds"), (int, float)) and at_ms:
        resets = at_ms + int(w["resets_in_seconds"] * 1000)
    label = "5h" if mins == 300 else "week" if mins == 10080 else "month" if mins >= 40000 else f"{round(mins / 60)}h" if mins else "limit"
    return {"key": label, "label": label, "used": float(w["used_percent"]), "resets": resets,
            "expired": bool(resets) and resets < now_ms(), "usd": None, "limit_usd": None, "period": None}


def codex_rollouts():
    t, out = time.time(), set()
    for k in range(-1, CODEX_DAYS + 1):
        day = time.strftime("%Y/%m/%d", time.localtime(t - k * 86400))
        for p in glob.glob(os.path.join(CODEX, "sessions", day, "rollout-*.jsonl")):
            try:
                if t - os.path.getmtime(p) <= CODEX_LIVE_S:
                    out.add(p)
            except OSError:
                pass
    return sorted(out, key=lambda p: os.path.getmtime(p), reverse=True)


def codex_limits():
    if not os.path.isdir(os.path.join(CODEX, "sessions")):
        return None
    best = None
    for path in codex_rollouts():
        try:
            size = os.path.getsize(path)
            with open(path, "rb") as f:
                f.seek(max(0, size - CODEX_TAIL))
                data = f.read()
        except OSError:
            continue
        for line in reversed(data.split(b"\n")):
            if b'"rate_limits"' not in line:
                continue
            try:
                d = json.loads(line)
            except ValueError:
                continue
            rl = (d.get("payload") or {}).get("rate_limits")
            if isinstance(rl, dict):
                at = epoch_ms(d.get("timestamp")) or 0
                if best is None or at > best[0]:
                    best = (at, rl)
                break
    windows, plan, updated = [], None, None
    if best:
        updated, rl = best
        plan = rl.get("plan_type")
        for key in ("primary", "secondary"):
            w = codex_window(rl.get(key), updated)
            if w:
                windows.append(w)
    return {"id": "codex", "name": "Codex", "installed": True, "connected": True, "error": None,
            "settings": None, "reports": 1 if best else 0, "updated": updated, "plan": plan, "windows": windows}


def codex_zero():
    return {"v": CACHE_VERSION, "off": 0, "id": None, "cwd": None, "started": None, "model": None,
            "tot": [0, 0, 0, 0], "snap": [0, 0, 0, 0], "turns": 0, "tools": 0, "ctx": 0, "base": 0,
            "hist": [], "tool": None, "window": None, "active": None}


def codex_usage(u):
    i, cached = num(u.get("input_tokens")), num(u.get("cached_input_tokens"))
    return [max(0, i - cached), num(u.get("output_tokens")), cached, num(u.get("cache_write_input_tokens"))]


def codex_tool(p):
    name = p.get("name") or "tool"
    args = p.get("arguments") if p.get("type") == "function_call" else p.get("input")
    target = ""
    if isinstance(args, str):
        try:
            a = json.loads(args)
            c = (a.get("command") or a.get("cmd") or a.get("path") or a.get("file_path") or "") if isinstance(a, dict) else ""
            target = " ".join(c) if isinstance(c, list) else str(c)
        except ValueError:
            target = args
    return (name + " " + " ".join(target.split())[:60]).strip()


def scan_codex(path, st):
    lines, off = read_new(path, st["off"])
    if lines is None:
        st.clear()
        st.update(codex_zero())
        lines, off = read_new(path, 0)
    st["off"] = off
    for line in lines:
        if not line.strip():
            continue
        try:
            d = json.loads(line)
        except ValueError:
            continue
        t, p = d.get("type"), d.get("payload") or {}
        if not isinstance(p, dict):
            continue
        pt = p.get("type")
        ts = epoch_ms(d.get("timestamp"))
        if t == "session_meta":
            st["id"] = p.get("id") or p.get("session_id")
            st["cwd"] = p.get("cwd")
            st["started"] = epoch_ms(p.get("timestamp") or d.get("timestamp"))
        elif t == "turn_context":
            st["model"] = p.get("model") or st["model"]
        elif t == "event_msg" and pt == "task_started":
            st["window"] = p.get("model_context_window") or st["window"]
            if ((p.get("turn_attribution") or {}).get("turn_trigger") or "user") == "user":
                st["snap"] = list(st["tot"])
        elif t == "event_msg" and pt == "token_count":
            info = p.get("info") or {}
            if isinstance(info.get("total_token_usage"), dict):
                st["tot"] = codex_usage(info["total_token_usage"])
            last = info.get("last_token_usage")
            if isinstance(last, dict):
                st["turns"] += 1
                st["ctx"] = num(last.get("total_tokens")) or num(last.get("input_tokens")) + num(last.get("output_tokens"))
                st["base"] = st["base"] or num(last.get("input_tokens"))
                st["hist"] = (st["hist"] + [st["ctx"]])[-HIST:]
            st["window"] = info.get("model_context_window") or st["window"]
            if ts:
                st["active"] = max(st["active"] or 0, ts)
        elif t == "response_item" and pt in ("function_call", "custom_tool_call"):
            st["tools"] += 1
            st["tool"] = codex_tool(p)


def codex_titles():
    out = {}
    try:
        with open(os.path.join(CODEX, "session_index.jsonl"), encoding="utf-8") as f:
            for line in f:
                try:
                    d = json.loads(line)
                except ValueError:
                    continue
                if d.get("id") and d.get("thread_name"):
                    out[d["id"]] = d["thread_name"]
    except OSError:
        pass
    return out


def codex_sessions(old):
    if not os.path.isdir(os.path.join(CODEX, "sessions")):
        return [], {}
    out, cache, titles = [], {}, None
    for path in codex_rollouts():
        key = os.path.basename(path)
        st = old.get(key)
        if not isinstance(st, dict) or st.get("v") != CACHE_VERSION:
            st = codex_zero()
        cache[key] = st
        try:
            scan_codex(path, st)
            mtime = int(os.path.getmtime(path) * 1000)
        except OSError as e:
            print(f"scan {path}: {e}", file=sys.stderr)
            continue
        if not st["id"]:
            continue
        if titles is None:
            titles = codex_titles()
        tot, turn = st["tot"], [a - b for a, b in zip(st["tot"], st["snap"])]
        out.append({
            "agent": "codex", "id": st["id"], "pid": None, "cwd": st["cwd"], "title": titles.get(st["id"]),
            "model": st["model"], "started": st["started"], "mtime": mtime, "active": st["active"],
            "total": {"in": tot[0], "out": tot[1], "cr": tot[2], "cw": tot[3], "usd": None, "estimated": False},
            "turn": {"in": turn[0], "out": turn[1], "cr": turn[2], "cw": turn[3], "usd": None, "estimated": False},
            "turns": st["turns"], "tools": st["tools"], "tool": st["tool"],
            "ctx": {"used": st["ctx"], "window": int(st["window"] or 0) or None, "base": st["base"],
                    "exact": bool(st["window"]), "growth": growth(st["hist"])},
        })
    return out, cache


# ---------------------------------------------------------------- statusLine connect / disconnect

def tee():
    return "{ [ -f %s ] && sh %s --tee || cat; }" % (shq(TAP), shq(TAP))


def wrap(command):
    return f"{tee()} | {{\n{command}\n}}" if command else f"{tee()} >/dev/null"


def unwrap(command):
    text = command.rstrip()
    if text == f"{tee()} >/dev/null":
        return ""
    opening, closing = f"{tee()} | {{\n", "\n}"
    if text.startswith(opening) and text.endswith(closing) and len(text) > len(opening) + len(closing):
        return text[len(opening):-len(closing)]
    return None


def save_settings(conn, settings):
    path = conn["path"]
    try:
        with open(path, encoding="utf-8") as f:
            current = f.read()
    except FileNotFoundError:
        current = None
    if current != conn["text"]:
        raise RuntimeError("Claude Code's settings changed while this ran. Try again.")
    if conn["text"] is not None:
        write_private(BACKUP, conn["text"])
    folder = os.path.dirname(path)
    os.makedirs(folder, exist_ok=True)
    mode = os.stat(path).st_mode & 0o777 if current is not None else 0o644
    fd, tmp = tempfile.mkstemp(dir=folder, prefix=".settings.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(json.dumps(settings, indent=2, ensure_ascii=False) + "\n")
        os.chmod(tmp, mode)
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def connect():
    conn = connection()
    if conn.get("error"):
        raise RuntimeError(conn["error"])
    if conn["connected"]:
        return {"ok": True, "changed": False, "settings": conn["path"]}
    settings = dict(conn["settings"])
    original = settings.get("statusLine")
    if isinstance(original, dict):
        command = original.get("command") if original.get("type") == "command" and isinstance(original.get("command"), str) else ""
        settings["statusLine"] = {**original, "type": "command", "command": wrap(command or "true")}
    else:
        settings["statusLine"] = {"type": "command", "command": wrap("")}
    save_settings(conn, settings)
    return {"ok": True, "changed": True, "settings": conn["path"]}


def disconnect():
    conn = connection()
    if conn.get("error"):
        raise RuntimeError(conn["error"])
    if not conn["connected"]:
        return {"ok": True, "changed": False, "settings": conn["path"]}
    settings = dict(conn["settings"])
    line = settings["statusLine"]
    inner = unwrap(line["command"])
    if inner is None:
        raise RuntimeError(f"The statusLine command in {conn['path']} no longer has the shape Connect wrote. Remove tap.sh from it by hand.")
    if inner:
        settings["statusLine"] = {**line, "command": inner}
    else:
        del settings["statusLine"]
    save_settings(conn, settings)
    return {"ok": True, "changed": True, "settings": conn["path"]}


# ---------------------------------------------------------------- main

def limits(tapped):
    providers = [claude_limits(tapped)]
    codex = codex_limits()
    if codex:
        providers.append(codex)
    return providers


def collect():
    tapped = taps()
    cache = read_json(CACHE, {})
    if not isinstance(cache, dict) or cache.get("v") != CACHE_VERSION:
        cache = {}
    claude, claude_cache = claude_sessions(cache.get("claude") or {}, tapped)
    codex, codex_cache = codex_sessions(cache.get("codex") or {})
    write_private(CACHE, json.dumps({"v": CACHE_VERSION, "claude": claude_cache, "codex": codex_cache}))
    return {"now": now_ms(), "providers": limits(tapped), "sessions": claude + codex}


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "all"
    try:
        if cmd == "limits":
            result = {"now": now_ms(), "providers": limits(taps())}
        elif cmd == "all":
            result = collect()
        elif cmd == "connect":
            result = connect()
        elif cmd == "disconnect":
            result = disconnect()
        else:
            raise RuntimeError(f"unknown command {cmd}")
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        return 1
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    sys.exit(main())
