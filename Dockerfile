FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY sample-service/package.json ./sample-service/package.json
RUN corepack enable && pnpm install --frozen-lockfile

FROM deps AS build
WORKDIR /app

COPY tsconfig.json ./
COPY src ./src
COPY tests ./tests
RUN pnpm run build && pnpm prune --prod

FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV MCP_HOST=0.0.0.0

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build

EXPOSE 3100

CMD ["node", "build/src/index.js"]
