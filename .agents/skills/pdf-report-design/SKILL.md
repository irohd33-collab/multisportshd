---
name: pdf-report-design
description: Build polished PDF reports with reportlab - Turkish/unicode TTF fonts (fixes the box glyphs), cover page, styled tables, matplotlib charts, page headers. Read BEFORE any PDF script.
---

# Polished PDF reports (reportlab + matplotlib)

Rules for every PDF you generate. Output strings stay in the user's language;
the mechanics below are language-neutral.

## RULE ZERO — fonts. This is why Turkish text became ■■■ boxes.

reportlab's built-in Helvetica/Times are WinAnsi: **ğ İ ş ı** render as black
boxes. Register a real TTF FIRST, before any drawing, and never mention
Helvetica again:

```python
import os
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

def register_fonts():
    cands = [
        ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
         "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
        ("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
         "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"),
    ]
    for reg, bold in cands:
        if os.path.exists(reg):
            pdfmetrics.registerFont(TTFont("Rapor", reg))
            pdfmetrics.registerFont(TTFont("Rapor-Bold", bold if os.path.exists(bold) else reg))
            # The MONO face is registered HERE, not later: md_inline() below emits
            # <font face="RMono"> for every code span, and reportlab raises on an
            # unregistered face — which is how a script ends up abandoning the
            # markdown converter and printing raw backticks instead.
            mono = reg.replace("Sans.ttf", "SansMono.ttf").replace("Sans-Regular", "Mono-Regular")
            pdfmetrics.registerFont(TTFont("RMono", mono if os.path.exists(mono) else reg))
            return "Rapor"
    raise SystemExit("TTF yok: `apt-get install -y fonts-dejavu-core` çalıştır, sonra tekrar dene")
FONT = register_fonts()
```

- Sandbox image lacks the font? `apt-get install -y fonts-dejavu-core` (root, gVisor-safe).
- EVERY ParagraphStyle and TableStyle below uses `FONT` / `"Rapor-Bold"` — one
  stray default font resurrects the boxes.
- Verify before shipping: render "ğüşiöçİĞÜŞÖÇ ₺" on the cover; if the extracted
  text (pdftotext) or a screenshot shows boxes, STOP and fix the font.
- Subscript/superscript: NEVER unicode ₁²₃ (missing glyphs) — Paragraph markup
  `H<sub>2</sub>O`, `x<super>2</super>`.

### The other box: EMOJI. No emoji in a PDF. None.

Registering the font is only half of it. **DejaVu has no emoji** — 🔴 🚨 ❌ ✅ 📌 🔥
are all missing — and reportlab does **not** raise when a glyph is missing: it
silently draws `.notdef`, which is the empty box, and the box ships to the
customer. Worse, `pdftotext` extracts *nothing* for it, so a text-based check
sees a clean file. (Real case, 2026-08-23: every finding title in a security
report opened with a box because the model prefixed it with 🔴.)

Severity is a **coloured chip with a word in it** — that is what the card layout
below is for. It is never an emoji. Symbols that DejaVu *does* have and you may
use: `— → ✓ ✗ ≤ ≥ · § ₺ € ± ×`.

Make it impossible instead of remembering it. Every string that reaches a
flowable goes through one helper, and that helper checks coverage:

```python
_MISSING_CACHE: set[str] = set()

def glyph_check(text: str, font: str = FONT) -> str:
    """Raise on any character the registered TTF cannot draw.

    reportlab fails SILENTLY here (draws .notdef = a box), so this is the only
    thing standing between a missing glyph and the delivered report."""
    c2g = pdfmetrics.getFont(font).face.charToGlyph
    bad = {ch for ch in text if ch not in "\n\t" and c2g.get(ord(ch)) is None}
    if bad:
        detail = ", ".join(f"U+{ord(c):04X} {c!r}" for c in sorted(bad))
        raise ValueError(f"{font} has no glyph for: {detail} — remove it (emoji?) "
                         f"or use a symbol DejaVu carries")
    return text
```

Test it once, at the top of the script, so a wrong font path fails immediately:
`glyph_check("ğüşıöçİĞÜŞÇÖ ₺ → ✓")`.

## Architecture: Platypus, never raw canvas

Raw `canvas.drawString` at hand-picked coordinates produces ransom notes. Use
`SimpleDocTemplate` + flowables; the canvas is ONLY for the page frame
(header/footer) via `onPage`:

```python
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
                                TableStyle, PageBreak, Image, KeepTogether)
from reportlab.lib.styles import ParagraphStyle

ACCENT = colors.HexColor("#1F4E78"); ACCENT2 = colors.HexColor("#2E75B6")
LIGHT = colors.HexColor("#F2F7FB");  MUTED = colors.HexColor("#808080")
GOOD = colors.HexColor("#2E9E5B");   BAD = colors.HexColor("#C0392B")

S_TITLE = ParagraphStyle("t",  fontName="Rapor-Bold", fontSize=22, textColor=ACCENT, spaceAfter=4)
S_SUB   = ParagraphStyle("s",  fontName="Rapor", fontSize=10, textColor=MUTED, spaceAfter=12)
S_H1    = ParagraphStyle("h1", fontName="Rapor-Bold", fontSize=14, textColor=ACCENT,
                         spaceBefore=14, spaceAfter=6)
S_BODY  = ParagraphStyle("b",  fontName="Rapor", fontSize=9.5, leading=13)
S_NOTE  = ParagraphStyle("n",  fontName="Rapor", fontSize=8, textColor=MUTED)

def page_frame(canv, doc):
    canv.saveState()
    canv.setFillColor(ACCENT); canv.rect(0, A4[1]-16*mm, A4[0], 16*mm, stroke=0, fill=1)
    canv.setFillColor(colors.white); canv.setFont("Rapor-Bold", 10)
    canv.drawString(14*mm, A4[1]-10.5*mm, "Günlük Yatırım Raporu")
    canv.setFont("Rapor", 8); canv.setFillColor(colors.white)
    canv.drawRightString(A4[0]-14*mm, A4[1]-10.5*mm, "20 Ağustos 2026 · UTC")
    canv.setFillColor(MUTED); canv.setFont("Rapor", 8)
    canv.drawRightString(A4[0]-14*mm, 8*mm, f"Sayfa {doc.page}")
    canv.restoreState()

doc = SimpleDocTemplate("/workspace/rapor.pdf", pagesize=A4,
                        topMargin=22*mm, bottomMargin=16*mm,
                        leftMargin=14*mm, rightMargin=14*mm)
story = []
# ... flowables ...
doc.build(story, onFirstPage=page_frame, onLaterPages=page_frame)
```

## Cover block + KPI row

First page: big title, period, then a one-row KPI strip (a 4-cell Table):

```python
def kpi_strip(items):  # items: [(label, value, delta_str_or_None)]
    cells = []
    for label, value, delta in items:
        block = [Paragraph(label.upper(), S_NOTE),
                 Paragraph(f'<font size="17" color="#1F4E78"><b>{value}</b></font>', S_BODY)]
        if delta:
            up = delta.startswith("+") or delta.startswith("▲")
            block.append(Paragraph(f'<font color="{"#2E9E5B" if up else "#C0392B"}"><b>{delta}</b></font>', S_NOTE))
        cells.append(block)
    t = Table([cells], colWidths=[(A4[0]-28*mm)/len(cells)]*len(cells))
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), LIGHT),
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("TOPPADDING", (0,0), (-1,-1), 8), ("BOTTOMPADDING", (0,0), (-1,-1), 8),
        ("LEFTPADDING", (0,0), (-1,-1), 10),
    ]))
    return t
```

## Tables: banded, breathing, never caged

```python
def styled_table(header, rows, col_widths, money_cols=()):
    data = [header] + rows
    t = Table(data, colWidths=col_widths, repeatRows=1)   # repeatRows = header on every page!
    style = [
        ("FONTNAME", (0,0), (-1,-1), "Rapor"),
        ("FONTNAME", (0,0), (-1,0), "Rapor-Bold"),
        ("FONTSIZE", (0,0), (-1,-1), 9),
        ("BACKGROUND", (0,0), (-1,0), ACCENT),
        ("TEXTCOLOR", (0,0), (-1,0), colors.white),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, LIGHT]),   # zebra
        ("LINEBELOW", (0,0), (-1,0), 0.75, ACCENT),                   # only line: under header
        ("TOPPADDING", (0,0), (-1,-1), 5), ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
    ]
    for c in money_cols:
        style.append(("ALIGN", (c,1), (c,-1), "RIGHT"))
    t.setStyle(TableStyle(style))
    return t
```

- Numbers pre-formatted per locale: `f"{v:,.0f} ₺".replace(",", ".")` for tr-TR.
- Emphasis: top-3 rows via extra style tuples `("FONTNAME",(0,1),(-1,3),"Rapor-Bold")`
  and a left accent `("LINEBEFORE",(0,1),(0,3),2,ACCENT2)` — NOT full-row yellow.
- Long tables: `repeatRows=1` is mandatory; wrap section title + first rows in
  `KeepTogether` so a heading never orphans at a page bottom.
- Cell text that can be long → wrap it in `Paragraph(txt, S_BODY)` (plain strings don't wrap).

## Charts: matplotlib PNGs (crisper than reportlab.graphics)

Render at 150+ dpi with one styled figure helper, embed as `Image`:

```python
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

def chart_png(path, kind, labels, values, title, unit=""):
    plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 9,
                         "axes.edgecolor": "#CCCCCC", "axes.linewidth": 0.6})
    fig, ax = plt.subplots(figsize=(6.6, 3.2), dpi=150)
    if kind == "bar":
        bars = ax.bar(labels, values, color="#2E75B6", width=0.55)
        ax.bar_label(bars, fmt=lambda v: f"{v/1000:,.0f}K", fontsize=8, color="#1F4E78")
    else:  # line
        ax.plot(labels, values, color="#1F4E78", linewidth=1.8)
        ax.fill_between(range(len(values)), values, color="#2E75B6", alpha=0.15)
    ax.set_title(title, fontsize=11, fontweight="bold", color="#1F4E78", loc="left")
    ax.spines[["top", "right"]].set_visible(False)
    ax.grid(axis="y", color="#E8E8E8", linewidth=0.5); ax.set_axisbelow(True)
    if unit: ax.set_ylabel(unit, fontsize=8, color="#808080")
    fig.tight_layout(); fig.savefig(path, transparent=False); plt.close(fig)

chart_png("/tmp/top5.png", "bar", names, amounts, "Top 5 Yatırımcı", "₺")
story.append(Image("/tmp/top5.png", width=170*mm, height=82*mm))
```

- DejaVu Sans in matplotlib matches the PDF font — Turkish safe there too.
- One message per chart; mixed currencies never share an axis.
- No matplotlib in the venv? `pip install matplotlib` (sandbox venv), or fall
  back to reportlab.graphics `VerticalBarChart` with `strokeColor=None`,
  `fillColor=HexColor("#2E75B6")` and a category axis using FONT.

## Findings reports (audit, review, incident) — the wall-of-text trap

THE FAILURE THIS SECTION EXISTS FOR. A security audit shipped with `### K-1 — OTP:
kriptografik olmayan RNG` printed **literally** in the body, a stray `--` floating
mid-page, and 32 findings running together as one undifferentiated block. The cover
page was fine; everything after it was unreadable.

### reportlab does not speak markdown. Ever.

`Paragraph()` understands a small HTML subset — `<b> <i> <u> <br/> <font> <a> <super>`
— and nothing else. Markdown passes straight through and prints as characters:

| You write | Reader sees |
| --- | --- |
| `### K-1 — Title` | `### K-1 — Title` in body type |
| `**critical**` | `**critical**` |
| `` `server.js:131` `` | `` `server.js:131` `` with backticks |
| `---` or `--` | a lonely `--` |
| `- bullet` | `- bullet`, no indent, no bullet |

If your content came from markdown (a model wrote it, a file holds it), you MUST
convert it. Never paste it into a Paragraph.

```python
import re
from xml.sax.saxutils import escape

def md_inline(text: str) -> str:
    """Markdown INLINE → reportlab markup. Escape first, then add tags."""
    s = escape(text)                                            # & < > — always first
    s = re.sub(r"`([^`]+)`", r'<font face="RMono" size="8.5">\1</font>', s)
    s = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", s)
    s = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<i>\1</i>", s)
    return s
```

### Build EVERY Paragraph through one helper

The two defects above — leaked markdown and box glyphs — both come from a string
reaching `Paragraph()` unexamined. Give the script exactly one door and neither
can happen again:

```python
def P(text: str, style) -> Paragraph:
    """The ONLY way a string becomes a flowable in this script."""
    body = md_inline(text)          # markdown → reportlab markup, escaped
    glyph_check(re.sub(r"<[^>]+>", "", body))   # check the visible text only
    # Checked on the CONVERTED string: md_inline is supposed to have consumed
    # these. Anything left is an unmatched marker, and it prints as itself.
    if re.search(r"\*\*|`", body):
        raise ValueError(f"markdown survived md_inline: {text[:80]!r}")
    # Block markdown must never reach a flowable at all — it is a heading or a
    # list, so it needs its own flowable, not a Paragraph that prints "### ".
    if re.match(r"\s*(#{1,6}\s|[-*+]\s|\|)", text):
        raise ValueError(f"block markdown reached P(): {text[:80]!r}")
    return Paragraph(body, style)
```

Then never write `Paragraph(...)` anywhere else — `P(...)` everywhere, table cells
included. A cell built as a bare string is the usual place backticks escape.

Strip block markdown (`#`, `-`, `|`) BEFORE it reaches a flowable — a `###` line is a
heading, so make it `Paragraph(text, S_H2)`; a `-` line is a bullet, so make it a
`ListFlowable` or a table row. Decide the flowable from the markdown, then throw the
markdown away.

### One finding = one card, never a run of paragraphs

Twelve paragraphs in a row all look the same. Give every finding a frame, a severity
chip and labelled fields, so the eye can jump between them:

```python
SEV = {                       # severity → (fill, text)
    "KRİTİK": ("#B00020", "#FFFFFF"),
    "YÜKSEK": ("#E65100", "#FFFFFF"),
    "ORTA":   ("#F9A825", "#212121"),
    "DÜŞÜK":  ("#2E7D32", "#FFFFFF"),
}

def finding(fid, title, severity, rows):
    """rows = [("Dosya", "server.js:131"), ("Etki", "..."), ("Düzeltme", "...")]"""
    fill, fg = SEV[severity]
    chip = Table([[Paragraph(f'<font color="{fg}"><b>{severity}</b></font>', S_CHIP)]],
                 colWidths=[22*mm], style=TableStyle([
                     ("BACKGROUND", (0,0), (-1,-1), colors.HexColor(fill)),
                     ("VALIGN",     (0,0), (-1,-1), "MIDDLE"),
                     ("TOPPADDING", (0,0), (-1,-1), 2), ("BOTTOMPADDING", (0,0), (-1,-1), 2),
                 ]))
    head = Table([[chip, Paragraph(f"<b>{escape(fid)}</b> — {md_inline(title)}", S_H2)]],
                 colWidths=[24*mm, None], style=TableStyle([
                     ("VALIGN", (0,0), (-1,-1), "TOP"), ("LEFTPADDING", (0,0), (-1,-1), 0),
                 ]))
    body = Table(
        [[Paragraph(f"<b>{escape(k)}</b>", S_LABEL), Paragraph(md_inline(v), S_BODY)]
         for k, v in rows],
        colWidths=[26*mm, None],
        style=TableStyle([
            ("VALIGN",        (0,0), (-1,-1), "TOP"),
            ("LEFTPADDING",   (0,0), (-1,-1), 0),
            ("BOTTOMPADDING", (0,0), (-1,-1), 4),
        ]))
    # KeepTogether so a finding never splits its header from its body across a page.
    return KeepTogether([head, Spacer(1, 2*mm), body, Spacer(1, 5*mm),
                         HRFlowable(width="100%", thickness=0.4,
                                    color=colors.HexColor("#E0E0E0")),
                         Spacer(1, 5*mm)])
```

`S_LABEL` is the field name: same size as body, bold, grey (`#616161`). That one
contrast — bold grey label against black text — is what turns a wall into a scan.

### Paths, identifiers and code are monospace

`server.js:131`, `routes-tickets.js:87-102`, `crypto.randomBytes(16)` are the things a
reader hunts for. In body type they disappear. Register a mono face next to your
Turkish-capable family and use it inline:

`RMono` is already registered by `register_fonts()` in RULE ZERO — that is deliberate,
because `md_inline()` emits it. Use it directly:

```python
P(f"Dosya: `{path}:{line}`", S_META)      # md_inline turns the span into RMono
```

### More than ~10 findings → table of contents

A 32-finding report needs a way in. A simple counts-by-severity table on the cover
(the audit did this well) plus a one-line-per-finding index:

```python
toc = [[Paragraph("<b>ID</b>", S_TH), Paragraph("<b>Seviye</b>", S_TH),
        Paragraph("<b>Başlık</b>", S_TH)]]
toc += [[Paragraph(f.id, S_BODY), Paragraph(f.sev, S_BODY), Paragraph(f.title, S_BODY)]
        for f in findings]
```

### Section rhythm

One `PageBreak()` per severity band, not per finding — a page with two findings on it
reads as deliberate; a page per finding reads as padding. Inside a band, findings are
separated by the hairline rule in `finding()`, never by blank paragraphs.

## Assembly order (every report)

```
story = [
  Paragraph(title, S_TITLE), Paragraph(period_line, S_SUB),
  kpi_strip([...]), Spacer(1, 8*mm),
  Image(hero_chart), Spacer(1, 6*mm),
  Paragraph("Bölüm başlığı", S_H1), styled_table(...),
  PageBreak(),  # per major section / currency family
  ...
  Paragraph("Not: ...", S_NOTE),
]
```

## Self-check before shipping

1. "ğüşıöçİĞÜŞÇÖ ₺" renders on page 1 — zero boxes (pdftotext it to be sure)
2. Header band + page numbers on every page; margins ≥14mm; nothing clipped
3. Tables: header repeats across pages, zebra bands, money right-aligned with units
4. Charts ≥150 dpi, no default matplotlib look (spines off, left titles), one currency per axis
5. Each currency family = its own section/page; no cross-currency totals anywhere
6. File opens in a phone PDF viewer legibly (9pt+ body, 6.6in-wide charts)
7. Run the verifier below and get a clean exit. The old line-anchored grep was
   not enough: the leak that shipped on 2026-08-23 was **inline** (`` `panel/index.html:256` ``
   and a stray `**` in the middle of a line), and an anchored pattern walks right past it.

```bash
python3 - "$PDF" <<'EOF'
import re, subprocess, sys
txt = subprocess.run(["pdftotext", "-layout", sys.argv[1], "-"],
                     capture_output=True, text=True, check=True).stdout
bad = []
for pat, why in [(r"`", "backtick — code span never converted"),
                 (r"\*\*", "bold marker"),
                 (r"^\s*#{1,6}\s", "markdown heading"),
                 (r"^\s*\|", "markdown table row"),
                 (r"\[object Object\]|undefined|NaN", "template leak")]:
    for m in re.finditer(pat, txt, re.M):
        line = txt[:m.start()].count("\n") + 1
        bad.append(f"  line {line}: {why} — {txt.splitlines()[line-1][:70]!r}")
# .notdef boxes extract as NOTHING, so count what the page shows vs what it says:
print("\n".join(bad[:20]) or "clean")
sys.exit(1 if bad else 0)
EOF
```
   Boxes cannot be caught this way — `pdftotext` drops `.notdef` silently. They are
   caught earlier, by `glyph_check`, which is why every string goes through `P()`.
   Belt and braces: `pdftoppm -r 60 -png -f 1 -l 2 report.pdf /tmp/pg` and LOOK at
   the pages.
8. Findings reports: every item has a severity chip + labelled fields, and no two
   consecutive items are separated only by whitespace
9. Paths and identifiers (`server.js:131`) render in the mono face, not body type


