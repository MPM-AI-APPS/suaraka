import pdfParse from "pdf-parse";

export interface ExtractedBook {
  text: string;
  pageCount: number;
  wordCount: number;
  pages: ExtractedPage[];
}

export interface ExtractedPage {
  index: number;
  pageNumber: number;
  text: string;
  wordCount: number;
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export async function extractPdf(buffer: Buffer): Promise<ExtractedBook> {
  const parsed = await pdfParse(buffer);
  const raw = (parsed.text || "").replace(/\r\n/g, "\n");
  const pageCount = parsed.numpages || 0;

  // pdf-parse concatenates all pages; we re-parse to get per-page text.
  // It uses a custom pagerender callback to split by page.
  const pageTexts: string[] = [];
  await pdfParse(buffer, {
    pagerender(pageData: { getTextContent: () => Promise<{ items: { str: string }[] }> }) {
      return pageData.getTextContent().then((content) => {
        const text = content.items.map((item) => item.str).join(" ");
        pageTexts.push(text);
        return text;
      });
    },
  });

  const pages: ExtractedPage[] = [];
  for (let i = 0; i < pageTexts.length; i++) {
    const text = pageTexts[i].trim();
    if (!text) continue;
    pages.push({
      index: pages.length,
      pageNumber: i + 1,
      text,
      wordCount: wordCount(text),
    });
  }

  // Fallback if pagerender produced nothing (shouldn't happen, but just in case)
  if (pages.length === 0 && raw.trim()) {
    pages.push({
      index: 0,
      pageNumber: 1,
      text: raw.trim(),
      wordCount: wordCount(raw),
    });
  }

  return {
    text: raw,
    pageCount,
    wordCount: wordCount(raw),
    pages,
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
