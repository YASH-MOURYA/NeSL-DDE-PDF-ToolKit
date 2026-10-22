# DDE PDF Toolkit

One React + Vite app for the two jobs that start from the same NeSL transaction JSON. It runs fully in the browser, so there is no backend.

1. **Documents**: list every Base64 PDF in the JSON, preview it page by page, and download one, several, or all as a ZIP.
2. **eStamps and merge**: add the eStamp PDFs and certificate numbers, and get one merged **A4** PDF for every set of documents.

It replaces the separate *JSON PDF Downloader* and *eStamp Merger* projects.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # parsing, A4, certificates, naming (generates sample data first)
npm run build      # static site in dist/
```

## How to use it

1. Type the **DDE transaction ID** (it names every downloaded file), then paste the transaction **JSON** (Ctrl+V in the box, Ctrl+V anywhere on the page, or the *Paste from clipboard* button). It loads as soon as you paste. *Upload file* (or dropping a file on the card) works too.
2. **Documents** tab: tick the PDFs you want. *Preview* opens a large window over a blurred page, with page number box, previous/next, zoom, and arrow keys. *Download PDFs* saves them one by one, *Download ZIP* bundles them.
3. **eStamps and merge** tab: add the eStamp PDF and the certificate number (required) for each request. The merged PDFs rebuild as you type. Preview them the same way, then download as PDFs or one ZIP. Downloads stay disabled until every eStamp is complete.

## File names

| What | Name |
| --- | --- |
| A document PDF | `<DDE transaction ID>_<document ID>.pdf` |
| Documents ZIP | `<txnID found in the JSON>.zip` (the DDE transaction ID if the JSON has none) |
| A merged PDF (single download) | `<DDE transaction ID>_<relation>.pdf` |
| Merged ZIP | `<DDE transaction ID>_PDFs.zip` with `<relation>/<DDE transaction ID>.pdf` inside |

Documents downloaded from the Documents tab are the **original** PDFs, exactly as decoded from the JSON. The A4 conversion only applies to the merged PDFs.

## Merge rules

- **A4 everywhere**: documents and eStamp PDFs are converted to exact A4 portrait (595.28 x 841.89 pt) before merging. Letter, A3, landscape and rotated pages are scaled to fit and centred. Content stays vector and annotations move with the page. Pages that are already A4 are left untouched.
- **Order**: all eStamps of a document are inserted immediately before it, in the order of `estampdtls`.
- **Certificate numbers**: every page of a document with eStamps gets `Certificate Number: n1, n2, n3` at the top right, one line, 12 pt, ending 46 pt from the right edge. The text is drawn as vector outlines, so it cannot be retyped in a PDF editor.
- **One merged PDF per set of documents**: if everyone holds the same document IDs there is one PDF, written into each relation folder (`creditor/`, `debtor/`, ...). Participants with different document sets get a separate PDF each. A participant without a document list holds every document.

## JSON assumptions

Documents in `loan.documentdtls[]` (`documentID`, Base64 in `docData`), participants in `loan.prtcptentty[]` (`fulnm`, `reltocntrct`, `documentID`), eStamp requests in `loan.estampdtls[]` (`documentID`, `descriptionofDocument`, `stampDutyAmount`, `firstparty`). Key names are matched case-insensitively and several spellings are tried (`docDetails`, `documentList`, `seqNo` ...). If the expected lists are missing, the whole JSON is searched for Base64 PDFs. Add more spellings at the top of `src/lib/parse.js`.

## Project layout

```
src/App.jsx                      state, loading, merging and downloads
src/components/TransactionInput  DDE transaction ID, JSON drop zone, paste box
src/components/DocumentsTab      document table
src/components/MergeTab          eStamp rows and merged PDFs
src/components/PdfViewer         large preview window (PDF.js)
src/lib/parse.js                 JSON to documents, groups, eStamp requests
src/lib/merge.js                 A4 fitting, merging, certificate header, naming
src/lib/download.js              PDF and ZIP downloads
src/pages/                       Privacy Policy and Terms
src/site.js                      operator name and contact email for the legal pages
scripts/copy-pdfjs-assets.mjs    copies PDF.js fonts and decoders into public/pdfjs
```

## Before launch

- [ ] Fill in `operator` and `contactEmail` in `src/site.js` (used by /privacy and /terms), and have both pages reviewed.
- [ ] Connect your custom domain in Netlify (Domain management) and enable HTTPS.
- [ ] Confirm the favicon shows on the deployed site.
- [ ] Confirm no "Made with" badge or third-party script is on the page.

Deployment steps are in `DEPLOY.md`.


## Application sections

The application has two main sections:

- **File Downloader** — extracts PDFs from the transaction JSON and downloads individual files or a ZIP.
- **eStamp Merger** — configures each eStamp request and previews generated PDFs beside the controls.

Each eStamp request supports three processing modes through two independent switches:

- **Manual merge** (both switches OFF): upload an eStamp PDF and enter its certificate number.
- **Use Pre-Merged Document** (first ON, skip OFF): use an already-stamped PDF to replace that document's normal merge operation.
- **Skip eStamp Request** (second ON): keep the original document without adding that request's eStamp. Skip takes priority if both switches are ON.

The UI uses a dark navy and blue corporate palette inspired by NeSL branding. All PDF processing remains in the browser.
