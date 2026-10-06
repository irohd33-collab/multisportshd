---
name: xlsx-report-design
description: Build STUNNING dashboard-grade Excel reports with openpyxl - KPI cards with deltas, in-cell sparklines, heatmaps, linked TOC, styled charts. Read BEFORE any .xlsx script.
---

# Dashboard-grade Excel reports (openpyxl)

You are not producing a data dump — you are producing the report a CFO forwards
to the board. Every workbook you generate must survive the "screenshot test":
any sheet, screenshotted, should look designed. This file gives you the exact
mechanics. Output-facing strings stay in the user's language.

## Workbook skeleton (always this order)

```
1. "Özet"        the dashboard: banner + KPI cards + hero chart + highlights
2. "İçindekiler" clickable TOC (skip if ≤4 sheets — fold it into the banner)
3. detail sheets one per dimension (currency/brand/user…), each self-titled
4. "Grafikler"   chart gallery (only if charts don't fit on their sheets)
5. "Ham Veri"    raw rows, machine-styled, ALWAYS last, tab colored gray
```

Tab colors tell the story: `ws.sheet_properties.tabColor = "1F4E78"` for Özet,
accent family for details, `"808080"` for raw. Sheet order IS information.

## The banner (top of every presentation sheet)

A two-row merged band, dark fill, white title — instantly "designed":

```python
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
ACCENT="1F4E78"; ACCENT2="2E75B6"; LIGHT="F2F7FB"; MUTED="808080"
GOOD="2E9E5B"; BAD="C0392B"; WARN="B7791F"

def banner(ws, title, subtitle, ncols=10):
    ws.sheet_view.showGridLines = False
    for r in (1, 2):
        ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=ncols)
        for c in range(1, ncols + 1):
            ws.cell(r, c).fill = PatternFill("solid", fgColor=ACCENT)
    ws.cell(1, 1, title).font = Font(size=17, bold=True, color="FFFFFF")
    ws.cell(2, 1, subtitle).font = Font(size=10, italic=True, color="D6E4F0")
    for r in (1, 2):
        ws.cell(r, 1).alignment = Alignment(horizontal="left", vertical="center", indent=1)
    ws.row_dimensions[1].height = 26; ws.row_dimensions[2].height = 16
```

## KPI cards WITH DELTAS (the dashboard's heart)

Big number + comparison vs yesterday/last period, arrow colored by direction.
If you have any prior-period number available, SHOW the delta — a KPI without
context is half a KPI:

```python
def kpi_card(ws, row, col, label, value_str, delta=None, sub=""):
    """3-wide x 4-tall merged card. delta: signed float ratio (0.12 = +12%) or None."""
    for dr in range(4):
        ws.merge_cells(start_row=row+dr, start_column=col, end_row=row+dr, end_column=col+2)
        for dc in range(3):
            ws.cell(row+dr, col+dc).fill = PatternFill("solid", fgColor=LIGHT)
    ws.cell(row, col, label.upper()).font = Font(size=9, bold=True, color=MUTED)
    ws.cell(row+1, col, value_str).font = Font(size=22, bold=True, color=ACCENT)
    if delta is not None:
        up = delta >= 0
        ws.cell(row+2, col, f"{'▲' if up else '▼'} {abs(delta):.1%}  {'dünkü güne göre' if True else ''}")
        ws.cell(row+2, col).font = Font(size=10, bold=True, color=(GOOD if up else BAD))
    ws.cell(row+3, col, sub).font = Font(size=9, color=MUTED)
    for dr in range(4):
        ws.cell(row+dr, col).alignment = Alignment(horizontal="left", indent=1)
```

Layout: cards at row 4, four across (cols A, E, I, M), then the hero chart at
row 9. Pre-render the value WITH its unit and thousands separators
(`f"{v:,.0f} ₺".replace(",", ".")` for tr-TR) — 22pt + number_format overflows.

## In-cell SPARKLINES (the trick nobody expects)

openpyxl has no native sparklines — fake them with Unicode blocks. A "Trend"
column showing each row's 24h shape turns a table into a dashboard:

```python
BARS = "▁▂▃▄▅▆▇█"
def sparkline(values, width=12):
    if not values or max(values) <= 0: return "—"
    step = max(1, len(values) // width)
    vals = [max(values[i:i+step]) for i in range(0, len(values), step)][:width]
    hi = max(vals)
    return "".join(BARS[min(7, int(v / hi * 7.999))] if v > 0 else " " for v in vals)
# usage: ws.cell(r, 8, sparkline(hourly[player]))  -> "▁▁▃▂▅█▇▃▁ ▂▁"
ws.cell(r, 8).font = Font(name="Consolas", size=10, color=ACCENT2)  # monospace!
```

Same trick as a progress/share bar: `"█" * int(share*10) + "░" * (10-int(share*10))`
next to a percent column. Monospace font is mandatory or the bars wobble.

## Native tables + structured-ref totals

Every data block is a real Excel Table (banded rows + filter buttons for free),
and totals are LIVE FORMULAS so they recalc when the user filters:

```python
from openpyxl.worksheet.table import Table, TableStyleInfo
def as_table(ws, first_row, last_row, ncols, name, style="TableStyleMedium2"):
    ref = f"A{first_row}:{chr(64+ncols)}{last_row}"
    t = Table(displayName=name, ref=ref)
    t.tableStyleInfo = TableStyleInfo(name=style, showRowStripes=True)
    ws.add_table(t)

# total row BELOW the table (not inside): SUBTOTAL(109,...) respects filters
ws.cell(last_row+1, 1, "TOPLAM").font = Font(bold=True)
ws.cell(last_row+1, 3, f"=SUBTOTAL(109,{name}[Toplam])").number_format = '#,##0 "₺"'
```

Iron rules: unique non-empty headers; NO merged cells inside the range; one
blank row between blocks; per-cell borders and zebra fills are DELETED once a
range is a table. Unique `displayName` per workbook (`Tbl_TRY`, `Tbl_IRR`, …).

## Heatmaps (hour x day, hour x brand)

A 24-column grid + a 3-color scale reads instantly and looks expensive:

```python
from openpyxl.formatting.rule import ColorScaleRule
rng = f"B{r0}:Y{r1}"   # 24 hour columns, one row per brand/day
ws.conditional_formatting.add(rng, ColorScaleRule(
    start_type="min", start_color="FFFFFF",
    mid_type="percentile", mid_value=60, mid_color="9DC3E6",
    end_type="max", end_color="1F4E78"))
for col in range(2, 26):  # squeeze into squares
    ws.column_dimensions[get_column_letter(col)].width = 4.5
ws.cell(r0-1, 2, "00").font = Font(size=8, color=MUTED)  # tiny hour labels
```

Numbers inside heatmap cells: `number_format='#,##0,'` (thousands-scaled) with
8pt font, or blank them entirely (`show only color`) for a pure heat look.

## Emphasis system (never yellow rows)

- Amount columns → **data bars**: `DataBarRule(start_type="min", end_type="max",
  color=ACCENT2, showValue=True)`. Ranking becomes visible without reading.
- Deltas/percent columns → **icon sets**: `IconSetRule("3Arrows", "percent",
  [0, 33, 67])`, or dye the text via two `CellIsRule`s (`>0` → GOOD bold,
  `<0` → BAD bold).
- Top-3 rows: bold font + a 14pt "①②③" or "🥇🥈🥉" prefix in the name cell.
  Whole-row fills are banned; they die the moment the user sorts.
- Thresholds the business cares about (e.g. deposit ≥ 100k) → left border
  accent: `Border(left=Side(style="thick", color=WARN))` on the name cell only.

## Charts that look intentional

```python
from openpyxl.chart import BarChart, LineChart, PieChart, Reference, Series
from openpyxl.chart.label import DataLabelList
from openpyxl.drawing.fill import PatternFillProperties  # rarely; solid is king

def styled_bar(ws, title, data, cats, y_fmt='#,##0'):
    ch = BarChart(); ch.type="col"; ch.style=10
    ch.title = title; ch.legend = None; ch.gapWidth = 60
    ch.y_axis.numFmt = y_fmt; ch.y_axis.majorGridlines = None   # ← kills the cage
    ch.x_axis.delete = False
    ch.add_data(data, titles_from_data=False); ch.set_categories(cats)
    ch.dLbls = DataLabelList(); ch.dLbls.showVal = True          # labels ON bars
    ch.dLbls.numFmt = '#,##0,'; ch.dLbls.dLblPos = "outEnd"
    ch.width, ch.height = 16, 9
    return ch
```

- **Combo** (bars = amount, line = count) for "volume + activity" stories:
  build a BarChart and a LineChart on the same anchor data, `bar += line`,
  give the line `line.y_axis.axId = 200` (secondary axis).
- **Doughnut/Pie** ONLY for ≤6 shares, with `dLbls.showPercent = True` and no legend.
- Kill default gray: `ch.y_axis.majorGridlines = None`, no chart border
  (`ch.graphical_properties` left default is fine), style 10-12.
- Anchors: dedicated right-hand band (`"K4"`, `"K22"`, …) or the Grafikler
  sheet on a 16-row grid. Charts NEVER overlap table cells.
- Chart feeder data: far-right columns (AA+) or a hidden sheet
  (`wb["_data"].sheet_state = "hidden"`) — the reader never sees scaffolding.

## Clickable navigation

TOC sheet + back-links make a 10-sheet workbook feel like an app:

```python
toc.cell(r, 1, s.title).hyperlink = f"#'{s.title}'!A1"
toc.cell(r, 1).font = Font(color=ACCENT2, underline="single", size=11)
# every detail sheet, top-right:
ws.cell(1, ncols, "◀ Özet").hyperlink = "#'Özet'!A1"
ws.cell(1, ncols).font = Font(color="D6E4F0", size=9, underline="single")
```

## Numbers, dates, widths (non-negotiable)

- Currency via number_format, never string concat: `'#,##0 "₺"'`, `'#,##0.00 "USD"'`.
  Compact large numbers on dashboards: `'#,##0,, "M₺"'` (millions).
- Mixed currencies NEVER share a column, a total, or a chart. Separate blocks.
- Percent: store fraction, format `'0.0%'`. Dates: store datetime, format
  `'dd.mm.yyyy hh:mm'` — pre-rendered strings kill sorting.
- Right-align numbers, left-align text, center headers only.
- Autosize with cap: width = min(longest+3, 42); Trend/spark columns fixed 14.
- `freeze_panes` under every long table's header; `print_title_rows="3:3"`,
  landscape, `fitToWidth=1` on every presentation sheet.

## Self-check before save (run mentally, fix, THEN save)

1. Screenshot test: would Özet look designed pasted into a slide? (banner, cards
   with deltas, hero chart, zero raw floats visible)
2. Every data range a named Table; no cage borders; no yellow rows anywhere
3. Sparklines/data bars present wherever a series hides in the rows
4. Charts: no legend for single series, no gridline cage, labels where they help
5. TOC links work; tabs colored; raw sheet last and gray
6. Mixed currencies fully quarantined; totals are SUBTOTAL formulas
7. Nothing overflows: no `####`, no clipped 22pt values, no chart on top of cells

## Anti-patterns (seen in real output — never again)

- Cage of thin borders over everything ⇒ use Tables
- Whole-row yellow "top 10" fills ⇒ data bars + bold + ①②③
- "1234567 TL" as text ⇒ number_format with unit
- Default-width columns, truncated headers, style-1 charts with "Series 1" legends
- One chart mixing TRY+USD+IRR ⇒ one chart per currency family, always
- Dashboard math in Python only ⇒ totals as SUBTOTAL so filtering stays honest

## Reference implementation (adapt, don't reinvent)

A complete miniature of the whole system — banner, KPI cards with deltas, a
sparkline table, an hour heatmap, a styled chart. Start every report from this
shape and swap in real data:

```python
#!/usr/bin/env python3
from collections import defaultdict
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter
from openpyxl.chart import BarChart, Reference
from openpyxl.chart.label import DataLabelList
from openpyxl.worksheet.table import Table, TableStyleInfo
from openpyxl.formatting.rule import ColorScaleRule, DataBarRule

ACCENT="1F4E78"; ACCENT2="2E75B6"; LIGHT="F2F7FB"; MUTED="808080"; GOOD="2E9E5B"; BAD="C0392B"
BARS="▁▂▃▄▅▆▇█"
def tl(v): return f"{v:,.0f} ₺".replace(",", ".")
def spark(vals, w=12):
    if not vals or max(vals)<=0: return "—"
    step=max(1,len(vals)//w); vs=[max(vals[i:i+step]) for i in range(0,len(vals),step)][:w]
    hi=max(vs); return "".join(BARS[min(7,int(v/hi*7.999))] if v>0 else " " for v in vs)

# ---- veri (örnek): rows = [{user, amount, hour}] --------------------------
rows=[{"user":u,"amount":a,"hour":h} for u,a,h in [
    ("mehmet42",180000,21),("ayse_k",95000,22),("kartal35",76000,20),("deniz01",41000,13),
    ("mehmet42",60000,23),("ayse_k",30000,9),("rio_77",22000,2),("kartal35",15000,21)]]
per_user=defaultdict(lambda:{"amt":0,"n":0,"hours":[0]*24})
for r in rows:
    p=per_user[r["user"]]; p["amt"]+=r["amount"]; p["n"]+=1; p["hours"][r["hour"]]+=r["amount"]
total=sum(r["amount"] for r in rows); yesterday=430000   # önceki gün: delta için

wb=Workbook(); oz=wb.active; oz.title="Özet"; oz.sheet_properties.tabColor=ACCENT

# banner
oz.sheet_view.showGridLines=False
for r in (1,2):
    oz.merge_cells(start_row=r,start_column=1,end_row=r,end_column=14)
    for c in range(1,15): oz.cell(r,c).fill=PatternFill("solid",fgColor=ACCENT)
oz.cell(1,1,"Günlük Yatırım Raporu").font=Font(size=17,bold=True,color="FFFFFF")
oz.cell(2,1,"20 Ağustos 2026 · UTC · para birimleri ayrı raporlanır").font=Font(size=10,italic=True,color="D6E4F0")
oz.cell(1,1).alignment=oz.cell(2,1).alignment=Alignment(horizontal="left",vertical="center",indent=1)
oz.row_dimensions[1].height=26; oz.row_dimensions[2].height=16

# KPI kartları (delta dahil)
def card(row,col,label,value,delta=None,sub=""):
    for dr in range(4):
        oz.merge_cells(start_row=row+dr,start_column=col,end_row=row+dr,end_column=col+2)
        for dc in range(3): oz.cell(row+dr,col+dc).fill=PatternFill("solid",fgColor=LIGHT)
    oz.cell(row,col,label.upper()).font=Font(size=9,bold=True,color=MUTED)
    oz.cell(row+1,col,value).font=Font(size=22,bold=True,color=ACCENT)
    if delta is not None:
        up=delta>=0
        oz.cell(row+2,col,f"{'▲' if up else '▼'} {abs(delta):.1%} düne göre").font=Font(size=10,bold=True,color=GOOD if up else BAD)
    oz.cell(row+3,col,sub).font=Font(size=9,color=MUTED)
    for dr in range(4): oz.cell(row+dr,col).alignment=Alignment(horizontal="left",indent=1)
card(4,1,"Toplam Yatırım",tl(total),(total-yesterday)/yesterday,"onaylı depositler")
card(4,5,"İşlem",str(len(rows)),None,"onaylı adet")
card(4,9,"Oyuncu",str(len(per_user)),None,"benzersiz")
card(4,13,"Ortalama",tl(total/len(rows)),None,"işlem başına")

# kullanıcı tablosu: sıra + spark + data bar
hdr=9
for i,h in enumerate(["#","Kullanıcı","Toplam","İşlem","Ortalama","Trend (24s)"],1): oz.cell(hdr,i,h)
rr=hdr+1
ranked=sorted(per_user.items(),key=lambda kv:kv[1]["amt"],reverse=True)
for i,(u,d) in enumerate(ranked,1):
    pre="①②③"[i-1] if i<=3 else str(i)
    oz.cell(rr,1,pre); oz.cell(rr,2,u)
    oz.cell(rr,3,d["amt"]).number_format='#,##0 "₺"'
    oz.cell(rr,4,d["n"]); oz.cell(rr,5,d["amt"]/d["n"]).number_format='#,##0 "₺"'
    oz.cell(rr,6,spark(d["hours"])).font=Font(name="Consolas",size=10,color=ACCENT2)
    if i<=3: oz.cell(rr,2).font=Font(bold=True)
    rr+=1
t=Table(displayName="Tbl_Kullanici",ref=f"A{hdr}:F{rr-1}")
t.tableStyleInfo=TableStyleInfo(name="TableStyleMedium2",showRowStripes=True); oz.add_table(t)
oz.cell(rr,2,"TOPLAM").font=Font(bold=True)
oz.cell(rr,3,"=SUBTOTAL(109,Tbl_Kullanici[Toplam])").number_format='#,##0 "₺"'
oz.conditional_formatting.add(f"C{hdr+1}:C{rr-1}",
    DataBarRule(start_type="min",end_type="max",color=ACCENT2,showValue=True))
for col,w in zip("ABCDEF",[5,18,16,9,14,16]): oz.column_dimensions[col].width=w
oz.freeze_panes=f"A{hdr+1}"

# saat ısı haritası (tek satır örnek; gerçekte marka/birim başına satır)
hm=rr+2; oz.cell(hm,1,"SAAT DAĞILIMI").font=Font(bold=True,size=11,color=ACCENT2)
hourly=[0.0]*24
for r in rows: hourly[r["hour"]]+=r["amount"]
for h24 in range(24):
    c=oz.cell(hm+2,2+h24,hourly[h24] or None); c.number_format='#,##0,'; c.font=Font(size=8)
    oz.cell(hm+1,2+h24,f"{h24:02d}").font=Font(size=8,color=MUTED)
    oz.column_dimensions[get_column_letter(2+h24)].width=4.5
oz.conditional_formatting.add(f"B{hm+2}:Y{hm+2}",ColorScaleRule(
    start_type="min",start_color="FFFFFF",mid_type="percentile",mid_value=60,
    mid_color="9DC3E6",end_type="max",end_color=ACCENT))

# grafik verisi sağ kuytuda + veri etiketli bar
base=hdr
for i,(u,d) in enumerate(ranked[:5]):
    oz.cell(base+i,28,u); oz.cell(base+i,29,d["amt"])
ch=BarChart(); ch.type="col"; ch.style=10; ch.title="Top 5 Yatırımcı"
ch.legend=None; ch.gapWidth=60; ch.y_axis.majorGridlines=None; ch.y_axis.numFmt='#,##0'
ch.add_data(Reference(oz,min_col=29,min_row=base,max_row=base+4),titles_from_data=False)
ch.set_categories(Reference(oz,min_col=28,min_row=base,max_row=base+4))
ch.dLbls=DataLabelList(); ch.dLbls.showVal=True; ch.dLbls.numFmt='#,##0,'
ch.width,ch.height=15,8.5; oz.add_chart(ch,"H9")
for cc in range(28,30): oz.column_dimensions[get_column_letter(cc)].hidden=True

wb.save("/workspace/rapor-ornek.xlsx"); print("OK")
```

Everything above scales: more users → same table; more currencies → clone the
sheet per family; more days → heatmap rows. The SHAPE never changes.
