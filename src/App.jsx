import { useState, useMemo, useCallback } from 'react'
import schemasData from './schemas.json'

// ─── Plist serializer (MDM profiles → .mobileconfig XML) ─────────────────────

function escapeXml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
function ind(n) { return '\t'.repeat(n) }

function valueToPlistLines(value, type, depth, subkeys = []) {
  const pad = ind(depth)
  if (value === undefined || value === null || value === '') return []
  if (type === '<boolean>') {
    return [`${pad}<${(value === true || value === 'true' || value === 1) ? 'true' : 'false'}/>`]
  }
  if (type === '<integer>' || type === '<real>') {
    const num = Number(value); if (isNaN(num)) return []
    const tag = type === '<real>' ? 'real' : 'integer'
    return [`${pad}<${tag}>${num}</${tag}>`]
  }
  if (type === '<date>') return [`${pad}<date>${escapeXml(value)}</date>`]
  if (type === '<data>') return [`${pad}<data>${escapeXml(value)}</data>`]
  if (type === '<array>') {
    if (!Array.isArray(value) || value.length === 0) return []
    const itemSchema = subkeys[0]
    const lines = [`${pad}<array>`]
    for (const item of value) {
      if (item === undefined || item === null || item === '') continue
      if (itemSchema?.type === '<dictionary>' || (typeof item === 'object' && !Array.isArray(item))) {
        lines.push(...dictToPlistLines(item, itemSchema?.subkeys || [], depth + 1))
      } else {
        lines.push(...valueToPlistLines(item, itemSchema?.type || '<string>', depth + 1, itemSchema?.subkeys || []))
      }
    }
    lines.push(`${pad}</array>`); return lines
  }
  if (type === '<dictionary>') {
    if (typeof value !== 'object' || Array.isArray(value)) return []
    return dictToPlistLines(value, subkeys, depth)
  }
  if (typeof value === 'object') return []
  return [`${pad}<string>${escapeXml(String(value))}</string>`]
}

function dictToPlistLines(obj, subkeyDefs = [], depth) {
  const pad = ind(depth), inner = ind(depth + 1)
  const lines = [`${pad}<dict>`]
  const schemaByKey = Object.fromEntries((subkeyDefs || []).filter(s => s.key).map(s => [s.key, s]))
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null || value === '') continue
    const sk = schemaByKey[key]
    const type = sk?.type || (typeof value === 'boolean' ? '<boolean>' : typeof value === 'number' ? '<integer>' : '<string>')
    const vlines = valueToPlistLines(value, type, depth + 1, sk?.subkeys || [])
    if (!vlines.length) continue
    lines.push(`${inner}<key>${escapeXml(key)}</key>`, ...vlines)
  }
  lines.push(`${pad}</dict>`); return lines
}

function generateMobileconfig(profileMeta, payloadForms) {
  const profileUUID = crypto.randomUUID().toUpperCase()
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">','<dict>',
    '\t<key>PayloadContent</key>','\t<array>',
  ]
  for (const form of payloadForms) {
    const payloadUUID = crypto.randomUUID().toUpperCase()
    const schemaByKey = Object.fromEntries((schemasData.profiles[form.profileId]?.payloadkeys || []).filter(s=>s.key).map(s=>[s.key,s]))
    lines.push('\t\t<dict>')
    lines.push('\t\t\t<key>PayloadType</key>',`\t\t\t<string>${escapeXml(form.payloadType)}</string>`)
    lines.push('\t\t\t<key>PayloadVersion</key>','\t\t\t<integer>1</integer>')
    lines.push('\t\t\t<key>PayloadUUID</key>',`\t\t\t<string>${payloadUUID}</string>`)
    lines.push('\t\t\t<key>PayloadIdentifier</key>',`\t\t\t<string>${escapeXml(profileMeta.identifier)}.${escapeXml(form.payloadType)}</string>`)
    for (const [key, value] of Object.entries(form.values)) {
      if (['PayloadType','PayloadVersion','PayloadUUID','PayloadIdentifier'].includes(key)) continue
      if (value === undefined || value === null || value === '') continue
      const sk = schemaByKey[key]
      const vlines = valueToPlistLines(value, sk?.type || '<string>', 3, sk?.subkeys || [])
      if (!vlines.length) continue
      lines.push(`\t\t\t<key>${escapeXml(key)}</key>`, ...vlines)
    }
    lines.push('\t\t</dict>')
  }
  lines.push('\t</array>')
  lines.push('\t<key>PayloadDescription</key>',`\t<string>${escapeXml(profileMeta.description)}</string>`)
  lines.push('\t<key>PayloadDisplayName</key>',`\t<string>${escapeXml(profileMeta.displayName)}</string>`)
  lines.push('\t<key>PayloadIdentifier</key>',`\t<string>${escapeXml(profileMeta.identifier)}</string>`)
  lines.push('\t<key>PayloadOrganization</key>',`\t<string>${escapeXml(profileMeta.organization)}</string>`)
  lines.push('\t<key>PayloadRemovalDisallowed</key>',`\t<${profileMeta.removalDisallowed ? 'true' : 'false'}/>`)
  lines.push('\t<key>PayloadScope</key>',`\t<string>${escapeXml(profileMeta.scope)}</string>`)
  lines.push('\t<key>PayloadType</key>','\t<string>Configuration</string>')
  lines.push('\t<key>PayloadUUID</key>',`\t<string>${profileUUID}</string>`)
  lines.push('\t<key>PayloadVersion</key>','\t<integer>1</integer>')
  lines.push('</dict>','</plist>')
  return lines.join('\n')
}

// ─── Declarative serializer (declarations → JSON) ─────────────────────────────

function generateDeclarationJSON(declarations) {
  return declarations.map(d => {
    const schema = schemasData.declarations[d.declarationId]
    const declarationType = schema?.payload?.declarationtype || d.declarationId
    return {
      Type: declarationType,
      Identifier: d.identifier || crypto.randomUUID(),
      ServerToken: d.serverToken || crypto.randomUUID(),
      Payload: { ...d.values },
    }
  })
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateMDM(meta, payloads) {
  const metaErrors = []
  if (!meta.displayName?.trim()) metaErrors.push('Display Name is required')
  if (!meta.identifier?.trim()) metaErrors.push('Identifier is required')
  const payloadErrors = {}
  for (const p of payloads) {
    const required = (schemasData.profiles[p.profileId]?.payloadkeys || []).filter(k => k.presence === 'required')
    const missing = required.filter(k => { const v = p.values[k.key]; return v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length) })
    if (missing.length) payloadErrors[p.id] = missing.map(k => k.title || k.key)
  }
  return { metaErrors, payloadErrors }
}

function validateDeclarative(declarations) {
  const errors = {}
  for (const d of declarations) {
    const errs = []
    if (!d.identifier?.trim()) errs.push('Identifier is required')
    const required = (schemasData.declarations[d.declarationId]?.payloadkeys || []).filter(k => k.presence === 'required')
    const missing = required.filter(k => { const v = d.values[k.key]; return v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length) })
    missing.forEach(k => errs.push(k.title || k.key))
    if (errs.length) errors[d.id] = errs
  }
  return errors
}

// ─── Schema helpers ───────────────────────────────────────────────────────────

const TYPE_MAP = { '<string>':'text','<integer>':'number','<real>':'number','<boolean>':'checkbox','<date>':'date','<data>':'textarea','<dictionary>':'dict','<array>':'array' }
const getInputType = kd => TYPE_MAP[kd.type || '<string>'] || 'text'

// ─── Form field components ────────────────────────────────────────────────────

function FieldLabel({ title, keyName, description, required }) {
  const [show, setShow] = useState(false)
  return (
    <div className="field-label">
      <span className="field-name">{title || keyName}{required && <span className="required">*</span>}</span>
      <span className="key-code">{keyName}</span>
      {description && <>
        <button className="help-btn" onClick={() => setShow(s=>!s)}>?</button>
        {show && <div className="field-desc">{description}</div>}
      </>}
    </div>
  )
}

function LabelWithHelp({ label, required, help }) {
  const [show, setShow] = useState(false)
  return (
    <div className="field-label">
      <span className="field-name">
        {label}{required && <span className="required">*</span>}
      </span>
      {help && <>
        <button className="help-btn" onClick={() => setShow(s => !s)}>?</button>
        {show && <div className="field-desc">{help}</div>}
      </>}
    </div>
  )
}

function ArrayField({ keyDef, value = [], onChange }) {
  if (keyDef.subkeys === null) {
    return <span className="dict-empty"><em>Nested items not configurable (recursive schema)</em></span>
  }
  const itemSchema = keyDef.subkeys?.[0]
  const itemIsDic = itemSchema?.type === '<dictionary>'
  const itemIsArr = itemSchema?.type === '<array>'
  const add = () => onChange([...value, itemIsDic ? {} : itemIsArr ? [] : ''])
  const remove = i => onChange(value.filter((_,idx)=>idx!==i))
  const update = (i,v) => onChange(value.map((x,idx)=>idx===i?v:x))
  return (
    <div className="array-field">
      {value.map((item,i) => (
        <div key={i} className="array-item">
          {itemIsDic
            ? <div className="array-dict-item"><DictField keyDef={itemSchema} value={item} onChange={v=>update(i,v)} /></div>
            : itemIsArr
            ? <div className="array-dict-item">
                {itemSchema.subkeys?.length
                  ? <ArrayField keyDef={itemSchema} value={Array.isArray(item) ? item : []} onChange={v=>update(i,v)} />
                  : <span className="dict-empty"><em>Nested items not configurable (recursive schema)</em></span>
                }
              </div>
            : <input type="text" value={item} placeholder={itemSchema?.title||itemSchema?.key||'Value'} onChange={e=>update(i,e.target.value)} />
          }
          <button className="rm-btn" onClick={()=>remove(i)}>×</button>
        </div>
      ))}
      <button className="add-btn" onClick={add}>+ Add {itemSchema?.title || itemSchema?.key || 'item'}</button>
    </div>
  )
}

function DictField({ keyDef, value = {}, onChange }) {
  const subkeys = keyDef.subkeys || []
  if (!subkeys.length) return <div className="dict-empty"><em>No sub-keys defined</em></div>
  return (
    <div className="dict-field">
      {subkeys.map(sk => (
        <div key={sk.key} className="sub-field">
          <FieldLabel title={sk.title} keyName={sk.key} description={sk.content} required={sk.presence==='required'} />
          <FieldInput keyDef={sk} value={value[sk.key]} onChange={v=>onChange({...value,[sk.key]:v})} />
        </div>
      ))}
    </div>
  )
}

function FieldInput({ keyDef, value, onChange }) {
  const inputType = getInputType(keyDef)
  const type = keyDef.type || '<string>'
  if (keyDef.rangelist) return (
    <select value={value??''} onChange={e=>onChange(e.target.value)}>
      <option value="">— select —</option>
      {keyDef.rangelist.map(opt=><option key={String(opt)} value={String(opt)}>{String(opt)}</option>)}
    </select>
  )
  if (inputType==='checkbox') return (
    <label className="toggle">
      <input type="checkbox" checked={value===true||value==='true'} onChange={e=>onChange(e.target.checked)} />
      <span className="toggle-slider" />
    </label>
  )
  if (inputType==='array') return <ArrayField keyDef={keyDef} value={value} onChange={onChange} />
  if (inputType==='dict') return <DictField keyDef={keyDef} value={value??{}} onChange={onChange} />
  if (inputType==='textarea'||type==='<data>') return (
    <textarea value={value??''} onChange={e=>onChange(e.target.value)} rows={3} placeholder={keyDef.title||keyDef.key} />
  )
  return (
    <input type={inputType} value={value??''} onChange={e=>onChange(inputType==='number'?Number(e.target.value):e.target.value)}
      placeholder={keyDef.default!==undefined?`Default: ${keyDef.default}`:''}
      min={keyDef.range?.min} max={keyDef.range?.max} pattern={keyDef.format} />
  )
}

// ─── Shared payload/declaration form ─────────────────────────────────────────

function ItemForm({ title, badge, description, payloadkeys, values, onChange, onRemove, errors }) {
  const handleChange = useCallback((key, val) => onChange({...values,[key]:val}), [values, onChange])
  return (
    <div className={`payload-form ${errors.length>0?'has-errors':''}`}>
      <div className="payload-form-header">
        <div>
          <span className="payload-type-badge">{badge}</span>
          {title && <span className="payload-title">{title}</span>}
        </div>
        <div className="payload-form-header-right">
          {errors.length>0 && <span className="payload-error-count">{errors.length} required field{errors.length!==1?'s':''} missing</span>}
          <button className="rm-payload-btn" onClick={onRemove}>Remove</button>
        </div>
      </div>
      {description && <p className="payload-desc">{description}</p>}
      {errors.length>0 && (
        <div className="payload-errors">
          <span className="payload-errors-label">Required:</span>
          {errors.map(e=><span key={e} className="payload-error-tag">{e}</span>)}
        </div>
      )}
      <div className="fields">
        {!payloadkeys?.length && <p className="no-keys">No configurable keys for this payload.</p>}
        {(payloadkeys||[]).map(keyDef => {
          const isMissing = errors.includes(keyDef.title||keyDef.key)
          return (
            <div key={keyDef.key} className={`field ${keyDef.presence==='required'?'required-field':''} ${isMissing?'field-missing':''}`}>
              <FieldLabel title={keyDef.title} keyName={keyDef.key} description={keyDef.content} required={keyDef.presence==='required'} />
              <FieldInput keyDef={keyDef} value={values[keyDef.key]} onChange={v=>handleChange(keyDef.key,v)} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── MDM picker ───────────────────────────────────────────────────────────────

function ItemPicker({ schemas, onAdd, label }) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const ids = useMemo(()=>Object.keys(schemas).sort(),[schemas])
  const filtered = useMemo(()=>ids.filter(id=>{
    const title=schemas[id]?.title||'', q=search.toLowerCase()
    return id.toLowerCase().includes(q)||title.toLowerCase().includes(q)
  }),[ids,search])
  const handlePick = id => { onAdd(id); setSearch(''); setOpen(false) }
  return (
    <div className="payload-picker">
      <button className="add-payload-btn" onClick={()=>setOpen(o=>!o)}>{open?'✕ Cancel':`＋ ${label}`}</button>
      {open && (
        <div className="picker-panel">
          <input autoFocus type="text" placeholder={`Search ${label.toLowerCase()}…`} value={search} onChange={e=>setSearch(e.target.value)} className="picker-search" />
          <div className="picker-list">
            {filtered.map(id=>(
              <button key={id} className="picker-item" onClick={()=>handlePick(id)}>
                <span className="picker-title">{schemas[id]?.title||id}</span>
                <span className="picker-id">{schemas[id]?.payload?.declarationtype||schemas[id]?.payload?.payloadtype||id}</span>
              </button>
            ))}
            {!filtered.length && <div className="picker-empty">No matches</div>}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Preview panel ────────────────────────────────────────────────────────────

function PreviewPanel({ content, filename }) {
  const [copied, setCopied] = useState(false)
  const copy = () => { navigator.clipboard.writeText(content); setCopied(true); setTimeout(()=>setCopied(false),2000) }
  return (
    <div className="preview-panel">
      <div className="preview-header">
        <span className="preview-title">Preview · {filename}</span>
        <div className="preview-actions">
          <button onClick={copy}>{copied?'✓ Copied':'Copy'}</button>
        </div>
      </div>
      <pre className="preview-code">{content}</pre>
    </div>
  )
}

// ─── MDM mode ─────────────────────────────────────────────────────────────────

function MDMMode() {
  const [meta, setMeta] = useState({ displayName:'', identifier:'com.example.profile', organization:'', description:'', scope:'System', removalDisallowed:false })
  const [payloads, setPayloads] = useState([])
  const [showPreview, setShowPreview] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [touched, setTouched] = useState(false)

  const addPayload = id => {
    const schema = schemasData.profiles[id]
    setTouched(true)
    setPayloads(ps=>[...ps,{ id:crypto.randomUUID(), profileId:id, payloadType:schema?.payload?.payloadtype||id, values:{} }])
  }
  const updatePayload = (id,values) => { setTouched(true); setPayloads(ps=>ps.map(p=>p.id===id?{...p,values}:p)) }
  const removePayload = id => { setTouched(true); setPayloads(ps=>ps.filter(p=>p.id!==id)) }

  const { metaErrors, payloadErrors } = useMemo(()=>validateMDM(meta,payloads),[meta,payloads])
  const isValid = !metaErrors.length && !Object.keys(payloadErrors).length
  if (isValid && showErrors) setShowErrors(false)

  const plistOutput = useMemo(()=>{
    if (!isValid) return null
    return generateMobileconfig(meta, payloads.map(p=>({ profileId:p.profileId, payloadType:p.payloadType, values:p.values })))
  },[isValid,meta,payloads])

  const filename = `${(meta.identifier||'profile').replace(/[^a-zA-Z0-9.-]/g,'_')}.mobileconfig`
  const totalErrors = metaErrors.length + Object.values(payloadErrors).reduce((n,e)=>n+e.length,0)

  const handleDownload = () => {
    setTouched(true)
    if (!isValid) { setShowErrors(true); return }
    const blob = new Blob([plistOutput],{type:'application/x-apple-aspen-config'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download=filename; a.click()
    URL.revokeObjectURL(url)
  }

  const setMetaField = (k,v) => { setTouched(true); setMeta(m=>({...m,[k]:v})) }
  const hasMetaError = f => showErrors && metaErrors.some(e=>e.toLowerCase().includes(f.toLowerCase()))

  return (
    <>
      <div className="mode-toolbar">
        <div className="mode-toolbar-left">
          <span className="payload-count">{payloads.length} payload{payloads.length!==1?'s':''}</span>
        </div>
        <div className="mode-toolbar-right">
          <button className={`preview-toggle ${showPreview?'active':''}`} onClick={()=>setShowPreview(s=>!s)} disabled={!plistOutput}>
            {showPreview?'Hide Preview':'Preview XML'}
          </button>
          <button className={`download-header-btn ${!touched?'btn-neutral':isValid?'btn-valid':'btn-invalid'}`} onClick={handleDownload}
            title={touched&&!isValid?`${totalErrors} required field${totalErrors!==1?'s':''} missing`:`Download ${filename}`}>
            ⬇ Download .mobileconfig
            {touched && !isValid && totalErrors>0 && <span className="error-badge">{totalErrors}</span>}
          </button>
        </div>
      </div>

      <main className="app-main">
        <div className={`editor-pane ${showPreview?'with-preview':''}`}>

          {/* Profile identity */}
          <div className={`meta-form ${showErrors&&metaErrors.length?'has-errors':''}`}>
            <h2>Profile Identity</h2>
            {showErrors && metaErrors.length>0 && <div className="meta-errors">{metaErrors.map(e=><span key={e} className="payload-error-tag">{e}</span>)}</div>}
            <div className="meta-grid">
              <div className={`field ${hasMetaError('Display')?'field-missing':''}`}>
                <LabelWithHelp label="Display Name" required help="The human-readable name shown to users when they view or install this profile on their device." />
                <input type="text" value={meta.displayName} onChange={e=>setMetaField('displayName',e.target.value)} placeholder="My Corporate Profile" />
              </div>
              <div className={`field ${hasMetaError('Identifier')?'field-missing':''}`}>
                <LabelWithHelp label="Identifier" required help={<>A reverse-DNS style string that uniquely identifies this profile (e.g. <code>com.acme.wifi.corporate</code>). Used by the OS to match against existing installed profiles for updates.</>} />
                <input type="text" value={meta.identifier} onChange={e=>setMetaField('identifier',e.target.value)} placeholder="com.example.profile" />
              </div>
              <div className="field">
                <LabelWithHelp label="Organization" help="The name of the organization that created this profile. Shown to users during installation." />
                <input type="text" value={meta.organization} onChange={e=>setMetaField('organization',e.target.value)} placeholder="Acme Corp" />
              </div>
              <div className="field">
                <LabelWithHelp label="Description" help="A short explanation of what this profile does. Shown on the profile detail screen in Settings." />
                <input type="text" value={meta.description} onChange={e=>setMetaField('description',e.target.value)} placeholder="Profile description" />
              </div>
              <div className="field">
                <LabelWithHelp label="Scope" help={<><strong>System</strong> applies the profile device-wide. <strong>User</strong> applies it only to the currently logged-in user (macOS only).</>} />
                <select value={meta.scope} onChange={e=>setMetaField('scope',e.target.value)}>
                  <option value="System">System</option>
                  <option value="User">User</option>
                </select>
              </div>
              <div className="field field-toggle">
                <LabelWithHelp label="Removal Disallowed" help="When enabled, users cannot manually remove this profile from their device. Requires MDM supervision or enrollment to take effect." />
                <label className="toggle">
                  <input type="checkbox" checked={meta.removalDisallowed} onChange={e=>setMetaField('removalDisallowed',e.target.checked)} />
                  <span className="toggle-slider" />
                </label>
              </div>
            </div>
          </div>

          {/* Payloads */}
          <div className="payloads-section">
            <div className="payloads-header">
              <h2>Payloads</h2>
              <ItemPicker schemas={schemasData.profiles} onAdd={addPayload} label="Add Payload" />
            </div>
            {!payloads.length && (
              <div className="empty-state">
                <p>No payloads added yet.</p>
                <p className="empty-hint">Click <strong>＋ Add Payload</strong> to choose from {Object.keys(schemasData.profiles).length} Apple MDM payload types.</p>
              </div>
            )}
            {payloads.map(p => {
              const schema = schemasData.profiles[p.profileId]
              return (
                <ItemForm key={p.id}
                  badge={p.payloadType} title={schema?.title} description={schema?.description}
                  payloadkeys={schema?.payloadkeys} values={p.values}
                  onChange={v=>updatePayload(p.id,v)} onRemove={()=>removePayload(p.id)}
                  errors={showErrors?(payloadErrors[p.id]||[]):[]}
                />
              )
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
  )
}

// ─── Declarative mode ─────────────────────────────────────────────────────────

// Group declarations by category for display
const DECL_CATEGORIES = {
  configurations: 'Configurations',
  activations: 'Activations',
  assets: 'Assets',
  management: 'Management',
}

function DeclarativeMode() {
  const [declarations, setDeclarations] = useState([])
  const [showPreview, setShowPreview] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [touched, setTouched] = useState(false)

  const addDeclaration = id => {
    const schema = schemasData.declarations[id]
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
                          <FieldInput keyDef={keyDef} value={d.values[keyDef.key]} onChange={v=>updateDeclaration(d.id,{values:{...d.values,[keyDef.key]:v}})} />
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

// ─── App shell ────────────────────────────────────────────────────────────────

export default function App() {
  const [mode, setMode] = useState('mdm') // 'mdm' | 'declarative'

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
    </div>
  )
}
