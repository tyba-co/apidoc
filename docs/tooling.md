# Editor and AI tooling

Three things make writing apidoc comments faster and safer: a VS Code extension with snippets and an `apidoc.json` schema, an agent skill that teaches coding agents the house rules, and a validation command you can run in CI.

## VS Code extension

The `vscode/` folder of the repository holds an extension called "apiDoc (Tyba)". It is not on the VS Code Marketplace: you build the `.vsix` file yourself and install it.

### What it provides

- **Context-aware completion.** Active only inside doc comments (`/** ... */`, Python docstrings and whole-line `//` or `#` comments). It asks for suggestions when you type `@`, `{`, `(` or a space after a tag, and it replaces what you already typed, so accepting `@apiParam` after typing `@apiP` does not leave a second `@`.

  | Where the cursor is | What is suggested |
  | --- | --- |
  | `@` at the start of a comment line | Every tag, as a snippet with tab stops |
  | `@api {` | HTTP methods |
  | `@apiParam {`, `@apiQuery {`, `@apiBody {`, `@apiHeader {`, `@apiSuccess {`, `@apiError {` (also after a `(group)`) | Field types |
  | `@apiSuccess (`, `@apiError (` | Common status groups, such as `201 Created` or `404 Not Found` |
  | `@apiSuccessExample {` and the other example tags | Highlight languages |
  | `@apiUse `, `@apiPermission ` | The `@apiDefine` names found in the workspace, with their title |
  | `@apiGroup `, `@apiVersion ` | The groups and versions already used in the workspace |

  The workspace is scanned once, on the first completion: source files outside `node_modules`, `.git`, `dist`, `build`, `out`, `doc` and `docs`, up to 3000 files. The index follows file changes, and the unsaved text of the open file is included.

- **Syntax highlighting.** Inside comments, `@api...` tags, `(group)` and `{type}` get their own colors in every supported language. Ordinary JSDoc such as `@param {string} name` is left alone.

- **Tag snippets.** The same snippets are also available as classic snippets. There is one for every tag, plus variants that save typing:

  | Snippet prefix | Inserts |
  | --- | --- |
  | `@api` | `@api {get\|post\|put\|patch\|delete} /path/:id Title`, with the method as a choice list |
  | `@apiParam`, `@apiQuery`, `@apiBody`, `@apiHeader`, `@apiSuccess` | A field with a type choice list (`String`, `Number`, `Boolean`, `Object`, `String[]`, `Number[]`, `Object[]`, `Date`, `File`) |
  | `@apiParamOptional`, `@apiQueryOptional`, `@apiBodyOptional`, `@apiHeaderOptional`, `@apiSuccessOptional` | The same field, in `[optional]` form |
  | `@apiSuccessGroup`, `@apiErrorGroup` | A response field or error with a status group such as `(201 Created)` or `(404 Not Found)` |
  | `@apiSampleRequestOff` | `@apiSampleRequest off` |
  | `@apiExample`, `@apiParamExample`, `@apiHeaderExample`, `@apiSuccessExample`, `@apiErrorExample` | An example with a type choice, a title and a body |

- **Block snippets** for C-style languages: `apidoc` inserts a complete endpoint block, `apidocdefine` an `@apiDefine` block.
- **`apidoc.json` support.** Files named `apidoc.json` are validated against a JSON schema that lists the keys (`name`, `version`, `description`, `title`, `url`, `sampleUrl`, `defaultVersion`, `order`, `header`, `footer`, `input`, `output`, `template`), the `template` options and the allowed values of `forceLanguage`, and offers completion for them. See [Configuration keys](configuration.md#configuration-keys).

Completion and highlighting work in JavaScript, TypeScript (and their React variants), Vue, PHP, Java, Go, C, C++, C#, Dart, Groovy, Kotlin, Scala, Python, Ruby, Perl, Lua, CoffeeScript, Elixir, Erlang and Clojure. Block snippets are available in the C-style subset: JavaScript, TypeScript, Vue, PHP, Java, Go, C, C++, C#, Dart, Groovy, Kotlin and Scala. Classic snippets are contributed only to the languages VS Code ships; Vue, Kotlin, Scala, Elixir and Erlang get the same tags from the completion provider, and Vue, Kotlin and Scala get the blocks (type `apidoc`) from it too.

### Build and install

From a clone of the repository:

```bash
cd vscode
npm run package
code --install-extension apidoc-vscode-0.2.1.vsix
```

`npm run package` runs `@vscode/vsce` through `npx`, so the first run needs network access. Instead of the `code` command you can install the file from the Extensions view: open the `...` menu and choose "Install from VSIX...".

### If nothing shows up

The completion provider declares `@`, `{`, `(` and the space as trigger characters, so VS Code should ask for suggestions as you type them, also inside comments. If the list does not appear, press `Ctrl+Space`; that always works.

### Limits

- A comment that follows code on the same line (`const a = 1; // @apiP`) is not treated as an apidoc comment; apidoc blocks occupy whole lines.
- Ruby `=begin` / `=end` blocks are not detected as comments; use `#` lines or a docstring-style block.
- There is no hover text, no live diagnostics and no go-to-definition from `@apiUse` to its `@apiDefine` yet.
- There is no schema for `apidoc.config.js` or for the `apidoc` key of `package.json`.

### Tests

`npm test` in the repository root runs unit tests of the completion logic and checks that every registered tag has a snippet the parser accepts. `cd vscode && npm install && npm run test:host` loads the extension in a real VS Code and asks it for completions. It downloads a VS Code build the first time; set `VSCODE_EXECUTABLE_PATH` to reuse an installed one. If you start it from VS Code's integrated terminal, clear `ELECTRON_RUN_AS_NODE` first. The host tests are not part of the CI, which has no display.

## Agent skill

`@tyba-co/apidoc` ships an agent skill, a folder with a `SKILL.md` and three reference files, that teaches coding agents to write and validate apidoc comments for this fork. It covers the workflow, an endpoint template, the hard rules (URL parameters, semver, `@apiUse` needs a matching `@apiDefine`, the tags that do not exist), the house style (always set `@apiName` and `@apiGroup`, document every error) and the validation loop. The references list every tag, every validation message and a set of validated examples. The agent loads the skill when you add or change an endpoint, ask it to document an API, or when apidoc fails or warns.

Install the package first (see [Install](index.md#install)), then choose one of the routes below.

### Copy it into a project

```bash
npx --no-install apidoc install-skill            # ./.claude/skills/apidoc
npx --no-install apidoc install-skill --global   # ~/.claude/skills/apidoc, for all your projects
```

- The command copies the skill shipped in the installed package to `.claude/skills/apidoc` (relative to the current directory, or to your home directory with `--global`) and prints `apidoc skill installed in <directory>`.
- It empties the destination folder first, so local edits to a copied skill are lost. Commit `.claude/skills/apidoc/` so the whole team gets the skill, and run the command again after upgrading the package.
- Any other argument is rejected: `[error] Unknown argument: <arg>. Usage: apidoc install-skill [--global]`.

### Install it as a Claude Code plugin

The repository is also a Claude Code plugin marketplace named `tyba-apidoc` with one plugin, `apidoc`. This route needs no npm package.

```bash
claude plugin marketplace add tyba-co/apidoc
claude plugin install apidoc@tyba-apidoc
```

Inside a Claude Code session the equivalent slash commands are:

```text
/plugin marketplace add tyba-co/apidoc
/plugin install apidoc@tyba-apidoc
```

The plugin follows the `master` branch, so it can describe tags that are newer than the package version a project uses. Refresh it with `/plugin marketplace update tyba-apidoc`.

### Other agents

Point the agent at the installed copy, for example in `AGENTS.md`:

```text
Before writing or changing apidoc comments, read node_modules/@tyba-co/apidoc/skills/apidoc/SKILL.md and follow it.
```

## Validating docs in CI

A dry run parses every comment and reports problems without writing the site. With `--warn-error` it also fails on warnings, which is how you keep documentation from rotting:

```bash
npx --no-install apidoc -i src -o doc -n --warn-error
```

- `-n` (`--dry-run`) writes nothing, so the `-o` directory is not created.
- `--warn-error` logs the first warning as an error and exits with code 1 immediately. The command therefore prints only the first problem: fix it and run again until the exit code is 0.
- Parse errors (invalid `@apiVersion`, a missing `@apiDefine`, an empty tag) fail the run even without `--warn-error`.
- Pass every input directory (`-i src -i lib`) the real build uses, and `-c path/to/apidoc.json` when the config is not in an input directory or the working directory. Otherwise you get `No config files found.` or `Referenced groupname does not exist ...`, because a definition outside the scanned directories cannot be found.
- Always use `npx --no-install` or an npm script. A bare `npx apidoc` in a project without `@tyba-co/apidoc` installed downloads the unrelated public `apidoc` package.

A package script keeps the command in one place:

```json
{
  "scripts": {
    "docs": "apidoc -i src -o doc",
    "docs:check": "apidoc -i src -o doc -n --warn-error"
  }
}
```

A GitHub Actions job. The `.npmrc` shown in [Install](index.md#install) must be in the repository, and the secret must hold a token with `read:packages`:

```yaml
name: docs
on: [pull_request]
jobs:
  docs-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - run: npm ci
        env:
          NODE_AUTH_TOKEN: ${{ secrets.PACKAGES_READ_TOKEN }}
      - run: npm run docs:check
```

### What the check does not catch

The validation reports syntax errors, unresolved `@apiUse` names, bad versions and the `@apiParam` and URL mismatches. It does not report:

- a missing `@apiName` or `@apiGroup` (apidoc generates a name and uses the file path as group);
- an endpoint without a title, which is dropped from the site;
- an `@apiBody` without a type, which breaks the page in the browser;
- a `@apiVersion` higher than the project `version`, which stays hidden until selected;
- a nested field whose parent is not declared as `Object` (shown in red in the body example only).

Review these in a generated site, or enforce them in code review. The agent skill lists them as house rules so that generated comments avoid them.
