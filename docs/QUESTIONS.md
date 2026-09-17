# Questions and checks for Matthew

Things I couldn't decide or verify on my own. Newest at the bottom. Answer inline or in chat; resolved items move to the bottom section.

## Open

1. **Case study on matthewclau.com is out of date after MAT-724.** It says units derive from `mmToPx` in `dimensions.ts` or `mmToPt` in `pdf.ts`; now both live in `src/utils/units.ts`, and `pdf.ts` / `printPdf.ts` / `layout.ts` became one `src/utils/sheetPdf.ts`. The README is updated. **Matthew is updating this himself later.**

## Resolved

- **Should the Back sheet preview be mirrored?** No: the current order is easier to read. The modal now carries a note saying the PDF flips the back page so each back prints behind its own front. (2026-09-17)
- **iPhone check for MAT-415:** done, a 10+ card deck survives a refresh on iPhone. (2026-09-17)
- **Favicon check for MAT-726:** done, both the browser tab and the iPhone bookmark show the two-cards mark. (2026-09-17)
- **Header card count with several sheets ignored copies.** Now counts copies, so it never under-reports what will print: "7 cards · 2 sheets". (2026-09-17)
- **Keep "Remove this card?" now that removal can be undone?** Keep it, because Undo is on a timer. (2026-09-17)
- **Is 6 seconds long enough for Undo?** Yes. (2026-09-17)
- **Crop output: 696 or 697 px wide?** 697. `mmToPx` now rounds to nearest, which also makes trim 650 × 1004. Auto-fill still recognises 696-wide crops exported before the change. (2026-09-17)
