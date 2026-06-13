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
import type { Card } from './models/card'
import type { Deck } from './models/deck'

const KO_FI_URL = 'https://ko-fi.com/mattlau95'
const PRINT_SERVICE_URL = 'https://www.stickermule.com/uses/business-cards'

function AppHeader() {
  return (
    <header className="app-header">
      <div className="app-header__brand">
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
  | { id: 'crop-front'; imageSrc: string; editingPending?: Card }
  | { id: 'upload-back'; pendingCard: Card; pendingBackSrc?: string }
  | { id: 'crop-back'; imageSrc: string; pendingCard: Card; setAsShared: boolean }
  | { id: 'edit-side'; imageSrc: string; cardId: string; side: 'front' | 'back' }

function App() {
  const { deck, total, addCard, removeCard, setCopies, updateCard, setSharedBack } = useDeck()
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
    if (!step.imageSrc.startsWith('data:')) URL.revokeObjectURL(step.imageSrc)
    if (step.editingPending) {
      setStep({ id: 'upload-back', pendingCard: { ...step.editingPending, front: dataUrl } })
    } else {
      const card = createCard()
      card.front = dataUrl
      setStep({ id: 'upload-back', pendingCard: card })
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

  function handleBackConfirm(dataUrl: string) {
    if (step.id !== 'crop-back') return
    URL.revokeObjectURL(step.imageSrc)
    const card = { ...step.pendingCard, back: dataUrl }
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

  function handleEditConfirm(dataUrl: string) {
    if (step.id !== 'edit-side') return
    URL.revokeObjectURL(step.imageSrc)
    updateCard(step.cardId, { [step.side]: dataUrl })
    setStep({ id: 'idle' })
  }

  if (step.id === 'crop-front') {
    return (
      <div className="app">
        <AppHeader />
        <main className="app-main">
          <CropEditor
            imageSrc={step.imageSrc}
            label={step.editingPending ? 'Edit front' : 'Step 1 of 2 — Crop the front'}
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
        <AppHeader />
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
        <AppHeader />
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
        <AppHeader />
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
        <div className="app-header__brand">
          <div className="app-header__title-row">
            <img src="/icon-cards.png" className="app-header__icon-left" alt="" />
            <h1>pocalab</h1>
            <img src="/icon-dashes.png" className="app-header__icon-right" alt="" />
          </div>
          <span className="app-header__tagline">a K-pop photocard maker</span>
        </div>
        {total > 0 && (
          <span className="app-header__count">{total} / {DECK_MAX_CARDS} cards</span>
        )}
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
            {total < DECK_MAX_CARDS && (
              <label className="deck-bar__add btn btn--ghost">
                + Add
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFrontFile(f) }}
                  hidden
                />
              </label>
            )}
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
            <button className="btn btn--primary deck-bar__download" onClick={handleExport} disabled={exporting}>
              {exporting ? 'Generating…' : 'Download PDF'}
            </button>
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

      {cardAdded && <div className="toast">Card added to deck</div>}
    </div>
  )
}

export default App
