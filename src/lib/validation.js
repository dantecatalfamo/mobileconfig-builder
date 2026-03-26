export function isEmpty(v) {
  return (
    v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length)
  );
}

function collectMissing(keys, values) {
  const missing = [];
  for (const k of keys || []) {
    if (!k.key) continue;
    const v = values?.[k.key];
    if (k.presence === "required" && isEmpty(v)) missing.push(k.title || k.key);
    if (k.type === "<dictionary>" && v != null && Array.isArray(k.subkeys))
      missing.push(...collectMissing(k.subkeys, v));
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
