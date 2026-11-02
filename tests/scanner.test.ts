import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { scanFile } from "@/lib/scanner";

function crc32(data: Buffer) { let c=0xffffffff; for (const b of data) { c^=b; for(let k=0;k<8;k++) c=(c>>>1)^(c&1?0xedb88320:0); } return (c^0xffffffff)>>>0; }
function zip(files: Array<[string, Buffer]>) {
  const locals: Buffer[]=[]; const centrals: Buffer[]=[]; let offset=0;
  for(const [name,data] of files) {
    const n=Buffer.from(name), compressed=deflateRawSync(data), crc=crc32(data);
    const l=Buffer.alloc(30+n.length); l.writeUInt32LE(0x04034b50,0); l.writeUInt16LE(20,4); l.writeUInt16LE(8,6); l.writeUInt32LE(crc,14); l.writeUInt32LE(compressed.length,18); l.writeUInt32LE(data.length,22); l.writeUInt16LE(n.length,26); n.copy(l,30); locals.push(l,compressed);
    const c=Buffer.alloc(46+n.length); c.writeUInt32LE(0x02014b50,0); c.writeUInt16LE(20,4); c.writeUInt16LE(20,6); c.writeUInt16LE(0,8); c.writeUInt16LE(8,10); c.writeUInt32LE(crc,16); c.writeUInt32LE(compressed.length,20); c.writeUInt32LE(data.length,24); c.writeUInt16LE(n.length,28); c.writeUInt32LE(offset,42); n.copy(c,46); centrals.push(c); offset+=l.length+compressed.length;
  }
  const central=Buffer.concat(centrals), body=Buffer.concat(locals), end=Buffer.alloc(22); end.writeUInt32LE(0x06054b50,0); end.writeUInt16LE(files.length,8); end.writeUInt16LE(files.length,10); end.writeUInt32LE(central.length,12); end.writeUInt32LE(body.length,16); return Buffer.concat([body,central,end]);
}
function png() {
  const sig=Buffer.from([137,80,78,71,13,10,26,10]);
  const chunk=(kind:string,data=Buffer.alloc(0))=>{const type=Buffer.from(kind),out=Buffer.alloc(12+data.length);out.writeUInt32BE(data.length,0);type.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc32(Buffer.concat([type,data])),8+data.length);return out;};
  const ihdr=Buffer.alloc(13); ihdr.writeUInt32BE(1,0); ihdr.writeUInt32BE(1,4); ihdr[8]=8; ihdr[9]=2;
  return Buffer.concat([sig,chunk("IHDR",ihdr),chunk("IDAT",deflateRawSync(Buffer.from([0,0,0,0]))),chunk("IEND")]);
}
const scan=(b:Buffer,n:string,m:string)=>scanFile(b,n,m);
describe("built-in document scanner",()=>{
  it("allows clean PDF, OOXML and PNG fixtures",()=>{
    expect(scan(Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF"),"a.pdf","application/pdf").safe).toBe(true);
    const docx=zip([["[Content_Types].xml",Buffer.from("<Types>"+Buffer.from(Array.from({length:240},(_,i)=>(i*73+19)%256)).toString("base64")+"</Types>")],["word/document.xml",Buffer.from("<document/>")]]);
    expect(scan(docx,"a.docx","application/vnd.openxmlformats-officedocument.wordprocessingml.document").safe).toBe(true);
    expect(scan(png(),"a.png","image/png").safe).toBe(true);
  });
  it("blocks EICAR and executable bytes renamed as PDF",()=>{
    expect(scan(Buffer.from("%PDF-1.7\nEICAR-STANDARD-ANTIVIRUS-TEST-FILE"),"a.pdf","application/pdf").safe).toBe(false);
    expect(scan(Buffer.from("MZxxxx"),"a.pdf","application/pdf").safe).toBe(false);
  });
  it("blocks macro payloads and obfuscated PDF actions",()=>{
    const docx=zip([["[Content_Types].xml",Buffer.from("<Types/>")],["word/document.xml",Buffer.from("<document/>")],["word/vbaProject.bin",Buffer.from("x")]]);
    expect(scan(docx,"a.docx","application/vnd.openxmlformats-officedocument.wordprocessingml.document").safe).toBe(false);
    for(const action of ["/OpenAction /JavaScript","/J#61vaScript"]) expect(scan(Buffer.from(`%PDF-1.7 ${action}`),"a.pdf","application/pdf").safe).toBe(false);
  });
  it("blocks ZIP bombs, traversal and parse errors",()=>{
    const huge=zip([["word/document.xml",Buffer.from("x".repeat(200_000))]]);
    expect(scan(huge,"a.docx","application/vnd.openxmlformats-officedocument.wordprocessingml.document").safe).toBe(false);
    const traversal=zip([["../payload.exe",Buffer.from("x")]]);
    expect(scan(traversal,"a.docx","application/vnd.openxmlformats-officedocument.wordprocessingml.document").safe).toBe(false);
    expect(scan(Buffer.from("PK\x03\x04broken"),"a.docx","application/vnd.openxmlformats-officedocument.wordprocessingml.document").safe).toBe(false);
  });
  it("blocks empty and oversized files",()=>{
    expect(scan(Buffer.alloc(0),"a.pdf","application/pdf").safe).toBe(false);
    expect(scan(Buffer.alloc(4*1024*1024+1),"a.pdf","application/pdf").safe).toBe(false);
  });
});
