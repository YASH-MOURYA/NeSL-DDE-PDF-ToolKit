import { useMemo, useRef, useState } from "react";
import Icon from "./Icon.jsx";

function validateJson(text) {
  if (!text.trim()) return { state: "empty", message: "Paste or upload a transaction JSON to begin.", line: null };
  try {
    JSON.parse(text);
    return { state: "valid", message: "Valid JSON structure", line: null };
  } catch (error) {
    const match = String(error?.message || "").match(/(?:position\s+(\d+)|line\s+(\d+)\s+column\s+(\d+))/i);
    let line = match?.[2] ? Number(match[2]) : null;
    if (!line && match?.[1]) line = text.slice(0, Number(match[1])).split("\n").length;
    return { state: "invalid", message: error?.message || "Invalid JSON. Check commas, quotes, and brackets.", line };
  }
}

export default function LandingPage({ txnId, onTxnId, loading, onLoadText, onLoadFile, onChooseTool, notify }) {
  const [text, setText] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);
  const editorRef = useRef(null);
  const validation = useMemo(() => validateJson(text), [text]);
  const lines = Math.max(12, text.split("\n").length);

  async function loadCurrent() {
    if (!text.trim()) {
      notify("Paste or upload the transaction JSON first.");
      editorRef.current?.focus();
      return;
    }
    await onLoadText(text, "Pasted JSON");
  }

  async function pasteClipboard() {
    try {
      const value = await navigator.clipboard.readText();
      if (!value.trim()) return notify("The clipboard is empty.");
      setText(value);
    } catch {
      notify("Clipboard access is blocked. Click inside the JSON editor and press Ctrl+V.");
      editorRef.current?.focus();
    }
  }

  async function readFile(file) {
    if (!file) return;
    try {
      setText(await file.text());
      // Loading is deliberately a separate action so invalid JSON can be fixed in the editor first.
    } catch {
      notify("Could not read this file. Choose a JSON or TXT file.");
    }
  }

  return (
    <section className="landing-workspace" aria-label="Toolkit home">
      <section className="landing-card landing-left">
        <div className="landing-txn">
          <span className="landing-icon"><Icon name="file" size={21} /></span>
          <div className="landing-field">
            <label htmlFor="landing-txn">DDE Transaction ID</label>
            <input
              id="landing-txn"
              className="input mono"
              value={txnId}
              onChange={(event) => onTxnId(event.target.value.toUpperCase())}
              placeholder="Enter DDE transaction ID"
              autoComplete="off"
              spellCheck={false}
            />
            <p>Used to name every downloaded file.</p>
          </div>
        </div>

        <div className="landing-divider" />

        <button type="button" className="tool-tile tool-tile-blue" onClick={() => onChooseTool("downloader")}>
          <span className="tool-icon"><Icon name="download" size={28} /></span>
          <span className="tool-copy">
            <strong>File Downloader</strong>
            <small>Extract PDFs from transaction JSON and download individual files or a ZIP archive.</small>
          </span>
          <span className="tool-arrow" aria-hidden="true">›</span>
        </button>

        <button type="button" className="tool-tile tool-tile-orange" onClick={() => onChooseTool("estamp")}>
          <span className="tool-icon"><Icon name="file" size={27} /></span>
          <span className="tool-copy">
            <strong>eStamp Merger</strong>
            <small>Merge eStamps with documents, use pre-merged files, or skip eStamp requests.</small>
          </span>
          <span className="tool-arrow" aria-hidden="true">›</span>
        </button>

        <div className="landing-security">
          <span className="security-dot" />
          <span>Files are processed locally in your browser.</span>
        </div>
      </section>

      <section id="transaction-json" className="landing-card landing-json">
        <div className="json-heading">
          <span className="landing-icon braces" aria-hidden="true">{`{ }`}</span>
          <div className="json-heading-copy">
            <h2>Transaction JSON</h2>
            <p>Paste the complete transaction JSON here or upload a JSON/TXT file.</p>
          </div>
          <span className={`validation-pill ${validation.state}`}>
            <span className="validation-dot" />
            {validation.state === "valid" ? "Valid JSON" : validation.state === "invalid" ? "JSON Error" : "JSON Validation"}
          </span>
        </div>

        <div className={`code-editor ${validation.state === "invalid" ? "has-error" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); readFile(event.dataTransfer.files?.[0]); }}>
          <div className="line-gutter" aria-hidden="true">
            {Array.from({ length: lines }, (_, index) => (
              <span key={index} className={validation.line === index + 1 ? "error-line" : ""}>
                {validation.line === index + 1 && <b>×</b>}{index + 1}
              </span>
            ))}
          </div>
          <textarea
            ref={editorRef}
            className="json-editor-input"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onScroll={(event) => { const gutter = event.currentTarget.previousElementSibling; if (gutter) gutter.scrollTop = event.currentTarget.scrollTop; }}
            onPaste={(event) => {
              const pasted = event.clipboardData?.getData("text") || "";
              if (pasted.trim()) {
                event.preventDefault();
                setText(pasted);
              }
            }}
            placeholder={'Paste transaction JSON here (Ctrl+V)\\n\\nExample:\\n{\\n  "loan": {\\n    "documentdtls": []\\n  }\\n}'}
            spellCheck={false}
            aria-label="Transaction JSON editor"
            aria-invalid={validation.state === "invalid"}
            disabled={loading}
          />
        </div>

        {validation.state !== "empty" && (
          <div className={`json-feedback ${validation.state}`} role={validation.state === "invalid" ? "alert" : "status"}>
            <span className="feedback-mark">{validation.state === "valid" ? "✓" : "×"}</span>
            <span>{validation.state === "valid" ? validation.message : `Invalid JSON${validation.line ? ` near line ${validation.line}` : ""}: ${validation.message}`}</span>
          </div>
        )}

        <div className="json-actions">
          <button type="button" className="btn btn-primary load-json" onClick={loadCurrent} disabled={loading || !text.trim()}>
            <Icon name="file" size={17} /> {loading ? "Processing PDFs…" : "Load JSON"}
          </button>
          <button type="button" className="btn choose-json" onClick={() => fileRef.current?.click()} disabled={loading}>
            <Icon name="upload" size={17} /> Choose JSON or TXT file
          </button>
          <input ref={fileRef} className="visually-hidden-file" type="file" accept=".json,.txt,application/json,text/plain" onChange={(event) => { readFile(event.target.files?.[0]); event.target.value = ""; }} />
          <button type="button" className="btn clipboard-json" onClick={pasteClipboard} disabled={loading}>
            <Icon name="clipboard" size={16} /> Paste from clipboard
          </button>
        </div>
      </section>
    </section>
  );
}
