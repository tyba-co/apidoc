# Tag reference

Every tag that apidoc understands, with its syntax, parameters, constraints and an example. The list comes from the parsers registered in `lib/core/index.js` (23 tags) plus `@apiIgnore`, which the block scanner handles itself.

Conventions used on this page:

- Square brackets in a syntax line mean the part is optional; they are not typed (except for the optional-field marker described in the [Field grammar](#field-grammar)).
- Tag names are case-insensitive; write them in camelCase.
- A tag runs from `@apiTag` until the next line that starts with `@api`, so values may span several lines.
- When a tag has no value but needs one, apidoc stops with `Empty parser result.` and the tag name.
- Tags that "insert" a single value (`@api`, `@apiName`, `@apiGroup`, `@apiVersion`, `@apiDescription`, `@apiDeprecated`, `@apiPrivate`) keep the last one when repeated. Tags that "push" (fields, examples, `@apiUse`, `@apiPermission`, `@apiSampleRequest`) accumulate.

| Tag | Purpose |
| --- | --- |
| [`@api`](#api) | Declare an endpoint: method, URL and title |
| [`@apiBody`](#apibody) | Request body field |
| [`@apiDefine`](#apidefine) | Declare a reusable block, group title or permission |
| [`@apiDeprecated`](#apideprecated) | Mark an endpoint deprecated |
| [`@apiDescription`](#apidescription) | Markdown description |
| [`@apiError`](#apierror) | Error response identifier |
| [`@apiErrorExample`](#apierrorexample) | Error response example |
| [`@apiExample`](#apiexample) | Usage example |
| [`@apiFileColumn`](#apifilecolumn) | Column of a tabular file in the body |
| [`@apiGroup`](#apigroup) | Put the endpoint in a sidebar group |
| [`@apiHeader`](#apiheader) | Request header |
| [`@apiHeaderExample`](#apiheaderexample) | Header example |
| [`@apiIgnore`](#apiignore) | Skip a block |
| [`@apiName`](#apiname) | Name the endpoint inside its group |
| [`@apiParam`](#apiparam) | URL path parameter |
| [`@apiParamExample`](#apiparamexample) | Request example |
| [`@apiPermission`](#apipermission) | Declare the permission needed |
| [`@apiPrivate`](#apiprivate) | Hide an endpoint unless `--private` |
| [`@apiQuery`](#apiquery) | Query string parameter |
| [`@apiSampleRequest`](#apisamplerequest) | Configure the sample request form |
| [`@apiSuccess`](#apisuccess) | Response field |
| [`@apiSuccessExample`](#apisuccessexample) | Success response example |
| [`@apiUse`](#apiuse) | Inline a defined block |
| [`@apiVersion`](#apiversion) | Version of the block |

## Field grammar

`@apiParam`, `@apiQuery`, `@apiBody`, `@apiHeader`, `@apiSuccess` and `@apiError` share one grammar:

```text
@apiParam [(group)] [{type[{size}][=allowed]}] field[=default] [description]
```

with the field optionally wrapped in square brackets to mark it optional: `[field]` or `[field=default]`.

| Part | Syntax | Meaning |
| --- | --- | --- |
| group | `(404 Not Found)` | Heading of the table the field is listed in. Default depends on the tag (see below). A group that matches an [`@apiDefine`](#apidefine) name is displayed with that define's title. |
| type | `{String}`, `{Object[]}`, `{String\|Number}` | Characters allowed: letters, digits and `( ) # : . / \ [ ] _ \| -`. A type containing `[]` marks an array and one containing the text `Object` makes the field a parent for nested fields. |
| size | `{String{1..64}}` | Free text between the inner braces; shown as "Size range". |
| allowed values | `{String="ACTIVE","BLOCKED"}`, `{Number=1,2,3}` | Comma-separated list shown as "Allowed values". Quote values that contain spaces. |
| optional | `[field]` | Marks the field optional. It is the only thing that makes a field optional: apidoc has no "required" keyword. |
| default | `[field=20]`, `[title="Mr Smith"]`, `[x='a b']` | Shown as "Default value". Unquoted defaults end at the first space or `]`; quote defaults that contain spaces. |
| field | `id`, `address.city`, `meta."trace.id"` | Field name. Allowed characters: letters, digits and `# @ $ : . / \ _ -`. A dot nests the field under a parent (see below). A segment in double quotes is a literal key and may contain dots. |
| description | free text | Everything after the field: Markdown, may span lines. |

Rules and consequences:

- The field name is required. `@apiParam {String}` fails with `Empty parser result.`
- A field with no `{type}` is accepted (`@apiError (404 Not Found) UserNotFound No user exists.`), but `@apiBody` fields must have a type, because the request body example cannot be built without it.
- Nesting: `profile.displayName` nests under `profile` only if `profile` was declared earlier, in the same block, with a type that contains `Object` (`Object` or `Object[]`). Otherwise the key stays flat.
- Quoted segments: `"custom.property"` and `meta."trace.id"` are never split at the dot inside the quotes. The quotes are not part of the key shown in the site.
- Do not use brackets for nesting. `profile[name]` raises `The use of square brackets for object properties is deprecated. Please use dot notation instead` and the tag is skipped.
- Repeating a field name inside the same group keeps the first declaration.

Default group per tag:

| Tag | Default group | Where it appears |
| --- | --- | --- |
| `@apiParam` | `Parameter` | One table per group in the Parameter block |
| `@apiQuery` | `Query` | One "Query Parameter(s)" table; the group has no effect |
| `@apiBody` | `Body` | One "Request Body" table; the group has no effect |
| `@apiHeader` | `Header` | One table per group in the Header block |
| `@apiSuccess` | `Success 200` | One table per group |
| `@apiError` | `Error 4xx` | One table per group |

**Example**

```js
/**
 * @api {post} /orders Create an order
 * @apiVersion 1.0.0
 * @apiName CreateOrder
 * @apiGroup Order
 * @apiBody {String{3..64}} reference Order reference.
 * @apiBody {String="PENDING","PAID"} [status="PENDING"] Initial status.
 * @apiBody {Number} [discount=0] Discount in cents.
 * @apiBody {Object[]} lines Order lines.
 * @apiBody {String} lines.sku Product code.
 * @apiBody {Number} lines.quantity Units ordered.
 * @apiBody {Object} meta Free-form metadata.
 * @apiBody {String} meta."trace.id" Trace id, a key that contains a dot.
 * @apiSuccess (201 Created) {String} id Order id.
 */
```

## Example tags

The five example tags share one syntax and one set of rules, described once here.

```text
@apiExample [{type}] [title]
    example body
    on the lines that follow
```

| Part | Required | Meaning |
| --- | --- | --- |
| `{type}` | No | Highlighting language, default `json`. Allowed characters: letters, digits and `. / \ [ ] _ -`. |
| `title` | No | Tab title. Without it the tab is called "Example 1", "Example 2", and so on. |
| body | Yes | The lines after the first one, until the next `@api` line. Indentation is removed. Without a body apidoc fails with `Empty parser result.` |

A body line that starts with `@api` ends the example. Examples are exempt from the square-bracket warning, so JSON arrays are fine.

## Tags

One section per tag, in alphabetical order. Each one gives the syntax, the parts it takes, notes taken from the parser source and an example.

### @api

Declares the block as an endpoint with its HTTP method, URL and title.

**Syntax**

```text
@api {method} path [title]
```

| Part | Required | Meaning |
| --- | --- | --- |
| `{method}` | Written always, though the parser accepts its absence | HTTP method in braces, any text: `{get}`, `{POST}`. It is lower-cased for the coloured badge; `get`, `post`, `put` and `delete` have a colour, other methods such as `patch` get a grey badge. Without it the method is empty and the badge is blank. |
| `path` | Yes | URL path without spaces, for example `/users/:id`. `:name` segments are path parameters. Shown with the `url` config key prepended when the path does not start with `http`. |
| `title` | Yes, in practice | The rest of the line. It is the sidebar label and the article heading. An endpoint with an empty title is not rendered in the generated site, although apidoc raises no error. |

**Notes**

- The parser regular expression is `^(?:(?:\{(.+?)\})?\s*)?(.+?)(?:\s+(.+?))?$`. A bare `@api` fails with `Empty parser result.`
- For every `:name` in the path, apidoc expects an [`@apiParam`](#apiparam) with that name and warns otherwise.
- Do not put `@api` and `@apiDefine` in one block: the block then counts as a definition and the endpoint is dropped.

**Example**

```js
/**
 * @api {put} /users/:id/email Change a user email
 * @apiVersion 1.0.0
 * @apiName ChangeUserEmail
 * @apiGroup User
 * @apiParam {String} id User id.
 * @apiBody {String} email New email address.
 */
```

### @apiBody

Documents a field of the request body and feeds the generated body example.

**Syntax**

```text
@apiBody [(group)] {type[{size}][=allowed]} field[=default] [description]
```

| Part | Required | Meaning |
| --- | --- | --- |
| `(group)` | No | Accepted, default `Body`, but the site renders one "Request Body" table whatever the group. |
| `{type}` | Yes, in practice | Needed to build the example. A field without a type makes the whole page fail to render in the browser (`Uncaught TypeError`), although apidoc reports nothing. |
| `field` | Yes | Field name; dots nest under `Object` / `Object[]` parents. |
| `description` | No | Markdown. |

**Notes**

- A file is a `{File}` field; put its format in the allowed values (`{File="csv"}`) and describe its columns with [`@apiFileColumn`](#apifilecolumn). A body with a file is a `multipart/form-data` request, and the example shows it as raw multipart and `curl`. See [Files in the body](structure.md#files-in-the-body).
- A `{Boolean}` field gets a `checked` flag when it has any default value, which pre-ticks the checkbox of the form-data sample request.
- The Request Body section renders an example JSON generated from these fields unless an `@apiParamExample` of type `json` exists. See [The body example](structure.md#the-body-example).
- Not checked against the URL.

**Example**

```js
/**
 * @api {post} /users Create a user
 * @apiVersion 1.0.0
 * @apiName CreateUser
 * @apiGroup User
 * @apiBody {String} email Email address.
 * @apiBody {Boolean} [newsletter=true] Subscribe to the newsletter.
 * @apiBody {String[]} [roles] Role names.
 * @apiSuccess (201 Created) {String} id User id.
 */
```

### @apiDefine

Declares a named block that other tags refer to by name: [`@apiUse`](#apiuse) inlines it, [`@apiGroup`](#apigroup) takes its title and description, a field `(group)` takes its title, and [`@apiPermission`](#apipermission) shows its title and description.

**Syntax**

```text
@apiDefine name [title]
description lines
```

| Part | Required | Meaning |
| --- | --- | --- |
| `name` | Yes | Letters, digits, `_` and `:` only. Otherwise: `Name must contain only alphanumeric and colon characters.` |
| `title` | No | The rest of the first line. |
| description | No | The following lines, as Markdown, until the next `@api` line. |

**Notes**

- The block may contain field tags, example tags, `@apiHeader`, `@apiError`, and further `@apiUse` and `@apiPermission`. Their content is merged into every endpoint that uses it.
- It may carry an [`@apiVersion`](#apiversion), used when an endpoint selects a definition by version.
- Keep one `@apiDefine` per comment block; a second one silently replaces the name of the first.
- A block with `@apiDefine` is never rendered as an endpoint.
- The definition must be inside an input directory.

**Example**

```js
/**
 * @apiDefine NotFoundError
 * @apiError (404 Not Found) NotFound The resource does not exist.
 * @apiErrorExample {json} 404:
 *     HTTP/1.1 404 Not Found
 *     { "error": "NotFound" }
 */

/**
 * @api {get} /orders/:id Get an order
 * @apiVersion 1.0.0
 * @apiName GetOrder
 * @apiGroup Order
 * @apiParam {String} id Order id.
 * @apiUse NotFoundError
 */
```

### @apiDeprecated

Marks an endpoint as deprecated, optionally with a note.

**Syntax**

```text
@apiDeprecated [text]
```

| Part | Required | Meaning |
| --- | --- | --- |
| `text` | No | Markdown note shown after the DEPRECATED label. |

**Notes**

- `(#Group:Name)` becomes a link to the endpoint `Name` of group `Group`, and `[label](#Group:Name)` links with your own label.
- Without text, the endpoint is simply flagged.

**Example**

```js
/**
 * @api {get} /orders/:id/total Get an order total
 * @apiVersion 1.0.0
 * @apiName GetOrderTotal
 * @apiGroup Order
 * @apiDeprecated use [Get an order](#Order:GetOrder) instead.
 * @apiParam {String} id Order id.
 * @apiSuccess {Number} total Total in cents.
 */
```

### @apiDescription

Adds a longer description of the endpoint.

**Syntax**

```text
@apiDescription text
```

| Part | Required | Meaning |
| --- | --- | --- |
| `text` | Yes when the tag is present | Markdown. May continue on the following lines until the next `@api` line; indentation is removed. |

**Notes**

- Rendered with the Markdown parser configured by `--markdown` (markdown-it with HTML allowed by default).
- An empty value fails with `Empty parser result.`
- The text must not contain `word[something]` (for example `items[0]`). The tag is then skipped with a warning about square brackets and the description is lost.

**Example**

```js
/**
 * @api {post} /transfers/:id/cancel Cancel a transfer
 * @apiVersion 1.0.0
 * @apiName CancelTransfer
 * @apiGroup Transfer
 * @apiDescription Cancels a transfer that is still `PENDING`.
 *
 * - A completed transfer cannot be cancelled.
 * - Cancelling twice is not an error.
 * @apiParam {String} id Transfer id.
 */
```

### @apiError

Documents an error that the endpoint can return.

**Syntax**

```text
@apiError [(group)] [{type}] errorName [description]
```

| Part | Required | Meaning |
| --- | --- | --- |
| `(group)` | No | Table heading, normally status and reason: `(404 Not Found)`. Default `Error 4xx`. |
| `{type}` | No | Usually omitted. |
| `errorName` | Yes | Error identifier or code, shown in the "Name" column. |
| `description` | No | Markdown: when the error happens. |

**Notes**

- Same grammar as the other field tags, so an error can also carry nested fields (`@apiError (400 Bad Request) {Object[]} fields`).
- Combine with [`@apiErrorExample`](#apierrorexample) to show a response body.
- Shared errors belong in an [`@apiDefine`](#apidefine) block.

**Example**

```js
/**
 * @api {delete} /users/:id Delete a user
 * @apiVersion 1.0.0
 * @apiName DeleteUser
 * @apiGroup User
 * @apiParam {String} id User id.
 * @apiError (404 Not Found) UserNotFound No user exists with this id.
 * @apiError (409 Conflict) UserHasOpenOrders The user still has open orders.
 */
```

### @apiErrorExample

An example of an error response, shown below the error table.

**Syntax**

```text
@apiErrorExample [{type}] [title]
    body
```

**Example**

```js
/**
 * @api {get} /users/:id Get a user
 * @apiVersion 1.0.0
 * @apiName GetUser
 * @apiGroup User
 * @apiParam {String} id User id.
 * @apiError (404 Not Found) UserNotFound No user exists with this id.
 * @apiErrorExample {json} 404:
 *     HTTP/1.1 404 Not Found
 *     { "error": "UserNotFound" }
 */
```

### @apiExample

A free-form usage example, shown in tabs above the field tables.

**Syntax**

```text
@apiExample [{type}] [title]
    body
```

**Notes**

- Typical content is a client call: `curl`, a JavaScript snippet, a CLI command.

**Example**

```js
/**
 * @api {get} /users/:id Get a user
 * @apiVersion 1.0.0
 * @apiName GetUser
 * @apiGroup User
 * @apiParam {String} id User id.
 * @apiExample {curl} Usage:
 *     curl -i https://api.example.com/users/u_1
 * @apiExample {js} Fetch:
 *     const user = await fetch('/users/u_1').then(response => response.json());
 */
```

### @apiFileColumn

Documents one column of a tabular file sent in the request body, so the site can show the layout the file must have.

**Syntax**

```text
@apiFileColumn [(file)] {type[{size}][=allowed]} column[=example] [description]
```

| Part | Required | Meaning |
| --- | --- | --- |
| `(file)` | No | Name of the `File` field of an [`@apiBody`](#param-api-body) the column belongs to. Without it the column belongs to the first `File` field. A name that matches no `File` field gets its own card, titled with that name. |
| `{type}` | Yes, in practice | `String`, `Number`, `Boolean`, `Date`... Shown in the Type column and used to build the example value. |
| `column` | Yes | Header of the column. Put it in brackets for an optional column (`[age]`) and between double quotes when it has spaces or dots (`"Hire date"`). |
| `=example` | No | Value shown in the Example column and in the example file. Without it the first allowed value is used, and without that a placeholder by type: `text`, `0`, `true` or `2026-01-31`. |
| `description` | No | Markdown. |

**Notes**

- The order of the tags is the order of the columns: the first tag is column 1 (`A`).
- The field of the file is declared with [`@apiBody`](#param-api-body) and its format goes in the allowed values: `{File="csv"}`. With `csv` or `tsv` the example file also has a tab with the raw text (comma or tab delimited, quoted as RFC 4180 requires); other formats, such as `xlsx`, only get the preview.
- A file field without columns stays a normal row of the body table, with its accepted formats and size (`{File{5MB}="csv"}` shows `Size limit: 5MB`).
- apidoc does not validate uploads; this is documentation only. Columns declared in an [`@apiDefine`](#param-api-define) are inherited by [`@apiUse`](#param-api-use) like any other field.
- Works with `{File[]}` for several files.

**Example**

```js
/**
 * @api {post} /sales/import Import sales
 * @apiVersion 1.0.0
 * @apiName ImportSales
 * @apiGroup Sales
 * @apiBody {File="csv"} sales Monthly export, comma delimited, UTF-8.
 * @apiBody {Boolean} [dryRun] Validate without importing.
 * @apiFileColumn (sales) {Date} date Sale date, as YYYY-MM-DD.
 * @apiFileColumn (sales) {Number} amount=1500 Amount in COP.
 * @apiFileColumn (sales) {String} "Customer name" Full name of the customer.
 * @apiFileColumn (sales) {String="ACTIVE","BLOCKED"} [status] Account status.
 * @apiSuccess {Number} imported Rows imported.
 */
```

### @apiGroup

Puts the endpoint in a sidebar group.

**Syntax**

```text
@apiGroup name
```

| Part | Required | Meaning |
| --- | --- | --- |
| `name` | Yes when the tag is present | Group identifier. Whitespace runs are replaced by `_` and shown as spaces. Parentheses are removed from the identifier used in anchors. |

**Notes**

- Without `@apiGroup`, the path of the source file becomes the group, which is rarely what you want.
- An [`@apiDefine`](#apidefine) with the same name provides the displayed group title and the group description.
- Groups are sorted alphabetically unless the `order` config key says otherwise. See [Structuring your documentation](structure.md#groups-and-navigation-order).

**Example**

```js
/**
 * @apiDefine Order Customer orders
 * Orders placed by customers, from creation to delivery.
 */

/**
 * @api {get} /orders List orders
 * @apiVersion 1.0.0
 * @apiName ListOrders
 * @apiGroup Order
 * @apiSuccess {Object[]} items Orders.
 */
```

### @apiHeader

Documents a request header.

**Syntax**

```text
@apiHeader [(group)] [{type[{size}][=allowed]}] field[=default] [description]
```

| Part | Required | Meaning |
| --- | --- | --- |
| `(group)` | No | Table heading. Default `Header`. |
| `{type}` | No | See the [Field grammar](#field-grammar). |
| `field` | Yes | Header name. Hyphens are allowed (`X-Request-Id`). |
| `description` | No | Markdown. |

**Notes**

- Each header becomes an input of the sample request form, prefilled with its default value.
- Usually defined once in an [`@apiDefine`](#apidefine) block and pulled in with [`@apiUse`](#apiuse).

**Example**

```js
/**
 * @apiDefine AuthHeader
 * @apiHeader {String} Authorization Bearer access token.
 */

/**
 * @api {get} /me Get the current user
 * @apiVersion 1.0.0
 * @apiName GetMe
 * @apiGroup User
 * @apiUse AuthHeader
 * @apiHeader {String} [Accept-Language=es] Preferred response language.
 * @apiSuccess {String} id User id.
 */
```

### @apiHeaderExample

An example of the request headers, shown below the Header table.

**Syntax**

```text
@apiHeaderExample [{type}] [title]
    body
```

**Example**

```js
/**
 * @api {get} /me Get the current user
 * @apiVersion 1.0.0
 * @apiName GetMe
 * @apiGroup User
 * @apiHeader {String} Authorization Bearer access token.
 * @apiHeaderExample {json} Header:
 *     { "Authorization": "Bearer eyJhbGciOi..." }
 * @apiSuccess {String} id User id.
 */
```

### @apiIgnore

Excludes the whole block from the documentation.

**Syntax**

```text
@apiIgnore [text]
```

**Notes**

- Handled by the block scanner in `lib/core/parser.js`, not by a registered parser, so it never produces a "parser plugin not found" warning. Any text after the tag is ignored.
- The block is skipped before any of its tags is validated, which makes it handy for unfinished endpoints.
- It overrides `--private`: an `@apiIgnore` block is never included.

**Example**

```js
/**
 * @api {get} /orders/export Export orders
 * @apiVersion 1.0.0
 * @apiName ExportOrders
 * @apiGroup Order
 * @apiIgnore not implemented yet
 */
```

### @apiName

Names the endpoint inside its group; together with the group it identifies the endpoint and its versions.

**Syntax**

```text
@apiName name
```

| Part | Required | Meaning |
| --- | --- | --- |
| `name` | Yes when the tag is present | Identifier. Whitespace runs are replaced by `_`. |

**Notes**

- Optional in the sense that apidoc does not fail without it: the name is then generated from the method and URL (`{get} /users/:id` becomes `GetUsersId`). The generated name changes with the URL, so always set it.
- It is used in anchors (`#api-Group-Name`) and in `(#Group:Name)` links. Other characters are not rewritten, so stay with letters and digits (the convention is PascalCase `VerbNoun`).
- Blocks with the same group and name are versions of one endpoint.

**Example**

```js
/**
 * @api {get} /users List users
 * @apiVersion 1.0.0
 * @apiName ListUsers
 * @apiGroup User
 * @apiSuccess {Object[]} items Users.
 */
```

### @apiParam

Documents a parameter that travels in the URL path.

**Syntax**

```text
@apiParam [(group)] [{type[{size}][=allowed]}] field[=default] [description]
```

| Part | Required | Meaning |
| --- | --- | --- |
| `(group)` | No | Table heading. Default `Parameter`. |
| `{type}` | No | See the [Field grammar](#field-grammar). |
| `field` | Yes | Name of the path parameter, matching `:field` in the URL. |
| `description` | No | Markdown. |

**Notes**

- Every `:name` segment of the `@api` path needs an `@apiParam name`, otherwise the warning is `URL contains a parameter ':name' that is not documented as @apiParam in @api '<title>' in file: '<file>'`.
- Every required `@apiParam` must appear in the URL, otherwise the warning is `@apiParam 'name' was defined but does not appear in URL of @api '<title>' in file: '<file>'`. Mark a parameter optional with `[name]` to be exempt, or use [`@apiBody`](#apibody) or [`@apiQuery`](#apiquery).
- Fields defined with [`@apiUse`](#apiuse) count for the first check.
- A custom group shows the table under the matching `@apiDefine` title.

**Example**

```js
/**
 * @api {get} /accounts/:accountId/movements/:movementId Get a movement
 * @apiVersion 1.0.0
 * @apiName GetMovement
 * @apiGroup Account
 * @apiParam {String} accountId Account id.
 * @apiParam {String} movementId Movement id.
 * @apiSuccess {Number} amount Signed amount in cents.
 */
```

### @apiParamExample

A request example, shown in the Parameter block, before the Query and Request Body tables.

**Syntax**

```text
@apiParamExample [{type}] [title]
    body
```

**Notes**

- If its type is `json` (the default), the generated body example is not shown and the keys of this example get type tooltips matched to your `@apiBody` fields. See [The body example](structure.md#the-body-example).
- An example of another type does not replace the generated one.

**Example**

```js
/**
 * @api {post} /users Create a user
 * @apiVersion 1.0.0
 * @apiName CreateUser
 * @apiGroup User
 * @apiBody {String} email Email address.
 * @apiBody {String[]} [roles] Role names.
 * @apiParamExample {json} Request:
 *     { "email": "ana@example.com", "roles": ["admin"] }
 */
```

### @apiPermission

Lists the permission or role required to call the endpoint.

**Syntax**

```text
@apiPermission name
```

| Part | Required | Meaning |
| --- | --- | --- |
| `name` | Yes | The whole rest of the line. |

**Notes**

- Repeatable. Shown as "Permission: name".
- If an [`@apiDefine`](#apidefine) with that name exists, its title and description appear in an info popover. Without one, the name is shown alone and nothing fails.
- It is parsed exactly like `@apiUse`, but it does not inline anything.

**Example**

```js
/**
 * @apiDefine admin Administrator
 * Requires the admin role.
 */

/**
 * @api {delete} /orders/:id Delete an order
 * @apiVersion 1.0.0
 * @apiName DeleteOrder
 * @apiGroup Order
 * @apiPermission admin
 * @apiParam {String} id Order id.
 */
```

### @apiPrivate

Hides the endpoint unless apidoc runs with `--private`.

**Syntax**

```text
@apiPrivate
```

**Notes**

- Takes no value; any text after it is ignored.
- Useful for internal endpoints that you want documented only in an internal build (`apidoc --private`).
- Without `--private`, the whole block is skipped and its tags are not validated.

**Example**

```js
/**
 * @api {get} /internal/health Health check
 * @apiVersion 1.0.0
 * @apiName GetHealth
 * @apiGroup Internal
 * @apiPrivate
 * @apiSuccess {String} status Always `ok`.
 */
```

### @apiQuery

Documents a query string parameter.

**Syntax**

```text
@apiQuery [(group)] [{type[{size}][=allowed]}] field[=default] [description]
```

| Part | Required | Meaning |
| --- | --- | --- |
| `(group)` | No | Accepted, default `Query`, but the site renders one "Query Parameter(s)" table whatever the group. |
| `{type}` | No | See the [Field grammar](#field-grammar). |
| `field` | Yes | Parameter name. |
| `description` | No | Markdown. |

**Notes**

- Never checked against the URL: no warnings about missing or extra query parameters.
- Each field is an input in the sample request form.
- Use `[field]` for optional parameters and `[field=value]` for defaults.

**Example**

```js
/**
 * @api {get} /accounts/:accountId/movements List account movements
 * @apiVersion 1.0.0
 * @apiName ListMovements
 * @apiGroup Account
 * @apiParam {String} accountId Account id.
 * @apiQuery {Number} [page=1] Page number, starting at 1.
 * @apiQuery {Number{1..100}} [limit=20] Page size.
 * @apiQuery {String="asc","desc"} [order="desc"] Sort direction by date.
 * @apiSuccess {Object[]} items Movements.
 */
```

### @apiSampleRequest

Sets the URL used by the "Send a Sample Request" form, or turns the form off for this endpoint.

**Syntax**

```text
@apiSampleRequest url
@apiSampleRequest off
```

| Part | Required | Meaning |
| --- | --- | --- |
| `url` | Yes | Absolute URL (starting with `http`, any case), or a path that is prefixed with `sampleUrl` from the config when that is a string. |
| `off` | | Disables the form for this endpoint. |

**Notes**

- Repeatable. Entries equal to `off` are dropped; if nothing remains, the endpoint has no form. The form uses the first remaining URL.
- When `sampleUrl` is set in the config, every endpoint gets a form automatically with `sampleUrl` plus its own URL. Use `off` to opt out.
- When `sampleUrl` is `true`, relative URLs are used as written, so the browser sends them to the origin that serves the documentation.
- `:name` placeholders in the URL are filled from the form fields.

**Example**

```js
/**
 * @api {get} /orders/:id Get an order
 * @apiVersion 1.0.0
 * @apiName GetOrder
 * @apiGroup Order
 * @apiParam {String} id Order id.
 * @apiSampleRequest https://staging.example.com/orders/:id
 */

/**
 * @api {post} /webhooks/orders Receive an order webhook
 * @apiVersion 1.0.0
 * @apiName ReceiveOrderWebhook
 * @apiGroup Webhook
 * @apiBody {String} event Event name.
 * @apiSampleRequest off
 */
```

### @apiSuccess

Documents a field of a successful response.

**Syntax**

```text
@apiSuccess [(group)] [{type[{size}][=allowed]}] field[=default] [description]
```

| Part | Required | Meaning |
| --- | --- | --- |
| `(group)` | No | Table heading, normally the status: `(201 Created)`. Default `Success 200`. |
| `{type}` | No, but recommended | See the [Field grammar](#field-grammar). |
| `field` | Yes | Response field; dots nest under `Object` / `Object[]` parents. |
| `description` | No | Markdown. |

**Notes**

- Different groups give different tables, so one endpoint can document several success statuses.
- The Type column appears when at least one field of the table has a type.

**Example**

```js
/**
 * @api {post} /transfers Create a transfer
 * @apiVersion 1.0.0
 * @apiName CreateTransfer
 * @apiGroup Transfer
 * @apiBody {Number} amount Amount in cents.
 * @apiSuccess (201 Created) {String} id Transfer id.
 * @apiSuccess (201 Created) {String="PENDING","DONE"} status Current status.
 * @apiSuccess (202 Accepted) {String} requestId Id to poll when the transfer needs review.
 */
```

### @apiSuccessExample

An example of a successful response, shown below the success tables.

**Syntax**

```text
@apiSuccessExample [{type}] [title]
    body
```

**Notes**

- Start the body with the HTTP status line when you want to show it (`HTTP/1.1 201 Created`); the body is then shown as written instead of being re-indented as JSON.

**Example**

```js
/**
 * @api {get} /users/:id Get a user
 * @apiVersion 1.0.0
 * @apiName GetUser
 * @apiGroup User
 * @apiParam {String} id User id.
 * @apiSuccess {String} id User id.
 * @apiSuccess {String} email User email.
 * @apiSuccessExample {json} 200:
 *     HTTP/1.1 200 OK
 *     { "id": "u_1", "email": "ana@example.com" }
 */
```

### @apiUse

Inlines the block declared by [`@apiDefine`](#apidefine) with the same name.

**Syntax**

```text
@apiUse name
```

| Part | Required | Meaning |
| --- | --- | --- |
| `name` | Yes | The whole rest of the line is the name, so do not add trailing text. |

**Notes**

- Repeatable, and allowed inside an `@apiDefine` block for composition.
- With a versioned endpoint, the definition used is the one with the same version or the highest lower one.
- The endpoint's own fields win over inherited ones with the same name in the same group.
- Failures: `Referenced groupname does not exist / it is not defined with @apiDefine.` when no definition has that name, and `Referenced definition has no matching or a higher version. Check version number in referenced define block.` when every definition is newer than the endpoint.

**Example**

```js
/**
 * @apiDefine Pagination
 * @apiQuery {Number} [page=1] Page number, starting at 1.
 * @apiQuery {Number{1..100}} [limit=20] Page size.
 */

/**
 * @apiDefine ServerError
 * @apiError (500 Internal Server Error) InternalError Unexpected failure.
 */

/**
 * @api {get} /orders List orders
 * @apiVersion 1.0.0
 * @apiName ListOrders
 * @apiGroup Order
 * @apiUse Pagination
 * @apiUse ServerError
 * @apiSuccess {Object[]} items Orders.
 */
```

### @apiVersion

Sets the version of the block, which drives version comparison and the choice of `@apiUse` definitions.

**Syntax**

```text
@apiVersion major.minor.patch
```

| Part | Required | Meaning |
| --- | --- | --- |
| `major.minor.patch` | Yes when the tag is present | A valid semantic version as accepted by the `semver` package, for example `1.0.0` or `2.1.0-beta.1`. |

**Notes**

- An invalid value stops the run: `Version format not valid.` with the definition `@apiVersion major.minor.patch`. `1.0`, `1.x` and `v1` are invalid.
- Without the tag the block gets `defaultVersion` from the config (`0.0.0` by default), not the project `version`.
- Also valid in an `@apiDefine` block, where it versions the definition.
- The generated site shows only versions up to the project `version` on load. See [Versions](structure.md#versions).

**Example**

```js
/**
 * @api {get} /users/:id Get a user
 * @apiVersion 2.1.0-beta.1
 * @apiName GetUser
 * @apiGroup User
 * @apiParam {String} id User id.
 * @apiSuccess {String} firstName First name.
 */
```

## Tags that are not available

`@apiStructure`, `@apiErrorStructure`, `@apiSuccessStructure` and `@apiHeaderStructure` appear in older upstream documentation. This version registers workers with those names but no parser, so apidoc reports `parser plugin 'apistructure' not found in block ...` (and the equivalent for the others). That is a warning, which `--warn-error` turns into a failure. Use [`@apiDefine`](#apidefine) and [`@apiUse`](#apiuse) instead.
