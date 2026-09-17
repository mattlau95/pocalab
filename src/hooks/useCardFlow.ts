import { useState } from 'react'
import { createCard, type Card, type CropState } from '../models/card'
import type { Project } from '../models/deck'
import type { useProject } from './useProject'
import { revokeBlobUrl } from '../utils/blobUrls'

// The add-a-card and edit-a-card flows as a state machine. 'idle' is the deck
// screen; every other step is a full-screen stage of adding or editing a card.
//
//   idle ──front file──▶ crop-front ──confirm──▶ upload-back ──back file──▶ crop-back ──confirm──▶ idle
//                                                    └──pick a previous back──────────────────────▶ idle
//   idle ──edit a side──▶ edit-side ──confirm──▶ idle, or confirm-back-scope when other cards share that back
export type Step =
  | { id: 'idle' }
  | { id: 'crop-front'; imageSrc: string; editingPending?: Card; initialState?: CropState; targetDeck: number }
  | { id: 'upload-back'; pendingCard: Card; pendingBackSrc?: string; targetDeck: number }
  | { id: 'crop-back'; imageSrc: string; pendingCard: Card; setAsShared: boolean; targetDeck: number }
  | { id: 'edit-side'; imageSrc: string; cardId: string; side: 'front' | 'back'; initialState?: CropState; deckIndex: number }
  | { id: 'confirm-back-scope'; dataUrl: string; newSrc: string; state: CropState; cardId: string; sharingCardIds: string[]; deckIndex: number }

type ProjectApi = ReturnType<typeof useProject>

function findCard(project: Project, deckIndex: number, cardId: string) {
  return project.decks[deckIndex]?.cards.find(c => c.id === cardId)
}

// The original upload a card keeps for re-editing that side, if any.
function storedSrc(project: Project, step: { deckIndex: number; cardId: string; side: 'front' | 'back' }) {
  const card = findCard(project, step.deckIndex, step.cardId)
  return step.side === 'front' ? card?.frontSrc : card?.backSrc
}

// Releases every upload URL that only this step holds, for when the whole step is thrown away.
function releaseStep(step: Step, project: Project) {
  switch (step.id) {
    case 'crop-front':
      revokeBlobUrl(step.editingPending?.frontSrc)
      revokeBlobUrl(step.imageSrc)
      break
    case 'upload-back':
      revokeBlobUrl(step.pendingBackSrc)
      revokeBlobUrl(step.pendingCard.frontSrc)
      break
    case 'crop-back':
      revokeBlobUrl(step.imageSrc)
      revokeBlobUrl(step.pendingCard.frontSrc)
      break
    case 'edit-side':
      revokeBlobUrl(step.imageSrc, storedSrc(project, step))
      break
    case 'confirm-back-scope':
      revokeBlobUrl(step.newSrc, findCard(project, step.deckIndex, step.cardId)?.backSrc)
      break
  }
}

export function useCardFlow({ project, addCard, updateCard, setSharedBack, resetProject }: ProjectApi) {
  const [step, setStep] = useState<Step>({ id: 'idle' })
  const [setAsShared, setSetAsShared] = useState(false)
  const [cardAdded, setCardAdded] = useState(false)

  const anyCards = project.decks.some(d => d.cards.length > 0)

  function finishAddingCard() {
    setSetAsShared(false)
    setStep({ id: 'idle' })
    setCardAdded(true)
    setTimeout(() => setCardAdded(false), 2000)
  }

  // Cancel steps back one stage (or out of the flow), asking before losing a cropped front.
  function cancel() {
    if (step.id === 'crop-front') {
      revokeBlobUrl(step.imageSrc)
      if (step.editingPending) {
        setStep({ id: 'upload-back', pendingCard: step.editingPending, targetDeck: step.targetDeck })
      } else {
        setStep({ id: 'idle' })
      }
      return
    }
    if (step.id === 'upload-back') {
      if (!window.confirm('Discard this card? Your cropped front image will be lost.')) return
      releaseStep(step, project)
      setSetAsShared(false)
      setStep({ id: 'idle' })
      return
    }
    if (step.id === 'crop-back') {
      setStep({ id: 'upload-back', pendingCard: step.pendingCard, pendingBackSrc: step.imageSrc, targetDeck: step.targetDeck })
      return
    }
    if (step.id === 'edit-side') releaseStep(step, project)
    setStep({ id: 'idle' })
  }

  // The logo: clears the whole project (and any step in progress) after confirming.
  function goHome() {
    const inFlow = step.id !== 'idle'
    if (!anyCards && !inFlow) return
    const msg = anyCards
      ? `Clear your deck${inFlow ? ' and cancel this crop' : ''}? This cannot be undone.`
      : 'Cancel this crop and start over?'
    if (!window.confirm(msg)) return
    releaseStep(step, project)
    resetProject()
    setStep({ id: 'idle' })
  }

  function startFront(file: File, targetDeck: number) {
    setStep({ id: 'crop-front', imageSrc: URL.createObjectURL(file), targetDeck })
  }

  function confirmFront(dataUrl: string, state: CropState) {
    if (step.id !== 'crop-front') return
    if (step.editingPending) {
      setStep({ id: 'upload-back', pendingCard: { ...step.editingPending, front: dataUrl, frontState: state }, targetDeck: step.targetDeck })
    } else {
      const card = createCard()
      card.front = dataUrl
      setStep({ id: 'upload-back', pendingCard: { ...card, frontSrc: step.imageSrc, frontState: state }, targetDeck: step.targetDeck })
    }
  }

  // From the back step, re-crop the front without losing the pending card.
  function editPendingFront() {
    if (step.id !== 'upload-back') return
    setStep({
      id: 'crop-front',
      imageSrc: step.pendingCard.front!,
      editingPending: step.pendingCard,
      initialState: step.pendingCard.frontState,
      targetDeck: step.targetDeck,
    })
  }

  function startBack(file: File) {
    if (step.id !== 'upload-back') return
    if (step.pendingBackSrc) {
      if (!window.confirm('Replace the back image you already selected?')) return
      revokeBlobUrl(step.pendingBackSrc)
    }
    setStep({ id: 'crop-back', imageSrc: URL.createObjectURL(file), pendingCard: step.pendingCard, setAsShared, targetDeck: step.targetDeck })
  }

  function confirmBack(dataUrl: string, state: CropState) {
    if (step.id !== 'crop-back') return
    addCard(step.targetDeck, { ...step.pendingCard, back: dataUrl, backSrc: step.imageSrc, backState: state })
    if (step.setAsShared) setSharedBack(step.targetDeck, dataUrl)
    finishAddingCard()
  }

  function pickExistingBack(dataUrl: string) {
    if (step.id !== 'upload-back') return
    revokeBlobUrl(step.pendingBackSrc)
    addCard(step.targetDeck, { ...step.pendingCard, back: dataUrl })
    finishAddingCard()
  }

  // Edit with a new upload.
  function editWithFile(cardId: string, side: 'front' | 'back', file: File, deckIndex: number) {
    setStep({ id: 'edit-side', imageSrc: URL.createObjectURL(file), cardId, side, deckIndex })
  }

  // Edit from the card's original upload, restoring the previous crop.
  function reEditSide(cardId: string, side: 'front' | 'back', deckIndex: number) {
    const card = findCard(project, deckIndex, cardId)
    if (!card) return
    const src = side === 'front' ? card.frontSrc : card.backSrc
    if (!src) return
    const initialState = side === 'front' ? card.frontState : card.backState
    setStep({ id: 'edit-side', imageSrc: src, cardId, side, initialState, deckIndex })
  }

  // "Replace image" inside the edit crop.
  function replaceEditImage(file: File) {
    if (step.id !== 'edit-side') return
    releaseStep(step, project)
    setStep({ id: 'edit-side', imageSrc: URL.createObjectURL(file), cardId: step.cardId, side: step.side, deckIndex: step.deckIndex })
  }

  function confirmEdit(dataUrl: string, state: CropState) {
    if (step.id !== 'edit-side') return

    const deck = project.decks[step.deckIndex]
    const card = deck?.cards.find(c => c.id === step.cardId)
    revokeBlobUrl(step.side === 'front' ? card?.frontSrc : card?.backSrc, step.imageSrc)

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

  function backScopeJustThis() {
    if (step.id !== 'confirm-back-scope') return
    updateCard(step.deckIndex, step.cardId, { back: step.dataUrl, backSrc: step.newSrc, backState: step.state })
    setStep({ id: 'idle' })
  }

  function backScopeAll() {
    if (step.id !== 'confirm-back-scope') return
    updateCard(step.deckIndex, step.cardId, { back: step.dataUrl, backSrc: step.newSrc, backState: step.state })
    for (const id of step.sharingCardIds) {
      updateCard(step.deckIndex, id, { back: step.dataUrl, backSrc: undefined, backState: undefined })
    }
    setStep({ id: 'idle' })
  }

  function backScopeCancel() {
    if (step.id !== 'confirm-back-scope') return
    releaseStep(step, project)
    setStep({ id: 'idle' })
  }

  return {
    step,
    setAsShared,
    setSetAsShared,
    cardAdded,
    cancel,
    goHome,
    startFront,
    confirmFront,
    editPendingFront,
    startBack,
    confirmBack,
    pickExistingBack,
    editWithFile,
    reEditSide,
    replaceEditImage,
    confirmEdit,
    backScopeJustThis,
    backScopeAll,
    backScopeCancel,
  }
}
