const DPI = 300

export function mmToPx(mm: number): number {
  return Math.floor((mm * DPI) / 25.4)
}

export function pxToMm(px: number): number {
  return (px * 25.4) / DPI
}

export const CARD_BLEED = {
  widthMm: 59,
  heightMm: 89,
  widthPx: mmToPx(59),   // 697
  heightPx: mmToPx(89),  // 1051
} as const

export const CARD_TRIM = {
  widthMm: 55,
  heightMm: 85,
  widthPx: mmToPx(55),   // 650
  heightPx: mmToPx(85),  // 1004
} as const

export const CARD_SAFE = {
  widthMm: 51,
  heightMm: 81,
} as const
