<script>
  import { Minus, Plus, RotateCcw } from '@lucide/svelte';

  // A compact canvas heatmap of the whole prefix space, for widths too large to
  // render as DOM cells (2 bytes = 65 536 prefixes, 3 bytes = 16.7 M). Each
  // prefix maps to a square: the high half of its hex picks the row, the low
  // half the column, so it's the same layout as the 1-byte grid, just denser.
  // Occupied prefixes are drawn amber→red by crowdedness; free space stays dark.

  let { prefixes = [], bytes = 2, selected = '', onpick } = $props();

  const hexLen = $derived(bytes * 2);
  const dim = $derived(Math.pow(16, bytes)); // cells per side: 256 (2B) / 4096 (3B)
  const R = 600; // internal canvas resolution (px per side)
  const maxZoom = $derived(bytes === 2 ? 64 : 512);

  const countMap = $derived(new Map(prefixes.map((p) => [p.prefix, p.count])));
  const heatDomain = $derived.by(() => {
    const counts = prefixes.map((p) => p.count).filter((c) => c > 0).sort((a, b) => a - b);
    if (!counts.length) return { min: 1, high: 1 };
    const min = counts[0];
    const max = counts[counts.length - 1];
    const p95 = counts[Math.min(counts.length - 1, Math.floor(counts.length * 0.95))];
    const high = p95 > min ? p95 : max;
    return { min, high: Math.max(min, high) };
  });

  let canvas;
  let hover = $state(null); // { prefix, count, x, y }
  let zoom = $state(1);
  let centerX = $state(0.5);
  let centerY = $state(0.5);
  let dragging = $state(null);
  let didDrag = $state(false);

  function fillFor(count) {
    const { min, high } = heatDomain;
    const t = high > min ? (Math.min(count, high) - min) / (high - min) : 0;
    return `hsl(${48 - 48 * t} 65% 50%)`; // 48 = amber, 0 = red — matches the 1-byte grid
  }

  function viewport() {
    const scale = R * zoom;
    return {
      scale,
      originX: R / 2 - centerX * scale,
      originY: R / 2 - centerY * scale
    };
  }

  function clampCenter() {
    const half = 0.5 / zoom;
    centerX = Math.min(1 - half, Math.max(half, centerX));
    centerY = Math.min(1 - half, Math.max(half, centerY));
  }

  function draw() {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = R * dpr;
    canvas.height = R * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, R, R);

    const { scale, originX, originY } = viewport();
    const cell = scale / dim;
    const s = Math.max(1, cell); // never smaller than a pixel, so dots stay visible
    for (const p of prefixes) {
      const idx = parseInt(p.prefix, 16);
      if (Number.isNaN(idx)) continue;
      const col = idx % dim;
      const row = Math.floor(idx / dim);
      const x = originX + col * cell;
      const y = originY + row * cell;
      if (x > R || y > R || x + s < 0 || y + s < 0) continue;
      ctx.fillStyle = fillFor(p.count);
      ctx.fillRect(Math.floor(x), Math.floor(y), s, s);
    }

    function strokePrefix(prefix, color, minBox, width) {
      if (!prefix || prefix.length !== hexLen) return;
      const idx = parseInt(prefix, 16);
      if (!Number.isNaN(idx)) {
        const col = idx % dim;
        const row = Math.floor(idx / dim);
        const box = Math.max(minBox, cell);
        const cx = originX + col * cell + cell / 2;
        const cy = originY + row * cell + cell / 2;
        if (cx + box / 2 < 0 || cy + box / 2 < 0 || cx - box / 2 > R || cy - box / 2 > R) return;
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.strokeRect(cx - box / 2, cy - box / 2, box, box);
      }
    }

    strokePrefix(hover?.prefix, '#cbd5e1', 7, 1.5);
    strokePrefix(selected, '#5aa9ff', 8, 2);
  }

  $effect(draw);

  function canvasPoint(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * R,
      y: ((e.clientY - rect.top) / rect.height) * R,
      left: rect.left,
      top: rect.top
    };
  }

  function worldAtCanvasPoint(x, y) {
    const { scale, originX, originY } = viewport();
    return {
      x: Math.min(1, Math.max(0, (x - originX) / scale)),
      y: Math.min(1, Math.max(0, (y - originY) / scale))
    };
  }

  function prefixAt(e) {
    const point = canvasPoint(e);
    const world = worldAtCanvasPoint(point.x, point.y);
    const fx = world.x;
    const fy = world.y;
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

  function zoomAt(nextZoom, x = R / 2, y = R / 2) {
    const oldWorld = worldAtCanvasPoint(x, y);
    zoom = Math.min(maxZoom, Math.max(1, nextZoom));
    const scale = R * zoom;
    centerX = oldWorld.x - (x - R / 2) / scale;
    centerY = oldWorld.y - (y - R / 2) / scale;
    clampCenter();
  }

  function onwheel(e) {
    e.preventDefault();
    const point = canvasPoint(e);
    const factor = e.deltaY < 0 ? 1.45 : 1 / 1.45;
    zoomAt(zoom * factor, point.x, point.y);
  }

  function resetView() {
    zoom = 1;
    centerX = 0.5;
    centerY = 0.5;
  }

  function onpointerdown(e) {
    canvas.setPointerCapture(e.pointerId);
    dragging = { id: e.pointerId, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY };
    didDrag = false;
  }

  function onpointermove(e) {
    if (!dragging || dragging.id !== e.pointerId) {
      onmove(e);
      return;
    }
    const rect = canvas.getBoundingClientRect();
    didDrag = didDrag || Math.hypot(e.clientX - dragging.startX, e.clientY - dragging.startY) > 4;
    centerX -= (e.clientX - dragging.x) / rect.width / zoom;
    centerY -= (e.clientY - dragging.y) / rect.height / zoom;
    dragging = { ...dragging, x: e.clientX, y: e.clientY };
    clampCenter();
    onmove(e);
  }

  function onpointerup(e) {
    if (dragging?.id === e.pointerId) dragging = null;
  }
</script>

<div class="relative">
  <div class="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-md border border-edge bg-bg/90 p-1 shadow-lg backdrop-blur">
    <button
      type="button"
      onclick={() => zoomAt(zoom / 1.8)}
      class="grid h-7 w-7 place-items-center rounded text-muted hover:bg-elev hover:text-ink disabled:opacity-40"
      disabled={zoom <= 1}
      title="Zoom out"
      aria-label="Zoom out"
    >
      <Minus size={14} />
    </button>
    <span class="w-10 text-center text-[10px] tabular-nums text-muted">{Math.round(zoom)}x</span>
    <button
      type="button"
      onclick={() => zoomAt(zoom * 1.8)}
      class="grid h-7 w-7 place-items-center rounded text-muted hover:bg-elev hover:text-ink disabled:opacity-40"
      disabled={zoom >= maxZoom}
      title="Zoom in"
      aria-label="Zoom in"
    >
      <Plus size={14} />
    </button>
    <button
      type="button"
      onclick={resetView}
      class="grid h-7 w-7 place-items-center rounded text-muted hover:bg-elev hover:text-ink"
      title="Reset view"
      aria-label="Reset view"
    >
      <RotateCcw size={14} />
    </button>
  </div>
  <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
  <canvas
    bind:this={canvas}
    onclick={(e) => {
      if (didDrag) {
        didDrag = false;
        return;
      }
      onpick?.(prefixAt(e));
    }}
    onwheel={onwheel}
    onpointerdown={onpointerdown}
    onpointermove={onpointermove}
    onpointerup={onpointerup}
    onpointercancel={onpointerup}
    onmouseleave={() => {
      hover = null;
      dragging = null;
    }}
    class="w-full cursor-crosshair rounded-lg border border-edge bg-elev2 active:cursor-grabbing"
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
