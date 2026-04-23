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

export interface ChapterSummary {
  id: string;
  index: number;
  title: string;
  wordCount: number;
  audioStatus: "idle" | "generating" | "ready" | "failed";
  audioDurationSec?: number | null;
  audioUrl?: string | null;
}

export interface VoiceItem {
  name: string;
  language?: string;
}

export interface GenerateChapterOptions {
  voice: string;
  exaggeration?: number;
  cfgWeight?: number;
  temperature?: number;
}

export const api = {
  async listBooks(): Promise<{ books: BookSummary[] }> {
    const { data } = await http.get("/books");
    return data;
  },
  async getBook(id: string): Promise<{ book: BookSummary; chapters: ChapterSummary[] }> {
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
  async listVoices(): Promise<VoiceItem[]> {
    const { data } = await http.get("/voices");
    return data as VoiceItem[];
  },
  async generateChapter(
    bookId: string,
    chapterId: string,
    opts: GenerateChapterOptions
  ) {
    const { data } = await http.post(`/books/${bookId}/chapters/${chapterId}/tts`, opts);
    return data as { audioUrl: string; durationSec?: number };
  },
  async summarizeChapter(bookId: string, chapterId: string, locale: "en" | "id") {
    const { data } = await http.post(`/books/${bookId}/chapters/${chapterId}/summary`, { locale });
    return data as { summary: string; takeaways: string[]; vocabulary: { term: string; definition: string }[] };
  },
  async askBook(bookId: string, question: string, locale: "en" | "id") {
    const { data } = await http.post(`/books/${bookId}/ask`, { question, locale });
    return data as { answer: string };
  },
  async saveProgress(bookId: string, chapterId: string, positionSec: number) {
    await http.post(`/books/${bookId}/progress`, { chapterId, positionSec });
  },
};

