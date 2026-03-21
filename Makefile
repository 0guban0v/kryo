.PHONY: install build test lint format sample-test sample-test-demo up

install:
	pnpm install --no-frozen-lockfile

build:
	pnpm run build
	pnpm run sample-service:build

test:
	pnpm test
	pnpm run sample-service:test

lint:
	pnpm run lint

format:
	pnpm run format

sample-test:
	pnpm run sample-service:test

sample-test-demo:
	pnpm run sample-service:test:demo

up:
	docker compose up --build
