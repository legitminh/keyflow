# Unreleased changes

Notes for the next release (`pnpm release minor --notes-file docs/unreleased.md`).

## New state and options

- `SubKeyframe presentation="overlay"`: a dropdown opens as a modal page stacked over the current page. It fills the viewport, scrolls vertically, never scrolls horizontally, and blocks the page until a choice, Back or Escape.

- `TextBoxController.edit(change)`: client controls, such as a suggestion bar, edit a TextBox through the same `TextComposition` an input method uses, so edits respect marked text and join native undo history.

## TextBox outside dismissal

- Clicking or tapping outside TextBox exits its private editing frame, keeps the value, finishes marked text, and reactivates its parent without stealing destination focus. Disabled parent controls dismiss without click-through; NumberBox commits its numeric draft.
- Built-in virtual keyboards keep editing open. Mark custom keyboards, suggestion bars and editing controls with `data-keyflow-textbox-keep-open`. Child frames still suspend and resume editing; Tab and window blur alone keep their native behavior.
- The TextBox guide documents this client contract and warns against manually popping frames on blur.

## Documentation

- README "Required user settings": every app must offer color theme, keypath display and box size (min-box scaling) on a settings screen, with the controls and state APIs to use.
- Box size is scaled by two buttons (× 0.75 and × 1.25), with no text field.
