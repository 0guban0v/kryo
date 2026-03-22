# Installation

## Local Bootstrap Flow

The normal local setup is a single convergent step:

```sh
cp .env.example yourname.env
make deploy ENV_FILE=yourname.env
```

`make deploy` runs the idempotent `make bootstrap` step first, then starts `mcp`.
The Makefile intentionally defaults `ENV_FILE` to a placeholder so Compose-backed targets fail fast until you pick a real local env file name and pass `ENV_FILE=...`.

If you only want to seed the dependent services and the selected env file without starting `mcp`:

```sh
make bootstrap ENV_FILE=yourname.env
```

If you also want the observability profile:

```sh
make deploy-all
```

## What The Bootstrap Does

`make bootstrap`:

- ensures `fizzy`, `campfire`, and `gitea` are running
- creates or reuses a local Fizzy identity, account, and write token
- creates or reuses a local Campfire administrator, room, and bot
- creates or reuses a local Gitea administrator, a dedicated `kryo-service` user, a service token, and a bootstrap repo
- updates the selected env file with:
  - `FIZZY_ACCOUNT_ID`
  - `FIZZY_API_TOKEN`
  - `CAMPFIRE_ROOM_ID`
  - `CAMPFIRE_BOT_KEY`
  - `GIT_FORGE_API_URL`
  - `GIT_FORGE_TOKEN`
  - `GIT_FORGE_REPO`

It is idempotent with respect to the selected env file: if those values are already present, it leaves them untouched and reuses them.

Defaults for Fizzy:

- account name: `Demo Platform`
- owner name: `Fizzy Admin`
- owner email: `fizzy-admin@demo.local`
- token description: `demo-platform`
- token permission: `write`

Fizzy does not support password login in this local stack. Sign in with the bootstrap email and use the development magic-link flow.
If you are using VSCodium Simple Browser or another browser without network inspection, run:

```sh
make fizzy-login-code
```

Override the target email when needed:

```sh
make fizzy-login-code EMAIL=someone@example.com
```

Defaults for Campfire:

- administrator: `Platform Admin`
- administrator email: `campfire-admin@demo.local`
- administrator password: `campfire-admin`
- room: `platform-ops`
- bot: `Kryo`

Defaults for Gitea:

- root URL: `http://localhost:3007`
- administrator username: `gitea-admin`
- administrator password: `gitea-admin`
- service user: `kryo-service`
- service user password: `kryo-service`
- bootstrap repo: `target-service`

By default, Kryo locks git-forge edits to the bootstrapped repo by setting `GIT_FORGE_ALLOW_REPO_OVERRIDE=false`.
Set it to `true` only if you intentionally want one Kryo instance to operate on multiple repos.

Override them when needed:

```sh
make bootstrap \
  ENV_FILE=.env.local \
  BOOTSTRAP_FIZZY_ACCOUNT_NAME='Mission Systems' \
  BOOTSTRAP_FIZZY_OWNER_NAME='Mission Admin' \
  BOOTSTRAP_FIZZY_OWNER_EMAIL='mission-admin@example.local' \
  BOOTSTRAP_CAMPFIRE_ROOM_NAME='mission-ops' \
  BOOTSTRAP_CAMPFIRE_BOT_NAME='Kryo Mission Control' \
  BOOTSTRAP_GITEA_REPO_NAME='mission-control'
```

## Useful Make Targets

- `make bootstrap`
- `make bootstrap-fizzy`
- `make bootstrap-campfire`
- `make bootstrap-gitea`
- `make deploy`
- `make deploy-all`
- `make up`
- `make down`
- `make ps`
- `make logs SERVICE=mcp`
- `make test-offline`
- `make test-online`
- `make lint`
- `make format`
- `make deadcode`
- `make quality`

`make test-online` runs the standalone MCP HTTP end-to-end suite against a live server.
It uses `MCP_E2E_URL`, which defaults to `http://127.0.0.1:3100/mcp`.
`make deadcode` runs `knip`.
`make quality` runs `format:check`, `lint`, and `deadcode` in one step.

## Access Points

- MCP HTTP: `http://localhost:3100/mcp`
- `mcp` health: `http://localhost:3100/up`
- Campfire bot webhook: `http://localhost:3100/campfire/webhook`
- Fizzy: `http://localhost:3006`
- Campfire: `http://localhost:3000`
- Gitea: `http://localhost:3007`

If you expose `kryo` on a non-local hostname, set `MCP_ALLOWED_HOSTS` to the ingress or proxy hostnames that should be accepted by the HTTP listener.
If you use stateful HTTP sessions, tune `MCP_SESSION_IDLE_TTL_MS` and `MCP_MAX_SESSIONS` for your expected client count and reconnect behavior.
