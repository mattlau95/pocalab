import { useCallback, useState } from 'react'
import { ConfirmDialog, type ConfirmOptions } from '../components/ConfirmDialog'

export type Confirm = (options: ConfirmOptions) => Promise<boolean>

// An awaitable replacement for window.confirm: `if (!(await confirm({...}))) return`.
// Render `dialog` once near the root.
export function useConfirm() {
  const [request, setRequest] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null)

  const confirm = useCallback<Confirm>(
    options => new Promise(resolve => setRequest({ ...options, resolve })),
    [],
  )

  const answer = (ok: boolean) => {
    request?.resolve(ok)
    setRequest(null)
  }

  const dialog = request && (
    <ConfirmDialog
      message={request.message}
      confirmLabel={request.confirmLabel}
      cancelLabel={request.cancelLabel}
      destructive={request.destructive}
      onConfirm={() => answer(true)}
      onCancel={() => answer(false)}
    />
  )

  return { confirm, dialog }
}
