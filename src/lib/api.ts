import axios from "axios";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const http = axios.create({
  baseURL: `${basePath}/api`,
  headers: { "Content-Type": "application/json" },
});

export interface BookSummary {
  id: string;
  title: string;
  author?: string | null;
  language: "en" | "id";
  pageCount: number;
  wordCount: number;
  status: "processing" | "ready" | "failed";
  isFavorite: boolean;
  coverUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PageSummary {
  id: string;
  index: number;
  pageNumber: number;
  text: string;
  wordCount: number;
  audioStatus: "idle" | "generating" | "ready" | "failed";
  audioDurationSec?: number | null;
  audioVoice?: string | null;
  audioVoiceLang?: "en" | "id" | null;
  audioUrl?: string | null;
}

export interface VoiceItem {
  name: string;
  gender?: string;
  locale?: string;
  language?: string;
}

export interface GeneratePageOptions {
  voice: string;
  rate?: string;
  pitch?: string;
  volume?: string;
}

export const api = {
  async listBooks(): Promise<{ books: BookSummary[] }> {
    const { data } = await http.get("/books");
    return data;
  },
  async getBook(id: string): Promise<{ book: BookSummary; pages: PageSummary[] }> {
    const { data } = await http.get(`/books/${id}`);
    return data;
  },
  async deleteBook(id: string) {
    await http.delete(`/books/${id}`);
  },
  async updateBook(id: string, patch: Partial<Pick<BookSummary, "title" | "isFavorite">>) {
    const { data } = await http.patch(`/books/${id}`, patch);
    return data;
  },
  async listVoices(language?: string): Promise<VoiceItem[]> {
    const params = new URLSearchParams();
    if (language) params.set("language", language);
    const qs = params.toString();
    const { data } = await http.get(`/voices${qs ? `?${qs}` : ""}`);
    return data as VoiceItem[];
  },
  async generatePage(
    bookId: string,
    pageId: string,
    opts: GeneratePageOptions
  ) {
    const { data } = await http.post(`/books/${bookId}/pages/${pageId}/tts`, opts);
    return data as { audioUrl: string; durationSec?: number };
  },
  async summarizePage(bookId: string, pageId: string, locale: "en" | "id") {
    const { data } = await http.post(`/books/${bookId}/pages/${pageId}/summary`, { locale });
    return data as { summary: string; takeaways: string[]; vocabulary: { term: string; definition: string }[] };
  },
  async askBook(bookId: string, question: string, locale: "en" | "id") {
    const { data } = await http.post(`/books/${bookId}/ask`, { question, locale });
    return data as { answer: string };
  },
  async reformatPage(bookId: string, pageId: string) {
    const { data } = await http.post(`/books/${bookId}/pages/${pageId}/reformat`);
    return data as { reformatted: string };
  },
  async translatePage(bookId: string, pageId: string, target: "en" | "id") {
    const { data } = await http.post(`/books/${bookId}/pages/${pageId}/translate`, { target });
    return data as { translated: string; target: string };
  },
  async saveProgress(bookId: string, pageId: string, positionSec: number) {
    await http.post(`/books/${bookId}/progress`, { pageId, positionSec });
  },
};

