// LoRa time-on-air math (Semtech SX127x/SX126x reference formula) plus the
// derived airtime / channel-utilisation figures the Radio & Airtime Calculator
// shows. Everything here is pure so it can be unit-tested and reused.

/**
 * LoRa symbol duration in seconds. Tsym = 2^SF / BW.
 * @param {number} sf spreading factor (7..12)
 * @param {number} bwHz bandwidth in Hz
 */
export function symbolTime(sf, bwHz) {
  return Math.pow(2, sf) / bwHz;
}

/**
 * Time on air for a single LoRa frame, in seconds.
 *
 * @param {object} p
 * @param {number} p.sf spreading factor (7..12)
 * @param {number} p.bwHz bandwidth in Hz (e.g. 125000, 250000)
 * @param {number} p.cr coding rate denominator offset: 1=4/5, 2=4/6, 3=4/7, 4=4/8
 * @param {number} p.payload payload length in bytes
 * @param {number} [p.preamble] preamble symbol count (default 8)
 * @param {boolean} [p.explicitHeader] explicit header on (default true)
 * @param {boolean} [p.crc] CRC on (default true)
 * @param {boolean|null} [p.lowDataRate] force low-data-rate optimize; null = auto
 *   (enabled when the symbol time exceeds 16 ms, per Semtech guidance)
 * @returns {{ total:number, preamble:number, payload:number, tSym:number,
 *   symbols:number, lowDataRate:boolean }}
 */
export function timeOnAir({
  sf,
  bwHz,
  cr,
  payload,
  preamble = 8,
  explicitHeader = true,
  crc = true,
  lowDataRate = null
}) {
  const tSym = symbolTime(sf, bwHz);
  const de = lowDataRate == null ? (tSym > 0.016 ? 1 : 0) : lowDataRate ? 1 : 0;
  const ih = explicitHeader ? 0 : 1;
  const crcBits = crc ? 1 : 0;

  const numerator = 8 * payload - 4 * sf + 28 + 16 * crcBits - 20 * ih;
  const denominator = 4 * (sf - 2 * de);
  const payloadSymbols = 8 + Math.max(Math.ceil(numerator / denominator) * (cr + 4), 0);

  const tPreamble = (preamble + 4.25) * tSym;
  const tPayload = payloadSymbols * tSym;

  return {
    total: tPreamble + tPayload,
    preamble: tPreamble,
    payload: tPayload,
    tSym,
    symbols: payloadSymbols,
    lowDataRate: de === 1
  };
}

/** Coding-rate "4/5".."4/8" string → cr offset 1..4. */
export function crFromString(s) {
  const m = /^\s*4\s*\/\s*([5-8])\s*$/.exec(String(s ?? ''));
  return m ? Number(m[1]) - 4 : 1;
}

/** cr offset 1..4 → "4/5".."4/8". */
export function crToString(cr) {
  return `4/${cr + 4}`;
}

/**
 * The effective LoRa bit rate in bits/sec: Rb = SF * (BW / 2^SF) * (4 / (4+CR)).
 * @param {number} sf
 * @param {number} bwHz
 * @param {number} cr offset 1..4
 */
export function bitRate(sf, bwHz, cr) {
  return sf * (bwHz / Math.pow(2, sf)) * (4 / (4 + cr));
}

/**
 * Whole-network airtime rollup for N nodes each transmitting one frame every
 * `intervalSec` seconds.
 *
 * @param {number} toaSec single-frame time on air (seconds)
 * @param {number} nodes number of transmitting nodes
 * @param {number} intervalSec seconds between each node's transmissions
 * @returns {{ txPerHour:number, airtimePerHourSec:number, dutyCycle:number,
 *   airtimePerNodePerDaySec:number, secondsBetweenTx:number }}
 */
export function networkLoad(toaSec, nodes, intervalSec) {
  const txPerHour = intervalSec > 0 ? (nodes * 3600) / intervalSec : 0;
  const airtimePerHourSec = txPerHour * toaSec;
  const dutyCycle = airtimePerHourSec / 3600; // fraction of the channel occupied
  const airtimePerNodePerDaySec = intervalSec > 0 ? (86400 / intervalSec) * toaSec : 0;
  const secondsBetweenTx = txPerHour > 0 ? 3600 / txPerHour : Infinity;
  return { txPerHour, airtimePerHourSec, dutyCycle, airtimePerNodePerDaySec, secondsBetweenTx };
}

/**
 * A rough collision-pressure gauge for an unslotted ALOHA-style channel. Two
 * frames collide if a second transmission starts within one ToA either side of
 * the first, so the vulnerable window is 2·ToA. p ≈ 1 - e^(-2·λ·ToA) is the
 * probability a given frame overlaps at least one other, where λ is the
 * network-wide frame rate (frames/sec).
 * @param {number} toaSec
 * @param {number} framesPerSec network-wide transmission rate
 */
export function collisionProbability(toaSec, framesPerSec) {
  return 1 - Math.exp(-2 * framesPerSec * toaSec);
}

/** Format a seconds duration compactly: "612 ms", "1.83 s", "2m 04s". */
export function fmtDuration(sec) {
  if (!isFinite(sec)) return '∞';
  if (sec < 1) return `${(sec * 1000).toFixed(sec < 0.1 ? 1 : 0)} ms`;
  if (sec < 60) return `${sec.toFixed(2)} s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  if (m < 60) return `${m}m ${String(s).padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${String(m % 60).padStart(2, '0')}m`;
}

/** Format a fraction (0..1) as a percentage with sensible precision. */
export function fmtPct(x) {
  if (!isFinite(x)) return '—';
  const pct = x * 100;
  if (pct >= 10) return `${pct.toFixed(0)}%`;
  if (pct >= 1) return `${pct.toFixed(1)}%`;
  if (pct >= 0.01) return `${pct.toFixed(2)}%`;
  if (pct === 0) return '0%';
  return `${pct.toExponential(1)}%`;
}
