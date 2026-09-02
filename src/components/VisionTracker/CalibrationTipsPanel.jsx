function CalibrationTipsPanel({ onClose }) {
  return (
    <aside className="visage-face-lock-panel">
      <div className="visage-face-lock-header">
        <p className="visage-face-lock-message">Calibration Tips</p>
        <button className="visage-tips-close-button" onClick={onClose} type="button">
          Close
        </button>
      </div>
      <ul className="visage-calibration-rules">
        <li>For best results, get close to the screen to fill the face oval completely from forehead to chin.</li>
        <li>Keep your head still; move your eyes only.</li>
        <li className="vision-desktop-tip">Press <span>B</span> for each blue dot, or turn on Auto select.</li>
        <li>Ensure steady front lighting; avoid glare on glasses or the webcam lens for best accuracy.</li>
        <li>Tracking starts after 25 dots. Extra points are optional.</li>
      </ul>
    </aside>
  )
}

export default CalibrationTipsPanel
