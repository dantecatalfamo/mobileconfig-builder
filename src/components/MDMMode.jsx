import { useState, useMemo } from "react";
import { generateMobileconfig } from "../lib/plist";
import { validateMDM } from "../lib/validation";
import { buildDefaultValues } from "../lib/schema";
import { LabelWithHelp } from "./FieldLabel";
import { ItemForm } from "./ItemForm";
import { ItemPicker } from "./ItemPicker";
import { PreviewPanel } from "./PreviewPanel";

export function MDMMode({ schemasData }) {
  const [meta, setMeta] = useState({
    displayName: "",
    identifier: "com.example.profile",
    organization: "",
    description: "",
    scope: "System",
    removalDisallowed: false,
  });
  const [payloads, setPayloads] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [touched, setTouched] = useState(false);

  const addPayload = id => {
    const schema = schemasData.profiles[id];
    setTouched(true);
    setPayloads(ps => [
      ...ps,
      {
        id: crypto.randomUUID(),
        profileId: id,
        payloadType: schema?.payload?.payloadtype || id,
        values: buildDefaultValues(schema?.payloadkeys),
      },
    ]);
  };
  const updatePayload = (id, values) => {
    setTouched(true);
    setPayloads(ps => ps.map(p => (p.id === id ? { ...p, values } : p)));
  };
  const removePayload = id => {
    setTouched(true);
    setPayloads(ps => ps.filter(p => p.id !== id));
  };

  const { metaErrors, payloadErrors } = useMemo(
    () => validateMDM(schemasData, meta, payloads),
    [schemasData, meta, payloads],
  );
  const isValid = !metaErrors.length && !Object.keys(payloadErrors).length;
  if (isValid && showErrors) setShowErrors(false);

  const plistOutput = useMemo(() => {
    if (!isValid) return null;
    return generateMobileconfig(
      schemasData,
      meta,
      payloads.map(p => ({
        profileId: p.profileId,
        payloadType: p.payloadType,
        values: p.values,
      })),
    );
  }, [isValid, schemasData, meta, payloads]);

  const filename = `${(meta.identifier || "profile").replace(/[^a-zA-Z0-9.-]/g, "_")}.mobileconfig`;
  const totalErrors =
    metaErrors.length +
    Object.values(payloadErrors).reduce((n, e) => n + e.length, 0);

  const handleDownload = () => {
    setTouched(true);
    if (!isValid) {
      setShowErrors(true);
      return;
    }
    const blob = new Blob([plistOutput], {
      type: "application/x-apple-aspen-config",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const setMetaField = (k, v) => {
    setTouched(true);
    setMeta(m => ({ ...m, [k]: v }));
  };
  const hasMetaError = f =>
    showErrors &&
    metaErrors.some(e => e.toLowerCase().includes(f.toLowerCase()));

  return (
    <>
      <div className="mode-toolbar">
        <div className="mode-toolbar-inner">
          <div className="mode-toolbar-left">
            <span className="payload-count">
              {payloads.length} payload{payloads.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="mode-toolbar-right">
            <button
              className={`preview-toggle ${showPreview ? "active" : ""}`}
              onClick={() => setShowPreview(s => !s)}
              disabled={!plistOutput}
            >
              {showPreview ? "Hide Preview" : "Preview XML"}
            </button>
            <button
              className={`download-header-btn ${!touched ? "btn-neutral" : isValid ? "btn-valid" : "btn-invalid"}`}
              onClick={handleDownload}
              title={
                touched && !isValid
                  ? `${totalErrors} required field${totalErrors !== 1 ? "s" : ""} missing`
                  : `Download ${filename}`
              }
            >
              Download .mobileconfig
              {touched && !isValid && totalErrors > 0 && (
                <span className="error-badge">{totalErrors}</span>
              )}
            </button>
          </div>
        </div>
      </div>

      <main className="app-main">
        <div className={`editor-pane ${showPreview ? "with-preview" : ""}`}>
          {/* Profile identity */}
          <div
            className={`meta-form ${showErrors && metaErrors.length ? "has-errors" : ""}`}
          >
            <h2>Profile Identity</h2>
            {showErrors && metaErrors.length > 0 && (
              <div className="meta-errors">
                {metaErrors.map(e => (
                  <span key={e} className="payload-error-tag">
                    {e}
                  </span>
                ))}
              </div>
            )}
            <div className="meta-grid">
              <div
                className={`field ${hasMetaError("Display") ? "field-missing" : ""}`}
              >
                <LabelWithHelp
                  label="Display Name"
                  required
                  help="The human-readable name shown to users when they view or install this profile on their device."
                />
                <input
                  type="text"
                  value={meta.displayName}
                  onChange={e => setMetaField("displayName", e.target.value)}
                  placeholder="My Corporate Profile"
                />
              </div>
              <div
                className={`field ${hasMetaError("Identifier") ? "field-missing" : ""}`}
              >
                <LabelWithHelp
                  label="Identifier"
                  required
                  help={
                    <>
                      A reverse-DNS style string that uniquely identifies this
                      profile (e.g. <code>com.acme.wifi.corporate</code>). Used
                      by the OS to match against existing installed profiles for
                      updates.
                    </>
                  }
                />
                <input
                  type="text"
                  value={meta.identifier}
                  onChange={e => setMetaField("identifier", e.target.value)}
                  placeholder="com.example.profile"
                />
              </div>
              <div className="field">
                <LabelWithHelp
                  label="Organization"
                  help="The name of the organization that created this profile. Shown to users during installation."
                />
                <input
                  type="text"
                  value={meta.organization}
                  onChange={e => setMetaField("organization", e.target.value)}
                  placeholder="Acme Corp"
                />
              </div>
              <div className="field">
                <LabelWithHelp
                  label="Description"
                  help="A short explanation of what this profile does. Shown on the profile detail screen in Settings."
                />
                <input
                  type="text"
                  value={meta.description}
                  onChange={e => setMetaField("description", e.target.value)}
                  placeholder="Profile description"
                />
              </div>
              <div className="field">
                <LabelWithHelp
                  label="Scope"
                  help={
                    <>
                      <strong>System</strong> applies the profile device-wide.{" "}
                      <strong>User</strong> applies it only to the currently
                      logged-in user (macOS only).
                    </>
                  }
                />
                <select
                  value={meta.scope}
                  onChange={e => setMetaField("scope", e.target.value)}
                >
                  <option value="System">System</option>
                  <option value="User">User</option>
                </select>
              </div>
              <div className="field field-toggle">
                <LabelWithHelp
                  label="Removal Disallowed"
                  help="When enabled, users cannot manually remove this profile from their device. Requires MDM supervision or enrollment to take effect."
                />
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={meta.removalDisallowed}
                    onChange={e =>
                      setMetaField("removalDisallowed", e.target.checked)
                    }
                  />
                  <span className="toggle-slider" />
                </label>
              </div>
            </div>
          </div>

          {/* Payloads */}
          <div className="payloads-section">
            <div className="payloads-header">
              <h2>Payloads</h2>
              <ItemPicker
                schemas={schemasData.profiles}
                onAdd={addPayload}
                label="Add Payload"
              />
            </div>
            {!payloads.length && (
              <div className="empty-state">
                <p>No payloads added yet.</p>
                <p className="empty-hint">
                  Click <strong>＋ Add Payload</strong> to choose from{" "}
                  {Object.keys(schemasData.profiles).length} Apple MDM payload
                  types.
                </p>
              </div>
            )}
            {payloads.map(p => {
              const schema = schemasData.profiles[p.profileId];
              return (
                <ItemForm
                  key={p.id}
                  badge={p.payloadType}
                  title={schema?.title}
                  description={schema?.description}
                  payloadkeys={schema?.payloadkeys}
                  values={p.values}
                  onChange={v => updatePayload(p.id, v)}
                  onRemove={() => removePayload(p.id)}
                  errors={showErrors ? payloadErrors[p.id] || [] : []}
                  showErrors={showErrors}
                  payloadSupportedOS={schema?.payload?.supportedOS}
                />
              );
            })}
          </div>
        </div>

        {showPreview && plistOutput && (
          <div className="preview-pane">
            <PreviewPanel content={plistOutput} filename={filename} />
          </div>
        )}
      </main>
    </>
  );
}
