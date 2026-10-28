/* =========================================================
   config.js — Quick Count Extruder Capacity
   PT Mahkota Sukses Makmur
   ========================================================= */

const CONFIG = {
  /* ---------- BACKEND ---------- */
  // Ganti dengan URL deployment GAS Anda (mode JSONP)
  GAS_URL: "https://script.google.com/macros/s/XXXXXXXXXXXXX/exec",

  // Spreadsheet baru (dipakai backend; frontend tetap lewat GAS)
  SPREADSHEET_ID: "1P50K6PQZ58Sy1HMYzL1XAkQJfgn74O1UYEb86x_Mf2c",

  // Nama sheet alamat di spreadsheet
  SHEET_ALAMAT: "Alamat",

  // Tahun fallback jika tahun sistem tidak ada di sheet Alamat
  TAHUN_FALLBACK: 2026,

  // Cache master SPK di GAS (detik) — 6 jam
  CACHE_SPK_DETIK: 21600,

  /* ---------- RUMUS ---------- */
  // Faktor pembagi rumus berat: tebal * lebar * panjang * BD / KONSTANTA_BERAT
  // Ubah di sini jika hasil lapangan meleset (tanpa edit app.js)
  KONSTANTA_BERAT: 1000,

  // Ambang peringatan durasi singkat (detik)
  DURASI_MIN_PERINGATAN: 60,

  /* ---------- SCANNER ---------- */
  SCANNER: {
    FPS: 10,
    QRBOX: 250,
    ASPECT_RATIO: 1.0,
    DISABLE_FLASH: false
  },

  /* ---------- FORMAT ---------- */
  LOCALE: "id-ID",
  DESIMAL_OUTPUT: 2
};
