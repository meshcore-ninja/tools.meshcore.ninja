// The catalog of tools, shared by the landing page and the header nav so both
// stay in sync. Icons are Lucide component names, resolved where rendered.
import { QrCode, Timer, Fingerprint } from '@lucide/svelte';

export const TOOLS = [
  {
    slug: 'qr',
    name: 'QR Studio',
    tagline: 'Create & test MeshCore QR codes',
    description:
      'Build scannable contact and channel QR codes for the MeshCore app, then decode, validate, upload or scan meshcore:// links with shareable parameters.',
    icon: QrCode
  },
  {
    slug: 'airtime',
    name: 'Airtime Calculator',
    tagline: 'MeshCore-aware LoRa airtime planning',
    description:
      'Calculate LoRa time on air with MeshCore firmware preambles or standard LoRa assumptions, compare radio profiles, and estimate offered channel load and collision pressure.',
    icon: Timer
  },
  {
    slug: 'prefix',
    name: 'Prefix Finder',
    tagline: 'Explore global and network prefix crowding',
    description:
      'Inspect reserved-aware 1, 2 or 3-byte public-key prefixes across all observed nodes or a selected network, zoom the canvas map, and check example collisions.',
    icon: Fingerprint
  }
];

export const TOOL_BY_SLUG = Object.fromEntries(TOOLS.map((t) => [t.slug, t]));
