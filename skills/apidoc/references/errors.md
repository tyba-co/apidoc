# Validation messages

Run `npx --no-install apidoc -i <input-dir> -o /tmp/apidoc-check -n --warn-error`. It prints the first problem and exits 1; fix it and run again.

| Message (start) | Cause | Fix |
|---|---|---|
| `No config files found.` | No `apidoc.json`, `apidoc.config.js` or `package.json` with an `apidoc` key in the input directory or cwd. | Pass `-c path/to/apidoc.json` or run from the directory holding the config. |
| `Version format not valid.` | `@apiVersion` is not semver. | Use `major.minor.patch`, e.g. `1.0.0`. |
| `Referenced groupname does not exist / it is not defined with @apiDefine.` | `@apiUse X` without `@apiDefine X` in the parsed input. | Add the define, or add its directory with another `-i`. |
| `Referenced definition has no matching or a higher version.` | Every `@apiDefine X` has a higher `@apiVersion` than the block using it. | Lower the define's version or raise the block's. |
| `URL contains a parameter ':x' that is not documented as @apiParam` | `:x` in the `@api` path has no `@apiParam x`. | Add `@apiParam {Type} x description`. |
| `@apiParam 'x' was defined but does not appear in URL` | A required `@apiParam` is not a path parameter. | Use `@apiBody` for body fields, `@apiQuery` for query fields, or mark it optional `[x]`. |
| `The use of square brackets for object properties is deprecated.` | Field written as `a[b]`. | Write `a.b`. |
| `parser plugin 'x' not found` | Unknown tag such as `@apiErrorStructure` or a typo. | Use a tag from `tags.md`. |
| `Empty parser result.` | A tag without its required value, e.g. an example tag with no body or an empty `@apiName`. | Add the missing value or delete the tag. |
| `Name must contain only alphanumeric and colon characters.` | `@apiDefine` name contains other characters. | Use letters, digits, `_` or `:`. |
| `Only one definition is allowed in the same block.` | Two `@apiDefine` in one comment block. | One `@apiDefine` per comment block. |
| `Only one definition or usage is allowed in the same block.` | `@apiUse` or `@apiPermission` inside an `@apiDefine` block. | Put `@apiUse`/`@apiPermission` in the endpoint blocks only. |

## Common mistakes that do not fail validation

- Missing `@apiGroup`: the group becomes the file path.
- Missing `@apiName`: the generated name changes when the URL changes, which breaks links and version comparison.
- An `@apiDefine` living outside the `-i` directories works locally only if your command includes that directory; check the project config's `input`.
