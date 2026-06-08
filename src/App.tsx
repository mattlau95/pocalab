import { useState } from 'react'
import './App.css'
import { useDeck } from './hooks/useDeck'
import { useBeforeUnload } from './hooks/useBeforeUnload'
import { ImageUpload } from './components/ImageUpload'
import { CropEditor } from './components/CropEditor'
import { createCard } from './models/card'

type Step = { id: 'idle' } | { id: 'crop'; imageSrc: string }

function App() {
  const { deck, addCard } = useDeck()
  useBeforeUnload(deck.cards.length > 0)
  const [step, setStep] = useState<Step>({ id: 'idle' })

  function handleFile(file: File) {
    const url = URL.createObjectURL(file)
    setStep({ id: 'crop', imageSrc: url })
  }

  function handleCropConfirm(dataUrl: string) {
    if (step.id !== 'crop') return
    URL.revokeObjectURL(step.imageSrc)
    const card = createCard()
    card.front = dataUrl
    addCard(card)
    setStep({ id: 'idle' })
  }

  function handleCropCancel() {
    if (step.id === 'crop') URL.revokeObjectURL(step.imageSrc)
    setStep({ id: 'idle' })
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Photocard Generator</h1>
        {deck.cards.length > 0 && (
          <span className="app-header__count">{deck.cards.length} / 9 cards</span>
        )}
      </header>

      <main className="app-main">
        {step.id === 'crop' ? (
          <CropEditor
            imageSrc={step.imageSrc}
            onConfirm={handleCropConfirm}
            onCancel={handleCropCancel}
          />
        ) : (
          <>
            {deck.cards.length > 0 && (
              <div className="card-grid">
                {deck.cards.map((card) => (
                  <div key={card.id} className="card-thumb">
                    {card.front && <img src={card.front} alt="Card front" />}
                  </div>
                ))}
              </div>
            )}
            <ImageUpload onFile={handleFile} />
          </>
        )}
      </main>
    </div>
  )
}

export default App
