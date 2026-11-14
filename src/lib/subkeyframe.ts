import type { InputFrameController } from './input-frames.js';
import type { Shortcut } from './shortcuts.js';
import type { InteractionHandlers } from './interaction.js';

/** Context supplied to custom menu content and item callbacks. */
export interface SubKeyframeContext {
  readonly frame: InputFrameController;
  readonly active: boolean;
  readonly open: boolean;
  enter(): Promise<void>;
  exit(): void;
  toggle(): Promise<void>;
  select(item: SubKeyframeItem): void;
}
export interface SubKeyframeItem extends InteractionHandlers {
  /** Stable identity when replacing/reordering an item list. */
  id?: string;
  label: string;
  /** Omit for an automatic shortcut. */
  keys?: Shortcut;
  disabled?: boolean;
  on_select?: (item: SubKeyframeItem, context: SubKeyframeContext) => void;
  /** Omit for the containing menu's closeOnSelect policy. */
  closeOnSelect?: boolean;
  /** Nested lists get their own frame and Back behavior. */
  items?: readonly SubKeyframeItem[];
}
/** Instance API available through bind:this. */
export interface SubKeyframeController {
  readonly frame: InputFrameController;
  enter(): Promise<void>;
  exit(): void;
  toggle(): Promise<void>;
}
