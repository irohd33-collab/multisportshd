# Windows .exe Otomatik Derleme — AppVeyor Kurulum Rehberi

Bu rehberi takip ederek Windows kurulum dosyanı (`MultiSportsHD-Setup.exe`)
otomatik ürettirirsin: her kod güncellemesinde AppVeyor .exe'yi derler ve
indirme linki otomatik güncellenir.

## Toplam süre: ~15 dakika (bir kez)

## 1) Kaynak kodu GitHub'a yükle

Mevcut sitenin tamamını (client + server + desktop klasörleri) bir GitHub reposuna yükle:

1. github.com'a gir → **New repository** → isim: `multisportshd` (Public seç, ücretsiz katman yeterli)
2. Yerelde:
   ```bash
   git remote add origin https://github.com/<kullanıcıadın>/multisportshd.git
   git push -u origin main
   ```

## 2) AppVeyor hesabı aç ve projeyi bağla

1. appveyor.com → **Sign in with GitHub**
2. **NEW PROJECT** → reposunu seç → **Add**
3. Proje ayarları açılır — `appveyor.yml` dosyası repoda olduğu için otomatik okunur

## 3) GitHub Token oluştur (otomatik release için)

1. github.com → Settings → Developer settings → **Personal access tokens (classic)**
2. **Generate new token** → scope: `repo` seç
3. Token'ı kopyala
4. AppVeyor → proje → **Settings → Environment** → **Add variable**:
   - Name: `GITHUB_TOKEN`
   - Value: kopyaladığın token
   - **Encrypt** butonuna bas (şifrelenmiş saklanır)

## 4) İlk build

AppVeyor → proje → **NEW BUILD** → build başlar (~5 dakika):
- Windows .exe derlenir
- **Artifacts** sekmesinde `MultiSportsHD-Setup-1.0.0.exe` görünür
- GitHub Releases'a otomatik yüklenir

## 5) Siteye kalıcı indirme linki bağla

Release yüklendiğinde sabit URL şu formatta olur:

```
https://github.com/<kullanıcıadın>/multisportshd/releases/latest/download/MultiSportsHD-Setup-1.0.0.exe
```

Bu URL'yi `/indir` sayfasındaki Windows satırına bağla — böylece her
güncellemede link otomatik en yeni .exe'yi indirir.

## Maliyet

- **Public repo:** AppVeyor tamamen ücretsiz
- **Private repo:** Aylık ~$29 (yalnızca kod gizli olacaksa gerekir)

## Sonraki Güncellemeler

Siteyi güncellediğinde `git push` yapman yeterli — AppVeyor otomatik
yeni .exe derler, GitHub Releases'ı günceller, sitenin linki hep en
yeni sürümü işaret eder.
