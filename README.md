# Suaraka

> **Your Library, Now in Voice.**

Suaraka is a modern AI audiobook platform. Upload any PDF — textbook, article, module, research paper — and instantly convert it into a natural, high-quality audiobook with [Chatterbox TTS](https://github.com/resemble-ai/chatterbox). Listen, read along karaoke-style, ask questions, and summarize chapters.

## Features

- **Keycloak SSO** personal library synced across devices
- **Smart PDF processing** — text extraction, chapter detection, reading order
- **Chatterbox TTS** — natural narration, multiple voices, adjustable speed
- **Reading + Listening** — split-screen, word-level highlight (karaoke)
- **Productivity** — chapter summaries, notes, key takeaways, vocabulary
- **AI Q&A** — ask anything about your library
- **Multi-language** — English & Bahasa Indonesia first-class
- **Mobile-first, minimal, calm** UI

## Tech Stack

- Next.js 16 (App Router) · React 19 · TypeScript
- Tailwind v4 + shadcn/ui · Lucide icons
- Auth.js v5 (next-auth) + Keycloak provider
- Drizzle ORM + PostgreSQL
- `pdf-parse` for extraction
- Chatterbox TTS service (HTTP) for narration
- LangChain + OpenAI-compatible LLM for Q&A/summaries

## Getting Started

```bash
cp .env.example .env.local
# fill KEYCLOAK_*, DATABASE_URL, CHATTERBOX_BASE_URL, OPENAI_API_KEY

pnpm install
pnpm db:push
pnpm dev
```

Open <http://localhost:3000>.

### Run dependencies with Docker

```bash
docker compose up db keycloak
```

Then configure a Keycloak realm `suaraka` with a confidential client
`suaraka-web` and redirect URI `http://localhost:3000/api/auth/callback/keycloak`.

## Project Layout

```
src/
  app/
    api/            # REST endpoints
    library/        # user library + reader/player
    upload/         # PDF upload
    login/          # Keycloak sign-in
  components/       # UI + domain components
  db/               # Drizzle schema + client
  lib/              # pdf, chatterbox, storage, llm, utils
```

## License

Proprietary — internal R&D.
