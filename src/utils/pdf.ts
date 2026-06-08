// pdf-lib chosen over jsPDF: TypeScript-native, precise coordinate control for
// crop-mark drawing, exact pt-based layout without HTML rendering overhead.
import { PDFDocument, PageSizes } from 'pdf-lib'

export function mmToPt(mm: number): number {
  return (mm * 72) / 25.4
}

// TODO: MAT-155+ — implement full double-sided letter PDF generation
export async function createPhotocardPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.addPage(PageSizes.Letter)
  return doc.save()
}
