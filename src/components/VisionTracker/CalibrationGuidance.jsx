function CalibrationGuidance({ showInputHint }) {
  return (
    <>
      {showInputHint && (
        <span className="visage-input-choice-hint">
          <span className="visage-input-choice-line">Keep looking at the blue dot as it fades.</span>
          <small className="visage-input-choice-line">Keep your head still.</small>
        </span>
      )}
      <div className="visage-calibration-status visage-corner-counter">
        <strong className="visage-calibration-counter">Focus on the blue dot</strong>
      </div>
    </>
  )
}

export default CalibrationGuidance
