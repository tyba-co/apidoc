# Configuration and CLI

apidoc reads project settings from a config file and behaviour from command-line flags. This page lists every key and every flag, and the places where the two interact.

## Where the configuration lives

apidoc looks for settings in three places. All three use the same keys.

| Source | Format |
| --- | --- |
| `apidoc.json` | JSON object |
| `apidoc.config.js` | A Node.js module: `module.exports = { ... }` |
| `package.json` | An `apidoc` key. `name`, `version` and `description` from the root of `package.json` fill in whatever the `apidoc` object leaves out. A `package.json` without an `apidoc` key is ignored. |

How the search works:

1. For each source, in the order `package.json`, `apidoc.json`, `apidoc.config.js`, apidoc looks in the current working directory first and then in every input directory (`-i`).
2. Every file found is merged key by key over the previous ones, so on conflicts `apidoc.config.js` beats `apidoc.json`, which beats `package.json`, and a file in an input directory beats one in the working directory.
3. The merge is shallow. A `template` object in a later file replaces the whole `template` object of an earlier one instead of merging with it.
4. Keys that no file sets get the defaults `name: "Acme project"`, `version: "0.0.0"` and `description: "REST Api"`. If no file is found at all, apidoc also warns `No config files found.`, which fails the run under `--warn-error`.

`-c <file>` (`--config`) skips the search: only that file is used (JSON or JavaScript, loaded with `require`), and the defaults above do not apply (the name defaults to empty and the description to `API Documentation`). The path must be a file, not a directory.

`apidoc.config.js` is excluded from parsing automatically, so it is never scanned for `@api` comments.

A complete `apidoc.json`:

```json
{
  "name": "Users API",
  "version": "1.4.0",
  "description": "Public API of the users service",
  "title": "Users API reference",
  "url": "https://api.example.com/v1",
  "sampleUrl": "https://staging.example.com/v1",
  "defaultVersion": "1.0.0",
  "order": ["User accounts", "Orders", "CreateUser", "GetUser"],
  "header": { "title": "Introduction", "filename": "header.md" },
  "footer": { "title": "Best practices", "filename": "footer.md" },
  "template": {
    "aloneDisplay": false,
    "showRequiredLabels": true,
    "withGenerator": true,
    "withCompare": true,
    "forceLanguage": "en"
  }
}
```

The same settings as `apidoc.config.js`:

```text
module.exports = {
  name: 'Users API',
  version: '1.4.0',
  template: { showRequiredLabels: true },
};
```

The same settings inside `package.json`:

```json
{
  "name": "users-service",
  "version": "1.4.0",
  "description": "Users service",
  "apidoc": {
    "title": "Users API reference",
    "template": { "showRequiredLabels": true }
  }
}
```

## Configuration keys

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `name` | string | `Acme project` (empty with `-c`) | Project name, shown as the page heading. |
| `version` | string (semver) | `0.0.0` | Project version, shown top right. It is also the version the site displays on load: blocks with a higher `@apiVersion` stay hidden until you pick a higher version in the dropdown. |
| `description` | string | `REST Api` (`API Documentation` with `-c`) | Text under the heading, also used as the HTML meta description. |
| `title` | string | `apiDoc: <name> - <version>` | Browser tab title. |
| `url` | string | none | Prefix added to every endpoint URL shown in the site, unless the URL already starts with `http`. It only changes the display; it does not affect sample requests. |
| `sampleUrl` | string or `true` | none | Turns on the "Send a Sample Request" form for every endpoint. A string is prefixed to relative endpoint URLs. `true` keeps URLs relative, so the browser sends the request to the origin that serves the documentation. `@apiSampleRequest off` disables it per endpoint. |
| `defaultVersion` | string (semver) | `0.0.0` | Version assigned to blocks without `@apiVersion`, and to definitions without one. |
| `order` | string[] | none | Sidebar order. Groups are matched by displayed title, endpoints by `@apiName` or lower-cased title. Unlisted items follow in default order. See [Ordering](structure.md#ordering). |
| `header` | object | none | Markdown page shown before the endpoints. See below. |
| `footer` | object | none | Markdown page shown after the endpoints. See below. |
| `input` | string[] | `["./src"]` | Source directories. Read only together with `-c`; see below. |
| `output` | string | `doc/` | Output directory. Not honoured by the CLI; use `-o`. See below. |
| `template` | object | see below | Options of the generated site. |

### header and footer

```json
{
  "header": { "title": "Introduction", "filename": "header.md" },
  "footer": { "title": "Best practices", "filename": "footer.md" }
}
```

| Property | Required | Meaning |
| --- | --- | --- |
| `filename` | Yes | Markdown file rendered into the page. Resolved against, in order: the first `input` entry of the config (or the working directory), the working directory, each input directory, and the directory of the `-c` file. If none exists, apidoc fails with `Can not read: <path>`. |
| `title` | No | Sidebar label of the page. The header falls back to the localized word "General". The footer gets no sidebar entry without a title. |

The Markdown is rendered with the same parser as descriptions. A `<h1>` or `<h2>` in it that carries an `id="api-<group>"` or `id="api-<group>-<name>"` attribute becomes its own sidebar entry; plain Markdown headings do not.

### input and output

- `input` is applied only when you pass `-c`/`--config` and no `-i`. Without `-c`, apidoc does not read `input` from `apidoc.json` and falls back to `./src`; pass `-i` explicitly.
- `output` is read only when the output directory is left at the library default. The CLI always supplies its own `-o` (default `doc/`), so the `output` key has no effect when you run `apidoc`. Pass `-o`.

### template options

Set under the `template` key.

| Option | Type | Default | Meaning |
| --- | --- | --- | --- |
| `aloneDisplay` | boolean | `false` | Show one endpoint at a time instead of the whole page; the sidebar selects which one. |
| `showRequiredLabels` | boolean | `false` | Show a "required" label next to non-optional fields. Optional fields always show an "optional" label. |
| `withGenerator` | boolean | `true` | Show the "Generated with @tyba-co/apidoc" line, with version and time. |
| `withCompare` | boolean | `true` | Show the version dropdowns and the compare features. When `false`, the version is shown as plain text. |
| `forceLanguage` | string | browser language | Language of the interface texts (labels, tooltips, buttons). Without it the site follows the first two letters of the browser language and falls back to English. |

Allowed values for `forceLanguage`:

| Language | Values |
| --- | --- |
| Catalan | `ca` |
| Chinese | `cn`, `zh`, `zh_cn` |
| Czech | `cs` |
| Dutch | `nl` |
| English | `en` |
| French | `fr` |
| German | `de` |
| Italian | `it` |
| Polish | `pl` |
| Portuguese | `pt`, `pt_br` |
| Romanian | `ro` |
| Russian | `ru` |
| Spanish | `es` |
| Turkish | `tr` |
| Vietnamese | `vi` |

Any other value stops the site at load with `Invalid value for language setting! Available values are ...`.

## Command-line options

```bash
npx --no-install apidoc [options]
```

| Flag | Default | Meaning |
| --- | --- | --- |
| `-i, --input <dirs...>` | `./src` | Source directories to scan. Repeat the flag or list several directories. |
| `-o, --output <dir>` | `doc/` | Output directory. |
| `-c, --config <file>` | none | Use this config file (JSON or JavaScript) and skip the search. See [Where the configuration lives](#where-the-configuration-lives). |
| `-n, --dry-run` | off | Parse and validate, write nothing. Prints `Dry run mode enabled: no files created.` |
| `--warn-error` | off | Treat warnings as errors: the first warning is printed as an error and the process exits with code 1 at once, so later problems are not reported until you fix it. |
| `--write-json` | off | Also write the parsed data as `assets/api-data.json` in the output directory. |
| `-p, --private` | off | Include endpoints marked with `@apiPrivate`. |
| `-S, --single` | off | Produce one self-contained `index.html` (CSS and JavaScript inlined) in the output directory. |
| `--filter-by <tag=value>` | none | Keep only blocks whose tag has exactly this value, plus all `@apiDefine` blocks. The tag name must be written in lower case, for example `--filter-by apigroup=User`; `apiGroup=User` matches nothing. |
| `-w, --watch` | off | Rebuild when files in the input directories change. |
| `-d, --debug` | off | Print debug messages and the parsed options, and build an unminified bundle with an inline source map. |
| `-v, --verbose` | off | Verbose output, including the parsed files. |
| `-q, --quiet` | off | Silence the log output. The exit code still reports failures. |
| `--log-format <format>` | `simple` | `simple` or `json`. `json` output has no colours. |
| `--no-color` | off | Declared as "turn off log color". The CLI default is already uncoloured, so the flag changes nothing visible. |
| `-e, --exclude-filters <regex...>` | none | Regular expressions of files or directories not to parse. `node_modules` and `apidoc.config.js` are always excluded; these are added to them. |
| `-f, --file-filters <regex...>` | built-in list | Regular expressions of files to parse. Replaces the built-in extension list shown in [Getting started](index.md#what-apidoc-does). |
| `--encoding <encoding>` | `utf8` | Encoding of the source files. |
| `--line-ending <value>` | `LF` | `LF`, `CR` or `CRLF`, for the line breaks of the generated data. Any other value, including the operating system's own line ending that the help text shows as default, is treated as `LF`. |
| `--markdown [file]` | built-in markdown-it | A path to a module that exports a Markdown parser class with a `render(text)` method, to replace the built-in one. Relative paths are resolved from the working directory. There is no working way to disable Markdown: `--markdown false` is read as a module path and crashes. |
| `-t, --template <dir>` | the bundled `template/` | Directory with a custom site template (it must follow the layout of the bundled one: `index.html`, `fonts/`, `img/` and `src/` with `webpack.config.js`, `main.js` and `css/main.css`). |
| `--parse-filters <name=file...>` | none | Register custom filters. |
| `--parse-languages <name=file...>` | none | Register comment styles for more file extensions. |
| `--parse-parsers <name=file...>` | none | Register custom tag parsers. |
| `--parse-workers <name=file...>` | none | Register custom workers. |
| `--definitions` | off | Declared as "include definitions file rather than copying definitions", but nothing reads it. It has no effect. |
| `-V, --version` | | Print the version. |
| `-h, --help` | | Print the help. |

Extra command:

| Command | Meaning |
| --- | --- |
| `apidoc install-skill [--global]` | Copy the agent skill into `./.claude/skills/apidoc` (or `~/.claude/skills/apidoc` with `--global`). See [Editor and AI tooling](tooling.md#agent-skill). |

Exit codes: `0` on success, `1` when parsing or generation fails, or when `--warn-error` meets a warning.

### Common invocations

```bash
# build the site
npx --no-install apidoc -i src -o doc

# several source directories
npx --no-install apidoc -i src -i lib -o doc

# validate only, fail on any warning (CI)
npx --no-install apidoc -i src -o doc -n --warn-error

# include @apiPrivate endpoints and keep the parsed data
npx --no-install apidoc -i src -o doc --private --write-json

# one group only
npx --no-install apidoc -i src -o doc --filter-by apigroup=User

# rebuild while you write comments
npx --no-install apidoc -i src -o doc --watch
```

### Exit-code and warnings reference

Messages that `--warn-error` turns into failures (each is a warning otherwise):

| Message starts with | Cause |
| --- | --- |
| `No config files found.` | No `apidoc.json`, `apidoc.config.js` or `package.json#apidoc` in the working or input directories. |
| `parser plugin '<tag>' not found` | An unknown `@api...` tag. |
| `The use of square brackets for object properties is deprecated.` | A tag text contains `word[...]`. The tag is skipped. |
| `URL contains a parameter ':<name>' that is not documented as @apiParam` | A `:name` URL segment without `@apiParam`. |
| `@apiParam '<name>' was defined but does not appear in URL` | A required `@apiParam` that is not a `:name` in the URL. |

Errors that always fail, with or without the flag: `Version format not valid.`, `Empty parser result.`, `Referenced groupname does not exist / it is not defined with @apiDefine.`, `Referenced definition has no matching or a higher version.` and `Name must contain only alphanumeric and colon characters.`
