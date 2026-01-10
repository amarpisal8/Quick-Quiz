# Quick-Quiz

A small client-side quiz app.

Development

- Install dev tools (optional):
  - npm install --save-dev prettier eslint eslint-plugin-prettier eslint-config-prettier

- Format files:
  - npm run format

- Lint:
  - npm run lint

Notes

- The project includes a theme toggle, countdown timer, saved-for-later dashboard, and responsive support for mobile (Samsung / iPhone breakpoints).
- Saved items persist to localStorage. Timers also persist to avoid accidental refresh bypass.

## Mobile testing ✅

- Target widths: Samsung (360px, 412px), iPhone (375px, 390px).
- Use browser devtools device simulator or a real device to verify:
  - Bottom action bar is visible and buttons are at least 48–52px tall.
  - Safe-area notch is respected (controls not clipped) thanks to `viewport-fit=cover`.
  - Tap targets are easy to press and the question tracker scrolls horizontally.
- For real-device testing: serve the app locally (e.g., `npx serve`) or use a tunnel and open the URL on the device.

## Save Test (Persistent) — Added feature

A lightweight persistent "Save Test" feature has been added using IndexedDB (file: `storage.js`). Key points:

- Save Test stores the entire test (questions array) in an immutable record and prevents duplicates using a deterministic content hash.
- Attempts are tracked separately and stored as history entries.
- New API (available via `TestStorage` global):
  - `TestStorage.saveTest(testObj)` — save a test (returns `{ saved, test }`)
  - `TestStorage.getSavedTest(testId)` — returns `{ test, questions, lastAttempt }` or `null`
  - `TestStorage.loadTestById(testId)` — loads a saved test into the running app (deep-cloned)
  - `TestStorage.getAllTests()` — list saved tests

Manual testing checklist is in `TESTING.md`.
