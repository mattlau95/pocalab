import { useEffect, useRef, useState } from 'react'
import { deckTotal, type useProject } from '../hooks/useProject'
import type { useCardFlow } from '../hooks/useCardFlow'
import type { useExport } from '../hooks/useExport'
import type { Confirm } from '../hooks/useConfirm'
import { PRESETS } from '../models/preset'
import { PageShell } from '../components/PageShell'
import { DeckPaperLabel } from '../components/DeckPaperLabel'
import { DeckCard } from '../components/DeckCard'
import { ImageUpload } from '../components/ImageUpload'
import { SheetPreview } from '../components/SheetPreview'
import { Modal } from '../components/Modal'
import { PrintGuidance } from '../components/PrintGuidance'
import { isPhotoPaper as isPhotoPaperPreset, printedSlots } from '../utils/sheetSlots'

const FEEDBACK_FORM_URL = 'https://forms.gle/j3aj9NYF35ZJDkSn9'

const EXAMPLE_FRONTS = [
  { src: '/photocard-front-examples/photocard-front-example-1-selfie.webp',   label: 'selfie' },
  { src: '/photocard-front-examples/photocard-front-example-2-portrait.webp', label: 'portrait' },
  { src: '/photocard-front-examples/photocard-front-example-3-concert.webp',  label: 'concert' },
  { src: '/photocard-front-examples/photocard-front-example-4-group.webp',    label: 'group' },
]

interface Props {
  projectApi: ReturnType<typeof useProject>
  flow: ReturnType<typeof useCardFlow>
  exporter: ReturnType<typeof useExport>
  showFeedbackPrompt: boolean
  onDismissFeedback: () => void
  storageToast: string | null
  onDismissStorageToast: () => void
  confirm: Confirm
}

// The idle screen: the first-run upload, or the deck with its sheets, export
// actions, sheet preview and paper size picker.
export function DeckScreen({ projectApi, flow, exporter, showFeedbackPrompt, onDismissFeedback, storageToast, onDismissStorageToast, confirm }: Props) {
  const { project, saveStatus, setPreset, removeCard, setCopies, addDeck, removeDeck, moveCard, removalMessage, undoRemoval } = projectApi
  const nUp = project.preset.nUp
  const [previewDeckIndex, setPreviewDeckIndex] = useState<number | null>(null)
  const [showPaperSizeModal, setShowPaperSizeModal] = useState(false)
  const [splitToast, setSplitToast] = useState<string | null>(null)
  const prevDeckCount = useRef(project.decks.length)
  const justSwitchedPreset = useRef(false)

  const anyCards = project.decks.some(d => d.cards.length > 0)
  const totalCards = project.decks.reduce((sum, d) => sum + deckTotal(d), 0)
  const isPhotoPaper = isPhotoPaperPreset(project.preset)
  const { exporting, label: exportLabel, error: exportError } = exporter

  // Tell the user when a paper size change spreads their cards over more sheets.
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

  function firstAvailableDeck() {
    return Math.max(0, project.decks.findIndex(d => deckTotal(d) < nUp))
  }

  async function handleRemoveDeck(deckIndex: number) {
    const deck = project.decks[deckIndex]
    if (deck && deck.cards.length > 0) {
      const message = `Remove Sheet ${deckIndex + 1} and its ${deck.cards.length} card${deck.cards.length !== 1 ? 's' : ''}?`
      if (!(await confirm({ message, confirmLabel: 'Remove sheet', destructive: true }))) return
    }
    removeDeck(deckIndex)
  }

  const saveLabel = { idle: null, saving: 'Saving…', saved: 'Saved', error: 'Not saved' }[saveStatus]

  const headerCount = project.decks.length > 1
    ? `${totalCards} cards · ${project.decks.length} sheets`
    : `${deckTotal(project.decks[0])} / ${nUp} cards`

  const headerStatus = (
    <div className="app-header__status">
      <span className="app-header__count" aria-live="polite" aria-atomic="true">{headerCount}</span>
      {/* Not a live region: it changes on every edit, and write failures
          are already announced by the storage error toast. */}
      {saveLabel && (
        <span className={`app-header__save app-header__save--${saveStatus}`}>{saveLabel}</span>
      )}
    </div>
  )

  const retryButton = (
    <button className="link-button" onClick={exporter.retry}>
      Try again
    </button>
  )

  const overlays = (
    <>
      {removalMessage ? (
        <div className="toast toast--undo" role="status" aria-live="polite">
          {removalMessage}
          <button className="toast__action" onClick={undoRemoval}>Undo</button>
        </div>
      ) : (flow.cardAdded || splitToast) && (
        <div className="toast" role="status" aria-live="polite">
          {splitToast ?? 'Card added to deck'}
        </div>
      )}

      {storageToast && (
        <div className="toast toast--error" role="alert" aria-live="assertive">
          {storageToast}
          <button className="toast__dismiss" onClick={onDismissStorageToast} aria-label="Dismiss">×</button>
        </div>
      )}

      {previewDeckIndex !== null && (() => {
        const deck = project.decks[previewDeckIndex]
        const slots = deck ? printedSlots(deck, project.preset) : []
        return (
          <Modal onClose={() => setPreviewDeckIndex(null)} title="Sheet preview">
            <div className="sheet-preview-pair">
              <div className="sheet-preview-pair__sheet">
                <span className="sheet-preview-pair__label">Front</span>
                <SheetPreview preset={project.preset} thumbnails={slots.map(s => s.front)} />
              </div>
              <div className="sheet-preview-pair__sheet">
                <span className="sheet-preview-pair__label">Back</span>
                <SheetPreview preset={project.preset} thumbnails={slots.map(s => s.back)} />
              </div>
            </div>
            <p className="sheet-preview-pair__note">
              Backs are shown in the same order as the fronts. The PDF flips the back page for you, so each back prints behind its own front.
            </p>
          </Modal>
        )
      })()}

      {showPaperSizeModal && (
        <Modal onClose={() => setShowPaperSizeModal(false)} title="Paper size">
          <div className="paper-size-options">
            {Object.values(PRESETS).map(p => (
              <button
                key={p.id}
                className={`paper-size-option${project.preset.id === p.id ? ' paper-size-option--on' : ''}`}
                onClick={() => { justSwitchedPreset.current = true; setPreset(p); setShowPaperSizeModal(false) }}
              >
                <DeckPaperLabel preset={p} />
              </button>
            ))}
          </div>
        </Modal>
      )}
    </>
  )

  return (
    <PageShell
      onHome={flow.goHome}
      homeLink={anyCards}
      headerStatus={headerStatus}
      mainClassName={`app-main${anyCards ? ' app-main--with-bar' : ''}`}
      overlays={overlays}
    >
      {anyCards && (
        <div className="deck-list__toolbar">
          <DeckPaperLabel preset={project.preset} />
          <div className="deck-list__toolbar-actions">
            <button
              className="btn deck-list__toolbar-btn deck-list__toolbar-btn--ghost"
              onClick={() => setPreviewDeckIndex(0)}
            >
              See Preview
            </button>
            <button
              className="btn deck-list__toolbar-btn deck-list__toolbar-btn--primary"
              onClick={() => setShowPaperSizeModal(true)}
            >
              Paper Size
            </button>
          </div>
        </div>
      )}

      {project.decks.map((deck, di) => {
        if (deck.cards.length === 0 && project.decks.length === 1) return null
        const dTotal = deckTotal(deck)
        const isFull = dTotal >= nUp
        return (
          <div key={di} className="deck-section">

            {project.decks.length > 1 && (
              <div className="deck-section__header">
                <span className="deck-section__label">{`Sheet ${di + 1}`}</span>
                <div className="deck-section__header-right">
                  <button
                    className="btn btn--ghost deck-section__preview-btn"
                    onClick={() => setPreviewDeckIndex(di)}
                  >
                    Preview
                  </button>
                  <button
                    className="deck-section__remove"
                    onClick={() => handleRemoveDeck(di)}
                  >
                    Remove ×
                  </button>
                </div>
              </div>
            )}

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
                      onEditSide={(side, file) => flow.editWithFile(card.id, side, file, di)}
                      onReEditSide={(side) => flow.reEditSide(card.id, side, di)}
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
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) flow.startFront(f, di) }}
                    className="visually-hidden"
                  />
                </label>
              )}

              {isFull && deck.cards.length > 0 && (
                <p className="deck-full">
                  {isPhotoPaper
                    ? 'Sheet is full.'
                    : 'Sheet is full — remove a card or reduce copies to add more.'}
                </p>
              )}
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
          <ImageUpload onFile={(f) => flow.startFront(f, 0)} />
        </>
      )}

      {anyCards && (
        <div className="deck-actions deck-actions--desktop" aria-busy={exporting}>
          {isPhotoPaper && project.preset.id === '5x7-4up' && (
            <p className="deck-actions__hint">Tight layout — near-perfect registration required.</p>
          )}
          <PrintGuidance preset={project.preset} />
          <div className="deck-actions__buttons">
            {project.decks.map((deck, di) => deck.cards.length > 0 && (
              <button key={di} className="btn btn--primary" onClick={() => exporter.exportSheet(di)} disabled={exporting}>
                {exporting ? exportLabel : isPhotoPaper
                  ? (project.decks.filter(d => d.cards.length > 0).length > 1 ? `Download sheet ${di + 1}` : 'Download sheet')
                  : 'Download PDF'}
              </button>
            ))}
            {isPhotoPaper && project.decks.filter(d => d.cards.length > 0).length > 1 && (
              <button className="btn btn--ghost" onClick={exporter.exportAllSheets} disabled={exporting}>
                Download all sheets
              </button>
            )}
          </div>
          {exportError && (
            <p className="deck-actions__error">
              {exportError}{' '}
              {retryButton}
            </p>
          )}
        </div>
      )}

      {anyCards && project.decks.some(d => deckTotal(d) < nUp) && (
        <div className="deck-upload">
          <ImageUpload onFile={(f) => flow.startFront(f, firstAvailableDeck())} />
        </div>
      )}

      {anyCards && (
        <div className="deck-bar" aria-busy={exporting}>
          {exportError && (
            <p className="deck-bar__error">
              {exportError}{' '}
              {retryButton}
            </p>
          )}
          {firstAvailableDeck() >= 0 && project.decks[firstAvailableDeck()] && deckTotal(project.decks[firstAvailableDeck()]) < nUp && (
            <label className="deck-bar__add">
              + Add image
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) flow.startFront(f, firstAvailableDeck()) }}
                className="visually-hidden"
              />
            </label>
          )}
          <button className="btn btn--primary deck-bar__download" onClick={() => exporter.exportSheet(0)} disabled={exporting}>
            {exporting ? exportLabel : isPhotoPaper ? 'Download sheet' : 'Download PDF'}
          </button>
        </div>
      )}

      {showFeedbackPrompt && (
        <div className="feedback-prompt">
          <span>Enjoying pocalab? We'd love your feedback.</span>
          <a href={FEEDBACK_FORM_URL} target="_blank" rel="noopener noreferrer" className="feedback-prompt__link">
            Share feedback →
          </a>
          <button className="feedback-prompt__dismiss" onClick={onDismissFeedback} aria-label="Dismiss">×</button>
        </div>
      )}
    </PageShell>
  )
}
