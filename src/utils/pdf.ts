import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib'
import {
  computeFrontSlots, computeBackSlots, drawCropMarks,
  BLEED_W, BLEED_H, LETTER_CONFIG, A4_CONFIG, mmToPt,
} from './layout'

export type PdfSlot = { front: string | null; back: string | null }
export type PaperSize = 'letter' | 'a4'

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

export async function createPhotocardPdf(slots: PdfSlot[], paperSize: PaperSize = 'letter'): Promise<Uint8Array> {
  const cal = readCalibration()
  const cfg = paperSize === 'a4' ? A4_CONFIG : LETTER_CONFIG

  const doc = await PDFDocument.create()
  const helvetica = await doc.embedFont(StandardFonts.Helvetica)
  const frontPage = doc.addPage([cfg.pageW, cfg.pageH])
  const backPage = doc.addPage([cfg.pageW, cfg.pageH])

  const frontSlots = computeFrontSlots(cfg)
  const backSlots = computeBackSlots(cfg)
  const gray = rgb(0.5, 0.5, 0.5)

  // Back crop marks go under photos so slight misalignment doesn't show through
  drawCropMarks(backPage, cfg)

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

  drawCropMarks(frontPage, cfg)

  // Orientation labels
  const gridTop = cfg.marginY + 3 * BLEED_H
  const topLabel = 'TOP ^'
  const topLabelW = helvetica.widthOfTextAtSize(topLabel, 7)
  const sideLabel = 'TOP >'
  const sideLabelW = helvetica.widthOfTextAtSize(sideLabel, 7)

  const leftMarginX = cfg.marginX - mmToPt(3)
  const rightMarginX = cfg.marginX + 3 * BLEED_W + mmToPt(4)
  const sideTopY = gridTop - mmToPt(2) - mmToPt(3) - sideLabelW

  for (const page of [frontPage, backPage]) {
    page.drawText(topLabel, {
      x: (cfg.pageW - topLabelW) / 2,
      y: gridTop + mmToPt(2),
      size: 7, font: helvetica, color: gray,
    })
    page.drawText(sideLabel, {
      x: leftMarginX, y: sideTopY,
      size: 7, font: helvetica, color: gray, rotate: degrees(90),
    })
    page.drawText(sideLabel, {
      x: rightMarginX, y: sideTopY,
      size: 7, font: helvetica, color: gray, rotate: degrees(90),
    })
  }

  frontPage.drawText('flip long edge ->', {
    x: cfg.marginX + 3 * BLEED_W + mmToPt(4),
    y: cfg.pageH / 2,
    size: 7, font: helvetica, color: gray, rotate: degrees(90),
  })

  return doc.save()
}
