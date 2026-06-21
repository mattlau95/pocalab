import { useState, useEffect, useRef } from 'react'
import './App.css'
import { useProject, deckTotal } from './hooks/useProject'
import { PRESETS, type PrintPreset } from './models/preset'
import { useBeforeUnload } from './hooks/useBeforeUnload'
import { ImageUpload } from './components/ImageUpload'
import { CropEditor } from './components/CropEditor'
import { DeckCard } from './components/DeckCard'
import { SheetPreview } from './components/SheetPreview'
import { Modal } from './components/Modal'
import { createCard } from './models/card'
import type { Card, CropState } from './models/card'
import type { Deck } from './models/deck'

const KO_FI_URL = 'https://ko-fi.com/mattlau95'
const FEEDBACK_FORM_URL = 'https://forms.gle/j3aj9NYF35ZJDkSn9'

const EXAMPLE_BACKS = [
  { src: '/photocard-back-examples/photocard-back-example-1_album.webp',     label: 'album' },
  { src: '/photocard-back-examples/photocard-back-example-2_logo.webp',      label: 'logo' },
  { src: '/photocard-back-examples/photocard-back-example-3_signature.webp', label: 'signature' },
]

const EXAMPLE_FRONTS = [
  { src: '/photocard-front-examples/photocard-front-example-1-selfie.webp',   label: 'selfie' },
  { src: '/photocard-front-examples/photocard-front-example-2-portrait.webp', label: 'portrait' },
  { src: '/photocard-front-examples/photocard-front-example-3-concert.webp',  label: 'concert' },
  { src: '/photocard-front-examples/photocard-front-example-4-group.webp',    label: 'group' },
]

const PRESET_DIMS: Record<string, string> = {
  'letter':  '8.5×11"',
  'a4':      '210×297mm',
  '4x6-2up': '4×6"',
  '5x7-2up': '5×7"',
  '5x7-3up': '5×7"',
  '5x7-4up': '5×7"',
}

function SheetIcon({ cols, rows }: { cols: number; rows: number }) {
  const W = 24, H = 32, bw = 1, pad = 2.5, gap = 1
  const innerW = W - bw * 2 - pad * 2
  const innerH = H - bw * 2 - pad * 2
  const cellW = (innerW - gap * (cols - 1)) / cols
  const cellH = (innerH - gap * (rows - 1)) / rows
  const cells: { x: number; y: number }[] = []
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      cells.push({ x: bw + pad + c * (cellW + gap), y: bw + pad + r * (cellH + gap) })
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none" aria-hidden="true">
      <rect x={bw / 2} y={bw / 2} width={W - bw} height={H - bw} rx="2" stroke="currentColor" strokeOpacity="0.4" strokeWidth={bw} />
      {cells.map((cell, i) => (
        <rect key={i} x={cell.x} y={cell.y} width={cellW} height={cellH} rx="0.5" fill="currentColor" fillOpacity="0.6" />
      ))}
    </svg>
  )
}

function DeckPaperLabel({ preset }: { preset: PrintPreset }) {
  const dims = PRESET_DIMS[preset.id] ?? ''
  const isNUp = preset.label.toLowerCase().includes('-up')
  return (
    <div className="deck-paper-label">
      <SheetIcon cols={preset.cols} rows={preset.rows} />
      <span className="deck-paper-label__name">
        {isNUp ? `${dims} (${preset.nUp} cards)` : `${preset.label} ${dims} (${preset.nUp} cards)`}
      </span>
    </div>
  )
}

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
  | { id: 'crop-front'; imageSrc: string; editingPending?: Card; initialState?: CropState; targetDeck: number }
  | { id: 'upload-back'; pendingCard: Card; pendingBackSrc?: string; targetDeck: number }
  | { id: 'crop-back'; imageSrc: string; pendingCard: Card; setAsShared: boolean; targetDeck: number }
  | { id: 'edit-side'; imageSrc: string; cardId: string; side: 'front' | 'back'; initialState?: CropState; deckIndex: number }
  | { id: 'confirm-back-scope'; dataUrl: string; newSrc: string; state: CropState; cardId: string; sharingCardIds: string[]; deckIndex: number }

function App() {
  const { project, storageWriteError, setPreset, addCard, removeCard, setCopies, updateCard, setSharedBack, addDeck, removeDeck, moveCard, resetProject } = useProject()
  const nUp = project.preset.nUp
  const [step, setStep] = useState<Step>({ id: 'idle' })
  const [setAsShared, setSetAsShared] = useState(false)
  const [cardAdded, setCardAdded] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exportErrorDeckIndex, setExportErrorDeckIndex] = useState<number | null>(null)
  const [showFeedbackPrompt, setShowFeedbackPrompt] = useState(false)
  const [splitToast, setSplitToast] = useState<string | null>(null)
  const [storageToast, setStorageToast] = useState<string | null>(null)
  const [previewDeckIndex, setPreviewDeckIndex] = useState<number | null>(null)
  const prevDeckCount = useRef(project.decks.length)
  const justSwitchedPreset = useRef(false)

  const anyCards = project.decks.some(d => d.cards.length > 0)
  const totalCards = project.decks.reduce((sum, d) => sum + d.cards.length, 0)
  const isPhotoPaper = !['letter', 'a4'].includes(project.preset.id)

  useBeforeUnload(anyCards || step.id !== 'idle')

  useEffect(() => {
    if (justSwitchedPreset.current && project.decks.length > prevDeckCount.current && project.decks.length > 1) {
      setSplitToast(`Cards split across ${project.decks.length} sheets`)
      const t = setTimeout(() => setSplitToast(null), 3000)
      prevDeckCount.current = project.decks.length
      justSwitchedPreset.current = false
      return () => clearTimeout(t)
    }
    justSwitchedPreset.current = false
    prevDeckCount.current = project.decks.length
  }, [project.decks.length])

  useEffect(() => {
    if (storageWriteError) setStorageToast(storageWriteError)
  }, [storageWriteError])

  function firstAvailableDeck() {
    return Math.max(0, project.decks.findIndex(d => deckTotal(d) < nUp))
  }

  function triggerDownload(bytes: Uint8Array, filename: string) {
    const url = URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' }))
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleExport(deckIndex = 0) {
    setExporting(true)
    setExportError(null)
    try {
      const deck = project.decks[deckIndex]
      if (!deck) return
      if (isPhotoPaper) {
        const { buildPrintPdf } = await import('./utils/printPdf')
        const bytes = await buildPrintPdf(project.preset, deck)
        triggerDownload(bytes, project.decks.length > 1 ? `sheet-${deckIndex + 1}.pdf` : 'sheet-1.pdf')
      } else {
        const { createPhotocardPdf } = await import('./utils/pdf')
        const paperSize = (project.preset.id === 'a4' ? 'a4' : 'letter') as 'letter' | 'a4'
        const bytes = await createPhotocardPdf(expandDeck(deck), paperSize)
        triggerDownload(bytes, 'photocards.pdf')
      }
      setShowFeedbackPrompt(true)
    } catch {
      setExportError('PDF generation failed — please try again.')
      setExportErrorDeckIndex(deckIndex)
    } finally {
      setExporting(false)
    }
  }

  async function handleExportAll() {
    setExporting(true)
    setExportError(null)
    try {
      const { buildPrintPdf } = await import('./utils/printPdf')
      const { PDFDocument } = await import('pdf-lib')
      const combined = await PDFDocument.create()
      for (const d of project.decks) {
        if (d.cards.length === 0) continue
        const sheetBytes = await buildPrintPdf(project.preset, d)
        const sheetDoc = await PDFDocument.load(sheetBytes)
        const pages = await combined.copyPages(sheetDoc, sheetDoc.getPageIndices())
        pages.forEach(p => combined.addPage(p))
      }
      const bytes = await combined.save()
      triggerDownload(bytes, 'photocards-all.pdf')
      setShowFeedbackPrompt(true)
    } catch {
      setExportError('PDF generation failed — please try again.')
      setExportErrorDeckIndex(null)
    } finally {
      setExporting(false)
    }
  }

  function handleCancel() {
    if (step.id === 'crop-front') {
      if (!step.imageSrc.startsWith('data:')) URL.revokeObjectURL(step.imageSrc)
      if (step.editingPending) {
        setStep({ id: 'upload-back', pendingCard: step.editingPending, targetDeck: step.targetDeck })
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
      setStep({ id: 'upload-back', pendingCard: step.pendingCard, pendingBackSrc: step.imageSrc, targetDeck: step.targetDeck })
      return
    }
    if (step.id === 'edit-side') {
      const card = project.decks[step.deckIndex]?.cards.find(c => c.id === step.cardId)
      const storedSrc = step.side === 'front' ? card?.frontSrc : card?.backSrc
      if (step.imageSrc !== storedSrc && step.imageSrc.startsWith('blob:')) {
        URL.revokeObjectURL(step.imageSrc)
      }
    }
    setStep({ id: 'idle' })
  }

  function handleGoHome() {
    const inFlow = step.id !== 'idle'
    if (!anyCards && !inFlow) return
    const msg = anyCards
      ? `Clear your deck${inFlow ? ' and cancel this crop' : ''}? This cannot be undone.`
      : 'Cancel this crop and start over?'
    if (!window.confirm(msg)) return

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
      const card = project.decks[step.deckIndex]?.cards.find(c => c.id === step.cardId)
      const storedSrc = step.side === 'front' ? card?.frontSrc : card?.backSrc
      if (step.imageSrc !== storedSrc && step.imageSrc.startsWith('blob:')) URL.revokeObjectURL(step.imageSrc)
    }
    if (step.id === 'confirm-back-scope') {
      const card = project.decks[step.deckIndex]?.cards.find(c => c.id === step.cardId)
      if (step.newSrc !== card?.backSrc && step.newSrc.startsWith('blob:')) URL.revokeObjectURL(step.newSrc)
    }

    resetProject()
    setStep({ id: 'idle' })
  }

  function handleRemoveDeck(deckIndex: number) {
    const deck = project.decks[deckIndex]
    if (deck && deck.cards.length > 0) {
      if (!window.confirm(`Remove Sheet ${deckIndex + 1} and its ${deck.cards.length} card${deck.cards.length !== 1 ? 's' : ''}?`)) return
    }
    removeDeck(deckIndex)
  }

  function handleFrontFile(file: File, targetDeck: number) {
    setStep({ id: 'crop-front', imageSrc: URL.createObjectURL(file), targetDeck })
  }

  function handleFrontConfirm(dataUrl: string, state: CropState) {
    if (step.id !== 'crop-front') return
    if (step.editingPending) {
      setStep({ id: 'upload-back', pendingCard: { ...step.editingPending, front: dataUrl, frontState: state }, targetDeck: step.targetDeck })
    } else {
      const card = createCard()
      card.front = dataUrl
      setStep({ id: 'upload-back', pendingCard: { ...card, frontSrc: step.imageSrc, frontState: state }, targetDeck: step.targetDeck })
    }
  }

  function handleBackFile(file: File) {
    if (step.id !== 'upload-back') return
    if (step.pendingBackSrc) {
      if (!window.confirm('Replace the back image you already selected?')) return
      URL.revokeObjectURL(step.pendingBackSrc)
    }
    setStep({ id: 'crop-back', imageSrc: URL.createObjectURL(file), pendingCard: step.pendingCard, setAsShared, targetDeck: step.targetDeck })
  }

  function handleBackConfirm(dataUrl: string, state: CropState) {
    if (step.id !== 'crop-back') return
    const card = { ...step.pendingCard, back: dataUrl, backSrc: step.imageSrc, backState: state }
    addCard(step.targetDeck, card)
    if (step.setAsShared) setSharedBack(step.targetDeck, dataUrl)
    setSetAsShared(false)
    setStep({ id: 'idle' })
    setCardAdded(true)
    setTimeout(() => setCardAdded(false), 2000)
  }

  function handleUseExistingBack(dataUrl: string) {
    if (step.id !== 'upload-back') return
    if (step.pendingBackSrc) URL.revokeObjectURL(step.pendingBackSrc)
    addCard(step.targetDeck, { ...step.pendingCard, back: dataUrl })
    setSetAsShared(false)
    setStep({ id: 'idle' })
    setCardAdded(true)
    setTimeout(() => setCardAdded(false), 2000)
  }

  function handleEditFile(cardId: string, side: 'front' | 'back', file: File, deckIndex: number) {
    setStep({ id: 'edit-side', imageSrc: URL.createObjectURL(file), cardId, side, deckIndex })
  }

  function handleReEditSide(cardId: string, side: 'front' | 'back', deckIndex: number) {
    const card = project.decks[deckIndex]?.cards.find(c => c.id === cardId)
    if (!card) return
    const src = side === 'front' ? card.frontSrc : card.backSrc
    if (!src) return
    const savedState = side === 'front' ? card.frontState : card.backState
    setStep({ id: 'edit-side', imageSrc: src, cardId, side, initialState: savedState, deckIndex })
  }

  function handleEditConfirm(dataUrl: string, state: CropState) {
    if (step.id !== 'edit-side') return

    const deck = project.decks[step.deckIndex]
    const card = deck?.cards.find(c => c.id === step.cardId)
    const oldSrc = step.side === 'front' ? card?.frontSrc : card?.backSrc
    if (oldSrc && oldSrc !== step.imageSrc && oldSrc.startsWith('blob:')) {
      URL.revokeObjectURL(oldSrc)
    }

    if (step.side === 'back') {
      const originalBack = card?.back
      const sharingCardIds = (deck?.cards ?? [])
        .filter(c => c.id !== step.cardId && c.back !== null && c.back === originalBack)
        .map(c => c.id)

      if (sharingCardIds.length > 0) {
        setStep({ id: 'confirm-back-scope', dataUrl, newSrc: step.imageSrc, state, cardId: step.cardId, sharingCardIds, deckIndex: step.deckIndex })
        return
      }
    }

    const srcKey = step.side === 'front' ? 'frontSrc' : 'backSrc'
    const stateKey = step.side === 'front' ? 'frontState' : 'backState'
    updateCard(step.deckIndex, step.cardId, { [step.side]: dataUrl, [srcKey]: step.imageSrc, [stateKey]: state })
    setStep({ id: 'idle' })
  }

  function handleBackScopeJustThis() {
    if (step.id !== 'confirm-back-scope') return
    updateCard(step.deckIndex, step.cardId, { back: step.dataUrl, backSrc: step.newSrc, backState: step.state })
    setStep({ id: 'idle' })
  }

  function handleBackScopeAll() {
    if (step.id !== 'confirm-back-scope') return
    updateCard(step.deckIndex, step.cardId, { back: step.dataUrl, backSrc: step.newSrc, backState: step.state })
    for (const id of step.sharingCardIds) {
      updateCard(step.deckIndex, id, { back: step.dataUrl, backSrc: undefined, backState: undefined })
    }
    setStep({ id: 'idle' })
  }

  function handleBackScopeCancel() {
    if (step.id !== 'confirm-back-scope') return
    const card = project.decks[step.deckIndex]?.cards.find(c => c.id === step.cardId)
    if (step.newSrc !== card?.backSrc && step.newSrc.startsWith('blob:')) {
      URL.revokeObjectURL(step.newSrc)
    }
    setStep({ id: 'idle' })
  }

  if (step.id === 'crop-front') {
    return (
      <div className="app">
        <AppHeader onHome={handleGoHome} />
        <main id="main-content" className="app-main">
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
    const targetDeckCards = project.decks[step.targetDeck]?.cards ?? []
    const knownBacks = [...new Set(
      targetDeckCards.map(c => c.back).filter((b): b is string => b !== null)
    )]
    return (
      <div className="app">
        <AppHeader onHome={handleGoHome} />
        <main id="main-content" className="app-main">
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
                    targetDeck: step.targetDeck,
                  })
                }
              >
                Edit
              </button>
            </div>

            <div className="upload-back__content">
              <p className="upload-back__step">Step 2 of 2 — Add the card back</p>

              {knownBacks.length > 0 && (
                <>
                  <p className="upload-back__step" style={{ marginBottom: -4 }}>Previously used</p>
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
                </>
              )}

              <p className="upload-back__step" style={{ marginBottom: -4 }}>Examples</p>
              <div className="back-gallery">
                {EXAMPLE_BACKS.map((item, i) => (
                  <div key={`eg-${i}`} className="back-gallery-item">
                    <div className="back-gallery__thumb back-gallery__thumb--static">
                      <img src={item.src} alt={`Example back: ${item.label}`} />
                    </div>
                    <span className="back-gallery-item__label">{item.label}</span>
                  </div>
                ))}
              </div>

              <div className="upload-back__divider">
                {knownBacks.length > 0 ? 'or upload different' : 'or upload your own'}
              </div>

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
        <main id="main-content" className="app-main">
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
    const editStep = step
    return (
      <div className="app">
        <AppHeader onHome={handleGoHome} />
        <main id="main-content" className="app-main">
          <CropEditor
            imageSrc={editStep.imageSrc}
            label={`Edit ${editStep.side}`}
            initialState={editStep.initialState}
            onConfirm={handleEditConfirm}
            onCancel={handleCancel}
            onReplace={(file) => {
              const card = project.decks[editStep.deckIndex]?.cards.find(c => c.id === editStep.cardId)
              const storedSrc = editStep.side === 'front' ? card?.frontSrc : card?.backSrc
              if (editStep.imageSrc !== storedSrc && editStep.imageSrc.startsWith('blob:')) {
                URL.revokeObjectURL(editStep.imageSrc)
              }
              setStep({ id: 'edit-side', imageSrc: URL.createObjectURL(file), cardId: editStep.cardId, side: editStep.side, deckIndex: editStep.deckIndex })
            }}
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
        <main id="main-content" className="app-main">
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

  const headerCount = project.decks.length > 1
    ? `${totalCards} cards · ${project.decks.length} sheets`
    : `${deckTotal(project.decks[0])} / ${nUp} cards`

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__brand" onClick={handleGoHome} style={{ cursor: anyCards ? 'pointer' : undefined }}>
          <div className="app-header__title-row">
            <img src="/icon-cards.png" className="app-header__icon-left" alt="" />
            <h1>pocalab</h1>
            <img src="/icon-dashes.png" className="app-header__icon-right" alt="" />
          </div>
          <span className="app-header__tagline">a K-pop photocard maker</span>
        </div>
        <span className="app-header__count" aria-live="polite" aria-atomic="true">{headerCount}</span>
        <a className="kofi-btn" href={KO_FI_URL} target="_blank" rel="noopener noreferrer">☕ Support</a>
      </header>

      <main id="main-content" className={`app-main${anyCards ? ' app-main--with-bar' : ''}`}>

        {anyCards && (
          <div className="deck-list__label">
            <DeckPaperLabel preset={project.preset} />
          </div>
        )}

        {project.decks.map((deck, di) => {
          if (deck.cards.length === 0 && project.decks.length === 1) return null
          const dTotal = deckTotal(deck)
          const isFull = dTotal >= nUp
          return (
            <div key={di} className="deck-section">

              {/* LEFT — card grid and add/full controls */}
              <div className="deck-section__body">
                {deck.cards.length > 0 && (
                  <div className="deck-grid">
                    {deck.cards.map((card) => (
                      <DeckCard
                        key={card.id}
                        card={card}
                        copies={deck.copies[card.id] ?? 1}
                        maxCopies={nUp - dTotal + (deck.copies[card.id] ?? 1)}
                        hideCopies={isPhotoPaper}
                        onCopiesChange={(count) => setCopies(di, card.id, count)}
                        onRemove={() => removeCard(di, card.id)}
                        onEditSide={(side, file) => handleEditFile(card.id, side, file, di)}
                        onReEditSide={(side) => handleReEditSide(card.id, side, di)}
                        onMoveTo={isPhotoPaper && project.decks.length > 1 ? (toDi) => moveCard(di, toDi, card.id) : undefined}
                        deckCount={project.decks.length}
                        deckIndex={di}
                      />
                    ))}
                  </div>
                )}

                {!isFull && (
                  <label className="deck-section__add">
                    + Add image
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFrontFile(f, di) }}
                      hidden
                    />
                  </label>
                )}

                {isFull && deck.cards.length > 0 && (
                  <p className="deck-full">
                    {isPhotoPaper
                      ? 'Sheet is full.'
                      : 'Deck is full — remove a card or reduce copies to add more.'}
                  </p>
                )}
              </div>

              {/* RIGHT — sticky sidebar: header → paper selector → preview */}
              <div className="deck-section__sidebar">
                <div className="deck-section__header">
                  <span className="deck-section__label">
                    {project.decks.length > 1 ? `Sheet ${di + 1}` : project.preset.label}
                  </span>
                  <div className="deck-section__header-right">
                    {deck.cards.length > 0 && (
                      <button
                        className="btn deck-section__preview-btn"
                        onClick={() => setPreviewDeckIndex(di)}
                      >
                        See Preview
                      </button>
                    )}
                    {project.decks.length > 1 && (
                      <button
                        className="deck-section__remove"
                        onClick={() => handleRemoveDeck(di)}
                      >
                        Remove ×
                      </button>
                    )}
                  </div>
                </div>
                <div className="paper-size-toggle">
                  {Object.values(PRESETS).map(p => (
                    <button
                      key={p.id}
                      className={`paper-size-btn${project.preset.id === p.id ? ' paper-size-btn--on' : ''}`}
                      onClick={() => { justSwitchedPreset.current = true; setPreset(p) }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <SheetPreview
                  preset={project.preset}
                  thumbnails={deck.cards.map(c => c.front)}
                />
              </div>

            </div>
          )
        })}

        {isPhotoPaper && (
          <button className="btn btn--ghost deck-add-sheet" onClick={() => addDeck()}>
            + Add sheet
          </button>
        )}

        {!anyCards && (
          <>
            <p className="deck-intro">Build a deck of up to {nUp} photocards — then export as a print-ready PDF.</p>
            <p className="upload-back__step" style={{ marginBottom: -4 }}>Examples</p>
            <div className="back-gallery back-gallery--front">
              {EXAMPLE_FRONTS.map((item, i) => (
                <div key={`fe-${i}`} className="back-gallery-item">
                  <div className="back-gallery__thumb back-gallery__thumb--static">
                    <img src={item.src} alt={`Example front: ${item.label}`} />
                  </div>
                  <span className="back-gallery-item__label">{item.label}</span>
                </div>
              ))}
            </div>
            <div className="upload-back__divider">or upload your own</div>
            <ImageUpload onFile={(f) => handleFrontFile(f, 0)} />
          </>
        )}

        {anyCards && (
          <div className="deck-actions deck-actions--desktop" aria-busy={exporting}>
            {isPhotoPaper && project.preset.id === '5x7-4up' && (
              <p className="deck-actions__hint">Tight layout — near-perfect registration required.</p>
            )}
            {isPhotoPaper && (
              <details className="print-guidance">
                <summary>ET-8550 print tips</summary>
                <p>Feed through the <strong>rear straight pass</strong>, not the front cassette. Enable <strong>borderless</strong> for the sheet size. Set media type to the matching photo/matte profile. Allow extra dry time before laminating.</p>
              </details>
            )}
            <div className="deck-actions__buttons">
              {project.decks.map((deck, di) => deck.cards.length > 0 && (
                <button key={di} className="btn btn--primary" onClick={() => handleExport(di)} disabled={exporting}>
                  {exporting ? 'Generating…' : isPhotoPaper
                    ? (project.decks.filter(d => d.cards.length > 0).length > 1 ? `Download sheet ${di + 1}` : 'Download sheet')
                    : 'Download PDF'}
                </button>
              ))}
              {isPhotoPaper && project.decks.filter(d => d.cards.length > 0).length > 1 && (
                <button className="btn btn--ghost" onClick={handleExportAll} disabled={exporting}>
                  Download all sheets
                </button>
              )}
            </div>
            {exportError && (
              <p className="deck-actions__error">
                {exportError}{' '}
                <button className="link-button" onClick={() => { setExportError(null); handleExport(exportErrorDeckIndex ?? 0) }}>
                  Try again
                </button>
              </p>
            )}
          </div>
        )}

        {anyCards && project.decks.some(d => deckTotal(d) < nUp) && (
          <div className="deck-upload">
            <ImageUpload onFile={(f) => handleFrontFile(f, firstAvailableDeck())} />
          </div>
        )}

        {anyCards && (
          <div className="deck-bar" aria-busy={exporting}>
            {exportError && (
              <p className="deck-bar__error">
                {exportError}{' '}
                <button className="link-button" onClick={() => { setExportError(null); handleExport(exportErrorDeckIndex ?? 0) }}>
                  Try again
                </button>
              </p>
            )}
            {firstAvailableDeck() >= 0 && project.decks[firstAvailableDeck()] && deckTotal(project.decks[firstAvailableDeck()]) < nUp && (
              <label className="deck-bar__add">
                + Add image
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFrontFile(f, firstAvailableDeck()) }}
                  hidden
                />
              </label>
            )}
            <button className="btn btn--primary deck-bar__download" onClick={() => handleExport(0)} disabled={exporting}>
              {exporting ? 'Generating…' : isPhotoPaper ? 'Download sheet' : 'Download PDF'}
            </button>
          </div>
        )}

        {showFeedbackPrompt && (
          <div className="feedback-prompt">
            <span>Enjoying pocalab? We'd love your feedback.</span>
            <a href={FEEDBACK_FORM_URL} target="_blank" rel="noopener noreferrer" className="feedback-prompt__link">
              Share feedback →
            </a>
            <button className="feedback-prompt__dismiss" onClick={() => setShowFeedbackPrompt(false)} aria-label="Dismiss">×</button>
          </div>
        )}
      </main>

      {(cardAdded || splitToast) && (
        <div className="toast" role="status" aria-live="polite">
          {splitToast ?? 'Card added to deck'}
        </div>
      )}

      {storageToast && (
        <div className="toast toast--error" role="alert" aria-live="assertive">
          {storageToast}
          <button className="toast__dismiss" onClick={() => setStorageToast(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      {previewDeckIndex !== null && (
        <Modal onClose={() => setPreviewDeckIndex(null)} title="Sheet preview">
          <div className="sheet-preview-pair">
            <div className="sheet-preview-pair__sheet">
              <span className="sheet-preview-pair__label">Front</span>
              <SheetPreview
                preset={project.preset}
                thumbnails={project.decks[previewDeckIndex]?.cards.map(c => c.front) ?? []}
              />
            </div>
            <div className="sheet-preview-pair__sheet">
              <span className="sheet-preview-pair__label">Back</span>
              <SheetPreview
                preset={project.preset}
                thumbnails={project.decks[previewDeckIndex]?.cards.map(c => c.back ?? project.decks[previewDeckIndex!]?.sharedBack ?? null) ?? []}
              />
            </div>
          </div>
        </Modal>
      )}

    </div>
  )
}

export default App
