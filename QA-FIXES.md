# QA Fixes — REKA

Ringkasan perbaikan yang diterapkan setelah audit di [QA-REPORT.md](QA-REPORT.md).

**Verifikasi akhir:** `npx tsc --noEmit` → 0 error · `npx expo lint` → 0 error / 0 warning · `npx expo-doctor` → **20/20 lulus** · `npx expo export --platform android` → sukses (2.751 modul).
**Belum diverifikasi:** pemakaian di device/emulator (tidak tersedia di sesi ini) — jalankan `npx expo start` dan coba alur di bagian "Checklist uji manual".

> Catatan `npm audit`: 8 advisory tersisa, semuanya di tooling Expo (`@expo/cli` → `deepmerge`, `zod`) yang hanya dipakai saat build/dev. Tidak ada di kode runtime app. `npm audit fix --force` akan menurunkan Expo ke SDK 51 (breaking), jadi sengaja **tidak** dijalankan.

---

## 1. P0 — Blocker (semua selesai)

| # | Masalah | Perbaikan |
|---|---|---|
| 1 | Struk beda mata uang tersimpan dengan angka asing | `ReviewReceiptModal` hanya menampilkan akun dengan mata uang struk (tanpa fallback), ada empty-state + tombol "Create {CUR} Account". Nominal kini **bisa diedit** (tap amount → keypad). `App.tsx` memblokir simpan bila mata uang akun ≠ mata uang struk, dan bila nominal ≤ 0. |
| 2 | Expense melebihi saldo → minus & pocket desync | UI: peringatan "Balance Will Go Negative" dengan pilihan Cancel / Save Anyway (bukan blokir diam-diam). Pocket: diblokir di UI **dan** di DB (`InsufficientFundsError`). Klaim `MAX(0, …)` dihapus sehingga saldo wallet & pocket selalu konsisten. |
| 3 | Alokasi pocket "menciptakan uang"; tombol Release mati | DB menolak alokasi melebihi dana belum terpakai dan menolak rilis melebihi saldo pocket. UI menampilkan "Available to allocate" / "Can release up to" + inline error. `onChangeMode` sudah ter-wire (`useAppModals.setAdjustPocketMode`). |
| 4 | Submit dobel | Guard `saving` + spinner "Saving…" di ManualTx, ReviewReceipt, NewAccount, NewPocket, AdjustPocket, SetBudget, AllocationPlan, ManageAccountOrder, CategoryManager, AmountInput. |
| 5 | Scanner mati di build produksi / key bocor | `isReceiptScannerConfigured`; tombol scan memberi pesan jujur + arah ke input manual (tidak error). `.env.example` + `SETUP.md` menjelaskan proxy vs key langsung. Settings kini punya bagian **Privacy & Data** yang menyebut foto struk dikirim ke Google Gemini dan data lain hanya di perangkat. |
| 6 | Scan bisa menggantung selamanya | `AbortController` + timeout 30 detik, tombol **Cancel Scan** (dan back Android), model dikurangi 3 dengan 1 retry. |
| 7 | Hapus akun menghapus seluruh riwayat tanpa info | Dialog menyebut jumlah transaksi & pocket + "cannot be undone". Akun terakhir tidak bisa dihapus (`deleteWallet` menolak). |
| 8 | Hapus 1 kaki transfer bisa menghapus transfer lain | Heuristik "ORDER BY id DESC" dihapus; hanya `transfer_pair_id` yang dipercaya. Kaki transfer lama dipasangkan sekali saat inisialisasi DB (matching nama + nominal + waktu ≤ 2 menit). |
| 9 | Restore backup liar & tanpa jaring pengaman | Validasi ketat (struktur, versi, id duplikat, referensi wallet/pocket/transaksi/line-item), pesan error yang ramah, **snapshot otomatis** + tombol **Undo Last Restore**, `sort_order` ikut dipulihkan. |

---

## 2. P1 — High (selesai)

- **Grafik 7 hari** tidak lagi menghitung transfer sebagai pemasukan + pengeluaran.
- **Budget per bulan**: `setMonthlyBudget` hanya menulis bulan terpilih (tidak lagi menimpa default semua bulan); kartu budget memakai `budgetMonthKey`, label "Spent in {bulan}", catatan saat melihat periode lain, pacing memakai jumlah hari nyata (bulan lampau → rata-rata harian).
- **Privacy mode**: kebocoran di header bulan History dan alert transfer diperbaiki; status privacy **disimpan** dan bertahan setelah app ditutup.
- **Remaining budget** mempertahankan tanda minus saat overspend.
- **Bar vs legend alokasi likuiditas** memakai satu perhitungan yang sama, tanpa minimum palsu, dan menampilkan "No balance yet" saat saldo nol.
- **Kategori**: divalidasi terhadap tipe transaksi, otomatis direset saat ganti Expense↔Income, duplikat ditolak, dan form tidak dikosongkan saat pembuatan gagal.
- **Hapus kategori default kini permanen** (seeding default hanya sekali per instalasi).
- **Mata uang transaksi terkunci saat edit** (tidak lagi mengubah nilai diam-diam), dan toggle mata uang di form tidak lagi mengubah seluruh app.
- **Waktu transaksi**: ada field jam (HH:mm), dan edit mempertahankan jam asli.
- **Quick-add USD** tidak lagi membuang sen.
- **Kurs transfer** dipakai & ditampilkan dari satu nilai (`appliedRate`), divalidasi (1…1e9), ada peringatan bila tidak wajar, dan **disimpan** untuk pemakaian berikutnya.
- **iOS**: footer Save tidak lagi tertutup keyboard (offset khusus iOS); `ios.bundleIdentifier`, `buildNumber`, dan teks izin kamera/foto ditambahkan.
- **Export backup** menangani batal/gagal/berhasil secara eksplisit; copy iOS tidak lagi mengklaim "tersimpan".
- **Wipe All Data** dua tahap, dan benar-benar mengembalikan kategori pabrik.

---

## 3. P2 — Perbaikan yang terasa saat dipakai

**Navigasi & data**
- Stepper bulan dibatasi sampai bulan berjalan (tidak bisa jalan ke masa depan).
- Empty state History & Overview punya tombol "Add Transaction" (bukan hanya teks).
- "See all" di kartu akun Overview kini berfungsi.
- Tap backdrop saat keyboard terbuka hanya menutup keyboard (tidak membuang form); form transaksi tidak bisa tertutup oleh tap backdrop.
- Hapus budget & adjust balance sekarang minta konfirmasi.
- Header filter History: "Apply Filters" → "Done" (sesuai perilaku live), gaya tombol "Reset" tidak lagi merah.
- TxDetail: ikon kategori tidak lagi mewarisi ikon transaksi sebelumnya; rute transfer diturunkan dari id wallet; timestamp tidak tercetak dua kali.
- Import: kategori dari backup tidak lagi "dihidupkan ulang" oleh seeding.

**UI/UX & aksesibilitas**
- Tap target: tombol header 40×40, tab "+" 52×52, chip 40+ tinggi, panah reorder 44×44, ikon close 40×40.
- `accessibilityRole`/`accessibilityLabel`/`accessibilityState` ditambahkan di header, tab bar, chip akun/pocket/kategori/metode, keypad, baris transaksi, tombol modal.
- Label menyesatkan diperbaiki: "Total Net Worth" → "Total Balance", "Money Journey" → "Analytics", "Receipt Verified" → "Review Receipt", "Note" → "Account Number", "Apply Filters" → "Done".
- `Starting Balance (optional)`, preset akun tidak lagi meninggalkan mata uang lama.
- `AccountCardItem`: teks panjang dipotong dengan ellipsis, nominal menyesuaikan ukuran.
- Token desain: ditambah `Palette.tint*`, `Spacing`, `Radius`; beberapa komponen dimigrasikan ke token.

**Ketahanan**
- `ErrorBoundary` global: crash render tidak lagi menjadi layar putih.
- Dependency tak terpakai dihapus: `expo-camera`, `react-native-reanimated`, `react-native-gesture-handler`, `react-native-worklets`, `@emnapi/*`.
- Izin mikrofon Android diblokir (`blockedPermissions`), karena app tidak merekam audio.
- Script `npm run typecheck`, `npm run lint`, `npm run doctor`, `npm run verify`.
- `supportsTablet: false` (layout belum dirancang untuk tablet/landscape).
- Urutan akun (`sort_order`) ikut tersimpan di backup dan dipulihkan.

---

## 4. Belum dikerjakan (butuh keputusan produk / pekerjaan terpisah)

Ini **bukan regresi**, hanya di luar cakupan perbaikan cepat:

1. **Kunci aplikasi** (PIN/biometrik) dan enkripsi database — butuh `expo-local-authentication` + keputusan UX.
2. **Proxy scanner** belum dideploy; kode & dokumentasi sudah siap (`EXPO_PUBLIC_GEMINI_PROXY_URL`).
3. **Recurring transaction**, notifikasi budget, budget per kategori.
4. **Cloud sync / auto-backup** dan pengingat backup.
5. **Import CSV** (baru export).
6. **Dark mode** dan layout tablet.
7. **Unit test** untuk `database.ts`, `formatters`, `calculator` (belum ada test runner).
8. Refactor menyeluruh 100+ literal warna ke token (sebagian sudah).
9. Nama akun/pocket duplikat masih diizinkan (kategori sudah ditolak).

---

## 5. Checklist uji manual (disarankan sebelum rilis)

1. Tambah transaksi IDR & USD, termasuk nominal besar dan desimal USD.
2. Edit transaksi → jam & tanggal tidak berubah; ganti mata uang ditolak dengan pesan.
3. Expense melebihi saldo → muncul konfirmasi, lalu saldo minus.
4. Buat pocket dengan saldo melebihi dana tersedia → ditolak dengan pesan jelas.
5. Alokasi & **Release** dana pocket → saldo rekening tetap konsisten.
6. Transfer antar akun, lalu hapus salah satu kaki → hanya transfer itu yang hilang.
7. Transfer beda mata uang → kurs tampil = kurs yang dipakai, dan tersimpan.
8. Scan struk USD tanpa akun USD → muncul CTA buat akun USD; nominal bisa dikoreksi.
9. Batalkan scan saat proses berjalan → modal tertutup, app tetap responsif.
10. Export backup → Wipe All Data (2 tahap) → Restore → Undo Last Restore.
11. Hapus akun yang punya transaksi → jumlah record disebut; akun terakhir tidak bisa dihapus.
12. Putar bulan ke depan → tombol next nonaktif di bulan berjalan.
13. Nyalakan privacy mode → semua nominal tersembunyi (termasuk header bulan History); restart app → tetap tersembunyi.
