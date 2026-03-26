import { useState, useMemo, useRef, useEffect } from "react";

export function ItemPicker({ schemas, onAdd, label }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const listRef = useRef(null);

  const ids = useMemo(() => Object.keys(schemas).sort(), [schemas]);
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return ids.filter(id => {
      const title = schemas[id]?.title || "";
      return id.toLowerCase().includes(q) || title.toLowerCase().includes(q);
    });
  }, [ids, search]);

  // Reset active index when results change
  useEffect(() => {
    setActiveIdx(0);
  }, [filtered]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.children[activeIdx];
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  const handlePick = id => {
    onAdd(id);
    setSearch("");
    setOpen(false);
  };

  const handleKeyDown = e => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[activeIdx]) {
      handlePick(filtered[activeIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setSearch("");
    }
  };

  return (
    <div className="payload-picker">
      <button className="add-payload-btn" onClick={() => setOpen(o => !o)}>
        {open ? "✕ Cancel" : `＋ ${label}`}
      </button>
      {open && (
        <div className="picker-panel">
          <input
            autoFocus
            type="text"
            placeholder={`Search ${label.toLowerCase()}…`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            className="picker-search"
          />
          <div className="picker-list" ref={listRef}>
            {filtered.map((id, i) => (
              <button
                key={id}
                className={`picker-item ${i === activeIdx ? "active" : ""}`}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => handlePick(id)}
              >
                <span className="picker-title">{schemas[id]?.title || id}</span>
                <span className="picker-id">
                  {schemas[id]?.payload?.declarationtype ||
                    schemas[id]?.payload?.payloadtype ||
                    id}
                </span>
              </button>
            ))}
            {!filtered.length && <div className="picker-empty">No matches</div>}
          </div>
        </div>
      )}
    </div>
  );
}
