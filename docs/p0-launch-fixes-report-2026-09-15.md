# pocalab P0 fixes — status report

**Date:** 2026-09-15 · **Branch:** `p0-launch-fixes` (12 commits, unmerged, unpushed) · **Source:** `docs/audits/audit-2026-09-15.md`

## Audit to-do list: status

| # | Finding | Status | Commit |
|---|---|---|---|
| 1 | Primary buttons fail AA contrast (3.49:1) | Done | `a627548` |
| 2 | Error text fails AA in light mode (3.65:1) | Done | `693b4f1` |
| 3 | Deck paper label invisible in light mode | Done | `7ef76ef` |
| 4 | Upload zone unreachable by keyboard | Done | `5f1bb25` |
| 5 | `aria-label` on a plain div, prohibited attribute | Done | `8efdca6` |
| 6 | Social preview won't render (SVG, relative URL) | Done | `dc7a687` |
| 7 | README is the untouched Vite template | Done | `b205cd4` |
| 8 | Persistence stops working after 3–4 cards | Done | `c4f068f` |
| R2 | GitHub description/homepage/topics wrong | Done | (GitHub metadata, not a commit) |
| — | Unstyled paper-size toggle (found mid-work, pulled forward) | Done | `8a7fce5` |
| — | Pink-as-text contrast gap left by fix #1 | Done | `f6bb25e` |
| — | Package still named `photocard-generator` | Done | `d2cb331` |
| — | Audit reports cluttering repo root | Done | `66f8ffb` |

**All 8 P0 items from the audit are closed**, plus 4 items found or requested during the work itself.

**Not started** (P1/P2 in the audit, out of scope for this pass): lint errors from `eslint-plugin-react-hooks` (#9), Modal dialog semantics (#10), click-to-home div (#11), touch targets under 24px (#13), mobile crop overflow (#14), inert example cards (#16), silent image-decode failure (#17), missing test script/CI (#18–19), `App.tsx` decomposition (#20), duplicate PDF pipelines (#21), and the P2 polish list (#22–34). `INBOX.md` also remains untracked at the root — never addressed.

## Feedback given, and how it was handled

1. **"Go with your recommendation for #8"** — the proposal had been to split card images into IndexedDB with only ids in localStorage. What actually shipped is simpler: the *whole* project record in one IndexedDB entry via a small `projectStore.ts` wrapper, no change to the `Project` type. Verified: 4 cards (4.5MB) persist across reload, legacy localStorage projects migrate once and get cleared, empty-deck reset writes back correctly.

2. **"Move [audits] into docs/audits/ first, then commit"** — done as its own commit (`66f8ffb`) before the persistence fix, README and fix-plan references updated to match.

3. **Earlier: "Stop and ask before any change that touches the Claude API integration or the data model"** — honored. Persistence changed *storage*, not the `Project`/`Card`/`Deck` shapes, so this proceeded under the #8 go-ahead rather than stopping again; the reasoning was flagged at the time.

4. **Earlier: replace bullet #4 of the original audit ask with "Portfolio readability"** — done in a prior pass: added a dedicated section to `audit-2026-09-15.md` (findings R1–R9), including the "single most impressive thing" analysis (the print-fidelity pipeline) and whether a 90-second reader would find it (no).

## Verification run at each step

- `tsc --noEmit` clean after every commit.
- `vite build` clean after every commit.
- axe-core across crop/upload-back/deck screens, dark+light+iPhone-13 emulation: went from 2–5 violations per screen to **0 violations everywhere**.
- Keyboard tab-order confirmed reaching the upload input (previously skipped straight to `body`).
- Playwright persistence test: 4-card save/reload, legacy migration, and reset-clears-storage all passed in Chrome.
- `eslint`: unchanged at 10 pre-existing errors (none added; 2 incidentally fixed by the persistence rewrite).

## Not yet done

- Branch not merged or pushed. Merge is fast-forward: `git checkout main && git merge --ff-only p0-launch-fixes`.
- `INBOX.md` still untracked — never resolved, no instruction given on it.
- No devlog entry written for this session yet.
