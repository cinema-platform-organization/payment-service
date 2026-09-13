FROM node:22.19.0 AS builder

ARG DATABASE_URI
ENV DATABASE_URI=$DATABASE_URI

RUN npm install -g pnpm@10.27.0

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile --config.minimum-release-age=0

COPY . .

RUN pnpm prisma generate

RUN pnpm build


FROM node:22.19.0 AS runner

RUN npm install -g pnpm@10.27.0

WORKDIR /app

ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml prisma.config.ts ./

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

CMD ["node", "dist/src/main"]