import { useState, useMemo } from 'react'
import schemasData from '../schemas.json'
import { generateDeclarationJSON } from '../lib/serialize'
import { validateDeclarative } from '../lib/validation'
import { FieldLabel, LabelWithHelp } from './FieldLabel'
import { FieldInput } from './FormFields'
import { ItemPicker } from './ItemPicker'
import { PreviewPanel } from './PreviewPanel'

export function DeclarativeMode() {
  const [declarations, setDeclarations] = useState([])
  const [showPreview, setShowPreview] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [touched, setTouched] = useState(false)

  const addDeclaration = id => {
    setTouched(true)
    setDeclarations(ds=>[...ds,{
      id: crypto.randomUUID(),
      declarationId: id,
      identifier: crypto.randomUUID(),
      serverToken: crypto.randomUUID(),
      values: {},
    }])
  }
  const updateDeclaration = (id, patch) => { setTouched(true); setDeclarations(ds=>ds.map(d=>d.id===id?{...d,...patch}:d)) }
  const removeDeclaration = id => { setTouched(true); setDeclarations(ds=>ds.filter(d=>d.id!==id)) }

  const declErrors = useMemo(()=>validateDeclarative(declarations),[declarations])
  const isValid = !Object.keys(declErrors).length && declarations.length > 0
  if (isValid && showErrors) setShowErrors(false)

  const jsonOutput = useMemo(()=>{
    if (!declarations.length) return null
    return JSON.stringify(generateDeclarationJSON(declarations), null, 2)
  },[declarations])

  const totalErrors = Object.values(declErrors).reduce((n,e)=>n+e.length,0)

  const handleDownload = () => {
    setTouched(true)
    if (!isValid) { setShowErrors(true); return }
    const blob = new Blob([jsonOutput],{type:'application/json'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download='declarations.json'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="mode-toolbar">
        <div className="mode-toolbar-left">
          <span className="payload-count">{declarations.length} declaration{declarations.length!==1?'s':''}</span>
          <span className="decl-note">Declarative Device Management · outputs JSON</span>
        </div>
        <div className="mode-toolbar-right">
          <button className={`preview-toggle ${showPreview?'active':''}`} onClick={()=>setShowPreview(s=>!s)} disabled={!jsonOutput}>
            {showPreview?'Hide Preview':'Preview JSON'}
          </button>
          <button className={`download-header-btn ${!touched?'btn-neutral':isValid?'btn-valid':'btn-invalid'}`} onClick={handleDownload}>
            ⬇ Download declarations.json
            {touched && !isValid && totalErrors>0 && <span className="error-badge">{totalErrors}</span>}
            {touched && !isValid && !declarations.length && <span className="error-badge">!</span>}
          </button>
        </div>
      </div>

      <main className="app-main">
        <div className={`editor-pane ${showPreview?'with-preview':''}`}>

          <div className="payloads-section">
            <div className="payloads-header">
              <h2>Declarations</h2>
              <ItemPicker schemas={schemasData.declarations} onAdd={addDeclaration} label="Add Declaration" />
            </div>

            {!declarations.length && (
              <div className="empty-state">
                <p>No declarations added yet.</p>
                <p className="empty-hint">Click <strong>＋ Add Declaration</strong> to choose from {Object.keys(schemasData.declarations).length} declaration types across configurations, activations, and assets.</p>
              </div>
            )}

            {declarations.map(d => {
              const schema = schemasData.declarations[d.declarationId]
              const declType = schema?.payload?.declarationtype || d.declarationId
              return (
                <div key={d.id} className={`payload-form ${showErrors&&declErrors[d.id]?.length?'has-errors':''}`}>
                  <div className="payload-form-header">
                    <div>
                      <span className={`payload-type-badge badge-decl-${schema?._category||'other'}`}>{declType}</span>
                      {schema?.title && <span className="payload-title">{schema.title}</span>}
                    </div>
                    <div className="payload-form-header-right">
                      {showErrors && declErrors[d.id]?.length>0 && <span className="payload-error-count">{declErrors[d.id].length} required field{declErrors[d.id].length!==1?'s':''} missing</span>}
                      <button className="rm-payload-btn" onClick={()=>removeDeclaration(d.id)}>Remove</button>
                    </div>
                  </div>

                  {schema?.description && <p className="payload-desc">{schema.description}</p>}

                  {showErrors && declErrors[d.id]?.length>0 && (
                    <div className="payload-errors">
                      <span className="payload-errors-label">Required:</span>
                      {declErrors[d.id].map(e=><span key={e} className="payload-error-tag">{e}</span>)}
                    </div>
                  )}

                  {/* Declaration identity fields */}
                  <div className="fields decl-identity-fields">
                    <div className="field">
                      <LabelWithHelp label="Identifier" required help={<>A string that uniquely identifies this declaration within your declaration set. Must be stable across updates — the OS uses it to match the declaration to its previously installed version. A UUID is a safe default (pre-filled), but a human-readable reverse-DNS string like <code>com.acme.wifi.corp</code> works too and is easier to reference from activations.</>} />
                      <input type="text" value={d.identifier} onChange={e=>updateDeclaration(d.id,{identifier:e.target.value})} placeholder="Unique identifier (UUID recommended)" />
                    </div>
                    <div className="field">
                      <LabelWithHelp label="Server Token" required help={<>An opaque string the server uses to indicate a specific revision of this declaration. The device compares this to its cached copy — if the tokens differ, it re-applies the declaration. Change this value every time you update the declaration's payload. A new UUID (pre-filled) or an incrementing value like <code>v2</code> both work.</>} />
                      <input type="text" value={d.serverToken} onChange={e=>updateDeclaration(d.id,{serverToken:e.target.value})} placeholder="Revision token" />
                    </div>
                  </div>

                  {/* Payload-specific keys */}
                  <div className="fields">
                    {(schema?.payloadkeys||[]).map(keyDef => {
                      const isMissing = showErrors && declErrors[d.id]?.includes(keyDef.title||keyDef.key)
                      return (
                        <div key={keyDef.key} className={`field ${keyDef.presence==='required'?'required-field':''} ${isMissing?'field-missing':''}`}>
                          <FieldLabel title={keyDef.title} keyName={keyDef.key} description={keyDef.content} required={keyDef.presence==='required'} />
                          <FieldInput keyDef={keyDef} value={d.values[keyDef.key]} onChange={v=>updateDeclaration(d.id,{values:{...d.values,[keyDef.key]:v}})} showErrors={showErrors} />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {showPreview && jsonOutput && (
          <div className="preview-pane">
            <PreviewPanel content={jsonOutput} filename="declarations.json" />
          </div>
        )}
      </main>
    </>
  )
}
