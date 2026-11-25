# Unreleased changes

## Changes

- Default labels are lowercase (`back`, `menu`, `text input`, `click to edit`, `number`, `slider`). README documents lowercase interface text as a practice.
- `BoundedText` no longer shows a scrollbar. Overflowing content auto-scrolls in an endless marquee loop that rests at its start each cycle (`speed`, `pause` and `gap` props). It is no longer a focusable scroll region, and `label` is now its tooltip.
