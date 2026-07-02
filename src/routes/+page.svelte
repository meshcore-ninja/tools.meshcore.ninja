<script>
  import { base } from '$app/paths';
  import { ArrowRight } from '@lucide/svelte';
  import { TOOLS } from '$lib/tools.js';
</script>

<svelte:head>
  <title>MeshCore Tools</title>
  <meta
    name="description"
    content="A collection of small, focused MeshCore utilities — QR studio, airtime calculator, and prefix finder."
  />
</svelte:head>

<section class="mx-auto w-full max-w-6xl px-4">
  <div class="py-14 sm:py-20">
    <h1 class="mt-5 max-w-2xl text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
      Small, focused tools for MeshCore
    </h1>
    <p class="mt-4 max-w-2xl text-base leading-relaxed text-dim">
      Browser-based utilities that convert and explain MeshCore-specific data.
    </p>
  </div>

  <div class="grid gap-4 pb-16 sm:grid-cols-2 lg:grid-cols-3">
    {#each TOOLS as tool (tool.slug)}
      {@const Icon = tool.icon}
      <a
        href="{base}/{tool.slug}"
        class="group relative flex flex-col rounded-2xl border border-edge bg-elev p-5 transition-colors hover:border-accent/60 hover:bg-elev2"
      >
        <div class="flex items-center gap-3">
          <span class="grid h-11 w-11 place-items-center rounded-xl border border-edge bg-bg text-accent transition-colors group-hover:border-accent/50">
            <Icon size={22} />
          </span>
          <ArrowRight
            size={18}
            class="ml-auto text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
          />
        </div>
        <h2 class="mt-4 text-lg font-semibold text-ink">{tool.name}</h2>
        <p class="mt-0.5 text-sm font-medium text-accent/90">{tool.tagline}</p>
        <p class="mt-2 text-sm leading-relaxed text-dim">{tool.description}</p>
      </a>
    {/each}
  </div>
</section>
