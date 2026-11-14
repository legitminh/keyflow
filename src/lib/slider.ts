import type { Snippet } from 'svelte';
import type { Shortcut } from './shortcuts.js';

export type SliderDirection = -1 | 1;
export interface SliderController {
  /** Set an absolute value, clamped and snapped to step. */
  set(value: number): void;
  /** Move a number of steps; useful for discrete custom controls. */
  shift(steps: number): void;
  /** Move one step immediately, then continuously until stopped. Repeated starts are idempotent. */
  start(direction: SliderDirection): void;
  /** Stop one direction, or all motion when omitted. */
  stop(direction?: SliderDirection): void;
}
export interface SliderCoreProps {
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  /** Units per second while held. Defaults to half the range per second. */
  speed?: number;
  orientation?: 'horizontal' | 'vertical';
  disabled?: boolean;
  label?: string;
  /** Optional accessible value description, e.g. "50 percent". */
  valueText?: (value: number) => string;
  onchange?: (value: number) => void;
  class?: string;
}
export interface SliderProps extends Omit<SliderCoreProps, 'orientation'> {
  /** Overrides the preset controls with any composition of existing interactables. */
  controls?: Snippet<[SliderController]>;
  decreaseLabel?: string;
  increaseLabel?: string;
}
export interface HoverSliderProps extends SliderProps {
  decreaseKeys?: Shortcut;
  increaseKeys?: Shortcut;
}

export function normalize_slider_value(value: number, min: number, max: number, step: number): number {
  if (![value, min, max, step, max - min].every(Number.isFinite) || max <= min || step <= 0) {
    throw new RangeError('Slider values must be finite, max must exceed min, and step must be positive');
  }
  if (value <= min) return min;
  if (value >= max) return max;
  // Remove floating point tails without limiting values to integer steps.
  return Math.max(min, Math.min(max, Number((min + Math.round((value - min) / step) * step).toPrecision(15))));
}
