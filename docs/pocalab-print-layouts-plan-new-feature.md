# Pocalab — Print Layout / Imposition Plan

Adding paper-size print functionality (4×6 and 5×7) to the photocard maker, with proper bleed and gutter-and-waste trimming so adjacent cards never contaminate each other's edges.

Card size is fixed at **85 × 55 mm** (standard photocard). All geometry below derives from that.

---

## 1. Goal

Let the user export a print-ready PDF that imposes multiple 85×55 cards onto a chosen photo-paper size, with:

- Correct bleed (artwork extended past the trim line so no white slivers).
- A **gutter = 2 × bleed** between any two adjacent cards, with the gutter discarded as a waste strip on cut — so a slightly-off cut only ever touches a card's *own* bleed, never the neighbor's content.
- Crop marks at every trim corner for registration on the trimmer.

---

## 2. The four layout presets

Units in mm. Sheet sizes are exact in PostScript points (1 in = 72 pt), which matters for pdf-lib.

| Preset | Sheet | N-up | Orientation | Bleed | Gutter (2×bleed) | Outer margin (X / Y) | Verdict |
|---|---|---|---|---|---|---|---|
| A | 4×6 (101.6×152.4) | 2 | landscape (85w×55h) | 3.0 mm | 6.0 mm | 8.3 / 18.2 mm | Comfortable — full bleed, low risk |
| B | 5×7 (127×177.8) | 2 | landscape (85w×55h) | 3.0 mm | 6.0 mm | 21.0 / 30.9 mm | Most reliable — huge margins |
| C | 5×7 (127×177.8) | 3 | landscape (85w×55h) | 1.5 mm | 3.0 mm | 21.0 / 3.4 mm | Balanced — yield vs. tight vertical |
| D | 5×7 (127×177.8) | 4 | portrait (55w×85h, 2×2) | 1.5 mm | 3.0 mm | 7.0 / 2.4 mm | Max yield — fragile, validate carefully |

### Why these bleed values are the ceiling, not a preference

The binding constraint is always the tight axis. Solving `cards + gutters + 2×outer-bleed ≤ sheet` for the max bleed each layout can physically hold:

| Preset | Tight axis | Max bleed that still fits |
|---|---|---|
| A (4×6, 2-up) | horizontal | ~8.3 mm |
| B (5×7, 2-up) | vertical | ~16.9 mm |
| C (5×7, 3-up) | vertical | ~2.1 mm |
| D (5×7, 4-up) | vertical | ~1.9 mm |

So A and B can run the full 3 mm bleed with room to spare. **C and D physically cannot** — that's why they're specced at 1.5 mm (3-up has 3.8 mm of total vertical slack at 1.5 mm; 4-up has only 1.8 mm). The app should clamp the bleed control to each preset's max and surface a warning when the user pushes it.

### Cut effort per preset

- A / B (single column, 2 cards): 1 internal waste strip (2 cuts) + 4 outer trims.
- C (single column, 3 cards): 2 internal waste strips (4 cuts) + 4 outer trims.
- D (2×2): 1 vertical waste strip + 1 horizontal waste strip + outer trims — the most cuts and the only one needing column-to-column registration.

Recommendation surfaced in UI: default to **B** for reliability, offer **C** for balance, gate **D** behind a "tight layout" warning. Note in copy that letter-size still beats all of these on yield-with-safe-margins if the user has a wide-format need — but that's out of scope for this 4×6/5×7 feature.

---

## 3. Geometry engine (pure function)

One parametric function computes everything; no per-preset hand placement. Work in mm internally, convert to points only at draw time.

```
MM_TO_PT = 72 / 25.4   // 2.834645669

interface Preset {
  id: string
  sheetMm: { w: number; h: number }
  cols: number
  rows: number
  orientation: 'landscape' | 'portrait'
  bleedMm: number
}

function layout(p: Preset) {
  const cardW = p.orientation === 'landscape' ? 85 : 55
  const cardH = p.orientation === 'landscape' ? 55 : 85
  const gutter = 2 * p.bleedMm

  const contentW = p.cols * cardW + (p.cols - 1) * gutter
  const contentH = p.rows * cardH + (p.rows - 1) * gutter

  const marginX = (p.sheetMm.w - contentW) / 2
  const marginY = (p.sheetMm.h - contentH) / 2

  // VALID only if each outer card can hold full bleed inside the sheet:
  const valid = marginX >= p.bleedMm && marginY >= p.bleedMm

  // trim rects (the finished 85×55 card), origin top-left, y-down for preview:
  const cards = []
  for (let r = 0; r < p.rows; r++) {
    for (let c = 0; c < p.cols; c++) {
      cards.push({
        x: marginX + c * (cardW + gutter),
        y: marginY + r * (cardH + gutter),
        w: cardW,
        h: cardH,
      })
    }
  }
  return { cardW, cardH, gutter, contentW, contentH, marginX, marginY, valid, cards }
}

function maxBleed(p): number {
  // largest b s.t. both axes still hold full outer bleed
  const cardW = p.orientation === 'landscape' ? 85 : 55
  const cardH = p.orientation === 'landscape' ? 55 : 85
  // sheetW >= cols*cardW + (cols-1)*2b + 2b  =>  b <= (sheetW - cols*cardW) / (2*cols)
  const bx = (p.sheetMm.w - p.cols * cardW) / (2 * p.cols)
  const by = (p.sheetMm.h - p.rows * cardH) / (2 * p.rows)
  return Math.min(bx, by)
}
```

`maxBleed` drives the bleed-slider clamp and the validation warning.

---

## 4. Bleed handling — real vs. overscan

Photocard art is full-bleed photo, so each card image must supply `bleed` mm of extra image on every side, or the trim edge shows paper.

Two cases the app must handle:

1. **Source has real bleed.** The uploaded/composed card already extends past the 85×55 trim. Place the image so its trim box lands on the card rect; the overflow falls into the gutter/margin. Preferred.
2. **Source is exactly 85×55 (no bleed data).** Most user images. Synthesize bleed by **overscan**: scale the image to `(cardW + 2·bleed) / cardW` and center it on the trim rect, so it spills `bleed` on each side. Cheap, and acceptable for photographic content where a 1–3 mm edge crop is invisible. This is the default path.

> Implementation note: overscan crops the image slightly. Warn (or offer a "keep full image, add white border" alternative) for designs with content near the edge — though for photocards, edge-to-edge photo is the norm and overscan is fine.

The drawn image rect is therefore *larger* than the trim rect by `bleed` on each side; the crop marks (below) mark the actual 85×55 trim, not the image extent.

---

## 5. Crop marks & cut guides

For the waste-strip model, marks sit at every card's trim corners, drawn **outside** the trim into the gutter/margin so they're removed on the cut.

- Hairline, ~0.25 pt, registration black.
- Tick length ~3–4 mm, offset ~1 mm from the trim corner (don't touch the artwork).
- Two ticks per corner (one per edge direction).
- Optional: faint full-length cut guides spanning the sheet at each trim line, toggleable, for users cutting on a rotary trimmer who want to line up the rail.

In a gutter of width `2·bleed`, the two neighboring trim lines are `2·bleed` apart and the whole gutter is waste — marks for both cards live in that strip.

---

## 6. pdf-lib generation

pdf-lib uses points, bottom-left origin (y-up) — flip the preview's y-down rects.

```
import { PDFDocument, rgb } from 'pdf-lib'

async function buildPrintPdf(preset, cardImages /* one per slot, or repeat */) {
  const L = layout(preset)
  const pdf = await PDFDocument.create()
  const pageW = preset.sheetMm.w * MM_TO_PT
  const pageH = preset.sheetMm.h * MM_TO_PT
  const page = pdf.addPage([pageW, pageH])

  for (let i = 0; i < L.cards.length; i++) {
    const card = L.cards[i]
    const img = await pdf.embedPng(cardImages[i % cardImages.length]) // or embedJpg

    // image rect = trim rect grown by bleed on all sides (overscan path)
    const b = preset.bleedMm
    const imgX = (card.x - b) * MM_TO_PT
    // convert y-down (top-left) to pdf y-up (bottom-left):
    const imgYTop = card.y - b
    const imgHmm = card.h + 2 * b
    const imgY = pageH - (imgYTop + imgHmm) * MM_TO_PT
    page.drawImage(img, {
      x: imgX,
      y: imgY,
      width: (card.w + 2 * b) * MM_TO_PT,
      height: imgHmm * MM_TO_PT,
    })

    drawCropMarks(page, card, pageH) // hairlines at the 85×55 trim corners
  }
  return pdf.save()
}
```

Page sizes come out clean: 4×6 = 288×432 pt, 5×7 = 360×504 pt. Card = 240.94×155.91 pt.

`drawImage` clips nothing on its own, so overscanned images from adjacent slots will overlap *in the gutter* — that's intentional (both bleed into the shared waste strip). Just confirm draw order doesn't matter since the overlap region is discarded on cut.

---

## 7. UI / UX additions

- **Paper size selector**: 4×6, 5×7 (Letter already exists / future).
- **N-up selector**, filtered to valid presets for the chosen sheet (4×6 → 2-up only; 5×7 → 2/3/4-up).
- **Bleed control**, clamped to `maxBleed(preset)`, default 3 mm where allowed else the preset's spec value; show the clamp ceiling inline.
- **Live preview** reusing the existing canvas: draw sheet, trim rects, gutter/waste strips shaded, crop marks, and the overscan image extent. Flag `valid === false` states.
- **Reliability hint** per preset (e.g. "4-up is tight — leave 1.5 mm bleed and expect near-perfect registration").
- **Export** → `buildPrintPdf`, download.

---

## 8. ET-8550 print settings (surface in export dialog)

Validated earlier on your unit; fold the guidance in rather than re-running calibration (that epic stays deprioritized):

- Feed photo paper / cardstock through the **rear straight pass**, not the front cassette — the cassette's roller bend skews stiff stock and breaks registration.
- Enable **borderless** for the sheet size so outer-card bleed reaches the paper edge.
- Set media type to the matching photo/matte profile; allow extra **dry time** before laminating.
- Note that lamination heat can stretch the sheet a hair — one more reason C and D's thin margins are risky, and why the waste-strip gutter matters.

---

## 9. Suggested Linear breakdown

1. Geometry engine + `maxBleed` + unit tests on the four presets (assert `valid` and slack values).
2. Overscan bleed synthesis + "image has bleed" passthrough.
3. pdf-lib export with crop marks; verify clean page-point sizes.
4. UI: size + N-up + clamped bleed + valid-state warnings.
5. Live preview rendering (sheet, trims, waste strips, marks, overscan extent).
6. ET-8550 export-dialog guidance copy.
7. Real-paper trim test across A–D; confirm no neighbor contamination at each preset's specced bleed.
