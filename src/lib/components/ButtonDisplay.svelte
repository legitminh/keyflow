<!-- 
  displays the key route and content of a button given its input token
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  let {
    children = undefined,
    token,
    flood: floods = false
  }: { children?: Snippet; token?: InputToken; flood?: boolean } = $props();

  import {
    _available_keys,
    map_numeric_route,
    list_input_token,
    list_key_strokes,
    type InputToken
  } from '../stores/input.js';
  import { get } from 'svelte/store';
  import { flood } from '../actions/flood.js';

  let my_numeric_route: number[] = $derived($map_numeric_route.get(token as InputToken) ?? []);
  let partial_index = $derived(
    (() => {
      for (let i = 0; i < $list_key_strokes.length; i++) {
        if ($list_key_strokes[i] !== my_numeric_route[i]) {
          return 0;
        }
      }
      return $list_key_strokes.length;
    })()
  ); //if key_stroke is a prefix of numeric_route, then the partial index if the key_stroke length, otherwise 0
  let entered_key_route = $derived(
    my_numeric_route
      .slice(0, partial_index)
      .map((index) => {
        return get(_available_keys)[index];
      })
      .join('')
  );
  let pending_key_route = $derived(
    my_numeric_route
      .slice(partial_index, my_numeric_route.length)
      .map((index) => {
        return get(_available_keys)[index];
      })
      .join('')
  );
  const min_step_hsl = 61; // smallest hsl degree
  let my_hsl = $derived(($list_input_token.findIndex((t) => t === token) * min_step_hsl) % 360);
  // the last key of the route is down, so this button is about to trigger
  let is_route_complete = $derived(
    my_numeric_route.length > 0 && partial_index === my_numeric_route.length
  );
</script>

<div class="button">
  <div
    class="route"
    use:flood={{
      enabled: floods,
      active: is_route_complete,
      color: `hsla(${my_hsl}, 100%, 50%, 0.75)`
    }}
  >
    {#if entered_key_route}
      <div class="enter_route" style={`background-color: hsla(${my_hsl}, 100%, 50%, 0.75);`}>
        {entered_key_route}
      </div>
    {/if}
    {#if pending_key_route}
      <div class="pending_route" style={`background-color: hsla(${my_hsl}, 100%, 50%, 0.25);`}>
        {pending_key_route}
      </div>
    {/if}
  </div>
  {#if children}
    <div class="content" style={`background-color: hsla(${my_hsl}, 100%, 50%, 0.125);`}>
      {@render children?.()}
    </div>
  {/if}
</div>

<style>
  .button {
    display: flex;
    /* the content only drops below the route when even its narrowest form can't fit beside it */
    flex-wrap: wrap;
  }
  .route {
    /* entered and pending route always stay together on one line */
    display: flex;
    flex: none;
    white-space: nowrap;
    color: var(--tertiary);
  }
  .content {
    /* take the remaining space and wrap its own text before forcing a line break */
    flex: 1 1 0;
  }
  /* .enter_route {
  opacity: 0.5;
}
.pending_route{
  opacity: 0.5;
} */
</style>
