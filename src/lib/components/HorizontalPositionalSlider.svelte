<script lang="ts">
  import Slider from './Slider.svelte';
  import type { SliderProps } from '../slider.js';
  let { value = $bindable(0), ...props }: SliderProps = $props();
</script>

<Slider bind:value orientation="horizontal" mode="positional" {...props} />
