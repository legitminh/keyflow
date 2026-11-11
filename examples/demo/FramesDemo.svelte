<script lang="ts">
  import {
    Keyflow, InputFrame, Button, Interactable, StaticButton, ActiveKeyboard,
    KeyboardDisplay, KeyboardKeyDisplay, create_keyboard_store, keyboard_layouts,
    type VirtualKeyInput
  } from '../../src/lib/index.js';
  import '../../src/lib/styles.css';
  let menu = $state(false);
  let nested = $state(false);
  let rootCount = $state(0);
  let menuCount = $state(0);
  let nestedCount = $state(0);
  let text = $state('');
  let custom = $state(false);
  const keyboards = create_keyboard_store(Object.values(keyboard_layouts), 'grid16');
  const active = keyboards.active;
  const layouts = keyboards.keyboards;
  const textInput = (event: VirtualKeyInput) => {
    if (event.type !== 'keyup') return;
    if (event.key === 'backspace') text = text.slice(0, -1);
    else if (event.key === 'enter') text += '\n';
    else if (event.key.length === 1) text += event.key;
  };
</script>

<Keyflow options={{ keys: ['a', 's', 'd', 'f'], platform: 'windows' }}>
  <main>
    <h1>Input frames & virtual keyboards</h1>
    <p>Open the menu: its bindings mask the root. Try the same static key in every frame.</p>
    <div class="controls">
      <StaticButton keys="q" on_close={() => rootCount++}>root: {rootCount}</StaticButton>
      <Button priority={0} on_close={() => rootCount++}>root automatic</Button>
      <Interactable priority={1} on_close={() => rootCount++}>custom root control</Interactable>
      <button onclick={() => menu = !menu}>Toggle menu frame</button>
    </div>
    <InputFrame active={menu} name="menu">
      {#if menu}
        <div class="panel">
          <h2>Menu</h2>
          <StaticButton keys="q" on_close={() => menuCount++}>menu: {menuCount}</StaticButton>
          <Button priority={0} on_close={() => menuCount++}>menu automatic</Button>
          <StaticButton keys="escape" on_close={() => menu = false}>close menu</StaticButton>
          <button onclick={() => nested = !nested}>Toggle nested frame</button>
          <InputFrame active={nested} name="nested">
            {#if nested}
              <div class="panel">
                <StaticButton keys="q" on_close={() => nestedCount++}>nested: {nestedCount}</StaticButton>
                <StaticButton keys="escape" on_close={() => nested = false}>close nested</StaticButton>
              </div>
            {/if}
          </InputFrame>
        </div>
      {/if}
    </InputFrame>
    <label>Layout
      <select aria-label="Keyboard layout" value={$active?.id ?? ''}
        onchange={(event) => keyboards.select(event.currentTarget.value || null)}>
        <option value="">None</option>
        {#each $layouts as layout}<option value={layout.id}>{layout.label}</option>{/each}
      </select>
    </label>
    <label><input type="checkbox" bind:checked={custom} /> Use custom text adapter</label>
    <pre aria-label="Custom text output">{text || '(empty)'}</pre>
    <div class="keyboard-dock">
    <ActiveKeyboard store={keyboards} onkey={custom ? textInput : undefined}>
      {#snippet toolbar()}
        <span>{custom ? 'Text input' : 'Shortcut input'}</span>
        <button onclick={() => keyboards.select(null)}>Hide keyboard</button>
      {/snippet}
    </ActiveKeyboard>
    </div>
    <details>
      <summary>Custom keyboard composition</summary>
      <KeyboardDisplay>
        <div class="controls">
          <KeyboardKeyDisplay key="q" color="#ffb347" label="Custom Q" />
          <KeyboardKeyDisplay key="escape" label="Escape" />
        </div>
      </KeyboardDisplay>
    </details>
  </main>
</Keyflow>

<style>
  main { height: 50dvh; flex: 0 0 50dvh; box-sizing: border-box; overflow: auto; padding: 1rem; font-size: 1rem; line-height: 1.5; }
  main :global(button) { font-size: 1rem; line-height: 1.5; }
  .keyboard-dock { position: fixed; inset: auto 0 0; height: 50dvh; z-index: 10; background: var(--background); --keyboard-key-height: 0px; }
  .keyboard-dock :global(.keyflow-keyboard) { height: 100%; }
  .keyboard-dock :global(.keyboard-row) { flex: 1; min-height: 0; }
  .keyboard-dock :global(.keyboard-toolbar button) { font: inherit; line-height: 1.4; }
  h1 { font-size: 1.5rem; }
  h2 { font-size: 1.2rem; }
  p, label, pre, details { margin-block: 1rem; }
  label { display: block; }
  .controls { display: flex; flex-wrap: wrap; gap: 1rem; }
  .panel { border: 1px solid currentColor; margin-block: 1rem; padding: .75rem; }
  .panel :global(button) { margin-inline-end: 1rem; }
  select { color: #111; background: #eee; }
</style>
