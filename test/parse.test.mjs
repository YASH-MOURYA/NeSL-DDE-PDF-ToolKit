import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { parseTransaction, findTxnId } from "../src/lib/parse.js";

async function pdfBase64(pages = 1) {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pages; i++) pdf.addPage([595.28, 841.89]);
  return Buffer.from(await pdf.save()).toString("base64");
}

// A) the downloader's shapes still work: docDetails, deeply nested, data: prefix
{
  const data = {
    response: { txnID: "TXN-77", payload: { docDetails: [
      { documentId: "7", docData: `data:application/pdf;base64,${await pdfBase64(2)}` },
      { documentId: "8", docData: await pdfBase64() },
    ] } },
  };
  const parsed = parseTransaction(data);
  assert.deepEqual(parsed.documents.map((d) => d.id), ["7", "8"]);
  assert.equal(parsed.jsonTxnId, "TXN-77");
}

// B) PDFs hidden under unknown key names are still found through the PDF header
{
  const data = { a: { b: [{ seqNo: "3", weird: await pdfBase64() }, { seqNo: "4", fileData: await pdfBase64() }] } };
  const parsed = parseTransaction(data);
  assert.equal(parsed.documents.length, 1, "only the item with a known data key is read");
  assert.equal(parsed.documents[0].id, "4");
}

// C) txnID lookup is recursive and case-insensitive
assert.equal(findTxnId({ x: [{ y: { TXNID: " 99 " } }] }), "99");
assert.equal(findTxnId({ x: 1 }), "");

console.log("parse tests passed");
