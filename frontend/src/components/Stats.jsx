import { useEffect, useRef, useState } from 'react'
import './Stats.css'

const useCountUp = (target, duration = 2000, start = false) => {
  const [count, setCount] = useState(target)

  useEffect(() => {
    // If value contains '/', treat it as static — don't animate
    if (!start || target.includes('/')) {
      setCount(target)
      return
    }
    let startTime = null
    const numericTarget = parseInt(target.replace(/\D/g, ''))
    const suffix = target.replace(/[0-9]/g, '')

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(eased * numericTarget) + suffix)
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [start, target, duration])

  return count || '0'
}

const StatItem = ({ value, label, delay, started }) => {
  const animated = useCountUp(value, 2200, started)

  return (
    <div className="stat" style={{ animationDelay: `${delay}s` }}>
      <div className="stat__value">{animated}</div>
      <div className="stat__label">{label}</div>
    </div>
  )
}

const Stats = () => {
  const [started, setStarted] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStarted(true) },
      { threshold: 0.4 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  const stats = [
    { value: '500+', label: 'LUXURY ESTATES', delay: 0 },
    { value: '98%', label: 'CLIENT RETENTION', delay: 0.15 },
    { value: '24/7', label: 'ELITE SUPPORT', delay: 0.3 },
  ]

  return (
    <section className="stats" ref={ref}>
      <div className="stats__inner">
        {stats.map((s) => (
          <StatItem key={s.label} {...s} started={started} />
        ))}
      </div>
    </section>
  )
}

export default Stats
