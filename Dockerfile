FROM node:22-bookworm-slim AS build

WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates libatomic1 libgcc-s1 libstdc++6 \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4173
ENV QVAC_MODEL=LLAMA_3_2_1B_INST_Q4_0
ENV MAX_DOCUMENT_SIZE_BYTES=10485760

WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates libatomic1 libgcc-s1 libstdc++6 \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/data ./data
COPY --from=build /app/public ./public
COPY --from=build /app/docs/model-manifest.json ./docs/model-manifest.json

RUN mkdir -p /app/.qvac
VOLUME ["/app/.qvac"]
EXPOSE 4173
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 CMD node -e "fetch('http://127.0.0.1:4173/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/server.js"]
