# ---- Build stage ----
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src ./src

RUN npm run build

# ---- Production stage ----
FROM node:20-alpine AS production

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

EXPOSE 5001

RUN addgroup -g 1001 -S nodejs \
    && adduser -S nodeapp -u 1001

RUN chown -R nodeapp:nodejs /app
USER nodeapp

CMD ["node", "dist/server.js"]
