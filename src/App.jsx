import { useState } from 'react'
import { MDMMode } from './components/MDMMode'
import { DeclarativeMode } from './components/DeclarativeMode'
import schemasData from './schemas.json'

export default function App() {
  const [mode, setMode] = useState('mdm')

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">⚙</span>
            <span className="logo-text">mobileconfig <span className="logo-sub">builder</span></span>
          </div>
          <div className="mode-switcher">
            <button className={`mode-btn ${mode==='mdm'?'active':''}`} onClick={()=>setMode('mdm')}>
              MDM Profiles
            </button>
            <button className={`mode-btn ${mode==='declarative'?'active':''}`} onClick={()=>setMode('declarative')}>
              Declarative
            </button>
          </div>
        </div>
      </header>

      {mode === 'mdm' ? <MDMMode /> : <DeclarativeMode />}

      {schemasData._appleLicense && (
        <footer className="app-footer">
          <details className="license-details">
            <summary>Schema data sourced from Apple Inc. — MIT License</summary>
            <pre className="license-text">{schemasData._appleLicense}</pre>
          </details>
        </footer>
      )}
    </div>
  )
}
