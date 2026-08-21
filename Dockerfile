# syntax=docker/dockerfile:1
# Mandala — image de production (Coolify : Build Pack = Dockerfile, ce fichier à la racine).
# Équivalent à Dockerfile.next — ne pas utiliser Nixpacks (conflit locale « next » → « suivant »).
FROM node:22-slim AS next-build
WORKDIR /app
ARG NEXT_PUBLIC_APP_URL=http://localhost:3002
ARG NEXT_PUBLIC_API_URL=
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY=
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV USE_NODE_API=true
ENV NEXT_TELEMETRY_DISABLED=1
ENV SKIP_TYPECHECK=1
# Plafond heap : laisse de la RAM au kernel (évite OOM kill pendant « Collecting build traces »).
ENV NODE_OPTIONS=--max-old-space-size=1536
COPY next/package*.json ./next/
# Cache npm entre builds (BuildKit) — accélère npm ci quand package-lock change peu.
RUN --mount=type=cache,target=/root/.npm \
    cd next && npm ci
COPY next/ ./next/
COPY scripts/ ./scripts/
# Typecheck déjà fait en CI ; build Docker sans tsc pour gagner ~15–25 s.
RUN cd next && npm run build:docker

FROM node:22-slim
WORKDIR /app
# Attendre la fin du build avant apt-get (évite le pic RAM apt + next en parallèle sur petit VPS).
COPY --from=next-build /app/next/package.json /tmp/.build-done
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/* \
  && rm /tmp/.build-done
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=next-build /app/next/.next/standalone ./
COPY --from=next-build /app/next/.next/static ./.next/static
COPY --from=next-build /app/next/public ./public
COPY scripts/docker-entrypoint.sh /app/docker-entrypoint.sh
COPY scripts/docker-healthcheck.mjs /app/docker-healthcheck.mjs
RUN chmod +x /app/docker-entrypoint.sh
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD ["curl", "-fsS", "http://127.0.0.1:3000/api/health/live"]
CMD ["/app/docker-entrypoint.sh"]
