import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import TransactionInput from "./components/TransactionInput.jsx";
import LandingPage from "./components/LandingPage.jsx";
import DocumentsTab from "./components/DocumentsTab.jsx";
import MergeTab, { isComplete, isTouched, orderOf } from "./components/MergeTab.jsx";
import Footer from "./components/Footer.jsx";
import Icon from "./components/Icon.jsx";
import { parseTransaction } from "./lib/parse.js";
import { buildOutputs, inspectPdf, normalizeToA4, planFilenames, safeName, toA4 } from "./lib/merge.js";
import { downloadPdf, downloadPdfs, downloadZip, nameDocuments, sanitizeFileName } from "./lib/download.js";
import { plural } from "./lib/format.js";

// The preview (PDF.js) is a separate chunk that loads the first time it is needed.
const loadViewer = () => import("./components/PdfViewer.jsx");
const PdfViewer = lazy(loadViewer);

let idCounter = 0;
// crypto.randomUUID() only exists on HTTPS/localhost; this works everywhere.
const uid = () => `id${Date.now().toString(36)}${(idCounter++).toString(36)}`;

const createStamp = (request = null) => ({
  id: uid(),
  fixed: Boolean(request), // true = created from an eStamp request in the JSON
  targetDocumentId: request?.documentId ?? "",
  description: request?.description ?? "",
  amount: request?.amount ?? "",
  firstParty: request?.firstParty ?? "",
  fileName: "",
  bytes: null,
  pages: 0,
  error: "",
  certificateNumber: "",
  usePreMerged: false,
  skipEstamp: false,
  preMergedFileName: "",
  preMergedBytes: null,
  preMergedPages: 0,
  preMergedError: "",
});

function InlinePdfPreview({ bytes }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!bytes) { setUrl(""); return undefined; }
    const objectUrl = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [bytes]);
  return url ? <iframe className="inline-pdf" title="Merged PDF preview" src={url} /> : <div className="preview-empty"><strong>Preparing preview…</strong></div>;
}

export default function App() {
  const [txnId, setTxnId] = useState("");
  const [source, setSource] = useState(null); // { name, jsonTxnId }
  const [loading, setLoading] = useState(false);
  const loadToken = useRef(0);

  const [documents, setDocuments] = useState([]);
  const [docOff, setDocOff] = useState([]); // keys of documents left out of the download
  const [groups, setGroups] = useState([]);
  const [parseWarnings, setParseWarnings] = useState([]);

  const [stamps, setStamps] = useState(() => [createStamp()]);
  const [fixedStamps, setFixedStamps] = useState(false); // eStamp slots dictated by the JSON

  const [outputs, setOutputs] = useState([]);
  const [buildWarnings, setBuildWarnings] = useState([]);
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState("");
  const [outputOff, setOutputOff] = useState([]);

  const [workspaceMode, setWorkspaceMode] = useState(() => window.location.hash === "#estamp" ? "estamp" : "downloader");
  const [documentsExpanded, setDocumentsExpanded] = useState(true);
  const [previewOutputId, setPreviewOutputId] = useState("");
  const [busy, setBusy] = useState(null); // null | "docs-pdf" | "docs-zip" | "merge-pdf" | "merge-zip"
  const [notice, setNotice] = useState(null);
  const [preview, setPreview] = useState(null);
  const layoutRef = useRef(null);
  const scrollTimer = useRef(null);
  const [leftPct, setLeftPct] = useState(36); // width of the controls panel; dragged with the divider
  const clampPct = (v) => Math.min(55, Math.max(24, v));
  const dragDivider = (e) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const box = layoutRef.current.getBoundingClientRect();
    setLeftPct(clampPct(((e.clientX - box.left) / box.width) * 100));
  };

  useEffect(() => {
    if (notice?.type !== "success") return undefined;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  // Keep tool selection in browser history so Chrome Back/Forward restores the previous view.
  useEffect(() => {
    if (!window.history.state?.toolkitView) {
      window.history.replaceState({ toolkitView: workspaceMode === "estamp" ? "estamp" : "home" }, "", window.location.pathname + window.location.search + (workspaceMode === "estamp" ? "#estamp" : "#home"));
    }

    const handlePopState = (event) => {
      const view = event.state?.toolkitView || (window.location.hash === "#estamp" ? "estamp" : window.location.hash === "#documents" ? "documents" : "home");
      setWorkspaceMode(view === "estamp" ? "estamp" : "downloader");
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
      scrollTimer.current = setTimeout(() => {
        const targetId = view === "documents" ? "documents-library" : view === "estamp" ? "estamp-workspace" : "page-top";
        document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 40);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
    };
  }, [workspaceMode]);

  function navigateWorkspace(mode) {
    const nextView = mode === "estamp" ? "estamp" : documents.length ? "documents" : "home";
    const hash = nextView === "estamp" ? "#estamp" : nextView === "documents" ? "#documents" : "#home";
    window.history.pushState({ toolkitView: nextView }, "", window.location.pathname + window.location.search + hash);
    setWorkspaceMode(mode);

    // File Downloader should take the user directly to the loaded document list.
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      const targetId = nextView === "documents" ? "documents-library" : nextView === "estamp" ? "estamp-workspace" : "transaction-json";
      document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: nextView === "documents" ? "start" : "nearest" });
    }, 60);
  }

  // ---------- loading the JSON ----------
  async function loadJSON(text, name) {
    if (!text.trim()) {
      setNotice({ type: "error", text: "Add the transaction JSON first." });
      return false;
    }
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      setNotice({ type: "error", text: "That is not valid JSON. Check the file and try again." });
      return false;
    }
    const result = parseTransaction(data);
    if (!result.documents.length) {
      setNotice({
        type: "error",
        text: "The JSON is valid, but no Base64 PDF documents were found. Expected loan.documentdtls with docData.",
      });
      return false;
    }

    const token = ++loadToken.current;
    setLoading(true);
    // Every document gets an A4 copy for merging. The original bytes stay untouched for the Documents tab.
    const prepared = await Promise.all(
      result.documents.map(async (doc, index) => {
        const base = { ...doc, key: `${index}-${doc.id}`, a4: doc.bytes, pages: null };
        try {
          const a4 = await toA4(doc.bytes);
          return { ...base, a4: a4.bytes, pages: a4.pages };
        } catch {
          return base; // unreadable files are reported by the merge step
        }
      })
    );
    if (token !== loadToken.current) return false; // a newer file was loaded meanwhile
    setLoading(false);

    setSource({
      name,
      jsonTxnId: result.jsonTxnId,
      requests: result.requests.length,
      participants: result.groups.reduce((n, g) => n + g.members.length, 0),
    });
    setDocuments(prepared);
    setDocumentsExpanded(true);
    setDocOff([]);
    setGroups(result.groups);
    setParseWarnings(result.warnings);
    setOutputOff([]);
    setPreviewOutputId("");
    setPreview(null);

    if (result.requests.length) {
      // exactly one eStamp slot per request in the JSON, no more and no fewer
      setFixedStamps(true);
      setStamps(result.requests.map((request) => createStamp(request)));
    } else {
      setFixedStamps(false);
      setStamps([createStamp()]);
    }

    setNotice({
      type: "success",
      text: `${plural(prepared.length, "document")} found${
        result.requests.length ? `, ${plural(result.requests.length, "eStamp request")} in the JSON` : ""
      }.`,
    });
    loadViewer(); // warm up the preview so the first click opens instantly
    return true;
  }

  async function loadFile(file) {
    if (!file) return;
    try {
      return await loadJSON(await file.text(), file.name);
    } catch {
      setNotice({ type: "error", text: "Could not read the JSON file." });
      return false;
    }
  }

  // Ctrl+V anywhere on the page (outside a text field) loads the JSON from the clipboard.
  const pasteHandler = useRef(null);
  pasteHandler.current = (event) => {
    if (preview || event.target.closest?.("input, textarea, select, [contenteditable]")) return;
    const text = event.clipboardData?.getData("text") ?? "";
    if (!text.trim().startsWith("{") && !text.trim().startsWith("[")) return;
    event.preventDefault();
    loadJSON(text, "Pasted JSON");
  };
  useEffect(() => {
    const listener = (event) => pasteHandler.current(event);
    document.addEventListener("paste", listener);
    return () => document.removeEventListener("paste", listener);
  }, []);

  // ---------- documents tab ----------
  const fileNames = useMemo(() => nameDocuments(documents, txnId.trim() || "TXN_ID"), [documents, txnId]);
  const selectedDocs = documents.filter((d) => !docOff.includes(d.key));

  const toggleDoc = (key) => setDocOff((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));
  const toggleAllDocs = (on) => setDocOff(on ? [] : documents.map((d) => d.key));

  const docsBlocked = txnId.trim() ? "" : "Enter the DDE transaction ID above to name the files.";

  // ---------- eStamps ----------
  const readyStamps = useMemo(() => stamps.filter(isComplete), [stamps]);
  // With requests in the JSON every request must be completed; in manual mode only rows being edited are checked.
  const missingStamps = useMemo(
    () => stamps.filter((s) => !isComplete(s) && (fixedStamps || isTouched(s))),
    [stamps, fixedStamps]
  );

  const updateStamp = (id, changes) => setStamps((cur) => cur.map((s) => (s.id === id ? { ...s, ...changes } : s)));
  const removeStamp = (id) =>
    setStamps((cur) => {
      const next = cur.filter((s) => s.id !== id);
      return next.length ? next : [createStamp()];
    });

  async function pickStamp(id, file) {
    if (!file) return;
    try {
      const raw = new Uint8Array(await file.arrayBuffer());
      const bytes = await normalizeToA4(raw); // eStamp pages become A4 before merging too
      const pages = await inspectPdf(bytes);
      updateStamp(id, { fileName: file.name, bytes, pages, error: "" });
    } catch {
      updateStamp(id, { fileName: file.name, bytes: null, pages: 0, error: "This file is not a readable PDF." });
    }
  }

  async function pickPreMerged(id, file) {
    if (!file) return;
    try {
      const raw = new Uint8Array(await file.arrayBuffer());
      const bytes = await normalizeToA4(raw);
      const pages = await inspectPdf(bytes);
      updateStamp(id, { preMergedFileName: file.name, preMergedBytes: bytes, preMergedPages: pages, preMergedError: "" });
    } catch {
      updateStamp(id, { preMergedFileName: file.name, preMergedBytes: null, preMergedPages: 0, preMergedError: "This file is not a readable PDF." });
    }
  }

  // ---------- live merge: rebuilds whenever the inputs change ----------
  const mergeDocs = useMemo(() => documents.map((d) => ({ id: d.id, name: d.name, bytes: d.a4 })), [documents]);

  useEffect(() => {
    if (!mergeDocs.length) {
      setOutputs([]);
      setBuildWarnings([]);
      return undefined;
    }
    let cancelled = false;
    setBuilding(true);
    const timer = setTimeout(async () => {
      try {
        const result = await buildOutputs({ documents: mergeDocs, groups, stamps: readyStamps });
        if (cancelled) return;
        setOutputs(result.outputs);
        setBuildWarnings(result.warnings);
        setBuildError("");
      } catch (error) {
        console.error("PDF build error:", error);
        if (!cancelled) setBuildError(error instanceof Error ? error.message : "Unexpected error.");
      } finally {
        if (!cancelled) setBuilding(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [mergeDocs, groups, readyStamps]);

  const named = useMemo(() => planFilenames(outputs, txnId.trim() || "TXN_ID"), [outputs, txnId]);
  const selectedOutputs = named.filter((o) => !outputOff.includes(o.id));
  const zipLayout = [...new Set(named.flatMap((o) => o.files.map((f) => f.path)))];

  const toggleOutput = (id) => setOutputOff((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const toggleAllOutputs = (on) => setOutputOff(on ? [] : named.map((o) => o.id));

  const mergeBlocked = !txnId.trim()
    ? "Enter the DDE transaction ID above to name the files."
    : missingStamps.length
    ? `${missingStamps.length} eStamp request${missingStamps.length === 1 ? "" : "s"} need attention. Check the highlighted request fields.`
    : "";

  // ---------- downloads ----------
  async function run(kind, task) {
    setBusy(kind);
    try {
      await task();
    } catch (error) {
      console.error("Download error:", error);
      setNotice({ type: "error", text: "The download could not be completed. Please try again." });
    } finally {
      setBusy(null);
    }
  }

  const downloadDocPdfs = () =>
    run("docs-pdf", async () => {
      await downloadPdfs(selectedDocs.map((d) => ({ name: fileNames.get(d.key), bytes: d.bytes })));
      setNotice({
        type: "success",
        text:
          selectedDocs.length > 1
            ? `${plural(selectedDocs.length, "PDF")} downloaded. If some are missing, allow multiple downloads for this site.`
            : "PDF downloaded.",
      });
    });

  const downloadDocZip = () =>
    run("docs-zip", async () => {
      const zipName = `${sanitizeFileName(source?.jsonTxnId || txnId.trim()) || "documents"}.zip`;
      await downloadZip(selectedDocs.map((d) => ({ path: fileNames.get(d.key), bytes: d.bytes })), zipName);
      setNotice({ type: "success", text: `${plural(selectedDocs.length, "PDF")} saved in ${zipName}.` });
    });

  const downloadMergedPdfs = () =>
    run("merge-pdf", async () => {
      await downloadPdfs(selectedOutputs.map((o) => ({ name: o.singleName, bytes: o.bytes })));
      setNotice({
        type: "success",
        text:
          selectedOutputs.length > 1
            ? `${plural(selectedOutputs.length, "PDF")} downloaded. If some are missing, allow multiple downloads for this site.`
            : "PDF downloaded.",
      });
    });

  const downloadMergedZip = () =>
    run("merge-zip", async () => {
      // flat layout <relation>/<TXN ID>.pdf; one merged PDF is written into EACH relation folder it serves
      const entries = selectedOutputs.flatMap((o) => o.files.map((f) => ({ path: f.path, bytes: o.bytes })));
      await downloadZip(entries, `${safeName(txnId.trim())}_PDFs.zip`);
      setNotice({ type: "success", text: `${plural(entries.length, "file")} added to the ZIP.` });
    });

  // ---------- preview ----------
  const openDocPreview = (doc) =>
    setPreview({
      kind: "docs",
      title: `Document ID ${doc.id}`,
      subtitle: doc.name && doc.name !== doc.id ? doc.name : fileNames.get(doc.key),
      bytes: doc.bytes,
      fileName: fileNames.get(doc.key),
    });

  const openMergedPreview = (output) =>
    setPreview({
      kind: "merge",
      title: `${output.relations.map((r) => r.label).join(" / ")}: ${output.participants.join(", ")}`,
      subtitle: `Order: ${orderOf(output)}`,
      bytes: output.bytes,
      fileName: output.singleName,
    });

  const warnings = [...parseWarnings, ...buildWarnings];
  const hasData = documents.length > 0;
  const currentOutput = named.find((o) => o.id === previewOutputId) || named[0];

  return (
    <div id="page-top" className={`page${workspaceMode === "estamp" ? " fit" : ""}`}>
      <header className="top">
        <span className="logo" aria-hidden="true"><i /></span>
        <div>
          <h1>NeSL DDE PDF Toolkit</h1>
          <p>File Downloader and eStamp Merger · Secure browser-based PDF processing</p>
        </div>
        {!hasData && workspaceMode === "downloader" && (
          <div className="partner-mark" aria-label="NeSL partner branding">
            <strong><span>N</span><em>e</em><span>SL</span></strong>
            <i />
            <small>National E-Governance<br />Services Ltd.</small>
          </div>
        )}
        <nav className="app-switcher" aria-label="Application sections" style={{ display: !hasData && workspaceMode === "downloader" ? "none" : undefined }}>
          <button type="button" className={workspaceMode === "downloader" ? "active" : ""} aria-current={workspaceMode === "downloader" ? "page" : undefined} onClick={() => navigateWorkspace("downloader")}>
            <Icon name="download" size={16} /> <span className="nav-label"><strong>Documents / Library</strong><small>File Downloader</small></span>
          </button>
          <button type="button" className={workspaceMode === "estamp" ? "active" : ""} aria-current={workspaceMode === "estamp" ? "page" : undefined} onClick={() => navigateWorkspace("estamp")}>
            <Icon name="file" size={16} /> <span className="nav-label"><strong>Merge &amp; Process</strong><small>eStamp Merger</small></span>
            {fixedStamps && <span className="count">{readyStamps.length}/{stamps.length}</span>}
          </button>
        </nav>
      </header>

      <main className={workspaceMode}>
        {notice && (
          <div className={`notice ${notice.type}`} role={notice.type === "error" ? "alert" : "status"}>
            <span>{notice.text}</span>
            <button type="button" className="icon-btn" onClick={() => setNotice(null)} aria-label="Dismiss message">
              <Icon name="close" size={14} />
            </button>
          </div>
        )}

        {workspaceMode === "downloader" ? (
          <>
            <LandingPage
              txnId={txnId}
              onTxnId={setTxnId}
              loading={loading}
              onLoadText={loadJSON}
              onLoadFile={loadFile}
              onChooseTool={navigateWorkspace}
              notify={(text) => setNotice({ type: "error", text })}
            />
            {hasData && (
              <section id="documents-library" className="card workspace documents-disclosure" aria-label="File Downloader">
                <div className="disclosure-heading">
                  <div>
                    <h2>Documents / Library</h2>
                    <p>{selectedDocs.length} of {documents.length} documents selected for download</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-small"
                    aria-expanded={documentsExpanded}
                    onClick={() => setDocumentsExpanded((expanded) => !expanded)}
                  >
                    {documentsExpanded ? "Collapse" : "Show documents"}
                    <span aria-hidden="true">{documentsExpanded ? "−" : "+"}</span>
                  </button>
                </div>
                {documentsExpanded && (
                  <DocumentsTab
                    documents={documents.map((d) => ({ ...d, selected: !docOff.includes(d.key) }))}
                    fileNames={fileNames}
                    blockedReason={docsBlocked}
                    busy={busy}
                    onToggle={toggleDoc}
                    onToggleAll={toggleAllDocs}
                    onPreview={openDocPreview}
                    onDownloadOne={(doc) => downloadPdf(doc.bytes, fileNames.get(doc.key))}
                    onDownloadPdfs={downloadDocPdfs}
                    onDownloadZip={downloadDocZip}
                  />
                )}
              </section>
            )}
          </>
        ) : (
          <section id="estamp-workspace" className="card workspace estamp-workspace" aria-label="eStamp Merger">
            <div className="estamp-layout" ref={layoutRef} style={{ "--left": `${leftPct}%` }}>
              <div className="estamp-controls">
                <TransactionInput
                  txnId={txnId}
                  onTxnId={setTxnId}
                  loaded={hasData ? { name: source?.name, documents: documents.length, requests: source?.requests ?? 0, participants: source?.participants ?? 0 } : null}
                  notify={(text) => setNotice({ type: "error", text })}
                  loading={loading}
                  onLoadText={loadJSON}
                  onLoadFile={loadFile}
                />
                {hasData ? (
                  <>
                    <MergeTab
                      documents={documents}
                      stamps={stamps}
                      fixedStamps={fixedStamps}
                      readyCount={readyStamps.length}
                      outputs={named}
                      deselected={outputOff}
                      building={building}
                      buildError={buildError}
                      warnings={warnings}
                      folders={zipLayout}
                      blockedReason={mergeBlocked}
                      busy={busy}
                      onStampChange={updateStamp}
                      onStampPick={pickStamp}
                      onPreMergedPick={pickPreMerged}
                      onStampAdd={() => setStamps((cur) => [...cur, createStamp()])}
                      onStampRemove={removeStamp}
                      onToggleOutput={toggleOutput}
                      onToggleAllOutputs={toggleAllOutputs}
                      onPreview={openMergedPreview}
                      onDownloadOne={(o) => downloadPdf(o.bytes, o.singleName)}
                      onDownloadPdfs={downloadMergedPdfs}
                      onDownloadZip={downloadMergedZip}
                    />
                  </>
                ) : (
                  <div className="preview-empty left-empty"><strong>Start with transaction JSON</strong><span>Enter the DDE transaction ID and upload or paste the JSON above.</span></div>
                )}
              </div>
              <div
                className="divider"
                role="separator"
                aria-orientation="vertical"
                aria-label="Drag to resize the panels"
                tabIndex={0}
                onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
                onPointerMove={dragDivider}
                onKeyDown={(e) => {
                  if (e.key === "ArrowLeft") setLeftPct((p) => clampPct(p - 3));
                  if (e.key === "ArrowRight") setLeftPct((p) => clampPct(p + 3));
                }}
              />
              <aside className="live-preview" aria-label="Merged PDF preview">
                <div className="preview-head">
                  <h2>Preview</h2>
                  {named.length > 0 && (
                    <div className="preview-tabs" role="tablist" aria-label="Select output to preview">
                      {named.map((output) => (
                        <button key={output.id} type="button" role="tab" className="preview-tab" aria-selected={output === currentOutput} onClick={() => setPreviewOutputId(output.id)}>
                          <strong>{output.relations.map((r) => r.label).join(" / ")}</strong>
                          <span>{output.participants.join(", ")}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {currentOutput ? (
                  <InlinePdfPreview bytes={currentOutput.bytes} />
                ) : (
                  <div className="preview-empty"><div className="preview-placeholder-icon">PDF</div><strong>Your preview will appear here</strong><span>Upload the transaction JSON to begin.</span></div>
                )}
              </aside>
            </div>
          </section>
        )}
      </main>

      <Footer />

      {preview && (
        <Suspense fallback={<div className="viewer-loading" role="status">Opening preview</div>}>
          <PdfViewer
            title={preview.title}
            subtitle={preview.subtitle}
            bytes={preview.bytes}
            onClose={() => setPreview(null)}
            onDownload={() => downloadPdf(preview.bytes, preview.fileName)}
            blockedReason={preview.kind === "docs" ? docsBlocked : mergeBlocked}
          />
        </Suspense>
      )}
    </div>
  );
}
