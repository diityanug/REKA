<div align="center">
  <img src="./assets/icon.png" alt="REKA Logo" width="96" height="96" style="border-radius: 22px;" />

  # REKA
  **Smart, Private, and Effortless Multi-Currency Personal Finance Tracker**

  [![Expo SDK 58](https://img.shields.io/badge/Expo-SDK%2058-000020?logo=expo&logoColor=white)](https://expo.dev)
  [![React Native 0.88](https://img.shields.io/badge/React%20Native-0.88-61DAFB?logo=react&logoColor=black)](https://reactnative.dev)
  [![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
  [![SQLite Offline-First](https://img.shields.io/badge/Storage-SQLite%20Local-003B57?logo=sqlite&logoColor=white)](https://docs.expo.dev/versions/latest/sdk/sqlite/)
  [![License: MIT](https://img.shields.io/badge/License-MIT-11473B.svg)](./LICENSE)
</div>

---

## Overview

**REKA** (*Mereka-reka / Merancang Keuangan*) adalah aplikasi mobile pencatat dan perencana keuangan pribadi berbasis **React Native (Expo)** dengan arsitektur **100% Offline-First**. Seluruh data akun, sub-kantong (*pockets*), transaksi, hingga rencana alokasi disimpan secara lokal di perangkat menggunakan **SQLite** tanpa memerlukan akun cloud ataupun koneksi internet.

 Dilengkapi dengan **AI Receipt Scanner** opsional berbasis **Google Gemini** untuk mengekstrak detail struk belanja secara otomatis, serta dukungan **Multi-Currency (`IDR` & `USD`)** dengan pendekatan *Unified View, Native Balance* (tanpa mencampur nilai kurs fluktuatif pada saldo utama).

---

## Key Features

- **Unified Multi-Currency (`IDR` & `USD`)**
  - Seluruh akun (`Bank`, `E-Wallet`, `Cash`, `Investment`, `Credit Card`, `E-Money`), *Allocation Plans*, dan riwayat transaksi tampil menyatu dalam satu daftar dengan format mata uang aslinya (*native currency*).
  - Kartu **Total Balance**, **Inflow/Outflow**, dan **Analytics** memiliki *currency switcher* instan (`IDR | USD`) agar metrik setiap mata uang tetap akurat dan tidak terdistorsi fluktuasi kurs harian.
- **Cross-Currency & Internal Account Transfers**
  - Transfer saldo antar-akun dalam mata uang yang sama maupun lintas mata uang (`IDR ↔ USD`) dengan pencatatan kurs (*exchange rate*) otomatis yang terpisah rapi pada bagian **Currency Conversion**.
- **Sub-Accounts / Pockets**
  - Bagi saldo di dalam satu akun utama ke beberapa kantong alokasi (*pockets*) lengkap dengan target dana, progres, dan pemilihan ikon berkategori.
- **Allocation Plans**
  - Buat rencana alokasi anggaran (*50/30/20 Rule*, *4 Buckets Rule*, atau kustom) baik dalam `IDR` maupun `USD`.
- **AI Receipt Scanner (Optional)**
  - Ambil foto struk via kamera atau galeri untuk mengekstrak nama *merchant*, tanggal, mata uang, pajak/diskon, daftar item, hingga total nominal secara otomatis menggunakan **Google Gemini API**.
- **Financial Health & Analytics**
  - Pantau *Cash Flow Ratio*, *Savings Rate*, batas anggaran bulanan (*Monthly Budget*), perbandingan *Month-over-Month*, serta *Donut Chart* pengeluaran & pemasukan per kategori.
- **Privacy Mode & Full Data Ownership**
  - Sembunyikan nominal sensitif dengan satu ketukan (*Privacy Mode*).
  - Ekspor & pulihkan (*Backup & Restore*) seluruh database dalam format **JSON** (dilengkapi fitur *Undo Last Restore*), atau ekspor laporan transaksi ke **CSV** (Excel / Google Sheets).

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | [Expo SDK 58](https://expo.dev) & [React Native 0.88](https://reactnative.dev) (React 19) |
| **Language** | [TypeScript](https://www.typescriptlang.org) |
| **Local Database** | `expo-sqlite` (WAL mode, atomic transactions, auto-migrations) |
| **AI Integration** | `@google/genai` (Gemini 2.5 Flash structured receipt extraction) |
| **Icons & UI** | `lucide-react-native`, `react-native-svg`, custom editorial design tokens |

---

## Getting Started

### 1. Prerequisites
- **Node.js** `>= 20.x`
- **Expo Go** di perangkat fisik atau **Android Studio / Xcode** untuk simulator/emulator.

### 2. Installation

```bash
# Clone repository
git clone https://github.com/diityanug/REKA.git
cd REKA

# Install dependencies
npm install
```

### 3. Environment Configuration (Optional — Receipt Scanner)

Aplikasi **berfungsi penuh secara offline tanpa file `.env`**. Jika ingin mengaktifkan fitur **Scan Struk (AI Receipt Scanner)**, salin file `.env.example` menjadi `.env`:

```bash
cp .env.example .env
```

Lalu isi salah satu konfigurasi berikut di `.env`:

1. **Opsi A — Backend Proxy (Direkomendasikan untuk produksi)**
   ```env
   EXPO_PUBLIC_GEMINI_PROXY_URL=https://your-proxy.example.com/scan
   ```
2. **Opsi B — Direct Gemini API Key (Untuk penggunaan pribadi)**
   ```env
   EXPO_PUBLIC_GEMINI_API_KEY=your_gemini_api_key_here
   ```

### 4. Running the App

```bash
# Jalankan Expo development server
npm start

# Atau langsung ke platform spesifik
npm run android
npm run ios
npm run web
```

---

## Quality Checks & Build

```bash
# Typecheck (TypeScript) & Lint (ESLint)
npm run verify

# Cek kesehatan konfigurasi & dependensi Expo
npm run doctor

# Build APK Android di cloud menggunakan EAS
npx eas-cli@latest build --platform android --profile preview
```

---

## Project Structure

```text
REKA/
├── App.tsx                      # Root komponen & orkestrasi navigasi/modal
├── app.json                     # Konfigurasi Expo & metadata aplikasi
├── eas.json                     # Profil build EAS (development, preview, production)
├── assets/                      # Ikon aplikasi, adaptive icon, dan splash screen
└── src/
    ├── components/              # Komponen UI reusable & kartu transaksi/akun
    │   ├── icons/               # Ikon SVG kustom
    │   ├── modals/              # Bottom-sheet modals (Transaksi, Transfer, Detail, dll.)
    │   └── tabs/                # 4 layar utama (Overview, Accounts, History, Analytics)
    ├── constants/               # Daftar opsi kategori, ikon pocket, & metode pembayaran
    ├── hooks/                   # Custom hooks (useFinanceData, useAppModals, dll.)
    ├── services/                # Layanan SQLite (database.ts) & AI Scanner (receiptScanner.ts)
    ├── theme/                   # Design tokens (Palette, Spacing, Typography)
    ├── types/                   # Definisi tipe TypeScript
    └── utils/                   # Formatter mata uang, kalkulator, tanggal, & haptics
```

---

## License

Dirilis di bawah lisensi [MIT](./LICENSE).
