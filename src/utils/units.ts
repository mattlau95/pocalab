// The one place units are defined. Everything that converts millimetres
// imports from here: crop output is pixels at 300 DPI, PDFs are points at
// 72 per inch, and layout maths is millimetres.

export const DPI = 300
export const MM_PER_INCH = 25.4
export const PT_PER_INCH = 72

export const MM_TO_PT = PT_PER_INCH / MM_PER_INCH

// Rounds to the nearest pixel, which is the closest whole-pixel match for the
// physical size: 59 mm is 696.85 px at 300 DPI, so a bleed-size crop is 697 px.
export function mmToPx(mm: number): number {
  return Math.round((mm * DPI) / MM_PER_INCH)
}

export function mmToPt(mm: number): number {
  return (mm * PT_PER_INCH) / MM_PER_INCH
}
