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
`GIT_FORGE_TOKEN` is required at startup because Kryo always exposes git-forge workflows; a Fizzy-only deployment mode is not currently supported.

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

Compose-backed targets require `ENV_FILE=...`.

### Stack

- `make deploy ENV_FILE=yourname.env` — bootstrap + start `mcp`
- `make deploy-all ENV_FILE=yourname.env` — deploy + start observability profile
- `make bootstrap ENV_FILE=yourname.env` — seed services and write credentials to env file
- `make bootstrap-fizzy ENV_FILE=yourname.env`
- `make bootstrap-gitea ENV_FILE=yourname.env`
- `make repair-fizzy-auth ENV_FILE=yourname.env` — re-bootstrap Fizzy auth and restart `mcp` (use when token expires)
- `make up ENV_FILE=yourname.env` — start all services with build
- `make down ENV_FILE=yourname.env`
- `make down-reset ENV_FILE=yourname.env` — destructive: removes Compose volumes
- `make restart ENV_FILE=yourname.env SERVICE=mcp`
- `make ps ENV_FILE=yourname.env`
- `make logs ENV_FILE=yourname.env SERVICE=mcp`
- `make fizzy-login-code ENV_FILE=yourname.env`
- `make docker-prune-dangling-volumes` — removes **all** globally dangling Docker volumes, not just Kryo
- `make docker-prune-dangling-images` — removes **all** globally dangling Docker images, not just Kryo

### Quality

All run inside the devbox container and require `ENV_FILE=...`.

- `make test-offline ENV_FILE=yourname.env`
- `make test-online ENV_FILE=yourname.env` — MCP HTTP e2e against `http://mcp:3100/mcp`
- `make lint ENV_FILE=yourname.env`
- `make format ENV_FILE=yourname.env`
- `make deadcode ENV_FILE=yourname.env` — runs `knip`
- `make quality ENV_FILE=yourname.env` — `format:check` + `lint` + `deadcode`

### Local LLM (Apple Silicon)

Requires [uv](https://github.com/astral-sh/uv). Uses vllm-mlx to serve a local model and run the demo agent.

- `make llm-install` — create `.venv` and install vllm-mlx
- `make llm-serve` — start vllm-mlx in the foreground (default model: `mlx-community/Qwen3-1.7B-4bit`)
- `make llm-serve-bg` — start in background, PID written to `var/llm/vllm-mlx.pid`
- `make llm-status` — check if the server is running
- `make llm-stop` — stop the background server
- `make llm-logs` — tail `var/llm/vllm-mlx.log`
- `make llm-smoke` — quick `/v1/models` probe
- `make llm-demo ENV_FILE=yourname.env` — reset demo state and run the end-to-end agent loop
- `make demo-reset ENV_FILE=yourname.env` — close open PRs, unassign card #1, move it back to To Do

Override the model:

```sh
make llm-serve VLLM_MLX_MODEL=mlx-community/Qwen3-4B-4bit
```

## Access Points

- MCP HTTP: `http://localhost:3100/mcp`
- `mcp` health: `http://localhost:3100/up`
- Fizzy: `http://localhost:3006`
- Gitea: `http://localhost:3007`

If you expose `kryo` on a non-local hostname, set `MCP_ALLOWED_HOSTS` to the ingress or proxy hostnames that should be accepted by the HTTP listener.
If you use stateful HTTP sessions, tune `MCP_SESSION_IDLE_TTL_MS` and `MCP_MAX_SESSIONS` for your expected client count and reconnect behavior.
