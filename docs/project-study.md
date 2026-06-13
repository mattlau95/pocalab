# MAT-295 — Project Success Study

## What the tool does well

- **Correct photocard spec** — bleed 59×89mm, trim 55×85mm, safe 51×81mm at 300 DPI. Most fan-made tools get this wrong or don't expose it at all.
- **Print-ready PDF output** — 3×3 grid on US Letter with solid trim guides and orientation labels. Users can hand this directly to a home printer or print shop.
- **Crop editor** — zoom, rotate, rule-of-thirds grid, fill-to-bleed, undo history, background color picker. This is more capable than most web-based crop tools.
- **Copy counts per card** — the deck model correctly handles "I want 3 of this card and 1 of that" in a single PDF, which is the actual use case.
- **No account required** — zero friction to start. Correct for this audience.
- **Theme** — Saja Boys / Huntrix palette is visually distinct and culturally resonant.

## Biggest gaps vs. real user needs

### 1. Shared back design (highest impact)
Most kpop photocard sets use one back design for the entire deck — not a unique back per card. Currently every card requires a separate back upload. Adding a "use same back for all cards" option (one upload, applied to every card) would remove the most common source of friction.

**Effort:** Medium (1–2 days). Back image could be stored at deck level, falling back to per-card if overridden.

### 2. No data persistence
All work is lost on page refresh. For a tool that requires multiple upload + crop cycles, this is a real pain point. localStorage persistence of the deck state (image data URLs included) would fix it with no backend.

**Effort:** Medium (1 day). Data URLs are large but manageable for a 9-card deck.

### 3. A4 paper size
The kpop fan community is global — Korea, SEA, and Europe all use A4. A US-Letter-only PDF excludes a large part of the target audience. An A4 layout (2×4 grid, slightly different margin math) would be the second paper option.

**Effort:** Quick win (2–3 hours). The layout.ts abstraction already makes this straightforward.

### 4. Mobile UX
The crop editor viewport is 520px tall — it dominates the screen on a phone and the controls below it require scrolling. The audience skews young and mobile-first. A responsive layout for the crop editor (collapsing the guide key, stacking controls vertically, reducing viewport height) would meaningfully expand the usable audience.

**Effort:** Medium (1 day of CSS work).

### 5. No SEO / discoverability
The app is not yet deployed and has no meta tags. Organic search is the primary acquisition channel for a free tool like this. See MAT-294 for the full audit.

**Effort:** Quick win (1–2 hours of markup + content).

## Tech stack assessment

| Area | Assessment |
|---|---|
| React 19 + TypeScript + Vite 8 | Excellent — modern, fast DX, no issues |
| pdf-lib | Good — no server needed, correct output. Loaded eagerly; should lazy-import on demand |
| react-easy-crop | Solid. Zoom semantics are non-obvious (zoom=1 fills the *container*, not the crop area) but the fill-zoom formula is now correctly implemented |
| No backend | Correct for current scope. Stay serverless until user accounts are needed |
| Testing | Playwright is installed but no tests exist. Low risk now; add smoke tests before first public launch |
| Bundle size | pdf-lib dominates (~200kb gzip). Lazy-loading it on "Download PDF" click would improve initial load |
| Deployment | Not yet deployed. Stack is Vercel-ready; no config needed |

## Prioritized recommendations

| # | Action | Impact | Effort |
|---|---|---|---|
| 1 | Shared back design for deck | High | Medium |
| 2 | SEO meta tags + static hero text | High | Quick win |
| 3 | A4 paper size option | High (international) | Quick win |
| 4 | localStorage deck persistence | High | Medium |
| 5 | Lazy-load pdf-lib | Medium (perf) | Quick win |
| 6 | Mobile crop editor layout | Medium | Medium |
| 7 | Ko-fi + print affiliate link | Medium (revenue) | Quick win |
| 8 | OG image for link previews | Medium (social sharing) | Quick win |

## Suggested next milestone

Before investing in features, deploy the site (MAT-293) and ship the SEO + meta tag fixes (MAT-294). Organic traffic data from the first few weeks will validate which features matter most — shared back vs. A4 vs. mobile may not all be equally important to the actual user mix.
