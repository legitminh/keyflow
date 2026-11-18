<script lang="ts">
  import { Keyflow, Document, SubKeyframe, ButtonPositional, VirtualKeyboard, scroll_obstruction } from '../../src/lib/index.js';
  import '../../src/lib/styles.css';
  let keyboard = $state(true), tall = $state(false), selected = $state('none');
  const nested = Array.from({ length: 80 }, (_, i) => ({ id: `child-${i}`, label: `Child ${i}`, on_select: () => selected = `Child ${i}` }));
  const items = Array.from({ length: 100 }, (_, i) => i === 3
    ? { id: 'nested', label: 'Nested menu', items: nested }
    : { id: `item-${i}`, label: `Item ${i}`, on_select: () => selected = `Item ${i}` });
  const lockstep = new URLSearchParams(location.search).has('lockstep');
</script>
<Keyflow options={{ lockstep, minBox: 32 }}>
  <Document scrollKeys={{ down: 'pagedown', up: 'pageup' }}>
    {#if new URLSearchParams(location.search).has('sticky')}<div class="sticky">Sticky toolbar</div>{/if}
    <main>
      <SubKeyframe label="Long menu" enterTrigger="m" {items} closeOnSelect={false} />
      <output aria-label="Selection">{selected}</output>
      {#each Array.from({ length: 80 }, (_, i) => i) as i}
        <div class="row"><ButtonPositional on_close={() => selected = `Root ${i}`}>Root {i}</ButtonPositional></div>
      {/each}
    </main>
  </Document>
  <header class="navbar">
    <button onclick={() => keyboard = !keyboard}>Toggle keyboard</button>
    <button onclick={() => tall = !tall}>Resize keyboard</button>
  </header>
  {#if keyboard}
    <footer class="dock" style:height={tall ? '240px' : '120px'} use:scroll_obstruction>
      <VirtualKeyboard variant="alpha" />
    </footer>
  {/if}
</Keyflow>
<style>
  main { padding: 8px; font: 16px/1.5 system-ui; }
  main :global(button) { font: inherit; line-height: 32px; }
  .sticky { position: sticky; top: 56px; z-index: 20; height: 40px; background: #ccc; font: 16px/40px sans-serif; }
  .row { height: 44px; }
  output { display: block; }
  .navbar { position: fixed; inset: 0 0 auto; height: 56px; z-index: 50; background: #ddd; display: flex; gap: 16px; align-items: center; }
  .navbar button { font: 16px system-ui; }
  .dock { position: fixed; inset: auto 0 0; z-index: 50; overflow: auto; background: #ddd; }
</style>
