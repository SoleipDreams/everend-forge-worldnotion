# Portable visual documents

WorldNotion stores timelines and relationship trees as ordinary Markdown files
under the universe root. Multiple documents can coexist and open beside notes
in independent writing panes. No Suite package or private plugin is required.

## Envelope and ownership

The reserved frontmatter key `forgeView` contains a versioned payload. The outer
`id` and `name` identify the document; it does not need canon `type` or `status`.
Visual documents appear in `VaultIndex.visualDocuments`, not `entities`.

```yaml
---
id: document-id
name: Family
forgeView:
  version: 1
  kind: relationships
  id: tree-id
  relationshipTypes: []
  variants:
    main:
      id: main
      name: Present
      nodes: []
      edges: []
      annotations: []
      groups: []
      drawings: []
---

Optional Markdown notes stay below the frontmatter.
```

`kind: timeline` contains `calendar`, `items`, and `views`; see
`src/visualDocuments/timelineTypes.ts` and `calendar.ts` for the exact schema.
Event and period dates are signed decimal integer strings representing ordinal
ticks. Switching calendars preserves those strings and changes the calendar lens.
Each document owns an independent calendar copy. Named universe presets live in
`.everend/calendars.json`; saving a preset does not rewrite other documents.

Tree variants are complete independent canvases, including authored node
positions, connections, annotations, groups, and drawings. They are separate
from canon entity variants. IDs are unique across each canvas's collections.
Dragging, renaming, or deleting a linked person changes this document only.

## References, source, and recovery

Canon links accept a stable entity ID, optionally `@variant`. Exact file paths
can disambiguate duplicate IDs; unique names and aliases are also resolved.
Timeline links may point to existing Markdown notes or visual documents without
requiring a canon entity. An existing full path containing `@` remains a literal
path. Missing or ambiguous references remain stored and are diagnosed.

Source is editable with the regular Markdown editor. Visual updates patch the
YAML AST, preserving unknown extensions, unchanged comments, and the Markdown
body. ID arrays retain item nodes when moved or reordered. Unknown versions and
invalid payloads open in source recovery and are excluded from canon repair,
property normalization, and structure migrations. `forgeView` is reserved from
property definitions and canon variant overrides.
YAML anchors/aliases inside `forgeView` require explicit inlining in Source
before visual editing, preventing one variant's edit from mutating another.

Markdown edits, visual edits, Undo/Redo, dirty state, conflict checks, and Save
share the same tab and exact-snapshot persistence contract.
Save errors belong to the document's pane, show its path, and provide Retry.
Failed writes and conflicts retain the content and dirty state; a successful
retry clears the error. Refreshing the index cannot invalidate a completed save.
Explicitly discarding a document clears its own failed-write guard after any
initiated write settles; failures belonging to other documents remain blocked.

Unsaved authored visual content has a separate machine-local recovery snapshot
containing the saved base, its timestamp, and the current raw Markdown. It is
captured synchronously on edits and stays outside workspace settings and canon
exports. Reopening offers Recover or Discard explicitly; it never applies a copy
or discards it through navigation. Closed or hidden recoveries still block
universe switching. An exact successful save removes only that saved copy,
retaining edits made while a write is in flight. Unsupported source is restored
in Source. If disk content or its timestamp changed, both versions remain
available and saving requires explicit confirmation of a reviewed new base.
A refresh preserves the original timestamp of a dirty tab.

Local session state contains selection, viewport, active view/tree variant, and incomplete manual
forms. It never enters `forgeView` or runtime exports. Pending forms survive tab
switches and app hiding; applying or discarding is explicit. They block closing
their document or changing universes, including when the editor is unmounted.
Layout version 2 stores independent document panes and migrates version 1 layouts.

## Validation

`npm run build` includes the TypeScript check. `npm run test:run` covers portable
AST updates, invalid-source recovery, references, calendar arithmetic, history,
multi-pane docking, local draft recovery, and real App save/guard integration.
Native Tauri acceptance additionally checks pointer interaction, persistence,
and Suite activity ownership against a disposable universe.

Older test fixtures were aligned with existing behavior: attachments use
`.everend/assets/image`, image trees expose nested roots, localized controls use
the current labels, and the image picker exposes its `Pick image` button.
Those fixture updates do not change application behavior.
