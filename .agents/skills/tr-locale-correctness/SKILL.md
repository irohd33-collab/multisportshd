---
name: tr-locale-correctness
description: Read before writing code that cases, sorts, searches, slugifies, or formats Turkish text, money, dates, phones.
---
# Turkish Locale Correctness

Turkish has FOUR letters i (i, İ, ı, I) and default Unicode casing gets all of them wrong — silently. The bugs surface as search filters that miss "ISPARTA" when the user types "ısparta", username dedupe that collides or fails randomly, Çelik sorted after Zorlu, and money shown with US separators. Every rule below has bitten a real app; apply them mechanically.

## Hard rules

1. **Casing:** any `.toLowerCase()` / `.toUpperCase()` / `.lower()` / `.upper()` on text that can contain Turkish is a bug. JS: `toLocaleLowerCase("tr")` / `toLocaleUpperCase("tr")` (`"tr-TR"` is equivalent). Python: there is NO locale-aware `str.lower` — copy the `tr_lower`/`tr_upper` helpers below. Facts: `"İ".toLowerCase()` → `"i̇"` = `i` + U+0307 combining dot, **length 2**, in BOTH JS and Python; `"I".toLowerCase()` → `"i"`, never `"ı"`; `"i".toUpperCase()` → `"I"`, never `"İ"`.
2. **Case-insensitive compare / dedupe / search:** run BOTH sides through the same tr-aware lowercaser before comparing or indexing. `tr_lower("ISPARTA") == tr_lower("ısparta")` must hold.
3. **Sorting names/labels:** JS `new Intl.Collator("tr").compare`; Python `locale.strxfrm` after `setlocale(LC_COLLATE, "tr_TR.UTF-8")`, with the explicit-alphabet fallback below when the locale is not installed. Turkish order: `a b c ç d e f g ğ h ı i j k l m n o ö p r s ş t u ü v y z` — ç after c, ı BEFORE i, ö after o, ü after u. Never `arr.sort()` / `sorted(arr)` on Turkish strings.
4. **Money:** dot thousands, comma decimals, exactly 2 decimals, symbol AFTER the number with a non-breaking space: `1.234.567,89 ₺`. Never hand-concatenate: `` `${v} TL` `` and `f"{v} TL"` are forbidden. Note: current ICU puts ₺ BEFORE the number (`₺1.234.567,89`); Turkish invoice/TCMB convention is after — the `formatToParts` helper below is ICU-version-proof.
5. **Time:** store and query UTC (`timestamptz`, ISO-8601 with `Z`). Display Europe/Istanbul — fixed UTC+3, no DST since Sept 2016 — but always via the named zone, never a hardcoded `+3` (pre-2016 historical data had DST). Every report/table header must label its zone, e.g. `(Europe/Istanbul, UTC+3)`.
6. **Slugs/identifiers:** explicit translate table `ç→c ğ→g ı→i ö→o ş→s ü→u` (plus uppercase forms) applied BEFORE ASCII cleanup. NFKD+ascii-ignore silently DELETES `ı` (U+0131 has no decomposition): `"Kadıköy"` → `"Kadkoy"`.
7. **Phones:** store E.164 `+905xxxxxxxxx`; display `+90 5xx xxx xx xx`. Never store the display form.

If sorting needs the system locale (Python `strxfrm` path), install it first — dash-safe, root available:

```sh
locale -a | grep -qi '^tr_TR\.utf8$' || { apt-get install -y locales >/dev/null && locale-gen tr_TR.UTF-8; }
```

## Working example — JS/TS (`tr.js`, run: `node tr.js`, no deps)

```js
const assert = require("node:assert");

// --- Casing: the dotted/dotless i trap
assert.strictEqual("İ".toLowerCase().length, 2);         // "i̇" — silent bug
assert.strictEqual("İ".toLocaleLowerCase("tr"), "i");    // length 1 — correct
assert.strictEqual("I".toLocaleLowerCase("tr"), "ı");    // NOT "i"
assert.strictEqual("i".toLocaleUpperCase("tr"), "İ");    // NOT "I"
const trLower = (s) => s.toLocaleLowerCase("tr");
const trEq = (a, b) => trLower(a) === trLower(b);
assert.ok(trEq("ISPARTA", "ısparta"));                   // fails with plain toLowerCase()
// ICU canary: if the "I"→"ı" assert above throws, this Node is a small-icu build —
// reinstall via nvm (nvm builds bundle full ICU).

// --- Sorting
const names = ["çelik", "cengiz", "ışık", "irmak", "üzüm", "uğur"];
names.sort(new Intl.Collator("tr").compare);
assert.deepStrictEqual(names, ["cengiz", "çelik", "ışık", "irmak", "uğur", "üzüm"]);

// --- Money: Intl for separators, formatToParts to force the Turkish suffix form
function formatTRY(v) {
  const parts = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" })
    .formatToParts(v);                                   // works on old AND new ICU
  const num = parts.filter((p) => p.type !== "currency" && p.type !== "literal")
    .map((p) => p.value).join("");
  return `${num} ₺`;                                // NBSP, symbol AFTER
}
assert.strictEqual(formatTRY(1234567.89), "1.234.567,89 ₺");

// --- Dates: store UTC, display Europe/Istanbul (fixed UTC+3, no DST since 2016)
const t = new Date("2026-08-20T11:30:00Z");
const opt = { timeZone: "Europe/Istanbul" };
const gun = new Intl.DateTimeFormat("tr-TR", { ...opt, dateStyle: "short" }).format(t);
const saat = new Intl.DateTimeFormat("tr-TR", { ...opt, timeStyle: "short" }).format(t);
assert.strictEqual(`${gun} ${saat}`, "20.08.2026 14:30"); // 11:30Z = 14:30 TRT
const raporBasligi = `Rapor: ${gun} ${saat} (Europe/Istanbul, UTC+3)`;

// --- Slugify: explicit map — both ı and İ must become "i", nothing dropped
const TR_MAP = { "ç":"c","Ç":"c","ğ":"g","Ğ":"g","ı":"i","I":"i","İ":"i",
                 "ö":"o","Ö":"o","ş":"s","Ş":"s","ü":"u","Ü":"u" };
const slugify = (s) => s.replace(/[çÇğĞıIİöÖşŞüÜ]/g, (c) => TR_MAP[c])
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
assert.strictEqual(slugify("Kadıköy İskelesi"), "kadikoy-iskelesi");

// --- Phone: store E.164, display +90 5xx xxx xx xx
function trPhone(raw) {
  let d = raw.replace(/\D/g, "");
  if (d.length > 10 && d.startsWith("90")) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  if (!/^5\d{9}$/.test(d)) throw new Error(`geçersiz numara: ${raw}`);
  return { e164: `+90${d}`,
           display: `+90 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8)}` };
}
assert.deepStrictEqual(trPhone("0505 123 45 67"),
  { e164: "+905051234567", display: "+90 505 123 45 67" });
console.log("tr.js: all checks passed —", raporBasligi);
```

## Working example — Python (`tr.py`, run: `python3 tr.py`, stdlib only, 3.9+)

```python
import locale
import re
import unicodedata
from datetime import datetime, timezone
from zoneinfo import ZoneInfo  # minimal images: apt-get install -y tzdata

# --- Casing: str.lower() has NO locale awareness — helpers are mandatory
assert len("İ".lower()) == 2                    # "i̇" — silent bug, both langs
_L = str.maketrans({"I": "ı", "İ": "i"})        # translate the two capitals FIRST,
_U = str.maketrans({"ı": "I", "i": "İ"})        # then plain lower/upper is safe
def tr_lower(s: str) -> str: return s.translate(_L).lower()
def tr_upper(s: str) -> str: return s.translate(_U).upper()
assert tr_lower("ISPARTA") == "ısparta"         # .lower() gives "isparta" — wrong
assert tr_upper("istanbul") == "İSTANBUL"       # .upper() gives "ISTANBUL" — wrong
assert tr_lower("ISPARTA") == tr_lower("ısparta")   # case-insensitive compare

# --- Sorting: strxfrm if tr_TR.UTF-8 is installed, explicit-alphabet fallback if not
ALPHABET = "abcçdefgğhıijklmnoöprsştuüvyz"      # official 29-letter order
ORDER = {c: i for i, c in enumerate(ALPHABET)}
def tr_key(s: str):                             # digits/foreign chars sort after letters
    return [ORDER.get(c, 100 + ord(c)) for c in tr_lower(s)]
try:
    locale.setlocale(locale.LC_COLLATE, "tr_TR.UTF-8")
    key = locale.strxfrm                        # see locale-gen one-liner above
except locale.Error:
    key = tr_key
names = ["çelik", "cengiz", "ışık", "irmak", "üzüm", "uğur"]
assert sorted(names, key=key) == ["cengiz", "çelik", "ışık", "irmak", "uğur", "üzüm"]

# --- Money: f-string gives US separators; swap them, then NBSP + suffix symbol
def format_try(v: float) -> str:
    s = f"{v:,.2f}"                             # "1,234,567.89"
    s = s.replace(",", "\x00").replace(".", ",").replace("\x00", ".")
    return f"{s} ₺"
assert format_try(1234567.89) == "1.234.567,89 ₺"

# --- Dates: store UTC, display Europe/Istanbul, LABEL the zone in output
IST = ZoneInfo("Europe/Istanbul")               # fixed UTC+3, no DST since 2016
utc_dt = datetime(2026, 8, 20, 11, 30, tzinfo=timezone.utc)
line = utc_dt.astimezone(IST).strftime("%d.%m.%Y %H:%M") + " (Europe/Istanbul, UTC+3)"
assert line == "20.08.2026 14:30 (Europe/Istanbul, UTC+3)"

# --- Slugify: NFKD-only DELETES ı (no decomposition) — proof, then the right way
bad = unicodedata.normalize("NFKD", "Kadıköy").encode("ascii", "ignore").decode()
assert bad == "Kadkoy"                          # never ship this
SLUG = str.maketrans({"ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u"})
def slugify(s: str) -> str:                     # tr_lower handles İ→i and I→ı→i
    return re.sub(r"[^a-z0-9]+", "-", tr_lower(s).translate(SLUG)).strip("-")
assert slugify("Kadıköy İskelesi") == "kadikoy-iskelesi"

# --- Phone: E.164 in DB, grouped for display
def tr_phone(raw: str) -> dict:
    d = re.sub(r"\D", "", raw)
    if len(d) > 10 and d.startswith("90"):
        d = d[2:]
    d = d.removeprefix("0")
    if not re.fullmatch(r"5\d{9}", d):
        raise ValueError(f"geçersiz numara: {raw}")
    return {"e164": f"+90{d}", "display": f"+90 {d[:3]} {d[3:6]} {d[6:8]} {d[8:]}"}
assert tr_phone("0505 123 45 67") == {"e164": "+905051234567",
                                      "display": "+90 505 123 45 67"}
print("tr.py: all checks passed")
```

## Self-check (run before shipping)

- Grep the diff for `toLowerCase()`, `toUpperCase()`, `.lower()`, `.upper()`, `casefold()` — every hit is either tr-aware or provably ASCII-only (IDs, hex, enum tags).
- `"İ".toLocaleLowerCase("tr").length === 1` and `"I".toLocaleLowerCase("tr") === "ı"` pass in the TARGET runtime (a small-icu Node fails; nvm builds pass).
- Typing `ısparta` in every search box finds `ISPARTA`, and vice versa.
- The rendered list sorts `["çelik","cengiz","ışık","irmak"]` as `cengiz, çelik, ışık, irmak`.
- A sample amount renders exactly `1.234.567,89 ₺` — comma before 2 decimals, symbol after, NBSP.
- `2026-08-20T11:30:00Z` in the DB displays as `14:30` and the page/report names its zone.
- `slugify("Kadıköy İskelesi") == "kadikoy-iskelesi"` — no character silently dropped.
- Phone round-trip: input `0505 123 45 67` → stored `+905051234567` → shown `+90 505 123 45 67`.

## Anti-patterns (all seen in production)

- `query.toUpperCase()` on search input: user types `izmir`, code compares against `"İZMİR".toLowerCase()` = `"i̇zmi̇r"` (combining dots, length 6) — never equal, filter returns nothing, no error logged.
- Username/email dedupe via plain `.lower()`: `IŞIK` normalizes to `isik`-adjacent garbage while `ışık` stays `ışık` — duplicate accounts pass the uniqueness check.
- `names.sort()` / `sorted(names)` on Turkish names: `Çelik` (U+00C7 > Z) and `Şahin` land AFTER `Zorlu`; `Ömer` after `Zeynep`.
- `` `${total.toFixed(2)} TL` `` or default `toLocaleString()`: prints `1,234,567.89 TL` — a Turkish reader parses the value off by ×1000; comma/dot roles are inverted.
- One report table mixing UTC `created_at` with server-local `now()` and no zone label — rows appear 3 hours apart from reality and the discrepancy shifts per column.
- `unicodedata.normalize("NFKD", s).encode("ascii","ignore")` slugify: `Kadıköy` → `Kadkoy`, `Ilıca` → `Ilca` — `ı` has no decomposition and is deleted outright.
- Hardcoded `ts + 3*3600` instead of the named `Europe/Istanbul` zone: wrong for all pre-2016 timestamps (DST era) and breaks on any future tzdata change.
- Storing the display phone `+90 505 123 45 67` and later comparing it with string equality against E.164 `+905051234567` — lookups miss, duplicate contacts pile up.
