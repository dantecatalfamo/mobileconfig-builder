import { useState } from "react";

export function PreviewPanel({ content, filename }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="preview-panel">
      <div className="preview-header">
        <span className="preview-title">Preview · {filename}</span>
        <div className="preview-actions">
          <button onClick={copy}>{copied ? "✓ Copied" : "Copy"}</button>
        </div>
      </div>
      <pre className="preview-code">{content}</pre>
    </div>
  );
}
