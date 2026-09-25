import { isEmpty, anyEntryKeys } from "../lib/validation";
import { FieldLabel } from "./FieldLabel";
import { isTyped } from "../lib/plistValue";

const TYPE_MAP = {
  "<string>": "text",
  "<integer>": "number",
  "<real>": "number",
  "<boolean>": "checkbox",
  "<date>": "date",
  "<data>": "textarea",
  "<dictionary>": "dict",
  "<array>": "array",
};
export const getInputType = kd => TYPE_MAP[kd.type || "<string>"] || "text";

export function ArrayField({
  keyDef,
  value = [],
  onChange,
  showErrors,
  payloadSupportedOS,
}) {
  if (keyDef.subkeys === null) {
    return (
      <span className="dict-empty">
        <em>Nested items not configurable (recursive schema)</em>
      </span>
    );
  }
  // Be tolerant of imported scalars where the schema expects an array (Apple
  // SAN keys, for example, accept "string or array of strings").
  const arr = Array.isArray(value)
    ? value
    : value === undefined || value === null || value === ""
      ? []
      : [value];
  const itemSchema = keyDef.subkeys?.[0];
  const itemIsDic = itemSchema?.type === "<dictionary>";
  const itemIsArr = itemSchema?.type === "<array>";
  const add = () => onChange([...arr, itemIsDic ? {} : itemIsArr ? [] : ""]);
  const remove = i => onChange(arr.filter((_, idx) => idx !== i));
  const update = (i, v) => onChange(arr.map((x, idx) => (idx === i ? v : x)));
  return (
    <div className="array-field">
      {arr.map((item, i) => (
        <div key={i} className="array-item">
          {itemIsDic ? (
            <div className="array-dict-item">
              <DictField
                keyDef={itemSchema}
                value={item}
                onChange={v => update(i, v)}
                showErrors={showErrors}
                payloadSupportedOS={payloadSupportedOS}
              />
            </div>
          ) : itemIsArr ? (
            <div className="array-dict-item">
              {itemSchema.subkeys?.length ? (
                <ArrayField
                  keyDef={itemSchema}
                  value={Array.isArray(item) ? item : []}
                  onChange={v => update(i, v)}
                  showErrors={showErrors}
                  payloadSupportedOS={payloadSupportedOS}
                />
              ) : (
                <span className="dict-empty">
                  <em>Nested items not configurable (recursive schema)</em>
                </span>
              )}
            </div>
          ) : item != null && typeof item === "object" ? (
            <ReadOnlyValue value={item} />
          ) : (
            <input
              type="text"
              value={item}
              placeholder={itemSchema?.title || itemSchema?.key || "Value"}
              onChange={e => update(i, e.target.value)}
            />
          )}
          <button className="rm-btn" onClick={() => remove(i)}>
            ×
          </button>
        </div>
      ))}
      <button className="add-btn" onClick={add}>
        + Add {itemSchema?.title || itemSchema?.key || "item"}
      </button>
    </div>
  );
}

export function DictField({
  keyDef,
  value = {},
  onChange,
  showErrors,
  payloadSupportedOS,
}) {
  const subkeys = keyDef.subkeys || [];
  const anyDef = subkeys.find(sk => sk.key === "ANY");
  const named = subkeys.filter(sk => sk.key !== "ANY");
  if (!subkeys.length)
    return (
      <div className="dict-empty">
        <em>No sub-keys defined</em>
      </div>
    );
  return (
    <div className="dict-field">
      {named.map(sk => {
        const isMissing =
          showErrors && sk.presence === "required" && isEmpty(value[sk.key]);
        return (
          <div
            key={sk.key}
            className={`sub-field ${isMissing ? "field-missing" : ""}`}
          >
            <FieldLabel
              title={sk.title}
              keyName={sk.key}
              description={sk.content}
              required={sk.presence === "required"}
              supportedOS={sk.supportedOS}
              payloadSupportedOS={payloadSupportedOS}
              defaultVal={sk.default}
            />
            <FieldInput
              keyDef={sk}
              value={value[sk.key]}
              onChange={v => onChange({ ...value, [sk.key]: v })}
              showErrors={showErrors}
              payloadSupportedOS={payloadSupportedOS}
            />
          </div>
        );
      })}
      {anyDef && (
        <AnyEntries
          anyDef={anyDef}
          knownKeys={named.map(sk => sk.key)}
          value={value}
          onChange={onChange}
          showErrors={showErrors}
          payloadSupportedOS={payloadSupportedOS}
          missing={
            showErrors &&
            anyDef.presence === "required" &&
            !anyEntryKeys(named, value).length
          }
        />
      )}
    </div>
  );
}

function emptyValueFor(type) {
  if (type === "<dictionary>") return {};
  if (type === "<array>") return [];
  if (type === "<boolean>") return false;
  return "";
}

// Editor for the arbitrarily-named entries a wildcard ANY sub-key allows:
// each entry gets an editable key name and a value input typed from anyDef.
export function AnyEntries({
  anyDef,
  knownKeys,
  value = {},
  onChange,
  showErrors,
  payloadSupportedOS,
  missing,
}) {
  const entries = anyEntryKeys([], value, knownKeys);
  const noun = anyDef.title || "entry";
  const rename = (from, to) => {
    if (to === from || to in value || knownKeys.includes(to)) return;
    onChange(
      Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k === from ? to : k, v]),
      ),
    );
  };
  const remove = k => {
    const next = { ...value };
    delete next[k];
    onChange(next);
  };
  const add = () => {
    let name = "key";
    for (let i = 2; name in value || knownKeys.includes(name); i++)
      name = `key${i}`;
    onChange({ ...value, [name]: emptyValueFor(anyDef.type) });
  };
  return (
    <div className={`any-entries ${missing ? "field-missing" : ""}`}>
      {entries.map((k, i) => (
        <div key={i} className="any-entry">
          <div className="any-entry-head">
            <input
              className="any-key-input"
              type="text"
              value={k}
              placeholder="Key"
              aria-label="Key name"
              onChange={e => rename(k, e.target.value)}
            />
            <button className="rm-btn" onClick={() => remove(k)}>
              ×
            </button>
          </div>
          <FieldInput
            keyDef={{ ...anyDef, key: k, title: k, presence: "required" }}
            value={value[k]}
            onChange={v => onChange({ ...value, [k]: v })}
            showErrors={showErrors}
            payloadSupportedOS={payloadSupportedOS}
          />
        </div>
      ))}
      <button className="add-btn" onClick={add}>
        + Add {noun}
      </button>
    </div>
  );
}

// Structured imported value the form can't edit; exported unchanged.
function ReadOnlyValue({ value }) {
  const text = isTyped(value)
    ? `${value.$plistType} ${value.value}`
    : JSON.stringify(value, null, 2);
  return (
    <div className="any-value">
      <pre>{text}</pre>
      <span className="dict-empty">
        <em>Imported value — preserved as-is, not editable here</em>
      </span>
    </div>
  );
}

export function FieldInput({
  keyDef,
  value,
  onChange,
  showErrors,
  payloadSupportedOS,
}) {
  const inputType = getInputType(keyDef);
  const type = keyDef.type || "<string>";
  // Structured values with no editable schema (<any>, or imported data whose
  // shape differs from the schema) are shown read-only and exported as-is.
  if (
    value != null &&
    typeof value === "object" &&
    (isTyped(value) ||
      !(
        (inputType === "array" && Array.isArray(value)) ||
        (inputType === "dict" && !Array.isArray(value))
      ))
  )
    return <ReadOnlyValue value={value} />;
  if (keyDef.rangelist)
    return (
      <select value={value ?? ""} onChange={e => onChange(e.target.value)}>
        <option value="">— select —</option>
        {keyDef.rangelist.map(opt => (
          <option key={String(opt)} value={String(opt)}>
            {String(opt)}
          </option>
        ))}
      </select>
    );
  if (inputType === "checkbox")
    return (
      <label className="toggle">
        <input
          type="checkbox"
          checked={value === true || value === "true"}
          onChange={e => onChange(e.target.checked)}
        />
        <span className="toggle-slider" />
      </label>
    );
  if (inputType === "array")
    return (
      <ArrayField
        keyDef={keyDef}
        value={value}
        onChange={onChange}
        showErrors={showErrors}
        payloadSupportedOS={payloadSupportedOS}
      />
    );
  if (inputType === "dict") {
    if (keyDef.presence !== "required" && value == null)
      return (
        <button className="add-btn" onClick={() => onChange({})}>
          + Add {keyDef.title || keyDef.key}
        </button>
      );
    return (
      <div className="dict-with-remove">
        <DictField
          keyDef={keyDef}
          value={value ?? {}}
          onChange={onChange}
          showErrors={showErrors}
          payloadSupportedOS={payloadSupportedOS}
        />
        {keyDef.presence !== "required" && (
          <button className="rm-dict-btn" onClick={() => onChange(undefined)}>
            Remove
          </button>
        )}
      </div>
    );
  }
  if (inputType === "textarea" || type === "<data>")
    return (
      <textarea
        value={value ?? ""}
        onChange={e => onChange(e.target.value)}
        rows={3}
        placeholder={keyDef.title || keyDef.key}
      />
    );
  return (
    <input
      type={inputType}
      value={value ?? ""}
      onChange={e =>
        onChange(
          inputType === "number" ? Number(e.target.value) : e.target.value,
        )
      }
      min={keyDef.range?.min}
      max={keyDef.range?.max}
      pattern={keyDef.format}
    />
  );
}
