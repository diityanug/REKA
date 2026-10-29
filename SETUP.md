# REKA — Setup & Release Checklist

Panduan singkat agar app bisa dijalankan dan dirilis tanpa jebakan.

---

## 1. Menjalankan

```bash
npm install
npm run typecheck     # tsc --noEmit
npm run lint          # expo lint
npx expo start        # dev server
```

Build Android lokal: `npx expo run:android` (butuh Android Studio) atau `eas build -p android --profile preview`.

---

## 2. Fitur yang butuh jaringan: scan struk (opsional)

App **berfungsi penuh tanpa internet**. Satu-satunya fitur online adalah scan struk (foto → Google Gemini).
Kalau tidak dikonfigurasi, tombol scan menampilkan pesan dan mengarahkan ke input manual — tidak error.

### Opsi A — Proxy (wajib untuk build yang dibagikan)

Simpan API key **di server**, bukan di app:

1. Buat endpoint yang menerima `POST { "base64Image": "...", "mimeType": "image/jpeg" }`.
2. Ekstrak struk dengan key Anda, balas JSON sesuai `ExtractedReceiptData` di `src/services/receiptScanner.ts`.
3. Tambahkan rate limit / auth sederhana (mis. header token per instalasi).
4. Set env:

```
EXPO_PUBLIC_GEMINI_PROXY_URL=https://your-proxy.example.com/scan
```

### Opsi B — Key langsung di app (hanya build pribadi)

```
EXPO_PUBLIC_GEMINI_API_KEY=...
```

**Peringatan:** semua `EXPO_PUBLIC_*` ikut ter-inline ke bundle dan bisa diekstrak dari APK/IPA/web.
Kalau memakai opsi ini:

- Batasi key di Google Cloud Console: API restriction = **Generative Language API only**, Application restriction = **Android app** (`com.aes.finance` + SHA-1 keystore) / **iOS bundle id**.
- Set budget/quota cap di Google Cloud.
- Jangan pernah build `preview`/`production` yang dibagikan dengan key ini.
- Di **web** tidak ada restriction yang melindungi; pakai proxy.

### Env untuk EAS Build

`.env` **tidak** ikut ter-upload ke EAS (gitignored). Set variabelnya di EAS:

```bash
eas env:create --environment production --name EXPO_PUBLIC_GEMINI_PROXY_URL --value https://...
```

---

## 3. Checklist sebelum rilis

- [ ] `npm run typecheck` dan `npm run lint` bersih
- [ ] `npx expo-doctor` tanpa masalah versi (`npx expo install --fix`)
- [ ] `npx expo export --platform android` sukses
- [ ] Scanner: proxy terpasang **atau** tombol scan memang dibiarkan nonaktif
- [ ] Versi di `app.json` (`version`, `android.versionCode`, `ios.buildNumber`) naik
- [ ] Ikon & splash ada di `assets/`
- [ ] Coba manual di device: tambah transaksi, edit, hapus, transfer, pocket, budget, export, restore
- [ ] Backup JSON diuji: export → wipe → restore

---

## 4. Tanggal penting di kode

| Hal | Lokasi |
|---|---|
| Versi app (dipakai di Settings) | `APP_VERSION` di `App.tsx` — samakan dengan `app.json` |
| Nama DB lokal | `aes_finance.db` di `src/services/database.ts` |
| Skema & migrasi | `src/services/database.ts` (`getDatabase`) |
| Kurs default transfer | `usd_idr_rate` di `app_settings` (default 16000) |
| Preferensi privacy | `privacy_mode` di `app_settings` |
