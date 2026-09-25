FROM node:20-alpine AS client-build

WORKDIR /build/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM node:20-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY server/package*.json ./server/
RUN npm ci --omit=dev --prefix server
COPY server/ ./server/
COPY server/global-bundle.pem ./global-bundle.pem
COPY --from=client-build /build/client/dist ./client/dist

RUN mkdir -p /app/server/uploads /app/server/backups /app/server/data

EXPOSE 5001
CMD ["node", "server/index.js"]
