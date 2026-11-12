<script lang="ts">
  import { onDestroy, onMount, tick, untrack } from 'svelte';
  import { readable } from 'svelte/store';
  import type { HTMLTextareaAttributes } from 'svelte/elements';
  import { create_input_frame, input_frame_manager, active_input_frame, type InputFrameController } from '../input-frames.js';
  import { get_input_frame } from '../input-frame-context.js';
  import { set_input_frame_handler, press_virtual_key } from '../input-events.js';
  import { create_static_token } from '../stores/static-input.js';
  import type { InputToken } from '../stores/input.js';
  import { normalize_event_key, type Shortcut } from '../shortcuts.js';
  import { TextareaEditor, type TextEditCommand } from '../text-editor.js';
  import ButtonDisplay from './ButtonDisplay.svelte';
  import StaticButtonDisplay from './StaticButtonDisplay.svelte';

  let { value = $bindable(''), enterTrigger, exitTrigger = 'escape', priority = 0,
    label = 'Text input', placeholder = 'Click to edit', rows = 4, disabled = false,
    wrap = 'off', class: className = '', onenter, onexit, oninput, onclipboarderror, ...attributes }: {
    value?: string; enterTrigger?: Shortcut; exitTrigger?: Shortcut; priority?: number;
    label?: string; placeholder?: string; rows?: number; disabled?: boolean;
    wrap?: 'soft' | 'hard' | 'off'; class?: string;
    onenter?: (frame: InputFrameController) => void; onexit?: (value: string) => void;
    oninput?: (event: Event) => void; onclipboarderror?: (error: unknown) => void;
  } & Omit<HTMLTextareaAttributes, 'value' | 'children' | 'oninput' | 'class' | 'wrap'> = $props();

  const parent = get_input_frame();
  const frame = create_input_frame({ name: 'textbox' });
  const stack = input_frame_manager.stack;
  const entry = create_static_token(begin);
  const automatic: InputToken = { priority: 0, on_close: begin };
  const exitToken = create_static_token(exit);
  const descriptionId = $props.id();
  let textarea: HTMLTextAreaElement;
  let button = $state<HTMLButtonElement>();
  let editor = $state.raw<TextareaEditor>();
  let message = $state('');
  let editing = $derived($stack.includes(frame));
  let active = $derived($active_input_frame === frame);
  const idleModifiers = readable({ shift: false, caps: false, control: false, meta: false, alt: false });
  let modifiers = $derived(editor?.modifiers ?? idleModifiers);
  const exitDescription = exitToken.description;
  let exitLabel = $derived($exitDescription.label);

  async function begin() {
    if (disabled || $active_input_frame !== parent || editing) return;
    message = '';
    editor?.resetModifiers();
    input_frame_manager.push(frame);
    await tick();
    if ($active_input_frame === frame) {
      focusEditor();
      onenter?.(frame);
    }
  }
  async function exit() {
    if ($active_input_frame !== frame) return;
    editor?.resetModifiers();
    frame.deactivate();
    await tick();
    if ($active_input_frame === parent) button?.focus({ preventScroll: true });
  }
  function focusEditor() {
    textarea.focus({ preventScroll: true });
    textarea.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  function refocus(event: FocusEvent) {
    const next = event.relatedTarget;
    if (next instanceof HTMLElement && next.closest('.keyflow-keyboard, .editor-toolbar')) return;
    // Clicking elsewhere never exits editing. A pushed child frame can temporarily take focus.
    queueMicrotask(() => { if ($active_input_frame === frame) focusEditor(); });
  }
  function command(action: TextEditCommand) {
    if (active) { message = ''; editor?.command(action); }
  }

  $effect(() => {
    const trigger = enterTrigger;
    const order = priority;
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
    textarea.setSelectionRange(value.length, value.length);
    editor = new TextareaEditor(textarea, {
      isActive: () => $active_input_frame === frame,
      onClipboardError(error) {
        message = 'Clipboard access failed. Use your device’s copy or paste command.';
        onclipboarderror?.(error);
      }
    });
    const unregister = set_input_frame_handler(frame, (type, input) => {
      const event = { key: input.key, code: input.code ?? '', repeat: input.repeat ?? false };
      if (type === 'keydown' ? frame.static_input.keydown(event) : frame.static_input.keyup(event)) return true;
      if (input.source !== 'virtual') {
        if (document.activeElement === textarea) return editor?.physicalKey(type, input) ?? false;
        const key = normalize_event_key(input.key);
        // Keep native button activation and Tab navigation available on focused keyboard controls.
        const native = editor?.physicalKey(key === 'tab' ? 'keyup' : type, input) ?? false;
        if (native) return true;
        if (type === 'keydown' && !['enter', 'space', 'tab', 'shift', 'control', 'meta', 'alt', 'capslock'].includes(key)) {
          focusEditor();
          editor?.virtualKey(input);
          return true;
        }
        return false;
      }
      if (type === 'keyup') editor?.virtualKey(input);
      return true;
    });
    const reset = () => editor?.resetModifiers();
    window.addEventListener('blur', reset);
    return () => { unregister(); window.removeEventListener('blur', reset); editor?.destroy(); };
  });
  onDestroy(() => frame.dispose());
</script>

<div class="keyflow-textbox {className}">
  {#if !editing}
    <button type="button" bind:this={button} class="text-entry" aria-label={label}
      disabled={disabled || $active_input_frame !== parent}
      onclick={() => parent.trigger(enterTrigger === undefined ? automatic : entry)}>
      {#snippet content()}<span class="preview">{value || placeholder}</span>{/snippet}
      {#if enterTrigger === undefined}<ButtonDisplay token={automatic} children={content} />
      {:else}<StaticButtonDisplay token={entry} children={content} />{/if}
    </button>
  {/if}
  <section hidden={!editing} aria-label={`${label} editor`}>
    <div class="editor-toolbar" role="toolbar" aria-label={`${label} editing tools`}>
      {#each ['copy', 'cut', 'paste', 'undo', 'redo', 'selectAll'] as action}
        <button type="button" disabled={!active} onpointerdown={(event) => event.preventDefault()}
          onclick={() => command(action as TextEditCommand)}>{action === 'selectAll' ? 'Select all' : action[0].toUpperCase() + action.slice(1)}</button>
      {/each}
      <button type="button" disabled={!active} aria-pressed={$modifiers.shift}
        onpointerdown={(event) => event.preventDefault()} onclick={() => press_virtual_key('shift')}>Shift</button>
      <button type="button" disabled={!active} onpointerdown={(event) => event.preventDefault()}
        onclick={() => press_virtual_key('enter')}>Enter</button>
    </div>
    <textarea bind:this={textarea} bind:value {...attributes} {rows} {wrap} {placeholder}
      disabled={disabled || !active} aria-label={label} aria-describedby={descriptionId}
      onblur={refocus} oninput={(event) => oninput?.(event)}></textarea>
    <p id={descriptionId} class="editor-status" role="status">{message || `Exit with ${exitLabel}`}</p>
  </section>
</div>

<style>
  .keyflow-textbox { margin-block: .75rem; min-width: 0; }
  .text-entry { display: block; width: 100%; border: 1px solid currentColor; padding: .5rem; text-align: left; font: inherit; }
  .preview { white-space: pre-wrap; overflow-wrap: anywhere; }
  textarea { display: block; width: 100%; box-sizing: border-box; min-height: 5rem; padding: .5rem;
    border: 1px solid currentColor; border-radius: .25rem; background: var(--background, #fff); color: var(--primary, #111); font: inherit; line-height: 1.5; }
  .editor-toolbar { display: flex; flex-wrap: wrap; gap: .4rem; margin-bottom: .4rem; }
  .editor-toolbar button { font: inherit; line-height: 1.4; border: 1px solid currentColor; padding: .2rem .4rem; border-radius: .2rem; text-transform: capitalize; }
  button[aria-pressed="true"] { background: var(--primary, #111); color: var(--background, #fff); }
  .editor-status { font-size: .85em; margin: .25rem 0; line-height: 1.4; }
</style>
