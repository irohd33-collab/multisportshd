import React from 'react';

// Siteye gömülü İndir sayfası — masaüstü (Electron) ve Android APK indirme seçenekleri
// Dosyalar /downloads/ altından servis edilir (deploy paketi downloads/ klasörünü içerir).

// Row bileşeni: `download` attr yalnızca gerçek dosya indirmelerinde kullanılmalı
// (talimat sayfaları HTML route olduğu için download attr'i onları .htm olarak indirir).
function Row({ icon, title, desc, href, fileNote, primary, isPage }) {
  return (
    <a href={href} download={!isPage} className="dl-row" target="_blank" rel="noopener noreferrer" style={primary ? { borderColor: 'var(--red)' } : undefined}>
      <div className="dl-icon">{icon}</div>
      <div className="dl-body">
        <div className="dl-title">{title}</div>
        <div className="dl-desc">{desc}</div>
        <div className="dl-note">{fileNote}</div>
      </div>
      <div className="dl-btn">⬇ İndir</div>
    </a>
  );
}

export default function Download() {
  return (
    <div className="page" style={{ paddingTop: '5.5rem' }}>
      <main className="page-main shell" style={{ maxWidth: '56rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 .5rem' }}>Uygulamayı İndir</h1>
        <p style={{ color: 'var(--muted)', marginBottom: '2rem' }}>
          MultiSportsHD'yi masaüstünde ve telefonunda kullan. Tarayıcı gerektirmez — aç, izle.
        </p>

        <h2 style={{ fontSize: 1.1, fontWeight: 700, margin: '1.5rem 0 .8rem', color: 'var(--red)' }}>MASAÜSTÜ</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.8rem' }}>
          <Row icon="🪟" title="Windows (64-bit)" desc="Windows 10/11 — kurulum sihirbazı ile" href="/indir-windows-talimat" isPage fileNote="Kurulum dosyası GitHub Releases'tan otomatik indirilir — GitHub hesabını bağlamak için tıkla ve talimatı izle" primary />
          <Row icon="🐧" title="Linux AppImage" desc="Ubuntu, Fedora, Debian — kurulum gerektirmez" href="/downloads/desktop/MultiSportsHD-1.0.0.AppImage" fileNote="Portable AppImage · chmod +x sonrası çalıştır (109 MB)" />
          <Row icon="🐧" title="Linux .deb" desc="Debian/Ubuntu — paket yöneticisiyle kurulum" href="/downloads/desktop/multisportshd-desktop_1.0.0_amd64.deb" fileNote="Debian paketi (76 MB)" />
        </div>

        <h2 style={{ fontSize: 1.1, fontWeight: 700, margin: '2rem 0 .8rem', color: 'var(--red)' }}>ANDROID</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.8rem' }}>
          <Row icon="🤖" title="Android APK" desc="Android 7.0+ — Play Store gerekmez" href="/downloads/android/multisportshd.apk" fileNote="multisportshd.apk · bilinmeyen kaynaklara izin ver" primary />
        </div>

        <h2 style={{ fontSize: 1.1, fontWeight: 700, margin: '2rem 0 .8rem', color: 'var(--red)' }}>MAC</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.8rem' }}>
          <Row icon="🍎" title="macOS" desc="macOS 11+ — DMG kurulumu" href="/downloads/desktop/MultiSportsHD-1.0.0.dmg" fileNote="Yakında — kaynak koddan build edilebilir" />
        </div>

        <div style={{ marginTop: '2rem', padding: '1rem', background: 'var(--surface)', borderRadius: 4, color: 'var(--muted)', fontSize: '.85rem', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text)' }}>Not:</strong> Uygulamalar siteyi gömülü tarayıcıda açar
          (masaüstü) / yükler (Android). Canlı yayınlar için internet bağlantısı gereklidir.
          Güncellemeler otomatik kontrol edilir.
        </div>
      </main>
    </div>
  );
}
