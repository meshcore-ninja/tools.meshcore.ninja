<script>
  import jsQR from 'jsqr';
  import {
    QrCode as QrIcon,
    UserPlus,
    Hash,
    ScanLine,
    Upload,
    Camera,
    CircleAlert,
    TriangleAlert,
    CircleCheck,
    RefreshCw,
    X
  } from '@lucide/svelte';
  import QrCode from '$lib/QrCode.svelte';
  import Select from '$lib/ui/Select.svelte';
  import SegmentedGroup from '$lib/ui/SegmentedGroup.svelte';
  import {
    CONTACT_TYPES,
    CONTACT_TYPE_LABEL,
    buildContactUri,
    buildChannelUri,
    validateContact,
    validateChannel,
    parseMeshUri,
    randomHex
  } from '$lib/qr.js';

  // ── Top-level mode: build a code, or decode/test one ──────────────────────
  let mode = $state('create'); // 'create' | 'test'

  // ── Create: contact vs channel ────────────────────────────────────────────
  let kind = $state('contact'); // 'contact' | 'channel'

  let contact = $state({ name: '', public_key: '', type: 1 });
  // The well-known MeshCore "Public" channel key (hex of the shipped secret).
  const PUBLIC_SECRET = '8b3387e9c5cdea6ac9e5edbaa115cd72';
  let channel = $state({ name: 'Public', secret: PUBLIC_SECRET });

  const contactUri = $derived(buildContactUri(contact));
  const channelUri = $derived(buildChannelUri(channel));
  const contactCheck = $derived(validateContact(contact));
  const channelCheck = $derived(validateChannel(channel));

  const activeUri = $derived(kind === 'contact' ? contactUri : channelUri);
  const activeCheck = $derived(kind === 'contact' ? contactCheck : channelCheck);
  const activeValid = $derived(activeCheck.errors.length === 0);

  // ── Test: paste / upload / scan ───────────────────────────────────────────
  let testInput = $state('');
  const decoded = $derived(parseMeshUri(testInput));
  let decodeNote = $state(''); // e.g. "Decoded from image" / scan errors

  let fileInput;
  function onFile(e) {
    const file = e.target.files?.[0];
    if (file) decodeImageFile(file);
    e.target.value = '';
  }

  async function decodeImageFile(file) {
    decodeNote = 'Decoding image…';
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const result = jsQR(img.data, img.width, img.height);
      if (result?.data) {
        testInput = result.data;
        decodeNote = 'Decoded from image.';
      } else {
        decodeNote = 'No QR code found in that image.';
      }
    } catch (err) {
      decodeNote = 'Could not read that image file.';
    }
  }

  // ── Camera scan ───────────────────────────────────────────────────────────
  let scanning = $state(false);
  let scanError = $state('');
  let videoEl;
  let stream = null;
  let rafId = 0;

  async function startScan() {
    scanError = '';
    scanning = true;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      videoEl.srcObject = stream;
      await videoEl.play();
      tick();
    } catch (err) {
      scanError = 'Camera unavailable or permission denied.';
      scanning = false;
    }
  }

  function stopScan() {
    scanning = false;
    cancelAnimationFrame(rafId);
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
  }

  function tick() {
    if (!scanning || !videoEl) return;
    if (videoEl.readyState === videoEl.HAVE_ENOUGH_DATA) {
      const canvas = document.createElement('canvas');
      canvas.width = videoEl.videoWidth;
      canvas.height = videoEl.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const result = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
      if (result?.data) {
        testInput = result.data;
        decodeNote = 'Scanned from camera.';
        stopScan();
        return;
      }
    }
    rafId = requestAnimationFrame(tick);
  }

  // Stop the camera when leaving the page / switching mode.
  $effect(() => {
    if (mode !== 'test' && scanning) stopScan();
    return () => stopScan();
  });

  const inputClass =
    'w-full rounded-md border border-edge bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none';
</script>

<svelte:head>
  <title>QR Studio — MeshCore Tools</title>
</svelte:head>

<section class="mx-auto w-full max-w-6xl px-4 py-8">
  <header class="mb-6 flex items-start gap-3">
    <span class="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-edge bg-elev text-accent">
      <QrIcon size={22} />
    </span>
    <div>
      <h1 class="text-2xl font-semibold tracking-tight text-ink">QR Studio</h1>
      <p class="mt-1 text-sm text-dim">
        Create scannable MeshCore contact & channel codes, or decode and validate any
        <code class="rounded bg-elev px-1 py-0.5 font-mono text-xs text-accent">meshcore://</code>
        code — paste it, upload an image, or scan with your camera.
      </p>
    </div>
  </header>

  <!-- Mode toggle -->
  <SegmentedGroup
    class="mb-6"
    bind:value={mode}
    items={[
      { value: 'create', label: 'Create', icon: QrIcon },
      { value: 'test', label: 'Test / decode', icon: ScanLine }
    ]}
  />

  {#if mode === 'create'}
    <div class="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <!-- Form -->
      <div class="rounded-2xl border border-edge bg-elev p-5">
        <SegmentedGroup
          class="mb-5"
          bind:value={kind}
          items={[
            { value: 'contact', label: 'Contact', icon: UserPlus },
            { value: 'channel', label: 'Channel', icon: Hash }
          ]}
        />

        {#if kind === 'contact'}
          <div class="grid gap-4">
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-dim">Name</span>
              <input class={inputClass} bind:value={contact.name} placeholder="Node name" />
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-dim">Public key <span class="text-muted">(64 hex chars)</span></span>
              <input
                class="{inputClass} font-mono"
                bind:value={contact.public_key}
                placeholder="9cd8fcf2…787765b1"
                spellcheck="false"
                autocapitalize="off"
              />
            </label>
            <div class="block">
              <span class="mb-1 block text-xs font-medium text-dim">Type</span>
              <Select
                bind:value={contact.type}
                items={CONTACT_TYPES.map((t) => ({ value: t.value, label: `${t.value} — ${t.label}` }))}
              />
            </div>
          </div>
        {:else}
          <div class="grid gap-4">
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-dim">Channel name</span>
              <input class={inputClass} bind:value={channel.name} placeholder="Public" />
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-dim">Secret <span class="text-muted">(32 hex chars / 16 bytes)</span></span>
              <div class="flex gap-2">
                <input
                  class="{inputClass} font-mono"
                  bind:value={channel.secret}
                  placeholder="8b3387e9…115cd72"
                  spellcheck="false"
                  autocapitalize="off"
                />
                <button
                  type="button"
                  onclick={() => (channel.secret = randomHex(16))}
                  title="Generate a random secret"
                  class="inline-flex shrink-0 items-center gap-1 rounded-md border border-edge bg-bg px-3 text-xs text-dim hover:border-accent hover:text-ink"
                >
                  <RefreshCw size={14} /> Random
                </button>
              </div>
            </label>
            <p class="text-xs text-muted">
              This is the well-known MeshCore <span class="font-mono">Public</span> channel secret. Generate a
              random one for a private group.
            </p>
          </div>
        {/if}

        <!-- Validation -->
        <div class="mt-5 space-y-1.5">
          {#each activeCheck.errors as e}
            <p class="flex items-center gap-1.5 text-xs text-bad"><CircleAlert size={14} /> {e}</p>
          {/each}
          {#each activeCheck.warnings as w}
            <p class="flex items-center gap-1.5 text-xs text-warn"><TriangleAlert size={14} /> {w}</p>
          {/each}
          {#if activeValid && activeCheck.warnings.length === 0}
            <p class="flex items-center gap-1.5 text-xs text-ok"><CircleCheck size={14} /> Looks good — scan the code with the MeshCore app.</p>
          {/if}
        </div>

        <div class="mt-4 rounded-lg border border-edge bg-bg p-3">
          <div class="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted">Encoded URI</div>
          <code class="block break-all font-mono text-xs text-dim">{activeUri}</code>
        </div>
      </div>

      <!-- Preview -->
      <aside class="rounded-2xl border border-edge bg-elev p-5">
        <div class="mb-3 text-xs font-medium text-dim">
          {kind === 'contact' ? 'Add-contact code' : 'Add-channel code'}
        </div>
        <QrCode value={activeUri} label={kind === 'contact' ? contact.name || 'contact' : channel.name || 'channel'} />
        <p class="mt-4 text-center text-xs text-muted">
          Open the MeshCore app → add {kind === 'contact' ? 'contact' : 'channel'} → scan.
        </p>
      </aside>
    </div>
  {:else}
    <!-- Test / decode -->
    <div class="grid gap-6 lg:grid-cols-2">
      <div class="rounded-2xl border border-edge bg-elev p-5">
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-dim">Paste a meshcore:// URI</span>
          <textarea
            class="{inputClass} h-24 resize-y font-mono"
            bind:value={testInput}
            placeholder="meshcore://contact/add?name=…&public_key=…&type=1"
            spellcheck="false"
            autocapitalize="off"
          ></textarea>
        </label>

        <div class="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onclick={() => fileInput.click()}
            class="inline-flex items-center gap-1.5 rounded-md border border-edge bg-bg px-3 py-1.5 text-xs text-dim hover:border-accent hover:text-ink"
          >
            <Upload size={14} /> Upload image
          </button>
          {#if !scanning}
            <button
              type="button"
              onclick={startScan}
              class="inline-flex items-center gap-1.5 rounded-md border border-edge bg-bg px-3 py-1.5 text-xs text-dim hover:border-accent hover:text-ink"
            >
              <Camera size={14} /> Scan camera
            </button>
          {:else}
            <button
              type="button"
              onclick={stopScan}
              class="inline-flex items-center gap-1.5 rounded-md border border-bad/50 bg-bad/10 px-3 py-1.5 text-xs text-bad hover:bg-bad/20"
            >
              <X size={14} /> Stop
            </button>
          {/if}
          {#if testInput}
            <button
              type="button"
              onclick={() => {
                testInput = '';
                decodeNote = '';
              }}
              class="ml-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted hover:text-ink"
            >
              <X size={14} /> Clear
            </button>
          {/if}
          <input bind:this={fileInput} type="file" accept="image/*" class="hidden" onchange={onFile} />
        </div>

        {#if decodeNote}
          <p class="mt-2 text-xs text-muted">{decodeNote}</p>
        {/if}
        {#if scanError}
          <p class="mt-2 text-xs text-bad">{scanError}</p>
        {/if}

        <!-- svelte-ignore a11y_media_has_caption -->
        <video
          bind:this={videoEl}
          class="mt-3 w-full rounded-lg border border-edge {scanning ? 'block' : 'hidden'}"
          playsinline
          muted
        ></video>
      </div>

      <!-- Result -->
      <div class="rounded-2xl border border-edge bg-elev p-5">
        {#if !testInput.trim()}
          <div class="grid h-full min-h-40 place-items-center text-center text-sm text-muted">
            Paste, upload or scan a code to inspect it.
          </div>
        {:else if !decoded}
          <div class="flex items-start gap-2 text-sm text-bad">
            <CircleAlert size={16} class="mt-0.5 shrink-0" />
            <span>Not a MeshCore URI. Expected it to start with <span class="font-mono">meshcore://</span>.</span>
          </div>
        {:else}
          <div class="mb-3 flex items-center gap-2">
            {#if decoded.errors.length === 0}
              <span class="inline-flex items-center gap-1.5 rounded-full border border-ok/40 bg-ok/10 px-2.5 py-0.5 text-xs font-medium text-ok">
                <CircleCheck size={13} /> Valid {decoded.kind}
              </span>
            {:else}
              <span class="inline-flex items-center gap-1.5 rounded-full border border-bad/40 bg-bad/10 px-2.5 py-0.5 text-xs font-medium text-bad">
                <CircleAlert size={13} /> Invalid {decoded.kind === 'unknown' ? 'code' : decoded.kind}
              </span>
            {/if}
            <span class="font-mono text-xs text-muted">{decoded.action}</span>
          </div>

          <dl class="divide-y divide-edge/60 rounded-lg border border-edge">
            {#each Object.entries(decoded.fields) as [k, v] (k)}
              <div class="grid grid-cols-[7rem_1fr] gap-2 px-3 py-2">
                <dt class="text-xs font-medium text-muted">{k}</dt>
                <dd class="break-all font-mono text-xs text-ink">
                  {v}
                  {#if k === 'type' && CONTACT_TYPE_LABEL[Number(v)]}
                    <span class="text-muted"> — {CONTACT_TYPE_LABEL[Number(v)]}</span>
                  {/if}
                </dd>
              </div>
            {/each}
          </dl>

          <div class="mt-3 space-y-1.5">
            {#each decoded.errors as e}
              <p class="flex items-center gap-1.5 text-xs text-bad"><CircleAlert size={14} /> {e}</p>
            {/each}
            {#each decoded.warnings as w}
              <p class="flex items-center gap-1.5 text-xs text-warn"><TriangleAlert size={14} /> {w}</p>
            {/each}
          </div>

          {#if decoded.errors.length === 0}
            <div class="mt-5 border-t border-edge pt-5">
              <div class="mb-3 text-xs font-medium text-dim">Re-rendered code</div>
              <QrCode value={decoded.uri} label={`${decoded.kind}-decoded`} />
              <a
                href={decoded.uri}
                class="mt-3 block text-center text-xs text-accent hover:underline"
              >
                Open in MeshCore app
              </a>
            </div>
          {/if}
        {/if}
      </div>
    </div>
  {/if}
</section>
