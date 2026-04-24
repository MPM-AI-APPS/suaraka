import {
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** User profile (mirrored from Keycloak on first login). */
export const users = pgTable("suaraka_users", {
  id: text("id").primaryKey(), // Keycloak sub
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  plan: text("plan").notNull().default("free"), // free | premium
  preferredLocale: text("preferred_locale").notNull().default("en"),
  preferredVoice: text("preferred_voice").notNull().default("warm_female"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastActive: timestamp("last_active", { withTimezone: true }),
}, (t) => [uniqueIndex("suaraka_users_email_idx").on(t.email)]);

/** Shelves / categories a user groups books into. */
export const shelves = pgTable("suaraka_shelves", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("slate"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** A user's uploaded PDF/book. */
export const books = pgTable("suaraka_books", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  shelfId: text("shelf_id").references(() => shelves.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  author: text("author"),
  language: text("language").notNull().default("en"), // en | id
  pdfPath: text("pdf_path").notNull(), // storage-relative path
  coverPath: text("cover_path"),
  pageCount: integer("page_count").notNull().default(0),
  wordCount: integer("word_count").notNull().default(0),
  status: text("status").notNull().default("processing"), // processing | ready | failed
  isFavorite: boolean("is_favorite").notNull().default(false),
  extractedText: text("extracted_text"), // cached full plain text
  meta: jsonb("meta").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** A page extracted from a book's PDF. */
export const pages = pgTable("suaraka_pages", {
  id: text("id").primaryKey(),
  bookId: text("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
  index: integer("index").notNull(),
  pageNumber: integer("page_number").notNull(),
  text: text("text").notNull(),
  wordCount: integer("word_count").notNull().default(0),
  audioPath: text("audio_path"), // storage-relative mp3/wav
  audioDurationSec: real("audio_duration_sec"),
  audioVoice: text("audio_voice"),
  audioStatus: text("audio_status").notNull().default("idle"), // idle | generating | ready | failed
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Word-level timing for karaoke-style highlight. */
export const pageTimings = pgTable("suaraka_page_timings", {
  pageId: text("page_id").primaryKey().references(() => pages.id, { onDelete: "cascade" }),
  words: jsonb("words").$type<Array<{ w: string; s: number; e: number }>>().notNull(),
});

/** Per-user listening position + bookmarks for a book. */
export const progress = pgTable("suaraka_progress", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  bookId: text("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
  pageId: text("page_id").references(() => pages.id, { onDelete: "set null" }),
  positionSec: real("position_sec").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("suaraka_progress_user_book_idx").on(t.userId, t.bookId)]);

export const bookmarks = pgTable("suaraka_bookmarks", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  bookId: text("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
  pageId: text("page_id").references(() => pages.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  positionSec: real("position_sec").notNull().default(0),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** AI-generated page insights (summary, takeaways, vocab). */
export const insights = pgTable("suaraka_insights", {
  id: text("id").primaryKey(),
  bookId: text("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
  pageId: text("page_id").references(() => pages.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // summary | takeaways | notes | vocabulary
  content: jsonb("content").$type<unknown>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
