import type { ReactNode } from 'react'
import { AppHeader } from './AppHeader'

interface Props {
  onHome?: () => void
  homeCursor?: boolean
  headerStatus?: ReactNode
  mainClassName?: string
  busy?: boolean
  children?: ReactNode
  // Toasts and modals, rendered after <main> so they sit above the page.
  overlays?: ReactNode
}

// Every screen: the header, the skip-link target <main>, then overlays.
export function PageShell({ onHome, homeCursor, headerStatus, mainClassName = 'app-main', busy, children, overlays }: Props) {
  return (
    <div className="app">
      <AppHeader onHome={onHome} homeCursor={homeCursor} status={headerStatus} />
      <main id="main-content" className={mainClassName} aria-busy={busy}>
        {children}
      </main>
      {overlays}
    </div>
  )
}
