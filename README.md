# tools.meshcore.ninja

A collection of small, focused MeshCore utilities — part of the
[MeshCore Ninja](https://meshcore.ninja) ecosystem. Not another map, client or
dashboard; just sharp tools that convert and explain MeshCore-specific data.
Everything runs client-side.

## Tools

- **QR Studio** (`/qr`) — create scannable `meshcore://contact/add` and
  `meshcore://channel/add` QR codes for the MeshCore app, and decode / validate
  any MeshCore URI by pasting it, uploading an image, or scanning with the
  camera. Follows the [documented QR formats](https://docs.meshcore.io/qr_codes/).
- **Radio & Airtime Calculator** (`/radio`) — LoRa time on air (Semtech
  reference formula) from bandwidth, spreading factor, coding rate and payload,
  scaled to a whole network with duty cycle and a rough collision-pressure
  estimate. Presets are pulled live from the network catalog; two radio profiles
  can be compared side by side.
- **Prefix Finder** (`/prefix`) — MeshCore routes on the first byte of a node's
  public key. Pick a network (optionally scoped to an area) to see which of the
  256 prefixes are taken on a 16×16 map, inspect conflicts, and pick an
  uncrowded prefix for a new node. Backed by the MeshCore Ninja API.

## Stack

SvelteKit 2 + Svelte 5 (runes), Tailwind v4 (CSS-first theming with the shared
MeshCore Ninja design tokens), static adapter → GitHub Pages. Same conventions
as [nodes.meshcore.ninja](https://nodes.meshcore.ninja).

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site → build/
npm run preview
```

Configuration (see `.env.example`):

- `VITE_API_BASE` — MeshCore Ninja API origin (default `https://api.meshcore.ninja`),
  queried by the Prefix Finder.
- `VITE_CATALOG_ORIGIN` — catalog origin serving `networks.json` / `bands.json`
  (default `https://meshcore.ninja`), used for radio presets.

## Deploy

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on push to
`main`. `static/CNAME` points the Pages site at `tools.meshcore.ninja`.
