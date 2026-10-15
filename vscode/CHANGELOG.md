# Changelog

## 0.2.2

- Marketplace metadata: the Tyba app icon, a dark gallery banner, homepage and issue tracker links.

## 0.2.1

- No more "Unknown language" errors in the extension's Runtime Status: snippets are contributed only to languages VS Code ships. Vue, Kotlin, Scala, Elixir and Erlang keep tag completion (it does not depend on the language being registered), and Vue, Kotlin and Scala get the `apidoc` / `apidocdefine` blocks from the completion provider.

## 0.2.0

- Context-aware completion inside doc comments: tags, HTTP methods, field types, status groups, example languages, and the `@apiDefine` names, groups and versions of the workspace.
- Syntax highlighting of `@api...` tags, `(group)` and `{type}` in comments.
- Host tests that run the extension in a real VS Code.

## 0.1.0

- Snippets for every tag, block snippets and a JSON schema for `apidoc.json`.
