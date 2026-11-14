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
  import ButtonDisplay from './ButtonDisplay.svelte';
  import StaticButtonDisplay from './StaticButtonDisplay.svelte';

  let { value = $bindable(''), enterTrigger, exitTrigger = 'escape', priority = 0, showEntry = true,
    label = 'Text input', placeholder = 'Click to edit', rows = 4, disabled = false,
    wrap = 'soft', class: className = '', onenter, onexit, oninput, ...attributes }: {
    value?: string; enterTrigger?: Shortcut | null; exitTrigger?: Shortcut; priority?: number;
    /** Hide the built-in entry button when supplying your own opener. */
    showEntry?: boolean;
    label?: string; placeholder?: string; rows?: number; disabled?: boolean;
    wrap?: 'soft' | 'hard' | 'off'; class?: string;
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
    editor?.resetModifiers();
    frame.deactivate();
    await tick();
    if (mounted && $active_input_frame === parent) {
      const target = opener?.isConnected && opener !== document.body ? opener : button;
      if (target) target.focus({ preventScroll: true });
      else if (document.activeElement === textarea) textarea.blur();
    }
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
    const unregister = set_input_frame_handler(frame, (type, input) => {
      const event = { key: input.key, code: input.code ?? '', repeat: input.repeat ?? false };
      if (type === 'keydown' ? frame.static_input.keydown(event) : frame.static_input.keyup(event)) return true;
      if (input.source !== 'virtual') return editor?.physicalKey(type, input) ?? false;
      if (type === 'keyup') editor?.virtualKey(input);
      return true;
    });
    const reset = () => editor?.resetModifiers();
    window.addEventListener('blur', reset);
    return () => { mounted = false; unregister(); window.removeEventListener('blur', reset); editor?.destroy(); };
  });
  onDestroy(() => frame.dispose());
</script>

<div class="keyflow-textbox {className}">
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
  <section hidden={!editing} aria-label={`${label} editor`}>
    <textarea bind:this={textarea} bind:value {...attributes} {rows} {wrap} {placeholder}
      disabled={disabled || !active} aria-label={label} aria-describedby={descriptionId}
      oninput={(event) => oninput?.(event)}></textarea>
    <p id={descriptionId} class="editor-status" role="status">{`Exit with ${exitLabel}`}</p>
  </section>
</div>

<style>
  .keyflow-textbox { margin-block: .75rem; min-width: 0; }
  .text-entry { display: block; width: 100%; border: 1px solid currentColor; padding: .5rem; text-align: left; font: inherit; }
  .preview { white-space: pre-wrap; overflow-wrap: anywhere; }
  textarea { display: block; width: 100%; box-sizing: border-box; min-height: 5rem; padding: .5rem;
    border: 1px solid currentColor; border-radius: .25rem; background: var(--background, #fff); color: var(--primary, #111); font: inherit; line-height: 1.5; }
  .editor-status { font-size: .85em; margin: .25rem 0; line-height: 1.4; }
</style>
