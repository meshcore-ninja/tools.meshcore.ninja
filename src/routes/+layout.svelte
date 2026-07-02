<script>
  import '../app.css';
  import { base } from '$app/paths';
  import { page } from '$app/stores';
  import { TOOLS } from '$lib/tools.js';

  let { children } = $props();

  let theme = $state('dark');
  $effect(() => {
    theme = document.documentElement.getAttribute('data-theme') || 'dark';
  });
  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('theme', theme);
    } catch (e) {
      /* ignore */
    }
  }

  // The current tool slug, for highlighting the active nav item.
  const slug = $derived($page.url.pathname.replace(base, '').replace(/^\/+/, '').split('/')[0]);
</script>

<div class="flex min-h-screen flex-col">
  <header class="border-b border-edge">
    <div class="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
      <a href="{base}/" class="flex shrink-0 items-center gap-2 font-semibold tracking-tight">
        <span class="text-accent">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
            <path d="M16 4l12 12-12 12L4 16z" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" />
            <circle cx="16" cy="16" r="3" fill="currentColor" />
          </svg>
        </span>
        <span class="hidden sm:inline">tools.meshcore.ninja</span>
        <span class="sm:hidden">tools</span>
      </a>

      <nav class="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {#each TOOLS as tool (tool.slug)}
          {@const Icon = tool.icon}
          <a
            href="{base}/{tool.slug}"
            class="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium {slug ===
            tool.slug
              ? 'bg-accent/10 text-accent'
              : 'text-dim hover:bg-elev hover:text-ink'}"
          >
            <Icon size={15} />
            <span class="hidden md:inline">{tool.name}</span>
            <span class="md:hidden">{tool.name.split(' ')[0]}</span>
          </a>
        {/each}
      </nav>

      <button
        type="button"
        onclick={toggleTheme}
        class="shrink-0 cursor-pointer rounded-md border border-edge bg-bg px-2 py-1 text-sm text-dim hover:border-accent hover:text-ink"
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? '☀' : '☾'}
      </button>
    </div>
  </header>

  <main class="flex min-w-0 flex-1 flex-col pb-12">
    {@render children?.()}
  </main>

  <footer class="border-t border-edge text-xs text-dim">
    <div class="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <span class="text-center sm:text-left">
        Part of the
        <a class="foot-link" href="https://meshcore.ninja" target="_blank" rel="noreferrer">MeshCore Ninja</a>
        ecosystem ·
        <a class="foot-link" href="https://github.com/meshcore-ninja/tools.meshcore.ninja" target="_blank" rel="noreferrer">source code</a>
      </span>
      <div class="flex items-center justify-center gap-4 sm:justify-end">
        <a class="foot-link" href="https://nodes.meshcore.ninja" target="_blank" rel="noreferrer">Nodes <span class="arrow">↗</span></a>
        <a class="foot-link" href="https://map.meshcore.ninja" target="_blank" rel="noreferrer">Map <span class="arrow">↗</span></a>
      </div>
    </div>
  </footer>
</div>

<style>
  /* Footer links: an accent underline sweeps in from the left with a soft glow —
     the same restrained flourish used across the MeshCore Ninja sites. */
  .foot-link {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 0.15em;
    color: inherit;
    text-decoration: none;
    transition:
      color 0.2s ease,
      text-shadow 0.2s ease;
  }

  .foot-link::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: -2px;
    height: 1px;
    width: 100%;
    transform: scaleX(0);
    transform-origin: left;
    background: linear-gradient(90deg, var(--color-accent), var(--color-accent2));
    transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .foot-link:hover,
  .foot-link:focus-visible {
    color: var(--color-ink);
    text-shadow: 0 0 8px color-mix(in srgb, var(--color-accent) 45%, transparent);
    outline: none;
  }

  .foot-link:hover::after,
  .foot-link:focus-visible::after {
    transform: scaleX(1);
  }

  .foot-link .arrow {
    display: inline-block;
    transition: transform 0.2s ease;
  }

  .foot-link:hover .arrow,
  .foot-link:focus-visible .arrow {
    transform: translate(2px, -2px);
  }
</style>
