import { useState } from 'react'
import type { Project } from '../models/deck'
import { isPhotoPaper, printedSlots } from '../utils/sheetSlots'

function triggerDownload(bytes: Uint8Array, filename: string) {
  const url = URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// PDF export for the deck screen: one sheet, or every sheet in one file.
// The PDF code is imported on first use so pdf-lib stays out of the initial bundle.
export function useExport(project: Project, onExported: () => void) {
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  // null retries "all sheets"; a number retries that sheet.
  const [failedDeckIndex, setFailedDeckIndex] = useState<number | null>(null)

  async function run(build: () => Promise<{ bytes: Uint8Array; filename: string }>, deckIndex: number | null) {
    setExporting(true)
    setProgress(null)
    setError(null)
    try {
      const { bytes, filename } = await build()
      triggerDownload(bytes, filename)
      onExported()
    } catch {
      setError('PDF generation failed — please try again.')
      setFailedDeckIndex(deckIndex)
    } finally {
      setExporting(false)
      setProgress(null)
    }
  }

  const onProgress = (done: number, total: number) => setProgress({ done, total })

  function exportSheet(deckIndex = 0) {
    const deck = project.decks[deckIndex]
    if (!deck) return
    return run(async () => {
      const { buildSheetPdf } = await import('../utils/sheetPdf')
      const bytes = await buildSheetPdf(project.preset, printedSlots(deck, project.preset), onProgress)
      const filename = !isPhotoPaper(project.preset) ? 'photocards.pdf'
        : project.decks.length > 1 ? `sheet-${deckIndex + 1}.pdf` : 'sheet-1.pdf'
      return { bytes, filename }
    }, deckIndex)
  }

  function exportAllSheets() {
    return run(async () => {
      const { buildSheetsPdf } = await import('../utils/sheetPdf')
      const sheets = project.decks.filter(d => d.cards.length > 0).map(d => printedSlots(d, project.preset))
      return { bytes: await buildSheetsPdf(project.preset, sheets, onProgress), filename: 'photocards-all.pdf' }
    }, null)
  }

  // Matches the original behaviour: a failed "all sheets" export retries sheet 1.
  function retry() {
    setError(null)
    return exportSheet(failedDeckIndex ?? 0)
  }

  // Embedding images is the slow part; once they are all in, pdf-lib still
  // has to serialise the document.
  const label = !progress
    ? 'Generating…'
    : progress.done < progress.total
      ? `Generating… ${progress.done} / ${progress.total}`
      : 'Finishing…'

  return { exporting, label, error, exportSheet, exportAllSheets, retry }
}
