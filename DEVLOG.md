# Devlog — Photocard Generator

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
