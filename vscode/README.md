# apiDoc (Tyba) for VS Code

Autocompletion for [@tyba-co/apidoc](https://github.com/tyba-co/apidoc) comments.

- Snippets for every apidoc tag: type `@api` inside a doc comment and pick `@apiParam`, `@apiBody`, `@apiSuccess`, ... Field types are offered as a choice list.
- Block snippets for C-style languages (JS, TS, PHP, Java, Go, C#, ...): `apidoc` inserts a complete endpoint block, `apidocdefine` an `@apiDefine` block.
- Validation and completion for `apidoc.json` (keys, `template` options, `forceLanguage` values).

## Install

The extension is not on the Marketplace. Build it from a clone of the repository and install the file:

```bash
cd vscode
npm run package
code --install-extension apidoc-vscode-0.1.0.vsix
```

`npm run package` needs network access the first time (it runs `@vscode/vsce` through `npx`).

## Suggestions inside comments

VS Code does not show suggestions inside comments while you type unless `editor.quickSuggestions` allows it. Press `Ctrl+Space` after `@api`, or enable it for your languages:

```json
"[javascript]": { "editor.quickSuggestions": { "comments": "on", "other": "on", "strings": "off" } },
"[typescript]": { "editor.quickSuggestions": { "comments": "on", "other": "on", "strings": "off" } }
```

## Adding a tag

When a parser is added to `lib/core/index.js`, add its snippet to `snippets/tags.json`. `npm test` in the repository root fails until every registered tag has a snippet that the parser accepts.

## Not included

- Completion of `@apiUse` / `@apiPermission` names from the workspace's `@apiDefine` blocks.
- Schema for `apidoc.config.js` and for the `apidoc` key of `package.json`.
