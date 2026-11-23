<script lang="ts">
  import { Keyflow, Document, must_view } from '../../src/lib/index.js';
  import '../../src/lib/styles.css';
</script>
<Keyflow options={{ lockstep: true, minBox: 32 }}>
  <Document scrollKeys={{ down: 'pagedown', up: 'pageup' }}>
    <div class="gap" style:height="500px"></div>
    <div class="block" id="short" style:height="400px" use:must_view>Short block</div>
    <div class="gap" style:height="1500px"></div>
    <div class="block" id="tall" style:height="2000px" use:must_view>Tall block</div>
    <div class="gap" style:height="1500px"></div>
  </Document>
</Keyflow>
<style>
  .block { background: #cde; font: 16px system-ui; }
</style>
