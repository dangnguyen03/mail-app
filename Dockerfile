# ---------- 1. Base ----------
FROM node:20-alpine AS base
WORKDIR /app

# ---------- 2. Install dependencies ----------
FROM base AS deps
COPY package.json package-lock.json* ./

# Cài dependencies (bao gồm dev deps để build)
RUN npm ci

# ---------- 3. Build ----------
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js app
RUN npm run build

# ---------- 4. Production ----------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Chỉ copy những gì cần thiết
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

# Next.js chạy port 3000
EXPOSE 3000

# Start app
CMD ["npm", "start"]