# Editor and AI tooling

Three things make writing apidoc comments faster and safer: a VS Code extension with snippets and an `apidoc.json` schema, an agent skill that teaches coding agents the house rules, and a validation command you can run in CI.

## VS Code extension

The `vscode/` folder of the repository holds an extension called "apiDoc (Tyba)". It is not on the VS Code Marketplace: you build the `.vsix` file yourself and install it.

### What it provides

- **Tag snippets.** Type `@api` inside a doc comment and pick a snippet. There is one for every tag, plus variants that save typing:

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

Tag snippets are active in JavaScript, TypeScript (and their React variants), Vue, PHP, Java, Go, C, C++, C#, Dart, Groovy, Kotlin, Scala, Python, Ruby, Perl, Lua, CoffeeScript, Elixir, Erlang and Clojure. Block snippets are available in the C-style subset: JavaScript, TypeScript, Vue, PHP, Java, Go, C, C++, C#, Dart, Groovy, Kotlin and Scala.

### Build and install

From a clone of the repository:

```bash
cd vscode
npm run package
code --install-extension apidoc-vscode-0.1.0.vsix
```

`npm run package` runs `@vscode/vsce` through `npx`, so the first run needs network access. Instead of the `code` command you can install the file from the Extensions view: open the `...` menu and choose "Install from VSIX...".

### Suggestions inside comments

VS Code does not show suggestions inside comments while you type unless `editor.quickSuggestions` allows it. Press `Ctrl+Space` after `@api`, or enable suggestions in comments for your languages:

```json
{
  "[javascript]": { "editor.quickSuggestions": { "comments": "on", "other": "on", "strings": "off" } },
  "[typescript]": { "editor.quickSuggestions": { "comments": "on", "other": "on", "strings": "off" } }
}
```

### Limits

- Names for `@apiUse` and `@apiPermission` are not completed from the `@apiDefine` blocks of your workspace.
- There is no schema for `apidoc.config.js` or for the `apidoc` key of `package.json`.

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
