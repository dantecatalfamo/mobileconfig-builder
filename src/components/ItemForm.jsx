import { useCallback } from 'react'
import { FieldLabel } from './FieldLabel'
import { FieldInput } from './FormFields'

export function ItemForm({ title, badge, description, payloadkeys, values, onChange, onRemove, errors, showErrors }) {
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
              <FieldInput keyDef={keyDef} value={values[keyDef.key]} onChange={v=>handleChange(keyDef.key,v)} showErrors={showErrors} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
