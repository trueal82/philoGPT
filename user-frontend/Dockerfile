# Stage 1: Build the Vite app
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Production server
FROM node:20-alpine AS production

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server.js ./
COPY --from=builder /app/dist ./dist

EXPOSE 3002

RUN addgroup -g 1001 -S nodejs \
    && adduser -S nodeapp -u 1001

RUN chown -R nodeapp:nodejs /app
USER nodeapp

CMD ["node", "server.js"]
