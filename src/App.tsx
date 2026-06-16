import { useState } from 'react'
import './App.css'
import { useDeck } from './hooks/useDeck'
import { useBeforeUnload } from './hooks/useBeforeUnload'
import { ImageUpload } from './components/ImageUpload'
import { CropEditor } from './components/CropEditor'
import { DeckCard } from './components/DeckCard'
import { createCard } from './models/card'
import { DECK_MAX_CARDS } from './models/deck'
import type { PaperSize } from './utils/pdf'
import type { Card, CropState } from './models/card'
import type { Deck } from './models/deck'

const KO_FI_URL = 'https://ko-fi.com/mattlau95'
const PRINT_SERVICE_URL = 'https://www.stickermule.com/uses/business-cards'

function AppHeader({ onHome }: { onHome?: () => void }) {
  return (
    <header className="app-header">
      <div className="app-header__brand" onClick={onHome} style={onHome ? { cursor: 'pointer' } : undefined}>
        <div className="app-header__title-row">
          <img src="/icon-cards.png" className="app-header__icon-left" alt="" />
          <h1>pocalab</h1>
          <img src="/icon-dashes.png" className="app-header__icon-right" alt="" />
        </div>
        <span className="app-header__tagline">a K-pop photocard maker</span>
      </div>
      <a className="kofi-btn" href={KO_FI_URL} target="_blank" rel="noopener noreferrer">
        ☕ Support
      </a>
    </header>
  )
}

function expandDeck(deck: Deck) {
  const slots: { front: string | null; back: string | null }[] = []
  for (const card of deck.cards) {
    const count = deck.copies[card.id] ?? 1
    for (let i = 0; i < count; i++) slots.push({ front: card.front, back: card.back ?? deck.sharedBack })
  }
  return slots
}

type Step =
  | { id: 'idle' }
  | { id: 'crop-front'; imageSrc: string; editingPending?: Card; initialState?: CropState }
  | { id: 'upload-back'; pendingCard: Card; pendingBackSrc?: string }
  | { id: 'crop-back'; imageSrc: string; pendingCard: Card; setAsShared: boolean }
  | { id: 'edit-side'; imageSrc: string; cardId: string; side: 'front' | 'back'; initialState?: CropState }
  | { id: 'confirm-back-scope'; dataUrl: string; newSrc: string; state: CropState; cardId: string; sharingCardIds: string[] }

function App() {
  const { deck, total, addCard, removeCard, setCopies, updateCard, setSharedBack, clearDeck } = useDeck()
  const [step, setStep] = useState<Step>({ id: 'idle' })
  const [setAsShared, setSetAsShared] = useState(false)
  const [paperSize, setPaperSize] = useState<PaperSize>('letter')
  const [cardAdded, setCardAdded] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [showPrintTip, setShowPrintTip] = useState(false)
  useBeforeUnload(deck.cards.length > 0 || step.id !== 'idle')

  async function handleExport() {
    setExporting(true)
    setExportError(null)
    try {
      const { createPhotocardPdf } = await import('./utils/pdf')
      const bytes = await createPhotocardPdf(expandDeck(deck), paperSize)
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = 'photocards.pdf'
      a.click()
      URL.revokeObjectURL(url)
      setShowPrintTip(true)
    } catch {
      setExportError('PDF generation failed — please try again.')
    } finally {
      setExporting(false)
    }
  }

  function handleCancel() {
    if (step.id === 'crop-front') {
      if (!step.imageSrc.startsWith('data:')) URL.revokeObjectURL(step.imageSrc)
      if (step.editingPending) {
        setStep({ id: 'upload-back', pendingCard: step.editingPending })
      } else {
        setStep({ id: 'idle' })
      }
      return
    }
    if (step.id === 'upload-back') {
      if (!window.confirm('Discard this card? Your cropped front image will be lost.')) return
      if (step.pendingBackSrc) URL.revokeObjectURL(step.pendingBackSrc)
      if (step.pendingCard.frontSrc?.startsWith('blob:')) URL.revokeObjectURL(step.pendingCard.frontSrc)
      setSetAsShared(false)
      setStep({ id: 'idle' })
      return
    }
    if (step.id === 'crop-back') {
      // Go back to upload-back, preserve the file URL as pendingBackSrc
      setStep({ id: 'upload-back', pendingCard: step.pendingCard, pendingBackSrc: step.imageSrc })
      return
    }
    if (step.id === 'edit-side') {
      // Only revoke if this is a NEW file (not the card's stored src which we want to keep)
      const card = deck.cards.find(c => c.id === step.cardId)
      const storedSrc = step.side === 'front' ? card?.frontSrc : card?.backSrc
      if (step.imageSrc !== storedSrc && step.imageSrc.startsWith('blob:')) {
        URL.revokeObjectURL(step.imageSrc)
      }
    }
    setStep({ id: 'idle' })
  }

  function handleGoHome() {
    const hasDeck = total > 0
    const inFlow = step.id !== 'idle'
    if (!hasDeck && !inFlow) return
    const msg = hasDeck
      ? `Clear your deck${inFlow ? ' and cancel this crop' : ''}? This cannot be undone.`
      : 'Cancel this crop and start over?'
    if (!window.confirm(msg)) return

    // Revoke blob URLs for any in-progress work not yet tracked in the deck
    if (step.id === 'crop-front') {
      if (step.editingPending?.frontSrc?.startsWith('blob:')) URL.revokeObjectURL(step.editingPending.frontSrc)
      if (step.imageSrc.startsWith('blob:')) URL.revokeObjectURL(step.imageSrc)
    }
    if (step.id === 'upload-back') {
      if (step.pendingBackSrc) URL.revokeObjectURL(step.pendingBackSrc)
      if (step.pendingCard.frontSrc?.startsWith('blob:')) URL.revokeObjectURL(step.pendingCard.frontSrc)
    }
    if (step.id === 'crop-back') {
      URL.revokeObjectURL(step.imageSrc)
      if (step.pendingCard.frontSrc?.startsWith('blob:')) URL.revokeObjectURL(step.pendingCard.frontSrc)
    }
    if (step.id === 'edit-side') {
      // Card is in deck — clearDeck handles its stored src. Only revoke if imageSrc is a NEW file.
      const card = deck.cards.find(c => c.id === step.cardId)
      const storedSrc = step.side === 'front' ? card?.frontSrc : card?.backSrc
      if (step.imageSrc !== storedSrc && step.imageSrc.startsWith('blob:')) URL.revokeObjectURL(step.imageSrc)
    }
    if (step.id === 'confirm-back-scope') {
      const card = deck.cards.find(c => c.id === step.cardId)
      if (step.newSrc !== card?.backSrc && step.newSrc.startsWith('blob:')) URL.revokeObjectURL(step.newSrc)
    }

    clearDeck()
    setStep({ id: 'idle' })
  }

  // Front upload → crop
  function handleFrontFile(file: File) {
    setStep({ id: 'crop-front', imageSrc: URL.createObjectURL(file) })
  }

  function handleFrontConfirm(dataUrl: string, state: CropState) {
    if (step.id !== 'crop-front') return
    if (step.editingPending) {
      // Re-editing front from upload-back step — preserve existing frontSrc, update state
      setStep({ id: 'upload-back', pendingCard: { ...step.editingPending, front: dataUrl, frontState: state } })
    } else {
      // New upload — keep the blob URL and state for future re-editing
      const card = createCard()
      card.front = dataUrl
      setStep({ id: 'upload-back', pendingCard: { ...card, frontSrc: step.imageSrc, frontState: state } })
    }
  }

  // Back upload → crop
  function handleBackFile(file: File) {
    if (step.id !== 'upload-back') return
    if (step.pendingBackSrc) {
      if (!window.confirm('Replace the back image you already selected?')) return
      URL.revokeObjectURL(step.pendingBackSrc)
    }
    setStep({ id: 'crop-back', imageSrc: URL.createObjectURL(file), pendingCard: step.pendingCard, setAsShared })
  }

  function handleBackConfirm(dataUrl: string, state: CropState) {
    if (step.id !== 'crop-back') return
    const card = { ...step.pendingCard, back: dataUrl, backSrc: step.imageSrc, backState: state }
    addCard(card)
    if (step.setAsShared) setSharedBack(dataUrl)
    setSetAsShared(false)
    setStep({ id: 'idle' })
    setCardAdded(true)
    setTimeout(() => setCardAdded(false), 2000)
  }

  function handleUseExistingBack(dataUrl: string) {
    if (step.id !== 'upload-back') return
    if (step.pendingBackSrc) URL.revokeObjectURL(step.pendingBackSrc)
    addCard({ ...step.pendingCard, back: dataUrl })
    setSetAsShared(false)
    setStep({ id: 'idle' })
    setCardAdded(true)
    setTimeout(() => setCardAdded(false), 2000)
  }

  // Edit a side of an existing card
  function handleEditFile(cardId: string, side: 'front' | 'back', file: File) {
    setStep({ id: 'edit-side', imageSrc: URL.createObjectURL(file), cardId, side })
  }

  function handleReEditSide(cardId: string, side: 'front' | 'back') {
    const card = deck.cards.find(c => c.id === cardId)
    if (!card) return
    const src = side === 'front' ? card.frontSrc : card.backSrc
    if (!src) return
    const savedState = side === 'front' ? card.frontState : card.backState
    setStep({ id: 'edit-side', imageSrc: src, cardId, side, initialState: savedState })
  }

  function handleEditConfirm(dataUrl: string, state: CropState) {
    if (step.id !== 'edit-side') return

    const card = deck.cards.find(c => c.id === step.cardId)
    const oldSrc = step.side === 'front' ? card?.frontSrc : card?.backSrc
    if (oldSrc && oldSrc !== step.imageSrc && oldSrc.startsWith('blob:')) {
      URL.revokeObjectURL(oldSrc)
    }

    if (step.side === 'back') {
      const originalBack = card?.back
      const sharingCardIds = deck.cards
        .filter(c => c.id !== step.cardId && c.back !== null && c.back === originalBack)
        .map(c => c.id)

      if (sharingCardIds.length > 0) {
        setStep({ id: 'confirm-back-scope', dataUrl, newSrc: step.imageSrc, state, cardId: step.cardId, sharingCardIds })
        return
      }
    }

    const srcKey = step.side === 'front' ? 'frontSrc' : 'backSrc'
    const stateKey = step.side === 'front' ? 'frontState' : 'backState'
    updateCard(step.cardId, { [step.side]: dataUrl, [srcKey]: step.imageSrc, [stateKey]: state })
    setStep({ id: 'idle' })
  }

  function handleBackScopeJustThis() {
    if (step.id !== 'confirm-back-scope') return
    updateCard(step.cardId, { back: step.dataUrl, backSrc: step.newSrc, backState: step.state })
    setStep({ id: 'idle' })
  }

  function handleBackScopeAll() {
    if (step.id !== 'confirm-back-scope') return
    updateCard(step.cardId, { back: step.dataUrl, backSrc: step.newSrc, backState: step.state })
    for (const id of step.sharingCardIds) {
      updateCard(id, { back: step.dataUrl, backSrc: undefined, backState: undefined })
    }
    setStep({ id: 'idle' })
  }

  function handleBackScopeCancel() {
    if (step.id !== 'confirm-back-scope') return
    const card = deck.cards.find(c => c.id === step.cardId)
    if (step.newSrc !== card?.backSrc && step.newSrc.startsWith('blob:')) {
      URL.revokeObjectURL(step.newSrc)
    }
    setStep({ id: 'idle' })
  }

  if (step.id === 'crop-front') {
    return (
      <div className="app">
        <AppHeader onHome={handleGoHome} />
        <main className="app-main">
          <CropEditor
            imageSrc={step.imageSrc}
            label={step.editingPending ? 'Edit front' : 'Step 1 of 2 — Crop the front'}
            initialState={step.initialState}
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
        <AppHeader onHome={handleGoHome} />
        <main className="app-main">
          <div className="upload-back">
            <div className="upload-back__preview">
              <div className="upload-back__thumb">
                {step.pendingCard.front && (
                  <img src={step.pendingCard.front} alt="Card front" />
                )}
              </div>
              <span className="upload-back__front-label">Front</span>
              <button
                className="btn btn--ghost upload-back__edit-btn"
                onClick={() =>
                  setStep({
                    id: 'crop-front',
                    imageSrc: step.pendingCard.front!,
                    editingPending: step.pendingCard,
                    initialState: step.pendingCard.frontState,
                  })
                }
              >
                Edit
              </button>
            </div>

            <div className="upload-back__content">
              <p className="upload-back__step">Step 2 of 2 — Add the card back</p>

              {(() => {
                const knownBacks = [...new Set(
                  deck.cards.map(c => c.back).filter((b): b is string => b !== null)
                )]
                return knownBacks.length > 0 ? (
                  <>
                    <p className="upload-back__step" style={{ marginBottom: -4 }}>Previously used backs</p>
                    <div className="back-gallery">
                      {knownBacks.map((dataUrl, i) => (
                        <button
                          key={i}
                          className="back-gallery__thumb"
                          onClick={() => handleUseExistingBack(dataUrl)}
                          title="Use this back"
                        >
                          <img src={dataUrl} alt={`Back option ${i + 1}`} />
                        </button>
                      ))}
                    </div>
                    <div className="upload-back__divider">or upload different</div>
                  </>
                ) : null
              })()}

              <ImageUpload onFile={handleBackFile} />

              <label className="upload-back__set-shared">
                <input
                  type="checkbox"
                  checked={setAsShared}
                  onChange={e => setSetAsShared(e.target.checked)}
                />
                Set as shared back for all cards
              </label>

              <div className="upload-back__actions">
                <button className="btn btn--ghost" onClick={handleCancel}>Start over</button>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (step.id === 'crop-back') {
    return (
      <div className="app">
        <AppHeader onHome={handleGoHome} />
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
        <AppHeader onHome={handleGoHome} />
        <main className="app-main">
          <CropEditor
            imageSrc={step.imageSrc}
            label={`Edit ${step.side}`}
            initialState={step.initialState}
            onConfirm={handleEditConfirm}
            onCancel={handleCancel}
          />
        </main>
      </div>
    )
  }

  if (step.id === 'confirm-back-scope') {
    const count = step.sharingCardIds.length
    return (
      <div className="app">
        <AppHeader onHome={handleGoHome} />
        <main className="app-main">
          <div className="back-scope">
            <div className="back-scope__thumb">
              <img src={step.dataUrl} alt="New back" />
            </div>
            <p className="back-scope__title">Save to how many cards?</p>
            <p className="back-scope__desc">
              {count} other {count === 1 ? 'card' : 'cards'} in your deck {count === 1 ? 'uses' : 'use'} this same back.
            </p>
            <div className="back-scope__actions">
              <button className="btn btn--ghost" onClick={handleBackScopeCancel}>Cancel</button>
              <button className="btn btn--ghost" onClick={handleBackScopeJustThis}>Just this card</button>
              <button className="btn btn--primary" onClick={handleBackScopeAll}>Update all {count + 1} cards</button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__brand" onClick={handleGoHome} style={{ cursor: total > 0 ? 'pointer' : undefined }}>
          <div className="app-header__title-row">
            <img src="/icon-cards.png" className="app-header__icon-left" alt="" />
            <h1>pocalab</h1>
            <img src="/icon-dashes.png" className="app-header__icon-right" alt="" />
          </div>
          <span className="app-header__tagline">a K-pop photocard maker</span>
        </div>
        <span className="app-header__count" aria-live="polite" aria-atomic="true">{total} / {DECK_MAX_CARDS} cards</span>
        <a className="kofi-btn" href={KO_FI_URL} target="_blank" rel="noopener noreferrer">☕ Support</a>
      </header>

      <main className={`app-main${deck.cards.length > 0 ? ' app-main--with-bar' : ''}`}>
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
                onReEditSide={(side) => handleReEditSide(card.id, side)}
              />
            ))}
          </div>
        )}

        {deck.cards.length > 0 && (
          <div className="deck-actions deck-actions--desktop">
            <div className="paper-size-toggle">
              <button
                className={`paper-size-btn${paperSize === 'letter' ? ' paper-size-btn--on' : ''}`}
                onClick={() => setPaperSize('letter')}
              >
                US Letter
              </button>
              <button
                className={`paper-size-btn${paperSize === 'a4' ? ' paper-size-btn--on' : ''}`}
                onClick={() => setPaperSize('a4')}
              >
                A4
              </button>
            </div>
            <button className="btn btn--primary" onClick={handleExport} disabled={exporting}>
              {exporting ? 'Generating…' : 'Download PDF'}
            </button>
            {exportError && <p className="deck-actions__error">{exportError}</p>}
          </div>
        )}

        {deck.cards.length > 0 && (
          <div className="deck-bar">
            <div className="deck-bar__toggle-row">
              <div className="paper-size-toggle">
                <button
                  className={`paper-size-btn${paperSize === 'letter' ? ' paper-size-btn--on' : ''}`}
                  onClick={() => setPaperSize('letter')}
                >
                  US Letter
                </button>
                <button
                  className={`paper-size-btn${paperSize === 'a4' ? ' paper-size-btn--on' : ''}`}
                  onClick={() => setPaperSize('a4')}
                >
                  A4
                </button>
              </div>
            </div>
            <div className="deck-bar__actions">
              {total < DECK_MAX_CARDS && (
                <label className="deck-bar__add">
                  + Add image
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFrontFile(f) }}
                    hidden
                  />
                </label>
              )}
              <div className="deck-bar__right">
                <button className="btn btn--primary deck-bar__download" onClick={handleExport} disabled={exporting}>
                  {exporting ? 'Generating…' : 'Download PDF'}
                </button>
                {exportError && <p className="deck-bar__error">{exportError}</p>}
              </div>
            </div>
          </div>
        )}

        {showPrintTip && (
          <div className="print-tip">
            <span>Want professional prints? Try</span>
            <a href={PRINT_SERVICE_URL} target="_blank" rel="noopener noreferrer" className="print-tip__link">
              Sticker Mule →
            </a>
            <button className="print-tip__dismiss" onClick={() => setShowPrintTip(false)} aria-label="Dismiss">×</button>
          </div>
        )}

        {total < DECK_MAX_CARDS && (
          <div className={deck.cards.length > 0 ? 'deck-upload' : undefined}>
            <ImageUpload onFile={handleFrontFile} />
          </div>
        )}

        {total >= DECK_MAX_CARDS && (
          <p className="deck-full">Deck is full — remove a card or reduce copies to add more.</p>
        )}
      </main>

      {cardAdded && <div className="toast" role="status" aria-live="polite">Card added to deck</div>}
    </div>
  )
}

export default App
