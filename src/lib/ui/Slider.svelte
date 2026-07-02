<script>
  // A themed single-value slider built on bits-ui.
  import { Slider } from 'bits-ui';
  let {
    value = $bindable(0),
    min = 0,
    max = 100,
    step = 1,
    class: className = '',
    ...rest
  } = $props();
</script>

<Slider.Root
  type="single"
  bind:value
  {min}
  {max}
  {step}
  {...rest}
  class="relative flex w-full touch-none select-none items-center {className}"
>
  {#snippet children({ thumbs })}
    <span class="relative h-1.5 w-full grow overflow-hidden rounded-full bg-elev2">
      <Slider.Range class="absolute h-full bg-accent" />
    </span>
    {#each thumbs as index (index)}
      <Slider.Thumb
        {index}
        class="block size-4 cursor-grab rounded-full border border-accent bg-bg shadow transition-colors hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 active:cursor-grabbing"
      />
    {/each}
  {/snippet}
</Slider.Root>
