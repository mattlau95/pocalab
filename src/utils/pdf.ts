import { PDFDocument, degrees } from 'pdf-lib'
import { computeFrontSlots, computeBackSlots, drawCropMarks, BLEED_W, BLEED_H } from './layout'

export type PdfSlot = { front: string | null; back: string | null }

type Calibration = { theta: number; dx: number; dy: number }

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1]
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function readCalibration(): Calibration {
  try {
    const raw = localStorage.getItem('photocard-calibration')
    if (raw) return JSON.parse(raw) as Calibration
  } catch { /* ignore */ }
  return { theta: 0, dx: 0, dy: 0 }
}

export async function createPhotocardPdf(slots: PdfSlot[]): Promise<Uint8Array> {
  const cal = readCalibration()
  const doc = await PDFDocument.create()
  const frontPage = doc.addPage([612, 792])
  const backPage = doc.addPage([612, 792])

  const frontSlots = computeFrontSlots()
  const backSlots = computeBackSlots()

  for (let i = 0; i < Math.min(slots.length, 9); i++) {
    const { front, back } = slots[i]

    if (front) {
      const img = await doc.embedPng(dataUrlToBytes(front))
      frontPage.drawImage(img, { x: frontSlots[i][0], y: frontSlots[i][1], width: BLEED_W, height: BLEED_H })
    }

    if (back) {
      const img = await doc.embedPng(dataUrlToBytes(back))
      backPage.drawImage(img, {
        x: backSlots[i][0] + cal.dx,
        y: backSlots[i][1] + cal.dy,
        width: BLEED_W,
        height: BLEED_H,
        rotate: degrees(cal.theta),
      })
    }
  }

  drawCropMarks(frontPage)
  drawCropMarks(backPage)

  return doc.save()
}
