/* =========================================================
   scanner.js — Quick Count Extruder Capacity
   Logic kamera (html5-qrcode v2.3.8) + bunyi sukses scan.
   ========================================================= */

const Scanner = (function () {
  let qrScanner = null;
  let isScanning = false;
  let audioCtx = null;

  /* ---------- AUDIO ---------- */
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

  /**
   * Bunyi sukses scan: square 1200 → 1800 Hz.
   */
  function beepSuksesScan() {
    const ctx = getAudioCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.linearRampToValueAtTime(1800, now + 0.12);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.4, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  /* ---------- SCANNER ---------- */
  /**
   * Mulai scanner kamera.
   * @param {string} elementId - id div target untuk video
   * @param {function} onSuccess - callback(decodedText)
   * @param {function} onError - callback(errorMessage) opsional
   */
  function start(elementId, onSuccess, onError) {
    if (isScanning) return;

    const target = document.getElementById(elementId);
    if (!target) {
      if (onError) onError("Elemen scanner tidak ditemukan.");
      return;
    }

    if (qrScanner) {
      stop();
    }

    qrScanner = new Html5Qrcode(elementId, {
      verbose: false
    });

    const config = {
      fps: CONFIG.SCANNER.FPS,
      qrbox: CONFIG.SCANNER.QRBOX,
      aspectRatio: CONFIG.SCANNER.ASPECT_RATIO,
      disableFlip: CONFIG.SCANNER.DISABLE_FLASH
    };

    qrScanner
      .start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          beepSuksesScan();
          if (onSuccess) onSuccess(decodedText);
          stop();
        },
        () => {
          // Error per-frame (tidak perlu ditampilkan)
        }
      )
      .then(() => {
        isScanning = true;
      })
      .catch((err) => {
        isScanning = false;
        if (onError) onError("Gagal membuka kamera: " + err);
      });
  }

  function stop() {
    if (!qrScanner) {
      isScanning = false;
      return;
    }

    const instance = qrScanner;
    qrScanner = null;
    isScanning = false;

    instance
      .stop()
      .then(() => {
        instance.clear();
      })
      .catch(() => {
        try { instance.clear(); } catch (e) {}
      });
  }

  function isActive() {
    return isScanning;
  }

  return { start, stop, isActive };
})();
