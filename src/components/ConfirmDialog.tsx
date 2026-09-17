import { useRef } from 'react'
import { Modal } from './Modal'

export interface ConfirmOptions {
  message: string
  confirmLabel: string
  cancelLabel?: string
  // Styles the confirm button as destructive (removing or discarding work).
  destructive?: boolean
}

interface Props extends ConfirmOptions {
  onConfirm: () => void
  onCancel: () => void
}

// A yes/no question in a modal. Focus starts on Cancel, the safe choice;
// Escape and the backdrop also cancel.
export function ConfirmDialog({ message, confirmLabel, cancelLabel = 'Cancel', destructive, onConfirm, onCancel }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  return (
    <Modal onClose={onCancel} role="alertdialog" ariaLabel={message} hideCloseButton initialFocusRef={cancelRef}>
      <p className="confirm-dialog__message">{message}</p>
      <div className="confirm-dialog__actions">
        <button ref={cancelRef} className="btn btn--ghost" onClick={onCancel}>{cancelLabel}</button>
        <button className={`btn ${destructive ? 'btn--destructive' : 'btn--primary'}`} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Modal>
  )
}
