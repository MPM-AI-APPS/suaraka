import pdfParse from "pdf-parse";

export interface ExtractedBook {
  text: string;
  pageCount: number;
  wordCount: number;
  chapters: ExtractedChapter[];
}

export interface ExtractedChapter {
  index: number;
  title: string;
  startPage?: number;
  endPage?: number;
  text: string;
  wordCount: number;
}

/** Chapter heading heuristic. Detects lines like:
 *   "Chapter 3", "CHAPTER III. THE OPEN SEA", "Bab 5", "Bagian II — ...",
 *   or "1. Introduction", "I. Pendahuluan".
 */
const CHAPTER_RE =
  /^\s*(?:(?:chapter|bab|bagian|part|section)\s+[ivxlcdm0-9]+|[ivxlcdm]{1,5}\.|\d{1,3}\.)\b.*$/i;

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export async function extractPdf(buffer: Buffer): Promise<ExtractedBook> {
  const parsed = await pdfParse(buffer);
  const raw = (parsed.text || "").replace(/\r\n/g, "\n");
  const pageCount = parsed.numpages || 0;

  const lines = raw.split("\n").map((l) => l.trim());

  // Detect chapter boundaries.
  const boundaries: { line: number; title: string }[] = [];
  lines.forEach((line, i) => {
    if (!line) return;
    if (line.length > 120) return;
    if (CHAPTER_RE.test(line)) {
      boundaries.push({ line: i, title: line.replace(/\s+/g, " ").trim() });
    }
  });

  const chapters: ExtractedChapter[] = [];
  if (boundaries.length >= 2) {
    for (let c = 0; c < boundaries.length; c++) {
      const start = boundaries[c].line;
      const end = c + 1 < boundaries.length ? boundaries[c + 1].line : lines.length;
      const body = lines.slice(start + 1, end).join("\n").trim();
      if (!body) continue;
      chapters.push({
        index: c,
        title: boundaries[c].title,
        text: body,
        wordCount: wordCount(body),
      });
    }
  }

  // Fallback: no chapters detected → split by roughly ~2000 word segments so TTS
  // stays responsive and the listener gets navigable pieces.
  if (chapters.length === 0) {
    const words = raw.split(/\s+/).filter(Boolean);
    const SEG = 2000;
    for (let i = 0, idx = 0; i < words.length; i += SEG, idx++) {
      const text = words.slice(i, i + SEG).join(" ").trim();
      if (!text) continue;
      chapters.push({
        index: idx,
        title: `Section ${idx + 1}`,
        text,
        wordCount: wordCount(text),
      });
    }
  }

  return {
    text: raw,
    pageCount,
    wordCount: wordCount(raw),
    chapters,
  };
}

/** Very rough title/author guesser from the first non-empty lines. */
export function guessMeta(text: string): { title?: string; author?: string } {
  const firstLines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 20);
  const title = firstLines.find((l) => l.length >= 3 && l.length <= 120);
  const authorLine = firstLines.find((l) => /^(by|oleh)\s+/i.test(l));
  const author = authorLine?.replace(/^(by|oleh)\s+/i, "").trim();
  return { title, author };
}
