<script>
  // A labelled numeric control: a bits-ui slider paired with a number box for
  // precise entry. Two-way binds a single number.
  import Slider from './Slider.svelte';

  let {
    value = $bindable(0),
    label = '',
    min = 0,
    max = 100,
    step = 1,
    suffix = '',
    class: className = ''
  } = $props();

  // The slider is clamped to [min,max]; the number box may hold an exact value.
  const sliderValue = $derived(Math.min(max, Math.max(min, Number(value) || 0)));
  function onSlider(v) {
    value = v;
  }
</script>

<div class={className}>
  {#if label}
    <div class="mb-1 flex items-baseline justify-between gap-2">
      <span class="text-xs font-medium text-dim">{label}</span>
      <span class="font-mono text-xs text-ink">{value}{suffix ? ` ${suffix}` : ''}</span>
    </div>
  {/if}
  <div class="flex items-center gap-3">
    <div class="flex h-8 flex-1 items-center">
      <Slider value={sliderValue} onValueChange={onSlider} {min} {max} {step} />
    </div>
    <input
      type="number"
      {min}
      {max}
      {step}
      bind:value
      class="w-20 rounded-md border border-edge bg-bg px-2 py-1 text-sm text-ink focus:border-accent focus:outline-none"
    />
  </div>
</div>
