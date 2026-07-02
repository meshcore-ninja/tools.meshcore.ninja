<script>
  // A themed segmented control built on bits-ui ToggleGroup. Always keeps one
  // item selected (clicking the active item is a no-op, not a deselect).
  // `items` are `{ value, label, icon? }` — icon is a Lucide component.
  import { ToggleGroup } from 'bits-ui';

  let { value = $bindable(), items = [], size = 'md', class: className = '' } = $props();

  const pad = $derived(size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm');
</script>

<ToggleGroup.Root
  type="single"
  {value}
  onValueChange={(v) => {
    if (v) value = v;
  }}
  class="inline-flex rounded-lg border border-edge bg-elev p-1 {className}"
>
  {#each items as item (item.value)}
    {@const Icon = item.icon}
    <ToggleGroup.Item
      value={item.value}
      class="inline-flex cursor-pointer items-center gap-1.5 rounded-md font-medium text-dim transition-colors hover:text-ink data-[state=on]:bg-accent/15 data-[state=on]:text-accent {pad}"
    >
      {#if Icon}<Icon size={size === 'sm' ? 14 : 15} />{/if}
      {item.label}
    </ToggleGroup.Item>
  {/each}
</ToggleGroup.Root>
