import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Hls from 'hls.js';

function fmtCountdown(ts) {
  const diffMs = ts - Date.now();
  const mins = Math.round(diffMs / 60000);
  if (mins > 48 * 60) {
    const d = new Date(ts).toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' });
    const t = new Date(ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    return `${d} ${t} · ${Math.round(mins / 1440)} gün sonra`;
  }
  let s = Math.max(0, Math.floor(diffMs / 1000));
  const h = Math.floor(s / 3600); s %= 3600;
  const m = Math.floor(s / 60); s %= 60;
  return h > 0 ? `${h} sa ${String(m).padStart(2, '0')} dk` : m > 0 ? `${m} dk ${String(s).padStart(2, '0')} sn` : `${s} sn`;
}

export default function Watch() {
  const { id } = useParams();
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [status, setStatus] = useState('loading'); // loading | playing | upcoming | error
  const [errorMsg, setErrorMsg] = useState('Yayın açılamadı. Yayın sona ermiş olabilir.');
  const [viewers, setViewers] = useState(0);
  const [match, setMatch] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [attempt, setAttempt] = useState(0);
  const [countdown, setCountdown] = useState('');
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // SEO: maç başlığı + canonical
  useEffect(() => {
    if (!match) return;
    const teams = match.away ? `${match.home} vs ${match.away}` : match.home;
    document.title = `${teams} Canlı İzle | ${match.league} — MultiSportsHD`;
    const desc = `${teams} maçını ${match.league} kapsamında HD kalitede canlı izle. MultiSportsHD kesintisiz canlı maç yayın platformu.`;
    let m = document.querySelector('meta[name="description"]');
    if (!m) { m = document.createElement('meta'); m.name = 'description'; document.head.appendChild(m); }
    m.content = desc;
    let c = document.querySelector('link[rel="canonical"]');
    if (!c) { c = document.createElement('link'); c.rel = 'canonical'; document.head.appendChild(c); }
    c.href = `https://multisportshd.com/watch/${id}`;
    return () => { document.title = 'MultiSportsHD - Canlı Maç İzle | Futbol, Basketbol, Tenis HD Yayın'; };
  }, [match, id]);

  // match info + similar rail (same sport)
  useEffect(() => {
    let alive = true;
    fetch('/api/streams')
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        const all = Object.values(d.sports || {}).flatMap((v) => v.events);
        const me = all.find((e) => String(e.stream_id) === String(id));
        if (me) setMatch(me);
        if (me) setSimilar(all.filter((e) => e.sport_key === me.sport_key && String(e.stream_id) !== String(id)).slice(0, 8));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [id]);

  // viewer heartbeat + count
  useEffect(() => {
    fetch(`/api/stream/${id}/viewers`).catch(() => {});
    const t = setInterval(() => fetch(`/api/stream/${id}/viewers`).catch(() => {}), 20000);
    const t2 = setInterval(() => {
      fetch(`/api/stream/${id}/viewers`).then((r) => r.json()).then((d) => setViewers(d.viewers || 0)).catch(() => {});
    }, 15000);
    return () => { clearInterval(t); clearInterval(t2); };
  }, [id]);

  // HLS player
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setStatus('loading');
    let cancelled = false;

    fetch(`/api/stream/${id}/playlist`, { headers: { Accept: 'application/vnd.apple.mpegurl' } })
      .then(async (r) => {
        if (cancelled) return;
        if (r.status === 404) { setStatus('error'); setErrorMsg('Yayın henüz başlamadı veya sona erdi.'); return; }
        if (!r.ok) { setStatus('error'); return; }
        const text = await r.text();
        if (!text.includes('#EXTM3U')) { setStatus('error'); return; }

        const hls = new Hls({
          maxBufferLength: 45,             // daha derin tampon → ağ dalgalanmalarına dayanıklı
          maxMaxBufferLength: 120,
          backBufferLength: 30,
          liveSyncDurationCount: 3,        // canlı uçtan 3 segment geride takip
          liveMaxLatencyDurationCount: 12, // 12 segment geride kalırsa otomatik canlı uca atla (donma önleme)
          fragLoadingMaxRetry: 6,
          fragLoadingRetryDelay: 1000,
          manifestLoadingMaxRetry: 4,
        });
        hlsRef.current = hls;
        hls.loadSource(`/api/stream/${id}/playlist`);
        hls.attachMedia(video);
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
            else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
            else if (!cancelled) setStatus('error');
          }
        });
        hls.on(Hls.Events.MANIFEST_PARSED, () => { video.play().catch(() => {}); });
      })
      .catch(() => { if (!cancelled) setStatus('error'); });

    return () => {
      cancelled = true;
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [id, attempt]);

  // Donma dedektörü: currentTime 8 sn ilerlemezse canlı uca atla + yeniden oynat
  useEffect(() => {
    if (status !== 'playing') return;
    let lastTime = 0, lastChange = Date.now();
    const v = videoRef.current;
    if (!v) return;
    const iv = setInterval(() => {
      if (!v || v.paused) { lastChange = Date.now(); return; }
      if (v.currentTime > lastTime + 0.1) {
        lastTime = v.currentTime;
        lastChange = Date.now();
        return;
      }
      // ilerleme yok
      if (Date.now() - lastChange > 8000) {
        lastChange = Date.now();
        try {
          if (hlsRef.current) {
            const liveSync = hlsRef.current.liveSyncPosition;
            if (liveSync && Number.isFinite(liveSync)) v.currentTime = liveSync;
          }
          v.play().catch(() => {});
        } catch { /* noop */ }
      }
    }, 2000);
    return () => clearInterval(iv);
  }, [status]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlaying = () => setStatus('playing');
    v.addEventListener('playing', onPlaying);
    return () => v.removeEventListener('playing', onPlaying);
  }, []);

  // countdown for upcoming matches
  useEffect(() => {
    if (!match?.start) return;
    const tick = () => {
      const ts = new Date(match.start).getTime();
      if (ts <= Date.now()) { setCountdown(''); return; }
      setCountdown(fmtCountdown(ts));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [match?.start]);

  const retry = () => { setStatus('loading'); setAttempt((a) => a + 1); };

  return (
    <div className="page">
      <header className={`site-header ${scrolled ? 'scrolled' : ''}`}>
        <div className="shell header-inner">
          <Link to="/" className="brand">
            <img src="/logo.svg" alt="MultiSportsHD" className="brand-logo" />
          </Link>
          <nav className="cat-nav" aria-label="Spor kategorileri">
            <Link to="/" className="cat-link">Ana Sayfa</Link>
          </nav>
          <span className="header-live"><span className="header-live-dot" /><span className="text">CANLI</span></span>
        </div>
      </header>

      <main className="page-main watch-wrap">
        <div className="player-shell">
          <video ref={videoRef} className="player-video" controls playsInline muted autoPlay />
          {/* MultiWin sponsor watermark — sağ alt köşe, tıklanabilir */}
          <a
            href="https://multiwin.cc/mwsport"
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="player-brand-mark"
            aria-label="MultiWin"
            title="MultiWin"
          >
            <img src="/assets/multiwin-180.png" alt="MultiWin" />
          </a>
          {status === 'loading' && <div className="player-loading">Yayın yükleniyor…</div>}
          {status === 'error' && (
            <div className="player-error">
              <div className="state-box">
                <div className="state-icon">📡</div>
                <p>{errorMsg}</p>
                {countdown && <p className="countdown">🕐 Yayın {countdown} başlayacak</p>}
                <div className="state-actions">
                  <button className="btn primary" onClick={retry}>Yeniden dene</button>
                  <Link to="/" className="btn">Yayınlara dön</Link>
                </div>
              </div>
            </div>
          )}
          {countdown && status !== 'error' && (
            <div className="countdown-pill">🕐 {countdown} başlayacak</div>
          )}
        </div>

        <div className="player-title-bar">
          <div>
            <h1>Canlı Yayın</h1>
            <div className="player-meta">
              {match ? <span className="match-title">{match.home}{match.away ? ` vs ${match.away}` : ''} — {match.league}</span> : 'Canlı spor yayını'}
            </div>
            <div className="player-meta"><span className="viewer-badge"><span className="viewer-dot" /> {viewers} izleyici</span></div>
          </div>
          <div className="player-actions">
            <Link to="/" className="btn">← Yayınlara dön</Link>
          </div>
        </div>

        {similar.length > 0 && (
          <section className="similar-section">
            <h2 className="section-heading">Benzer yayınlar</h2>
            <div className="rail">
              {similar.map((e) => (
                <Link key={e.stream_id} to={`/watch/${e.stream_id}`} className="card" target="_blank" rel="noopener noreferrer">
                  <div className="card-media">
                    <img className="card-cover" src={e.ai_cover || e.cover || `/api/stream/${e.stream_id}/cover?home=${encodeURIComponent(e.home)}&away=${encodeURIComponent(e.away)}&league=${encodeURIComponent(e.league)}`} alt="" loading="lazy" />
                    <span className={e.status === 'live' ? 'badge badge-live' : 'badge badge-muted'}>{e.status === 'live' ? 'CANLI' : (e.start ? `🕐 ${new Date(e.start).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}` : 'Yayın')}</span>
                  </div>
                  <div className="card-body">
                    <span className="card-league">{e.league}</span>
                    <h3 className="card-title">{e.away ? `${e.home} vs ${e.away}` : e.home}</h3>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
