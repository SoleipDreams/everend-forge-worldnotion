# Changelog

All notable changes to Everend WorldNotion are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.5.2] - 2026-11-25

### Added

- Added an express-start tour for creating an Explorer folder and Markdown
  note, then inspecting the note's base properties.

### Changed

- Clarified the relationship between the local universe folder, Explorer
  folders, notes, and the Properties panel in the learning tours.
- Kept Explorer active when the optional AI Advisor panel is added or selected,
  and placed the two panels together in the default workspace layout.

## [0.2.0] - 2026-07-07

### Added

- Properties panel rebuilt with Obsidian-style rows: add, rename, and change
  property type inline.
- Property pickers for every reference type: entity, entity list, file, and
  image fields now offer autocomplete/pickers instead of raw text inputs.
- Typed toast system (success/info/warning/error) plus a save status
  indicator in the editor.
- Styled in-app dialogs (confirm, message, prompt) replacing every native
  `window.alert`/`confirm`/`prompt` — native dialogs are silently ignored in
  some Tauri webviews (macOS), which made actions like deleting an entity
  type impossible.
- Continuous integration on GitHub Actions: typecheck, lint, format check,
  and the frontend test suite, plus `cargo check`/`clippy`/`test` for the
  Tauri backend.
- Scale guards: a synthetic 1,000-note vault exercises indexing, explorer
  tree, graph build, and wikilink resolution in CI with complexity budgets.

### Changed

- Explorer virtualization and command palette search performance improvements
  for large vaults.
- Workspace state (tabs, tab groups, dock layout, expanded folders) and the
  input/menu/recents behaviors were extracted from the monolithic App
  component into tested domain hooks.
- Vault file operations (create, rename, duplicate, move, trash) now go
  through shared primitives that handle both runtimes (desktop and browser
  File System Access) in one place.
- Modals expose proper ARIA roles, close on Escape, and focus their primary
  action when opened.

### Fixed

- A real Content Security Policy replaces the previous `csp: null`.
- The explorer "Move to folder" action used `window.prompt`, which never
  appears on some platforms; it now uses the in-app prompt dialog.
- Removed a stray `</script>` tag in `index.html` (malformed HTML that
  browsers silently ignored).
- Line endings are normalized to LF via `.gitattributes`, so Prettier checks
  behave identically on Windows and CI.

## [0.1.0] - 2026-07-02

Initial public scaffold: Markdown vault indexing with entity frontmatter,
explorer, tabbed CodeMirror editor with wikilinks, taxonomy and properties
configuration, relationship graph, and dockable workspace layout.
