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
make deploy-all ENV_FILE=yourname.env
```

## What The Bootstrap Does

`make bootstrap`:

- ensures `fizzy` and `gitea` are running
- creates or reuses a local Fizzy identity, account, and write token
- creates or reuses a local Gitea administrator, a dedicated `platform-team` user, a service token, and a bootstrap repo
- updates the selected env file with:
  - `FIZZY_ACCOUNT_ID`
  - `FIZZY_API_TOKEN`
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
make fizzy-login-code ENV_FILE=yourname.env
```

Override the target email when needed:

```sh
make fizzy-login-code ENV_FILE=yourname.env EMAIL=someone@example.com
```

Defaults for Gitea:

- root URL: `http://localhost:3007`
- administrator username: `gitea-admin`
- administrator password: `gitea-admin`
- service user: `platform-team`
- service user password: `platform-team`
- bootstrap repo: `dev-sandbox`

By default, Kryo locks git-forge edits to the bootstrapped repo by setting `GIT_FORGE_ALLOW_REPO_OVERRIDE=false`.
Set it to `true` only if you intentionally want one Kryo instance to operate on multiple repos.

Override them when needed:

```sh
make bootstrap \
  ENV_FILE=.env.local \
  BOOTSTRAP_FIZZY_ACCOUNT_NAME='Mission Systems' \
  BOOTSTRAP_FIZZY_OWNER_NAME='Mission Admin' \
  BOOTSTRAP_FIZZY_OWNER_EMAIL='mission-admin@example.local' \
  BOOTSTRAP_GITEA_REPO_NAME='mission-control'
```

## Useful Make Targets

All of the targets below are Compose-backed and require `ENV_FILE=...`.

- `make bootstrap ENV_FILE=yourname.env`
- `make bootstrap-fizzy ENV_FILE=yourname.env`
- `make bootstrap-gitea ENV_FILE=yourname.env`
- `make deploy ENV_FILE=yourname.env`
- `make deploy-all ENV_FILE=yourname.env`
- `make up ENV_FILE=yourname.env`
- `make down ENV_FILE=yourname.env`
- `make down-reset ENV_FILE=yourname.env`
- `make docker-prune-dangling-volumes`
- `make docker-prune-dangling-images`
- `make ps ENV_FILE=yourname.env`
- `make logs ENV_FILE=yourname.env SERVICE=mcp`
- `make test-offline ENV_FILE=yourname.env`
- `make test-online ENV_FILE=yourname.env`
- `make lint ENV_FILE=yourname.env`
- `make format ENV_FILE=yourname.env`
- `make deadcode ENV_FILE=yourname.env`
- `make quality ENV_FILE=yourname.env`

`make test-online ENV_FILE=...` runs the standalone MCP HTTP end-to-end suite against a live server.
It uses `MCP_E2E_URL`, which defaults to `http://127.0.0.1:3100/mcp`.
When run through `make test-online`, the devbox container targets the Compose service URL `http://mcp:3100/mcp`.
`make deadcode ENV_FILE=...` runs `knip`.
`make quality ENV_FILE=...` runs `format:check`, `lint`, and `deadcode` in one step.
`make down-reset ENV_FILE=...` is the destructive reset path: it removes the local Compose volumes.
`make docker-prune-dangling-volumes` removes globally dangling Docker volumes, not just Kryo volumes.
`make docker-prune-dangling-images` removes globally dangling Docker images, not just Kryo images.

## Access Points

- MCP HTTP: `http://localhost:3100/mcp`
- `mcp` health: `http://localhost:3100/up`
- Fizzy: `http://localhost:3006`
- Gitea: `http://localhost:3007`

If you expose `kryo` on a non-local hostname, set `MCP_ALLOWED_HOSTS` to the ingress or proxy hostnames that should be accepted by the HTTP listener.
If you use stateful HTTP sessions, tune `MCP_SESSION_IDLE_TTL_MS` and `MCP_MAX_SESSIONS` for your expected client count and reconnect behavior.
