import { mmToPx } from './units'

// Card geometry. Millimetres are the source of truth; pixel sizes are the
// 300 DPI crop output.

export const CARD_TRIM = {
  widthMm: 55,
  heightMm: 85,
  widthPx: mmToPx(55),   // 650
  heightPx: mmToPx(85),  // 1004
} as const

// The crop editor always rasterises with this bleed on each side. Print
// presets may place cards with a different bleed (see PrintPreset.bleedMm).
export const CROP_BLEED_MM = 2

export const CARD_BLEED = {
  widthMm: CARD_TRIM.widthMm + 2 * CROP_BLEED_MM,    // 59
  heightMm: CARD_TRIM.heightMm + 2 * CROP_BLEED_MM,  // 89
  widthPx: mmToPx(CARD_TRIM.widthMm + 2 * CROP_BLEED_MM),   // 697
  heightPx: mmToPx(CARD_TRIM.heightMm + 2 * CROP_BLEED_MM), // 1051
} as const

// Crops exported before the switch to round-to-nearest are one pixel narrower;
// auto-fill still recognises them.
export const LEGACY_BLEED_WIDTH_PX = 696

export const CARD_SAFE = {
  widthMm: 51,
  heightMm: 81,
} as const
