import { useEffect, useRef } from 'react'
import './CursorGlow.css'

/* Soft gold light that trails the pointer on every page. Rendered as a single
   fixed element driven by a rAF loop (transform-only, no React re-renders);
   disabled for touch devices and reduced-motion users. */
const CursorGlow = () => {
  const glowRef = useRef(null)

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return undefined
    const glow = glowRef.current
    if (!glow) return undefined

    let raf = 0
    let targetX = window.innerWidth / 2
    let targetY = window.innerHeight / 3
    let x = targetX
    let y = targetY
    let shown = false
    let hidden = false

    const onMove = (event) => {
      targetX = event.clientX
      targetY = event.clientY
      if (!shown) {
        shown = true
        hidden = false
        glow.style.opacity = '1'
      }
    }
    const onHide = () => {
      shown = false
      if (!hidden) {
        hidden = true
        glow.style.opacity = '0'
      }
    }

    const tick = () => {
      x += (targetX - x) * 0.18
      y += (targetY - y) * 0.18
      glow.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`
      raf = requestAnimationFrame(tick)
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    document.documentElement.addEventListener('mouseleave', onHide)
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMove)
      document.documentElement.removeEventListener('mouseleave', onHide)
    }
  }, [])

  return <div ref={glowRef} className="cursor-glow" aria-hidden="true" />
}

export default CursorGlow
