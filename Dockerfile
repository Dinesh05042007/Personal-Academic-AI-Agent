# Multi-stage production Dockerfile for Personal Academic AI Agent
FROM node:22-slim AS builder

WORKDIR /app

# Build Frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Setup Backend Runtime
FROM node:22-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm install --omit=dev

WORKDIR /app
COPY backend ./backend
COPY documents ./documents
COPY --from=builder /app/frontend/dist ./frontend/dist

EXPOSE 3000

CMD ["node", "backend/server.js"]
