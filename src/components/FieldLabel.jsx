import { useState } from 'react'

export function FieldLabel({ title, keyName, description, required }) {
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

export function LabelWithHelp({ label, required, help }) {
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
