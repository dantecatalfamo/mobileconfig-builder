import { isEmpty } from '../lib/validation'
import { FieldLabel } from './FieldLabel'

const TYPE_MAP = { '<string>':'text','<integer>':'number','<real>':'number','<boolean>':'checkbox','<date>':'date','<data>':'textarea','<dictionary>':'dict','<array>':'array' }
export const getInputType = kd => TYPE_MAP[kd.type || '<string>'] || 'text'

export function ArrayField({ keyDef, value = [], onChange, showErrors, payloadSupportedOS }) {
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
            ? <div className="array-dict-item"><DictField keyDef={itemSchema} value={item} onChange={v=>update(i,v)} showErrors={showErrors} payloadSupportedOS={payloadSupportedOS} /></div>
            : itemIsArr
            ? <div className="array-dict-item">
                {itemSchema.subkeys?.length
                  ? <ArrayField keyDef={itemSchema} value={Array.isArray(item) ? item : []} onChange={v=>update(i,v)} showErrors={showErrors} payloadSupportedOS={payloadSupportedOS} />
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

export function DictField({ keyDef, value = {}, onChange, showErrors, payloadSupportedOS }) {
  const subkeys = keyDef.subkeys || []
  if (!subkeys.length) return <div className="dict-empty"><em>No sub-keys defined</em></div>
  return (
    <div className="dict-field">
      {subkeys.map(sk => {
        const isMissing = showErrors && sk.presence === 'required' && isEmpty(value[sk.key])
        return (
          <div key={sk.key} className={`sub-field ${isMissing ? 'field-missing' : ''}`}>
            <FieldLabel title={sk.title} keyName={sk.key} description={sk.content} required={sk.presence==='required'} supportedOS={sk.supportedOS} payloadSupportedOS={payloadSupportedOS} defaultVal={sk.default} />
            <FieldInput keyDef={sk} value={value[sk.key]} onChange={v=>onChange({...value,[sk.key]:v})} showErrors={showErrors} payloadSupportedOS={payloadSupportedOS} />
          </div>
        )
      })}
    </div>
  )
}

export function FieldInput({ keyDef, value, onChange, showErrors, payloadSupportedOS }) {
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
  if (inputType==='array') return <ArrayField keyDef={keyDef} value={value} onChange={onChange} showErrors={showErrors} payloadSupportedOS={payloadSupportedOS} />
  if (inputType==='dict') {
    if (keyDef.presence !== 'required' && value == null)
      return <button className="add-btn" onClick={()=>onChange({})}>+ Add {keyDef.title||keyDef.key}</button>
    return (
      <div className="dict-with-remove">
        <DictField keyDef={keyDef} value={value??{}} onChange={onChange} showErrors={showErrors} payloadSupportedOS={payloadSupportedOS} />
        {keyDef.presence !== 'required' && <button className="rm-dict-btn" onClick={()=>onChange(undefined)}>Remove</button>}
      </div>
    )
  }
  if (inputType==='textarea'||type==='<data>') return (
    <textarea value={value??''} onChange={e=>onChange(e.target.value)} rows={3} placeholder={keyDef.title||keyDef.key} />
  )
  return (
    <input type={inputType} value={value??''} onChange={e=>onChange(inputType==='number'?Number(e.target.value):e.target.value)}
      min={keyDef.range?.min} max={keyDef.range?.max} pattern={keyDef.format} />
  )
}
