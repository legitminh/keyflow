<script lang="ts">
  import { onMount, onDestroy, tick, untrack, type Snippet } from 'svelte';
  import { get } from 'svelte/store';
  import { SvelteSet } from 'svelte/reactivity';
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
  import Camera from './scroll/vertical/Camera.svelte';
  import ScrollIndicator from './scroll/vertical/ScrollIndicator.svelte';
  import { visibility } from '../actions/visibility.js';
  import { observe_viewports, refresh_viewports, usable_viewport } from '../viewport.js';
  import StaticButton from './StaticButton.svelte';
  import ButtonDisplay from './ButtonDisplay.svelte';
  import StaticButtonDisplay from './StaticButtonDisplay.svelte';
  import SubKeyframe from './SubKeyframe.svelte';

  let { label = 'Menu', items = [], children, triggerContent, itemDisplay,
    enterTrigger, exitTrigger = 'escape', priority = 0, open = $bindable(false),
    disabled = false, registered = true, showTrigger = true, closeOnSelect = true, closeOnOutside = true,
    backLabel = 'Back', presentation = 'inline', onopen, onclose, onselect, class: className = '',
    on_pressed_down, on_pressed_up, on_cursor_enter, on_cursor_exit, on_enter, on_exit
  }: {
    label?: string; items?: readonly SubKeyframeItem[];
    /** Custom controls are automatically registered in this menu's frame. */
    children?: Snippet<[SubKeyframeContext]>;
    triggerContent?: Snippet<[SubKeyframeContext]>;
    itemDisplay?: Snippet<[SubKeyframeItem, SubKeyframeContext]>;
    enterTrigger?: Shortcut | null; exitTrigger?: Shortcut | null; priority?: number;
    open?: boolean; disabled?: boolean; registered?: boolean; showTrigger?: boolean;
    closeOnSelect?: boolean; closeOnOutside?: boolean; backLabel?: string;
    /**
     * `inline` opens the menu in place. `overlay` stacks it over the whole page like
     * another page: it fills the viewport, scrolls vertically when long, and blocks
     * the page underneath until a choice, Back or Escape.
     */
    presentation?: 'inline' | 'overlay';
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
  let triggerVisible = $state(false);
  let unsubscribe: (() => void) | undefined;
  let included = false;
  let restoreOnClose = true;
  const visibleItems = new SvelteSet<string | SubKeyframeItem>();
  let parentScroll: { node: HTMLElement; top: number; left: number } | undefined;
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
    const scroller = root.parentElement?.closest<HTMLElement>('[data-keyflow-scroll-viewport]');
    parentScroll = scroller ? { node: scroller, top: scroller.scrollTop, left: scroller.scrollLeft } : undefined;
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
      .filter((node) => !node.matches(':disabled') && !node.closest('[data-keyflow-scroll-controls]') && node.tabIndex >= 0 && node.getClientRects().length > 0);
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
    nodes[next].scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    refresh_viewports();
  }
  let layer = $state<HTMLDivElement>();
  /** Move the overlay to the document body so page transforms and overflow cannot clip it. */
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return { destroy: () => node.remove() };
  }
  function outside(event: MouseEvent) {
    if (!event.isTrusted || !closeOnOutside || !included || event.button !== 0 || presentation === 'overlay') return;
    const path = event.composedPath();
    if (path.includes(root) || (layer && path.includes(layer))) return;
    // Capture the click after its target is fixed, before its action runs. This
    // preserves outside actions and lets them open another frame from the parent.
    restoreOnClose = false;
    exit();
  }

  $effect(() => {
    const keys = enterTrigger;
    const order = priority;
    if (disabled || !registered || keys === null || (keys === undefined && showTrigger && !triggerVisible)) return;
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
    const stop = observe_viewports(() => {
      if (!panel) return;
      const bounds = usable_viewport(panel);
      const available = Math.max(0, bounds.bottom - bounds.top);
      const height = available;
      const next = `${Math.floor(height)}px`;
      if (panel.style.maxHeight !== next) panel.style.maxHeight = next;
    });
    unsubscribe = stack.subscribe((frames) => untrack(() => {
      const next = frames.includes(frame);
      const changed = next !== included;
      included = next;
      open = next;
      if (!changed) return;
      if (next) {
        onopen?.(context);
        void tick().then(() => {
          if (mounted && get(active_input_frame) === frame) { refresh_viewports(); panel?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' }); refresh_viewports(); const first = focusable()[0] ?? panel; first?.focus({ preventScroll: true }); first?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' }); refresh_viewports(); }
        });
      } else {
        const restore = restoreOnClose;
        restoreOnClose = true;
        onclose?.(context);
        void tick().then(() => {
          if (restore && mounted && !included && get(active_input_frame) === parent && opener?.isConnected && !disabled) {
            parentScroll?.node.scrollTo({ top: parentScroll.top, left: parentScroll.left, behavior: 'instant' });
            opener.focus({ preventScroll: true });
            refresh_viewports();
          }
        });
      }
    }));
    if (initiallyOpen) void enter();
    return () => { stop(); window.removeEventListener('click', outside, true); };
  });
  onDestroy(() => {
    mounted = false;
    frame.dispose();
    unsubscribe?.();
  });
</script>

<svelte:window onkeydown={navigate} />
{#snippet menu()}
  <section id={panelId} class="subkeyframe-panel" aria-label={label} tabindex="-1" bind:this={panel}>
    <Camera class="subkeyframe-viewport" worldClass="subkeyframe-world">
{#if presentation === 'overlay'}<p class="subkeyframe-title">{label}</p>{/if}
    {#if items.length}
      <ul class="subkeyframe-items">
        {#each items as item (item.id ?? item)}
          <li use:visibility={{ onFullyVisible: () => visibleItems.add(item.id ?? item), onHidden: () => visibleItems.delete(item.id ?? item) }}>
            {#snippet content()}{#if itemDisplay}{@render itemDisplay(item, context)}{:else}{item.label}{/if}{/snippet}
            {#if item.items}
              <SubKeyframe label={item.label} items={item.items} enterTrigger={item.keys} disabled={item.disabled} registered={visibleItems.has(item.id ?? item)}
                {exitTrigger} closeOnSelect={item.closeOnSelect ?? closeOnSelect} {closeOnOutside} {backLabel} {presentation} {onselect} {itemDisplay} triggerContent={content}
                on_pressed_down={item.on_pressed_down} on_pressed_up={item.on_pressed_up}
                on_cursor_enter={item.on_cursor_enter} on_cursor_exit={item.on_cursor_exit}
                on_enter={item.on_enter} on_exit={item.on_exit} />
            {:else if item.keys !== undefined}
              <StaticButton {...item} registered={visibleItems.has(item.id ?? item)} keys={item.keys} on_close={() => select(item)} children={content} />
            {:else}
              <Button {...item} registered={visibleItems.has(item.id ?? item)} on_close={() => select(item)} children={content} />
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
    </Camera>
    <ScrollIndicator />
  </section>
{/snippet}

<div class="keyflow-subkeyframe {className}" bind:this={root}>
  {#if showTrigger}
    <button type="button" class="subkeyframe-trigger" bind:this={trigger} aria-label={label}
      aria-expanded={open} aria-controls={panelId} disabled={disabled || (!open && $active_input_frame !== parent)}
      use:visibility={{ onFullyVisible: () => triggerVisible = true, onHidden: () => triggerVisible = false }}
      use:interaction={{ controller: input_token_interaction(triggerToken), disabled: disabled || (!open && $active_input_frame !== parent) }}
      onclick={() => { if (included) exit(); else parent.trigger(triggerToken, false); }}>
      {#snippet caption()}{#if triggerContent}{@render triggerContent(context)}{:else}{label}{/if}{/snippet}
      {#if enterTrigger === undefined}<ButtonDisplay token={automatic} children={caption} />
      {:else if enterTrigger !== null}<StaticButtonDisplay token={entry} children={caption} />
      {:else}{@render caption()}{/if}
    </button>
  {/if}
  <InputFrame {frame}>
    {#if open && presentation === 'overlay'}
      <div class="subkeyframe-overlay" bind:this={layer} use:portal>{@render menu()}</div>
    {:else if open}
      {@render menu()}
    {/if}
  </InputFrame>
</div>

<style>
  .keyflow-subkeyframe { display: inline-block; position: relative; }
  .subkeyframe-panel { box-sizing: border-box; max-height: calc(100dvh - 1rem); overflow: hidden; display: flex; flex-direction: column; gap: .5rem; padding: .5rem; border: 1px solid currentColor; background: var(--background, #fff); }
  .subkeyframe-panel :global(.subkeyframe-world) { display: flex; flex-direction: column; gap: .5rem; }
  .subkeyframe-items { display: flex; flex-direction: column; gap: .25rem; list-style: none; margin: 0; padding: 0; }
  .subkeyframe-items :global(button), .subkeyframe-back { text-align: start; }
  /* Overlay: a page stacked over the page. Only vertical scrolling, never wider than the viewport. */
  :global(.subkeyframe-overlay) { position: fixed; inset: 0; z-index: 1000; display: flex; justify-content: center; align-items: flex-start;
    box-sizing: border-box; overflow: hidden; background: var(--background, #fff); overscroll-behavior: contain; }
  :global(.subkeyframe-overlay > .subkeyframe-panel) { width: min(100%, 40rem); max-width: 100%; border: 0; overflow-x: hidden;
    padding: calc(var(--min-box, 48px) / 2); }
  :global(.subkeyframe-overlay .subkeyframe-title) { margin: 0; font-weight: 700; }
  :global(.subkeyframe-overlay .subkeyframe-items button), :global(.subkeyframe-overlay .subkeyframe-back) { width: 100%; white-space: normal; overflow-wrap: anywhere; }
</style>
