FROM node:22-alpine AS deps
WORKDIR /workspace

COPY package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY examples/demo-service/package.json ./examples/demo-service/package.json
RUN corepack enable && pnpm install --filter kryo-demo-service... --frozen-lockfile

FROM deps AS build
WORKDIR /workspace

COPY examples/demo-service/tsconfig.json ./examples/demo-service/tsconfig.json
COPY examples/demo-service/src ./examples/demo-service/src
COPY examples/demo-service/tests ./examples/demo-service/tests
RUN pnpm --filter kryo-demo-service run build

FROM node:22-alpine AS runtime
WORKDIR /workspace/examples/demo-service

ENV NODE_ENV=production
ENV PORT=4000

COPY --from=deps /workspace/package.json /workspace/package.json
COPY --from=deps /workspace/pnpm-lock.yaml /workspace/pnpm-lock.yaml
COPY --from=deps /workspace/pnpm-workspace.yaml /workspace/pnpm-workspace.yaml
COPY --from=deps /workspace/node_modules /workspace/node_modules
COPY --from=deps /workspace/examples/demo-service/package.json ./package.json
COPY --from=deps /workspace/examples/demo-service/node_modules ./node_modules
COPY --from=build /workspace/examples/demo-service/build ./build

EXPOSE 4000

CMD ["node", "build/src/index.js"]
