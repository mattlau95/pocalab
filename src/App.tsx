import { useState } from 'react'
import './App.css'
import { useProject } from './hooks/useProject'
import { useBeforeUnload } from './hooks/useBeforeUnload'
import { useCardFlow } from './hooks/useCardFlow'
import { useExport } from './hooks/useExport'
import { PageShell } from './components/PageShell'
import { CropEditor } from './components/CropEditor'
import { UploadBackScreen } from './screens/UploadBackScreen'
import { BackScopeScreen } from './screens/BackScopeScreen'
import { DeckScreen } from './screens/DeckScreen'

function App() {
  const projectApi = useProject()
  const { project, hydrated, storageWriteError } = projectApi
  const flow = useCardFlow(projectApi)
  const { step } = flow

  const [showFeedbackPrompt, setShowFeedbackPrompt] = useState(false)
  const exporter = useExport(project, () => setShowFeedbackPrompt(true))
  // useProject reports a write failure once; the toast shows it until dismissed.
  const [storageToastDismissed, setStorageToastDismissed] = useState(false)

  const anyCards = project.decks.some(d => d.cards.length > 0)
  useBeforeUnload(anyCards || step.id !== 'idle')

  // The saved project is read from IndexedDB asynchronously; render the shell
  // only until it arrives so the empty first-run screen never flashes over a
  // deck that is about to appear.
  if (!hydrated) return <PageShell busy />

  switch (step.id) {
    case 'crop-front':
      return (
        <PageShell onHome={flow.goHome}>
          <CropEditor
            imageSrc={step.imageSrc}
            label={step.editingPending ? 'Edit front' : 'Step 1 of 2 — Crop the front'}
            initialState={step.initialState}
            onConfirm={flow.confirmFront}
            onCancel={flow.cancel}
          />
        </PageShell>
      )

    case 'upload-back': {
      const targetDeckCards = project.decks[step.targetDeck]?.cards ?? []
      const knownBacks = [...new Set(targetDeckCards.map(c => c.back).filter((b): b is string => b !== null))]
      return (
        <PageShell onHome={flow.goHome}>
          <UploadBackScreen
            pendingCard={step.pendingCard}
            knownBacks={knownBacks}
            setAsShared={flow.setAsShared}
            onSetAsSharedChange={flow.setSetAsShared}
            onEditFront={flow.editPendingFront}
            onPickBack={flow.pickExistingBack}
            onBackFile={flow.startBack}
            onStartOver={flow.cancel}
          />
        </PageShell>
      )
    }

    case 'crop-back':
      return (
        <PageShell onHome={flow.goHome}>
          <CropEditor
            imageSrc={step.imageSrc}
            label="Step 2 of 2 — Crop the back"
            onConfirm={flow.confirmBack}
            onCancel={flow.cancel}
          />
        </PageShell>
      )

    case 'edit-side':
      return (
        <PageShell onHome={flow.goHome}>
          <CropEditor
            imageSrc={step.imageSrc}
            label={`Edit ${step.side}`}
            initialState={step.initialState}
            onConfirm={flow.confirmEdit}
            onCancel={flow.cancel}
            onReplace={flow.replaceEditImage}
          />
        </PageShell>
      )

    case 'confirm-back-scope':
      return (
        <PageShell onHome={flow.goHome}>
          <BackScopeScreen
            newBack={step.dataUrl}
            otherCount={step.sharingCardIds.length}
            onCancel={flow.backScopeCancel}
            onJustThis={flow.backScopeJustThis}
            onAll={flow.backScopeAll}
          />
        </PageShell>
      )

    case 'idle':
      return (
        <DeckScreen
          projectApi={projectApi}
          flow={flow}
          exporter={exporter}
          showFeedbackPrompt={showFeedbackPrompt}
          onDismissFeedback={() => setShowFeedbackPrompt(false)}
          storageToast={storageToastDismissed ? null : storageWriteError}
          onDismissStorageToast={() => setStorageToastDismissed(true)}
        />
      )
  }
}

export default App
