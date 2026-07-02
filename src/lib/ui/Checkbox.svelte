<script>
  // A themed checkbox built on bits-ui.
  import { Checkbox } from 'bits-ui';
  import { Check, Minus } from '@lucide/svelte';
  let { checked = $bindable(false), class: className = '', ...rest } = $props();
</script>

<Checkbox.Root
  bind:checked
  {...rest}
  class="grid size-4 shrink-0 cursor-pointer place-items-center rounded border border-edge bg-bg transition-colors data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=indeterminate]:border-accent data-[state=indeterminate]:bg-accent {className}"
>
  {#snippet children({ checked: c, indeterminate })}
    {#if indeterminate}
      <Minus class="size-3 text-bg" />
    {:else if c}
      <Check class="size-3 text-bg" />
    {/if}
  {/snippet}
</Checkbox.Root>
