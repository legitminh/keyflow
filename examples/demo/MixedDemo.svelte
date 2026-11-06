<script lang="ts">
  import {
    Keyflow, Document, LineText, Button, ButtonPositional, StaticButton
  } from '../../src/lib/index.js';
  import '../../src/lib/styles.css';
  let fixed = $state(0);
  let automatic = $state(0);
  let positional = $state(0);
  let showGroup = $state(false);
</script>

<Keyflow options={{ keys: ['a', 'b', 'c', 'd'], lockstep: false }}>
  <Document>
    <LineText><h1>fixed and positional shortcuts</h1></LineText>
    <LineText><StaticButton keys="ab" on_close={() => fixed++}>fixed: {fixed}</StaticButton></LineText>
    <LineText><Button priority={0} on_close={() => automatic++}>automatic: {automatic}</Button></LineText>
    <LineText><button type="button" onclick={() => showGroup = !showGroup}>Toggle positional controls</button></LineText>
    {#if showGroup}
      {#each [1, 2] as index}
        <LineText><ButtonPositional on_close={() => positional++}>near {index}: {positional}</ButtonPositional></LineText>
      {/each}
    {/if}
    <div style="height: 150vh;"></div>
    <LineText><ButtonPositional on_close={() => positional++}>far: {positional}</ButtonPositional></LineText>
    <LineText><a href="/static">back to static shortcuts</a></LineText>
  </Document>
</Keyflow>
