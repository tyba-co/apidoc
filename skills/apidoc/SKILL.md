---
name: apidoc
description: Write, review and validate apidoc comment blocks (@api, @apiParam, @apiBody, @apiQuery, @apiSuccess, @apiError, @apiDefine/@apiUse) that document HTTP endpoints in source code for @tyba-co/apidoc. Use when adding or changing an endpoint, when asked to document an API, or when apidoc fails or warns.
---

# apidoc comments

apidoc reads `/** ... */` comment blocks (and the comment styles of Python, Ruby, Elixir, Erlang, Lua, Perl, CoffeeScript and Clojure) whose lines start with `@api` tags, and generates a static documentation site. Not for OpenAPI/Swagger files or prose docs.

## Workflow

1. Find the project's apidoc config (`apidoc.json`, `apidoc.config.js`, or an `apidoc` key in `package.json`) and the input directories it documents. Read two or three existing blocks near the code you are changing and copy their style.
2. Write the block directly above the route handler, starting from the template below.
3. Run the validation loop. Fix the first reported problem, re-run, repeat until it exits 0.

## Endpoint template

```js
/**
 * @apiDefine UserNotFoundError
 * @apiError (404 Not Found) UserNotFound No user exists with this id.
 * @apiErrorExample {json} 404:
 *     HTTP/1.1 404 Not Found
 *     { "error": "UserNotFound" }
 */

/**
 * @api {get} /users/:id Get a user
 * @apiVersion 1.0.0
 * @apiName GetUser
 * @apiGroup User
 * @apiDescription Returns the public profile of one user.
 *
 * @apiHeader {String} Authorization Bearer access token.
 * @apiParam {String} id User id.
 * @apiQuery {String="profile","settings"} [include] Extra sections to embed.
 *
 * @apiSuccess {String} id User id.
 * @apiSuccess {String} email User email.
 * @apiSuccess {Object} profile Public profile.
 * @apiSuccess {String} profile.displayName Name shown to other users.
 * @apiSuccessExample {json} 200:
 *     HTTP/1.1 200 OK
 *     { "id": "u_1", "email": "ana@example.com", "profile": { "displayName": "Ana" } }
 *
 * @apiUse UserNotFoundError
 */
```

## Hard rules

1. Every `:param` in the `@api` URL needs an `@apiParam`; every required `@apiParam` must appear in the URL. Request body fields use `@apiBody`, query string fields use `@apiQuery`, headers use `@apiHeader`.
2. `@apiVersion` is strict semver (`1.0.0`, never `1.0` or `1.x`).
3. Every `@apiUse` name needs a matching `@apiDefine` inside the input directories, with a version lower than or equal to the block's version.
4. Never use `@apiStructure`, `@apiErrorStructure`, `@apiSuccessStructure` or `@apiHeaderStructure`: they are not registered in this version and fail validation. Use `@apiDefine` + `@apiUse`.
5. Example tags (`@apiSuccessExample`, `@apiErrorExample`, ...) need a body on the following lines. Nested fields use dot notation (`profile.displayName`), never brackets (`profile[displayName]`).

## House style

- Always set `@apiName` (PascalCase `VerbNoun`, e.g. `GetUser`) and `@apiGroup` (PascalCase singular resource, e.g. `User`). Without them apidoc silently generates a name from the method and URL and uses the file path as group.
- The `@api` title is a short imperative phrase: `Get a user`, `Create a transfer`.
- Every field has a type and a one-sentence description. Optional fields are `[field]`, defaults `[field=value]`, enums `{String="a","b"}`, arrays `{String[]}`.
- Document every error the handler can return with `@apiError (<status>) <ErrorCode> <description>` and one `@apiErrorExample`; shared errors, headers and params live in `@apiDefine` blocks and are pulled in with `@apiUse`.
- Add one `@apiSuccessExample {json}` with realistic data.
- For a breaking change, keep the old block and add a new one with a higher `@apiVersion`; the site compares versions.

## Validation loop

```bash
npx --no-install apidoc -i <input-dir> -o /tmp/apidoc-check -n --warn-error
```

- `-n` parses without writing files; `--warn-error` turns warnings into exit code 1. Only the first warning is printed, so iterate.
- Pass every input directory of the project config (`-i src -i lib`), and `-c <path>/apidoc.json` when the config is not in the input directory; otherwise apidoc reports `No config files found.` and fails.
- Use `npx --no-install` or a package script: plain `npx apidoc` in a project without `@tyba-co/apidoc` installed downloads the unrelated public `apidoc` package.

## Read next

- [references/tags.md](references/tags.md): every tag, its syntax and its gotchas.
- [references/errors.md](references/errors.md): validation messages and how to fix them.
- [references/examples.md](references/examples.md): complete, validated blocks for common endpoint shapes.
