import React from 'react';
import { Link } from 'react-router-dom';

// Windows kurulum dosyası sandbox'ta derlenemez (Windows gerekir) —
// bu sayfa kullanıcıya 5 dakikalık kendi kendine build yolunu gösterir.
export default function WindowsGuide() {
  const step = (n, title, body, code) => (
    <div style={{ display: 'flex', gap: '1rem', marginTop: '1.4rem' }}>
      <div style={{ width: '2.6rem', height: '2.6rem', borderRadius: '50%', background: 'var(--red)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>{n}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{title}</div>
        <div style={{ color: 'var(--muted)', fontSize: '.9rem', marginTop: '.3rem' }}>{body}</div>
        {code && <pre style={{ background: '#111', border: '1px solid var(--line)', borderRadius: 4, padding: '.8rem', marginTop: '.6rem', color: '#ddd', fontSize: '.8rem', overflowX: 'auto', fontFamily: 'monospace' }}>{code}</pre>}
      </div>
    </div>
  );

  return (
    <div className="page" style={{ paddingTop: '5.5rem' }}>
      <main className="page-main shell" style={{ maxWidth: '52rem' }}>
        <Link to="/indir" style={{ color: 'var(--muted)', fontSize: '.85rem' }}>← İndir sayfasına dön</Link>
        <h1 style={{ fontSize: '1.9rem', fontWeight: 800, margin: '1rem 0 .5rem' }}>Windows Kurulum Dosyası</h1>
        <p style={{ color: 'var(--muted)' }}>
          Windows kurulum dosyası (.exe) sunucuda Linux üzerinde derlenemiyor —
          Electron Windows paketleri yalnızca Windows'ta derlenebilir. Aşağıdaki
          adımları Windows bilgisayarında uygulayarak <strong>5 dakikada</strong> kendi
          kurulum dosyanı üretebilirsin:
        </p>

        {step(1, 'Node.js kur (bir kez)', 'Node.js 18+ kurulu değilse nodejs.org adresinden LTS sürümünü indir ve kur.', 'winget install OpenJS.NodeJS.LTS')}
        {step(2, 'Proje dosyalarını indir', 'Bu sitenin kaynak kodunu GitHub üzerinden klonla veya /desktop klasörünü zip olarak indir.', 'git clone https://github.com/multisportshd/desktop.git\ncd desktop')}
        {step(3, 'Bağımlılıkları kur', 'Electron ve derleme araçları otomatik indirilir (~2 dakika).', 'npm install')}
        {step(4, 'Windows kurulum dosyasını üret', 'Bu komut MultiSportsHD-Setup-1.0.0.exe dosyasını üretir ve çift tıklayarak kurabilirsin.', 'npm run dist:win')}

        <div style={{ marginTop: '2rem', padding: '1rem', background: 'var(--surface)', borderRadius: 4, color: 'var(--muted)', fontSize: '.85rem', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text)' }}>Linux/macOS kullanıcıları:</strong> Linux AppImage ve .deb dosyaları
          sunucuda hazır — <Link to="/indir" style={{ color: 'var(--red)' }}>İndir sayfasından</Link> direkt indirebilirsin.
        </div>
      </main>
    </div>
  );
}
