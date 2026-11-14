<script lang="ts">
  import Slider from './Slider.svelte';
  import type { HoverSliderProps } from '../slider.js';
  let { value = $bindable(0), ...props }: HoverSliderProps = $props();
</script>

<Slider bind:value orientation="vertical" mode="hover" {...props} />
