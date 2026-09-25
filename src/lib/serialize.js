function isDefault(value, def) {
  if (typeof def === "boolean") return value === def || value === String(def);
  // eslint-disable-next-line eqeqeq
  return value == def;
}

// Form inputs (selects, array item text boxes) yield strings; JSON needs the
// schema's scalar type. The plist serializer does the same via its type tags.
function coerce(value, keyDef) {
  if (!keyDef) return value;
  if (keyDef.type === "<array>" && Array.isArray(value)) {
    const item = keyDef.subkeys?.[0];
    return value.map(v =>
      item?.type === "<dictionary>" && v && typeof v === "object"
        ? filterDefaults(v, item.subkeys)
        : coerce(v, item),
    );
  }
  if (typeof value !== "string" || value === "") return value;
  if (keyDef.type === "<integer>" || keyDef.type === "<real>") {
    const num = Number(value);
    return isNaN(num) ? value : num;
  }
  if (keyDef.type === "<boolean>") {
    if (value === "true") return true;
    if (value === "false") return false;
  }
  return value;
}

function filterDefaults(values, payloadkeys) {
  if (!payloadkeys?.length) return { ...values };
  const schemaByKey = Object.fromEntries(
    payloadkeys.filter(s => s.key).map(s => [s.key, s]),
  );
  const out = {};
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === "") continue;
    // Arbitrary-name keys fall back to the wildcard ANY definition.
    const sk = (key !== "ANY" && schemaByKey[key]) || schemaByKey.ANY;
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
      out[key] = coerce(value, sk);
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
