# Unreleased changes

Notes for the next minor release (`pnpm release minor --notes-file docs/unreleased.md`).

## New components

- `BoundedText`: one line of text (or custom children) capped at `limit` units wide (16 characters by default). Longer content scrolls horizontally with native scrolling and becomes focusable for keyboard users.
- `HorizontalSlider` / `VerticalSlider`: slider presets whose step controls are persistent positional `Button`s. Their shortcuts follow page position and stay registered while offscreen.
- `TextBox singleLine`: a one-line field one min-box high. Enter (physical or virtual) commits, and pasted line breaks become spaces.
- `NumberBox`: a numeric single-line TextBox. On commit it parses, clamps to `min`/`max` and snaps to `step`. Unparsable text reverts. ArrowUp/ArrowDown nudge the value while editing.
