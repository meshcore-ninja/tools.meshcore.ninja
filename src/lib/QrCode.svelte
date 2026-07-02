<script>
  // Renders a scannable QR for arbitrary text as crisp SVG, with copy + PNG
  // download. Always black-on-white so every reader (including the MeshCore app)
  // can scan it, in both light and dark themes.
  import qrcode from 'qrcode-generator';
  import { Copy, Check, Download } from '@lucide/svelte';

  let {
    value = '',
    ec = 'M', // error correction: L / M / Q / H
    label = ''
  } = $props();

  const qr = $derived.by(() => {
    if (!value) return null;
    try {
      const q = qrcode(0, ec);
      q.addData(value);
      q.make();
      return q;
    } catch {
      return null; // too much data for the chosen EC level
    }
  });

  const svg = $derived(qr ? qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true }) : '');

  let copied = $state(false);
  function copy() {
    if (!value) return;
    navigator.clipboard?.writeText(value).then(() => {
      copied = true;
      setTimeout(() => (copied = false), 1200);
    });
  }

  // Rasterise the QR modules to a PNG so it can be saved / printed. We draw the
  // module matrix directly at a fixed scale rather than the SVG, for sharp edges.
  function downloadPng() {
    if (!qr) return;
    const count = qr.getModuleCount();
    const margin = 4;
    const scale = 10;
    const size = (count + margin * 2) * scale;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#000000';
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c)) {
          ctx.fillRect((c + margin) * scale, (r + margin) * scale, scale, scale);
        }
      }
    }
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `${(label || 'meshcore-qr').replace(/[^a-z0-9._-]+/gi, '-')}.png`;
    a.click();
  }
</script>

<div class="flex flex-col items-center gap-3">
  <div class="w-full max-w-64 rounded-lg bg-white p-4 [&>svg]:block [&>svg]:h-auto [&>svg]:w-full">
    {#if svg}
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      {@html svg}
    {:else}
      <div class="grid aspect-square place-items-center text-center text-xs text-neutral-400">
        {value ? 'Too much data for this code' : 'Nothing to encode yet'}
      </div>
    {/if}
  </div>
  {#if svg}
    <div class="flex gap-2">
      <button
        type="button"
        onclick={copy}
        class="inline-flex items-center gap-1.5 rounded-md border border-edge bg-bg px-3 py-1.5 text-xs text-dim hover:border-accent hover:text-ink"
      >
        {#if copied}<Check size={14} class="text-accent" />Copied{:else}<Copy size={14} />Copy link{/if}
      </button>
      <button
        type="button"
        onclick={downloadPng}
        class="inline-flex items-center gap-1.5 rounded-md border border-edge bg-bg px-3 py-1.5 text-xs text-dim hover:border-accent hover:text-ink"
      >
        <Download size={14} /> PNG
      </button>
    </div>
  {/if}
</div>
