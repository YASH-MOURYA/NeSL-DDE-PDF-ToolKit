import JSZip from "jszip";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const sanitizeFileName = (value) =>
  String(value).replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").replace(/\s+/g, " ").trim();

export function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const pdfBlob = (bytes) => new Blob([bytes], { type: "application/pdf" });

export const downloadPdf = (bytes, fileName) => saveBlob(pdfBlob(bytes), fileName);

/** Several PDFs one after another; a short gap keeps browsers from dropping them. files: [{ name, bytes }] */
export async function downloadPdfs(files) {
  for (const [index, file] of files.entries()) {
    if (index > 0) await sleep(350);
    downloadPdf(file.bytes, file.name);
  }
}

/** Zips in the browser and downloads. entries: [{ path, bytes }] */
export async function downloadZip(entries, zipName) {
  const zip = new JSZip();
  entries.forEach((entry) => zip.file(entry.path, entry.bytes, { createFolders: false }));
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  saveBlob(blob, zipName);
}

/** File name per document: "<DDE transaction ID>_<document ID>.pdf" (a repeated ID gets _2, _3 ...). Returns Map key -> name. */
export function nameDocuments(documents, prefix) {
  const base = sanitizeFileName(prefix) || "TXN_ID";
  const used = new Map();
  const names = new Map();
  for (const doc of documents) {
    const stem = `${base}_${sanitizeFileName(doc.id)}`;
    const n = (used.get(stem) ?? 0) + 1;
    used.set(stem, n);
    names.set(doc.key, `${stem}${n > 1 ? `_${n}` : ""}.pdf`);
  }
  return names;
}
