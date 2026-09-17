import type { PrintPreset } from '../models/preset'
import { isPhotoPaper } from '../utils/sheetSlots'

const PRESET_PAPER_NAME: Record<PrintPreset['id'], string> = {
  'letter': 'Letter',
  'a4': 'A4',
  '4x6-2up': '4 × 6 in',
  '5x7-2up': '5 × 7 in',
  '5x7-3up': '5 × 7 in',
  '5x7-4up': '5 × 7 in',
}

// The print-dialog settings validated on an Epson EcoTank ET-8550 (MAT-174).
// Any scaling in the print dialog breaks exact card size and front/back
// registration, so these are the settings, not suggestions.
export function PrintGuidance({ preset }: { preset: PrintPreset }) {
  const paper = PRESET_PAPER_NAME[preset.id]
  const photo = isPhotoPaper(preset)
  return (
    <details className="print-guidance">
      <summary>Print settings (Epson ET-8550)</summary>
      <ol className="print-guidance__steps">
        <li>
          Open the PDF in Adobe Acrobat Reader and set <strong>Page Sizing &amp; Handling</strong> to{' '}
          <strong>Actual size</strong>. Never Fit or Shrink — anything else resizes the cards.
        </li>
        <li>
          Set Paper Size to <strong>{paper}</strong> in both Acrobat and the Epson driver, so they agree.
        </li>
        <li>
          Turn <strong>Borderless off</strong>. It upscales the page by 2–3 % to bleed off the edges,
          which throws off both the card size and the front/back alignment.
        </li>
        <li>
          {photo ? 'Photo paper and cardstock feed' : 'Cardstock feeds'} through{' '}
          <strong>Rear Paper Feeder</strong> (the tray) — not the Rear Paper Feed Slot, which clips
          20 mm off the trailing edge, and not any “-Borderless” source.
        </li>
        <li>
          Print page 1 (the fronts), let the ink dry, flip the stack on the{' '}
          <strong>long edge</strong>, re-feed it, then print page 2 (the backs).{' '}
          <strong>Re-select the paper source</strong> for the second pass: the driver resets to
          Cassette 2 for every job.
        </li>
        {photo
          ? <li>Set media type to the matching photo or matte profile, and allow extra drying time before laminating.</li>
          : <li>Plain Letter paper can use cassette auto-duplex instead of the manual flip.</li>}
      </ol>
      <p className="print-guidance__result">
        With those settings the sheet prints at exact size, with the backs in register — no
        calibration needed.
      </p>
    </details>
  )
}
