<script lang="ts">
  import { onDestroy, onMount, tick, untrack } from 'svelte';
  import type { HTMLTextareaAttributes } from 'svelte/elements';
  import { create_input_frame, input_frame_manager, active_input_frame, type InputFrameController } from '../input-frames.js';
  import { get_input_frame } from '../input-frame-context.js';
  import { set_input_frame_handler } from '../input-events.js';
  import { create_static_token } from '../stores/static-input.js';
  import type { InputToken } from '../stores/input.js';
  import type { Shortcut } from '../shortcuts.js';
  import { TextareaEditor } from '../text-editor.js';
  import type { MarkedRange, TextInputMethod } from '../text-input-method.js';
  import ButtonDisplay from './ButtonDisplay.svelte';
  import StaticButtonDisplay from './StaticButtonDisplay.svelte';

  let { value = $bindable(''), enterTrigger, exitTrigger = 'escape', priority = 0, showEntry = true,
    label = 'Text input', placeholder = 'Click to edit', rows = 4, disabled = false,
    wrap = 'soft', singleLine = false, inputMethod, class: className = '', onenter, onexit, oninput, ...attributes }: {
    value?: string; enterTrigger?: Shortcut | null; exitTrigger?: Shortcut; priority?: number;
    /** Hide the built-in entry button when supplying your own opener. */
    showEntry?: boolean;
    label?: string; placeholder?: string; rows?: number; disabled?: boolean;
    wrap?: 'soft' | 'hard' | 'off'; class?: string;
    /** One line of text: Enter (physical or virtual) finishes editing and pasted line breaks become spaces. */
    singleLine?: boolean;
    /** Client input method (IME/phonetic keyboard) that receives physical and virtual keys first. */
    inputMethod?: TextInputMethod;
    onenter?: (frame: InputFrameController) => void; onexit?: (value: string) => void;
    oninput?: (event: Event) => void;
  } & Omit<HTMLTextareaAttributes, 'value' | 'children' | 'oninput' | 'class' | 'wrap'> = $props();

  const parent = get_input_frame();
  const frame = create_input_frame({ name: 'textbox' });
  const stack = input_frame_manager.stack;
  const entry = create_static_token(enter);
  const automatic: InputToken = { priority: 0, on_close: enter };
  const exitToken = create_static_token(exit);
  const descriptionId = $props.id();
  let textarea: HTMLTextAreaElement;
  let button = $state<HTMLButtonElement>();
  let editor = $state.raw<TextareaEditor>();
  let marked = $state<MarkedRange | null>(null);
  let backdrop = $state<HTMLDivElement>();
  let mounted = false;
  let opener: HTMLElement | undefined;
  let editing = $derived($stack.includes(frame));
  let active = $derived($active_input_frame === frame);
  const exitDescription = exitToken.description;
  let exitLabel = $derived($exitDescription.label);

  /** Enter from any client control in this textbox's parent InputFrame. */
  export async function enter() {
    if (!mounted || disabled || $active_input_frame !== parent || editing) return;
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    editor?.resetModifiers();
    input_frame_manager.push(frame);
    await tick();
    if (mounted && $active_input_frame === frame) {
      focusEditor();
      onenter?.(frame);
    }
  }
  /** Exit the topmost editing frame, preserving the value and restoring opener focus. */
  export async function exit() {
    if (!mounted || $active_input_frame !== frame) return;
    endComposition();
    editor?.resetModifiers();
    frame.deactivate();
    await tick();
    if (mounted && $active_input_frame === parent) {
      const target = opener?.isConnected && opener !== document.body ? opener : button;
      if (target) target.focus({ preventScroll: true });
      else if (document.activeElement === textarea) textarea.blur();
    }
  }
  function endComposition() {
    if (!editor?.marked) return;
    editor.composition.finish();
    inputMethod?.reset?.();
  }
  const mirrored = ['font', 'letterSpacing', 'wordSpacing', 'lineHeight', 'textIndent', 'tabSize', 'paddingTop', 'paddingRight',
    'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'boxSizing', 'whiteSpace', 'overflowWrap', 'wordBreak', 'direction'] as const;
  function syncBackdrop() {
    if (!backdrop || !textarea) return;
    // Mirror the textarea's live text box, so client styles never need to target the backdrop.
    const style = getComputedStyle(textarea);
    for (const property of mirrored) backdrop.style[property] = style[property];
    backdrop.style.top = `${textarea.offsetTop}px`;
    backdrop.style.left = `${textarea.offsetLeft}px`;
    backdrop.style.width = `${textarea.offsetWidth}px`;
    backdrop.style.height = `${textarea.offsetHeight}px`;
    const scrollbar = textarea.offsetWidth - textarea.clientWidth - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth);
    if (scrollbar > 0) backdrop.style.paddingRight = `${parseFloat(style.paddingRight) + scrollbar}px`;
    backdrop.scrollTop = textarea.scrollTop;
    backdrop.scrollLeft = textarea.scrollLeft;
  }
  function focusEditor() {
    textarea.focus({ preventScroll: true });
    textarea.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  $effect(() => {
    const trigger = enterTrigger;
    const order = priority;
    if (trigger === null || disabled) return;
    untrack(() => parent.update(automatic, order));
    return untrack(() => trigger === undefined ? parent.register(automatic) : parent.static_input.register(entry, trigger));
  });
  $effect(() => frame.static_input.register(exitToken, exitTrigger));
  $effect(() => {
    if (active) void tick().then(() => { if ($active_input_frame === frame) focusEditor(); });
  });
  $effect(() => { if (disabled && editing) untrack(() => frame.deactivate()); });
  let session = false;
  $effect(() => {
    if (editing) session = true;
    else if (session) {
      session = false;
      untrack(() => { editor?.resetModifiers(); onexit?.(value); });
    }
  });

  onMount(() => {
    mounted = true;
    textarea.setSelectionRange(value.length, value.length);
    editor = new TextareaEditor(textarea);
    editor.onmarkedchange = (range) => { marked = range; void tick().then(syncBackdrop); };
    editor.oncompositionlost = () => inputMethod?.reset?.();
    const unregister = set_input_frame_handler(frame, (type, input) => {
      const event = { key: input.key, code: input.code ?? '', repeat: input.repeat ?? false };
      if (type === 'keydown' ? frame.static_input.keydown(event) : frame.static_input.keyup(event)) return true;
      if (inputMethod && editor) {
        editor.checkComposition();
        if (inputMethod.key(type, input, editor.composition)) return true;
      }
      if (singleLine && input.key === 'Enter') {
        // Enter commits a single-line value instead of inserting a line break.
        if (type === 'keydown') void exit();
        return true;
      }
      if (input.source !== 'virtual') return editor?.physicalKey(type, input) ?? false;
      if (type === 'keyup') editor?.virtualKey(input);
      return true;
    });
    const reset = () => { editor?.resetModifiers(); };
    const lose = () => { editor?.checkComposition(); };
    textarea.addEventListener('pointerup', lose);
    textarea.addEventListener('scroll', syncBackdrop);
    window.addEventListener('blur', reset);
    return () => { mounted = false; unregister(); textarea.removeEventListener('pointerup', lose); textarea.removeEventListener('scroll', syncBackdrop); window.removeEventListener('blur', reset); editor?.destroy(); };
  });
  onDestroy(() => frame.dispose());
</script>

<div class="keyflow-textbox {className}" class:single-line={singleLine}>
  {#if showEntry && !editing}
    <button type="button" bind:this={button} class="text-entry" aria-label={label}
      disabled={disabled || $active_input_frame !== parent}
      onclick={() => parent.trigger(enterTrigger === undefined ? automatic : entry)}>
      {#snippet content()}<span class="preview">{value || placeholder}</span>{/snippet}
      {#if enterTrigger === undefined}<ButtonDisplay token={automatic} children={content} />
      {:else if enterTrigger !== null}<StaticButtonDisplay token={entry} children={content} />
      {:else}{@render content()}{/if}
    </button>
  {/if}
  <section hidden={!editing} aria-label={`${label} editor`} class="editor-frame" class:composing={!!marked}>
    {#if inputMethod}
      <div class="composition-backdrop" aria-hidden="true" bind:this={backdrop}>{#if marked}{value.slice(0, marked.start)}<u class="keyflow-marked">{value.slice(marked.start, marked.end)}</u>{value.slice(marked.end)}{:else}{value}{/if}{'\n'}</div>
    {/if}
    <textarea bind:this={textarea} bind:value {...attributes} rows={singleLine ? 1 : rows} wrap={singleLine ? 'off' : wrap} {placeholder}
      disabled={disabled || !active} aria-label={label} aria-describedby={descriptionId}
      oninput={(event) => { if (singleLine && /[\r\n]/.test(value)) value = value.replace(/\r?\n|\r/g, ' '); oninput?.(event); syncBackdrop(); }}></textarea>
    <p id={descriptionId} class="editor-status" role="status">{`Exit with ${exitLabel}`}</p>
  </section>
</div>

<style>
  .keyflow-textbox { margin-block: .75rem; min-width: 0; }
  .text-entry { display: block; width: 100%; border: 1px solid currentColor; padding: .5rem; text-align: left; font: inherit; }
  .preview { white-space: pre-wrap; overflow-wrap: anywhere; }
  textarea { display: block; width: 100%; box-sizing: border-box; min-height: 5rem; padding: .5rem;
    border: 1px solid currentColor; border-radius: .25rem; background: var(--background, #fff); color: var(--primary, #111); font: inherit; line-height: 1.5; }
  .editor-frame { position: relative; }
  /* The backdrop mirrors the textarea's text box exactly; only the marked range is visible through it. */
  .composition-backdrop { position: absolute; z-index: 1; overflow: hidden; pointer-events: none; border-style: solid;
    border-color: transparent; white-space: pre-wrap; overflow-wrap: break-word; color: transparent; background: none; }
  .composition-backdrop :global(.keyflow-marked) { text-decoration: underline 2px; text-underline-offset: .18em; color: transparent;
    text-decoration-color: var(--primary, currentColor); }
  .editor-status { font-size: .85em; margin: .25rem 0; line-height: 1.4; }
  /* Single-line boxes sit inline at one min-box of height, like buttons. */
  .single-line { display: inline-block; margin-block: 0; vertical-align: middle; }
  .single-line .text-entry { display: inline-block; width: auto; min-width: 4ch; padding: 0 .4ch; line-height: var(--min-box); white-space: nowrap; }
  .single-line .preview { white-space: pre; }
  .single-line textarea { display: inline-block; width: var(--textbox-width, 16ch); min-height: 0; height: var(--min-box); padding: 0 .4ch;
    line-height: var(--min-box); resize: none; overflow: hidden; white-space: pre; }
  .single-line .editor-status { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); margin: 0; }
</style>
