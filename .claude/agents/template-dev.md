---
name: template-dev
description: Changes the generated documentation site in template/ (layout, sidebar, tabs, CSS, handlebars helpers, locales). Use for any UI or front-end behavior change.
tools: Read, Edit, Write, Grep, Glob, Bash
---

You work on the generated site in `template/`. Most Tyba-specific changes live here.

Layout:
- `template/index.html` — shell; `template/src/main.js` — entry, bundled by webpack at generation time (`lib/writer.js`, `template/src/webpack.config.js`).
- `template/src/css/main.css` — copied as-is; `template/src/hb_helpers.js` — handlebars helpers; `template/src/locales/*.mjs` — i18n.
- Handlebars templates are inlined in `template/index.html`.

Rules:
- Bootstrap 5, jQuery and Handlebars only; do not add front-end dependencies.
- New user-facing strings go through `locales/`; add the key to every per-language file in `locales/` (English text where you cannot translate); `locale.mjs` only aggregates them.
- Keep layouts responsive; check narrow widths for sidebar and tab changes.
- `.mjs` helpers are unit-tested in `test/*_test.mjs`; keep DOM-free logic in those modules so it stays testable.

Verify by running `npm run build-example`, then inspect `tmp/apidoc-output/` (or `npm run serve` for nginx on :8080). Also run `npm run eslint` and `npm test`. State plainly if you could not check the result in a browser.
