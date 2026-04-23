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

/** Summarize a single chapter. */
export async function summarizeChapter(text: string, language: "en" | "id") {
  const llm = getLlm();
  const instruction =
    language === "id"
      ? "Ringkas bab berikut dalam 5-7 kalimat jelas, lalu berikan 5 poin kunci (key takeaways) dan 5 kosa kata penting beserta definisinya. Balas dalam JSON dengan kunci: summary (string), takeaways (string[]), vocabulary ({term, definition}[])."
      : "Summarize the following chapter in 5-7 clear sentences, then give 5 key takeaways and 5 important vocabulary terms with short definitions. Reply in JSON with keys: summary (string), takeaways (string[]), vocabulary ({term, definition}[]).";

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
