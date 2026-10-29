FROM node:24-bookworm-slim AS base

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global pnpm@11.25.0

WORKDIR /app

FROM base AS build

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json tsconfig.build.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src
COPY data ./data

RUN pnpm build && pnpm prune --prod

FROM base AS runtime

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build --chown=node:node /app/package.json /app/pnpm-lock.yaml ./
COPY --from=build --chown=node:node /app/pnpm-workspace.yaml ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/prisma.config.ts ./
COPY --from=build --chown=node:node /app/data ./data

USER node
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

# Runtime uses only the installed CLI: pnpm may attempt to reconcile dependencies
# against host-injected configuration, which must not modify the production image.
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node dist/prisma/seed.js && exec node dist/src/main.js"]
