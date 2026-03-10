FROM node:20-slim

# Build tools for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@9

WORKDIR /app

# Copy package manifest first for better layer caching
COPY package.json ./
RUN pnpm install

# Copy source and build
COPY nest-cli.json tsconfig.json ./
COPY src ./src
RUN pnpm exec nest build

ENV NODE_ENV=production
# HF Spaces uses 7860; Render/local use 4000 — always driven by $PORT env var
ENV PORT=7860
EXPOSE 7860

CMD ["node", "dist/main.js"]
