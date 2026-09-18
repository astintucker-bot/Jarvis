import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import JSZip from "jszip";

const MAX_WORD_BYTES = 10 * 1024 * 1024;

export function safeWordFilename(value: string) {
  const base = value.trim().replace(/\.docx$/i, "").replace(/[^a-zA-Z0-9 _()-]+/g, "").replace(/\s+/g, " ").slice(0, 120) || "Jarvis Document";
  return `${base}.docx`;
}

function inlineRuns(value: string) {
  const runs: TextRun[] = [];
  const pieces = value.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  for (const piece of pieces) {
    const bold = piece.startsWith("**") && piece.endsWith("**");
    runs.push(new TextRun({ text: bold ? piece.slice(2, -2) : piece, bold }));
  }
  return runs.length ? runs : [new TextRun("")];
}

export async function createWordDocument(title: string, content: string) {
  const children: Paragraph[] = [];
  if (title.trim()) children.push(new Paragraph({ text: title.trim(), heading: HeadingLevel.TITLE, spacing: { after: 280 } }));
  for (const rawLine of content.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      children.push(new Paragraph(""));
    } else if (/^###\s+/.test(line)) {
      children.push(new Paragraph({ children: inlineRuns(line.replace(/^###\s+/, "")), heading: HeadingLevel.HEADING_3 }));
    } else if (/^##\s+/.test(line)) {
      children.push(new Paragraph({ children: inlineRuns(line.replace(/^##\s+/, "")), heading: HeadingLevel.HEADING_2 }));
    } else if (/^#\s+/.test(line)) {
      children.push(new Paragraph({ children: inlineRuns(line.replace(/^#\s+/, "")), heading: HeadingLevel.HEADING_1 }));
    } else if (/^[-*]\s+/.test(line)) {
      children.push(new Paragraph({ children: inlineRuns(line.replace(/^[-*]\s+/, "")), bullet: { level: 0 } }));
    } else if (/^\d+[.)]\s+/.test(line)) {
      children.push(new Paragraph({ children: inlineRuns(line.replace(/^\d+[.)]\s+/, "")), numbering: { reference: "jarvis-numbering", level: 0 } }));
    } else {
      children.push(new Paragraph({ children: inlineRuns(line), spacing: { after: 120 } }));
    }
  }
  const document = new Document({
    numbering: { config: [{ reference: "jarvis-numbering", levels: [{ level: 0, format: "decimal", text: "%1.", alignment: "left" }] }] },
    sections: [{ properties: {}, children }],
    creator: "J.A.R.V.I.S.",
    title: title.trim(),
    description: "Created by J.A.R.V.I.S.",
  });
  return Buffer.from(await Packer.toBuffer(document));
}

function decodeXml(value: string) {
  return value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

export async function extractWordText(bytes: Buffer) {
  if (!bytes.length || bytes.length > MAX_WORD_BYTES) throw new Error("The Word document must be smaller than 10 MB.");
  const zip = await JSZip.loadAsync(bytes);
  const document = zip.file("word/document.xml");
  if (!document) throw new Error("This file is not a readable Word document.");
  const xml = await document.async("string");
  const paragraphs = [...xml.matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g)].map(match => {
    const text = [...match[1].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(part => decodeXml(part[1])).join("");
    return text.trimEnd();
  });
  return paragraphs.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
