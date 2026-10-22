import assert from "node:assert/strict";
import { A4, HEADER, layoutCertificates, textWidth } from "../src/lib/merge.js";

const num = (i) => `IN-KA${String(60205095895692 + i * 1111111111).padStart(14, "0")}Q`; // 19 characters, like the real ones

// 1) every certificate number sits on ONE line, separated by ", ", at 12 pt - no wrapping, no shrinking
for (const n of [1, 3, 5, 25]) {
  const numbers = Array.from({ length: n }, (_, i) => num(i));
  const { lines, size } = layoutCertificates(numbers);
  assert.equal(lines.length, 1, `${n} numbers stay on one line`);
  assert.equal(size, HEADER.size);
  assert.equal(lines[0], `Certificate Number: ${numbers.join(", ")}`);
}

// 2) an absurdly long number does not shrink the font either
{
  const huge = "IN-" + "X".repeat(120);
  const { lines, size } = layoutCertificates([huge, num(1)]);
  assert.equal(lines.length, 1);
  assert.equal(size, HEADER.size);
  assert.equal(lines[0], `Certificate Number: ${huge}, ${num(1)}`);
}

// 3) numbers are trimmed, upper-cased and stripped of non-ASCII; blanks are dropped
{
  const { lines } = layoutCertificates(["  in-dl1 ", "", "   "]);
  assert.deepEqual(lines, ["Certificate Number: IN-DL1"]);
  assert.deepEqual(layoutCertificates([]).lines, []);
}

// 4) the line ends at the right margin; a single certificate starts near the real application's position
{
  const { lines, size } = layoutCertificates(["IN-DL89959002014420Y"]);
  const start = A4.width - HEADER.marginRight - textWidth(lines[0], size);
  assert.ok(Math.abs(start - 310) < 3, `single certificate should start near x=310, got ${start.toFixed(1)}`);
}
console.log("certificate layout tests passed");
