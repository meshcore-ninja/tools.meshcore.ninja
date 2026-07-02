// Client for the MeshCore Ninja API + catalog, scoped to what the tools need:
// the network list, the rich network catalog (radio config, coverage), and node
// search (used by the prefix finder to see which pubkey prefixes are taken).

export const API_BASE = (import.meta.env?.VITE_API_BASE || 'https://api.meshcore.ninja').replace(
  /\/+$/,
  ''
);

// Origin of the MeshCore Ninja catalog that publishes networks.json / bands.json.
const CATALOG_ORIGIN = (import.meta.env?.VITE_CATALOG_ORIGIN || 'https://meshcore.ninja').replace(
  /\/+$/,
  ''
);

/**
 * Search the node directory. Threads an AbortSignal so a new request cancels the
 * previous one.
 * @param {object} p
 * @param {string} [p.q] name substring or `^<hex>` pubkey-prefix match
 * @param {string} [p.net] restrict to a network id
 * @param {{key:string,value:string,radiusKm?:number}[]} [p.filters] structured filters
 * @param {number} [p.limit]
 * @param {AbortSignal} [signal]
 * @returns {Promise<{results:any[],returned:number,total:number,capped:boolean}>}
 */
export function search({ q, net, filters, limit } = {}, signal) {
  const sp = new URLSearchParams();
  if (q) sp.set('q', q);
  if (net) sp.set('networks', net);
  for (const f of filters ?? []) {
    if (!f?.key || f.value == null || f.value === '') continue;
    sp.append(f.key, String(f.value));
    if (f.key === 'near' && f.radiusKm) sp.set('radius', String(f.radiusKm));
  }
  if (limit) sp.set('limit', String(limit));
  return fetch(`${API_BASE}/api/search?${sp.toString()}`, { signal }).then((r) => {
    if (!r.ok) throw new Error(`search ${r.status}`);
    return r.json();
  });
}

/**
 * Full prefix-occupancy histogram for a network at a given prefix width. Unlike
 * `search`, this is not capped — the API groups every matching node server-side,
 * so the Prefix Finder sees complete occupancy and every conflict.
 * @param {object} p
 * @param {string} [p.net] network id; omit or pass "global" for all nodes
 * @param {number} [p.bytes] prefix width in bytes (1–3, default 1)
 * @param {{key:string,value:string,radiusKm?:number}[]} [p.filters] e.g. a `near` area filter
 * @param {AbortSignal} [signal]
 * @returns {Promise<{bytes:number,counted:number,space:number,used:number,collisions:number,
 *   prefixes:{prefix:string,count:number,nodes:{pubkey:string,name:string,type:number,typeName:string}[]}[]}>}
 */
export function prefixes({ net, bytes = 1, filters } = {}, signal) {
  const sp = new URLSearchParams();
  if (net && net !== 'global') sp.set('networks', net);
  sp.set('bytes', String(bytes));
  for (const f of filters ?? []) {
    if (!f?.key || f.value == null || f.value === '') continue;
    sp.append(f.key, String(f.value));
    if (f.key === 'near' && f.radiusKm) sp.set('radius', String(f.radiusKm));
  }
  return fetch(`${API_BASE}/api/prefixes?${sp.toString()}`, { signal }).then((r) => {
    if (!r.ok) throw new Error(`prefixes ${r.status}`);
    return r.json();
  });
}

let networksPromise;
/**
 * The network list (id + name), for the network picker. Fetched once and
 * memoized; failures resolve to an empty list.
 * @returns {Promise<{id:string,name:string}[]>}
 */
export function networks() {
  if (!networksPromise) {
    networksPromise = fetch(`${API_BASE}/api/networks`)
      .then((r) => (r.ok ? r.json() : { networks: [] }))
      .then((d) => (d.networks ?? []).map((n) => ({ id: n.id, name: n.name })))
      .then((list) => list.sort((a, b) => a.name.localeCompare(b.name)))
      .catch(() => []);
  }
  return networksPromise;
}

let meshNetworksPromise;
/**
 * The full network catalog from networks.json (flat array), keyed by id, so a
 * tool can read radio config, coverage countries and regions per network.
 * Fetched once and memoized; failures resolve to an empty map.
 * @returns {Promise<Record<string, any>>}
 */
export function meshNetworks() {
  if (!meshNetworksPromise) {
    meshNetworksPromise = fetch(`${CATALOG_ORIGIN}/networks.json`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => Object.fromEntries((Array.isArray(list) ? list : []).map((n) => [n.id, n])))
      .catch(() => ({}));
  }
  return meshNetworksPromise;
}

let bandsPromise;
/**
 * The LoRa band catalog from bands.json, keyed by band id (e.g. "868", "915").
 * Fetched once and memoized; failures resolve to an empty map.
 * @returns {Promise<Record<string, {name:string,range:string,region:string}>>}
 */
export function bands() {
  if (!bandsPromise) {
    bandsPromise = fetch(`${CATALOG_ORIGIN}/bands.json`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => (d && typeof d === 'object' ? d : {}))
      .catch(() => ({}));
  }
  return bandsPromise;
}
