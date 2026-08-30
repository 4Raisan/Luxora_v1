import { useEffect, useRef } from 'react'
import './LuxoraBackground.css'

/**
 * LuxoraBackground — Full-Screen Interactive Gold Squares Atmosphere
 * Whole screen tilts, shifts, and reacts dynamically to mouse position & velocity.
 */
export default function LuxoraBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    let width = 0
    let height = 0
    let animationFrameId

    const mouse = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      targetX: window.innerWidth / 2,
      targetY: window.innerHeight / 2,
      vx: 0,
      vy: 0
    }

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = width + 'px'
      canvas.style.height = height + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    window.addEventListener('resize', resize)
    resize()

    const handleMouseMove = (e) => {
      mouse.targetX = e.clientX
      mouse.targetY = e.clientY
    }

    const handleTouchMove = (e) => {
      if (e.touches.length > 0) {
        mouse.targetX = e.touches[0].clientX
        mouse.targetY = e.touches[0].clientY
      }
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })

    const PARTICLE_COUNT = Math.floor(Math.max(80, (window.innerWidth * window.innerHeight) / 11000))
    const particles = []

    const GOLD_COLORS = [
      '#f5e6be',
      '#e8c96b',
      '#d4af37',
      '#c8a84c',
      '#dfb752',
      '#b89228'
    ]

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const depth = Math.random()
      particles.push({
        baseX: Math.random() * (width + 300) - 150,
        baseY: Math.random() * (height + 300) - 150,
        x: 0,
        y: 0,
        size: Math.pow(depth, 2) * 6.5 + 1.8,
        depth,
        color: GOLD_COLORS[Math.floor(Math.random() * GOLD_COLORS.length)],
        vx: (Math.random() - 0.5) * 0.3 * (depth + 0.2),
        vy: -(Math.random() * 0.4 + 0.1) * (depth + 0.3),
        repelX: 0,
        repelY: 0,
        baseAlpha: Math.random() * 0.5 + 0.25,
        alpha: 0.5,
        pulseSpeed: Math.random() * 0.02 + 0.008,
        pulsePhase: Math.random() * Math.PI * 2,
        wobbleSpeed: Math.random() * 0.01 + 0.005,
        wobbleAmp: Math.random() * 20 + 5
      })
    }

    const render = (now) => {
      animationFrameId = requestAnimationFrame(render)

      mouse.vx = (mouse.targetX - mouse.x) * 0.06
      mouse.vy = (mouse.targetY - mouse.y) * 0.06
      mouse.x += mouse.vx
      mouse.y += mouse.vy

      const normX = (mouse.x / width - 0.5) * 2
      const normY = (mouse.y / height - 0.5) * 2

      ctx.fillStyle = '#050507'
      ctx.fillRect(0, 0, width, height)

      // Full-Screen Ambient Golden Spotlight that dynamically shifts with cursor
      const glowX = width * 0.22 + normX * (width * 0.25)
      const glowY = height * 0.20 + normY * (height * 0.22)
      const glowRadius = Math.max(width * 0.75, 750)

      const glowGrad = ctx.createRadialGradient(
        glowX, glowY, 0,
        glowX, glowY, glowRadius
      )
      glowGrad.addColorStop(0, 'rgba(212, 175, 55, 0.16)')
      glowGrad.addColorStop(0.3, 'rgba(200, 160, 60, 0.07)')
      glowGrad.addColorStop(0.65, 'rgba(160, 120, 40, 0.015)')
      glowGrad.addColorStop(1, 'rgba(5, 5, 7, 0)')

      ctx.fillStyle = glowGrad
      ctx.fillRect(0, 0, width, height)

      // Secondary cursor aura
      const cursorAura = ctx.createRadialGradient(
        mouse.x, mouse.y, 0,
        mouse.x, mouse.y, 240
      )
      cursorAura.addColorStop(0, 'rgba(212, 175, 55, 0.06)')
      cursorAura.addColorStop(1, 'rgba(5, 5, 7, 0)')
      ctx.fillStyle = cursorAura
      ctx.fillRect(0, 0, width, height)

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]

        p.baseX += p.vx
        p.baseY += p.vy
        p.pulsePhase += p.pulseSpeed

        const boundPadding = 120
        if (p.baseX < -boundPadding) p.baseX = width + boundPadding
        if (p.baseX > width + boundPadding) p.baseX = -boundPadding
        if (p.baseY < -boundPadding) p.baseY = height + boundPadding
        if (p.baseY > height + boundPadding) p.baseY = -boundPadding

        // 3D Parallax Displacement
        const parallaxX = -normX * Math.pow(p.depth, 1.3) * 110
        const parallaxY = -normY * Math.pow(p.depth, 1.3) * 75

        const wobbleX = Math.sin(now * 0.001 * p.wobbleSpeed * 60 + p.pulsePhase) * (p.wobbleAmp * p.depth)

        const currentPosX = p.baseX + parallaxX + wobbleX + p.repelX
        const currentPosY = p.baseY + parallaxY + p.repelY

        const dx = currentPosX - mouse.x
        const dy = currentPosY - mouse.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const repelRadius = 160

        if (dist < repelRadius && dist > 0.1) {
          const force = (1 - dist / repelRadius) * (18 * p.depth + 4)
          p.repelX += (dx / dist) * force
          p.repelY += (dy / dist) * force
        }

        p.repelX *= 0.92
        p.repelY *= 0.92

        p.x = p.baseX + parallaxX + wobbleX + p.repelX
        p.y = p.baseY + parallaxY + p.repelY

        p.alpha = p.baseAlpha + Math.sin(p.pulsePhase) * 0.2
        if (p.alpha < 0.08) p.alpha = 0.08
        if (p.alpha > 0.95) p.alpha = 0.95

        ctx.save()
        ctx.globalAlpha = p.alpha

        if (p.size > 4.2) {
          ctx.shadowColor = 'rgba(212, 175, 55, 0.6)'
          ctx.shadowBlur = 9
        } else {
          ctx.shadowBlur = 0
        }

        ctx.fillStyle = p.color
        ctx.fillRect(
          Math.round(p.x - p.size / 2),
          Math.round(p.y - p.size / 2),
          Math.round(p.size),
          Math.round(p.size)
        )

        ctx.restore()
      }
    }

    render(performance.now())

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('touchmove', handleTouchMove)
    }
  }, [])

  return <canvas ref={canvasRef} className="luxora-squares-bg" aria-hidden="true" />
}
