export function ImportWarnings({ warnings, onClose }) {
  if (!warnings || !warnings.length) return null;
  return (
    <div className="import-warnings">
      <div className="import-warnings-header">
        <span className="import-warnings-title">
          Import notes ({warnings.length})
        </span>
        <button
          className="import-warnings-close"
          onClick={onClose}
          aria-label="Dismiss import warnings"
        >
          ×
        </button>
      </div>
      <ul className="import-warnings-list">
        {warnings.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ul>
    </div>
  );
}
