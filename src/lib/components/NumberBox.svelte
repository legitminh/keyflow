<!--
  Numeric single-line TextBox. The draft text is validated when editing ends (Enter, the exit trigger,
  an opted-in outside click, or the controller's exit()): it is parsed, clamped to [min, max], snapped to `step`, and written to
  `value`; unparsable drafts revert. While editing, physical ArrowUp/ArrowDown nudge by one step.
-->
<script lang="ts">
  import TextBox from './TextBox.svelte';
  import type { Shortcut } from '../shortcuts.js';
  import type { TextBoxController } from '../textbox.js';
  import { normalize_slider_value } from '../slider.js';

  let { value = $bindable(0), min = -Infinity, max = Infinity, step = 1, digits, label = 'number', enterTrigger, exitTrigger = 'escape',
    priority = 0, showEntry = true, disabled = false, exitOnClickOutside = false, exitOnShiftEnter = true,
    width = '8ch', format, onchange, class: className = '' }: {
    value?: number; min?: number; max?: number; step?: number;
    /** Fraction digits shown; defaults to those of `step`. */
    digits?: number;
    label?: string; enterTrigger?: Shortcut | null; exitTrigger?: Shortcut; priority?: number; showEntry?: boolean; disabled?: boolean;
    /** Finish and validate the draft on outside click. Default false. */
    exitOnClickOutside?: boolean;
    /** Finish with Shift+Enter. Default true; Enter always finishes a numeric field. */
    exitOnShiftEnter?: boolean;
    /** CSS width of the editing field. */
    width?: string;
    /** Custom display text, e.g. `(v) => v + ' px'`. Editing always shows the bare number. */
    format?: (value: number) => string;
    onchange?: (value: number) => void;
    class?: string;
  } = $props();

  let box = $state<TextBoxController>();
  const places = $derived(digits ?? Math.max(0, (String(step).split('.')[1] ?? '').length));
  const show = (n: number) => Number.isFinite(n) ? n.toFixed(places) : '';
  let draft = $state('');
  let editing = false;

  function clampSnap(n: number) {
    const lo = Number.isFinite(min) ? min : -Number.MAX_SAFE_INTEGER, hi = Number.isFinite(max) ? max : Number.MAX_SAFE_INTEGER;
    return normalize_slider_value(n, lo, hi, step > 0 ? step : 1);
  }
  function commit(text: string) {
    editing = false;
    const parsed = Number(text.trim().replace(',', '.'));
    if (text.trim() === '' || !Number.isFinite(parsed)) { draft = show(value); return; }
    const next = clampSnap(parsed);
    draft = show(next);
    if (next !== value) { value = next; onchange?.(next); }
  }
  // Keep the visible text in sync with outside changes while not editing.
  $effect(() => { const current = value; if (!editing) draft = format ? format(current) : show(current); });

  export async function enter() { await box?.enter(); }
  export async function exit() { await box?.exit(); }
</script>

<span class="keyflow-numberbox {className}" style:--textbox-width={width}
  onkeydown={(event) => {
    if (!editing || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
    event.preventDefault();
    const base = Number(draft.trim()), next = clampSnap((Number.isFinite(base) ? base : value) + (event.key === 'ArrowUp' ? step : -step));
    draft = show(next);
  }}>
  <TextBox bind:this={box} bind:value={draft} singleLine {label} {enterTrigger} {exitTrigger} {priority} {showEntry} {disabled}
    {exitOnClickOutside} {exitOnShiftEnter}
    inputmode="decimal" spellcheck={false}
    onenter={() => { editing = true; draft = show(value); }}
    onexit={(text) => commit(text)} />
</span>

<style>
  .keyflow-numberbox { display: inline-block; vertical-align: middle; }
</style>
