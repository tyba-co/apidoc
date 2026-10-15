# Getting started

apidoc generates a static documentation website for an HTTP API from comments written next to the code that implements it. You add `@api...` tags to doc comments in your source files, run one command, and get a folder with an `index.html` you can host anywhere.

This documentation covers `@tyba-co/apidoc`, Tyba's fork of [apidoc](https://apidocjs.com). It is aimed at developers who write the comments in a backend codebase and have never used apidoc.

## What apidoc does

- It scans the input directories for source files and extracts the comment blocks that contain `@api` tags.
- It turns those blocks into endpoints, groups them, links versions of the same endpoint together and writes a single-page site.
- It never executes your code and does not need your framework. The documentation is exactly what the comments say, so it only stays correct if you update the comments with the code.

The default file filter picks up these extensions: `clj`, `cls`, `coffee`, `cpp`, `cs`, `dart`, `erl`, `ex`, `exs`, `go`, `groovy`, `ino`, `java`, `js`, `jsx`, `kt`, `litcoffee`, `lua`, `mjs`, `p`, `php`, `pl`, `pm`, `py`, `rb`, `scala`, `ts`, `tsx` and `vue` (the underlying pattern is `ino?` and `php?`, so `.in` and `.ph` files match too). Change it with [`--file-filters`](configuration.md#command-line-options).

Comment syntax depends on the file extension. Everything not listed below uses the C-style `/** ... */` block.

| Extension | Comment block |
| --- | --- |
| `.py` | `"""` ... `"""` |
| `.rb` | `=begin` ... `=end`, or `#**` ... `#*` |
| `.pl`, `.pm` | `=pod` ... `=cut`, or `#**` ... `#*` |
| `.coffee`, `.litcoffee` | `###` ... `###` |
| `.lua` | `--[[` ... `]]` |
| `.ex`, `.exs` | `#{` ... `#}` |
| `.erl` | `%{` ... `%}` |
| `.clj` | `;;;;` ... `;;;;` |
| everything else (`.js`, `.ts`, `.java`, `.php`, `.go`, `.cs`, `.kt`, ...) | `/**` ... `*/` |

## What this fork adds

The tag syntax is the upstream apidoc syntax, so existing comments keep working. The fork adds:

- A Bootstrap 5 template: responsive layout with an off-canvas sidebar, filterable navigation, tabbed examples and a "Send a Sample Request" form.
- A generated example JSON for the Request Body section, with hover tooltips on keys and values and a visible marker for keys that cannot nest. See [The body example](structure.md#the-body-example).
- Quoted field segments for keys that contain a dot. See [Field names and nested bodies](structure.md#field-names-and-nested-bodies).
- An agent skill, an `install-skill` command and a VS Code extension. See [Editor and AI tooling](tooling.md).
- Node.js 22 or newer, and distribution through GitHub Packages as `@tyba-co/apidoc` instead of the public npm registry.

## Install

The package is published to GitHub Packages, not to npmjs.org. Your project needs an `.npmrc` that maps the `@tyba-co` scope to that registry, and an access token with the `read:packages` permission in the `NODE_AUTH_TOKEN` environment variable.

```text
@tyba-co:registry=https://npm.pkg.github.com/
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

```bash
export NODE_AUTH_TOKEN=<your GitHub token>
npm i -D @tyba-co/apidoc
```

Requirements: Node.js 22 or newer. Never commit a token; the `.npmrc` above only references the variable.

## Write your first endpoint

Put a comment block above the code that handles the route. Any file inside an input directory works, for example `src/users.js`.

```js
/**
 * @api {get} /users/:id Get a user
 * @apiVersion 1.0.0
 * @apiName GetUser
 * @apiGroup User
 * @apiDescription Returns the public profile of one user.
 *
 * @apiParam {String} id User id.
 *
 * @apiSuccess {String} id User id.
 * @apiSuccess {String} email User email.
 * @apiSuccessExample {json} 200:
 *     HTTP/1.1 200 OK
 *     { "id": "u_1", "email": "ana@example.com" }
 *
 * @apiError (404 Not Found) UserNotFound No user exists with this id.
 */
```

What each line does:

| Tag | Effect |
| --- | --- |
| `@api {get} /users/:id Get a user` | HTTP method, URL and the title shown in the sidebar. The title is required for the endpoint to appear: an endpoint without one is dropped from the generated site. |
| `@apiVersion 1.0.0` | Version of this block, strict semver. |
| `@apiName GetUser` | Identifier of the endpoint inside its group. Used in links such as `#api-User-GetUser`. |
| `@apiGroup User` | Sidebar section the endpoint belongs to. |
| `@apiParam {String} id` | Documents the `:id` path parameter. |
| `@apiSuccess`, `@apiSuccessExample` | Response fields and a sample response. |
| `@apiError (404 Not Found) UserNotFound` | An error response; the text in parentheses becomes the table heading. |

Read [Structuring your documentation](structure.md) for the rules behind each part, and the [Tag reference](tags.md) for every tag.

## Create apidoc.json

apidoc needs a project name and version. Create `apidoc.json` in the directory you will pass to `-i` (or in the directory you run the command from):

```json
{
  "name": "Users API",
  "version": "1.0.0",
  "description": "Public API of the users service"
}
```

Without any config file apidoc warns `No config files found.` and falls back to the name `Acme project`. The same settings can live in `apidoc.config.js` or under an `apidoc` key in `package.json`. All keys are listed in [Configuration and CLI](configuration.md).

## Generate the site

```bash
npx --no-install apidoc -i src -o doc
```

- `-i src` is the input directory (repeat the flag for several directories). The default is `./src`.
- `-o doc` is the output directory. The default is `doc/`.

Use `--no-install` (or call `apidoc` from an npm script, where the local binary is found first). With a bare `npx apidoc`, a project that does not have `@tyba-co/apidoc` installed will download the unrelated public `apidoc` package from npm and run that instead.

A convenient setup is a script in your `package.json`:

```json
{
  "scripts": {
    "docs": "apidoc -i src -o doc"
  }
}
```

To check your comments without writing any files, add `-n` (`--dry-run`). Add `--warn-error` to make warnings fail the run, which is what you want in CI. See [Validating docs in CI](tooling.md#validating-docs-in-ci).

## Open the result

The output directory contains `index.html` and an `assets/` folder. Open `doc/index.html` in a browser, or publish the folder with any static file host. `--single` produces one self-contained `index.html` instead.

When a project grows, add the pieces you need:

- Group titles, shared parameters and shared errors with [`@apiDefine` and `@apiUse`](structure.md#reusing-blocks-with-apidefine-and-apiuse).
- A custom sidebar order, an introduction page and a footer page, with the [`order`, `header` and `footer` keys](configuration.md#configuration-keys).
- A "Send a Sample Request" form, with [`sampleUrl`](configuration.md#configuration-keys) or [`@apiSampleRequest`](tags.md#apisamplerequest).

## Where to go next

- [Structuring your documentation](structure.md): how to organise blocks, groups, versions, parameters, responses and examples, and how nested bodies work.
- [Tag reference](tags.md): every tag with syntax, parameters, constraints and examples.
- [Configuration and CLI](configuration.md): `apidoc.json` keys, `apidoc.config.js` and every command-line flag.
- [Editor and AI tooling](tooling.md): VS Code snippets, the agent skill and validation in CI.
