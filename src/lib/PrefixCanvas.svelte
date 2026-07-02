<script>
  // A compact canvas heatmap of the whole prefix space, for widths too large to
  // render as DOM cells (2 bytes = 65 536 prefixes, 3 bytes = 16.7 M). Each
  // prefix maps to a square: the high half of its hex picks the row, the low
  // half the column, so it's the same layout as the 1-byte grid, just denser.
  // Occupied prefixes are drawn amber→red by crowdedness; free space stays dark.

  let { prefixes = [], bytes = 2, maxCount = 1, selected = '', onpick } = $props();

  const hexLen = $derived(bytes * 2);
  const dim = $derived(Math.pow(16, bytes)); // cells per side: 256 (2B) / 4096 (3B)
  const R = 600; // internal canvas resolution (px per side)

  const countMap = $derived(new Map(prefixes.map((p) => [p.prefix, p.count])));

  let canvas;
  let hover = $state(null); // { prefix, count, x, y }

  function fillFor(count) {
    const t = maxCount > 1 ? (count - 1) / (maxCount - 1) : 0;
    return `hsl(${48 - 48 * t} 65% 50%)`; // 48 = amber, 0 = red — matches the 1-byte grid
  }

  function draw() {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = R * dpr;
    canvas.height = R * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, R, R);

    const cell = R / dim;
    const s = Math.max(1, cell); // never smaller than a pixel, so dots stay visible
    for (const p of prefixes) {
      const idx = parseInt(p.prefix, 16);
      if (Number.isNaN(idx)) continue;
      const col = idx % dim;
      const row = Math.floor(idx / dim);
      ctx.fillStyle = fillFor(p.count);
      ctx.fillRect(Math.floor(col * cell), Math.floor(row * cell), s, s);
    }

    // Highlight the inspected prefix with a small accent box.
    if (selected && selected.length === hexLen) {
      const idx = parseInt(selected, 16);
      if (!Number.isNaN(idx)) {
        const col = idx % dim;
        const row = Math.floor(idx / dim);
        const box = Math.max(8, cell);
        const cx = col * cell + cell / 2;
        const cy = row * cell + cell / 2;
        ctx.strokeStyle = '#5aa9ff';
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - box / 2, cy - box / 2, box, box);
      }
    }
  }

  $effect(draw);

  function prefixAt(e) {
    const rect = canvas.getBoundingClientRect();
    const fx = (e.clientX - rect.left) / rect.width;
    const fy = (e.clientY - rect.top) / rect.height;
    const col = Math.min(dim - 1, Math.max(0, Math.floor(fx * dim)));
    const row = Math.min(dim - 1, Math.max(0, Math.floor(fy * dim)));
    return (row * dim + col).toString(16).padStart(hexLen, '0');
  }

  function onmove(e) {
    const prefix = prefixAt(e);
    const rect = canvas.getBoundingClientRect();
    hover = {
      prefix,
      count: countMap.get(prefix) ?? 0,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }
</script>

<div class="relative">
  <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
  <canvas
    bind:this={canvas}
    onclick={(e) => onpick?.(prefixAt(e))}
    onmousemove={onmove}
    onmouseleave={() => (hover = null)}
    class="w-full cursor-crosshair rounded-lg border border-edge bg-elev2"
    style="aspect-ratio:1/1; image-rendering:pixelated;"
  ></canvas>
  {#if hover}
    <div
      class="pointer-events-none absolute z-10 rounded border border-edge bg-elev2 px-2 py-1 text-xs shadow-lg"
      style="left:{hover.x + 10}px; top:{hover.y + 10}px;"
    >
      <span class="font-mono text-ink">{hover.prefix}</span>
      <span class="text-muted">
        — {hover.count === 0 ? 'free' : `${hover.count} node${hover.count === 1 ? '' : 's'}`}
      </span>
    </div>
  {/if}
</div>
