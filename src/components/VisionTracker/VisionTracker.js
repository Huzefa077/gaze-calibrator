import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import CalibrationTipsPanel from './CalibrationTipsPanel';
import CalibrationGuidance from './CalibrationGuidance';
import ConsentPanel from './ConsentPanel';
import FaceLockControls from './FaceLockControls';
import RefinementPrompt from './RefinementPrompt';
import TrackerSideMenu from './TrackerSideMenu';
import { recordCalibrationPoint, startWebGazer, stopWebGazer } from '../../services/gazeTracking';
import './VisionTracker.css';

const BASELINE_TRAINING_POINTS = 25;
const EXTRA_REFINEMENT_POINTS = 15;
const LIVE_TRACKING_START_CLICK = BASELINE_TRAINING_POINTS;
const BASELINE_GRID_SIZE = 5;
const BASELINE_GRID_START = 8;
const BASELINE_GRID_STEP = 84 / (BASELINE_GRID_SIZE - 1);
const GAZE_NOISE_DEAD_ZONE = 7;
// The hold is deliberately long enough to collect several eye samples while the
// user keeps looking at the same target. See startInputCooldown for why one
// sample at click time was not reliable enough.
const CALIBRATION_INPUT_COOLDOWN_MS = 800;
const CALIBRATION_SAMPLE_INTERVAL_MS = 100;
const AUTO_SELECT_DELAY_MS = 1000;
const AUTO_SELECT_TICK_MS = 80;
const FIRST_DOT_DELAY_MS = 5000;
const REFINEMENT_FIRST_DOT_DELAY_MS = 2000;
const TRACKER_PHASES = {
  // The ordinary home card. No camera or WebGazer session is active yet.
  CONSENT: 'CONSENT',
  // Camera/WebGazer are running, but the user is still positioning their face.
  // Closing the tips and pressing Start Calibration moves to CALIBRATION.
  FACE_LOCK: 'FACE_LOCK',
  // One phase owns baseline calibration, optional refinement, and live output.
  // clickCount/trainingGoal decide which part of that flow is currently shown.
  CALIBRATION: 'CALIBRATION'
};

function createRefinementPoints(count) {
  return Array.from({ length: count }, () => ({
    x: 10 + Math.random() * 80,
    y: 10 + Math.random() * 80
  }));
}

function shufflePoints(points) {
  const shuffledPoints = [...points];

  for (let index = shuffledPoints.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffledPoints[index], shuffledPoints[randomIndex]] = [shuffledPoints[randomIndex], shuffledPoints[index]];
  }

  return shuffledPoints;
}

function getNearestCenterPointIndex(points) {
  return points.reduce((nearestIndex, point, index) => {
    const currentDistance = Math.hypot(point.x - 50, point.y - 50);
    const nearestDistance = Math.hypot(points[nearestIndex].x - 50, points[nearestIndex].y - 50);

    return currentDistance < nearestDistance ? index : nearestIndex;
  }, 0);
}

function createTrainingPoints() {
  const points = [];

  for (let row = 0; row < BASELINE_GRID_SIZE; row += 1) {
    for (let column = 0; column < BASELINE_GRID_SIZE; column += 1) {
      points.push({
        x: BASELINE_GRID_START + column * BASELINE_GRID_STEP,
        y: BASELINE_GRID_START + row * BASELINE_GRID_STEP
      });
    }
  }

  const centerPointIndex = getNearestCenterPointIndex(points);
  const centerPoint = points[centerPointIndex];
  const randomizedBaselinePoints = shufflePoints(points.filter((_, index) => index !== centerPointIndex));

  return [
    centerPoint,
    ...randomizedBaselinePoints
  ];
}

const VisionTracker = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [trainingPoints, setTrainingPoints] = useState(createTrainingPoints);
  const [trainingGoal, setTrainingGoal] = useState(BASELINE_TRAINING_POINTS);
  const [clickCount, setClickCount] = useState(0);
  const [trackerPhase, setTrackerPhase] = useState(TRACKER_PHASES.CONSENT);
  const [isTrackerReady, setIsTrackerReady] = useState(false);
  const [isStartingTracker, setIsStartingTracker] = useState(false);
  const [isDarkeningCalibration, setIsDarkeningCalibration] = useState(false);
  const [showCalibrationInputHint, setShowCalibrationInputHint] = useState(false);
  const [showFaceLockTips, setShowFaceLockTips] = useState(true);
  const [cooldownRemainingMs, setCooldownRemainingMs] = useState(0);
  const [isAutoSelectEnabled, setIsAutoSelectEnabled] = useState(false);
  const [autoSelectRemainingMs, setAutoSelectRemainingMs] = useState(0);
  const [showRefinementPrompt, setShowRefinementPrompt] = useState(false);
  const [refinementDecision, setRefinementDecision] = useState('pending');
  const [isFirstDotDelayActive, setIsFirstDotDelayActive] = useState(false);
  const [isTrackerMenuOpen, setIsTrackerMenuOpen] = useState(false);
  const [error, setError] = useState('');
  const [, setCameraPermissionStatus] = useState('unknown');
  const [gazePoint, setGazePoint] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

  // Holds the currently rendered <video>, so a preserved stream can be attached
  // again when switching between phase-specific markup.
  const videoRef = useRef(null);
  // Keeps the browser MediaStream outside React rendering. Losing this reference
  // would make it impossible to stop every camera track during cleanup.
  const streamRef = useRef(null);
  // The following state mirrors let timers and global keyboard handlers read the
  // latest values without capturing an old render in their closures.
  const trackerPhaseRef = useRef(TRACKER_PHASES.CONSENT);
  const isTrackerReadyRef = useRef(false);
  const trainingPointsRef = useRef(trainingPoints);
  const trainingGoalRef = useRef(trainingGoal);
  const clickCountRef = useRef(clickCount);
  // Stores the last filtered gaze coordinate. State alone could be stale between
  // WebGazer callbacks, which would make smoothing jump or lag.
  const smoothedPointRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  // Timeout that ends the dimmed calibration hold and advances to the next dot.
  const inputCooldownTimerRef = useRef(null);
  // Interval that updates the small visible countdown during that hold.
  const inputCooldownIntervalRef = useRef(null);
  // Separate interval that records repeated WebGazer samples during the hold.
  const calibrationSampleIntervalRef = useRef(null);
  // Becomes false before teardown. Async callbacks check it so they cannot update
  // state or record samples after Exit/unmount has started.
  const isTrackerActiveRef = useRef(true);
  // Synchronous lock against double clicks/auto-select while React state catches up.
  const isInputCoolingDownRef = useRef(false);
  // Owns the five-second beginner instruction so it can be cancelled on exit/reset.
  const calibrationInputHintTimerRef = useRef(null);
  // Auto-select uses one timeout to select and one interval to display remaining time.
  const autoSelectTimerRef = useRef(null);
  const autoSelectIntervalRef = useRef(null);
  // Keyboard callbacks need the current prompt state without reinstalling listeners.
  const showRefinementPromptRef = useRef(false);
  // Owns the pause before the first baseline/refinement dot becomes actionable.
  const firstDotDelayTimerRef = useRef(null);
  const isFirstDotDelayActiveRef = useRef(false);
  // Remembers where routing came from so arriving at / only exits a real session.
  const previousPathnameRef = useRef(location.pathname);

  // Keep the phase mirror current for WebGazer, keyboard, and timer callbacks.
  useEffect(() => {
    trackerPhaseRef.current = trackerPhase;
  }, [trackerPhase]);

  // Update all remaining mirrors together. These dependencies are exactly the
  // state values copied into refs; changing any one must refresh its mirror.
  useEffect(() => {
    trainingPointsRef.current = trainingPoints;
    trainingGoalRef.current = trainingGoal;
    clickCountRef.current = clickCount;
    isTrackerReadyRef.current = isTrackerReady;
    showRefinementPromptRef.current = showRefinementPrompt;
    isFirstDotDelayActiveRef.current = isFirstDotDelayActive;
  }, [trainingPoints, trainingGoal, clickCount, isTrackerReady, showRefinementPrompt, isFirstDotDelayActive]);

  // Phase changes replace parts of the portal, including <video>. Reattach the
  // existing MediaStream instead of requesting permission or starting a new camera.
  useEffect(() => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [trackerPhase]);

  // Read permission only for status/error handling. An empty dependency array is
  // intentional: registering permission.onchange more than once would leak handlers.
  useEffect(() => {
    const readCameraPermission = async () => {
      if (!navigator.permissions?.query) return;

      try {
        const permission = await navigator.permissions.query({ name: 'camera' });
        setCameraPermissionStatus(permission.state);
        permission.onchange = () => setCameraPermissionStatus(permission.state);
      } catch {
        setCameraPermissionStatus('browser controlled');
      }
    };

    readCameraPermission();
  }, []);

  const stopLocalStream = () => {
    streamRef.current?.getTracks?.().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const clearInputCooldown = () => {
    isInputCoolingDownRef.current = false;
    setCooldownRemainingMs(0);

    if (inputCooldownTimerRef.current) {
      clearTimeout(inputCooldownTimerRef.current);
      inputCooldownTimerRef.current = null;
    }

    if (inputCooldownIntervalRef.current) {
      clearInterval(inputCooldownIntervalRef.current);
      inputCooldownIntervalRef.current = null;
    }

    if (calibrationSampleIntervalRef.current) {
      clearInterval(calibrationSampleIntervalRef.current);
      calibrationSampleIntervalRef.current = null;
    }
  };

  const clearCalibrationInputHint = () => {
    if (calibrationInputHintTimerRef.current) {
      clearTimeout(calibrationInputHintTimerRef.current);
      calibrationInputHintTimerRef.current = null;
    }

    setShowCalibrationInputHint(false);
  };

  const clearAutoSelectTimer = () => {
    setAutoSelectRemainingMs(0);

    if (autoSelectTimerRef.current) {
      clearTimeout(autoSelectTimerRef.current);
      autoSelectTimerRef.current = null;
    }

    if (autoSelectIntervalRef.current) {
      clearInterval(autoSelectIntervalRef.current);
      autoSelectIntervalRef.current = null;
    }
  };

  const clearFirstDotDelay = () => {
    if (firstDotDelayTimerRef.current) {
      clearTimeout(firstDotDelayTimerRef.current);
      firstDotDelayTimerRef.current = null;
    }

    isFirstDotDelayActiveRef.current = false;
    setIsFirstDotDelayActive(false);
  };

  const startFirstDotDelay = (delayMs = FIRST_DOT_DELAY_MS) => {
    clearFirstDotDelay();

    isFirstDotDelayActiveRef.current = true;
    setIsFirstDotDelayActive(true);

    firstDotDelayTimerRef.current = setTimeout(() => {
      firstDotDelayTimerRef.current = null;
      isFirstDotDelayActiveRef.current = false;
      setIsFirstDotDelayActive(false);
    }, delayMs);
  };

  const startCalibrationInputHint = () => {
    clearCalibrationInputHint();
    setShowCalibrationInputHint(true);

    calibrationInputHintTimerRef.current = setTimeout(() => {
      setShowCalibrationInputHint(false);
      calibrationInputHintTimerRef.current = null;
    }, 4800);
  };

  const hasUsableWebGazerDetection = () => {
    const webgazer = window.webgazer;
    if (!webgazer) return false;

    const tracker = webgazer.getTracker?.();

    try {
      if (tracker && typeof tracker.getCurrentPosition === 'function') {
        const currentPosition = tracker.getCurrentPosition();
        return Array.isArray(currentPosition) && currentPosition.length > 0;
      }

      if (tracker && typeof tracker.getCurrentPrediction === 'function') {
        const trackerPrediction = tracker.getCurrentPrediction();
        return Array.isArray(trackerPrediction) && trackerPrediction.length > 0;
      }
    } catch {
      return false;
    }

    // This WebGazer build does not always expose a face-validity API. In that
    // case, do not block calibration samples on an unavailable signal.
    return true;
  };

  const startInputCooldown = (onHoldComplete, onHoldSample) => {
    clearInputCooldown();

    const cooldownStartedAt = Date.now();
    isInputCoolingDownRef.current = true;
    setCooldownRemainingMs(CALIBRATION_INPUT_COOLDOWN_MS);

    // Originally a dot click recorded only one sample. That sample could represent
    // an eye movement or blink at the instant of clicking, producing unstable
    // calibration. Keep the target fixed/dimmed and collect several samples across
    // the hold so WebGazer learns from the user's settled gaze instead.
    onHoldSample?.();
    calibrationSampleIntervalRef.current = setInterval(() => {
      if (Date.now() - cooldownStartedAt >= CALIBRATION_INPUT_COOLDOWN_MS) return;

      onHoldSample?.();
    }, CALIBRATION_SAMPLE_INTERVAL_MS);

    inputCooldownIntervalRef.current = setInterval(() => {
      const remaining = Math.max(0, CALIBRATION_INPUT_COOLDOWN_MS - (Date.now() - cooldownStartedAt));
      setCooldownRemainingMs(remaining);
    }, 80);

    inputCooldownTimerRef.current = setTimeout(() => {
      if (!isTrackerActiveRef.current) return;

      clearInputCooldown();
      onHoldComplete?.();
    }, CALIBRATION_INPUT_COOLDOWN_MS);
  };

  const cleanup = () => {
    // cleanup can be reached by Exit, routing, startup failure, and unmount. The
    // active flag makes the operation idempotent and blocks late timer callbacks.
    if (!isTrackerActiveRef.current) return;

    isTrackerActiveRef.current = false;
    clearCalibrationInputHint();
    clearInputCooldown();
    clearAutoSelectTimer();
    clearFirstDotDelay();
    stopLocalStream();
    stopWebGazer();

    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => { });
    }
  };

  const resetCalibration = () => {
    // Reset is a new baseline round inside the same mounted tracker session.
    isTrackerActiveRef.current = true;
    clearInputCooldown();
    clearAutoSelectTimer();
    clearFirstDotDelay();
    startCalibrationInputHint();
    window.webgazer?.clearData?.();
    setTrainingPoints(createTrainingPoints());
    setTrainingGoal(BASELINE_TRAINING_POINTS);
    setClickCount(0);
    setShowRefinementPrompt(false);
    setRefinementDecision('pending');
    setIsTrackerMenuOpen(false);
    setTrackerPhase(TRACKER_PHASES.CALIBRATION);
    setIsDarkeningCalibration(false);
    startFirstDotDelay();
    smoothedPointRef.current = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    setGazePoint(smoothedPointRef.current);
  };

  const handleGazeUpdate = (data) => {
    // WebGazer can emit noisy points many times per second. Ignore tiny movements,
    // then smooth larger ones before React renders the live gaze dot.
    if (!data || trackerPhaseRef.current !== TRACKER_PHASES.CALIBRATION) return;

    const previous = smoothedPointRef.current;
    const deltaX = data.x - previous.x;
    const deltaY = data.y - previous.y;
    const movementDistance = Math.hypot(deltaX, deltaY);

    if (movementDistance < GAZE_NOISE_DEAD_ZONE) return;

    const smoothingFactor = movementDistance > 160 ? 0.88 : 0.48;
    const nextPoint = {
      x: previous.x + deltaX * smoothingFactor,
      y: previous.y + deltaY * smoothingFactor
    };

    smoothedPointRef.current = nextPoint;
    setGazePoint(nextPoint);
  };

  const startTrackerWithConsent = async () => {
    isTrackerActiveRef.current = true;
    setIsStartingTracker(true);
    setError('');

    try {
      await document.documentElement.requestFullscreen?.().catch(() => { });
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      setCameraPermissionStatus('granted');

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      await startWebGazer(handleGazeUpdate);

      setShowFaceLockTips(true);
      setIsTrackerReady(true);
      setTrackerPhase(TRACKER_PHASES.FACE_LOCK);
      navigate('/calibration');
    } catch {
      setCameraPermissionStatus('denied');
      setError('Fullscreen and camera permission are required for Gaze Tracker.');
      cleanup();
    } finally {
      setIsStartingTracker(false);
    }
  };

  // Install keyboard shortcuts once for the lifetime of this component. The handler
  // deliberately reads refs, so adding changing tracker state as dependencies would
  // repeatedly remove/re-add the listener. Its cleanup also performs the final,
  // idempotent camera/WebGazer teardown when the component unmounts.
  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;

    const handleKeyDown = (event) => {
      if (event.code === 'Space' && trackerPhaseRef.current !== TRACKER_PHASES.CONSENT) {
        event.preventDefault();
        if (showRefinementPromptRef.current) return;
        resetCalibration();
      }

      if (event.key.toLowerCase() === 'b') {
        event.preventDefault();
        recordCurrentTrainingPoint();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      cleanup();
    };
  }, []);

  // Active tracker screens must not scroll behind the fullscreen portal. Depending
  // on trackerPhase restores scrolling both when returning to consent and on unmount.
  useEffect(() => {
    if (trackerPhase === TRACKER_PHASES.CONSENT) return undefined;

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [trackerPhase]);

  const recordCurrentTrainingPoint = (targetElement) => {
    // Guard every entry path (mouse, keyboard, or auto-select) synchronously. Using
    // refs here prevents two rapid inputs from both seeing an old React render.
    if (!isTrackerReadyRef.current || trackerPhaseRef.current !== TRACKER_PHASES.CALIBRATION) return;
    if (clickCountRef.current >= trainingGoalRef.current) return;
    if (isInputCoolingDownRef.current) return;
    if (isFirstDotDelayActiveRef.current) return;
    clearAutoSelectTimer();

    const pointIndex = Math.min(clickCountRef.current, trainingPointsRef.current.length - 1);
    const point = trainingPointsRef.current[pointIndex];
    if (!point) return;

    const targetBounds = targetElement?.getBoundingClientRect?.();
    const targetCenterX = targetBounds ? targetBounds.left + targetBounds.width / 2 : window.innerWidth * (point.x / 100);
    const targetCenterY = targetBounds ? targetBounds.top + targetBounds.height / 2 : window.innerHeight * (point.y / 100);

    const nextCount = Math.min(clickCountRef.current + 1, trainingGoalRef.current);

    if (nextCount >= trainingGoalRef.current) {
      recordCalibrationPoint(targetCenterX, targetCenterY);
      setClickCount(nextCount);
      return;
    }

    const sampleCurrentPoint = () => {
      if (!isTrackerActiveRef.current) return;
      if (!isTrackerReadyRef.current || trackerPhaseRef.current !== TRACKER_PHASES.CALIBRATION) return;
      if (!hasUsableWebGazerDetection()) return;

      recordCalibrationPoint(targetCenterX, targetCenterY);
    };

    startInputCooldown(() => {
      setClickCount((count) => Math.min(count + 1, trainingGoalRef.current));
    }, sampleCurrentPoint);
  };

  const handleTargetClick = (event) => {
    event.preventDefault();
    recordCurrentTrainingPoint(event.currentTarget);
  };

  const toggleAutoSelect = () => {
    setIsAutoSelectEnabled((enabled) => {
      if (enabled) {
        clearAutoSelectTimer();
      }

      return !enabled;
    });
  };

  const handleExit = () => {
    cleanup();
    setTrackerPhase(TRACKER_PHASES.CONSENT);
    setIsTrackerReady(false);
    setIsStartingTracker(false);
    setIsDarkeningCalibration(false);
    setShowFaceLockTips(true);
    setTrainingPoints(createTrainingPoints());
    setTrainingGoal(BASELINE_TRAINING_POINTS);
    setClickCount(0);
    setCooldownRemainingMs(0);
    setShowRefinementPrompt(false);
    setRefinementDecision('pending');
    clearFirstDotDelay();
    setIsTrackerMenuOpen(false);
    navigate('/');
  };

  const startCalibrationPhase = () => {
    if (!isTrackerReady) return;
    isTrackerActiveRef.current = true;
    clearInputCooldown();
    clearAutoSelectTimer();
    clearFirstDotDelay();
    startCalibrationInputHint();
    window.webgazer?.clearData?.();
    setClickCount(0);
    setTrainingGoal(BASELINE_TRAINING_POINTS);
    setTrainingPoints(createTrainingPoints());
    setTrackerPhase(TRACKER_PHASES.CALIBRATION);
    setIsDarkeningCalibration(true);
    setShowFaceLockTips(false);
    setShowRefinementPrompt(false);
    setRefinementDecision('pending');
    setIsTrackerMenuOpen(false);
    startFirstDotDelay();
    navigate('/calibration');
  };

  const startRefinementRound = () => {
    // Refinement extends the existing trained session; it does not clear WebGazer.
    // Its 15 random points are appended and trainingGoal becomes 40.
    if (trainingGoalRef.current > BASELINE_TRAINING_POINTS || refinementDecision === 'accepted') {
      setShowRefinementPrompt(false);
      return;
    }

    clearAutoSelectTimer();
    clearFirstDotDelay();
    setTrainingPoints((points) => [...points, ...createRefinementPoints(EXTRA_REFINEMENT_POINTS)]);
    setTrainingGoal(BASELINE_TRAINING_POINTS + EXTRA_REFINEMENT_POINTS);
    setShowRefinementPrompt(false);
    setRefinementDecision('accepted');
    setIsTrackerMenuOpen(false);
    setTrackerPhase(TRACKER_PHASES.CALIBRATION);
    clearCalibrationInputHint();
    startFirstDotDelay(REFINEMENT_FIRST_DOT_DELAY_MS);
    navigate('/calibration');
  };

  const skipRefinementRound = () => {
    clearAutoSelectTimer();
    setShowRefinementPrompt(false);
    setRefinementDecision('skipped');
    setIsTrackerMenuOpen(false);
  };

  const openTipsFromMenu = () => {
    setShowFaceLockTips(true);
    setIsTrackerMenuOpen(false);
  };

  const openRefinementPromptFromMenu = () => {
    setShowRefinementPrompt(true);
    setIsTrackerMenuOpen(false);
  };

  // Route-based exit safeguard: only a transition *back* to / from another tracker
  // path ends an active session. The dependency is pathname alone on purpose. If
  // trackerPhase were included, entering FACE_LOCK could rerun this while still on
  // / and immediately shut the newly opened camera off (the earlier exit bug).
  useEffect(() => {
    const previousPathname = previousPathnameRef.current;
    previousPathnameRef.current = location.pathname;

    if (
      previousPathname !== '/' &&
      location.pathname === '/' &&
      trackerPhaseRef.current !== TRACKER_PHASES.CONSENT
    ) {
      handleExit();
    }
  }, [location.pathname]);

  const activePoint = trainingPoints[Math.min(clickCount, trainingGoal - 1)];
  const shouldShowTrainingDot =
    isTrackerReady &&
    trackerPhase === TRACKER_PHASES.CALIBRATION &&
    clickCount < trainingGoal &&
    !showRefinementPrompt &&
    !showFaceLockTips &&
    !isFirstDotDelayActive;
  const shouldShowGazeDot = isTrackerReady && trackerPhase === TRACKER_PHASES.CALIBRATION && clickCount >= LIVE_TRACKING_START_CLICK;
  const isFaceLockPhase = trackerPhase === TRACKER_PHASES.FACE_LOCK;
  const isConsentPhase = trackerPhase === TRACKER_PHASES.CONSENT;
  const calibrationProgressCurrent = clickCount < BASELINE_TRAINING_POINTS
    ? Math.min(clickCount, BASELINE_TRAINING_POINTS)
    : Math.min(Math.max(0, clickCount - BASELINE_TRAINING_POINTS), EXTRA_REFINEMENT_POINTS);
  const calibrationProgressGoal = clickCount < BASELINE_TRAINING_POINTS ? BASELINE_TRAINING_POINTS : EXTRA_REFINEMENT_POINTS;
  const isTrainingComplete = clickCount >= trainingGoal;
  const isInputCoolingDown = cooldownRemainingMs > 0;
  const shouldShowRefinementOption =
    trackerPhase === TRACKER_PHASES.CALIBRATION &&
    clickCount >= BASELINE_TRAINING_POINTS;
  const shouldGuideRefinement =
    shouldShowRefinementOption &&
    trainingGoal === BASELINE_TRAINING_POINTS &&
    refinementDecision === 'pending' &&
    !showRefinementPrompt;
  const shouldShowCalibrationInputHint = showCalibrationInputHint && trackerPhase === TRACKER_PHASES.CALIBRATION && !isTrainingComplete;
  const screenClassName = [
    isFaceLockPhase ? 'visage-calibration-screen visage-face-lock-screen' : 'visage-calibration-screen',
    isDarkeningCalibration ? 'visage-dark-calibration' : ''
  ].filter(Boolean).join(' ');

  // Restart auto-select whenever the active dot or its eligibility changes. Cleanup
  // cancels both clocks, preventing a timer for the previous dot from selecting the
  // next dot. Every dependency can change whether/which target may be selected.
  useEffect(() => {
    clearAutoSelectTimer();

    if (!isAutoSelectEnabled || !shouldShowTrainingDot || isInputCoolingDown || !activePoint) {
      return undefined;
    }

    const autoSelectStartedAt = Date.now();
    setAutoSelectRemainingMs(AUTO_SELECT_DELAY_MS);

    autoSelectIntervalRef.current = setInterval(() => {
      const remaining = Math.max(0, AUTO_SELECT_DELAY_MS - (Date.now() - autoSelectStartedAt));
      setAutoSelectRemainingMs(remaining);
    }, AUTO_SELECT_TICK_MS);

    autoSelectTimerRef.current = setTimeout(() => {
      clearAutoSelectTimer();
      recordCurrentTrainingPoint();
    }, AUTO_SELECT_DELAY_MS);

    return clearAutoSelectTimer;
  }, [isAutoSelectEnabled, shouldShowTrainingDot, isInputCoolingDown, clickCount, activePoint]);

  // Finishing the baseline changes the URL to the live tracking view, but leaves the
  // optional refinement decision pending. The prompt is intentionally not opened;
  // the menu animation guides the user to request it. Dependencies describe every
  // value used to decide that the baseline has just finished.
  useEffect(() => {
    const shouldAskForRefinement =
      trackerPhase === TRACKER_PHASES.CALIBRATION &&
      clickCount >= BASELINE_TRAINING_POINTS &&
      trainingGoal === BASELINE_TRAINING_POINTS &&
      refinementDecision === 'pending';

    if (!shouldAskForRefinement) {
      return;
    }

    clearAutoSelectTimer();
    navigate('/tracking');
  }, [trackerPhase, clickCount, trainingGoal, refinementDecision]);

  // After the user skips refinement or completes the accepted extra round, ensure
  // the URL is /tracking. Including pathname avoids redundant navigation; navigate
  // is included because it is an external hook value used by this effect.
  useEffect(() => {
    const hasCompletedCurrentTraining =
      trackerPhase === TRACKER_PHASES.CALIBRATION &&
      clickCount >= trainingGoal &&
      refinementDecision !== 'pending';

    if (hasCompletedCurrentTraining && location.pathname !== '/tracking') {
      navigate('/tracking');
    }
  }, [trackerPhase, clickCount, trainingGoal, refinementDecision, location.pathname, navigate]);

  if (isConsentPhase) {
    return (
      <ConsentPanel
        error={error}
        isStartingTracker={isStartingTracker}
        onStart={startTrackerWithConsent}
      />
    );
  }

  return createPortal(
    <section className={screenClassName}>
      <video ref={videoRef} className={isFaceLockPhase ? 'visage-background-video visage-face-lock-video' : 'visage-background-video'} autoPlay muted playsInline />
      <div className={isFaceLockPhase ? 'visage-head-guide visage-head-guide-face-lock' : 'visage-head-guide'} aria-hidden="true"></div>

      {!isConsentPhase && (
        <TrackerSideMenu
          isOpen={isTrackerMenuOpen}
          isAutoSelectEnabled={isAutoSelectEnabled}
          showFaceLockTips={showFaceLockTips}
          showRefinementPrompt={showRefinementPrompt}
          shouldGuideRefinement={shouldGuideRefinement}
          shouldShowRefinementOption={shouldShowRefinementOption}
          onClose={() => setIsTrackerMenuOpen(false)}
          onExit={handleExit}
          onOpenRefinement={openRefinementPromptFromMenu}
          onOpenTips={openTipsFromMenu}
          onToggle={() => setIsTrackerMenuOpen((isOpen) => !isOpen)}
          onToggleAutoSelect={toggleAutoSelect}
        />
      )}

      {isFaceLockPhase && !showFaceLockTips && (
        <FaceLockControls
          isAutoSelectEnabled={isAutoSelectEnabled}
          isTrackerReady={isTrackerReady}
          onStart={startCalibrationPhase}
          onToggleAutoSelect={toggleAutoSelect}
        />
      )}

      <div className={isFaceLockPhase ? 'visage-copy visage-face-lock-copy' : 'visage-copy'}>
        {showFaceLockTips ? (
          <CalibrationTipsPanel onClose={() => setShowFaceLockTips(false)} />
        ) : isFaceLockPhase || isTrainingComplete ? null : (
          <CalibrationGuidance showInputHint={shouldShowCalibrationInputHint} />
        )}
        {error && <strong className="visage-error">{error}</strong>}
        {!error && isStartingTracker && <strong className="visage-loading">Starting camera...</strong>}
      </div>

      {showRefinementPrompt && (
        <RefinementPrompt
          refinementDecision={refinementDecision}
          onSkip={skipRefinementRound}
          onStart={startRefinementRound}
        />
      )}

      {shouldShowTrainingDot && (
        <>
          <span
            className="visage-training-progress"
            style={{ left: `${activePoint.x}%`, top: `${activePoint.y}%` }}
            aria-live="polite"
          >
            {calibrationProgressCurrent}/{calibrationProgressGoal}
          </span>
          <button
            className={isInputCoolingDown ? 'visage-training-dot visage-training-dot-cooling' : 'visage-training-dot'}
            onClick={handleTargetClick}
            disabled={isInputCoolingDown}
            style={{ left: `${activePoint.x}%`, top: `${activePoint.y}%` }}
            type="button"
            aria-label="Calibration point"
          ></button>
          {isAutoSelectEnabled && !isInputCoolingDown && autoSelectRemainingMs > 0 && (
            <span
              className="visage-auto-select-timer"
              style={{ left: `${activePoint.x}%`, top: `${activePoint.y}%` }}
              aria-hidden="true"
            >
              {(autoSelectRemainingMs / 1000).toFixed(1)}s
            </span>
          )}
        </>
      )}

      {shouldShowGazeDot && (
        <span
          className="visage-gaze-dot"
          style={{ transform: `translate(${gazePoint.x}px, ${gazePoint.y}px)` }}
          aria-hidden="true"
        ></span>
      )}
    </section>,
    document.body
  );
};

export default VisionTracker;
