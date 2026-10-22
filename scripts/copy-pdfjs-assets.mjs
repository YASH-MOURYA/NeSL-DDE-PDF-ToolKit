// Copies the PDF.js data files (CMaps, standard fonts, WASM decoders, ICC profiles) into public/pdfjs
// so the preview renders every kind of PDF correctly and never loads anything from another site.
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const from = path.resolve("node_modules/pdfjs-dist");
const to = path.resolve("public/pdfjs");
rmSync(to, { recursive: true, force: true });
mkdirSync(to, { recursive: true });
for (const dir of ["cmaps", "standard_fonts", "wasm", "iccs"]) {
  if (existsSync(path.join(from, dir))) cpSync(path.join(from, dir), path.join(to, dir), { recursive: true });
}
console.log("PDF.js assets copied to public/pdfjs");
