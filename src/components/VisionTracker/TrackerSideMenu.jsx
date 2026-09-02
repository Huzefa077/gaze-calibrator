import InteractiveEye from '../InteractiveEye/InteractiveEye'

function TrackerSideMenu({
  isOpen,
  isAutoSelectEnabled,
  showFaceLockTips,
  showRefinementPrompt,
  shouldGuideRefinement,
  shouldShowRefinementOption,
  onClose,
  onExit,
  onOpenRefinement,
  onOpenTips,
  onToggle,
  onToggleAutoSelect
}) {
  return (
    <>
      <button
        className={[
          'visage-menu-toggle',
          isOpen ? 'visage-menu-toggle-open' : '',
          shouldGuideRefinement && !isOpen ? 'visage-refinement-guide' : ''
        ].filter(Boolean).join(' ')}
        onClick={onToggle}
        type="button"
        aria-label={isOpen ? 'Close tracker menu' : 'Open tracker menu'}
        aria-expanded={isOpen}
      >
        <span></span>
        <span></span>
        <span></span>
      </button>
      <div
        className={isOpen ? 'visage-menu-backdrop visage-menu-backdrop-open' : 'visage-menu-backdrop'}
        onClick={onClose}
        aria-hidden="true"
      ></div>
      <nav className={isOpen ? 'visage-side-menu visage-side-menu-open' : 'visage-side-menu'} aria-label="Gaze tracker menu">
        <div className="visage-side-menu-header">
          <div className="visage-side-menu-brand">
            <InteractiveEye className="visage-side-menu-eye" />
            <strong>Gaze Tracker</strong>
          </div>
        </div>
        <button
          className={showFaceLockTips ? 'visage-menu-action visage-menu-action-active' : 'visage-menu-action'}
          onClick={onOpenTips}
          type="button"
        >
          Tips
        </button>
        <button
          className={isAutoSelectEnabled ? 'visage-menu-action visage-menu-action-blue' : 'visage-menu-action'}
          onClick={onToggleAutoSelect}
          type="button"
          aria-pressed={isAutoSelectEnabled}
        >
          Auto select {isAutoSelectEnabled ? 'On' : 'Off'}
        </button>
        {shouldShowRefinementOption && (
          <button
            className={[
              'visage-menu-action',
              showRefinementPrompt ? 'visage-menu-action-active' : '',
              shouldGuideRefinement && isOpen ? 'visage-refinement-guide' : ''
            ].filter(Boolean).join(' ')}
            onClick={onOpenRefinement}
            type="button"
          >
            Refine Accuracy
          </button>
        )}
        <button className="visage-menu-action visage-menu-action-exit" onClick={onExit} type="button">
          Exit
        </button>
      </nav>
    </>
  )
}

export default TrackerSideMenu
