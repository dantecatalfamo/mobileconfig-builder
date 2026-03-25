import { useState, useEffect } from 'react'
import { MDMMode } from './components/MDMMode'
import { DeclarativeMode } from './components/DeclarativeMode'

export default function App() {
  const [mode, setMode] = useState('mdm')
  const [schemasData, setSchemasData] = useState(null)

  useEffect(() => {
    import('./schemas.json').then(m => setSchemasData(m.default))
  }, [])

  if (!schemasData) return <div className="app"><p style={{textAlign:'center',marginTop:'4rem',color:'var(--text2)'}}>Loading schemas…</p></div>

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

      {mode === 'mdm' ? <MDMMode schemasData={schemasData} /> : <DeclarativeMode schemasData={schemasData} />}

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
