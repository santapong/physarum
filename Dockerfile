# Stage 1: build & verify static bundle
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG BASE_PATH=/
ENV BASE_PATH=$BASE_PATH \
    GOMAXPROCS=1 \
    UV_THREADPOOL_SIZE=1
RUN npx vitest run --poolOptions.forks.singleFork && npm run build

# Stage 2: minimal unprivileged nginx runtime
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
COPY --chmod=0644 nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null 2>&1 || exit 1
