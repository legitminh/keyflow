# Input frames and virtual keyboards

1. Scope automatic tokens, static shortcut tries, and key reservations to input frames. Keep the existing route stores as the active-frame view. Clear unfinished input whenever the top frame changes.
2. Add persistent frame references, Svelte binding contexts, and an explicit stack manager with push/pop/go_to/replace/reset. Keyflow supplies the permanent root; stack order is independent of DOM nesting. Disable direct activation in lower frames. Retain visibility-based registration as an opt-in within a frame.
3. Extract shared key dispatch for hardware and virtual input. Virtual keys emit key events, never reference interactables, and accept an override callback.
4. Add configurable ASCII keyboard layouts (alpha, alphanumeric, 60%, ortholinear, 4×4, 4×8), composable KeyboardDisplay/KeyboardKeyDisplay components, an optional toolbar, and an isolated keyboard registry with nullable active selection.
5. Add a working demo and migration documentation recommending frames for menus, dialogs, and subflows. Explain lifecycle, masking, static conflicts, input adapters, touch behavior, and customization.
6. Verify frame isolation, restoration, reference transitions, stack unwinding and lifecycle, reservations, cancellation, virtual input, keyboard management, and real Svelte/browser integration. Run check, build, unit tests, and browser tests.

## Completion and validation

All six steps are implemented. The public package exports the frame/controller APIs, virtual input adapters, seven built-in layouts (including flick alpha), composable keyboard displays, and project keyboard stores. The default `/` (also `/stack`) now uses the frame stack to choose every keyboard layout in a persistent half-screen dock; `/frames` covers more keyboard layouts and custom input adapters; the migration guide recommends replacing deregistration bookkeeping with frame scopes.

Validation: `pnpm check` (zero errors/warnings), `pnpm build`, 46 unit tests, and 29 browser tests passed. Browser tests ran with the installed Google Chrome via `CHROME_PATH`, including touch emulation and the existing scrolling/static-shortcut regressions. Equal-priority route restoration, frame-local static reservations, reusable references (including Svelte bindings), direct-click blocking, and consuming transition signals exactly once have dedicated regression coverage.


## Flick-key extension

Keep the input dispatcher, InputTokens, frame manager, and registry APIs intact. Add an optional directional translation map to KeyboardKey plus a FlickKeyDisplay renderer, geometric release classifier, and customizable flick-alpha preset. Undefined directions and cancelled/unmounted gestures emit nothing; final release selects exactly one ordinary virtual key event pair. Mixed layouts use the existing KeyboardDisplay.

The default demo's menu selects seven built-in keyboards plus a mixed sample. A persistent bottom-50dvh div holds the active keyboard while the top half scrolls. The original flow demo remains at `/flow`. Verification covers each direction, return-inside taps, diagonal geometry, cancellation/capture loss, accessible activation, real touch dragging, mixed keys, layout changes mid-gesture, exact preset mappings and uppercase emission, and tablet/phone docking geometry and screenshots.

Button feedback now shares one brief activation highlight across physical keys, virtual keys, direct clicks and touch taps. Held pointer presses use the same color; masked frames cannot highlight through activation. Browser coverage includes automatic/static buttons and quick down/up pairs.

The flick-alpha preset is now a minimal 3×10 ortholinear grid: qwertyuiop / asdfghjkl; / zxcvbnm,. plus Space. Only requested numeric-up, uppercase-down, bracket/brace, colon, angle-bracket and Space-arrow gestures are defined. Unused directions cancel. Printable virtual input casing is preserved while frame shortcut matching remains case-insensitive.
