---
name: html-email-design
description: Read before generating any HTML email (transactional or report) — layout, dark mode, multipart, Outlook rules.
---
# HTML Email Design

Email HTML is 1999-era HTML: Outlook on Windows renders with the Word engine, Gmail strips `<style>` in many contexts and clips messages over ~102KB. Everything below is non-negotiable. Generate the HTML **and** the plain-text alternative every single time — the platform sends both as `multipart/alternative`.

## Hard rules

1. **600px max-width, single column.** Layout with nested `<table role="presentation" border="0" cellpadding="0" cellspacing="0">` only. No `<div>` layout, no flexbox, no grid, no float, no `position`.
2. **All CSS inline** in `style=""` attributes. No `<style>` block, no `<link>`, no `@import`, no `@font-face`, no `<script>`. Font stack: `Arial,Helvetica,sans-serif`.
3. **Outlook spacing:** `margin` on `div`/`p` is unreliable — create all spacing with `padding` on `<td>`. Every `line-height` needs `mso-line-height-rule:exactly;` before it in the same style attribute.
4. **Images:** explicit `width` and `height` HTML attributes (display size, not file size), meaningful `alt`, `style="display:block;border:0;"`. Total email weight (HTML + text part) **< 100KB** — Gmail clips at ~102KB and hides your footer/unsubscribe.
5. **Backgrounds on `<td>`**, never only on `<body>` (Gmail replaces body). Set both `bgcolor="#..."` attribute and `background-color` style on the same td.
6. **Dark mode:** include `<meta name="color-scheme" content="light dark">` and `<meta name="supported-color-schemes" content="light dark">`. Never use `#000000` text; prefer `#111827` on `#F4F5F7`/`#F9FAFB` surfaces so Gmail's forced inversion keeps contrast. Verify both themes.
7. **Turkish text is raw UTF-8.** `<meta charset="utf-8">` first in head; write `ğüşıöçĞÜŞİÖÇ` directly — never entities like `&#287;`. Subject-line RFC 2047 encoding is the platform's job; preheader and body are plain UTF-8.
8. **Preheader:** hidden div right after `<body>`, 80–100 chars, summarizes the email — it shows next to the subject in inbox lists.
9. **CTA button is table/VML "bulletproof"** — the `<!--[if mso]>` VML block in the template below is required verbatim, same URL in both branches.
10. **Data in email:** stat rows as two-cell tables (label left `#6B7280`, value right bold `#111827`), max 5 rows. Anything wider than 3 columns or longer than 5 rows: link to the full report page or attach it. Never a 10-column table at 600px.

## Template — save as `/workspace/mail/rapor.html` (~120 lines, adapt copy/colors)

```html
<!DOCTYPE html>
<html lang="tr" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <title>Ağustos 2026 Raporu</title>
</head>
<body style="margin:0;padding:0;word-spacing:normal;background-color:#F4F5F7;">
  <!-- Preheader: 80-100 chars, raw UTF-8, hidden everywhere -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    Ağustos raporunuz hazır: 12.480 gönderim, %98,2 teslimat — ayrıntılı döküm ve grafikler içeride.
  </div>
  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color:#F4F5F7;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" border="0" cellpadding="0" cellspacing="0"
               style="width:600px;max-width:600px;background-color:#FFFFFF;border-radius:8px;">
          <!-- Header band: brand color -->
          <tr>
            <td bgcolor="#1D4ED8" style="background-color:#1D4ED8;padding:20px 32px;border-radius:8px 8px 0 0;">
              <img src="https://example.com/logo-white-160x40.png" width="160" height="40" alt="TeknoMail"
                   style="display:block;border:0;">
            </td>
          </tr>
          <!-- Body copy -->
          <tr>
            <td style="padding:32px 32px 8px 32px;font-family:Arial,Helvetica,sans-serif;">
              <h1 style="margin:0 0 12px 0;font-size:22px;mso-line-height-rule:exactly;line-height:28px;color:#111827;">
                Merhaba Ayşe,
              </h1>
              <p style="margin:0 0 16px 0;font-size:15px;mso-line-height-rule:exactly;line-height:22px;color:#374151;">
                Ağustos 2026 gönderim raporunuz hazır. Öne çıkan üç metrik aşağıda; grafikli tam döküm için butona tıklayın.
              </p>
            </td>
          </tr>
          <!-- Stat rows: label left gray, value right bold. Max 5 rows. -->
          <tr>
            <td style="padding:8px 32px;">
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #E5E7EB;font-family:Arial,Helvetica,sans-serif;font-size:14px;mso-line-height-rule:exactly;line-height:20px;color:#6B7280;">Toplam gönderim</td>
                  <td align="right" style="padding:10px 0;border-bottom:1px solid #E5E7EB;font-family:Arial,Helvetica,sans-serif;font-size:14px;mso-line-height-rule:exactly;line-height:20px;font-weight:bold;color:#111827;">12.480</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #E5E7EB;font-family:Arial,Helvetica,sans-serif;font-size:14px;mso-line-height-rule:exactly;line-height:20px;color:#6B7280;">Teslimat oranı</td>
                  <td align="right" style="padding:10px 0;border-bottom:1px solid #E5E7EB;font-family:Arial,Helvetica,sans-serif;font-size:14px;mso-line-height-rule:exactly;line-height:20px;font-weight:bold;color:#111827;">%98,2</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;mso-line-height-rule:exactly;line-height:20px;color:#6B7280;">Geri dönen (bounce)</td>
                  <td align="right" style="padding:10px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;mso-line-height-rule:exactly;line-height:20px;font-weight:bold;color:#111827;">37</td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Bulletproof CTA: VML branch for Outlook, anchor for everyone else. Same URL twice. -->
          <tr>
            <td align="center" style="padding:24px 32px 32px 32px;">
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
                href="https://example.com/rapor/2026-08" style="height:44px;v-text-anchor:middle;width:240px;"
                arcsize="14%" fillcolor="#1D4ED8" stroke="f">
                <w:anchorlock/>
                <center style="color:#FFFFFF;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">Raporu Görüntüle</center>
              </v:roundrect>
              <![endif]-->
              <!--[if !mso]><!-->
              <a href="https://example.com/rapor/2026-08"
                 style="display:inline-block;width:240px;background-color:#1D4ED8;color:#FFFFFF;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;mso-line-height-rule:exactly;line-height:44px;text-align:center;text-decoration:none;border-radius:6px;">Raporu Görüntüle</a>
              <!--<![endif]-->
            </td>
          </tr>
          <!-- Footer: physical address + unsubscribe are mandatory -->
          <tr>
            <td bgcolor="#F9FAFB" style="background-color:#F9FAFB;padding:20px 32px;border-top:1px solid #E5E7EB;border-radius:0 0 8px 8px;">
              <p style="margin:0 0 6px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;mso-line-height-rule:exactly;line-height:18px;color:#6B7280;">
                Tekno Yazılım A.Ş. · Örnek Mah. Teknoloji Cad. No:1, 34000 İstanbul
              </p>
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;mso-line-height-rule:exactly;line-height:18px;color:#6B7280;">
                Bu e-postayı rapor aboneliğiniz nedeniyle aldınız.
                <a href="https://example.com/unsubscribe?u=abc123" style="color:#1D4ED8;text-decoration:underline;">Abonelikten çık</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

## Build multipart + send/preview — save as `/workspace/mail/send.py`

```python
#!/usr/bin/env python3
# Builds multipart/alternative (text + html), checks weight, sends via SMTP
# if SMTP_HOST is set, otherwise writes .txt next to the .html for eyeballing.
import os, smtplib, textwrap
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formatdate, make_msgid

HTML = open("/workspace/mail/rapor.html", encoding="utf-8").read()

TEXT_RAW = """TeknoMail — Ağustos 2026 Raporu

Merhaba Ayşe,

Ağustos 2026 gönderim raporunuz hazır. Öne çıkan metrikler:

  Toplam gönderim ....... 12.480
  Teslimat oranı ........ %98,2
  Geri dönen (bounce) ... 37

Tam rapor: https://example.com/rapor/2026-08

--
Tekno Yazılım A.Ş. · Örnek Mah. Teknoloji Cad. No:1, 34000 İstanbul
Abonelikten çık: https://example.com/unsubscribe?u=abc123
"""

def wrap78(s: str) -> str:
    out = []
    for line in s.splitlines():
        out.extend(textwrap.wrap(line, width=78) or [""])
    return "\n".join(out)

msg = MIMEMultipart("alternative")  # text part FIRST, html LAST
msg["Subject"] = "Ağustos raporunuz hazır"   # RFC 2047 encoding handled automatically
msg["From"] = os.environ.get("MAIL_FROM", "rapor@example.com")
msg["To"] = os.environ.get("MAIL_TO", "test@example.com")
msg["Date"] = formatdate(localtime=True)
msg["Message-ID"] = make_msgid()
msg["List-Unsubscribe"] = "<https://example.com/unsubscribe?u=abc123>"
msg.attach(MIMEText(wrap78(TEXT_RAW), "plain", "utf-8"))
msg.attach(MIMEText(HTML, "html", "utf-8"))

size_kb = len(msg.as_bytes()) / 1024
assert size_kb < 100, f"email too heavy: {size_kb:.0f}KB (Gmail clips at ~102KB)"

host = os.environ.get("SMTP_HOST")
if host:
    with smtplib.SMTP(host, int(os.environ.get("SMTP_PORT", "587"))) as s:
        s.starttls()
        s.login(os.environ["SMTP_USER"], os.environ["SMTP_PASS"])
        s.send_message(msg)
    print(f"sent, {size_kb:.0f}KB")
else:
    with open("/workspace/mail/rapor.txt", "w", encoding="utf-8") as f:
        f.write(wrap78(TEXT_RAW))
    print(f"no SMTP_HOST — wrote rapor.txt; open rapor.html in a browser, {size_kb:.0f}KB total")
```

Run: `mkdir -p /workspace/mail && python3 /workspace/mail/send.py`. To send to a real test box, export `SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS MAIL_FROM MAIL_TO` (creds via `{{secret:smtp_test}}` if the platform provides them). When previewing the file, toggle the OS/browser between light and dark and re-check contrast.

## Self-check (before handing the email over)

- [ ] Outer content table is exactly `width="600"` + `max-width:600px`; single column throughout.
- [ ] Every `<table>` has `role="presentation" border="0" cellpadding="0" cellspacing="0"`.
- [ ] `grep -c '<style\|<link\|<script\|@import' rapor.html` returns 0; all CSS is in `style=""`.
- [ ] Every `<img>` has `width`, `height`, `alt`, `display:block`.
- [ ] All spacing comes from td `padding`; every `line-height` is preceded by `mso-line-height-rule:exactly`.
- [ ] CTA has both the VML branch and the `<a>` branch with the identical URL.
- [ ] Preheader is 80–100 chars, hidden, raw Turkish characters (no `&#...;` entities anywhere for ğüşıöç).
- [ ] Backgrounds are on `<td>` (bgcolor + style), no `#000000` anywhere, both themes checked.
- [ ] Plain-text part exists, ≤78 cols, carries the same numbers and the same links.
- [ ] `msg.as_bytes()` < 100KB; footer has physical address + working unsubscribe link.

## Anti-patterns (seen in the wild — do not repeat)

- **Div-based layout** with float/flex/grid: Outlook's Word engine collapses it into a vertical soup.
- **One giant screenshot image as the whole email**: blank message when images are blocked (Outlook default), spam score jumps, zero accessibility.
- **`background-image` for critical content**: stripped by Outlook; use td `bgcolor` and real `<img>` tags.
- **External fonts** (`@import`, Google Fonts `<link>`): blocked by every major client; stick to Arial/Helvetica.
- **900px-wide tables**: horizontal scroll on desktop clients, illegible zoom-out on mobile — 600px, period.
- **Missing text/plain part**: measurable deliverability penalty and nothing to show on watches/screen readers.
- **`margin` on `div`/`p` for spacing**: silently dropped by Outlook; the layout only breaks for the customers you cannot see.
- **HTML entities for Turkish letters** (`&#287;` for ğ): garbles preheader previews and the text part.
- **10-column data tables**: unreadable at 600px — use 2-cell stat rows (max 5) and link to the full report.
- **Skipping the dark-mode pass**: pure white cards + pure black text invert into unreadable gray-on-gray in Gmail dark.
