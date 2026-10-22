import { useState } from "react";
import Icon from "./Icon.jsx";
import { plural } from "../lib/format.js";

export default function TransactionInput({ txnId, onTxnId, loaded, loading, onLoadText, onLoadFile, notify }) {
  const [mode, setMode] = useState("paste"); // "paste" | "file"
  const [replacing, setReplacing] = useState(false);
  const [text, setText] = useState("");
  const [dragging, setDragging] = useState(false);
  const showInput = !loaded || replacing;

  async function load(value) {
    const ok = await onLoadText(value, "Pasted JSON");
    if (ok) {
      setText("");
      setReplacing(false);
    } else {
      setText(value); // keep it visible so it can be fixed
    }
  }

  // Pasting into the box loads straight away: no extra click.
  function onPaste(event) {
    const pasted = event.clipboardData?.getData("text") ?? "";
    if (!pasted.trim()) return;
    event.preventDefault();
    load(pasted);
  }

  async function fromClipboard() {
    try {
      const value = await navigator.clipboard.readText();
      if (!value.trim()) return notify("The clipboard is empty.");
      load(value);
    } catch {
      notify("The browser blocked clipboard access. Click the box and press Ctrl+V instead.");
    }
  }

  async function pickFile(file) {
    if (!file) return;
    if (await onLoadFile(file)) setReplacing(false);
  }

  return (
    <section
      className="card input-card"
      aria-label="Transaction"
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); setMode("file"); pickFile(e.dataTransfer.files?.[0]); }}
    >
      <div className="input-grid">
        <div className="field">
          <label htmlFor="txn">DDE transaction ID</label>
          <input
            id="txn"
            className="input mono"
            value={txnId}
            onChange={(e) => onTxnId(e.target.value.toUpperCase())}
            placeholder="Example: DDE_807911"
            autoComplete="off"
            spellCheck={false}
          />
          <p className="hint">Used to name every downloaded file.</p>
        </div>

        <div className="field">
          <div className="label-row">
            <span className="label">Transaction JSON</span>
            {showInput && (
              <div className="seg" role="tablist" aria-label="How to add the JSON">
                <button type="button" role="tab" aria-selected={mode === "paste"} className={mode === "paste" ? "on" : ""} onClick={() => setMode("paste")}>Paste</button>
                <button type="button" role="tab" aria-selected={mode === "file"} className={mode === "file" ? "on" : ""} onClick={() => setMode("file")}>Upload file</button>
              </div>
            )}
          </div>

          {!showInput ? (
            <div className="loaded">
              <span className="dz-icon ok"><Icon name="check" size={18} /></span>
              <span className="dz-text">
                <strong title={loaded.name}>{loaded.name}</strong>
                <small>
                  {plural(loaded.documents, "document")}, {plural(loaded.requests, "eStamp request")}, {plural(loaded.participants, "participant")}
                </small>
              </span>
              <button type="button" className="btn btn-small" onClick={() => setReplacing(true)}>Replace JSON</button>
            </div>
          ) : mode === "paste" ? (
            <>
              <textarea
                className="input paste-box"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onPaste={onPaste}
                placeholder="Paste the complete transaction JSON here (Ctrl+V). It loads as soon as you paste."
                spellCheck={false}
                disabled={loading}
                aria-label="Transaction JSON"
              />
              <div className="paste-actions">
                <button type="button" className="btn btn-primary" onClick={fromClipboard} disabled={loading}>
                  <Icon name="clipboard" /> {loading ? "Reading documents" : "Paste from clipboard"}
                </button>
                {text.trim() && !loading && <button type="button" className="btn" onClick={() => load(text)}>Load JSON</button>}
                {replacing && <button type="button" className="link" onClick={() => setReplacing(false)}>Cancel</button>}
              </div>
            </>
          ) : (
            <>
              <label className={`dropzone${dragging ? " drag" : ""}`}>
                <input type="file" accept=".json,application/json,text/plain" onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }} />
                <span className="dz-body">
                  <span className="dz-icon"><Icon name="upload" size={18} /></span>
                  <span className="dz-text">
                    <strong>{loading ? "Reading documents" : "Drop the JSON file here or browse"}</strong>
                    <small>You can also drop a file anywhere on this card.</small>
                  </span>
                </span>
              </label>
              {replacing && <button type="button" className="link" onClick={() => setReplacing(false)}>Cancel</button>}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
