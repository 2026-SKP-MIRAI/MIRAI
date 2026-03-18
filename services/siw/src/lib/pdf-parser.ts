// pdf-parse is excluded from webpack bundling via next.config.ts serverExternalPackages
export async function parsePdf(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParseModule = require("pdf-parse") as {
    PDFParse: new (opts: { data: Buffer }) => { getText(): Promise<{ text: string }> };
  };
  const parser = new pdfParseModule.PDFParse({ data: buffer });
  const result = await parser.getText();
  return result.text;
}
