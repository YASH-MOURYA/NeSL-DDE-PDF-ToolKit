import { useEffect, useRef } from "react";
import Icon from "./Icon.jsx";
import { formatBytes, plural } from "../lib/format.js";

export default function DocumentsTab({
  documents,
  fileNames,
  blockedReason,
  busy,
  onToggle,
  onToggleAll,
  onPreview,
  onDownloadOne,
  onDownloadPdfs,
  onDownloadZip,
}) {
  const selected = documents.filter((d) => d.selected).length;
  const allRef = useRef(null);
  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = selected > 0 && selected < documents.length;
  }, [selected, documents.length]);

  const disabled = Boolean(blockedReason) || selected === 0 || busy !== null;

  return (
    <div role="tabpanel" aria-label="Documents">
      <div className="toolbar">
        <p className="toolbar-text">
          <strong>{selected}</strong> of {plural(documents.length, "document")} selected for download
        </p>
        <div className="toolbar-actions">
          <button type="button" className="btn" disabled={disabled} onClick={onDownloadPdfs}>
            <Icon name="download" /> {busy === "docs-pdf" ? "Downloading" : selected === 1 ? "Download PDF" : "Download PDFs"}
          </button>
          <button type="button" className="btn btn-primary" disabled={disabled} onClick={onDownloadZip}>
            <Icon name="download" /> {busy === "docs-zip" ? "Creating ZIP" : "Download ZIP"}
          </button>
        </div>
      </div>
      {blockedReason && <p className="hint block-hint">{blockedReason}</p>}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th className="col-check">
                <input
                  ref={allRef}
                  type="checkbox"
                  checked={documents.length > 0 && selected === documents.length}
                  onChange={(e) => onToggleAll(e.target.checked)}
                  aria-label="Select all documents"
                />
              </th>
              <th>Document</th>
              <th className="col-num">Pages</th>
              <th className="col-num">Size</th>
              <th className="col-actions"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr key={doc.key} className={doc.selected ? "" : "off"}>
                <td className="col-check">
                  <input
                    type="checkbox"
                    checked={doc.selected}
                    onChange={() => onToggle(doc.key)}
                    aria-label={`Include document ${doc.id}`}
                  />
                </td>
                <td>
                  <div className="doc-main">
                    <strong>Document ID {doc.id}</strong>
                    {doc.name && doc.name !== doc.id && <span className="doc-name">{doc.name}</span>}
                  </div>
                  <code className="doc-file" title={fileNames.get(doc.key)}>{fileNames.get(doc.key)}</code>
                </td>
                <td className="col-num">{doc.pages ?? "-"}</td>
                <td className="col-num">{formatBytes(doc.bytes.length)}</td>
                <td className="col-actions">
                  <button type="button" className="btn btn-small" onClick={() => onPreview(doc)}>
                    <Icon name="eye" size={15} /> Preview
                  </button>
                  <button type="button" className="btn btn-small" onClick={() => onDownloadOne(doc)} disabled={Boolean(blockedReason)}>
                    <Icon name="download" size={15} /> Download
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
