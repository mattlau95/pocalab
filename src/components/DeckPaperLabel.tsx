import type { PrintPreset } from '../models/preset'

const PRESET_DIMS: Record<string, string> = {
  'letter':  '8.5×11"',
  'a4':      '210×297mm',
  '4x6-2up': '4×6"',
  '5x7-2up': '5×7"',
  '5x7-3up': '5×7"',
  '5x7-4up': '5×7"',
}

function SheetIcon({ cols, rows }: { cols: number; rows: number }) {
  const W = 24, H = 32, bw = 1, pad = 2.5, gap = 1
  const innerW = W - bw * 2 - pad * 2
  const innerH = H - bw * 2 - pad * 2
  const cellW = (innerW - gap * (cols - 1)) / cols
  const cellH = (innerH - gap * (rows - 1)) / rows
  const cells: { x: number; y: number }[] = []
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      cells.push({ x: bw + pad + c * (cellW + gap), y: bw + pad + r * (cellH + gap) })
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none" aria-hidden="true">
      <rect x={bw / 2} y={bw / 2} width={W - bw} height={H - bw} rx="2" stroke="currentColor" strokeOpacity="0.4" strokeWidth={bw} />
      {cells.map((cell, i) => (
        <rect key={i} x={cell.x} y={cell.y} width={cellW} height={cellH} rx="0.5" fill="currentColor" fillOpacity="0.6" />
      ))}
    </svg>
  )
}

export function DeckPaperLabel({ preset }: { preset: PrintPreset }) {
  const dims = PRESET_DIMS[preset.id] ?? ''
  const isNUp = preset.label.toLowerCase().includes('-up')
  return (
    <div className="deck-paper-label">
      <SheetIcon cols={preset.cols} rows={preset.rows} />
      <span className="deck-paper-label__name">
        {isNUp ? `${dims} (${preset.nUp} cards)` : `${preset.label} ${dims} (${preset.nUp} cards)`}
      </span>
    </div>
  )
}
