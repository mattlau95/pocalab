import './App.css'
import { useDeck } from './hooks/useDeck'
import { useBeforeUnload } from './hooks/useBeforeUnload'

function App() {
  const { deck } = useDeck()
  useBeforeUnload(deck.cards.length > 0)

  return (
    <div className="app">
      <header className="app-header">
        <h1>Photocard Generator</h1>
      </header>
      <main className="app-main">
        <p>Upload and crop your photocards to get started.</p>
      </main>
    </div>
  )
}

export default App
