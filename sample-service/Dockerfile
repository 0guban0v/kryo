FROM node:22-alpine AS deps
WORKDIR /workspace

COPY package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY sample-service/package.json ./sample-service/package.json
RUN corepack enable && pnpm install --filter mission-control-sample-service... --frozen-lockfile

FROM deps AS build
WORKDIR /workspace

COPY sample-service/tsconfig.json ./sample-service/tsconfig.json
COPY sample-service/src ./sample-service/src
COPY sample-service/tests ./sample-service/tests
RUN pnpm --filter mission-control-sample-service run build

FROM node:22-alpine AS runtime
WORKDIR /workspace/sample-service

ENV NODE_ENV=production
ENV PORT=4000

COPY --from=deps /workspace/package.json /workspace/package.json
COPY --from=deps /workspace/pnpm-lock.yaml /workspace/pnpm-lock.yaml
COPY --from=deps /workspace/pnpm-workspace.yaml /workspace/pnpm-workspace.yaml
COPY --from=deps /workspace/node_modules /workspace/node_modules
COPY --from=deps /workspace/sample-service/package.json ./package.json
COPY --from=deps /workspace/sample-service/node_modules ./node_modules
COPY --from=build /workspace/sample-service/build ./build

EXPOSE 4000

CMD ["node", "build/src/index.js"]
