# Printing a pocalab sheet

pocalab's PDF is already the exact size: each card is 55 × 85 mm with 2 mm of bleed, laid out on the sheet you picked. Everything that can go wrong from here happens in the print dialog, because any scaling changes the card size and pulls the backs out of register.

These settings were validated on an **Epson EcoTank ET-8550**, the printer pocalab is built around. The result: exact card size, backs in register, no calibration step.

## The settings that matter

| Setting | Value | Why |
|---|---|---|
| Page Sizing & Handling (Acrobat) | **Actual size** | Fit or Shrink rescales the page, so cards come out under 55 mm |
| Paper Size | The sheet you chose, matched in **both** Acrobat and the Epson driver | A mismatch makes the driver rescale |
| Borderless | **Off** | It upscales the page 2–3 % to bleed off the edges. This caused both the size error and the front/back misalignment during testing |
| Paper Source (cardstock, photo paper) | **Rear Paper Feeder** (the tray) | Not the Rear Paper Feed Slot, which clips 20 mm off the trailing edge, and not any "-Borderless" source |
| Media type | The matching photo or matte profile | Ink coverage and drying |

Print from **Adobe Acrobat Reader** rather than a browser PDF viewer. Browser viewers have their own scaling behaviour and fewer controls.

## Double-sided by hand (cardstock)

1. Print **page 1**, the fronts.
2. Let the ink dry. Photo and matte stock need longer, especially before laminating.
3. Flip the stack on the **long edge**. That is the flip the PDF's back page is mirrored for; its margin says so.
4. Re-feed the stack and print **page 2**, the backs.
5. **Re-select the paper source on the second pass.** The driver resets to Cassette 2 for every job, so this is the easiest step to lose.

Plain Letter paper can use cassette auto-duplex instead, which is fine for test prints.

## Checking a print

- Measure a card across the trim marks: it should be 55 × 85 mm. If it is a few percent small, something rescaled — usually Fit-to-page or borderless.
- Hold a cut card up to the light. The back should sit within about half a millimetre of the front. If every back is off in the same direction, the flip edge was wrong; if they drift across the sheet, the page was scaled.

## Other printers

pocalab's PDF is not printer-specific, so the same rules apply anywhere: actual size, matching paper size, no borderless, long-edge flip. Trays and source names differ. Epic 5 (MAT-148) covers a calibration tool for printers that cannot register the two sides accurately.
