FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server.js ./
COPY public ./public

EXPOSE 3001

RUN addgroup -g 1001 -S nodejs \
    && adduser -S nodeapp -u 1001

RUN chown -R nodeapp:nodejs /app
USER nodeapp

CMD ["node", "server.js"]
