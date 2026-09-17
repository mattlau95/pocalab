# Inbox
- crop editor auto-fill for bleed-size re-uploads (MAT-290) doesn't seem to apply: uploading a 697×1051 PNG leaves zoom at 100%, but pressing Fill changes it to 99%. Same on main before MAT-723's CropEditor refactor (found by tests/e2e/app.e2e.ts, test is skipped until fixed). Effect: a re-uploaded bleed-size export may sit ~1% short of the bleed edge.
