import type { ReactNode } from 'react'

const KO_FI_URL = 'https://ko-fi.com/mattlau95'

interface Props {
  // Clicking the logo goes home (the caller confirms before discarding work).
  onHome?: () => void
  // Whether the logo is a link; defaults to whenever onHome is set. The empty
  // start screen passes false, since there is nothing to go home from.
  homeLink?: boolean
  // Centre of the header: the card count and save status on the deck screen.
  status?: ReactNode
}

export function AppHeader({ onHome, homeLink = !!onHome, status }: Props) {
  const brand = (
    <>
      <div className="app-header__title-row">
        <img src="/icon-cards.png" className="app-header__icon-left" alt="" />
        <h1>pocalab</h1>
        <img src="/icon-dashes.png" className="app-header__icon-right" alt="" />
      </div>
      <span className="app-header__tagline">a K-pop photocard maker</span>
    </>
  )
  return (
    <header className="app-header">
      {onHome && homeLink ? (
        <a
          className="app-header__brand"
          href="/"
          aria-label="pocalab, start over"
          onClick={e => { e.preventDefault(); onHome() }}
        >
          {brand}
        </a>
      ) : (
        <div className="app-header__brand">{brand}</div>
      )}
      {status}
      <a className="kofi-btn" href={KO_FI_URL} target="_blank" rel="noopener noreferrer">☕ Support</a>
    </header>
  )
}
