<script lang="ts">
  import { onDestroy, onMount, tick, untrack } from 'svelte';
  import type { HTMLTextareaAttributes } from 'svelte/elements';
  import { create_input_frame, input_frame_manager, active_input_frame, type InputFrameController } from '../input-frames.js';
  import { get_input_frame } from '../input-frame-context.js';
  import { set_input_frame_handler } from '../input-events.js';
  import { create_static_token } from '../stores/static-input.js';
  import type { InputToken } from '../stores/input.js';
  import type { Shortcut } from '../shortcuts.js';
  import { normalize_event_key } from '../shortcuts.js';
  import { TextareaEditor } from '../text-editor.js';
  import type { MarkedRange, TextComposition, TextInputMethod } from '../text-input-method.js';
  import ButtonDisplay from './ButtonDisplay.svelte';
  import StaticButtonDisplay from './StaticButtonDisplay.svelte';

  let { value = $bindable(''), enterTrigger, exitTrigger = 'escape', priority = 0, showEntry = true,
    label = 'text input', placeholder = 'click to edit', rows = 4, disabled = false,
    wrap = 'soft', singleLine = false, exitOnClickOutside = false, exitOnShiftEnter = true,
    inputMethod, class: className = '', onenter, onexit, oninput, ...attributes }: {
    value?: string; enterTrigger?: Shortcut | null; exitTrigger?: Shortcut; priority?: number;
    /** Hide the built-in entry button when supplying your own opener. */
    showEntry?: boolean;
    label?: string; placeholder?: string; rows?: number; disabled?: boolean;
    wrap?: 'soft' | 'hard' | 'off'; class?: string;
    /** One line of text: Enter (physical or virtual) finishes editing and pasted line breaks become spaces. */
    singleLine?: boolean;
    /** Finish editing when clicking or tapping outside. Default false. */
    exitOnClickOutside?: boolean;
    /** Finish editing with physical or virtual Shift+Enter. Default true. */
    exitOnShiftEnter?: boolean;
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
  let container: HTMLDivElement;
  let textarea: HTMLTextAreaElement;
  let button = $state<HTMLButtonElement>();
  let editor = $state.raw<TextareaEditor>();
  let marked = $state<MarkedRange | null>(null);
  let backdrop = $state<HTMLDivElement>();
  let mounted = false;
  let opener: HTMLElement | undefined;
  let entryRevision = 0;
  let editing = $derived($stack.includes(frame));
  let active = $derived($active_input_frame === frame);
  const exitDescription = exitToken.description;
  let exitLabel = $derived($exitDescription.label);
  let exitHint = $derived(`Exit with ${[exitLabel, ...(singleLine ? ['Enter'] : []),
    ...(exitOnShiftEnter && !singleLine ? ['Shift+Enter'] : []), ...(exitOnClickOutside ? ['click outside'] : [])].join(' or ')}`);

  /** Enter from any client control in this textbox's parent InputFrame. */
  export async function enter() {
    if (!mounted || disabled || $active_input_frame !== parent || editing) return;
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    editor?.resetModifiers();
    entryRevision++;
    input_frame_manager.push(frame);
    await tick();
    if (mounted && $active_input_frame === frame) {
      focusEditor();
      onenter?.(frame);
    }
  }
  /** Exit the topmost editing frame, preserving the value and restoring opener focus. */
  export async function exit() {
    await closeEditing(true);
  }
  async function closeEditing(restoreFocus: boolean) {
    if (!mounted || $active_input_frame !== frame) return;
    endComposition();
    editor?.resetModifiers();
    frame.deactivate();
    await tick();
    if (restoreFocus && mounted && $active_input_frame === parent) {
      const target = opener?.isConnected && opener !== document.body ? opener : button;
      if (target) target.focus({ preventScroll: true });
      else if (document.activeElement === textarea) textarea.blur();
    }
  }
  function outsideClick(event: MouseEvent) {
    if (!exitOnClickOutside || $active_input_frame !== frame) return;
    const path = event.composedPath();
    if (path.includes(container) || path.some((node) => node instanceof Element && node.hasAttribute('data-keyflow-textbox-keep-open'))) return;
    // Capture the frame before the target runs, then let its action finish first. Opening a
    // child frame must suspend this editor; an entry click must not immediately close it.
    const revision = entryRevision;
    setTimeout(() => {
      if (mounted && exitOnClickOutside && entryRevision === revision && $active_input_frame === frame) void closeEditing(false);
    }, 0);
  }
  function disabledPointerUp(event: PointerEvent) {
    // Disabled controls do not emit click. Wait until the pointer's entire activation has
    // finished so re-enabling the parent cannot turn dismissal into a click-through action.
    if (event.composedPath().some((node) => node instanceof Element && node.matches(':disabled'))) outsideClick(event);
  }
  /**
   * Edit the text from client controls (a suggestion bar, a toolbar) with the same
   * composition API an input method uses, so the change joins native undo history.
   */
  export function edit(change: (composition: TextComposition) => void) {
    if (!editor) return false;
    editor.checkComposition();
    change(editor.composition);
    if (editing) focusEditor();
    return true;
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
    if (singleLine && /[\r\n]/.test(value)) value = value.replace(/\r\n?|\n/g, ' ');
  });
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
      if (input.source !== 'virtual') editor?.physicalKey(type, input);
      const event = { key: input.key, code: input.code ?? '', repeat: input.repeat ?? false };
      if (type === 'keydown' ? frame.static_input.keydown(event) : frame.static_input.keyup(event)) return true;
      if (normalize_event_key(input.key) === 'enter' && (singleLine || (exitOnShiftEnter && (input.shiftKey || editor?.shiftKey)))) {
        // Catch both phases before an input method or virtual adapter can insert a newline.
        if (type === 'keydown') void exit();
        return true;
      }
      if (inputMethod && editor) {
        editor.checkComposition();
        if (inputMethod.key(type, input, editor.composition)) return true;
      }
      if (input.source !== 'virtual') return false;
      if (type === 'keyup') editor?.virtualKey(input);
      return true;
    });
    const reset = () => { editor?.resetModifiers(); };
    const lose = () => { editor?.checkComposition(); };
    textarea.addEventListener('pointerup', lose);
    textarea.addEventListener('scroll', syncBackdrop);
    window.addEventListener('blur', reset);
    document.addEventListener('click', outsideClick, true);
    document.addEventListener('pointerup', disabledPointerUp, true);
    return () => { mounted = false; unregister(); textarea.removeEventListener('pointerup', lose); textarea.removeEventListener('scroll', syncBackdrop); window.removeEventListener('blur', reset); document.removeEventListener('click', outsideClick, true); document.removeEventListener('pointerup', disabledPointerUp, true); editor?.destroy(); };
  });
  onDestroy(() => frame.dispose());
</script>

<div bind:this={container} class="keyflow-textbox {className}" class:single-line={singleLine}>
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
      oninput={(event) => {
        const target = event.currentTarget;
        if (singleLine) target.value = target.value.replace(/\r\n?|\n/g, ' ');
        value = target.value;
        oninput?.(event);
        syncBackdrop();
      }}></textarea>
    <p id={descriptionId} class="editor-status" role="status">{exitHint}</p>
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
