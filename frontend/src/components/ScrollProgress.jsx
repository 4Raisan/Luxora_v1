import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import './ScrollProgress.css'

gsap.registerPlugin(ScrollTrigger)

const ScrollProgress = () => {
  const barRef = useRef(null)

  useLayoutEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined

    const context = gsap.context(() => {
      gsap.fromTo(barRef.current, { scaleX: 0 }, {
        scaleX: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: document.body,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.3,
        },
      })
    })

    return () => context.revert()
  }, [])

  return <div ref={barRef} className="scroll-progress" aria-hidden="true" />
}

export default ScrollProgress