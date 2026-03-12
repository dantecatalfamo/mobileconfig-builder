import { useState, useMemo } from 'react'

export function ItemPicker({ schemas, onAdd, label }) {
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
