<script lang="ts">
  import {
    Keyflow,
    Document,
    LineText,
    Indent,
    Image,
    ButtonPositional,
    Link,
    ThemeToggle,
    min_box,
    lockstep_scrolling
  } from '../../src/lib/index.js';
  import '../../src/lib/styles.css';

  let count = $state(0);
  const demoImage =
    'data:image/svg+xml,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120"><rect width="240" height="120" fill="#777"/><path d="M0 60h240M120 0v120" stroke="#fff" stroke-width="2"/></svg>'
    );
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
    <Indent>
      <LineText>Grid-based image layout</LineText>
      <Image href={demoImage} alt="Grid layout example" maxWidth="100%" maxHeight="30vh" />
    </Indent>
    <LineText><h2 id="destination">destination</h2></LineText>
    <LineText><Link href="#">back to top</Link></LineText>
  </Document>
</Keyflow>
