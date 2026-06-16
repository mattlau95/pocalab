import { useRef, useState } from 'react'
import type { Card } from '../models/card'
import './DeckCard.css'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

interface Props {
  card: Card
  copies: number
  maxCopies: number
  onCopiesChange: (count: number) => void
  onRemove: () => void
  onEditSide: (side: 'front' | 'back', file: File) => void
  onReEditSide: (side: 'front' | 'back') => void
}

export function DeckCard({ card, copies, maxCopies, onCopiesChange, onRemove, onEditSide, onReEditSide }: Props) {
  const frontInputRef = useRef<HTMLInputElement>(null)
  const backInputRef = useRef<HTMLInputElement>(null)
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const [removing, setRemoving] = useState(false)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') {
    const file = e.target.files?.[0]
    if (file) onEditSide(side, file)
    e.target.value = ''
  }

  function downloadSide(dataUrl: string | null, side: 'front' | 'back') {
    if (!dataUrl) return
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `photocard-${side}.png`
    a.click()
  }

  function handleRemove() {
    setRemoving(true)
    const timeout = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 200
    setTimeout(onRemove, timeout)
  }

  return (
    <div className={`deck-card${removing ? ' deck-card--removing' : ''}`}>
      {confirmingRemove ? (
        <div className="deck-card__remove-confirm">
          <button
            className="deck-card__remove-yes"
            onClick={handleRemove}
            title="Confirm removal"
            aria-label="Confirm removal"
          >✓</button>
          <button
            className="deck-card__remove-no"
            onClick={() => setConfirmingRemove(false)}
            title="Cancel"
            aria-label="Cancel removal"
          >✕</button>
        </div>
      ) : (
        <button
          className="deck-card__remove"
          onClick={() => setConfirmingRemove(true)}
          title="Remove card"
          aria-label="Remove card"
        >
          ×
        </button>
      )}

      <div className="deck-card__thumbs">
        <div className="deck-card__thumb-col">
          <div className="deck-card__thumb">
            {card.front && <img src={card.front} alt="Front" />}
          </div>
          <span className="deck-card__side-label">Front</span>
          <div className="deck-card__side-actions">
            <button
              className="deck-card__edit"
              onClick={() => card.frontSrc ? onReEditSide('front') : frontInputRef.current?.click()}
            >Edit</button>
            {card.frontSrc && (
              <button className="deck-card__replace" onClick={() => frontInputRef.current?.click()} title="Upload a new image">Replace</button>
            )}
            <button className="deck-card__dl" onClick={() => downloadSide(card.front, 'front')} title="Download image" aria-label="Download front image">
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 1v7M3 6l3 3 3-3M1 10h10" />
              </svg>
            </button>
          </div>
          <input
            ref={frontInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            onChange={(e) => handleFileChange(e, 'front')}
            hidden
          />
        </div>

        <div className="deck-card__thumb-col">
          <div className="deck-card__thumb">
            {card.back && <img src={card.back} alt="Back" />}
          </div>
          <span className="deck-card__side-label">Back</span>
          <div className="deck-card__side-actions">
            <button
              className="deck-card__edit"
              onClick={() => card.backSrc ? onReEditSide('back') : backInputRef.current?.click()}
            >Edit</button>
            {card.backSrc && (
              <button className="deck-card__replace" onClick={() => backInputRef.current?.click()} title="Upload a new image">Replace</button>
            )}
            <button className="deck-card__dl" onClick={() => downloadSide(card.back, 'back')} title="Download image" aria-label="Download back image">
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 1v7M3 6l3 3 3-3M1 10h10" />
              </svg>
            </button>
          </div>
          <input
            ref={backInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            onChange={(e) => handleFileChange(e, 'back')}
            hidden
          />
        </div>
      </div>

      <div className="deck-card__copies">
        <button
          className="copies-btn"
          onClick={() => onCopiesChange(copies - 1)}
          disabled={copies <= 1}
        >
          −
        </button>
        <span className="copies-count">{copies}</span>
        <button
          className="copies-btn"
          onClick={() => onCopiesChange(copies + 1)}
          disabled={copies >= maxCopies}
        >
          +
        </button>
      </div>
    </div>
  )
}
