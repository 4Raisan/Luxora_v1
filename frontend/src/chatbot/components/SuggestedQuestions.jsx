import React from 'react'

export function SuggestedQuestions({ questions = [], onSelect }) {
  if (!questions || questions.length === 0) return null

  return (
    <div className="lx-quick-actions" style={{ marginTop: '6px' }}>
      {questions.map((q, idx) => (
        <button
          key={idx}
          className="lx-quick-pill"
          onClick={() => onSelect(q)}
        >
          ✦ {q}
        </button>
      ))}
    </div>
  )
}

export default SuggestedQuestions
