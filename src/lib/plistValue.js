// Imported <data>/<date> values at positions the schema doesn't type as such
// (unknown keys, <any>) are kept wrapped so they re-export with their original
// plist type instead of degrading to <string>.
export const typedValue = (type, value) => ({ $plistType: type, value });
export const isTyped = v =>
  v != null && typeof v === "object" && typeof v.$plistType === "string";
