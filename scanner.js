/* =========================================================
   scanner.js — Quick Count Extruder Capacity
   Logic kamera (html5-qrcode v2.3.8)
   ========================================================= */

const Scanner = (function () {
  let qrScanner = null;
  let isScanning = false;

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

    // Bersihkan dulu jika ada instance lama
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
          // Sukses decode — hentikan scanner, kirim hasil
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

  /**
   * Hentikan scanner & bersihkan video.
   */
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
        // Abaikan error saat stop (kamera mungkin sudah mati)
        try { instance.clear(); } catch (e) {}
      });
  }

  function isActive() {
    return isScanning;
  }

  return { start, stop, isActive };
})();
