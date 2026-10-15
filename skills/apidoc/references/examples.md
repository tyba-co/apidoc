# Validated examples

Every `js` block below passes `apidoc -n --warn-error` on its own (checked by `test/skill_sync_test.js` in @tyba-co/apidoc). Copy the shape, not the names.

## Create a resource with a JSON body and shared definitions

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
 * @apiVersion 1.2.0
 * @apiName CreateTransfer
 * @apiGroup Transfer
 * @apiDescription Moves money between two accounts of the authenticated user.
 *
 * @apiUse AuthHeader
 * @apiBody {String} sourceAccountId Account the money leaves.
 * @apiBody {String} targetAccountId Account the money enters.
 * @apiBody {Number} amount Amount in cents.
 * @apiBody {String="COP","USD"} [currency="COP"] ISO 4217 currency.
 *
 * @apiSuccess (201 Created) {String} id Transfer id.
 * @apiSuccess (201 Created) {String="PENDING","DONE"} status Current status.
 * @apiSuccessExample {json} 201:
 *     HTTP/1.1 201 Created
 *     { "id": "tr_9f2", "status": "PENDING" }
 *
 * @apiUse ValidationError
 * @apiError (409 Conflict) InsufficientFunds The source account balance is too low.
 */
```

## Paginated list with query parameters

```js
/**
 * @api {get} /accounts/:accountId/movements List account movements
 * @apiVersion 1.0.0
 * @apiName ListMovements
 * @apiGroup Account
 *
 * @apiParam {String} accountId Account id.
 * @apiQuery {Number} [page=1] Page number, starting at 1.
 * @apiQuery {Number{1..100}} [limit=20] Page size.
 * @apiQuery {String} [from] Inclusive start date, `YYYY-MM-DD`.
 *
 * @apiSuccess {Object[]} items Movements, newest first.
 * @apiSuccess {String} items.id Movement id.
 * @apiSuccess {Number} items.amount Signed amount in cents.
 * @apiSuccess {Number} total Total number of movements.
 * @apiSuccessExample {json} 200:
 *     HTTP/1.1 200 OK
 *     { "items": [{ "id": "mv_1", "amount": -12000 }], "total": 1 }
 *
 * @apiError (404 Not Found) AccountNotFound No account exists with this id.
 */
```

## Deprecated endpoint kept next to its replacement

```js
/**
 * @api {get} /users/:id/balance Get a user balance
 * @apiVersion 1.0.0
 * @apiName GetUserBalance
 * @apiGroup User
 * @apiDeprecated use (#Account:ListMovements) instead.
 *
 * @apiParam {String} id User id.
 * @apiSuccess {Number} balance Balance in cents.
 */
```

## A new version of an existing endpoint

Keep the old block untouched and add a block with the same `@apiName` and `@apiGroup` and a higher `@apiVersion`.

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

## Wrong on purpose

```text
@apiParam {String} email User email.          <- body field: use @apiBody
@apiVersion 1.2                               <- not semver: use 1.2.0
@apiSuccess {String} profile[name] Name.      <- brackets: use profile.name
@apiErrorStructure UserErrors                 <- not a tag: use @apiDefine + @apiUse
```
