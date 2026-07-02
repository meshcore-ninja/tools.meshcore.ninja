<script>
  // A themed single-select built on bits-ui, matching the MeshCore Ninja look.
  // `items` are `{ value, label }` (values are coerced to strings for bits-ui,
  // so bind to string state). Optional `groups` render labelled sections.
  import { Select } from 'bits-ui';
  import { Check, ChevronDown } from '@lucide/svelte';

  let {
    value = $bindable(),
    items = [],
    groups = null, // [{ label, items:[{value,label}] }] — overrides `items` when set
    placeholder = 'Select…',
    class: className = '',
    onValueChange = undefined,
    ...rest
  } = $props();

  const flat = $derived(groups ? groups.flatMap((g) => g.items) : items);
  const selected = $derived(flat.find((i) => String(i.value) === String(value)));
</script>

<Select.Root type="single" bind:value {onValueChange} {...rest}>
  <Select.Trigger
    class="inline-flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-edge bg-bg px-2.5 py-1.5 text-sm hover:border-accent focus:border-accent focus:outline-none data-[state=open]:border-accent {className}"
  >
    <span class="truncate {selected ? 'text-ink' : 'text-muted'}">{selected?.label ?? placeholder}</span>
    <ChevronDown class="size-4 shrink-0 text-muted" />
  </Select.Trigger>
  <Select.Portal>
    <Select.Content
      sideOffset={6}
      class="z-50 max-h-72 w-[var(--bits-select-anchor-width)] min-w-[var(--bits-select-anchor-width)] overflow-y-auto rounded-lg border border-edge bg-elev2 p-1 text-sm text-ink shadow-lg shadow-black/30 outline-none"
    >
      <Select.Viewport>
        {#snippet item(it)}
          <Select.Item
            value={String(it.value)}
            label={it.label}
            class="flex cursor-pointer select-none items-center justify-between gap-2 rounded-md px-2 py-1.5 outline-none data-[highlighted]:bg-accent/15 data-[highlighted]:text-accent data-[state=checked]:text-accent"
          >
            {#snippet children({ selected: isSel })}
              <span class="truncate">{it.label}</span>
              {#if isSel}<Check class="size-4 shrink-0" />{/if}
            {/snippet}
          </Select.Item>
        {/snippet}

        {#if groups}
          {#each groups as g, gi (g.label)}
            {#if gi > 0}<div class="my-1 h-px bg-edge" role="separator"></div>{/if}
            <Select.Group>
              <Select.GroupHeading class="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                {g.label}
              </Select.GroupHeading>
              {#each g.items as it (it.value)}{@render item(it)}{/each}
            </Select.Group>
          {/each}
        {:else}
          {#each items as it (it.value)}{@render item(it)}{/each}
        {/if}
      </Select.Viewport>
    </Select.Content>
  </Select.Portal>
</Select.Root>
