# apidoc tags

Source of truth: `lib/core/parsers/*.js`, registered in `lib/core/index.js`. Tag names are case-insensitive; write them in camelCase. An element runs from its tag to the next line that starts with `@api`, so descriptions and examples may span several lines.

| Tag | Syntax | Notes |
|---|---|---|
| `@api` | `@api {method} path [title]` | One per endpoint block. Write `{method}` always: apidoc accepts the tag without it, but the endpoint then has no HTTP method. |
| `@apiName` | `@apiName name` | Unique per group and version. Whitespace becomes `_`. If missing, a name is generated from method and URL. |
| `@apiGroup` | `@apiGroup name` | Whitespace becomes `_`. If missing, the file path is used. Pair with `@apiDefine <group> <title>` to give the group a title and description. |
| `@apiVersion` | `@apiVersion major.minor.patch` | Strict semver. Also versions an `@apiDefine` block. Falls back to `defaultVersion` from the config (default `0.0.0`). |
| `@apiDescription` | `@apiDescription text` | Markdown, may span lines. |
| `@apiPermission` | `@apiPermission name` | Repeatable. Shows the title and description of `@apiDefine name` when one exists. |
| `@apiUse` | `@apiUse name` | Repeatable. Inlines the `@apiDefine name` block whose version is the highest one lower than or equal to this block's version. Fails if no define matches. |
| `@apiDefine` | `@apiDefine name [title]` + description lines | Reusable block. Name: letters, digits, `_` and `:` only. May contain `@apiVersion`, field tags and example tags. |
| `@apiParam` | `@apiParam [(group)] [{type}] field [description]` | URL path parameters. Default group `Parameter`. |
| `@apiQuery` | same as `@apiParam` | Query string parameters. Default group `Query`. |
| `@apiBody` | same as `@apiParam` | Request body fields. Default group `Body`. A `{Boolean}` default sets the checkbox in the sample request form. A file is `{File="csv"}`. |
| `@apiFileColumn` | `@apiFileColumn [(file)] {type} column[=example] description` | One column of a tabular file declared with `@apiBody {File="csv"}`. `(file)` is the name of the File field; quote names with spaces (`"Hire date"`). The site renders the expected columns and an example file. |
| `@apiHeader` | same as `@apiParam` | Request headers. Default group `Header`. |
| `@apiSuccess` | same as `@apiParam` | Response fields. Default group `Success 200`; use `(201 Created)` etc. for others. |
| `@apiError` | same as `@apiParam` | Error identifiers, usually without type: `@apiError (404 Not Found) UserNotFound description`. Default group `Error 4xx`. |
| `@apiExample` | `@apiExample [{type}] title` + body lines | Usage example. `type` defaults to `json`. Body is required. |
| `@apiParamExample` | same as `@apiExample` | Request example. |
| `@apiHeaderExample` | same as `@apiExample` | Header example. |
| `@apiSuccessExample` | same as `@apiExample` | Response example. |
| `@apiErrorExample` | same as `@apiExample` | Error response example. |
| `@apiSampleRequest` | `@apiSampleRequest url` or `@apiSampleRequest off` | Enables the "send a sample request" form. A relative URL is prefixed with `sampleUrl` from the config; `off` disables it for this block. |
| `@apiDeprecated` | `@apiDeprecated [text]` | Marks the endpoint deprecated; the text is markdown, e.g. `use (#User:GetUser) instead`. |
| `@apiPrivate` | `@apiPrivate` | Excludes the block unless apidoc runs with `--private`. |

`@apiIgnore [text]` is handled by the parser itself: a block containing it is skipped entirely. Use it for work in progress.

## Field grammar

`@apiParam [(group)] [{type[{size}][=allowed]}] [field[=default]] description` applies to `@apiParam`, `@apiQuery`, `@apiBody`, `@apiHeader`, `@apiSuccess` and `@apiError`.

| Example | Meaning |
|---|---|
| `@apiParam {Number} id User id.` | required field with type |
| `@apiQuery {Number} [limit=20] Page size.` | optional field with default |
| `@apiBody {String{1..64}} name Display name.` | size constraint |
| `@apiBody {String="ACTIVE","BLOCKED"} status Account status.` | allowed values |
| `@apiSuccess {Object[]} items Page of results.` | array of objects |
| `@apiSuccess {String} items.id Item id.` | nested field, dot notation |
| `@apiBody {String} meta."trace.id" Trace id.` | quoted segment: a literal key that contains a dot |
| `@apiError (409 Conflict) EmailTaken The email is already registered.` | error with custom group |

Type characters: letters, digits and `()#:./\[]_|-`, so `String|Number` and `Object[]` are valid. A type containing `Object` makes the field a parent for dotted children.

A dot nests only under a parent declared as `Object` or `Object[]`. If the parent is missing or has another type, the generated body example shows the key in red as "cannot nest"; fix the declaration, or quote the segment (`"a.b"`) when the key really contains a dot.

## Example grammar

```text
@apiSuccessExample {json} Success-Response:
    HTTP/1.1 200 OK
    { "id": "u_1" }
```

The first line holds the optional `{type}` (used for syntax highlighting) and the title; everything until the next `@api` line is the body, unindented.

## Not tags

`@apiStructure`, `@apiErrorStructure`, `@apiSuccessStructure` and `@apiHeaderStructure` appear in old upstream docs but have no parser here. apidoc reports `parser plugin '...' not found`, which `--warn-error` turns into a failure. Use `@apiDefine` and `@apiUse` instead.
