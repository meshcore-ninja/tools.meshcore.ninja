// The catalog of tools, shared by the landing page and the header nav so both
// stay in sync. Icons are Lucide component names, resolved where rendered.
import { QrCode, Timer, Fingerprint } from '@lucide/svelte';

export const TOOLS = [
  {
    slug: 'qr',
    name: 'QR Studio',
    tagline: 'Create & test MeshCore QR codes',
    description:
      'Build scannable contact and channel QR codes for the MeshCore app, and decode or validate any meshcore:// code you paste, upload or scan.',
    icon: QrCode
  },
  {
    slug: 'airtime',
    name: 'Airtime Calculator',
    tagline: 'Time on air, channel use & collision pressure',
    description:
      'Work out LoRa time on air from bandwidth, spreading factor and payload, then scale it to a whole network — “700 repeaters advertising every 12 h” — and compare two radio profiles side by side.',
    icon: Timer
  },
  {
    slug: 'prefix',
    name: 'Prefix Finder',
    tagline: 'Pick an uncrowded pubkey prefix',
    description:
      'See which one-byte pubkey prefixes are already taken on a network (optionally near a location), spot conflicts on a 256-cell map, and pick the least-crowded prefix for a new node.',
    icon: Fingerprint
  }
];

export const TOOL_BY_SLUG = Object.fromEntries(TOOLS.map((t) => [t.slug, t]));
