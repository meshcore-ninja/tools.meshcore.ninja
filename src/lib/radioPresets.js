// Generic LoRa radio profiles. Network-specific presets are pulled live from the
// MeshCore catalog (networks.json) at runtime and merged with these — see the
// Radio calculator page. Each preset carries the knobs that affect time on air.

export const BUILTIN_PRESETS = [
  {
    id: 'eu-long-fast',
    name: 'EU Long Fast (868)',
    freqMhz: 869.525,
    bwKhz: 250,
    sf: 11,
    cr: '4/5',
    note: 'MeshCore-style EU default: reach over throughput.'
  },
  {
    id: 'eu-medium-fast',
    name: 'EU Medium Fast (868)',
    freqMhz: 869.525,
    bwKhz: 250,
    sf: 9,
    cr: '4/5',
    note: 'Shorter range, much less airtime per packet.'
  },
  {
    id: 'us-long-fast',
    name: 'US Long Fast (915)',
    freqMhz: 906.875,
    bwKhz: 250,
    sf: 11,
    cr: '4/5',
    note: 'US 915 MHz band equivalent of EU Long Fast.'
  },
  {
    id: 'long-slow',
    name: 'Long Slow (SF12 / 125)',
    freqMhz: 869.525,
    bwKhz: 125,
    sf: 12,
    cr: '4/8',
    note: 'Maximum reach and robustness — very high airtime cost.'
  },
  {
    id: 'short-fast',
    name: 'Short Fast (SF7 / 250)',
    freqMhz: 869.525,
    bwKhz: 250,
    sf: 7,
    cr: '4/5',
    note: 'Dense urban / short hops, minimal airtime.'
  }
];

export const BW_OPTIONS = [7.8, 10.4, 15.6, 20.8, 31.25, 41.7, 62.5, 125, 250, 500];
export const SF_OPTIONS = [7, 8, 9, 10, 11, 12];
export const CR_OPTIONS = ['4/5', '4/6', '4/7', '4/8'];
