FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
COPY hawk.ts ./hawk.ts
COPY src ./src
COPY scripts ./scripts

RUN npm ci && npm run build

FROM node:24-alpine AS runtime

ENV NODE_ENV=production \
    HAWK_MCP_TRANSPORT=httpStream \
    HAWK_MCP_HOST=0.0.0.0 \
    HAWK_MCP_PORT=3000 \
    HAWK_MCP_ENDPOINT=/mcp \
    HAWK_MCP_SESSION_STORE_PATH=/data/session.json

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

RUN mkdir -p /data && chown -R node:node /app /data

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/hawk.js"]
