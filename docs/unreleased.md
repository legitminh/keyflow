# Unreleased changes

Notes for the next release (`pnpm release patch --notes-file docs/unreleased.md`).

## New state and options

- `TextBoxController.edit(change)`: client controls, such as a suggestion bar, edit a TextBox through the same `TextComposition` an input method uses, so edits respect marked text and join native undo history.

## Documentation

- README "Required user settings": every app must offer color theme, keypath display and box size (min-box scaling) on a settings screen, with the controls and state APIs to use.
