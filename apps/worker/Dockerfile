FROM node:20-bookworm-slim
WORKDIR /app
COPY package.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/worker/package.json apps/worker/package.json
RUN npm install --omit=dev --workspace=apps/worker --no-audit --no-fund
COPY packages/shared packages/shared
COPY apps/worker apps/worker
ENV NODE_ENV=production
# Runs as root only so it can talk to the Docker socket; submissions never run in this container.
CMD ["node", "apps/worker/src/index.js"]
