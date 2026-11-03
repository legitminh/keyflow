<script lang="ts">
  import {
    Keyflow,
    Document,
    LineText,
    ButtonPositional,
    Link,
    ThemeToggle,
    min_box,
    lockstep_scrolling
  } from '../../src/lib/index.js';
  import '../../src/lib/styles.css';

  let count = $state(0);
</script>

<Keyflow>
  <Document>
    <LineText><h1>keyflow</h1></LineText>
    <LineText>Use the key labels, click a control, or swipe to move by a page.</LineText>
    <LineText><ButtonPositional on_close={() => count++}>count: {count}</ButtonPositional></LineText
    >
    <LineText><ThemeToggle /></LineText>
    <LineText
      ><ButtonPositional on_close={() => min_box.set(min_box.value * 1.25)}
        >zoom in</ButtonPositional
      ></LineText
    >
    <LineText
      ><ButtonPositional on_close={() => lockstep_scrolling.set(!lockstep_scrolling.enabled)}
        >toggle native scrolling</ButtonPositional
      ></LineText
    >
    <LineText><Link href="#destination">jump to destination</Link></LineText>
    <LineText><label>Type here <input aria-label="Example input" /></label></LineText>
    {#each Array.from({ length: 30 }, (_, i) => i) as i}
      <LineText><p>Section {i + 1}: content stays aligned to the grid.</p></LineText>
    {/each}
    <LineText><h2 id="destination">destination</h2></LineText>
    <LineText><Link href="#">back to top</Link></LineText>
  </Document>
</Keyflow>
