# Devlog — pocalab

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

## 2026-06-19 — Accessibility quick wins (MAT-408, MAT-412, MAT-414, MAT-417)

Four P1/P2 quick wins from the June 18 UX audit, all targeting screen reader support and error recovery.

### MAT-408 — Aria-labels on icon-only buttons

Several buttons announced themselves to screen readers as just "button" with no context. `title` attributes were present on some but aren't a reliable accessible name source.

Fixed across two files:

- **`CropEditor.tsx`** — `aria-label` added to rotate left/right, zoom in/out, eye dropper, and grid toggle. The grid toggle already had `aria-pressed`; that was kept alongside the new label.
- **`DeckCard.tsx`** — Edit and Replace buttons have visible text but no front/back distinction. With two "Edit" buttons on screen (one per side), a screen reader user had no way to know which was which. `aria-label="Edit front image"` / `aria-label="Edit back image"` (and equivalents for Replace) resolves the ambiguity.

### MAT-412 — Surface localStorage write failures with a toast

`useProject.ts` silently swallowed all `localStorage.setItem` errors. If storage was full or unavailable, the project quietly stopped persisting — the user would assume their work was saved when it wasn't.

The catch block now sets a `storageWriteError` string exposed from the hook. A `useRef` flag prevents the same error from firing on every project update; it shows at most once per session. `App.tsx` watches `storageWriteError` via `useEffect` and populates a `storageToast` state when it fires.

The storage toast renders as `.toast--error` — a persistent variant (no auto-dismiss) with a dismiss button, styled in red against the existing green info toast. It uses `role="alert"` and `aria-live="assertive"` so screen readers announce it immediately.

### MAT-414 — Retry button on PDF export error

When PDF generation failed, the error message appeared with no recovery path — users had to mentally note the error, dismiss it, and find the export button themselves.

A new `exportErrorDeckIndex` state tracks which deck triggered the failure. Both error locations (desktop `.deck-actions__error` and mobile `.deck-bar__error`) now render an inline "Try again" button that clears the error and re-calls `handleExport(exportErrorDeckIndex ?? 0)`. For `handleExportAll` failures the index is set to `null`, so retry falls back to deck 0 (all-sheets export has its own button anyway).

The button uses a new `.link-button` utility class — unstyled button that inherits font and color, underlined — so it reads as inline text rather than a separate control.

### MAT-417 — `aria-busy` on export area during PDF generation

During export, buttons disabled and label changed to "Generating…" but the containers carried no ARIA state. Screen readers relying on region announcements couldn't detect that the area was updating.

`aria-busy={exporting}` added to both `.deck-actions--desktop` and `.deck-bar`. One-line change; no visual effect.

---

## 2026-06-19 — Paper size switching bugs (MAT-394, MAT-436, MAT-437)

### MAT-437 — Consolidate cards when switching to a larger-nUp preset

`SET_PRESET` in `useProject.ts` previously iterated decks one-by-one and only ever split cards into additional sheets. Switching to a preset with a *higher* nUp (e.g. 4×6 2-up → Letter 9-up) left cards fragmented across many sheets instead of packing them back together. That's the root cause of the "cards being taken away" report — they weren't gone, just spread across sheets confusingly.

**Fix: flatten-then-repack.** Rather than iterating each existing deck in isolation, the reducer now:

1. Flattens all cards from all decks into a single ordered list, clamping each card's copies to `newNUp` (so no single card can individually exceed a full sheet).
2. Repacks that list sequentially into the minimum number of decks — starting a new deck whenever the running total would exceed `newNUp`.

This naturally handles both directions: a smaller nUp splits overflow, a larger nUp consolidates. The clamping also prevents stale copies values from producing decks that exceed the new cap.

```ts
// Before: deck-by-deck — never merged across original deck boundaries
for (const deck of project.decks) { ... newDecks.push(current) }

// After: flatten first, then repack
const flat = project.decks.flatMap(d => d.cards.map(c => ({ card: c, copies: min(d.copies[c.id], newNUp), sharedBack: d.sharedBack })))
// repack flat into newDecks of size newNUp
```

### MAT-436 — DeckPaperLabel always visible above the sheet list

`DeckPaperLabel` (the dark pill showing the sheet icon + paper name + dimensions) was only rendered inside the per-deck header when there was exactly one deck. The moment a preset switch created multiple sheets, every header switched to "Sheet N" text and the format indicator disappeared entirely.

**Fix.** The label is now rendered once in a persistent `div.deck-list__label` above the deck loop, visible whenever any cards exist. The per-deck header no longer carries `DeckPaperLabel` — it shows "Sheet N" only when multiple decks exist, and nothing in the left slot otherwise. `.deck-list__label { margin-bottom: 12px }` was added to `App.css` for spacing.

### Copies controls on photo paper

The +/− copies buttons were hidden on all photo paper presets (`hideCopies={isPhotoPaper}`). There's no reason to restrict this — a user printing a 4×6 2-up sheet may well want two copies of the same card. The `hideCopies` prop was removed from the `<DeckCard>` call. `isPhotoPaper` still controls sheet-management UI (Add sheet, Move-to). The "sheet is full" message was unified to "Sheet is full — remove a card or reduce copies to add more." for both preset types.

### MAT-394 — Data model (already done)

The multi-deck + preset model described in this issue (`Project`, `Deck`, `PrintPreset`, `useProject`) was already fully implemented. Marked Done in Linear with no code changes.

---

## 2026-06-19 — Modal close button and sheet preview (MAT-430)

### MAT-430 — Visible close button + sheet preview improvements

**Close button.** The `Modal` component had no visible dismiss affordance — users could only close via Escape or backdrop click. The fix went through two iterations in the same session:

1. First pass added a `×` icon button in the top-right of the modal header (standard pattern).
2. After review, replaced with a "Close" text button centered at the bottom of the modal. More discoverable and less ambiguous than a small corner icon, especially given the modal's card-like shape.

The `modal__header` is now purely a title row (no flex space-between). A `modal__footer` div holds the centered Close button, styled with the existing `btn btn--ghost` classes.

**Sheet preview — front + back.** The "See Preview" modal previously showed only the front sheet. Actual print output is duplex — two sheets — so the preview now renders both side by side:

```
  FRONT          BACK
┌────────┐  ┌────────┐
│ ██ ░░  │  │ ██ ░░  │
│ ░░ ░░  │  │ ░░ ░░  │
└────────┘  └────────┘
```

Each is a full `SheetPreview` SVG with a small uppercase label above it. Backs fall back to `card.back ?? deck.sharedBack ?? null`, so shared backs render correctly across all slots.

**Centering.** The preview pair sits in `.sheet-preview-pair` (flex, `justify-content: center`), so the two SVGs are centered in the modal regardless of modal width.

---

## 2026-06-19 — Deck view header redesign (MAT-427, MAT-431)

### MAT-427 — Verification and bug fixes

MAT-427 landed in a prior session with the full implementation in the working tree but unverified. Today's session verified it against Figma and fixed two bugs found in the process.

**Figma verification.** Four Figma nodes were inspected (1-173, 1-122, 1-204, 1-369). Node 1-369 is the authoritative header design — it shows the full dark pill bar with the sheet label on the left and action buttons on the right. Two discrepancies were found: the button label read "Preview" instead of "See Preview", and the section label showed only the preset name with no card count. Both were corrected.

**`deck-card__thumbs` overflow.** On desktop at wide viewports, the Front column's side-actions (Edit + Replace + DL) were wider than the column's available flex space, causing the contents of the `.deck-card` to bleed past the card border. Root cause: `.deck-card__thumb-col` had `flex: 1` but no `min-width: 0`, so flexbox couldn't shrink the column below its content size. Fix: `min-width: 0` on `.deck-card__thumb-col` and `flex-wrap: wrap; justify-content: center` on `.deck-card__side-actions` so buttons wrap gracefully when columns are narrow.

### MAT-431 — Figma section-label component

Figma node 1-168 defines a richer section label than the plain `deck-section__label` span: a dark pill containing a miniature sheet grid icon on the left and the paper name in 16px semibold uppercase on the right.

**`SheetIcon` component.** Rather than using Figma's localhost-served SVG assets (which only work during design sessions), the icon is drawn programmatically as an inline `<svg>`:

```tsx
function SheetIcon({ cols, rows }: { cols: number; rows: number }) {
  // computes cell dimensions from inner bounds, renders paper outline rect
  // + N×M card rectangles with 0.5px radius
}
```

The component derives slot dimensions from `preset.cols` / `preset.rows`, so switching presets (3×3 for letter, 1×2 for 4×6, 2×2 for 5×7-4up) automatically renders the correct grid without any additional variants.

**`DeckPaperLabel` component.** Wraps the icon and a name span. A `PRESET_DIMS` lookup provides human-readable size strings (`8.5×11"`, `210×297mm`, `4×6"`, `5×7"`). In single-deck mode, `DeckPaperLabel` replaces the `deck-section__label` span; multi-deck mode keeps the plain "Sheet N" text.

### Full header bar per Figma node 4-222

Node 4-222 shows the complete header bar at full scale. Key changes from the node 1-168 implementation:

**Label text inline.** The previous component had a separate dimensions column (stacked 8.5 / × / 11 in tiny text). The 4-222 design drops that column entirely and folds the dimensions into the label string: `{preset.label} {dims} ({preset.nUp} cards)` — e.g. "US LETTER 8.5×11" (9 CARDS)". `text-transform: uppercase` on the name span handles capitalisation so the JSX stays lowercase.

**Dark pill header.** `.deck-section__header` gained `background: #0d0818; border-radius: 6px; padding: 8px 12px`. All child text colors updated to white / rgba(255,255,255,x). The "Remove ×" button (multi-deck mode) was updated from `var(--foreground-muted)` to `rgba(255,255,255,0.55)` for legibility on the dark surface.

**Button restyling.** The two header buttons were changed from `btn--ghost` to purpose-specific classes:
- `.deck-section__preview-btn`: lavender background (`#edd9ff`), 1px pink border, dark text — matches Figma's outlined-primary style
- `.deck-section__paper-size-btn`: solid primary pink, white text — standard primary button

**Responsive wrap.** `flex-wrap: wrap` and a two-value gap (`12px 32px`) let the button group drop to a second line on narrow viewports without any media query. At 1280px the bar is single-line; at 540px the buttons wrap below the label, still inside the dark pill.

### Desktop upload zone

On desktop, once a card exists, the home-screen `<ImageUpload>` disappears and there was no way to add more images without knowing to look for the mobile deck-bar. An `<ImageUpload>` is now rendered after `deck-actions--desktop`, wrapped in a `div.deck-upload` that is hidden on `(pointer: coarse)` devices via the existing media query rule. The upload zone only appears when `project.decks.some(d => deckTotal(d) < nUp)` — i.e. at least one deck still has open slots.

## 2026-06-19 — Mobile layout fixes, fade label, paper size modal redesign (MAT-432–434)

### MAT-432 — Deck bar and crop controls on mobile/tablet

Two layout regressions on touch devices, fixed together.

**Deck bar download button.** `.deck-bar__download` had `flex-shrink: 0`, so when the deck was full (no "Add image" button beside it) the download button sat narrow and left-aligned instead of filling the bar. Fix: `flex: 1` + `min-height: 44px` — button now spans the full bar width whether or not the add button is present.

**Crop controls overflow.** The Background control row packed swatch + eyedropper + hex input + fade slider + value into a single `control-row`. On a 375 px phone with 24 px app padding and 16 px controls padding, the available inner width is ~295 px — tight enough for the fade slider to go below its minimum width and overflow. Fix: the fade slider was extracted into its own `control-group` row (see MAT-433 below).

### MAT-433 — Fade slider label

The fade `<input type="range">` had an `id="crop-fade"` but no matching `<label>`. Separating it into its own `control-group` in `CropEditor.tsx` gave it a proper `<label htmlFor="crop-fade">Fade</label>` for free — same change, two problems solved.

### MAT-434 — Paper size modal redesign

**First pass.** The paper size modal showed only a horizontal `paper-size-toggle` row of plain text buttons. Added the current preset as a `DeckPaperLabel` pill above the buttons so users could see what they were switching *from*.

**Second pass (same session).** Replaced the toggle row entirely with a vertical list of `DeckPaperLabel` buttons — one per preset, full-width, dark-pill background, pink border on the active option. The "current" header section became redundant (the active border makes it self-evident) and was removed. Old `.paper-size-toggle` / `.paper-size-btn` CSS deleted.

**Label cleanup.** For the four n-up photo paper presets, `DeckPaperLabel` was rendering the full `preset.label + dims` string — e.g. "4×6 — 2-up 4×6" (2 cards)" — where the sheet size appears twice. A one-line guard (`isNUp = preset.label.toLowerCase().includes('-up')`) makes those presets show only the dims: "4×6" (2 cards)". Letter and A4 labels are unchanged.

---

## 2026-06-19 — Ticket triage and skip link (MAT-395–397, MAT-410, MAT-413)

### MAT-395, MAT-396, MAT-397 — Already done

These three tickets described the geometry engine and PDF builder for photo paper presets. All three were already fully implemented in a prior session as part of the print-preset work — `src/utils/printLayout.ts` (exports `layout()` and `maxBleed()`), `src/utils/printPdf.ts` (exports `buildPrintPdf()`), and the `bleedMm` parameter on `getCroppedDataUrl` in `src/utils/cropImage.ts`. Marked Done in Linear with no code changes.

### MAT-413 — Already done

The ticket asked for two things: disable the eyedropper button in browsers that don't support the API, and catch `AbortError` (user cancelled) silently. Both were already in `CropEditor.tsx` — `hasEyeDropper` (`'EyeDropper' in window`, line 53) gates the button render so it's hidden entirely in Firefox/Safari, and the `catch {}` block at line 191 silently swallows all errors including `AbortError`. Marked Done with no code changes.

### MAT-410 — Skip link for keyboard users

No skip link existed, requiring keyboard users to Tab through the entire `AppHeader` on every step transition before reaching main content (WCAG 2.4.1 — bypass blocks).

**`index.html`:** Added `<a href="#main-content" class="skip-link">Skip to main content</a>` as the first child of `<body>`, before `<div id="root">`.

**`src/App.tsx`:** Added `id="main-content"` to all six `<main>` elements across the app's render branches (five identical `<main className="app-main">` instances replaced in one pass, plus the dynamic home-screen `<main className={...}>` separately).

**`src/index.css`:** Added `.skip-link` / `.skip-link:focus` styles at the top of the file. The link is clipped off-screen (`left: -9999px`, 1×1 px) until focused, then snaps to `position: fixed; top: 1rem; left: 1rem` at `z-index: 9999` — visible as a white pill with dark text, then disappears again once focus moves on.

---

## 2026-06-17 — Photo paper print layouts and multi-deck (MAT-394–401)

The letter/A4 flow was always a batch job: 9 cards, one sheet, send to printer. The next category of user is someone with a photo paper printer — an Epson ET-8550 or similar — who wants to print one or two cards at a time on 4×6 or 5×7 stock. The constraints are completely different: smaller sheet, no 9-up grid, manual rear-feeder duplex, tight registration requirements. Seven tickets.

### MAT-394 — Data model: multi-deck and preset

The biggest structural change. Previously the app held a single `Deck` (cards + copies) with `letter` or `a4` as the only paper distinction. Now the top-level model is a `Project`:

```ts
interface Project {
  preset: PrintPreset
  decks: Deck[]
}
```

`PrintPreset` encodes everything a sheet needs: `sheetMm`, `cols`, `rows`, `orientation`, `bleedMm`, `nUp`. Six presets ship:

| ID | Label | Sheet | Grid | Bleed | N-up |
|----|-------|-------|------|-------|------|
| `letter` | US Letter | 215.9×279.4 mm | 3×3 | 2 mm | 9 |
| `a4` | A4 | 210×297 mm | 3×3 | 2 mm | 9 |
| `4x6-2up` | 4×6 — 2-up | 101.6×152.4 mm | 1×2 | 3 mm | 2 |
| `5x7-2up` | 5×7 — 2-up | 127×177.8 mm | 1×2 | 3 mm | 2 |
| `5x7-3up` | 5×7 — 3-up | 127×177.8 mm | 1×3 | 1.5 mm | 3 |
| `5x7-4up` | 5×7 — 4-up | 127×177.8 mm | 2×2 | 1.5 mm | 4 |

The photo paper presets use single-column layouts (cols=1, rows=N) because a 4×6 sheet is 101.6 mm wide — placing two 85 mm landscape cards side by side would require 176 mm. Verified by the geometry engine.

`useDeck.ts` is replaced by `useProject.ts`. Storage key changes from `photocard-deck` to `photocard-project`; migration is transparent on first load. The `SET_PRESET` action auto-splits cards across new decks when switching to a smaller preset: if a user had 9 cards on letter and switches to 4×6 2-up, they end up with 5 decks of 2/2/2/2/1.

### MAT-395 — Geometry engine

`src/utils/printLayout.ts` exports two functions.

`layout(preset)` computes every number needed to position cards on the sheet in mm coordinates (y-down, origin top-left):

```ts
cardW = orientation === 'landscape' ? 85 : 55
gutter = 2 * bleedMm
contentW = cols * cardW + (cols - 1) * gutter
marginX = (sheetMm.w - contentW) / 2
valid = marginX >= bleedMm && marginY >= bleedMm
```

`valid` is the key safety gate: a layout that produces margins smaller than the bleed would clip the bleed zone against the sheet edge. All six presets pass. The 5×7 4-up is the tightest — 0.75 mm of margin beyond bleed on each side — which is why it gets a "near-perfect registration required" warning in the UI.

`maxBleed(preset)` returns the theoretical maximum safe bleed for a given sheet and grid, for future use if we ever expose a bleed slider.

Unit tests (`tests/printLayout.spec.ts`) run under Node 24's built-in `node:test` + `node:assert/strict` — Playwright's browser automation package is installed but not `@playwright/test`. All 5 assertions pass.

### MAT-396 — Crop re-render at target bleed

Photo paper presets use 1.5 mm or 3 mm bleed vs. the letter default of 2 mm. Rather than maintaining two separate crop pipelines, `getCroppedDataUrl` gained an optional `bleedMm` parameter:

```ts
const outW = bleedMm === 2
  ? CARD_BLEED.widthPx
  : Math.round((55 + 2 * bleedMm) * (300 / 25.4))
```

When `bleedMm === 2`, the existing cached pixel dimensions are used directly. Any other value recomputes. The CropEditor call site is unchanged — photo paper crops re-render automatically at the correct bleed size when their deck's preset is applied.

In practice, existing card images (cropped at 2 mm bleed) can be drawn into photo paper PDF slots via overscan — the image is scaled ~3% larger to fill the bleed box — so no re-render is needed for the export path. The re-render pipeline is there for perfect fidelity if a user re-crops after switching presets.

### MAT-397 — Photo paper PDF builder

`buildPrintPdf(preset, deck)` in `src/utils/printPdf.ts` produces a 2-page PDF:

- **Page 1** — fronts at their bleed-box positions
- **Page 2** — backs, x-mirrored for long-edge duplex: `backSlot.x = sheetMm.w − slot.x − slot.w`

The duplex mirror means that when the sheet is flipped on its long edge (the way every home duplex printer works), the backs land on top of the fronts correctly.

Crop marks are hairline ticks: 0.25 pt stroke, 3 mm length, starting 1 mm away from the trim corner and pointing outward into the gutter. Eight ticks per card (two per corner). They're drawn on both pages.

Image placement uses overscan: existing card PNGs (cropped at 2 mm bleed) are drawn at the bleed-box dimensions `(slot.w + 2*b) × (slot.h + 2*b)` rather than at trim size. This scales the image by at most `~3%` — invisible in print — and means no re-render is needed at export time.

The ET-8550 guidance is a `<details>` collapsible in the UI: rear straight pass, borderless mode, correct media type, extra dry time before laminating.

### MAT-398 — Preset picker polish

Three UX fixes for the photo paper flow:

**Copies hidden.** The `−/+` copy stepper on each `DeckCard` is hidden when `isPhotoPaper` (`hideCopies` prop). When you only have 2 slots, "2 copies of card A" is incoherent — you just add two cards.

**"Sheet is full."** The deck-full message now reads "Sheet is full." for photo paper presets instead of "Deck is full — remove a card or reduce copies to add more."

**Split toast deduped.** The "Cards split across N sheets" toast only fires when a preset switch causes the split — not when the user manually clicks "+ Add sheet". Implemented with a `justSwitchedPreset` ref that is set in the `setPreset` click handler and checked in the `useEffect` that watches `project.decks.length`.

### MAT-399 — Multi-deck UI

The deck view was a flat list of cards targeting a hardcoded `ACTIVE_DECK = 0`. Now `project.decks` is mapped into labeled sections:

- **"SHEET N" header** — visible when more than one deck exists; includes a "Remove ×" button
- **Card grid** — the existing `DeckCard` grid for that deck's cards
- **"+ Add image"** — a dashed-border label per deck section, targeting that deck index
- **"Sheet is full."** — per-deck when `deckTotal(deck) >= nUp`
- **"Move →" controls** — each card gets a move trigger that expands to "Move to: Sheet N" buttons when multiple decks exist (photo paper only)
- **"+ Add sheet" button** — at the bottom, photo paper only
- **"Download sheet N" buttons** — one per populated deck; "Download all sheets" when 2+ decks have cards

The header count switches from "N / nUp cards" (single deck) to "N cards · M sheets" (multi-deck).

All step types now carry `targetDeck` (for new-card flows) or `deckIndex` (for edit flows), threading the correct deck index through every crop confirmation, back-scope dialog, and URL revocation path. `handleGoHome` uses `resetProject()` which clears all decks rather than just deck 0.

### MAT-401 — Live sheet preview

`SheetPreview` is a pure SVG component that renders in the section header of every deck, showing what the printed sheet will look like:

- Sheet background (white) with a subtle grey wash on the waste/margin area
- Content boundary marked with a dashed border
- Bleed zone per slot in a faint pink tint
- Card thumbnails (card front `data:` URLs) clipped inside nested `<svg overflow="hidden">` elements
- Warm beige placeholder for unfilled slots
- Crop mark ticks at all 4 × 2 = 8 corner edges (0.22 pt hairlines, 1.8 mm)

The component takes `preset` and `thumbnails[]` props, calls `layout()` internally, and scales the entire sheet to a 130 px wide SVG via `viewBox`. It updates reactively — switching presets re-renders the layout immediately; adding cards fills in the thumbnails.

---

## 2026-06-18 — Home page cleanup and SheetPreview orientation fixes

Two bugs found and fixed in the same session.

### Empty home page clutter

The idle home state was rendering a full `deck-section` div even before any cards were added. This meant the sheet label, `SheetPreview` widget, and a "+ Add image" dashed button all appeared above the main upload drop zone — three competing entry points where there should be one. The fix is an early `return null` at the top of the `project.decks.map` loop when `deck.cards.length === 0 && project.decks.length === 1`. Once cards exist, or once the user is in multi-deck mode (photo paper with a second sheet added), the section renders normally. The duplicate `deck.cards.length > 0 || project.decks.length > 1` guards on the header and add-button that were added in an intermediate pass were also removed — the early return makes them redundant.

### SheetPreview orientation — two separate bugs

**Letter and A4 grids overflowed.** Both presets had `orientation: 'landscape'` in `preset.ts`. This feeds into `layout()` in `printLayout.ts`, which sets `cardW = 85` for landscape. Three 85 mm cards plus two 4 mm gutters is 263 mm — wider than the 215.9 mm letter sheet. The result was `marginX = −23.55 mm`: every card slot started off the left edge of the SVG viewBox and the grid was completely garbled. The fix is changing both presets to `orientation: 'portrait'` (cardW = 55, contentW = 173 mm — fits with 21 mm margins). This is safe because `createPhotocardPdf` for letter/A4 uses its own `LETTER_CONFIG`/`A4_CONFIG` from `./layout` and never reads `preset.orientation`.

**Photo paper landscape slots showed portrait images incorrectly.** The 4×6-2up, 5×7-2up, and 5×7-3up presets correctly use `orientation: 'landscape'` — cards are physically printed rotated 90° on portrait paper so they fit. But `CropEditor` always crops to portrait (59×89 mm, from `CARD_BLEED`), so `card.front` is always a portrait-aspect image. Rendering it into an 85×55 landscape slot with no transform produces a heavily cropped, squished result. The fix: in `SheetPreview`, when `slot.w > slot.h`, wrap the `<image>` in a `<g>` with the transform `translate(w/2, h/2) rotate(-90) translate(−h/2, −w/2)` and swap the image dimensions to `width={slot.h} height={slot.w}`. This rotates the portrait image −90° around the center of the landscape cell, filling it correctly. The 5×7-4up preset (portrait orientation, 2×2 grid) was already correct and is unchanged.

---

## 2026-06-17 — Mobile color picker fallback + backlog audit (MAT-314)

**MAT-314 — Editable hex input for background color.** On iOS Safari and some Android browsers, `<input type="color">` either fails silently or doesn't open reliably. The hex value next to the swatch was a read-only `<span>` — useless on mobile. Replaced it with a styled text input (`.ctrl-hex-input`) that looks identical to the span at rest but becomes an editable field on tap or click. A separate `hexDraft` state tracks in-progress typing so `bgColor` stays valid at all times — partial values like `#ff` don't corrupt the viewport background or the export. On blur, a valid 6-digit hex applies and pushes to undo history; invalid input reverts to the last good color. The color picker swatch still works normally on desktop.

**Backlog audit.** A pass through the open Linear backlog closed 9 issues that were already implemented in the codebase but never marked done: robots.txt + sitemap (MAT-304), OG image (MAT-302), SEO hero text (MAT-303), mobile upload copy (MAT-315), previously-used back gallery (MAT-313), centered badge (MAT-310), live deploy (MAT-293), dynamic crop viewport (MAT-311), and canvas compositing for small images (MAT-312). MAT-306 (affiliate link) was cancelled — not the right time.

## 2026-06-17 — Quick-win batch: UX polish across editor, deck, and onboarding (MAT-367, MAT-376, MAT-384–387)

Seven quick-win issues shipped in one session.

**MAT-385 — DeckCard proportional thumbnails.** The deck-card thumbnails were a fixed 60×90 px on desktop, leaving the card container looking loose when the grid stretched. Changed `.deck-card__thumb` to `width: 100%; aspect-ratio: 2/3` so thumbnails always fill the column width. The mobile override was the same value and is now the shared default.

**MAT-386 — Fade slider merged into Background row.** The crop editor previously had a separate "Fade" control row below "Background". The fade `<input type="range">` was moved inline after the hex value in the Background row: [swatch] [dropper?] [#hex] [fade slider] [fade%]. One fewer row in a UI that was already tall on small screens.

**MAT-387 — Replace image from inside the crop editor.** Added an `onReplace?: (file: File) => void` prop to `CropEditor`. When provided, a "Replace image" label-button (hidden file input) appears left-aligned in the crop-actions bar, with Cancel and Confirm pushed right via `marginRight: auto`. Wired to the `edit-side` step in App.tsx — handles blob URL revocation before switching to the new file.

**MAT-367 — Deck-of-9 onboarding hint.** In-person testing showed a new user assumed the tool made a single card. A one-line hint was added above the upload zone on the idle (empty deck) screen: "Build a deck of up to 9 photocards — then export as a print-ready PDF."

**MAT-376 — Example back designs in the editor.** New users reaching the "Add the card back" step had no visual inspiration. Three SVG example backs are now seeded as an always-visible gallery section ("Examples"): a dark minimal card with a subtle dot pattern, a pink-to-purple gradient with a white inset border, and a cream card with a double border frame. Clicking one immediately applies it via `handleUseExistingBack`.

**MAT-384 — Crop guides vs header z-index.** Verified resolved by the header z-index bump from MAT-388 (header: 20, guides: 10, guides also clipped by `overflow: hidden` on the viewport). No code change needed.

**MAT-366 — Mobile sticky bar overlap.** Verified resolved by MAT-388's single-row deck bar redesign (~130 px → ~64 px). No code change needed.

## 2026-06-17 — Mobile header and deck bar overhaul (MAT-388, MAT-389)

Two interconnected mobile layout bugs were fixed in the same pass.

### Sticky header replaced with fixed on mobile (MAT-389)

The app header used `position: sticky` everywhere. On iOS Safari, `position: sticky` inside a flex container is unreliable during momentum scrolling — the header can scroll away with the content and not re-attach until the scroll velocity dies. The fix is straightforward: on `@media (pointer: coarse)`, override to `position: fixed; left: 0; right: 0`. Since `fixed` removes the header from document flow, `.app-main` gets a compensating `padding-top: 90px` (66px header height + 24px original padding) on the same breakpoint. Desktop keeps `position: sticky` unchanged. The z-index was also bumped from 10 → 20 across all viewports to ensure the header stacks above the fixed deck bar.

### Deck bar collapsed to single row (MAT-388)

The previous mobile deck bar used two rows: a centered paper-size toggle row on top, then an actions row with a large "Add image" label and a narrower "Download PDF" column. This made the bar roughly 130px tall, wasted vertical screen real estate, and looked disjointed. The new layout is a single `flex-direction: row` bar: `[US Letter | A4] · [+ Add image (flex: 1)] · [Download PDF]`. Bar height drops to ~64px.

The wrapper divs (`deck-bar__toggle-row`, `deck-bar__actions`, `deck-bar__right`) were removed from both the JSX and CSS. The error message, previously inside the right column, is now a flex item with `flex-basis: 100%; order: -1` — it becomes a full-width row above the controls when present, growing the bar upward rather than shifting the layout sideways.

The toast (`position: fixed; z-index: 30`) was also repositioned on mobile to `bottom: calc(80px + env(safe-area-inset-bottom))` so it clears the bar. The `app-main--with-bar` bottom padding and `scroll-padding-bottom` on `html` were updated to match the new bar height (from 110px → 70px).

---

## 2026-06-14 — Edit back scope dialog

When a second (or third, etc.) card reuses the same back from the gallery, clicking "Edit back" would now open a new file picker — because `backSrc` is only stored for cards that went through the full crop flow, not for gallery-reuse cards. More importantly, if you did edit the back and save, the other cards sharing that image would be silently left with the old version, with no way to propagate the change except editing each card individually.

The fix is a Google-Calendar-style scope step. After cropping a back edit, `handleEditConfirm` checks whether any other cards in the deck currently have the same `card.back` data URL. If they do, rather than committing immediately, it transitions to a new `confirm-back-scope` step that shows the cropped result and asks: "Save to how many cards?" — with three options: **Cancel**, **Just this card**, and **Update all N cards**.

"Just this card" applies the new crop only to the edited card (`back`, `backSrc`, `backState` all updated). "Update all N cards" applies the new `back` data URL to every sharing card, but only sets `backSrc`/`backState` on the primary card — the others have those fields cleared, so future edits on them will fall back to the file picker (since the edit session and blob URL belong to the card that was originally edited, not the others).

Blob URL lifecycle is handled correctly in all paths: cancel revokes the new blob if it was a fresh upload but leaves it alone if it was the existing stored blob being re-edited. `handleGoHome` during the scope dialog follows the same rule.

---

## 2026-06-13 — UX audit and fixes (MAT-318, MAT-319)

A systematic audit of pocalab against WCAG 2.2 AA, Core Web Vitals, and general UX fundamentals produced twelve findings. All twelve were fixed in one session.

### Accessibility (MAT-318)

**Focus obscured by sticky header / fixed deck-bar.** `scroll-padding-top: 80px` on `html` ensures focused elements aren't hidden behind the sticky app header. On touch devices, `scroll-padding-bottom: 110px` does the same for the fixed deck-bar.

**Crop viewport not keyboard-accessible.** The crop viewport is now a focusable element (`tabIndex={0}`) with an `aria-label`. Arrow keys pan the image (8 px per key press). A `prefers-reduced-motion`-aware keyboard hint ("Arrow keys to pan · Tab to move to controls") appears while the viewport is focused and is hidden on touch devices. The viewport gets a `focus-visible` outline matching the primary color.

**`aria-pressed` missing on Grid toggle.** The Grid pill button now carries `aria-pressed={showGrid}` so screen readers announce "pressed" / "not pressed" correctly.

**Card count and toast not announced.** The `X / 9 cards` badge gained `aria-live="polite" aria-atomic="true"`. The download toast gained `role="status" aria-live="polite"`.

**Background color input has no label.** Added `htmlFor="crop-bgcolor"` / `id="crop-bgcolor"` to the label/input pair.

**Download button too small.** The deck-card download icon button was 20×20 px, below the WCAG 2.5.8 target-size minimum (24×24 px). Increased to 24×24.

**Remove confirm buttons too small on touch.** The ✓/✕ confirm buttons were 24×24, just at the minimum. On `pointer: coarse` they're now 32×32.

**Low-contrast muted text.** Eight opacity rules were removed and the text colors replaced with explicit `var(--foreground-muted)` usage: `.app-header__tagline`, `.app-header__count`, `.deck-full`, `.upload-back__front-label`, `.upload-back__divider`, `.print-tip__dismiss`, `.upload-zone__hint`, `.deck-card__side-label`. All token values already cleared 4.5:1 — the opacity was the only problem.

### Performance

**Google Fonts blocking render.** The two `<link rel="stylesheet">` tags for Fredoka were replaced with a non-blocking async pattern: `<link rel="preload" as="style">` + an `onload` that sets `rel="stylesheet"` + a `<noscript>` fallback. Font load no longer blocks the first paint.

### Persist original upload and restore crop state (MAT-319)

Before this: clicking "Edit front" or "Edit back" on a deck card opened a file picker, forcing a re-upload of the same image to re-crop it. After: the original `File`-derived blob URL is kept in memory as `card.frontSrc` / `card.backSrc` for the life of the session. `CropState` (zoom, rotation, crop position, background color) is persisted to `localStorage` as `card.frontState` / `card.backState`.

When "Edit" is clicked and a stored `src` exists, `handleReEditSide` opens the crop editor directly — no file picker — with the original full-resolution image and the exact saved crop position, zoom, and rotation restored. The user can fine-tune their crop without starting from scratch.

Blob URLs are revoked when the card is explicitly removed (`removeCard`), when the deck is cleared (`clearDeck`), or when a new edit session replaces the stored URL with a different file. They're stripped from `localStorage` serialization (`frontSrc`/`backSrc` fields omitted) since blob URLs are session-only and invalid after reload. After a reload, Edit falls back to the file picker, but `CropState` still restores the saved crop parameters.

`CropEditor` gained an `initialState?: CropState` prop. All crop state is passed back to `onConfirm` so callers can persist it.

### Logo → go home (MAT-318)

Clicking the pocalab brand logo navigates back to the idle screen. If the deck has cards or a crop is in progress, a context-aware `window.confirm` fires: "Clear your deck and cancel this crop?" / "Clear your deck?" / "Cancel this crop and start over?" depending on what's active. On confirmation, all in-progress blob URLs are revoked and `clearDeck` is called.

### Deck grid fills mobile width

On 320–375 px viewports, the old `flex-wrap` + `clamp(140px, 45vw, 164px)` per card produced only 1 card per row — a 144 px card in a 272 px space — with a large gap to the right. The math: `45vw` at 375 px is `168.75 px`, too wide for 2 columns (168.75 × 2 + 12 = 349.5 px > 327 px available after padding).

Switched `.deck-grid` to `display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr))`. Now at 320 px it's 1 column at 272 px (fills the space); at 375 px it's 2 columns at 157.5 px each. On touch devices, `.deck-card__thumb` uses `aspect-ratio: 2/3; width: 100%; height: auto` so thumbnails scale with the column. Edit and download buttons stack vertically to avoid overflowing the narrower column.

---

## 2026-06-13 — Brand: pocalab

The project has a name. **pocalab** — lowercase, no space, an obvious portmanteau of "poca" (short for photocard in fan communities) and "lab." The subtitle is "a K-pop photocard maker."

The name change touched more files than expected. The `<title>`, all OG/Twitter meta tags, the h1, the OG image SVG, and the seo-lede section in `index.html`. The git remote was updated after the GitHub repo was renamed. The Vercel project was created as `pocalab` directly, giving `pocalab.vercel.app` as the default deployment URL.

The header was redesigned around the name: a card-stack icon sits to the left of the h1, a diagonal dashes mark sits to the right, both scaled to match the cap height of the Fredoka text. A tagline — "a K-pop photocard maker" — sits below in a smaller muted style. The icons are imported as PNGs with transparent backgrounds.

Custom domains `pocalab.app` and `pocalab.com` were purchased on Porkbun. DNS was configured with A records pointing to Vercel's IP (`76.76.21.21`) and CNAME records for `www` to `cname.vercel-dns.com`. In Vercel, `pocalab.app` is the primary production domain; `pocalab.com` and both `www` variants redirect to it with 308s.

---

## 2026-06-13 — Design tokens, theming, and typography

Renamed all CSS custom properties to Shadcn/Radix-style tokens throughout the codebase: `--background`, `--foreground`, `--foreground-muted`, `--surface`, `--border`, `--primary`, `--primary-hover`, `--primary-foreground`, `--primary-muted`, `--destructive`, `--destructive-muted`, `--destructive-border`. The old names were ad hoc; these names travel well across components without context.

Two named palettes:

**Saja Boys (light mode)** — a warm cream and brown base with a hot pink primary. Background `#FFFBF7`, foreground `#1E1208`, surface `#F5E8D8`, border `#F0DCCA`. Primary `#EE4897`.

**Huntrix (dark mode)** — a deep purple-black base. Background `#0C0818`, foreground `#EDD9FF`, surface `#160D30`, border `#281A46`. Primary `#EE4897`.

Both palettes share the same primary color. The `--primary-muted` value is a semi-transparent version used for hover states and subtle backgrounds (0.08 alpha in light, 0.12 in dark).

[Fredoka](https://fonts.google.com/specimen/Fredoka) replaces system-ui for the h1. It's a rounded, friendly display font that reads as playful without being childish — right register for K-pop fan tooling. Loaded at weights 400 and 600 via Google Fonts preconnect. `text-transform: lowercase` is applied to h1 via CSS so the markup can be written naturally but the rendered result is always lowercase, which is part of the brand.

---

## 2026-06-19 — Example image galleries for front and back

The back-upload step previously showed three hard-coded SVG placeholders as "example" backs — abstract pattern tiles with no relationship to real photocard backs. The idle screen (front upload) had no examples at all.

Both are replaced with real WebP images.

**Back examples** — three actual photocard back designs (`album`, `logo`, `signature`) from `public/photocard-back-examples/`. Each thumbnail is labelled with the design type in small muted text. The `EXAMPLE_BACKS` array changed from SVG data URIs to `{ src, label }` objects.

**Front examples** — four front photos (`selfie`, `portrait`, `concert`, `group`) from `public/photocard-front-examples/` added to the idle screen above the upload zone. Thumbnails are 80×120 px (vs the 44×66 px used for backs) to make them more prominent at first glance. The gallery is horizontally centered.

Both galleries are intentionally **non-interactive** — no click handler, no hover highlight, default cursor. They are visual reference only, showing users the kind of image that works well so they can find something similar. The "Previously used" backs gallery in the upload-back step remains fully interactive.

A divider ("or upload your own") separates the front example gallery from the upload zone, matching the pattern already used in the back-upload step. Vertical padding and margin were added around the gallery and upload zone to give the idle screen breathing room.

---

## 2026-06-13 — SEO and discoverability (MAT-296, MAT-302–304)

A static SPA with no server-rendered HTML is invisible to search crawlers unless you put the content somewhere they can find it. Three approaches layered together:

**Meta tags** — full `<title>`, `<meta name="description">`, and Open Graph / Twitter card tags added to `index.html`. Titles and descriptions written for the actual search query ("k-pop photocard maker," "print photocards at home") rather than developer-friendly names.

**OG image** — `public/og-image.svg` is a 1200×630 banner in the Huntrix palette: "pocalab" at large display size, the subtitle in primary pink, three feature pills, and a decorative photocard stack. SVG rather than PNG because it's a fraction of the file size for this kind of flat graphic and Vercel serves it correctly with the right MIME type. Most social platforms accept SVG for OG images.

**Sitemap and robots.txt** — `public/sitemap.xml` lists the single URL at `pocalab.app`. `public/robots.txt` points crawlers to the sitemap and allows all. Both are in `public/` so Vite copies them to the dist root without any plugin configuration.

**Crawler lede** — A `<section class="seo-lede" aria-hidden="true">` placed after `#root` in `index.html`. Crawlers see the h2 and description text directly; screen readers and visual users don't, because the section is visually hidden via the standard `position: absolute; width: 1px; height: 1px; clip: rect(0,0,0,0)` pattern. This is the most reliable way to get indexed content into a React SPA without SSR.

---

## 2026-06-13 — Shared back, localStorage, A4, lazy PDF (MAT-297–300)

Four independent features shipped together.

### Shared back (MAT-297)

The upload-back step now shows a "Use shared back" option when one has been set. Any card's back can be marked "set as shared back for all cards" via a checkbox — that data URL is stored on the deck as `sharedBack: string | null`. Subsequent cards can tap **Use** to adopt it without re-uploading or re-cropping.

This covers the common case: you're printing a themed set where the back design is the same across all 9 cards. Previously you had to upload and crop the same back 9 times. Now you do it once.

The deck model gained `sharedBack`. The `expandDeck` function (which unfolds cards × copies into PDF slots) falls back to `deck.sharedBack` when a card's own `back` is null.

### localStorage persistence (MAT-298)

`useDeck` now persists the deck to `localStorage` on every state change and rehydrates on mount. The hydration uses `{ ...createDeck(), ...JSON.parse(raw) }` — spreading a fresh deck first means future fields added to `Deck` have correct defaults even when an old saved value is loaded.

### A4 support (MAT-299)

A `PageConfig` interface abstracts page dimensions and margins. Two configs: `LETTER_CONFIG` (612×792 pt, 3×3 grid of photocards) and `A4_CONFIG` (595×842 pt, also 3×3 — nine photocards fit on A4 with ~16.5 mm horizontal and ~15 mm vertical margins).

A paper size toggle in the deck actions bar switches between US Letter and A4. The selection is passed to `createPhotocardPdf` at export time. All layout math derives from `PageConfig` — no hardcoded page sizes anywhere outside the two config objects.

### Lazy PDF loading (MAT-300)

pdf-lib is ~200 KB. Previously it was bundled with the main chunk and loaded on every page view, even for users who never export. Changed to dynamic import: `const { createPhotocardPdf } = await import('./utils/pdf')`. Vite picks this up and splits pdf-lib (plus the layout and pdf utility modules) into a separate chunk. The chunk is fetched only when the user clicks "Download PDF."

---

## 2026-06-13 — Ko-fi support button and print tip (MAT-305–306)

Two lightweight monetization touches.

**Ko-fi button** — A "☕ Support" link in the app header, right-aligned via `margin-left: auto`. Styled as a surface-colored pill with a border, consistent with the rest of the UI. Links to `ko-fi.com/mattlau95`. No tracking, no pop-up, no nag.

**Print tip banner** — After a PDF is downloaded, a dismissible banner appears: "Want professional prints? Try Sticker Mule →" with a link to Sticker Mule's business card printing page. This is shown exactly once per download action (`showPrintTip` state, reset by the dismiss button). The banner uses `--primary-muted` as a background so it reads as a tip rather than an error or alert. Sticker Mule prints at business card spec, which is close enough to photocard spec that the output PDF works there with no modifications.

---

## 2026-06-13 — Mobile crop fixes (MAT-310–312)

Three bugs surfaced on mobile that didn't exist on desktop.

### MAT-311 — Crop frame overflowing the viewport

`DISPLAY_CROP` was a hardcoded `{ width: 295, height: 445 }` constant passed directly to react-easy-crop's `cropSize` prop. On mobile, a CSS media query set `.crop-viewport` to `360px` tall — but the crop frame was 445px, so it overflowed the container and was partially hidden. The guides overlay was also sized in fixed pixels, so the guide lines were misaligned with the visible portion of the frame.

Fixed with a `ResizeObserver` on the viewport element. On every container resize, it computes the largest crop frame (at the photocard 59:89 aspect ratio) that fits within the current container dimensions with a 4px inset, and updates a `cropSize` state value. The `Cropper` component, the guides frame, `fillToBleed`, and the auto-fill effect all consume `cropSize` instead of the old constant. The mobile viewport height was also increased to `clamp(320px, 55vw, 440px)` to give the crop frame more room.

### MAT-312 — Small images stretched to fill the output

`getCroppedDataUrl` had:
```ts
outCtx.drawImage(rotCanvas, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, out.width, out.height)
```

This unconditionally stretched whatever region was in `pixelCrop` to fill the entire 696×1051 output. When the source image was smaller than the bleed frame, `pixelCrop` covered the full source image (e.g. 300×450 px), and those pixels were stretched to 696×1051. On desktop this was masked because users typically upload large photos; on mobile, small screenshots and low-resolution images are more common.

The fix clips `pixelCrop` to the rotated canvas bounds, then maps the clipped region to its proportional position in the output:

```ts
const srcX = Math.max(0, pixelCrop.x)
const srcY = Math.max(0, pixelCrop.y)
const srcW = Math.min(rotCanvas.width, pixelCrop.x + pixelCrop.width) - srcX
const srcH = Math.min(rotCanvas.height, pixelCrop.y + pixelCrop.height) - srcY
const scaleX = out.width / pixelCrop.width
const scaleY = out.height / pixelCrop.height
outCtx.drawImage(rotCanvas, srcX, srcY, srcW, srcH,
  (srcX - pixelCrop.x) * scaleX, (srcY - pixelCrop.y) * scaleY,
  srcW * scaleX, srcH * scaleY)
```

A small image now composites at its proportional size onto the background color, matching desktop behavior.

### MAT-310 — Card count badge positioning

The `X / 9 cards` badge in the idle view header was left-aligned after the brand, making it look like a subtitle of the logo rather than a global page stat. Made it `position: absolute; left: 50%; transform: translateX(-50%)` so it's always horizontally centered in the header regardless of brand and Ko-fi button widths.

---

## 2026-06-13 — Back gallery, mobile fixes, sticky action bar (MAT-308, MAT-313–317)

### MAT-313 — Back gallery on upload-back step

The "Step 2 of 2" screen now shows all previously cropped backs from the current deck as a row of thumbnails. Tapping any thumbnail immediately adds the new card with that back and returns to idle — no re-upload, no re-crop. Previously only the single `sharedBack` was surfaced; this extends the concept to every distinct back already in the deck, derived by deduplicating `deck.cards.map(c => c.back)`. The "or upload different" divider separates the gallery from the upload zone when both are present.

### MAT-314 — Mobile color picker (overlay input)

The crop editor's background color swatch previously called `colorInputRef.current?.click()` to open a hidden `<input type="color">` — a pattern iOS Safari blocks with no error or fallback. Fixed by overlaying a fully transparent `<input type="color">` directly on top of the visible swatch div (`position: absolute; inset: 0; opacity: 0`). The user's touch hits the input element directly; no programmatic click needed. `onBlur` on the input also pushes a history snapshot, so color changes are now undoable.

### MAT-315 — Mobile upload UX

`ImageUpload` was a `<div>` with a nested `<label>` button — only the button was tappable. Converted the outer container to a `<label>` wrapping a hidden `<input type="file">`, so tapping anywhere on the zone opens the picker. Two copy variants in the prompt: "Tap to add an image" on touch devices, "Drop an image here, or click to browse" on pointer devices. Switched with `@media (pointer: coarse)`.

### MAT-316 — Fill button broken after rotation

`fillToBleed()` computed the fill zoom using `renderedMedia.width` and `renderedMedia.height` — the zoom=1 display size of the image as reported by react-easy-crop on load, before any rotation is applied. When the image is rotated 90° or 270°, the effective bounding box dimensions swap: a portrait image becomes landscape. The calculation was using the wrong axis, producing a zoom that overshot one dimension and left the other empty. Fixed by swapping `renderedMedia.width` and `renderedMedia.height` when `rotation % 180 !== 0`.

### MAT-317 — Mobile sticky action bar

On mobile with cards in the deck, the paper size toggle and download button required scrolling past the card grid to reach, and the upload zone was further below still. Replaced with a fixed action bar at the bottom of the screen:

- Left side: a large "**+ Add image**" button styled as a primary-colored tap target, stretching the full height of the bar.
- Right side: paper size toggle (US Letter / A4) stacked above the Download PDF button in a column.

The desktop layout is unchanged — `.deck-actions--desktop` stays visible on non-touch devices; `.deck-upload` also stays. On `pointer: coarse`, both are hidden and the deck-bar takes over. The header was made `position: sticky; top: 0` so it remains visible while scrolling the card grid.

### MAT-308 — Canonical URL updates

With `pocalab.app` confirmed live, the placeholder URLs were updated: `sitemap.xml` `<loc>`, `robots.txt` `Sitemap:`, and a new `<meta property="og:url" content="https://pocalab.app/">` in `index.html`. All three previously pointed to `photocard-generator.vercel.app`.

---

## 2026-06-10 — Crop editor: seven UX improvements (MAT-218–224)

Seven features across the crop editor and the add-card flow.

### MAT-222 — Disable scroll-to-zoom

Mouse wheel scroll inside the viewport was zooming the image, which conflicted with normal page scroll and felt jarring. Added `zoomWithScroll={false}` to the `<Cropper>` component. Zoom is now keyboard- and control-only: the − / + step buttons, the size slider, or pinch on mobile.

### MAT-219 — Fix "Background" label overlap

The `.control-label` width was hardcoded at `44px` — wide enough for "Rotate" and "Size" but not "Background". Widened to `80px`, pushing the control row right enough to clear the text without wasting space.

### MAT-220 — Center button

Added a **Center** pill button at the bottom of the controls panel. It calls `setCrop({ x: 0, y: 0 })` and immediately pushes an undo snapshot so the action is reversible. Useful after panning away or after applying a rotation that shifts the image off-center.

### MAT-221 — Undo / redo

Undo and Redo pills sit beside Center in the controls panel. History is stored in refs rather than state (avoids stale-closure issues in event handlers). The snapshot type captures `{ crop, zoom, rotation, bgColor }`.

Snapshots are pushed on discrete actions: rotate buttons, zoom step buttons, center, and eyedropper pick. For sliders, a snapshot is pushed on `onPointerUp` using the DOM element's final value — this way dragging doesn't flood the history stack, but the settled position is always captured. The initial state (zoom=1, rotation=0, center) is the first history entry, so Undo is disabled on load and the user can always return to the starting state.

### MAT-218 — Front preview on the upload-back step

The add-card flow's second screen now shows a thumbnail of the front that was just cropped, with a "Front" label and an **Edit** button underneath. Clicking Edit re-enters the crop editor with the front's data URL as the image source and an `editingPending` flag on the step state. On confirm, the updated data URL is patched back into the pending card and the flow returns to the upload-back screen without creating a new card.

Cancel from crop-front (when editing a pending card) correctly returns to upload-back rather than discarding the session. Cancel from crop-back (before back is confirmed) also returns to upload-back, preserving the pending back image as `pendingBackSrc` so a "Replace?" confirmation can fire if the user picks a different back file later.

### MAT-223 — Rule-of-thirds grid toggle

Added a **Grid** toggle pill in the controls panel. When active, four 1 px semi-transparent white lines appear at the 33% and 66% marks both horizontally and vertically, rendered as absolutely-positioned divs inside the guide overlay (below the bleed/trim/safe borders so the zone colors remain visible). The grid state resets each time a new image is loaded.

### MAT-224 — Responsive label + key layout

On viewports ≥ 900 px the crop editor switches from a flex column to a CSS Grid with two columns: the main column (viewport, controls, actions at 600 px) and a side column that holds the key panel beside the step label. On narrow viewports the key panel remains below the controls as before — no DOM duplication needed, just `grid-template-areas` reassigning positions based on the media query.

The `max-width` of the crop editor was expanded from `600px` to `960px` to accommodate the two-column layout.

---

## 2026-06-10 — Epic 3: Deck Builder (MAT-146)

With the crop tool in place, the next step is assembling a deck — building a card from two crops, viewing the deck, managing copy counts, and wiring up the remove and edit flows.

### MAT-160 — Build a card from front + back crops

The add-card flow is now a two-step sequence managed by a step machine in `App.tsx`:

1. **Upload front** → crop editor labeled "Step 1 of 2 — Crop the front"
2. **Upload back** → crop editor labeled "Step 2 of 2 — Crop the back"
3. Confirm back → card is added to the deck, return to idle

The pending card lives in step state (`{ id: 'upload-back', pendingCard: Card }`) between the two crops, so it never touches the deck until both sides are confirmed. Cancel at any point revokes the object URL and discards the pending card.

The same `CropEditor` component is reused for both sides — it just receives a `label` prop indicating which step it's on.

### MAT-161 — Deck view with thumbnails and copy stepper

`DeckCard` is a new component that represents a single card in the deck. It shows both thumbnails side by side (60×90 px each, bleed aspect ratio) with a "Front / Back" label and an Edit button under each side. Below the thumbnails is a copy stepper: − count + with the current count in the center.

The deck header shows `X / 9 cards` where X is the total copy count across all cards, not the number of unique cards. That's the number that actually matters — it's what determines how many card slots the sheet will use.

### MAT-162 — Edit, remove, and cap enforcement

**Edit**: Clicking Edit on a side opens a hidden `<input type="file">`. Picking a file transitions to an `edit-side` step, runs the crop editor, then calls `updateCard(id, { [side]: dataUrl })` — a new reducer action that patches just the front or back of an existing card without touching anything else.

**Remove**: Each card has a × button at the top-right corner. Calls `removeCard`, which deletes both the card and its copies entry from state.

**Cap fix**: The original `ADD_CARD` guard checked `deck.cards.length >= 9` — that caps unique cards, not total copy slots. Fixed to check `sumCopies(deck.copies) >= 9`. `SET_COPIES` also now enforces the ceiling: it computes the new total and returns the current state unmodified if incrementing would push past 9. The stepper's + button is disabled when `copies >= maxCopies`, where `maxCopies = 9 - total + currentCopiesForThisCard`.

When the deck is full the upload zone is hidden and replaced with a short "Deck is full" message.

---

## 2026-06-10 — Crop editor: background color and sub-100% zoom

Two related additions to the crop editor that open up a new class of source images: PNGs with transparency and images smaller than the card frame.

### Background color

The crop viewport previously had a hardcoded `#111` background. Now it accepts a `bgColor` state (default `#ffffff`) passed as an inline style on the container. The same value is forwarded to `getCroppedDataUrl` and applied as a `fillRect` on the output canvas before the image is drawn — so any transparent pixels in the source, or any canvas area outside the image bounds, export with the chosen background color rather than black or alpha.

The controls panel has a new Background row: a color swatch button that triggers a hidden `<input type="color">`, showing the current color and the hex value as a readout.

If the browser supports the [EyeDropper API](https://developer.mozilla.org/en-US/docs/Web/API/EyeDropper) (Chrome/Edge), a dropper button appears next to the swatch. It lets you sample any pixel on screen — including directly from the crop viewport — and sets that as the background color. Useful when the card image has a border or matte color you want to match. On unsupported browsers the button simply doesn't render.

### Zoom below 100%

`MIN_ZOOM` was 1, meaning the image always had to fill the entire bleed area. Changed to 0.1 — the image can now be placed at 10% size or anywhere in between, leaving the background color visible in the empty areas.

`restrictPosition={false}` was added to the Cropper so that when the image is smaller than the crop frame it can be freely positioned anywhere, rather than being snapped to center. This matters for cases like placing a small logo or sticker at a specific spot on a colored background.

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

### Iteration: rotate and zoom controls

After first pass, two missing interactions were obvious: there was no way to rotate a portrait image that came in landscape, and zoom was scroll-only with no visible feedback.

Added a controls panel below the viewport with two rows:

**Rotate** — ↺ / ↻ buttons snap 90° in either direction for the common case (fixing a sideways scan). A slider between them covers fine rotation from −180° to +180°, with a live degree readout. The snap buttons are the part that gets used 95% of the time; the slider is there for tilted photos.

**Size** — − / + buttons step zoom by 10%. A slider covers the full 1×–4× range with a percentage readout. Scroll in the viewport still works as before for people who expect it.

The canvas export needed updating too. react-easy-crop gives crop coordinates in rotated image space, so the export utility now draws the source image rotated onto an intermediate canvas first, then crops from that. Without this step, a rotated image would export with the wrong region selected.

### Iteration: distinct guide lines and labeled key

The first guide pass used dashed white and amber lines that were easy to miss against a busy image. Replaced with three visually distinct colors:

- **Cyan** — bleed (now rendered as an explicit overlay, not just implied by the crop frame border)
- **Red** — trim / cut line
- **Green** — safe zone

All three are 2 px solid. The old compact legend was replaced with a key panel: each row shows a matching colored swatch, the zone name and dimensions, and a plain-English description of what the zone means. Useful for anyone who hasn't printed photocards before and doesn't know what "bleed" means.

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
