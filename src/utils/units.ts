// The one place units are defined. Everything that converts millimetres
// imports from here: crop output is pixels at 300 DPI, PDFs are points at
// 72 per inch, and layout maths is millimetres.

export const DPI = 300
export const MM_PER_INCH = 25.4
export const PT_PER_INCH = 72

export const MM_TO_PT = PT_PER_INCH / MM_PER_INCH

// Rounds down so a card is never rasterised larger than its physical size.
export function mmToPx(mm: number): number {
  return Math.floor((mm * DPI) / MM_PER_INCH)
}

export function mmToPt(mm: number): number {
  return (mm * PT_PER_INCH) / MM_PER_INCH
}
