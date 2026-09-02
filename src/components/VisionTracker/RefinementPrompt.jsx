function RefinementPrompt({ refinementDecision, onSkip, onStart }) {
  const isRefinementActive = refinementDecision === 'accepted'

  return (
    <aside className="visage-refinement-prompt" aria-live="polite">
      <p className="visage-refinement-label">Optional</p>
      <h2>{isRefinementActive ? 'Refinement active' : 'Need more accuracy?'}</h2>
      <p>
        {isRefinementActive
          ? 'Complete the extra dots to finish the optional refinement round.'
          : 'Add 15 extra inputs to refine accuracy, or continue with current tracking.'}
      </p>
      <div className="visage-refinement-actions">
        <button className="visage-refinement-button" onClick={onSkip} type="button">
          {isRefinementActive ? 'Close' : 'No'}
        </button>
        <button
          className="visage-refinement-button visage-refinement-button-primary"
          onClick={onStart}
          disabled={isRefinementActive}
          type="button"
        >
          Yes
        </button>
      </div>
    </aside>
  )
}

export default RefinementPrompt
