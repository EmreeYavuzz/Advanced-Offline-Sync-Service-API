# React Native Cevrimdisi Servis Formu

Bu repo, sahada internet olmasa bile servis talebi olusturabilen bir mobil demo uygulasidir. Form kaydi once cihaza yazilir, baglanti uygun hale gelince uygulama bekleyen kayitlari otomatik olarak sunucuya gonderir.

Proje iki parcadan olusur:

- `mobile/`: Expo Router + TypeScript mobil uygulama
- `mock-api/`: Express tabanli demo backend

## Demo Video

Offline kayit, otomatik sync ve cakisma cozumunu gosteren ekran kaydi:

[Uygulama Tanıtım ve Demo Videosu](https://youtu.be/IVtDPGbkX2c)

## Amac

Bu demo su problemi cozer:

- surucu internet yokken servis talebi olusturabilir
- kayit uygulama kapansa bile kaybolmaz
- internet geldiginde manuel buton olmadan otomatik senkron olur
- her kaydin durumu listede gorunur
- cakisma olursa kullanici karar verir

## Teknoloji Stack

- React Native
- Expo
- Expo Router
- TypeScript
- AsyncStorage
- NetInfo
- Express

Bonus tarafinda hazirlanan altyapi:

- `expo-notifications`
- `expo-background-task`
- `expo-task-manager`

## Gereksinimler

- Node.js 18+
- npm 9+
- Expo SDK 54
- Android Emulator veya gercek cihaz

Not:

- Notification ve background task gibi bonus ozellikler Expo Go yerine development build veya gercek cihazda daha dogru test edilir.

## Ozellikler

- Form gonderildigi anda kayit once cihaza yazilir
- Kayitlar AsyncStorage icinde kalici tutulur
- Uygulama kapanip acilsa da kuyruk geri yuklenir
- Baglanti durumu NetInfo ile izlenir
- Server sagligi ayrica `GET /health` ile kontrol edilir
- Baglanti ve server uygun hale gelince otomatik senkron baslar
- Her kayit icin durum listede gorunur:
  - `Bekliyor`
  - `Gonderiliyor`
  - `Gonderildi`
  - `Hata`
  - `Cakisma`
  - `Atlandi`
- Cakisma durumunda kullanici:
  - `Uzerine Yaz`
  - `Atla`
  secenegini kullanabilir
- Senkron gecmisi tutulur
- Bekleyen kayit olustugunda local notification hatirlaticisi planlanir
- Bekleyen kayit kalmadiginda planlanan bildirim iptal edilir
- Arka plan sync icin queue isleyici altyapisi vardir

## Proje Yapisi

```text
mobile/
  app/
    (tabs)/
      index.tsx
      records.tsx
      history.tsx
    _layout.tsx
    modal.tsx
  src/
    components/
    config/
    constants/
    context/
    services/
    types/
    utils/

mock-api/
  server.js
```

Bu taskin merkezindeki kritik dosyalar:

```text
mobile/src/context/SyncContext.tsx
mobile/src/services/storage.ts
mobile/src/services/syncService.ts
mobile/src/services/syncRunner.ts
mobile/src/services/networkService.ts
mobile/src/services/notificationService.ts
mobile/src/services/backgroundTask.ts
mobile/src/components/ConflictSheet.tsx
mock-api/server.js
```

## Veri Akisi

Uygulamanin temel akisi su sekildedir:

1. Kullanici formu doldurur.
2. Kayit once cihazdaki AsyncStorage kuyruguna yazilir.
3. Uygulama uygun baglanti varsa otomatik sync dener.
4. Basariliysa kayit `Gonderildi` olur.
5. Hata varsa kayit `Hata` olarak kalir.
6. `409 Conflict` durumunda kullaniciya karar ekrani gosterilir.

Bu sayede uygulama sadece ekrandaki state'e bagli kalmaz; veri cihazda kalici olarak saklanir.

## Mock API

Sunucu endpointleri:

- `GET /health`
- `GET /service-requests`
- `POST /service-requests/sync`

### Conflict Kurali

Asagidaki kombinasyon ayniysa:

- `vehicleId`
- `serviceType`
- `requestedAt` gun bilgisi

ve server tarafinda mevcut kayit varsa, `baseVersion` uyusmazliginda API `409 Conflict` doner.

Buradaki conflict zaman karsilastirmasi degil, ayni kayda ait versiyon uyusmazligidir.

## Ornek Conflict Yaniti

API `409 Conflict` dondugunde payload mantigi kabaca su sekildedir:

```json
{
  "message": "Ayni arac icin ayni gun servis kaydi bulundu.",
  "serverVersion": 1,
  "serverRecord": {
    "serverId": "server-123",
    "vehicleId": "34ABC123",
    "serviceType": "Bakim",
    "requestedAt": "2026-05-13T09:00:00.000Z"
  }
}
```

Mobil uygulama bu durumda kullaniciya:

- `Uzerine Yaz`
- `Atla`

seceneklerini sunar.

## Ortam Degiskenleri

Mobil uygulama API adresini su degiskenden okuyabilir:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.50:4000
```

Ornek dosya:

- `mobile/.env.example`

Bu degisken verilmezse uygulama sirasiyla:

- `EXPO_PUBLIC_API_URL`
- Expo host adresi
- Android emulator icin `http://10.0.2.2:4000`

adaylarini kullanmayi dener.

## Kurulum ve Calistirma

### 1. Mock API'yi baslat

```powershell
cd mock-api
npm install
npm start
```

Beklenen:

- `http://localhost:4000/health` calisir

### 2. Mobil uygulamayi baslat

```powershell
cd mobile
npm install
npm start
```

### 3. Gercek cihaz kullaniliyorsa

Telefon `localhost` adresini bilgisayar olarak gormez. Gerekirse API adresini LAN IP ile ver:

```powershell
cd mobile
$env:EXPO_PUBLIC_API_URL="http://192.168.1.50:4000"
npm start
```

veya `.env` dosyasi kullan:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.50:4000
```

## Uygulamada Gorulecek Ekranlar

- `Yeni Talep`
- `Kayitlar`
- `Islem Gecmisi`
- `Cakisma Karari` modal ekrani

## Test Senaryolari

### 1. Offline kayit

1. Mock API'yi kapat.
2. Formu doldur.
3. Kaydi gonder.

Beklenen:

- kayit listede gorunur
- durum `Bekliyor` veya uygun durumda `Hata` olabilir
- uygulama kapanip acilsa da kayit durur

### 2. Otomatik sync

1. Bekleyen kayit varken Mock API'yi yeniden ac.
2. Birkac saniye bekle veya uygulamayi foreground yap.

Beklenen:

- manuel sync butonu olmadan senkron baslar
- kayit `Gonderildi` olur
- islem gecmisi guncellenir

### 3. Hata senaryosu

1. Formda `Arac ID` olarak `ERR-500` gir.
2. Kaydi gonder.

Beklenen:

- API `500` doner
- kayit `Hata` olur
- hata mesaji listede ve gecmiste gorunur

### 4. Cakisma senaryosu

1. Ayni arac ve servis tipi ile bir kayit gonder.
2. Sonra ayni gun icin ayni kombinasyonla ikinci kaydi gonder.

Beklenen:

- cakisma modal'i acilir
- `Cihazdaki Kayit` ve `Buluttaki Kayit` gorunur
- `Uzerine Yaz` ve `Atla` secenekleri calisir

## Bonus Ozellikler

### Local notification

Bekleyen kayit olustugunda local notification hatirlaticisi planlanir. Bekleyen kayit kalmadiginda planlanan bildirim iptal edilir.

Not:

- Bu kisim development build veya gercek cihaz uzerinde daha dogru test edilir.
- Expo Go ortaminda notification davranisi sinirli olabilir.

### Sync gecmisi

Uygulamada ayri bir `Islem Gecmisi` ekrani vardir. Burada:

- hangi kayit
- ne zaman
- hangi islem
- basarili mi

bilgileri gorulebilir.

### Background sync

Arka plan sync `expo-background-task` ile ayni queue isleyicisini kullanir. Uygulama task'i register eder; isletim sistemi uygun gordugunde AsyncStorage icindeki `Bekliyor` veya `Hata` durumundaki kayitlari tekrar gondermeyi dener.

Bu mekanizma:

- internet durumunu kontrol eder
- queue icindeki bekleyen kayitlari okur
- uygun kayitlari API'ye gonderir
- basarili olursa durumu gunceller
- gerekirse bildirim gonderebilir

Not:

- Bu kisim anlik degil, isletim sisteminin planlayicisina baglidir.
- Development build veya native cihaz testleri daha gercekci sonuc verir.

## Dogrulama Komutlari

Mobil TypeScript derlemesi:

```powershell
cd mobile
npx tsc --noEmit
```

Mock API soz dizimi kontrolu:

```powershell
cd mock-api
node -c server.js
```

## Kabul Kriterleri Kontrolu

Tamamlanan zorunlu maddeler:

- Offline kayit var
- AsyncStorage kullaniliyor
- Otomatik sync var
- Sync durumlari listede gorunuyor
- Cakisma cozumu var
- Manuel sync butonu yok

Bonus durumu:

- Local push notification: altyapi var, native test onerilir
- Sync gecmisi ekrani: tamam
- Arka plan sync: altyapi var, native test onerilir

## Teslim Formati

Bu task icin teslim paketi su sekilde hazirlandi:

- GitHub repo
- README
- Offline senaryosunu gosteren ekran kaydi
