# MultiSportsHD Desktop — Build Talimatları

Bu klasör Electron masaüstü uygulamasının kaynak kodunu içerir.

## Hızlı Başlangıç

```bash
cd desktop
npm install          # Electron + electron-builder indirir (~2 dk)
npm start            # Geliştirme: pencereyi açar
```

## Paketleme (Dağıtım İçin)

### Windows (Windows 10/11 bilgisayarında çalıştır)
```bash
cd desktop
npm install
npm run dist:win     # → ../downloads/desktop/MultiSportsHD-Setup-1.0.0.exe
```
> Not: Windows dışı platformlarda .exe derlenemez — build'i Windows makinede çalıştır.

### Linux (bu sandbox'ta zaten derlendi)
```bash
cd desktop
npm run dist:linux   # → ../downloads/desktop/*.AppImage + *.deb
```
Çıktılar: `downloads/desktop/MultiSportsHD-1.0.0.AppImage` (109 MB) ve
`multisportshd-desktop_1.0.0_amd64.deb` (76 MB) — canlıda indirilebilir durumda.

### macOS (Mac bilgisayarda çalıştır)
```bash
cd desktop
npm install
npm run dist:mac     # → ../downloads/desktop/MultiSportsHD-1.0.0.dmg
```
> Not: Apple Developer hesabı olmadan da DMG üretilir; Gatekeeper uyarısı verir (sağ tık → Aç).

## Otomatik Güncelleme

`electron-updater` paketi eklendiğinde `main.js` içindeki `initAutoUpdate()` otomatik
çalışır; yayın sunucusu (GitHub Releases / generic provider) bağlandığında
güncellemeler kendiliğinden indirilir.

## Dosyalar
- `main.js` — ana süreç: pencere, tray, IPC, auto-update
- `preload.js` — güvenli köprü (başlık çubuğu butonları)
- `icon.png` / `tray.png` — uygulama ikonları
