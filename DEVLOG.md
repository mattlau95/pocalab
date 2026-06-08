# Devlog — Photocard Generator

_A series on building a browser tool to print K-pop photocards exactly right._

---

## Introduction

I print my own K-pop photocards. This is the log of building a proper tool to do it.

### The hobby

Photocards are small trading cards — 55 × 85 mm — that come packaged with K-pop albums and merch. Fans collect them, trade them, and hunt specific members or versions the same way you'd chase a rare Pokémon card. Part of the culture is also making your own: custom cards of eras that didn't get official prints, photosets from concert footage, cards of niche groups that never made it to wide distribution. You print them, cut them, sleeve them. They feel real because they are real — same size, same card stock, same weight in your hand.

### The manual reality

My current workflow lives in a Canva file I built years ago. It has bleed zones, cut lines, and alignment guides baked in — a US Letter sheet laid out for duplex printing, with slots for front and back pairs. It works. It's also a slog every single time.

Every new batch means: find the source images, crop each one to fit the bleed area without cutting off faces or text, drag it onto the Canva canvas, nudge it until it aligns with the guides, repeat for the back, repeat for every card in the set, export, print, check the duplex alignment, sometimes reprint. If I want two copies of one card and one of another, I'm manually duplicating and repositioning. If the image is portrait but slightly off-ratio, I'm eyeballing it. The process is the same every time, and it never gets faster.

### The itch to automate

At some point I caught myself re-cropping the same image for the third time because I'd nudged it two pixels off and the bleed looked wrong, and the thought that stopped me was: _I build software for a living. Why am I doing this by hand?_

This is a fixed, repeatable process. The card dimensions don't change. The sheet layout doesn't change. The duplex registration doesn't change. Every step I do manually in Canva is a step a tool could do deterministically, in seconds, with no eyeballing required. The only variable is the images themselves — and even that's just a crop with a known target size.

### The vision

Upload your images → crop each one to exact card spec with bleed → arrange your deck → generate a print-ready double-sided US Letter PDF. Goodbye Canva.

### The catch — why it's not trivial

If this were just "put images on a PDF," it'd be a weekend script. The interesting parts are:

**Hitting exact physical dimensions from a browser.** A 55 mm card has to be exactly 55 mm when it comes out of the printer, which means the PDF has to encode dimensions precisely in points (72 pt/inch), not pixels, and the image data has to be rasterized at 300 DPI. Getting mm → px → pt to agree without rounding errors is where the math lives.

**Bleed, trim, and safe zones.** The image extends to 59 × 89 mm (bleed) so there's no white edge if the cut drifts slightly. The cut target is 55 × 85 mm. Anything important — text, faces, key art — has to stay inside 51 × 81 mm (safe zone). The crop tool has to enforce all three simultaneously.

**Front/back duplex alignment.** Printing double-sided means the front of card 1 and the back of card 1 have to land on opposite sides of the same sheet in the right positions for the page to fold or flip correctly. Get the layout wrong and every card comes out with a misaligned back.

**Two-hole calibration.** The clever bit: rather than trusting that every printer's duplex alignment is perfect, the plan is to build a calibration sheet — print it once, punch two holes through both layers, measure the offset, and feed that offset back in as a correction. Mechanical registration instead of trial and error.

That's enough to earn a devlog.

### What's ahead

This series will cover locking the print spec and why those numbers are what they are, the architecture decisions for a purely client-side app, building the crop tool, the PDF generation pipeline, and the calibration system. Entry one is below.

---

## 2026-06-08 — Epic 2: Crop Tool (MAT-145)

The crop tool is the core of the whole app — everything else depends on it producing a correctly sized image. The goal: given an arbitrary photo, let the user frame it within the bleed bounds, then export exactly 697×1051 px of source image data.

### MAT-155 — Image upload

`ImageUpload` is a drag-drop zone with a file picker fallback. Validates on the client before anything touches the DOM: accepted types are JPEG, PNG, and WebP; max file size is 50 MB. Rejected files get an inline error. Accepted files produce a `File` object — the component doesn't touch URLs or data, that's the caller's job.

The 50 MB cap is conservative — most source images are under 10 MB — but it prevents someone from accidentally dropping a raw file from a mirrorless camera and wondering why the tab froze.

### MAT-156 — Crop UI with bleed / trim / safe guides

Three nested overlays rendered on top of the crop viewport, all driven by the same `CARD_*` constants from `dimensions.ts`:

- **Bleed (59×89 mm)** — the crop frame itself. The exported image fills to here.
- **Trim (55×85 mm)** — dashed white line at 93.2% of the bleed frame. Cut target.
- **Safe zone (51×81 mm)** — amber line at 86.4% of the bleed frame. Keep faces and text inside this.

The guides are absolutely positioned divs centered over the crop frame using percentages derived from the mm constants. They're `pointer-events: none` so they don't interfere with panning.

### MAT-157 — Pan / zoom / position

Handled by [react-easy-crop](https://github.com/ValentinoUberti/react-easy-crop). The crop frame is fixed at 295×445 px on screen (59:89 ratio at 5 px/mm). The image pans and zooms underneath it. `minZoom=1` enforces that the image always covers the full bleed area — no empty edges in the export.

The library outputs `croppedAreaPixels: { x, y, width, height }` — the rectangle of source pixels that maps to the crop frame. That's all we need for the export step.

### MAT-158 — Low-res warning

When `croppedAreaPixels.width < 697 || croppedAreaPixels.height < 1051`, the source image doesn't have enough pixels for a 300 DPI output at card size. A red warning banner appears. It doesn't block the export — the user might intentionally be printing a smaller card, or they might accept a slightly soft result — but they're informed.

This fires most often when someone zooms in heavily on a low-resolution source.

### MAT-159 — Canvas export at 300 DPI

`getCroppedDataUrl` in `src/utils/cropImage.ts`: creates an offscreen 697×1051 canvas, draws the `croppedAreaPixels` region of the source image onto it scaled to fill, and returns a PNG data URL. The canvas dimensions match `CARD_BLEED.widthPx` / `heightPx` from the constants — again, one source of truth.

The same component and utility are used for both front and back. The caller decides which card slot gets the result.

### App wiring

`App.tsx` now manages a two-step flow: idle (upload zone + card grid) and crop (full-screen crop editor). On confirm, `URL.revokeObjectURL` cleans up the object URL immediately, and the card is added to the in-memory deck with `front` set. The card grid in the idle view shows thumbnails of confirmed fronts.

---

## 2026-06-08 — Epic 1: Foundation & Data Model (MAT-144)

### What this app is

Client-side web app to replace a manual Canva workflow for printing K-pop photocards. You upload images, crop them to card spec with bleed, build a deck, and generate a print-ready double-sided US Letter PDF with two-hole duplex calibration. No backend, no server — everything runs in the browser.

### Print spec (locked)

| Zone   | Width | Height |
|--------|-------|--------|
| Bleed (full print area) | 59 mm / 697 px | 89 mm / 1051 px |
| Trim (cut line) | 55 mm / 650 px | 85 mm / 1004 px |
| Safe zone | 51 mm | 81 mm |

All pixel values are at 300 DPI: `floor(mm × 300 / 25.4)`.

---

### MAT-150 — Scaffold (React + Vite + TypeScript)

Initialized from `npm create vite@latest . -- --template react-ts`. Stripped the default Vite counter demo and replaced it with a minimal layout shell: a header with the app name and a `<main>` content area. Set up the source structure:

```
src/
├── components/
├── hooks/
├── models/
└── utils/
```

Client-side only. No router yet — single page for now.

---

### MAT-151 — mm↔px Conversion Utilities

`src/utils/dimensions.ts` — the single source of truth for all dimensional math:

- `mmToPx(mm)` → `Math.floor(mm × 300 / 25.4)`
- `pxToMm(px)` → inverse
- `CARD_BLEED`, `CARD_TRIM`, `CARD_SAFE` constants derived from `mmToPx` so they're always consistent with the formula

These constants will be referenced everywhere: the cropper canvas size, the PDF page layout, and eventually the crop-mark drawing logic.

---

### MAT-152 — Core Data Model

**`Card { id, front, back }`** — `front` and `back` are data URLs (strings) or `null` if not yet uploaded. `id` is a `crypto.randomUUID()`.

**`Deck { cards[], copies{} }`** — `cards` holds up to 9 `Card` objects; `copies` is a `Record<cardId, number>` for per-card copy counts (default 1 when a card is added).

State is managed by `useDeck` (`src/hooks/useDeck.ts`), a `useReducer`-based hook. Three actions: `ADD_CARD` (silently no-ops if already at 9), `REMOVE_CARD`, `SET_COPIES`. Purely in-memory — no persistence layer.

---

### MAT-153 — beforeunload Warning

`src/hooks/useBeforeUnload.ts` — takes a boolean `enabled` and registers a `beforeunload` handler that calls `e.preventDefault()` (which triggers the browser's native "leave page?" dialog). Enabled whenever `deck.cards.length > 0`. Cleans up its own listener on unmount or when disabled.

An accidental refresh won't silently wipe a session mid-workflow.

---

### MAT-154 — PDF Library Decision: pdf-lib ✓

Evaluated **pdf-lib** vs **jsPDF** for this use case.

**Chose pdf-lib.** Reasons:

- TypeScript-native — jsPDF's types are a community add-on
- Full coordinate control: `page.drawImage()` and `page.drawLine()` at exact points, which is what's needed for placing cards at precise bleed/trim offsets and drawing crop marks
- No HTML renderer — jsPDF's main selling point is irrelevant here since we're compositing cropped image data programmatically, not rendering DOM
- Smaller bundle, actively maintained

The only friction with pdf-lib is that it works in **points** (72 pt/inch), not mm. Solved by adding `mmToPt(mm)` → `mm × 72 / 25.4` to `src/utils/pdf.ts`, alongside `mmToPx` in dimensions.ts.

`createPhotocardPdf` is stubbed — returns a single blank Letter page to confirm the import works. Full implementation is MAT-155+.
