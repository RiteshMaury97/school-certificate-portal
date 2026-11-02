// Built-ins only: crypto supplies audit hashes/random storage names; zlib inflates ZIP members for inspection.
import { createHash, randomUUID } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import blocklist from "./blocklist.json";

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_ENTRIES = 500;
const MAX_UNCOMPRESSED = 50 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
};
const BAD_EXT = new Set(["exe","js","vbs","bat","cmd","scr","ps1","jar","msi","lnk","hta","html","svg","docm","xlsm","pptm"]);
export type ScanResult = { safe: boolean; verdict: "clean" | "blocked"; reasons: string[]; sha256: string };
function blocked(buffer: Buffer, reasons: string[]): ScanResult {
  return { safe: false, verdict: "blocked", reasons, sha256: createHash("sha256").update(buffer).digest("hex") };
}
function decodePdfNames(text: string): string {
  return text.replace(/#([0-9a-f]{2})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}
function isZip(buffer: Buffer) { return buffer.length >= 4 && buffer.readUInt32LE(0) === 0x04034b50; }
function unzipEntries(buffer: Buffer): Array<{ name: string; data: Buffer }> {
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("Malformed ZIP");
  const count = buffer.readUInt16LE(eocd + 10), centralSize = buffer.readUInt32LE(eocd + 12), centralOffset = buffer.readUInt32LE(eocd + 16);
  if (count > MAX_ENTRIES || centralOffset + centralSize > eocd) throw new Error("ZIP limits or structure invalid");
  const entries: Array<{ name: string; data: Buffer }> = [];
  let cursor = centralOffset, total = 0;
  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error("Malformed ZIP directory");
    const flags = buffer.readUInt16LE(cursor + 8), method = buffer.readUInt16LE(cursor + 10), crc = buffer.readUInt32LE(cursor + 16);
    const compressed = buffer.readUInt32LE(cursor + 20), declared = buffer.readUInt32LE(cursor + 24), nl = buffer.readUInt16LE(cursor + 28), el = buffer.readUInt16LE(cursor + 30), cl = buffer.readUInt16LE(cursor + 32), localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.subarray(cursor + 46, cursor + 46 + nl).toString("utf8");
    cursor += 46 + nl + el + cl;
    if ((flags & 1) || name.startsWith("/") || /^[a-z]:/i.test(name) || name.split(/[\\/]/).includes("..")) throw new Error("Unsafe or encrypted ZIP entry");
    if (declared > MAX_UNCOMPRESSED || (compressed === 0 ? declared > 0 : declared / compressed > 100)) throw new Error("ZIP expansion limit exceeded");
    total += declared; if (total > MAX_UNCOMPRESSED) throw new Error("ZIP expansion limit exceeded");
    if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("Malformed ZIP entry");
    const localName = buffer.readUInt16LE(localOffset + 26), localExtra = buffer.readUInt16LE(localOffset + 28), start = localOffset + 30 + localName + localExtra;
    if (start + compressed > buffer.length) throw new Error("Truncated ZIP entry");
    const raw = buffer.subarray(start, start + compressed);
    let data: Buffer;
    if (method === 0) data = Buffer.from(raw);
    else if (method === 8) data = inflateRawSync(raw, { maxOutputLength: MAX_UNCOMPRESSED });
    else throw new Error("Unsupported ZIP compression");
    if (data.length !== declared || data.length > MAX_UNCOMPRESSED) throw new Error("ZIP size mismatch");
    // CRC-32 check uses the ZIP checksum field; malformed entries fail closed.
    if (crc32(data) !== crc) throw new Error("ZIP checksum mismatch");
    entries.push({ name, data });
  }
  return entries;
}
function crc32(data: Buffer): number { let c = 0xffffffff; for (const b of data) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0); } return (c ^ 0xffffffff) >>> 0; }
function suspicious(data: Buffer): boolean {
  const text = data.toString("latin1");
  return /powershell\s+(?:-enc|-encodedcommand)|cmd\.exe\s*\/c|wscript\.shell|<script\b|[A-Za-z0-9+/]{200,}={0,2}[\s\S]{0,100}(?:exec|eval|powershell)/i.test(text);
}
function imageValid(buffer: Buffer, ext: string): boolean {
  if (ext === "png") {
    const sig = Buffer.from([137,80,78,71,13,10,26,10]); if (!buffer.subarray(0,8).equals(sig)) return false;
    let p = 8, ended = false;
    while (p + 12 <= buffer.length) { const n = buffer.readUInt32BE(p); if (p + 12 + n > buffer.length) return false; if (crc32(buffer.subarray(p + 4, p + 8 + n)) !== buffer.readUInt32BE(p + 8 + n)) return false; const typ = buffer.toString("ascii", p+4, p+8); if (typ === "IEND") { if (n !== 0 || p + 12 !== buffer.length) return false; ended = true; break; } p += 12 + n; }
    return ended;
  }
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return false;
  let p = 2;
  while (p < buffer.length) { if (buffer[p++] !== 0xff) return false; while (buffer[p] === 0xff) p++; const marker = buffer[p++] ?? -1; if (marker === 0xd9) return p === buffer.length; if (marker === 0xda) { const len = buffer.readUInt16BE(p); p += len; const end = buffer.lastIndexOf(Buffer.from([0xff,0xd9])); return end >= p && end + 2 === buffer.length; } if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue; if (p + 2 > buffer.length) return false; const len = buffer.readUInt16BE(p); if (len < 2 || p + len > buffer.length) return false; p += len; }
  return false;
}
export function scanFile(buffer: Buffer, originalName: string, declaredMime: string): ScanResult {
  const reasons: string[] = [];
  try {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) reasons.push("empty file");
    if (buffer.length > MAX_UPLOAD_BYTES) reasons.push("file too large");
    const cleanName = originalName.replace(/[\\/\0\u202a-\u202e\u2066-\u2069\x00-\x1f\x7f]/g, "").replace(/^.*:/, "").trim();
    const parts = cleanName.toLowerCase().split("."); const ext = parts.at(-1) ?? "";
    if (!EXTENSIONS[ext] || parts.slice(1,-1).some((part) => BAD_EXT.has(part)) || BAD_EXT.has(ext)) reasons.push("extension not allowed");
    if (parts.length > 2 && parts.slice(1,-1).some((part) => part.length > 0)) reasons.push("double extension");
    if (declaredMime !== EXTENSIONS[ext]) reasons.push("declared MIME mismatch");
    const signature = buffer.length >= 4 ? buffer.readUInt32BE(0) : 0;
    const macho = new Set([0xfeedface, 0xcefaedfe, 0xfeedfacf, 0xcffaedfe, 0xcafebabe, 0xbebafeca]);
    if ((buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) || buffer.subarray(0,4).equals(Buffer.from([0x7f,0x45,0x4c,0x46])) || macho.has(signature) || buffer.subarray(0,2).toString() === "#!") reasons.push("executable or script signature");
    if (buffer.includes(Buffer.from("EICAR-STANDARD-ANTIVIRUS-TEST-FILE"))) reasons.push("test signature detected");
    const sha256 = createHash("sha256").update(buffer).digest("hex");
    if ((blocklist as string[]).includes(sha256)) reasons.push("blocked hash");
    if (reasons.length) return blocked(buffer, reasons);
    if (ext === "pdf") {
      if (!buffer.subarray(0,5).equals(Buffer.from("%PDF-"))) reasons.push("PDF magic mismatch");
      const body = decodePdfNames(buffer.toString("latin1"));
      if (/\/(?:JavaScript|JS|OpenAction|AA|Launch|EmbeddedFile|RichMedia|XFA|SubmitForm)\b/i.test(body)) reasons.push("active PDF content");
      if (/%%EOF/.test(body) && body.slice(body.lastIndexOf("%%EOF") + 5).trim()) reasons.push("trailing PDF data");
    } else if (ext === "png" || ext === "jpg" || ext === "jpeg") {
      if (!imageValid(buffer, ext)) reasons.push("invalid image structure or trailing data");
    } else if (ext === "txt") {
      if (buffer.includes(0) || buffer.some((byte) => byte < 9 || (byte > 13 && byte < 32))) reasons.push("binary text content");
    } else {
      const entries = unzipEntries(buffer);
      const expected = ext === "docx" ? "word/" : ext === "xlsx" ? "xl/" : "ppt/";
      if (!entries.some((entry) => entry.name.startsWith(expected) && entry.name.endsWith(".xml"))) reasons.push("invalid OOXML package");
      for (const entry of entries) {
        const n = entry.name.toLowerCase();
        if (n.includes("vbaproject.bin") || n.startsWith("word/embeddings/") || n.startsWith("xl/embeddings/") || n.startsWith("ppt/embeddings/") || /activex|oleobject/.test(n)) reasons.push("macro or embedded object");
        if (n.endsWith(".rels") && /targetmode\s*=\s*["']external["']/i.test(entry.data.toString("utf8"))) reasons.push("external relationship");
        if (/\.(?:exe|dll|bat|cmd|js|ps1|vbs|jar)$/.test(n) || isZip(entry.data)) reasons.push("nested archive or executable payload");
        if (suspicious(entry.data)) reasons.push("suspicious content pattern");
      }
    }
    if (suspicious(buffer)) reasons.push("suspicious content pattern");
    return reasons.length ? blocked(buffer, [...new Set(reasons)]) : { safe: true, verdict: "clean", reasons: [], sha256 };
  } catch {
    return blocked(buffer, ["scan failed or file could not be parsed"]);
  }
}
export function createStorageName(originalName: string): string {
  const extension = originalName.split(".").at(-1)?.toLowerCase() ?? "";
  if (!EXTENSIONS[extension]) throw new Error("Unsupported extension");
  return `${randomUUID()}.${extension}`;
}
