// Desktop shell: özel başlık çubuğu + sol kenar çubuğu + gömülü site (Ledger Live benzeri)
// Electron'da window.mshd hazır olur; web'de bu bileşen render edilmez.
import React from 'react';

const { mshd } = typeof window !== 'undefined' ? window : {};

export function isDesktopApp() {
  return !!(mshd && mshd.isDesktop);
}

export function TitleBar() {
  if (!isDesktopApp()) return null;
  const [maximized, setMaximized] = React.useState(false);
  React.useEffect(() => {
    if (mshd?.isMaximized) mshd.isMaximized().then(setMaximized).catch(() => {});
  }, []);
  const dragStyle = { WebkitAppRegion: 'drag' };
  const noDrag = { WebkitAppRegion: 'no-drag' };
  return (
    <div style={{
      ...dragStyle, height: 38, display: 'flex', alignItems: 'center',
      background: '#0a0a0a', borderBottom: '1px solid #1d1d1d',
      paddingLeft: 12, gap: 10, userSelect: 'none', position: 'relative', zIndex: 999,
    }}>
      <img src="/logo.svg" alt="" style={{ height: 18 }} />
      <span style={{ color: '#e50914', fontWeight: 800, fontSize: 13, letterSpacing: 1 }}>DESKTOP</span>
      <div style={{ flex: 1 }} />
      <div style={{ ...noDrag, display: 'flex', gap: 2 }}>
        <TB title="Küçült" onClick={() => mshd.minimize()} label="─" />
        <TB title="Büyüt/Küçült" onClick={async () => { await mshd.maximize(); setMaximized(await mshd.isMaximized()); }} label={maximized ? '❐' : '☐'} />
        <TB title="Tepsiye küçült" onClick={() => mshd.close()} label="✕" danger />
      </div>
    </div>
  );
}

function TB({ title, onClick, label, danger }) {
  return (
    <button title={title} onClick={onClick} style={{
      ...noDragStyle(), width: 44, height: 30, background: 'transparent', border: 0,
      color: danger ? '#e50914' : '#ccc', fontSize: 13, cursor: 'pointer', borderRadius: 3,
    }}
      onMouseEnter={(e) => { e.currentTarget.style.background = danger ? '#e50914' : '#2a2a2a'; e.currentTarget.style.color = danger ? '#fff' : '#fff'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = danger ? '#e50914' : '#ccc'; }}
    >{label}</button>
  );
}
function noDragStyle() { return { WebkitAppRegion: 'no-drag' }; }

// Sol kenar çubuğu — masaüstü uygulamasında ana gezinme (web'de gizli)
export function SideNav() {
  if (!isDesktopApp()) return null;
  const items = [
    { icon: '▶', label: 'Yayınlar', href: '/' },
    { icon: '🔴', label: 'Canlı', href: '/?filter=live' },
    { icon: '🕐', label: 'Yaklaşan', href: '/?filter=upcoming' },
  ];
  return (
    <div style={{
      width: 210, minHeight: 'calc(100vh - 38px)', background: '#111',
      borderRight: '1px solid #1d1d1d', padding: '16px 10px', display: 'flex',
      flexDirection: 'column', gap: 4,
    }}>
      {items.map((it) => (
        <a key={it.href} href={it.href} style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
          borderRadius: 4, color: '#ccc', fontSize: 14, textDecoration: 'none',
        }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#1d1d1d'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#ccc'; }}
        ><span>{it.icon}</span>{it.label}</a>
      ))}
      <div style={{ flex: 1 }} />
      <a href="https://multiwin.cc/mwsport" target="_blank" rel="noreferrer" style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
        borderRadius: 4, color: '#888', fontSize: 12,
      }}>🔗 MultiWin</a>
    </div>
  );
}
