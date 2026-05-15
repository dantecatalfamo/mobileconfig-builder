import { useRef } from "react";

export function ImportButton({ onImport, accept, label }) {
  const inputRef = useRef(null);

  const handleChange = async e => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const text = await file.text();
    onImport(text, file.name);
  };

  return (
    <>
      <button className="import-btn" onClick={() => inputRef.current?.click()}>
        {label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        style={{ display: "none" }}
      />
    </>
  );
}
