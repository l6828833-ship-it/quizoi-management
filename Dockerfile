# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Expo embeds EXPO_PUBLIC_* values in the browser bundle at build time.
# Set non-secret values with Fly build arguments; do not put JWT_SECRET or DATABASE_URL here.
ARG VITE_APP_ID=""
ARG VITE_OAUTH_PORTAL_URL=""
ARG OAUTH_SERVER_URL=""
ARG OWNER_OPEN_ID=""
ARG OWNER_NAME=""
ARG EXPO_PUBLIC_API_BASE_URL=""
ARG SUPABASE_URL=""
ARG SUPABASE_PUBLISHABLE_KEY=""
ARG QUIZIO_OWNER_EMAIL=""
ENV NODE_ENV=production \
    VITE_APP_ID=${VITE_APP_ID} \
    VITE_OAUTH_PORTAL_URL=${VITE_OAUTH_PORTAL_URL} \
    OAUTH_SERVER_URL=${OAUTH_SERVER_URL} \
    OWNER_OPEN_ID=${OWNER_OPEN_ID} \
    OWNER_NAME=${OWNER_NAME} \
    EXPO_PUBLIC_API_BASE_URL=${EXPO_PUBLIC_API_BASE_URL} \
    SUPABASE_URL=${SUPABASE_URL} \
    SUPABASE_PUBLISHABLE_KEY=${SUPABASE_PUBLISHABLE_KEY} \
    QUIZIO_OWNER_EMAIL=${QUIZIO_OWNER_EMAIL}

RUN pnpm build

FROM node:22-bookworm-slim AS production

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

COPY --from=build /app/dist ./dist
COPY --from=build /app/web-dist ./web-dist

ENV NODE_ENV=production \
    PORT=8080

EXPOSE 8080
CMD ["node", "dist/index.js"]
