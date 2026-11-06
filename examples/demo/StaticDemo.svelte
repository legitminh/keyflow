<script lang="ts">
  import {
    Keyflow, Document, LineText, Button, StaticButton, StaticInteractable,
    key_presets, type ShortcutPlatform
  } from '../../src/lib/index.js';
  import '../../src/lib/styles.css';
  const requestedPlatform = new URLSearchParams(window.location.search).get('platform');
  const platform: ShortcutPlatform | 'auto' =
    requestedPlatform === 'mac' || requestedPlatform === 'windows' || requestedPlatform === 'linux'
      ? requestedPlatform : 'auto';
  let automatic = $state(0);
  let sequence = $state(0);
  let primary = $state(0);
  let shifted = $state(0);
  let escapeSequence = $state(0);
  let custom = $state(0);
  let dynamic = $state(0);
  let dynamicKey = $state('e');
  let showDynamic = $state(true);
</script>

<Keyflow options={{ keys: key_presets.letters, platform }}>
  <Document>
    <LineText><h1>static shortcuts</h1></LineText>
    <LineText>Press keys in the displayed order, then release all keys. Keys can be released between presses. Each binding is an exact sequence with no timeout.</LineText>
    <LineText><Button on_close={() => automatic++}>automatic: {automatic}</Button></LineText>
    <LineText><StaticButton keys="ab" on_close={() => sequence++}>sequence: {sequence}</StaticButton></LineText>
    <LineText><StaticButton keys={['ctrl', 'k']} on_close={() => primary++}>primary: {primary}</StaticButton></LineText>
    <LineText><StaticButton keys={['shift', 'j']} on_close={() => shifted++}>shifted: {shifted}</StaticButton></LineText>
    <LineText><StaticButton keys={['esc', 'x']} on_close={() => escapeSequence++}>escape sequence: {escapeSequence}</StaticButton></LineText>
    <LineText><StaticInteractable keys="z" on_close={() => custom++}>custom: {custom}</StaticInteractable></LineText>
    <LineText><label>Type here <input aria-label="Static example input" /></label></LineText>
    <LineText>
      <button type="button" onclick={() => dynamicKey = dynamicKey === 'e' ? 'g' : 'e'}>Change static key</button>
      <button type="button" onclick={() => showDynamic = !showDynamic}>Toggle static control</button>
    </LineText>
    {#if showDynamic}
      <LineText><StaticButton keys={dynamicKey} on_close={() => dynamic++}>dynamic: {dynamic}</StaticButton></LineText>
    {/if}
    <LineText>Preview: <a href="/static?platform=mac">macOS</a>, <a href="/static?platform=windows">Windows</a>, <a href="/static?platform=linux">Linux</a></LineText>
    <LineText><a href="/mixed">fixed and positional shortcuts demo</a></LineText>
    <LineText><a href="/">back to automatic shortcuts</a></LineText>
  </Document>
</Keyflow>
