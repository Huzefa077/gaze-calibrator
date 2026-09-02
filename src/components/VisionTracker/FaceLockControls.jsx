function FaceLockControls({ isAutoSelectEnabled, isTrackerReady, onStart, onToggleAutoSelect }) {
  return (
    <div className="visage-face-lock-actions visage-face-lock-actions-centered">
      <button
        className="visage-start-calibration-button"
        onClick={onStart}
        disabled={!isTrackerReady}
        type="button"
      >
        {isTrackerReady ? 'Start Calibration' : 'Starting camera...'}
      </button>
      <button
        className={isAutoSelectEnabled
          ? 'visage-auto-select-button visage-auto-select-button-active visage-face-lock-auto-select'
          : 'visage-auto-select-button visage-face-lock-auto-select'}
        onClick={onToggleAutoSelect}
        type="button"
        aria-pressed={isAutoSelectEnabled}
      >
        Auto select {isAutoSelectEnabled ? 'On' : 'Off'}
      </button>
    </div>
  )
}

export default FaceLockControls
