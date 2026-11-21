FROM node:20-alpine AS base

# Install pnpm and dependencies
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

# Copy repo configuration files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/contract/package.json ./packages/contract/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY packages/contract ./packages/contract
COPY apps/api ./apps/api
COPY apps/web ./apps/web

# Build frontend static bundle
RUN pnpm --filter @club/web build

# Expose default port
EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

# Start unified API + Web server
CMD ["pnpm", "start"]
