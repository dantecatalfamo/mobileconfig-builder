import { isTyped } from "./plistValue";

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function isDefault(value, def) {
  if (typeof def === "boolean") return value === def || value === String(def);
  // eslint-disable-next-line eqeqeq
  return value == def;
}
function ind(n) {
  return "\t".repeat(n);
}

// Plist type for a value with no usable schema definition (unknown or
// arbitrary-name keys, <any>, or imported data whose shape differs from the
// schema), so imported profiles round-trip without losing data.
function inferType(value) {
  if (isTyped(value)) return value.$plistType;
  if (typeof value === "boolean") return "<boolean>";
  if (typeof value === "number")
    return Number.isInteger(value) ? "<integer>" : "<real>";
  if (Array.isArray(value)) return "<array>";
  if (typeof value === "object") return "<dictionary>";
  return "<string>";
}

function fitsType(value, type) {
  switch (type) {
    case "<array>":
      return Array.isArray(value);
    case "<dictionary>":
      return (
        typeof value === "object" && !Array.isArray(value) && !isTyped(value)
      );
    case "<boolean>":
      return (
        typeof value === "boolean" || value === "true" || value === "false"
      );
    case "<integer>":
    case "<real>":
      return typeof value !== "object" && !isNaN(Number(value));
    case "<string>":
      return typeof value === "string";
    case "<date>":
    case "<data>":
      return typeof value === "string" || value?.$plistType === type;
    default:
      return false;
  }
}

function resolveType(value, keyDef) {
  return keyDef && fitsType(value, keyDef.type)
    ? keyDef.type
    : inferType(value);
}

// Schema for a dict entry: the named sub-key, else the wildcard ANY sub-key.
function schemaLookup(subkeyDefs = []) {
  const byKey = Object.fromEntries(
    (subkeyDefs || []).filter(s => s.key).map(s => [s.key, s]),
  );
  const anyDef = byKey.ANY;
  return key => (key !== "ANY" && byKey[key]) || anyDef;
}

function valueToPlistLines(value, type, depth, subkeys = []) {
  const pad = ind(depth);
  if (value === undefined || value === null || value === "") return [];
  if (type === "<boolean>") {
    return [
      `${pad}<${value === true || value === "true" || value === 1 ? "true" : "false"}/>`,
    ];
  }
  if (type === "<integer>" || type === "<real>") {
    const num = Number(value);
    if (isNaN(num)) return [];
    const tag = type === "<real>" ? "real" : "integer";
    return [`${pad}<${tag}>${num}</${tag}>`];
  }
  if (type === "<date>" || type === "<data>") {
    const tag = type.slice(1, -1);
    const raw = isTyped(value) ? value.value : value;
    return [`${pad}<${tag}>${escapeXml(raw)}</${tag}>`];
  }
  if (type === "<array>") {
    if (!Array.isArray(value) || value.length === 0) return [];
    const itemSchema = subkeys?.[0];
    const lines = [`${pad}<array>`];
    for (const item of value) {
      if (item === undefined || item === null || item === "") continue;
      lines.push(
        ...valueToPlistLines(
          item,
          resolveType(item, itemSchema),
          depth + 1,
          itemSchema?.subkeys || [],
        ),
      );
    }
    lines.push(`${pad}</array>`);
    return lines;
  }
  if (type === "<dictionary>") {
    if (typeof value !== "object" || Array.isArray(value)) return [];
    return [
      `${pad}<dict>`,
      ...entryLines(value, subkeys, depth + 1),
      `${pad}</dict>`,
    ];
  }
  if (typeof value === "object") return [];
  return [`${pad}<string>${escapeXml(String(value))}</string>`];
}

// <key>/<value> lines for each entry of obj, skipping empty values and
// optional values equal to their schema default.
function entryLines(obj, subkeyDefs, depth, skipKeys = []) {
  const lookup = schemaLookup(subkeyDefs);
  const lines = [];
  for (const [key, value] of Object.entries(obj)) {
    if (skipKeys.includes(key)) continue;
    if (value === undefined || value === null || value === "") continue;
    const sk = lookup(key);
    if (
      sk &&
      sk.default !== undefined &&
      sk.presence !== "required" &&
      isDefault(value, sk.default)
    )
      continue;
    const vlines = valueToPlistLines(
      value,
      resolveType(value, sk),
      depth,
      sk?.subkeys || [],
    );
    if (!vlines.length) continue;
    lines.push(`${ind(depth)}<key>${escapeXml(key)}</key>`, ...vlines);
  }
  return lines;
}

export function generateMobileconfig(schemasData, profileMeta, payloadForms) {
  const profileUUID = crypto.randomUUID().toUpperCase();
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    "<dict>",
    "\t<key>PayloadContent</key>",
    "\t<array>",
  ];
  for (const form of payloadForms) {
    const payloadUUID = crypto.randomUUID().toUpperCase();
    lines.push("\t\t<dict>");
    lines.push(
      "\t\t\t<key>PayloadType</key>",
      `\t\t\t<string>${escapeXml(form.payloadType)}</string>`,
    );
    lines.push("\t\t\t<key>PayloadVersion</key>", "\t\t\t<integer>1</integer>");
    lines.push(
      "\t\t\t<key>PayloadUUID</key>",
      `\t\t\t<string>${payloadUUID}</string>`,
    );
    lines.push(
      "\t\t\t<key>PayloadIdentifier</key>",
      `\t\t\t<string>${escapeXml(profileMeta.identifier)}.${escapeXml(form.payloadType)}</string>`,
    );
    lines.push(
      ...entryLines(
        form.values,
        schemasData.profiles[form.profileId]?.payloadkeys,
        3,
        ["PayloadType", "PayloadVersion", "PayloadUUID", "PayloadIdentifier"],
      ),
    );
    lines.push("\t\t</dict>");
  }
  lines.push("\t</array>");
  lines.push(
    "\t<key>PayloadDescription</key>",
    `\t<string>${escapeXml(profileMeta.description)}</string>`,
  );
  lines.push(
    "\t<key>PayloadDisplayName</key>",
    `\t<string>${escapeXml(profileMeta.displayName)}</string>`,
  );
  lines.push(
    "\t<key>PayloadIdentifier</key>",
    `\t<string>${escapeXml(profileMeta.identifier)}</string>`,
  );
  lines.push(
    "\t<key>PayloadOrganization</key>",
    `\t<string>${escapeXml(profileMeta.organization)}</string>`,
  );
  lines.push(
    "\t<key>PayloadRemovalDisallowed</key>",
    `\t<${profileMeta.removalDisallowed ? "true" : "false"}/>`,
  );
  lines.push(
    "\t<key>PayloadScope</key>",
    `\t<string>${escapeXml(profileMeta.scope)}</string>`,
  );
  lines.push("\t<key>PayloadType</key>", "\t<string>Configuration</string>");
  lines.push("\t<key>PayloadUUID</key>", `\t<string>${profileUUID}</string>`);
  lines.push("\t<key>PayloadVersion</key>", "\t<integer>1</integer>");
  lines.push("</dict>", "</plist>");
  return lines.join("\n");
}
