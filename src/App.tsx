import { useState } from 'react'
import './App.css'
import { useDeck } from './hooks/useDeck'
import { useBeforeUnload } from './hooks/useBeforeUnload'
import { ImageUpload } from './components/ImageUpload'
import { CropEditor } from './components/CropEditor'
import { DeckCard } from './components/DeckCard'
import { createCard } from './models/card'
import { DECK_MAX_CARDS } from './models/deck'
import type { Card } from './models/card'

type Step =
  | { id: 'idle' }
  | { id: 'crop-front'; imageSrc: string }
  | { id: 'upload-back'; pendingCard: Card }
  | { id: 'crop-back'; imageSrc: string; pendingCard: Card }
  | { id: 'edit-side'; imageSrc: string; cardId: string; side: 'front' | 'back' }

function App() {
  const { deck, total, addCard, removeCard, setCopies, updateCard } = useDeck()
  const [step, setStep] = useState<Step>({ id: 'idle' })
  useBeforeUnload(deck.cards.length > 0 || step.id !== 'idle')

  function handleCancel() {
    if (step.id === 'crop-front' || step.id === 'crop-back' || step.id === 'edit-side') {
      URL.revokeObjectURL(step.imageSrc)
    }
    setStep({ id: 'idle' })
  }

  // Front upload → crop
  function handleFrontFile(file: File) {
    setStep({ id: 'crop-front', imageSrc: URL.createObjectURL(file) })
  }

  function handleFrontConfirm(dataUrl: string) {
    if (step.id !== 'crop-front') return
    URL.revokeObjectURL(step.imageSrc)
    const card = createCard()
    card.front = dataUrl
    setStep({ id: 'upload-back', pendingCard: card })
  }

  // Back upload → crop
  function handleBackFile(file: File) {
    if (step.id !== 'upload-back') return
    setStep({ id: 'crop-back', imageSrc: URL.createObjectURL(file), pendingCard: step.pendingCard })
  }

  function handleBackConfirm(dataUrl: string) {
    if (step.id !== 'crop-back') return
    URL.revokeObjectURL(step.imageSrc)
    const card = { ...step.pendingCard, back: dataUrl }
    addCard(card)
    setStep({ id: 'idle' })
  }

  // Edit a side of an existing card
  function handleEditFile(cardId: string, side: 'front' | 'back', file: File) {
    setStep({ id: 'edit-side', imageSrc: URL.createObjectURL(file), cardId, side })
  }

  function handleEditConfirm(dataUrl: string) {
    if (step.id !== 'edit-side') return
    URL.revokeObjectURL(step.imageSrc)
    updateCard(step.cardId, { [step.side]: dataUrl })
    setStep({ id: 'idle' })
  }

  if (step.id === 'crop-front') {
    return (
      <div className="app">
        <header className="app-header">
          <h1>Photocard Generator</h1>
        </header>
        <main className="app-main">
          <CropEditor
            imageSrc={step.imageSrc}
            label="Step 1 of 2 — Crop the front"
            onConfirm={handleFrontConfirm}
            onCancel={handleCancel}
          />
        </main>
      </div>
    )
  }

  if (step.id === 'upload-back') {
    return (
      <div className="app">
        <header className="app-header">
          <h1>Photocard Generator</h1>
        </header>
        <main className="app-main">
          <div className="upload-back">
            <p className="upload-back__step">Step 2 of 2 — Add the card back</p>
            <ImageUpload onFile={handleBackFile} />
            <div className="upload-back__actions">
              <button className="btn btn--ghost" onClick={handleCancel}>Cancel</button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (step.id === 'crop-back') {
    return (
      <div className="app">
        <header className="app-header">
          <h1>Photocard Generator</h1>
        </header>
        <main className="app-main">
          <CropEditor
            imageSrc={step.imageSrc}
            label="Step 2 of 2 — Crop the back"
            onConfirm={handleBackConfirm}
            onCancel={handleCancel}
          />
        </main>
      </div>
    )
  }

  if (step.id === 'edit-side') {
    return (
      <div className="app">
        <header className="app-header">
          <h1>Photocard Generator</h1>
        </header>
        <main className="app-main">
          <CropEditor
            imageSrc={step.imageSrc}
            label={`Edit ${step.side}`}
            onConfirm={handleEditConfirm}
            onCancel={handleCancel}
          />
        </main>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Photocard Generator</h1>
        {total > 0 && (
          <span className="app-header__count">{total} / {DECK_MAX_CARDS} cards</span>
        )}
      </header>

      <main className="app-main">
        {deck.cards.length > 0 && (
          <div className="deck-grid">
            {deck.cards.map((card) => (
              <DeckCard
                key={card.id}
                card={card}
                copies={deck.copies[card.id] ?? 1}
                maxCopies={DECK_MAX_CARDS - total + (deck.copies[card.id] ?? 1)}
                onCopiesChange={(count) => setCopies(card.id, count)}
                onRemove={() => removeCard(card.id)}
                onEditSide={(side, file) => handleEditFile(card.id, side, file)}
              />
            ))}
          </div>
        )}

        {total < DECK_MAX_CARDS && (
          <ImageUpload onFile={handleFrontFile} />
        )}

        {total >= DECK_MAX_CARDS && (
          <p className="deck-full">Deck is full — remove a card or reduce copies to add more.</p>
        )}
      </main>
    </div>
  )
}

export default App
