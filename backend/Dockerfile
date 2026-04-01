# ============================================================
# Multi-stage build : permet de séparer l'environnement de build
# (avec devDependencies et outils de test) de l'image de production.
# Avantages : image finale plus légère (~5x), surface d'attaque réduite
# (pas de devDependencies ni de code de test en production),
# et meilleure sécurité car seuls les fichiers nécessaires sont copiés.
# ============================================================

# Stage 1 — Test & Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm test

# Stage 2 — Production
FROM node:20-alpine AS production
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=builder /app/package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/server.js .
USER appuser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1
CMD ["node", "server.js"]
