import { ChatOpenAI } from "@langchain/openai";

export function getLlm() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");
  return new ChatOpenAI({
    apiKey,
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0.2,
    configuration: {
        baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    }
  });
}

/** Summarize a single page's content. */
export async function summarizePage(text: string, language: "en" | "id") {
  const llm = getLlm();
  const instruction =
    language === "id"
      ? "Ringkas halaman berikut dalam 3-5 kalimat jelas, lalu berikan poin kunci (key takeaways) dan kosa kata penting beserta definisinya. Balas dalam JSON dengan kunci: summary (string), takeaways (string[]), vocabulary ({term, definition}[])."
      : "Summarize the following page in 3-5 clear sentences, then give key takeaways and important vocabulary terms with short definitions. Reply in JSON with keys: summary (string), takeaways (string[]), vocabulary ({term, definition}[]).";

  const res = await llm.invoke([
    { role: "system", content: instruction },
    { role: "user", content: text.slice(0, 16000) },
  ]);
  const content = typeof res.content === "string" ? res.content : JSON.stringify(res.content);
  try {
    return JSON.parse(content.replace(/^```json\s*|\s*```$/g, ""));
  } catch {
    return { summary: content, takeaways: [], vocabulary: [] };
  }
}

/** Reformat raw PDF-extracted text into clean, readable paragraphs. */
export async function reformatPageText(text: string, language: "en" | "id") {
  const llm = getLlm();
  const instruction =
    language === "id"
      ? `Kamu adalah editor teks. Teks berikut diekstrak dari PDF dan mungkin memiliki masalah seperti:
- Baris putus di tengah kalimat akibat layout PDF
- Kata yang terpotong dengan tanda hubung di akhir baris (mis. "se- suatu")
- Header/footer halaman yang ikut terbaca
- Spasi dan paragraf yang tidak teratur

Tugasmu: bersihkan dan format ulang teks menjadi paragraf-paragraf yang nyaman dibaca.
Jangan ubah isi atau artinya. Jangan tambahkan kata. Balas HANYA dengan teks yang sudah diformat, tanpa penjelasan.`
      : `You are a text editor. The following text was extracted from a PDF and may have issues such as:
- Line breaks in the middle of sentences due to PDF layout
- Hyphenated words split across lines (e.g. "some- thing" → "something")
- Page headers/footers mixed into the body
- Irregular spacing and paragraph breaks

Your task: clean up and reformat the text into well-structured, comfortable-to-read paragraphs.
Do not change the content or meaning. Do not add words. Reply ONLY with the reformatted text, no explanations.`;

  const res = await llm.invoke([
    { role: "system", content: instruction },
    { role: "user", content: text.slice(0, 16000) },
  ]);
  return typeof res.content === "string" ? res.content : JSON.stringify(res.content);
}

/** Detect language and translate text. */
export async function translateText(text: string, targetLanguage: "en" | "id") {
  const llm = getLlm();
  const targetLabel = targetLanguage === "id" ? "Indonesian" : "English";
  const instruction = `You are a translator. Detect the language of the given text and translate it to ${targetLabel}. If it's already in ${targetLabel}, return the original text. Reply ONLY with the translated text, nothing else.`;
  const res = await llm.invoke([
    { role: "system", content: instruction },
    { role: "user", content: text.slice(0, 16000) },
  ]);
  return typeof res.content === "string" ? res.content : JSON.stringify(res.content);
}

/** Answer a question grounded in a book's text. */
export async function askBook(question: string, bookText: string, language: "en" | "id") {
  const llm = getLlm();
  const sys =
    language === "id"
      ? "Kamu adalah asisten baca yang menjawab pertanyaan hanya berdasarkan teks buku yang diberikan. Jika jawaban tidak ada, katakan dengan jujur."
      : "You are a reading assistant that answers strictly based on the provided book text. If the answer is not present, say so honestly.";
  // Naive context window — a real impl would RAG over chunks.
  const context = bookText.slice(0, 24000);
  const res = await llm.invoke([
    { role: "system", content: sys },
    { role: "user", content: `BOOK:\n${context}\n\nQUESTION: ${question}` },
  ]);
  return typeof res.content === "string" ? res.content : JSON.stringify(res.content);
}
