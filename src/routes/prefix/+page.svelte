<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { Tooltip } from 'bits-ui';
  import { Fingerprint, LocateFixed, Loader2, TriangleAlert, Search, Sparkles, CircleQuestionMark } from '@lucide/svelte';
  import { networks, prefixes, search } from '$lib/api.js';
  import Select from '$lib/ui/Select.svelte';
  import Checkbox from '$lib/ui/Checkbox.svelte';
  import Slider from '$lib/ui/Slider.svelte';
  import SegmentedGroup from '$lib/ui/SegmentedGroup.svelte';
  import PrefixCanvas from '$lib/PrefixCanvas.svelte';

  // MeshCore routes on the first byte of a node's public key — the "prefix".
  // Two nodes that share a prefix on the same network create path ambiguity, so
  // this tool shows which prefixes are already taken and suggests uncrowded ones
  // for a new node. The API groups every matching node server-side (uncapped),
  // so occupancy is complete at 1, 2 or 3 bytes of prefix.

  const GLOBAL_NETWORK = 'global';
  const NODES_BASE = 'https://nodes.meshcore.ninja';
  const RESERVED_PREFIX_MESSAGE =
    'Prefixes beginning with 00 or FF are reserved by MeshCore. Choose a prefix whose first byte is between 01 and FE.';

  let netList = $state([]);
  let net = $state(GLOBAL_NETWORK);
  let netLoadError = $state(false);

  // Optional geo scope: only count nodes within `radiusKm` of (lat, lon).
  let useLocation = $state(false);
  let lat = $state('');
  let lon = $state('');
  let radiusKm = $state(25);

  // Prefix width in bytes (1 = 2 hex chars, the MeshCore routing prefix).
  let prefixBytes = $state('1');
  const hexLen = $derived(Number(prefixBytes) * 2);

  // A candidate prefix to check for conflicts. Also settable by clicking a cell
  // or deriving from a pasted pubkey.
  let candidate = $state('');
  let candidatePubkey = $state('');

  let loading = $state(false);
  let error = $state('');
  let data = $state(null); // API /api/prefixes response

  if (browser) {
    const params = new URLSearchParams(location.search);
    const urlNet = params.get('net');
    const urlBytes = params.get('bytes');
    const urlArea = params.get('area') === '1';
    const urlLat = params.get('lat');
    const urlLon = params.get('lon');
    const urlRadius = Number(params.get('radius'));
    const urlCandidate = params.get('prefix');
    const urlPubkey = params.get('pubkey');

    if (urlNet) net = urlNet;
    if (['1', '2', '3'].includes(urlBytes)) prefixBytes = urlBytes;
    if (urlArea) useLocation = true;
    if (urlLat != null) lat = urlLat;
    if (urlLon != null) lon = urlLon;
    if (Number.isFinite(urlRadius) && urlRadius >= 1 && urlRadius <= 200) radiusKm = urlRadius;
    if (urlCandidate != null) candidate = urlCandidate;
    if (urlPubkey != null) candidatePubkey = urlPubkey;
  }

  onMount(async () => {
    try {
      netList = await networks();
      if (!netList.length) netLoadError = true;
    } catch {
      netLoadError = true;
    }
  });

  function locate() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        lat = pos.coords.latitude.toFixed(5);
        lon = pos.coords.longitude.toFixed(5);
        useLocation = true;
        run();
      },
      () => {
        error = 'Could not get your location.';
      }
    );
  }

  let reqId = 0;
  async function run() {
    if (!net) return;
    const id = ++reqId;
    loading = true;
    error = '';
    // Drop the previous width's result immediately: otherwise `analysis` would
    // briefly mix the old (e.g. 2-byte) prefixes with the new width and try to
    // render a grid sized for the wrong space.
    data = null;
    try {
      const filters = [];
      if (useLocation && lat !== '' && lon !== '') {
        filters.push({ key: 'near', value: `${lat},${lon}`, radiusKm: Number(radiusKm) });
      }
      const d = await prefixes({ net, bytes: Number(prefixBytes), filters });
      if (id !== reqId) return; // a newer scan superseded this one
      data = d;
    } catch (e) {
      if (id !== reqId) return;
      error = 'Prefix scan failed. The API may be unreachable.';
      data = null;
    } finally {
      if (id === reqId) loading = false;
    }
  }

  // Re-scan whenever the network or prefix width changes (and on first load).
  // Location/radius tweaks re-scan on the Scan button (or "use my location").
  let lastKey = '';
  $effect(() => {
    const key = `${net}|${prefixBytes}`;
    if (net && key !== lastKey) {
      lastKey = key;
      run();
    }
  });

  $effect(() => {
    if (!browser) return;
    const params = new URLSearchParams();
    if (net && net !== GLOBAL_NETWORK) params.set('net', net);
    if (prefixBytes !== '1') params.set('bytes', prefixBytes);
    if (useLocation) {
      params.set('area', '1');
      if (lat !== '') params.set('lat', lat);
      if (lon !== '') params.set('lon', lon);
      if (radiusKm !== 25) params.set('radius', String(radiusKm));
    }
    if (candidate !== '') params.set('prefix', candidate);
    if (candidatePubkey !== '') params.set('pubkey', candidatePubkey);
    const query = params.toString();
    const next = `${location.pathname}${query ? `?${query}` : ''}${location.hash}`;
    if (next !== `${location.pathname}${location.search}${location.hash}`) {
      history.replaceState(history.state, '', next);
    }
  });

  // Occupancy analysis, derived from the server response. Guard on the response's
  // own `bytes` matching the selected width so a stale result from the previous
  // width is never rendered against the wrong-sized grid.
  const analysis = $derived.by(() => {
    if (!data || data.bytes !== Number(prefixBytes)) return null;
    // prefix hex -> count (the histogram is counts-only; node names are fetched
    // lazily for whichever prefix the user inspects).
    const countMap = new Map();
    for (const p of data.prefixes ?? []) countMap.set(p.prefix, p.count);

    // 256-cell counts for the 1-byte grid.
    let counts = null;
    if (hexLen === 2) {
      counts = new Array(256).fill(0);
      for (const p of data.prefixes ?? []) counts[parseInt(p.prefix, 16)] = p.count;
    }
    const occupiedCounts = (data.prefixes ?? []).map((p) => p.count).filter((c) => c > 0).sort((a, b) => a - b);
    const heatMin = occupiedCounts[0] ?? 1;
    const p95Count =
      occupiedCounts[Math.min(occupiedCounts.length - 1, Math.floor(occupiedCounts.length * 0.95))] ?? heatMin;
    const heatMax =
      p95Count > heatMin ? p95Count : occupiedCounts[occupiedCounts.length - 1] ?? heatMin;

    // Suggestions: for 1 byte, the least-crowded of all 256 (free first). For
    // wider prefixes the space is huge, so offer random free prefixes.
    let suggestions = [];
    if (hexLen === 2) {
      suggestions = counts
        .map((c, i) => ({ prefix: i.toString(16).padStart(2, '0'), count: c }))
        .filter((s) => !isReservedMeshCorePrefix(s.prefix))
        .sort((a, b) => a.count - b.count || parseInt(a.prefix, 16) - parseInt(b.prefix, 16))
        .slice(0, 12);
    } else {
      const seen = new Set();
      let attempts = 0;
      while (suggestions.length < 12 && attempts < 500) {
        attempts++;
        const p = randHex(hexLen);
        if (isReservedMeshCorePrefix(p) || countMap.has(p) || seen.has(p)) continue;
        seen.add(p);
        suggestions.push({ prefix: p, count: 0 });
      }
    }

    const used = (data.prefixes ?? []).map((p) => ({ prefix: p.prefix, count: p.count }));
    const topCollisions = used
      .filter((p) => p.count > 1)
      .sort((a, b) => b.count - a.count || a.prefix.localeCompare(b.prefix))
      .slice(0, 30);

    return {
      countMap,
      counts,
      heatDomain: { min: heatMin, high: heatMax },
      totalSpace: data.space,
      usedCount: data.used,
      collisions: data.collisions,
      counted: data.counted,
      suggestions,
      used,
      topCollisions
    };
  });

  function randHex(len) {
    let s = '';
    const chars = '0123456789abcdef';
    for (let i = 0; i < len; i++) s += chars[(Math.random() * 16) | 0];
    return s;
  }

  const hex2 = (i) => i.toString(16).padStart(2, '0');

  function isReservedMeshCorePrefix(prefix) {
    const normalized = prefix.trim().toLowerCase();
    if (!/^[0-9a-f]+$/.test(normalized)) return false;
    if (normalized.length < 2) return false;
    return normalized.startsWith('00') || normalized.startsWith('ff');
  }

  // Crowdedness scale: only a free prefix is "safe", so it stays neutral. Any
  // prefix already in use starts at amber (one node is already a potential
  // collision) and deepens to red as more nodes pile onto it.
  function cellStyle(count, heatDomain, isCandidate, isReserved) {
    if (isCandidate) return 'background:var(--color-accent2);color:#fff;';
    if (isReserved) return 'background:repeating-linear-gradient(135deg, #1f2937 0 5px, #111827 5px 10px);color:#9ca3af;';
    if (!count) return '';
    const t =
      heatDomain.high > heatDomain.min
        ? (Math.min(count, heatDomain.high) - heatDomain.min) / (heatDomain.high - heatDomain.min)
        : 0;
    const hue = 48 - 48 * t; // 48 = amber, 0 = red
    return `background:hsl(${hue} 65% 45%);color:#fff;`;
  }

  const candidateNorm = $derived(
    (candidate || '').toLowerCase().replace(/[^0-9a-f]/g, '').slice(0, hexLen)
  );
  const candidateIdx = $derived(
    hexLen === 2 && candidateNorm.length === 2 ? parseInt(candidateNorm, 16) : -1
  );
  const candidateCount = $derived(
    analysis && candidateNorm.length === hexLen ? analysis.countMap.get(candidateNorm) ?? 0 : 0
  );
  const candidateReserved = $derived(
    candidateNorm.length === hexLen && isReservedMeshCorePrefix(candidateNorm)
  );
  const selectedNetworkLabel = $derived(
    net === GLOBAL_NETWORK ? 'Global' : netList.find((n) => n.id === net)?.name || 'this network'
  );
  const scopeLabel = $derived(net === GLOBAL_NETWORK ? 'globally' : 'on this network');
  const networkItems = $derived([
    { value: GLOBAL_NETWORK, label: 'Global' },
    ...netList.map((n) => ({ value: n.id, label: n.name }))
  ]);
  const showAllHref = $derived(`${NODES_BASE}/?q=${encodeURIComponent(`^${candidateNorm}`)}`);

  // Node names for the inspected prefix are fetched on demand (the histogram is
  // counts-only), via a caret pubkey-prefix search scoped to the selected scope.
  let conflicts = $state([]);
  let conflictsLoading = $state(false);
  $effect(() => {
    const pfx = candidateNorm;
    if (!net || pfx.length !== hexLen || candidateReserved || candidateCount === 0) {
      conflicts = [];
      conflictsLoading = false;
      return;
    }
    conflictsLoading = true;
    let stale = false;
    search({ net: net === GLOBAL_NETWORK ? undefined : net, q: `^${pfx}`, limit: 10 })
      .then((d) => {
        if (stale) return;
        conflicts = (d.results ?? []).map((n) => ({
          pubkey: (n.pubkey || '').toLowerCase(),
          name: n.name || '(unnamed)'
        }));
      })
      .catch(() => {
        if (!stale) conflicts = [];
      })
      .finally(() => {
        if (!stale) conflictsLoading = false;
      });
    return () => {
      stale = true;
    };
  });

  // Derive a candidate prefix from a pasted pubkey.
  $effect(() => {
    const pk = candidatePubkey.toLowerCase().replace(/[^0-9a-f]/g, '');
    if (pk.length >= hexLen) candidate = pk.slice(0, hexLen);
  });

  const inputClass =
    'w-full rounded-md border border-edge bg-bg px-2.5 py-1.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none';
</script>

<svelte:head>
  <title>Prefix Finder — MeshCore Tools</title>
</svelte:head>

{#snippet helpTip(text, kind = '')}
  <Tooltip.Root>
    <Tooltip.Trigger
      class="inline-grid h-4 w-4 shrink-0 place-items-center rounded-full text-muted outline-none hover:text-accent focus-visible:text-accent focus-visible:ring-1 focus-visible:ring-accent"
      aria-label="More information"
    >
      <CircleQuestionMark size={13} aria-hidden="true" />
    </Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Content
        side="top"
        sideOffset={6}
        class="z-50 max-w-72 rounded-md border border-edge bg-elev2 px-3 py-2 text-xs leading-relaxed text-ink shadow-lg shadow-black/30"
      >
        {#if kind}
          <div class="mb-2 rounded-md border border-edge/80 bg-bg/70 px-2 py-2">
            {#if kind === 'space'}
              <div class="flex items-center gap-1.5 text-[10px]">
                <span class="rounded bg-elev2 px-1.5 py-0.5 text-muted">free</span>
                <span class="rounded bg-warn/15 px-1.5 py-0.5 text-warn">used</span>
                <span class="rounded bg-bad/15 px-1.5 py-0.5 text-bad">crowded</span>
              </div>
            {:else if kind === 'reserved'}
              <div class="flex items-center gap-1 text-[10px]">
                <span class="rounded bg-elev2 px-1.5 py-1 font-mono text-[10px] text-muted">00</span>
                <span class="rounded bg-accent/15 px-1.5 py-1 font-mono text-[10px] text-accent">01-FE</span>
                <span class="rounded bg-elev2 px-1.5 py-1 font-mono text-[10px] text-muted">FF</span>
              </div>
            {:else if kind === 'collision'}
              <div class="flex items-center gap-1.5 text-[10px]">
                <span class="rounded bg-warn/15 px-1.5 py-0.5 text-warn">2 nodes</span>
                <span class="text-muted">→</span>
                <span class="rounded bg-bad/15 px-1.5 py-0.5 text-bad">more crowded</span>
              </div>
            {/if}
          </div>
        {/if}
        {text}
        <Tooltip.Arrow class="text-edge" />
      </Tooltip.Content>
    </Tooltip.Portal>
  </Tooltip.Root>
{/snippet}

{#snippet labelHelp(label, help, kind = '')}
  <span class="inline-flex items-center gap-1">
    <span>{label}</span>
    {@render helpTip(help, kind)}
  </span>
{/snippet}

<section class="mx-auto w-full max-w-6xl px-4 py-8">
  <header class="mb-6 flex items-start gap-3">
    <span class="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-edge bg-elev text-accent">
      <Fingerprint size={22} />
    </span>
    <div>
      <h1 class="text-2xl font-semibold tracking-tight text-ink">Prefix Finder</h1>
      <p class="mt-1 text-sm text-dim">
        MeshCore routes on the first byte of a node’s public key. Pick Global or a network (and optionally a
        location), choose how wide a prefix to examine, then see which prefixes are taken, spot
        conflicts, and choose an uncrowded one for a new node.
      </p>
    </div>
  </header>

  <!-- Controls -->
  <div class="mb-6 rounded-2xl border border-edge bg-elev p-4">
    <div class="flex flex-wrap items-end gap-x-4 gap-y-3">
      <div class="block">
        <span class="mb-1 block text-xs font-medium text-dim">
          {@render labelHelp('Network', 'Choose a single MeshCore network catalog, or Global to count matching public-key prefixes across all observed nodes.')}
        </span>
        <div class="w-56">
          <Select bind:value={net} items={networkItems} placeholder="Choose a network…" />
        </div>
        {#if netLoadError}
          <span class="mt-1 block text-xs text-bad">Couldn’t load networks.</span>
        {/if}
      </div>

      <div class="block">
        <span class="mb-1 block text-xs font-medium text-dim">
          {@render labelHelp('Prefix width', 'How many leading public-key bytes to inspect. One byte shows MeshCore routing-prefix pressure; wider views help explore rarer vanity prefixes.', 'space')}
        </span>
        <SegmentedGroup
          bind:value={prefixBytes}
          size="sm"
          items={[
            { value: '1', label: '1 byte' },
            { value: '2', label: '2 bytes' },
            { value: '3', label: '3 bytes' }
          ]}
        />
      </div>

      <label class="inline-flex cursor-pointer items-center gap-2 pb-1.5 text-sm text-dim">
        <Checkbox bind:checked={useLocation} />
        {@render labelHelp('Limit to an area', 'Count only nodes near the chosen latitude/longitude within the selected radius. Useful when choosing a prefix for a local deployment.')}
      </label>

      <button
        type="button"
        onclick={run}
        disabled={loading || !net}
        class="ml-auto inline-flex items-center gap-1.5 rounded-md border border-accent/50 bg-accent/10 px-4 py-1.5 text-sm font-medium text-accent hover:bg-accent/20 disabled:opacity-50"
      >
        {#if loading}<Loader2 size={15} class="animate-spin" />{:else}<Search size={15} />{/if}
        Scan
      </button>
    </div>

    {#if useLocation}
      <div class="mt-4 flex flex-wrap items-end gap-x-4 gap-y-3 border-t border-edge pt-4">
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-dim">
            {@render labelHelp('Latitude', 'Center latitude for the area filter, in decimal degrees.')}
          </span>
          <input class="{inputClass} w-28" bind:value={lat} placeholder="50.075" />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-dim">
            {@render labelHelp('Longitude', 'Center longitude for the area filter, in decimal degrees.')}
          </span>
          <input class="{inputClass} w-28" bind:value={lon} placeholder="14.437" />
        </label>
        <div class="block w-56">
          <span class="mb-1 block text-xs font-medium text-dim">
            {@render labelHelp(`Radius — ${radiusKm} km`, 'Distance around the selected center point used for the local prefix count.')}
          </span>
          <div class="flex h-8 items-center">
            <Slider bind:value={radiusKm} min={1} max={200} step={1} />
          </div>
        </div>
        <button
          type="button"
          onclick={locate}
          class="inline-flex items-center gap-1.5 rounded-md border border-edge bg-bg px-3 py-1.5 text-sm text-dim hover:border-accent hover:text-ink"
        >
          <LocateFixed size={15} /> Use my location
        </button>
      </div>
    {/if}
  </div>

  {#if error}
    <p class="mb-4 flex items-center gap-1.5 text-sm text-bad"><TriangleAlert size={15} /> {error}</p>
  {/if}

  {#if analysis}
    <!-- Summary -->
    <div class="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div class="rounded-lg border border-edge bg-elev p-3">
        <div class="text-[10px] uppercase tracking-wide text-muted">
          {@render labelHelp('Nodes counted', 'Number of nodes included in this prefix scan after network and optional area filters.')}
        </div>
        <div class="mt-0.5 text-lg font-semibold text-ink">{analysis.counted.toLocaleString()}</div>
      </div>
      <div class="rounded-lg border border-edge bg-elev p-3">
        <div class="text-[10px] uppercase tracking-wide text-muted">
          {@render labelHelp('Prefixes used', 'How many distinct prefixes currently appear among the counted nodes.')}
        </div>
        <div class="mt-0.5 text-lg font-semibold text-warn">{analysis.usedCount.toLocaleString()}</div>
      </div>
      <div class="rounded-lg border border-edge bg-elev p-3">
        <div class="text-[10px] uppercase tracking-wide text-muted">
          {@render labelHelp('Prefix space', 'Total number of possible prefixes at the selected width: 256 for one byte, 65,536 for two bytes, and 16,777,216 for three bytes.', 'space')}
        </div>
        <div class="mt-0.5 text-lg font-semibold text-ink">{analysis.totalSpace.toLocaleString()}</div>
        <div class="text-[11px] text-muted">{hexLen} hex chars</div>
      </div>
      <div class="rounded-lg border border-edge bg-elev p-3">
        <div class="text-[10px] uppercase tracking-wide text-muted">
          {@render labelHelp('Collisions', 'Number of prefixes used by more than one counted node. Shared first-byte prefixes can create MeshCore route ambiguity.', 'collision')}
        </div>
        <div class="mt-0.5 text-lg font-semibold {analysis.collisions > 0 ? 'text-bad' : 'text-ok'}">
          {analysis.collisions.toLocaleString()}
        </div>
      </div>
    </div>

    <div class="grid gap-6 lg:grid-cols-[1fr_18rem]">
      <div class="rounded-2xl border border-edge bg-elev p-4">
        {#if hexLen === 2}
          <!-- The 16×16 prefix map (1-byte only) -->
          <div class="mb-3 flex items-center justify-between gap-3">
            <h2 class="inline-flex items-center gap-1 text-sm font-semibold text-ink">
              <span>Prefix map (00-ff)</span>
              {@render helpTip('Each cell is one first-byte prefix. Dark cells are free, colored cells are occupied, and 00/FF are reserved by MeshCore.', 'reserved')}
            </h2>
            <div class="flex items-center gap-2 text-[10px] text-muted">
              <span class="inline-flex items-center gap-1"><span class="h-2.5 w-2.5 rounded-sm bg-elev2"></span>free</span>
              <span class="inline-flex items-center gap-1">
                <span class="h-2.5 w-2.5 rounded-sm" style="background:repeating-linear-gradient(135deg, #1f2937 0 3px, #111827 3px 6px);"></span>
                reserved
              </span>
              <span class="inline-flex items-center gap-1">
                <span class="h-2.5 w-16 rounded-sm" style="background:linear-gradient(90deg, hsl(48 65% 45%), hsl(0 65% 45%));"></span>
                least → most
              </span>
            </div>
          </div>
          <div class="pf-grid">
            {#each analysis.counts as count, i (i)}
              <button
                type="button"
                onclick={() => (candidate = hex2(i))}
                title={isReservedMeshCorePrefix(hex2(i))
                  ? `${hex2(i)} — reserved by MeshCore`
                  : `${hex2(i)} — ${count} node${count === 1 ? '' : 's'}`}
                style={cellStyle(count, analysis.heatDomain, i === candidateIdx, isReservedMeshCorePrefix(hex2(i)))}
                class="flex aspect-square items-center justify-center rounded-sm font-mono text-[9px] leading-none {count
                  ? ''
                  : 'bg-elev2 text-muted'} {i === candidateIdx ? 'ring-2 ring-accent2' : ''}"
              >
                {hex2(i)}
              </button>
            {/each}
          </div>
          <p class="mt-3 text-xs text-muted">
            Each cell is a prefix (00–ff); colour shows how crowded it is. Prefixes 00 and ff are reserved.
          </p>
        {:else}
          <!-- Canvas heatmap of the whole space (too large for DOM cells) -->
          <div class="mb-3 flex items-center justify-between gap-3">
            <h2 class="inline-flex items-center gap-1 text-sm font-semibold text-ink">
              <span>Prefix map ({hexLen} hex · {analysis.totalSpace.toLocaleString()})</span>
              {@render helpTip('Canvas heatmap of the wider prefix space. Colored pixels are occupied prefixes; dark space is free. Zoom and hover to inspect exact prefixes.', 'space')}
            </h2>
            <div class="flex items-center gap-2 text-[10px] text-muted">
              <span class="inline-flex items-center gap-1"><span class="h-2.5 w-2.5 rounded-sm bg-elev2"></span>free</span>
              <span class="inline-flex items-center gap-1">
                <span class="h-2.5 w-16 rounded-sm" style="background:linear-gradient(90deg, hsl(48 65% 50%), hsl(0 65% 50%));"></span>
                least → most
              </span>
            </div>
          </div>
          {#if analysis.used.length === 0}
            <p class="py-8 text-center text-sm text-muted">No nodes matched.</p>
          {:else}
            <PrefixCanvas
              prefixes={analysis.used}
              bytes={Number(prefixBytes)}
              selected={candidateNorm}
              onpick={(p) => (candidate = p)}
            />
            <p class="mt-3 text-xs text-muted">
              Every prefix in the {analysis.totalSpace.toLocaleString()}-cell space; occupied ones are coloured by
              crowdedness. Hover to read a prefix, scroll to zoom, drag to pan, click to inspect it.
            </p>
          {/if}
        {/if}

        {#if analysis.topCollisions.length > 0}
          <div class="mt-4 border-t border-edge pt-3">
            <div class="mb-2 flex items-center gap-1.5 text-xs font-semibold text-ink">
              <TriangleAlert size={14} class="text-bad" />
              {@render labelHelp('Most collisions', 'The most crowded prefixes in this scan, capped to keep the page fast. Click one to inspect its nodes.', 'collision')}
            </div>
            <div class="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
              {#each analysis.topCollisions as c (c.prefix)}
                <button
                  type="button"
                  onclick={() => (candidate = c.prefix)}
                  class="flex items-center justify-between gap-2 rounded-md border border-edge bg-bg px-2.5 py-1.5 text-left hover:border-accent"
                  title={`${c.prefix} — ${c.count} nodes`}
                >
                  <span class="truncate font-mono text-xs text-ink">{c.prefix}</span>
                  <span class="shrink-0 text-[11px] font-medium text-bad">{c.count} nodes</span>
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <!-- Suggestions + candidate inspector -->
      <aside class="space-y-4">
        <div class="rounded-2xl border border-edge bg-elev p-4">
          <div class="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Sparkles size={15} class="text-accent" />
            {@render labelHelp('Suggested prefixes', 'For one byte, suggestions are the least-used non-reserved prefixes. For wider searches, suggestions are random currently-free prefixes.')}
          </div>
          <div class="flex flex-wrap gap-1.5">
            {#each analysis.suggestions as s (s.prefix)}
              <button
                type="button"
                onclick={() => (candidate = s.prefix)}
                class="rounded-md border px-2 py-1 font-mono text-xs {s.count === 0
                  ? 'border-ok/40 bg-ok/10 text-ok'
                  : 'border-edge bg-bg text-dim'} hover:border-accent"
                title={`${s.count} node${s.count === 1 ? '' : 's'}`}
              >
                {s.prefix}
              </button>
            {/each}
          </div>
          <p class="mt-2 text-[11px] text-muted">
            {hexLen === 2 ? 'Free prefixes first, then the least-used.' : 'Random free prefixes at this width.'}
          </p>
        </div>

        <div class="rounded-2xl border border-edge bg-elev p-4">
          <div class="mb-2 text-sm font-semibold text-ink">
            {@render labelHelp('Check a prefix', 'Enter a candidate prefix, or paste a full public key and the tool will take the leading bytes. Prefixes beginning with 00 or FF are reserved.', 'reserved')}
          </div>
          <div class="grid gap-2">
            <input
              class="{inputClass} font-mono"
              bind:value={candidate}
              maxlength={hexLen}
              placeholder={'e.g. ' + 'a3f19c'.slice(0, hexLen)}
              spellcheck="false"
            />
            <div class="text-center text-[10px] text-muted">or paste a full pubkey</div>
            <input
              class="{inputClass} font-mono"
              bind:value={candidatePubkey}
              placeholder="pubkey to check its prefix"
              spellcheck="false"
            />
          </div>

          {#if candidateNorm.length === hexLen}
            <div class="mt-3 border-t border-edge pt-3">
              {#if candidateReserved}
                <p class="text-sm text-bad">
                  {RESERVED_PREFIX_MESSAGE}
                </p>
              {:else if candidateCount === 0}
                <p class="text-sm text-ok">
                  Prefix <span class="font-mono font-semibold">{candidateNorm}</span> is free {scopeLabel}.
                </p>
              {:else}
                <p class="text-sm text-bad">
                  <span class="font-mono font-semibold">{candidateNorm}</span> is used by
                  {candidateCount} node{candidateCount === 1 ? '' : 's'} {scopeLabel}:
                </p>
                {#if conflictsLoading && conflicts.length === 0}
                  <p class="mt-2 flex items-center gap-1.5 text-xs text-muted">
                    <Loader2 size={13} class="animate-spin" /> Loading nodes…
                  </p>
                {:else}
                  <ul class="mt-2 space-y-1">
                    {#each conflicts as c (c.pubkey)}
                      <li>
                        <a
                          href={`${NODES_BASE}/${c.pubkey}`}
                          target="_blank"
                          rel="noreferrer"
                          class="flex items-center justify-between gap-2 rounded border border-edge bg-bg px-2 py-1 text-xs hover:border-accent"
                        >
                        <span class="truncate text-ink">{c.name}</span>
                        <span class="shrink-0 font-mono text-muted">{c.pubkey.slice(0, Math.max(8, hexLen))}…</span>
                        </a>
                      </li>
                    {/each}
                  </ul>
                  <a
                    href={showAllHref}
                    target="_blank"
                    rel="noreferrer"
                    class="mt-2 inline-flex text-xs font-medium text-accent hover:underline"
                  >
                    Show all
                  </a>
                {/if}
              {/if}
            </div>
          {/if}
        </div>
      </aside>
    </div>
  {:else if loading}
    <div class="flex items-center justify-center gap-2 py-20 text-sm text-dim">
      <Loader2 size={18} class="animate-spin" /> Scanning {selectedNetworkLabel}…
    </div>
  {/if}
</section>

<style>
  /* 16×16 prefix grid. Plain CSS (not Tailwind utilities) so 256 cells lay out
     in one pass without per-cell class churn. */
  .pf-grid {
    display: grid;
    grid-template-columns: repeat(16, minmax(0, 1fr));
    gap: 4px;
  }
</style>
