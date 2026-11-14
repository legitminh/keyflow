<script lang="ts">
  import { onMount, onDestroy, tick, untrack, type Snippet } from 'svelte';
  import { get } from 'svelte/store';
  import { active_input_frame, create_input_frame, input_frame_manager } from '../input-frames.js';
  import { get_input_frame } from '../input-frame-context.js';
  import { create_static_token } from '../stores/static-input.js';
  import { input_token_interaction, type InteractionHandlers } from '../interaction.js';
  import type { InputToken } from '../stores/input.js';
  import type { Shortcut } from '../shortcuts.js';
  import type { SubKeyframeContext, SubKeyframeItem } from '../subkeyframe.js';
  import { interaction } from '../actions/interaction.js';
  import InputFrame from './InputFrame.svelte';
  import Button from './Button.svelte';
  import StaticButton from './StaticButton.svelte';
  import ButtonDisplay from './ButtonDisplay.svelte';
  import StaticButtonDisplay from './StaticButtonDisplay.svelte';
  import SubKeyframe from './SubKeyframe.svelte';

  let { label = 'Menu', items = [], children, triggerContent, itemDisplay,
    enterTrigger, exitTrigger = 'escape', priority = 0, open = $bindable(false),
    disabled = false, showTrigger = true, closeOnSelect = true, closeOnOutside = true,
    backLabel = 'Back', onopen, onclose, onselect, class: className = '',
    on_pressed_down, on_pressed_up, on_cursor_enter, on_cursor_exit, on_enter, on_exit
  }: {
    label?: string; items?: readonly SubKeyframeItem[];
    /** Custom controls are automatically registered in this menu's frame. */
    children?: Snippet<[SubKeyframeContext]>;
    triggerContent?: Snippet<[SubKeyframeContext]>;
    itemDisplay?: Snippet<[SubKeyframeItem, SubKeyframeContext]>;
    enterTrigger?: Shortcut | null; exitTrigger?: Shortcut | null; priority?: number;
    open?: boolean; disabled?: boolean; showTrigger?: boolean;
    closeOnSelect?: boolean; closeOnOutside?: boolean; backLabel?: string;
    onopen?: (context: SubKeyframeContext) => void;
    onclose?: (context: SubKeyframeContext) => void;
    onselect?: (item: SubKeyframeItem, context: SubKeyframeContext) => void;
    class?: string;
  } & InteractionHandlers = $props();

  const parent = get_input_frame();
  const initialName = () => label;
  export const frame = create_input_frame({ name: initialName() });
  const stack = input_frame_manager.stack;
  const panelId = $props.id();
  let root: HTMLDivElement;
  let panel = $state<HTMLElement>();
  let trigger = $state<HTMLButtonElement>();
  let opener: HTMLElement | undefined;
  let mounted = $state(false);
  let unsubscribe: (() => void) | undefined;
  let included = false;
  let restoreOnClose = true;
  const active = $derived($active_input_frame === frame);
  const handlers = () => ({ on_pressed_down, on_pressed_up, on_cursor_enter, on_cursor_exit, on_enter, on_exit });
  const entry = create_static_token(() => { void enter(); });
  const automatic: InputToken = { priority: 0, on_close: () => { void enter(); } };
  const back = create_static_token(exit);
  // Forward through live getters without causing registration churn when handlers change.
  for (const token of [entry, automatic]) {
    for (const key of ['on_pressed_down', 'on_pressed_up', 'on_cursor_enter', 'on_cursor_exit', 'on_enter', 'on_exit'] as const) {
      Object.defineProperty(token, key, { get: () => handlers()[key], configurable: true });
    }
  }
  const triggerToken = $derived(enterTrigger === undefined ? automatic : entry);
  const context: SubKeyframeContext = {
    frame, get active() { return active; }, get open() { return open; }, enter, exit, toggle, select
  };

  /** Open only from the active parent frame. Repeated entry is harmless. */
  export async function enter() {
    if (!mounted || disabled || included || get(active_input_frame) !== parent) return;
    opener = trigger ?? (document.activeElement instanceof HTMLElement && document.activeElement !== document.body
      ? document.activeElement : undefined);
    frame.activate();
    await tick();
  }
  /** Unwind this menu and any nested frames, returning to its previous frame. */
  export function exit() { if (mounted && included) frame.deactivate(); }
  export async function toggle() { if (included) exit(); else await enter(); }

  function select(item: SubKeyframeItem) {
    if (!active || item.disabled || item.items) return;
    if (item.closeOnSelect ?? closeOnSelect) exit();
    item.on_select?.(item, context);
    onselect?.(item, context);
  }
  function focusable() {
    return [...(panel?.querySelectorAll<HTMLElement>('button, a[href], input, textarea, select, [tabindex]') ?? [])]
      .filter((node) => !node.matches(':disabled') && node.tabIndex >= 0 && node.getClientRects().length > 0);
  }
  function navigate(event: KeyboardEvent) {
    if (!active || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey ||
        !panel?.contains(event.target as Node)) return;
    const target = event.target as HTMLElement;
    if (target.isContentEditable || target.matches('input, textarea, select')) return;
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const nodes = focusable();
    if (!nodes.length) return;
    event.preventDefault();
    const index = nodes.indexOf(target);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? nodes.length - 1
      : (index + (event.key === 'ArrowDown' ? 1 : -1) + nodes.length) % nodes.length;
    nodes[next].focus({ preventScroll: true });
  }
  function outside(event: MouseEvent) {
    if (!event.isTrusted || !closeOnOutside || !included || event.button !== 0 || event.composedPath().includes(root)) return;
    // Capture the click after its target is fixed, before its action runs. This
    // preserves outside actions and lets them open another frame from the parent.
    restoreOnClose = false;
    exit();
  }

  $effect(() => {
    const keys = enterTrigger;
    const order = priority;
    if (disabled || keys === null) return;
    untrack(() => parent.update(automatic, order));
    return untrack(() => keys === undefined ? parent.register(automatic) : parent.static_input.register(entry, keys));
  });
  $effect(() => {
    const keys = exitTrigger;
    if (open && keys !== null) return untrack(() => frame.static_input.register(back, keys));
  });
  $effect(() => {
    const requested = open;
    const unavailable = disabled;
    if (!mounted) return;
    untrack(() => {
      if (unavailable || !requested) exit();
      else if (!included) {
        if (get(active_input_frame) === parent) void enter();
        else open = false;
      }
    });
  });

  onMount(() => {
    const initiallyOpen = open;
    mounted = true;
    window.addEventListener('click', outside, true);
    unsubscribe = stack.subscribe((frames) => untrack(() => {
      const next = frames.includes(frame);
      const changed = next !== included;
      included = next;
      open = next;
      if (!changed) return;
      if (next) {
        onopen?.(context);
        void tick().then(() => {
          if (mounted && get(active_input_frame) === frame) (focusable()[0] ?? panel)?.focus({ preventScroll: true });
        });
      } else {
        const restore = restoreOnClose;
        restoreOnClose = true;
        onclose?.(context);
        void tick().then(() => {
          if (restore && mounted && !included && get(active_input_frame) === parent && opener?.isConnected && !disabled) opener.focus({ preventScroll: true });
        });
      }
    }));
    if (initiallyOpen) void enter();
    return () => window.removeEventListener('click', outside, true);
  });
  onDestroy(() => {
    mounted = false;
    frame.dispose();
    unsubscribe?.();
  });
</script>

<svelte:window onkeydown={navigate} />
<div class="keyflow-subkeyframe {className}" bind:this={root}>
  {#if showTrigger}
    <button type="button" class="subkeyframe-trigger" bind:this={trigger} aria-label={label}
      aria-expanded={open} aria-controls={panelId} disabled={disabled || (!open && $active_input_frame !== parent)}
      use:interaction={{ controller: input_token_interaction(triggerToken), disabled: disabled || (!open && $active_input_frame !== parent) }}
      onclick={() => { if (included) exit(); else parent.trigger(triggerToken, false); }}>
      {#snippet caption()}{#if triggerContent}{@render triggerContent(context)}{:else}{label}{/if}{/snippet}
      {#if enterTrigger === undefined}<ButtonDisplay token={automatic} children={caption} />
      {:else if enterTrigger !== null}<StaticButtonDisplay token={entry} children={caption} />
      {:else}{@render caption()}{/if}
    </button>
  {/if}
  <InputFrame {frame}>
    {#if open}
      <section id={panelId} class="subkeyframe-panel" aria-label={label} tabindex="-1" bind:this={panel}>
        {#if items.length}
          <ul class="subkeyframe-items">
            {#each items as item (item.id ?? item)}
              <li>
                {#snippet content()}{#if itemDisplay}{@render itemDisplay(item, context)}{:else}{item.label}{/if}{/snippet}
                {#if item.items}
                  <SubKeyframe label={item.label} items={item.items} enterTrigger={item.keys} disabled={item.disabled}
                    {exitTrigger} closeOnSelect={item.closeOnSelect ?? closeOnSelect} {closeOnOutside} {backLabel} {onselect} {itemDisplay} triggerContent={content}
                    on_pressed_down={item.on_pressed_down} on_pressed_up={item.on_pressed_up}
                    on_cursor_enter={item.on_cursor_enter} on_cursor_exit={item.on_cursor_exit}
                    on_enter={item.on_enter} on_exit={item.on_exit} />
                {:else if item.keys !== undefined}
                  <StaticButton {...item} keys={item.keys} on_close={() => select(item)} children={content} />
                {:else}
                  <Button {...item} on_close={() => select(item)} children={content} />
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
        {@render children?.(context)}
        <button type="button" class="subkeyframe-back" disabled={!active}
          use:interaction={{ controller: input_token_interaction(back), disabled: !active }}
          onclick={() => frame.trigger(back, false)}>
          {#snippet backContent()}{backLabel}{/snippet}
          {#if exitTrigger !== null}<StaticButtonDisplay token={back} children={backContent} />{:else}{backLabel}{/if}
        </button>
      </section>
    {/if}
  </InputFrame>
</div>

<style>
  .keyflow-subkeyframe { display: inline-block; position: relative; }
  .subkeyframe-panel { display: flex; flex-direction: column; gap: .5rem; padding: .5rem; border: 1px solid currentColor; background: var(--background, #fff); }
  .subkeyframe-items { display: flex; flex-direction: column; gap: .25rem; list-style: none; margin: 0; padding: 0; }
  .subkeyframe-items :global(button), .subkeyframe-back { text-align: start; }
</style>
