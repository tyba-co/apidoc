# apiDoc (Tyba) for VS Code

Completion, highlighting and snippets for [@tyba-co/apidoc](https://github.com/tyba-co/apidoc) comments.

- **Completion inside doc comments**: type `@` for every tag; after `@api {` the HTTP methods; after `@apiParam {` (and the other field tags) the types; after `@apiSuccess (` / `@apiError (` the status groups; after `@apiUse ` / `@apiPermission ` the `@apiDefine` names of your workspace; after `@apiGroup ` / `@apiVersion ` the values already in use. Accepting a tag replaces what you typed, so there is no double `@`.
- **Highlighting** of `@api...` tags, `(group)` and `{type}` inside comments.
- **Snippets**: one per tag (with `Optional` and status-group variants), and `apidoc` / `apidocdefine` blocks for C-style languages.
- **`apidoc.json`**: validation and completion of keys, `template` options and `forceLanguage` values.

## Install

The extension is not on the Marketplace. Build it from a clone of the repository and install the file:

```bash
cd vscode
npm run package
code --install-extension apidoc-vscode-0.2.1.vsix
```

`npm run package` needs network access the first time (it runs `@vscode/vsce` through `npx`).

## If nothing shows up

The provider triggers on `@`, `{`, `(` and the space after a tag. If the list does not appear, press `Ctrl+Space`.

## Tests

- `npm test` in the repository root: unit tests of the completion logic, and every registered tag must have a snippet the parser accepts.
- `npm install && npm run test:host` here: loads the extension in a real VS Code and asks it for completions. It downloads a VS Code build, or set `VSCODE_EXECUTABLE_PATH` to an installed one. From VS Code's integrated terminal, unset `ELECTRON_RUN_AS_NODE` first. Not run in CI (no display).

## Adding a tag

When a parser is added to `lib/core/index.js`, add its snippet to `snippets/tags.json`; the tag completion uses the same snippets. `npm test` fails until every registered tag has one.

## Not included

- Hover text, live diagnostics and go-to-definition from `@apiUse` to `@apiDefine`.
- Comments that follow code on the same line, and Ruby `=begin` blocks.
- Schema for `apidoc.config.js` and for the `apidoc` key of `package.json`.
