import { useEffect, useId, useRef, useState } from 'react'
import '../Layout/Layout.css'

const eyePositionSubscribers = new Set()
let areEyePositionListenersActive = false

const publishEyePosition = (position) => {
  eyePositionSubscribers.forEach((subscriber) => subscriber(position))
}

const handleGlobalPointerMove = (event) => {
  publishEyePosition({ x: event.clientX, y: event.clientY })
}

const handleGlobalTouch = (event) => {
  const touch = event.touches[0]
  if (touch) publishEyePosition({ x: touch.clientX, y: touch.clientY })
}

const resetAllEyes = () => publishEyePosition(null)

const addGlobalEyePositionListeners = () => {
  if (areEyePositionListenersActive) return

  window.addEventListener('pointermove', handleGlobalPointerMove)
  window.addEventListener('touchstart', handleGlobalTouch, { passive: true })
  window.addEventListener('touchmove', handleGlobalTouch, { passive: true })
  window.addEventListener('touchend', resetAllEyes, { passive: true })
  document.documentElement.addEventListener('mouseleave', resetAllEyes)
  areEyePositionListenersActive = true
}

const removeGlobalEyePositionListeners = () => {
  if (!areEyePositionListenersActive || eyePositionSubscribers.size > 0) return

  window.removeEventListener('pointermove', handleGlobalPointerMove)
  window.removeEventListener('touchstart', handleGlobalTouch)
  window.removeEventListener('touchmove', handleGlobalTouch)
  window.removeEventListener('touchend', resetAllEyes)
  document.documentElement.removeEventListener('mouseleave', resetAllEyes)
  areEyePositionListenersActive = false
}

function InteractiveEye({ className = '' }) {
  const [eyeState, setEyeState] = useState('normal')
  const [isEyeClosed, setIsEyeClosed] = useState(false)
  const eyeRef = useRef(null)
  const pupilRef = useRef(null)
  const eyeCloseTimerRef = useRef(null)
  const eyeStateTimerRef = useRef(null)
  const gradientId = `interactive-eye-iris-${useId().replace(/:/g, '')}`

  useEffect(() => {
    let animationFrameId = null
    let pointerPosition = null

    const updatePupil = () => {
      animationFrameId = null
      const eye = eyeRef.current
      const pupil = pupilRef.current
      if (!eye || !pupil || !pointerPosition) return

      const bounds = eye.getBoundingClientRect()
      const deltaX = pointerPosition.x - (bounds.left + bounds.width / 2)
      const deltaY = pointerPosition.y - (bounds.top + bounds.height / 2)
      const ellipticalDistance = Math.hypot(deltaX / 8, deltaY / 4.5) || 1
      const scale = 1 / Math.max(1, ellipticalDistance)
      pupil.style.transform = `translate(${deltaX * scale}px, ${deltaY * scale}px)`
    }

    const moveEye = (x, y) => {
      pointerPosition = { x, y }
      if (!animationFrameId) animationFrameId = requestAnimationFrame(updatePupil)
    }

    const updateFromGlobalPosition = (position) => {
      pointerPosition = position
      if (!position) {
        if (animationFrameId) cancelAnimationFrame(animationFrameId)
        animationFrameId = null
        if (pupilRef.current) pupilRef.current.style.transform = 'translate(0, 0)'
        return
      }

      moveEye(position.x, position.y)
    }

    eyePositionSubscribers.add(updateFromGlobalPosition)
    addGlobalEyePositionListeners()

    return () => {
      eyePositionSubscribers.delete(updateFromGlobalPosition)
      removeGlobalEyePositionListeners()
      if (animationFrameId) cancelAnimationFrame(animationFrameId)
      if (eyeCloseTimerRef.current) clearTimeout(eyeCloseTimerRef.current)
      if (eyeStateTimerRef.current) clearTimeout(eyeStateTimerRef.current)
    }
  }, [])

  const handleClick = () => {
    if (eyeState === 'angry') return
    if (eyeCloseTimerRef.current) clearTimeout(eyeCloseTimerRef.current)
    if (eyeStateTimerRef.current) clearTimeout(eyeStateTimerRef.current)

    if (eyeState === 'irritated') {
      setIsEyeClosed(false)
      setEyeState('angry')
      eyeStateTimerRef.current = setTimeout(() => setEyeState('normal'), 5000)
      return
    }

    setEyeState('normal')
    setIsEyeClosed(true)
    eyeCloseTimerRef.current = setTimeout(() => {
      setIsEyeClosed(false)
      setEyeState('irritated')
      eyeStateTimerRef.current = setTimeout(() => setEyeState('normal'), 2500)
    }, 200)
  }

  return (
    <button
      className={`site-brand-eye-button ${className}`.trim()}
      type="button"
      aria-label="Interact with the GazeCal eye"
      onClick={handleClick}
    >
      <span
        className={[
          'site-brand-mark',
          `site-brand-mark-${eyeState}`,
          isEyeClosed ? 'site-brand-mark-closed' : ''
        ].filter(Boolean).join(' ')}
        ref={eyeRef}
        aria-hidden="true"
      >
        <svg viewBox="0 0 52 34" role="presentation">
          <defs>
            <radialGradient id={gradientId} cx="38%" cy="34%" r="68%">
              <stop offset="0%" stopColor="#a5f3fc" />
              <stop offset="38%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#0284c7" />
            </radialGradient>
          </defs>
          <path
            className="site-brand-eye-white"
            d="M2 17C7.8 7.5 15.8 3 26 3s18.2 4.5 24 14c-5.8 9.5-13.8 14-24 14S7.8 26.5 2 17Z"
          />
          <g className="site-brand-iris" ref={pupilRef}>
            <circle className="site-brand-iris-color" cx="26" cy="17" r="9" fill={`url(#${gradientId})`} />
            <circle className="site-brand-pupil" cx="26" cy="17" r="4.2" />
            <path
              className="site-brand-pupil-angry"
              d="M26 10.5C28.4 13.2 28.4 20.8 26 23.5C23.6 20.8 23.6 13.2 26 10.5Z"
            />
            <circle className="site-brand-eye-highlight" cx="23.5" cy="14.3" r="1.7" />
          </g>
        </svg>
      </span>
    </button>
  )
}

export default InteractiveEye
