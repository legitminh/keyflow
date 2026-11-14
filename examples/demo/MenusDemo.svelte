<script lang="ts">
  import { Keyflow, SubKeyframe, Button, TextBox, input_frame_manager,
    type SubKeyframeController, type SubKeyframeItem, type Shortcut } from '../../src/lib/index.js';
  import '../../src/lib/styles.css';
  let menu = $state<SubKeyframeController>();
  let tools = $state<SubKeyframeController>();
  let open = $state(new URLSearchParams(window.location.search).has('open'));
  let mounted = $state(true);
  let disabled = $state(false);
  let showTrigger = $state(true);
  let closeOnSelect = $state(true);
  let closeOnOutside = $state(true);
  let entryMode = $state('f');
  let exitTrigger = $state<Shortcut | null>('escape');
  let selected = $state('none');
  let entries = $state(0), exits = $state(0), selections = $state(0);
  let items = $state<SubKeyframeItem[]>([
    { id: 'new', label: 'New file' },
    { id: 'open', label: 'Open file', keys: 'o' },
    { id: 'disabled', label: 'Delete file', keys: 'x', disabled: true },
    { id: 'pin', label: 'Pin menu', keys: 'p', closeOnSelect: false },
    { id: 'more', label: 'More', keys: 'm', items: [
      { id: 'copy', label: 'Copy', keys: 'c' },
      { id: 'advanced', label: 'Advanced', keys: 'a', items: [{ id: 'archive', label: 'Archive' }] }
    ] }
  ]);
  const stack = input_frame_manager.stack;
  const enterTrigger = $derived(entryMode === 'auto' ? undefined : entryMode === 'none' ? null : entryMode);
</script>

<Keyflow options={{ lockstep: false }}>
  <main>
    <h1>Dropdowns and nested keyframes</h1>
    <p aria-label="Frame stack">{$stack.map((frame) => frame.name).join(' → ')}</p>
    <p aria-label="Selected item">{selected}</p>
    <p aria-label="Menu sessions">Entries: {entries}; exits: {exits}; selections: {selections}</p>
    <p aria-label="Open binding">{String(open)}</p>
    <div class="settings">
      <label><input type="checkbox" bind:checked={mounted} /> Mount menu</label>
      <label><input type="checkbox" bind:checked={disabled} /> Disable menu</label>
      <label><input type="checkbox" bind:checked={showTrigger} /> Show trigger</label>
      <label><input type="checkbox" bind:checked={closeOnSelect} /> Close on select</label>
      <label><input type="checkbox" bind:checked={closeOnOutside} /> Close on outside</label>
      <label>Entry key <select bind:value={entryMode}><option value="f">F</option><option value="auto">Automatic</option><option value="none">Pointer/API only</option></select></label>
      <label>Exit key <select bind:value={exitTrigger}><option value="escape">Escape</option><option value="F2">F2</option><option value={null}>Back button only</option></select></label>
    </div>
    <div class="settings">
      <button onclick={() => { void menu?.enter(); }}>Open through API</button>
      <button onclick={() => menu?.exit()}>Close through API</button>
      <button onclick={() => open = !open}>Toggle binding</button>
      <button onclick={() => input_frame_manager.pop()}>Pop frame externally</button>
      <button onclick={() => items = [...items, { id: 'added', label: 'Added item', keys: 'z' }]}>Add item</button>
      <button onclick={() => items = items.filter((item) => item.id !== 'open')}>Remove item</button>
    </div>
    {#if mounted}
      <SubKeyframe bind:this={menu} bind:open label="File" {items} {disabled} {showTrigger} {enterTrigger} {exitTrigger} {closeOnSelect} {closeOnOutside}
        onopen={() => entries++} onclose={() => exits++}
        onselect={(item) => { selected = item.label; selections++; }}>
        {#snippet children(context)}
          <Button on_close={() => context.select({ label: 'Custom action' })}>Custom action</Button>
          <SubKeyframe label="Custom submenu" enterTrigger="u">
            {#snippet children(child)}
              <Button on_close={child.exit}>Close custom submenu</Button>
              <TextBox enterTrigger="t" label="Menu notes" />
            {/snippet}
          </SubKeyframe>
        {/snippet}
      </SubKeyframe>
    {/if}
    <SubKeyframe bind:this={tools} label="Tools" enterTrigger="t" items={[{ label: 'Tool action' }]} />
    <button onclick={() => { void tools?.enter(); }}>Open tools externally</button>
    <button class="outside" onclick={() => selected = 'outside'}>Outside action</button>
  </main>
</Keyflow>

<style>
  main { padding: 1rem; font: 1rem/1.5 system-ui, sans-serif; }
  .settings { display: flex; flex-wrap: wrap; gap: 1rem; margin-block: 1rem; }
  main :global(button) { padding: .5rem; border: 1px solid currentColor; font: inherit; }
  main :global(button:disabled) { opacity: .4; }
  .outside { display: block; margin-top: 1rem; }
</style>
