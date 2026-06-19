import { useRef, useState } from 'react'
import type { Card } from '../models/card'
import { Modal } from './Modal'
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
  hideCopies?: boolean
  onMoveTo?: (toDeckIndex: number) => void
  deckCount?: number
  deckIndex?: number
}

export function DeckCard({ card, copies, maxCopies, onCopiesChange, onRemove, onEditSide, onReEditSide, hideCopies, onMoveTo, deckCount = 1, deckIndex = 0 }: Props) {
  const frontInputRef = useRef<HTMLInputElement>(null)
  const backInputRef = useRef<HTMLInputElement>(null)
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [showMove, setShowMove] = useState(false)

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
      <button
        className="deck-card__remove"
        onClick={() => setConfirmingRemove(true)}
        title="Remove card"
        aria-label="Remove card"
      >
        <svg width="13" height="14" viewBox="0 0 13 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M1 3.5h11M4.5 3.5V2.5A.5.5 0 0 1 5 2h3a.5.5 0 0 1 .5.5v1M10.5 3.5l-.65 8a.5.5 0 0 1-.5.45H3.65a.5.5 0 0 1-.5-.45l-.65-8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {confirmingRemove && (
        <Modal onClose={() => setConfirmingRemove(false)}>
          <p className="deck-card__remove-prompt">Remove this card?</p>
          <div className="deck-card__remove-actions">
            <button className="btn btn--primary deck-card__remove-yes" onClick={handleRemove}>Remove</button>
            <button className="btn btn--ghost deck-card__remove-no" onClick={() => setConfirmingRemove(false)}>Cancel</button>
          </div>
        </Modal>
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
              aria-label="Edit front image"
            >Edit</button>
            {card.frontSrc && (
              <button className="deck-card__replace" onClick={() => frontInputRef.current?.click()} title="Upload a new image" aria-label="Replace front image">Replace</button>
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
              aria-label="Edit back image"
            >Edit</button>
            {card.backSrc && (
              <button className="deck-card__replace" onClick={() => backInputRef.current?.click()} title="Upload a new image" aria-label="Replace back image">Replace</button>
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

      {!hideCopies && (
        <div className="deck-card__copies">
          <button
            className="copies-btn"
            aria-label="Decrease copies"
            onClick={() => onCopiesChange(copies - 1)}
            disabled={copies <= 1}
          >
            −
          </button>
          <span className="copies-count" aria-live="polite" aria-atomic="true">{copies}</span>
          <button
            className="copies-btn"
            aria-label="Increase copies"
            onClick={() => onCopiesChange(copies + 1)}
            disabled={copies >= maxCopies}
          >
            +
          </button>
        </div>
      )}

      {onMoveTo && deckCount > 1 && (
        <div className="deck-card__move">
          {showMove ? (
            <div className="deck-card__move-options">
              <span className="deck-card__move-label">Move to:</span>
              {Array.from({ length: deckCount }, (_, i) => i).filter(i => i !== deckIndex).map(i => (
                <button
                  key={i}
                  className="deck-card__move-btn"
                  onClick={() => { onMoveTo(i); setShowMove(false) }}
                >
                  Sheet {i + 1}
                </button>
              ))}
              <button className="deck-card__move-cancel" onClick={() => setShowMove(false)}>✕</button>
            </div>
          ) : (
            <button className="deck-card__move-trigger" onClick={() => setShowMove(true)}>
              Move →
            </button>
          )}
        </div>
      )}
    </div>
  )
}
