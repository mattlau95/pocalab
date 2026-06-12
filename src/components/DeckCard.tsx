import { useRef } from 'react'
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
}

export function DeckCard({ card, copies, maxCopies, onCopiesChange, onRemove, onEditSide }: Props) {
  const frontInputRef = useRef<HTMLInputElement>(null)
  const backInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') {
    const file = e.target.files?.[0]
    if (file) onEditSide(side, file)
    e.target.value = ''
  }

  return (
    <div className="deck-card">
      <button
        className="deck-card__remove"
        onClick={() => { if (window.confirm('Remove this card from your deck?')) onRemove() }}
        title="Remove card"
        aria-label="Remove card"
      >
        ×
      </button>

      <div className="deck-card__thumbs">
        <div className="deck-card__thumb-col">
          <div className="deck-card__thumb">
            {card.front && <img src={card.front} alt="Front" />}
          </div>
          <span className="deck-card__side-label">Front</span>
          <button className="deck-card__edit" onClick={() => frontInputRef.current?.click()}>
            Edit
          </button>
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
          <button className="deck-card__edit" onClick={() => backInputRef.current?.click()}>
            Edit
          </button>
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
