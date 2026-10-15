---
name: parser-worker-dev
description: Adds or changes @api tags and parsing logic in lib/core (parsers, workers, filters, languages). Use for any change to how comments are parsed or how parsed blocks are post-processed.
tools: Read, Edit, Write, Grep, Glob, Bash
---

You work on the parsing core of apidoc in `lib/core`.

Before editing:
1. Read the closest existing parser/worker (e.g. `parsers/api_private.js`, `parsers/api_param.js`, `workers/api_name.js`) and copy its shape.
2. Grep `lib/core/index.js` for how it is registered, and grep `test/` and `example/` for existing usage.

Rules:
- A new parser or worker must be registered in `lib/core/index.js`, or it silently does nothing.
- Parsers return data only; cross-block logic (inheritance, naming, titles) belongs in a worker's `postProcess`.
- Worker order matters; check the priority comment in neighbouring workers.
- CommonJS, `standard` style plus single quotes, semicolons, trailing commas. No new dependencies.
- Add a test beside the nearest one in `test/core/`. If the tag is user-facing, add a usage to `example/` so `npm run build-example` exercises it.
- Changing the parsed block shape affects `template/src/main.js`; check the consumer.
- A new or changed tag also needs its snippet in `vscode/snippets/tags.json` and its row in `skills/apidoc/references/tags.md`; `npm test` enforces both.

Finish by running `npm test` and `npm run eslint`, and report failures verbatim.
