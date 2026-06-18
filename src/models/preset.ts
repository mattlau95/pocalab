export interface PrintPreset {
  id: 'letter' | 'a4' | '4x6-2up' | '5x7-2up' | '5x7-3up' | '5x7-4up'
  label: string
  sheetMm: { w: number; h: number }
  cols: number
  rows: number
  orientation: 'landscape' | 'portrait'
  bleedMm: number
  nUp: number
}

export const PRESETS: Record<PrintPreset['id'], PrintPreset> = {
  'letter':  { id: 'letter',  label: 'US Letter',   sheetMm: { w: 215.9, h: 279.4 }, cols: 3, rows: 3, orientation: 'portrait',  bleedMm: 2,   nUp: 9 },
  'a4':      { id: 'a4',      label: 'A4',          sheetMm: { w: 210,   h: 297   }, cols: 3, rows: 3, orientation: 'portrait',  bleedMm: 2,   nUp: 9 },
  '4x6-2up': { id: '4x6-2up', label: '4×6 — 2-up', sheetMm: { w: 101.6, h: 152.4 }, cols: 1, rows: 2, orientation: 'landscape', bleedMm: 3,   nUp: 2 },
  '5x7-2up': { id: '5x7-2up', label: '5×7 — 2-up', sheetMm: { w: 127,   h: 177.8 }, cols: 1, rows: 2, orientation: 'landscape', bleedMm: 3,   nUp: 2 },
  '5x7-3up': { id: '5x7-3up', label: '5×7 — 3-up', sheetMm: { w: 127,   h: 177.8 }, cols: 1, rows: 3, orientation: 'landscape', bleedMm: 1.5, nUp: 3 },
  '5x7-4up': { id: '5x7-4up', label: '5×7 — 4-up', sheetMm: { w: 127,   h: 177.8 }, cols: 2, rows: 2, orientation: 'portrait',  bleedMm: 1.5, nUp: 4 },
}

export const DEFAULT_PRESET = PRESETS['letter']
