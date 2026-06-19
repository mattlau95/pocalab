import { useEffect } from 'react'
import './Modal.css'

interface Props {
  onClose: () => void
  children: React.ReactNode
  title?: string
}

export function Modal({ onClose, children, title }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        {title && <div className="modal__header"><span className="modal__title">{title}</span></div>}
        {children}
        <div className="modal__footer">
          <button className="btn btn--ghost modal__close-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
