import { useEffect, useId, useRef } from 'react'
import './Modal.css'

interface Props {
  onClose: () => void
  children: React.ReactNode
  title?: string
  // alertdialog for questions that need an answer; dialog otherwise.
  role?: 'dialog' | 'alertdialog'
  // Hide the footer Close button when the content has its own actions.
  hideCloseButton?: boolean
  // Element to focus on open; defaults to the first focusable element.
  initialFocusRef?: React.RefObject<HTMLElement | null>
  // Accessible name when there is no visible title.
  ariaLabel?: string
}

const FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

// A modal dialog: focus moves in on open, Tab stays inside, Escape or the
// backdrop closes it, and focus returns to where it was on close.
export function Modal({ onClose, children, title, role = 'dialog', hideCloseButton, initialFocusRef, ariaLabel }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  // Read through a ref so a new onClose each render doesn't re-run the focus effect.
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const first = initialFocusRef?.current ?? dialog.querySelector<HTMLElement>(FOCUSABLE) ?? dialog
    first.focus()

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !dialog) return
      const focusable = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)]
      if (focusable.length === 0) { e.preventDefault(); return }
      const firstEl = focusable[0]
      const lastEl = focusable[focusable.length - 1]
      if (e.shiftKey && (document.activeElement === firstEl || !dialog.contains(document.activeElement))) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && (document.activeElement === lastEl || !dialog.contains(document.activeElement))) {
        e.preventDefault()
        firstEl.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (previouslyFocused?.isConnected) previouslyFocused.focus()
    }
  }, [initialFocusRef])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        className="modal"
        role={role}
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : ariaLabel}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
      >
        {title && <div className="modal__header"><h2 id={titleId} className="modal__title">{title}</h2></div>}
        {children}
        {!hideCloseButton && (
          <div className="modal__footer">
            <button className="btn btn--ghost modal__close-btn" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  )
}
