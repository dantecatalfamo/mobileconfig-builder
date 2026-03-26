import { useState } from "react";
import { MDMMode } from "./components/MDMMode";
import { DeclarativeMode } from "./components/DeclarativeMode";
import schemasData from "./schemas.json";

export default function App() {
  const [mode, setMode] = useState("mdm");

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">⚙</span>
            <span className="logo-text">
              mobileconfig <span className="logo-sub">builder</span>
            </span>
          </div>
          <div className="mode-switcher">
            <button
              className={`mode-btn ${mode === "mdm" ? "active" : ""}`}
              onClick={() => setMode("mdm")}
            >
              MDM Profiles
            </button>
            <button
              className={`mode-btn ${mode === "declarative" ? "active" : ""}`}
              onClick={() => setMode("declarative")}
            >
              Declarative
            </button>
          </div>
        </div>
      </header>

      {mode === "mdm" ? (
        <MDMMode schemasData={schemasData} />
      ) : (
        <DeclarativeMode schemasData={schemasData} />
      )}

      <footer className="app-footer">
        <div className="footer-info">
          <div className="footer-left">
            <span>© 2026 Dante Catalfamo</span>
            <span className="footer-sep">·</span>
            <span>AGPL-3.0</span>
            <span className="footer-sep">·</span>
            <a
              href="https://github.com/dantecatalfamo/mobileconfig-builder"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
          </div>
          <span>
            Schema built{" "}
            {new Date(schemasData._meta.generatedAt).toLocaleDateString(
              undefined,
              { year: "numeric", month: "short", day: "numeric" },
            )}
          </span>
        </div>
        {schemasData._appleLicense && (
          <details className="license-details">
            <summary>Schema data sourced from Apple Inc. — MIT License</summary>
            <pre className="license-text">{schemasData._appleLicense}</pre>
          </details>
        )}
      </footer>
    </div>
  );
}
