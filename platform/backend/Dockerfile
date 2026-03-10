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
ENV PORT=4000
EXPOSE 4000

CMD ["node", "dist/main.js"]
