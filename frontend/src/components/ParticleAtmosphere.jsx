import { useEffect, useRef } from 'react'
import './ParticleAtmosphere.css'

const PARTICLE_MIN = 30
const PARTICLE_MAX = 50
const REPULSION_RADIUS = 150
const GOLD = { red: 218, green: 185, blue: 91 }

const randomBetween = (minimum, maximum) => minimum + Math.random() * (maximum - minimum)

const createParticle = (width, height) => {
  const angle = Math.random() * Math.PI * 2
  const drift = randomBetween(0.08, 0.28)
  const baseVx = Math.cos(angle) * drift
  const baseVy = Math.sin(angle) * drift
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    radius: randomBetween(0.8, 3),
    baseVx,
    baseVy,
    vx: baseVx,
    vy: baseVy,
    pulse: Math.random() * Math.PI * 2,
    pulseSpeed: randomBetween(0.008, 0.022),
  }
}

export default function ParticleAtmosphere({ className = '' }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const context = canvas.getContext('2d')
    if (!context) return undefined

    let animationFrame = 0
    let width = window.innerWidth
    let height = window.innerHeight
    let particles = []
    let mouseX = width / 2
    let mouseY = height / 2
    let easedMouseX = mouseX
    let easedMouseY = mouseY
    let mouseVisible = false
    let glowOpacity = 0

    const desiredParticleCount = () => {
      const scaled = Math.round((width * height) / 36000)
      return Math.max(PARTICLE_MIN, Math.min(PARTICLE_MAX, scaled))
    }

    const resize = () => {
      width = window.innerWidth
      height = window.innerHeight
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * pixelRatio)
      canvas.height = Math.round(height * pixelRatio)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)

      const count = desiredParticleCount()
      if (particles.length > count) particles = particles.slice(0, count)
      while (particles.length < count) particles.push(createParticle(width, height))
      particles.forEach((particle) => {
        particle.x = Math.min(Math.max(particle.x, 0), width)
        particle.y = Math.min(Math.max(particle.y, 0), height)
      })
    }

    const handleMouseMove = (event) => {
      mouseX = event.clientX
      mouseY = event.clientY
      mouseVisible = true
    }

    const handleMouseLeave = () => { mouseVisible = false }

    const render = () => {
      context.clearRect(0, 0, width, height)

      easedMouseX += (mouseX - easedMouseX) * 0.1
      easedMouseY += (mouseY - easedMouseY) * 0.1
      glowOpacity += ((mouseVisible ? 0.16 : 0) - glowOpacity) * 0.08

      if (glowOpacity > 0.002) {
        const glow = context.createRadialGradient(easedMouseX, easedMouseY, 0, easedMouseX, easedMouseY, 220)
        glow.addColorStop(0, `rgba(${GOLD.red}, ${GOLD.green}, ${GOLD.blue}, ${glowOpacity})`)
        glow.addColorStop(0.42, `rgba(${GOLD.red}, ${GOLD.green}, ${GOLD.blue}, ${glowOpacity * 0.35})`)
        glow.addColorStop(1, `rgba(${GOLD.red}, ${GOLD.green}, ${GOLD.blue}, 0)`)
        context.fillStyle = glow
        context.fillRect(easedMouseX - 220, easedMouseY - 220, 440, 440)
      }

      particles.forEach((particle) => {
        if (mouseVisible) {
          const dx = particle.x - mouseX
          const dy = particle.y - mouseY
          const distance = Math.sqrt(dx * dx + dy * dy)
          if (distance > 0 && distance < REPULSION_RADIUS) {
            const force = (1 - distance / REPULSION_RADIUS) * 1.15
            particle.vx += (dx / distance) * force
            particle.vy += (dy / distance) * force
          }
        }

        // Friction eases every scattered particle back to its individual drift.
        particle.vx = particle.vx * 0.95 + particle.baseVx * 0.05
        particle.vy = particle.vy * 0.95 + particle.baseVy * 0.05
        const speed = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy)
        if (speed > 5.5) {
          particle.vx = (particle.vx / speed) * 5.5
          particle.vy = (particle.vy / speed) * 5.5
        }

        particle.x += particle.vx
        particle.y += particle.vy
        const margin = particle.radius * 3
        if (particle.x < -margin) particle.x = width + margin
        if (particle.x > width + margin) particle.x = -margin
        if (particle.y < -margin) particle.y = height + margin
        if (particle.y > height + margin) particle.y = -margin

        particle.pulse += particle.pulseSpeed
        const opacity = 0.2 + ((Math.sin(particle.pulse) + 1) / 2) * 0.65
        const particleGlow = context.createRadialGradient(
          particle.x,
          particle.y,
          0,
          particle.x,
          particle.y,
          particle.radius * 4,
        )
        particleGlow.addColorStop(0, `rgba(255, 241, 190, ${opacity})`)
        particleGlow.addColorStop(0.3, `rgba(${GOLD.red}, ${GOLD.green}, ${GOLD.blue}, ${opacity * 0.65})`)
        particleGlow.addColorStop(1, `rgba(${GOLD.red}, ${GOLD.green}, ${GOLD.blue}, 0)`)
        context.beginPath()
        context.fillStyle = particleGlow
        context.arc(particle.x, particle.y, particle.radius * 4, 0, Math.PI * 2)
        context.fill()
      })

      animationFrame = window.requestAnimationFrame(render)
    }

    resize()
    window.addEventListener('resize', resize, { passive: true })
    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    document.documentElement.addEventListener('mouseleave', handleMouseLeave)
    animationFrame = window.requestAnimationFrame(render)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', handleMouseMove)
      document.documentElement.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [])

  return <canvas ref={canvasRef} className={`particle-atmosphere ${className}`.trim()} aria-hidden="true" />
}
