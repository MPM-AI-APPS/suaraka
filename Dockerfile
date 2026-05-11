# ---------- Build stage ----------
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm@9 && pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

# ---------- Production stage ----------
FROM node:22-alpine

WORKDIR /app

RUN apk update && apk add --no-cache ca-certificates && update-ca-certificates

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
