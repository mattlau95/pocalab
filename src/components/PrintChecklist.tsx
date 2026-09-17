import { useId, useState } from 'react'
import type { PrintPreset } from '../models/preset'
import { isPhotoPaper } from '../utils/sheetSlots'

// Shown right after a download: the few settings that ruin a sheet if missed.
// The full list lives in PrintGuidance and docs/printing.md.
export function PrintChecklist({ preset, onDismiss }: { preset: PrintPreset; onDismiss: () => void }) {
  const titleId = useId()
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  const items = [
    'Printing at Actual size — not Fit or Shrink to page',
    'Borderless turned off',
    isPhotoPaper(preset) ? 'Paper in the rear feeder, media type set to match' : 'Cardstock in the rear feeder (plain paper can auto-duplex)',
    'Page 1 first, then flip the stack on the long edge for page 2',
  ]

  return (
    <section className="print-checklist" aria-labelledby={titleId}>
      <div className="print-checklist__head">
        <h2 id={titleId} className="print-checklist__title">Before you print</h2>
        <button className="print-checklist__dismiss" onClick={onDismiss} aria-label="Dismiss checklist">×</button>
      </div>
      <ul className="print-checklist__items">
        {items.map(item => (
          <li key={item}>
            <label className="print-checklist__item">
              <input
                type="checkbox"
                checked={checked[item] ?? false}
                onChange={e => setChecked(c => ({ ...c, [item]: e.target.checked }))}
              />
              <span>{item}</span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  )
}
