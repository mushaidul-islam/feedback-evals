# Truth Be Told — Backend

Go HTTP API scaffold. Config, structured logging, middleware, graceful
shutdown, and a health service — nothing else. Business features are built on
top of this.

**Stack:** Go 1.26 · [chi](https://github.com/go-chi/chi) router · stdlib
`log/slog` · no database yet.

---

## 1. Install Go

Needs **Go 1.26+**:

```bash
go version
```

If that prints nothing or a version below 1.26, install from
[go.dev/dl](https://go.dev/dl/) (`brew install go` on macOS).

You do not need an exact patch version — `go.mod` pins `toolchain go1.26.6`, so
any Go 1.21+ downloads the right one on first build.

## 2. Start the server

```bash
cd backend
cp .env.example .env
make run
```

```
time=2026-08-18T14:32:20.699Z level=INFO msg="server started" addr=0.0.0.0:8080 env=development version=dev
```

The server is listening on **http://localhost:8080**. Leave it running and open
a second terminal.

For automatic rebuilds on save:

```bash
go install github.com/air-verse/air@latest
make dev
```

`make dev` falls back to a plain run if `air` is missing. `make help` lists
every target; `make docker-up` runs the same thing in a container.

## 3. Call the health API

Two endpoints, answering two different questions.

### `GET /healthz` — is the process alive?

```bash
curl localhost:8080/healthz
```

```json
{ "status": "ok", "version": "dev", "uptime": "1m12s" }
```

If you get this, everything works: config loaded, router wired, middleware
running. `version` is the git SHA when built with `make build`, `dev` under
`make run` — that is how you confirm which build is deployed.

This endpoint checks **no** dependencies, deliberately. If it pinged the
database, an outage would make every replica report unhealthy, the orchestrator
would restart all of them, and nothing would be serving when the database came
back.

### `GET /readyz` — should this instance receive traffic?

```bash
curl -i localhost:8080/readyz
```

```json
{ "status": "ready", "checks": [] }
```

`checks` is empty because nothing is wired yet. This is the endpoint that
probes dependencies; when one fails it returns **503**, which tells a load
balancer to stop routing here without restarting the process.

### Adding a dependency check

One line in `cmd/server.go`:

```go
healthSvc := services.NewHealth(Version,
    services.Check{Name: "postgres", Probe: pool.Ping},
    services.Check{Name: "redis", Probe: redisClient.Ping},
)
```

Checks run concurrently, so latency is the slowest probe rather than the sum:

```json
{
  "status": "not_ready",
  "checks": [
    { "name": "postgres", "ok": true,  "latency": "3ms" },
    { "name": "redis",    "ok": false, "latency": "3s", "error": "dial tcp: i/o timeout" }
  ]
}
```

### Also worth trying

```bash
curl localhost:8080/api/v1/nope          # errors are always JSON, never plain text
curl -i localhost:8080/healthz | grep -i tracing   # every response carries a tracing ID
# Ctrl-C the server and watch it drain instead of dropping connections
```

---

## Structure

```
backend/
├── main.go                 # calls cmd.Server()
├── cmd/server.go           # config, wiring, graceful shutdown
├── internal/
│   ├── config/             # env → struct, loaded once
│   ├── handlers/           # HTTP layer: router.go + one file per feature
│   ├── services/           # business logic, knows nothing about HTTP
│   └── middleware/         # tracing, logging, recovery, CORS
├── pkg/utils/              # shared HTTP helpers, no app logic
├── deploy/docker/
├── Makefile
└── .env.example
```

Three layers, and each one has a rule:

| Layer | Rule |
|---|---|
| `handlers/` | Decode, delegate, encode. No business logic. |
| `services/` | Business logic. No `net/http`, no status codes. |
| `cmd/server.go` | The only place dependencies are constructed. |

## Adding a feature

1. `internal/services/<name>.go` — the logic, plus whatever types it returns
2. `internal/handlers/<name>.go` — decode → call the service → encode
3. Register routes in `internal/handlers/router.go`
4. Construct it in `cmd/server.go`

Health is the worked example: read those four places and copy the shape.

## Decisions, and why

**chi over Gin/Echo/Fiber.** Since Go 1.22 the stdlib router does method and
path matching, which was the main reason to reach for a framework. chi adds
only middleware chaining and sub-routers in ~1k lines with zero dependencies,
and its handlers *are* `http.Handler` — so stdlib and ecosystem middleware
(Sentry, OpenTelemetry) work unmodified, and dropping chi later is a small
change rather than a rewrite. Gin's `*gin.Context` would lock every handler
signature to Gin.

**Config loaded once in `cmd/`, passed down.** No `GetConfig()` singleton
reachable from anywhere. A global config is what makes packages impossible to
test without manipulating process env.

**No `godotenv.Load()` at startup.** `.env` is a developer convenience, not a
deployment mechanism. Loading one at startup means the binary refuses to run in
a container that has none.

**No `ports/` or `domain/` package.** An interface with exactly one
implementation is indirection without substitution. Go's convention is to
declare an interface where it is *consumed* — so when a real seam appears (a
database, say), declare `type Repo interface{...}` in the package that needs
it and pass an implementation in from `cmd/server.go`.

**Three layers, not five.** Layer count should follow from need. Adding
`ports/` and `domain/` before there is a second implementation costs two
directories and buys nothing.

**Two dependencies:** chi and `google/uuid`. Check the stdlib first before
adding a third — with `log/slog`, `errors.Join`, and Go 1.22 routing, it
usually covers it.

## Not built yet

No database, no auth, no tests, no CI. The seams:

- **Database** — construct the client in `cmd/server.go` and pass it to
  services. Recommended: **pgx v5 + sqlc + goose** — write SQL, sqlc generates
  typed Go against your schema, so a typo'd column fails the build rather than
  production.
- **Auth** — add `middleware.RequireAuth` and apply it to the `/api/v1`
  subtree in `router.go`. Validate the secret in `config.Load()` and return an
  error if it is missing; never default it.
- **Tests** — none yet, by choice, since there is no business logic to protect.
  Worth adding with the first real feature: stdlib `testing` plus
  `net/http/httptest` covers handlers with no extra dependency.

## Relationship to `docs/MVP.md`

`docs/MVP.md` specifies a TypeScript backend on Supabase Edge Functions and
Trigger.dev. This directory contradicts that — an unresolved divergence, not an
oversight (the spec also still says Vite while `frontend/` is Next.js). Worth
deciding before this takes real traffic. The rest of the spec — state machine,
data model, abuse rules — is unaffected by the language choice.
