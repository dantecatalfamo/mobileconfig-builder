import { typedValue, isTyped } from "./plistValue";

function parsePlistNode(node) {
  const tag = node.tagName;
  switch (tag) {
    case "true":
      return true;
    case "false":
      return false;
    case "integer":
      return parseInt(node.textContent, 10);
    case "real":
      return parseFloat(node.textContent);
    case "string":
      return node.textContent;
    case "date":
      return typedValue("<date>", node.textContent);
    case "data":
      return typedValue("<data>", node.textContent.replace(/\s+/g, ""));
    case "array": {
      const items = [];
      for (const child of node.children) items.push(parsePlistNode(child));
      return items;
    }
    case "dict": {
      const obj = {};
      const children = Array.from(node.children);
      for (let i = 0; i < children.length; i++) {
        if (children[i].tagName !== "key") continue;
        const k = children[i].textContent;
        const v = children[i + 1];
        if (!v) break;
        obj[k] = parsePlistNode(v);
        i++;
      }
      return obj;
    }
  }
  return null;
}

// Unwrap typed values where the schema already says <data>/<date>, so form
// fields get plain strings; leave them wrapped everywhere else.
function unwrapTyped(value, keyDef) {
  if (isTyped(value))
    return keyDef?.type === value.$plistType ? value.value : value;
  if (Array.isArray(value)) {
    const item = keyDef?.type === "<array>" ? keyDef.subkeys?.[0] : undefined;
    return value.map(v => unwrapTyped(v, item));
  }
  if (value && typeof value === "object") {
    return unwrapDict(
      value,
      keyDef?.type === "<dictionary>" ? keyDef.subkeys : [],
    );
  }
  return value;
}

function unwrapDict(obj, subkeys) {
  const byKey = Object.fromEntries(
    (subkeys || []).filter(s => s.key).map(s => [s.key, s]),
  );
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k,
      unwrapTyped(v, (k !== "ANY" && byKey[k]) || byKey.ANY || null),
    ]),
  );
}

export function parseMobileconfig(xml, schemasData) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error(
      "Invalid XML. Signed .mobileconfig files (CMS-wrapped) are not supported — please supply the unsigned profile.",
    );
  }
  const root = doc.querySelector("plist > dict");
  if (!root) throw new Error("Not a property list: missing <plist><dict>.");
  const data = parsePlistNode(root);
  if (!data || typeof data !== "object")
    throw new Error("Root dictionary could not be parsed.");

  const meta = {
    displayName: data.PayloadDisplayName || "",
    identifier: data.PayloadIdentifier || "",
    organization: data.PayloadOrganization || "",
    description: data.PayloadDescription || "",
    scope: data.PayloadScope || "System",
    removalDisallowed: data.PayloadRemovalDisallowed === true,
  };

  const warnings = [];
  const rawPayloads = Array.isArray(data.PayloadContent)
    ? data.PayloadContent
    : [];
  const payloads = [];
  for (const entry of rawPayloads) {
    if (!entry || typeof entry !== "object") continue;
    const payloadType = entry.PayloadType;
    if (!payloadType) {
      warnings.push("Payload missing PayloadType — skipped.");
      continue;
    }
    if (!schemasData.profiles[payloadType]) {
      warnings.push(`Unknown payload type "${payloadType}" — skipped.`);
      continue;
    }
    const values = unwrapDict(
      entry,
      schemasData.profiles[payloadType].payloadkeys,
    );
    delete values.PayloadType;
    delete values.PayloadVersion;
    delete values.PayloadUUID;
    delete values.PayloadIdentifier;
    payloads.push({
      id: crypto.randomUUID(),
      profileId: payloadType,
      payloadType,
      values,
    });
  }

  return { meta, payloads, warnings };
}

export function parseDeclarationJSON(jsonString, schemasData) {
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (e) {
    throw new Error(`Invalid JSON: ${e.message}`);
  }
  const array = Array.isArray(parsed) ? parsed : [parsed];

  const typeToId = {};
  for (const [key, schema] of Object.entries(schemasData.declarations || {})) {
    const t = schema?.payload?.declarationtype;
    if (t) typeToId[t] = key;
  }

  const warnings = [];
  const declarations = [];
  for (const entry of array) {
    if (!entry || typeof entry !== "object") continue;
    const type = entry.Type;
    if (!type) {
      warnings.push("Declaration missing Type — skipped.");
      continue;
    }
    const declId = typeToId[type];
    if (!declId) {
      warnings.push(`Unknown declaration type "${type}" — skipped.`);
      continue;
    }
    declarations.push({
      id: crypto.randomUUID(),
      declarationId: declId,
      identifier: entry.Identifier || crypto.randomUUID(),
      serverToken: entry.ServerToken || crypto.randomUUID(),
      values:
        entry.Payload && typeof entry.Payload === "object" ? entry.Payload : {},
    });
  }

  return { declarations, warnings };
}
