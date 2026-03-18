// pdf-parse is excluded from webpack bundling via next.config.ts serverExternalPackages

// DOMMatrix polyfill for Node.js — pdf-parse v2 requires this for PDF coordinate transforms
// TODO: remove when #119 (siw pdf-parse 제거) 완료
if (typeof globalThis.DOMMatrix === "undefined") {
  class DOMMatrix {
    a=1; b=0; c=0; d=1; e=0; f=0
    m11=1; m12=0; m13=0; m14=0; m21=0; m22=1; m23=0; m24=0
    m31=0; m32=0; m33=1; m34=0; m41=0; m42=0; m43=0; m44=1
    is2D=true; isIdentity=true
    constructor(_init?: string | number[]) {}
    multiply(other?: DOMMatrix) { return other ?? this }
    translate(tx=0, ty=0) { const m = new DOMMatrix(); m.e=tx; m.f=ty; return m }
    scale(sx=1, sy=sx) { const m = new DOMMatrix(); m.a=sx; m.d=sy; return m }
    rotate() { return new DOMMatrix() }
    inverse() { return new DOMMatrix() }
    transformPoint(p?: {x?:number; y?:number}) { return p ?? {x:0, y:0} }
    toString() { return `matrix(${this.a},${this.b},${this.c},${this.d},${this.e},${this.f})` }
  }
  (globalThis as Record<string, unknown>).DOMMatrix = DOMMatrix
}

export async function parsePdf(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParseModule = require("pdf-parse") as {
    PDFParse: new (opts: { data: Buffer }) => { getText(): Promise<{ text: string }> };
  };
  const parser = new pdfParseModule.PDFParse({ data: buffer });
  const result = await parser.getText();
  return result.text;
}
