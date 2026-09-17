import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPhotocardPdf, type PdfSlot } from '../src/utils/pdf'
import { buildPrintPdf } from '../src/utils/printPdf'
import { PRESETS, type PrintPreset } from '../src/models/preset'
import type { Deck } from '../src/models/deck'
import { solidPngDataUrl } from './helpers/png'
import { summarizePdf } from './helpers/pdfOps'

// These pin down exactly what each PDF builder draws, so refactors of the
// units and PDF code (MAT-724) can prove the output did not change.
// Update the stored snapshots with: npm test -- --test-update-snapshots

const MM_TO_PT = 72 / 25.4
const BLEED_W = 59 * MM_TO_PT
const BLEED_H = 89 * MM_TO_PT
const close = (actual: number, expected: number, what: string) =>
  assert.ok(Math.abs(actual - expected) < 0.02, `${what}: expected ${expected}, got ${actual}`)

const RED = solidPngDataUrl(20, 30, [200, 30, 30])
const BLUE = solidPngDataUrl(20, 30, [30, 30, 200])
const GREEN = solidPngDataUrl(20, 30, [30, 160, 60])

test('Letter: fronts fill slots in order, backs are mirrored across the page', async () => {
  const slots: PdfSlot[] = [
    { front: RED, back: BLUE },
    { front: RED, back: null },
    { front: GREEN, back: GREEN },
  ]
  const [front, back] = await summarizePdf(await createPhotocardPdf(slots, 'letter'))

  assert.deepEqual(front.size, [612, 792])
  assert.equal(front.images.length, 3)
  assert.equal(back.images.length, 2, 'a slot with no back draws nothing on the back page')
  for (const [, , w, h] of [...front.images, ...back.images]) {
    close(w, BLEED_W, 'image width')
    close(h, BLEED_H, 'image height')
  }
  // Slots run left to right along the top row.
  assert.ok(front.images[0][0] < front.images[1][0] && front.images[1][0] < front.images[2][0])
  // Long-edge duplex: back x = pageWidth - front x - bleed width, same y.
  close(back.images[0][0], 612 - front.images[0][0] - BLEED_W, 'mirrored x of slot 1')
  close(back.images[0][1], front.images[0][1], 'y of slot 1')
  close(back.images[1][0], 612 - front.images[2][0] - BLEED_W, 'mirrored x of slot 3')
})

test('A4: page size and a full 3×3 sheet', async () => {
  const slots = Array.from({ length: 9 }, () => ({ front: RED, back: BLUE }))
  const [front, back] = await summarizePdf(await createPhotocardPdf(slots, 'a4'))
  close(front.size[0], 595.28, 'A4 width')
  close(front.size[1], 841.89, 'A4 height')
  assert.equal(front.images.length, 9)
  assert.equal(back.images.length, 9)
})

test('Letter/A4: anything past nine slots is ignored', async () => {
  const slots = Array.from({ length: 12 }, () => ({ front: RED, back: BLUE }))
  const [front, back] = await summarizePdf(await createPhotocardPdf(slots, 'letter'))
  assert.equal(front.images.length, 9)
  assert.equal(back.images.length, 9)
})

test('Letter/A4: progress is reported once per slot, starting at zero', async () => {
  const calls: [number, number][] = []
  await createPhotocardPdf([{ front: RED, back: null }, { front: BLUE, back: null }], 'letter', (d, t) => calls.push([d, t]))
  assert.deepEqual(calls, [[0, 2], [1, 2], [2, 2]])
})

const photoPresets = Object.values(PRESETS).filter(p => p.id !== 'letter' && p.id !== 'a4')

function deckOf(count: number, overrides: Partial<Deck> = {}): Deck {
  const cards = Array.from({ length: count }, (_, i) => ({ id: `card-${i}`, front: i % 2 ? BLUE : RED, back: i === 0 ? GREEN : null }))
  return { cards, copies: Object.fromEntries(cards.map(c => [c.id, 1])), sharedBack: BLUE, ...overrides }
}

for (const preset of photoPresets) {
  test(`${preset.label} ${preset.nUp}-up: one image per card, shared back fallback, mirrored backs`, async () => {
    const [front, back] = await summarizePdf(await buildPrintPdf(preset, deckOf(preset.nUp)))
    close(front.size[0], preset.sheetMm.w * MM_TO_PT, 'sheet width')
    close(front.size[1], preset.sheetMm.h * MM_TO_PT, 'sheet height')
    assert.equal(front.images.length, preset.nUp)
    assert.equal(back.images.length, preset.nUp, 'cards without their own back use the shared back')
    front.images.forEach(([x, y, w], i) => {
      close(back.images[i][0], front.size[0] - x - w, `mirrored x of slot ${i + 1}`)
      close(back.images[i][1], y, `y of slot ${i + 1}`)
    })
  })
}

test('photo paper: copies are ignored and extra cards are dropped', async () => {
  const preset = PRESETS['5x7-2up'] as PrintPreset
  const deck = deckOf(3)
  deck.copies['card-0'] = 2
  const [front] = await summarizePdf(await buildPrintPdf(preset, deck))
  assert.equal(front.images.length, 2)
})

test('photo paper: progress is reported once per card', async () => {
  const calls: [number, number][] = []
  await buildPrintPdf(PRESETS['5x7-3up'], deckOf(3), (d, t) => calls.push([d, t]))
  assert.deepEqual(calls, [[0, 3], [1, 3], [2, 3], [3, 3]])
})

test('drawing operators match the stored snapshot', async (t) => {
  const letter = await summarizePdf(await createPhotocardPdf(
    [{ front: RED, back: BLUE }, { front: BLUE, back: null }, { front: GREEN, back: GREEN }], 'letter'))
  const a4 = await summarizePdf(await createPhotocardPdf([{ front: RED, back: BLUE }], 'a4'))
  const photo = await Promise.all(photoPresets.map(async p => [p.id, await summarizePdf(await buildPrintPdf(p, deckOf(p.nUp)))] as const))
  t.assert.snapshot({ letter, a4, ...Object.fromEntries(photo) })
})
