# UX Audit Fix Plan — pocalab
**Based on:** `audit-2026-06-13.md`  
**Status:** Ready to implement

---

## Overview

12 findings across 3 tiers. Organized below into batches by area of the codebase so each batch can be a single commit. All fixes should be verified in light mode, dark mode, desktop, mobile (pointer:coarse), and tablet (touch + wide viewport).

```
Batch A — Quick, isolated CSS/markup fixes (P0 + P1 quick wins)
Batch B — CropEditor keyboard pan (P1 deep work)
Batch C — Polish (P2)
```

---

## Batch A — Quick wins (all P0 and most P1)

### A1 · Export error silent on mobile
**Severity:** P0 — silent failure  
**File:** `src/App.tsx`

**Root cause:** `exportError` is rendered only inside `.deck-actions--desktop` (line ~347), which has `display:none` on `pointer:coarse`. The mobile `.deck-bar` has no error path.

**Fix:** Add the error paragraph inside `.deck-bar__right`, after the Download PDF button. The bar is `position:fixed;bottom:0`, so the error renders as a second line inside the right column, pushing the bar taller. That's fine — the `app-main--with-bar` padding already accommodates variable bar height.

```tsx
// Inside .deck-bar__right, after the download button:
{exportError && (
  <p className="deck-bar__error">{exportError}</p>
)}
```

**CSS to add** (`src/App.css`, inside `@media (pointer: coarse)`):
```css
.deck-bar__error {
  margin: 0;
  font-size: 12px;
  color: var(--destructive);
  text-align: center;
}
```

**Screen sizes:**
- Mobile: visible in fixed bar below download button. Bar grows to accommodate.
- Desktop: deck-bar is hidden, error shows in `.deck-actions--desktop` as before. No change.
- Tablet touch: same as mobile.

---

### A2 · Color contrast — systematic opacity fix
**Severity:** P0 — WCAG 2.2 AA violation (2 confirmed by axe-core; additional instances follow same pattern)  
**Files:** `src/App.css`, `src/components/ImageUpload.css`, `src/components/DeckCard.css`

**Root cause:** Several elements apply `opacity` on top of `var(--foreground-muted)` to create a visually lighter effect. The base `--foreground-muted` tokens are actually AA-compliant on their respective backgrounds:
- Light mode `#4A3728` on `#FFFBF7` → **9.46:1** ✅
- Dark mode `#BBA8D4` on `#0C0818` → **9.73:1** ✅

Applying `opacity: 0.6–0.65` blends the text toward the background, dropping the effective contrast to ~3.5:1 — well below 4.5:1 AA.

**Fix:** Remove all opacity declarations from text that uses `var(--foreground-muted)`. The base token color is already visually muted (warm brown in light, soft lavender in dark) and reads as secondary without needing opacity. The visual effect is nearly identical with no accessibility cost.

**Confirmed axe failures to fix:**

| File | Selector | Current | Fix |
|------|----------|---------|-----|
| `src/App.css:47–51` | `.app-header__tagline` | `opacity: 0.65` | remove `opacity` line |
| `src/components/ImageUpload.css:38–42` | `.upload-zone__hint` | `opacity: 0.6` | remove `opacity` line |

**Additional instances that follow the same pattern** (not flagged by axe but use the same anti-pattern — fix proactively):

| File | Selector | Opacity | Notes |
|------|----------|---------|-------|
| `src/App.css:57–62` | `.app-header__count` | `opacity: 0.7` | Card count badge |
| `src/App.css:78–82` | `.upload-back__divider` | `opacity: 0.6` | "or upload different" divider text |
| `src/components/DeckCard.css:67–71` | `.deck-card__side-label` | `opacity: 0.7` | "Front" / "Back" labels on card thumbnails |

> **Note on the visual design:** Removing `opacity` makes these elements slightly darker. In light mode they'll read as warm brown (#4A3728); in dark mode as soft lavender (#BBA8D4). The visual hierarchy (primary > secondary) is preserved by font size and weight difference, not opacity. If after removing opacity these feel too heavy, the correct fix is to introduce a dedicated `--foreground-subtle` token with a pre-computed color that passes 4.5:1, rather than reaching for opacity.

**Screen sizes:** Same fix applies to all breakpoints. No media-query variation needed.

---

### A3 · DeckCard action button target sizes
**Severity:** P0 — WCAG 2.2 SC 2.5.8 (Target Size, minimum 24×24 CSS px)  
**File:** `src/components/DeckCard.css`

**Root cause:** Two buttons in `DeckCard` are below the 24×24 px hard minimum:
- `.deck-card__dl` — currently `20×20px` (`DeckCard.css:79–92`)
- `.deck-card__edit` — currently `height ≈ 20px` (`font-size:11px; padding:2px 8px` → `2×2 + 11×1.5 = 20.5px`) (`DeckCard.css:98–110`)

Also worth improving (above hard minimum but below the 44px comfortable touch target):
- `.copies-btn` — `26×26px` — add an explicit mobile boost

**Fix:**

```css
/* Bring to hard minimum everywhere */
.deck-card__dl {
  width: 24px;   /* was 20px */
  height: 24px;  /* was 20px */
}

.deck-card__edit {
  font-size: 11px;
  padding: 4px 8px;  /* was 2px 8px — raises height to ~24.5px */
  border-radius: 4px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--foreground-muted);
  cursor: pointer;
  transition: background 0.1s;
}

/* Boost to comfortable touch targets on coarse-pointer devices */
@media (pointer: coarse) {
  .deck-card__dl {
    width: 32px;
    height: 32px;
  }

  .deck-card__edit {
    padding: 6px 10px;  /* ≈ 32px height */
    font-size: 12px;
  }

  .copies-btn {
    width: 36px;  /* was 26px */
    height: 36px;
  }
}
```

**Screen size rationale:**
- Desktop (pointer:fine): 24px meets the hard minimum. Precision mouse users don't need large targets.
- Mobile / tablet touch (pointer:coarse): 32–36px is a meaningful improvement without breaking the compact DeckCard layout (card width is 140–164px, so there's room for 32px buttons with gaps).
- The DeckCard total width (`clamp(140px, 45vw, 164px)`) means we can't go to 44px without redesigning the card. 32–36px is the right compromise.

---

### A4 · Sticky header: `scroll-padding-top` for Focus Not Obscured
**Severity:** P1 — WCAG 2.2 SC 2.4.12 (Focus Not Obscured, minimum)  
**File:** `src/index.css`

**Root cause:** `.app-header` is `position:sticky; top:0; z-index:10`. When a user keyboard-navigates to an element near the top of the page, the browser's scroll-into-view puts the element at the very top of the scroll area — directly behind the sticky header. WCAG 2.2 requires that the focused element not be entirely obscured by "author-created content."

**Fix:** Set `scroll-padding-top` on the root element to slightly exceed the header height. The header is ~64px tall (padding 16px top + ~32px content + 16px bottom). Use 80px to give a comfortable buffer.

```css
/* src/index.css — add to the :root block or separately */
html {
  scroll-padding-top: 80px;
}
```

**Additional consideration — bottom obscured by deck-bar on mobile:**  
On touch devices with the fixed `.deck-bar` at the bottom (~80–100px depending on content), a focused element near the bottom of the card grid could be partially hidden behind the bar. Add:

```css
@media (pointer: coarse) {
  html {
    scroll-padding-bottom: 110px;
  }
}
```

> `scroll-padding-bottom` isn't as widely discussed as the top version, but it's in the spec and works in all modern browsers. It's the correct fix here rather than hacking `margin-bottom` on individual elements.

**Screen sizes:**
- Desktop: only `scroll-padding-top: 80px` applies (the bottom deck-bar is hidden).
- Mobile/tablet touch: both top (header) and bottom (deck-bar) padding apply.

---

### A5 · Google Fonts: remove render-blocking stylesheet
**Severity:** P1 — production LCP impact  
**File:** `index.html`

**Root cause:** `<link rel="stylesheet" href="https://fonts.googleapis.com/...">` is a synchronous, render-blocking request. The browser must fetch and parse this CSS before any pixel is painted. On a slow connection this delays First Contentful Paint and pushes LCP.

**Current LCP (dev server):** 9.0s (heavily inflated by Vite HMR — but the Fonts request is a real issue in production too).

**Fix:** Convert to the async load pattern. The `<link rel="preload" as="style">` fires the fetch immediately (same timing) but doesn't block rendering. The `onload` callback then activates the stylesheet.

```html
<!-- index.html — replace line 8 -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  rel="preload"
  href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600&display=swap"
  as="style"
  onload="this.onload=null;this.rel='stylesheet'"
/>
<noscript>
  <link
    rel="stylesheet"
    href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600&display=swap"
  />
</noscript>
```

**Visual impact:** During the brief window before Fredoka loads, the h1 "pocalab" renders in `system-ui`. Because `font-display: swap` is already in the URL, text stays visible — you just see a font swap on the h1 for ~100–300ms on first load. This is a good tradeoff for a single-word headline. Repeat visitors get it from cache with no swap.

**Screen sizes:** No variation. Applies equally to all viewport sizes.

---

### A6 · Background color `<label>` association
**Severity:** P1 — WCAG 4.1.2 (Name, Role, Value)  
**File:** `src/components/CropEditor.tsx`

**Root cause:** `CropEditor.tsx:273` — `<label className="control-label">Background</label>` has no `htmlFor`, and the color `<input>` inside `.ctrl-swatch__input` has no `id`. Screen readers will read the visible label text but it isn't programmatically connected to the input, so AT users navigating by form field won't hear "Background" announced when the color picker is focused.

**Fix:**

```tsx
// CropEditor.tsx:273
<label className="control-label" htmlFor="crop-bgcolor">Background</label>

// CropEditor.tsx:277
<input
  id="crop-bgcolor"          // ADD THIS
  type="color"
  value={bgColor}
  onChange={(e) => setBgColor(e.target.value)}
  onBlur={(e) => pushHistory({ crop, zoom, rotation, bgColor: e.target.value })}
  className="ctrl-swatch__input"
  title="Choose background color"
/>
```

No CSS change needed. The overlay positioning is unaffected.

---

### A7 · "Card added" toast not announced to screen readers
**Severity:** P1 — WCAG 4.1.3 (Status Messages)  
**File:** `src/App.tsx`

**Root cause:** The toast at `App.tsx:407` (`<div className="toast">Card added to deck</div>`) has no `aria-live` or `role="status"`, so screen readers receive no announcement when a card is added. This is a WCAG 2.2 AA violation (4.1.3 requires that status messages be announced without requiring focus).

Axe didn't catch this because the toast element is conditionally rendered (only exists in DOM when visible), and the scanner saw it in its absent state.

**Fix:**

```tsx
// App.tsx:407
{cardAdded && (
  <div className="toast" role="status" aria-live="polite">
    Card added to deck
  </div>
)}
```

`role="status"` is equivalent to `aria-live="polite"` but is the semantically correct role for transient success messages. Screen readers will announce "Card added to deck" after the current task completes.

**Note:** The existing `.toast` CSS already handles all visual aspects. This is a one-attribute addition.

---

## Batch B — Crop keyboard pan (P1 deep work)

### B1 · Keyboard position control in crop viewport
**Severity:** P1 — WCAG 2.2 SC 2.5.7 (Dragging Movements)  
**Files:** `src/components/CropEditor.tsx`, `src/components/CropEditor.css`

**Root cause:** The crop viewport is drag-to-pan only. react-easy-crop has no built-in keyboard pan. WCAG 2.2 requires a single-pointer (non-drag) alternative for all drag operations — the Center pill addresses centering but arbitrary free positioning requires dragging.

**Implementation:**

Add `tabIndex={0}` and `onKeyDown` to the `.crop-viewport` div. The `crop` state in react-easy-crop is a `{x, y}` offset in display pixels from the center of the container. Arrow keys nudge by a configurable step.

```tsx
// CropEditor.tsx — update viewport div
const PAN_STEP = 8 // display pixels per keypress; adjust for feel

const [isViewportFocused, setIsViewportFocused] = useState(false)

// In JSX:
<div
  className="crop-viewport"
  style={{ background: bgColor }}
  ref={viewportRef}
  tabIndex={0}
  aria-label="Crop viewport — use arrow keys to pan the image"
  onFocus={() => setIsViewportFocused(true)}
  onBlur={() => setIsViewportFocused(false)}
  onKeyDown={(e) => {
    if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) return
    e.preventDefault()
    setCrop(c => ({
      x: e.key === 'ArrowLeft' ? c.x - PAN_STEP
       : e.key === 'ArrowRight' ? c.x + PAN_STEP
       : c.x,
      y: e.key === 'ArrowUp' ? c.y - PAN_STEP
       : e.key === 'ArrowDown' ? c.y + PAN_STEP
       : c.y,
    }))
  }}
  onKeyUp={(e) => {
    // Push history after the key is released so rapid presses don't flood undo stack
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
      pushHistory({ crop, zoom, rotation, bgColor })
    }
  }}
>
```

**CSS — show a focus indicator on the viewport:**

```css
/* src/components/CropEditor.css */
.crop-viewport:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 3px;
}
```

The viewport already has `border-radius: 8px` and `overflow: hidden`, so the outline appears around the rounded outer edge.

**UX label hint for discoverability:**

Add a small keyboard hint below the viewport on desktop that appears only when the viewport has focus. This prevents the crop-key panel from being cluttered on load.

```tsx
{isViewportFocused && (
  <p className="crop-kb-hint" aria-hidden="true">
    Arrow keys to pan · Tab to move to controls
  </p>
)}
```

```css
.crop-kb-hint {
  font-size: 11px;
  color: var(--foreground-muted);
  text-align: center;
  margin: -8px 0 0;
}

@media (pointer: coarse) {
  .crop-kb-hint { display: none; } /* touch users won't use keyboard pan */
}
```

**Screen size rationale:**
- Desktop: keyboard pan is the primary keyboard path. `PAN_STEP = 8` gives fine control. The hint shows on focus so the feature is discoverable.
- Mobile/tablet: touch drag is the primary interaction. The keyboard handler is still present (external keyboards on iPads can use it) but the visual hint is hidden to avoid clutter.
- The `onKeyUp` history push means hold-down key panning doesn't generate dozens of undo steps — only one snapshot per key press sequence.

**Undo interaction:** Arrow panning pushes to history on key release. This means a single tap of an arrow key = one undo step. Holding an arrow key down will move the image continuously without flooding the history stack (key repeat events fire `onKeyDown` but not `onKeyUp` until release).

---

## Batch C — Polish (P2)

### C1 · `aria-live` on card count badge
**Severity:** P2  
**File:** `src/App.tsx` (both AppHeader and idle view header)

```tsx
// App.tsx:306 (idle view) and AppHeader component if count is ever added there
<span
  className="app-header__count"
  aria-live="polite"
  aria-atomic="true"
>
  {total} / {DECK_MAX_CARDS} cards
</span>
```

`aria-atomic="true"` ensures the whole string is read on change ("5 / 9 cards"), not just the number that changed.

---

### C2 · Remove card animation
**Severity:** P2  
**Files:** `src/components/DeckCard.tsx`, `src/components/DeckCard.css`

Currently `removeCard` immediately filters the card from state and the grid snaps. A brief exit animation confirms the action and prevents the "did that work?" moment.

**Approach:** Local `removing` state drives a CSS transition before dispatching the remove.

```tsx
// DeckCard.tsx
const [removing, setRemoving] = useState(false)

function handleRemove() {
  if (!window.confirm('Remove this card from your deck?')) return
  setRemoving(true)
  // Wait for CSS transition, then call onRemove
  setTimeout(onRemove, 200)
}
```

```tsx
// In JSX — add removing class
<div className={`deck-card${removing ? ' deck-card--removing' : ''}`}>
```

```css
/* DeckCard.css */
.deck-card {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.deck-card--removing {
  opacity: 0;
  transform: scale(0.92);
}

@media (prefers-reduced-motion: reduce) {
  .deck-card { transition: none; }
  /* card disappears instantly — no animation */
}
```

---

### C3 · Remove card confirm specificity
**Severity:** P2  
**File:** `src/components/DeckCard.tsx`

`window.confirm('Remove this card from your deck?')` is generic. With multiple cards visible the user can't always tell which one is targeted by the confirm, especially after the × button loses focus.

**Option A (quick):** Pass a card description into the confirm string. `Card` currently has `front`/`back` data URLs — not useful for a string. One approach is to pass a human-readable index from the parent.

**Option B (better UX):** Replace `window.confirm` with an inline "are you sure?" state on the card. When the × button is clicked, it toggles to show two buttons — "Yes, remove" (destructive) and "Cancel" — directly on the card. This is more discoverable and avoids the browser's native confirm dialog (which doesn't style with the app's design).

```tsx
// DeckCard.tsx
const [confirmingRemove, setConfirmingRemove] = useState(false)

// In JSX — replace the remove button with:
{confirmingRemove ? (
  <div className="deck-card__remove-confirm">
    <button className="deck-card__remove-yes" onClick={handleRemove}>Remove</button>
    <button className="deck-card__remove-no" onClick={() => setConfirmingRemove(false)}>Cancel</button>
  </div>
) : (
  <button
    className="deck-card__remove"
    onClick={() => setConfirmingRemove(true)}
    title="Remove card"
    aria-label="Remove card"
  >×</button>
)}
```

```css
.deck-card__remove-confirm {
  position: absolute;
  top: 4px;
  right: 4px;
  display: flex;
  gap: 4px;
}

.deck-card__remove-yes {
  font-size: 10px;
  padding: 3px 6px;
  border-radius: 4px;
  background: var(--destructive);
  color: #fff;
  border: none;
  cursor: pointer;
}

.deck-card__remove-no {
  font-size: 10px;
  padding: 3px 6px;
  border-radius: 4px;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--foreground-muted);
  cursor: pointer;
}

@media (pointer: coarse) {
  .deck-card__remove-yes,
  .deck-card__remove-no {
    padding: 5px 8px;  /* larger touch target */
    font-size: 11px;
  }
}
```

This removes the need for `window.confirm` entirely in this flow and keeps the confirmation in-context on the specific card.

---

## Additional finding (not in audit report)

### D1 · ctrl-pill buttons could use `aria-pressed` for toggleable state
**File:** `src/components/CropEditor.tsx`

The **Grid** pill is a toggle (`ctrl-pill--on` class applied when active), but it has no `aria-pressed` attribute. Screen reader users navigating by button won't know if the grid is currently on or off.

```tsx
// CropEditor.tsx:302-308
<button
  className={`ctrl-pill${showGrid ? ' ctrl-pill--on' : ''}`}
  onClick={() => setShowGrid(g => !g)}
  title="Toggle rule-of-thirds grid"
  aria-pressed={showGrid}
>
  Grid
</button>
```

This is a one-attribute change and a quick win.

---

## Implementation order

| Priority | Batch | Items | Estimated time |
|----------|-------|-------|---------------|
| First | A | A1–A7 | ~1.5h — all isolated, no architectural risk |
| Second | B | B1 | ~45min — react-easy-crop keyboard integration |
| Third | C | C1, C3-B (inline confirm), D1 | ~45min |
| Last | C | C2 (remove animation) | ~20min |

**Total estimated:** ~3.5 hours of implementation.

---

## Verification checklist

After each batch:

- [ ] Check light mode AND dark mode (toggle OS preference)
- [ ] Check desktop (pointer:fine) AND mobile simulation (DevTools → pointer:coarse)
- [ ] Keyboard-navigate the full flow with Tab only — confirm no element is hidden behind sticky header/bar, every button is reachable, focus rings visible
- [ ] Run `npx @axe-core/cli http://localhost:5173` — target 0 violations
- [ ] Check that `prefers-reduced-motion` removes the card exit animation
- [ ] After fonts change: verify "pocalab" h1 font still renders as Fredoka after async load (check Network tab — should be loaded, just non-blocking)
- [ ] Screen reader smoke test (VoiceOver / NVDA): add a card, hear "Card added to deck" announced; navigate to count badge, hear count announced when it changes

---

## Specifically for tablet (mid-range viewport, touch input)

The current codebase uses `@media (pointer: coarse)` rather than width breakpoints to detect touch intent. This is correct — a 1024px iPad in portrait with finger input registers `pointer:coarse`. But a few edge cases to check:

1. **Deck-bar on iPad in landscape** (~1180px wide): the bar spans full width, which makes the Add button very wide. Consider adding `max-width: 180px` to `.deck-bar__add` at wider viewports to prevent it looking stretched. Pair with `flex: 0 0 auto` or `min-width: 120px` to keep it prominent.

2. **Crop editor on iPad** (900px+ triggers the two-column CSS Grid layout): the crop editor grid has `grid-template-columns: 600px 1fr`. On a 820px iPad viewport, this overflows. The `@media (min-width: 900px)` threshold means the two-column layout only kicks in on wider iPads in landscape — which is correct, but worth verifying that portrait iPads (820px) still get the single-column layout.

3. **DeckCard width on tablet**: `width: clamp(140px, 45vw, 164px)` — at a 768px viewport, `45vw = 346px`, so the card clamps at `164px`. At 1024px, `45vw = 461px`, so also `164px`. Cards always stay compact, which is intentional. Fine.

4. **Focus Not Obscured at the bottom (tablet + keyboard)**: If an external keyboard is connected to an iPad, Tab navigation applies and the fixed `.deck-bar` at the bottom can obscure bottom-positioned elements. The `scroll-padding-bottom: 110px` from fix A4 covers this.
