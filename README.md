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
