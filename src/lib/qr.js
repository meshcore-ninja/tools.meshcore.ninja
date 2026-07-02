// Build and parse the two documented MeshCore QR / URI schemes:
//   meshcore://contact/add?name=…&public_key=…&type=…
//   meshcore://channel/add?name=…&secret=…
// See https://docs.meshcore.io/qr_codes/ . These helpers are pure so both the
// generator and the decoder/validator in the QR Studio share one source of truth.

/** Contact type id → label, per the docs. */
export const CONTACT_TYPES = [
  { value: 1, label: 'Companion' },
  { value: 2, label: 'Repeater' },
  { value: 3, label: 'Room Server' },
  { value: 4, label: 'Sensor' }
];

export const CONTACT_TYPE_LABEL = Object.fromEntries(CONTACT_TYPES.map((t) => [t.value, t.label]));

const HEX = /^[0-9a-fA-F]*$/;

/**
 * Build a `meshcore://contact/add` URI. Values are URL-encoded.
 * @param {{name?:string, public_key?:string, type?:number|string}} p
 */
export function buildContactUri({ name = '', public_key = '', type = 1 } = {}) {
  const sp = new URLSearchParams();
  sp.set('name', name);
  sp.set('public_key', (public_key || '').toLowerCase());
  sp.set('type', String(type || 1));
  return `meshcore://contact/add?${sp.toString()}`;
}

/**
 * Build a `meshcore://channel/add` URI. Values are URL-encoded.
 * @param {{name?:string, secret?:string}} p
 */
export function buildChannelUri({ name = '', secret = '' } = {}) {
  const sp = new URLSearchParams();
  sp.set('name', name);
  sp.set('secret', (secret || '').toLowerCase());
  return `meshcore://channel/add?${sp.toString()}`;
}

/**
 * Validate a contact card's fields. Returns { errors, warnings } arrays of
 * human-readable strings; empty errors means it's a valid, shareable card.
 */
export function validateContact({ name = '', public_key = '', type = 1 } = {}) {
  const errors = [];
  const warnings = [];
  const pk = (public_key || '').trim();
  if (!pk) errors.push('Public key is required.');
  else if (!HEX.test(pk)) errors.push('Public key must be hexadecimal (0-9, a-f).');
  else if (pk.length !== 64)
    errors.push(`Public key must be 64 hex chars (32 bytes) — got ${pk.length}.`);
  const t = Number(type);
  if (!CONTACT_TYPE_LABEL[t]) warnings.push(`Type ${type} is not one of the documented 1-4.`);
  if (!name.trim()) warnings.push('No name set — the contact will import unnamed.');
  return { errors, warnings };
}

/**
 * Validate a channel's fields. Returns { errors, warnings }.
 */
export function validateChannel({ name = '', secret = '' } = {}) {
  const errors = [];
  const warnings = [];
  const s = (secret || '').trim();
  if (!s) errors.push('Secret is required.');
  else if (!HEX.test(s)) errors.push('Secret must be hexadecimal (0-9, a-f).');
  else if (s.length !== 32)
    errors.push(`Secret must be 32 hex chars (16 bytes) — got ${s.length}.`);
  if (!name.trim()) warnings.push('No channel name set.');
  return { errors, warnings };
}

/**
 * Parse any MeshCore URI into a structured, validated descriptor. Returns null
 * when the string is not a recognised meshcore:// URI.
 * @param {string} raw
 * @returns {null | {
 *   kind:'contact'|'channel'|'unknown', action:string, uri:string,
 *   fields:Record<string,string>, errors:string[], warnings:string[]
 * }}
 */
export function parseMeshUri(raw) {
  const text = (raw || '').trim();
  if (!/^meshcore:\/\//i.test(text)) return null;

  // meshcore://contact/add?… — the host+path is the action; parse the query
  // manually so a bare `meshcore://` still round-trips through URLSearchParams.
  const withoutScheme = text.replace(/^meshcore:\/\//i, '');
  const [path, query = ''] = withoutScheme.split('?');
  const action = path.replace(/\/+$/, '').toLowerCase();
  const params = new URLSearchParams(query);
  const fields = Object.fromEntries(params.entries());

  if (action === 'contact/add') {
    const v = validateContact({
      name: fields.name ?? '',
      public_key: fields.public_key ?? '',
      type: fields.type ?? 1
    });
    return { kind: 'contact', action, uri: text, fields, ...v };
  }
  if (action === 'channel/add') {
    const v = validateChannel({ name: fields.name ?? '', secret: fields.secret ?? '' });
    return { kind: 'channel', action, uri: text, fields, ...v };
  }
  return {
    kind: 'unknown',
    action,
    uri: text,
    fields,
    errors: [`Unrecognised MeshCore action "${action || '(none)'}".`],
    warnings: []
  };
}

/** A cryptographically-random hex string of `bytes` bytes (for channel secrets). */
export function randomHex(bytes) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}
