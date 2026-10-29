# QA Report — REKA (aes-finance)

> **STATUS: sebagian besar temuan di bawah sudah diperbaiki.** Lihat [QA-FIXES.md](QA-FIXES.md) untuk daftar perbaikan + verifikasi. Dokumen ini disimpan sebagai catatan audit awal.

Audit menyeluruh atas `App.tsx` + seluruh `src/**` (49 file), `services/database.ts`, semua hook, semua modal & tab, plus konfigurasi Expo/EAS.
Cakupan metode: telaah kode baris-per-baris, penyusuran alur data (UI → hook → SQL), lint, typecheck, expo-doctor, dan bundling produksi Android.

---

## 1. Verdict

| Pertanyaan | Jawaban |
|---|---|
| Apakah app-nya **jalan**? | Ya. Typecheck 0 error, lint 0 warning, bundle Android produksi sukses (2.750 modul, Hermes 5,2 MB). Tidak ada import hilang / config plugin rusak. |
| Apakah **fitur inti** lengkap? | Ya. Catat transaksi, scan struk, transfer (termasuk beda mata uang), pocket/amplop, budget, analitik, backup/restore, export CSV — semuanya ada dan saling terhubung. |
| Sudah **usable untuk dipakai sendiri** (Android)? | **Ya, sudah enak dipakai sehari-hari.** Ada beberapa bug angka yang harus Anda sadari (P0-1…P0-3), tapi alur harian tidak terhambat. |
| Layak **dirilis / dibagikan ke user lain**? | **Belum.** Ada 8 isu P0: angka bisa tersimpan salah, saldo bisa "bercipta"/korup, input bisa dobel, hapus 1 kaki transfer bisa menghapus transfer lain, dan scan struk akan mati di build produksi. |

Ringkas: **sudah usable untuk Anda, belum aman untuk user lain.** Perkiraan 2 hari kerja untuk membereskan P0 + P1 angka; sisanya polish.

---

## 2. Hasil verifikasi otomatis

| Pemeriksaan | Hasil |
|---|---|
| `npx tsc --noEmit` | Lulus, 0 error |
| `npx expo lint` | Lulus, 0 warning |
| `npx expo export --platform android` | Sukses, 2.750 modul, tidak ada resolusi modul gagal |
| `npx expo-doctor` | 19/20 lulus. Gagal: 5 paket beda **patch** (`expo` 58.0.20→.21, `expo-camera`, `expo-file-system`, `expo-sharing`, `expo-splash-screen`) → jalankan `npx expo install --fix` |
| Test otomatis | **Tidak ada sama sekali.** Logika uang (saldo, budget, konversi, filter bulan) tanpa jaring pengaman regresi. |
| Git | Working tree bersih — semua temuan di bawah masih ada di commit terakhir. |

---

## 3. P0 — Blocker

### P0-1. Struk mata uang asing: angka asing disimpan sebagai mata uang dompet lokal
- `ReviewReceiptModal.tsx:91` — bila tak ada dompet semata uang struk, daftar dompet jatuh ke **semua** dompet (chip `Bca (IDR)`), sementara nominal di atasnya tetap ditampilkan dalam mata uang struk (`:147`).
- `App.tsx:374, 420-421` — saat simpan: `txCurrency = targetWallet.currency` + `amount: extractedData.totalAmount`, **tanpa konversi & tanpa peringatan**.
- Efek: struk **$12.50** masuk ke akun IDR menjadi **Rp 13**. Nominal 0 juga lolos karena `handleSaveScanTransaction` tidak memvalidasi `totalAmount > 0`.

### P0-2. Pengeluaran melebihi saldo tidak diblokir → saldo minus & pocket tidak sinkron
- Chip akun hanya menampilkan nama (`ManualTxModal.tsx:356`), validasi hanya merchant + `amount > 0` (`App.tsx:446-454`).
- `database.ts:755-767`: wallet `balance = balance + delta` (boleh minus), pocket `MAX(0, balance + delta)` (di-clamp).
- Sekali overdraw → saldo wallet dan pocket **permanen berbeda**, tak ada cara memperbaiki dari UI. Bandingkan transfer yang dijaga 2 lapis (`TransferModal.tsx:169-177`, `database.ts:981-985`).

### P0-3. Alokasi pocket "menciptakan uang", dan tombol Release mati
- `database.ts:575-582, 609-616`: bila alokasi > dana belum terpakai, **saldo rekening ditambah** sebesar selisihnya. Rekening Rp 500.000 + pocket "Sewa" Rp 2.000.000 → rekening jadi Rp 2.000.000.
- `App.tsx:892` `onChangeMode={(m) => {}}` → segmented **Release (- Withdraw)** tidak berfungsi. `useAppModals` bahkan tidak mengekspos setter mode (`useAppModals.ts:193-201`).
- UI tidak menampilkan "dana tersedia untuk dialokasikan" (`AdjustPocketModal.tsx:68-84`) → user tidak punya cara tahu ini salah.
- Rilis sebagian juga memotong diam-diam (`database.ts:617-620` clamp ke 0, sisa tidak dilaporkan).

### P0-4. Submit dobel: satu tombol, dua record
- Tanpa guard in-flight: `ManualTxModal.tsx:532-543`, `ReviewReceiptModal.tsx:306-315`, `NewAccountModal.tsx:280`, `NewPocketModal.tsx:239`, `AdjustPocketModal.tsx:165`, `AllocationPlanModal.tsx:369`, `ManageAccountOrderModal.tsx:134`.
- `App.tsx:444` tanpa flag `saving`; ID baru tiap panggilan (`database.ts:707`) → 2 tap = 2 transaksi + saldo terpotong 2×.
- Pola yang benar sudah ada di `TransferModal.tsx:57,477-485` dan `SettingsModal.tsx:248-311` — tinggal disamakan.

### P0-5. Scan struk mati di build produksi, dan API key akan bocor bila dipasang
- `receiptScanner.ts:31-32` memakai `EXPO_PUBLIC_GEMINI_API_KEY` (di-inline saat bundling).
- `.env` tidak di-commit & EAS upload mengikuti `.gitignore`; `eas.json` tidak punya `env` → build produksi tanpa key → semua scan gagal "not configured".
- Bila dimasukkan via `EXPO_PUBLIC_*`, key **ter-embed di bundle JS** dan bisa diekstrak dari APK (risiko billing).
- Jalur aman sudah disiapkan kode (`EXPO_PUBLIC_GEMINI_PROXY_URL`) tapi proxy-nya belum ada.

### P0-6. Scan tanpa Batal & tanpa timeout → app bisa terkunci
- `ScanningReceiptModal.tsx` tanpa tombol batal dan tanpa `onRequestClose` (back Android diabaikan).
- `receiptScanner.ts:110-120, 159` tanpa `AbortController`/timeout, mencoba 6 model × 2 attempt.
- Di jaringan buruk user tertahan di layar "Analyzing Slip" dan seluruh UI tidak bisa disentuh.

### P0-7. Hapus akun menghapus seluruh riwayat, tanpa jumlah & tanpa pengaman
- `useFinanceData.ts:323-346` → `database.ts:508-525` menghapus semua transaksi + pocket akun.
- Pesan hanya `Remove "X" and its linked records from this device?` — tidak menyebut "beserta 214 transaksi", tidak ada typed-confirm, tidak ada auto-backup/undo.
- **Akun terakhir juga bisa dihapus** (tidak ada guard); setelah itu `selectedWalletId` kosong dan simpan transaksi gagal sampai user membuat akun baru.

### P0-8. Hapus satu kaki transfer bisa menghapus transfer **lain**
- `deleteWallet` men-NULL-kan pairing kaki yang tersisa (`database.ts:512-515`).
- Saat kaki yatim itu dihapus, fallback legacy (`database.ts:800-816`) mencari: `category='Transfer' AND type != ? ORDER BY id DESC LIMIT 1` — **tanpa mencocokkan wallet/nominal/waktu**.
- `revertTxBalance` (`:818-842`) lalu membalik saldo wallet itu dan menghapusnya. Kerusakan saldo + kehilangan data yang tidak terkait, dari aksi yang copy-nya hanya bilang "amount will be reversed for both source and destination accounts".

### P0-9. Restore backup: validasi longgar, menghapus dulu, tanpa jaring pengaman
- `database.ts:1286-1304` hanya memeriksa "ada array wallets/transactions" + `{id,name}`; `version: 1` ditulis tapi **tidak pernah dibaca** saat import.
- `pickBackupFile` menerima `text/*` dan `*/*` (`fileStorage.ts:75`) → file sembarang bisa dipilih, lalu `DELETE` semua tabel dijalankan (`:1307-1313`) sebelum insert.
- Tidak ada langkah "backup data sekarang dulu", tidak ada undo, error SQLite mentah ditampilkan apa adanya (`SettingsModal.tsx:166`).
- `sort_order` tidak di-import (`:1330-1339`) → **urutan akun hilang** setelah restore.

---

## 4. P1 — High

| # | Temuan | Bukti |
|---|---|---|
| P1-1 | **Grafik 7 hari menghitung transfer sebagai income DAN expense.** Transfer internal Rp 1 jt menambah +1 jt pemasukan & +1 jt pengeluaran. Semua permukaan lain sudah mengecualikan transfer. | `useFinanceData.ts:166-179` vs `OverviewTab.tsx:120`, `AnalyticsTab.tsx:98` |
| P1-2 | **Kartu Budget salah untuk periode non-bulan-berjalan.** `budgetSpent` ikut filter bulan termasuk `all` → "All Time" membandingkan belanja sepanjang masa dengan budget 1 bulan (bisa ribuan %), label tetap "Spent this Month", Safe Daily Spend membagi dengan 30 hari hardcoded. | `AnalyticsTab.tsx:284-286, 321, 906` |
| P1-3 | **Budget per bulan menimpa default semua bulan.** `setMonthlyBudget` menulis key bulan **dan** key global; `getMonthlyBudget` fallback ke global. Set budget Oktober → Januari-Februari ikut berubah. UI tidak memberi tahu. | `database.ts:1107-1116, 1097-1104` |
| P1-4 | **Privacy mode bocor** di header bulan History (nominal asli tercetak, `privacyMode` juga absen dari deps) dan di alert transfer (`isMasked` hardcoded `false`). | `HistoryTab.tsx:349,352`; `TransferModal.tsx:172` |
| P1-5 | **"Remaining Budget" minus hilang** — overspend Rp 500rb tampil "Rp 500.000"; di privacy mode tak ada sinyal apa pun. | `AnalyticsTab.tsx:953-955` |
| P1-6 | **Bar alokasi vs legend tidak cocok** — bar `100/n` + `Math.max(share,5)`, legend `0`. Akun saldo 0 tampil ~33% di bar, 0% di legend. | `AccountsTab.tsx:54-78` |
| P1-7 | **Kategori tidak divalidasi & jadi basi** saat ganti Expense↔Income (tersimpan "Food & Beverages" sebagai income), dan kategori yang sudah dihapus tetap tersimpan. | `ManualTxModal.tsx:166-169, 429-431`; `App.tsx:446-454` |
| P1-8 | **Hapus kategori default tidak "nempel".** Default category di-seed ulang setiap cold start (`database.ts:252-279`), jadi hapus → restart → kembali. Transaksi lama juga jadi orphan: ikon kategori jatuh ke `HelpCircle` lalu **memakai ikon transaksi yang dibuka sebelumnya**. | `database.ts:252-279, 417-435`; `TxDetailModal.tsx:70-73` |
| P1-9 | **Export bilang "berhasil" padahal tidak terjadi** — batal pilih folder / Sharing tak tersedia = `success:false` tanpa pesan (`SettingsModal.tsx:87-96` tidak punya `else`); di iOS menutup share sheet tetap memunculkan "saved successfully". | `SettingsModal.tsx:87-96, 115-124`; `fileStorage.ts:19-21, 49-58` |
| P1-10 | **Toggle mata uang di dalam form mengubah seluruh app** dan saat edit USD→IDR **nilai transaksi berubah** (`12.50` → `12`) tanpa peringatan. | `App.tsx:746-759, 510-522` |
| P1-11 | **Edit transaksi selalu menimpa jam jadi "sekarang"** (tidak ada time picker); transaksi hasil scan bisa bergeser 1 hari di zona waktu negatif. | `App.tsx:486-499`; `formatters.ts:31` |
| P1-12 | **Quick-add USD menghapus sen** — `parseInt('12.5')` = 12, tap "+$10" jadi 22, bukan 22.50. | `AmountInputModal.tsx:250` |
| P1-13 | **Kurs hardcoded 16.000 & rawan salah ketik** — default literal di 3 tempat + DB, tanpa validasi magnitudo (satu nol ekstra = uang tujuan 10×), dan angka tampil bisa beda dengan yang dipakai. | `TransferModal.tsx:54,122,393`; `database.ts:992` |
| P1-14 | **Tidak ada disclosure privasi.** Foto struk diunggah ke Google Gemini, tapi Settings tak pernah menyebutnya; DB SQLite tidak terenkripsi, tak ada pernyataan "data hanya di perangkat". Ini gap kepercayaan terbesar untuk app finansial. | `receiptScanner.ts:31-32`; `SettingsModal.tsx:229` |
| P1-15 | **Di iOS tombol Save tertutup keyboard** — footer di-pin di luar area scroll, tanpa `KeyboardAvoidingView`. (Android aman karena window resize.) | `ManualTxModal.tsx:532`; `BottomSheetModal.tsx` |
| P1-16 | **iOS build belum bisa dirilis** — `ios.bundleIdentifier` masih placeholder `com.placeholder.appid`, tanpa `ios.buildNumber`. | `app.json` |

---

## 5. P2 — Medium

**Alur & state**
- Navigasi bulan tanpa batas ke masa depan (`OverviewTab.tsx:150-153`, `AnalyticsTab.tsx:383-386`).
- Empty state buntu: History tanpa transaksi hanya "No matching transactions / try adjusting search query", tanpa tombol — padahal `onOpenManualModal` sudah tersedia tapi tak dipakai (`HistoryTab.tsx:328-343`).
- Ganti tipe Expense/Income tidak mereset kategori; buka ulang form selalu reset kategori/"QRIS"/akun → user dengan 5 akun memilih akun setiap input (`useAppModals.ts:249-261`).
- Klik backdrop / back Android membuang form setengah jadi tanpa konfirmasi (`BottomSheetModal.tsx:37,84-89,97`).
- Error hanya muncul setelah submit, dalam dialog terpisah; Save tidak pernah disabled, tidak ada inline error (`ManualTxModal.tsx:532-543`).
- Kreator kategori gagal (nama kosong) tetap mengosongkan form dan mengarahkan draft transaksi ke nama kategori yang tidak ada (`App.tsx:816-827`).
- Nama kategori/akun/pocket boleh duplikat (`database.ts:402-415`).
- Tap baris kategori di Category Manager punya efek tersembunyi ke draft transaksi (`App.tsx:828-834`).
- Budget dikosongkan = tersimpan 0 (menghapus budget) tanpa konfirmasi; tombol "Remove Budget" juga tanpa konfirmasi (`App.tsx:970-978`; `SetBudgetModal.tsx:148-160`).
- "Wipe All Data" tidak mereset kategori, padahal copy bilang "clean initial state" (`database.ts:1422-1439`).
- Adjust Balance langsung menimpa saldo tanpa konfirmasi & 0 dianggap valid (`AccountDetailModal.tsx:436-439`; `AmountInputModal.tsx:264-268`).
- Review struk hampir read-only: hanya merchant bisa diedit, **nominal tidak bisa dikoreksi** padahal itu kesalahan OCR paling mungkin (`ReviewReceiptModal.tsx:145-184`).
- Dana tidak terlihat saat input transaksi (`ManualTxModal.tsx:356`) → user tak tahu sebentar lagi overdraw.
- Wallet bisa diam-diam pindah: bila `selectedWalletId` kosong/tidak cocok, transaksi disimpan ke akun pertama mata uang itu (`App.tsx:456-463`).
- `TxDetailModal` menebak rute transfer dari string nama merchant (`/^(.+?)\s+to\s+(.+)$/`), bukan dari id → nama akun yang mengandung " to " bikin rute salah (`TxDetailModal.tsx:114`).
- "Apply Filters" hanya `onClose()` — filter sudah diterapkan live, tapi tombolnya menyesatkan; tidak ada Cancel (`HistoryFilterModal.tsx:288-298`).
- Manage Account Order: hanya panah 34×34, tanpa drag; menutup = perubahan hilang diam-diam (`ManageAccountOrderModal.tsx:102-124`).
- NewAccountModal: preset chip bisa meninggalkan currency basi (pilih "USD Vault" lalu "BCA" → akun BCA dalam USD).
- Allocation plan menghitung baris kosong di "Total Allocated (N items)" (`AllocationPlanModal.tsx:358`).
- Tanggal file backup pakai UTC → sebelum jam 07:00 WIB namanya tanggal kemarin (`SettingsModal.tsx:84`).

**Visual & aksesibilitas**
- **123 literal hex** di luar `src/theme/tokens.ts` (mis. `#7B61FF` violet, `#EDF5FF` biru dingin) di tengah palet hangat; 4 varian "danger pink" & 3 varian "info blue". `tokens.ts` tidak punya skala spacing/radius — itu sebabnya radius berkisar 12/14/16/18/20/28.
- Dua navigator bulan untuk state yang sama (`finance.selectedMonth`) dengan ukuran, warna, dan copy berbeda (`OverviewTab.tsx:178-211` vs `AnalyticsTab.tsx:407-448`).
- Tiga tipografi heading berbeda untuk level yang sama (Overview 15/600, Accounts 15/700, Analytics 12/700 uppercase).
- Warna CTA primer beda: TransferModal `Palette.ink`, sisanya `Palette.primary`.
- Tiga format tanggal: "Jan 5, 2025" (form), "5 Jan 2025" (list), ISO+jam (detail).
- Duplikasi informasi: Inflow/Outflow/Net di 3 tempat; Total Balance muncul 2 nama ("Total Balance" vs "Total Net Worth"); diagnosis kesehatan finansial 3 kali dalam satu layar; timestamp di TxDetail 2×.
- Tap target di bawah 44pt: tombol header 32×32, currency pill ~24pt, chip 28-30dp, hapus pocket 16px+6px, nav DatePicker 36×36, reorder 34×34.
- **0 `accessibilityLabel`** di seluruh `src/components` — semua tombol ikon tanpa nama untuk TalkBack/VoiceOver.
- 10 blok style `modalOverlay`/`modalSheet` mati di setiap modal, plus style sisa fitur lama.
- Grab handle di `ModalHeader` tidak bisa di-drag (tidak ada pan gesture).
- Tinggi sheet melompat-lompat antar langkah (80/82/84/88/92%) dan footer ada yang sticky, ada yang inline.
- iPad: `supportsTablet: true` + infoPlist `~ipad` mengizinkan 4 orientasi, sementara grid 2 kolom (`width: 48%` + `gap: 12`) tidak muat di landscape.

**Teknis**
- Dependency mati: `expo-camera`, `react-native-reanimated`, `react-native-gesture-handler`, `@emnapi/core`, `@emnapi/runtime` (yang dipakai hanya `Animated` bawaan RN).
- Tidak ada error boundary → satu error render = layar putih.
- Dead props/wiring: `AccountCardItem.pockets` & `totalLiquidity`, `OverviewTab.availableMonths/selectedWalletId/onNavigateToAccounts`, `HistoryTab.onOpenManualModal`, `savingsRate` dikomputasi tapi tak dirender.
- `100 ÷ 0 = 100` di kalkulator (`calculator.ts:36`); preset di atas cap diam-diam tidak bereaksi (`CalculatorKeypad.tsx:153`).
- Dua batas digit USD berbeda: kalkulator 13 digit, AmountInputModal 9 digit.
- Parsing nominal: paste `-500` atau `12-3` dianggap ekspresi matematika (bukan angka), USD `1.250.50` → 1.25, IDR `12.34` → 12 (`formatters.ts:182-205`).
- `CustomAlertModal` menutup dialog **sebelum** menjalankan aksi dan overlay bisa men-dismiss-nya (`CustomAlertModal.tsx:83-89,99`) → dialog konfirmasi tidak benar-benar memblokir.
- Import JSON tidak mereset kategori lama (`database.ts:1309-1314`).
- Tidak ada test & CI.

---

## 6. P3 — Polish

- Label "Merchant / Recipient" + placeholder "Supermarket, Salary" janggal untuk transaksi income.
- Field "Note" di NewAccountModal sebenarnya nomor rekening; placeholder & default-nya beda-beda (`Main Savings` / `Main Vault`).
- "Max N digits" tampil dua kali di AmountInputModal.
- `returnKeyType="next"` di merchant tidak memindah fokus.
- Memilih tanggal "hari ini" di date picker terlihat batal (segmen balik ke "Pick Date").
- Tombol "Reset" filter diberi gaya destructive merah, sementara aksi yang benar-benar destruktif justru outline pucat — bahasa visual terbalik.
- Semua ikon centang dipakai untuk Save/Confirm/Apply di 6 aksi berbeda.
- Token tipografi ditimpa terus (`...Typography.body, fontSize: 13/14/16`) sehingga skala di `tokens.ts` nyaris tidak berefek.
- Dua scrim berbeda untuk maksud yang sama: `rgba(18,18,16,0.32)` vs `rgba(18,18,16,0.45)`.
- Ikon kategori `Duplikat` untuk transaksi reset ke hari ini, sementara Edit mempertahankan tanggal asli.
- CSV: kolom `amount` tidak di-quote (aman, tapi beda perlakuan).
- `NewPocketModal` tidak punya empty state saat belum ada akun.

---

## 7. Yang sudah bagus (jangan dirusak saat refactor)

- Pemisahan bersih: `App.tsx` (orkestrasi) → `useFinanceData` (domain) → `services/database` (SQL) → komponen presentasional.
- Transfer atomik dua kaki dengan `transfer_pair_id`; hapus transfer membalik kedua kaki dengan benar.
- Semua operasi destruktif DB dibungkus transaksi SQL; import atomik (gagal = rollback, data lama utuh).
- IDR/USD dipisah tegas (wallet, budget, allocation plan per mata uang) — tidak ada pencampuran di laporan.
- Parsing nominal IDR, kalkulator BODMAS tanpa `eval`, dan cursor mapping keypad sudah pernah di-hardening.
- Tidak ada `Alert.alert` bawaan, tidak ada `ts-ignore`/`as any` di logika inti, tidak ada `console.log` sisa.
- Desain visual konsisten (cream/terracotta), splash animasi, haptics di titik penting, animasi sheet halus.
- Error DB ditangkap & ditampilkan ke user, bukan crash.

---

## 8. Urutan perbaikan

| Prioritas | Item | Est. |
|---|---|---|
| 1 | P0-2 + P0-3 + P0-4 (validasi saldo, stop money-minting, submit guard) | 4-5 jam |
| 2 | P0-1 (kunci dompet ke mata uang struk / konversi + peringatan, wajib nominal > 0) | 2 jam |
| 3 | P0-7 + P0-8 + P0-9 (hapus & restore: sebut jumlah, guard kaki transfer, validasi backup + auto-backup) | 4 jam |
| 4 | P0-5 + P0-6 (proxy Gemini + env EAS, AbortController + tombol Batal) | 3-4 jam |
| 5 | P1-1…P1-8 (semua bug angka & privacy — 8 titik kecil) | 3 jam |
| 6 | P1-9…P1-16 (export, FX, kategori, disclosure privasi, iOS keyboard/build) | 1 hari |
| 7 | P2 (empty state CTA, label, tap target, a11y, hapus dependency mati, error boundary, `expo install --fix`) | 1-2 hari |
| 8 | P3 polish + test untuk `database.ts` & `formatters/calculator` | 1-2 hari |

Target minimal agar layak dibagikan: **P0-1 s/d P0-9 + P1-1 s/d P1-8** (± 2 hari kerja). Sisanya bisa menyusul tanpa menghalangi pemakaian.
