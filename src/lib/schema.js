/**
 * Recursively build an initial values object from schema payloadkeys defaults.
 * Only scalar defaults (boolean, string, number) are applied directly.
 * Required dictionaries are recursed into so their subkey defaults are applied.
 * Optional dictionaries are left absent (user must explicitly add them).
 */
export function buildDefaultValues(payloadkeys) {
  const values = {}
  for (const k of (payloadkeys || [])) {
    if (k.default !== undefined) {
      values[k.key] = k.default
    } else if (k.type === '<boolean>' && k.presence === 'required') {
      values[k.key] = false
    } else if (k.type === '<dictionary>' && k.presence === 'required' && k.subkeys?.length) {
      const sub = buildDefaultValues(k.subkeys)
      if (Object.keys(sub).length) values[k.key] = sub
    }
  }
  return values
}
