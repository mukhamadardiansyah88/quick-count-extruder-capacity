/* =========================================================
   app.js — Quick Count Extruder Capacity
   PT Mahkota Sukses Makmur
   ========================================================= */

(function () {
  "use strict";

  /* ================= STATE ================= */
  const state = {
    masterSPK: [],
    spkAktif: null,
    timerId: null,
    running: false,
    startTime: 0,
    elapsedMs: 0,
    durasiFinalMs: 0
  };

  /* ================= ELEMEN ================= */
  const el = {};

  function cacheElements() {
    el.inputSPK              = document.getElementById("inputSPK");
    el.btnScan               = document.getElementById("btnScan");
    el.btnCariSPK            = document.getElementById("btnCariSPK");

    el.cardHasilSPK          = document.getElementById("cardHasilSPK");
    el.infoSPK               = document.getElementById("infoSPK");
    el.btnTutupInfoSPK       = document.getElementById("btnTutupInfoSPK");

    el.inputPanjangSPK       = document.getElementById("inputPanjangSPK");
    el.inputSettinganCounter = document.getElementById("inputSettinganCounter");

    el.stopwatchDisplay      = document.getElementById("stopwatchDisplay");
    el.btnStopwatch          = document.getElementById("btnStopwatch");
    el.warningDurasi         = document.getElementById("warningDurasi");

    el.inputCounterAwal      = document.getElementById("inputCounterAwal");
    el.inputCounterAkhir     = document.getElementById("inputCounterAkhir");

    el.btnResetAll           = document.getElementById("btnResetAll");

    el.outPerJam             = document.getElementById("outPerJam");
    el.outPerShift           = document.getElementById("outPerShift");
    el.outPerHari            = document.getElementById("outPerHari");

    el.overlayScanner        = document.getElementById("overlayScanner");
    el.btnTutupScanner       = document.getElementById("btnTutupScanner");
    el.readerScanner         = document.getElementById("readerScanner");

    el.overlayReset          = document.getElementById("overlayReset");
    el.btnTutupReset         = document.getElementById("btnTutupReset");
    el.btnKonfirmasiReset    = document.getElementById("btnKonfirmasiReset");
    el.btnBatalReset         = document.getElementById("btnBatalReset");

    el.tahunFooter           = document.getElementById("tahunFooter");
  }

  /* ================= AUDIO ================= */
  let audioCtx = null;

  function getAudioCtx() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function nada(ctx, freq, t, durasi, tipe, gainLevel) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = tipe;
    osc.frequency.setValueAtTime(freq, t);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(gainLevel, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + durasi);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + durasi + 0.01);
  }

  function beepSukses() {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    [660, 880, 1100, 1320].forEach((f, i) => {
      nada(ctx, f, now + i * 0.14, 0.12, "sine", 0.55);
    });
  }

  function beepGagal() {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    [400, 200].forEach((f, i) => {
      nada(ctx, f, now + i * 0.23, 0.12, "square", 0.4);
    });
  }

  function beepMulai() {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.linearRampToValueAtTime(880, now + 0.1);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.45, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  function beepStop() {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.linearRampToValueAtTime(660, now + 0.1);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.45, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  function beepReset() {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    [660, 440].forEach((f, i) => {
      nada(ctx, f, now + i * 0.14, 0.12, "sine", 0.45);
    });
  }

  function getar(pola) {
    if (navigator.vibrate) {
      try { navigator.vibrate(pola); } catch (e) {}
    }
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
    const centi   = Math.floor((totalMs % 1000) / 10);
    return pad2(jam) + ":" + pad2(menit) + ":" + pad2(detik) + "," + pad2(centi);
  }

  function durasiKeJam(ms) {
    return ms / 3600000;
  }

  /**
   * Parse angka dari format id-ID:
   * - Titik = ribuan (dihapus)
   * - Koma = desimal (jadi titik)
   */
  function parseAngka(str) {
    if (str === null || str === undefined) return NaN;
    let s = String(str).trim().replace(/\s/g, "");
    s = s.replace(/\./g, "");   // hapus ribuan
    s = s.replace(/,/g, ".");   // desimal koma → titik
    return parseFloat(s);
  }

  function formatOutput(angka) {
    if (!isFinite(angka)) return "—";
    return angka.toLocaleString(CONFIG.LOCALE, {
      minimumFractionDigits: CONFIG.DESIMAL_OUTPUT,
      maximumFractionDigits: CONFIG.DESIMAL_OUTPUT
    });
  }

  /**
   * Format angka untuk preview input:
   * - Titik ribuan (sisipan otomatis) dihapus dulu lewat pola \d\.\d{3}\b
   * - Titik sisa = ketikan user → dianggap koma (desimal)
   * - Koma = desimal
   * - Format ulang: ribuan pakai titik, desimal pakai koma
   */
  function formatRibuan(str) {
    if (str === null || str === undefined) return "";
    let raw = String(str).trim();
    if (!raw) return "";

    // 1. Hapus titik ribuan sisipan otomatis (pola 1.200 / 1.234.567)
    raw = raw.replace(/(\d)\.(?=\d{3}\b)/g, "$1");

    // 2. Titik sisa = ketikan user (dianggap desimal) → ubah jadi koma
    raw = raw.replace(/\./g, ",");

    // 3. Pisahkan integer & desimal berdasarkan koma pertama
    const komaIdx = raw.indexOf(",");
    let intPart, decPart;
    if (komaIdx >= 0) {
      intPart = raw.slice(0, komaIdx).replace(/\D/g, "");
      decPart = raw.slice(komaIdx + 1).replace(/\D/g, "");
    } else {
      intPart = raw.replace(/\D/g, "");
      decPart = undefined;
    }

    if (!intPart && decPart === undefined) return "";

    // 4. Format ribuan
    let intFormatted = intPart
      ? intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
      : "0";

    if (decPart !== undefined && decPart !== "") {
      return intFormatted + "," + decPart;
    }
    return intFormatted;
  }

  function pasangFormatterRibuan(input) {
    input.addEventListener("input", function () {
      const posisiAkhir = input.selectionStart === input.value.length;
      const formatted = formatRibuan(input.value);
      if (formatted !== input.value) {
        input.value = formatted;
        if (posisiAkhir) {
          const len = input.value.length;
          try { input.setSelectionRange(len, len); } catch (e) {}
        }
      }
      hitungSemua();
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
    }
  }

  /* ================= CARI SPK ================= */
  function cariSPK() {
    const no = (el.inputSPK.value || "").trim();

    if (!no) {
      el.inputSPK.classList.add("error");
      setTimeout(() => el.inputSPK.classList.remove("error"), 1200);
      beepGagal();
      getar([80, 40, 80]);
      tampilGagalSPK("(kosong)");
      return;
    }

    const found = state.masterSPK.find(
      (row) => String(row.noSPK || "").trim() === no
    );

    if (!found) {
      el.inputSPK.classList.add("error");
      setTimeout(() => el.inputSPK.classList.remove("error"), 1200);
      beepGagal();
      getar([80, 40, 80]);
      tampilGagalSPK(no);
      return;
    }

    el.inputSPK.classList.remove("error");
    state.spkAktif = found;
    beepSukses();
    getar(40);
    tampilSuksesSPK(found);
  }

  function tampilSuksesSPK(spk) {
    el.cardHasilSPK.classList.remove("hidden", "gagal");
    el.cardHasilSPK.classList.add("sukses");

    const tebal = (spk.tebal === undefined || spk.tebal === null) ? "" : String(spk.tebal);
    const lebar = (spk.lebar === undefined || spk.lebar === null) ? "" : String(spk.lebar);
    const lipat = (spk.lipat === undefined || spk.lipat === null) ? "" : String(spk.lipat).trim();
    const bd    = (spk.bd === undefined || spk.bd === null) ? "" : String(spk.bd);
    const jenis = (spk.jenis === undefined || spk.jenis === null) ? "—" : String(spk.jenis);

    const lipatNum = parseAngka(lipat);
    const adaLipat = lipat !== "" && isFinite(lipatNum) && lipatNum > 0;

    let dimensi;
    if (adaLipat) {
      dimensi = escapeHtml(tebal) + " X " + escapeHtml(lebar) + "/" + escapeHtml(lipat);
    } else {
      dimensi = escapeHtml(tebal) + " X " + escapeHtml(lebar);
    }

    const html =
      '<div class="spk-baris1">SPK <b>' + escapeHtml(spk.noSPK || "") + '</b></div>' +
      '<div class="spk-jenis">' + escapeHtml(jenis) + '</div>' +
      '<div class="spk-tebal-lebar">' +
        '<span class="spk-dimensi">' + dimensi + '</span>' +
        '<span class="spk-bd">BD ' + escapeHtml(bd) + '</span>' +
      '</div>';

    el.infoSPK.innerHTML = html;
  }

  function tampilGagalSPK(no) {
    el.cardHasilSPK.classList.remove("hidden", "sukses");
    el.cardHasilSPK.classList.add("gagal");

    const html =
      '<div class="spk-baris1">SPK <b>' + escapeHtml(no) + '</b></div>' +
      '<div class="spk-gagal">SPK tidak ditemukan</div>';

    el.infoSPK.innerHTML = html;
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

    state.startTime = Date.now();
    state.elapsedMs = 0;
    state.running = true;

    el.btnStopwatch.textContent = "Stop";
    el.btnStopwatch.classList.remove("btn-green");
    el.btnStopwatch.classList.add("btn-red");

    beepMulai();
    getar(30);

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

    if (state.durasiFinalMs > 0 && state.durasiFinalMs < CONFIG.DURASI_MIN_PERINGATAN * 1000) {
      el.warningDurasi.classList.remove("hidden");
    } else {
      el.warningDurasi.classList.add("hidden");
    }

    beepStop();
    getar(30);

    hitungSemua();
  }

  function tick() {
    if (!state.running) return;
    state.elapsedMs = Date.now() - state.startTime;
    el.stopwatchDisplay.textContent = formatDurasi(state.elapsedMs);
  }

  /* ================= HITUNG ================= */
  function hitungSemua() {
    const spk = state.spkAktif;
    const panjangSPK = parseAngka(el.inputPanjangSPK.value);
    const settingan = parseAngka(el.inputSettinganCounter.value);
    const cAwal = parseAngka(el.inputCounterAwal.value);
    const cAkhir = parseAngka(el.inputCounterAkhir.value);
    const durasiMs = state.durasiFinalMs;

    setOutput("—", "—", "—");

    if (!spk) return;
    if (!isFinite(durasiMs) || durasiMs <= 0) return;
    if (!isFinite(panjangSPK) || panjangSPK <= 0) return;
    if (!isFinite(settingan) || settingan <= 0) return;
    if (!isFinite(cAwal) || !isFinite(cAkhir)) return;

    if (cAkhir < cAwal) {
      el.inputCounterAkhir.classList.add("error");
      return;
    } else {
      el.inputCounterAkhir.classList.remove("error");
    }

    const tebal = parseAngka(spk.tebal);
    const lebar = parseAngka(spk.lebar);
    const bd = parseAngka(spk.bd);

    if (!isFinite(tebal) || !isFinite(lebar) || !isFinite(bd)) return;

    const deltaCounter = cAkhir - cAwal;
    const panjangProduksi = (deltaCounter / settingan) * panjangSPK;
    const berat = (tebal * lebar * panjangProduksi * bd) / CONFIG.KONSTANTA_BERAT;
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
    if (state.running) {
      stopStopwatch();
    }

    state.spkAktif = null;
    state.timerId = null;
    state.running = false;
    state.startTime = 0;
    state.elapsedMs = 0;
    state.durasiFinalMs = 0;

    el.inputSPK.value = "";
    el.inputPanjangSPK.value = "";
    el.inputSettinganCounter.value = "";
    el.inputCounterAwal.value = "";
    el.inputCounterAkhir.value = "";

    el.inputSPK.classList.remove("error");
    el.inputCounterAkhir.classList.remove("error");

    el.stopwatchDisplay.textContent = "00:00:00,00";
    el.btnStopwatch.textContent = "Mulai";
    el.btnStopwatch.classList.remove("btn-red");
    el.btnStopwatch.classList.add("btn-green");
    el.warningDurasi.classList.add("hidden");

    el.cardHasilSPK.classList.add("hidden");
    el.cardHasilSPK.classList.remove("sukses", "gagal");
    el.infoSPK.innerHTML = "";

    setOutput("—", "—", "—");

    tutupOverlayReset();

    beepReset();
    getar([40, 60, 40]);
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

  /* ================= INIT TAHUN ================= */
  function setTahunFooter() {
    if (el.tahunFooter) {
      el.tahunFooter.textContent = String(new Date().getFullYear());
    }
  }

  /* ================= EVENT BINDING ================= */
  function bindEvents() {
    el.btnCariSPK.addEventListener("click", cariSPK);
    el.inputSPK.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        cariSPK();
      }
    });

    el.btnScan.addEventListener("click", bukaScanner);
    el.btnTutupScanner.addEventListener("click", tutupScanner);

    el.btnTutupInfoSPK.addEventListener("click", tutupInfoSPK);

    el.btnStopwatch.addEventListener("click", toggleStopwatch);

    pasangFormatterRibuan(el.inputPanjangSPK);
    pasangFormatterRibuan(el.inputSettinganCounter);
    pasangFormatterRibuan(el.inputCounterAwal);
    pasangFormatterRibuan(el.inputCounterAkhir);

    el.btnResetAll.addEventListener("click", bukaOverlayReset);
    el.btnTutupReset.addEventListener("click", tutupOverlayReset);
    el.btnBatalReset.addEventListener("click", tutupOverlayReset);
    el.btnKonfirmasiReset.addEventListener("click", resetAll);

    window.addEventListener("touchmove", function () {}, { passive: true });
  }

  /* ================= INIT ================= */
  function init() {
    cacheElements();
    setTahunFooter();
    bindEvents();
    loadMasterSPK();
    el.stopwatchDisplay.textContent = formatDurasi(0);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
