<script>
  import { browser } from '$app/environment';
  import { Tooltip } from 'bits-ui';
  import { Timer, ArrowRightLeft, Package, Network, CircleQuestionMark } from '@lucide/svelte';
  import { meshNetworks } from '$lib/api.js';
  import Select from '$lib/ui/Select.svelte';
  import Switch from '$lib/ui/Switch.svelte';
  import SegmentedGroup from '$lib/ui/SegmentedGroup.svelte';
  import Slider from '$lib/ui/Slider.svelte';
  import NumberSlider from '$lib/ui/NumberSlider.svelte';
  import { BUILTIN_PRESETS, BW_OPTIONS, SF_OPTIONS, CR_OPTIONS } from '$lib/radioPresets.js';
  import {
    timeOnAir,
    meshCorePreamble,
    meshCoreTimeOnAir,
    bitRate,
    crFromString,
    networkLoad,
    collisionProbability,
    fmtDuration,
    fmtPct
  } from '$lib/airtime.js';

  const PROFILE_MESHCORE = 'meshcore';
  const PROFILE_STANDARD = 'standard';
  const profileItems = [
    { value: PROFILE_MESHCORE, label: 'MeshCore firmware' },
    { value: PROFILE_STANDARD, label: 'Standard LoRa' }
  ];

  // Radio configs A (+ optional B for comparison). Each carries the params that
  // drive time on air; frequency and TX power are informational context.
  function defaultConfig(over = {}) {
    return {
      bwKhz: 250,
      sf: 11,
      cr: '4/5',
      payload: 32,
      preamble: 8,
      packetHex: '',
      ...over
    };
  }

  function numberParam(params, key, fallback, { min = -Infinity, max = Infinity, allowed } = {}) {
    const raw = params.get(key);
    if (raw == null || raw === '') return fallback;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < min || n > max) return fallback;
    if (allowed && !allowed.includes(n)) return fallback;
    return n;
  }

  function stringParam(params, key, fallback, allowed) {
    const raw = params.get(key);
    if (raw == null) return fallback;
    if (allowed && !allowed.includes(raw)) return fallback;
    return raw;
  }

  function configFromParams(params, prefix, fallback) {
    return {
      bwKhz: numberParam(params, `${prefix}bw`, fallback.bwKhz, { allowed: BW_OPTIONS }),
      sf: numberParam(params, `${prefix}sf`, fallback.sf, { allowed: SF_OPTIONS }),
      cr: stringParam(params, `${prefix}cr`, fallback.cr, CR_OPTIONS),
      payload: numberParam(params, `${prefix}pl`, fallback.payload, { min: 1, max: 255 }),
      preamble: fallback.preamble,
      packetHex: stringParam(params, `${prefix}hex`, fallback.packetHex)
    };
  }

  // Paste a raw MeshCore packet (hex) to size the payload from it: LoRa time on
  // air is driven by the whole PHY payload, so the byte length is what matters.
  function sizeFromPacket(cfg) {
    const hex = (cfg.packetHex || '').replace(/[^0-9a-fA-F]/g, '');
    const bytes = Math.floor(hex.length / 2);
    if (bytes >= 1 && bytes <= 255) cfg.payload = bytes;
  }
  function packetBytes(cfg) {
    return Math.floor((cfg.packetHex || '').replace(/[^0-9a-fA-F]/g, '').length / 2);
  }

  // Two modes: a focused single-packet time-on-air calculator, and an optional
  // "network spread" that scales that packet across a whole mesh.
  let mode = $state('packet'); // 'packet' | 'spread'
  const spread = $derived(mode === 'spread');
  let profile = $state(PROFILE_MESHCORE);

  let a = $state(defaultConfig());
  let b = $state(defaultConfig({ sf: 9, payload: 32 }));
  let compare = $state(false);

  // Bound to the (action-style) preset pickers; reset to '' after each apply so
  // the trigger always reads "Load a preset…".
  let presetA = $state('');
  let presetB = $state('');

  // Shared network scenario: how many nodes, and how often each transmits. The
  // interval is a discrete slider over human-friendly values, which spans
  // seconds → a day far more legibly than one linear range.
  let nodes = $state(700);
  // Realistic MeshCore advert cadences — from a fairly chatty 30 min up to a
  // sparse repeater advert every few days.
  const INTERVALS = [
    { s: 1800, label: '30 min' },
    { s: 3600, label: '1 h' },
    { s: 7200, label: '2 h' },
    { s: 10800, label: '3 h' },
    { s: 14400, label: '4 h' },
    { s: 21600, label: '6 h' },
    { s: 28800, label: '8 h' },
    { s: 43200, label: '12 h' },
    { s: 64800, label: '18 h' },
    { s: 86400, label: '24 h' },
    { s: 129600, label: '36 h' },
    { s: 172800, label: '48 h' },
    { s: 259200, label: '72 h' }
  ];
  let intervalIdx = $state(INTERVALS.findIndex((x) => x.s === 43200)); // 12 h default
  const intervalSec = $derived(INTERVALS[intervalIdx].s);
  const intervalLabel = $derived(INTERVALS[intervalIdx].label);
  const txPerDay = $derived(intervalSec > 0 ? 86400 / intervalSec : 0);

  // Live network presets from the catalog (those declaring a radio config).
  let netPresets = $state([]);
  meshNetworks().then((cat) => {
    netPresets = Object.values(cat)
      .filter((n) => n?.radio?.spreading_factor && n?.radio?.bandwidth_khz)
      .map((n) => ({
        id: `net:${n.id}`,
        name: `${n.name}`,
        freqMhz: Number(n.radio.frequency_mhz) || 0,
        bwKhz: Number(n.radio.bandwidth_khz),
        sf: Number(n.radio.spreading_factor),
        cr: n.radio.coding_rate || '4/5',
        note: 'Live from the MeshCore network catalog.'
      }))
      .sort((x, y) => x.name.localeCompare(y.name));
  });

  // Preset picker options, grouped into built-in profiles and live networks.
  const presetGroups = $derived([
    { label: 'Profiles', items: BUILTIN_PRESETS.map((p) => ({ value: p.id, label: p.name })) },
    ...(netPresets.length
      ? [{ label: 'Networks (live)', items: netPresets.map((p) => ({ value: p.id, label: p.name })) }]
      : [])
  ]);

  function applyPreset(target, id) {
    if (!id) return;
    const p = [...BUILTIN_PRESETS, ...netPresets].find((x) => x.id === id);
    if (!p) return;
    if (target === 'a') a = { ...a, bwKhz: p.bwKhz, sf: p.sf, cr: p.cr };
    else b = { ...b, bwKhz: p.bwKhz, sf: p.sf, cr: p.cr };
  }

  // Derived per-config results. Everything downstream keys off the single ToA.
  function compute(cfg) {
    // Select-bound values arrive as strings; coerce the numeric radio params.
    const sf = Number(cfg.sf);
    const bwHz = Number(cfg.bwKhz) * 1000;
    const cr = crFromString(cfg.cr);
    const toaParams = {
      sf,
      bwHz,
      cr,
      payload: Number(cfg.payload)
    };
    const preambleSymbols =
      profile === PROFILE_MESHCORE ? meshCorePreamble(sf) : Number(cfg.preamble);
    const toa =
      profile === PROFILE_MESHCORE
        ? meshCoreTimeOnAir(toaParams)
        : timeOnAir({ ...toaParams, preamble: preambleSymbols });
    const rb = bitRate(sf, bwHz, cr);
    const load = networkLoad(toa.total, nodes, intervalSec);
    const framesPerSec = load.txPerHour / 3600;
    const collision = collisionProbability(toa.total, framesPerSec);
    // Scenario sweep: hold the per-node interval, vary the node count.
    const sweep = [100, 1000, 10000].map((n) => {
      const l = networkLoad(toa.total, n, intervalSec);
      return {
        nodes: n,
        dutyCycle: l.dutyCycle,
        collision: collisionProbability(toa.total, l.txPerHour / 3600)
      };
    });
    return { toa, rb, load, collision, sweep, preambleSymbols };
  }

  const ra = $derived(compute(a));
  const rb2 = $derived(compute(b));

  const inputClass =
    'w-full rounded-md border border-edge bg-bg px-2.5 py-1.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none';

  if (browser) {
    const params = new URLSearchParams(location.search);
    mode = stringParam(params, 'mode', 'packet', ['packet', 'spread']);
    profile = stringParam(params, 'profile', PROFILE_MESHCORE, [PROFILE_MESHCORE, PROFILE_STANDARD]);
    compare = params.get('compare') === '1';
    a = configFromParams(params, 'a_', defaultConfig());
    b = configFromParams(params, 'b_', defaultConfig({ sf: 9, payload: 32 }));
    nodes = numberParam(params, 'nodes', 700, { min: 1, max: 10000 });
    const interval = numberParam(params, 'interval', 43200, {
      allowed: INTERVALS.map((x) => x.s)
    });
    intervalIdx = Math.max(0, INTERVALS.findIndex((x) => x.s === interval));
  }

  function setIfNotDefault(params, key, value, fallback) {
    if (String(value) !== String(fallback)) params.set(key, String(value));
  }

  function writeConfigParams(params, prefix, cfg, fallback) {
    setIfNotDefault(params, `${prefix}bw`, cfg.bwKhz, fallback.bwKhz);
    setIfNotDefault(params, `${prefix}sf`, cfg.sf, fallback.sf);
    setIfNotDefault(params, `${prefix}cr`, cfg.cr, fallback.cr);
    setIfNotDefault(params, `${prefix}pl`, cfg.payload, fallback.payload);
    if (cfg.packetHex) params.set(`${prefix}hex`, cfg.packetHex);
  }

  $effect(() => {
    if (!browser) return;
    const params = new URLSearchParams();
    if (mode !== 'packet') params.set('mode', mode);
    if (profile !== PROFILE_MESHCORE) params.set('profile', profile);
    if (compare) params.set('compare', '1');
    writeConfigParams(params, 'a_', a, defaultConfig());
    if (compare) writeConfigParams(params, 'b_', b, defaultConfig({ sf: 9, payload: 32 }));
    if (mode === 'spread') {
      if (nodes !== 700) params.set('nodes', String(nodes));
      if (intervalSec !== 43200) params.set('interval', String(intervalSec));
    }
    const query = params.toString();
    const next = `${location.pathname}${query ? `?${query}` : ''}${location.hash}`;
    if (next !== `${location.pathname}${location.search}${location.hash}`) {
      history.replaceState(history.state, '', next);
    }
  });

  function dutyClass(d) {
    if (d >= 0.1) return 'text-bad';
    if (d >= 0.01) return 'text-warn';
    return 'text-ok';
  }
</script>

<svelte:head>
  <title>Airtime Calculator — MeshCore Tools</title>
</svelte:head>

{#snippet helpTip(text, kind = '', href = '', linkText = 'Learn more')}
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
            {#if kind === 'bandwidth'}
              <div class="flex flex-wrap items-center gap-1.5 text-[10px]">
                <span class="rounded bg-accent2/15 px-1.5 py-0.5 text-accent2">narrow</span>
                <span class="text-muted">longer symbols</span>
                <span class="text-muted">/</span>
                <span class="rounded bg-accent/15 px-1.5 py-0.5 text-accent">wide</span>
                <span class="text-muted">shorter symbols</span>
              </div>
            {:else if kind === 'spreading'}
              <div class="flex items-center gap-1 text-[10px]">
                <span class="rounded bg-accent/15 px-1.5 py-0.5 text-accent">SF7 fast</span>
                <span class="text-muted">→</span>
                <span class="rounded bg-accent/25 px-1.5 py-0.5 text-accent">SF9</span>
                <span class="text-muted">→</span>
                <span class="rounded bg-accent/35 px-1.5 py-0.5 text-accent">SF12 long</span>
              </div>
            {:else if kind === 'coding'}
              <div class="flex flex-wrap items-center gap-1.5 text-[10px]">
                <span class="rounded bg-accent/15 px-1.5 py-0.5 text-accent">4/5 less repair</span>
                <span class="text-muted">→</span>
                <span class="rounded bg-warn/15 px-1.5 py-0.5 text-warn">4/8 more repair</span>
              </div>
            {:else if kind === 'preamble'}
              <div class="flex items-center gap-1.5 text-[10px]">
                <span class="rounded bg-accent2/15 px-1.5 py-0.5 text-accent2">preamble</span>
                <span class="text-muted">then</span>
                <span class="rounded bg-accent/15 px-1.5 py-0.5 text-accent">encoded data</span>
              </div>
            {:else if kind === 'symbols'}
              <div class="flex flex-wrap items-center gap-1 text-[10px]">
                {#each ['symbol', 'symbol', 'symbol'] as label}
                  <span class="rounded bg-accent/15 px-1.5 py-0.5 text-accent">{label}</span>
                {/each}
                <span class="text-muted">not bytes</span>
              </div>
            {:else if kind === 'load'}
              <div class="flex items-center gap-1.5 text-[10px]">
                <span class="rounded bg-accent/15 px-1.5 py-0.5 text-accent">idle</span>
                <span class="text-muted">→</span>
                <span class="rounded bg-warn/15 px-1.5 py-0.5 text-warn">offered load</span>
                <span class="text-muted">→</span>
                <span class="rounded bg-bad/15 px-1.5 py-0.5 text-bad">busy</span>
              </div>
            {:else if kind === 'collision'}
              <div class="flex items-center gap-1.5 text-[10px]">
                <span class="rounded bg-accent/15 px-1.5 py-0.5 text-accent">frame A</span>
                <span class="rounded bg-bad/15 px-1.5 py-0.5 text-bad">overlaps B</span>
              </div>
            {/if}
          </div>
        {/if}
        {text}
        {#if href}
          <a class="mt-2 block text-accent2 hover:underline" href={href} target="_blank" rel="noreferrer">
            {linkText} ↗
          </a>
        {/if}
        <Tooltip.Arrow class="text-edge" />
      </Tooltip.Content>
    </Tooltip.Portal>
  </Tooltip.Root>
{/snippet}

{#snippet labelHelp(label, help, kind = '', href = '', linkText = 'Learn more')}
  <span class="inline-flex items-center gap-1">
    <span>{label}</span>
    {@render helpTip(help, kind, href, linkText)}
  </span>
{/snippet}

{#snippet configForm(cfg, target)}
  <div class="grid grid-cols-2 gap-3">
    <div class="col-span-2 block">
      <span class="mb-1 block text-xs font-medium text-dim">
        {@render labelHelp('Preset', 'Loads bandwidth, spreading factor and coding rate used by a known profile or MeshCore network. A preset is a convenient starting point; it does not verify your device configuration or legal limits at your frequency and location.')}
      </span>
      <Select
        placeholder="Load a preset…"
        groups={presetGroups}
        value={target === 'a' ? presetA : presetB}
        onValueChange={(v) => {
          applyPreset(target, v);
          if (target === 'a') presetA = '';
          else presetB = '';
        }}
      />
    </div>

    <div class="col-span-2 grid grid-cols-3 gap-3">
      <div class="block">
        <span class="mb-1 block text-xs font-medium text-dim">
          {@render labelHelp('Bandwidth (kHz)', 'The width of the LoRa radio channel. Wider bandwidth makes symbols shorter and reduces airtime; narrower bandwidth generally improves sensitivity but occupies the channel for longer.', 'bandwidth')}
        </span>
        <Select bind:value={cfg.bwKhz} items={BW_OPTIONS.map((bw) => ({ value: bw, label: `${bw}` }))} />
      </div>
      <div class="block">
        <span class="mb-1 block text-xs font-medium text-dim">
          {@render labelHelp('Spreading factor', 'Controls how many LoRa chips represent each symbol. Higher SF usually improves weak-signal reception, but it greatly increases symbol duration, packet airtime and channel usage.', 'spreading')}
        </span>
        <Select bind:value={cfg.sf} items={SF_OPTIONS.map((sf) => ({ value: sf, label: `SF${sf}` }))} />
      </div>
      <div class="block">
        <span class="mb-1 block text-xs font-medium text-dim">
          {@render labelHelp('Coding rate', 'Forward-error-correction redundancy. 4/5 has the least redundancy and shortest airtime; 4/8 adds the most redundancy and longest airtime. More redundancy can help with interference but does not guarantee reception.', 'coding')}
        </span>
        <Select bind:value={cfg.cr} items={CR_OPTIONS.map((cr) => ({ value: cr, label: cr }))} />
      </div>
    </div>
    <div class="col-span-2">
      <div class="mb-1 text-xs font-medium text-dim">
        {@render labelHelp('Payload', 'The number of bytes handed to the LoRa radio as the packet body. For a raw MeshCore packet, use the length of the entire raw packet, not only the message text. Airtime increases in symbol-sized steps.', 'symbols')}
      </div>
      <NumberSlider bind:value={cfg.payload} min={1} max={255} suffix="bytes" />
    </div>

    <label class="col-span-2 block">
      <span class="mb-1 block text-xs font-medium text-dim">
        {@render labelHelp('Or paste a packet (hex) to size the payload', 'Paste the complete raw packet as hexadecimal bytes. Spaces, line breaks and separators are ignored; every complete pair of hex digits counts as one byte. The calculator uses only the byte count; it does not decode or validate the packet.')}
      </span>
      <input
        class="{inputClass} font-mono"
        bind:value={cfg.packetHex}
        oninput={() => sizeFromPacket(cfg)}
        placeholder="e.g. 010a2b… — the whole PHY payload"
        spellcheck="false"
        autocapitalize="off"
      />
      {#if packetBytes(cfg) > 0}
        <span class="mt-1 block text-[11px] text-muted">
          {packetBytes(cfg)} bytes from packet → payload set to {Math.min(255, packetBytes(cfg))}.
        </span>
      {/if}
    </label>
  </div>
{/snippet}

{#snippet results(r, cfg)}
  <!-- Packet-level metrics: always shown -->
  <div class="grid grid-cols-2 gap-3">
    <div class="rounded-lg border border-edge bg-bg p-3">
      <div class="text-[10px] uppercase tracking-wide text-muted">
        {@render labelHelp('Time on air', 'The time from the beginning of the transmitted LoRa preamble until the end of the encoded packet. It is radio-channel occupancy, not end-to-end MeshCore message latency.', 'preamble')}
      </div>
      <div class="mt-0.5 text-lg font-semibold text-accent">{fmtDuration(r.toa.total)}</div>
      <div class="text-[11px] text-muted">
        {r.preambleSymbols} preamble · {r.toa.symbols} payload symbols{r.toa.lowDataRate ? ' · LDRO' : ''}
      </div>
    </div>
    <div class="rounded-lg border border-edge bg-bg p-3">
      <div class="text-[10px] uppercase tracking-wide text-muted">
        {@render labelHelp('Nominal PHY bit rate', 'The theoretical LoRa bit rate from bandwidth, spreading factor and coding rate. It does not include preamble, header, CRC or packet-boundary overhead. Actual useful throughput is lower.')}
      </div>
      <div class="mt-0.5 text-lg font-semibold text-ink">{(r.rb / 1000).toFixed(2)} kbps</div>
      <div class="text-[11px] text-muted">{cfg.payload} B payload</div>
    </div>
    <div class="col-span-2 rounded-lg border border-edge bg-bg p-3">
      <div class="text-[10px] uppercase tracking-wide text-muted">
        {@render labelHelp('Airtime breakdown', 'Shows how total transmission time is divided between receiver-detection overhead and the encoded data section. Longer MeshCore preambles can dominate very small packets.', 'preamble')}
      </div>
      <div class="mt-1 flex overflow-hidden rounded" style="height: 8px;">
        <div class="h-full bg-accent2" style="width: {(r.toa.preamble / r.toa.total) * 100}%" title="Preamble"></div>
        <div class="h-full bg-accent" style="width: {(r.toa.payload / r.toa.total) * 100}%" title="Payload"></div>
      </div>
      <div class="mt-1.5 flex justify-between text-[11px] text-muted">
        <span><span class="text-accent2">■</span> Preamble {fmtDuration(r.toa.preamble)}</span>
        <span><span class="text-accent">■</span> Encoded data {fmtDuration(r.toa.payload)}</span>
      </div>
    </div>

    {#if spread}
      <div class="rounded-lg border border-edge bg-bg p-3">
        <div class="text-[10px] uppercase tracking-wide text-muted">
          {@render labelHelp('Packets / hour', 'Average number of originating transmissions produced by all modelled nodes in one hour. This is a traffic rate; packets may still cluster because nodes are not synchronised.')}
        </div>
        <div class="mt-0.5 text-lg font-semibold text-ink">{Math.round(r.load.txPerHour).toLocaleString()}</div>
        <div class="text-[11px] text-muted">≈ one every {fmtDuration(r.load.secondsBetweenTx)}</div>
      </div>
      <div class="rounded-lg border border-edge bg-bg p-3">
        <div class="text-[10px] uppercase tracking-wide text-muted">
          {@render labelHelp('Offered channel load', 'The sum of all calculated packet airtimes divided by the observation period. A value of 5% means the model generates airtime equal to 5% of one hour. This is aggregate channel load, not a regulatory per-device duty cycle.', 'load')}
        </div>
        <div class="mt-0.5 text-lg font-semibold {dutyClass(r.load.dutyCycle)}">{fmtPct(r.load.dutyCycle)}</div>
        <div class="text-[11px] text-muted">{fmtDuration(r.load.airtimePerHourSec)} of airtime / hour</div>
      </div>
      <div class="rounded-lg border border-edge bg-bg p-3">
        <div class="text-[10px] uppercase tracking-wide text-muted">
          {@render labelHelp('Traffic / node / day', 'How much airtime one modelled node contributes per day at the selected interval, before accounting for forwarding, rebroadcasts, retries or replies.')}
        </div>
        <div class="mt-0.5 text-lg font-semibold text-ink">{fmtDuration(r.load.airtimePerNodePerDaySec)}</div>
        <div class="text-[11px] text-muted">of airtime each</div>
      </div>
      <div class="rounded-lg border border-edge bg-bg p-3">
        <div class="text-[10px] uppercase tracking-wide text-muted">
          {@render labelHelp('Collision pressure', 'A rough unslotted-ALOHA estimate of the chance that a frame overlaps at least one other frame. It is useful as a relative warning light, not a full MeshCore simulation.', 'collision')}
        </div>
        <div class="mt-0.5 text-lg font-semibold {dutyClass(r.collision)}">{fmtPct(r.collision)}</div>
        <div class="text-[11px] text-muted">chance a frame overlaps</div>
      </div>
    {/if}
  </div>

  {#if spread}
    <!-- Utilisation bar -->
    <div class="mt-3">
      <div class="h-2 w-full overflow-hidden rounded-full bg-edge">
        <div
          class="h-full rounded-full {r.load.dutyCycle >= 0.1 ? 'bg-bad' : r.load.dutyCycle >= 0.01 ? 'bg-warn' : 'bg-accent'}"
          style="width: {Math.min(100, r.load.dutyCycle * 100).toFixed(2)}%"
        ></div>
      </div>
      <div class="mt-1 flex justify-between text-[10px] text-muted">
        <span>0%</span><span>1% per-device reference</span><span>100%</span>
      </div>
    </div>

    <!-- Scenario sweep -->
    <div class="mt-4 overflow-hidden rounded-lg border border-edge">
      <div class="bg-elev2 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted">
        What happens as the network grows (same {intervalLabel} interval)
      </div>
      <table class="w-full text-left text-xs">
        <thead class="text-muted">
          <tr class="border-b border-edge">
            <th class="px-3 py-1.5 font-medium">
              {@render labelHelp('Nodes', 'Number of nodes assumed to generate this type of transmission. Count only nodes that actually send the modelled packet at the selected interval.')}
            </th>
            <th class="px-3 py-1.5 text-right font-medium">
              {@render labelHelp('Channel use', 'Aggregate offered channel load for this node count and interval. It is not the regulatory duty cycle of a single device.', 'load')}
            </th>
            <th class="px-3 py-1.5 text-right font-medium">
              {@render labelHelp('Collision', 'Estimated probability that a frame overlaps another frame under the simplified unslotted-ALOHA model.', 'collision')}
            </th>
          </tr>
        </thead>
        <tbody>
          {#each r.sweep as s (s.nodes)}
            <tr class="border-b border-edge/50 last:border-0">
              <td class="px-3 py-1.5 font-mono text-ink">{s.nodes.toLocaleString()}</td>
              <td class="px-3 py-1.5 text-right font-mono {dutyClass(s.dutyCycle)}">{fmtPct(s.dutyCycle)}</td>
              <td class="px-3 py-1.5 text-right font-mono {dutyClass(s.collision)}">{fmtPct(s.collision)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
{/snippet}

<section class="mx-auto w-full max-w-6xl px-4 py-8">
  <header class="mb-6 flex items-start gap-3">
    <span class="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-edge bg-elev text-accent">
      <Timer size={22} />
    </span>
    <div>
      <h1 class="text-2xl font-semibold tracking-tight text-ink">Airtime Calculator</h1>
      <p class="mt-1 text-sm text-dim">
        {#if spread}
          Scale one packet across a whole mesh — “700 repeaters advertising every 12 hours” — with
          aggregate channel utilisation and collision pressure.
        {:else}
          LoRa time on air and bit rate for a single packet. Paste a raw packet or set the payload,
          then turn on network spread to scale it across a mesh.
        {/if}
      </p>
    </div>
  </header>

  <!-- Mode + compare toolbar -->
  <div class="mb-6 flex flex-wrap items-center gap-4">
    <SegmentedGroup
      bind:value={mode}
      items={[
        { value: 'packet', label: 'Single packet', icon: Package },
        { value: 'spread', label: 'Network spread', icon: Network }
      ]}
    />
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-xs font-medium text-dim">
        {@render labelHelp('Calculation profile', 'Selects packet-format assumptions used by the calculation. MeshCore firmware mode uses the current MeshCore adaptive preamble; generic LoRa uses a common 8-symbol preamble.', 'preamble')}
      </span>
      <SegmentedGroup bind:value={profile} size="sm" items={profileItems} />
    </div>
    <label class="ml-auto inline-flex cursor-pointer items-center gap-2.5 text-sm text-dim">
      <Switch bind:checked={compare} />
      Compare a second config
    </label>
  </div>

  {#if spread}
    <!-- Network scenario (spread mode only) -->
    <div class="mb-6 grid gap-5 rounded-2xl border border-edge bg-elev p-4 sm:grid-cols-2">
      <div>
        <div class="mb-1 text-xs font-medium text-dim">
          {@render labelHelp('Number of nodes', 'The number of nodes assumed to generate this type of transmission. Count only nodes that actually send the modelled packet at the selected interval, not every device that merely exists in the network.')}
        </div>
        <NumberSlider bind:value={nodes} min={1} max={10000} suffix="nodes" />
      </div>
      <div>
        <div class="mb-1 flex items-baseline justify-between gap-2">
          <span class="text-xs font-medium text-dim">
            {@render labelHelp('Each transmits every', 'Average time between transmissions from each modelled node. For example, 700 nodes transmitting once every 12 hours produce 1,400 originating transmissions per day before rebroadcasts or retries.')}
          </span>
          <span class="font-mono text-xs text-ink">
            {intervalLabel} · {Math.round(txPerDay).toLocaleString()}/day
          </span>
        </div>
        <div class="flex h-8 items-center">
          <Slider bind:value={intervalIdx} min={0} max={INTERVALS.length - 1} step={1} />
        </div>
      </div>
    </div>
  {/if}

  <div class="grid gap-6 {compare ? 'lg:grid-cols-2' : ''}">
    <!-- Config A -->
    <div class="rounded-2xl border border-edge bg-elev p-5">
      <div class="mb-4 flex items-center gap-2">
        <span class="grid h-6 w-6 place-items-center rounded-md bg-accent/15 text-xs font-bold text-accent">A</span>
        <h2 class="text-sm font-semibold text-ink">Config A</h2>
      </div>
      {@render configForm(a, 'a')}
      <div class="mt-5 border-t border-edge pt-5">
        {@render results(ra, a)}
      </div>
    </div>

    {#if compare}
      <div class="rounded-2xl border border-edge bg-elev p-5">
        <div class="mb-4 flex items-center gap-2">
          <span class="grid h-6 w-6 place-items-center rounded-md bg-accent2/15 text-xs font-bold text-accent2">B</span>
          <h2 class="text-sm font-semibold text-ink">Config B</h2>
        </div>
        {@render configForm(b, 'b')}
        <div class="mt-5 border-t border-edge pt-5">
          {@render results(rb2, b)}
        </div>
      </div>
    {/if}
  </div>

  {#if compare}
    <div class="mt-6 flex items-center justify-center gap-3 rounded-xl border border-edge bg-elev px-4 py-3 text-sm">
      <ArrowRightLeft size={16} class="text-muted" />
      <span class="text-dim">
        B is
        <strong class="text-ink">{(ra.toa.total / rb2.toa.total).toFixed(2)}×</strong>
        {ra.toa.total >= rb2.toa.total ? 'faster' : 'slower'} on air than A
        ({fmtDuration(ra.toa.total)} vs {fmtDuration(rb2.toa.total)}){#if spread}, and uses
          <strong class="text-ink">{fmtPct(rb2.load.dutyCycle)}</strong>
          of the channel vs A’s <strong class="text-ink">{fmtPct(ra.load.dutyCycle)}</strong>{/if}.
      </span>
    </div>
  {/if}

  <p class="mx-auto mt-6 max-w-3xl text-center text-xs leading-relaxed text-muted">
    Time on air uses the Semtech LoRa reference formula (explicit header, CRC on, low-data-rate
    optimisation auto-enabled when the symbol time exceeds 16 ms). MeshCore firmware mode uses
    MeshCore’s adaptive preamble: 32 symbols for SF5-SF8 and 16 for SF9-SF12. Network spread is
    aggregate offered channel load, not a regulatory per-device duty cycle. Collision pressure is
    a rough unslotted-ALOHA estimate — real meshes add flood re-broadcasts and CSMA, so treat it
    as a relative gauge, not a guarantee.
  </p>
</section>
