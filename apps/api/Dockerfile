FROM node:20-bookworm-slim
WORKDIR /app
COPY package.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
RUN npm install --omit=dev --workspace=apps/api --no-audit --no-fund
COPY packages/shared packages/shared
COPY apps/api apps/api
COPY scripts/seed.js scripts/seed.js
ENV NODE_ENV=production
EXPOSE 4000
USER node
CMD ["node", "apps/api/src/index.js"]
