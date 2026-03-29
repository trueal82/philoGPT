FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci && npm cache clean --force

COPY . .
RUN npm run build

# --- Production stage ---
FROM node:20-alpine

WORKDIR /app

COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/server.js ./

EXPOSE 3001

RUN addgroup -g 1001 -S nodejs \
    && adduser -S nodeapp -u 1001

RUN chown -R nodeapp:nodejs /app
USER nodeapp

CMD ["node", "server.js"]
