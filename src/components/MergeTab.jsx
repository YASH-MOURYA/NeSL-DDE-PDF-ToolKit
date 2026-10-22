import Icon from "./Icon.jsx";
import { plural } from "../lib/format.js";

const relClass = (label) => {
  const key = label.toLowerCase();
  return key === "creditor" ? "rel-creditor" : key === "debtor" ? "rel-debtor" : "rel-other";
};
const docLabel = (d) => (d.name && d.name !== d.id ? `${d.id} (${d.name})` : d.id);
const docIdsOf = (output) => output.sequence.filter((item) => item.kind === "doc" || item.kind === "preMerged").map((item) => item.id);
export const orderOf = (output) =>
  output.sequence.map((item) => {
    if (item.kind === "stamp") return `eStamp ${item.certificate}`;
    if (item.kind === "preMerged") return `Pre-merged PDF for ID ${item.id}`;
    return `ID ${item.id}`;
  }).join(", ");

const MODE_LABEL = { manual: "Manual", preMerged: "Pre-merged", skipped: "Skipped" };

export const getProcessingMode = (stamp) =>
  stamp.skipEstamp ? "skipped" : stamp.usePreMerged ? "preMerged" : "manual";

export const isComplete = (stamp) => {
  if (!stamp.targetDocumentId) return false;
  const mode = getProcessingMode(stamp);
  if (mode === "skipped") return true;
  if (mode === "preMerged") return Boolean(stamp.preMergedBytes);
  return Boolean(stamp.bytes && stamp.certificateNumber.trim());
};

export const isTouched = (stamp) => Boolean(
  stamp.bytes || stamp.fileName || stamp.targetDocumentId ||
  stamp.certificateNumber.trim() || stamp.usePreMerged || stamp.skipEstamp ||
  stamp.preMergedBytes || stamp.preMergedFileName
);

function StampRow({ stamp, index, total, fixed, documents, onChange, onPick, onPreMergedPick, onRemove }) {
  const mode = getProcessingMode(stamp);
  const done = isComplete(stamp);
  const needs = [
    !stamp.targetDocumentId && "a document ID",
    mode === "manual" && !stamp.bytes && "the eStamp PDF",
    mode === "manual" && !stamp.certificateNumber.trim() && "the certificate number",
    mode === "preMerged" && !stamp.preMergedBytes && "the pre-merged PDF",
  ].filter(Boolean);
  const showNeeds = !done && (fixed || isTouched(stamp));
  const details = [stamp.amount && `₹${stamp.amount}`, stamp.firstParty].filter(Boolean).join(", ");

  return (
    <li className={`stamp${done ? " done" : ""}`}>
      <div className="stamp-top">
        <div className="stamp-id">
          <span className="small-label">Goes before document</span>
          {stamp.fixed ? (
            <strong className="mono">{stamp.targetDocumentId}</strong>
          ) : (
            <select
              className="input"
              value={stamp.targetDocumentId}
              onChange={(e) => onChange(stamp.id, { targetDocumentId: e.target.value })}
              aria-label="Document ID this eStamp goes before"
            >
              <option value="">Choose a document</option>
              {documents.map((d) => <option key={d.key} value={d.id}>{docLabel(d)}</option>)}
            </select>
          )}
        </div>
        <div className="stamp-info">
          <strong title={stamp.description}>{stamp.description || `eStamp ${index + 1}`}</strong>
          <span>{[`eStamp ${index + 1} of ${total}`, details].filter(Boolean).join(", ")}</span>
        </div>
        <span className={`badge ${mode}`}>{MODE_LABEL[mode]}</span>
        {stamp.fixed ? (
          <span className={`status ${done ? "ok" : "todo"}`}>{done ? "Ready" : "Pending"}</span>
        ) : (
          <button type="button" className="icon-btn" onClick={() => onRemove(stamp.id)} aria-label="Remove this eStamp">
            <Icon name="close" />
          </button>
        )}
      </div>

      <div className="stamp-toggles">
        <label className={`switch-row${stamp.skipEstamp ? " disabled" : ""}`} title="Replace the original document with an already-stamped PDF.">
          <strong>Use Pre-Merged Document</strong>
          <input type="checkbox" role="switch" checked={stamp.usePreMerged} disabled={stamp.skipEstamp} onChange={(e) => onChange(stamp.id, { usePreMerged: e.target.checked })} />
        </label>
        <label className="switch-row" title="Keep the original document without adding this eStamp.">
          <strong>Skip eStamp Request</strong>
          <input type="checkbox" role="switch" checked={stamp.skipEstamp} onChange={(e) => onChange(stamp.id, { skipEstamp: e.target.checked, usePreMerged: false })} />
        </label>
      </div>

      {mode === "manual" && <div className="stamp-fields">
        <label className={`file-pick${stamp.bytes ? " has" : ""}${stamp.error ? " bad" : ""}`}>
          <input type="file" accept=".pdf,application/pdf" onChange={(e) => { onPick(stamp.id, e.target.files?.[0]); e.target.value = ""; }} />
          <Icon name="file" />
          <span className="file-name">{stamp.fileName || "Choose eStamp PDF"}</span>
          {stamp.bytes && <small>{plural(stamp.pages, "page")}</small>}
        </label>
        <div className="cert">
          <label htmlFor={`cert-${stamp.id}`} className="small-label">Certificate number (required)</label>
          <input id={`cert-${stamp.id}`} className={`input mono${showNeeds && stamp.bytes && !stamp.certificateNumber.trim() ? " invalid" : ""}`} value={stamp.certificateNumber} onChange={(e) => onChange(stamp.id, { certificateNumber: e.target.value.toUpperCase() })} autoComplete="off" spellCheck={false} />
        </div>
      </div>}

      {mode === "preMerged" && <div className="stamp-fields one-column">
        <label className={`file-pick${stamp.preMergedBytes ? " has" : ""}${stamp.preMergedError ? " bad" : ""}`}>
          <input type="file" accept=".pdf,application/pdf" onChange={(e) => { onPreMergedPick(stamp.id, e.target.files?.[0]); e.target.value = ""; }} />
          <Icon name="file" />
          <span className="file-name">{stamp.preMergedFileName || "Choose already-merged PDF"}</span>
          {stamp.preMergedBytes && <small>{plural(stamp.preMergedPages, "page")}</small>}
        </label>
      </div>}

      {mode === "skipped" && <div className="mode-message skipped-message"><strong>Skipped</strong><span>Original document kept, no eStamp added.</span></div>}
      {stamp.error && mode === "manual" && <p className="field-error">{stamp.error}</p>}
      {stamp.preMergedError && mode === "preMerged" && <p className="field-error">{stamp.preMergedError}</p>}
      {showNeeds && !stamp.error && <p className="hint warn">Still needed: {needs.join(", ")}.</p>}
    </li>
  );
}

export default function MergeTab({
  documents,
  stamps,
  fixedStamps,
  readyCount,
  outputs,
  deselected,
  building,
  buildError,
  warnings,
  folders,
  blockedReason,
  busy,
  onStampChange,
  onStampPick,
  onPreMergedPick,
  onStampAdd,
  onStampRemove,
  onToggleOutput,
  onToggleAllOutputs,
  onPreview,
  onDownloadOne,
  onDownloadPdfs,
  onDownloadZip,
}) {
  const selected = outputs.filter((o) => !deselected.includes(o.id));
  const fileCount = selected.reduce((n, o) => n + o.files.length, 0);
  const disabled = Boolean(blockedReason) || selected.length === 0 || busy !== null;

  return (
    <div role="tabpanel" aria-label="eStamps and merge" className="merge">
      <section className="block" aria-labelledby="stamps-title">
        <div className="block-head">
          <div>
            <h2 id="stamps-title">eStamp requests</h2>
            <p className="hint">
              {fixedStamps
                ? `${readyCount} of ${stamps.length} configured. Each eStamp goes right before its document.`
                : "No eStamp requests in the JSON. Add one and choose its document."}
            </p>
          </div>
          {!fixedStamps && (
            <button type="button" className="btn" onClick={onStampAdd}>
              <Icon name="plus" /> Add eStamp
            </button>
          )}
        </div>
        <ul className="stamps">
          {stamps.map((stamp, index) => (
            <StampRow
              key={stamp.id}
              stamp={stamp}
              index={index}
              total={stamps.length}
              fixed={fixedStamps}
              documents={documents}
              onChange={onStampChange}
              onPick={onStampPick}
              onPreMergedPick={onPreMergedPick}
              onRemove={onStampRemove}
            />
          ))}
        </ul>
      </section>

      <section className="block" aria-labelledby="merged-title">
        <div className="block-head">
          <div>
            <h2 id="merged-title">Merged PDFs</h2>
            <p className="hint">
              {outputs.length
                ? `${selected.length} of ${plural(outputs.length, "merged PDF")} selected. Every page is A4.`
                : building ? "Building merged PDFs." : "Merged PDFs appear here."}
            </p>
          </div>
          <div className="toolbar-actions">
            <button type="button" className="btn" disabled={disabled} onClick={onDownloadPdfs}>
              <Icon name="download" /> {busy === "merge-pdf" ? "Downloading" : selected.length === 1 ? "Download PDF" : "Download PDFs"}
            </button>
            <button type="button" className="btn btn-primary" disabled={disabled} onClick={onDownloadZip}>
              <Icon name="download" /> {busy === "merge-zip" ? "Creating ZIP" : "Download ZIP"}
            </button>
          </div>
        </div>
        {blockedReason && <p className="hint block-hint">{blockedReason}</p>}

        {outputs.length > 0 && (
          <ul className="outputs">
            <li className="outputs-all">
              <label>
                <input
                  type="checkbox"
                  checked={selected.length === outputs.length}
                  ref={(el) => { if (el) el.indeterminate = selected.length > 0 && selected.length < outputs.length; }}
                  onChange={(e) => onToggleAllOutputs(e.target.checked)}
                />
                Select all
              </label>
            </li>
            {outputs.map((o) => (
              <li key={o.id} className={`output${deselected.includes(o.id) ? " off" : ""}`}>
                <input
                  type="checkbox"
                  checked={!deselected.includes(o.id)}
                  onChange={() => onToggleOutput(o.id)}
                  aria-label={`Include ${o.singleName}`}
                />
                <div className="output-body">
                  <div className="output-top">
                    {o.relations.map((r) => <span key={r.label} className={`tag ${relClass(r.label)}`}>{r.label}</span>)}
                    <strong title={o.participants.join(", ")}>{plural(o.participants.length, "participant")}: {o.participants.join(", ")}</strong>
                  </div>
                  <span className="output-meta">
                    Document IDs {docIdsOf(o).join(", ")}, {plural(o.pageCount, "page")}
                  </span>
                  <span className="output-order" title={orderOf(o)}>Order: {orderOf(o)}</span>
                  <code className="doc-file">{o.singleName}</code>
                </div>
                <div className="output-actions">
                  <button type="button" className="btn btn-small" onClick={() => onPreview(o)}>
                    <Icon name="eye" size={15} /> Preview
                  </button>
                  <button type="button" className="btn btn-small" onClick={() => onDownloadOne(o)} disabled={Boolean(blockedReason)}>
                    <Icon name="download" size={15} /> Download
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {folders.length > 0 && (
          <p className="hint">
            ZIP layout: {folders.join(", ")}.
            {folders.length > outputs.length &&
              ` One merged PDF is saved in every relation folder it serves, so the ZIP holds ${plural(fileCount, "file")} but only ${plural(selected.length, "different PDF")}.`}
          </p>
        )}
        {warnings.length > 0 && <ul className="warnings">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
        {buildError && <p className="field-error">The merge failed: {buildError}</p>}
      </section>
    </div>
  );
}
