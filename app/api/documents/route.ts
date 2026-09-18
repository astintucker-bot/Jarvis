import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { NextRequest, NextResponse } from "next/server";
import { extractWordText } from "../../../lib/wordDocuments";

export const runtime = "nodejs";
const run = promisify(execFile);
const maxBytes = 10 * 1024 * 1024;

const decode = (bytes: Buffer) => {
  for (const encoding of ["utf-8", "utf-16le", "latin1"] as const) {
    try { return new TextDecoder(encoding, { fatal: true }).decode(bytes); } catch { /* Try the next encoding. */ }
  }
  return new TextDecoder().decode(bytes);
};
const cleanXml = (value: string) => value.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, "\"").replace(/\s+/g, " ").trim();

async function extract(name: string, bytes: Buffer) {
  const suffix = name.slice(name.lastIndexOf(".")).toLowerCase();
  if ([".txt", ".md", ".csv", ".json"].includes(suffix)) return decode(bytes);
  const folder = await mkdtemp(join(tmpdir(), "jarvis-document-"));
  const source = join(folder, `upload${suffix}`);
  try {
    await writeFile(source, bytes);
    if (suffix === ".docx") return extractWordText(bytes);
    if (suffix === ".xlsx") {
      const files = (await run("unzip", ["-Z1", source], { encoding: "utf8", timeout: 15_000 })).stdout.split("\n");
      const sharedXml = files.includes("xl/sharedStrings.xml") ? (await run("unzip", ["-p", source, "xl/sharedStrings.xml"], { encoding: "utf8" })).stdout : "";
      const shared = [...sharedXml.matchAll(/<si[^>]*>([\s\S]*?)<\/si>/g)].map(match => cleanXml(match[1]));
      const sheets = files.filter(file => /^xl\/worksheets\/sheet\d+\.xml$/.test(file));
      const output: string[] = [];
      for (const sheet of sheets) {
        const xml = (await run("unzip", ["-p", source, sheet], { encoding: "utf8", timeout: 15_000 })).stdout;
        for (const row of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
          const cells = [...row[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)].map(cell => {
            const value = cell[2].match(/<v>([\s\S]*?)<\/v>/)?.[1] || "";
            return /t="s"/.test(cell[1]) ? shared[Number(value)] || "" : cleanXml(value);
          });
          if (cells.length) output.push(cells.join(" | "));
        }
      }
      return output.join("\n");
    }
    if (suffix === ".pdf") {
      const output = join(folder, "output.txt");
      await run("pdftotext", ["-layout", source, output], { timeout: 20_000 });
      return decode(await readFile(output));
    }
    throw new Error("Supported files are PDF, DOCX, TXT, MD, CSV, JSON, and XLSX.");
  } finally { await rm(folder, { recursive: true, force: true }); }
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const file = form.get("document");
  if (!(file instanceof File) || !file.name || file.size === 0 || file.size > maxBytes) return NextResponse.json({ error: "Choose a supported file smaller than 10 MB." }, { status: 400 });
  if (!/^[\w. ()-]{1,180}$/.test(file.name)) return NextResponse.json({ error: "Invalid filename." }, { status: 400 });
  try {
    const text = (await extract(file.name, Buffer.from(await file.arrayBuffer()))).replace(/\u0000/g, "").trim().slice(0, 30_000);
    if (!text) throw new Error("JARVIS could not find readable text in that document.");
    return NextResponse.json({ name: file.name, text });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "JARVIS could not read that file." }, { status: 422 }); }
}
