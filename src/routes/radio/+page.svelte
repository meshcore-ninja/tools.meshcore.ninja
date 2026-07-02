<script>
  import { RadioTower, ArrowRightLeft } from '@lucide/svelte';
  import { meshNetworks } from '$lib/api.js';
  import Select from '$lib/ui/Select.svelte';
  import Switch from '$lib/ui/Switch.svelte';
  import { BUILTIN_PRESETS, BW_OPTIONS, SF_OPTIONS, CR_OPTIONS } from '$lib/radioPresets.js';
  import {
    timeOnAir,
    bitRate,
    crFromString,
    networkLoad,
    collisionProbability,
    fmtDuration,
    fmtPct
  } from '$lib/airtime.js';

  // Radio configs A (+ optional B for comparison). Each carries the params that
  // drive time on air; frequency and TX power are informational context.
  function defaultConfig(over = {}) {
    return {
      freqMhz: 869.525,
      bwKhz: 250,
      sf: 11,
      cr: '4/5',
      payload: 32,
      preamble: 8,
      txPower: 22,
      ...over
    };
  }

  let a = $state(defaultConfig());
  let b = $state(defaultConfig({ sf: 9, payload: 32 }));
  let compare = $state(false);

  // Bound to the (action-style) preset pickers; reset to '' after each apply so
  // the trigger always reads "Load a preset…".
  let presetA = $state('');
  let presetB = $state('');

  // Shared network scenario: how many nodes, and how often each transmits.
  let nodes = $state(700);
  let intervalValue = $state(12);
  let intervalUnit = $state('hours'); // seconds | minutes | hours
  const UNIT_SEC = { seconds: 1, minutes: 60, hours: 3600 };
  const intervalSec = $derived(intervalValue * UNIT_SEC[intervalUnit]);

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
    if (target === 'a') a = { ...a, freqMhz: p.freqMhz, bwKhz: p.bwKhz, sf: p.sf, cr: p.cr };
    else b = { ...b, freqMhz: p.freqMhz, bwKhz: p.bwKhz, sf: p.sf, cr: p.cr };
  }

  // Derived per-config results. Everything downstream keys off the single ToA.
  function compute(cfg) {
    // Select-bound values arrive as strings; coerce the numeric radio params.
    const sf = Number(cfg.sf);
    const bwHz = Number(cfg.bwKhz) * 1000;
    const cr = crFromString(cfg.cr);
    const toa = timeOnAir({
      sf,
      bwHz,
      cr,
      payload: Number(cfg.payload),
      preamble: cfg.preamble
    });
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
    return { toa, rb, load, collision, sweep };
  }

  const ra = $derived(compute(a));
  const rb2 = $derived(compute(b));

  const inputClass =
    'w-full rounded-md border border-edge bg-bg px-2.5 py-1.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none';

  function dutyClass(d) {
    if (d >= 0.1) return 'text-bad';
    if (d >= 0.01) return 'text-warn';
    return 'text-ok';
  }
</script>

<svelte:head>
  <title>Radio & Airtime Calculator — MeshCore Tools</title>
</svelte:head>

{#snippet configForm(cfg, target)}
  <div class="grid grid-cols-2 gap-3">
    <div class="col-span-2 block">
      <span class="mb-1 block text-xs font-medium text-dim">Preset</span>
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

    <label class="block">
      <span class="mb-1 block text-xs font-medium text-dim">Frequency (MHz)</span>
      <input class={inputClass} type="number" step="0.001" bind:value={cfg.freqMhz} />
    </label>
    <div class="block">
      <span class="mb-1 block text-xs font-medium text-dim">Bandwidth (kHz)</span>
      <Select bind:value={cfg.bwKhz} items={BW_OPTIONS.map((bw) => ({ value: bw, label: `${bw}` }))} />
    </div>
    <div class="block">
      <span class="mb-1 block text-xs font-medium text-dim">Spreading factor</span>
      <Select bind:value={cfg.sf} items={SF_OPTIONS.map((sf) => ({ value: sf, label: `SF${sf}` }))} />
    </div>
    <div class="block">
      <span class="mb-1 block text-xs font-medium text-dim">Coding rate</span>
      <Select bind:value={cfg.cr} items={CR_OPTIONS.map((cr) => ({ value: cr, label: cr }))} />
    </div>
    <label class="block">
      <span class="mb-1 block text-xs font-medium text-dim">Payload (bytes)</span>
      <input class={inputClass} type="number" min="1" max="255" bind:value={cfg.payload} />
    </label>
    <label class="block">
      <span class="mb-1 block text-xs font-medium text-dim">TX power (dBm)</span>
      <input class={inputClass} type="number" bind:value={cfg.txPower} />
    </label>
  </div>
{/snippet}

{#snippet results(r, cfg)}
  <div class="grid grid-cols-2 gap-3">
    <div class="rounded-lg border border-edge bg-bg p-3">
      <div class="text-[10px] uppercase tracking-wide text-muted">Time on air</div>
      <div class="mt-0.5 text-lg font-semibold text-accent">{fmtDuration(r.toa.total)}</div>
      <div class="text-[11px] text-muted">{r.toa.symbols} payload symbols{r.toa.lowDataRate ? ' · LDRO' : ''}</div>
    </div>
    <div class="rounded-lg border border-edge bg-bg p-3">
      <div class="text-[10px] uppercase tracking-wide text-muted">Bit rate</div>
      <div class="mt-0.5 text-lg font-semibold text-ink">{(r.rb / 1000).toFixed(2)} kbps</div>
      <div class="text-[11px] text-muted">{cfg.payload} B payload</div>
    </div>
    <div class="rounded-lg border border-edge bg-bg p-3">
      <div class="text-[10px] uppercase tracking-wide text-muted">Packets / hour</div>
      <div class="mt-0.5 text-lg font-semibold text-ink">{Math.round(r.load.txPerHour).toLocaleString()}</div>
      <div class="text-[11px] text-muted">≈ one every {fmtDuration(r.load.secondsBetweenTx)}</div>
    </div>
    <div class="rounded-lg border border-edge bg-bg p-3">
      <div class="text-[10px] uppercase tracking-wide text-muted">Channel utilisation</div>
      <div class="mt-0.5 text-lg font-semibold {dutyClass(r.load.dutyCycle)}">{fmtPct(r.load.dutyCycle)}</div>
      <div class="text-[11px] text-muted">{fmtDuration(r.load.airtimePerHourSec)} of airtime / hour</div>
    </div>
    <div class="rounded-lg border border-edge bg-bg p-3">
      <div class="text-[10px] uppercase tracking-wide text-muted">Traffic / node / day</div>
      <div class="mt-0.5 text-lg font-semibold text-ink">{fmtDuration(r.load.airtimePerNodePerDaySec)}</div>
      <div class="text-[11px] text-muted">of airtime each</div>
    </div>
    <div class="rounded-lg border border-edge bg-bg p-3">
      <div class="text-[10px] uppercase tracking-wide text-muted">Collision pressure</div>
      <div class="mt-0.5 text-lg font-semibold {dutyClass(r.collision)}">{fmtPct(r.collision)}</div>
      <div class="text-[11px] text-muted">chance a frame overlaps</div>
    </div>
  </div>

  <!-- Utilisation bar -->
  <div class="mt-3">
    <div class="h-2 w-full overflow-hidden rounded-full bg-edge">
      <div
        class="h-full rounded-full {r.load.dutyCycle >= 0.1 ? 'bg-bad' : r.load.dutyCycle >= 0.01 ? 'bg-warn' : 'bg-accent'}"
        style="width: {Math.min(100, r.load.dutyCycle * 100).toFixed(2)}%"
      ></div>
    </div>
    <div class="mt-1 flex justify-between text-[10px] text-muted">
      <span>0%</span><span>1% EU duty limit</span><span>100%</span>
    </div>
  </div>

  <!-- Scenario sweep -->
  <div class="mt-4 overflow-hidden rounded-lg border border-edge">
    <div class="bg-elev2 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted">
      What happens as the network grows (same {intervalValue}{intervalUnit[0]} interval)
    </div>
    <table class="w-full text-left text-xs">
      <thead class="text-muted">
        <tr class="border-b border-edge">
          <th class="px-3 py-1.5 font-medium">Nodes</th>
          <th class="px-3 py-1.5 text-right font-medium">Channel use</th>
          <th class="px-3 py-1.5 text-right font-medium">Collision</th>
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
{/snippet}

<section class="mx-auto w-full max-w-6xl px-4 py-8">
  <header class="mb-6 flex items-start gap-3">
    <span class="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-edge bg-elev text-accent">
      <RadioTower size={22} />
    </span>
    <div>
      <h1 class="text-2xl font-semibold tracking-tight text-ink">Radio & Airtime Calculator</h1>
      <p class="mt-1 text-sm text-dim">
        LoRa time on air, then scaled to a whole mesh — “700 repeaters advertising every 12 hours”
        — with duty cycle and collision pressure. Turn on compare to weigh two radio profiles.
      </p>
    </div>
  </header>

  <!-- Network scenario -->
  <div class="mb-6 flex flex-wrap items-end gap-4 rounded-2xl border border-edge bg-elev p-4">
    <label class="block">
      <span class="mb-1 block text-xs font-medium text-dim">Number of nodes</span>
      <input class="{inputClass} w-32" type="number" min="1" bind:value={nodes} />
    </label>
    <div class="block">
      <span class="mb-1 block text-xs font-medium text-dim">Each transmits every</span>
      <div class="flex gap-2">
        <input class="{inputClass} w-24" type="number" min="1" bind:value={intervalValue} />
        <div class="w-28">
          <Select
            bind:value={intervalUnit}
            items={[
              { value: 'seconds', label: 'seconds' },
              { value: 'minutes', label: 'minutes' },
              { value: 'hours', label: 'hours' }
            ]}
          />
        </div>
      </div>
    </div>
    <label class="ml-auto inline-flex cursor-pointer items-center gap-2.5 pb-1.5 text-sm text-dim">
      <Switch bind:checked={compare} />
      Compare a second config
    </label>
  </div>

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
        ({fmtDuration(ra.toa.total)} vs {fmtDuration(rb2.toa.total)}), and uses
        <strong class="text-ink">{fmtPct(rb2.load.dutyCycle)}</strong>
        of the channel vs A’s <strong class="text-ink">{fmtPct(ra.load.dutyCycle)}</strong>.
      </span>
    </div>
  {/if}

  <p class="mx-auto mt-6 max-w-3xl text-center text-xs leading-relaxed text-muted">
    Time on air uses the Semtech LoRa reference formula (explicit header, CRC on, low-data-rate
    optimisation auto-enabled when the symbol time exceeds 16 ms). Collision pressure is a rough
    unslotted-ALOHA estimate — real meshes add flood re-broadcasts and CSMA, so treat it as a
    relative gauge, not a guarantee.
  </p>
</section>
