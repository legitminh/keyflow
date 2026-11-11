<script lang="ts">
  import { onDestroy } from 'svelte';
  import {
    Keyflow, InputFrame, Button, StaticButton, ActiveKeyboard,
    create_input_frame, input_frame_manager, create_keyboard_store,
    keyboard_layouts, keyflow_key_handler, type KeyboardLayout, type VirtualKeyInput
  } from '../../src/lib/index.js';
  import '../../src/lib/styles.css';

  const menu = create_input_frame({ name: 'keyboard-menu' });
  const activeFrame = input_frame_manager.active;
  const stack = input_frame_manager.stack;
  // A layout may freely mix directional and ordinary keys.
  const mixed: KeyboardLayout = {
    id: 'mixed', label: 'Mixed flick + regular',
    rows: keyboard_layouts.alpha.rows.map((row, r) => row.map((key, c) =>
      r === 0 && c < 4 ? { ...key, flick: {
        up: keyboard_layouts['flick-alpha'].rows[r][c].flick?.up,
        right: keyboard_layouts['flick-alpha'].rows[r][c].flick?.right
      } } : { ...key }))
  };
  const layouts = [
    keyboard_layouts['flick-alpha'], keyboard_layouts.alpha, keyboard_layouts.alphanumeric,
    keyboard_layouts['60%'], keyboard_layouts.ortholinear, keyboard_layouts.grid16,
    keyboard_layouts.grid32, mixed
  ];
  const keyboards = create_keyboard_store(layouts, 'flick-alpha');
  const activeKeyboard = keyboards.active;
  let pageCount = $state(0);
  let selections = $state(0);
  let text = $state('');
  let lastKey = $state('none');
  let textMode = $state(false);
  function choose(id: string) {
    keyboards.select(id);
    selections++;
    input_frame_manager.pop();
  }
  function handleKey(event: VirtualKeyInput) {
    if (event.type === 'keyup') {
      lastKey = event.key === ' ' ? 'space' : event.key;
      if (textMode) {
        if (event.key === 'backspace') text = text.slice(0, -1);
        else if (event.key === 'enter') text += '\n';
        else if (event.key.length === 1) text += event.key;
      }
    }
    if (!textMode) keyflow_key_handler(event);
  }
  onDestroy(() => menu.dispose());
</script>

<Keyflow options={{ keys: ['a', 'b', 'c', 'd', 'e'] }}>
  <main>
    <h1>Keyflow · touch & flick</h1>
    <p>Tap a letter, or drag past a key's edge and release for its hinted input. E opens the keyboard menu; A returns.</p>
    <p aria-label="Frame stack">{$stack.map((frame) => frame.name).join(' → ')}</p>
    <div class="status">
      <span aria-label="Page action count">Page actions: {pageCount}</span>
      <span aria-label="Last virtual key">Last key: {lastKey}</span>
      <span aria-label="Keyboard selection count">Selections: {selections}</span>
    </div>
    <div class="controls" role="group" aria-label="Page actions">
      <Button priority={0} on_close={() => pageCount++}>Page A</Button>
      <Button priority={1} on_close={() => pageCount++}>Page B</Button>
      <Button priority={2} on_close={() => pageCount++}>Page C</Button>
      <Button priority={3} on_close={() => pageCount++}>Page D</Button>
      <Button priority={4} on_close={() => input_frame_manager.push(menu)}>Open menu</Button>
    </div>
    <InputFrame frame={menu}>
      <section class="panel" hidden={$activeFrame !== menu} aria-label="Keyboard menu">
        <h2>Choose your keyboard</h2>
        <div class="choices">
          <StaticButton keys="a" on_close={() => input_frame_manager.pop()}>Back</StaticButton>
          {#each layouts as layout, index}
            <StaticButton keys={String.fromCharCode(98 + index)} on_close={() => choose(layout.id)}>
              {layout.label}{$activeKeyboard?.id === layout.id ? ' · selected' : ''}
            </StaticButton>
          {/each}
        </div>
      </section>
    </InputFrame>
    <label class="mode"><input type="checkbox" bind:checked={textMode} /> Text playground (virtual keys type here)</label>
    <pre aria-label="Custom text output">{text || '(empty)'}</pre>
    <a href="/flow">Scrolling demo</a> · <a href="/frames">More keyboard examples</a>
  </main>

  <!-- Stable dock stays mounted while input frames and keyboard types change. -->
  <div class="keyboard-dock" aria-label="Persistent keyboard">
    <ActiveKeyboard store={keyboards} onkey={handleKey}>
      {#snippet toolbar()}
        <strong>{$activeKeyboard?.label}</strong>
        <button type="button" onclick={() => {
          textMode = false;
          if ($activeFrame === menu) input_frame_manager.pop();
          else input_frame_manager.push(menu);
        }}>{$activeFrame === menu ? 'Back to page' : 'Choose keyboard'}</button>
        <span>Tap · flick ↑ ↓ ← →</span>
      {/snippet}
    </ActiveKeyboard>
  </div>
</Keyflow>

<style>
  main { height: 50dvh; flex: 0 0 50dvh; overflow: auto; box-sizing: border-box; padding: 1rem; font-size: 1rem; line-height: 1.5; }
  h1 { margin: 0 0 .5rem; font-size: 1.4rem; }
  h2 { margin: 0 0 .5rem; font-size: 1.1rem; }
  p { margin: .5rem 0; }
  .status, .controls { display: flex; flex-wrap: wrap; gap: .5rem 1rem; margin-block: .75rem; }
  .panel { border: 1px solid currentColor; margin-block: .75rem; padding: .75rem; }
  .choices { display: grid; grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr)); gap: .5rem; }
  .mode { display: block; margin-block: .75rem; }
  pre { min-height: 2rem; white-space: pre-wrap; }
  main :global(button) { font-size: 1rem; line-height: 1.5; }
  main :global(button:disabled) { opacity: .4; cursor: default; }
  .keyboard-dock { position: fixed; inset: auto 0 0; height: 50dvh; box-sizing: border-box; z-index: 10;
    padding-bottom: env(safe-area-inset-bottom, 0); background: var(--background, #171717);
    border-top: 1px solid var(--tertiary, #777); --keyboard-key-height: 0px; --keyboard-font-size: clamp(1rem, 2vw, 1.4rem); }
  .keyboard-dock :global(.keyflow-keyboard) { height: 100%; }
  .keyboard-dock :global([data-layout="60%"]) { --keyboard-font-size: clamp(.65rem, 1.3vw, 1rem); }
  .keyboard-dock :global(.keyboard-row) { flex: 1; min-height: 0; }
  .keyboard-dock :global(.keyboard-toolbar) { flex: 0 0 auto; font-size: .85rem; line-height: 1.4; }
  .keyboard-dock :global(.keyboard-toolbar button) { font: inherit; text-decoration: underline; padding: .3rem .5rem; }
</style>
