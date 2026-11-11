<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { Shortcut } from '../shortcuts.js';
  import { create_static_token, type StaticInputToken } from '../stores/static-input.js';

  import { active_input_frame } from '../input-frames.js';
  import { get_input_frame } from '../input-frame-context.js';
  const frame = get_input_frame();
  const { static_input } = frame;
  let { keys, on_close, children, myToken = $bindable() }: {
    keys: Shortcut; on_close: () => void; children?: Snippet; myToken?: StaticInputToken;
  } = $props();
  const token = create_static_token(() => on_close());
  const description = token.description;
  const descriptionId = $props.id();
  $effect(() => {
    myToken = token;
    return static_input.register(token, keys);
  });
</script>

<button type="button" disabled={$active_input_frame !== frame}
  onclick={() => frame.trigger(token)} class="inline cursor-pointer"
  aria-describedby={descriptionId}>
  {@render children?.()}
</button>
<span id={descriptionId} hidden>{$active_input_frame === frame ? `Shortcut: ${$description.label}` : 'Inactive input frame'}</span>
