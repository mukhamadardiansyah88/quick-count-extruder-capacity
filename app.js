/* =========================================================
   app.js — Quick Count Extruder Capacity
   PT Mahkota Sukses Makmur
   ========================================================= */

(function () {
  "use strict";

  /* ================= STATE ================= */
  const state = {
    masterSPK: [],          // cache semua SPK dari GAS
    spkAktif: null,         // objek SPK terpilih
    timerId: null,          // interval stopwatch
    running: false,         // stopwatch jalan?
    startTime: 0,           // timestamp mulai
    elapsedMs: 0,           // total ms saat stop / berjalan
    durasiFinalMs: 0        // durasi saat stop (untuk hitung)
  };

  /* ================= ELEMEN ================= */
  const el = {};

  function cacheElements() {
    el.inputSPK            = document.getElementById("inputSPK");
    el.btnScan             = document.getElementById("btnScan");
    el.btnCariSPK          = document.getElementById("btnCariSPK");

    el.cardHasilSPK        = document.getElementById("cardHasilSPK");
    el.infoSPK             = document.getElementById("infoSPK");
    el.btnTutupInfoSPK     = document.getElementById("btnTutupInfoSPK");

    el.inputPanjangSPK     = document.getElementById("inputPanjangSPK");
    el.inputSettinganCounter = document.getElementById("inputSettinganCounter");

    el.stopwatchDisplay    = document.getElementById("stopwatchDisplay");
    el.btnStopwatch        = document.getElementById("btnStopwatch");
    el.warningDurasi       = document.getElementById("warningDurasi");

    el.inputCounterAwal    = document.getElementById("inputCounterAwal");
    el.inputCounterAkhir   = document.getElementById("inputCounterAkhir");

    el.btnResetAll         = document.getElementById("btnResetAll");

    el.outPerJam           = document.getElementById("outPerJam");
    el.outPerShift         = document.getElementById("outPerShift");
    el.outPerHari          = document.getElementById("outPerHari");

    el.overlayScanner      = document.getElementById("overlayScanner");
    el.btnTutupScanner     = document.getElementById("btnTutupScanner");
    el.readerScanner       = document.getElementById("readerScanner");

    el.overlayReset        = document.getElementById("overlayReset");
    el.btnTutupReset       = document.getElementById("btnTutupReset");
    el.btnKonfirmasiReset  = document.getElementById("btnKonfirmasiReset");
    el.btnBatalReset       = document.getElementById("btnBatalReset");
  }

  /* ================= UTIL ================= */
  function pad2(n) {
    return n < 10 ? "0" + n : "" + n;
  }

  function formatDurasi(ms) {
    if (ms < 0) ms = 0;
    const totalMs = Math.floor(ms);
    const jam     = Math.floor(totalMs / 3600000);
    const menit   = Math.floor((totalMs % 3600000) / 60000);
    const detik   = Math.floor((totalMs % 60000) / 1000);
    const centi   = Math.floor((totalMs % 1000) / 10); // 2 digit (00-99)
    return pad2(jam) + ":" + pad2(menit) + ":" + pad2(detik) + "," + pad2(centi);
  }

  function durasiKeJam(ms) {
    return ms / 3600000; // ms → jam desimal
  }

  function parseAngka(str) {
    if (str === null || str === undefined) return NaN;
    // Ganti koma jadi titik, hapus spasi & pemisah ribuan titik
    let s = String(str).trim().replace(/\s/g, "");
    s = s.replace(/,/g, ".");
    // Hapus titik pemisah ribuan jika ada lebih dari satu titik / pola ribuan
    // Sederhana: biarkan satu titik terakhir sebagai desimal
    const parts = s.split(".");
    if (parts.length > 2) {
      const desimal = parts.pop();
      s = parts.join("") + "." + desimal;
    }
    return parseFloat(s);
  }

  function formatOutput(angka) {
    if (!isFinite(angka)) return "—";
    return angka.toLocaleString(CONFIG.LOCALE, {
      minimumFractionDigits: CONFIG.DESIMAL_OUTPUT,
      maximumFractionDigits: CONFIG.DESIMAL_OUTPUT
    });
  }

  /* ================= GAS FETCH (JSONP) ================= */
  function jsonp(action, params) {
    return new Promise((resolve, reject) => {
      const callbackName = "gasCallback_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
      const query = Object.assign({ action: action, callback: callbackName }, params || {});
      const url = CONFIG.GAS_URL + "?" + Object.keys(query)
        .map(k => encodeURIComponent(k) + "=" + encodeURIComponent(query[k]))
        .join("&");

      const script = document.createElement("script");
      script.src = url;
      script.async = true;

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Timeout: GAS tidak merespons."));
      }, 20000);

      function cleanup() {
        clearTimeout(timeout);
        if (script.parentNode) script.parentNode.removeChild(script);
        try { delete window[callbackName]; } catch (e) { window[callbackName] = undefined; }
      }

      window[callbackName] = function (data) {
        cleanup();
        if (data && data.ok === false) {
          reject(new Error(data.error || "GAS error"));
        } else {
          resolve(data);
        }
      };

      script.onerror = function () {
        cleanup();
        reject(new Error("Gagal memuat GAS (network/CORS)."));
      };

      document.body.appendChild(script);
    });
  }

  /* ================= LOAD MASTER SPK ================= */
  async function loadMasterSPK() {
    try {
      const res = await jsonp("getMasterSPK", {});
      // res: { ok: true, data: [ { noSPK, jenis, tebal, lebar, lipat, panjangPot, panjangRol, bd, ... } ] }
      if (res && res.ok && Array.isArray(res.data)) {
        state.masterSPK = res.data;
        console.log("[QuickCount] Master SPK loaded:", state.masterSPK.length, "baris");
      } else {
        console.warn("[QuickCount] Format getMasterSPK tidak dikenali:", res);
        state.masterSPK = [];
      }
    } catch (e) {
      console.error("[QuickCount] Gagal load master SPK:", e);
      state.masterSPK = [];
      // Tidak blocking; user tetap bisa coba cari SPK (akan gagal sampai data termuat)
    }
  }

  /* ================= CARI SPK ================= */
  function cariSPK() {
    const no = (el.inputSPK.value || "").trim();
    if (!no) {
      el.inputSPK.classList.add("error");
      setTimeout(() => el.inputSPK.classList.remove("error"), 1200);
      return;
    }

    const found = state.masterSPK.find(
      (row) => String(row.noSPK || "").trim() === no
    );

    if (!found) {
      el.inputSPK.classList.add("error");
      setTimeout(() => el.inputSPK.classList.remove("error"), 1200);
      return;
    }

    el.inputSPK.classList.remove("error");
    state.spkAktif = found;
    tampilInfoSPK(found);
  }

  function tampilInfoSPK(spk) {
    el.cardHasilSPK.classList.remove("hidden");

    const baris = [];

    function row(label, value, isBD) {
      const v = (value === undefined || value === null || value === "") ? "—" : value;
      baris.push(
        '<div class="info-row">' +
          '<span class="info-label">' + escapeHtml(label) + '</span>' +
          '<span class="info-value' + (isBD ? ' bd' : '') + '">' + escapeHtml(String(v)) + '</span>' +
        '</div>'
      );
    }

    row("No SPK", spk.noSPK);
    row("Jenis Plastik", spk.jenis);
    row("Tebal (mm)", spk.tebal);
    row("Lebar (cm)", spk.lebar);
    row("Lipat (cm)", spk.lipat);
    row("Panjang Pot (cm)", spk.panjangPot);
    row("Panjang Rol (cm)", spk.panjangRol);
    row("BD", spk.bd, true);

    el.infoSPK.innerHTML = baris.join("");
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function tutupInfoSPK() {
    el.cardHasilSPK.classList.add("hidden");
    el.infoSPK.innerHTML = "";
    // Tidak menghapus state.spkAktif — supaya hitungan tetap jalan.
    // Reset All yang akan menghapusnya.
  }

  /* ================= STOPWATCH ================= */
  function toggleStopwatch() {
    if (state.running) {
      stopStopwatch();
    } else {
      startStopwatch();
    }
  }

  function startStopwatch() {
    if (state.running) return;

    // Reset elapsed dari 0 jika sebelumnya sudah stop
    state.startTime = Date.now() - (state.running ? state.elapsedMs : 0);
    state.elapsedMs = 0;
    state.running = true;

    el.btnStopwatch.textContent = "Stop";
    el.btnStopwatch.classList.remove("btn-green");
    el.btnStopwatch.classList.add("btn-red");

    tick();
    state.timerId = setInterval(tick, 50);
  }

  function stopStopwatch() {
    if (!state.running) return;

    state.elapsedMs = Date.now() - state.startTime;
    state.durasiFinalMs = state.elapsedMs;
    state.running = false;

    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }

    el.stopwatchDisplay.textContent = formatDurasi(state.durasiFinalMs);
    el.btnStopwatch.textContent = "Mulai";
    el.btnStopwatch.classList.remove("btn-red");
    el.btnStopwatch.classList.add("btn-green");

    // Peringatan durasi
    if (state.durasiFinalMs > 0 && state.durasiFinalMs < CONFIG.DURASI_MIN_PERINGATAN * 1000) {
      el.warningDurasi.classList.remove("hidden");
    } else {
      el.warningDurasi.classList.add("hidden");
    }

    hitungSemua();
  }

  function tick() {
    if (!state.running) return;
    state.elapsedMs = Date.now() - state.startTime;
    el.stopwatchDisplay.textContent = formatDurasi(state.elapsedMs);
  }

  /* ================= HITUNG ================= */
  function hitungSemua() {
    // Ambil semua nilai
    const spk = state.spkAktif;
    const panjangSPK = parseAngka(el.inputPanjangSPK.value);
    const settingan = parseAngka(el.inputSettinganCounter.value);
    const cAwal = parseAngka(el.inputCounterAwal.value);
    const cAkhir = parseAngka(el.inputCounterAkhir.value);
    const durasiMs = state.durasiFinalMs;

    // Reset output dulu
    setOutput("—", "—", "—");

    // Validasi: SPK & durasi & parameter
    if (!spk) return;
    if (!isFinite(durasiMs) || durasiMs <= 0) return;
    if (!isFinite(panjangSPK) || panjangSPK <= 0) return;
    if (!isFinite(settingan) || settingan <= 0) return;
    if (!isFinite(cAwal) || !isFinite(cAkhir)) return;

    // Counter akhir < awal → tidak valid
    if (cAkhir < cAwal) {
      el.inputCounterAkhir.classList.add("error");
      return;
    } else {
      el.inputCounterAkhir.classList.remove("error");
    }

    // Ambil tebal, lebar, BD dari SPK
    const tebal = parseAngka(spk.tebal);
    const lebar = parseAngka(spk.lebar);
    const bd = parseAngka(spk.bd);

    if (!isFinite(tebal) || !isFinite(lebar) || !isFinite(bd)) return;

    // Rumus
    const deltaCounter = cAkhir - cAwal;
    const panjangProduksi = (deltaCounter / settingan) * panjangSPK; // Meter
    const berat = (tebal * lebar * panjangProduksi * bd) / CONFIG.KONSTANTA_BERAT; // Kg
    const durasiJam = durasiKeJam(durasiMs);

    if (!isFinite(durasiJam) || durasiJam <= 0) return;

    const perHari = (24 / durasiJam) * berat;
    const perShift = perHari / 2;
    const perJam = perHari / 24;

    setOutput(
      formatOutput(perJam),
      formatOutput(perShift),
      formatOutput(perHari)
    );
  }

  function setOutput(perJam, perShift, perHari) {
    el.outPerJam.textContent = perJam;
    el.outPerShift.textContent = perShift;
    el.outPerHari.textContent = perHari;
  }

  /* ================= RESET ALL ================= */
  function bukaOverlayReset() {
    el.overlayReset.classList.add("active");
  }

  function tutupOverlayReset() {
    el.overlayReset.classList.remove("active");
  }

  function resetAll() {
    // Stop stopwatch jika jalan
    if (state.running) {
      stopStopwatch();
    }

    // Reset state
    state.spkAktif = null;
    state.timerId = null;
    state.running = false;
    state.startTime = 0;
    state.elapsedMs = 0;
    state.durasiFinalMs = 0;

    // Reset input
    el.inputSPK.value = "";
    el.inputPanjangSPK.value = "";
    el.inputSettinganCounter.value = "";
    el.inputCounterAwal.value = "";
    el.inputCounterAkhir.value = "";

    // Reset kelas error
    el.inputSPK.classList.remove("error");
    el.inputCounterAkhir.classList.remove("error");

    // Reset stopwatch display & tombol
    el.stopwatchDisplay.textContent = "00:00:00,00";
    el.btnStopwatch.textContent = "Mulai";
    el.btnStopwatch.classList.remove("btn-red");
    el.btnStopwatch.classList.add("btn-green");
    el.warningDurasi.classList.add("hidden");

    // Sembunyikan info SPK
    el.cardHasilSPK.classList.add("hidden");
    el.infoSPK.innerHTML = "";

    // Reset output
    setOutput("—", "—", "—");

    // Tutup overlay reset
    tutupOverlayReset();
  }

  /* ================= SCANNER UI ================= */
  function bukaScanner() {
    el.overlayScanner.classList.add("active");
    setTimeout(() => {
      Scanner.start(
        "readerScanner",
        (decodedText) => {
          el.inputSPK.value = decodedText.trim();
          tutupScanner();
          cariSPK();
        },
        (err) => {
          alert(err);
          tutupScanner();
        }
      );
    }, 200);
  }

  function tutupScanner() {
    Scanner.stop();
    el.overlayScanner.classList.remove("active");
  }

  /* ================= EVENT BINDING ================= */
  function bindEvents() {
    // SPK
    el.btnCariSPK.addEventListener("click", cariSPK);
    el.inputSPK.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        cariSPK();
      }
    });

    // Scanner
    el.btnScan.addEventListener("click", bukaScanner);
    el.btnTutupScanner.addEventListener("click", tutupScanner);

    // Info SPK
    el.btnTutupInfoSPK.addEventListener("click", tutupInfoSPK);

    // Stopwatch
    el.btnStopwatch.addEventListener("click", toggleStopwatch);

    // Hitung ulang setiap input berubah
    [
      el.inputPanjangSPK,
      el.inputSettinganCounter,
      el.inputCounterAwal,
      el.inputCounterAkhir
    ].forEach((input) => {
      input.addEventListener("input", function () {
        hitungSemua();
      });
    });

    // Reset All
    el.btnResetAll.addEventListener("click", bukaOverlayReset);
    el.btnTutupReset.addEventListener("click", tutupOverlayReset);
    el.btnBatalReset.addEventListener("click", tutupOverlayReset);
    el.btnKonfirmasiReset.addEventListener("click", resetAll);

    // Overlay kaku: JANGAN tutup saat klik luar / Escape
    // (tidak ada listener untuk itu)

    // Passive scroll untuk HP
    window.addEventListener("touchmove", function () {}, { passive: true });
  }

  /* ================= INIT ================= */
  function init() {
    cacheElements();
    bindEvents();
    loadMasterSPK(); // async, tidak blocking
    el.stopwatchDisplay.textContent = formatDurasi(0);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
