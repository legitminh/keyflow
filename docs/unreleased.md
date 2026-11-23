# Unreleased changes

Notes for the next minor release (`pnpm release minor --notes-file docs/unreleased.md`).

## New components

- `BoundedText`: one line of text (or custom children) capped at `limit` units wide (16 characters by default). Longer content scrolls horizontally with native scrolling and becomes focusable for keyboard users.
- `HorizontalSlider` / `VerticalSlider`: slider presets whose step controls are persistent positional `Button`s. Their shortcuts follow page position and stay registered while offscreen.
- `TextBox singleLine`: a one-line field one min-box high. Enter (physical or virtual) commits, and pasted line breaks become spaces.
- `NumberBox`: a numeric single-line TextBox. On commit it parses, clamps to `min`/`max` and snaps to `step`. Unparsable text reverts. ArrowUp/ArrowDown nudge the value while editing.
- `TextBox inputMethod`: a client `TextInputMethod` (IME, phonetic keyboard) receives physical and virtual keys first and edits through a `TextComposition` with underlined marked text, commit, cancel and native undo history.
- `TextBoxController.edit(change)`: client controls edit a TextBox through the same `TextComposition` an input method uses.
- `KeypathToggle`: switches buttons between showing their keypath (shortcut labels) in front and hiding it. Shortcut colors and highlights remain, and shortcuts keep working while hidden.

## New state and options

- `keypath_visibility` (`visible`, `set()`, `toggle()`): reactive keypath visibility, persisted with the other preferences.
- `keypathVisible` option (`true` by default, `false`, or `'auto'`). `'auto'` shows keypaths on computers and hides them on touch-first devices such as iPads and phones; `detect_keypath_visible()` exposes the same check. The README recommends `'auto'` plus an exposed `KeypathToggle`.

## Changes

- Preferences (theme, grid size, scrolling mode, keypath visibility) persist in `localStorage` instead of `sessionStorage`; earlier session values migrate on first read.
