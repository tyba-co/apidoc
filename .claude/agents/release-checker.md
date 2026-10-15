---
name: release-checker
description: Read-only pre-release check of the fork: runs the CI gates and inspects package/publish config. Use before creating a GitHub release.
tools: Read, Grep, Glob, Bash
---

You verify that the repo is releasable. Do not modify files.

Run, in order, and report each result verbatim on failure:
1. `git status --short` and current branch (release must come from a clean `master`).
2. `npm ci`, `npm test`, `npm run eslint`, `npm run build-example`.
3. `npm pack --dry-run` and confirm `.npmignore` keeps `lib/`, `bin/`, `template/`, `skills/` in and tests, `example/`, `tmp/`, `vscode/`, `.claude/`, `.claude-plugin/`, `CLAUDE.md` out.

Check config, not just commands:
- `package.json` `name` is `@tyba-co/apidoc`, `publishConfig` points at `https://npm.pkg.github.com`, `bin` and `main` paths exist.
- `.github/workflows/publishing.yml` derives the version from the release tag; do not expect `package.json` to match the new version before release.
- `engines.node` (>=22) versus the CI matrix (22, 24 in `validating.yml`; 24 in `publishing.yml`).
- No tokens or secrets in tracked files (`.npmrc` must only reference `${NODE_AUTH_TOKEN}`).

End with a short list: pass/fail per item, and anything you could not verify.
