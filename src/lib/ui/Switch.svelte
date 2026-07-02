<script>
  // A themed on/off switch built on bits-ui.
  import { Switch } from 'bits-ui';
  let { checked = $bindable(false), class: className = '', ...rest } = $props();
</script>

<Switch.Root
  bind:checked
  {...rest}
  class="inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-edge transition-colors data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=unchecked]:bg-elev2 {className}"
>
  <Switch.Thumb
    class="pointer-events-none block size-3.5 rounded-full bg-dim shadow transition-transform data-[state=checked]:translate-x-4 data-[state=checked]:bg-bg data-[state=unchecked]:translate-x-0.5"
  />
</Switch.Root>
