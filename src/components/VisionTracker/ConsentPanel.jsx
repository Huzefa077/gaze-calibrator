function ConsentPanel({ error, isStartingTracker, onStart }) {
  return (
    <section className="vision-tracker-inline">
      <div className="visage-consent-panel">
        <h1>Gaze Tracker</h1>
        <ul className="visage-consent-points">
          <li><strong>Step 1:</strong> Start calibration</li>
          <li><strong>Step 2:</strong> Complete 25 blue-dot inputs</li>
          <li><strong>Step 3:</strong> Live gaze tracking starts</li>
        </ul>
        <p className="visage-consent-note">After calibration, you can visit the menu and select 'Refine' to improve accuracy.</p>
        {error && <strong className="visage-error">{error}</strong>}
        <button
          className="visage-start-calibration-button visage-consent-button"
          onClick={onStart}
          disabled={isStartingTracker}
          type="button"
        >
          {isStartingTracker ? 'Requesting permission...' : 'Enter Fullscreen & Start'}
        </button>
      </div>
    </section>
  )
}

export default ConsentPanel
