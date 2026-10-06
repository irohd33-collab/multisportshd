---
name: telegram-formatting
description: Read before sending any Telegram Bot API message or report — HTML escaping, 4096 splits, tables, 400/429 recovery.
---
# Telegram Formatting

The operator channel is Telegram. One bad entity makes `sendMessage` return 400, and from the user's side
the report silently never arrives. Send through the helper below — it escapes, splits, degrades on parse
errors, and obeys flood control.

## Hard rules

1. `parse_mode: "HTML"` always. MarkdownV2 only when explicitly demanded — 18 metachars, every
   unescaped one a fatal 400.
2. Run `esc()` on EVERY interpolated value: usernames, domains, error strings, filenames. One stray `<`
   or `&` from user data kills the whole message.
3. Allowed tags only: `<b> <i> <u> <s> <a href> <code> <pre> <blockquote> <tg-spoiler>`. Newline is `\n` —
   `<br>`, `<p>`, `<div>`, `<table>` are 400 errors.
4. Hard limit 4096 chars/message. Split at 4000 on `\n\n` boundaries with a `(i/n)` suffix per part;
   never split inside a tag pair — keep each entity in one paragraph, each paragraph under 4000 chars.
5. No real tables in Telegram. Use aligned monospace inside `<pre>` — pad with `ljust`/`rjust` BEFORE
   escaping, max ~34 chars per line to fit a phone — or bold-label lines: `<b>Durum:</b> Mutabık`.
6. Numbers: always thousands-separated with currency via `money()`. Never `f"{total}"` on a float.
7. Long reports: max ~15 summary lines as the message, full data as `sendDocument` (xlsx/pdf). Caption:
   max 1024 chars, same parse/escape rules as message text.
8. Buttons: `inline_keyboard`; `callback_data` max 64 UTF-8 BYTES — measure `len(s.encode())`, not `len(s)`.
9. Rate limits: ~30 msg/s global, 1 msg/s per chat. Sleep >=1 s between parts; on 429 wait `retry_after`.
10. Never drop a message on 400 "can't parse entities": strip tags, unescape, resend as plain text.

## Helper module — `tg.py`

```python
# tg.py -- polished Telegram sends via Bot API. Deps: pip install requests
import html as _html, json, os, re, time
import requests

TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]          # never hardcode the token
API = f"https://api.telegram.org/bot{TOKEN}"
MDV2_META = "_*[]()~`>#+-=|{}.!"                  # ALL 18 MarkdownV2 metachars

def esc(s):
    """HTML mode: only these 4 escapes. Run on EVERY interpolated value."""
    return (str(s).replace("&", "&amp;").replace("<", "&lt;")
                  .replace(">", "&gt;").replace('"', "&quot;"))

def esc_md2(s):
    """Only when MarkdownV2 is explicitly demanded. One missed char = HTTP 400."""
    return re.sub("([" + re.escape(MDV2_META) + "])", r"\\\1", str(s))

def money(v, cur="TL"):
    """182350.5 -> '182.350,50 TL'. Never send raw floats to chat."""
    s = f"{float(v):,.2f}".replace(",", "_").replace(".", ",").replace("_", ".")
    return f"{s} {cur}"

def _pack(items, sep, limit):
    out, buf = [], ""
    for it in items:
        if sep == "\n\n" and len(it) > limit:     # oversized paragraph -> lines
            if buf: out.append(buf)
            buf = ""
            out.extend(_pack(it.split("\n"), "\n", limit))
        elif buf and len(buf) + len(sep) + len(it) > limit:
            out.append(buf); buf = it
        else:
            buf = buf + sep + it if buf else it
    return out + [buf] if buf else out

def split_parts(text, limit=4000):                # 4096 minus room for '(2/3)' suffix
    return [text] if len(text) <= 4096 else _pack(text.split("\n\n"), "\n\n", limit)

def _post(method, payload, files=None):
    for _ in range(4):
        r = requests.post(f"{API}/{method}", data=payload, files=files, timeout=30)
        if r.ok:
            return r.json()
        if r.status_code == 429:                  # flood control: obey, then retry
            time.sleep(r.json()["parameters"]["retry_after"] + 1); continue
        if r.status_code == 400 and "can't parse entities" in r.text:
            payload = {**payload}                 # degrade to plain text, never drop
            payload.pop("parse_mode", None)
            for k in ("text", "caption"):
                if k in payload:
                    payload[k] = _html.unescape(re.sub(r"<[^>]+>", "", payload[k]))
            continue
        raise RuntimeError(f"{method} -> {r.status_code}: {r.text[:200]}")
    raise RuntimeError(f"{method}: gave up after 4 attempts")

def send(chat_id, html, reply_markup=None):
    parts = split_parts(html)
    for i, part in enumerate(parts, 1):
        if len(parts) > 1:
            part += f"\n\n<i>({i}/{len(parts)})</i>"      # per-part suffix
        payload = {"chat_id": chat_id, "text": part, "parse_mode": "HTML",
                   "disable_web_page_preview": True}
        if reply_markup and i == len(parts):      # buttons only on the last part
            payload["reply_markup"] = reply_markup
        _post("sendMessage", payload)
        if i < len(parts): time.sleep(1.1)        # limit: 1 msg/s per chat

def send_document(chat_id, path, caption_html=""):
    with open(path, "rb") as f:
        blob = f.read()                           # bytes survive a 429 retry
    return _post("sendDocument",
                 {"chat_id": chat_id, "caption": caption_html[:1024], "parse_mode": "HTML"},
                 files={"document": (os.path.basename(path), blob)})

def buttons(*rows):
    """buttons([("Onayla", "ok:42"), ("Reddet", "no:42")]) -> reply_markup string."""
    kb = [[{"text": t, "callback_data": d} for t, d in row] for row in rows]
    for b in (b for row in kb for b in row):
        assert len(b["callback_data"].encode()) <= 64, f"callback_data > 64 bytes: {b}"
    return json.dumps({"inline_keyboard": kb})
```

## Usage — deposit summary + document + ack buttons

```python
# report.py -- daily deposit summary: pretty message + xlsx attachment + ack buttons
from tg import buttons, esc, money, send, send_document

CHAT = -1001234567890                             # operator channel id

rows = [("Havale", 182350.00, 41),
        ("Kredi Karti", 96410.50, 87),
        ("Papara", 12000.00, 9)]
total = sum(r[1] for r in rows)

# Pad FIRST (visible width), escape AFTER: esc() adds chars, not visible width.
table = [f"{name:<12}{money(amt):>17}" for name, amt, _ in rows]   # 29 cols < 34
table += ["-" * 29, f"{'TOPLAM':<12}{money(total):>17}"]

msg = (
    "<b>Günlük Yatırım Özeti</b> — 20.08.2026\n"
    "\n"
    "<pre>" + esc("\n".join(table)) + "</pre>\n"
    "\n"
    f"<b>İşlem:</b> {sum(r[2] for r in rows)} adet\n"
    f"<b>Durum:</b> {esc('Mutabık')}"
)
send(CHAT, msg, reply_markup=buttons([("Onayla", "dep:0820:ok"),
                                      ("Reddet", "dep:0820:no")]))
send_document(CHAT, "/workspace/reports/deposits-2026-08-20.xlsx",
              caption_html="<b>Detay dökümü</b> — 137 kayıt, 3 yöntem, 290.760,50 TL")

# Renders on a phone as:
#   Günlük Yatırım Özeti — 20.08.2026    (bold title)
#
#   Havale         182.350,00 TL          (monospace, aligned)
#   Kredi Karti     96.410,50 TL
#   Papara          12.000,00 TL
#   -----------------------------
#   TOPLAM         290.760,50 TL
#
#   İşlem: 137 adet
#   Durum: Mutabık
#   [ Onayla ]  [ Reddet ]
```

## MarkdownV2 escapes (only when demanded)

Escape with a backslash, per context — miss one and the message is lost.

| Context | Escape these |
|---|---|
| Regular text | all 18: `_` `*` `[` `]` `(` `)` `~` `` ` `` `>` `#` `+` `-` `=` `\|` `{` `}` `.` `!` |
| Inside `pre`/`code` entities | only `` ` `` and `\` |
| Inside a link/emoji URL `(...)` | only `)` and `\` |

`esc_md2()` implements the regular-text column. Note `.` and `!` are metachars: "Rapor hazır."
unescaped is already a 400.

## Self-check

Before calling send, confirm:

- [ ] `parse_mode` is HTML; every dynamic value passed through `esc()`.
- [ ] Only allowed tags; no `<br>`/`<p>`/`<table>`; every tag closed in the same paragraph.
- [ ] `len(text)` printed; anything over 4096 goes through `split_parts()`; no paragraph over 4000 chars.
- [ ] Every amount went through `money()`; `re.search(r"\d+\.\d", text)` finds no raw float.
- [ ] `max(len(l) for l in pre_lines)` <= 34.
- [ ] Every `callback_data`: `len(s.encode()) <= 64`.
- [ ] Caption <= 1024 chars, escaped like message text.
- [ ] All sends go through `_post` (429 retry + plain fallback), never raw `requests.post`.
- [ ] Multipart/burst sends sleep 1.1 s between messages to one chat.

## Anti-patterns

- MarkdownV2 with unescaped `.` or `-`: "Rapor v2.1 - hazır." → 400, report lost, user sees nothing.
- One 5000-char `sendMessage` → 400 MESSAGE_TOO_LONG; whole report dropped instead of 2 parts.
- ASCII-art table outside `<pre>`: proportional font destroys the columns on every phone.
- `for row in rows: send(...)` — 20 messages in a burst → 429 mid-loop, tail of the report lost.
  Batch into one `<pre>` table, or sleep 1.1 s per message.
- `Toplam: 290760.5 TL` — raw float, unreadable; must be `290.760,50 TL`.
- `try: send(...) except: pass` — parse errors vanish silently; degrade to plain text, never swallow.
- Slicing `text[:4096]` blindly — cuts `</b>` in half, so part 1 AND part 2 both 400.
- JSON blob in `callback_data` (over 64 bytes) → BUTTON_DATA_INVALID; send a short id like `dep:0820:ok`.
- Escaping before padding: `esc()` turns `&` into `&amp;` (5 chars, 1 visible) and shifts every column.
