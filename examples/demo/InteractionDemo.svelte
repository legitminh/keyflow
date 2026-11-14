<script lang="ts">
  import {
    Keyflow, Button, ButtonPositional, HoverButton, HoverButtonPositional, StaticButton,
    Interactable, InteractablePositional, StaticInteractable, VirtualKeyboard, FlickKeyDisplay,
    interaction, create_input_frame, input_frame_manager, type InteractionEvent
  } from '../../src/lib/index.js';
  import { onDestroy } from 'svelte';
  import '../../src/lib/styles.css';
  let events = $state<(InteractionEvent & { control: string })[]>([]);
  let actions = $state(0);
  let mounted = $state(true);
  let disabled = $state(false);
  const child = create_input_frame({ name: 'lifecycle-child' });
  onDestroy(() => child.dispose());
  const handlers = (control: string) => ({
    on_pressed_down: (event: InteractionEvent) => { events.push({ ...event, original_event: undefined, control }); },
    on_pressed_up: (event: InteractionEvent) => { events.push({ ...event, original_event: undefined, control }); },
    on_cursor_enter: (event: InteractionEvent) => { events.push({ ...event, original_event: undefined, control }); },
    on_cursor_exit: (event: InteractionEvent) => { events.push({ ...event, original_event: undefined, control }); },
    on_enter: (event: InteractionEvent) => { if (event.kind === 'focus') events.push({ ...event, original_event: undefined, control }); },
    on_exit: (event: InteractionEvent) => { if (event.kind === 'focus') events.push({ ...event, original_event: undefined, control }); }
  });
</script>

<Keyflow options={{ lockstep: false }}>
  <main>
    <h1>Interaction lifecycle</h1>
    <p>Press, hover, or focus any control to see paired events and elapsed milliseconds.</p>
    <button onclick={() => events = []}>Clear events</button>
    <button onclick={() => mounted = !mounted}>Toggle controls</button>
    <button onclick={() => disabled = !disabled}>Toggle disabled</button>
    <button onclick={() => input_frame_manager.push(child)}>Change frame</button>
    <button onclick={() => input_frame_manager.reset()}>Reset frame</button>
    <p aria-label="Actions">{actions}</p>
    {#if mounted}
      <div class="controls">
        <Button {...handlers('automatic')} on_close={() => actions++}>Automatic action</Button>
        <ButtonPositional {...handlers('positional')}>Positional action</ButtonPositional>
        <HoverButton {...handlers('hover')}>Hover action</HoverButton>
        <HoverButtonPositional {...handlers('hover-positional')}>Hover positional action</HoverButtonPositional>
        <StaticButton keys="z" {...handlers('static')} on_close={() => actions++}>Static action</StaticButton>
        <Interactable {...handlers('interactable')}>Custom action</Interactable>
        <InteractablePositional {...handlers('interactable-positional')}>Custom positional action</InteractablePositional>
        <StaticInteractable keys="y" {...handlers('static-interactable')}>Custom static action</StaticInteractable>
        <button {disabled} use:interaction={{ ...handlers('custom'), disabled }}>Native custom action</button>
      </div>
      <VirtualKeyboard layout={{ id: 'test', label: 'Lifecycle keys', rows: [[{ key: 'a' }, { key: 'b', ...handlers('per-key') }]] }}
        {...handlers('keyboard')} onkey={() => {}} />
      <FlickKeyDisplay key="c" flick={{ up: 'C' }} {...handlers('flick')} {disabled} onkey={() => {}} />
    {/if}
    <pre aria-label="Interaction events">{JSON.stringify(events)}</pre>
  </main>
</Keyflow>

<style>
  main :global(.keyflow-key) { touch-action: none; }
  main { padding: 1rem; font: 1rem/1.5 system-ui, sans-serif; }
  .controls { display: flex; flex-wrap: wrap; gap: 1rem; margin: 1rem 0; }
  main :global(button) { padding: .5rem; }
  pre { white-space: pre-wrap; font-size: .75rem; }
</style>
