---
name: docx-report-design
description: Read before producing any .docx deliverable with python-docx — skeleton, fields, tables, charts, brand rules.
---
# Word Report Design (python-docx)

Polished .docx deliverables in the same design language as the xlsx/pdf skills: accent `#1F4E78`, light fill `#F2F7FB`, Calibri. python-docx lacks APIs for field codes, cell shading and repeating table headers — the three XML helpers below fill that gap; copy them verbatim.

## Hard rules

1. **Language.** Documents delivered to EXTERNAL parties (clients, integrators) are written in ENGLISH unless explicitly told otherwise. Internal reports follow the operator's language (Turkish on this platform).
2. **Fonts.** Calibri (fallback Arial) only. Turkish text is safe in docx (real Unicode), but the font must EXIST on the reader's machine — anything exotic falls back to Times. `Normal` = Calibri 10.5pt, plus the `w:eastAsia` fallback.
3. **Headings.** Only built-in `Heading 1`/`Heading 2` — manual bold paragraphs are invisible to the TOC and navigation pane. Recolor both to `#1F4E78` once, before writing content.
4. **Skeleton.** Every doc of 2+ pages gets: cover page (26pt bold accent title, subtitle, date; no header/footer via `different_first_page_header_footer`), header with the document title, footer with `Page X of Y` fields.
5. **TOC.** Insert the real TOC field (populates only after F9 / open-in-Word) AND a static text TOC when the doc is final — otherwise a reader who never refreshes fields sees it empty.
6. **Tables.** Base `Light Grid Accent 1`; header row bold white on `#1F4E78` + `tblHeader`; band even rows `#F2F7FB`; right-align numbers; widths explicit (autofit lies): `autofit = False` AND per cell in EVERY row.
7. **Wide data.** Over 7 columns in portrait → landscape section, or summarize (top-N + totals) and attach the source .xlsx. Never paste a 15-column sheet verbatim.
8. **Charts.** matplotlib PNG at 150 dpi, `add_picture(width=Inches(6.3))`, centered, 9pt gray italic caption. Native tables and rendered charts only — never screenshots.

Setup: `pip install "python-docx>=1.1" matplotlib` (a fresh venv needs `apt-get install -y python3.12-venv` first).

## Example 1 — helpers, skeleton, cover, header/footer, TOC (`report.py`, part 1)

```python
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.section import WD_SECTION, WD_ORIENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import qn, nsdecls

ACCENT, LIGHT = "1F4E78", "F2F7FB"

def add_field(paragraph, code):          # PAGE, NUMPAGES, TOC — python-docx has no API
    run = paragraph.add_run()
    beg = OxmlElement('w:fldChar'); beg.set(qn('w:fldCharType'), 'begin')
    ins = OxmlElement('w:instrText'); ins.set(qn('xml:space'), 'preserve'); ins.text = code
    end = OxmlElement('w:fldChar'); end.set(qn('w:fldCharType'), 'end')
    for el in (beg, ins, end): run._r.append(el)

def shade(cell, fill):                   # cell background — use verbatim
    cell._tc.get_or_add_tcPr().append(parse_xml(
        r'<w:shd {} w:val="clear" w:fill="{}"/>'.format(nsdecls('w'), fill)))

def repeat_header(row):                  # header row repeats on every page
    el = OxmlElement('w:tblHeader'); el.set(qn('w:val'), 'true')
    row._tr.get_or_add_trPr().append(el)

doc = Document()
normal = doc.styles['Normal']
normal.font.name, normal.font.size = 'Calibri', Pt(10.5)
normal.element.get_or_add_rPr().get_or_add_rFonts().set(qn('w:eastAsia'), 'Calibri')
for name in ('Heading 1', 'Heading 2'):  # recolor once; TOC still picks them up
    st = doc.styles[name]
    st.font.name, st.font.color.rgb = 'Calibri', RGBColor(0x1F, 0x4E, 0x78)

sec = doc.sections[0]
sec.top_margin = sec.bottom_margin = Inches(0.8)
sec.left_margin = sec.right_margin = Inches(0.9)
sec.different_first_page_header_footer = True        # cover page: no header/footer

hdr = sec.header.paragraphs[0]
hdr.text, hdr.alignment = "Tekno Platform — Monthly Operations Report", WD_ALIGN_PARAGRAPH.RIGHT
ftr = sec.footer.paragraphs[0]
ftr.alignment = WD_ALIGN_PARAGRAPH.CENTER
ftr.add_run("Page "); add_field(ftr, "PAGE"); ftr.add_run(" of "); add_field(ftr, "NUMPAGES")

title = doc.add_paragraph(); title.alignment = WD_ALIGN_PARAGRAPH.CENTER
title.paragraph_format.space_before = Pt(220)
r = title.add_run("Monthly Operations Report"); r.bold = True
r.font.size, r.font.color.rgb = Pt(26), RGBColor(0x1F, 0x4E, 0x78)
sub = doc.add_paragraph(); sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = sub.add_run("tekno-monitor fleet — July 2026\nPrepared 2026-08-20")
r.font.size, r.font.color.rgb = Pt(12), RGBColor(0x59, 0x59, 0x59)
doc.add_page_break()

doc.add_heading("Contents", level=1)
add_field(doc.add_paragraph(), r'TOC \o "1-2" \h \z \u')  # empty until F9 in Word
doc.add_paragraph("1  Executive Summary — 3")             # static TOC for final delivery
doc.add_paragraph("2  Fleet Metrics — 3")
doc.add_page_break()
```

## Example 2 — KPI strip, table, chart, landscape (same file, part 2)

```python
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

doc.add_heading("Executive Summary", level=1)
kpis = [("99.97%", "Uptime"), ("41", "Servers"), ("128", "Alerts"), ("3.1 TB", "Backups")]
strip = doc.add_table(rows=2, cols=4)    # no style assigned = borderless (Normal Table)
for i, (num, label) in enumerate(kpis):
    shade(strip.cell(0, i), LIGHT); shade(strip.cell(1, i), LIGHT)
    p = strip.cell(0, i).paragraphs[0]; p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(num); r.bold = True
    r.font.size, r.font.color.rgb = Pt(20), RGBColor(0x1F, 0x4E, 0x78)
    p = strip.cell(1, i).paragraphs[0]; p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(label); r.font.size, r.font.color.rgb = Pt(8), RGBColor(0x59, 0x59, 0x59)
    for row in strip.rows: row.cells[i].width = Inches(1.55)

doc.add_heading("Fleet Metrics", level=1)
data = [("web-01", "1 240 512", "99.99%"), ("db-01", "980 003", "99.95%"),
        ("mq-01", "402 118", "99.98%")]
t = doc.add_table(rows=1 + len(data), cols=3)
t.style, t.autofit = doc.styles['Light Grid Accent 1'], False
for i, htxt in enumerate(("Server", "Requests", "Uptime")):
    cell = t.rows[0].cells[i]; shade(cell, ACCENT)
    r = cell.paragraphs[0].add_run(htxt)
    r.bold, r.font.color.rgb = True, RGBColor(0xFF, 0xFF, 0xFF)
repeat_header(t.rows[0])
for ri, rowvals in enumerate(data, start=1):
    for ci, val in enumerate(rowvals):
        cell = t.rows[ri].cells[ci]; cell.text = val
        if ci > 0: cell.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.RIGHT
    if ri % 2 == 0:
        for c in t.rows[ri].cells: shade(c, LIGHT)
for row in t.rows:                        # widths only stick per cell, in EVERY row
    for w, cell in zip((Inches(2.0), Inches(2.6), Inches(1.7)), row.cells):
        cell.width = w

fig, ax = plt.subplots(figsize=(6.3, 3.0))
ax.bar(["May", "Jun", "Jul"], [2.4, 2.9, 3.1], color="#1F4E78")
ax.set_ylabel("Backups (TB)"); fig.tight_layout()
fig.savefig("backups.png", dpi=150); plt.close(fig)
doc.add_picture("backups.png", width=Inches(6.3))
doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
cap = doc.add_paragraph(); cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = cap.add_run("Figure 1 — Monthly backup volume")
r.italic, r.font.size, r.font.color.rgb = True, Pt(9), RGBColor(0x80, 0x80, 0x80)

land = doc.add_section(WD_SECTION.NEW_PAGE)   # wide tables live here
land.orientation = WD_ORIENT.LANDSCAPE
land.page_width, land.page_height = land.page_height, land.page_width
doc.add_heading("Appendix A — Wide Data", level=1)
doc.save("report.docx")
```

An internal Turkish variant only changes the strings: `"Aylık Operasyon Raporu"`, `"Sayfa "`/`" / "`, `"Şekil 1 — Aylık yedek hacmi"` — the code and fonts stay identical.

## Self-check

- [ ] Audience checked first: external → English body; internal → operator's language.
- [ ] `Normal` = Calibri 10.5pt with `w:eastAsia` set; Heading 1/2 recolored `#1F4E78`.
- [ ] Cover page clean (no header/footer); `Page X of Y` starts on page 2; header carries the doc title.
- [ ] TOC field present, plus static TOC lines on final delivery.
- [ ] Every table: `autofit = False`, widths on all rows, `tblHeader` on row 0, white-on-accent header, banded rows, numbers right-aligned.
- [ ] Charts: 150 dpi PNG, `Inches(6.3)` wide, centered, 9pt gray italic caption.
- [ ] Nothing wider than 7 columns in portrait; wide data in a landscape section or an .xlsx annex.
- [ ] File round-trips: `python -c "from docx import Document; Document('report.docx')"` exits 0.

## Anti-patterns

- Default blue Calibri Light headings shipped straight to a client — the "raw Word" look. Recolor Heading 1/2 first.
- Tables left on autofit: wrapped two-line headers, ragged columns.
- Pasting a wide xlsx table verbatim at 8pt — summarize top-N + totals; attach the .xlsx as annex.
- Skipping footer/page numbers on a 10-page report — unreferenceable in review calls and print.
- Screenshots of tables or Excel charts pasted as images: blurry in print, not searchable. Rebuild as native tables / matplotlib PNGs.
- Trusting the TOC field alone — it renders empty in every viewer that never refreshes fields (most of them).
- Roboto/Inter/branded TTFs — absent on the reader's machine, silently substituted with Times.
- Turkish body text sent to an external client because the chat is in Turkish — the deliverable language follows the AUDIENCE, not the conversation.
