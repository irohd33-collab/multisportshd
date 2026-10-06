import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

const SPORT_LABEL = {
  football: 'Futbol', basketball: 'Basketbol', tennis: 'Tenis', ice_hockey: 'Buz Hokeyi',
  table_tennis: 'Masa Tenisi', volleyball: 'Voleybol', baseball: 'Beyzbol', cricket: 'Kriket',
  rugby: 'Ragbi', handball: 'Hentbol', futsal: 'Futsal', badminton: 'Badminton',
  golf: 'Golf', boxing: 'Boks', darts: 'Dartlar', formula_1: 'Formula 1',
  horse_racing: 'At Yarışı', motorsport: 'Motor Sporları', snooker: 'Snooker',
  sports_channels: 'Kanallar', american_football: 'Amerikan Futbolu', bandy: 'Bandy',
};

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' });
}
function relTime(ts) {
  const diff = Math.round((ts - Date.now()) / 60000);
  if (!Number.isFinite(diff) || diff <= 0) return 'başladı';
  if (diff < 60) return `${diff} dk sonra`;
  const h = Math.floor(diff / 60);
  if (h < 48) {
    const r = diff % 60;
    return r ? `${h} sa ${r} dk sonra` : `${h} sa sonra`;
  }
  return `${Math.round(diff / 1440)} gün sonra`;
}

function StatusBadge({ e }) {
  if (e.status === 'live') {
    return <span className="badge badge-live"><span className="badge-dot" /> CANLI{e.game_time ? <span style={{ fontWeight: 600 }}>{String(e.game_time).split('.')[0]}</span> : null}</span>;
  }
  if (e.status === 'upcoming' && e.start) {
    const ts = new Date(e.start).getTime();
    const hoursAway = (ts - Date.now()) / 3600000;
    const label = hoursAway < 48 ? `🕐 ${fmtTime(e.start)} · ${relTime(e.start)}` : `📅 ${fmtDate(e.start)} ${fmtTime(e.start)}`;
    return <span className="badge badge-upcoming">{label}</span>;
  }
  if (e.start) return <span className="badge badge-muted">🕐 {fmtTime(e.start)}</span>;
  return <span className="badge badge-muted">Yayın</span>;
}

function StreamCard({ e }) {
  const cover = e.ai_cover || e.cover || `/api/stream/${e.stream_id}/cover?home=${encodeURIComponent(e.home)}&away=${encodeURIComponent(e.away)}&league=${encodeURIComponent(e.league)}`;
  const teams = e.away ? `${e.home} vs ${e.away}` : e.home;
  return (
    <Link to={`/watch/${e.stream_id}`} className="card" target="_blank" rel="noopener noreferrer">
      <div className="card-media">
        <img className="card-cover" src={cover} alt="" loading="lazy" />
        <div className="card-overlay" />
        {(e.home_badge || e.away_badge) && (
          <div className="card-badges">
            {e.home_badge && <img src={e.home_badge} alt="" className="team-badge" loading="lazy" onError={(ev)=>{ev.currentTarget.style.display='none';}} />}
            {e.away ? <span className="vs-mark">vs</span> : null}
            {e.away_badge && <img src={e.away_badge} alt="" className="team-badge" loading="lazy" onError={(ev)=>{ev.currentTarget.style.display='none';}} />}
          </div>
        )}
        <StatusBadge e={e} />
        {e.viewers > 0 && <span className="card-viewers">{e.viewers}</span>}
        <span className="card-play" aria-hidden="true">▶</span>
      </div>
      <div className="card-body">
        <span className="card-league">{e.league}</span>
        <h3 className="card-title">{teams}</h3>
        {e.score_ft && Array.isArray(e.score_ft) && <div className="card-score">{e.score_ft.join(' - ')}</div>}
        {e.referee && <div className="card-referee">⚖ {e.referee}</div>}
      </div>
    </Link>
  );
}

function Row({ title, count, events, scrollRef }) {
  const ref = useRef(null);
  const scroll = (dir) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
  };
  if (!events?.length) return null;
  return (
    <section className="row-section">
      <div className="row-heading">
        <h2 className="row-title">{title}</h2>
        {count != null && <span className="row-count">{count} yayın</span>}
      </div>
      <button className="row-arrow left" aria-label="Geri" onClick={() => scroll(-1)}>‹</button>
      <div className="rail" ref={ref}>
        {events.map((e) => <StreamCard key={e.stream_id} e={e} />)}
      </div>
      <button className="row-arrow right" aria-label="İleri" onClick={() => scroll(1)}>›</button>
    </section>
  );
}

export default function Home() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sport, setSport] = useState('all');
  const [q, setQ] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const load = async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (sport !== 'all') params.set('sport', sport);
      if (q) params.set('q', q);
      const res = await fetch(`/api/streams?${params}`);
      if (!res.ok) throw new Error('liste alınamadı');
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (e) {
      if (!data) setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => load(), 350);
    return () => clearTimeout(t);
  }, [sport, q]);
  useEffect(() => {
    const t = setInterval(() => load(true), 30000);
    return () => clearInterval(t);
  }, [sport, q]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const { all, hero, sports } = useMemo(() => {
    if (!data) return { all: [], hero: null, sports: [] };
    const g = (e) => e.status === 'live' ? 0 : e.status === 'upcoming' ? 1 : 2;
    const key = (e) => {
      if (e.status === 'live') {
        const parts = String(e.game_time || '0').split('.').join(':').split(':').map(Number);
        return -(parts[0] * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0));
      }
      return e.start ? new Date(e.start).getTime() : Infinity;
    };
    const sorted = [...all0(data)].sort((a, b) => g(a) - g(b) || key(a) - key(b));
    const live = sorted.filter((e) => e.status === 'live');
    const upcoming = sorted.filter((e) => e.status === 'upcoming');
    const rest = sorted.filter((e) => e.status !== 'live' && e.status !== 'upcoming');
    return {
      all: sorted,
      hero: live[0] || upcoming[0] || sorted[0] || null,
      sports: Object.entries(data.sports || {}).map(([k, v]) => ({ key: k, count: v.count })).sort((a, b) => b.count - a.count),
      _live: live, _upcoming: upcoming, _rest: rest,
    };
  }, [data]);

  const live = useMemo(() => all.filter((e) => e.status === 'live'), [all]);
  const upcoming = useMemo(() => all.filter((e) => e.status === 'upcoming'), [all]);
  const other = useMemo(() => all.filter((e) => e.status !== 'live' && e.status !== 'upcoming'), [all]);

  // category rows: pick up to 6 sports with most events, excluding current filter
  const catRows = useMemo(() => {
    const counts = new Map();
    for (const e of all) counts.set(e.sport_key, (counts.get(e.sport_key) || 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([key, count]) => ({
        key,
        count,
        label: SPORT_LABEL[key] || key.replace(/_/g, ' '),
        events: all.filter((e) => e.sport_key === key),
      }));
  }, [all]);

  const heroCover = hero ? (hero.ai_cover || hero.cover || '') : '';

  return (
    <div className="page">
      <header className={`site-header ${scrolled ? 'scrolled' : ''}`}>
        <div className="shell header-inner">
          <Link to="/" className="brand">
            <img src="/logo.svg" alt="MultiSportsHD" className="brand-logo" />
          </Link>
          <nav className="cat-nav" aria-label="Spor kategorileri">
            <button className={`cat-link ${sport === 'all' ? 'active' : ''}`} onClick={() => setSport('all')}>Tümü</button>
            {sports.slice(0, 4).map((s) => (
              <button key={s.key} className={`cat-link ${sport === s.key ? 'active' : ''}`} onClick={() => setSport(s.key)}>
                {SPORT_LABEL[s.key] || s.key.replace(/_/g, ' ')}
              </button>
            ))}
            <Link to="/indir" className="cat-link" style={{ color: 'var(--red)', fontWeight: 700 }}>⬇ Uygulamalarımız</Link>
            {sports.length > 6 && (
              <select
                className="cat-select"
                aria-label="Diğer sporlar"
                value=""
                onChange={(e) => { if (e.target.value) setSport(e.target.value); }}
              >
                <option value="" disabled>Diğer…</option>
                {sports.slice(6).map((s) => (
                  <option key={s.key} value={s.key}>{SPORT_LABEL[s.key] || s.key.replace(/_/g, ' ')}</option>
                ))}
              </select>
            )}
          </nav>
          <div className="header-right">
            <div className={`search ${searchOpen ? 'open' : ''}`}>
              <button className="search-btn" aria-label="Ara" onClick={() => setSearchOpen((o) => !o)}>🔍</button>
              {(searchOpen || q) && (
                <input type="search" placeholder="Lig, takım veya maç…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Yayın ara" autoFocus={searchOpen} />
              )}
            </div>
            <span className="header-live"><span className="header-live-dot" /><span className="text">{data?.live_total ?? '—'} CANLI</span></span>
          </div>
        </div>
      </header>

      <main className="page-main">
        {loading && !data && (
          <div style={{ height: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>Yükleniyor…</div>
        )}

        {!loading && error && !data && (
          <div className="state-box">
            <div className="state-icon">⚠️</div>
            <p>Yayın listesi alınamadı.</p>
            <div className="state-actions"><button className="btn primary" onClick={() => load()}>Tekrar dene</button></div>
          </div>
        )}

        {!loading && data && (
          <>
            {(q || sport !== 'all') ? (
              <div style={{ paddingTop: '5.5rem' }}>
                <div className="row-heading">
                  <h2 className="row-title">{q ? `"${q}" için sonuçlar` : (SPORT_LABEL[sport] || sport)}</h2>
                  <span className="row-count">{all.length} yayın</span>
                  <button className="row-link" style={{ opacity: 1 }} onClick={() => { setQ(''); setSport('all'); }}>Temizle</button>
                </div>
                <div className="rail">
                  {all.map((e) => <StreamCard key={e.stream_id} e={e} />)}
                </div>
                {all.length === 0 && (
                  <div className="state-box"><div className="state-icon">📭</div><p>Sonuç yok.</p></div>
                )}
              </div>
            ) : (
              <>
                {hero && (
                  <section className="hero">
                    <div className="hero-bg">
                      <img src={heroCover} alt="" />
                    </div>
                    <div className="hero-content shell">
                      <div className="hero-league">
                        {hero.status === 'live' && <span className="badge-dot" />}
                        {hero.status === 'live' ? 'CANLI' : 'YAKLAŞAN'} · {hero.league}
                      </div>
                      <h1 className="hero-title">{hero.away ? `${hero.home} vs ${hero.away}` : hero.home}</h1>
                      <div className="hero-meta">
                        {hero.status === 'live' && hero.game_time && <span>⏱ {String(hero.game_time).split('.')[0]}</span>}
                        {hero.start && <span>{fmtTime(hero.start)}</span>}
                        {hero.viewers > 0 && <span>{hero.viewers} izleyici</span>}
                      </div>
                      {hero.score_ft && Array.isArray(hero.score_ft) && (
                        <div className="hero-desc">{hero.score_ft.join(' - ')}</div>
                      )}
                      <div className="hero-actions">
                        <Link to={`/watch/${hero.stream_id}`} className="btn-hero" target="_blank" rel="noopener noreferrer">▶ {hero.status === 'live' ? 'İzle' : 'Detay'}</Link>
                        <button className="btn-hero btn-ghost" onClick={() => setSport(hero.sport_key)}>ⓘ Bu sporun yayınları</button>
                      </div>
                    </div>
                  </section>
                )}

                {live.length > 0 && <Row title="Şu An Oynanıyor" count={live.length} events={live} />}
                {upcoming.length > 0 && <Row title="Yaklaşan" count={upcoming.length} events={upcoming} />}
                {catRows.filter((r) => r.key !== 'sports_channels').map((r) => (
                  <Row key={r.key} title={r.label} count={r.count} events={r.events} />
                ))}
                {all.length === 0 && (
                  <div className="state-box"><div className="state-icon">📭</div><p>Şu anda yayın yok.</p></div>
                )}
              </>
            )}
          </>
        )}
      </main>

      <footer className="site-footer">
        <div className="shell">
          <div className="footer-links">
            <Link to="/indir">⬇ Uygulamayı İndir</Link>
            <a href="https://multiwin.cc/mwsport" target="_blank" rel="noopener noreferrer sponsored">MultiWin</a>
            <a href="/sitemap.xml">Site Haritası</a>
          </div>
          <div>MultiSportsHD — canlı ve yaklaşan spor yayınları</div>
        </div>
      </footer>
    </div>
  );
}

function all0(data) {
  return Object.values(data.sports || {}).flatMap((v) => v.events);
}
