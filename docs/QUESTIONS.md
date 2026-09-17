# Questions and checks for Matthew

Things I couldn't decide or verify on my own while working through Epic 4.5. Newest at the bottom. Answer inline or in chat; I'll move resolved items to the bottom section.

## Open

1. **Should the Back sheet preview be mirrored?** Both PDFs mirror the back page's columns for long-edge duplex, so the card in the top-left of the front prints in the top-right of the back page. The Back preview draws the same order as the front. Mirroring it would match the printed page; keeping it would match how people think of "card 1". (MAT-725, predates it.)
2. **iPhone check for MAT-415:** on pocalab.app, add 10+ cards, refresh, confirm they all come back. The ticket auto-closed on merge with this unticked.
3. **Favicon check for MAT-726:** look at the browser tab icon on pocalab.app, and Share → Add to Home Screen on iPhone. The ticket auto-closed on merge with this unticked.
4. **Header card count with several sheets ignores copies.** With one sheet it reads "3 / 9 cards" counting copies; with two or more it reads "12 cards · 2 sheets" counting cards only. Fix to count copies? (Small; not in any ticket yet.)
5. **Case study on matthewclau.com is out of date after MAT-724.** It lives outside this repo, so I can't edit it. It says units derive from `mmToPx` in `dimensions.ts` or `mmToPt` in `pdf.ts`; now both live in `src/utils/units.ts`, and `pdf.ts` / `printPdf.ts` / `layout.ts` became one `src/utils/sheetPdf.ts`. The README is updated.
6. **Keep "Remove this card?" now that removal can be undone?** MAT-416 added a 6-second Undo toast for removing a card or sheet, but kept the confirmation dialog in front of it, so removing a card is now two clicks plus a safety net. Many apps drop the question once Undo exists. Keep both, or remove the card confirmation (sheets with cards would still ask)?
7. **Is 6 seconds long enough for Undo?** It disappears after 6 s, or as soon as the deck changes again.

## Resolved
