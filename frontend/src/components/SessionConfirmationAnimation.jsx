import React, { useState, useEffect } from 'react'
import './SessionConfirmationAnimation.css'

/**
 * SessionConfirmationAnimation
 * Renders delightful luxury category-specific animations when confirming a service session.
 * 
 * Categories:
 * - 'auto': Sleek car driving left to right with spinning rims, headlights, and gold dust trail.
 * - 'garden': 3 distinct leaves swirling and tumbling along wind currents.
 * - 'pet': Playful pet animation (Dog, Cat, Bird, Fish) moving left to right with paw prints / wing flaps / bubbles.
 * 
 * Props:
 * - category: 'auto' | 'garden' | 'pet' | 'combo'
 * - petType: 'dog' | 'cat' | 'bird' | 'fish' (optional for pet care)
 * - isPlaying: boolean (controls animation playback)
 * - onComplete: function called when animation run finishes
 * - compact: boolean (inline compact bar vs full hero banner)
 * - replayable: boolean (shows replay button)
 */
export default function SessionConfirmationAnimation({
  category = 'auto',
  petType = 'dog',
  isPlaying = true,
  onComplete,
  compact = false,
  replayable = false,
  className = '',
}) {
  const [animKey, setAnimKey] = useState(0)

  const handleReplay = (e) => {
    e?.stopPropagation()
    setAnimKey(prev => prev + 1)
  }

  useEffect(() => {
    if (!isPlaying) return
    const timer = setTimeout(() => {
      if (onComplete) onComplete()
    }, compact ? 2600 : 3600)
    return () => clearTimeout(timer)
  }, [animKey, isPlaying, compact, onComplete])

  const normCat = (category || 'auto').toLowerCase()

  return (
    <div
      key={animKey}
      className={`sca-stage ${compact ? 'sca-stage--compact' : 'sca-stage--hero'} sca-cat-${normCat} ${className}`}
      aria-label={`${normCat} booking confirmation animation`}
    >
      {/* Background Ambient Atmosphere */}
      <div className="sca-ambient-glow" />
      <div className="sca-grid-lines" />

      {/* Auto Care: Luxury Car driving left to right */}
      {normCat === 'auto' && (
        <div className="sca-auto-scene">
          {/* Road and speed marks */}
          <div className="sca-road">
            <div className="sca-road-line" />
            <div className="sca-road-dashes" />
          </div>

          {/* Car container with drive trajectory */}
          <div className="sca-car-wrapper">
            <div className="sca-car-headlight" />
            <div className="sca-car-exhaust">
              <span className="sca-dust sca-dust-1" />
              <span className="sca-dust sca-dust-2" />
              <span className="sca-dust sca-dust-3" />
              <span className="sca-dust sca-dust-4" />
            </div>

            {/* Luxury Car Silhouette SVG */}
            <svg className="sca-car-svg" viewBox="0 0 200 70" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="carBodyGrad" x1="0" y1="0" x2="200" y2="70" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#efd07b" />
                  <stop offset="50%" stopColor="#c9a84c" />
                  <stop offset="100%" stopColor="#7a5d1a" />
                </linearGradient>
                <linearGradient id="carRoofGrad" x1="0" y1="0" x2="200" y2="0" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#1a1a1f" />
                  <stop offset="50%" stopColor="#2e2e38" />
                  <stop offset="100%" stopColor="#161619" />
                </linearGradient>
                <linearGradient id="carGlassGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(201, 168, 76, 0.45)" />
                  <stop offset="100%" stopColor="rgba(10, 10, 12, 0.85)" />
                </linearGradient>
              </defs>

              {/* Headlight beam cone */}
              <polygon points="175,42 240,25 240,55" fill="rgba(255, 235, 160, 0.18)" />

              {/* Lower Shadow */}
              <ellipse cx="98" cy="62" rx="86" ry="6" fill="rgba(0,0,0,0.6)" filter="blur(4px)" />

              {/* Main Body */}
              <path
                d="M 12 48 
                   C 10 42, 14 36, 26 34 
                   C 42 32, 54 30, 68 20 
                   C 80 11, 124 10, 142 20 
                   C 152 25, 166 32, 182 36 
                   C 192 38, 196 44, 194 50 
                   C 192 54, 186 56, 172 56 
                   C 166 56, 164 48, 150 48 
                   C 136 48, 134 56, 68 56 
                   C 62 56, 60 48, 46 48 
                   C 32 48, 30 56, 18 56 
                   C 13 56, 11 52, 12 48 Z"
                fill="url(#carBodyGrad)"
                stroke="#ffe89e"
                strokeWidth="1.5"
              />

              {/* Cabin Roof & Windows */}
              <path
                d="M 64 24 
                   C 74 15, 118 14, 136 22 
                   C 144 26, 154 31, 160 34 
                   L 52 34 
                   C 56 29, 60 26, 64 24 Z"
                fill="url(#carGlassGrad)"
                stroke="#c9a84c"
                strokeWidth="1"
              />

              {/* Window Divider Pillar */}
              <line x1="104" y1="16" x2="104" y2="34" stroke="#161619" strokeWidth="2.5" />

              {/* Door Seam & Chrome Accent Line */}
              <path d="M 66 34 L 66 52 M 106 34 L 106 52" stroke="rgba(0,0,0,0.35)" strokeWidth="1.2" />
              <path d="M 32 38 Q 105 39 174 41" stroke="#fff1b8" strokeWidth="1" opacity="0.8" />

              {/* Headlight & Tail Light */}
              <circle cx="188" cy="42" r="3.5" fill="#fff" />
              <circle cx="188" cy="42" r="6" fill="#ffe89e" opacity="0.5" />
              <path d="M 14 42 Q 13 46 16 48" stroke="#ff3b30" strokeWidth="3" strokeLinecap="round" />

              {/* Front Wheel (Spinning) */}
              <g className="sca-wheel sca-wheel-front" transform="translate(150, 50)">
                <circle cx="0" cy="0" r="14" fill="#141416" stroke="#c9a84c" strokeWidth="2.5" />
                <circle cx="0" cy="0" r="8" fill="#222" stroke="#e0c268" strokeWidth="1.5" />
                <circle cx="0" cy="0" r="3" fill="#fff" />
                {/* Rims */}
                <line x1="-12" y1="0" x2="12" y2="0" stroke="#ffe89e" strokeWidth="1.5" />
                <line x1="0" y1="-12" x2="0" y2="12" stroke="#ffe89e" strokeWidth="1.5" />
                <line x1="-8" y1="-8" x2="8" y2="8" stroke="#ffe89e" strokeWidth="1.5" />
                <line x1="-8" y1="8" x2="8" y2="-8" stroke="#ffe89e" strokeWidth="1.5" />
              </g>

              {/* Rear Wheel (Spinning) */}
              <g className="sca-wheel sca-wheel-rear" transform="translate(46, 50)">
                <circle cx="0" cy="0" r="14" fill="#141416" stroke="#c9a84c" strokeWidth="2.5" />
                <circle cx="0" cy="0" r="8" fill="#222" stroke="#e0c268" strokeWidth="1.5" />
                <circle cx="0" cy="0" r="3" fill="#fff" />
                {/* Rims */}
                <line x1="-12" y1="0" x2="12" y2="0" stroke="#ffe89e" strokeWidth="1.5" />
                <line x1="0" y1="-12" x2="0" y2="12" stroke="#ffe89e" strokeWidth="1.5" />
                <line x1="-8" y1="-8" x2="8" y2="8" stroke="#ffe89e" strokeWidth="1.5" />
                <line x1="-8" y1="8" x2="8" y2="-8" stroke="#ffe89e" strokeWidth="1.5" />
              </g>
            </svg>
          </div>
        </div>
      )}

      {/* Garden Care: 3 Leaves Swirling & Crawling by the Wind */}
      {normCat === 'garden' && (
        <div className="sca-garden-scene">
          {/* Wind Gust Streams */}
          <svg className="sca-wind-stream" viewBox="0 0 600 120" preserveAspectRatio="none">
            <path className="sca-wind-line sca-wind-1" d="M -50 45 Q 120 15 280 55 T 650 35" />
            <path className="sca-wind-line sca-wind-2" d="M -50 75 Q 180 100 360 60 T 650 80" />
            <path className="sca-wind-line sca-wind-3" d="M -50 25 Q 220 5 420 40 T 650 20" />
          </svg>

          {/* Golden/Emerald floating pollen sparkles */}
          <div className="sca-sparkles">
            {[...Array(8)].map((_, i) => (
              <span key={i} className={`sca-sparkle sca-sparkle-${i + 1}`} />
            ))}
          </div>

          {/* Leaf 1: Golden Royal Leaf */}
          <div className="sca-leaf-track sca-leaf-track-1">
            <div className="sca-leaf-rotator sca-leaf-rot-1">
              <svg className="sca-leaf-svg sca-leaf-gold" viewBox="0 0 40 40" width="34" height="34">
                <defs>
                  <linearGradient id="goldLeafGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#ffe599" />
                    <stop offset="60%" stopColor="#d4af37" />
                    <stop offset="100%" stopColor="#8a6d1a" />
                  </linearGradient>
                </defs>
                <path
                  d="M 20 2 C 28 8 36 18 34 30 C 30 38 18 38 10 32 C 4 24 8 10 20 2 Z"
                  fill="url(#goldLeafGrad)"
                  stroke="#fff2be"
                  strokeWidth="1.2"
                />
                <path d="M 20 2 Q 21 20 22 36" stroke="#70520a" strokeWidth="1.2" />
                <path d="M 20 12 Q 27 15 31 19 M 20 20 Q 26 23 29 27 M 20 16 Q 13 19 10 23" stroke="#70520a" strokeWidth="0.8" />
              </svg>
            </div>
          </div>

          {/* Leaf 2: Emerald Green Monstera / Ivy Leaf */}
          <div className="sca-leaf-track sca-leaf-track-2">
            <div className="sca-leaf-rotator sca-leaf-rot-2">
              <svg className="sca-leaf-svg sca-leaf-emerald" viewBox="0 0 40 40" width="30" height="30">
                <defs>
                  <linearGradient id="emeraldLeafGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#86efac" />
                    <stop offset="50%" stopColor="#22c55e" />
                    <stop offset="100%" stopColor="#15803d" />
                  </linearGradient>
                </defs>
                <path
                  d="M 4 20 C 6 8 20 4 36 4 C 36 20 32 34 20 36 C 8 36 2 30 4 20 Z"
                  fill="url(#emeraldLeafGrad)"
                  stroke="#bbf7d0"
                  strokeWidth="1.2"
                />
                <path d="M 36 4 Q 20 20 8 32" stroke="#0f5132" strokeWidth="1.2" />
                <path d="M 28 12 Q 22 10 16 12 M 22 18 Q 16 17 12 20 M 17 23 Q 12 24 9 27" stroke="#0f5132" strokeWidth="0.8" />
              </svg>
            </div>
          </div>

          {/* Leaf 3: Bronze/Amber Autumn Leaf */}
          <div className="sca-leaf-track sca-leaf-track-3">
            <div className="sca-leaf-rotator sca-leaf-rot-3">
              <svg className="sca-leaf-svg sca-leaf-amber" viewBox="0 0 40 40" width="28" height="28">
                <defs>
                  <linearGradient id="amberLeafGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#fef08a" />
                    <stop offset="50%" stopColor="#eab308" />
                    <stop offset="100%" stopColor="#a16207" />
                  </linearGradient>
                </defs>
                <path
                  d="M 20 4 C 28 10 34 18 30 28 C 24 36 12 36 6 28 C 2 18 10 10 20 4 Z"
                  fill="url(#amberLeafGrad)"
                  stroke="#fef9c3"
                  strokeWidth="1.2"
                />
                <path d="M 20 4 L 18 36" stroke="#713f12" strokeWidth="1.2" />
                <path d="M 20 14 L 27 19 M 19 22 L 26 27 M 19 17 L 12 21" stroke="#713f12" strokeWidth="0.8" />
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Pet Care: Dog, Cat, Bird, or Fish Animation */}
      {normCat === 'pet' && (
        <div className="sca-pet-scene">
          {/* Paw Prints Track for Land Pets (Dog / Cat) */}
          {(petType === 'dog' || petType === 'cat') && (
            <div className="sca-paw-track">
              {[...Array(6)].map((_, i) => (
                <div key={i} className={`sca-paw sca-paw-${i + 1}`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--gold, #c9a84c)" opacity="0.85">
                    <circle cx="12" cy="16" r="4.5" />
                    <circle cx="6.5" cy="9.5" r="2.3" />
                    <circle cx="17.5" cy="9.5" r="2.3" />
                    <circle cx="3.5" cy="14" r="1.8" />
                    <circle cx="20.5" cy="14" r="1.8" />
                  </svg>
                </div>
              ))}
            </div>
          )}

          {/* Water Ripples & Bubbles for Fish */}
          {petType === 'fish' && (
            <div className="sca-fish-water">
              <div className="sca-water-wave sca-water-wave-1" />
              <div className="sca-water-wave sca-water-wave-2" />
              <div className="sca-bubbles">
                {[...Array(8)].map((_, i) => (
                  <span key={i} className={`sca-bubble sca-bubble-${i + 1}`} />
                ))}
              </div>
            </div>
          )}

          {/* Sky Clouds / Wind Breeze for Bird */}
          {petType === 'bird' && (
            <div className="sca-bird-sky">
              <svg className="sca-bird-wind" viewBox="0 0 500 80">
                <path d="M 0 30 Q 150 10 300 35 T 500 20" stroke="rgba(201, 168, 76, 0.3)" strokeWidth="1.5" fill="none" strokeDasharray="6 6" />
                <path d="M 50 60 Q 200 40 380 65 T 500 50" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="1" fill="none" strokeDasharray="4 4" />
              </svg>
            </div>
          )}

          {/* Running / Flying / Swimming Pet Character Container */}
          <div className={`sca-pet-runner sca-pet-runner--${petType}`}>
            {/* 🐶 DOG (Running playful pup) */}
            {petType === 'dog' && (
              <div className="sca-dog-char">
                <svg className="sca-dog-svg" viewBox="0 0 90 60" width="70" height="48">
                  <defs>
                    <linearGradient id="dogGrad" x1="0" y1="0" x2="90" y2="60" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#fde047" />
                      <stop offset="60%" stopColor="#d4af37" />
                      <stop offset="100%" stopColor="#92400e" />
                    </linearGradient>
                  </defs>
                  {/* Tail (Wagging) */}
                  <g className="sca-dog-tail">
                    <path d="M 18 32 C 10 24 6 12 14 8 C 17 6 20 14 19 28" fill="url(#dogGrad)" stroke="#78350f" strokeWidth="1.2" />
                  </g>
                  {/* Back Left Leg */}
                  <g className="sca-dog-leg-back-l">
                    <path d="M 24 38 L 20 54 L 26 56" stroke="#92400e" strokeWidth="4" strokeLinecap="round" />
                  </g>
                  {/* Back Right Leg */}
                  <g className="sca-dog-leg-back-r">
                    <path d="M 30 38 L 28 54 L 34 56" stroke="#d4af37" strokeWidth="4" strokeLinecap="round" />
                  </g>
                  {/* Body */}
                  <ellipse cx="44" cy="34" rx="22" ry="13" fill="url(#dogGrad)" stroke="#78350f" strokeWidth="1.2" />
                  {/* Collar */}
                  <path d="M 60 26 L 58 38" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
                  <circle cx="58" cy="40" r="2.5" fill="#fde047" />
                  {/* Front Left Leg */}
                  <g className="sca-dog-leg-front-l">
                    <path d="M 58 38 L 62 54 L 68 56" stroke="#92400e" strokeWidth="4" strokeLinecap="round" />
                  </g>
                  {/* Front Right Leg */}
                  <g className="sca-dog-leg-front-r">
                    <path d="M 64 38 L 66 54 L 72 56" stroke="#d4af37" strokeWidth="4" strokeLinecap="round" />
                  </g>
                  {/* Head & Floppy Ear */}
                  <g className="sca-dog-head">
                    <circle cx="70" cy="22" r="11" fill="url(#dogGrad)" stroke="#78350f" strokeWidth="1.2" />
                    {/* Snout */}
                    <ellipse cx="80" cy="24" rx="6" ry="4.5" fill="url(#dogGrad)" stroke="#78350f" strokeWidth="1" />
                    <circle cx="84" cy="22" r="2.2" fill="#18181b" />
                    {/* Eye */}
                    <circle cx="72" cy="19" r="2" fill="#18181b" />
                    <circle cx="72.6" cy="18.4" r="0.7" fill="#ffffff" />
                    {/* Floppy Ear */}
                    <path className="sca-dog-ear" d="M 65 14 C 60 16 58 26 63 28 C 66 30 68 20 67 14 Z" fill="#92400e" />
                  </g>
                </svg>
              </div>
            )}

            {/* 🐈 CAT (Graceful leaping feline) */}
            {petType === 'cat' && (
              <div className="sca-cat-char">
                <svg className="sca-cat-svg" viewBox="0 0 90 60" width="70" height="48">
                  <defs>
                    <linearGradient id="catGrad" x1="0" y1="0" x2="90" y2="60" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#fef08a" />
                      <stop offset="50%" stopColor="#ca8a04" />
                      <stop offset="100%" stopColor="#713f12" />
                    </linearGradient>
                  </defs>
                  {/* Sleek Curved Tail */}
                  <path className="sca-cat-tail" d="M 18 36 C 8 32 4 14 12 10 C 16 8 18 16 20 28" fill="none" stroke="url(#catGrad)" strokeWidth="4" strokeLinecap="round" />
                  {/* Body */}
                  <ellipse cx="42" cy="34" rx="20" ry="11" fill="url(#catGrad)" stroke="#713f12" strokeWidth="1.2" />
                  {/* Legs */}
                  <path className="sca-cat-legs-b" d="M 26 38 Q 22 50 28 54" stroke="#ca8a04" strokeWidth="3.5" strokeLinecap="round" fill="none" />
                  <path className="sca-cat-legs-f" d="M 56 38 Q 62 48 68 52" stroke="#ca8a04" strokeWidth="3.5" strokeLinecap="round" fill="none" />
                  {/* Head & Pointy Ears */}
                  <g className="sca-cat-head">
                    <circle cx="66" cy="22" r="10" fill="url(#catGrad)" stroke="#713f12" strokeWidth="1.2" />
                    {/* Ears */}
                    <polygon points="60,14 65,6 68,14" fill="#a16207" />
                    <polygon points="68,14 73,8 75,15" fill="#a16207" />
                    {/* Eyes & Nose */}
                    <ellipse cx="70" cy="20" rx="1.8" ry="2.2" fill="#22c55e" />
                    <circle cx="75" cy="24" r="1.5" fill="#f472b6" />
                    {/* Whiskers */}
                    <line x1="74" y1="23" x2="84" y2="21" stroke="#fff" strokeWidth="0.8" />
                    <line x1="74" y1="25" x2="84" y2="27" stroke="#fff" strokeWidth="0.8" />
                  </g>
                </svg>
              </div>
            )}

            {/* 🐦 BIRD (Flying bird with flapping wings) */}
            {petType === 'bird' && (
              <div className="sca-bird-char">
                <svg className="sca-bird-svg" viewBox="0 0 80 60" width="65" height="48">
                  <defs>
                    <linearGradient id="birdGrad" x1="0" y1="0" x2="80" y2="60" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#93c5fd" />
                      <stop offset="50%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#1e3a8a" />
                    </linearGradient>
                    <linearGradient id="birdWingGrad" x1="0" y1="0" x2="0" y2="40">
                      <stop offset="0%" stopColor="#dbeafe" />
                      <stop offset="100%" stopColor="#2563eb" />
                    </linearGradient>
                  </defs>
                  {/* Tail Feathers */}
                  <polygon points="12,28 2,20 6,32 0,38 16,34" fill="#1d4ed8" />
                  {/* Body */}
                  <path d="M 16 32 C 22 24 38 22 54 26 C 62 28 66 34 60 40 C 48 46 28 44 16 32 Z" fill="url(#birdGrad)" stroke="#1e40af" strokeWidth="1" />
                  {/* Flapping Wings */}
                  <g className="sca-bird-wing">
                    <path d="M 32 26 C 26 4 48 2 56 16 C 48 20 40 24 32 26 Z" fill="url(#birdWingGrad)" stroke="#1d4ed8" strokeWidth="1.2" />
                  </g>
                  {/* Head & Beak */}
                  <circle cx="62" cy="28" r="7" fill="url(#birdGrad)" stroke="#1e40af" strokeWidth="1" />
                  <circle cx="64" cy="26" r="1.5" fill="#18181b" />
                  <circle cx="64.5" cy="25.5" r="0.6" fill="#fff" />
                  <polygon points="68,26 78,29 68,31" fill="#f59e0b" stroke="#b45309" strokeWidth="0.8" />
                </svg>
              </div>
            )}

            {/* 🐠 FISH (Golden swimming koi/tropical fish) */}
            {petType === 'fish' && (
              <div className="sca-fish-char">
                <svg className="sca-fish-svg" viewBox="0 0 90 60" width="70" height="48">
                  <defs>
                    <linearGradient id="fishGrad" x1="0" y1="0" x2="90" y2="60" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#fed7aa" />
                      <stop offset="50%" stopColor="#f97316" />
                      <stop offset="100%" stopColor="#c2410c" />
                    </linearGradient>
                    <linearGradient id="fishFinGrad" x1="0" y1="0" x2="0" y2="40">
                      <stop offset="0%" stopColor="#ffedd5" />
                      <stop offset="100%" stopColor="#ea580c" />
                    </linearGradient>
                  </defs>
                  {/* Waving Tail Fin */}
                  <g className="sca-fish-tail">
                    <path d="M 22 30 C 10 14 0 16 4 28 C 0 36 6 48 20 34 Z" fill="url(#fishFinGrad)" stroke="#c2410c" strokeWidth="1" />
                  </g>
                  {/* Body */}
                  <ellipse cx="48" cy="30" rx="26" ry="14" fill="url(#fishGrad)" stroke="#9a3412" strokeWidth="1.2" />
                  {/* Scales Pattern */}
                  <path d="M 40 24 Q 44 30 40 36 M 48 22 Q 52 30 48 38 M 56 24 Q 60 30 56 36" stroke="rgba(255,255,255,0.4)" strokeWidth="1" fill="none" />
                  {/* Dorsal Top Fin */}
                  <path d="M 38 17 Q 50 10 58 17 Z" fill="url(#fishFinGrad)" />
                  {/* Pectoral Fin (Waving) */}
                  <g className="sca-fish-fin">
                    <path d="M 52 34 Q 44 44 40 38 Z" fill="url(#fishFinGrad)" stroke="#ea580c" strokeWidth="0.8" />
                  </g>
                  {/* Eye & Mouth */}
                  <circle cx="66" cy="27" r="3.2" fill="#fff" />
                  <circle cx="67" cy="27" r="1.8" fill="#18181b" />
                  <circle cx="67.5" cy="26.5" r="0.6" fill="#fff" />
                  <path d="M 73 31 Q 70 33 73 35" stroke="#9a3412" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                </svg>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Combo Packages: Synchronized Trio Feature */}
      {normCat === 'combo' && (
        <div className="sca-combo-scene">
          <div className="sca-combo-stage">
            {/* Mini car */}
            <div className="sca-combo-item sca-combo-car">
              <span className="sca-combo-icon">🚗</span>
              <span className="sca-combo-label">Auto</span>
            </div>
            {/* Swirling leaf */}
            <div className="sca-combo-item sca-combo-leaf">
              <span className="sca-combo-icon">🍃</span>
              <span className="sca-combo-label">Garden</span>
            </div>
            {/* Companion pet */}
            <div className="sca-combo-item sca-combo-pet">
              <span className="sca-combo-icon">🐾</span>
              <span className="sca-combo-label">Pet</span>
            </div>
          </div>
        </div>
      )}

      {/* Replay Button (Optional) */}
      {replayable && (
        <button
          type="button"
          className="sca-replay-btn"
          onClick={handleReplay}
          title="Replay booking animation"
        >
          ↻ Replay
        </button>
      )}
    </div>
  )
}
