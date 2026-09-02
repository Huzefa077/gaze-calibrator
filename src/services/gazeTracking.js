// Cache the in-flight CDN request so multiple callers cannot append several
// WebGazer scripts. The running flag prevents duplicate teardown attempts.
let webGazerScriptPromise = null;
let isWebGazerRunning = false;
const WEBGAZER_SCRIPT_URL = 'https://cdn.jsdelivr.net/gh/jspsych/jsPsych@jspsych@7.0.0/examples/js/webgazer/webgazer.js';

// Returns WebGazer immediately when already loaded; otherwise injects the exact
// CDN script once and resolves only after window.webgazer becomes available.
export function loadWebGazer() {
  if (window.webgazer) {
    return Promise.resolve(window.webgazer);
  }

  if (!webGazerScriptPromise) {
    webGazerScriptPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector('script[data-webgazer="true"]');

      if (existingScript) {
        // During local hot reload, a previous failed script tag can remain in
        // the DOM. Remove it so the browser does not reuse a broken HTML response.
        existingScript.remove();
      }

      const script = document.createElement('script');
      script.src = WEBGAZER_SCRIPT_URL;
      script.type = 'text/javascript';
      script.async = true;
      script.dataset.webgazer = 'true';
      script.onload = () => {
        if (window.webgazer) {
          resolve(window.webgazer);
          return;
        }

        reject(new Error('WebGazer loaded, but did not initialize.'));
      };
      script.onerror = () => reject(new Error('Failed to load WebGazer.js'));
      document.body.appendChild(script);
    });
  }

  return webGazerScriptPromise;
}

// Loads and starts WebGazer, connects the supplied prediction callback, disables
// mouse-based training, and hides WebGazer's built-in preview UI. The returned
// promise resolves only after WebGazer has begun using the camera.
export async function startWebGazer(gazeListener) {
  const webgazer = await loadWebGazer();

  webgazer.clearData?.();
  webgazer.removeMouseEventListeners?.();

  // Ocula trains WebGazer only from explicit blue-dot inputs. The library's
  // automatic mouse listeners can make the gaze dot follow the cursor, so we
  // disable them and call recordScreenPosition ourselves during calibration.
  webgazer
    .setRegression('ridge')
    .setGazeListener(gazeListener);

  webgazer.showVideoPreview?.(false);
  webgazer.showPredictionPoints?.(false);
  webgazer.showFaceOverlay?.(false);
  webgazer.showFaceFeedbackBox?.(false);

  await webgazer.begin();
  isWebGazerRunning = true;
  webgazer.removeMouseEventListeners?.();
  hideWebGazerDom();
  return webgazer;
}

// Teaches WebGazer that the user's eyes were looking at this screen coordinate.
// It returns false when WebGazer is unavailable so callers can fail harmlessly.
export function recordCalibrationPoint(x, y) {
  const webgazer = window.webgazer;

  if (!webgazer?.recordScreenPosition) {
    return false;
  }

  // Explicitly train WebGazer on the target center. This is more stable than
  // relying only on the raw mouse click coordinate.
  webgazer.recordScreenPosition(x, y, 'click');
  return true;
}

// Stops prediction and camera resources owned by WebGazer, then removes the DOM
// elements it injects. Safe to call repeatedly: the running flag avoids ending
// the same instance twice. Some WebGazer builds remove a child internally twice,
// so their harmless NotFoundError is deliberately ignored during shutdown.
export function stopWebGazer() {
  const webgazer = window.webgazer;
  if (!webgazer || !isWebGazerRunning) {
    removeWebGazerDom();
    return;
  }

  isWebGazerRunning = false;

  try {
    webgazer.pause();
    webgazer.clearGazeListener();
    webgazer.end();
  } catch (error) {
    if (error?.name !== 'NotFoundError') {
      console.warn('WebGazer cleanup warning:', error);
    }
  }

  document.querySelectorAll('video').forEach((video) => {
    if (!video.id?.toLowerCase().includes('webgazer') && !video.className?.toString().toLowerCase().includes('webgazer')) return;

    video.srcObject?.getTracks?.().forEach((track) => track.stop());
  });

  removeWebGazerDom();
}

// Makes WebGazer's injected preview/overlay elements invisible while leaving
// them mounted; WebGazer may still expect those nodes during an active session.
export function hideWebGazerDom() {
  [
    'webgazerVideoFeed',
    'webgazerFaceOverlay',
    'webgazerFaceFeedbackBox',
    'webgazerVideoContainer'
  ].forEach((elementId) => {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.style.display = 'none';
    element.style.pointerEvents = 'none';
    element.style.opacity = '0';
  });
}

// Physically removes WebGazer's injected nodes after shutdown or as a fallback
// when no running instance exists.
export function removeWebGazerDom() {
  [
    'webgazerVideoFeed',
    'webgazerFaceOverlay',
    'webgazerFaceFeedbackBox',
    'webgazerVideoContainer'
  ].forEach((elementId) => {
    document.getElementById(elementId)?.remove();
  });
}
