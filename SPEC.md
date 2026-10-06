# Canlı Yayın Sitesi — SPEC

## Goal
TV tarayıcılarında akıcı çalışan, koyu temalı bir canlı spor yayın sitesi: yayın listesi provider'dan (SportsbookStreams / player-us) çekilir, HLS ile oynatılır, özel reklam sistemi env ile yapılandırılır. Giriş yok.

## Data Source (keşfedildi)
- List: `STREAM_API_URL` (default `https://api-prime.player-us.xyz/stream-list-v2/`) → `{ sports: { <sport>: { events: { id: { stream_id, league, competitiors: {home, away}, sport } } } } }`
- Playback: `https://gsplayer.xyz/stream-token/<stream_id>?auth_token=<TOKEN>&cid=<CID>` → HTML içinde `<source src="https://<h>.n4154.xyz/<id>.m3u8?auth_token=..&cid=..">`
- m3u8 host CORS: `access-control-allow-origin: *`
- TOKEN = operatör lisans kimliği → SADECE server-side (env `STREAM_AUTH_TOKEN`), asla client'a gönderilmez; backend playlist/segment proxy'ler.

## Scope
In: ana sayfa (liste + kategori nav + arama), oynatıcı sayfası (HLS, hls.js, TV dostu büyük kontroller), pre-roll/overlay reklam sistemi (env ile), server-side cache (TTL 300s), loading/error state'leri, yayın otomatik yenileme.
Out: kullanıcı hesabı, DRM, VOD, mobil uygulama.

## Env Vars
- `PORT` (default 3000)
- `STREAM_API_URL` (default https://api-prime.player-us.xyz/stream-list-v2/)
- `STREAM_TOKEN_URL` (default https://gsplayer.xyz/stream-token/)
- `STREAM_AUTH_TOKEN` ({{secret:STREAM_AUTH_TOKEN}} — operatör token'ı)
- `STREAM_CID` (default gs6487)
- `STREAM_CACHE_TTL` (default 300)
- `AD_MODE` (off | preroll | overlay, default off)
- `AD_VIDEO_URL`, `AD_IMAGE_URL`, `AD_LINK`, `AD_DURATION` (s, default 10)

## Endpoints (backend, Express)
- `GET /api/streams` — cache'li liste (TTL), `?sport=` filtre, `?q=` arama
- `GET /api/stream/:id/playlist` — token'lı m3u8 proxy (URI'ler `/api/stream/:id/media?u=` olarak yeniden yazılır)
- `GET /api/stream/:id/media?u=` — segment/key proxy (token query'yi server-side ekler)
- `GET /api/config` — ad/ayar bilgisi (secrets YOK)
- Statik `client/dist` serve + SPA fallback

## Frontend (React + Vite, SPA)
- `/` — header (logo + arama), spor kategorileri chip nav, yayın kartları grid (league, home vs away, LIVE rozeti), 60s otomatik yenileme, skeleton loading
- `/watch/:id` — HLS oynatıcı (hls.js → native fallback), büyük butonlar, pre-roll reklam overlay (geri sayım + atla), hata durumu, geri dön
- Koyu tema (selcukspor tarzı), TV: büyük focus hedefleri, minimal CPU (buffer limitleri, animasyon yok)

## Tech Choices
Express (Node 24, native fetch), Vite + React 18, hls.js, react-router. Tek process, statik serve. Cache: in-memory Map (TTL).

## Acceptance Criteria
1. `/api/streams` cache'li çalışır, TTL env ile değişir, upstream hatasında son iyi cache döner (stale-if-error).
2. Playlist proxy m3u8 döner; segment proxy çalışır; token client'a sızmaz.
3. Ana sayfa: kategori filtre + arama + yenileme; TV görünümünde (mobile viewport testi) taşma yok.
4. Oynatıcı: hls.js başlar, hata state'i görünür, pre-roll ad çalışır (AD_MODE=preroll ile), geri butonu çalışır.
5. Deploy sonrası live URL READ-ONLY doğrulama (curl) geçer.

## Status Log
- 2026-09-26: Keşif tamam (list şeması + stream-token→n4154.xyz m3u8 akışı + CORS *). SPEC yazıldı. Build başladı.
- 2026-09-26: İlk deploy → https://multisportshd.com (deploy 70c6ad4f). Doğrulama: / 200, /api/streams 200 (214 yayın), /api/config 200. Oynatıcı için STREAM_AUTH_TOKEN gerekli (operatör token'ı env'e girilmeli, yoksa /api/stream/:id/playlist 404 döner).
- 2026-09-26: Kullanıcı sorusu: "prime.player-us.xyz/stream/{id} şeklinde mi açmak lazım?" → cevap: prime.player-us.xyz redirect ediyor ama auth_token olmadan asla m3u8 dönmüyor. Token olmadan hiçbir yöntem açılmıyor (lisans kısıtı). Backend artık token kontrolü yapıyor: token yoksa 503 token_missing (deploy 3b058b47). / 200, /api/streams 200 (226), /api/stream/40897317/playlist → 503 token_missing. Oynatıcı doğru davranıyor — yayın açılmıyor çünkü STREAM_AUTH_TOKEN env'de yok (operatör lisans tokenı).
