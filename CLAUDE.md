# apidoc (Tyba fork)

Fork of [apidoc](https://apidocjs.com) published as `@tyba-co/apidoc` to GitHub Packages. Parses inline `@api*` comments from source files and generates a static documentation site (webpack-bundled SPA).

## Commands

```bash
npm test                 # node:test, test/**/*_test.*js (mocha-style globals from test/support/node_test_globals.mjs)
npm run test:mocha       # same suite under mocha
npm run eslint           # lib, bin/apidoc, template/src
npm run pre-commit       # eslint + test
npm run build-example    # generates ./tmp/apidoc-output from example/
npm run serve            # build-example + nginx on :8080 (docker)
```

CI (`.github/workflows/validating.yml`) runs test, eslint and build-example. All three must pass.

## Architecture

Pipeline: `bin/apidoc` (commander CLI, nodemon watch) → `lib/index.js` `createDoc` → `lib/reader.js`/`lib/core` (parse) → `lib/writer.js` (output).

- `lib/core/parsers/api_*.js` — one parser per `@api*` tag. Exports `{ parse, path, method, markdownFields? }`. `path` is where the result lands in the block (`local.*` / `local.parameter.fields.*`), `method` is `insert` or `push`.
- `lib/core/workers/api_*.js` — post-process all parsed blocks (`postProcess`): inheritance (`@apiUse`), generated names, titles, structure. Order matters; workers are registered in `lib/core/index.js`.
- `lib/core/filters/` — post-parse field filters (`apiparam`, `apierror`, `apiheader`, `apisuccess`).
- `lib/core/languages/` — comment-style regexes per file extension; `default.js` covers C-style.
- `lib/core/index.js` — registers parsers/filters/workers/languages by name. A new tag or worker is not active until registered here.
- `lib/writer.js` — writes `api_data.js`/`api_project.js`, copies `template/`, runs webpack on `template/src/main.js`.
- `template/` — the generated site (handlebars + jquery + bootstrap 5). Source in `template/src/`, locales in `template/src/locales/*.mjs`.
- `example/` — sample sources and `apidoc.json`; doubles as the CI smoke test via `build-example`.
- `skills/apidoc/` — agent skill shipped in the npm package; `apidoc install-skill` (`lib/install_skill.js`, dispatched in `bin/apidoc` before commander) copies it to `.claude/skills/apidoc`. `.claude-plugin/marketplace.json` exposes the same skill as a Claude Code plugin.
- `vscode/` — VS Code extension (snippets + `apidoc.json` schema), not published to npm; `cd vscode && npm run package` builds the `.vsix`.

## Conventions

- Node >= 22 (CI matrix 22 and 24; dev and publish on 24, see `.nvmrc`).
- CommonJS in `lib/` and `bin/`; ESM (`.mjs`) only in `template/src` helpers and their tests.
- ESLint is `standard` plus: single quotes, semicolons, `comma-dangle: always-multiline`, no extra parens. 2-space indent, LF (`.editorconfig`).
- Existing JSDoc uses `{String}`/`{Object}` casing; match the file you are editing.
- Keep upstream code diffable: avoid reformatting or renaming upstream files, so merging upstream releases stays cheap. Tyba-specific work is mostly in `template/` (layout, sidebar, tabs, responsiveness).
- New behavior ships with a test next to the closest existing one in `test/`. Parser tests: `test/core/parsers/`. Template/ESM tests: `*_test.mjs`.
- Tests must run under both node:test and mocha: use only `describe`, `it`, `before`, `after` (no `beforeEach`/`afterEach`, `.only`, `this.timeout()`; chain `it(...).timeout(ms)` instead).
- Adding or changing a parser means updating `vscode/snippets/tags.json` and `skills/apidoc/references/tags.md`; `test/vscode_snippets_test.js` and `test/skill_sync_test.js` fail until both match `lib/core/index.js`.

## Git and release

- Default branch is `master`; `CONTRIBUTING.md` mentions `dev`, which this fork does not use.
- Publishing: creating a GitHub release triggers `publishing.yml`, which sets the `package.json` version from the tag, commits it to `master`, and runs `npm publish`. Do not bump the version by hand for a release.
- `.npmrc` reads `NODE_AUTH_TOKEN`; never commit a token.
- `doc/` and `tmp/` are gitignored build output.
- `.npmignore` (not a `files` field) controls the tarball: `skills/` ships; `vscode/`, `.claude/`, `.claude-plugin/`, `CLAUDE.md` do not. Check with `npm pack --dry-run`.
