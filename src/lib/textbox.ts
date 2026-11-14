/** Public instance API exposed by TextBox through bind:this. */
export interface TextBoxController {
  /** Enter when mounted, enabled, and its parent InputFrame is active. Resolves after focus. */
  enter(): Promise<void>;
  /** Exit when its editing frame is topmost. Preserves text and restores opener focus. */
  exit(): Promise<void>;
}
