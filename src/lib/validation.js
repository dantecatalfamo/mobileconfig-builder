export function isEmpty(v) {
  return (
    v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length)
  );
}

// Keys of a dict value that aren't named in the schema, i.e. the entries
// matched by a wildcard ANY sub-key.
export function anyEntryKeys(keys, values, extraKnown = []) {
  const known = new Set([...(keys || []).map(k => k.key), ...extraKnown]);
  return Object.keys(values || {}).filter(k => !known.has(k));
}

function collectMissing(keys, values, parentLabel) {
  const missing = [];
  for (const k of keys || []) {
    if (!k.key) continue;
    if (k.key === "ANY") {
      // ANY matches any number of arbitrarily-named entries; "required"
      // means at least one.
      const entries = anyEntryKeys(keys, values);
      if (k.presence === "required" && !entries.length)
        missing.push(k.title || parentLabel || "At least one entry");
      if (k.type === "<dictionary>" && Array.isArray(k.subkeys))
        for (const e of entries)
          if (values[e] != null)
            missing.push(...collectMissing(k.subkeys, values[e], e));
      continue;
    }
    const v = values?.[k.key];
    if (k.presence === "required" && isEmpty(v)) missing.push(k.title || k.key);
    if (k.type === "<dictionary>" && v != null && Array.isArray(k.subkeys))
      missing.push(...collectMissing(k.subkeys, v, k.title || k.key));
  }
  return missing;
}

export function validateMDM(schemasData, meta, payloads) {
  const metaErrors = [];
  if (!meta.displayName?.trim()) metaErrors.push("Display Name is required");
  if (!meta.identifier?.trim()) metaErrors.push("Identifier is required");
  const payloadErrors = {};
  for (const p of payloads) {
    const missing = collectMissing(
      schemasData.profiles[p.profileId]?.payloadkeys,
      p.values,
    );
    if (missing.length) payloadErrors[p.id] = missing;
  }
  return { metaErrors, payloadErrors };
}

export function validateDeclarative(schemasData, declarations) {
  const errors = {};
  for (const d of declarations) {
    const errs = [];
    if (!d.identifier?.trim()) errs.push("Identifier is required");
    errs.push(
      ...collectMissing(
        schemasData.declarations[d.declarationId]?.payloadkeys,
        d.values,
      ),
    );
    if (errs.length) errors[d.id] = errs;
  }
  return errors;
}
