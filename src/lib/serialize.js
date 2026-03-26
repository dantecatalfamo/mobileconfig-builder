function isDefault(value, def) {
  if (typeof def === "boolean") return value === def || value === String(def);
  // eslint-disable-next-line eqeqeq
  return value == def;
}

function filterDefaults(values, payloadkeys) {
  if (!payloadkeys?.length) return { ...values };
  const schemaByKey = Object.fromEntries(
    payloadkeys.filter(s => s.key).map(s => [s.key, s]),
  );
  const out = {};
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === "") continue;
    const sk = schemaByKey[key];
    if (
      sk &&
      sk.default !== undefined &&
      sk.presence !== "required" &&
      isDefault(value, sk.default)
    )
      continue;
    if (
      sk?.type === "<dictionary>" &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      out[key] = filterDefaults(value, sk.subkeys);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function generateDeclarationJSON(schemasData, declarations) {
  return declarations.map(d => {
    const schema = schemasData.declarations[d.declarationId];
    const declarationType = schema?.payload?.declarationtype || d.declarationId;
    return {
      Type: declarationType,
      Identifier: d.identifier || crypto.randomUUID(),
      ServerToken: d.serverToken || crypto.randomUUID(),
      Payload: filterDefaults(d.values, schema?.payloadkeys),
    };
  });
}
