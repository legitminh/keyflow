<script lang="ts">
  import { onDestroy, untrack, type Snippet } from 'svelte';
  import { create_input_frame, type InputFrameController } from '../input-frames.js';
  import { provide_input_frame } from '../input-frame-context.js';

  let { children, frame: suppliedFrame, active, name, controller = $bindable() }: {
    children?: Snippet;
    /** Stable frame reference. The caller owns its lifetime. Omit to create an owned frame. */
    frame?: InputFrameController;
    /** Optional declarative activation. Omit when using input_frame_manager. */
    active?: boolean;
    name?: string;
    controller?: InputFrameController;
  } = $props();
  const initial = () => ({ suppliedFrame, name });
  const options = initial();
  const frame = options.suppliedFrame ?? create_input_frame({ name: options.name });
  provide_input_frame(frame);
  controller = frame;
  $effect(() => {
    const enabled = active;
    untrack(() => {
      if (enabled === true) frame.activate();
      else if (enabled === false) frame.deactivate();
    });
  });
  onDestroy(() => { if (!options.suppliedFrame) frame.dispose(); });
</script>

{@render children?.()}
