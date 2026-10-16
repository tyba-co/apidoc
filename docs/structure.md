# Structuring your documentation

This page explains how apidoc turns comment blocks into a site and how to organise them: blocks, groups, versions, shared definitions, request and response fields, examples, and nested bodies. Every tag is described in detail in the [Tag reference](tags.md).

## Anatomy of a block

A block is one comment (`/** ... */` in C-style languages, see [Getting started](index.md#what-apidoc-does) for the others). Inside it, a tag starts at `@api...` and runs until the next line whose first characters (after spaces and `*`) are `@api`. A tag can therefore span several lines, which is how descriptions and examples work.

```js
/**
 * @api {post} /users Create a user
 * @apiVersion 1.0.0
 * @apiName CreateUser
 * @apiGroup User
 * @apiDescription Creates a user and sends the welcome email.
 * Descriptions are Markdown and may span several lines.
 *
 * @apiBody {String} email Email address.
 * @apiSuccess (201 Created) {String} id Id of the new user.
 */
```

Rules that decide what apidoc keeps:

- A comment without any tag that starts with `@api` is ignored.
- A block containing `@apiIgnore` is skipped entirely. A block containing `@apiPrivate` is skipped unless you run apidoc with `--private`.
- A block containing `@apiDefine` is a definition, not an endpoint (see [Reusing blocks](#reusing-blocks-with-apidefine-and-apiuse)). If it also contains `@api`, the endpoint is silently dropped: keep the two in separate blocks.
- Tag names are case-insensitive (`@apiname` works) but write them in camelCase.
- An unknown tag such as `@apiFoo` produces the warning `parser plugin 'apifoo' not found` and is skipped.
- A tag whose value is required but empty fails with `Empty parser result.` (for example a bare `@apiName` or an example tag without a body).
- A tag that contains `word[...]` outside its example text, such as `items[0]` in a description, triggers the warning `The use of square brackets for object properties is deprecated. Please use dot notation instead`. The tag is skipped, not parsed, so the description disappears from the output. Rephrase the text (for example "the first item").

### What is required

| Tag | Required | What happens if you leave it out |
| --- | --- | --- |
| `@api {method} url title` | Yes, for every endpoint | A block without `@api` has no method and URL, and the URL checks described below cannot run. |
| the title in `@api` | Yes, in practice | An endpoint with an empty title is not rendered in the generated site at all (the template skips it), although apidoc reports no error. |
| `@apiName` | No, but always set it | The name is generated from method and URL: `{get} /users/:id` becomes `GetUsersId`. It changes whenever the URL changes, which breaks links and version history. |
| `@apiGroup` | No, but always set it | The path of the source file becomes the group name and title, so every file gets its own sidebar section named after a file path. |
| `@apiVersion` | No | The block gets the project `defaultVersion` (`0.0.0` unless configured), not the project `version`. |

The site identifies an endpoint by the pair `@apiGroup` + `@apiName`. Two blocks with the same pair are treated as versions of one endpoint, so a copy-pasted block that keeps the old name becomes another version of the original.

## Groups and navigation order

`@apiGroup` creates a sidebar section. Whitespace in the name is replaced by `_` in the identifier and shown as spaces in the site, so `@apiGroup Order Items` and `@apiGroup Order_Items` are the same group.

To give a group a display title and an introduction, define a block with the same name as the group:

```js
/**
 * @apiDefine User User accounts
 * Everything related to user accounts.
 * The text after the title line is the group description (Markdown).
 */

/**
 * @api {get} /users List users
 * @apiVersion 1.0.0
 * @apiName ListUsers
 * @apiGroup User
 * @apiSuccess {Object[]} items Users.
 * @apiSuccess {String} items.id User id.
 */

/**
 * @api {get} /users/:id Get a user
 * @apiVersion 1.0.0
 * @apiName GetUser
 * @apiGroup User
 * @apiParam {String} id User id.
 * @apiSuccess {String} id User id.
 */
```

The sidebar shows "User accounts" with the description above the endpoints. Without a matching `@apiDefine`, the group title is the group name.

### Ordering

By default, groups are sorted alphabetically by group name (plain string sort, so uppercase letters come before lowercase), and endpoints inside a group are sorted by their lower-cased title. Override this with the `order` array in `apidoc.json`:

```json
{
  "name": "Users API",
  "version": "1.0.0",
  "order": ["User accounts", "Orders", "CreateUser", "GetUser"]
}
```

- A group is matched by its displayed title, with `_` read as a space. In the example above the group defined with `@apiDefine User User accounts` is matched by `User accounts`, not by `User`.
- An endpoint is matched by its `@apiName` (`GetUser`) or by its lower-cased title (`get a user`).
- Everything not listed keeps the default order and is placed after the listed items.

You can also add free-form pages before and after the endpoints with the `header` and `footer` keys. See [Configuration keys](configuration.md#configuration-keys).

## Versions

`@apiVersion` takes a strict semantic version: `1.0.0` is valid, `1.0`, `1.x` and `v1` are not. The error is `Version format not valid.` with the definition `@apiVersion major.minor.patch`.

To change an endpoint in a breaking way, keep the old block and add a new one with the same `@apiGroup` and `@apiName` and a higher `@apiVersion`:

```js
/**
 * @api {get} /users/:id Get a user
 * @apiVersion 1.0.0
 * @apiName GetUser
 * @apiGroup User
 * @apiParam {String} id User id.
 * @apiSuccess {String} name Full name.
 */

/**
 * @api {get} /users/:id Get a user
 * @apiVersion 2.0.0
 * @apiName GetUser
 * @apiGroup User
 * @apiParam {String} id User id.
 * @apiSuccess {String} firstName First name.
 * @apiSuccess {String} lastName Last name.
 */
```

How the generated site uses versions:

- The version button at the top lists the project `version` plus every `@apiVersion` found. Choosing a version shows, for each endpoint, the newest block whose version is lower than or equal to the chosen one.
- On load the site shows the project `version` from your config. A block whose `@apiVersion` is higher than the project `version` is hidden until you pick a higher version in that dropdown. Bump `version` in `apidoc.json` when you introduce a higher `@apiVersion`.
- With the compare feature enabled (default), each endpoint has a dropdown "compare changes to:" that shows a diff against another version, and the top dropdown has "Compare all with predecessor". Disable it with `template.withCompare` set to `false`. Opening the page with `?compare=1` starts in compare mode.
- Blocks without `@apiVersion` get `defaultVersion`, so they always show.

`@apiDefine` blocks are versioned too, with the same `@apiVersion` tag. See the next section for how `@apiUse` picks one.

## Reusing blocks with @apiDefine and @apiUse

`@apiDefine name [title]` declares a reusable block. Every line after the first is its description. The block can hold any field or example tags, and `@apiUse` inlines them into an endpoint.

```js
/**
 * @apiDefine AuthHeader
 * @apiHeader {String} Authorization Bearer access token.
 */

/**
 * @apiDefine ValidationError
 * @apiError (400 Bad Request) ValidationError One or more body fields are invalid.
 * @apiErrorExample {json} 400:
 *     HTTP/1.1 400 Bad Request
 *     { "error": "ValidationError", "fields": ["amount"] }
 */

/**
 * @api {post} /transfers Create a transfer
 * @apiVersion 1.0.0
 * @apiName CreateTransfer
 * @apiGroup Transfer
 * @apiUse AuthHeader
 * @apiBody {Number} amount Amount in cents.
 * @apiSuccess (201 Created) {String} id Transfer id.
 * @apiUse ValidationError
 */
```

Behaviour:

- `@apiDefine` names may contain letters, digits, `_` and `:`. Anything else fails with `Name must contain only alphanumeric and colon characters.`
- `@apiUse` can be repeated, and a defined block can itself contain `@apiUse`.
- Fields from the definition are appended to the endpoint's own. When both declare the same field name in the same group, the endpoint's own declaration wins and the duplicate is removed.
- Keep one `@apiDefine` per comment block. A second one in the same block does not raise an error; it silently replaces the name of the first and merges both bodies.
- The same name is looked up for four things: `@apiUse`, the title of a group (`@apiGroup`), the title of a field group (`@apiParam (name) ...`) and a permission (`@apiPermission name`). A define therefore also needs a title when it is used for the last three.

### Versioned definitions

When the endpoint has `@apiVersion X`, `@apiUse name` uses the definition with exactly version `X`, or else the one with the highest version lower than `X`. A define without `@apiVersion` has the version `defaultVersion`.

```js
/**
 * @apiDefine PageSize
 * @apiVersion 1.0.0
 * @apiQuery {Number} [limit=20] Page size.
 */

/**
 * @apiDefine PageSize
 * @apiVersion 2.0.0
 * @apiQuery {Number{1..100}} [limit=50] Page size, at most 100.
 */

/**
 * @api {get} /orders List orders
 * @apiVersion 1.5.0
 * @apiName ListOrders
 * @apiGroup Order
 * @apiUse PageSize
 * @apiSuccess {Object[]} items Orders.
 */

/**
 * @api {get} /orders List orders
 * @apiVersion 2.1.0
 * @apiName ListOrders
 * @apiGroup Order
 * @apiUse PageSize
 * @apiSuccess {Object[]} items Orders.
 */
```

Here the `1.5.0` endpoint gets the `1.0.0` definition and the `2.1.0` endpoint gets the `2.0.0` one.

### Failures

These fail the run (exit code 1) because apidoc stops at the first error.

```text
@apiUse Missing
  error: Referenced groupname does not exist / it is not defined with @apiDefine.

@apiDefine Shared with @apiVersion 2.0.0, used by an endpoint with @apiVersion 1.0.0
  error: Referenced definition has no matching or a higher version. Check version number in referenced define block.
```

The definition must be inside one of the input directories. If it lives elsewhere, add that directory with another `-i`.

## Documenting path parameters, query and body

Pick the tag by where the value travels:

| Tag | Where the value travels | Section in the site |
| --- | --- | --- |
| `@apiParam` | The URL path (`/users/:id`) | Parameter |
| `@apiQuery` | The query string (`?page=2`) | Query Parameter(s) |
| `@apiBody` | The request body (JSON or form) | Request Body, plus a generated example |
| `@apiHeader` | A request header | Header |

```js
/**
 * @api {post} /accounts/:accountId/transfers Create a transfer
 * @apiVersion 1.0.0
 * @apiName CreateAccountTransfer
 * @apiGroup Account
 *
 * @apiHeader {String} Authorization Bearer access token.
 * @apiParam {String} accountId Account the money leaves.
 * @apiQuery {Boolean} [dryRun=false] Validate without moving money.
 * @apiBody {String} targetAccountId Account the money enters.
 * @apiBody {Number} amount Amount in cents.
 * @apiBody {String="COP","USD"} [currency="COP"] ISO 4217 currency.
 *
 * @apiSuccess (201 Created) {String} id Transfer id.
 */
```

apidoc cross-checks `@apiParam` against the URL and emits warnings, which `--warn-error` turns into failures:

- Every `:name` segment of the URL path needs an `@apiParam`. Otherwise: `URL contains a parameter ':name' that is not documented as @apiParam in @api '<title>' in file: '<file>'`.
- Every required `@apiParam` must appear as a `:name` in the URL. Otherwise: `@apiParam 'name' was defined but does not appear in URL of @api '<title>' in file: '<file>'`. The usual cause is a body field documented with `@apiParam`: use `@apiBody`. Optional parameters (`[name]`) are exempt from this check.
- `@apiQuery`, `@apiBody` and `@apiHeader` are never checked against the URL.
- A block that contains `@apiDefine` is not checked for required parameters missing from the URL, and an endpoint that uses `@apiUse` may satisfy `:name` through the parameters of the definition.
- A nested `@apiParam` such as `filter.q` is also a required parameter that is not in the URL. Put structured input in `@apiQuery` or `@apiBody`.

`(group)` is accepted on every field tag. For `@apiParam`, `@apiHeader`, `@apiSuccess` and `@apiError` it creates a separate table with the group as heading; for `@apiQuery` and `@apiBody` it is accepted but has no effect on the layout: the site renders one table for each.

The field syntax (`{type{size}=allowed}`, `[field=default]`) is described in the [Field grammar](tags.md#field-grammar).

## Headers

Request headers are `@apiHeader` fields, typically defined once and pulled in with `@apiUse`. When the endpoint has a sample request form, each header becomes an input there. `@apiHeaderExample` shows a header block under the Header table.

```js
/**
 * @apiDefine AuthHeader
 * @apiHeader {String} Authorization Bearer access token.
 * @apiHeaderExample {json} Header:
 *     { "Authorization": "Bearer eyJhbGciOi..." }
 */

/**
 * @api {get} /me Get the current user
 * @apiVersion 1.0.0
 * @apiName GetMe
 * @apiGroup User
 * @apiUse AuthHeader
 * @apiHeader {String} [X-Request-Id] Correlation id echoed in the response.
 * @apiSuccess {String} id User id.
 */
```

## Success and error responses

`@apiSuccess` documents response fields and `@apiError` documents error identifiers. The text in parentheses is the group: it becomes the table heading, so distinct statuses get distinct tables.

| Tag | Default group | Typical use |
| --- | --- | --- |
| `@apiSuccess` | `Success 200` | `@apiSuccess (201 Created) {String} id Id.` |
| `@apiError` | `Error 4xx` | `@apiError (409 Conflict) EmailTaken The email is already registered.` |

For `@apiError` the field is an error code, normally without a type. The Type column appears in a table only when at least one field in it has a type.

```js
/**
 * @api {post} /users Create a user
 * @apiVersion 1.0.0
 * @apiName CreateUser
 * @apiGroup User
 * @apiBody {String} email Email address.
 *
 * @apiSuccess (201 Created) {String} id User id.
 * @apiSuccess (201 Created) {Object} links Related resources.
 * @apiSuccess (201 Created) {String} links.self URL of the user.
 * @apiSuccessExample {json} 201:
 *     HTTP/1.1 201 Created
 *     { "id": "u_1", "links": { "self": "/users/u_1" } }
 *
 * @apiError (400 Bad Request) InvalidEmail The email is not valid.
 * @apiError (409 Conflict) EmailTaken The email is already registered.
 * @apiErrorExample {json} 409:
 *     HTTP/1.1 409 Conflict
 *     { "error": "EmailTaken" }
 */
```

Nested response fields use the same dot notation and the same `Object` / `Object[]` parent rule as request bodies. See [Field names and nested bodies](#field-names-and-nested-bodies).


## File responses, response headers and asynchronous endpoints

An endpoint can return a file, for example a CSV export. Declare it as a `File` field of `@apiSuccess`, with the format in the allowed values, and describe the columns with `@apiFileColumn`, exactly as for a file in the body. Document the headers the server sends with `@apiResponseHeader`.

```js
/**
 * @api {get} /sales/export Download the sales
 * @apiVersion 1.0.0
 * @apiName DownloadSales
 * @apiGroup Sales
 * @apiQuery {String} [month] Month, as YYYY-MM.
 * @apiSuccess {File="csv"} sales The file, comma delimited, UTF-8.
 * @apiFileColumn (sales) {Date} date Sale date.
 * @apiFileColumn (sales) {Number} amount=1500 Amount in COP.
 * @apiResponseHeader {String} Content-Disposition="attachment; filename=sales.csv" Name of the downloaded file.
 * @apiResponseHeader {Number} X-Total-Count=250 Number of rows in the file.
 */
```

Under the success table the site shows a card for the file: the format, the expected columns, and an example file as a spreadsheet preview, as the raw CSV and as the raw HTTP response (`200 OK` with `Content-Type` and `Content-Disposition`). The headers get a "Response Headers" table of their own, after the success fields.

For an endpoint that works in the background, answer `202 Accepted` and point to the result with a header. There is no special tag: a success group, a `Location` header and a second endpoint for polling say it all.

```js
/**
 * @api {post} /reports Start a report
 * @apiVersion 1.0.0
 * @apiName StartReport
 * @apiGroup Report
 * @apiBody {String} month Month, as YYYY-MM.
 * @apiSuccess (202 Accepted) {String} id Id of the report job.
 * @apiResponseHeader (Response Headers 202) {String} Location="/reports/42" URL to poll until the report is ready.
 * @apiResponseHeader (Response Headers 202) {Number} Retry-After=5 Seconds to wait before polling.
 */
```

Document the polling endpoint as an ordinary `GET` that answers `200` with the result and `202` while it is not ready; the `Location` header of the first answer is its URL.


## Webhooks and streams

Two kinds of endpoint are not a simple request and answer:

- **Webhooks.** Your API calls the client. Declare the block as usual, with the method and an example path, and add `@apiWebhook`. The site marks it as a webhook, calls the body "Payload" and hides the sample request.
- **Streams.** The response never ends: server-sent events or newline-delimited JSON. Add `@apiStreaming {sse}` and describe one event with `@apiSuccess` and an `@apiSuccessExample {http}`. The sample request is hidden.

```js
/**
 * @api {post} /webhooks/payment-confirmed Payment confirmed
 * @apiVersion 1.0.0
 * @apiName PaymentConfirmedWebhook
 * @apiGroup Webhooks
 * @apiWebhook Sent when a payment is confirmed. Answer 2xx within 5 seconds.
 * @apiHeader {String} X-Signature HMAC of the payload.
 * @apiBody {String} paymentId Id of the payment.
 * @apiBody {Number} amount Amount in cents.
 */
```

```js
/**
 * @api {get} /payments/stream Payment events
 * @apiVersion 1.0.0
 * @apiName PaymentStream
 * @apiGroup Payments
 * @apiStreaming {sse} One event per payment change.
 * @apiSuccess {String} event Event name.
 * @apiSuccess {String} data JSON with the payment.
 * @apiSuccessExample {http} Event:
 *     event: payment.confirmed
 *     data: {"id":"p_1","amount":1500}
 */
```

apidoc is for HTTP APIs: GraphQL, WebSocket and gRPC services do not fit a method and path, and are not modeled.

## Examples

| Tag | Shown | Typical content |
| --- | --- | --- |
| `@apiExample` | Tabs above the field tables | A client call such as `curl` |
| `@apiParamExample` | In the Parameter block, before the Query and Request Body tables | A request payload |
| `@apiHeaderExample` | Below the Header table | Request headers |
| `@apiSuccessExample` | Below the success tables | A success response |
| `@apiErrorExample` | Below the error table | An error response |

All five share one syntax: an optional `{type}` and a title on the first line, then the example body on the following lines. The type selects syntax highlighting and defaults to `json`. The body is required; without it the run fails with `Empty parser result.` When the type is `json` and the body is valid JSON, the site re-indents it; a body that starts with an HTTP status line is shown as written.

```js
/**
 * @api {get} /users/:id Get a user
 * @apiVersion 1.0.0
 * @apiName GetUser
 * @apiGroup User
 * @apiParam {String} id User id.
 *
 * @apiExample {curl} Usage:
 *     curl -i https://api.example.com/users/u_1 -H "Authorization: Bearer $TOKEN"
 * @apiExample {js} Fetch:
 *     const response = await fetch('/users/u_1');
 *
 * @apiHeaderExample {json} Header:
 *     { "Authorization": "Bearer eyJhbGciOi..." }
 *
 * @apiSuccess {String} id User id.
 * @apiSuccessExample {json} 200:
 *     HTTP/1.1 200 OK
 *     { "id": "u_1" }
 *
 * @apiError (404 Not Found) UserNotFound No user exists with this id.
 * @apiErrorExample {json} 404:
 *     HTTP/1.1 404 Not Found
 *     { "error": "UserNotFound" }
 */
```

A line inside an example that starts with `@api` ends the example, so do not start an example line with that text.

## Permissions

`@apiPermission name` lists a permission under the endpoint ("Permission: name"). It can be repeated. When an `@apiDefine` with the same name exists, its title and description appear in a popover next to the name.

```js
/**
 * @apiDefine admin Administrator
 * Needs the admin role.
 */

/**
 * @api {delete} /users/:id Delete a user
 * @apiVersion 1.0.0
 * @apiName DeleteUser
 * @apiGroup User
 * @apiPermission admin
 * @apiParam {String} id User id.
 */
```

An undefined permission name is not an error: it is shown without a popover.

## Deprecation, private and ignored blocks

```js
/**
 * @api {get} /users/:id/balance Get a user balance
 * @apiVersion 1.0.0
 * @apiName GetUserBalance
 * @apiGroup User
 * @apiDeprecated use (#User:GetUser) instead.
 * @apiParam {String} id User id.
 */

/**
 * @api {get} /internal/health Health check
 * @apiVersion 1.0.0
 * @apiName GetHealth
 * @apiGroup Internal
 * @apiPrivate
 */
```

- `@apiDeprecated [text]` shows a DEPRECATED notice with the text. In the text, `(#Group:Name)` becomes a link to that endpoint and `[label](#Group:Name)` links with a custom label.
- `@apiPrivate` hides the block unless you build with `--private` (`-p`).
- `@apiIgnore` skips the block completely, for work in progress or code that must never be documented.

## Code samples

Under every endpoint the site shows its request as **cURL**, **JavaScript** (`fetch`) and **Python** (`requests`), built from what you documented:

- the path parameters (`@apiParam`) replaced in the URL with their example value;
- the required query parameters (`@apiQuery`), and those with a default;
- the request headers (`@apiHeader`) that are required or have a default; a secret header without an example, such as `Authorization`, gets a placeholder (`<token>`);
- the credentials of the first `auth` scheme of `apidoc.json` as a placeholder, except for endpoints with `@apiPermission none`;
- the body, according to its format: the JSON example for JSON, form parts with the file for `multipart/form-data`, `--data-urlencode` and `URLSearchParams` for form-encoded bodies, `--data-binary` for a binary body, and the first `@apiParamExample` for XML and text.

The samples are generated, not written: there is nothing to maintain. Examples are the `=example` / default values of the fields, then the first allowed value, then a placeholder by type. Webhooks and streams have no samples. To turn them off, set `template.codeSamples` to `false`; see [Configuration](configuration.md#configuration-keys).

## OpenAPI export

`apidoc --openapi` writes `openapi.json` (OpenAPI 3.0.3) next to the site, so the same comments feed Postman, code generators and gateways:

```bash
npx --no-install apidoc -i src -o doc --openapi
```

- `url` and `environments` become `servers`; `auth` becomes `securitySchemes` and the global `security`. Endpoints with `@apiPermission none` get `security: []`.
- Path parameters, `@apiQuery` and `@apiHeader` become `parameters`; the body becomes a `requestBody` in its format (JSON schema with nesting, required fields, sizes and allowed values; `multipart/form-data` with binary files and their `@apiFileColumn` columns; form-encoded, binary, XML and text bodies).
- Success and error groups become responses by status (`Error 4xx` is `4XX`); `@apiResponseHeader` becomes response `headers`, and a `File` field in the success fields becomes a download with its media type.
- `@apiWebhook` endpoints go under `x-webhooks`, and `@apiStreaming` adds `x-streaming`.
- Only the newest version of each method and path is exported.

## Sample request

An endpoint gets a "Send a Sample Request" form when it has a sample request URL, which comes from either place:

- `sampleUrl` in the config: every endpoint gets a form that targets `sampleUrl` followed by the endpoint URL. `@apiSampleRequest off` disables it for one endpoint.
- `@apiSampleRequest <url>` on an endpoint, absolute or relative to `sampleUrl`. It can be repeated; the form uses the first URL.

```js
/**
 * @api {get} /users/:id Get a user
 * @apiVersion 1.0.0
 * @apiName GetUser
 * @apiGroup User
 * @apiParam {String} id User id.
 * @apiSampleRequest https://staging.example.com/users/:id
 */

/**
 * @api {post} /webhooks/payments Receive a payment webhook
 * @apiVersion 1.0.0
 * @apiName ReceivePaymentWebhook
 * @apiGroup Webhook
 * @apiSampleRequest off
 * @apiBody {String} event Event name.
 */
```

The form is built from the endpoint's `@apiHeader`, `@apiParam`, `@apiQuery` and `@apiBody` fields. `:id` in the URL is replaced with the value typed for the `id` field.

## Body formats

A body is JSON unless you say otherwise. `@apiContentType` declares the format, and the site adapts the example, the cURL command and the sample request to it. The `@apiBody` fields keep describing the content in every case.

Form-encoded bodies, such as OAuth token endpoints:

```js
/**
 * @api {post} /oauth/token Request an access token
 * @apiVersion 1.0.0
 * @apiName RequestTokenForm
 * @apiGroup Auth
 * @apiContentType application/x-www-form-urlencoded
 * @apiBody {String="password","refresh_token"} grant_type Grant type.
 * @apiBody {String} username=ana@example.com User name.
 * @apiBody {String} [password] Password, with the password grant.
 * @apiSuccess {String} access_token Bearer token.
 */
```

The example is the raw request with the encoded body (`grant_type=password&username=ana%40example.com`) and a cURL command with `--data-urlencode`. The sample request has one input per field and sends the values form encoded. Nested fields use brackets (`address[city]`) and an array repeats its name.

A binary body, where the whole body is one file and not a multipart part:

```js
/**
 * @api {put} /users/:id/avatar Upload an avatar
 * @apiVersion 1.0.0
 * @apiName UploadAvatarBinary
 * @apiGroup User
 * @apiContentType image/png
 * @apiParam {Number} id Id of the user.
 * @apiBody {File{2MB}="png"} avatar The image.
 */
```

The example shows `[binary content]` and `curl --data-binary @avatar.png`; the sample request has one file input and sends the chosen file with its Content-Type.

XML and text bodies. There is no generated example, because the structure is yours: write it with `@apiParamExample`, and the sample request starts with it.

```js
/**
 * @api {post} /orders/xml Create an order from XML
 * @apiVersion 1.0.0
 * @apiName CreateOrderXmlBody
 * @apiGroup Order
 * @apiContentType application/xml
 * @apiBody {Number} id Order id.
 * @apiBody {String} customer Customer name.
 * @apiParamExample {xml} Request:
 *     <order>
 *       <id>1</id>
 *       <customer>Ana</customer>
 *     </order>
 * @apiSuccess {Number} id Id of the created order.
 */
```

A top-level JSON array is declared with a single optional `Object[]` field; see [The body example](#the-body-example). Files in a `multipart/form-data` body have their own section below.

## Files in the body

A file is sent as `multipart/form-data`, so a body with a `File` field is a multipart request: every `@apiBody` field is one part of it, and the field name is the name of the part. The file is the part with that name and a `filename`; the other fields are plain parts. Declare the file as an `@apiBody` field of type `File`. Its format goes in the allowed values, so the same `="..."` that restricts a string describes the accepted extensions. For a tabular file (`csv`, `tsv`, `xlsx`), `@apiFileColumn` lists the columns the file must have.

```js
/**
 * @api {post} /users/import Import users from a file
 * @apiVersion 1.0.0
 * @apiName ImportUsersFile
 * @apiGroup User
 * @apiDescription Upload a CSV file with one user per row. The first row holds the column names.
 * @apiBody {File{5MB}="csv"} users Users to create, comma delimited, UTF-8.
 * @apiBody {Boolean} [dryRun] Validate the file without creating anything.
 * @apiFileColumn (users) {String} name Full name of the user.
 * @apiFileColumn (users) {String} email=ana@example.com Email address, unique per user.
 * @apiFileColumn (users) {Date} "Hire date" Date when the user was hired, as YYYY-MM-DD.
 * @apiFileColumn (users) {Number} [age] Age in years.
 * @apiFileColumn (users) {String="ADMIN","USER"} role=USER Role granted to the user.
 * @apiSuccess {Number} created Number of users created.
 */
```

What the site shows under "Request Body":

- The heading is marked `multipart/form-data`. In the field table, the `users` row has type `File`, its accepted formats (`csv`) and its size limit (`5MB`).
- A card per file with the format and whether it is required, a table of **expected columns** (position, name, type, an example value, description, allowed values, and an `optional` mark) and an **example file**: a spreadsheet-style preview with the column letters and the header row, plus a tab with the raw CSV ready to copy.
- The generated example is the multipart request itself, in two tabs: the raw HTTP request (with the file part, its `filename` and `Content-Type`, and the CSV content built from the columns) and the equivalent `curl` command with `-F`. It replaces the JSON example, because a multipart body has no JSON. Nested fields get bracket names, like `extraInfo[hireDate]` and `tags[]`, the same as in the sample request form.

Rules:

- The `(file)` of `@apiFileColumn` is the name of the `File` field; without it, the column belongs to the first file. Columns whose name matches no file field get their own card.
- The order of the tags is the order of the columns, and the example row uses the `=example` value, then the first allowed value, then a placeholder by type.
- Quote a column name that has spaces or dots: `"Hire date"`. See [Field names and nested bodies](#field-names-and-nested-bodies) for the same quoting in `@apiBody`.
- Several files are several `File` fields, or one `{File[]}`, which is shown as two parts with the same name. Give each file its own `(file)` group.
- The sample request starts as `multipart/form-data` when the body has a file: each `File` field is a file input (`multiple` for `File[]`), and the chosen files are sent as real file parts. apidoc documents the upload; it does not validate it.

## Field names and nested bodies

Dot notation describes nested objects, in requests and responses:

```js
/**
 * @api {post} /customers Create a customer
 * @apiVersion 1.0.0
 * @apiName CreateCustomer
 * @apiGroup Customer
 * @apiBody {String} name Full name.
 * @apiBody {Object} address Postal address.
 * @apiBody {String} address.city City.
 * @apiBody {String} [address.zip] Postal code.
 * @apiBody {Object[]} contacts Phone contacts.
 * @apiBody {String} contacts.number Phone number.
 */
```

The rules:

- A dot nests a field only under a parent that is declared with a type containing `Object`, so `Object` or `Object[]`. Any other parent type, or no parent, leaves the field flat.
- The parent must be declared before its children in the block. A child that comes first stays flat.
- Nesting can go several levels deep (`a`, `a.b`, `a.b.c`), and `Object[]` parents produce an array holding one sample object.
- In the field table, children are indented under their parent.
- A flat key that contains a dot, like `profile.nick` without a declared `profile` object, appears in the generated body example in red with the tooltip `String · required · cannot nest: its parent is not declared as an Object`. This is a hint that you forgot to declare the parent as `Object`, or that you wanted a literal key.
- A segment wrapped in double quotes declares a literal key that contains a dot. It is never split at its dot and it is shown normally, without the red marker.

```js
/**
 * @api {post} /events Track an event
 * @apiVersion 1.0.0
 * @apiName TrackEvent
 * @apiGroup Event
 * @apiBody {String} "custom.property" Key that really contains a dot.
 * @apiBody {Object} meta Event metadata.
 * @apiBody {String} meta."trace.id" Trace id, stored under the key `trace.id` inside `meta`.
 * @apiBody {String} meta.source Emitting service.
 */
```

This generates `{ "custom.property": "", "meta": { "trace.id": "", "source": "" } }`. Quote only the segment that contains the dot, as in `meta."trace.id"`. Without the parent (`meta` here declared as `Object`), `meta."trace.id"` becomes a flat key `meta.trace.id` in the example, and that key gets no tooltip.

The same quoting works in the other field tags. `@apiSuccess {String} items."a.b" Value.` documents a response key.

## The body example

When an endpoint has `@apiBody` fields, the Request Body section shows two things: the field table, and an "Example" with a JSON document built from those fields. The same JSON seeds the body of the sample request form.

How the generated JSON is built:

| Field type | Value in the example |
| --- | --- |
| `String` | The default value, or `""` |
| `Number` | The default value as an integer, or `0` |
| `Boolean` | `true` if a default value is written, otherwise `false`. Any default counts, including `[flag=false]`, which renders `true` |
| `Date` | The default value, or today's date formatted in the reader's locale |
| `Object` (and any type that contains the text `Object`, such as `ObjectId`) | `{}`, with nested fields filled in |
| `Object[]` | `[]`, or an array with one sample object when nested fields exist |
| any `Type[]` (for example `String[]`) | `[]` |
| anything else (for example `Mixed`, `File`) | The field is left out of the example |

Details worth knowing:

- Type names `String`, `Number`, `Boolean` and `Date` are matched case-insensitively; the `Object` check is a case-sensitive substring test, so `ObjectId` is treated as an object while `object` is not.
- `Number` defaults are read as integers: `[price=9.5]` renders `9`.
- Every `@apiBody` field needs a type. The generator reads the type of every field, and one `@apiBody` without a type (`@apiBody name Description`) makes the page fail in the browser with `Uncaught TypeError: Cannot read properties of undefined (reading 'toLowerCase')`: no endpoint of the site is rendered. apidoc itself reports nothing.
- If the body has exactly one top-level field and that field is optional, the example is that field's bare value instead of an object. This is the way to document a body that is a top-level array: declare `@apiBody {Object[]} [items]` with its children and the example shows `[ { ... } ]`. The same shortcut applies to a single optional scalar, so a lone `@apiBody {Number} [limit=20]` renders `20`.
- In the form-data variant of the sample request, a `Boolean` field is a checkbox that is ticked when the field has any default value, for the same reason.

### Provide your own example

If the endpoint has an `@apiParamExample` of type `json` (the default type), the site shows yours and skips the generated one. An example of another type, such as `{curl}`, does not replace the generated one.

```js
/**
 * @api {post} /customers Create a customer
 * @apiVersion 1.0.0
 * @apiName CreateCustomerWithExample
 * @apiGroup Customer
 * @apiBody {String} name Full name.
 * @apiBody {Object} address Postal address.
 * @apiBody {String} address.city City.
 * @apiBody {Number} [age=30] Age in years.
 * @apiParamExample {json} Request:
 *     {
 *       "name": "Ana",
 *       "address": { "city": "Bogota" },
 *       "age": 41
 *     }
 */
```

### Hover tooltips

Hovering a key or a scalar value (string, number, boolean or null) in the example shows `Type · required` or `Type · optional`, for example `Number · optional`. The words are translated like the rest of the interface.

- On the generated example, the tooltip text for a key that cannot nest also says `cannot nest: its parent is not declared as an Object`, and the key is red.
- In your own `@apiParamExample` the keys are matched to your `@apiBody` fields by their dotted path (arrays add no path segment), so `address` and `address.city` get tooltips in the example above. Keys that match no `@apiBody` field get no tooltip, and the red marker is never used there.
- Tooltips are attached only when the key paths found in the highlighted JSON line up with the highlighted tokens. An example that is not valid JSON-like text may get none.

### Autocomplete in the sample request

The JSON textarea of "Send a Sample Request" suggests the keys you declared with `@apiBody`, so a body is quick to write by hand.

- **Keys.** Type `"` inside an object, or press Ctrl+Space, to see the keys that object can take, filtered as you type. The list follows the nesting: inside `address` it offers `address.city`, not the root fields, and it goes through arrays of objects. Keys already present in that object are left out.
- **Accepting.** Enter or Tab inserts `"key": value` with the default of the field (`""`, `0`, `false`, `{}`, `[]` or `[{}]` by type) and puts the cursor where you continue typing. When another key follows, a comma is added. Accepting on a key that is already complete only renames it.
- **Values.** After `:` it offers `true` and `false` for a `{Boolean}` field and the allowed values of a field declared like `{String="ASC","DESC"}`.
- **Navigating.** The arrow keys move, Escape closes the list, and hovering an entry shows the field description. The details next to each key are the same `Type · required|optional` as the tooltips.
- **Not covered.** Free text values are not suggested, and the Parameters textarea of endpoints documented with `@apiParam` has no autocomplete.
